import { cache, db } from '@api/env';
import {
	BillableEventType,
	bill,
	billableEvent,
	chunk,
	file,
	tenant,
	user,
} from '@api/schema';
import { and, desc, eq, isNull, sql, sum } from 'drizzle-orm';

const TENANT_BILLING_KEY = (slug: string) => `tenant:${slug}:billing-info`;
const STORAGE_KEY = (slug: string) => `tenant:${slug}:storage-usage`;
const EMBED_KEY = (slug: string) => `tenant:${slug}:embed-usage`;
const UNPAID_KEY = (slug: string) => `tenant:${slug}:unpaid-bill`;

export type TenantBillingInfo = {
	usageBasedBilling: boolean;
	storageLimit: number;
	embedLimit: number;
};

export async function getTenantBillingInfo(
	slug: string,
): Promise<TenantBillingInfo> {
	const cached = await cache.get<TenantBillingInfo>(TENANT_BILLING_KEY(slug));
	if (cached) return cached;

	const result = (
		await db
			.select({
				usageBasedBilling: tenant.usageBasedBilling,
				storageLimit: tenant.storageLimit,
				embedLimit: tenant.embedLimit,
			})
			.from(tenant)
			.where(eq(tenant.slug, slug))
	).at(0);

	if (!result)
		return {
			usageBasedBilling: false,
			storageLimit: 5 * 1024,
			embedLimit: 2 * 1024 * 250_000,
		};

	await cache.set(TENANT_BILLING_KEY(slug), result, { ex: 60 * 60 });
	return result;
}

export async function getStorageUsage(slug: string): Promise<number> {
	const cached = await cache.get<number>(STORAGE_KEY(slug));
	if (cached !== null) return cached;

	const result = (
		await db
			.select({
				consumption: sql<string>`coalesce((sum(octet_length(${chunk.text}) + 4096) / (1024.0 * 1024.0))::numeric, 0)`,
			})
			.from(chunk)
			.innerJoin(file, eq(file.id, chunk.fileId))
			.innerJoin(user, eq(user.id, file.userId))
			.where(eq(user.slug, slug))
	).at(0);

	const usage = Number(result?.consumption ?? 0);
	await cache.set(STORAGE_KEY(slug), usage, { ex: 12 * 60 * 60 });
	return usage;
}

export async function getEmbedUsage(slug: string): Promise<number> {
	const cached = await cache.get<number>(EMBED_KEY(slug));
	if (cached !== null) return cached;

	const result = (
		await db
			.select({ consumption: sum(billableEvent.consumption) })
			.from(billableEvent)
			.innerJoin(user, eq(user.id, billableEvent.userId))
			.where(
				and(
					eq(billableEvent.type, BillableEventType.EMBED),
					eq(user.slug, slug),
					isNull(billableEvent.billId),
				),
			)
	).at(0);

	const usage = Number(result?.consumption ?? 0);
	await cache.set(EMBED_KEY(slug), usage, { ex: 60 * 60 });
	return usage;
}

export async function incrementStorageUsage(
	slug: string,
	deltaMB: number,
): Promise<void> {
	const key = STORAGE_KEY(slug);
	const current = await cache.get<number>(key);
	if (current !== null) {
		await cache.set(key, current + deltaMB, { ex: 12 * 60 * 60 });
	}
}

export async function incrementEmbedUsage(
	slug: string,
	deltaTokens: number,
): Promise<void> {
	const key = EMBED_KEY(slug);
	const current = await cache.get<number>(key);
	if (current !== null) {
		await cache.set(key, current + deltaTokens, { ex: 60 * 60 });
	}
}

export async function hasUnpaidBill(slug: string): Promise<boolean> {
	const cached = await cache.get<boolean>(UNPAID_KEY(slug));
	if (cached !== null) return cached;

	const latestBill = (
		await db
			.select({ paid: bill.paid })
			.from(bill)
			.where(eq(bill.slug, slug))
			.orderBy(desc(bill.createdAt))
			.limit(1)
	).at(0);

	const unpaid = latestBill ? !latestBill.paid : false;
	await cache.set(UNPAID_KEY(slug), unpaid, { ex: 60 * 60 });
	return unpaid;
}

export type IngestBlockReason =
	| 'PAYMENT_REQUIRED'
	| 'STORAGE_LIMIT_REACHED'
	| 'EMBED_LIMIT_REACHED';

export async function checkTenantCanIngest(
	billingInfo: TenantBillingInfo,
	slug: string,
): Promise<null | IngestBlockReason> {
	if (await hasUnpaidBill(slug)) return 'PAYMENT_REQUIRED';

	if (billingInfo.usageBasedBilling) return null;

	const [storageUsage, embedUsage] = await Promise.all([
		getStorageUsage(slug),
		getEmbedUsage(slug),
	]);

	if (storageUsage >= billingInfo.storageLimit) return 'STORAGE_LIMIT_REACHED';
	if (embedUsage >= billingInfo.embedLimit) return 'EMBED_LIMIT_REACHED';

	return null;
}

export async function checkTenantCanChat(
	slug: string,
): Promise<null | 'PAYMENT_REQUIRED'> {
	if (await hasUnpaidBill(slug)) return 'PAYMENT_REQUIRED';
	return null;
}
