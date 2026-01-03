import { authPlugin } from '@api/auth';
import type { NexataListDir } from '@api/integration/lib';
import { credential, OauthProvider } from '@api/schema';
import type { JwtPayload } from '@api/utils/auth';
import { getAccessTokenForUser } from '@api/utils/credential';
import { Nullish, tObject } from '@api/utils/type';
import { eq } from 'drizzle-orm';
import { Dropbox as DropboxClient } from 'dropbox';
import { Elysia, type Static, t } from 'elysia';
import { HttpError } from 'elysia-logger';

export namespace Dropbox {
	export const fromRequest = async (
		activeUser: JwtPayload,
		credentialId: string,
		adminExpected?: true,
	) =>
		new DropboxClient({
			accessToken: await getAccessTokenForUser(
				activeUser,
				credentialId,
				adminExpected,
				eq(credential.provider, OauthProvider.DROPBOX),
			),
		});

	export const fromToken = (accessToken: string) =>
		new DropboxClient({ accessToken });

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
					default: true,
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
					recursive: input.recursive ?? true,
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
}

export const dropboxRouter = new Elysia({ prefix: '/dropbox' })
	.use(authPlugin())
	.get(
		'/search/:credentialId',
		async ({ params: { credentialId }, query, activeUser }) =>
			Dropbox.search(
				await Dropbox.fromRequest(activeUser, credentialId),
				query,
			),
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
		async ({ params: { credentialId }, query, activeUser }) =>
			Dropbox.listDir(
				await Dropbox.fromRequest(activeUser, credentialId),
				query,
			),
		{
			detail: {
				summary: 'List dropbox dir',
				description: Dropbox.listDirDescription,
			},
			params: tObject({ credentialId: t.String({ format: 'uuid' }) }),
			query: Dropbox.listDirInput,
		},
	);
