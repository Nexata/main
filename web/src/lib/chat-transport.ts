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

export function createAuthenticatedChatTransport(
  threadId?: string | null
) {
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

        const extraReason = originalPayload.extraReason ?? false;
        const languagePreference = originalPayload.languagePreference;

        // ===== CON ARCHIVOS =====
        if (hasFiles) {
          const formData = new FormData();

          formData.append('prompt', prompt);
          formData.append('extraReason', String(extraReason));

          if (finalThreadId) formData.append('threadId', finalThreadId);
          if (originalPayload.editedMessageId) {
            formData.append(
              'editedMessageId',
              originalPayload.editedMessageId,
            );
          }
          if (languagePreference) {
            formData.append('languagePreference', languagePreference);
          }

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
        const adaptedPayload = cleanObject({
          prompt,
          extraReason,
          threadId: finalThreadId,
          editedMessageId: originalPayload.editedMessageId,
          languagePreference,
        });

        const response = await baseFetch(url, {
          ...init,
          body: JSON.stringify(adaptedPayload),
          headers: {
            ...(init.headers ?? {}),
            'content-type': 'application/json',
          },
        });

        // ---- stream parsing ----
        try {
          const clone = response.clone()
          const reader = clone.body?.getReader()
          if (!reader) return response

          const decoder = new TextDecoder()
          let buffer = ''

          reader.read().then(({ value }) => {
            if (!value) return

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''

            for (const line of lines) {
              if (!line.startsWith('data:')) continue

              try {
                const json = line.replace('data:', '').trim()
                if (json === '[DONE]') return

                const event = JSON.parse(json)

                if (event.type === 'start' && event.messageMetadata?.threadId) {
                  const { threadId, threadTitle } = event.messageMetadata
                  const store = useChatUIStore.getState()

                  store.setActiveThreadId(threadId)

                  if (threadTitle) {
                    store.upsertOptimisticThread({
                      id: threadId,
                      title: threadTitle,
                      isTyping: true,
                    })
                  }
                }
              } catch {}
            }
          })
        } catch (err) {
          console.error('[Chat Debug] Failed to parse stream', err);
        }

        return response;
      } catch (err) {
        console.error('[Chat Adapter] Failed to adapt payload', err);
        return baseFetch(url, init);
      }
    }

    return baseFetch(url, init);
  };

  const customFetch = Object.assign(customFetchImpl, baseFetch) as typeof fetch;

  return new DefaultChatTransport({
    api: '/chat',
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
    fetch: customFetch,
  });
}
