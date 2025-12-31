import { authPlugin } from '@api/auth';
import type { NexataListDir, NexataListDirEntry } from '@api/integration/lib';
import { getAccessTokenForUser } from '@api/utils/credential';
import { tObject } from '@api/utils/type';
import { Dropbox } from 'dropbox';
import { Elysia, t } from 'elysia';
import { HttpError } from 'elysia-logger';

export const dropboxRouter = new Elysia({ prefix: '/dropbox' })
	.use(authPlugin())
	// .post(
	// 	'/:id',
	// 	async ({ params: { path } }) => {
	// 		return dropbox.filesDownload({ path });
	// 	},
	// 	{
	// 		detail: { summary: 'Ingest external file' },
	// 		params: tObject({ path: t.String() }),
	// 	},
	// )
	.get(
		'/',
		async ({ query, activeUser }) => {
			const dpx = new Dropbox({
				accessToken: await getAccessTokenForUser(
					activeUser,
					query.credentialId,
				),
			});

			const res = await (query.cursor
				? dpx.filesListFolderContinue({ cursor: query.cursor })
				: dpx.filesListFolder({
						path: query.path ?? '',
						include_media_info: true,
						include_non_downloadable_files: false,
					}));

			if (res.status !== 200) throw HttpError.Conflict('EXTERNAL_ERROR');

			return {
				entries: res.result.entries.map((e) => ({
					// @ts-expect-error
					id: e.id ?? e.path_lower,
					name: e.name,
					// @ts-expect-error
					size: e.size ? e.size / (1024 * 1024) : undefined,
					path: e.path_display,
					ext: e['.tag'] === 'folder' ? 'folder' : e.name.split('.').pop(),
					// @ts-expect-error
					updatedAt: e.server_modified ?? new Date(e.server_modified),
				})),
				cursor: res.result.has_more ? res.result.cursor : null,
			} satisfies NexataListDir;
		},
		{
			detail: { summary: 'List dropbox dir' },
			query: tObject({
				credentialId: t.String({ format: 'uuid' }),
				path: t.Optional(t.String()),
				cursor: t.Optional(t.String()),
			}),
		},
	);
