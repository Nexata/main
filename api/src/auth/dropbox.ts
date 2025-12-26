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

const DROPBOX_CLIENT_CREDENTIALS: Oauth2Credentials = [
	warnEnv('DROPBOX_APP_KEY'),
	warnEnv('DROPBOX_APP_SECRET'),
	getOauthCallback('dropbox'),
];

export const dropboxRouter = new Elysia({ prefix: `/dropbox` })
	.use(oauth2({ Dropbox: DROPBOX_CLIENT_CREDENTIALS }))
	.use(jwtPlugin)
	.get(
		'/',
		async ({ oauth2, query }) =>
			createOauthRedirect(query, async (q) => {
				const url = oauth2.createURL(
					'Dropbox',
					[
						'account_info.read',
						'openid',
						'profile',
						'email',
						...(q.scope ? realOauthScopes[q.scope] : []),
					].filter((x: unknown): x is string => typeof x === 'string'),
				);

				if (q) {
					url.searchParams.set('token_access_type', 'offline');
					url.searchParams.set('prompt', 'consent');
				}

				return url;
			}),
		{
			detail: { summary: 'Dropbox OAuth' },
			query: oauthExtendedState(OauthProvider.DROPBOX),
		},
	)
	.get(
		'/callback',
		async ({ oauth2, query, jwt, refreshJwt }) =>
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
						throw HttpError.PreconditionFailed('EMAIL_NOT_FOUND');

					return {
						email: idToken.email,
						refreshTokenExpiresAt: new Date(Date.now() + 86400 * 365 * 10), // 10 years
						name:
							`${idToken.given_name ?? ''} ${idToken.family_name ?? ''}`.trim() ||
							undefined,
						pfpUrl: undefined,
					};
				},
			),
		{ detail: { summary: 'Dropbox OAuth Callback', hide: true } },
	);
