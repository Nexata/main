import { cache, db, EMBEDDING_SIZE } from '@api/env';
import { FileCategory } from '@api/file/lib/types';
import { locales } from '@api/locales';
import {
	BillableEventType,
	type BillDetails,
	BillSource,
	bill,
	billableEvent,
	chunk,
	file,
	type Language,
	PLANS,
	Plan,
	REFILL_PRICING,
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
	isNotNull,
	isNull,
	lte,
	ne,
	notExists,
	or,
	sql,
	sum,
} from 'drizzle-orm';

export const PLAN_KEY = (slug: string) => `tenant:${slug}:plan`;
export const STORAGE_KEY = (slug: string) => `tenant:${slug}:storage-usage`;
export const EMBED_KEY = (slug: string) => `tenant:${slug}:embed-usage`;
export const MESSAGE_KEY = (slug: string) => `tenant:${slug}:message-usage`;
export const REFILL_KEY = (slug: string) => `tenant:${slug}:refill-messages`;
export const UNPAID_KEY = (slug: string) => `tenant:${slug}:unpaid-bill`;
export const LIMIT_WARN_KEY = (slug: string) => `tenant:${slug}:limit-warned`;

/**
 * Multiplier applied to raw chunk data (text bytes + embedding vector)
 * to account for HNSW index, row/tuple overhead, btree indexes, and TOAST storage.
 */
export const STORAGE_OVERHEAD_MULTIPLIER = 4;

