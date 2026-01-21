import { apiClient, withAuthRetry } from '@/api';
import { useQuery, useQueryClient } from "@tanstack/react-query";

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
		queryKey: ["me"],
		queryFn: getMe,
		staleTime: Infinity,
	});
}

export function useUpdateMe() {
	const queryClient = useQueryClient();

	return async (data: {
		displayName?: string;
		pfp?: File;
	}) => {
		await withAuthRetry((headers) =>
			apiClient.api.user.me.patch({
				$headers: headers,
				displayName: data.displayName,
				pfp: data.pfp,
			})
		);
		
		await queryClient.invalidateQueries({ queryKey: ["me"] });
	};
}

// UpdateMe
export async function updateMe(data: {
	displayName?: string;
	pfp?: File;
}) {
	return withAuthRetry((headers) =>
		apiClient.api.user.me.patch({
			$headers: headers,
			displayName: data.displayName,
			pfp: data.pfp,
		})
	);
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
    queryKey: ["my-tenant"],
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

