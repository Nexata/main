import { authPlugin } from '@api/auth';
import { db } from '@api/env';
import { credential, credentialPermission, user } from '@api/schema';
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
	.delete(
		'/:id',
		async ({ params: { id }, activeUser }) =>
			Promise.all([
				removeCachedCredentials(activeUser.slug),
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
					.returning({ credential: credential.id }),
			]),
		{
			detail: { summary: 'Delete credential by ID' },
			params: tObject({ id: t.String({ format: 'uuid' }) }),
		},
	)
	.get(
		'/',
		async ({ activeUser }) => getCredentialsForUser(activeUser, 'display'),
		{
			detail: { summary: 'List credentials' },
		},
	);
