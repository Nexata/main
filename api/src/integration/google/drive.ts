import { authPlugin } from '@api/auth';
import { db } from '@api/env';
import { NexataFile } from '@api/file';
import { getMimeTypeFromExt } from '@api/file/lib/types';
import { Google } from '@api/integration/google/lib';
import {
	getIngestedDirIds,
	getIngestedFileIds,
	type IngestSelection,
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
	OauthScope,
	TraceType,
	trace,
} from '@api/schema';
import type { ActiveUser } from '@api/utils/auth';
import { checkTenantCanIngest } from '@api/utils/billing';
import {
	ensureFreshTokens,
	getTokensForUser,
	userHasCredential,
} from '@api/utils/credential';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { Nullish, tObject } from '@api/utils/type';
import { drive, type drive_v3 } from '@googleapis/drive';
import { captureException } from '@sentry/bun';
import { and, eq, notInArray } from 'drizzle-orm';
import { Elysia, type Static, t } from 'elysia';

const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

const GOOGLE_WORKSPACE_MIME_TYPES = {
	'application/vnd.google-apps.document': {
		exportMime: 'application/pdf',
		ext: 'pdf',
	},
	'application/vnd.google-apps.spreadsheet': {
		exportMime:
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		ext: 'xlsx',
	},
	'application/vnd.google-apps.presentation': {
		exportMime: 'application/pdf',
		ext: 'pdf',
	},
	'application/vnd.google-apps.drawing': {
		exportMime: 'image/png',
		ext: 'png',
	},
} as const;

const FILE_FIELDS =
	'id, name, mimeType, size, modifiedTime, webViewLink, parents';

export namespace Drive {
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

	export const fromTokens = (access_token: string, refresh_token: string) => {
		const auth = Google.createOAuth2Client();
		auth.setCredentials({ access_token, refresh_token });
		return drive({ version: 'v3', auth });
	};

	export enum FileCategory {
		IMAGE = 'image',
		DOCUMENT = 'document',
		PDF = 'pdf',
		SPREADSHEET = 'spreadsheet',
		PRESENTATION = 'presentation',
		AUDIO = 'audio',
		VIDEO = 'video',
		FOLDER = 'folder',
		OTHER = 'other',
	}

	const CATEGORY_MIME_PATTERNS: Record<FileCategory, string[]> = {
		[FileCategory.FOLDER]: [FOLDER_MIME_TYPE],
		[FileCategory.DOCUMENT]: [
			'application/vnd.google-apps.document',
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			'application/msword',
			'text/',
		],
		[FileCategory.SPREADSHEET]: [
			'application/vnd.google-apps.spreadsheet',
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'application/vnd.ms-excel',
		],
		[FileCategory.PRESENTATION]: [
			'application/vnd.google-apps.presentation',
			'application/vnd.openxmlformats-officedocument.presentationml.presentation',
			'application/vnd.ms-powerpoint',
		],
		[FileCategory.PDF]: ['application/pdf'],
		[FileCategory.IMAGE]: ['image/'],
		[FileCategory.AUDIO]: ['audio/'],
		[FileCategory.VIDEO]: ['video/'],
		[FileCategory.OTHER]: [],
	};

	function buildMimeTypeQuery(categories: FileCategory[]): string {
		const conditions: string[] = [];

		for (const category of categories) {
			const patterns = CATEGORY_MIME_PATTERNS[category];
			for (const pattern of patterns) {
				if (pattern.endsWith('/')) {
					conditions.push(`mimeType contains '${pattern}'`);
				} else {
					conditions.push(`mimeType = '${pattern}'`);
				}
			}
		}

		return conditions.length ? `(${conditions.join(' or ')})` : '';
	}

