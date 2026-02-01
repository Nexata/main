import { useQuery, useQueryClient } from '@tanstack/react-query';
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
	params?: { limit?: number },
) {
	return withAuthRetry((headers) =>
		apiClient.chat.thread[threadId]!.get({
			$headers: headers,
			$query: {
				limit: params?.limit ?? 100,
			},
		}),
	);
}

export type ThreadById = Awaited<ReturnType<typeof getThreadById>>;

export function useThreadById(
	threadId: string | null,
	params?: { limit?: number },
) {
	return useQuery<ThreadById>({
		queryKey: ['chat-thread', threadId, params],
		queryFn: () => {
			if (!threadId) throw new Error('threadId is required');
			return getThreadById(threadId, params);
		},
		enabled: !!threadId,
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

// List threads (desc)
export async function listThreads(params?: {
	limit?: number;
	search?: string;
}) {
	return withAuthRetry((headers) =>
		apiClient.chat.thread.get({
			$headers: headers,
			$query: {
				limit: params?.limit ?? 100,
				search: params?.search ?? '',
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
