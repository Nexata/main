import {
	authorizeOauthCallback,
	createOauthRedirect,
	getOauthCallback,
	type Oauth2Credentials,
	oauthExtendedState,
} from '@api/auth/lib';
import { OauthProvider, realOauthScopes } from '@api/schema';
import { jwtPlugin } from '@api/utils/auth';
import { warnEnv } from '@api/utils/env';
import Elysia from 'elysia';
import { HttpError } from 'elysia-logger';
import { oauth2 } from 'elysia-oauth2';

const GOOGLE_CLIENT_CREDENTIALS: Oauth2Credentials = [
	warnEnv('GOOGLE_CLIENT_ID'),
	warnEnv('GOOGLE_CLIENT_SECRET'),
	getOauthCallback('google'),
];

export const googleRouter = new Elysia({ prefix: `/google` })
	.use(oauth2({ Google: GOOGLE_CLIENT_CREDENTIALS }))
	.use(jwtPlugin)
	.get(
		'/',
		async ({ oauth2, query }) =>
			createOauthRedirect(query, async (q) => {
				const url = oauth2.createURL(
					'Google',
					[
						'openid',
						'profile',
						'email',
						...(q.scope ? realOauthScopes[q.scope] : []),
					].filter((x: unknown): x is string => typeof x === 'string'),
				);

				if (q) {
					url.searchParams.set('access_type', 'offline');
					url.searchParams.set('prompt', 'consent');
				}

				return url;
			}),
		{
			detail: { summary: 'Google OAuth' },
			query: oauthExtendedState(OauthProvider.GOOGLE),
		},
	)
	.get(
		'/callback',
		async ({ oauth2, query, jwt, refreshJwt }) =>
			authorizeOauthCallback(
				OauthProvider.GOOGLE,
				query,
				await oauth2.authorize('Google'),
				jwt.sign,
				refreshJwt.sign,
				async (
					idToken: { email?: string; name?: string; picture?: string },
					data?: { refresh_token_expires_in?: number },
				) => {
					if (!idToken?.email)
						throw HttpError.PreconditionFailed('EMAIL_NOT_FOUND');

					return {
						email: idToken.email,
						refreshTokenExpiresAt: data?.refresh_token_expires_in
							? new Date(Date.now() + data.refresh_token_expires_in * 1000)
							: undefined,
						name: idToken?.name,
						pfpUrl: idToken?.picture,
					};
				},
			),
		{ detail: { summary: 'Google OAuth Callback', hide: true } },
	);
