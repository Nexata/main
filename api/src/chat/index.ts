import { authPlugin } from '@api/auth';
import {
	BUILD_SYSTEM_PROMPT,
	createSyncedStream,
	createSyncResolver,
	generateThreadTitle,
	getThreadMessages,
	mapFinishReason,
	type PartialMessage,
	persistChat,
} from '@api/chat/lib';
import { threadRouter } from '@api/chat/thread';
import { getTools } from '@api/chat/tools';
import { Nexata } from '@api/chat/tools/nexata';
import { db, MODEL, REASONING_MODEL } from '@api/env';
import { NexataFile } from '@api/file';
import { Dropbox } from '@api/integration/dropbox';
import { Drive, Gmail } from '@api/integration/google';
import { OneDrive, Outlook } from '@api/integration/microsoft';
import { FinishReason, message, OauthScope, thread } from '@api/schema';
import { checkTenantCanChat, checkTenantCanIngest } from '@api/utils/billing';
import {
	type CachedCredential,
	ensureFreshTokens,
	getCredentialsForUser,
} from '@api/utils/credential';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { sq } from '@api/utils/sql';
import { Nullish, tObject } from '@api/utils/type';
import { captureException } from '@sentry/bun';
import { encode } from '@toon-format/toon';
import {
	consumeStream,
	createUIMessageStreamResponse,
	type ModelMessage,
	stepCountIs,
	streamText,
} from 'ai';
import { and, eq, lte, or, sql } from 'drizzle-orm';
import { Elysia, t } from 'elysia';

