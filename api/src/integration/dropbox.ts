import { authPlugin } from '@api/auth';
import { db } from '@api/env';
import { NexataFile } from '@api/file';
import {
	getFileCategory,
	getMimeTypeFromExt,
	isSupportedExt,
} from '@api/file/lib/types';
import {
	getIngestedDirIds,
	getIngestedFileIds,
	type IngestResult,
	type IngestSelection,
	isFileUnmodified,
	type NexataListDir,
	type NexataListDirEntry,
	resolveNexataSelection,
} from '@api/integration/lib';
import {
	credential,
	externalDir,
	FileHost,
	file,
	type Language,
	OauthProvider,
	TraceType,
	trace,
} from '@api/schema';
import type { ActiveUser } from '@api/utils/auth';
import {
	checkBatchCapacity,
	checkTenantCanIngest,
	clearIngestStopFlag,
	type FileEstimate,
	invalidateStorageUsage,
	isIngestStopped,
	setIngestStopFlag,
} from '@api/utils/billing';
import {
	ensureFreshTokens,
	getTokensForUser,
	userHasCredential,
} from '@api/utils/credential';
import { requireEnv } from '@api/utils/env';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { refreshDropboxTokens } from '@api/utils/token-refresh';
import { Nullish, tObject } from '@api/utils/type';
import { captureException } from '@sentry/bun';
import { and, eq, notInArray } from 'drizzle-orm';
import { Dropbox as DropboxClient } from 'dropbox';
import { Elysia, type Static, t } from 'elysia';
import pLimit from 'p-limit';

const INGEST_CONCURRENCY = 8;
const RECHECK_INTERVAL = 50;

function dedupeSelection(selection: { isDir: boolean; id: string }[]) {
	const unique = new Map<string, { isDir: boolean; id: string }>();

	for (const item of selection) unique.set(`${item.isDir}:${item.id}`, item);

	return [...unique.values()];
}

export namespace Dropbox {
	export const fromRequest = async (
		activeUser: ActiveUser,
		credentialId: string,
		adminExpected?: true,
	) => {
		const { at, rt } = await getTokensForUser(
			activeUser,
			credentialId,
			adminExpected,
		);

		return fromTokens(at, rt);
	};

	export const fromTokens = (accessToken: string, refreshToken: string) =>
		new DropboxClient({
			accessToken,
			refreshToken,
			clientId: requireEnv('DROPBOX_APP_KEY'),
			clientSecret: requireEnv('DROPBOX_APP_SECRET'),
		});

	export enum FileCategory {
		IMAGE = 'image',
		DOCUMENT = 'document',
		PDF = 'pdf',
		SPREADSHEET = 'spreadsheet',
		PRESENTATION = 'presentation',
		AUDIO = 'audio',
		VIDEO = 'video',
		FOLDER = 'folder',
		PAPER = 'paper',
		OTHERS = 'others',
		OTHER = 'other',
	}

	export async function refreshTokens(
		credentialId: string,
		options?: {
			slug?: string;
			language?: Language;
			tokens?: { refreshToken: string; accessToken: string };
		},
	) {
		return refreshDropboxTokens(credentialId, options);
	}

	export const [searchDescription, searchInput] = [
		'Dropbox tool to search for files using filesSearchV2. Prefer narrowing with path, extension, and category filters before relying on broad text alone. Use credentialEmail when the user wants only one Dropbox account searched.',
		t.Union([
			tObject({
				cursor: t.String({
					description:
						'Continuation token for the search. If provided, the search will continue from the previous page. If received, all other params are ignored.',
				}),
			}),
			tObject({
				credentialEmail: Nullish(t.String({ format: 'email' }), {
					description:
						'Limit the search to a specific connected Dropbox account. Use this when the user refers to only one Dropbox.',
				}),
				query: t.String({
					minLength: 1,
					description:
						'The string to search for. Use focused file names or short identifying terms, and combine with path, extension, or category filters when possible.',
				}),
				path: Nullish(t.String(), {
					description:
						"Scopes the search to a path or folder ID in the user's Dropbox. Searches the entire Dropbox if not specified. Prefer this when the user hints at a folder or location.",
				}),
				fileExtensions: Nullish(t.Array(t.String()), {
					description: 'Restricts search to only the extensions specified.',
				}),
				fileCategories: Nullish(t.Array(t.Enum(FileCategory)), {
					description: 'Restricts search to only the categories specified.',
				}),
			}),
		]),
	];

