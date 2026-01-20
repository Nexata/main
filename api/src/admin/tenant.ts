import { authPlugin } from '@api/auth';
import { db } from '@api/env';
import { tenant } from '@api/schema';
import { uploadTenantPfp } from '@api/utils/s3';
import { eq } from 'drizzle-orm';
import { createUpdateSchema } from 'drizzle-typebox';
import { Elysia, t } from 'elysia';

const updateTenant = createUpdateSchema(tenant);

export const tenantRouter = new Elysia({ prefix: '/tenant' })
	.use(authPlugin({ admin: true }))
	.patch(
		'/',
		async ({ body, activeUser }) =>
			db
				.update(tenant)
				.set({
					...body,
					logoUrl:
						body.logo && (await uploadTenantPfp(activeUser.slug, body.logo)),
				})
				.where(eq(tenant.slug, activeUser.slug))
				.returning({ slug: tenant.slug }),
		{
			detail: { summary: 'Update tenant' },
			body: t.Composite([
				t.Pick(updateTenant, ['displayName']),
				t.Object({
					logo: t.Optional(t.File({ format: 'image/*', maxSize: '4m' })),
				}),
			]),
		},
	);
