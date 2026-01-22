import { authPlugin } from '@api/auth';
import { db } from '@api/env';
import type { NexataListDir } from '@api/integration/lib';
import { credential, OauthProvider } from '@api/schema';
import type { JwtPayload } from '@api/utils/auth';
import {
	getTokensForUser,
	removeCachedCredentials,
	userHasCredential,
} from '@api/utils/credential';
import { requireEnv } from '@api/utils/env';
import { Nullish, tObject } from '@api/utils/type';
import { and, eq } from 'drizzle-orm';
import { DropboxAuth, Dropbox as DropboxClient } from 'dropbox';
import { Elysia, type Static, t } from 'elysia';
import { HttpError } from 'elysia-logger';

export namespace Dropbox {
	export const fromRequest = async (
		activeUser: JwtPayload,
		credentialId: string,
		adminExpected?: true,
	) => {
		const { at, rt } = await getTokensForUser(
			activeUser,
			credentialId,
			adminExpected,
			eq(credential.provider, OauthProvider.DROPBOX),
		);

		return fromTokens(at, rt);
	};

	export const fromTokens = (accessToken: string, refreshToken?: string) =>
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
			persistenceSlug?: string;
			tokens?: { refreshToken: string; accessToken: string };
		},
	) {
		const tokens =
			options?.tokens ??
			(
				await db
					.select({
						refreshToken: credential.refreshToken,
						accessToken: credential.accessToken,
					})
					.from(credential)
					.where(
						and(
							eq(credential.id, credentialId),
							eq(credential.provider, OauthProvider.DROPBOX),
						),
					)
			).at(0);

		if (!tokens) throw HttpError.NotFound('CREDENTIAL_LOST');

		const auth = new DropboxAuth({
			accessToken: tokens.accessToken,
			refreshToken: tokens.refreshToken,
			clientId: requireEnv('DROPBOX_APP_KEY'),
			clientSecret: requireEnv('DROPBOX_APP_SECRET'),
		});

		auth.refreshAccessToken();

		const newTokens = {
			accessToken: auth.getAccessToken(),
			accessTokenExpiresAt: auth.getAccessTokenExpiresAt(),
			refreshToken: auth.getRefreshToken(),
			refreshTokenExpiresAt: new Date(Date.now() + 86400 * 365 * 10), // 10 years
		};

		if (newTokens.accessToken === tokens.accessToken) return false;

		if (options?.persistenceSlug)
			await Promise.all([
				db
					.update(credential)
					.set(newTokens)
					.where(eq(credential.id, credentialId)),
				removeCachedCredentials(
					options.persistenceSlug,
					undefined,
					credentialId,
				),
			]);

		return true;
	}

	export const [searchDescription, searchInput] = [
		'Dropbox tool to search for files using filesSearchV2.',
		t.Union([
			t.Object({
				cursor: t.String({
					description:
						'Continuation token for the search. If provided, the search will continue from the previous page. If received, all other params are ignored.',
				}),
			}),
			t.Object({
				query: t.String({
					minLength: 1,
					description:
						'The string to search for. May match across multiple fields based on the request arguments.',
				}),
				path: Nullish(t.String(), {
					description:
						"Scopes the search to a path or folder ID in the user's Dropbox. Searches the entire Dropbox if not specified.",
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

		if (res.status !== 200) throw HttpError.Conflict('EXTERNAL_ERROR');

		return {
			cursor: res.result.has_more ? (res.result.cursor ?? null) : null,
			entries: res.result.matches
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

		if (res.status !== 200) throw HttpError.Conflict('EXTERNAL_ERROR');

		return {
			cursor: res.result.has_more ? res.result.cursor : null,
			entries: res.result.entries.map((e) => ({
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
			})),
		};
	}

	export async function ingest(
		_dpx: DropboxClient,
		_userId: string,
		selection: { isDir: boolean; id: string }[],
	) {
		selection = selection.sort(({ isDir }) => (isDir ? -1 : 1));

		// TODO: If is not dir, download an ingest through File.ingest
		// If it's dir:
		// first check if the dir exists, if not create it
		// then via API, iterate through all files of the dir until no cursor, getting their ids
		// If the dir already existed, check if any file was deleted (we have the dir id and the existing file ids)
		// If there are files deleted, let's remove them also on nexata.
		// Then let's individually download all ids and send them to File.ingest
		// If there are dirs in that dir, we will have to do this recursively.
	}
}

export const dropboxRouter = new Elysia({ prefix: '/dropbox' })
	.use(authPlugin())
	.get(
		'/search/:credentialId',
		async ({ params: { credentialId }, query, activeUser }) => {
			const hasPermission = await userHasCredential(activeUser, credentialId);
			if (!hasPermission) throw HttpError.Forbidden('NO_CREDENTIAL_PERMISSION');
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
			if (!hasPermission) throw HttpError.Forbidden('NO_CREDENTIAL_PERMISSION');
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
			if (!hasPermission) throw HttpError.Forbidden('NO_CREDENTIAL_PERMISSION');

			return Dropbox.refreshTokens(credentialId, {
				persistenceSlug: activeUser.slug,
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
			const dpx = await Dropbox.fromRequest(
				activeUser,
				body.credentialId,
				true,
			);

			await Dropbox.ingest(dpx, activeUser.id, body.selection);
		},
		{
			detail: { summary: 'Ingest from dropbox' },
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
