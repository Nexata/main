import Elysia from 'elysia';

export const filesRouter = new Elysia({ prefix: '/files' }).put(
	'/sync',
	async () => {
		// Refresh files
	},
	{
		detail: {
			tags: ['TODO'],
			summary: 'Sync external files',
			description:
				'Sync for external files. Expected to run cronologically once an hour.',
		},
	},
);