	function buildSearchQuery(
		input: Exclude<Static<typeof searchInput>, { cursor: string }>,
	): string {
		const parts: string[] = ['trashed = false'];

		if (input.query) parts.push(`fullText contains '${input.query}'`);
		if (input.name) parts.push(`name contains '${input.name}'`);
		if (input.path) parts.push(`'${input.path}' in parents`);
		if (input.modifiedAfter)
			parts.push(`modifiedTime > '${input.modifiedAfter}'`);
		if (input.modifiedBefore)
			parts.push(`modifiedTime < '${input.modifiedBefore}'`);
		if (input.ownedByMe === true) parts.push("'me' in owners");
		if (input.ownedByMe === false) parts.push("not 'me' in owners");
		if (input.sharedWithMe === true) parts.push('sharedWithMe = true');
		if (input.starred === true) parts.push('starred = true');
		if (input.fileCategories?.length) {
			const mimeQuery = buildMimeTypeQuery(input.fileCategories);
			if (mimeQuery) parts.push(mimeQuery);
		}
		if (input.fileExtensions?.length) {
			const extConditions = input.fileExtensions.map(
				(ext) => `fileExtension = '${ext.replace(/^\./, '')}'`,
			);
			parts.push(`(${extConditions.join(' or ')})`);
		}

		return parts.join(' and ');
	}

	function mapFileToEntry(f: drive_v3.Schema$File): NexataListDirEntry {
		const isFolder = f.mimeType === FOLDER_MIME_TYPE;
		const googleExt =
			GOOGLE_WORKSPACE_MIME_TYPES[
				f.mimeType as keyof typeof GOOGLE_WORKSPACE_MIME_TYPES
			]?.ext;
		const ext = isFolder
			? 'dir'
			: (googleExt ??
				(f.name?.includes('.') ? f.name.split('.').pop() : undefined));

		return {
			id: f.id!,
			name: f.name ?? 'Unknown',
			nexataId: null,
			url:
				f.webViewLink ??
				(isFolder
					? `https://drive.google.com/drive/folders/${f.id}`
					: `https://drive.google.com/file/d/${f.id}/view`),
			size: f.size ? Number(f.size) / (1024 * 1024) : undefined,
			path: f.parents?.at(0),
			ext,
			updatedAt: f.modifiedTime ? new Date(f.modifiedTime) : undefined,
		};
	}

	export const [searchDescription, searchInput] = [
		'Google Drive tool to search for files using Drive query syntax.',
		t.Union([
			t.Object({
				cursor: t.String({
					description:
						'Continuation token for pagination. If provided, other params are ignored.',
				}),
			}),
			t.Object({
				query: Nullish(t.String(), {
					description: 'Full-text search query for file content and metadata.',
				}),
				name: Nullish(t.String(), {
					description: 'Filter by file name (contains match).',
				}),
				path: Nullish(t.String(), {
					description:
						"Folder ID to search within. Uses 'root' for the root folder.",
				}),
				fileExtensions: Nullish(t.Array(t.String()), {
					description:
						"Restrict search to specific file extensions (e.g., ['pdf', 'docx']).",
				}),
				fileCategories: Nullish(t.Array(t.Enum(FileCategory)), {
					description:
						'Restrict search to specific file categories (image, document, pdf, spreadsheet, presentation, audio, video, folder).',
				}),
				modifiedAfter: Nullish(t.String({ format: 'date-time' }), {
					description: 'Filter files modified after this date (ISO 8601).',
				}),
				modifiedBefore: Nullish(t.String({ format: 'date-time' }), {
					description: 'Filter files modified before this date (ISO 8601).',
				}),
				ownedByMe: Nullish(t.Boolean(), {
					description:
						'Filter by ownership: true for files owned by me, false for files not owned by me.',
				}),
				sharedWithMe: Nullish(t.Boolean(), {
					description: 'Filter for files shared with me.',
				}),
				starred: Nullish(t.Boolean(), {
					description: 'Filter for starred files.',
				}),
				maxResults: Nullish(t.Number({ minimum: 1, maximum: 1000 }), {
					default: 100,
					description: 'Maximum number of results to return (max 1000).',
				}),
			}),
		]),
	];

