import { db } from '@api/env';
import { credential, user } from '@api/schema';
import { providerRefreshers } from '@api/utils/token-refresh';
import { and, eq, isNotNull, lte } from 'drizzle-orm';
import Elysia from 'elysia';

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
				and(
					isNotNull(credential.refreshTokenExpiresAt),
					lte(credential.refreshTokenExpiresAt, fourHoursFromNow),
				),
			);

		const withRefresher = credentialsToRefresh.filter(
			(cred) => providerRefreshers[cred.provider],
		);

		const refreshResults = await Promise.allSettled(
			withRefresher.map(async (cred) => {
				const refresher = providerRefreshers[cred.provider]!;

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
			skipped: credentialsToRefresh.length - withRefresher.length,
		};
	},
	{
		detail: {
			summary: 'Refresh credentials',
			description:
				'Refreshes refresh tokens that will expire in the next 4 hours. Access tokens are refreshed on-demand when credentials are used. Expected to run chronologically every 4 hours.',
		},
	},
);
