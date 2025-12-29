import { authPlugin } from '@api/auth';
import { dropboxRouter } from '@api/integration/dropbox';
import { Elysia } from 'elysia';

export const integrationRouter = new Elysia({
	prefix: '/integration',
	tags: ['Integration'],
})
	.use(authPlugin())
	.use(dropboxRouter);
