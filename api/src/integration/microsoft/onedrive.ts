import { authPlugin } from '@api/auth';
import { db } from '@api/env';
import { NexataFile } from '@api/file';
import { getMimeTypeFromExt } from '@api/file/lib/types';
import {
	getIngestedDirIds,
	getIngestedFileIds,
	type IngestSelection,
	type NexataListDir,
	type NexataListDirEntry,
	resolveNexataSelection,
} from '@api/integration/lib';
import { Microsoft } from '@api/integration/microsoft/lib';
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
import { refreshMicrosoftTokens } from '@api/utils/token-refresh';
import { Nullish, tObject } from '@api/utils/type';
import type { Client } from '@microsoft/microsoft-graph-client';
import type { DriveItem } from '@microsoft/microsoft-graph-types';
import { captureException } from '@sentry/bun';
import { and, eq, notInArray } from 'drizzle-orm';
import { Elysia, type Static, t } from 'elysia';

const ITEM_SELECT = [
	'id',
	'name',
	'size',
	'lastModifiedDateTime',
	'webUrl',
	'parentReference',
	'file',
	'folder',
].join(',');

function parseCompoundId(compoundId: string): {
	driveId: string | null;
	itemId: string;
} {
	const sep = compoundId.indexOf('!');
	if (sep === -1) return { driveId: null, itemId: compoundId };
	return {
		driveId: compoundId.slice(0, sep),
		itemId: compoundId.slice(sep + 1),
	};
}

function makeCompoundId(item: DriveItem): string {
	const driveId = item.parentReference?.driveId;
	if (driveId && item.id) return `${driveId}!${item.id}`;
	return item.id!;
}

function itemApiPath(compoundId: string): string {
	const { driveId, itemId } = parseCompoundId(compoundId);
	if (driveId) return `/drives/${driveId}/items/${itemId}`;
	return `/me/drive/items/${itemId}`;
}

function childrenApiPath(compoundId: string | null): string {
	if (!compoundId) return '/me/drive/root/children';
	const { driveId, itemId } = parseCompoundId(compoundId);
	if (driveId) return `/drives/${driveId}/items/${itemId}/children`;
	return `/me/drive/items/${itemId}/children`;
}

function isMsaSearchError(error: unknown): boolean {
	if (error instanceof Error) {
		const msg = error.message.toLowerCase();
		return msg.includes('msa') || msg.includes('microsoftsearch');
	}
	return false;
}

function dedupeSelection(selection: { isDir: boolean; id: string }[]) {
	const unique = new Map<string, { isDir: boolean; id: string }>();

	for (const item of selection) unique.set(`${item.isDir}:${item.id}`, item);

	return [...unique.values()];
}

export namespace OneDrive {
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
		Microsoft.fromTokens(accessToken, refreshToken);

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

	const CATEGORY_TO_KQL_FILETYPES: Record<FileCategory, string[]> = {
		[FileCategory.FOLDER]: [],
		[FileCategory.DOCUMENT]: ['doc', 'docx', 'odt', 'rtf', 'txt'],
		[FileCategory.SPREADSHEET]: ['xls', 'xlsx', 'ods', 'csv'],
		[FileCategory.PRESENTATION]: ['ppt', 'pptx', 'odp'],
		[FileCategory.PDF]: ['pdf'],
		[FileCategory.IMAGE]: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'],
		[FileCategory.AUDIO]: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'],
		[FileCategory.VIDEO]: ['mp4', 'avi', 'mov', 'mkv', 'webm', 'wmv'],
		[FileCategory.OTHER]: [],
	};

