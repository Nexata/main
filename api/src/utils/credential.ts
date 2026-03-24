import { cache, db } from '@api/env';
import {
	AccessLevel,
	allAccessLevelEntries,
	credential,
	credentialAccess,
	encodeCredentialAccess,
	type Language,
	type OauthProvider,
	type OauthScope,
	user,
} from '@api/schema';
import type { ActiveUser } from '@api/utils/auth';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { providerRefreshers } from '@api/utils/token-refresh';
import { captureException } from '@sentry/bun';
import { and, eq, inArray, ne } from 'drizzle-orm';

const CACHE_TTL = 12 * 60 * 60;

const credentialCacheKey = (slug: string, credentialId: string) =>
	`credential:${slug}:${credentialId}`;

const userCredentialsSetKey = (slug: string, userId: string) =>
	`user:${slug}:${userId}:credentials`;

export type CachedCredential = {
	id: string;
	provider: OauthProvider;
	scope: OauthScope;
	accessToken: string;
	refreshToken: string;
	accessTokenExpiresAt: string;
	email: string;
	ownedBy: {
		id: string;
		email: string;
	};
};

const FIVE_MINUTES = 5 * 60 * 1000;

export async function ensureFreshTokens(
	credentialId: string,
	provider: OauthProvider,
	accessToken: string,
	refreshToken: string,
	accessTokenExpiresAt: Date | string,
	slug: string,
	language?: Language,
): Promise<{ at: string; rt: string }> {
	const expiresAt = new Date(accessTokenExpiresAt);
	if (expiresAt.getTime() > Date.now() + FIVE_MINUTES)
		return { at: accessToken, rt: refreshToken };

	const refresher = providerRefreshers[provider];
	if (!refresher) return { at: accessToken, rt: refreshToken };

	await refresher(credentialId, {
		slug,
		language,
		tokens: { accessToken, refreshToken },
	});
	const [updated] = await Promise.all([
		db
			.select({
				accessToken: credential.accessToken,
				refreshToken: credential.refreshToken,
			})
			.from(credential)
			.where(eq(credential.id, credentialId))
			.then((res) => res.at(0)),
		invalidateCredentialCache(slug, credentialId),
	]);

	if (!updated)
		throw httpError(HttpCode.NOT_FOUND, ErrorCode.CREDENTIAL_LOST, language);

	return { at: updated.accessToken, rt: updated.refreshToken };
}

export async function invalidateCredentialCache(
	slug: string,
	credentialId: string,
	affectedUserIds?: string[],
) {
	const credKey = credentialCacheKey(slug, credentialId);

	const userKeys = affectedUserIds?.length
		? affectedUserIds.map((uid) => userCredentialsSetKey(slug, uid))
		: await cache.keys(`user:${slug}:*:credentials`);

	return Promise.all([
		cache.del(credKey),
		...userKeys.map((key) => cache.del(key)),
	]);
}

export async function addCredentialToUserCache(
	slug: string,
	userId: string,
	credentialId: string,
	accessLevel: AccessLevel,
) {
	const setKey = userCredentialsSetKey(slug, userId);
	const entry = encodeCredentialAccess(credentialId, accessLevel);
	await cache.sadd(setKey, entry);
}

export async function getCredentialsForUser(
	activeUser: ActiveUser,
	returnType: 'usage',
): Promise<CachedCredential[]>;
export async function getCredentialsForUser(
	activeUser: ActiveUser,
	returnType: 'display',
): Promise<
	{
		id: string;
		userId: string;
		slug: string;
		accessLevel: AccessLevel;
		provider: OauthProvider;
		scope: OauthScope;
		email: string;
		isGlobal: boolean;
		ownedBy: {
			id: string;
			email: string;
			pfpUrl: string | null;
			displayName: string | null;
			isTenantAdmin: boolean;
		};
		permissions: {
			id: string;
			displayName: string | null;
			email: string;
			pfpUrl: string | null;
			accessLevel: AccessLevel;
		}[];
		createdAt: Date;
		accessToken: undefined;
		refreshToken: undefined;
		accessTokenExpiresAt: undefined;
	}[]
