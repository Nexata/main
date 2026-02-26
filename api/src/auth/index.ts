import { dropboxRouter } from '@api/auth/dropbox';
import { googleRouter } from '@api/auth/google';
import { microsoftRouter } from '@api/auth/microsoft';
import { cache, db } from '@api/env';
import { device, user } from '@api/schema';
import { jwtPlugin, userCacheKey } from '@api/utils/auth';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { tObject } from '@api/utils/type';
import { and, eq, exists } from 'drizzle-orm';
import { Elysia, t } from 'elysia';

export { authPlugin } from '@api/auth/plugin';

const USER_CACHE_TTL = 12 * 60 * 60;

export const authRouter = new Elysia({
	prefix: '/auth',
	tags: ['Auth'],
})
	.use(googleRouter)
	.use(dropboxRouter)
	.use(microsoftRouter)
	.use(jwtPlugin)
	.post(
		'/refresh-token',
		async ({
			headers: { fingerprint, 'user-agent': userAgent },
			body: { token },
			refreshJwt,
			jwt,
		}) => {
			const payload = await refreshJwt.verify(token);
			if (!payload)
				throw httpError(HttpCode.UNAUTHORIZED, ErrorCode.INVALID_REFRESH_TOKEN);

			const u = (
				await db
					.select()
					.from(user)
					.where(
						and(
							eq(user.id, payload.id),
							exists(
								db
									.select()
									.from(device)
									.where(
										and(
											eq(device.userId, payload.id),
											eq(device.fingerprint, fingerprint),
											eq(device.refreshToken, token),
										),
									),
							),
						),
					)
			).at(0);

			if (!u) throw httpError(HttpCode.FORBIDDEN, ErrorCode.USER_NOT_FOUND);

			const [accessToken, refreshToken] = await Promise.all([
				jwt.sign({ id: u.id, slug: u.slug }),
				refreshJwt.sign({ id: u.id }),
			]);

			await Promise.all([
				db
					.insert(device)
					.values({
						fingerprint,
						userId: payload.id,
						accessToken,
						refreshToken,
						userAgent,
					})
					.onConflictDoUpdate({
						target: [device.userId, device.fingerprint],
						set: {
							accessToken,
							refreshToken,
							userAgent,
							createdAt: new Date(),
						},
					}),
				cache.set(`device:${payload.id}:${fingerprint}`, accessToken, {
					ex: USER_CACHE_TTL,
				}),
				cache.set(
					userCacheKey(u.slug, u.id),
					{ ...u, apiKey: null },
					{
						ex: USER_CACHE_TTL,
					},
				),
			]);

			return { accessToken, refreshToken };
		},
		{
			detail: { summary: 'Refresh token' },
			body: tObject({ token: t.String() }),
			headers: tObject({ fingerprint: t.String(), 'user-agent': t.String() }),
		},
	);
