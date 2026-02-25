import { cache, db } from '@api/env';
import {
	AccessLevel,
	credential,
	credentialPermission,
	device,
	type OauthProvider,
	OauthScope,
	realOauthScopes,
	scopesPerProvider,
	TraceType,
	tenant,
	trace,
	user,
} from '@api/schema';
import { userCacheKey } from '@api/utils/auth';
import { addCredentialToUserCache } from '@api/utils/credential';
import { requireEnv } from '@api/utils/env';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { lowerEq } from '@api/utils/sql';
import { Nullish } from '@api/utils/type';
import { and, eq, inArray } from 'drizzle-orm';
import { redirect, type Static, t } from 'elysia';
import { decodeIdToken, type OAuth2Tokens } from 'elysia-oauth2';

export type Oauth2Credentials = [
	clientId: string,
	clientSecret: string,
	redirectURI: string,
];

export const getOauthCallback = (key: string) =>
	`${requireEnv('DEPLOYMENT_URL')}/auth/${key}/callback`;

export const oauthLoginExtendedState = t.Object({
	flow: t.Literal('login', { default: 'login' }),
	tenant: Nullish(
		t.String({
			minLength: 2,
			pattern: '^[a-z0-9]{2,16}$',
			description: 'Tenant slug',
		}),
	),
	fingerprint: t.String({
		description: 'Device fingerprint for token tracking',
	}),
	redirect: Nullish(t.String({ format: 'uri' }), {
		description: 'URL to redirect user after successful authentication.',
	}),
});

export type OauthLoginExtendedState = Static<typeof oauthLoginExtendedState>;

export const oauthCredentialExtendedState = (provider?: OauthProvider) =>
	t.Object({
		flow: t.Readonly(t.Literal('credential', { default: 'credential' })),
		scope: provider
			? t.Union(
					scopesPerProvider[provider].map((scope) => t.Literal(scope)),
					{ description: `Scopes to request from ${provider}.` },
				)
			: t.Enum(OauthScope, {
					description: 'Scopes to request from the provider.',
				}),
		userId: t.String({ format: 'uuid' }),
		redirect: Nullish(t.String({ format: 'uri' }), {
			description: 'URL to redirect user after successful authentication.',
		}),
	});

export const plainOauthCredentialExtendedState = oauthCredentialExtendedState();
export type OauthCredentialExtendedState = Static<
	typeof plainOauthCredentialExtendedState
>;

export type OauthExtendedState =
	| OauthLoginExtendedState
	| OauthCredentialExtendedState;

export async function createOauthRedirect(
	query: OauthExtendedState,
	urlFunc: (q: OauthCredentialExtendedState | false) => Promise<URL>,
	userId?: string,
) {
	const url = await urlFunc(query.flow === 'credential' && query);

	const state = url.searchParams.get('state');
	if (!state) throw httpError(HttpCode.CONFLICT, ErrorCode.STATE_NOT_FOUND);

	await cache.set(state, userId ? { ...query, userId } : query, { ex: 3600 });
	return { url: url.href };
}

