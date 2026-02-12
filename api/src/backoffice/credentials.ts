import { db } from '@api/env';
import { credential, user } from '@api/schema';
import { providerRefreshers } from '@api/utils/token-refresh';
import { and, eq, isNotNull, lte } from 'drizzle-orm';
import Elysia from 'elysia';

export const credentialsRouter = new Elysia({ prefix: '/credentials' }).put(
	'/refresh',
	async () => {
		const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);

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
				and(
					isNotNull(credential.refreshTokenExpiresAt),
					lte(credential.refreshTokenExpiresAt, oneHourFromNow),
				),
			);

		const refreshResults = await Promise.allSettled(
			credentialsToRefresh.map(async (cred) => {
				const refresher = providerRefreshers[cred.provider];
				if (!refresher) return;

				await refresher(cred.id, {
					slug: cred.userSlug,
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
			// NOTE: Cron job, scheduled to run once every 1 hour
			description:
				'Refreshes refresh tokens that will expire in the next 1 hour. Access tokens are refreshed on-demand when credentials are used. Expected to run chronologically every 1 hour.',
		},
	},
);
