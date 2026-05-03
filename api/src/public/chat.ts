import { db } from '@api/env';
import { file, Language, message, thread } from '@api/schema';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { jsonAgg, jsonBuildObject } from '@api/utils/sql';
import { Nullish, tObject } from '@api/utils/type';
import { and, desc, eq, lt } from 'drizzle-orm';
import { Elysia, t } from 'elysia';

export const publicChatRouter = new Elysia({ prefix: '/chat' }).get(
	'/thread/:id',
	async ({ params: { id }, query, headers }) => {
		const cursor = query.cursor ? new Date(query.cursor) : null;
		const messages = await db
			.select({
				id: message.id,
				role: message.role,
				content: message.content,
				extraReason: message.extraReason,
				createdAt: message.createdAt,
				files: jsonAgg(
					jsonBuildObject({
						id: file.id,
						name: file.name,
						type: file.type,
						url: file.url,
					}),
					{ filterWhere: eq(file.messageId, message.id) },
				).as('files'),
			})
			.from(message)
			.leftJoin(file, eq(file.messageId, message.id))
			.innerJoin(thread, eq(thread.id, message.threadId))
			.where(
				and(
					eq(message.threadId, id),
					eq(thread.isPublic, true),
					cursor ? lt(message.createdAt, cursor) : undefined,
				),
			)
			.limit(query.limit ?? 100)
			.orderBy(desc(message.createdAt))
			.groupBy(message.id);

		if (!messages.length) {
			throw httpError(
				HttpCode.NOT_FOUND,
				ErrorCode.THREAD_NOT_FOUND,
				(headers.language ?? Language.EN) as Language,
			);
		}

		return {
			messages: messages.reverse().filter((m) => m.content),
			isOwner: false,
			isPublic: true,
		};
	},
	{
		detail: { summary: 'Read public shared thread by ID (asc)' },
		params: tObject({ id: t.String({ format: 'uuid' }) }),
		query: tObject({
			cursor: Nullish(t.String({ format: 'date-time' }), {
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
