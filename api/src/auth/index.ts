import { dropboxRouter } from '@api/auth/dropbox';
import { googleRouter } from '@api/auth/google';
import { cache, db } from '@api/env';
import { device, user } from '@api/schema';
import { type ActiveUser, jwtPlugin, userCacheKey } from '@api/utils/auth';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { tObject } from '@api/utils/type';
import { password } from 'bun';
import { and, eq, exists, isNotNull } from 'drizzle-orm';
import { Elysia, t } from 'elysia';

const USER_CACHE_TTL = 12 * 60 * 60;

async function getCachedUser(
	slug: string,
	userId: string,
): Promise<ActiveUser> {
	const key = userCacheKey(slug, userId);
	const cached = await cache.get<ActiveUser>(key);
	if (cached) return cached;

	const u = (
		await db
			.select()
			.from(user)
			.where(and(eq(user.id, userId), eq(user.slug, slug)))
	).at(0);

	if (!u) throw httpError(HttpCode.NOT_FOUND, ErrorCode.USER_NOT_FOUND);

	const activeUser = { ...u, apiKey: null };
	await cache.set(key, activeUser, { ex: USER_CACHE_TTL });
	return activeUser;
}

export const authPlugin =
	(
		options: { admin?: boolean; apiAllowed?: boolean } = {
			admin: false,
			apiAllowed: true,
		},
	) =>
	(app: Elysia) =>
		app
			.use(jwtPlugin)
			.guard({
				headers: t.Union([
					t.Object({
						authorization: t.TemplateLiteral('Bearer ${string}'),
						fingerprint: t.String(),
					}),
					t.Object({
						clientId: t.String({ format: 'uuid' }),
						clientSecret: t.String(),
					}),
				]),
			})
			.resolve(async ({ headers, jwt }) => {
				if ('clientId' in headers) {
					if (!options.apiAllowed)
						throw httpError(HttpCode.FORBIDDEN, ErrorCode.API_NOT_ALLOWED);

					const { clientId, clientSecret } = headers as {
						clientId: string;
						clientSecret: string;
					};

					const cached = await cache.get<ActiveUser & { clientSecret: string }>(
						`apikey:${clientId}`,
					);
					if (cached && cached.clientSecret === clientSecret) {
						const { clientSecret, ...activeUser } = cached;
						if (options.admin && !activeUser.isAdmin)
							throw httpError(HttpCode.UNAUTHORIZED, ErrorCode.INVALID_TOKEN);
						return { activeUser };
					}

					const u = (
						await db
							.select()
							.from(user)
							.where(and(eq(user.id, clientId), isNotNull(user.apiKey)))
					).at(0);

					if (!u) throw httpError(HttpCode.NOT_FOUND, ErrorCode.USER_NOT_FOUND);

					if (!(await password.verify(u.apiKey!, clientSecret)))
						throw httpError(
							HttpCode.UNAUTHORIZED,
							ErrorCode.INVALID_CREDENTIALS,
						);

					if (options.admin && !u.isAdmin)
						throw httpError(HttpCode.UNAUTHORIZED, ErrorCode.INVALID_TOKEN);

					const activeUser = { ...u, apiKey: null };
					await cache.set(
						`apikey:${clientId}`,
						{ ...activeUser, clientSecret } as ActiveUser & {
							clientSecret: string;
						},
						{ ex: 12 * 60 * 60 },
					);
					return { activeUser };
				}

				const { authorization, fingerprint } = headers as {
					authorization: string;
					fingerprint: string;
				};

				const at = authorization?.split(' ')[1];
				const payload = await jwt.verify(at);
				console.log(payload);

				if (!at || !payload)
					throw httpError(HttpCode.UNAUTHORIZED, ErrorCode.INVALID_TOKEN);

				const cachedToken = await cache.get<string>(
					`device:${payload.id}:${fingerprint}`,
				);

				const savedToken =
					cachedToken ??
					(
						await db
							.select()
							.from(device)
							.where(
								and(
									eq(device.fingerprint, fingerprint),
									eq(device.userId, payload.id),
								),
							)
					).at(0)?.accessToken;

				if (savedToken !== at)
					throw httpError(HttpCode.UNAUTHORIZED, ErrorCode.INVALID_DEVICE);

				if (!cachedToken)
					await cache.set(`device:${payload.id}:${fingerprint}`, at, {
						ex: 12 * 60 * 60,
					});

				const activeUser = await getCachedUser(payload.slug, payload.id);

				if (options.admin && !activeUser.isAdmin)
					throw httpError(HttpCode.UNAUTHORIZED, ErrorCode.INVALID_TOKEN);

				return { activeUser };
			});

export const authRouter = new Elysia({
	prefix: '/auth',
	tags: ['Auth'],
})
	.use(googleRouter)
	.use(dropboxRouter)
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
