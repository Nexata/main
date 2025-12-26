import { authPlugin } from '@api/auth';
import { Elysia } from 'elysia';

export const credentialRouter = new Elysia({ prefix: '/permission' }).use(
	authPlugin(),
);
// TODO: CREATE/DELETE/UPDATE permissions / isGlobal, invalidar cache
