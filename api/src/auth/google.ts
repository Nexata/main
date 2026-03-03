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
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { Elysia } from 'elysia';
import { oauth2 } from 'elysia-oauth2';

const GOOGLE_CLIENT_CREDENTIALS: Oauth2Credentials = [
	warnEnv('GOOGLE_CLIENT_ID', ''),
	warnEnv('GOOGLE_CLIENT_SECRET', ''),
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
				if (!q) throw httpError(HttpCode.BAD_REQUEST, ErrorCode.NO_SCOPES);

				const url = oauth2.createURL('Google', [
					'openid',
					'profile',
					'email',
					...realOauthScopes[q.scope],
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
				async (idToken: {
					email?: string;
					name?: string;
					picture?: string;
				}) => {
					if (!idToken?.email)
						throw httpError(
							HttpCode.PRECONDITION_FAILED,
							ErrorCode.EMAIL_NOT_FOUND,
						);

					return {
						email: idToken.email,
						name: idToken?.name,
						pfpUrl: idToken?.picture,
						userAgent: headers['user-agent'],
					};
				},
			),
		{ detail: { summary: 'Google OAuth Callback', hide: true } },
	);
