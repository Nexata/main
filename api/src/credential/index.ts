import { authPlugin } from '@api/auth';
import { permissionRouter } from '@api/credential/permission';
import { db } from '@api/env';
import {
	credential,
	credentialPermission,
	TraceType,
	trace,
	user,
} from '@api/schema';
import {
	getCredentialsForUser,
	removeCachedCredentials,
} from '@api/utils/credential';
import { tObject } from '@api/utils/type';
import { and, eq, exists, inArray, or } from 'drizzle-orm';
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
				removeCachedCredentials(activeUser.slug),
			]);

			return deletionResult;
		},
		{
			detail: { summary: 'Delete credential by ID' },
			params: tObject({ id: t.String({ format: 'uuid' }) }),
		},
	)
	.get(
		'/',
		async ({ activeUser }) => getCredentialsForUser(activeUser, 'display'),
		{ detail: { summary: 'List credentials' } },
	);
