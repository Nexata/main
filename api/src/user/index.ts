import { authPlugin } from '@api/auth';
import { db } from '@api/env';
import { device, TraceType, trace, user } from '@api/schema';
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
