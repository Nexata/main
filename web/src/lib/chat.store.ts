import { create } from 'zustand';

export type OptimisticThread = {
  id: string;
  title: string;
  isTyping: boolean;
};

export type ChatSessionStatus =
  | 'idle'        // chat listo, sin streaming
  | 'new'         // chat nuevo, sin threadId todavía
  | 'hydrating'  // cargando mensajes existentes
  | 'streaming'; // AI escribiendo

type ChatUIState = {
  activeThreadId: string | null;
  status: ChatSessionStatus;
  optimisticThreads: Record<string, OptimisticThread>;
  setActiveThreadId: (id: string | null) => void;
  upsertOptimisticThread: (thread: OptimisticThread) => void;
  removeOptimisticThread: (threadId: string) => void;
  startNewChat: () => void;
  hydrateChat: (threadId: string) => void;
  setStreaming: (threadId: string) => void;
  finishStreaming: () => void;
};

export const useChatUIStore = create<ChatUIState>((set) => ({
  activeThreadId: null,
  status: 'idle',
  optimisticThreads: {},
  startNewChat: () =>
    set({
      activeThreadId: null,
      status: 'new',
    }),
  hydrateChat: (threadId) =>
    set((s) => ({
      activeThreadId: threadId,
      status: s.status === 'streaming' ? s.status : 'hydrating',
    })),
  setStreaming: (threadId) =>
    set({
      activeThreadId: threadId,
      status: 'streaming',
    }),
  finishStreaming: () =>
    set((s) => ({
      status: s.activeThreadId ? 'idle' : 'new',
    })),
  setActiveThreadId: (id) =>
    set((s) => ({
      activeThreadId: id,
      // status: s.status === 'new' ? 'idle' : s.status,
    })),
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
}));
