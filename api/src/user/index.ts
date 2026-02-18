import { authPlugin } from '@api/auth';
import { db } from '@api/env';
import { BillableEventType, billableEvent, device, user } from '@api/schema';
import { meRouter } from '@api/user/me';
import { jsonAgg, jsonBuildObject } from '@api/utils/sql';
import { tObject } from '@api/utils/type';
import { and, countDistinct, eq, isNotNull, type SQL } from 'drizzle-orm';
import { Elysia, t } from 'elysia';

export const userRouter = new Elysia({ prefix: '/user', tags: ['User'] })
	.use(authPlugin())
	.use(meRouter)
	.get(
		'/:id',
		async ({ params: { id }, activeUser }) =>
			db
				.select({
					id: user.id,
					email: user.email,
					displayName: user.displayName,
					pfpUrl: user.pfpUrl,
					isAdmin: user.isAdmin,
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
				.where(and(eq(user.id, id), eq(user.slug, activeUser.slug)))
				.groupBy(user.id),
		{
			detail: { summary: 'Read user by ID' },
			params: tObject({ id: t.String({ format: 'uuid' }) }),
		},
	)
	.get(
		'/',
		async ({ activeUser }) =>
			db
				.select({
					id: user.id,
					email: user.email,
					displayName: user.displayName,
					pfpUrl: user.pfpUrl,
					isAdmin: user.isAdmin,
					hasApiKey: isNotNull(user.apiKey) as SQL<boolean>,
				})
				.from(user)
				.where(eq(user.slug, activeUser.slug)),
		{
			detail: { summary: 'List users' },
		},
	);
