import { authPlugin } from '@api/auth';
import { permissionRouter } from '@api/credential/permission';
import { db } from '@api/env';
import {
	credential,
	credentialPermission,
	type Language,
	TraceType,
	trace,
	user,
} from '@api/schema';
import {
	getCredentialsForUser,
	invalidateCredentialCache,
} from '@api/utils/credential';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { tObject } from '@api/utils/type';
import { NeonDbError } from '@neondatabase/serverless';
import { and, eq, exists, inArray, not, or } from 'drizzle-orm';
import { Elysia, t } from 'elysia';

export const credentialRouter = new Elysia({
	prefix: '/credential',
	tags: ['Credential'],
})
	.use(authPlugin())
	.use(permissionRouter)
	.delete(
		'/:id',
		async ({ params: { id }, activeUser }) => {
			try {
				const [[deletionResult]] = await Promise.all([
					db.batch([
						db
							.delete(credential)
							.where(
								and(
									eq(credential.id, id),
									!activeUser.isAdmin
										? or(
												eq(credential.userId, activeUser.id),
												exists(
													db
														.select({ id: user.id })
														.from(credentialPermission)
														.where(
															and(
																eq(credentialPermission.credentialId, id),
																eq(credentialPermission.userId, activeUser.id),
																eq(credentialPermission.isAdmin, true),
															),
														),
												),
											)
										: inArray(
												credential.userId,
												db
													.select({ id: user.id })
													.from(user)
													.where(eq(user.slug, activeUser.slug)),
											),
								),
							)
							.returning({ credentialId: credential.id }),
						db.insert(trace).values({
							userId: activeUser.id,
							type: TraceType.CREDENTIAL_REMOVED,
							metadata: { credentialId: id },
						}),
					]),
					invalidateCredentialCache(activeUser.slug, id),
				]);

				return deletionResult;
			} catch (error) {
				if (error instanceof NeonDbError && error.code === '23503') {
					throw httpError(
						HttpCode.CONFLICT,
						ErrorCode.CREDENTIAL_HAS_FILES,
						activeUser.language as Language,
					);
				}
				throw error;
			}
		},
		{
			detail: { summary: 'Delete credential by ID' },
			params: tObject({ id: t.String({ format: 'uuid' }) }),
		},
	)
	.patch(
		'/is-global',
		async ({ body: { credentialId }, activeUser }) => {
			const allowed = activeUser.isAdmin
				? inArray(
						credential.userId,
						db
							.select({ id: user.id })
							.from(user)
							.where(eq(user.slug, activeUser.slug)),
					)
				: or(
						eq(credential.userId, activeUser.id),
						exists(
							db
								.select({ id: user.id })
								.from(credentialPermission)
								.where(
									and(
										eq(credentialPermission.credentialId, credentialId),
										eq(credentialPermission.userId, activeUser.id),
										eq(credentialPermission.isAdmin, true),
									),
								),
						),
					);

			const result = (
				await db
					.update(credential)
					.set({ isGlobal: not(credential.isGlobal) })
					.where(and(eq(credential.id, credentialId), allowed))
					.returning({ isGlobal: credential.isGlobal })
			).at(0);

			if (!result)
				throw httpError(
					HttpCode.FORBIDDEN,
					ErrorCode.NO_CREDENTIAL_PERMISSION,
					activeUser.language as Language,
				);

			await invalidateCredentialCache(activeUser.slug, credentialId);

			return result;
		},
		{
			detail: { summary: 'Toggle credential global visibility' },
			body: tObject({
				credentialId: t.String({ format: 'uuid' }),
			}),
		},
	)
	.get(
		'/',
		async ({ activeUser }) => getCredentialsForUser(activeUser, 'display'),
		{ detail: { summary: 'List credentials' } },
	);
