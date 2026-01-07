import {
	authorizeOauthCallback,
	createOauthRedirect,
	getOauthCallback,
	type Oauth2Credentials,
	oauthCredentialExtendedState,
	oauthLoginExtendedState,
} from '@api/auth/lib';
import { OauthProvider, realOauthScopes } from '@api/schema';
import { jwtPlugin } from '@api/utils/auth';
import { warnEnv } from '@api/utils/env';
import { Elysia } from 'elysia';
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
		'/login',
		async ({ oauth2, query }) =>
			createOauthRedirect(query, async () =>
				oauth2.createURL('Google', ['openid', 'profile', 'email']),
			),
		{
			detail: { summary: 'Google OAuth (login)' },
			query: oauthLoginExtendedState,
		},
	)
	.get(
		'/',
		async ({ oauth2, query }) =>
			createOauthRedirect(query, async (q) => {
				if (!q) throw HttpError.BadRequest('NO_SCOPES');

				const url = oauth2.createURL('Google', [
					'openid',
					'profile',
					'email',
					...q.scopes.flatMap((s) => realOauthScopes[s]),
				]);

				url.searchParams.set('access_type', 'offline');
				url.searchParams.set('prompt', 'consent');
				return url;
			}),
		{
			detail: { summary: 'Google OAuth (credential)' },
			query: oauthCredentialExtendedState(OauthProvider.GOOGLE),
		},
	)
	.get(
		'/callback',
		async ({ oauth2, query, jwt, refreshJwt, headers }) =>
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
						userAgent: headers['user-agent'],
					};
				},
			),
		{ detail: { summary: 'Google OAuth Callback', hide: true } },
	);
