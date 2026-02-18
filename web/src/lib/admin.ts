import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, withAuthRetry } from '@/api';

// Messages Consumption
export async function getBillingMessages() {
	return await withAuthRetry((headers) =>
		apiClient.admin.billing.messages.get({
			$headers: headers,
		}),
	);
}

export type BillingMessages = Awaited<ReturnType<typeof getBillingMessages>>;

export function useBillingMessages() {
	return useQuery<BillingMessages>({
		queryKey: ['admin', 'billing', 'messages'],
		queryFn: getBillingMessages,
		staleTime: 60_000,
	});
}

// Consumptions
export async function getBillingUsage() {
	return await withAuthRetry((headers) =>
		apiClient.admin.billing.usage.get({
			$headers: headers,
		}),
	);
}

export type BillingUsage = Awaited<ReturnType<typeof getBillingUsage>>;

export function useBillingUsage() {
	return useQuery<BillingUsage>({
		queryKey: ['admin', 'billing', 'usage'],
		queryFn: getBillingUsage,
		staleTime: 60_000,
	});
}

// List Users
export async function getUsers() {
	return await withAuthRetry((headers) =>
		apiClient.user.get({
			$headers: headers,
		}),
	);
}

export type Users = Awaited<ReturnType<typeof getUsers>>;

export function useUsers() {
	return useQuery<Users>({
		queryKey: ['admin', 'users'],
		queryFn: getUsers,
		staleTime: 180_000,
	});
}

// CreateUser

export type CreateUserInput = {
	email: string;
	displayName?: string;
	apiKey?: string;
	pfp?: File;
	isAdmin?: boolean;
};

export async function createUser(data: CreateUserInput) {
	return await withAuthRetry((headers) =>
		apiClient.admin.user.post({
			$headers: headers,
			...data,
		}),
	);
}

export function useCreateUser() {
	const queryClient = useQueryClient();

	return async (data: CreateUserInput) => {
		const res = await createUser(data);
		await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
		return res;
	};
}

// Edit User
export type EditUserInput = Partial<{
	displayName: string;
	apiKey: string;
	pfp: File;
	isAdmin: boolean;
}>;

export async function editUser(userId: string, data: EditUserInput) {
	return await withAuthRetry((headers) =>
		apiClient.admin.user[userId]!.patch({
			$headers: headers,
			...data,
		}),
	);
}

export function useEditUser() {
	const queryClient = useQueryClient();

	return async (userId: string, data: EditUserInput) => {
		const res = await editUser(userId, data);
		await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
		return res;
	};
}

// Delete User
export async function deleteUser(userId: string) {
	return await withAuthRetry((headers) =>
		apiClient.admin.user[userId]!.delete({
			$headers: headers,
		}),
	);
}

export function useDeleteUser() {
	const queryClient = useQueryClient();

	return async (userId: string) => {
		await deleteUser(userId);
		await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
	};
}

// Edit Tenant
export type EditTenantInput = Partial<{
	displayName: string;
	logo: File;
}>;

export async function editTenant(data: EditTenantInput) {
	return await withAuthRetry((headers) =>
		apiClient.admin.tenant.patch({
			$headers: headers,
			...data,
		}),
	);
}

export function useEditTenant() {
	const queryClient = useQueryClient();

	return async (data: EditTenantInput) => {
		const res = await editTenant(data);
		await queryClient.invalidateQueries({ queryKey: ['my-tenant'] });

		return res;
	};
}

// ---------- Admin Trace ----------

export type TraceType =
  Parameters<
    typeof apiClient.admin.trace.get
  >[0]['$query']['type'] extends
    | (infer T)[]
    | null
    | undefined
    ? T
    : never;

export type AdminTraceParams = {
  type?: TraceType[] | null;
  userId?: string[] | null;
  from?: Date | null;
  to?: Date | null;
  cursor?: Date | null;
  limit?: number;
};

export async function getAdminTrace(
  params: AdminTraceParams = {}
) {
  return await withAuthRetry(headers => {
    const query: Parameters<typeof apiClient.admin.trace.get>[0]['$query'] = {limit: params.limit ?? 100,};

    if (params.type?.length) query.type = params.type;
    if (params.userId?.length) query.userId = params.userId;
    if (params.from) query.from = params.from;
    if (params.to) query.to = params.to;
    if (params.cursor) query.cursor = params.cursor;

    return apiClient.admin.trace.get({
      $headers: headers,
      $query: query,
    });
  });
}

export type AdminTrace = Awaited<ReturnType<typeof getAdminTrace>>;

export function useAdminTrace(
  params: AdminTraceParams = {}
) {
  return useQuery<AdminTrace>({
    queryKey: ['admin', 'trace', params],
    queryFn: () => getAdminTrace(params),
    staleTime: 60_000,
  });
}

// ---------- Admin Trace Count ----------

export type AdminTraceCountParams = AdminTraceParams;

export async function getAdminTraceCount(
  params: AdminTraceCountParams = {}
) {
  return await withAuthRetry(headers => {
    const query: Parameters<typeof apiClient.admin.trace.count.get>[0]['$query'] = {limit: params.limit ?? 100};

    if (params.type?.length) query.type = params.type;
    if (params.userId?.length) query.userId = params.userId;
    if (params.from) query.from = params.from;
    if (params.to) query.to = params.to;
    if (params.cursor) query.cursor = params.cursor;

    return apiClient.admin.trace.count.get({
      $headers: headers,
      $query: query,
    });
  });
}

export type AdminTraceCount = Awaited<ReturnType<typeof getAdminTraceCount>>;

export function useAdminTraceCount(
  params: AdminTraceCountParams = {}
) {
  return useQuery<AdminTraceCount>({
    queryKey: ['admin', 'trace', 'count', params],
    queryFn: () => getAdminTraceCount(params),
    staleTime: 60_000,
  });
}
