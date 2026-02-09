import { cache, db } from '@api/env';
import {
	AccessLevel,
	allAccessLevelEntries,
	credentialAccess,
	encodeCredentialAccess,
	type Language,
	type OauthProvider,
	type OauthScope,
} from '@api/schema';
import type { JwtPayload } from '@api/utils/auth';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { and, eq, ne } from 'drizzle-orm';

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
	email: string;
	ownedBy: {
		id: string;
		email: string;
	};
};

export async function invalidateCredentialCache(
	slug: string,
	credentialId: string,
	affectedUserIds?: string[],
) {
	const credKey = credentialCacheKey(slug, credentialId);
	const accessEntries = allAccessLevelEntries(credentialId);

	const userKeys = affectedUserIds?.length
		? affectedUserIds.map((uid) => userCredentialsSetKey(slug, uid))
		: await cache.keys(`user:${slug}:*:credentials`);

	return Promise.all([
		cache.del(credKey),
		...userKeys.map((key) => cache.srem(key, ...accessEntries)),
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
	activeUser: JwtPayload,
	returnType: 'usage',
): Promise<CachedCredential[]>;
export async function getCredentialsForUser(
	activeUser: JwtPayload,
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
	}[]
>;
export async function getCredentialsForUser(
	activeUser: JwtPayload,
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
		.where(and(eq(credentialAccess.userId, activeUser.id)));

	if (!credentials.length) return [];

	const forUsage: [CachedCredential, string][] = credentials.map((c) => [
		{
			id: c.id,
			provider: c.provider,
			scope: c.scope,
			email: c.email,
			accessToken: c.accessToken,
			refreshToken: c.refreshToken,
			ownedBy: {
				id: c.ownedBy.id,
				email: c.ownedBy.email,
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

		if (cached) return { at: cached.accessToken, rt: cached.refreshToken };
	}

	const result = (
		await db
			.select({
				accessLevel: credentialAccess.accessLevel,
				accessToken: credentialAccess.accessToken,
				refreshToken: credentialAccess.refreshToken,
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

	return { at: result.accessToken, rt: result.refreshToken };
}

export async function userHasCredential(
	activeUser: JwtPayload,
	credentialId: string,
	adminExpected?: true,
) {
	try {
		await getTokensForUser(activeUser, credentialId, adminExpected);
		return true;
	} catch {
		return false;
	}
}