/** SQL expression: estimated storage megabytes for a single chunk row. */
export const chunkStorageMB = sql<number>`(octet_length(${chunk.text}) + 4096) * ${STORAGE_OVERHEAD_MULTIPLIER} / (1024.0 * 1024.0)`;

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
		if (cached !== null && cached !== undefined) return cached;
	}

	const result = (
		await db
			.select({
				consumption: sql<string>`coalesce((sum(${chunkStorageMB}))::numeric, 0)`,
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
		if (cached !== null && cached !== undefined) return cached;
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
		if (cached !== null && cached !== undefined) return cached;
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
		if (cached !== null && cached !== undefined) return cached;
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

export async function invalidateStorageUsage(slug: string): Promise<void> {
	await cache.del(STORAGE_KEY(slug));
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

	const graceCutoff = dayjs().subtract(3, 'day').startOf('day').toDate();

	const unpaidBill = (
		await db
			.select({ id: bill.id })
			.from(bill)
			.where(
				and(
					eq(bill.slug, slug),
					eq(bill.paid, false),
					ne(bill.source, BillSource.REFILL),
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

	const needsStorageCheck = limits.storageLimit !== null;
	const needsEmbedCheck = limits.embedLimit !== null;

	if (!needsStorageCheck && !needsEmbedCheck) return null;

	const [storageUsage, embedUsage] = await Promise.all([
		needsStorageCheck ? getStorageUsage(slug) : 0,
		needsEmbedCheck ? getEmbedUsage(slug) : 0,
	]);

	if (needsStorageCheck && storageUsage >= limits.storageLimit!)
		return ErrorCode.STORAGE_LIMIT_REACHED;

	if (needsEmbedCheck && embedUsage >= limits.embedLimit!)
		return ErrorCode.EMBED_LIMIT_REACHED;

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

export function calculateRefillAmount(messages: number): number {
	const discount = REFILL_PRICING.discounts.find((d) => d.value === messages);
	const rate = discount ? 1 - discount.rate : 1;
	return messages * REFILL_PRICING.perMessage * rate;
}

export const BATCH_DISCOUNTS = [
	{ months: 12, rate: 0.2 },
	{ months: 9, rate: 0.15 },
	{ months: 6, rate: 0.1 },
	{ months: 3, rate: 0.05 },
] as const;

export function calculateBatchDiscount(months: number): number {
	for (const tier of BATCH_DISCOUNTS)
		if (months >= tier.months) return tier.rate;

	return 0;
}

export function calculateBatchBillAmount(
	plan: Plan,
	details: BillDetails,
	months: number,
): number {
	const limits = PLANS[plan];
	const discountRate = calculateBatchDiscount(months);

	let amount = limits.baseBill * months * (1 - discountRate);

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
	const isPaid = amount === 0;

	await db.batch([
		db.insert(bill).values({
			id: billId,
			slug,
			amount: amount.toString(),
			plan,
			source,
			paid: isPaid,
			details,
		}),
		db
			.update(billableEvent)
			.set({ billId })
			.where(and(eq(billableEvent.slug, slug), isNull(billableEvent.billId))),
		...(isPaid
			? [
					db
						.update(tenant)
						.set({ billingAt: dayjs().add(1, 'month').toDate() })
						.where(eq(tenant.slug, slug)),
				]
			: []),
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
	const graceCutoff = dayjs().subtract(3, 'day').startOf('day').toDate();

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
				{ filterWhere: isNotNull(user.id) },
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
								ne(bill.source, BillSource.REFILL),
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

// ---------------------------------------------------------------------------
// Batch ingestion: estimation, capacity pre-check, and stop-flag helpers
// ---------------------------------------------------------------------------

const INGEST_STOP_KEY = (slug: string) => `ingest:${slug}:stopped`;
const INGEST_STOP_TTL = 60 * 60; // 1 hour

export type FileEstimate = { sizeBytes: number; category: FileCategory };

export type BatchEstimate = {
	estimatedStorageMB: number;
	estimatedEmbedTokens: number;
};

/**
 * Conservative heuristic to estimate resource consumption for a batch of files
 * **before** downloading or processing them. Intentionally over-estimates to
 * prevent exceeding tenant limits during parallel ingestion.
 */
export function estimateBatchResources(files: FileEstimate[]): BatchEstimate {
	let estimatedStorageMB = 0;
	let estimatedEmbedTokens = 0;

	for (const { sizeBytes, category } of files) {
		switch (category) {
			case FileCategory.TEXT: {
				const chunks = Math.ceil(sizeBytes / EMBEDDING_SIZE);
				estimatedStorageMB +=
					(chunks * (EMBEDDING_SIZE + 4096) * STORAGE_OVERHEAD_MULTIPLIER) /
					(1024 * 1024);
				estimatedEmbedTokens += chunks * 250;
				break;
			}
			case FileCategory.PDF: {
				const textChunks = Math.ceil((sizeBytes * 0.3) / EMBEDDING_SIZE);
				const estimatedImages = Math.max(1, Math.floor(sizeBytes / 500_000));
				estimatedStorageMB +=
					(textChunks * (EMBEDDING_SIZE + 4096) * STORAGE_OVERHEAD_MULTIPLIER) /
					(1024 * 1024);
				// 2 chunks per image (description + OCR)
				estimatedStorageMB +=
					(estimatedImages *
						2 *
						(EMBEDDING_SIZE + 4096) *
						STORAGE_OVERHEAD_MULTIPLIER) /
					(1024 * 1024);
				estimatedEmbedTokens += textChunks * 250 + estimatedImages * 40_000;
				break;
			}
			case FileCategory.DOCUMENT: {
				const docChunks = Math.ceil((sizeBytes * 0.2) / EMBEDDING_SIZE);
				const docImages = Math.max(1, Math.floor(sizeBytes / 500_000));
				estimatedStorageMB +=
					(docChunks * (EMBEDDING_SIZE + 4096) * STORAGE_OVERHEAD_MULTIPLIER) /
					(1024 * 1024);
				estimatedStorageMB +=
					(docImages *
						2 *
						(EMBEDDING_SIZE + 4096) *
						STORAGE_OVERHEAD_MULTIPLIER) /
					(1024 * 1024);
				estimatedEmbedTokens += docChunks * 250 + docImages * 40_000;
				break;
			}
			case FileCategory.SPREADSHEET: {
				const sheetChunks = Math.ceil((sizeBytes * 0.5) / EMBEDDING_SIZE);
				estimatedStorageMB +=
					(sheetChunks *
						(EMBEDDING_SIZE + 4096) *
						STORAGE_OVERHEAD_MULTIPLIER) /
					(1024 * 1024);
				estimatedEmbedTokens += sheetChunks * 250;
				break;
			}
			case FileCategory.IMAGE: {
				// 2 chunks (description + OCR), VLM token cost
				estimatedStorageMB +=
					(2 * (EMBEDDING_SIZE + 4096) * STORAGE_OVERHEAD_MULTIPLIER) /
					(1024 * 1024);
				estimatedEmbedTokens += 40_000;
				break;
			}
			case FileCategory.UNSUPPORTED:
				break;
		}
	}

	return { estimatedStorageMB, estimatedEmbedTokens };
}

export type BatchCapacityResult = {
	canProceed: boolean;
	maxFiles: number | null;
	reason?: ErrorCode;
};

/**
 * Pre-checks whether a tenant has enough capacity for a batch of files.
 * If the full batch exceeds limits, calculates how many files (cheapest first)
 * can fit within remaining capacity.
 */
export async function checkBatchCapacity(
	slug: string,
	files: FileEstimate[],
): Promise<BatchCapacityResult> {
	const blockReason = await checkTenantCanIngest(slug);
	if (blockReason)
		return { canProceed: false, maxFiles: 0, reason: blockReason };

	const plan = await getTenantPlan(slug);
	const limits = PLANS[plan];

	// Unlimited plans can always proceed
	if (limits.storageLimit === null && limits.embedLimit === null)
		return { canProceed: true, maxFiles: null };

	const [storageUsage, embedUsage] = await Promise.all([
		limits.storageLimit !== null ? getStorageUsage(slug) : 0,
		limits.embedLimit !== null ? getEmbedUsage(slug) : 0,
	]);

	const remainingStorageMB =
		limits.storageLimit !== null
			? limits.storageLimit - storageUsage
			: Infinity;
	const remainingEmbedTokens =
		limits.embedLimit !== null ? limits.embedLimit - embedUsage : Infinity;

	const fullEstimate = estimateBatchResources(files);

	if (
		fullEstimate.estimatedStorageMB <= remainingStorageMB &&
		fullEstimate.estimatedEmbedTokens <= remainingEmbedTokens
	)
		return { canProceed: true, maxFiles: null };

	// Calculate per-file estimates and sort by cost (cheapest first)
	const perFile = files
		.map((f, i) => ({ ...estimateBatchResources([f]), index: i }))
		.sort((a, b) => a.estimatedEmbedTokens - b.estimatedEmbedTokens);

	let accStorage = 0;
	let accEmbed = 0;
	let maxFiles = 0;

	for (const est of perFile) {
		const nextStorage = accStorage + est.estimatedStorageMB;
		const nextEmbed = accEmbed + est.estimatedEmbedTokens;

		if (nextStorage > remainingStorageMB || nextEmbed > remainingEmbedTokens)
			break;

		accStorage = nextStorage;
		accEmbed = nextEmbed;
		maxFiles++;
	}

	if (maxFiles === 0)
		return {
			canProceed: false,
			maxFiles: 0,
			reason:
				remainingStorageMB <= 0
					? ErrorCode.STORAGE_LIMIT_REACHED
					: ErrorCode.EMBED_LIMIT_REACHED,
		};

	return { canProceed: true, maxFiles };
}

/**
 * Sets a stop flag in Redis to signal parallel workers to stop ingesting
 * for a given tenant.
 */
export async function setIngestStopFlag(slug: string): Promise<void> {
	await cache.set(INGEST_STOP_KEY(slug), true, { ex: INGEST_STOP_TTL });
}

/**
 * Checks whether the ingest stop flag is set for a given tenant.
 */
export async function isIngestStopped(slug: string): Promise<boolean> {
	return Boolean(await cache.get(INGEST_STOP_KEY(slug)));
}

/**
 * Clears the ingest stop flag for a tenant (called when batch starts).
 */
export async function clearIngestStopFlag(slug: string): Promise<void> {
	await cache.del(INGEST_STOP_KEY(slug));
}
