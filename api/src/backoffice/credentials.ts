import Elysia from 'elysia';

export const credentialsRouter = new Elysia({ prefix: '/credentials' }).put(
	'/refresh',
	async () => {
		// Eliminar credentials vencidas
		// usar refresh tokens si corresponde
	},
	{
		detail: {
			tags: ['TODO'],
			summary: 'Refresh credentials',
			description:
				'Removes expired credentials and refreshes tokens if necessary. Expected to run cronologically at midnight.',
		},
	},
);
