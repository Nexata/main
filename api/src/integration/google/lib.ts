import { db } from '@api/env';
import { credential } from '@api/schema';
import { invalidateCredentialCache } from '@api/utils/credential';
import { requireEnv } from '@api/utils/env';
import { auth } from '@googleapis/gmail';
import { eq } from 'drizzle-orm';
import { HttpError } from 'elysia-logger';
import type { OAuth2Client } from 'google-auth-library';

export namespace Google {
	export const createOAuth2Client = (): OAuth2Client =>
		new auth.OAuth2(
			requireEnv('GOOGLE_CLIENT_ID'),
			requireEnv('GOOGLE_CLIENT_SECRET'),
		);

	export async function refreshTokens(
		credentialId: string,
		options?: {
			slug?: string;
			tokens?: { refreshToken: string; accessToken: string };
		},
	) {
		const tokens =
			options?.tokens ??
			(
				await db
					.select({
						refreshToken: credential.refreshToken,
						accessToken: credential.accessToken,
					})
					.from(credential)
					.where(eq(credential.id, credentialId))
			).at(0);

		if (!tokens) throw HttpError.NotFound('CREDENTIAL_LOST');

		const oauth2Client = createOAuth2Client();
		oauth2Client.setCredentials({
			access_token: tokens.accessToken,
			refresh_token: tokens.refreshToken,
		});

		let credentials: typeof oauth2Client.credentials;
		try {
			const res = await oauth2Client.refreshAccessToken();
			credentials = res.credentials;
		} catch (e) {
			if (e instanceof Error && e.message.includes('invalid_grant'))
				throw HttpError.Unauthorized('CREDENTIAL_EXPIRED');
			throw e;
		}

		if (credentials.access_token === tokens.accessToken) return false;

		const newTokens = {
			accessToken: credentials.access_token!,
			accessTokenExpiresAt: credentials.expiry_date
				? new Date(credentials.expiry_date)
				: new Date(Date.now() + 3600 * 1000),
			refreshToken: credentials.refresh_token ?? tokens.refreshToken,
			refreshTokenExpiresAt: new Date(Date.now() + 86400 * 365 * 10),
		};

		if (options?.slug)
			await Promise.all([
				db
					.update(credential)
					.set(newTokens)
					.where(eq(credential.id, credentialId)),
				invalidateCredentialCache(options.slug, credentialId),
			]);

		return true;
	}
}
