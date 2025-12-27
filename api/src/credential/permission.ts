import { authPlugin } from '@api/auth';
import { db } from '@api/env';
import { credential, credentialPermission } from '@api/schema';
import { boolOr, coalesce } from '@api/utils/sql';
import { and, eq, or, sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-typebox';
import { Elysia } from 'elysia';

const insertCredentialPermission = createInsertSchema(credentialPermission);

export const permissionRouter = new Elysia({ prefix: '/permission' })
	.use(authPlugin())
	.post(
		'/',
		async ({ body, activeUser }) => {
			const xd = await db
				.select({
					isAdmin: activeUser.isAdmin
						? sql<boolean>`true`
						: coalesce(
								or(
									eq(credential.userId, activeUser.id),
									boolOr(
										and(
											eq(credentialPermission.userId, activeUser.id),
											eq(credentialPermission.isAdmin, true),
										)!,
									),
								)!,
								sql<boolean>`false`,
							),
				})
				.from(credential);
		},
		{
			detail: { summary: 'Create credential permission' },
			body: insertCredentialPermission,
		},
	)
	.patch('/', async () => {}, {
		detail: { summary: 'Update credential permission' },
	})
	.delete('/', async () => {}, {
		detail: { summary: 'Revoke credential permission' },
	});
// TODO: CREATE/DELETE/UPDATE permissions / isGlobal, invalidar cache