	function buildKqlQuery(
		input: Exclude<Static<typeof searchInput>, { cursor: string }>,
	): string {
		const parts: string[] = [];
		const query = input.query ?? input.q;

		if (query) parts.push(query);
		if (input.name) parts.push(`filename:${input.name}`);
		if (input.path) parts.push(`path:"${input.path}"`);
		if (input.modifiedAfter)
			parts.push(`lastModifiedTime>=${input.modifiedAfter}`);
		if (input.modifiedBefore)
			parts.push(`lastModifiedTime<=${input.modifiedBefore}`);

		const fileTypes: string[] = [];
		if (input.fileExtensions?.length) fileTypes.push(...input.fileExtensions);
		if (input.fileCategories?.length) {
			for (const cat of input.fileCategories) {
				const types = CATEGORY_TO_KQL_FILETYPES[cat];
				if (types.length) fileTypes.push(...types);
			}
		}
		if (fileTypes.length)
			parts.push(`(${fileTypes.map((ft) => `filetype:${ft}`).join(' OR ')})`);

		return parts.join(' ') || '*';
	}

	function mapDriveItemToEntry(item: DriveItem): NexataListDirEntry {
		const isFolder = !!item.folder;
		const ext = isFolder
			? 'dir'
			: item.name
				? item.name.split('.').pop()
				: undefined;

		return {
			id: makeCompoundId(item),
			name: item.name ?? 'Unknown',
			nexataId: null,
			url: item.webUrl ?? undefined,
			size: item.size ? item.size / (1024 * 1024) : undefined,
			path: item.parentReference?.id ?? undefined,
			ext,
			updatedAt: item.lastModifiedDateTime
				? new Date(item.lastModifiedDateTime)
				: undefined,
		};
	}

	async function enrichEntries(
		entries: NexataListDirEntry[],
	): Promise<NexataListDirEntry[]> {
		const fileIds = entries.filter((e) => e.ext !== 'dir').map((e) => e.id);
		const dirIds = entries.filter((e) => e.ext === 'dir').map((e) => e.id);
		const [ingestedFiles, ingestedDirs] = await Promise.all([
			getIngestedFileIds(fileIds, FileHost.ONE_DRIVE),
			getIngestedDirIds(dirIds, FileHost.ONE_DRIVE),
		]);

		return entries.map((e) => ({
			...e,
			nexataId:
				e.ext === 'dir'
					? (ingestedDirs.get(e.id) ?? null)
					: (ingestedFiles.get(e.id) ?? null),
		}));
	}

	async function driveItemSearch(
		client: Client,
		input: Static<typeof searchInput>,
	): Promise<NexataListDir> {
		if ('cursor' in input) {
			const response: { value?: DriveItem[]; '@odata.nextLink'?: string } =
				await client.api(input.cursor).get();

			return {
				cursor: response['@odata.nextLink'] ?? null,
				entries: await enrichEntries(
					(response.value ?? []).map(mapDriveItemToEntry),
				),
			};
		}

		const queryParts: string[] = [];
		if (input.query) queryParts.push(input.query);
		if (input.name) queryParts.push(input.name);
		const queryText = queryParts.join(' ') || '*';
		const top = input.maxResults ?? 100;

		const basePath = input.path
			? `${itemApiPath(input.path)}/search(q='${encodeURIComponent(queryText)}')`
			: `/me/drive/root/search(q='${encodeURIComponent(queryText)}')`;

		const response: { value?: DriveItem[]; '@odata.nextLink'?: string } =
			await client.api(basePath).select(ITEM_SELECT).top(top).get();

		let entries = (response.value ?? []).map(mapDriveItemToEntry);

		const allowedExts = new Set<string>();
		if (input.fileExtensions?.length)
			for (const ext of input.fileExtensions)
				allowedExts.add(ext.toLowerCase());
		if (input.fileCategories?.length)
			for (const cat of input.fileCategories)
				for (const ext of CATEGORY_TO_KQL_FILETYPES[cat]) allowedExts.add(ext);
		if (allowedExts.size)
			entries = entries.filter(
				(e) => e.ext && allowedExts.has(e.ext.toLowerCase()),
			);

		if (input.modifiedAfter) {
			const after = new Date(input.modifiedAfter);
			entries = entries.filter((e) => e.updatedAt && e.updatedAt >= after);
		}
		if (input.modifiedBefore) {
			const before = new Date(input.modifiedBefore);
			entries = entries.filter((e) => e.updatedAt && e.updatedAt <= before);
		}

		return {
			cursor: response['@odata.nextLink'] ?? null,
			entries: await enrichEntries(entries),
		};
	}

