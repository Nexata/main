import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient, withAuthRetry } from '@/api'

// Messages Consumption
export async function getBillingMessages() {
  return await withAuthRetry((headers) =>
    apiClient.api.admin.billing.messages.get({
      $headers: headers,
    }),
  )
}

export type BillingMessages = Awaited<ReturnType<typeof getBillingMessages>>

export function useBillingMessages() {
  return useQuery<BillingMessages>({
    queryKey: ['admin', 'billing', 'messages'],
    queryFn: getBillingMessages,
    staleTime: 60_000, 
  })
}

// Embeddings Consumption
export async function getBillingEmbeds() {
  return await withAuthRetry((headers) =>
    apiClient.api.admin.billing.embeds.get({
      $headers: headers,
    }),
  )
}

export type BillingEmbeds = Awaited<ReturnType<typeof getBillingEmbeds>>

export function useBillingEmbeds() {
  return useQuery<BillingEmbeds>({
    queryKey: ['admin', 'billing', 'embeds'],
    queryFn: getBillingEmbeds,
    staleTime: 60_000,
  })
}

// Storage Consumption
export async function getBillingStorage() {
  return await withAuthRetry((headers) =>
    apiClient.api.admin.billing.storage.get({
      $headers: headers,
    }),
  )
}

export type BillingStorage = Awaited<ReturnType<typeof getBillingStorage>>

export function useBillingStorage() {
  return useQuery<BillingStorage>({
    queryKey: ['admin', 'billing', 'storage'],
    queryFn: getBillingStorage,
    staleTime: 60_000,
  })
}

// List Users
export async function getUsers() {
  return await withAuthRetry((headers) =>
    apiClient.api.user.get({
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
    apiClient.api.admin.user.post({
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
    apiClient.api.admin.user[userId]!.patch({
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
    apiClient.api.admin.user[userId]!.delete({
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
    apiClient.api.admin.tenant.patch({
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
