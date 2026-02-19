import { cache, db } from '@api/env';
import {
	BillableEventType,
	BillSource,
	bill,
	billableEvent,
	chunk,
	file,
	PLANS,
	Plan,
	tenant,
	USAGE_BASED_PRICING,
	user,
} from '@api/schema';
import { ErrorCode } from '@api/utils/error';
import { jsonAgg, jsonBuildObject } from '@api/utils/sql';
import dayjs from 'dayjs';
import { and, eq, isNull, lte, or, sql, sum } from 'drizzle-orm';

const PLAN_KEY = (slug: string) => `tenant:${slug}:plan`;
const STORAGE_KEY = (slug: string) => `tenant:${slug}:storage-usage`;
const EMBED_KEY = (slug: string) => `tenant:${slug}:embed-usage`;
const MESSAGE_KEY = (slug: string) => `tenant:${slug}:message-usage`;
const REFILL_KEY = (slug: string) => `tenant:${slug}:refill-messages`;
const UNPAID_KEY = (slug: string) => `tenant:${slug}:unpaid-bill`;

export async function getTenantPlan(slug: string): Promise<Plan> {
	const cached = await cache.get<Plan>(PLAN_KEY(slug));
	if (cached) return cached;

	const result = (
		await db
			.select({ plan: tenant.plan })
			.from(tenant)
			.where(eq(tenant.slug, slug))
	).at(0);

	const plan = result?.plan ?? Plan.FREE;
	await cache.set(PLAN_KEY(slug), plan, { ex: 12 * 60 * 60 });
	return plan;
}

