import { Elysia } from 'elysia';

export const filesRouter = new Elysia({ prefix: '/files' }).put(
	'/sync',
	async () => {
		// TODO: Re-ingest dirs with autoSync = true,
		// and files with autoSync = true and externalDirId null,
		// The ingestion method is based on fileHost; i.e. if dropbox, use Dropbox.ingest from @src/integration/dropbox.ts
		// We only have dropbox by now but it should be easy to extend this as we are going to have others,
		// Similar to refresh credentials at @src/backoffice/credentials.ts in this sense.
	},
	{
		detail: {
			summary: 'Sync external files',
			// NOTE: Cron job, scheduled to run once an hour
			description:
				'Sync for external files. Expected to run cronologically once an hour.',
		},
	},
);
