import { authPlugin } from '@api/auth';
import { db } from '@api/env';
import { TraceType, trace, user } from '@api/schema';
import { jsonBuildObject } from '@api/utils/sql';
import { Nullish, tObject } from '@api/utils/type';
import { and, desc, eq, gte, inArray, lt, lte } from 'drizzle-orm';
import { Elysia, t } from 'elysia';

export const traceRouter = new Elysia({ prefix: '/trace' })
	.use(authPlugin({ admin: true }))
	.get(
		'/',
		async ({ query, activeUser }) =>
			db
				.select({
					id: trace.id,
					user: jsonBuildObject({
						id: user.id,
						email: user.email,
						displayName: user.displayName,
						pfpUrl: user.pfpUrl,
						isAdmin: user.isAdmin,
					}).as('user'),
					type: trace.type,
					metadata: trace.metadata,
					createdAt: trace.createdAt,
				})
				.from(trace)
				.innerJoin(user, eq(user.id, trace.userId))
				.where(
					and(
						eq(user.slug, activeUser.slug),
						query.type ? inArray(trace.type, query.type) : undefined,
						query.userId ? inArray(trace.userId, query.userId) : undefined,
						query.from ? gte(trace.createdAt, query.from) : undefined,
						query.to ? lte(trace.createdAt, query.to) : undefined,
						query.cursor ? lt(trace.createdAt, query.cursor) : undefined,
					),
				)
				.groupBy(trace.id, user.id)
				.orderBy(desc(trace.createdAt))
				.limit(query.limit),
		{
			detail: { summary: 'List traces (desc)' },
			query: tObject({
				type: Nullish(t.Array(t.Enum(TraceType)), {
					description: 'Filter by trace type(s)',
				}),
				userId: Nullish(t.Array(t.String({ format: 'uuid' })), {
					description: 'Filter by user ID(s)',
				}),
				from: Nullish(t.Date(), {
					description: 'Filter by createdAt greater than or equal to this date',
				}),
				to: Nullish(t.Date(), {
					description: 'Filter by createdAt less than or equal to this date',
				}),
				cursor: Nullish(t.Date(), {
					description:
						'Cursor for pagination, based on createdAt prop (creation date).',
				}),
				limit: t.Number({
					default: 100,
					description: 'Limit for pagination.',
				}),
			}),
		},
	);
