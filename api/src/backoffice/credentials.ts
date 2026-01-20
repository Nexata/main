import { db } from '@api/env';
import { Dropbox } from '@api/integration/dropbox';
import { credential, OauthProvider, user } from '@api/schema';
import { eq, lte, or } from 'drizzle-orm';
import Elysia from 'elysia';

const providerRefreshers: Record<string, typeof Dropbox.refreshTokens> = {
	[OauthProvider.DROPBOX]: Dropbox.refreshTokens,
};

export const credentialsRouter = new Elysia({ prefix: '/credentials' }).put(
	'/refresh',
	async () => {
		const fourHoursFromNow = new Date(Date.now() + 4 * 60 * 60 * 1000);

		const credentialsToRefresh = await db
			.select({
				id: credential.id,
				userSlug: user.slug,
				provider: credential.provider,
				refreshToken: credential.refreshToken,
				accessToken: credential.accessToken,
			})
			.from(credential)
			.innerJoin(user, eq(user.id, credential.userId))
			.where(
				or(
					lte(credential.accessTokenExpiresAt, fourHoursFromNow),
					lte(credential.refreshTokenExpiresAt, fourHoursFromNow),
				),
			);

		const refreshResults = await Promise.allSettled(
			credentialsToRefresh.map(async (cred) => {
				const refresher = providerRefreshers[cred.provider];
				if (!refresher) return;

				await refresher(cred.id, {
					persistenceSlug: cred.userSlug,
					tokens: {
						accessToken: cred.accessToken,
						refreshToken: cred.refreshToken,
					},
				});
			}),
		);

		return {
			refreshed: refreshResults.filter((r) => r.status === 'fulfilled').length,
			total: credentialsToRefresh.length,
		};
	},
	{
		detail: {
			summary: 'Refresh credentials',
			description:
				'Refreshes tokens that will expire in the next 4 hours. Expected to run cronologically every 4 hours.',
		},
	},
);
