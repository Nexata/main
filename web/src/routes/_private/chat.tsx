'use client';

import { type UIMessage, useChat } from '@ai-sdk/react';
import { createFileRoute } from '@tanstack/react-router';
import { decode } from '@toon-format/toon';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { infoToast } from '@/components/info-toast/info-toast';
import { Chat } from '@/components/ui/chat';
import { useRandomWelcome } from '@/hooks/use-random-welcome';
import {
	getThreadById,
	type ThreadById,
	useBranchOffMessage,
	useThreadById,
} from '@/lib/chat';
import { useChatUIStore } from '@/lib/chat.store';
import { getChatInstance, getChatPool, NEW_CHAT_KEY } from '@/lib/chat-pool';
import { extractErrorText } from '@/lib/error';
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
	head: () => ({
		meta: [
			{ title: chat_meta_title() },
			{ name: 'robots', content: 'noindex' },
		],
	}),
});

// ----------------------------
// Stable helpers (outside component)
// ----------------------------

type UIParts = UIMessage['parts'];

// Tools that require user approval before execution
const APPROVAL_TOOLS = new Set([
	'NexataReingest',
	'GmailIngestAttachments',
	'OutlookIngestAttachments',
	'DriveIngest',
	'DropboxIngest',
	'OneDriveIngest',
]);