	export async function search(
		dpx: DropboxClient,
		input: Static<typeof searchInput>,
	): Promise<NexataListDir> {
		const res = await ('cursor' in input
			? dpx.filesSearchContinueV2({ cursor: input.cursor })
			: dpx.filesSearchV2({
					query: input.query ?? '',
					options: {
						path: input.path ?? '',
						max_results: 500,
						file_extensions: input.fileExtensions ?? undefined,
						file_categories:
							input.fileCategories?.map((c) => ({ '.tag': c })) ?? undefined,
					},
				}));

		if (res.status !== 200)
			throw httpError(HttpCode.CONFLICT, ErrorCode.EXTERNAL_ERROR);

		const entries = res.result.matches
			// biome-ignore lint/suspicious/noExplicitAny: Dropbox miss-type
			.flatMap((e) => (e.metadata as unknown as any).metadata)
			.map((e) => ({
				id: e.id ?? e.path_lower,
				name: e.name,
				url: `https://www.dropbox.com/home${e.path_lower}`,
				size: e.size ? e.size / (1024 * 1024) : undefined,
				path: e.path_display,
				ext: e['.tag'] === 'folder' ? 'dir' : e.name.split('.').pop(),
				updatedAt: e.server_modified ?? new Date(e.server_modified),
			}));

		const fileIds = entries.filter((e) => e.ext !== 'dir').map((e) => e.id);
		const dirIds = entries.filter((e) => e.ext === 'dir').map((e) => e.id);
		const [ingestedFiles, ingestedDirs] = await Promise.all([
			getIngestedFileIds(fileIds, FileHost.DROPBOX),
			getIngestedDirIds(dirIds, FileHost.DROPBOX),
		]);

		return {
			cursor: res.result.has_more ? (res.result.cursor ?? null) : null,
			entries: entries.map((e) => ({
				...e,
				nexataId:
					e.ext === 'dir'
						? (ingestedDirs.get(e.id) ?? null)
						: (ingestedFiles.get(e.id) ?? null),
			})),
		};
	}

	export const [listDirDescription, listDirInput] = [
		'Lists files and folders in a Dropbox directory.',
		t.Union([
			t.Object({
				cursor: t.String({
					description:
						'Continuation token for the search. If provided, the search will continue from the previous page. If received, all other params are ignored.',
				}),
			}),
			t.Object({
				path: Nullish(t.String(), {
					description:
						"Lists from a path or folder ID in the user's Dropbox. Uses the root directory if not specified.",
				}),
				recursive: Nullish(t.Boolean(), {
					default: false,
					description: 'Whether to recursively list files and folders.',
				}),
				limit: Nullish(t.Number({ minimum: 1 }), {
					default: 50,
					description: 'Maximum number of results to return.',
				}),
			}),
		]),
	];

	export async function listDir(
		dpx: DropboxClient,
		input: Static<typeof listDirInput>,
	): Promise<NexataListDir> {
		const res = await ('cursor' in input
			? dpx.filesListFolderContinue({ cursor: input.cursor })
			: dpx.filesListFolder({
					path: input.path ?? '',
					limit: input.limit ?? 50,
					recursive: input.recursive ?? false,
					include_media_info: true,
					include_non_downloadable_files: false,
				}));

		if (res.status !== 200)
			throw httpError(HttpCode.CONFLICT, ErrorCode.EXTERNAL_ERROR);

		const entries = res.result.entries.map((e) => ({
			// @ts-expect-error
			id: e.id ?? e.path_lower,
			name: e.name,
			url: `https://www.dropbox.com/home${e.path_lower}`,
			// @ts-expect-error
			size: e.size ? e.size / (1024 * 1024) : undefined,
			path: e.path_display,
			ext: e['.tag'] === 'folder' ? 'dir' : e.name.split('.').pop(),
			// @ts-expect-error
			updatedAt: e.server_modified ?? new Date(e.server_modified),
		}));

		const fileIds = entries.filter((e) => e.ext !== 'dir').map((e) => e.id);
		const dirIds = entries.filter((e) => e.ext === 'dir').map((e) => e.id);
		const [ingestedFiles, ingestedDirs] = await Promise.all([
			getIngestedFileIds(fileIds, FileHost.DROPBOX),
			getIngestedDirIds(dirIds, FileHost.DROPBOX),
		]);

		return {
			cursor: res.result.has_more ? res.result.cursor : null,
			entries: entries.map((e) => ({
				...e,
				nexataId:
					e.ext === 'dir'
						? (ingestedDirs.get(e.id) ?? null)
						: (ingestedFiles.get(e.id) ?? null),
			})),
		};
	}

