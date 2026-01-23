import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, withAuthRetry } from '@/api';
import { clearTokens } from './auth';
import { clearFingerprint } from './fingerprint';

// GetMe
export async function getMe() {
	return await withAuthRetry((headers) =>
		apiClient.api.user.me.info.get({
			$headers: headers,
		}),
	);
}
export type Me = Awaited<ReturnType<typeof getMe>>;

export function useMe() {
	return useQuery<Me>({
		queryKey: ['me'],
		queryFn: getMe,
		staleTime: Infinity,
	});
}

// UpdateMe
export async function updateMe(data: { displayName?: string; pfp?: File }) {
	return withAuthRetry((headers) => {
		const body: {
			displayName?: string;
			pfp?: File;
		} = {};

		if (data.displayName !== undefined) body.displayName = data.displayName;
		if (data.pfp !== undefined) body.pfp = data.pfp;

		return apiClient.api.user.me.patch({
			$headers: headers,
			...body,
		});
	});
}

export function useUpdateMe() {
	const queryClient = useQueryClient();

	return async (data: { displayName?: string; pfp?: File }) => {
		await withAuthRetry((headers) => {
			const body: {
				displayName?: string;
				pfp?: File;
			} = {};

			if (data.displayName !== undefined) body.displayName = data.displayName;
			if (data.pfp !== undefined) body.pfp = data.pfp;

			return apiClient.api.user.me.patch({
				$headers: headers,
				...body,
			});
		});

		await queryClient.invalidateQueries({ queryKey: ['me'] });
	};
}

// GetMyTenant
export async function getMyTenant() {
	return await withAuthRetry((headers) =>
		apiClient.api.user.me.tenant.get({
			$headers: headers,
		}),
	);
}
export type MyTenant = Awaited<ReturnType<typeof getMyTenant>>[number];

export function useMyTenant() {
	return useQuery<
		Awaited<ReturnType<typeof getMyTenant>>,
		Error,
		MyTenant | null
	>({
		queryKey: ['my-tenant'],
		queryFn: getMyTenant,
		staleTime: Infinity,
		select: (data) => data?.[0] ?? null,
	});
}

export async function getUsers() {
	return await withAuthRetry((headers) =>
		apiClient.api.user.get({
			$headers: headers,
		}),
	);
}
export type Users = Awaited<ReturnType<typeof getUsers>>;

// DeleteMe
export async function deleteMe() {
	return withAuthRetry((headers) =>
		apiClient.api.user.me.delete({
			$headers: headers,
		}),
	);
}

export function useDeleteMe() {
	const queryClient = useQueryClient();

	return async () => {
		await withAuthRetry((headers) =>
			apiClient.api.user.me.delete({
				$headers: headers,
			}),
		);

		clearTokens();
		clearFingerprint();
		localStorage.clear();
		sessionStorage.clear();
		await queryClient.clear();

		window.location.href = '/login';
	};
}

// DeleteMyDevice
export async function deleteMyDevice(fingerprint: string) {
	return withAuthRetry((headers) =>
		apiClient.api.user.me.device[fingerprint]!.delete({
			$headers: headers,
		}),
	);
}

export function useDeleteMyDevice() {
	const queryClient = useQueryClient();

	return async (fingerprint: string) => {
		await withAuthRetry((headers) =>
			apiClient.api.user.me.device[fingerprint]!.delete({
				$headers: headers,
			}),
		);

		await queryClient.invalidateQueries({ queryKey: ['me'] });
	};
}

// Create or Regenerate API Key
export async function createOrRegenerateApiKey() {
	return withAuthRetry((headers) =>
		apiClient.api.user.me['api-key'].put({
			$headers: headers,
		}),
	);
}
export type ApiKey = Awaited<ReturnType<typeof createOrRegenerateApiKey>>;

export function useCreateOrRegenerateApiKey() {
	const queryClient = useQueryClient();

	return async () => {
		const res = (await withAuthRetry((headers) =>
			apiClient.api.user.me['api-key'].put({
				$headers: headers,
			}),
		)) as ApiKey;

		await queryClient.invalidateQueries({ queryKey: ['me'] });
		return res;
	};
}

// Delete API Key
export async function deleteApiKey() {
	return withAuthRetry((headers) =>
		apiClient.api.user.me['api-key'].delete({
			$headers: headers,
		}),
	);
}

export function useDeleteApiKey() {
	const queryClient = useQueryClient();

	return async () => {
		await withAuthRetry((headers) =>
			apiClient.api.user.me['api-key'].delete({
				$headers: headers,
			}),
		);

		await queryClient.invalidateQueries({ queryKey: ['me'] });
	};
}
