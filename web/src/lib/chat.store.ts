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
	setActiveThreadId: (id: string | null) => void;
	upsertOptimisticThread: (thread: OptimisticThread) => void;
	removeOptimisticThread: (threadId: string) => void;
	startNewChat: () => void;
	hydrateChat: (threadId: string) => void;
	addStreamingThread: (threadId: string) => void;
	removeStreamingThread: (threadId: string) => void;
	addUnreadThread: (threadId: string) => void;
	removeUnreadThread: (threadId: string) => void;
};

export const useChatUIStore = create<ChatUIState>()(
	persist(
		(set) => ({
			activeThreadId: null,
			viewStatus: 'idle',
			streamingThreadIds: new Set<string>(),
			unreadThreadIds: new Set<string>(),
			optimisticThreads: {},
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
		}),
		{
			name: 'chat-ui-store',
			partialize: (state) => ({
				activeThreadId: state.activeThreadId,
			}),
		},
	),
);
