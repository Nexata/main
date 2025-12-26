import { cache, db } from '@api/env';
import type { OauthProvider, OauthScope } from '@api/schema';
import { credential, credentialPermission, user } from '@api/schema';
import type { JwtPayload } from '@api/utils/auth';
import { jsonBuildObject } from '@api/utils/sql';
import { and, eq, exists, or } from 'drizzle-orm';

export async function removeCachedCredentials(slug: string, uids?: string[]) {
	const cachedCredentials =
		uids?.map((uid) => `credentials:${slug}:${uid}`) ??
		(await cache.keys(`credentials:${slug}:*`));

	return cachedCredentials?.length ? await cache.del(...cachedCredentials) : 0;
}

export type CachedCredential = {
	provider: OauthProvider;
	scope: OauthScope[];
	accessToken: string;
	ownedBy: {
		id: string;
		email: string;
	};
};

export async function getCredentialsForUser(
	activeUser: JwtPayload,
	returnType: 'usage',
): Promise<CachedCredential[]>;
export async function getCredentialsForUser(
	activeUser: JwtPayload,
	returnType: 'display',
): Promise<unknown>; // typo
export async function getCredentialsForUser(
	activeUser: JwtPayload,
	returnType: 'display' | 'usage' = 'display',
) {
	if (returnType === 'usage') {
		const cached = await cache.get<CachedCredential[]>(
			`credentials:${activeUser.slug}:${activeUser.id}`,
		);
		if (cached) return cached;
	}

	const credentials = await db
		.select({
			id: credential.id,
			isAdminOfCredential: credentialPermission.isAdmin,
			ownedBy: jsonBuildObject({
				id: user.id,
				email: user.email,
				pfpUrl: user.pfpUrl,
				displayName: user.displayName,
				isAdmin: user.isAdmin,
			}),
			provider: credential.provider,
			scope: credential.scope,
			isGlobal: credential.isGlobal,
			accessToken: credential.accessToken,
			// TODO: Permissions array of users
			createdAt: credential.createdAt,
		})
		.from(credential)
		.innerJoin(user, eq(user.id, credential.userId))
		.where(
			and(
				!activeUser.isAdmin
					? or(
							eq(credential.userId, activeUser.id),
							exists(
								db
									.select({ id: user.id })
									.from(credentialPermission)
									.where(
										and(
											eq(credentialPermission.credentialId, credential.id),
											eq(credentialPermission.userId, activeUser.id),
										),
									),
							),
						)
					: eq(user.slug, activeUser.slug),
			),
		);

	const usageCredentials = credentials.map(
		(c) =>
			({
				provider: c.provider,
				scope: c.scope,
				accessToken: c.accessToken,
				ownedBy: {
					id: c.ownedBy.id,
					email: c.ownedBy.email,
				},
			}) satisfies CachedCredential,
	);

	await cache.set(
		`credentials:${activeUser.slug}:${activeUser.id}`,
		usageCredentials,
		{ ex: 60 * 60 * 12 },
	);

	return returnType === 'usage'
		? usageCredentials
		: credentials.map((c) => ({ ...c, accessToken: undefined }));
}
