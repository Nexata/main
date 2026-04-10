import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type OptimisticThread = {
	id: string;
	title: string;
	isTyping: boolean;
};

export type ChatViewStatus = 'idle' | 'new';

type ChatUIState = {
	activeThreadId: string | null;
	viewStatus: ChatViewStatus;
	streamingThreadIds: Set<string>;
	unreadThreadIds: Set<string>;
	optimisticThreads: Record<string, OptimisticThread>;
	unsyncedThreadIds: Set<string>;
	editingMessageId: string | null;
	editingMessageText: string;
	lastUserMessageId: string | null;
	extraReasonMessageIds: Set<string>;
	setActiveThreadId: (id: string | null) => void;
	upsertOptimisticThread: (thread: OptimisticThread) => void;
	removeOptimisticThread: (threadId: string) => void;
	startNewChat: () => void;
	hydrateChat: (threadId: string) => void;
	addStreamingThread: (threadId: string) => void;
	removeStreamingThread: (threadId: string) => void;
	addUnreadThread: (threadId: string) => void;
	removeUnreadThread: (threadId: string) => void;
	markThreadUnsynced: (threadId: string) => void;
	markThreadSynced: (threadId: string) => void;
	startEditing: (messageId: string, text: string) => void;
	cancelEditing: () => void;
	setLastUserMessageId: (id: string | null) => void;
	addExtraReasonMessageId: (id: string) => void;
};

export const useChatUIStore = create<ChatUIState>()(
	persist(
		(set) => ({
			activeThreadId: null,
			viewStatus: 'idle',
			streamingThreadIds: new Set<string>(),
			unreadThreadIds: new Set<string>(),
			unsyncedThreadIds: new Set<string>(),
			optimisticThreads: {},
			editingMessageId: null,
			editingMessageText: '',
			lastUserMessageId: null,
			extraReasonMessageIds: new Set<string>(),
			startNewChat: () => set({ activeThreadId: null, viewStatus: 'new' }),
			hydrateChat: (threadId) =>
				set((state) => {
					const nextUnread = new Set(state.unreadThreadIds);
					nextUnread.delete(threadId);
					return {
						activeThreadId: threadId,
						viewStatus: 'idle',
						unreadThreadIds: nextUnread,
					};
				}),
			addStreamingThread: (threadId) =>
				set((state) => {
					if (state.streamingThreadIds.has(threadId)) return state;
					const next = new Set(state.streamingThreadIds);
					next.add(threadId);
					return { streamingThreadIds: next };
				}),
			removeStreamingThread: (threadId) =>
				set((state) => {
					if (!state.streamingThreadIds.has(threadId)) return state;
					const next = new Set(state.streamingThreadIds);
					next.delete(threadId);
					return { streamingThreadIds: next };
				}),
			addUnreadThread: (threadId) =>
				set((state) => {
					if (state.unreadThreadIds.has(threadId)) return state;
					const next = new Set(state.unreadThreadIds);
					next.add(threadId);
					return { unreadThreadIds: next };
				}),
			removeUnreadThread: (threadId) =>
				set((state) => {
					if (!state.unreadThreadIds.has(threadId)) return state;
					const next = new Set(state.unreadThreadIds);
					next.delete(threadId);
					return { unreadThreadIds: next };
				}),
			markThreadUnsynced: (threadId) =>
				set((state) => {
					if (state.unsyncedThreadIds.has(threadId)) return state;
					const next = new Set(state.unsyncedThreadIds);
					next.add(threadId);
					return { unsyncedThreadIds: next };
				}),
			markThreadSynced: (threadId) =>
				set((state) => {
					if (!state.unsyncedThreadIds.has(threadId)) return state;
					const next = new Set(state.unsyncedThreadIds);
					next.delete(threadId);
					return { unsyncedThreadIds: next };
				}),
			setActiveThreadId: (id) => set({ activeThreadId: id }),
			upsertOptimisticThread: (thread) =>
				set((state) => ({
					optimisticThreads: {
						...state.optimisticThreads,
						[thread.id]: thread,
					},
				})),
			removeOptimisticThread: (threadId) =>
				set((state) => {
					const next = { ...state.optimisticThreads };
					delete next[threadId];
					return { optimisticThreads: next };
				}),
			startEditing: (messageId, text) =>
				set({ editingMessageId: messageId, editingMessageText: text }),
			cancelEditing: () =>
				set({ editingMessageId: null, editingMessageText: '' }),
			setLastUserMessageId: (id) => set({ lastUserMessageId: id }),
			addExtraReasonMessageId: (id) =>
				set((state) => {
					const next = new Set(state.extraReasonMessageIds);
					next.add(id);
					return { extraReasonMessageIds: next };
				}),
		}),
		{
			name: 'chat-ui-store',
			partialize: (state) => ({
				activeThreadId: state.activeThreadId,
			}),
		},
	),
);
