import { authPlugin } from '@api/auth';
import { db } from '@api/env';
import { user } from '@api/schema';
import { meRouter } from '@api/user/me';
import { tObject } from '@api/utils/type';
import { and, eq } from 'drizzle-orm';
import Elysia, { t } from 'elysia';

export const userRouter = new Elysia({ prefix: '/user', tags: ['User'] })
	.use(authPlugin())
	.use(meRouter)
	.get(
		'/:id',
		async ({ params: { id }, activeUser }) =>
			db
				.select()
				.from(user)
				.where(and(eq(user.id, id), eq(user.slug, activeUser.slug))),
		{
			detail: { summary: 'Read user by ID' },
			params: tObject({ id: t.String({ format: 'uuid' }) }),
		},
	)
	.get(
		'/',
		async ({ activeUser }) =>
			db.select().from(user).where(eq(user.slug, activeUser.slug)),
		{
			detail: { summary: 'List users' },
		},
	);