const countAskQuestionsSinceLastUserMessage = (
	threadMessages: PartialMessage[],
) => {
	let count = 0;

	for (let i = threadMessages.length - 1; i >= 0; i--) {
		const threadMessage = threadMessages[i];
		if (!threadMessage) continue;
		if (threadMessage.role === 'user') break;

		if (threadMessage.role !== 'assistant') continue;

		const contentParts = Array.isArray(threadMessage.content)
			? (threadMessage.content as unknown[])
			: [];

		count += contentParts.filter(
			(
				part,
			): part is {
				type: 'tool-call';
				toolName: string;
			} =>
				typeof part === 'object' &&
				part !== null &&
				'type' in part &&
				part.type === 'tool-call' &&
				'toolName' in part &&
				part.toolName === 'NexataAskQuestions',
		).length;
	}

	return count;
};

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

				threadMessages.splice(editedMessageIndex);
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
			const syncResolver = createSyncResolver();

			const stream = streamText({
				model: body.extraReason ? REASONING_MODEL : MODEL,
				maxOutputTokens: 16384,
				providerOptions: {
					togetherai: { parallel_tool_calls: false },
				},
				system: BUILD_SYSTEM_PROMPT({
					displayName: activeUser.displayName,
					email: activeUser.email,
					isAdmin: activeUser.isAdmin,
					languagePreference,
				}),
				abortSignal: request.signal,
				stopWhen: stepCountIs(200),
				tools: await getTools(
					activeUser,
					body.threadId,
					fileIds,
					body.interactive ?? true,
				),
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
					syncResolver.resolve({
						messages: responseMessages,
						reason: mapFinishReason(aiFinishReason),
					});
				},
				onAbort: async ({ steps }) => {
					const responseMessages = steps.flatMap(
						(step) => step.response.messages,
					);
					syncResolver.resolve({
						messages: responseMessages,
						reason: FinishReason.STOPPED,
					});
				},
				onError: async ({ error }) => {
					if (error instanceof Error && error.name === 'AbortError') {
						syncResolver.resolve({
							messages: [],
							reason: FinishReason.STOPPED,
						});
					} else {
						captureException(error, {
							tags: { source: 'chat:onError' },
							extra: { threadId },
						});
						syncResolver.resolve({
							messages: [],
							reason: FinishReason.ERROR,
						});
					}
				},
			});

			const uiStream = createSyncedStream(
				stream.toUIMessageStream({
					sendReasoning: true,
					generateMessageId: () => assistantMessageId,
					messageMetadata: ({ part }) => {
						if (part.type === 'start')
							return { threadId, threadTitle, userMessageId: userMessage.id };
					},
				}),
				syncResolver,
				doPersist,
				{ threadId, source: 'chat' },
			);

			return createUIMessageStreamResponse({
				stream: uiStream,
				headers: { 'Content-Type': 'text/event-stream' },
				consumeSseStream: consumeStream,
			});
		},
		{
			detail: { summary: 'Chat with LLM' },
			body: tObject({
				prompt: t.String({ minLength: 1 }),
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

			const lastMessage = threadMessages.at(-1);
			if (!lastMessage || lastMessage.role !== 'assistant')
				throw httpError(
					HttpCode.BAD_REQUEST,
					ErrorCode.TOOL_CALL_NOT_FOUND,
					activeUser.language,
				);

			const contentParts = (
				Array.isArray(lastMessage.content) ? lastMessage.content : []
			) as unknown[];

			// ===== Tool approval (NexataReingest, GmailIngestAttachments, etc.) =====
			const isApproval = body.approved != null;

			if (isApproval) {
				const approvalPart = [...contentParts].reverse().find(
					(
						part,
					): part is {
						type: 'tool-call';
						toolCallId: string;
						toolName: string;
						input: Record<string, unknown>;
					} =>
						typeof part === 'object' &&
						part !== null &&
						'type' in part &&
						part.type === 'tool-call',
				);

				if (!approvalPart)
					throw httpError(
						HttpCode.BAD_REQUEST,
						ErrorCode.TOOL_CALL_NOT_FOUND,
						activeUser.language,
					);

				let toolOutput: unknown;
				if (body.approved) {
					try {
						if (approvalPart.toolName === 'NexataReingest') {
							toolOutput = await Nexata.reingest(
								activeUser,
								approvalPart.input as { fileId: string },
							);
						} else {
							const ingestTools: Record<
								string,
								{
									scope: OauthScope;
									fromTokens: (at: string, rt: string) => unknown;
									execute: (
										client: never,
										au: typeof activeUser,
										input: never,
										credentialId: string,
									) => Promise<unknown>;
								}
							> = {
								GmailIngestAttachments: {
									scope: OauthScope.GMAIL,
									fromTokens: Gmail.fromTokens,
									execute: Gmail.ingestAttachments,
								},
								OutlookIngestAttachments: {
									scope: OauthScope.OUTLOOK,
									fromTokens: Outlook.fromTokens,
									execute: Outlook.ingestAttachments,
								},
								DriveIngest: {
									scope: OauthScope.DRIVE,
									fromTokens: Drive.fromTokens,
									execute: async (client, au, input, credentialId) => {
										const blockReason = await checkTenantCanIngest(au.slug);
										if (blockReason)
											throw httpError(
												blockReason === ErrorCode.PAYMENT_REQUIRED
													? HttpCode.PAYMENT_REQUIRED
													: HttpCode.PRECONDITION_FAILED,
												ErrorCode[blockReason as keyof typeof ErrorCode],
												au.language,
											);
										return Drive.ingest(
											client,
											au.id,
											au.slug,
											credentialId,
											(input as { selection: { isDir: boolean; id: string }[] })
												.selection,
										);
									},
								},
								DropboxIngest: {
									scope: OauthScope.DROPBOX,
									fromTokens: Dropbox.fromTokens,
									execute: async (client, au, input, credentialId) => {
										const blockReason = await checkTenantCanIngest(au.slug);
										if (blockReason)
											throw httpError(
												blockReason === ErrorCode.PAYMENT_REQUIRED
													? HttpCode.PAYMENT_REQUIRED
													: HttpCode.PRECONDITION_FAILED,
												ErrorCode[blockReason as keyof typeof ErrorCode],
												au.language,
											);
										return Dropbox.ingest(
											client,
											au.id,
											au.slug,
											credentialId,
											(input as { selection: { isDir: boolean; id: string }[] })
												.selection,
										);
									},
								},
								OneDriveIngest: {
									scope: OauthScope.ONE_DRIVE,
									fromTokens: OneDrive.fromTokens,
									execute: async (client, au, input, credentialId) => {
										const blockReason = await checkTenantCanIngest(au.slug);
										if (blockReason)
											throw httpError(
												blockReason === ErrorCode.PAYMENT_REQUIRED
													? HttpCode.PAYMENT_REQUIRED
													: HttpCode.PRECONDITION_FAILED,
												ErrorCode[blockReason as keyof typeof ErrorCode],
												au.language,
											);
										return OneDrive.ingest(
											client,
											au.id,
											au.slug,
											credentialId,
											(input as { selection: { isDir: boolean; id: string }[] })
												.selection,
										);
									},
								},
							};

							const handler = ingestTools[approvalPart.toolName];
							if (!handler)
								throw httpError(
									HttpCode.BAD_REQUEST,
									ErrorCode.TOOL_CALL_NOT_FOUND,
									activeUser.language,
								);

							const credentials = await getCredentialsForUser(
								activeUser,
								'usage',
							);
							const cred = credentials.find(
								(c): c is CachedCredential =>
									c.scope === handler.scope &&
									(!approvalPart.input.credentialEmail ||
										c.email === approvalPart.input.credentialEmail),
							);

							if (!cred)
								throw httpError(
									HttpCode.BAD_REQUEST,
									ErrorCode.TOOL_CALL_NOT_FOUND,
									activeUser.language,
								);

							const { at, rt } = await ensureFreshTokens(
								cred.id,
								cred.provider,
								cred.accessToken,
								cred.refreshToken,
								cred.accessTokenExpiresAt,
								activeUser.slug,
								activeUser.language,
							);

							toolOutput = await handler.execute(
								handler.fromTokens(at, rt) as never,
								activeUser,
								approvalPart.input as never,
								cred.id,
							);
						}
					} catch (error) {
						captureException(error, {
							tags: { source: 'chat:answer:approve:tool' },
							extra: {
								toolName: approvalPart.toolName,
								threadId: body.threadId,
							},
						});
						toolOutput = {
							error:
								error instanceof Error
									? error.message
									: 'Tool execution failed',
						};
					}
				} else {
					toolOutput = { result: 'DENIED' };
				}

				const toolResultMessage = {
					id: crypto.randomUUID(),
					role: 'tool',
					content: [
						{
							type: 'tool-result',
							toolCallId: approvalPart.toolCallId,
							toolName: approvalPart.toolName,
							result: toolOutput,
							output: {
								type: 'text',
								value: encode(toolOutput),
							},
						},
					],
				} as unknown as PartialMessage;

				threadMessages.push(toolResultMessage);

				const languagePreference =
					body.languagePreference ?? activeUser.language;
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

				const syncResolver = createSyncResolver();
				const includeAskQuestions =
					countAskQuestionsSinceLastUserMessage(threadMessages) < 2;

				const stream = streamText({
					model: MODEL,
					maxOutputTokens: 16384,
					providerOptions: {
						togetherai: { parallel_tool_calls: false },
					},
					system: BUILD_SYSTEM_PROMPT({
						displayName: activeUser.displayName,
						email: activeUser.email,
						isAdmin: activeUser.isAdmin,
						languagePreference,
					}),
					abortSignal: request.signal,
					stopWhen: stepCountIs(200),
					tools: await getTools(
						activeUser,
						body.threadId,
						[],
						true,
						includeAskQuestions,
					),
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
						syncResolver.resolve({
							messages: responseMessages,
							reason: mapFinishReason(aiFinishReason),
						});
					},
					onAbort: async ({ steps }) => {
						const responseMessages = steps.flatMap(
							(step) => step.response.messages,
						);
						syncResolver.resolve({
							messages: responseMessages,
							reason: FinishReason.STOPPED,
						});
					},
					onError: async ({ error }) => {
						if (error instanceof Error && error.name === 'AbortError') {
							syncResolver.resolve({
								messages: [],
								reason: FinishReason.STOPPED,
							});
						} else {
							captureException(error, {
								tags: { source: 'chat:answer:approve:onError' },
								extra: { threadId: body.threadId },
							});
							syncResolver.resolve({
								messages: [],
								reason: FinishReason.ERROR,
							});
						}
					},
				});

				const uiStream = createSyncedStream(
					stream.toUIMessageStream({ sendReasoning: true }),
					syncResolver,
					doPersist,
					{ threadId: body.threadId, source: 'chat:answer:approve' },
				);

				return createUIMessageStreamResponse({
					stream: uiStream,
					headers: { 'Content-Type': 'text/event-stream' },
					consumeSseStream: consumeStream,
				});
			}

			// ===== NexataAskQuestions answer =====
			const toolCallPart = contentParts.find(
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

			const syncResolver = createSyncResolver();
			const includeAskQuestions =
				countAskQuestionsSinceLastUserMessage(threadMessages) < 2;

			const stream = streamText({
				model: MODEL,
				maxOutputTokens: 16384,
				providerOptions: {
					togetherai: { parallel_tool_calls: false },
				},
				system: BUILD_SYSTEM_PROMPT({
					displayName: activeUser.displayName,
					email: activeUser.email,
					isAdmin: activeUser.isAdmin,
					languagePreference,
				}),
				abortSignal: request.signal,
				stopWhen: stepCountIs(200),
				tools: await getTools(
					activeUser,
					body.threadId,
					[],
					true,
					includeAskQuestions,
				),
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
					syncResolver.resolve({
						messages: responseMessages,
						reason: mapFinishReason(aiFinishReason),
					});
				},
				onAbort: async ({ steps }) => {
					const responseMessages = steps.flatMap(
						(step) => step.response.messages,
					);
					syncResolver.resolve({
						messages: responseMessages,
						reason: FinishReason.STOPPED,
					});
				},
				onError: async ({ error }) => {
					if (error instanceof Error && error.name === 'AbortError') {
						syncResolver.resolve({
							messages: [],
							reason: FinishReason.STOPPED,
						});
					} else {
						captureException(error, {
							tags: { source: 'chat:answer:onError' },
							extra: { threadId: body.threadId },
						});
						syncResolver.resolve({
							messages: [],
							reason: FinishReason.ERROR,
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
			const uiStream = createSyncedStream(
				stream.toUIMessageStream({ sendReasoning: true }),
				syncResolver,
				doPersist,
				{ threadId: body.threadId, source: 'chat:answer' },
			);

			return createUIMessageStreamResponse({
				stream: uiStream,
				headers: { 'Content-Type': 'text/event-stream' },
				consumeSseStream: consumeStream,
			});
		},
		{
			detail: {
				summary: 'Answer tool call',
				description:
					'Submits user answers for a NexataAskQuestions tool call, or an approval/denial for an approval-requiring tool call (e.g. NexataReingest, GmailIngestAttachments, OutlookIngestAttachments). Does not consume a message credit.',
			},
			body: tObject({
				threadId: t.String({
					format: 'uuid',
					description: 'UUID of the thread containing the tool call.',
				}),
				result: Nullish(t.Unknown(), {
					description:
						'The user answers for NexataAskQuestions, as a JSON value.',
				}),
				toolCallId: Nullish(t.String(), {
					description:
						'The tool call ID for the approval. Optional — the last tool-call part is used if omitted.',
				}),
				approved: Nullish(t.Boolean(), {
					description: 'Whether the approval-requiring tool call was approved.',
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