	async function listAllFiles(
		dpx: DropboxClient,
		path: string,
	): Promise<NexataListDirEntry[]> {
		const initial = await listDir(dpx, { path, recursive: true, limit: 2000 });
		const allEntries = initial.entries;
		let cursor = initial.cursor;

		while (cursor) {
			const continued = await listDir(dpx, { cursor });
			allEntries.push(...continued.entries);
			cursor = continued.cursor;
		}

		return allEntries;
	}

	export async function downloadFile(
		dpx: DropboxClient,
		fileId: string,
	): Promise<{
		file: File;
		id: string;
		name: string;
		path: string;
		modifiedAt: Date;
	}> {
		const res = await dpx.filesDownload({ path: fileId });

		if (res.status !== 200)
			throw httpError(HttpCode.CONFLICT, ErrorCode.EXTERNAL_ERROR);

		const result = res.result as typeof res.result & {
			fileBinary?: Uint8Array;
			fileBlob?: Blob;
		};

		const fileData = result.fileBinary ?? result.fileBlob;
		if (!fileData)
			throw httpError(HttpCode.CONFLICT, ErrorCode.NO_FILE_CONTENT);

		const mimeType = getMimeTypeFromExt(result.name);
		if (mimeType === 'unsupported')
			throw httpError(HttpCode.CONFLICT, ErrorCode.UNSUPPORTED_FILE_TYPE);

		const buffer =
			fileData instanceof Blob
				? await fileData.arrayBuffer()
				: (fileData.buffer as ArrayBuffer);

		return {
			file: new File([buffer], result.name, { type: mimeType }),
			id: result.id,
			name: result.name,
			path: result.path_display ?? result.path_lower ?? '',
			modifiedAt: new Date(result.server_modified),
		};
	}

	async function ingestFile(
		dpx: DropboxClient,
		userId: string,
		slug: string,
		credentialId: string,
		entry: NexataListDirEntry,
		externalDirId?: string,
	): Promise<string> {
		try {
			const downloaded = await downloadFile(dpx, entry.id);

			const result = await NexataFile.ingest(
				{
					userId,
					slug,
					provider: FileHost.DROPBOX,
					externalDirId,
					externalId: downloaded.id,
					credentialId,
					autoSync: true,
					url: entry.url,
					name: downloaded.name,
					type: downloaded.file.type,
					modifiedAt: downloaded.modifiedAt,
				},
				downloaded.file,
			);

			return result;
		} catch (error) {
			captureException(error, {
				tags: { source: 'Dropbox.ingestFile' },
				extra: { userId, entry },
			});

			await db.insert(trace).values({
				userId,
				type: TraceType.INGEST_FAILED,
				metadata: {
					provider: FileHost.DROPBOX,
					externalId: entry.id,
					name: entry.name,
					error: error instanceof Error ? error.message : 'UNKNOWN',
				},
			});

			return 'FAILED';
		}
	}