function normalizeParts(
	content: unknown,
	toolOutputMap?: Map<string, { output: unknown; isError: boolean }>,
): UIParts {
	if (!content) return [];
	if (typeof content === 'string') return [{ type: 'text', text: content }];
	if (!Array.isArray(content)) return [];

	const convertedToolCallIds = new Set<string>();

	return content
		.map((part: any) => {
			if (part.type === 'tool-call' && part.toolName) {
				convertedToolCallIds.add(part.toolCallId);
				const mapped = toolOutputMap?.get(part.toolCallId);
				const output = part.output ?? mapped?.output ?? null;
				const isError = mapped?.isError ?? false;
				const pendingApproval =
					APPROVAL_TOOLS.has(part.toolName) && output == null && !isError;
				// Mark tool parts whose output came from the server-side
				// toolOutputMap as providerExecuted so the auto-submit
				// predicate never treats hydrated messages as candidates.
				const wasServerExecuted = mapped != null;
				return {
					type: `tool-${part.toolName}`,
					toolCallId: part.toolCallId,
					state: isError
						? 'output-error'
						: output != null
							? 'output-available'
							: pendingApproval
								? 'approval-requested'
								: 'input-available',
					input: part.input ?? {},
					output,
					...(wasServerExecuted ? { providerExecuted: true } : {}),
					...(pendingApproval ? { approval: { id: part.toolCallId } } : {}),
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
			// Filter out AI SDK internal approval parts — the approval state is
			// already encoded in the corresponding tool-call part.
			if (
				part.type === 'tool-approval-request' ||
				part.type === 'tool-approval-response'
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

const MESSAGES_PAGE_SIZE = 30;

function hydrateThreadMessages(
	threadMessages: ThreadById['messages'],
): UIMessage[] {
	if (!threadMessages?.length) return [];

	// Build a map of toolCallId → { output, isError } from "tool" role messages
	const toolOutputMap = new Map<
		string,
		{ output: unknown; isError: boolean }
	>();
	for (const m of threadMessages) {
		if (m.role !== 'tool' || !Array.isArray(m.content)) continue;
		for (const part of m.content as any[]) {
			if (part.type === 'tool-result' && part.toolCallId) {
				const rawOutput = part.result ?? part.output ?? null;
				const isWrapped =
					rawOutput &&
					typeof rawOutput === 'object' &&
					'type' in rawOutput &&
					'value' in rawOutput;
				const isError =
					!!part.isError || (isWrapped && rawOutput.type === 'error-text');
				const unwrapped = isWrapped ? rawOutput.value : rawOutput;
				const output =
					typeof unwrapped === 'string'
						? (() => {
								try {
									return decode(unwrapped);
								} catch {
									return unwrapped;
								}
							})()
						: unwrapped;
				toolOutputMap.set(part.toolCallId, { output, isError });
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
			parts: [
				...(m.files ?? [])
					.filter((f) => f.id)
					.map((f) => ({
						type: 'file' as const,
						filename: f.name,
						mediaType: f.type,
						url: f.url,
					})),
				...normalizeParts(m.content, toolOutputMap),
			],
		}));
}

export function NexataChat() {
	// ----------------------------
	// Store
	// ----------------------------

	const {
		activeThreadId,
		viewStatus,
		streamingThreadIds,
		unsyncedThreadIds,
		addStreamingThread,
		removeStreamingThread,
		addUnreadThread,
		markThreadUnsynced,
		markThreadSynced,
	} = useChatUIStore();

	const isNewChat =
		viewStatus === 'new' || (!activeThreadId && viewStatus === 'idle');
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

	const isActiveThreadStreaming = activeThreadId
		? streamingThreadIds.has(activeThreadId)
		: false;

	// Threads created in this session already have messages from the stream —
	// skip the initial fetch entirely to avoid a flash of loading state.
	const justCreatedThreadsRef = useRef<Set<string>>(new Set());
	const isJustCreated = activeThreadId
		? justCreatedThreadsRef.current.has(activeThreadId)
		: false;

	const { data: threadData, isLoading: isThreadLoading } = useThreadById(
		activeThreadId ?? null,
		{ limit: MESSAGES_PAGE_SIZE },
		{ enabled: !isActiveThreadStreaming && !isJustCreated },
	);

	const threadMessages = threadData?.messages;
	const isOwner = threadData?.isOwner ?? true;
	const isReadOnly = !!activeThreadId && !isOwner;

	const hydratedMessages = useMemo<UIMessage[]>(
		() => hydrateThreadMessages(threadMessages ?? []),
		[threadMessages],
	);

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
		addToolApprovalResponse,
	} = useChat({
		chat,
	});

	// ----------------------------
	// Thread hydration
	// ----------------------------

	const appliedThreadRef = useRef<string | null>(null);

	useEffect(() => {
		appliedThreadRef.current = null;
		// If activeThreadId was just set while the thread is streaming
		// (promoted from __new__), mark it as just-created so we skip
		// both the fetch and the hydration — the AI SDK already has the messages.
		if (activeThreadId && streamingThreadIds.has(activeThreadId)) {
			justCreatedThreadsRef.current.add(activeThreadId);
		}
	}, [activeThreadId]);

	useEffect(() => {
		if (!activeThreadId) return;
		if (threadMessages === undefined) return;
		if (appliedThreadRef.current === activeThreadId) return;

		// Don't overwrite if this thread is currently streaming (has live messages)
		const threadKey = activeThreadId;
		if (streamingThreadIds.has(threadKey)) return;

		// Skip initial hydration for a thread that was just created in this session.
		// The AI SDK already holds the correct messages from the stream.
		if (justCreatedThreadsRef.current.has(activeThreadId)) {
			justCreatedThreadsRef.current.delete(activeThreadId);
			appliedThreadRef.current = activeThreadId;
			return;
		}

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
	// Older messages pagination (scroll up to load)
	// ----------------------------

	const [isFetchingOlder, setIsFetchingOlder] = useState(false);
	const [hasOlderMessages, setHasOlderMessages] = useState(true);

	// Reset pagination state when thread changes
	useEffect(() => {
		setHasOlderMessages(true);
		setIsFetchingOlder(false);
	}, [activeThreadId]);

	// After initial hydration, check if there could be more messages
	useEffect(() => {
		if (!threadMessages) return;
		if (threadMessages.length < MESSAGES_PAGE_SIZE) {
			setHasOlderMessages(false);
		}
	}, [threadMessages]);

	const loadOlderMessages = useCallback(async () => {
		if (!activeThreadId || isFetchingOlder || !hasOlderMessages) return;

		// Find the oldest hydrated message's createdAt
		const oldestMessage = messages.find(
			(m) =>
				(m as any).createdAt &&
				(m.metadata as { hydrated?: boolean })?.hydrated,
		);
		const oldestCreatedAt = (oldestMessage as any)?.createdAt as
			| Date
			| string
			| undefined;
		if (!oldestCreatedAt) return;

		const cursor =
			typeof oldestCreatedAt === 'string'
				? oldestCreatedAt
				: oldestCreatedAt.toISOString();

		setIsFetchingOlder(true);
		try {
			const olderData = await getThreadById(activeThreadId, {
				limit: MESSAGES_PAGE_SIZE,
				cursor,
			});

			const olderHydrated = hydrateThreadMessages(olderData.messages);

			if (olderHydrated.length === 0) {
				setHasOlderMessages(false);
				return;
			}

			if (olderData.messages.length < MESSAGES_PAGE_SIZE) {
				setHasOlderMessages(false);
			}

			// Deduplicate: exclude any messages already in the current set
			const existingIds = new Set(messages.map((m) => m.id));
			const newMessages = olderHydrated.filter((m) => !existingIds.has(m.id));

			if (newMessages.length > 0) {
				setMessages((prev) => [...newMessages, ...prev]);
			}
		} catch (error) {
			console.error('Failed to load older messages', error);
		} finally {
			setIsFetchingOlder(false);
		}
	}, [
		activeThreadId,
		isFetchingOlder,
		hasOlderMessages,
		messages,
		setMessages,
	]);

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
			const typedPart = p as {
				type: string;
				toolName?: string;
				state?: string;
			};
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
		if (chatStatus === 'submitted') {
			// Mark unsynced only at the START of a new request (status 'submitted').
			// Doing it for 'streaming' as well caused a race: the effect for
			// 'streaming' could fire AFTER the onData(data-synced) callback,
			// undoing the sync when React batched renders.
			addStreamingThread(threadKey);
			markThreadUnsynced(threadKey);
		}
		if (chatStatus === 'streaming') {
			addStreamingThread(threadKey);
		}
		if (chatStatus === 'error') {
			removeStreamingThread(threadKey);
			return;
		}
		if (chatStatus === 'ready') {
			// Fallback: ensure the thread is synced when the stream completes.
			// Normally data-synced in onData handles this, but edge cases
			// (blocked auto-submits returning empty streams, React batching
			// racing with onData) can leave the thread stuck as unsynced.
			markThreadSynced(threadKey);
			const timeout = setTimeout(() => {
				removeStreamingThread(threadKey);
			}, 300);
			return () => clearTimeout(timeout);
		}
	}, [
		chatStatus,
		activeThreadId,
		addStreamingThread,
		removeStreamingThread,
		markThreadUnsynced,
		markThreadSynced,
	]);

	// ----------------------------
	// Patch mock user message ID with real server-assigned ID
	// ----------------------------

	const lastUserMessageId = useChatUIStore((s) => s.lastUserMessageId);
	const setLastUserMessageId = useChatUIStore((s) => s.setLastUserMessageId);

	useEffect(() => {
		if (!lastUserMessageId) return;

		const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
		if (!lastUserMsg || lastUserMsg.id === lastUserMessageId) {
			setLastUserMessageId(null);
			return;
		}

		setMessages(
			messages.map((m) =>
				m.id === lastUserMsg.id ? { ...m, id: lastUserMessageId } : m,
			),
		);
		setLastUserMessageId(null);
	}, [lastUserMessageId, messages, setMessages, setLastUserMessageId]);

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
	const isSyncing = unsyncedThreadIds.has(activeThreadId ?? NEW_CHAT_KEY);

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
		const errorText = extractErrorText(error) ?? chat_meta_error();
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
	const isReadOnlyRef = useRef(isReadOnly);
	isReadOnlyRef.current = isReadOnly;

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (isReadOnlyRef.current) return;
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

	const handleEditMessage = useCallback(
		async (messageId: string, newText: string) => {
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
		},
		[
			cancelEditing,
			addStreamingThread,
			activeThreadId,
			sendMessage,
			me?.language,
		],
	);

	// ----------------------------
	// Retry message
	// ----------------------------

	const handleRetry = useCallback(
		async (messageId: string) => {
			const msg = messages.find((m) => m.id === messageId);
			if (!msg) return;
			const text = msg.parts
				.filter(
					(p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text',
				)
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
			} catch (error) {
				infoToast.error(toastId, {
					title: chat_branch_off_error(),
					description: extractErrorText(error),
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
					addToolOutput={isReadOnly ? undefined : addToolOutput}
					addToolApprovalResponse={
						isReadOnly ? undefined : addToolApprovalResponse
					}
					onEditMessage={isReadOnly ? undefined : handleEditMessage}
					onBranchOff={handleBranchOff}
					onRetry={isReadOnly ? undefined : handleRetry}
					isReadOnly={isReadOnly}
					isSyncing={isSyncing}
					onLoadOlderMessages={loadOlderMessages}
					isFetchingOlderMessages={isFetchingOlder}
					hasOlderMessages={hasOlderMessages}
				/>
			</div>
		</div>
	);
}
