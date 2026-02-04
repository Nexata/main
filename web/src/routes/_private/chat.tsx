'use client';

import { Chat as AIChat, useChat } from '@ai-sdk/react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import type { UIMessage } from 'ai';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Chat } from '@/components/ui/chat';
import { useThreadById } from '@/lib/chat';
import { createAuthenticatedChatTransport } from '@/lib/chat-transport';
import { 'chat.meta.title' as chat_meta_title } from '@/paraglide/messages.js';
import { useRandomWelcome } from '@/hooks/use-random-welcome';
import { useMe } from '@/lib/user';
import { useChatUIStore } from '@/lib/chat.store';

export const Route = createFileRoute('/_private/chat')({
	component: NexataChat,
	validateSearch: (search: Record<string, unknown>) => ({
		threadId: typeof search.threadId === 'string' ? search.threadId : null,
	}),
});

export function NexataChat() {
	useEffect(() => {
		document.title = chat_meta_title();
	}, []);

	const search = Route.useSearch();
	const navigate = useNavigate();

	// Active Thred
  const [activeThreadId, setActiveThreadId] = useState<string | null>(search.threadId);

 	// Avisar ThredId + Title
	const setGlobalActiveThreadId = useChatUIStore((s) => s.setActiveThreadId);

  useEffect(() => {
    setActiveThreadId(search.threadId);
		setGlobalActiveThreadId(search.threadId);
  }, [search.threadId]);

	// Flags Auxiliares
  const hadThreadOnMount = useRef<boolean>(search.threadId !== null);
  const shouldLoadThread = activeThreadId !== null && hadThreadOnMount.current;

	// Precarga de Thred
  const { data: threadMessages, isLoading: threadLoading } = useThreadById(shouldLoadThread ? activeThreadId : null);

	const chat = useMemo(() => {
		return new AIChat({
			transport: createAuthenticatedChatTransport(
				activeThreadId,
				(newThreadId) => {
          setActiveThreadId(newThreadId);
					setGlobalActiveThreadId(newThreadId);

					navigate({
						to: '/chat',
						search: { threadId: newThreadId },
						replace: true,
					});
				},
			),
		});
  }, [activeThreadId, navigate]);

	type UIParts = UIMessage["parts"];

  function normalizeParts(content: unknown): UIParts {
    if (!content) return [];

    if (Array.isArray(content)) return content as UIParts;
    if (typeof content === "string")  return [{ type: "text", text: content }];

    return [];
  }

  const initialMessages = useMemo<UIMessage[]>(() => {
    if (!threadMessages || !activeThreadId) return [];

    return threadMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        id: m.id,
        role: m.role,
        createdAt: m.createdAt,
        metadata: { hydrated: true },
        parts: normalizeParts(m.content),
      }));
  }, [threadMessages, activeThreadId]);

	// Creacion del Chat
	const { messages, sendMessage, status, stop, error, setMessages } = useChat({chat});

	// Input
  const [input, setInput] = useState('');
  const hasUserSentMessage = useRef(false);

	// Hidratacion Effect
	const hasHydrated = useRef(false);

  useEffect(() => {
    if (hasHydrated.current) return;
    if (!hadThreadOnMount.current) return;
    if (!activeThreadId) return;
    if (!initialMessages.length) return;
    if (status === "streaming") return;

    setMessages(initialMessages);
    hasHydrated.current = true;
  }, [activeThreadId, initialMessages, status, setMessages]);

	// Revisar thred activo
	useEffect(() => {
		if (!activeThreadId) {
      setMessages([]);
			setGlobalActiveThreadId(null);
		}
	}, [activeThreadId, setMessages]);

 	// Flags
  const isLoadingThreadUI = hadThreadOnMount.current && threadLoading && status !== 'streaming';
  const isThinkingUI = status === 'streaming';
  const isHydratingThread = hadThreadOnMount.current && threadLoading && !hasUserSentMessage.current;

  // Enviar Mensaje
	const handleSubmit = async (
		event?: { preventDefault?: () => void },
		options?: { attachments?: FileList },
	) => {
		event?.preventDefault?.();

		const hasText = input.trim().length > 0;
    const hasFiles = options?.attachments && options.attachments.length > 0;

    if (!hasText && !hasFiles) return;

		hasUserSentMessage.current = true;
		const actualInput = input;
    setInput('');

    const files = options?.attachments;

		await sendMessage({
			text: actualInput,
			files
		});
  };

	// Random Welcome
	const { data: me } = useMe();
	const userName = me?.displayName?.trim().split(' ')[0] ?? 'there';
  const welcomeText = useRandomWelcome(userName);

	return (
		<div className="flex flex-col h-full w-full min-h-0">
			<div className="flex flex-col flex-1 min-h-0 overflow-hidden">
  			<Chat
          className="flex-1 min-h-0"
          messages={messages}
          input={input}
          handleInputChange={(e) => setInput(e.target.value)}
          handleSubmit={handleSubmit}
          isGenerating={isThinkingUI}
          stop={stop}
          isLoadingThread={isLoadingThreadUI}
          hasUserSentMessage={hasUserSentMessage.current}
          suggestionsLabel={welcomeText}
          suggestions={[]}
          append={() => { }}
          isHydratingThread={isHydratingThread}
        />

				{error && (
					<div className="text-xs text-red-500 text-center mt-1">
						Error: {error.message}
					</div>
				)}

				<div className="text-xs mt-1 w-full text-center text-muted-foreground">
					Nexata's Chat ®
				</div>
			</div>
		</div>
	);
}
