import { cache, db } from '@api/env';
import { locales } from '@api/locales';
import {
	BillableEventType,
	BillSource,
	bill,
	billableEvent,
	chunk,
	file,
	type Language,
	PLANS,
	Plan,
	TraceType,
	tenant,
	trace,
	USAGE_BASED_PRICING,
	user,
} from '@api/schema';
import { log, requireEnv } from '@api/utils/env';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { sendTemplateMail, Template } from '@api/utils/mail';
import { jsonAgg, jsonBuildObject } from '@api/utils/sql';
import { captureException } from '@sentry/bun';
import dayjs from 'dayjs';
import {
	and,
	eq,
	gte,
	isNull,
	lte,
	notExists,
	or,
	sql,
	sum,
} from 'drizzle-orm';

const PLAN_KEY = (slug: string) => `tenant:${slug}:plan`;
const STORAGE_KEY = (slug: string) => `tenant:${slug}:storage-usage`;
const EMBED_KEY = (slug: string) => `tenant:${slug}:embed-usage`;
const MESSAGE_KEY = (slug: string) => `tenant:${slug}:message-usage`;
const REFILL_KEY = (slug: string) => `tenant:${slug}:refill-messages`;
export const UNPAID_KEY = (slug: string) => `tenant:${slug}:unpaid-bill`;
const LIMIT_WARN_KEY = (slug: string) => `tenant:${slug}:limit-warned`;

const LIMIT_TYPE_LOCALE_KEY: Record<string, string> = {
	message: 'typeMessages',
	storage: 'typeStorage',
	embed: 'typeEmbeds',
};

const LIMIT_WARN_THRESHOLD = 0.95;

