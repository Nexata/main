import { dropboxRouter } from '@api/auth/dropbox';
import { googleRouter } from '@api/auth/google';
import { cache, db } from '@api/env';
import { device, user } from '@api/schema';
import { jwtPlugin } from '@api/utils/auth';
import { tObject } from '@api/utils/type';
import { and, eq } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { HttpError } from 'elysia-logger';

export const authPlugin =
	(admin: boolean = false) =>
	(app: Elysia) =>
		app
			.use(jwtPlugin)
			.guard({
				headers: tObject({
					authorization: t.TemplateLiteral('Bearer ${string}'),
					'x-fingerprint': t.String(),
				}),
			})
			.resolve(
				async ({
					headers: { authorization, 'x-fingerprint': fingerprint },
					jwt,
				}) => {
					const at = authorization?.split(' ')[1];
					const payload = await jwt.verify(at);
					if (!at || !payload || (admin && !payload.isAdmin))
						throw HttpError.Unauthorized();

					const cachedAccessToken = await cache.get<string>(
						`device:${payload.id}:${fingerprint}:access`,
					);
					if (cachedAccessToken && cachedAccessToken !== at) {
						throw HttpError.Unauthorized();
					}

					const existingDevice = (
						await db
							.select()
							.from(device)
							.where(
								and(
									eq(device.fingerprint, fingerprint),
									eq(device.userId, payload.id),
									eq(device.isAccessToken, true),
								),
							)
							.limit(1)
					).at(0);

					if (!existingDevice) {
						throw HttpError.Unauthorized();
					}

					return { activeUser: payload };
				},
			);

export const authRouter = new Elysia({
	prefix: '/auth',
	tags: ['Auth'],
})
	.use(googleRouter)
	.use(dropboxRouter)
	.use(jwtPlugin)
	.post(
		'/refresh-token',
		async ({ body: { token, fingerprint }, refreshJwt, jwt }) => {
			const payload = await refreshJwt.verify(token);
			if (!payload) throw HttpError.Unauthorized();

			const existingDevice = (
				await db
					.select()
					.from(device)
					.where(
						and(
							eq(device.fingerprint, fingerprint),
							eq(device.userId, payload.id),
							eq(device.isAccessToken, false),
						),
					)
					.limit(1)
			).at(0);

			if (!existingDevice) {
				throw HttpError.Unauthorized();
			}

			const u = (
				await db.select().from(user).where(eq(user.id, payload.id))
			).at(0);

			if (!u) throw HttpError.Forbidden('EXPIRED_TOKEN');

			const [accessToken, refreshToken] = await Promise.all([
				jwt.sign(u),
				refreshJwt.sign(u),
			]);

			await Promise.all([
				db.batch([
					db
						.delete(device)
						.where(
							and(
								eq(device.fingerprint, fingerprint),
								eq(device.userId, payload.id),
							),
						),
					db.insert(device).values({
						fingerprint: fingerprint,
						userId: payload.id,
						isAccessToken: true,
					}),
					db.insert(device).values({
						fingerprint: fingerprint,
						userId: payload.id,
						isAccessToken: false,
					}),
				]),
				cache.set(`device:${payload.id}:${fingerprint}:access`, accessToken, {
					ex: 43200,
				}),
			]);

			return { accessToken, refreshToken };
		},
		{
			detail: { summary: 'Refresh token' },
			body: tObject({
				token: t.String(),
				fingerprint: t.String(),
			}),
		},
	);