	export async function search(
		drv: drive_v3.Drive,
		input: Static<typeof searchInput>,
	): Promise<NexataListDir> {
		const res =
			'cursor' in input
				? await drv.files.list({
						pageToken: input.cursor,
						fields: `nextPageToken, files(${FILE_FIELDS})`,
					})
				: await drv.files.list({
						q: buildSearchQuery(input),
						pageSize: input.maxResults ?? 100,
						fields: `nextPageToken, files(${FILE_FIELDS})`,
					});

		if (res.status !== 200)
			throw httpError(HttpCode.CONFLICT, ErrorCode.EXTERNAL_ERROR);

		const entries = (res.data.files ?? []).map(mapFileToEntry);

		const fileIds = entries.filter((e) => e.ext !== 'dir').map((e) => e.id);
		const dirIds = entries.filter((e) => e.ext === 'dir').map((e) => e.id);
		const [ingestedFiles, ingestedDirs] = await Promise.all([
			getIngestedFileIds(fileIds, FileHost.DRIVE),
			getIngestedDirIds(dirIds, FileHost.DRIVE),
		]);

		return {
			cursor: res.data.nextPageToken ?? null,
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
		'Lists files and folders in a Google Drive directory.',
		t.Union([
			t.Object({
				cursor: t.String({
					description:
						'Continuation token for pagination. If provided, other params are ignored.',
				}),
			}),
			t.Object({
				path: Nullish(t.String(), {
					description:
						"Folder ID to list contents of. Uses 'root' for the root folder if not specified.",
				}),
				recursive: Nullish(t.Boolean(), {
					default: false,
					description:
						'Whether to recursively list all files and subfolders. When true, lists entire folder tree.',
				}),
				limit: Nullish(t.Number({ minimum: 1, maximum: 1000 }), {
					default: 100,
					description: 'Maximum number of results per page.',
				}),
			}),
		]),
	];

	async function enrichEntries(
		entries: NexataListDirEntry[],
	): Promise<NexataListDirEntry[]> {
		const fileIds = entries.filter((e) => e.ext !== 'dir').map((e) => e.id);
		const dirIds = entries.filter((e) => e.ext === 'dir').map((e) => e.id);
		const [ingestedFiles, ingestedDirs] = await Promise.all([
			getIngestedFileIds(fileIds, FileHost.DRIVE),
			getIngestedDirIds(dirIds, FileHost.DRIVE),
		]);

		return entries.map((e) => ({
			...e,
			nexataId:
				e.ext === 'dir'
					? (ingestedDirs.get(e.id) ?? null)
					: (ingestedFiles.get(e.id) ?? null),
		}));
	}

	export async function listDir(
		drv: drive_v3.Drive,
		input: Static<typeof listDirInput>,
	): Promise<NexataListDir> {
		if ('cursor' in input) {
			const res = await drv.files.list({
				pageToken: input.cursor,
				fields: `nextPageToken, files(${FILE_FIELDS})`,
			});

			if (res.status !== 200)
				throw httpError(HttpCode.CONFLICT, ErrorCode.EXTERNAL_ERROR);

			return {
				cursor: res.data.nextPageToken ?? null,
				entries: await enrichEntries(
					(res.data.files ?? []).map(mapFileToEntry),
				),
			};
		}

		const folderId = input.path ?? 'root';
		const q = input.recursive
			? `trashed = false`
			: `'${folderId}' in parents and trashed = false`;

		const res = await drv.files.list({
			q,
			pageSize: input.limit ?? 100,
			fields: `nextPageToken, files(${FILE_FIELDS})`,
			...(input.recursive && folderId !== 'root'
				? {
						driveId: folderId,
						includeItemsFromAllDrives: true,
						corpora: 'drive',
					}
				: {}),
		});

		if (res.status !== 200)
			throw httpError(HttpCode.CONFLICT, ErrorCode.EXTERNAL_ERROR);

		let entries = (res.data.files ?? []).map(mapFileToEntry);

		if (input.recursive && folderId !== 'root') {
			entries = entries.filter(
				(e) => e.path === folderId || isDescendantOf(entries, e, folderId),
			);
		}

		return {
			cursor: res.data.nextPageToken ?? null,
			entries: await enrichEntries(entries),
		};
	}

	function isDescendantOf(
		entries: NexataListDirEntry[],
		entry: NexataListDirEntry,
		targetId: string,
	): boolean {
		if (entry.path === targetId) return true;
		if (!entry.path) return false;

		const parent = entries.find((e) => e.id === entry.path);
		if (!parent) return false;

		return isDescendantOf(entries, parent, targetId);
	}

	async function listAllFiles(
		drv: drive_v3.Drive,
		folderId: string,
	): Promise<NexataListDirEntry[]> {
		const allEntries: NexataListDirEntry[] = [];
		let pageToken: string | undefined;

		const q = `'${folderId}' in parents and trashed = false`;

		do {
			const res = await drv.files.list({
				q,
				pageSize: 1000,
				pageToken,
				fields: `nextPageToken, files(${FILE_FIELDS})`,
			});

			if (res.status !== 200)
				throw httpError(HttpCode.CONFLICT, ErrorCode.EXTERNAL_ERROR);

			const entries = (res.data.files ?? []).map(mapFileToEntry);
			allEntries.push(...entries);

			const folders = entries.filter((e) => e.ext === 'dir');
			for (const folder of folders) {
				const subEntries = await listAllFiles(drv, folder.id);
				allEntries.push(...subEntries);
			}

			pageToken = res.data.nextPageToken ?? undefined;
		} while (pageToken);

		return allEntries;
	}

	export async function downloadFile(
		drv: drive_v3.Drive,
		fileId: string,
	): Promise<{
		file: File;
		id: string;
		name: string;
		path: string;
		modifiedAt: Date;
	}> {
		const metadata = await drv.files.get({
			fileId,
			fields: 'id, name, mimeType, size, modifiedTime, parents',
		});

		if (metadata.status !== 200)
			throw httpError(HttpCode.CONFLICT, ErrorCode.EXTERNAL_ERROR);

		const { mimeType, name } = metadata.data;
		if (!name) throw httpError(HttpCode.CONFLICT, ErrorCode.NO_FILE_NAME);

		const isGoogleDoc = mimeType?.startsWith('application/vnd.google-apps.');
		const exportInfo =
			GOOGLE_WORKSPACE_MIME_TYPES[
				mimeType as keyof typeof GOOGLE_WORKSPACE_MIME_TYPES
			];

		let fileContent: ArrayBuffer;
		let finalMime: string;
		let finalName: string;

		if (isGoogleDoc && exportInfo) {
			const res = await drv.files.export(
				{ fileId, mimeType: exportInfo.exportMime },
				{ responseType: 'arraybuffer' },
			);
			fileContent = res.data as ArrayBuffer;
			finalMime = exportInfo.exportMime;
			finalName = `${name.replace(/\.[^.]+$/, '')}.${exportInfo.ext}`;
			if (finalName === `.${exportInfo.ext}`)
				finalName = `${name}.${exportInfo.ext}`;
		} else if (isGoogleDoc) {
			throw httpError(HttpCode.CONFLICT, ErrorCode.UNSUPPORTED_FILE_TYPE);
		} else {
			const res = await drv.files.get(
				{ fileId, alt: 'media' },
				{ responseType: 'arraybuffer' },
			);
			fileContent = res.data as ArrayBuffer;
			finalMime = mimeType || getMimeTypeFromExt(name);
			finalName = name;
		}

		if (finalMime === 'unsupported')
			throw httpError(HttpCode.CONFLICT, ErrorCode.UNSUPPORTED_FILE_TYPE);

		return {
			file: new File([fileContent], finalName, { type: finalMime }),
			id: metadata.data.id!,
			name: finalName,
			path: metadata.data.parents?.at(0) ?? '',
			modifiedAt: new Date(metadata.data.modifiedTime!),
		};
	}

	async function ingestFile(
		drv: drive_v3.Drive,
		userId: string,
		slug: string,
		credentialId: string,
		entry: NexataListDirEntry,
		externalDirId?: string,
	): Promise<string> {
		try {
			const downloaded = await downloadFile(drv, entry.id);

			const result = await NexataFile.ingest(
				{
					userId,
					slug,
					provider: FileHost.DRIVE,
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
				tags: { source: 'Drive.ingestFile' },
				extra: { userId, entry },
			});

			await db.insert(trace).values({
				userId,
				type: TraceType.INGEST_FAILED,
				metadata: {
					provider: FileHost.DRIVE,
					externalId: entry.id,
					name: entry.name,
					error: error instanceof Error ? error.message : 'UNKNOWN',
				},
			});

			return 'FAILED';
		}
	}

	async function getDirInfo(
		drv: drive_v3.Drive,
		dirId: string,
	): Promise<NexataListDirEntry> {
		const res = await drv.files.get({
			fileId: dirId,
			fields: 'id, name, mimeType, webViewLink, modifiedTime',
		});

		if (res.status !== 200)
			throw httpError(HttpCode.CONFLICT, ErrorCode.EXTERNAL_ERROR);

		return {
			id: res.data.id!,
			name: res.data.name!,
			nexataId: null,
			url:
				res.data.webViewLink ??
				`https://drive.google.com/drive/folders/${res.data.id}`,
			ext: 'dir',
			updatedAt: res.data.modifiedTime
				? new Date(res.data.modifiedTime)
				: undefined,
		};
	}

	async function getFileInfo(
		drv: drive_v3.Drive,
		fileId: string,
	): Promise<NexataListDirEntry> {
		const res = await drv.files.get({
			fileId,
			fields: FILE_FIELDS,
		});

		if (res.status !== 200)
			throw httpError(HttpCode.CONFLICT, ErrorCode.EXTERNAL_ERROR);

		return mapFileToEntry(res.data);
	}

	async function ingestDirectory(
		drv: drive_v3.Drive,
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
						eq(externalDir.provider, FileHost.DRIVE),
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
						provider: FileHost.DRIVE,
						url: dirEntry.url,
						modifiedAt: dirEntry.updatedAt ?? new Date(),
					})
					.returning({ id: externalDir.id })
			).at(0)?.id;

		if (!dirId)
			throw httpError(
				HttpCode.INTERNAL_SERVER_ERROR,
				ErrorCode.EXTERNAL_DIR_FAILED,
			);

		const allEntries = await listAllFiles(drv, dirEntry.id);
		const fileEntries = allEntries.filter((e) => e.ext !== 'dir');
		const currentExternalIds = fileEntries.map((e) => e.id);

		if (existing && currentExternalIds.length)
			await db
				.delete(file)
				.where(
					and(
						eq(file.externalDirId, dirId),
						eq(file.provider, FileHost.DRIVE),
						notInArray(file.externalId, currentExternalIds),
					),
				);

		for (const entry of fileEntries) {
			const blockReason = await checkTenantCanIngest(slug);
			if (blockReason) {
				stats.failed +=
					fileEntries.length - stats.ok - stats.unmodified - stats.failed;
				break;
			}

			try {
				const result = await ingestFile(
					drv,
					userId,
					slug,
					credentialId,
					entry,
					dirId,
				);
				stats[result.toLowerCase() as keyof typeof stats]++;
			} catch (error) {
				captureException(error, {
					tags: { source: 'Drive.ingestDirectory' },
					extra: { userId, entry },
				});
				stats.failed++;
			}
		}

		return stats;
	}

	export async function ingest(
		drv: drive_v3.Drive,
		userId: string,
		slug: string,
		credentialId: string,
		selection: { isDir: boolean; id: string }[],
	) {
		const sorted = selection.sort(({ isDir }) => (isDir ? -1 : 1));

		const results = { ok: 0, unmodified: 0, failed: 0 };

		for (const item of sorted) {
			if (item.isDir) {
				const dirInfo = await getDirInfo(drv, item.id);
				const stats = await ingestDirectory(
					drv,
					userId,
					slug,
					credentialId,
					dirInfo,
				);
				results.ok += stats.ok;
				results.unmodified += stats.unmodified;
				results.failed += stats.failed;
			} else {
				const blockReason = await checkTenantCanIngest(slug);
				if (blockReason) {
					results.failed++;
					continue;
				}
				const fileInfo = await getFileInfo(drv, item.id);
				const result = await ingestFile(
					drv,
					userId,
					slug,
					credentialId,
					fileInfo,
				);
				results[result.toLowerCase() as keyof typeof results]++;
			}
		}

		return results;
	}

	export async function ingestFromCredential(
		userId: string,
		slug: string,
		credentialId: string,
		selection: IngestSelection[],
	): Promise<string> {
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
						eq(credential.provider, OauthProvider.GOOGLE),
						eq(credential.scope, OauthScope.DRIVE),
					),
				)
		).at(0);

		if (!tokens) {
			captureException(new Error('Credential not found during Drive sync'), {
				tags: { source: 'Drive.ingestFromCredential' },
				extra: { userId, credentialId },
			});
			if (selection.length)
				await db.insert(trace).values(
					selection.map((item) => ({
						userId,
						type: TraceType.INGEST_FAILED,
						metadata: {
							provider: FileHost.DRIVE,
							externalId: item.id,
							name: item.id,
							error: 'CREDENTIAL_LOST',
						},
					})),
				);
			return 'FAILED';
		}

		let at: string;
		let rt: string;
		try {
			({ at, rt } = await ensureFreshTokens(
				credentialId,
				OauthProvider.GOOGLE,
				tokens.accessToken,
				tokens.refreshToken,
				tokens.accessTokenExpiresAt,
				slug,
			));
		} catch (error) {
			captureException(error, {
				tags: { source: 'Drive.ingestFromCredential' },
				extra: { userId, credentialId },
			});
			if (selection.length)
				await db.insert(trace).values(
					selection.map((item) => ({
						userId,
						type: TraceType.INGEST_FAILED,
						metadata: {
							provider: FileHost.DRIVE,
							externalId: item.id,
							name: item.id,
							error:
								error instanceof Error ? error.message : 'TOKEN_REFRESH_FAILED',
						},
					})),
				);
			return 'FAILED';
		}

		const drv = fromTokens(at, rt);
		const results = await ingest(drv, userId, slug, credentialId, selection);

		return !results.failed && results.ok
			? 'OK'
			: results.ok && results.failed
				? 'PARTIAL'
				: results.failed
					? 'FAILED'
					: 'UNMODIFIED';
	}

	export async function refreshTokens(
		credentialId: string,
		options?: { slug?: string; language?: Language },
	) {
		return Google.refreshTokens(credentialId, options);
	}
}

