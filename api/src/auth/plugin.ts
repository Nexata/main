import { cache, db } from '@api/env';
import { device, user } from '@api/schema';
import { type ActiveUser, jwtPlugin, userCacheKey } from '@api/utils/auth';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { password } from 'bun';
import { and, eq, isNotNull } from 'drizzle-orm';
import { type Elysia, t } from 'elysia';

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
