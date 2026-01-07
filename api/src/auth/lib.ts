import { cache, db } from '@api/env';
import {
	credential,
	device,
	type OauthProvider,
	OauthScope,
	realOauthScopes,
	scopesPerProvider,
	user,
} from '@api/schema';
import { removeCachedCredentials } from '@api/utils/credential';
import { requireEnv } from '@api/utils/env';
import { lowerEq } from '@api/utils/sql';
import { Nullish } from '@api/utils/type';
import { and, eq } from 'drizzle-orm';
import { redirect, type Static, t } from 'elysia';
import { HttpError } from 'elysia-logger';
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
	tenant: t.String({
		minLength: 2,
		pattern: '^[a-z0-9]{2,16}$',
		description: 'Tenant slug',
	}),
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
		scopes: t.Array(
			provider
				? t.Union(scopesPerProvider[provider].map((scope) => t.Literal(scope)))
				: t.Enum(OauthScope),
			{ description: 'Scopes to request from the provider.', minItems: 1 },
		),
		userId: t.String({ format: 'uuid' }),
		fingerprint: t.String({
			description: 'Device fingerprint for token tracking',
		}),
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
) {
	const url = await urlFunc(query.flow === 'credential' && query);

	const state = url.searchParams.get('state');
	if (!state) throw HttpError.Conflict('STATE_NOT_FOUND');

	await cache.set(state, query, { ex: 3600 });
	return redirect(url.href);
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
	}>,
) {
	const q = await cache.getdel<OauthExtendedState>(query.state);
	if (!q) throw HttpError.Conflict('STATE_NOT_FOUND');

	if (
		q.flow === 'credential' &&
		q.scopes
			.flatMap((s) => realOauthScopes[s])
			.some((s) => !tokens.scopes().includes(s))
	)
		throw HttpError.Conflict('SCOPE_MISMATCH');

	if (q.flow === 'credential' && !tokens.hasRefreshToken())
		throw HttpError.Conflict('NO_REFRESH_TOKEN');

	const metadata = await metadataFunc(
		await Promise.resolve()
			.then(() => tokens.idToken())
			.then(decodeIdToken)
			.catch(() => ({})),
		tokens.data,
	);

	if (q.flow === 'credential' && !metadata.refreshTokenExpiresAt)
		throw HttpError.Conflict('NO_REFRESH_TOKEN_EXPIRATION');

	const u = (
		await db
			.select()
			.from(user)
			.where(
				q.flow === 'credential'
					? eq(user.id, q.userId)
					: and(
							lowerEq(user.email, metadata.email.toLowerCase()),
							eq(user.slug, q.tenant.toLowerCase()),
						),
			)
	).at(0);

	if (!u?.id) throw HttpError.Forbidden('USER_NOT_FOUND');

	if ((!u.displayName && metadata.name) || (!u.pfpUrl && metadata.pfpUrl)) {
		await db
			.update(user)
			.set({ displayName: metadata.name, pfpUrl: metadata.pfpUrl })
			.where(eq(user.id, u.id));

		u.pfpUrl = u.pfpUrl ?? metadata.pfpUrl ?? null;
		u.displayName = u.displayName ?? metadata.name ?? null;
	}

	const url = q.redirect && new URL(q.redirect);

	if (q.flow === 'login') {
		const [accessToken, refreshToken] = await Promise.all([
			jwtSign(u),
			refreshJwtSign(u),
		]);

		await db.batch([
			db.insert(device).values({
				fingerprint: q.fingerprint,
				userId: u.id,
				isAccessToken: true,
			}),
			db.insert(device).values({
				fingerprint: q.fingerprint,
				userId: u.id,
				isAccessToken: false,
			}),
		]);

		await cache.set(`device:${u.id}:${q.fingerprint}:access`, accessToken, {
			ex: 43200,
		});

		if (url) {
			url.searchParams.set('at', accessToken);
			url.searchParams.set('rt', refreshToken);
		}

		return url ? redirect(url.href) : { accessToken, refreshToken };
	}

	const set = {
		accessToken: tokens.accessToken(),
		accessTokenExpiresAt: tokens.accessTokenExpiresAt(),
		refreshToken: tokens.refreshToken(),
		refreshTokenExpiresAt: metadata.refreshTokenExpiresAt!,
	};

	await Promise.all([
		removeCachedCredentials(u.slug),
		db.batch([
			db
				.insert(credential)
				.values({
					userId: u.id,
					email: metadata.email,
					provider: provider,
					scopes: q.scopes,
					...set,
				})
				.onConflictDoUpdate({
					set,
					target: [credential.provider, credential.email, credential.scopes],
				}),
			db.insert(device).values({
				fingerprint: q.fingerprint,
				userId: u.id,
				isAccessToken: true,
			}),
			db.insert(device).values({
				fingerprint: q.fingerprint,
				userId: u.id,
				isAccessToken: false,
			}),
		]),
		cache.set(`device:${u.id}:${q.fingerprint}:access`, set.accessToken, {
			ex: 43200,
		}),
	]);

	return url ? redirect(url.href) : true;
}
