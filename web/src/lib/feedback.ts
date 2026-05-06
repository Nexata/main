import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, withAuthRetry } from '@/api';

type FeedbackQuery = Parameters<typeof apiClient.feedback.get>[0]['$query'];
export type FeedbackType = NonNullable<NonNullable<FeedbackQuery>['type']>;
export type FeedbackStatus = NonNullable<NonNullable<FeedbackQuery>['status']>;
export const FEEDBACK_STATUS_OPTIONS = [
	'pending' as FeedbackStatus,
	'in_review' as FeedbackStatus,
	'wontfix' as FeedbackStatus,
	'solved' as FeedbackStatus,
] as const satisfies readonly FeedbackStatus[];

// ListFeedback
export async function listFeedback(params?: {
	status?: FeedbackStatus;
	type?: FeedbackType;
	cursor?: string;
}) {
	return withAuthRetry((headers) => {
		const query: Record<string, unknown> = {};

		if (params?.status !== undefined) query.status = params.status;
		if (params?.type !== undefined) query.type = params.type;
		if (params?.cursor !== undefined) query.cursor = params.cursor;

		return apiClient.feedback.get({
			$headers: headers,
			$query: query,
		});
	});
}

export type FeedbackList = Awaited<ReturnType<typeof listFeedback>>;

export function useListFeedback(params?: Parameters<typeof listFeedback>[0]) {
	return useQuery<FeedbackList>({
		queryKey: ['feedback', params?.status, params?.type, params?.cursor],
		queryFn: () => listFeedback(params),
		staleTime: Infinity,
	});
}

// CreateFeedback
export async function createFeedback(data: {
	type: FeedbackType;
	comment: string;
	files?: File[];
}) {
	return withAuthRetry((headers) =>
		apiClient.feedback.post({
			$headers: headers,
			...data,
		}),
	);
}

export type Feedback = Awaited<ReturnType<typeof createFeedback>>;

export function useCreateFeedback() {
	const queryClient = useQueryClient();

	return async (data: {
		type: FeedbackType;
		comment: string;
		files?: File[];
	}): Promise<Feedback> => {
		const result = await withAuthRetry((headers) =>
			apiClient.feedback.post({
				$headers: headers,
				...data,
			}),
		);

		await queryClient.invalidateQueries({
			queryKey: ['feedback'],
		});

		return result as Feedback;
	};
}

// UpdateFeedback
export async function updateFeedback(
	id: string,
	data: {
		type?: FeedbackType;
		comment?: string;
		files?: File[];
		removeFileUrls?: string[];
	},
) {
	return withAuthRetry((headers) =>
		apiClient.feedback[id]!.patch({
			$headers: headers,
			...data,
		}),
	);
}

export function useUpdateFeedback() {
	const queryClient = useQueryClient();

	return async (
		id: string,
		data: {
			type?: FeedbackType;
			comment?: string;
			files?: File[];
			removeFileUrls?: string[];
		},
	): Promise<void> => {
		await withAuthRetry((headers) =>
			apiClient.feedback[id]!.patch({
				$headers: headers,
				...data,
			}),
		);

		await queryClient.invalidateQueries({
			queryKey: ['feedback'],
		});
	};
}

// DeleteFeedback
export async function deleteFeedback(id: string) {
	return withAuthRetry((headers) =>
		apiClient.feedback[id]!.delete({
			$headers: headers,
		}),
	);
}

export function useDeleteFeedback() {
	const queryClient = useQueryClient();

	return async (id: string): Promise<void> => {
		await withAuthRetry((headers) =>
			apiClient.feedback[id]!.delete({
				$headers: headers,
			}),
		);

		await queryClient.invalidateQueries({
			queryKey: ['feedback'],
		});
	};
}
