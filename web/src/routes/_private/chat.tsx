'use client';

import { Chat as AIChat, useChat } from '@ai-sdk/react';
import { createFileRoute } from '@tanstack/react-router';
import type { UIMessage } from 'ai';
import { useEffect, useMemo, useState } from 'react';

import { Chat } from '@/components/ui/chat';
import { useThreadById } from '@/lib/chat';
import { createAuthenticatedChatTransport } from '@/lib/chat-transport';
import { 'chat.meta.title' as chat_meta_title } from '@/paraglide/messages.js';
import { useRandomWelcome } from '@/hooks/use-random-welcome';
import { useMe } from '@/lib/user';
import { useChatUIStore } from '@/lib/chat.store';

export const Route = createFileRoute('/_private/chat')({
  component: NexataChat,
});

export function NexataChat() {
  useEffect(() => {
    document.title = chat_meta_title();
  }, []);

  // Store (fuente única de estado UI)
  const {
    activeThreadId,
    status,
    hydrateChat,
    setStreaming,
    finishStreaming,
  } = useChatUIStore();

  const isNewChat = status === 'new';
  const isHydrating = status === 'hydrating';
  const isStreaming = status === 'streaming';

  // Hidratación de thread
  const shouldLoadThread = isHydrating && !!activeThreadId;
  const { data: threadMessages } = useThreadById(shouldLoadThread ? activeThreadId : null);

  type UIParts = UIMessage['parts'];

  const normalizeParts = (content: unknown): UIParts => {
    if (!content) return [];
    if (Array.isArray(content)) return content as UIParts;
    if (typeof content === 'string') {
      return [{ type: 'text', text: content }];
    }
    return [];
  };

  const hydratedMessages = useMemo<UIMessage[]>(() => {
    if (!threadMessages) return [];

    return threadMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        id: m.id,
        role: m.role,
        createdAt: m.createdAt,
        metadata: { hydrated: true },
        parts: normalizeParts(m.content),
      }));
  }, [threadMessages]);


  // Chat engine
  const chat = useMemo(
    () => new AIChat({ transport: createAuthenticatedChatTransport(activeThreadId) }),
    [activeThreadId]
  );

  const {
    messages,
    sendMessage,
    stop,
    error,
    setMessages,
    status: chatStatus
  } = useChat({ chat });

  // Aplicar hidratación al motor de chat
  useEffect(() => {
    if (!isHydrating) return;
    if (!hydratedMessages.length) return;

    setMessages(hydratedMessages);
    finishStreaming();
  }, [isHydrating, hydratedMessages, setMessages, finishStreaming]);

  // Input / submit
  const [input, setInput] = useState('');

  const handleSubmit = async (
    event?: { preventDefault?: () => void },
    options?: { attachments?: FileList },
  ) => {
    event?.preventDefault?.();

    const hasText = input.trim().length > 0;
    const hasFiles = options?.attachments?.length;

    if (!hasText && !hasFiles) return;

    const text = input;
    const files = options?.attachments;

    setInput('');
    setStreaming(activeThreadId ?? '');

    await sendMessage({ text, files });
  };

  // Welcome / empty state
  const { data: me, isLoading: isMeLoading } = useMe()
  const userName = me?.displayName?.trim().split(' ')[0] ?? 'there';
  const welcomeText = useRandomWelcome(userName);

  useEffect(() => {
    if (activeThreadId === null && status === 'idle') {
      useChatUIStore.getState().startNewChat()
    }
  }, [activeThreadId, status])

  return (
    <div className="flex flex-col h-full w-full min-h-0">
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <Chat
          className="flex-1 min-h-0"
          messages={messages}
          input={input}
          handleInputChange={(e) => setInput(e.target.value)}
          handleSubmit={handleSubmit}
          stop={stop}
          isGenerating={isStreaming}
          isHydratingThread={isHydrating}
          isNewChat={isNewChat}
          welcomeLabel={welcomeText}
          isUserLoading={isMeLoading}
        />

        {error && (
          <div className="text-xs text-red-500 text-center mt-1">
            Error: {error.message}
          </div>
        )}

        <div className="text-xs mt-1 w-full text-center text-muted-foreground">
          Nexata&apos;s Chat ®
        </div>
      </div>
    </div>
  );
}
