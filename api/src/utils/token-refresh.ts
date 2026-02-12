import { db } from '@api/env';
import { credential, type Language, OauthProvider } from '@api/schema';
import { invalidateCredentialCache } from '@api/utils/credential';
import { requireEnv } from '@api/utils/env';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { auth } from '@googleapis/gmail';
import { and, eq } from 'drizzle-orm';
import { DropboxAuth } from 'dropbox';

type RefreshOptions = {
	slug?: string;
	language?: Language;
	tokens?: { refreshToken: string; accessToken: string };
};

export type RefreshTokensFn = (
	credentialId: string,
	options?: RefreshOptions,
) => Promise<boolean>;

async function refreshDropboxTokens(
	credentialId: string,
	options?: RefreshOptions,
): Promise<boolean> {
	const tokens =
		options?.tokens ??
		(
			await db
				.select({
					refreshToken: credential.refreshToken,
					accessToken: credential.accessToken,
				})
				.from(credential)
				.where(
					and(
						eq(credential.id, credentialId),
						eq(credential.provider, OauthProvider.DROPBOX),
					),
				)
		).at(0);

	if (!tokens)
		throw httpError(
			HttpCode.NOT_FOUND,
			ErrorCode.CREDENTIAL_LOST,
			options?.language,
		);

	const dbxAuth = new DropboxAuth({
		accessToken: tokens.accessToken,
		refreshToken: tokens.refreshToken,
		clientId: requireEnv('DROPBOX_APP_KEY'),
		clientSecret: requireEnv('DROPBOX_APP_SECRET'),
	});

	dbxAuth.refreshAccessToken();

	const newTokens = {
		accessToken: dbxAuth.getAccessToken(),
		accessTokenExpiresAt: dbxAuth.getAccessTokenExpiresAt(),
		refreshToken: dbxAuth.getRefreshToken(),
	};

	if (newTokens.accessToken === tokens.accessToken) return false;

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

async function refreshGoogleTokens(
	credentialId: string,
	options?: RefreshOptions,
): Promise<boolean> {
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

	const oauth2Client = new auth.OAuth2(
		requireEnv('GOOGLE_CLIENT_ID'),
		requireEnv('GOOGLE_CLIENT_SECRET'),
	);
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

export const providerRefreshers: Record<string, RefreshTokensFn> = {
	[OauthProvider.DROPBOX]: refreshDropboxTokens,
	[OauthProvider.GOOGLE]: refreshGoogleTokens,
};

export { refreshDropboxTokens, refreshGoogleTokens };
