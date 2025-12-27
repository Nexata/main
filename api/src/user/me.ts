import { authPlugin } from '@api/auth';
import { db } from '@api/env';
import { tenant, user } from '@api/schema';
import { eq } from 'drizzle-orm';
import { createUpdateSchema } from 'drizzle-typebox';
import { Elysia, t } from 'elysia';

const updateUser = createUpdateSchema(user);

export const meRouter = new Elysia({ prefix: '/me', tags: ['Me'] })
	.use(authPlugin())
	.get(
		'/tenant',
		async ({ activeUser }) =>
			db
				.select({
					slug: tenant.slug,
					displayName: tenant.displayName,
					logoUrl: tenant.logoUrl,
					createdAt: tenant.createdAt,
				})
				.from(tenant)
				.where(eq(tenant.slug, activeUser.slug)),
		{
			detail: { summary: 'Get my tenant' },
		},
	)
	.get('/', async ({ activeUser }) => activeUser, {
		detail: { summary: 'Get me' },
	})
	// TODO: Update pfp
	.patch(
		'/',
		async ({ activeUser: { id }, body }) =>
			db.update(user).set(body).where(eq(user.id, id)),
		{
			detail: { summary: 'Update me' },
			body: t.Omit(updateUser, ['id', 'slug', 'email', 'isAdmin', 'pfpUrl']),
		},
	)
	// TODO: Delete pfp
	.delete(
		'/',
		async ({ activeUser: { id } }) => db.delete(user).where(eq(user.id, id)),
		{
			detail: { summary: 'Delete me' },
		},
	);
