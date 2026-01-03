import { authPlugin } from '@api/auth';
import { db } from '@api/env';
import { tenant, user } from '@api/schema';
import { uploadUserPfp } from '@api/utils/s3';
import { s3 } from 'bun';
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
	.get(
		'/',
		async ({ activeUser }) =>
			(await db
				.select({
					id: user.id,
					email: user.email,
					displayName: user.displayName,
					pfpUrl: user.pfpUrl,
					isAdmin: user.isAdmin,
				})
				.from(user)
				.where(eq(user.id, activeUser.id))).at(0),
		{
			detail: { summary: 'Get me' },
		},
	)
	.patch(
		'/',
		async ({ activeUser: { id }, body }) =>
			db
				.update(user)
				.set({
					...body,
					pfpUrl: body.pfp && (await uploadUserPfp(id, body.pfp)),
				})
				.where(eq(user.id, id)),
		{
			detail: { summary: 'Update me' },
			body: t.Composite([
				t.Pick(updateUser, ['displayName']),
				t.Object({
					pfp: t.Optional(t.File({ format: 'image/*', maxSize: '4m' })),
				}),
			]),
		},
	)
	.delete(
		'/',
		async ({ activeUser: { id } }) => {
			await db.delete(user).where(eq(user.id, id));
			await s3.delete(`u/${id}`);
			return id;
		},
		{
			detail: { summary: 'Delete me' },
		},
	);
