import { cache, db } from '@api/env';
import { message, thread, user } from '@api/schema';
import type { ModelMessage } from 'ai';
import { and, asc, eq, exists, lt } from 'drizzle-orm';
import { HttpError } from 'elysia-logger';

export type getThreadMessagesOptions = {
	content: 'partial' | 'full';
	slug: string;
	limit?: number;
	userId?: string;
	cursor?: Date | null;
	avoidCaching?: true;
};

export type PartialMessage = ModelMessage & { id: string };

export type FullMessage = ModelMessage &
	PartialMessage & {
		extraReason: boolean;
		createdAt: Date;
	};

export async function getThreadMessages(
	threadId: string,
	op: getThreadMessagesOptions & { content: 'partial' },
): Promise<PartialMessage[]>;

export async function getThreadMessages(
	threadId: string,
	op: getThreadMessagesOptions & { content: 'full' },
): Promise<FullMessage[]>;

export async function getThreadMessages(
	threadId: string,
	op: getThreadMessagesOptions,
) {
	if (op.content === 'partial') {
		const cached = await cache.get<PartialMessage[]>(threadId);
		if (cached) return cached;
	}

	const noncached = await db
		.select(
			op.content === 'partial'
				? { id: message.id, role: message.role, content: message.content }
				: {
						id: message.id,
						role: message.role,
						content: message.content,
						extraReason: message.extraReason,
						createdAt: message.createdAt,
					},
		)
		.from(message)
		.innerJoin(thread, eq(thread.id, message.threadId))
		.where(
			and(
				eq(message.threadId, threadId),
				exists(
					db
						.select({ slug: user.slug })
						.from(user)
						.where(and(eq(user.id, thread.userId), eq(user.slug, op.slug))),
				),
				op.userId ? eq(thread.userId, op.userId) : undefined,
				op.cursor ? lt(message.createdAt, op.cursor) : undefined,
			),
		)
		.limit(op.limit ?? 100)
		.orderBy(asc(message.createdAt));

	if (!noncached?.length) throw HttpError.NotFound('THREAD_NOT_FOUND');

	if (!op.avoidCaching)
		await cache.set<PartialMessage[]>(
			threadId,
			(op.content === 'full'
				? noncached.map((m) => ({
						id: m.id,
						role: m.role,
						content: m.content,
					}))
				: noncached) as PartialMessage[],
			{
				ex: 60 * 5,
			},
		);

	return noncached;
}
