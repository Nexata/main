import { authPlugin } from '@api/auth';
import {
	BUILD_SYSTEM_PROMPT,
	getThreadMessages,
	MODEL,
	type PartialMessage,
	REASONING_MODEL,
} from '@api/chat/lib';
import { threadRouter } from '@api/chat/thread';
import { cache, db } from '@api/env';
import { type MessageRole, message, tenant, thread } from '@api/schema';
import { getTools } from '@api/tools';
import { sq } from '@api/utils/sql';
import { Nullish, tObject } from '@api/utils/type';
import { type ModelMessage, stepCountIs, streamText } from 'ai';
import { and, eq, gte, lte, or, sql } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { HttpError } from 'elysia-logger';

export const chatRouter = new Elysia({ prefix: '/chat', tags: ['Chat'] })
	.use(authPlugin())
	.use(threadRouter)
	.post(
		'/',
		async ({ body, activeUser }) => {
			const count =
				(await cache.get<{ limit: number; used: number }>(
					`tenant:${activeUser.slug}:messages`,
				)) ??
				(
					await db
						.select({ limit: tenant.messageLimit, used: tenant.usedMessages })
						.from(tenant)
				).at(0);

			if (!count) throw HttpError.InternalServerError('NO_MESSAGE_COUNT');
			if (count.used + 1 >= count.limit)
				throw HttpError.MethodNotAllowed('MESSAGE_LIMIT_REACHED');

			const userMessage: PartialMessage = {
				id: '',
				role: 'user',
				content: [{ type: 'text', text: body.prompt }],
			};

			const threadMessages = body.threadId
				? await getThreadMessages(body.threadId, {
						content: 'partial',
						slug: activeUser.slug,
						userId: activeUser.id,
						avoidCaching: true,
					})
				: [];

			const editedMessageIndex = !body.editedMessageId
				? -1
				: threadMessages.findIndex(
						(message) => message.id === body.editedMessageId,
					);
			const editedMessage =
				editedMessageIndex !== -1 ? threadMessages[editedMessageIndex] : null;

			if (body.editedMessageId) {
				if (!editedMessage || editedMessage.role !== 'user')
					throw HttpError.NotFound('EDITED_MESSAGE_NOT_FOUND');

				threadMessages.splice(0, editedMessageIndex + 1);
			}

			threadMessages.push(userMessage);

			// imgs: groq('meta-llama/llama-4-maverick-17b-128e-instruct')
			const stream = streamText({
				model: body.extraReason ? REASONING_MODEL : MODEL,
				system: BUILD_SYSTEM_PROMPT({
					...activeUser,
					languagePreference: body.languagePreference,
				}),
				stopWhen: stepCountIs(20),
				tools: await getTools(activeUser, body.threadId),
				providerOptions: {
					groq: {
						// @ts-expect-error
						reasoningEffort: body.extraReason ? undefined : 'high',
						// @ts-expect-error
						reasoningFormat: body.extraReason ? undefined : 'hidden',
					},
				},
				messages: threadMessages.map(
					(m) =>
						({
							role: m.role,
							content: m.content,
						}) as ModelMessage,
				),
				onFinish: async ({ finishReason, response: { messages } }) => {
					if (finishReason !== 'stop')
						throw new Error('FINISH_REASON_NOT_STOP');

					if (editedMessage && body.threadId)
						await db
							.delete(message)
							.where(
								and(
									eq(message.threadId, body.threadId),
									or(
										eq(message.id, editedMessage.id),
										gte(
											message.createdAt,
											db
												.select({ createdAt: message.createdAt })
												.from(message)
												.where(eq(message.id, editedMessage.id)),
										),
									),
								),
							);

					const messagesToAppend = [userMessage, ...messages];

					const threadId =
						body.threadId ??
						(
							await db
								.insert(thread)
								.values({
									userId: activeUser.id,
									title: ((x: string) =>
										x.length >= 28 ? `${x.slice(0, 25)}...` : x)(
										body.prompt.charAt(0).toUpperCase() + body.prompt.slice(1),
									),
								})
								.returning({ id: thread.id })
						).at(0)?.id;

					if (!threadId) throw new Error('THREAD_NOT_CREATED');

					const appendedMessages = await db
						.insert(message)
						.values(
							messagesToAppend.map((m) => ({
								threadId,
								role: m.role as MessageRole,
								content: m.content,
							})),
						)
						.returning({
							id: message.id,
							role: message.role,
							content: message.content,
						});

					const usedMessages = await db
						.update(tenant)
						.set({ usedMessages: sql`${tenant.usedMessages} + 1` })
						.where(eq(tenant.slug, activeUser.slug))
						.returning({ usedMessages: tenant.usedMessages })
						.catch(async () => {
							await cache.del(`tenant:${activeUser.slug}:messages`);
							throw new Error('USED_MESSAGES_UPDATE_FAILED');
						});

					await Promise.all([
						cache.set(threadId, [...threadMessages, ...appendedMessages], {
							ex: 60 * 5,
						}),
						cache.set(
							`tenant:${activeUser.slug}:messages`,
							{
								limit: count.limit,
								used: usedMessages.at(0)?.usedMessages ?? 1,
							},
							{ ex: 60 * 60 },
						),
					]);
				},
			});

			return stream.toUIMessageStreamResponse({
				headers: { 'Content-Type': 'text/event-stream' },
			});
		},
		{
			detail: { summary: 'Chat with LLM' },
			body: tObject({
				prompt: t.String(),
				extraReason: Nullish(t.Boolean({ default: false }), {
					description:
						'If true, uses a heavier reasoning model in exchange of two message credits.',
				}),
				threadId: Nullish(t.String({ format: 'uuid' }), {
					description:
						'UUID of the thread. If none, a new thread will be created.',
				}),
				editedMessageId: Nullish(t.String({ format: 'uuid' }), {
					description:
						'UUID of a message to edit. This will edit a message content, deleting all future messages on the thread. threadId must also be added to the request for indexing purposes.',
				}),
				languagePreference: Nullish(t.String(), {
					description: 'Language preference for the chat response.',
				}),
			}),
		},
	)
	.put(
		'/branch-off/:messageId',
		async ({ params: { messageId }, activeUser }) => {
			const offMessage = db.$with('off_message').as(
				db
					.select({
						id: message.id,
						createdAt: message.createdAt,
						threadId: message.threadId,
						threadTitle: thread.title,
					})
					.from(message)
					.innerJoin(thread, eq(thread.id, message.threadId))
					.where(eq(message.id, messageId))
					.limit(1),
			);

			const newThreadId = (
				await db
					.with(offMessage)
					.insert(thread)
					.values({
						userId: activeUser.id,
						title: sq(
							db.select({ title: offMessage.threadTitle }).from(offMessage),
						),
					})
					.returning({ id: thread.id })
			).at(0)?.id;
			if (!newThreadId)
				throw HttpError.InternalServerError('THREAD_CREATION_FAILED');

			const messagesToCopy = db.$with('messages_to_copy').as(
				db
					.with(offMessage)
					.select()
					.from(message)
					.where(
						or(
							eq(message.id, db.select({ id: offMessage.id }).from(offMessage)),
							and(
								eq(
									message.threadId,
									db.select({ threadId: offMessage.threadId }).from(offMessage),
								),
								lte(
									message.createdAt,
									db
										.select({ createdAt: offMessage.createdAt })
										.from(offMessage),
								),
							),
						),
					),
			);

			return db
				.with(messagesToCopy)
				.insert(message)
				.select(
					db
						.select({
							id: sql`gen_random_uuid()`.as('id'),
							role: messagesToCopy.role,
							content: messagesToCopy.content,
							extraReason: messagesToCopy.extraReason,
							threadId: sql`${newThreadId}`.as('thread_id'),
							createdAt: messagesToCopy.createdAt,
						})
						.from(messagesToCopy),
				)
				.returning({ id: message.id, threadId: message.threadId });
		},
		{
			detail: {
				summary: 'Branch off message by ID',
				description:
					'Creates a new thread, copying messages greater than or equal to a given assistant message.',
			},
			params: tObject({
				messageId: t.String({
					format: 'uuid',
					description: 'Assistant message ID',
				}),
			}),
		},
	);
