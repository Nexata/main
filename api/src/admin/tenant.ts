import { authPlugin } from '@api/auth';
import { db } from '@api/env';
import { tenant } from '@api/schema';
import { eq } from 'drizzle-orm';
import { createUpdateSchema } from 'drizzle-typebox';
import { Elysia, t } from 'elysia';

const updateTenant = createUpdateSchema(tenant);

export const tenantRouter = new Elysia({ prefix: '/tenant' })
	.use(authPlugin(true))
	// TODO: Logo
	.patch(
		'/',
		async ({ body, activeUser }) =>
			db
				.update(tenant)
				.set(body)
				.where(eq(tenant.slug, activeUser.slug))
				.returning({ slug: tenant.slug }),
		{
			detail: { summary: 'Update tenant' },
			body: t.Pick(updateTenant, ['displayName']),
		},
	);