	async function ingestDirectory(
		dpx: DropboxClient,
		userId: string,
		slug: string,
		credentialId: string,
		dirEntry: NexataListDirEntry,
	): Promise<{ ok: number; unmodified: number; failed: number }> {
		const stats = { ok: 0, unmodified: 0, failed: 0 };

		const existing = (
			await db
				.select({ id: externalDir.id })
				.from(externalDir)
				.where(
					and(
						eq(externalDir.provider, FileHost.DROPBOX),
						eq(externalDir.externalId, dirEntry.id),
					),
				)
		).at(0);

		const dirId =
			existing?.id ??
			(
				await db
					.insert(externalDir)
					.values({
						externalId: dirEntry.id,
						credentialId,
						name: dirEntry.name,
						provider: FileHost.DROPBOX,
						url: dirEntry.url,
						autoSync: true,
						modifiedAt: dirEntry.updatedAt ?? new Date(),
					})
					.returning({ id: externalDir.id })
			).at(0)?.id;
		if (!dirId)
			throw httpError(
				HttpCode.INTERNAL_SERVER_ERROR,
				ErrorCode.EXTERNAL_DIR_FAILED,
			);

		const allEntries = await listAllFiles(dpx, dirEntry.id);
		const fileEntries = allEntries.filter(
			(e) => e.ext !== 'dir' && isSupportedExt(e.name),
		);
		const currentExternalIds = fileEntries.map((e) => e.id);

		if (existing && currentExternalIds.length)
			if (
				(
					await db
						.delete(file)
						.where(
							and(
								eq(file.externalDirId, dirId),
								eq(file.provider, FileHost.DROPBOX),
								notInArray(file.externalId, currentExternalIds),
							),
						)
						.returning({ id: file.id })
				).length
			)
				await invalidateStorageUsage(slug);

		const estimates: FileEstimate[] = fileEntries.map((e) => ({
			sizeBytes: (e.size ?? 0) * 1024 * 1024,
			category: getFileCategory(e.name),
		}));

		const capacity = await checkBatchCapacity(slug, estimates);
		if (!capacity.canProceed) {
			stats.failed += fileEntries.length;
			return stats;
		}

		const entriesToProcess =
			capacity.maxFiles !== null
				? fileEntries.slice(0, capacity.maxFiles)
				: fileEntries;

		if (capacity.maxFiles !== null)
			stats.failed += fileEntries.length - capacity.maxFiles;

		await clearIngestStopFlag(slug);
		const limit = pLimit(INGEST_CONCURRENCY);
		let processedCount = 0;

		const results = await Promise.allSettled(
			entriesToProcess.map((entry) =>
				limit(async () => {
					if (await isIngestStopped(slug)) return 'FAILED';

					if (++processedCount % RECHECK_INTERVAL === 0) {
						const blockReason = await checkTenantCanIngest(slug);
						if (blockReason) {
							await setIngestStopFlag(slug);
							return 'FAILED';
						}
					}

					return ingestFile(dpx, userId, slug, credentialId, entry, dirId);
				}),
			),
		);

		for (const result of results) {
			if (result.status === 'rejected') {
				stats.failed++;
			} else {
				const key = result.value.toLowerCase() as keyof typeof stats;
				stats[key]++;
			}
		}

		return stats;
	}

	export const [ingestDescription, ingestInput] = [
		'Dropbox tool to ingest (download and vectorize) files or folders from Dropbox into Nexata. Use DropboxSearch or DropboxListDir first to find items, then pass their external IDs here. Directories are ingested recursively. Only use when the user explicitly requests ingestion.',
		tObject({
			selection: t.Array(
				tObject({
					id: t.String({
						description: 'External Dropbox ID of the file or folder.',
					}),
					isDir: t.Boolean({
						description: 'Whether the item is a directory.',
					}),
				}),
				{ minItems: 1 },
			),
		}),
	];

	export async function ingest(
		dpx: DropboxClient,
		userId: string,
		slug: string,
		credentialId: string,
		selection: { isDir: boolean; id: string }[],
	) {
		const sorted = dedupeSelection(selection).sort(({ isDir }) =>
			isDir ? -1 : 1,
		);

		const results = { ok: 0, unmodified: 0, failed: 0 };

		const limit = pLimit(INGEST_CONCURRENCY);

		const taskResults = await Promise.allSettled(
			sorted.map((item) =>
				limit(async () => {
					if (item.isDir) {
						const dirInfo = await getDirInfo(dpx, item.id);
						return ingestDirectory(dpx, userId, slug, credentialId, dirInfo);
					}

					const blockReason = await checkTenantCanIngest(slug);
					if (blockReason) return { ok: 0, unmodified: 0, failed: 1 };

					const fileInfo = await getFileInfo(dpx, item.id);
					if (
						await isFileUnmodified(
							FileHost.DROPBOX,
							item.id,
							fileInfo.updatedAt,
						)
					)
						return { ok: 0, unmodified: 1, failed: 0 };
					const result = await ingestFile(
						dpx,
						userId,
						slug,
						credentialId,
						fileInfo,
					);
					return {
						ok: result === 'OK' ? 1 : 0,
						unmodified: result === 'UNMODIFIED' ? 1 : 0,
						failed: result !== 'OK' && result !== 'UNMODIFIED' ? 1 : 0,
					};
				}),
			),
		);

		for (const r of taskResults) {
			if (r.status === 'fulfilled') {
				results.ok += r.value.ok;
				results.unmodified += r.value.unmodified;
				results.failed += r.value.failed;
			} else {
				results.failed++;
			}
		}

		return results;
	}

