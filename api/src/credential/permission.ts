import { authPlugin } from '@api/auth';
import { db } from '@api/env';
import { credential, credentialPermission, user } from '@api/schema';
import type { JwtPayload } from '@api/utils/auth';
import { removeCachedCredentials } from '@api/utils/credential';
import { boolOr } from '@api/utils/sql';
import { and, eq, exists, or, type SQLWrapper, sql } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-typebox';
import { Elysia, t } from 'elysia';
import { HttpError } from 'elysia-logger';

const [selectCredentialPermission, insertCredentialPermission] = [
	createSelectSchema(credentialPermission),
	createInsertSchema(credentialPermission),
];

const isCredentialAdmin = (
	activeUser: JwtPayload,
	credentialId: string,
	...whereConditions: SQLWrapper[]
) =>
	db
		.select({
			isAdmin: activeUser.isAdmin
				? sql<boolean>`true`
				: or(
						eq(credential.userId, activeUser.id),
						boolOr(
							and(
								eq(credentialPermission.userId, activeUser.id),
								eq(credentialPermission.isAdmin, true),
							)!,
						),
					)!,
		})
		.from(credential)
		.leftJoin(
			credentialPermission,
			eq(credentialPermission.credentialId, credential.id),
		)
		.leftJoin(user, eq(user.id, credential.userId))
		.where(
			and(
				eq(credential.id, credentialId),
				eq(user.slug, activeUser.slug),
				...whereConditions,
			),
		)
		.groupBy(credential.id);

export const permissionRouter = new Elysia({ prefix: '/permission' })
	.use(authPlugin())
	.put(
		'/',
		async ({ body, activeUser }) => {
			if (
				!(
					await isCredentialAdmin(
						activeUser,
						body.credentialId,
						exists(
							db
								.select({ slug: user.slug })
								.from(user)
								.where(
									and(eq(user.id, body.userId), eq(user.slug, activeUser.slug)),
								),
						),
					)
				).at(0)?.isAdmin
			)
				throw HttpError.Forbidden();

			await removeCachedCredentials(activeUser.slug, body.userId);

			return db
				.insert(credentialPermission)
				.values(body)
				.onConflictDoUpdate({
					target: [
						credentialPermission.credentialId,
						credentialPermission.userId,
					],
					set: { isAdmin: body.isAdmin },
				})
				.returning({
					credentialId: credentialPermission.credentialId,
					userId: credentialPermission.userId,
					isAdmin: credentialPermission.isAdmin,
				});
		},
		{
			detail: { summary: 'Upsert credential permission' },
			body: insertCredentialPermission,
		},
	)
	.delete(
		'/',
		async ({ body, activeUser }) => {
			if (
				!(await isCredentialAdmin(activeUser, body.credentialId)).at(0)?.isAdmin
			)
				throw HttpError.Forbidden();

			await removeCachedCredentials(activeUser.slug, body.userId);

			return db
				.delete(credentialPermission)
				.where(
					and(
						eq(credentialPermission.credentialId, body.credentialId),
						eq(credentialPermission.userId, body.userId),
					),
				)
				.returning({
					credentialId: credentialPermission.credentialId,
					userId: credentialPermission.userId,
					isAdmin: credentialPermission.isAdmin,
				});
		},
		{
			detail: { summary: 'Delete credential permission' },
			body: t.Pick(selectCredentialPermission, ['credentialId', 'userId']),
		},
	);
