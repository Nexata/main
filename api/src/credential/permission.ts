import { authPlugin } from '@api/auth';
import { db } from '@api/env';
import {
	credential,
	credentialPermission,
	TraceType,
	trace,
	user,
} from '@api/schema';
import type { JwtPayload } from '@api/utils/auth';
import { invalidateCredentialCache } from '@api/utils/credential';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { boolOr } from '@api/utils/sql';
import { and, eq, exists, or, type SQLWrapper, sql } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-typebox';
import { Elysia, t } from 'elysia';

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
				throw httpError(
					HttpCode.FORBIDDEN,
					ErrorCode.NO_CREDENTIAL_PERMISSION,
					activeUser.language,
				);

			await invalidateCredentialCache(activeUser.slug, body.credentialId, [
				body.userId,
			]);

			return db
				.with(
					db.$with('trace').as(
						db.insert(trace).values({
							userId: activeUser.id,
							type: TraceType.CREDENTIAL_ADDED,
							metadata: { credentialId: body.credentialId },
						}),
					),
				)
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
				throw httpError(
					HttpCode.FORBIDDEN,
					ErrorCode.NO_CREDENTIAL_PERMISSION,
					activeUser.language,
				);

			await invalidateCredentialCache(activeUser.slug, body.credentialId, [
				body.userId,
			]);

			const [result] = await db.batch([
				db
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
					}),
				db.insert(trace).values({
					userId: activeUser.id,
					type: TraceType.CREDENTIAL_REMOVED,
					metadata: { credentialId: body.credentialId },
				}),
			]);

			return result;
		},
		{
			detail: { summary: 'Delete credential permission' },
			body: t.Pick(selectCredentialPermission, ['credentialId', 'userId']),
		},
	);
