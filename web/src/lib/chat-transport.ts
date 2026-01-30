import { DefaultChatTransport } from 'ai';
import { API_BASE_URL } from '@/api';
import { getAccessToken } from '@/lib/auth';
import { getFingerprint } from '@/lib/fingerprint';

const baseFetch = globalThis.fetch;

export function createAuthenticatedChatTransport(threadId?: string | null) {
	const customFetchImpl = async (
		input: RequestInfo | URL,
		init?: RequestInit,
	): Promise<Response> => {
		const url =
			typeof input === 'string' && input.startsWith('/')
				? `${API_BASE_URL}${input}`
				: input;

		if (typeof input === 'string' && input === '/api/chat' && init?.body) {
			try {
				const originalPayload = JSON.parse(init.body as string);

				const lastMessage = originalPayload.messages?.at(-1);

				const prompt =
					lastMessage?.parts
						?.filter((p: any) => p.type === 'text')
						.map((p: any) => p.text)
						.join('\n') ?? '';

				const files =
					lastMessage?.parts
						?.filter((p: any) => p.type === 'file')
						.map((f: any) => ({
							mediaType: f.mediaType,
							filename: f.filename,
							url: f.url,
						})) ?? [];

				const adaptedPayload = {
					prompt,
					files,
					extraReason: originalPayload.extraReason ?? false,
					threadId: threadId,
					editedMessageId: undefined,
					languagePreference: undefined,
				};

				return baseFetch(url, {
					...init,
					body: JSON.stringify(adaptedPayload),
				});
			} catch (err) {
				console.error('[Chat Adapter] Failed to adapt payload', err);
				return baseFetch(url, init);
			}
		}

		return baseFetch(url, init);
	};

	const customFetch = Object.assign(customFetchImpl, baseFetch) as typeof fetch;
	return new DefaultChatTransport({
		api: '/api/chat',
		headers: async () => {
			const token = getAccessToken();
			const fingerprint = await getFingerprint();

			return { authorization: token ? `Bearer ${token}` : '', fingerprint };
		},
		body: {
			threadId: threadId,
			extraReason: false,
			editedMessageId: undefined,
			languagePreference: undefined,
		},
		fetch: customFetch,
	});
}
