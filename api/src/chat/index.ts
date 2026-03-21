import { authPlugin } from '@api/auth';
import {
	BUILD_SYSTEM_PROMPT,
	generateThreadTitle,
	getThreadMessages,
	mapFinishReason,
	type PartialMessage,
	persistChat,
	redactReasoningTransform,
} from '@api/chat/lib';
import { threadRouter } from '@api/chat/thread';
import { getTools } from '@api/chat/tools';
import { db, MODEL, REASONING_MODEL } from '@api/env';
import { NexataFile } from '@api/file';
import { FinishReason, message, thread } from '@api/schema';
import { checkTenantCanChat } from '@api/utils/billing';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { sq } from '@api/utils/sql';
import { Nullish, tObject } from '@api/utils/type';
import { captureException } from '@sentry/bun';
import { encode } from '@toon-format/toon';
import { consumeStream, type ModelMessage, stepCountIs, streamText } from 'ai';
import { and, eq, lte, or, sql } from 'drizzle-orm';
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

			const assistantMessageId = crypto.randomUUID();

			const doPersist = async (
				responseMessages: ModelMessage[],
				reason: FinishReason,
			) =>
				persistChat({
					threadId,
					activeUser,
					creditsToUse,
					threadMessages,
					responseMessages,
					reason,
					messagesToPrepend: [fileSystemMessage, userMessage].filter(
						(x) => typeof x !== 'undefined',
					),
					editedMessage: editedMessage || undefined,
					newThread: body.threadId
						? undefined
						: {
								prompt: body.prompt,
								title: threadTitle,
								language: activeUser.language,
							},
					fileIds: fileIds.length ? fileIds : undefined,
					userMessageId: userMessage.id,
					assistantMessageId,
				});

			// Final streaming
			const stream = streamText({
				model: body.extraReason ? REASONING_MODEL : MODEL,
				system: BUILD_SYSTEM_PROMPT({
					...activeUser,
					languagePreference,
				}),
				abortSignal: request.signal,
				stopWhen: stepCountIs(50),
				tools: await getTools(
					activeUser,
					body.threadId,
					fileIds,
					body.interactive ?? true,
				),
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
					await doPersist(
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
					await doPersist(responseMessages, FinishReason.STOPPED).catch(
						(error) =>
							captureException(error, {
								tags: { source: 'chat:onAbort' },
								extra: { threadId },
							}),
					);
				},
				onError: async ({ error }) => {
					if (error instanceof Error && error.name === 'AbortError') {
						await doPersist([], FinishReason.STOPPED).catch((err) =>
							captureException(err, {
								tags: { source: 'chat:onError:abort' },
								extra: { threadId },
							}),
						);
					} else {
						await doPersist([], FinishReason.ERROR).catch((err) =>
							captureException(err, {
								tags: { source: 'chat:onError:persist' },
								extra: { threadId },
							}),
						);
						captureException(error, {
							tags: { source: 'chat:onError' },
							extra: { threadId },
						});
					}
				},
			});

			return stream.toUIMessageStreamResponse({
				headers: { 'Content-Type': 'text/event-stream' },
				consumeSseStream: consumeStream,
				generateMessageId: () => assistantMessageId,
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
				interactive: Nullish(
					t.Union([
						t.Boolean({ default: true }),
						t.BooleanString({ default: true }),
					]),
					{
						description:
							'If true, includes approval-requiring tools like re-ingestion in the toolset.',
					},
				),
			}),
		},
	)
	.post(
		'/answer',
		async ({ body, activeUser, request }) => {
			const threadMessages = await getThreadMessages(body.threadId, {
				content: 'partial',
				slug: activeUser.slug,
				userId: activeUser.id,
				avoidCaching: true,
				language: activeUser.language,
			});

			// Find the last assistant message with an unresolved NexataAskQuestions tool call
			const lastMessage = threadMessages.at(-1);
			if (!lastMessage || lastMessage.role !== 'assistant')
				throw httpError(
					HttpCode.BAD_REQUEST,
					ErrorCode.TOOL_CALL_NOT_FOUND,
					activeUser.language,
				);

			const toolCallPart = (
				(Array.isArray(lastMessage.content)
					? lastMessage.content
					: []) as unknown[]
			).find(
				(
					part,
				): part is {
					type: 'tool-call';
					toolCallId: string;
					toolName: string;
				} =>
					typeof part === 'object' &&
					part !== null &&
					'type' in part &&
					part.type === 'tool-call' &&
					'toolName' in part &&
					part.toolName === 'NexataAskQuestions',
			);

			if (!toolCallPart)
				throw httpError(
					HttpCode.BAD_REQUEST,
					ErrorCode.TOOL_CALL_NOT_FOUND,
					activeUser.language,
				);

			// Append the tool result to the message history
			// Extra `result` field stores raw answers for frontend hydration
			const toolResultMessage = {
				id: crypto.randomUUID(),
				role: 'tool',
				content: [
					{
						type: 'tool-result',
						toolCallId: toolCallPart.toolCallId,
						toolName: 'NexataAskQuestions',
						result: body.result,
						output: {
							type: 'text',
							value: encode(body.result),
						},
					},
				],
			} as unknown as PartialMessage;

			threadMessages.push(toolResultMessage);

			const languagePreference = body.languagePreference ?? activeUser.language;

			const assistantMessageId = crypto.randomUUID();

			const doPersist = async (
				responseMessages: ModelMessage[],
				reason: FinishReason,
			) =>
				persistChat({
					threadId: body.threadId,
					activeUser,
					creditsToUse: 0,
					threadMessages,
					responseMessages,
					reason,
					messagesToPrepend: [toolResultMessage],
					assistantMessageId,
				});

			const stream = streamText({
				model: MODEL,
				system: BUILD_SYSTEM_PROMPT({
					...activeUser,
					languagePreference,
				}),
				abortSignal: request.signal,
				stopWhen: stepCountIs(50),
				tools: await getTools(activeUser, body.threadId, [], true),
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
					await doPersist(
						responseMessages,
						mapFinishReason(aiFinishReason),
					).catch((error) =>
						captureException(error, {
							tags: { source: 'chat:answer:onFinish' },
							extra: {
								threadId: body.threadId,
								finishReason: aiFinishReason,
							},
						}),
					);
				},
				onAbort: async ({ steps }) => {
					const responseMessages = steps.flatMap(
						(step) => step.response.messages,
					);
					await doPersist(responseMessages, FinishReason.STOPPED).catch(
						(error) =>
							captureException(error, {
								tags: { source: 'chat:answer:onAbort' },
								extra: { threadId: body.threadId },
							}),
					);
				},
				onError: async ({ error }) => {
					if (error instanceof Error && error.name === 'AbortError') {
						await doPersist([], FinishReason.STOPPED).catch((err) =>
							captureException(err, {
								tags: { source: 'chat:answer:onError:abort' },
								extra: { threadId: body.threadId },
							}),
						);
					} else {
						await doPersist([], FinishReason.ERROR).catch((err) =>
							captureException(err, {
								tags: { source: 'chat:answer:onError:persist' },
								extra: { threadId: body.threadId },
							}),
						);
						captureException(error, {
							tags: { source: 'chat:answer:onError' },
							extra: { threadId: body.threadId },
						});
					}
				},
			});

			// Do NOT pass generateMessageId here.
			// If we send a new messageId in the SSE "start" event, the AI SDK client
			// detects that the new ID differs from the existing QA assistant message ID
			// and calls pushMessage() on a deep-clone of that message (which still
			// contains the original text + QA parts), making the entire QA block appear
			// twice in the UI.  Without a messageId in "start", the SDK keeps the clone's
			// original ID → replaceMessage() is used instead of pushMessage() → no duplication.
			// The assistantMessageId UUID is still used exclusively for DB persistence below.
			return stream.toUIMessageStreamResponse({
				headers: { 'Content-Type': 'text/event-stream' },
				consumeSseStream: consumeStream,
			});
		},
		{
			detail: {
				summary: 'Answer tool call',
				description:
					'Submits user answers for a NexataAskQuestions tool call and resumes AI generation. Does not consume a message credit.',
			},
			body: tObject({
				threadId: t.String({
					format: 'uuid',
					description: 'UUID of the thread containing the tool call.',
				}),
				result: t.Unknown({
					description: 'The user answers for the tool call, as a JSON value.',
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
							finishReason: messagesToCopy.finishReason,
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
