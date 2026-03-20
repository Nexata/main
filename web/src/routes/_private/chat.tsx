'use client';

import { type UIMessage, useChat } from '@ai-sdk/react';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import EditConfirmModal from '@/components/chat-edit/edit-confirm.modal';
import { infoToast } from '@/components/info-toast/info-toast';
import { Chat } from '@/components/ui/chat';
import { useRandomWelcome } from '@/hooks/use-random-welcome';
import { useBranchOffMessage, useThreadById } from '@/lib/chat';
import { useChatUIStore } from '@/lib/chat.store';
import { getChatInstance, getChatPool, NEW_CHAT_KEY } from '@/lib/chat-pool';
import { useToolDetailStore } from '@/lib/tool-detail.store';
import { useMe } from '@/lib/user';
import {
	'chat.branch_off.error' as chat_branch_off_error,
	'chat.branch_off.loading' as chat_branch_off_loading,
	'chat.branch_off.success' as chat_branch_off_success,
	'chat.meta.error' as chat_meta_error,
	'chat.meta.title' as chat_meta_title,
} from '@/paraglide/messages.js';

export const Route = createFileRoute('/_private/chat')({
	validateSearch: (search: Record<string, unknown>) => ({
		id: typeof search.id === 'string' ? search.id : undefined,
	}),
	component: NexataChat,
});

// ----------------------------
// Stable helpers (outside component)
// ----------------------------

type UIParts = UIMessage['parts'];

