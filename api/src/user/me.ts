import { authPlugin } from '@api/auth';
import { cache, db } from '@api/env';
import { device, Language, TraceType, tenant, trace, user } from '@api/schema';
import { uploadUserPfp } from '@api/utils/s3';
import { jsonAgg, jsonBuildObject } from '@api/utils/sql';
import { tObject } from '@api/utils/type';
import { password, s3 } from 'bun';
import { and, countDistinct, eq, isNotNull, type SQL } from 'drizzle-orm';
import { createUpdateSchema } from 'drizzle-typebox';
import { Elysia, t } from 'elysia';
import { HttpError } from 'elysia-logger';

const updateUser = createUpdateSchema(user);

export const meRouter = new Elysia({ prefix: '/me', tags: ['Me'] })
	.use(authPlugin())
	.get(
		'/info',
		async ({ activeUser }) =>
			(
				await db
					.select({
						id: user.id,
						email: user.email,
						displayName: user.displayName,
						pfpUrl: user.pfpUrl,
						isAdmin: user.isAdmin,
						language: user.language,
						hasApiKey: isNotNull(user.apiKey) as SQL<boolean>,
						devices: jsonAgg(
							jsonBuildObject({
								id: device.id,
								fingerprint: device.fingerprint,
								userAgent: device.userAgent,
								createdAt: device.createdAt,
							}),
							{ distinct: true },
						),
						messageCount: countDistinct(trace.id),
					})
					.from(user)
					.leftJoin(device, eq(device.userId, user.id))
					.leftJoin(
						trace,
						and(
							eq(trace.userId, user.id),
							eq(trace.type, TraceType.MESSAGE_SENT),
						),
					)
					.where(eq(user.id, activeUser.id))
					.groupBy(user.id)
			)[0]!,
		{
			detail: { summary: 'Get me' },
		},
	)
	.get(
		'/tenant',
		async ({ activeUser }) =>
			db
				.select({
					slug: tenant.slug,
					displayName: tenant.displayName,
					logoUrl: tenant.logoUrl,
					createdAt: tenant.createdAt,
					hasApiAccess: tenant.hasApiAccess,
				})
				.from(tenant)
				.where(eq(tenant.slug, activeUser.slug)),
		{
			detail: { summary: 'Get my tenant' },
		},
	)
	.patch(
		'/',
		async ({ activeUser: { id }, body }) =>
			db
				.update(user)
				.set({
					...body,
					pfpUrl: body.pfp && (await uploadUserPfp(id, body.pfp)),
				})
				.where(eq(user.id, id))
				.returning({ id: user.id }),
		{
			detail: { summary: 'Update me' },
			body: t.Composite([
				t.Pick(updateUser, ['displayName']),
				t.Object({
					pfp: t.Optional(t.File({ format: 'image/*', maxSize: '4m' })),
					language: t.Optional(t.Enum(Language)),
				}),
			]),
		},
	)
	.delete(
		'/',
		async ({ activeUser: { id } }) => {
			await db.delete(user).where(eq(user.id, id));
			await s3.delete(`u/${id}`);
			return id;
		},
		{
			detail: { summary: 'Delete me' },
		},
	)
	.delete(
		'/device/:fingerprint',
		async ({ params: { fingerprint }, activeUser }) =>
			Promise.all([
				db
					.delete(device)
					.where(
						and(
							eq(device.fingerprint, fingerprint),
							eq(device.userId, activeUser.id),
						),
					)
					.returning({ id: device.id }),
				cache.del(`device:${activeUser.id}:${fingerprint}`),
			]),
		{
			detail: { summary: 'Delete device' },
			params: tObject({ fingerprint: t.String({ minLength: 1 }) }),
		},
	)
	.put(
		'/api-key',
		async ({ activeUser }) => {
			const tenantData = (
				await db
					.select({ hasApiAccess: tenant.hasApiAccess })
					.from(tenant)
					.where(eq(tenant.slug, activeUser.slug))
					.limit(1)
			).at(0);

			if (!tenantData?.hasApiAccess)
				throw HttpError.Forbidden('API_ACCESS_NOT_ENABLED');

			const rawApiKey = (crypto.randomUUID() + crypto.randomUUID())
				.replace(/-/g, '')
				.toUpperCase();
			const hashedApiKey = await password.hash(rawApiKey);

			await Promise.all([
				db
					.update(user)
					.set({ apiKey: hashedApiKey })
					.where(eq(user.id, activeUser.id)),
				cache.del(`apikey:${activeUser.id}`),
			]);

			return rawApiKey;
		},
		{
			detail: { summary: 'Create or regenerate API key' },
		},
	)
	.delete(
		'/api-key',
		async ({ activeUser }) => {
			const [updatedUser] = await Promise.all([
				db
					.update(user)
					.set({ apiKey: null })
					.where(eq(user.id, activeUser.id))
					.returning({ id: user.id }),
				cache.del(`apikey:${activeUser.id}`),
			]);

			return updatedUser.at(0)?.id;
		},
		{
			detail: { summary: 'Delete API key' },
		},
	);
