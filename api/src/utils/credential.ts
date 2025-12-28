import { cache, db } from '@api/env';
import type { OauthProvider, OauthScope } from '@api/schema';
import { credential, credentialPermission, user } from '@api/schema';
import type { JwtPayload } from '@api/utils/auth';
import { boolOr, coalesce, jsonAgg, jsonBuildObject } from '@api/utils/sql';
import { and, eq, exists, isNotNull, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

export async function removeCachedCredentials(slug: string, uids?: string[]) {
	const cachedCredentials =
		uids?.map((uid) => `credentials:${slug}:${uid}`) ??
		(await cache.keys(`credentials:${slug}:*`));

	return cachedCredentials?.length ? await cache.del(...cachedCredentials) : 0;
}

export type CachedCredential = {
	provider: OauthProvider;
	scopes: OauthScope[];
	accessToken: string;
	email: string;
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
	// biome-ignore lint/suspicious/noExplicitAny: typo
): Promise<any[]>;
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

	const credentialPermissionUser = alias(user, 'credential_permission_user');
	const credentials = await db
		.select({
			id: credential.id,
			canAdmin: activeUser.isAdmin
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
			provider: credential.provider,
			scopes: credential.scopes,
			email: credential.email,
			isGlobal: credential.isGlobal,
			ownedBy: jsonBuildObject({
				id: user.id,
				email: user.email,
				pfpUrl: user.pfpUrl,
				displayName: user.displayName,
				isAdmin: user.isAdmin,
			}).as('owned_by'),
			permissions: coalesce(
				jsonAgg(
					jsonBuildObject({
						id: credentialPermissionUser.id,
						displayName: credentialPermissionUser.displayName,
						email: credentialPermissionUser.email,
						pfpUrl: credentialPermissionUser.pfpUrl,
						isAdminOfCredential: credentialPermission.isAdmin,
					}),
					isNotNull(credentialPermissionUser.id),
				),
				sql<[]>`'[]'::json`,
			).as('permissions'),
			accessToken: credential.accessToken,
			createdAt: credential.createdAt,
		})
		.from(credential)
		.innerJoin(user, eq(user.id, credential.userId))
		.leftJoin(
			credentialPermission,
			eq(credentialPermission.credentialId, credential.id),
		)
		.leftJoin(
			credentialPermissionUser,
			and(
				eq(credentialPermissionUser.id, credentialPermission.userId),
				eq(credentialPermissionUser.isAdmin, false),
			),
		)
		.where(
			and(
				!activeUser.isAdmin
					? or(
							eq(credential.userId, activeUser.id),
							and(
								eq(credential.isGlobal, true),
								eq(user.slug, activeUser.slug),
							),
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
		)
		.groupBy(credential.id, user.id);

	const usageCredentials = [
		...credentials
			.map(
				(c) =>
					({
						provider: c.provider,
						scopes: c.scopes,
						email: c.email,
						accessToken: c.accessToken,
						ownedBy: {
							id: c.ownedBy.id,
							email: c.ownedBy.email,
						},
					}) satisfies CachedCredential,
			)
			.reduce((m, c) => {
				const k = `${c.email}-${c.provider}-${JSON.stringify(c.scopes.sort())}`;
				return m.has(k) ? m : m.set(k, c);
			}, new Map<string, CachedCredential>())
			.values(),
	];

	await cache.set(
		`credentials:${activeUser.slug}:${activeUser.id}`,
		usageCredentials,
		{ ex: 60 * 60 * 12 },
	);

	return returnType === 'usage'
		? usageCredentials
		: credentials.map((c) => ({ ...c, accessToken: undefined }));
}