export async function authorizeOauthCallback(
	provider: OauthProvider,
	query: { state: string },
	tokens: OAuth2Tokens,
	// biome-ignore lint/suspicious/noExplicitAny: JWT miss-type
	jwtSign: (signValue: any) => Promise<string>,
	// biome-ignore lint/suspicious/noExplicitAny: JWT miss-type
	refreshJwtSign: (signValue: any) => Promise<string>,
	metadataFunc: (
		decodedIdToken: object,
		callbackData?: object,
	) => Promise<{
		email: string;
		refreshTokenExpiresAt?: Date;
		name?: string;
		pfpUrl?: string;
		userAgent?: string;
	}>,
) {
	const q = await cache.getdel<OauthExtendedState>(query.state);
	if (!q) throw httpError(HttpCode.CONFLICT, ErrorCode.STATE_NOT_FOUND);

	if (
		q.flow === 'credential' &&
		realOauthScopes[q.scope].some((s) => !tokens.scopes().includes(s))
	)
		throw httpError(HttpCode.CONFLICT, ErrorCode.SCOPE_MISMATCH);

	if (q.flow === 'credential' && !tokens.hasRefreshToken())
		throw httpError(HttpCode.CONFLICT, ErrorCode.NO_REFRESH_TOKEN);

	const metadata = await metadataFunc(
		await Promise.resolve()
			.then(() => tokens.idToken())
			.then(decodeIdToken)
			.catch(() => ({})),
		tokens.data,
	);

	const url = q.redirect && new URL(q.redirect);

	if (q.flow === 'login') {
		const users = await db
			.select()
			.from(user)
			.innerJoin(tenant, eq(user.slug, tenant.slug))
			.where(
				and(
					lowerEq(user.email, metadata.email.toLowerCase()),
					q.tenant ? eq(user.slug, q.tenant.toLowerCase()) : undefined,
				),
			);

		if (!users.length)
			throw httpError(HttpCode.FORBIDDEN, ErrorCode.USER_NOT_FOUND);

		const toUpdate = users.filter(
			(row) =>
				(!row.user.displayName && metadata.name) ||
				(!row.user.pfpUrl && metadata.pfpUrl),
		);

		if (toUpdate.length)
			await db
				.update(user)
				.set({ displayName: metadata.name, pfpUrl: metadata.pfpUrl })
				.where(
					inArray(
						user.id,
						toUpdate.map((row) => row.user.id),
					),
				);

		const ttl = 12 * 60 * 60;

		const sessions = await Promise.all(
			users.map(async (row) => {
				const u = {
					...row.user,
					displayName: row.user.displayName ?? metadata.name ?? null,
					pfpUrl: row.user.pfpUrl ?? metadata.pfpUrl ?? null,
				};

				const [at, rt] = await Promise.all([
					jwtSign({ id: u.id, slug: u.slug }),
					refreshJwtSign({ id: u.id }),
				]);

				const set = {
					accessToken: at,
					refreshToken: rt,
					userAgent: metadata.userAgent,
					createdAt: new Date(),
				};

				await Promise.all([
					db
						.insert(device)
						.values({
							fingerprint: q.fingerprint,
							userId: u.id,
							...set,
						})
						.onConflictDoUpdate({
							target: [device.userId, device.fingerprint],
							set,
						}),
					cache.set(`device:${u.id}:${q.fingerprint}`, at, { ex: ttl }),
					cache.set(
						userCacheKey(u.slug, u.id),
						{ ...u, apiKey: null },
						{ ex: ttl },
					),
				]);

				return {
					at,
					rt,
					user: {
						id: u.id,
						email: u.email,
						displayName: u.displayName,
						pfpUrl: u.pfpUrl,
					},
					tenant: {
						slug: row.tenant.slug,
						displayName: row.tenant.displayName,
						logoUrl: row.tenant.logoUrl,
					},
				};
			}),
		);

		if (url) url.searchParams.set('sessions', btoa(JSON.stringify(sessions)));
		return url ? redirect(url.href) : sessions;
	}

	const u = (await db.select().from(user).where(eq(user.id, q.userId))).at(0);

	if (!u?.id) throw httpError(HttpCode.FORBIDDEN, ErrorCode.USER_NOT_FOUND);

	if ((!u.displayName && metadata.name) || (!u.pfpUrl && metadata.pfpUrl)) {
		await db
			.update(user)
			.set({ displayName: metadata.name, pfpUrl: metadata.pfpUrl })
			.where(eq(user.id, u.id));

		u.pfpUrl = u.pfpUrl ?? metadata.pfpUrl ?? null;
		u.displayName = u.displayName ?? metadata.name ?? null;
	}

	const set = {
		accessToken: tokens.accessToken(),
		accessTokenExpiresAt: tokens.accessTokenExpiresAt(),
		refreshToken: tokens.refreshToken(),
		refreshTokenExpiresAt: metadata.refreshTokenExpiresAt ?? null,
	};

	const cred = (
		await db
			.insert(credential)
			.values({
				userId: u.id,
				email: metadata.email,
				provider: provider,
				scope: q.scope,
				...set,
			})
			.onConflictDoUpdate({
				set,
				target: [credential.provider, credential.email, credential.scope],
			})
			.returning({ id: credential.id, userId: credential.userId })
	).at(0);

	if (!cred)
		throw httpError(
			HttpCode.INTERNAL_SERVER_ERROR,
			ErrorCode.CREDENTIAL_NOT_UPSERTED,
		);

	if (cred.userId !== u.id)
		await db
			.insert(credentialPermission)
			.values({
				credentialId: cred.id,
				userId: u.id,
				isAdmin: true,
			})
			.onConflictDoUpdate({
				target: [
					credentialPermission.credentialId,
					credentialPermission.userId,
				],
				set: { isAdmin: true },
			});

	await Promise.all([
		db.insert(trace).values({
			userId: u.id,
			type: TraceType.CREDENTIAL_ADDED,
			metadata: { credentialId: cred.id },
		}),
		addCredentialToUserCache(u.slug, u.id, cred.id, AccessLevel.ADMIN),
	]);

	return url ? redirect(url.href) : true;
}
