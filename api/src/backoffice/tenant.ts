import { db } from '@api/env';
import { tenant, user } from '@api/schema';
import { tObject } from '@api/utils/type';
import { eq } from 'drizzle-orm';
import { createInsertSchema, createUpdateSchema } from 'drizzle-typebox';
import Elysia, { t } from 'elysia';

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
	);
