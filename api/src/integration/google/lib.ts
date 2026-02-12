import { db } from '@api/env';
import { credential, type Language } from '@api/schema';
import { invalidateCredentialCache } from '@api/utils/credential';
import { requireEnv } from '@api/utils/env';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { auth } from '@googleapis/gmail';
import { eq } from 'drizzle-orm';
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
			language?: Language;
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

		if (!tokens)
			throw httpError(
				HttpCode.NOT_FOUND,
				ErrorCode.CREDENTIAL_LOST,
				options?.language,
			);

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
				throw httpError(
					HttpCode.UNAUTHORIZED,
					ErrorCode.CREDENTIAL_EXPIRED,
					options?.language,
				);
			throw e;
		}

		if (credentials.access_token === tokens.accessToken) return false;

		const newTokens = {
			accessToken: credentials.access_token!,
			accessTokenExpiresAt: credentials.expiry_date
				? new Date(credentials.expiry_date)
				: new Date(Date.now() + 3600 * 1000),
			refreshToken: credentials.refresh_token ?? tokens.refreshToken,
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