	export const [searchDescription, searchInput] = [
		'OneDrive tool to search for files across OneDrive and SharePoint using Microsoft Search API with KQL syntax. Prefer narrow searches that combine file name, path, filetype, category, and modified date before broad text-only search. Use credentialEmail when the user wants only one OneDrive account searched.',
		t.Union([
			tObject({
				cursor: t.String({
					description:
						'Continuation token for pagination. If provided, other params are ignored.',
				}),
			}),
			tObject({
				credentialEmail: Nullish(t.String({ format: 'email' }), {
					description:
						'Limit the search to a specific connected OneDrive account. Use this when the user refers to only one OneDrive or SharePoint-connected account.',
				}),
				query: Nullish(t.String(), {
					description:
						'Full-text or KQL-style query for file content and metadata. Prefer combining this with name, path, filetype, or date filters instead of broad text alone.',
				}),
				q: Nullish(t.String(), {
					description:
						'Alias for query. Supported for compatibility with common caller usage.',
				}),
				name: Nullish(t.String(), {
					description: 'Filter by file name.',
				}),
				path: Nullish(t.String(), {
					description:
						'Filter by folder path. Prefer path scoping when the user hints at where the file lives.',
				}),
				fileExtensions: Nullish(t.Array(t.String()), {
					description:
						"Restrict search to specific file extensions (e.g., ['pdf', 'docx']).",
				}),
				fileCategories: Nullish(t.Array(t.Enum(FileCategory)), {
					description:
						'Restrict search to specific file categories (image, document, pdf, spreadsheet, presentation, audio, video, folder).',
				}),
				modifiedAfter: Nullish(t.String({ format: 'date' }), {
					description: 'Filter files modified after this date (YYYY-MM-DD).',
				}),
				modifiedBefore: Nullish(t.String({ format: 'date' }), {
					description: 'Filter files modified before this date (YYYY-MM-DD).',
				}),
				maxResults: Nullish(t.Number({ minimum: 1, maximum: 500 }), {
					default: 100,
					description: 'Maximum number of results to return (max 500).',
				}),
			}),
		]),
	];

	export async function search(
		client: Client,
		input: Static<typeof searchInput>,
	): Promise<NexataListDir> {
		try {
			let from = 0;
			let size = 100;
			let queryString = '*';

			if ('cursor' in input) {
				const parsed = JSON.parse(input.cursor) as {
					from: number;
					size: number;
					queryString: string;
				};
				from = parsed.from;
				size = parsed.size;
				queryString = parsed.queryString;
			} else {
				queryString = buildKqlQuery(input);
				size = input.maxResults ?? 100;
			}

			const searchBody = {
				requests: [
					{
						entityTypes: ['driveItem'],
						query: { queryString },
						from,
						size,
					},
				],
			};

			const response = await client.api('/search/query').post(searchBody);

			const hitsContainer = response.value?.at(0)?.hitsContainers?.at(0);
			const hits = hitsContainer?.hits ?? [];
			const moreAvailable = hitsContainer?.moreResultsAvailable ?? false;
			const totalCount = hitsContainer?.total ?? 0;

			const entries: NexataListDirEntry[] = hits.map(
				(hit: { resource: DriveItem }) => mapDriveItemToEntry(hit.resource),
			);

			const nextFrom = from + hits.length;
			const cursor =
				moreAvailable && nextFrom < totalCount
					? JSON.stringify({ from: nextFrom, size, queryString })
					: null;

			return {
				cursor,
				entries: await enrichEntries(entries),
			};
		} catch (error) {
			if (isMsaSearchError(error)) return driveItemSearch(client, input);
			throw error;
		}
	}

