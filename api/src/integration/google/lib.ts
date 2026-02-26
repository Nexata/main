import type { Language } from '@api/schema';
import { requireEnv } from '@api/utils/env';
import { refreshGoogleTokens } from '@api/utils/token-refresh';
import { auth } from '@googleapis/gmail';

export namespace Google {
	export const createOAuth2Client = () =>
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
		return refreshGoogleTokens(credentialId, options);
	}
}
