import { DefaultChatTransport } from 'ai';
import { API_BASE_URL } from '@/api';
import { getAccessToken } from '@/lib/auth';
import { getFingerprint } from '@/lib/fingerprint';
import { useChatUIStore } from './chat.store';

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

        const prompt =
          lastMessage?.parts
            ?.filter((p: any) => p.type === 'text')
            .map((p: any) => p.text)
            .join('\n') ?? '';

        const fileParts =
          lastMessage?.parts?.filter((p: any) => p.type === 'file') ?? [];

        const hasFiles = fileParts.length > 0;

        const finalThreadId =
          originalPayload.threadId ?? threadId ?? undefined;

        const adaptedPayload = cleanObject({
          prompt,
          extraReason: originalPayload.extraReason ?? false,
          threadId: finalThreadId,
          editedMessageId: originalPayload.editedMessageId,
          languagePreference: originalPayload.languagePreference,
        });

        // ===== CON ARCHIVOS =====
        if (hasFiles) {
          const formData = new FormData();

          Object.entries(adaptedPayload).forEach(([k, v]) => {
            if (v !== undefined) formData.append(k, String(v));
          });

          for (const part of fileParts) {
            formData.append('files', part.file);
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

        // Rama paralela: lógica de negocio
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

                if (event.type === 'start' && event.messageMetadata?.threadId && originalPayload.threadId == null)
                {
                  const { threadId, threadTitle } = event.messageMetadata;
                  const store = useChatUIStore.getState();

                  store.setActiveThreadId(threadId);

                  store.upsertOptimisticThread({
                    id: threadId,
                    title: threadTitle ?? 'New chat',
                    isTyping: true,
                  });
                }
              } catch {
                // ignore malformed chunks
              }
            }
          }
        })();

        // Devolvemos el stream intacto al SDK
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
      extraReason: false,
      editedMessageId: undefined,
      languagePreference: undefined,
    },
  });
}
