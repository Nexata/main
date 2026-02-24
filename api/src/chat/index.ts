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
	BillableEventType,
	billableEvent,
	FinishReason,
	file,
	type MessageRole,
	message,
	thread,
} from '@api/schema';
import { checkTenantCanChat, incrementMessageUsage } from '@api/utils/billing';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { sq } from '@api/utils/sql';
import { Nullish, tObject } from '@api/utils/type';
import { captureException } from '@sentry/bun';
import { encode } from '@toon-format/toon';
import { consumeStream, type ModelMessage, stepCountIs, streamText } from 'ai';
import { and, eq, gte, inArray, lte, or, sql } from 'drizzle-orm';
import { Elysia, t } from 'elysia';

export const chatRouter = new Elysia({ prefix: '/chat', tags: ['Chat'] })
	.use(authPlugin())
	.use(threadRouter)
	.post(
		'/',
		async ({ body, activeUser, request }) => {
			const creditsToUse = body.extraReason ? 2 : 1;
			const chatBlock = await checkTenantCanChat(activeUser.slug, creditsToUse);

			if (chatBlock)
				throw httpError(
					chatBlock === ErrorCode.PAYMENT_REQUIRED
						? HttpCode.PAYMENT_REQUIRED
						: HttpCode.METHOD_NOT_ALLOWED,
					chatBlock as ErrorCode,
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
				fileIds.push(...body.files.map(() => crypto.randomUUID()));

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

			const mapFinishReason = (aiReason: string): FinishReason =>
				aiReason === 'stop'
					? FinishReason.COMPLETE
					: aiReason === 'length'
						? FinishReason.LENGTH
						: FinishReason.ERROR;

			const persistChat = async (
				responseMessages: ModelMessage[],
				reason: FinishReason,
			) => {
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
					...responseMessages,
				].filter((x) => typeof x !== 'undefined');

				const shouldBill = reason !== FinishReason.ERROR;

				const baseDate = new Date();
				const messageValues = messagesToAppend.map((m, i) => ({
					id:
						'id' in m && typeof m.id === 'string' ? m.id : crypto.randomUUID(),
					threadId,
					role: m.role as MessageRole,
					content: m.content,
					finishReason:
						m.role === 'assistant' || m.role === 'tool' ? reason : undefined,
					createdAt: new Date(baseDate.getTime() + i),
				}));

				const insertQuery = shouldBill
					? db
							.with(
								db.$with('billing').as(
									db.insert(billableEvent).values({
										type: BillableEventType.MESSAGE,
										consumption: creditsToUse.toString(),
										userId: activeUser.id,
										slug: activeUser.slug,
									}),
								),
							)
							.insert(message)
							.values(messageValues)
							.returning({ id: message.id, role: message.role })
					: db
							.insert(message)
							.values(messageValues)
							.returning({ id: message.id, role: message.role });

				const insertedMessages = await insertQuery;

				const afterInsert: Promise<unknown>[] = [
					cache.set(threadId, [...threadMessages, ...insertedMessages], {
						ex: 60 * 5,
					}),
				];

				if (shouldBill)
					afterInsert.push(
						incrementMessageUsage(activeUser.slug, creditsToUse),
					);

				await Promise.all(afterInsert);

				if (fileIds.length)
					await db
						.update(file)
						.set({ messageId: userMessage.id })
						.where(
							and(eq(file.userId, activeUser.id), inArray(file.id, fileIds)),
						);
			};

			// Final streaming
			const stream = streamText({
				model: body.extraReason ? REASONING_MODEL : MODEL,
				system: BUILD_SYSTEM_PROMPT({
					...activeUser,
					languagePreference,
				}),
				abortSignal: request.signal,
				stopWhen: stepCountIs(50),
				tools: await getTools(activeUser, body.threadId, fileIds),
				experimental_transform: redactReasoningTransform(),
				messages: threadMessages.map(
					(m) =>
						({
							role: m.role,
							content: m.content,
						}) as ModelMessage,
				),
				onFinish: async ({
					finishReason: aiFinishReason,
					response: { messages: responseMessages },
				}) => {
					await persistChat(
						responseMessages,
						mapFinishReason(aiFinishReason),
					).catch((error) =>
						captureException(error, {
							tags: { source: 'chat:onFinish' },
							extra: { threadId, finishReason: aiFinishReason },
						}),
					);
				},
				onAbort: async ({ steps }) => {
					const responseMessages = steps.flatMap(
						(step) => step.response.messages,
					);
					await persistChat(responseMessages, FinishReason.STOPPED).catch(
						(error) =>
							captureException(error, {
								tags: { source: 'chat:onAbort' },
								extra: { threadId },
							}),
					);
				},
			});

			return stream.toUIMessageStreamResponse({
				headers: { 'Content-Type': 'text/event-stream' },
				consumeSseStream: consumeStream,
				messageMetadata: ({ part }) => {
					if (part.type === 'start') return { threadId, threadTitle };
				},
			});
		},
		{
			detail: { summary: 'Chat with LLM' },
			body: tObject({
				prompt: t.String(),
				extraReason: Nullish(
					t.Union([
						t.Boolean({ default: false }),
						t.BooleanString({ default: false }),
					]),
					{
						description:
							'If true, uses a heavier reasoning model in exchange of two message credits.',
					},
				),
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
