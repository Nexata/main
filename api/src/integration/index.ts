import { authPlugin } from '@api/auth';
import { dropboxRouter } from '@api/integration/dropbox';
import { googleRouter } from '@api/integration/google';
import { legajoxRouter } from '@api/integration/legajox';
import { microsoftRouter } from '@api/integration/microsoft';
import { Elysia } from 'elysia';

export const integrationRouter = new Elysia({
	prefix: '/integration',
	tags: ['Integration'],
})
	.use(authPlugin())
	.use(dropboxRouter)
	.use(googleRouter)
	.use(microsoftRouter)
	.use(legajoxRouter);
