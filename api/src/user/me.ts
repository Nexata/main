import { authPlugin } from '@api/auth';
import { cache, db } from '@api/env';
import {
	BillableEventType,
	billableEvent,
	device,
	Language,
	PLANS,
	type Plan,
	TraceType,
	tenant,
	trace,
	user,
} from '@api/schema';
import { userCacheKey } from '@api/utils/auth';
import { getTenantPlan } from '@api/utils/billing';
import { requireEnv } from '@api/utils/env';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { sendTemplateMail, Template } from '@api/utils/mail';
import { deleteTenantData, uploadUserPfp } from '@api/utils/s3';
import { jsonAgg, jsonBuildObject } from '@api/utils/sql';
import { tObject } from '@api/utils/type';
import { password, s3 } from 'bun';
import {
	and,
	count,
	countDistinct,
	eq,
	isNotNull,
	type SQL,
} from 'drizzle-orm';
import { createUpdateSchema } from 'drizzle-typebox';
import { Elysia, t } from 'elysia';

const updateUser = createUpdateSchema(user);

export const meRouter = new Elysia({ prefix: '/me' })
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
						messageCount: countDistinct(billableEvent.id),
					})
					.from(user)
					.leftJoin(device, eq(device.userId, user.id))
					.leftJoin(
						billableEvent,
						and(
							eq(billableEvent.userId, user.id),
							eq(billableEvent.type, BillableEventType.MESSAGE),
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
		async ({ activeUser }) => {
			const result = (
				await db
					.select({
						slug: tenant.slug,
						displayName: tenant.displayName,
						logoUrl: tenant.logoUrl,
						plan: tenant.plan,
						createdAt: tenant.createdAt,
					})
					.from(tenant)
					.where(eq(tenant.slug, activeUser.slug))
			).at(0);

			if (!result)
				throw httpError(
					HttpCode.INTERNAL_SERVER_ERROR,
					ErrorCode.TENANT_NOT_FOUND,
					activeUser.language,
				);

			return { ...result, ...PLANS[result.plan as Plan] };
		},
		{
			detail: { summary: 'Get my tenant' },
		},
	)
	.patch(
		'/',
		async ({ activeUser, body }) => {
			const updated = (
				await db
					.update(user)
					.set({
						...body,
						pfpUrl:
							body.pfp &&
							(await uploadUserPfp(activeUser.slug, activeUser.id, body.pfp)),
					})
					.where(eq(user.id, activeUser.id))
					.returning()
			).at(0);

			if (updated)
				await cache.set(
					userCacheKey(activeUser.slug, activeUser.id),
					{ ...updated, apiKey: null },
					{ ex: 12 * 60 * 60 },
				);

			return { id: updated?.id };
		},
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
		async ({ activeUser }) => {
			const { id, slug, email, displayName, language } = activeUser;

			await Promise.all([
				db.delete(user).where(eq(user.id, id)),
				cache.del(userCacheKey(slug, id), `apikey:${id}`),
				s3.delete(`t/${slug}/u/${id}`),
			]);

			const remaining = (
				await db
					.select({ count: count() })
					.from(user)
					.where(eq(user.slug, slug))
			).at(0);

			let tenantDisplayName = slug;
			let logoUrl: string | null = null;

			if (!remaining?.count) {
				await deleteTenantData(slug);
				await db.delete(tenant).where(eq(tenant.slug, slug));
			} else {
				const t = (
					await db
						.select({
							displayName: tenant.displayName,
							logoUrl: tenant.logoUrl,
						})
						.from(tenant)
						.where(eq(tenant.slug, slug))
						.limit(1)
				).at(0);

				tenantDisplayName = t?.displayName ?? slug;
				logoUrl = t?.logoUrl ?? null;
			}

			await Promise.all([
				db.insert(trace).values({
					userId: id,
					type: TraceType.USER_DELETED,
					metadata: { email, displayName },
				}),
				sendTemplateMail({
					to: email,
					template: Template.USER_LEFT,
					data: {
						tenantDisplayName,
						logoUrl,
						redirect: requireEnv('DEFAULT_REDIRECT_URL'),
					},
					language: language as Language,
				}),
			]);

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
			const plan = await getTenantPlan(activeUser.slug);
			if (!PLANS[plan].hasApiAccess)
				throw httpError(
					HttpCode.FORBIDDEN,
					ErrorCode.API_ACCESS_NOT_ENABLED,
					activeUser.language,
				);

			const rawApiKey = crypto.randomUUID().replaceAll('-', '').toUpperCase();
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
