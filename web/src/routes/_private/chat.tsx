'use client';

import { Chat as AIChat, useChat } from '@ai-sdk/react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import type { UIMessage } from 'ai';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Chat } from '@/components/ui/chat';
import { useThreadById } from '@/lib/chat';
import { createAuthenticatedChatTransport } from '@/lib/chat-transport';
import { 'chat.meta.title' as chat_meta_title } from '@/paraglide/messages.js';

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
	const [activeThreadId, setActiveThreadId] = useState<string | null>(search.threadId,);
	useEffect(() => {
		setActiveThreadId(search.threadId);
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

					navigate({
						to: '/chat',
						search: { threadId: newThreadId },
						replace: true,
					});
				},
			),
		});
	}, [activeThreadId, navigate]);

	const initialMessages = useMemo<UIMessage[]>(() => {
    if (!threadMessages || !activeThreadId) return [];

    return threadMessages
      .filter((m) => m.role !== 'tool')
      .map((m) => {
        let text = '';

        if (Array.isArray(m.content)) {
          text = m.content
            .filter((p) => p.type === 'text' && typeof p.text === 'string')
            .map((p) => p.text)
            .join('')
            .trim();
        }

        return {
          id: m.id,
          role: m.role as 'user' | 'assistant' | 'system',
          createdAt: m.createdAt,
          metadata: {
            hydrated: true,
          },
          parts: [
            {
              type: 'text',
              text,
            },
          ],
        };
      })
      .filter(
        (m) =>
          m.parts.length > 0 &&
          m.parts.some((p) => p.type === 'text' && p.text.trim().length > 0,),
      );
  }, [threadMessages, activeThreadId]);

	// Creacion del Chat
	const { messages, sendMessage, status, stop, error, setMessages } = useChat({
		chat,
  });

	// Input
  const [input, setInput] = useState('');
  const hasUserSentMessage = useRef(false);

	// Hidratacion Effect
	useEffect(() => {
    if (!hadThreadOnMount.current) return;
    if (!activeThreadId) return;
    if (!initialMessages.length) return;

    stop?.();
    setMessages(initialMessages);
  }, [activeThreadId, initialMessages, setMessages, stop]);


	// Revisar thred activo
	useEffect(() => {
		if (!activeThreadId) {
			setMessages([]);
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

    if (!input.trim()) return;

		hasUserSentMessage.current = true;
		const actualInput = input;
		setInput('');

		await sendMessage({
			text: actualInput,
			files: options?.attachments,
		});
  };

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
          suggestionsLabel="Que pinta hoy amigo? Pregunta si te da la nafta gato."
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