	export async function ingestFromCredential(
		userId: string,
		slug: string,
		credentialId: string,
		selection: IngestSelection[],
	): Promise<IngestResult> {
		const failedResult: IngestResult = {
			ok: 0,
			unmodified: 0,
			failed: selection.length || 1,
		};

		const tokens = (
			await db
				.select({
					refreshToken: credential.refreshToken,
					accessToken: credential.accessToken,
					accessTokenExpiresAt: credential.accessTokenExpiresAt,
				})
				.from(credential)
				.where(
					and(
						eq(credential.id, credentialId),
						eq(credential.provider, OauthProvider.DROPBOX),
					),
				)
		).at(0);

		if (!tokens) {
			captureException(new Error('Credential not found during Dropbox sync'), {
				tags: { source: 'Dropbox.ingestFromCredential' },
				extra: { userId, credentialId },
			});
			if (selection.length)
				await db.insert(trace).values(
					selection.map((item) => ({
						userId,
						type: TraceType.INGEST_FAILED,
						metadata: {
							provider: FileHost.DROPBOX,
							externalId: item.id,
							name: item.id,
							error: 'CREDENTIAL_LOST',
						},
					})),
				);
			return failedResult;
		}

		let at: string;
		let rt: string;
		try {
			({ at, rt } = await ensureFreshTokens(
				credentialId,
				OauthProvider.DROPBOX,
				tokens.accessToken,
				tokens.refreshToken,
				tokens.accessTokenExpiresAt,
				slug,
			));
		} catch (error) {
			captureException(error, {
				tags: { source: 'Dropbox.ingestFromCredential' },
				extra: { userId, credentialId },
			});
			if (selection.length)
				await db.insert(trace).values(
					selection.map((item) => ({
						userId,
						type: TraceType.INGEST_FAILED,
						metadata: {
							provider: FileHost.DROPBOX,
							externalId: item.id,
							name: item.id,
							error:
								error instanceof Error ? error.message : 'TOKEN_REFRESH_FAILED',
						},
					})),
				);
			return failedResult;
		}

		const dpx = fromTokens(at, rt);
		return ingest(dpx, userId, slug, credentialId, selection);
	}

	async function getDirInfo(
		dpx: DropboxClient,
		dirId: string,
	): Promise<NexataListDirEntry> {
		const res = await dpx.filesGetMetadata({ path: dirId });
		if (res.status !== 200)
			throw httpError(HttpCode.CONFLICT, ErrorCode.EXTERNAL_ERROR);

		const e = res.result;
		return {
			// @ts-expect-error
			id: e.id ?? e.path_lower,
			name: e.name,
			url: `https://www.dropbox.com/home${e.path_lower}`,
			path: e.path_display,
			ext: 'dir',
			nexataId: null,
		};
	}

	async function getFileInfo(
		dpx: DropboxClient,
		fileId: string,
	): Promise<NexataListDirEntry> {
		const res = await dpx.filesGetMetadata({ path: fileId });
		if (res.status !== 200)
			throw httpError(HttpCode.CONFLICT, ErrorCode.EXTERNAL_ERROR);

		const e = res.result;
		return {
			// @ts-expect-error
			id: e.id ?? e.path_lower,
			name: e.name,
			url: `https://www.dropbox.com/home${e.path_lower}`,
			// @ts-expect-error
			size: e.size ? e.size / (1024 * 1024) : undefined,
			path: e.path_display,
			ext: e.name.split('.').pop(),
			// @ts-expect-error
			updatedAt: e.server_modified ? new Date(e.server_modified) : undefined,
			nexataId: null,
		};
	}
}

