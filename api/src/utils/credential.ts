import { cache, db } from '@api/env';
import type { OauthProvider, OauthScope } from '@api/schema';
import { credential, credentialPermission, user } from '@api/schema';
import type { JwtPayload } from '@api/utils/auth';
import { boolOr, coalesce, jsonAgg, jsonBuildObject } from '@api/utils/sql';
import {
	and,
	eq,
	exists,
	isNotNull,
	or,
	type SQLWrapper,
	sql,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { HttpError } from 'elysia-logger';

export async function removeCachedCredentials(
	slug: string,
	uid?: string,
	credentialId?: string,
) {
	if (uid)
		return cache.del(
			`credentials:${slug}:${uid}`,
			...(credentialId
				? [`t:${slug}:${uid}:${credentialId}`]
				: await cache.keys(`t:${slug}:${uid}:*`)),
		);

	if (credentialId) {
		const k = [
			...(await cache.keys(`credentials:${slug}:*`)),
			...(await cache.keys(`t:${slug}:*:${credentialId}`)),
		];

		return k.length && cache.del(...k);
	}

	const cachedCredentials = await cache.keys(`credentials:${slug}:*`);
	const cachedAccessTokens = await cache.keys(`t:${slug}:*:*`);
	const allKeys = [...cachedCredentials, ...cachedAccessTokens];
	return allKeys.length && cache.del(...allKeys);
}

export type CachedCredential = {
	provider: OauthProvider;
	scope: OauthScope;
	accessToken: string;
	refreshToken?: string;
	email: string;
	ownedBy: {
		id: string;
		email: string;
	};
};

export interface DisplayCredential {
	id: string;
	canAdmin: boolean;
	provider: OauthProvider;
	scope: OauthScope;
	email: string;
	isGlobal: boolean;
	ownedBy: {
		id: string;
		email: string;
		pfpUrl: string | null;
		displayName: string | null;
		isAdmin: boolean;
	};
	permissions: Array<{
		id: string;
		displayName: string | null;
		email: string;
		pfpUrl: string | null;
		isAdminOfCredential: boolean;
	}>;
	accessToken: undefined;
	refreshToken: undefined;
	createdAt: Date;
}

export async function getCredentialsForUser(
	activeUser: JwtPayload,
	returnType: 'usage',
): Promise<CachedCredential[]>;
export async function getCredentialsForUser(
	activeUser: JwtPayload,
	returnType: 'display',
): Promise<DisplayCredential[]>;
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
			scope: credential.scope,
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
			refreshToken: credential.refreshToken,
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

	const usageCredentials = credentials.map(
		(c) =>
			({
				provider: c.provider,
				scope: c.scope,
				email: c.email,
				accessToken: c.accessToken,
				refreshToken: c.refreshToken,
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
		: credentials.map((c) => ({
				...c,
				accessToken: undefined,
				refreshToken: undefined,
			}));
}

export async function getTokensForUser(
	activeUser: JwtPayload,
	credentialId: string,
	adminExpected?: true,
	...addedConditions: SQLWrapper[]
) {
	const cached = await cache.get<{ at: string; rt: string }>(
		`t:${activeUser.slug}:${activeUser.id}:${credentialId}`,
	);
	if (cached) return cached;

	const t = (
		await db
			.select({ at: credential.accessToken, rt: credential.refreshToken })
			.from(credential)
			.innerJoin(
				user,
				and(eq(user.id, credential.userId), eq(user.slug, activeUser.slug)),
			)
			.where(
				and(
					...addedConditions,
					eq(credential.id, credentialId),
					!activeUser.isAdmin
						? or(
								eq(credential.userId, activeUser.id),
								adminExpected && eq(credential.isGlobal, true),
								exists(
									db
										.select({ id: user.id })
										.from(credentialPermission)
										.where(
											and(
												eq(credentialPermission.credentialId, credential.id),
												eq(credentialPermission.userId, activeUser.id),
												adminExpected && eq(credentialPermission.isAdmin, true),
											),
										),
								),
							)
						: undefined,
				),
			)
	).at(0);

	if (!t?.at) throw HttpError.Forbidden('NO_CREDENTIAL_FOUND');

	await cache.set(`t:${activeUser.slug}:${activeUser.id}:${credentialId}`, t, {
		ex: 60 * 60,
	});

	return t;
}

export async function userHasCredential(
	activeUser: JwtPayload,
	credentialId: string,
	adminExpected?: true,
) {
	return Boolean(
		await getTokensForUser(activeUser, credentialId, adminExpected),
	);
}
