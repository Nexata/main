import { useQuery } from '@tanstack/react-query'
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
