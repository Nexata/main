import { Elysia } from 'elysia';

export const filesRouter = new Elysia({ prefix: '/files' }).put(
	'/sync',
	async () => {
		// TODO: Re-ingest files with autoSync = true, that changed in the last hour
	},
	{
		detail: {
			summary: 'Sync external files',
			description:
				'Sync for external files. Expected to run cronologically once an hour.',
		},
	},
);
