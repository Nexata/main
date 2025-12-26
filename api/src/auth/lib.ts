import { cache, db } from '@api/env';
import {
	credential,
	type OauthProvider,
	OauthScope,
	realOauthScopes,
	scopesPerProvider,
	user,
} from '@api/schema';
import { removeCachedCredentials } from '@api/utils/credential';
import { requireEnv } from '@api/utils/env';
import { lowerEq } from '@api/utils/sql';
import { Nullish, tObject } from '@api/utils/type';
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

export const oauthExtendedState = (provider?: OauthProvider) =>
	tObject({
		tenant: t.String({
			minLength: 2,
			pattern: '^[a-z0-9]{2,16}$',
			description: 'Tenant slug',
		}),
		scope: Nullish(
			provider
				? t.Union(scopesPerProvider[provider].map((scope) => t.Literal(scope)))
				: t.Enum(OauthScope),
			{
				description:
					'For simple login, do not provide a scope. For credentials and permissions, use the desired `scope` from the available list.',
			},
		),
		redirect: Nullish(t.String({ format: 'uri' }), {
			description: 'URL to redirect user after successful authentication.',
		}),
	});

export const plainOauthExtendedState = oauthExtendedState();
export type OauthExtendedState = Static<typeof plainOauthExtendedState>;

export async function createOauthRedirect(
	query: OauthExtendedState,
	urlFunc: (q: OauthExtendedState) => Promise<URL>,
) {
	const url = await urlFunc(query);

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
		q.scope &&
		tokens.hasScopes() &&
		realOauthScopes[q.scope].some((scope) => !tokens.scopes().includes(scope))
	)
		throw HttpError.Conflict('SCOPE_MISMATCH');

	if (q.scope && !tokens.hasRefreshToken())
		throw HttpError.Conflict('NO_REFRESH_TOKEN');

	const metadata = await metadataFunc(
		await Promise.resolve()
			.then(() => tokens.idToken())
			.then(decodeIdToken)
			.catch(() => ({})),
		tokens.data,
	);

	if (q.scope && !metadata.refreshTokenExpiresAt)
		throw HttpError.Conflict('NO_REFRESH_TOKEN_EXPIRATION');

	const u = (
		await db
			.select()
			.from(user)
			.where(
				and(
					lowerEq(user.email, metadata.email.toLowerCase()),
					eq(user.slug, q.tenant.toLowerCase()),
				),
			)
	).at(0);

	if (!u?.id) throw HttpError.Forbidden('USER_NOT_FOUND');

	if ((!u.displayName && metadata.name) || (!u.pfpUrl && metadata.pfpUrl))
		await db
			.update(user)
			.set({ displayName: metadata.name, pfpUrl: metadata.pfpUrl })
			.where(eq(user.id, u.id));

	const url = q.redirect && new URL(q.redirect);

	if (!q.scope) {
		const [accessToken, refreshToken] = await Promise.all([
			jwtSign(u),
			refreshJwtSign(u),
		]);

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
		// biome-ignore lint/style/noNonNullAssertion: no reach
		refreshTokenExpiresAt: metadata.refreshTokenExpiresAt!,
	};

	await Promise.all([
		removeCachedCredentials(u.slug),
		db
			.insert(credential)
			.values({
				userId: u.id,
				provider: provider,
				scope: [q.scope],
				...set,
			})
			.onConflictDoUpdate({
				set,
				target: [credential.userId, credential.provider, credential.scope],
			}),
	]);

	return url ? redirect(url.href) : true;
}
