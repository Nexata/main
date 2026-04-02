import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, withAuthRetry } from '@/api';

// Consumptions
export async function getBillingUsage() {
	return await withAuthRetry((headers) =>
		apiClient.admin.billing.usage.get({
			$headers: headers,
		}),
	);
}

export type BillingUsage = Awaited<ReturnType<typeof getBillingUsage>>;

export function useBillingUsage(enabled = true) {
	return useQuery<BillingUsage>({
		queryKey: ['admin', 'billing', 'usage'],
		queryFn: getBillingUsage,
		staleTime: 60_000,
		enabled,
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
	sendMail: boolean;
	redirect?: string;
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

export type TraceType = Parameters<
	typeof apiClient.admin.trace.get
>[0]['$query']['type'] extends (infer T)[] | null | undefined
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

export async function getAdminTrace(params: AdminTraceParams = {}) {
	return await withAuthRetry((headers) => {
		const query: Parameters<typeof apiClient.admin.trace.get>[0]['$query'] = {
			limit: params.limit ?? 100,
		};

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

export function useAdminTrace(params: AdminTraceParams = {}) {
	return useQuery<AdminTrace>({
		queryKey: ['admin', 'trace', params],
		queryFn: () => getAdminTrace(params),
		staleTime: 60_000,
	});
}

// ---------- Admin Trace Count ----------

export type AdminTraceCountParams = AdminTraceParams;

export async function getAdminTraceCount(params: AdminTraceCountParams = {}) {
	return await withAuthRetry((headers) => {
		const query: Parameters<
			typeof apiClient.admin.trace.count.get
		>[0]['$query'] = { limit: params.limit ?? 100 };

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

export function useAdminTraceCount(params: AdminTraceCountParams = {}) {
	return useQuery<AdminTraceCount>({
		queryKey: ['admin', 'trace', 'count', params],
		queryFn: () => getAdminTraceCount(params),
		staleTime: 60_000,
	});
}

export type BillingPlan = Parameters<
	typeof apiClient.admin.billing.plan.put
>[0]['plan'];

export async function setBillingPlan(plan: BillingPlan) {
	return await withAuthRetry((headers) =>
		apiClient.admin.billing.plan.put({
			$headers: headers,
			plan,
		}),
	);
}

export function useSetBillingPlan() {
	const queryClient = useQueryClient();

	return async (plan: BillingPlan) => {
		const res = await setBillingPlan(plan);

		await queryClient.invalidateQueries({
			queryKey: ['admin', 'billing'],
		});

		return res;
	};
}

// ---------- Billing Last Bill ----------

export async function getBillingLastBill() {
	return await withAuthRetry((headers) =>
		apiClient.admin.billing['last-bill'].get({
			$headers: headers,
		}),
	);
}

export type BillingLastBill = Awaited<ReturnType<typeof getBillingLastBill>>;

export function useBillingLastBill() {
	return useQuery<BillingLastBill>({
		queryKey: ['admin', 'billing', 'last-bill'],
		queryFn: getBillingLastBill,
		staleTime: 60_000,
	});
}

// ---------- Billing Refill ----------

export async function createBillingRefill(messages: number) {
	return await withAuthRetry((headers) =>
		apiClient.admin.billing.refill.put({
			$headers: headers,
			messages,
		}),
	);
}

export type BillingRefill = Awaited<ReturnType<typeof createBillingRefill>>;

export function useCreateBillingRefill() {
	return async (messages: number) => {
		return await createBillingRefill(messages);
	};
}

// ---------- Payment MP Checkout ----------

export async function getPaymentMpCheckout(
	billId: string,
	redirect?: string,
	language?: string,
) {
	return await withAuthRetry((headers) =>
		apiClient.payment.mp[billId]!.get({
			$headers: { ...headers, ...(language ? { language } : {}) },
			$query: redirect ? { redirect } : {},
		}),
	);
}

export function useGetPaymentMpCheckout() {
	return async (billId: string, redirect?: string, language?: string) => {
		return await getPaymentMpCheckout(billId, redirect, language);
	};
}

// ---------- Billing Bills ----------

export type BillingBillsParams = {
	cursor?: string | null;
	limit?: number;
};

export async function getBillingBills(params: BillingBillsParams = {}) {
	return await withAuthRetry((headers) =>
		apiClient.admin.billing.bills.get({
			$headers: headers,
			$query: {
				...(params.cursor ? { cursor: params.cursor } : {}),
				...(params.limit ? { limit: params.limit } : {}),
			},
		}),
	);
}

export type BillingBills = Awaited<ReturnType<typeof getBillingBills>>;

export function useBillingBills(params: BillingBillsParams = {}) {
	return useQuery<BillingBills>({
		queryKey: ['admin', 'billing', 'bills', params],
		queryFn: () => getBillingBills(params),
		staleTime: 60_000,
	});
}

// ---------- Billing Last Refill Bill ----------

export async function getBillingLastRefillBill() {
	return await withAuthRetry((headers) =>
		apiClient.admin.billing['last-refill-bill'].get({
			$headers: headers,
		}),
	);
}

export type BillingLastRefillBill = Awaited<
	ReturnType<typeof getBillingLastRefillBill>
>;

export function useBillingLastRefillBill() {
	return useQuery<BillingLastRefillBill>({
		queryKey: ['admin', 'billing', 'last-refill-bill'],
		queryFn: getBillingLastRefillBill,
		staleTime: 60_000,
	});
}

// ---------- Batch Billing Preview ----------

export async function getBatchBillingPreview(months: number) {
	return await withAuthRetry((headers) =>
		apiClient.admin.billing['batch-preview'].get({
			$headers: headers,
			$query: { months },
		}),
	);
}

export type BatchBillingPreview = Awaited<
	ReturnType<typeof getBatchBillingPreview>
>;

export function useBatchBillingPreview(months: number, enabled = true) {
	return useQuery<BatchBillingPreview>({
		queryKey: ['admin', 'billing', 'batch-preview', months],
		queryFn: () => getBatchBillingPreview(months),
		staleTime: 30_000,
		enabled,
	});
}

// ---------- Batch Billing ----------

export async function setBatchBilling(months: number) {
	return await withAuthRetry((headers) =>
		apiClient.admin.billing.batch.put({
			$headers: headers,
			months,
		}),
	);
}

export type BatchBillingResult = Awaited<ReturnType<typeof setBatchBilling>>;

export function useSetBatchBilling() {
	const queryClient = useQueryClient();

	return async (months: number) => {
		const res = await setBatchBilling(months);
		await queryClient.invalidateQueries({ queryKey: ['admin', 'billing'] });
		return res;
	};
}

// ---------- USD/ARS Quote ----------

export async function getUsdArsQuote() {
	return await withAuthRetry((headers) =>
		apiClient.public['usd-ars-quote'].get({
			$headers: headers,
		}),
	);
}

export type UsdArsQuote = Awaited<ReturnType<typeof getUsdArsQuote>>;

export function useUsdArsQuote() {
	return useQuery<UsdArsQuote>({
		queryKey: ['public', 'usd-ars-quote'],
		queryFn: getUsdArsQuote,
		staleTime: 5 * 60_000,
	});
}