function normalizeParts(
	content: unknown,
	toolOutputMap?: Map<string, unknown>,
): UIParts {
	if (!content) return [];
	if (typeof content === 'string') return [{ type: 'text', text: content }];
	if (!Array.isArray(content)) return [];

	const convertedToolCallIds = new Set<string>();

	return content
		.map((part: any) => {
			if (part.type === 'tool-call' && part.toolName) {
				convertedToolCallIds.add(part.toolCallId);
				const output =
					part.output ?? toolOutputMap?.get(part.toolCallId) ?? null;
				return {
					type: `tool-${part.toolName}`,
					toolCallId: part.toolCallId,
					state: output != null ? 'output-available' : 'input-available',
					input: part.input ?? {},
					output,
				};
			}
			// Skip dynamic-tool parts that were already converted from tool-call
			if (
				part.type === 'dynamic-tool' &&
				part.toolCallId &&
				convertedToolCallIds.has(part.toolCallId)
			) {
				return null;
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
		})
		.filter(Boolean) as UIParts;
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
		addUnreadThread,
	} = useChatUIStore();

	const isNewChat = viewStatus === 'new' || (!activeThreadId && viewStatus === 'idle');
	const hydrateChat = useChatUIStore((s) => s.hydrateChat);

	// ----------------------------
	// URL search param sync
	// ----------------------------

	const { id: searchThreadId } = Route.useSearch();

	useEffect(() => {
		if (searchThreadId && searchThreadId !== activeThreadId) {
			hydrateChat(searchThreadId);
		}
	}, [searchThreadId]);

	const navigate = Route.useNavigate();

	useEffect(() => {
		navigate({
			search: (prev) => ({
				...prev,
				id: activeThreadId ?? undefined,
			}),
			replace: true,
		});
	}, [activeThreadId, navigate]);

	// ----------------------------
	// Thread data (React Query es la fuente de verdad del loading)
	// ----------------------------

	const { data: threadMessages, isLoading: isThreadLoading } = useThreadById(
		activeThreadId ?? null,
	);

	const hydratedMessages = useMemo<UIMessage[]>(() => {
		if (!threadMessages) return [];

		// Build a map of toolCallId → output from "tool" role messages
		const toolOutputMap = new Map<string, unknown>();
		for (const m of threadMessages) {
			if (m.role !== 'tool' || !Array.isArray(m.content)) continue;
			for (const part of m.content as any[]) {
				if (part.type === 'tool-result' && part.toolCallId) {
					toolOutputMap.set(
						part.toolCallId,
						part.result ?? part.output ?? null,
					);
				}
			}
		}

		return threadMessages
			.filter((m) => m.role === 'user' || m.role === 'assistant')
			.map((m) => ({
				id: m.id,
				role: m.role,
				createdAt: m.createdAt,
				metadata: { hydrated: true },
				parts: normalizeParts(m.content, toolOutputMap),
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
	// After a NexataAskQuestions answer stream the SDK replaces the QA assistant
	// message in-place with a combined [text + QA(output-available) + answer] message.
	// Once the stream is done we reset the hydration guard so the next React Query
	// refetch can split it back into the two separate DB messages.
	// ----------------------------

	useEffect(() => {
		if (chatStatus !== 'ready' || !activeThreadId) return;

		const lastMsg = messages.at(-1);
		if (lastMsg?.role !== 'assistant') return;

		// Detect the combined QA+answer pattern: QA tool part followed by a text part
		let foundQA = false;
		let hasTextAfterQA = false;
		for (const p of lastMsg.parts ?? []) {
			const typedPart = p as { type: string; toolName?: string; state?: string };
			if (
				!foundQA &&
				(typedPart.type === 'tool-NexataAskQuestions' ||
					(typedPart.type === 'dynamic-tool' &&
						typedPart.toolName === 'NexataAskQuestions')) &&
				typedPart.state === 'output-available'
			) {
				foundQA = true;
			} else if (foundQA && typedPart.type === 'text') {
				hasTextAfterQA = true;
				break;
			}
		}

		if (hasTextAfterQA) {
			// Allow the hydration effect to re-run and load the proper two-message
			// state from the DB (QA message + separate answer message).
			appliedThreadRef.current = null;
		}
	}, [chatStatus, activeThreadId, messages]);

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
			if (currentStatus === 'ready') {
				removeStreamingThread(threadId);
				addUnreadThread(threadId);
				continue;
			}
			if (currentStatus === 'error') {
				removeStreamingThread(threadId);
				continue;
			}

			// Subscribe for future changes
			const unsub = instance['~registerStatusCallback'](() => {
				const s = instance.status;
				if (s === 'ready') {
					removeStreamingThread(threadId);
					addUnreadThread(threadId);
				} else if (s === 'error') {
					removeStreamingThread(threadId);
				}
			});
			unsubscribes.push(unsub);
		}

		return () => {
			unsubscribes.forEach((fn) => fn());
		};
	}, [
		streamingThreadIds,
		activeThreadId,
		removeStreamingThread,
		addUnreadThread,
	]);

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
			{ text, files: files?.length ? files : undefined },
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
	// Close tool detail panel on thread switch
	// ----------------------------

	const closeToolDetail = useToolDetailStore((s) => s.close);

	useEffect(() => {
		closeToolDetail();
	}, [activeThreadId, closeToolDetail]);

	// ----------------------------
	// Edit message
	// ----------------------------

	// ----------------------------
	// Global Enter key → send message
	// ----------------------------

	const handleSubmitRef = useRef(handleSubmit);
	handleSubmitRef.current = handleSubmit;
	const inputRef = useRef(input);
	inputRef.current = input;

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey) return;
			const tag = (document.activeElement?.tagName ?? '').toLowerCase();
			if (['textarea', 'input', 'select', 'button', 'a'].includes(tag)) return;
			if ((document.activeElement as HTMLElement)?.isContentEditable) return;
			if (inputRef.current.trim().length === 0) return;
			e.preventDefault();
			handleSubmitRef.current();
		};
		document.addEventListener('keydown', onKeyDown);
		return () => document.removeEventListener('keydown', onKeyDown);
	}, []);

	const cancelEditing = useChatUIStore((s) => s.cancelEditing);
	const [editPending, setEditPending] = useState<{
		messageId: string;
		newText: string;
	} | null>(null);

	const handleEditMessage = useCallback(
		(messageId: string, newText: string) => {
			setEditPending({ messageId, newText });
		},
		[],
	);

	const handleEditConfirm = useCallback(async () => {
		if (!editPending) return;
		const { messageId, newText } = editPending;
		setEditPending(null);
		cancelEditing();

		addStreamingThread(activeThreadId ?? NEW_CHAT_KEY);

		await sendMessage(
			{ text: newText, files: undefined, messageId },
			{
				body: {
					threadId: activeThreadId ?? null,
					editedMessageId: messageId,
					languagePreference: me?.language ?? null,
					extraReason: false,
				},
			},
		);
	}, [
		editPending,
		cancelEditing,
		addStreamingThread,
		activeThreadId,
		sendMessage,
		me?.language,
	]);

	const handleEditCancel = useCallback(() => {
		setEditPending(null);
		cancelEditing();
	}, [cancelEditing]);

	// ----------------------------
	// Retry message
	// ----------------------------

	const handleRetry = useCallback(
		async (messageId: string) => {
			const msg = messages.find((m) => m.id === messageId);
			if (!msg) return;
			const text = msg.parts
				.filter((p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text')
				.map((p) => p.text)
				.join('');
			if (!text.trim()) return;

			addStreamingThread(activeThreadId ?? NEW_CHAT_KEY);

			await sendMessage(
				{ text, files: undefined, messageId },
				{
					body: {
						threadId: activeThreadId ?? null,
						editedMessageId: messageId,
						languagePreference: me?.language ?? null,
						extraReason: false,
					},
				},
			);
		},
		[messages, addStreamingThread, activeThreadId, sendMessage, me?.language],
	);

	// ----------------------------
	// Branch off
	// ----------------------------

	const branchOff = useBranchOffMessage();

	const handleBranchOff = useCallback(
		async (messageId: string) => {
			const toastId = infoToast.loading({
				title: chat_branch_off_loading(),
			});
			try {
				const result = await branchOff(messageId);
				infoToast.success(toastId, {
					title: chat_branch_off_success(),
				});
				if (result && typeof result === 'object' && 'threadId' in result) {
					hydrateChat(result.threadId as string);
				}
			} catch {
				infoToast.error(toastId, {
					title: chat_branch_off_error(),
				});
			}
		},
		[branchOff, hydrateChat],
	);

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
					onEditMessage={handleEditMessage}
					onBranchOff={handleBranchOff}				onRetry={handleRetry}				/>
			</div>

			<EditConfirmModal
				open={!!editPending}
				onCancel={handleEditCancel}
				onConfirm={handleEditConfirm}
			/>
		</div>
	);
}
