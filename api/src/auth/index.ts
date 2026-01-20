import { dropboxRouter } from '@api/auth/dropbox';
import { googleRouter } from '@api/auth/google';
import { cache, db } from '@api/env';
import { device, user } from '@api/schema';
import { type JwtPayload, jwtPlugin } from '@api/utils/auth';
import { tObject } from '@api/utils/type';
import { and, eq, exists, isNotNull } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { HttpError } from 'elysia-logger';

export const authPlugin =
	(options: { admin?: boolean; apiAllowed?: boolean } = {}) =>
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
					if (!options.apiAllowed) throw HttpError.Forbidden();

					const { clientId, clientSecret } = headers as {
						clientId: string;
						clientSecret: string;
					};

					const cached = await cache.get<JwtPayload & { clientSecret: string }>(
						`apikey-${clientId}`,
					);
					if (cached && cached.clientSecret === clientSecret) {
						const { clientSecret, ...activeUser } = cached;
						return { activeUser };
					}

					const u = (
						await db
							.select()
							.from(user)
							.where(and(eq(user.id, clientId), isNotNull(user.apiKey)))
					).at(0);

					if (!u) throw HttpError.NotFound();

					if (!(await Bun.password.verify(u.apiKey!, clientSecret)))
						throw HttpError.Unauthorized();

					const activeUser = { ...u, apiKey: null };
					await cache.set(
						`apikey-${clientId}`,
						{ ...activeUser, clientSecret } as JwtPayload & {
							clientSecret: string;
						},
						{ ex: 3600 },
					);
					return { activeUser };
				}

				const { authorization, fingerprint } = headers as {
					authorization: string;
					fingerprint: string;
				};

				const at = authorization?.split(' ')[1];
				const payload = await jwt.verify(at);

				if (!at || !payload || (options.admin && !payload.isAdmin))
					throw HttpError.Unauthorized();

				const savedToken =
					(await cache.get<string>(`device:${payload.id}:${fingerprint}`)) ??
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

				if (savedToken !== at) throw HttpError.Unauthorized();

				return { activeUser: payload };
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
			if (!payload) throw HttpError.Unauthorized();

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

			if (!u) throw HttpError.Forbidden();
			const [accessToken, refreshToken] = await Promise.all([
				jwt.sign({ ...u, apiKey: null }),
				refreshJwt.sign({ ...u, apiKey: null }),
			]);

			await db
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
				});

			await cache.set(`device:${payload.id}:${fingerprint}`, accessToken, {
				ex: 12 * 60 * 60,
			});

			return { accessToken, refreshToken };
		},
		{
			detail: { summary: 'Refresh token' },
			body: tObject({ token: t.String() }),
			headers: tObject({ fingerprint: t.String(), 'user-agent': t.String() }),
		},
	);