	export const [listDirDescription, listDirInput] = [
		'Lists files and folders in a OneDrive directory.',
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
						'Folder ID (driveId!itemId) to list contents of. Uses OneDrive root if not specified.',
				}),
				recursive: Nullish(t.Boolean(), {
					default: false,
					description: 'Whether to recursively list all files and subfolders.',
				}),
				limit: Nullish(t.Number({ minimum: 1, maximum: 1000 }), {
					default: 100,
					description: 'Maximum number of results per page.',
				}),
			}),
		]),
	];

	export async function listDir(
		client: Client,
		input: Static<typeof listDirInput>,
	): Promise<NexataListDir> {
		if ('cursor' in input) {
			const response: {
				value?: DriveItem[];
				'@odata.nextLink'?: string;
			} = await client.api(input.cursor).get();

			return {
				cursor: response['@odata.nextLink'] ?? null,
				entries: await enrichEntries(
					(response.value ?? []).map(mapDriveItemToEntry),
				),
			};
		}

		if (input.recursive) {
			const folderId = input.path ?? null;
			const allEntries = await listAllFiles(client, folderId);
			return {
				cursor: null,
				entries: await enrichEntries(allEntries),
			};
		}

		const apiPath = childrenApiPath(input.path ?? null);

		const response: {
			value?: DriveItem[];
			'@odata.nextLink'?: string;
		} = await client
			.api(apiPath)
			.select(ITEM_SELECT)
			.top(input.limit ?? 100)
			.orderby('name asc')
			.get();

		return {
			cursor: response['@odata.nextLink'] ?? null,
			entries: await enrichEntries(
				(response.value ?? []).map(mapDriveItemToEntry),
			),
		};
	}

	async function listAllFiles(
		client: Client,
		folderId: string | null,
	): Promise<NexataListDirEntry[]> {
		const allEntries: NexataListDirEntry[] = [];
		let nextLink: string | undefined;

		const apiPath = childrenApiPath(folderId);

		const first: { value?: DriveItem[]; '@odata.nextLink'?: string } =
			await client.api(apiPath).select(ITEM_SELECT).top(200).get();

		const items = (first.value ?? []).map(mapDriveItemToEntry);
		allEntries.push(...items);
		nextLink = first['@odata.nextLink'];

		while (nextLink) {
			const page: { value?: DriveItem[]; '@odata.nextLink'?: string } =
				await client.api(nextLink).get();
			const pageItems = (page.value ?? []).map(mapDriveItemToEntry);
			allEntries.push(...pageItems);
			nextLink = page['@odata.nextLink'];
		}

		const folders = allEntries.filter((e) => e.ext === 'dir');
		for (const folder of folders) {
			const subEntries = await listAllFiles(client, folder.id);
			allEntries.push(...subEntries);
		}

		return allEntries;
	}

	export async function downloadFile(
		client: Client,
		compoundId: string,
	): Promise<{
		file: File;
		id: string;
		name: string;
		path: string;
		modifiedAt: Date;
	}> {
		const apiPath = itemApiPath(compoundId);

		const item: DriveItem & { '@microsoft.graph.downloadUrl'?: string } =
			await client
				.api(apiPath)
				.select(`${ITEM_SELECT},@microsoft.graph.downloadUrl`)
				.get();

		const name = item.name;
		if (!name) throw httpError(HttpCode.CONFLICT, ErrorCode.NO_FILE_NAME);

		let fileContent: ArrayBuffer;

		const downloadUrl = item['@microsoft.graph.downloadUrl'];
		if (downloadUrl) {
			const response = await fetch(downloadUrl);
			if (!response.ok)
				throw httpError(HttpCode.CONFLICT, ErrorCode.EXTERNAL_ERROR);
			fileContent = await response.arrayBuffer();
		} else {
			// Fallback: /content returns a 302 redirect to a pre-authenticated download URL
			const stream: NodeJS.ReadableStream = await client
				.api(`${apiPath}/content`)
				.getStream();
			fileContent = await new Response(
				stream as unknown as ReadableStream,
			).arrayBuffer();
		}
		const mimeType = item.file?.mimeType ?? getMimeTypeFromExt(name);

		if (mimeType === 'unsupported')
			throw httpError(HttpCode.CONFLICT, ErrorCode.UNSUPPORTED_FILE_TYPE);

		return {
			file: new File([fileContent], name, { type: mimeType }),
			id: makeCompoundId(item),
			name,
			path: item.parentReference?.id ?? '',
			modifiedAt: item.lastModifiedDateTime
				? new Date(item.lastModifiedDateTime)
				: new Date(),
		};
	}

	async function ingestFile(
		client: Client,
		userId: string,
		slug: string,
		credentialId: string,
		entry: NexataListDirEntry,
		externalDirId?: string,
	): Promise<string> {
		try {
			const downloaded = await downloadFile(client, entry.id);

			const result = await NexataFile.ingest(
				{
					userId,
					slug,
					provider: FileHost.ONE_DRIVE,
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
				tags: { source: 'OneDrive.ingestFile' },
				extra: { userId, entry },
			});

			await db.insert(trace).values({
				userId,
				type: TraceType.INGEST_FAILED,
				metadata: {
					provider: FileHost.ONE_DRIVE,
					externalId: entry.id,
					name: entry.name,
					error: error instanceof Error ? error.message : 'UNKNOWN',
				},
			});

			return 'FAILED';
		}
	}

	async function getDirInfo(
		client: Client,
		compoundId: string,
	): Promise<NexataListDirEntry> {
		const apiPath = itemApiPath(compoundId);
		const item: DriveItem = await client
			.api(apiPath)
			.select('id,name,webUrl,lastModifiedDateTime,parentReference,folder')
			.get();

		return {
			id: makeCompoundId(item),
			name: item.name ?? 'Unknown',
			nexataId: null,
			url: item.webUrl ?? undefined,
			ext: 'dir',
			updatedAt: item.lastModifiedDateTime
				? new Date(item.lastModifiedDateTime)
				: undefined,
		};
	}

	async function getFileInfo(
		client: Client,
		compoundId: string,
	): Promise<NexataListDirEntry> {
		const apiPath = itemApiPath(compoundId);
		const item: DriveItem = await client.api(apiPath).select(ITEM_SELECT).get();

		return mapDriveItemToEntry(item);
	}

	async function ingestDirectory(
		client: Client,
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
						eq(externalDir.provider, FileHost.ONE_DRIVE),
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
						provider: FileHost.ONE_DRIVE,
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

		const allEntries = await listAllFiles(client, dirEntry.id);
		const fileEntries = allEntries.filter((e) => e.ext !== 'dir');
		const currentExternalIds = fileEntries.map((e) => e.id);

		if (existing && currentExternalIds.length)
			await db
				.delete(file)
				.where(
					and(
						eq(file.externalDirId, dirId),
						eq(file.provider, FileHost.ONE_DRIVE),
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
					client,
					userId,
					slug,
					credentialId,
					entry,
					dirId,
				);
				stats[result.toLowerCase() as keyof typeof stats]++;
			} catch (error) {
				captureException(error, {
					tags: { source: 'OneDrive.ingestDirectory' },
					extra: { userId, entry },
				});
				stats.failed++;
			}
		}

		return stats;
	}

	export const [ingestDescription, ingestInput] = [
		'OneDrive tool to ingest (download and vectorize) files or folders from OneDrive into Nexata. Use OneDriveSearch or OneDriveListDir first to find items, then pass their external IDs here. Directories are ingested recursively. Only use when the user explicitly requests ingestion.',
		tObject({
			selection: t.Array(
				tObject({
					id: t.String({
						description: 'External OneDrive ID of the file or folder.',
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
		client: Client,
		userId: string,
		slug: string,
		credentialId: string,
		selection: { isDir: boolean; id: string }[],
	) {
		const sorted = dedupeSelection(selection).sort(({ isDir }) =>
			isDir ? -1 : 1,
		);

		const results = { ok: 0, unmodified: 0, failed: 0 };

		for (const item of sorted) {
			if (item.isDir) {
				const dirInfo = await getDirInfo(client, item.id);
				const stats = await ingestDirectory(
					client,
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
				const fileInfo = await getFileInfo(client, item.id);
				const result = await ingestFile(
					client,
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
						eq(credential.provider, OauthProvider.MICROSOFT),
						eq(credential.scope, OauthScope.ONE_DRIVE),
					),
				)
		).at(0);

		if (!tokens) {
			captureException(new Error('Credential not found during OneDrive sync'), {
				tags: { source: 'OneDrive.ingestFromCredential' },
				extra: { userId, credentialId },
			});
			if (selection.length)
				await db.insert(trace).values(
					selection.map((item) => ({
						userId,
						type: TraceType.INGEST_FAILED,
						metadata: {
							provider: FileHost.ONE_DRIVE,
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
				OauthProvider.MICROSOFT,
				tokens.accessToken,
				tokens.refreshToken,
				tokens.accessTokenExpiresAt,
				slug,
			));
		} catch (error) {
			captureException(error, {
				tags: { source: 'OneDrive.ingestFromCredential' },
				extra: { userId, credentialId },
			});
			if (selection.length)
				await db.insert(trace).values(
					selection.map((item) => ({
						userId,
						type: TraceType.INGEST_FAILED,
						metadata: {
							provider: FileHost.ONE_DRIVE,
							externalId: item.id,
							name: item.id,
							error:
								error instanceof Error ? error.message : 'TOKEN_REFRESH_FAILED',
						},
					})),
				);
			return 'FAILED';
		}

		const client = fromTokens(at, rt);
		const results = await ingest(client, userId, slug, credentialId, selection);

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
		return refreshMicrosoftTokens(credentialId, options);
	}
}

export const oneDriveRouter = new Elysia({ prefix: '/onedrive' })
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
			return OneDrive.search(
				await OneDrive.fromRequest(activeUser, credentialId),
				query,
			);
		},
		{
			detail: {
				summary: 'Search OneDrive',
				description: OneDrive.searchDescription,
			},
			params: tObject({ credentialId: t.String({ format: 'uuid' }) }),
			query: OneDrive.searchInput,
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
			return OneDrive.listDir(
				await OneDrive.fromRequest(activeUser, credentialId),
				query,
			);
		},
		{
			detail: {
				summary: 'List OneDrive dir',
				description: OneDrive.listDirDescription,
			},
			params: tObject({ credentialId: t.String({ format: 'uuid' }) }),
			query: OneDrive.listDirInput,
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

			return OneDrive.refreshTokens(credentialId, {
				slug: activeUser.slug,
				language: activeUser.language as Language,
			});
		},
		{
			detail: { summary: 'Refresh OneDrive credential' },
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

			return OneDrive.ingest(
				await OneDrive.fromRequest(activeUser, body.credentialId, true),
				activeUser.id,
				activeUser.slug,
				body.credentialId,
				body.selection,
			);
		},
		{
			detail: { summary: 'Ingest from OneDrive' },
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
				FileHost.ONE_DRIVE,
			);

			return OneDrive.ingest(
				await OneDrive.fromRequest(activeUser, body.credentialId, true),
				activeUser.id,
				activeUser.slug,
				body.credentialId,
				resolved,
			);
		},
		{
			detail: { summary: 'Re-ingest from OneDrive' },
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
