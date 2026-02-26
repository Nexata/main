import {
	authorizeOauthCallback,
	createOauthRedirect,
	getOauthCallback,
	type Oauth2Credentials,
	oauthCredentialExtendedState,
	oauthLoginExtendedState,
} from '@api/auth/lib';
import { authPlugin } from '@api/auth/plugin';
import { OauthProvider, realOauthScopes } from '@api/schema';
import { jwtPlugin } from '@api/utils/auth';
import { warnEnv } from '@api/utils/env';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { Elysia, t } from 'elysia';
import { oauth2 } from 'elysia-oauth2';

const DROPBOX_CLIENT_CREDENTIALS: Oauth2Credentials = [
	warnEnv('DROPBOX_APP_KEY', ''),
	warnEnv('DROPBOX_APP_SECRET', ''),
	getOauthCallback('dropbox'),
];

export const dropboxRouter = new Elysia({ prefix: `/dropbox` })
	.use(oauth2({ Dropbox: DROPBOX_CLIENT_CREDENTIALS }))
	.use(jwtPlugin)
	.get(
		'/login',
		async ({ oauth2, query }) =>
			createOauthRedirect(query, async () => {
				const url = oauth2.createURL('Dropbox', [
					'account_info.read',
					'openid',
					'profile',
					'email',
				]);

				return url;
			}),
		{
			detail: { summary: 'Dropbox OAuth (login)' },
			query: oauthLoginExtendedState,
		},
	)
	.get(
		'/callback',
		async ({ oauth2, query, jwt, refreshJwt, headers }) =>
			authorizeOauthCallback(
				OauthProvider.DROPBOX,
				query,
				await oauth2.authorize('Dropbox'),
				jwt.sign,
				refreshJwt.sign,
				async (idToken: {
					email?: string;
					given_name?: string;
					family_name?: string;
				}) => {
					if (!idToken.email)
						throw httpError(
							HttpCode.PRECONDITION_FAILED,
							ErrorCode.EMAIL_NOT_FOUND,
						);

					return {
						email: idToken.email,
						name:
							`${idToken.given_name ?? ''} ${idToken.family_name ?? ''}`.trim() ||
							undefined,
						pfpUrl: undefined,
						userAgent: headers['user-agent'],
					};
				},
			),
		{ detail: { summary: 'Dropbox OAuth Callback', hide: true } },
	)
	.use(authPlugin())
	.get(
		'/',
		async ({ oauth2, query, activeUser }) =>
			createOauthRedirect(
				query,
				async (q) => {
					if (!q) throw httpError(HttpCode.BAD_REQUEST, ErrorCode.NO_SCOPES);

					const url = oauth2.createURL('Dropbox', [
						'account_info.read',
						'openid',
						'profile',
						'email',
						...realOauthScopes[q.scope],
					]);

					url.searchParams.set('token_access_type', 'offline');
					url.searchParams.set('prompt', 'consent');
					return url;
				},
				activeUser.id,
			),
		{
			detail: { summary: 'Dropbox OAuth (credential)' },
			query: t.Omit(oauthCredentialExtendedState(OauthProvider.DROPBOX), [
				'userId',
			]),
		},
	);
