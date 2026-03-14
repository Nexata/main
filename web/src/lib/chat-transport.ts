import { DefaultChatTransport } from 'ai';
import { API_BASE_URL } from '@/api';
import { getAccessToken } from '@/lib/auth';
import { getFingerprint } from '@/lib/fingerprint';
import { useChatUIStore } from './chat.store';
import { promoteChatInstance } from './chat-pool';

const baseFetch = globalThis.fetch;

function cleanObject<T extends Record<string, any>>(obj: T): Partial<T> {
	return Object.fromEntries(
		Object.entries(obj).filter(([, v]) => v !== undefined),
	) as Partial<T>;
}

export function createAuthenticatedChatTransport(threadId?: string | null) {
	const customFetchImpl = async (
		input: RequestInfo | URL,
		init?: RequestInit,
	): Promise<Response> => {
		const url =
			typeof input === 'string' && input.startsWith('/')
				? `${API_BASE_URL}${input}`
				: input;

		if (typeof input === 'string' && input === '/chat' && init?.body) {
			try {
				const originalPayload = JSON.parse(init.body as string);
				const lastMessage = originalPayload.messages?.at(-1);
				const isAutoSubmit = lastMessage?.role === 'assistant';

				// ===== NexataAskQuestions → /chat/answer =====
				if (isAutoSubmit) {
					const askQuestionsPart = lastMessage?.parts?.find(
						(p: any) =>
							(p.type === 'tool-NexataAskQuestions' ||
								(p.type === 'dynamic-tool' &&
									p.toolName === 'NexataAskQuestions')) &&
							p.state === 'output-available' &&
							p.output != null,
					);

					if (askQuestionsPart) {
						const storeThreadId = useChatUIStore.getState().activeThreadId;

						return baseFetch(`${API_BASE_URL}/chat/answer`, {
							...init,
							body: JSON.stringify({
								threadId: storeThreadId,
								result: askQuestionsPart.output,
								languagePreference: originalPayload.languagePreference ?? null,
							}),
							headers: {
								...(init.headers ?? {}),
								'content-type': 'application/json',
							},
						});
					}
				}

				const prompt = isAutoSubmit
					? ''
					: (lastMessage?.parts
							?.filter((p: any) => p.type === 'text')
							.map((p: any) => p.text)
							.join('\n') ?? '');

				const fileParts =
					lastMessage?.parts?.filter((p: any) => p.type === 'file') ?? [];

				const hasFiles = fileParts.length > 0;

				const storeThreadId = useChatUIStore.getState().activeThreadId || null;
				const sanitize = (id: unknown): string | null =>
					typeof id === 'string' && id.trim() !== '' ? id : null;

				const finalThreadId =
					sanitize(originalPayload.threadId) ??
					sanitize(threadId) ??
					storeThreadId ??
					undefined;

				const adaptedPayload = cleanObject({
					prompt: prompt ?? '',
					extraReason:
						originalPayload.extraReason != null
							? Boolean(originalPayload.extraReason)
							: null,
					threadId: finalThreadId ?? null,
					editedMessageId: originalPayload.editedMessageId ?? null,
					languagePreference: originalPayload.languagePreference ?? null,
					files: hasFiles ? fileParts : null,
					...(isAutoSubmit && { messages: originalPayload.messages }),
				});

				if (hasFiles) {
					const formData = new FormData();

					Object.entries(adaptedPayload).forEach(([key, value]) => {
						if (key === 'files') return;
						if (value != null && value !== '')
							formData.append(key, String(value));
					});

					for (const part of fileParts) {
						let fileToSend: File;
						if (part.file instanceof File) {
							fileToSend = part.file;
						} else if (part.url && part.filename) {
							const res = await fetch(part.url);
							const blob = await res.blob();
							fileToSend = new File([blob], part.filename, {
								type: part.mediaType,
							});
						} else {
							console.warn('[Transport] Skipping invalid file part', part);
							continue;
						}
						formData.append('files', fileToSend);
					}

					return baseFetch(url, {
						...init,
						body: formData,
						headers: {
							authorization: (init.headers as any)?.authorization,
							fingerprint: (init.headers as any)?.fingerprint,
						},
					});
				}

				// ===== SIN ARCHIVOS =====
				const response = await baseFetch(url, {
					...init,
					body: JSON.stringify(adaptedPayload),
					headers: {
						...(init.headers ?? {}),
						'content-type': 'application/json',
					},
				});

				// ===== STREAM DUPLICATION =====
				if (!response.body) return response;

				const [sdkStream, sideStream] = response.body.tee();

				(async () => {
					const reader = sideStream.getReader();
					const decoder = new TextDecoder();
					let buffer = '';

					while (true) {
						const { value, done } = await reader.read();
						if (done) break;

						buffer += decoder.decode(value, { stream: true });
						const lines = buffer.split('\n');
						buffer = lines.pop() ?? '';

						for (const line of lines) {
							if (!line.startsWith('data:')) continue;

							try {
								const json = line.replace('data:', '').trim();
								if (json === '[DONE]') return;

								const event = JSON.parse(json);

								if (event.type === 'start' && event.messageMetadata?.threadId) {
									const { threadId: newThreadId, threadTitle } =
										event.messageMetadata;
									const store = useChatUIStore.getState();

									if (newThreadId !== store.activeThreadId) {
										promoteChatInstance(newThreadId);
										store.setActiveThreadId(newThreadId);
										store.upsertOptimisticThread({
											id: newThreadId,
											title: threadTitle ?? 'New chat',
											isTyping: true,
										});
									}

									store.addStreamingThread(newThreadId);
								}
							} catch {
								// ignore malformed chunks
							}
						}
					}
				})();

				return new Response(sdkStream, response);
			} catch (err) {
				console.error('[Chat Transport] Payload adaptation failed', err);
				return baseFetch(url, init);
			}
		}

		return baseFetch(url, init);
	};

	const customFetch = Object.assign(customFetchImpl, baseFetch) as typeof fetch;

	return new DefaultChatTransport({
		api: '/chat',
		fetch: customFetch,
		headers: async () => {
			const token = getAccessToken();
			const fingerprint = await getFingerprint();
			return {
				authorization: token ? `Bearer ${token}` : '',
				fingerprint,
			};
		},
		body: {
			threadId,
			extraReason: null,
			editedMessageId: null,
			languagePreference: null,
			files: null,
		},
	});
}
