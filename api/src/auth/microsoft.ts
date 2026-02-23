import {
	authorizeOauthCallback,
	createOauthRedirect,
	getOauthCallback,
	type Oauth2Credentials,
	oauthCredentialExtendedState,
	oauthLoginExtendedState,
} from '@api/auth/lib';
import { IS_PRODUCTION } from '@api/env';
import { OauthProvider, realOauthScopes } from '@api/schema';
import { jwtPlugin } from '@api/utils/auth';
import { warnEnv } from '@api/utils/env';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { Elysia } from 'elysia';
import { oauth2 } from 'elysia-oauth2';

const MICROSOFT_CLIENT_CREDENTIALS: [tenant: string, ...Oauth2Credentials] = [
	warnEnv('MICROSOFT_TENANT_ID', 'common'),
	warnEnv('MICROSOFT_CLIENT_ID', ''),
	warnEnv('MICROSOFT_CLIENT_SECRET', ''),
	getOauthCallback('microsoft'),
];

export const microsoftRouter = new Elysia({ prefix: `/microsoft` })
	.use(
		oauth2(
			{ MicrosoftEntraId: MICROSOFT_CLIENT_CREDENTIALS },
			{
				cookie: { secure: IS_PRODUCTION },
			},
		),
	)
	.use(jwtPlugin)
	.get(
		'/login',
		async ({ oauth2, query }) =>
			createOauthRedirect(query, async () =>
				oauth2.createURL('MicrosoftEntraId', ['openid', 'profile', 'email']),
			),
		{
			detail: { summary: 'Microsoft OAuth (login)' },
			query: oauthLoginExtendedState,
		},
	)
	.get(
		'/',
		async ({ oauth2, query }) =>
			createOauthRedirect(query, async (q) => {
				if (!q) throw httpError(HttpCode.BAD_REQUEST, ErrorCode.NO_SCOPES);

				const url = oauth2.createURL('MicrosoftEntraId', [
					'openid',
					'profile',
					'email',
					'offline_access',
					...realOauthScopes[q.scope],
				]);

				url.searchParams.set('prompt', 'consent');
				return url;
			}),
		{
			detail: { summary: 'Microsoft OAuth (credential)' },
			query: oauthCredentialExtendedState(OauthProvider.MICROSOFT),
		},
	)
	.get(
		'/callback',
		async ({ oauth2, query, jwt, refreshJwt, headers }) =>
			authorizeOauthCallback(
				OauthProvider.MICROSOFT,
				query,
				await oauth2.authorize('MicrosoftEntraId'),
				jwt.sign,
				refreshJwt.sign,
				async (idToken: {
					email?: string;
					preferred_username?: string;
					name?: string;
				}) => {
					const email = idToken.email ?? idToken.preferred_username;
					if (!email)
						throw httpError(
							HttpCode.PRECONDITION_FAILED,
							ErrorCode.EMAIL_NOT_FOUND,
						);

					return {
						email,
						name: idToken.name,
						pfpUrl: undefined,
						userAgent: headers['user-agent'],
					};
				},
			),
		{ detail: { summary: 'Microsoft OAuth Callback', hide: true } },
	);
