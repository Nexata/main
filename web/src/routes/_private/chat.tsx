'use client';

import { Chat as AIChat, useChat, type UIMessage } from '@ai-sdk/react';
import { lastAssistantMessageIsCompleteWithToolCalls } from 'ai';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Chat } from '@/components/ui/chat';
import { useRandomWelcome } from '@/hooks/use-random-welcome';
import { useThreadById } from '@/lib/chat';
import { useChatUIStore } from '@/lib/chat.store';
import { createAuthenticatedChatTransport } from '@/lib/chat-transport';
import { useMe } from '@/lib/user';
import { 'chat.meta.title' as chat_meta_title } from '@/paraglide/messages.js';

export const Route = createFileRoute('/_private/chat')({
	component: NexataChat,
});

// ----------------------------
// Stable helpers (outside component)
// ----------------------------

type UIParts = UIMessage['parts'];

function normalizeParts(content: unknown): UIParts {
  if (!content) return [];
  if (typeof content === 'string') return [{ type: 'text', text: content }];
  if (!Array.isArray(content)) return [];

  return content.map((part: any) => {
    if (part.type === 'tool-call' && part.toolName) {
      return {
        type: `tool-${part.toolName}`,
        toolCallId: part.toolCallId,
        state: 'output-available',
        input: part.input ?? {},
        output: part.output ?? null,
      };
    }
    if (part.type === 'file') {
      return {
        type: 'file',
        filename: part.filename ?? part.name ?? 'Unknown',
        mediaType: part.mediaType ?? part.mimeType ?? 'application/octet-stream',
        url: part.url ?? '',
      };
    }
    return part;
  }) as UIParts;
}

export function NexataChat() {
  useEffect(() => {
    document.title = chat_meta_title();
  }, []);

  // ----------------------------
  // Store
  // ----------------------------

  const { activeThreadId, status, setStreaming, finishStreaming } = useChatUIStore();

  const isNewChat = status === 'new';
  const isStreaming = status === 'streaming';

  // ----------------------------
  // Thread data (React Query es la fuente de verdad del loading)
  // ----------------------------

  const { data: threadMessages, isLoading: isThreadLoading } = useThreadById(
    activeThreadId ?? null
  );

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

  // ----------------------------
  // Chat Engine
  // ----------------------------

  const chat = useMemo(
    () => new AIChat({
      transport: createAuthenticatedChatTransport(),
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls
    }), [],
  );

  const {
    messages,
    sendMessage,
    stop,
    error,
    setMessages,
    status: chatStatus,
    addToolOutput
  } = useChat({
    chat
  });

  const appliedThreadRef = useRef<string | null>(null);

  useEffect(() => {
    appliedThreadRef.current = null;
  }, [activeThreadId]);

  useEffect(() => {
    if (!activeThreadId) return;
    if (threadMessages === undefined) return;
    if (appliedThreadRef.current === activeThreadId) return;

    appliedThreadRef.current = activeThreadId;
    setMessages(hydratedMessages);
  }, [activeThreadId, threadMessages, hydratedMessages, setMessages]);

  useEffect(() => {
    if (isNewChat) setMessages([]);
  }, [isNewChat, setMessages]);

  // ----------------------------
  // Reset streaming state when done
  // ----------------------------

  useEffect(() => {
    if (chatStatus === 'error') {
      finishStreaming();
      return;
    }
    if (chatStatus === 'ready') {
      const timeout = setTimeout(() => {
        finishStreaming();
      }, 300);
      return () => clearTimeout(timeout);
    }
    if (chatStatus === 'streaming' || chatStatus === 'submitted') {
      setStreaming(activeThreadId ?? '');
    }
  }, [chatStatus, finishStreaming, setStreaming, activeThreadId]);

  // ----------------------------
  // UI state derivado
  // ----------------------------

  const isSdkStreaming = chatStatus === 'streaming' || chatStatus === 'submitted'
  const isHydrating = !!activeThreadId && isThreadLoading && !isStreaming;

  // ----------------------------
  // Input / Submit
  // ----------------------------

  const [input, setInput] = useState('');
  const [extraReason, setExtraReason] = useState(false);

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
    const reasoning = extraReason;

    setInput('');
    setStreaming(activeThreadId ?? '');
    setExtraReason(false);

    await sendMessage(
      { text, files: files?.length ? files : null },
      {
        body: {
          threadId: activeThreadId ?? null,
          editedMessageId: null,
          languagePreference: me?.language ?? null,
          extraReason: reasoning,
        },
      },
    );
  };

  // ----------------------------
  // Welcome
  // ----------------------------

  const { data: me, isLoading: isMeLoading } = useMe();
  const userName = me?.displayName?.trim().split(' ')[0] ?? 'there';
  const welcomeText = useRandomWelcome(userName);

  // ----------------------------
  // Render
  // ----------------------------

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
          isGenerating={isSdkStreaming}
          isHydratingThread={isHydrating}
          isNewChat={isNewChat}
          welcomeLabel={welcomeText}
          isUserLoading={isMeLoading}
          setExtraReason={setExtraReason}
          addToolOutput ={addToolOutput}
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