export const driveRouter = new Elysia({ prefix: '/drive' })
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
			return Drive.search(
				await Drive.fromRequest(activeUser, credentialId),
				query,
			);
		},
		{
			detail: {
				summary: 'Search Google Drive',
				description: Drive.searchDescription,
			},
			params: tObject({ credentialId: t.String({ format: 'uuid' }) }),
			query: Drive.searchInput,
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
			return Drive.listDir(
				await Drive.fromRequest(activeUser, credentialId),
				query,
			);
		},
		{
			detail: {
				summary: 'List drive dir',
				description: Drive.listDirDescription,
			},
			params: tObject({ credentialId: t.String({ format: 'uuid' }) }),
			query: Drive.listDirInput,
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

			return Drive.refreshTokens(credentialId, {
				slug: activeUser.slug,
				language: activeUser.language as Language,
			});
		},
		{
			detail: { summary: 'Refresh drive credential' },
			params: tObject({ credentialId: t.String({ format: 'uuid' }) }),
		},
	)
	.post(
		'/ingest',
		async ({ activeUser, body }) => {
			const blockReason = await checkTenantCanIngest(activeUser.slug);
			if (blockReason) {
				const lang = activeUser.language as Language;
				if (blockReason === 'PAYMENT_REQUIRED')
					throw httpError(
						HttpCode.PAYMENT_REQUIRED,
						ErrorCode.PAYMENT_REQUIRED,
						lang,
					);
				throw httpError(
					HttpCode.PRECONDITION_FAILED,
					ErrorCode[blockReason as keyof typeof ErrorCode],
					lang,
				);
			}

			return Drive.ingest(
				await Drive.fromRequest(activeUser, body.credentialId, true),
				activeUser.id,
				activeUser.slug,
				body.credentialId,
				body.selection,
			);
		},
		{
			detail: { summary: 'Ingest from drive' },
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
				const lang = activeUser.language as Language;
				if (blockReason === 'PAYMENT_REQUIRED')
					throw httpError(
						HttpCode.PAYMENT_REQUIRED,
						ErrorCode.PAYMENT_REQUIRED,
						lang,
					);
				throw httpError(
					HttpCode.PRECONDITION_FAILED,
					ErrorCode[blockReason as keyof typeof ErrorCode],
					lang,
				);
			}

			const resolved = await resolveNexataSelection(
				body.selection,
				FileHost.DRIVE,
			);

			return Drive.ingest(
				await Drive.fromRequest(activeUser, body.credentialId, true),
				activeUser.id,
				activeUser.slug,
				body.credentialId,
				resolved,
			);
		},
		{
			detail: { summary: 'Re-ingest from drive' },
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