export async function getStorageUsage(slug: string): Promise<number> {
	const cached = await cache.get<number>(STORAGE_KEY(slug));
	if (cached) return cached;

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
	if (cached) return cached;

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

export async function getMessageUsage(slug: string): Promise<number> {
	const cached = await cache.get<number>(MESSAGE_KEY(slug));
	if (cached) return cached;

	const result = (
		await db
			.select({ consumption: sum(billableEvent.consumption) })
			.from(billableEvent)
			.innerJoin(user, eq(user.id, billableEvent.userId))
			.where(
				and(
					eq(billableEvent.type, BillableEventType.MESSAGE),
					eq(user.slug, slug),
					isNull(billableEvent.billId),
				),
			)
	).at(0);

	const usage = Number(result?.consumption ?? 0);
	await cache.set(MESSAGE_KEY(slug), usage, { ex: 60 * 60 });
	return usage;
}

export async function getRefillMessages(slug: string): Promise<number> {
	const cached = await cache.get<number>(REFILL_KEY(slug));
	if (cached) return cached;

	const result = (
		await db
			.select({ consumption: sum(billableEvent.consumption) })
			.from(billableEvent)
			.where(
				and(
					eq(billableEvent.type, BillableEventType.REFILL),
					eq(billableEvent.slug, slug),
					isNull(billableEvent.billId),
				),
			)
	).at(0);

	const usage = Number(result?.consumption ?? 0);
	await cache.set(REFILL_KEY(slug), usage, { ex: 60 * 60 });
	return usage;
}

export async function incrementStorageUsage(
	slug: string,
	deltaMB: number,
): Promise<void> {
	const key = STORAGE_KEY(slug);
	if (await cache.exists(key)) await cache.incrbyfloat(key, deltaMB);
}

export async function incrementEmbedUsage(
	slug: string,
	deltaTokens: number,
): Promise<void> {
	const key = EMBED_KEY(slug);
	if (await cache.exists(key)) await cache.incrbyfloat(key, deltaTokens);
}

export async function incrementMessageUsage(
	slug: string,
	deltaCredits: number,
): Promise<void> {
	const key = MESSAGE_KEY(slug);
	if (await cache.exists(key)) await cache.incrbyfloat(key, deltaCredits);
}

export async function hasUnpaidBill(slug: string): Promise<boolean> {
	const cached = await cache.get<boolean>(UNPAID_KEY(slug));
	if (cached !== null) return cached;

	const graceCutoff = dayjs().subtract(3, 'day').format('YYYY-MM-DD');

	const unpaidBill = (
		await db
			.select({ id: bill.id })
			.from(bill)
			.where(
				and(
					eq(bill.slug, slug),
					eq(bill.paid, false),
					or(
						eq(bill.source, BillSource.PLAN_CHANGE),
						lte(bill.createdAt, graceCutoff),
					),
				),
			)
			.limit(1)
	).at(0);

	const unpaid = Boolean(unpaidBill);
	await cache.set(UNPAID_KEY(slug), unpaid, { ex: 60 * 60 });
	return unpaid;
}

export async function checkTenantCanIngest(
	slug: string,
): Promise<null | ErrorCode> {
	if (await hasUnpaidBill(slug)) return ErrorCode.PAYMENT_REQUIRED;

	const plan = await getTenantPlan(slug);
	const limits = PLANS[plan];

	if (limits.storageLimit !== null) {
		const storageUsage = await getStorageUsage(slug);
		if (storageUsage >= limits.storageLimit)
			return ErrorCode.STORAGE_LIMIT_REACHED;
	}

	if (limits.embedLimit !== null) {
		const embedUsage = await getEmbedUsage(slug);
		if (embedUsage >= limits.embedLimit) return ErrorCode.EMBED_LIMIT_REACHED;
	}

	return null;
}

export async function checkTenantCanChat(
	slug: string,
	creditsToUse: number,
): Promise<null | ErrorCode> {
	if (await hasUnpaidBill(slug)) return ErrorCode.PAYMENT_REQUIRED;

	const plan = await getTenantPlan(slug);
	const limits = PLANS[plan];

	if (limits.messageLimit === null) return null;

	const [messageUsage, refillMessages] = await Promise.all([
		getMessageUsage(slug),
		getRefillMessages(slug),
	]);

	if (messageUsage + creditsToUse > limits.messageLimit + refillMessages)
		return ErrorCode.MESSAGE_LIMIT_REACHED;

	return null;
}

type BillDetails = {
	baseBill: number;
	storage?: number;
	embed?: number;
	message?: number;
	refill?: number;
};

export function calculateBillAmount(plan: Plan, details: BillDetails): number {
	const limits = PLANS[plan];
	let amount = limits.baseBill;

	if (limits.storageLimit === null && details.storage)
		amount += details.storage * USAGE_BASED_PRICING.storagePerMbPerDay;

	if (limits.embedLimit === null && details.embed)
		amount += details.embed * USAGE_BASED_PRICING.embedPerToken;

	if (limits.messageLimit === null && details.message)
		amount += details.message * USAGE_BASED_PRICING.perMessage;

	return Math.round(amount * 100) / 100;
}

export async function generateBillForTenant(
	slug: string,
	plan: Plan,
	source: BillSource = BillSource.PERIODIC,
): Promise<{ billId: string; amount: number }> {
	const consumption = await db
		.select({
			type: billableEvent.type,
			total: sum(billableEvent.consumption),
		})
		.from(billableEvent)
		.where(and(eq(billableEvent.slug, slug), isNull(billableEvent.billId)))
		.groupBy(billableEvent.type);

	const details: BillDetails = { baseBill: PLANS[plan].baseBill };
	for (const row of consumption) {
		const key = row.type as keyof Omit<BillDetails, 'baseBill'>;
		details[key] = Number(row.total ?? 0);
	}

	const amount = calculateBillAmount(plan, details);
	const billId = crypto.randomUUID();

	await db.batch([
		db.insert(bill).values({
			id: billId,
			slug,
			amount: amount.toString(),
			plan,
			source,
			paid: amount === 0,
			details,
		}),
		db
			.update(billableEvent)
			.set({ billId })
			.where(and(eq(billableEvent.slug, slug), isNull(billableEvent.billId))),
		db
			.update(tenant)
			.set({ billingAt: dayjs().add(1, 'month').toDate() })
			.where(eq(tenant.slug, slug)),
	]);

	await cache.del(
		PLAN_KEY(slug),
		STORAGE_KEY(slug),
		EMBED_KEY(slug),
		MESSAGE_KEY(slug),
		REFILL_KEY(slug),
		UNPAID_KEY(slug),
	);

	return { billId, amount };
}

export type TenantDueForBilling = {
	slug: string;
	plan: Plan;
	logoUrl: string | null;
	displayName: string | null;
	admins: { email: string; language: string; displayName: string | null }[];
};

export async function getTenantsDueForBilling(): Promise<
	TenantDueForBilling[]
> {
	const now = dayjs().endOf('day').toDate();

	return db
		.select({
			slug: tenant.slug,
			plan: tenant.plan,
			logoUrl: tenant.logoUrl,
			displayName: tenant.displayName,
			admins: jsonAgg(
				jsonBuildObject({
					email: user.email,
					language: user.language,
					displayName: user.displayName,
				}),
				{ filterWhere: user.id },
			),
		})
		.from(tenant)
		.leftJoin(user, and(eq(user.slug, tenant.slug), eq(user.isAdmin, true)))
		.where(lte(tenant.billingAt, now))
		.groupBy(tenant.slug);
}
