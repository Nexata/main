import { cache, db } from '@api/env';
import { tenant, user } from '@api/schema';
import { tObject } from '@api/utils/type';
import { and, eq, isNotNull } from 'drizzle-orm';
import { createInsertSchema, createUpdateSchema } from 'drizzle-typebox';
import { Elysia, t } from 'elysia';
import { HttpError } from 'elysia-logger';

const [insertTenant, updateTenant] = [
	createInsertSchema(tenant),
	createUpdateSchema(tenant),
];

export const tenantRouter = new Elysia({ prefix: '/tenant' })
	.post(
		'/',
		async ({ body: { email, ...body } }) =>
			db
				.with(db.$with('sq').as(db.insert(tenant).values(body)))
				.insert(user)
				.values({ email, slug: body.slug, isAdmin: true })
				.returning({ id: user.id }),
		{
			detail: { summary: 'Create tenant' },
			body: t.Intersect([
				t.Omit(insertTenant, ['createdAt']),
				t.Object({
					email: t.String({ format: 'email', description: 'First user email' }),
				}),
			]),
		},
	)
	.get('/', async () => db.select().from(tenant).$withCache(false), {
		detail: { summary: 'List tenants' },
	})
	.patch(
		'/:slug',
		async ({ body, params: { slug } }) =>
			db
				.update(tenant)
				.set(body)
				.where(eq(tenant.slug, slug))
				.returning({ slug: tenant.slug }),
		{
			detail: { summary: 'Update tenant by slug' },
			body: t.Omit(updateTenant, ['createdAt']),
			params: tObject({ slug: t.String() }),
		},
	)
	.delete(
		'/:slug',
		async ({ params: { slug } }) =>
			db
				.delete(tenant)
				.where(eq(tenant.slug, slug))
				.returning({ slug: tenant.slug }),
		{
			detail: { summary: 'Delete tenant by slug' },
			params: tObject({ slug: t.String() }),
		},
	)
	.patch(
		'/:slug/api-access',
		async ({ params: { slug } }) => {
			const currentTenant = await db
				.select({ hasApiAccess: tenant.hasApiAccess })
				.from(tenant)
				.where(eq(tenant.slug, slug))
				.limit(1);

			if (!currentTenant[0]) throw HttpError.NotFound('TENANT_NOT_FOUND');

			const newValue = !currentTenant[0].hasApiAccess;
			await db
				.update(tenant)
				.set({ hasApiAccess: newValue })
				.where(eq(tenant.slug, slug));

			if (!newValue) {
				const usersWithKeys = await db
					.select({ id: user.id })
					.from(user)
					.where(and(eq(user.slug, slug), isNotNull(user.apiKey)));

				if (usersWithKeys.length > 0)
					await cache.del(...usersWithKeys.map((u) => `apikey-${u.id}`));
			}

			return { hasApiAccess: newValue };
		},
		{
			detail: { summary: 'Toggle tenant API access' },
			params: tObject({ slug: t.String() }),
		},
	);
