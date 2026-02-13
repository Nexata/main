'use client';

import { Chat as AIChat, useChat, type UIMessage } from '@ai-sdk/react';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

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
	if (Array.isArray(content)) return content as UIParts;
	if (typeof content === 'string') return [{ type: 'text', text: content }];
	return [];
}

export function NexataChat() {
	useEffect(() => {
		document.title = chat_meta_title();
	}, []);

	// ----------------------------
	// Store
	// ----------------------------

	const {
		activeThreadId,
		status,
		setStreaming,
		finishStreaming,
	} = useChatUIStore();

	const isNewChat = status === 'new';
	const isHydrating = status === 'hydrating';
	const isStreaming = status === 'streaming';

	// ----------------------------
	// Thread Hydration
	// ----------------------------

	const shouldLoadThread = isHydrating && !!activeThreadId;
	const { data: threadMessages } = useThreadById(shouldLoadThread ? activeThreadId : null);

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
	// Chat Engine (stable)
	// ----------------------------

	const chat = useMemo(
		() =>
			new AIChat({
				transport: createAuthenticatedChatTransport(),
			}),
		[],
	);

	const {
		messages,
		sendMessage,
		stop,
		error,
		setMessages,
		status: chatStatus,
	} = useChat({ chat });

	// ----------------------------
	// Apply hydration to engine
	// ----------------------------

	useEffect(() => {
		if (!isHydrating) return;
		if (!hydratedMessages.length) return;

		setMessages(hydratedMessages);
		finishStreaming();
	}, [isHydrating, hydratedMessages, setMessages, finishStreaming]);

	// ----------------------------
	// Reset streaming state when done
	// ----------------------------

	useEffect(() => {
		if (chatStatus === 'ready' || chatStatus === 'error') {
			finishStreaming();
		}
	}, [chatStatus, finishStreaming]);

	// ----------------------------
	// Input / Submit
	// ----------------------------

  const [input, setInput] = useState('');
  const [extraReason, setExtraReason] = useState(false)

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
			{ text, files },
			{
				body: {
          threadId: activeThreadId ?? undefined,
          languagePreference: me?.languagePreference ?? undefined,
          extraReason: reasoning || undefined
				},
			},
    );
	};

	// ----------------------------
	// Welcome / Empty State
	// ----------------------------

	const { data: me, isLoading: isMeLoading } = useMe();
	const userName = me?.displayName?.trim().split(' ')[0] ?? 'there';
	const welcomeText = useRandomWelcome(userName);

	useEffect(() => {
		if (status === 'new') {
			setMessages([]);
		}
	}, [status, setMessages]);

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
					isGenerating={isStreaming}
					isHydratingThread={isHydrating}
					isNewChat={isNewChat}
					welcomeLabel={welcomeText}
          isUserLoading={isMeLoading}
					setExtraReason={setExtraReason}
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
