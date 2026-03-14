'use client';

import { type UIMessage, useChat } from '@ai-sdk/react';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { infoToast } from '@/components/info-toast/info-toast';
import { Chat } from '@/components/ui/chat';
import { useRandomWelcome } from '@/hooks/use-random-welcome';
import { useThreadById } from '@/lib/chat';
import { useChatUIStore } from '@/lib/chat.store';
import { getChatInstance, getChatPool, NEW_CHAT_KEY } from '@/lib/chat-pool';
import { useMe } from '@/lib/user';
import {
	'chat.meta.error' as chat_meta_error,
	'chat.meta.title' as chat_meta_title,
} from '@/paraglide/messages.js';

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
				mediaType:
					part.mediaType ?? part.mimeType ?? 'application/octet-stream',
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

	const {
		activeThreadId,
		viewStatus,
		streamingThreadIds,
		addStreamingThread,
		removeStreamingThread,
	} = useChatUIStore();

	const isNewChat = viewStatus === 'new';

	// ----------------------------
	// Thread data (React Query es la fuente de verdad del loading)
	// ----------------------------

	const { data: threadMessages, isLoading: isThreadLoading } = useThreadById(
		activeThreadId ?? null,
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
	// Chat Engine (per-thread from pool)
	// ----------------------------

	const chat = useMemo(() => getChatInstance(activeThreadId), [activeThreadId]);

	const {
		messages,
		sendMessage,
		stop,
		error,
		setMessages,
		status: chatStatus,
		addToolOutput,
	} = useChat({
		chat,
	});

	// ----------------------------
	// Thread hydration
	// ----------------------------

	const appliedThreadRef = useRef<string | null>(null);

	useEffect(() => {
		appliedThreadRef.current = null;
	}, [activeThreadId]);

	useEffect(() => {
		if (!activeThreadId) return;
		if (threadMessages === undefined) return;
		if (appliedThreadRef.current === activeThreadId) return;

		// Don't overwrite if this thread is currently streaming (has live messages)
		const threadKey = activeThreadId;
		if (streamingThreadIds.has(threadKey)) return;

		appliedThreadRef.current = activeThreadId;
		setMessages(hydratedMessages);
	}, [
		activeThreadId,
		threadMessages,
		hydratedMessages,
		setMessages,
		streamingThreadIds,
	]);

	useEffect(() => {
		if (isNewChat) setMessages([]);
	}, [isNewChat, setMessages]);

	// ----------------------------
	// Sync active thread's SDK status → store
	// ----------------------------

	useEffect(() => {
		const threadKey = activeThreadId ?? NEW_CHAT_KEY;
		if (chatStatus === 'streaming' || chatStatus === 'submitted') {
			addStreamingThread(threadKey);
		}
		if (chatStatus === 'error') {
			removeStreamingThread(threadKey);
			return;
		}
		if (chatStatus === 'ready') {
			const timeout = setTimeout(() => {
				removeStreamingThread(threadKey);
			}, 300);
			return () => clearTimeout(timeout);
		}
	}, [chatStatus, activeThreadId, addStreamingThread, removeStreamingThread]);

	// ----------------------------
	// Background stream monitor
	// Uses Chat instance's ~registerStatusCallback for non-active threads
	// ----------------------------

	useEffect(() => {
		if (streamingThreadIds.size === 0) return;

		const unsubscribes: (() => void)[] = [];
		const pool = getChatPool();

		for (const threadId of streamingThreadIds) {
			// Active thread is monitored by the useChat hook above
			if (threadId === (activeThreadId ?? NEW_CHAT_KEY)) continue;

			const instance = pool.get(threadId);
			if (!instance) {
				removeStreamingThread(threadId);
				continue;
			}

			// Check immediately
			const currentStatus = instance.status;
			if (currentStatus === 'ready' || currentStatus === 'error') {
				removeStreamingThread(threadId);
				continue;
			}

			// Subscribe for future changes
			const unsub = instance['~registerStatusCallback'](() => {
				const s = instance.status;
				if (s === 'ready' || s === 'error') {
					removeStreamingThread(threadId);
				}
			});
			unsubscribes.push(unsub);
		}

		return () => {
			unsubscribes.forEach((fn) => fn());
		};
	}, [streamingThreadIds, activeThreadId, removeStreamingThread]);

	// ----------------------------
	// UI state derivado
	// ----------------------------

	const isSdkStreaming =
		chatStatus === 'streaming' || chatStatus === 'submitted';
	const isHydrating = !!activeThreadId && isThreadLoading && !isSdkStreaming;

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
		addStreamingThread(activeThreadId ?? NEW_CHAT_KEY);
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
	// Error toast
	// ----------------------------

	useEffect(() => {
		if (!error) return;
		const errorText = (error as any)?.message?.text ?? chat_meta_error();
		infoToast.error(Date.now(), { description: errorText });
	}, [error]);

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
					addToolOutput={addToolOutput}
				/>
			</div>
		</div>
	);
}
