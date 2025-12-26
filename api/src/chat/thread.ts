import { authPlugin } from '@api/auth';
import { getThreadMessages } from '@api/chat/lib';
import { db } from '@api/env';
import { thread } from '@api/schema';
import { Nullish, tObject } from '@api/utils/type';
import { and, desc, eq, ilike, inArray, lt } from 'drizzle-orm';
import Elysia, { t } from 'elysia';

export const threadRouter = new Elysia({ prefix: '/thread' })
	.use(authPlugin())
	.get(
		'/:id',
		async ({ params: { id }, query, activeUser: { slug } }) =>
			await getThreadMessages(id, {
				content: 'full',
				slug,
				limit: query.limit,
				cursor: query.cursor,
			}),
		{
			detail: { summary: 'Read thread by ID (asc)' },
			params: tObject({ id: t.String({ format: 'uuid' }) }),
			query: tObject({
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
	)
	.patch(
		'/:id',
		async ({ params: { id }, body, activeUser }) =>
			db
				.update(thread)
				.set(body)
				.where(and(eq(thread.id, id), eq(thread.userId, activeUser.id)))
				.returning({ id: thread.id }),
		{
			detail: { summary: 'Update thread by ID' },
			params: tObject({ id: t.String({ format: 'uuid' }) }),
			body: tObject({
				title: t.String({ minLength: 2, maxLength: 64 }),
			}),
		},
	)
	.delete(
		'/:id',
		async ({ params: { id }, activeUser }) =>
			db
				.delete(thread)
				.where(and(eq(thread.id, id), eq(thread.userId, activeUser.id)))
				.returning({ id: thread.id }),
		{
			detail: { summary: 'Delete thread by ID' },
			params: tObject({ id: t.String({ format: 'uuid' }) }),
		},
	)
	.delete(
		'/',
		async ({ body: { ids }, activeUser }) =>
			db
				.delete(thread)
				.where(and(inArray(thread.id, ids), eq(thread.userId, activeUser.id)))
				.returning({ id: thread.id }),
		{
			detail: { summary: 'Delete threads by IDs' },
			body: tObject({ ids: t.Array(t.String({ format: 'uuid' })) }),
		},
	)
	.get(
		'/',
		async ({ query, activeUser }) =>
			db
				.select({
					id: thread.id,
					title: thread.title,
					createdAt: thread.createdAt,
				})
				.from(thread)
				.where(
					and(
						eq(thread.userId, activeUser.id),
						query.cursor ? lt(thread.createdAt, query.cursor) : undefined,
						query.search ? ilike(thread.title, `%${query.search}%`) : undefined,
					),
				)
				.limit(query.limit)
				.orderBy(desc(thread.createdAt)),
		{
			detail: { summary: 'List threads (desc)' },
			query: tObject({
				cursor: Nullish(t.Date(), {
					description:
						'Cursor for pagination, based on createdAt prop (creation date).',
				}),
				limit: t.Number({
					default: 100,
					description: 'Limit for pagination.',
				}),
				search: Nullish(t.String(), {
					description: 'Optional search query for thread title.',
				}),
			}),
		},
	);