>;
export async function getCredentialsForUser(
	activeUser: ActiveUser,
	returnType: 'display' | 'usage',
) {
	const setKey = userCredentialsSetKey(activeUser.slug, activeUser.id);

	if (returnType === 'usage') {
		const cachedEntries = await cache.smembers(setKey);

		if (cachedEntries.length) {
			const cachedCredentials = await cache.mget<(CachedCredential | null)[]>(
				...cachedEntries
					.map((e) => e.split(':')[0]!)
					.map((id) => credentialCacheKey(activeUser.slug, id)),
			);

			if (cachedCredentials.every(Boolean)) return cachedCredentials;
		}
	}

	const credentials = await db
		.select()
		.from(credentialAccess)
		.where(eq(credentialAccess.userId, activeUser.id));

	if (!credentials.length) return [];

	const forUsage: [CachedCredential, string][] = credentials.map((c) => [
		{
			id: c.id,
			provider: c.provider,
			scope: c.scope,
			email: c.email,
			accessToken: c.accessToken,
			refreshToken: c.refreshToken,
			accessTokenExpiresAt: c.accessTokenExpiresAt.toISOString(),
			ownedBy: {
				id: c.ownerId,
				email: c.ownerEmail,
			},
		},
		encodeCredentialAccess(c.id, c.accessLevel),
	]);

	const [usageCredentials, userSetEntries] = [
		forUsage.map((c) => c[0]),
		forUsage.map((c) => c[1]),
	];

	if (usageCredentials.length) {
		const cachePromises: Promise<unknown>[] = usageCredentials.map((c) =>
			cache.set(credentialCacheKey(activeUser.slug, c.id), c, {
				ex: CACHE_TTL,
			}),
		);

		if (userSetEntries.length)
			cachePromises.push(
				cache.sadd(setKey, ...(userSetEntries as [string, ...string[]])),
			);

		await Promise.all(cachePromises);
	}

	if (returnType === 'usage') return usageCredentials;

	const credentialIds = credentials.map((c) => c.id);

	const [ownerRows, permissionRows] = await Promise.all([
		db
			.select({
				credentialId: credential.id,
				id: user.id,
				email: user.email,
				pfpUrl: user.pfpUrl,
				displayName: user.displayName,
				isTenantAdmin: user.isAdmin,
			})
			.from(credential)
			.innerJoin(user, eq(user.id, credential.userId))
			.where(inArray(credential.id, credentialIds)),
		db
			.select({
				credentialId: credentialAccess.id,
				id: credentialAccess.userId,
				accessLevel: credentialAccess.accessLevel,
			})
			.from(credentialAccess)
			.where(inArray(credentialAccess.id, credentialIds)),
	]);

	const ownerMap = new Map(ownerRows.map((o) => [o.credentialId, o]));

	const permUserIds = [...new Set(permissionRows.map((p) => p.id))];
	const permUsers = permUserIds.length
		? await db
				.select({
					id: user.id,
					displayName: user.displayName,
					email: user.email,
					pfpUrl: user.pfpUrl,
				})
				.from(user)
				.where(inArray(user.id, permUserIds))
		: [];
	const permUserMap = new Map(permUsers.map((u) => [u.id, u]));

	return credentials.map((c) => {
		const ownerInfo = ownerMap.get(c.id);
		const perms = permissionRows
			.filter((p) => p.credentialId === c.id && p.id !== c.ownerId)
			.map((p) => {
				const u = permUserMap.get(p.id);
				return {
					id: p.id,
					displayName: u?.displayName ?? null,
					email: u?.email ?? '',
					pfpUrl: u?.pfpUrl ?? null,
					accessLevel: p.accessLevel,
				};
			});

		return {
			id: c.id,
			userId: activeUser.id,
			slug: activeUser.slug,
			accessLevel: c.accessLevel,
			provider: c.provider,
			scope: c.scope,
			email: c.email,
			isGlobal: c.isGlobal,
			ownedBy: {
				id: ownerInfo?.id ?? c.ownerId,
				email: ownerInfo?.email ?? c.ownerEmail,
				pfpUrl: ownerInfo?.pfpUrl ?? null,
				displayName: ownerInfo?.displayName ?? null,
				isTenantAdmin: ownerInfo?.isTenantAdmin ?? false,
			},
			permissions: perms,
			createdAt: c.createdAt,
			accessToken: undefined,
			refreshToken: undefined,
			accessTokenExpiresAt: undefined,
		};
	});
}

export async function getTokensForUser(
	activeUser: ActiveUser,
	credentialId: string,
	adminExpected?: true,
) {
	const setKey = userCredentialsSetKey(activeUser.slug, activeUser.id);
	const membershipResults = await cache.smismember(
		setKey,
		allAccessLevelEntries(credentialId, adminExpected ?? false),
	);

	if (membershipResults.some(Boolean)) {
		const cached = await cache.get<CachedCredential>(
			credentialCacheKey(activeUser.slug, credentialId),
		);

		if (cached)
			return ensureFreshTokens(
				cached.id,
				cached.provider,
				cached.accessToken,
				cached.refreshToken,
				cached.accessTokenExpiresAt,
				activeUser.slug,
				activeUser.language,
			);
	}

	const result = (
		await db
			.select({
				accessLevel: credentialAccess.accessLevel,
				accessToken: credentialAccess.accessToken,
				refreshToken: credentialAccess.refreshToken,
				accessTokenExpiresAt: credentialAccess.accessTokenExpiresAt,
				provider: credentialAccess.provider,
			})
			.from(credentialAccess)
			.where(
				and(
					eq(credentialAccess.id, credentialId),
					eq(credentialAccess.userId, activeUser.id),
					adminExpected
						? and(
								ne(credentialAccess.accessLevel, AccessLevel.READ),
								ne(credentialAccess.accessLevel, AccessLevel.GLOBAL),
							)
						: undefined,
				),
			)
	).at(0);

	if (!result?.accessToken)
		throw httpError(
			HttpCode.FORBIDDEN,
			ErrorCode.NO_CREDENTIAL_FOUND,
			activeUser.language as Language,
		);

	await cache.sadd(
		setKey,
		encodeCredentialAccess(credentialId, result.accessLevel),
	);

	return ensureFreshTokens(
		credentialId,
		result.provider,
		result.accessToken,
		result.refreshToken,
		result.accessTokenExpiresAt,
		activeUser.slug,
		activeUser.language,
	);
}

export async function userHasCredential(
	activeUser: ActiveUser,
	credentialId: string,
	adminExpected?: true,
) {
	try {
		await getTokensForUser(activeUser, credentialId, adminExpected);
		return true;
	} catch (error) {
		captureException(error, {
			tags: { source: 'userHasCredential' },
			extra: { activeUser, credentialId, adminExpected },
		});
		return false;
	}
}