export async function getTenantPlan(
	slug: string,
	skipCache = false,
): Promise<Plan> {
	if (!skipCache) {
		const cached = await cache.get<Plan>(PLAN_KEY(slug));
		if (cached) return cached;
	}

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

export async function getStorageUsage(
	slug: string,
	skipCache = false,
): Promise<number> {
	if (!skipCache) {
		const cached = await cache.get<number>(STORAGE_KEY(slug));
		if (cached) return cached;
	}

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

export async function getEmbedUsage(
	slug: string,
	skipCache = false,
): Promise<number> {
	if (!skipCache) {
		const cached = await cache.get<number>(EMBED_KEY(slug));
		if (cached) return cached;
	}

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

export async function getMessageUsage(
	slug: string,
	skipCache = false,
): Promise<number> {
	if (!skipCache) {
		const cached = await cache.get<number>(MESSAGE_KEY(slug));
		if (cached) return cached;
	}

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
	await cache.set(MESSAGE_KEY(slug), usage, { ex: 12 * 60 * 60 });
	return usage;
}

export async function getRefillMessages(
	slug: string,
	skipCache = false,
): Promise<number> {
	if (!skipCache) {
		const cached = await cache.get<number>(REFILL_KEY(slug));
		if (cached) return cached;
	}

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
	await cache.set(REFILL_KEY(slug), usage, { ex: 12 * 60 * 60 });
	return usage;
}

export async function incrementStorageUsage(
	slug: string,
	deltaMB: number,
): Promise<void> {
	const key = STORAGE_KEY(slug);
	if (await cache.exists(key)) await cache.incrbyfloat(key, deltaMB);
	checkAndNotifyLimits(slug, 'storage');
}

export async function incrementEmbedUsage(
	slug: string,
	deltaTokens: number,
): Promise<void> {
	const key = EMBED_KEY(slug);
	if (await cache.exists(key)) await cache.incrbyfloat(key, deltaTokens);
	checkAndNotifyLimits(slug, 'embed');
}

export async function incrementMessageUsage(
	slug: string,
	deltaCredits: number,
): Promise<void> {
	const key = MESSAGE_KEY(slug);
	if (await cache.exists(key)) await cache.incrbyfloat(key, deltaCredits);
	checkAndNotifyLimits(slug, 'message');
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
	await cache.set(UNPAID_KEY(slug), unpaid, { ex: 12 * 60 * 60 });
	return unpaid;
}

type BreachedLimit = {
	type: 'message' | 'storage' | 'embed';
	used: string;
	limit: string;
	percentage: number;
};

async function checkAndNotifyLimits(
	slug: string,
	type: BreachedLimit['type'],
): Promise<void> {
	try {
		if (await cache.exists(LIMIT_WARN_KEY(slug))) return;

		const plan = await getTenantPlan(slug);
		const limits = PLANS[plan];

		let breached: BreachedLimit | null = null;

		if (type === 'message' && limits.messageLimit !== null) {
			const [messageUsage, refillMessages] = await Promise.all([
				getMessageUsage(slug),
				getRefillMessages(slug),
			]);
			const effectiveLimit = limits.messageLimit + refillMessages;
			const ratio = effectiveLimit > 0 ? messageUsage / effectiveLimit : 0;
			if (ratio >= LIMIT_WARN_THRESHOLD)
				breached = {
					type: 'message',
					used: Math.round(messageUsage).toString(),
					limit: Math.round(effectiveLimit).toString(),
					percentage: Math.min(Math.round(ratio * 100), 100),
				};
		} else if (type === 'storage' && limits.storageLimit !== null) {
			const storageUsage = await getStorageUsage(slug);
			const ratio =
				limits.storageLimit > 0 ? storageUsage / limits.storageLimit : 0;
			if (ratio >= LIMIT_WARN_THRESHOLD)
				breached = {
					type: 'storage',
					used: Math.round(storageUsage).toString(),
					limit: Math.round(limits.storageLimit).toString(),
					percentage: Math.min(Math.round(ratio * 100), 100),
				};
		} else if (type === 'embed' && limits.embedLimit !== null) {
			const embedUsage = await getEmbedUsage(slug);
			const ratio = limits.embedLimit > 0 ? embedUsage / limits.embedLimit : 0;
			if (ratio >= LIMIT_WARN_THRESHOLD)
				breached = {
					type: 'embed',
					used: Math.round(embedUsage).toString(),
					limit: Math.round(limits.embedLimit).toString(),
					percentage: Math.min(Math.round(ratio * 100), 100),
				};
		}

		if (!breached) return;

		const existingTrace = (
			await db
				.select({ id: trace.id })
				.from(trace)
				.where(
					and(
						eq(trace.type, TraceType.LIMIT_WARNING),
						eq(sql`${trace.metadata}->>'slug'`, slug),
						gte(trace.createdAt, dayjs().subtract(1, 'month').toDate()),
					),
				)
				.limit(1)
		).at(0);

		if (existingTrace) {
			await cache.set(LIMIT_WARN_KEY(slug), true, { ex: 12 * 60 * 60 });
			return;
		}

		const tenantInfo = (
			await db
				.select({
					displayName: tenant.displayName,
					logoUrl: tenant.logoUrl,
				})
				.from(tenant)
				.where(eq(tenant.slug, slug))
		).at(0);

		if (!tenantInfo)
			throw httpError(HttpCode.NOT_FOUND, ErrorCode.TENANT_NOT_FOUND);

		const admins = await db
			.select({
				id: user.id,
				email: user.email,
				displayName: user.displayName,
				language: user.language,
			})
			.from(user)
			.where(and(eq(user.slug, slug), eq(user.isAdmin, true)));

		if (!admins.length) return;

		await Promise.allSettled(
			admins.map((admin) => {
				const lang = admin.language as Language;
				const locale =
					locales[lang]?.['limit-warning'] ??
					locales.en?.['limit-warning'] ??
					{};

				return sendTemplateMail({
					to: admin.email,
					template: Template.LIMIT_WARNING,
					data: {
						displayName: admin.displayName ?? admin.email,
						tenantDisplayName: tenantInfo.displayName ?? slug,
						logoUrl: tenantInfo.logoUrl,
						limits: [
							{
								label:
									locale[LIMIT_TYPE_LOCALE_KEY[breached.type] ?? ''] ??
									breached.type,
								used: breached.used,
								limit: breached.limit,
								percentage: breached.percentage,
							},
						],
						redirect: requireEnv('DEFAULT_REDIRECT_URL'),
					},
					language: lang,
				});
			}),
		);

		await db.insert(trace).values({
			type: TraceType.LIMIT_WARNING,
			metadata: {
				slug,
				limits: [breached.type],
			},
		});

		await cache.set(LIMIT_WARN_KEY(slug), true, { ex: 12 * 60 * 60 });

		log('log', `Limit warning sent for tenant ${slug}: ${breached.type}`);
	} catch (error) {
		captureException(error, {
			tags: { source: 'checkAndNotifyLimits' },
			extra: { slug, type },
		});
	}
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
		LIMIT_WARN_KEY(slug),
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
	const graceCutoff = dayjs().subtract(3, 'day').format('YYYY-MM-DD');

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
		.where(
			and(
				lte(tenant.billingAt, now),
				notExists(
					db
						.select({ id: bill.id })
						.from(bill)
						.where(
							and(
								eq(bill.slug, tenant.slug),
								eq(bill.paid, false),
								or(
									eq(bill.source, BillSource.PLAN_CHANGE),
									lte(bill.createdAt, graceCutoff),
								),
							),
						),
				),
			),
		)
		.groupBy(tenant.slug);
}
