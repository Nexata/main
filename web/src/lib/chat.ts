import {
	useInfiniteQuery,
	useQuery,
	useQueryClient,
} from '@tanstack/react-query';
import { apiClient, withAuthRetry } from '@/api';

// Types
export type PaginationParams = {
	cursor?: string | null;
	limit?: number;
	search?: string;
};

// Read thread by ID (asc)
export async function getThreadById(
	threadId: string,
	params?: { limit?: number; cursor?: string },
) {
	return withAuthRetry((headers) =>
		apiClient.chat.thread[threadId]!.get({
			$headers: headers,
			$query: {
				...(params?.cursor ? { cursor: new Date(params.cursor) } : {}),
				limit: params?.limit ?? 100,
			},
		}),
	);
}

export type ThreadById = Awaited<ReturnType<typeof getThreadById>>;

export function useThreadById(
	threadId: string | null,
	params?: { limit?: number },
	options?: { enabled?: boolean },
) {
	return useQuery<ThreadById>({
		queryKey: ['chat-thread', threadId, params],
		queryFn: () => {
			if (!threadId) throw new Error('threadId is required');
			return getThreadById(threadId, params);
		},
		enabled: !!threadId && (options?.enabled ?? true),
	});
}

// Update thread by ID
export async function updateThreadById(
	threadId: string,
	data: { title: string },
) {
	return withAuthRetry((headers) =>
		apiClient.chat.thread[threadId]!.patch({
			$headers: headers,
			title: data.title,
		}),
	);
}

export function useUpdateThreadById() {
	const queryClient = useQueryClient();

	return async (threadId: string, data: { title: string }) => {
		await updateThreadById(threadId, data);

		await queryClient.invalidateQueries({
			queryKey: ['chat-thread', threadId],
		});
		await queryClient.invalidateQueries({
			queryKey: ['chat-threads'],
		});
	};
}

// Delete thread by ID
export async function deleteThreadById(threadId: string) {
	return withAuthRetry((headers) =>
		apiClient.chat.thread[threadId]!.delete({
			$headers: headers,
		}),
	);
}

export function useDeleteThreadById() {
	const queryClient = useQueryClient();

	return async (threadId: string) => {
		await deleteThreadById(threadId);

		await queryClient.invalidateQueries({
			queryKey: ['chat-threads'],
		});
	};
}

// Bulk delete threads by IDs
export function useDeleteThreadsByIds() {
	const queryClient = useQueryClient();

	return async (threadIds: string[]) => {
		await Promise.all(threadIds.map((id) => deleteThreadById(id)));

		await queryClient.invalidateQueries({
			queryKey: ['chat-threads'],
		});
	};
}

// List threads (desc)
export async function listThreads(params?: {
	cursor?: string | null;
	limit?: number;
	search?: string;
}) {
	return withAuthRetry((headers) =>
		apiClient.chat.thread.get({
			$headers: headers,
			$query: {
				...(params?.cursor ? { cursor: new Date(params.cursor) } : {}),
				limit: params?.limit ?? 30,
				...(params?.search ? { search: params.search } : {}),
			},
		}),
	);
}

export type Threads = Awaited<ReturnType<typeof listThreads>>;

export function useThreads(params?: { limit?: number; search?: string }) {
	return useQuery<Threads>({
		queryKey: ['chat-threads', params],
		queryFn: () => listThreads(params),
	});
}

const THREADS_PAGE_SIZE = 30;

export function useInfiniteThreads(params?: { search?: string }) {
	return useInfiniteQuery({
		queryKey: ['chat-threads', { search: params?.search }],
		queryFn: ({ pageParam }) =>
			listThreads({
				search: params?.search,
				limit: THREADS_PAGE_SIZE,
				cursor: pageParam,
			}),
		initialPageParam: null as string | null,
		getNextPageParam: (lastPage) => {
			if (!lastPage || lastPage.length < THREADS_PAGE_SIZE) return undefined;
			const lastItem = lastPage[lastPage.length - 1];
			if (!lastItem?.createdAt) return undefined;
			return typeof lastItem.createdAt === 'string'
				? lastItem.createdAt
				: (lastItem.createdAt as Date).toISOString();
		},
	});
}

// Chat with LLM
export type ChatWithLLMInput = {
	prompt: string;
	extraReason?: boolean;
	threadId?: string;
	editedMessageId?: string;
	languagePreference?: string;
	files?: File[] | null;
};

export async function chatWithLLM(data: ChatWithLLMInput) {
	return withAuthRetry((headers) =>
		apiClient.chat.post({
			$headers: headers,
			...data,
		}),
	);
}

export type ChatWithLLMResponse = Awaited<ReturnType<typeof chatWithLLM>>;

export function useChatWithLLM() {
	const queryClient = useQueryClient();

	return async (data: ChatWithLLMInput) => {
		const res = await chatWithLLM(data);

		if (data.threadId) {
			await queryClient.invalidateQueries({
				queryKey: ['chat-thread', data.threadId],
			});
		}

		await queryClient.invalidateQueries({
			queryKey: ['chat-threads'],
		});

		return res;
	};
}

// Branch off message by ID
export async function branchOffMessage(messageId: string) {
	return withAuthRetry((headers) =>
		apiClient.chat['branch-off'][messageId]!.put({
			$headers: headers,
		}),
	);
}

export type BranchOffResponse = Awaited<ReturnType<typeof branchOffMessage>>;

export function useBranchOffMessage() {
	const queryClient = useQueryClient();

	return async (messageId: string) => {
		const res = await branchOffMessage(messageId);

		await queryClient.invalidateQueries({
			queryKey: ['chat-threads'],
		});

		return res;
	};
}
