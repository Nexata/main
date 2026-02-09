import { authPlugin } from '@api/auth';
import {
	BUILD_SYSTEM_PROMPT,
	createThread,
	generateThreadTitle,
	getThreadMessages,
	type PartialMessage,
	redactReasoningTransform,
} from '@api/chat/lib';
import { threadRouter } from '@api/chat/thread';
import { getTools } from '@api/chat/tools';
import { cache, db, MODEL, REASONING_MODEL } from '@api/env';
import { NexataFile } from '@api/file';
import {
	file,
	type MessageRole,
	message,
	TraceType,
	thread,
	trace,
} from '@api/schema';
import { checkTenantCanChat } from '@api/utils/billing';
import { getMessageCount } from '@api/utils/chat';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { sq } from '@api/utils/sql';
import { Nullish, tObject } from '@api/utils/type';
import { encode } from '@toon-format/toon';
import { type ModelMessage, stepCountIs, streamText } from 'ai';
import { and, eq, gte, inArray, lte, or, sql } from 'drizzle-orm';
import { Elysia, t } from 'elysia';

export const chatRouter = new Elysia({ prefix: '/chat', tags: ['Chat'] })
	.use(authPlugin())
	.use(threadRouter)
	.post(
		'/',
		async ({ body, activeUser }) => {
			// Message limit and payment handling
			const [unpaidBlock, messageCountData] = await Promise.all([
				checkTenantCanChat(activeUser.slug),
				getMessageCount(activeUser.slug),
			]);

			const creditsToUse = body.extraReason ? 2 : 1;

			if (unpaidBlock)
				throw httpError(
					HttpCode.PAYMENT_REQUIRED,
					ErrorCode.PAYMENT_REQUIRED,
					activeUser.language,
				);
			if (messageCountData.count + creditsToUse > messageCountData.limit)
				throw httpError(
					HttpCode.METHOD_NOT_ALLOWED,
					ErrorCode.MESSAGE_LIMIT_REACHED,
					activeUser.language,
				);

			// Initial history retrieval: if threadId provided
			const threadMessages = body.threadId
				? await getThreadMessages(body.threadId, {
						content: 'partial',
						slug: activeUser.slug,
						userId: activeUser.id,
						avoidCaching: true,
						language: activeUser.language,
					})
				: [];

			// Edit message handling: if editedMessageId provided
			let editedMessage: PartialMessage | false = false;
			if (body.editedMessageId) {
				const editedMessageIndex = threadMessages.findIndex(
					(message) => message.id === body.editedMessageId,
				);

				editedMessage =
					editedMessageIndex !== -1 && threadMessages[editedMessageIndex]!;

				if (!editedMessage || editedMessage.role !== 'user')
					throw httpError(
						HttpCode.NOT_FOUND,
						ErrorCode.EDITED_MESSAGE_NOT_FOUND,
						activeUser.language,
					);

				threadMessages.splice(0, editedMessageIndex + 1);
			}

			// Attached files handling: if files provided
			const fileIds: string[] = [];
			let fileSystemMessage: PartialMessage | undefined;

			if (body.files?.length) {
				const fileIds = body.files.map(crypto.randomUUID);

				const insertedFiles = await Promise.all(
					body.files.map((f, i) =>
						NexataFile.ingest(
							{ id: fileIds[i], userId: activeUser.id, slug: activeUser.slug },
							f,
						),
					),
				).then((files) =>
					files.map((fileIngestionResult, i) => ({
						id: fileIngestionResult === 'OK' ? fileIds[i] : null,
						fileIngestionResult,
						name: body.files!.at(i)!.name,
						type: body.files!.at(i)!.type,
						size: body.files!.at(i)!.size,
					})),
				);

				fileSystemMessage = {
					id: crypto.randomUUID(),
					role: 'system',
					content: [
						`The user attached ${fileIds.length} file(s) to the message.`,
						encode(insertedFiles),
						`You have tools available to list and read file contents.`,
					].join('\n\n'),
				};

				threadMessages.push(fileSystemMessage);
			}

			// Initial user message handling and streaming
			const userMessage: PartialMessage = {
				id: crypto.randomUUID(),
				role: 'user',
				content: [{ type: 'text', text: body.prompt }],
			};
			threadMessages.push(userMessage);

			// Thread ID handling: use existing or generate new ID
			const threadId = body.threadId ?? crypto.randomUUID();

			const languagePreference = body.languagePreference ?? activeUser.language;

			// Generate thread title for new threads
			const threadTitle = body.threadId
				? undefined
				: await generateThreadTitle(body.prompt, languagePreference);

			// Final streaming
			const stream = streamText({
				model: body.extraReason ? REASONING_MODEL : MODEL,
				system: BUILD_SYSTEM_PROMPT({
					...activeUser,
					languagePreference,
				}),
				stopWhen: stepCountIs(20),
				tools: await getTools(activeUser, body.threadId, fileIds),
				experimental_transform: redactReasoningTransform(),
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

					if (!body.threadId)
						await createThread(
							activeUser.id,
							body.prompt,
							threadId,
							threadTitle,
							activeUser.language,
						);

					const messagesToAppend = [
						fileSystemMessage,
						userMessage,
						...messages,
					].filter((x) => typeof x !== 'undefined');

					const baseDate = new Date();
					const insertedMessages = await db
						.with(
							db.$with('trace').as(
								db.insert(trace).values({
									userId: activeUser.id,
									type: TraceType.MESSAGE_SENT,
									metadata: {
										threadId: body.threadId,
										extraReason: body.extraReason,
									},
								}),
							),
						)
						.insert(message)
						.values(
							messagesToAppend.map((m, i) => ({
								id: 'id' in m && m.id ? m.id : crypto.randomUUID(),
								threadId,
								role: m.role as MessageRole,
								content: m.content,
								createdAt: new Date(baseDate.getTime() + i),
							})),
						)
						.returning({ id: message.id, role: message.role });

					await Promise.all([
						cache.set(threadId, [...threadMessages, ...insertedMessages], {
							ex: 60 * 5,
						}),
						cache.set(
							`tenant:${activeUser.slug}:message-count`,
							{
								limit: messageCountData.limit,
								count: messageCountData.count + creditsToUse,
							},
							{ ex: 60 * 60 },
						),
					]);

					// Update files with messageId if we have one
					if (fileIds.length)
						await db
							.update(file)
							.set({ messageId: userMessage.id })
							.where(
								and(eq(file.userId, activeUser.id), inArray(file.id, fileIds)),
							);
				},
			});

			return stream.toUIMessageStreamResponse({
				headers: { 'Content-Type': 'text/event-stream' },
				messageMetadata: ({ part }) => {
					if (part.type === 'start') return { threadId, threadTitle };
				},
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
				files: Nullish(t.Files(), {
					description: 'Files to attach to this message.',
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
				throw httpError(
					HttpCode.INTERNAL_SERVER_ERROR,
					ErrorCode.THREAD_CREATION_FAILED,
					activeUser.language,
				);

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