export const dropboxRouter = new Elysia({ prefix: '/dropbox' })
	.use(authPlugin())
	.get(
		'/search/:credentialId',
		async ({ params: { credentialId }, query, activeUser }) => {
			const hasPermission = await userHasCredential(activeUser, credentialId);
			if (!hasPermission)
				throw httpError(
					HttpCode.FORBIDDEN,
					ErrorCode.NO_CREDENTIAL_PERMISSION,
					activeUser.language as Language,
				);
			return Dropbox.search(
				await Dropbox.fromRequest(activeUser, credentialId),
				query,
			);
		},
		{
			detail: {
				summary: 'Search dropbox',
				description: Dropbox.searchDescription,
			},
			params: tObject({ credentialId: t.String({ format: 'uuid' }) }),
			query: Dropbox.searchInput,
		},
	)
	.get(
		'/:credentialId',
		async ({ params: { credentialId }, query, activeUser }) => {
			const hasPermission = await userHasCredential(activeUser, credentialId);
			if (!hasPermission)
				throw httpError(
					HttpCode.FORBIDDEN,
					ErrorCode.NO_CREDENTIAL_PERMISSION,
					activeUser.language as Language,
				);
			return Dropbox.listDir(
				await Dropbox.fromRequest(activeUser, credentialId),
				query,
			);
		},
		{
			detail: {
				summary: 'List dropbox dir',
				description: Dropbox.listDirDescription,
			},
			params: tObject({ credentialId: t.String({ format: 'uuid' }) }),
			query: Dropbox.listDirInput,
		},
	)
	.put(
		'/refresh/:credentialId',
		async ({ params: { credentialId }, activeUser }) => {
			const hasPermission = await userHasCredential(
				activeUser,
				credentialId,
				true,
			);
			if (!hasPermission)
				throw httpError(
					HttpCode.FORBIDDEN,
					ErrorCode.NO_CREDENTIAL_PERMISSION,
					activeUser.language as Language,
				);

			return Dropbox.refreshTokens(credentialId, {
				slug: activeUser.slug,
				language: activeUser.language as Language,
			});
		},
		{
			detail: { summary: 'Refresh dropbox credential' },
			params: tObject({ credentialId: t.String({ format: 'uuid' }) }),
		},
	)
	.post(
		'/ingest',
		async ({ activeUser, body }) => {
			const blockReason = await checkTenantCanIngest(activeUser.slug);
			if (blockReason) {
				if (blockReason === 'PAYMENT_REQUIRED')
					throw httpError(
						HttpCode.PAYMENT_REQUIRED,
						ErrorCode.PAYMENT_REQUIRED,
						activeUser.language,
					);

				throw httpError(
					HttpCode.PRECONDITION_FAILED,
					ErrorCode[blockReason as keyof typeof ErrorCode],
					activeUser.language,
				);
			}

			return Dropbox.ingest(
				await Dropbox.fromRequest(activeUser, body.credentialId, true),
				activeUser.id,
				activeUser.slug,
				body.credentialId,
				body.selection,
			);
		},
		{
			detail: { summary: 'Ingest from dropbox' },
			body: tObject({
				credentialId: t.String({ format: 'uuid' }),
				selection: t.Array(
					tObject({
						id: t.String(),
						isDir: t.Boolean({
							description: 'Whether the item is a directory',
						}),
					}),
				),
			}),
		},
	)
	.post(
		'/re-ingest',
		async ({ activeUser, body }) => {
			const blockReason = await checkTenantCanIngest(activeUser.slug);
			if (blockReason) {
				if (blockReason === 'PAYMENT_REQUIRED')
					throw httpError(
						HttpCode.PAYMENT_REQUIRED,
						ErrorCode.PAYMENT_REQUIRED,
						activeUser.language,
					);

				throw httpError(
					HttpCode.PRECONDITION_FAILED,
					ErrorCode[blockReason as keyof typeof ErrorCode],
					activeUser.language,
				);
			}

			const resolved = await resolveNexataSelection(
				body.selection,
				FileHost.DROPBOX,
			);

			return Dropbox.ingest(
				await Dropbox.fromRequest(activeUser, body.credentialId, true),
				activeUser.id,
				activeUser.slug,
				body.credentialId,
				resolved,
			);
		},
		{
			detail: { summary: 'Re-ingest from dropbox' },
			body: tObject({
				credentialId: t.String({ format: 'uuid' }),
				selection: t.Array(
					tObject({
						id: t.String({ format: 'uuid' }),
						isDir: t.Boolean({
							description: 'Whether the item is a directory',
						}),
					}),
				),
			}),
		},
	);
