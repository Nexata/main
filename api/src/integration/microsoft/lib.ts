import { OauthProvider } from '@api/schema';
import { ensureFreshTokens } from '@api/utils/credential';
import { Client } from '@microsoft/microsoft-graph-client';

const FIVE_MINUTES = 5 * 60 * 1000;
const FIFTY_FIVE_MINUTES = 55 * 60 * 1000;

export namespace Microsoft {
	export type GraphClient = Client;

	export const fromTokens = (
		accessToken: string,
		refreshToken: string,
		context?: { credentialId: string; slug: string },
	) => {
		let currentToken = accessToken;
		let currentRefreshToken = refreshToken;
		let expiresAt: number | null = null;

		return Client.init({
			authProvider: (done) => {
				if (!context || (expiresAt && expiresAt > Date.now() + FIVE_MINUTES)) {
					done(null, currentToken);
					return;
				}

				ensureFreshTokens(
					context.credentialId,
					OauthProvider.MICROSOFT,
					currentToken,
					currentRefreshToken,
					expiresAt ? new Date(expiresAt) : new Date(0),
					context.slug,
				)
					.then(({ at, rt }) => {
						currentToken = at;
						currentRefreshToken = rt;
						if (at !== accessToken || !expiresAt)
							expiresAt = Date.now() + FIFTY_FIVE_MINUTES;
						done(null, currentToken);
					})
					.catch(() => {
						done(null, currentToken);
					});
			},
		});
	};
}
