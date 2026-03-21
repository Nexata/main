import { authPlugin } from '@api/auth';
import { cache, db } from '@api/env';
import {
	type BillDetails,
	BillSource,
	bill,
	type Language,
	PLANS,
	Plan,
	REFILL_PRICING,
	tenant,
	user,
} from '@api/schema';
import {
	BATCH_DISCOUNTS,
	calculateBatchBillAmount,
	calculateBatchDiscount,
	calculateRefillAmount,
	generateBillForTenant,
	getEmbedUsage,
	getMessageUsage,
	getRefillMessages,
	getStorageUsage,
	getTenantPlan,
	UNPAID_KEY,
} from '@api/utils/billing';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { Nullish, tObject } from '@api/utils/type';
import { and, desc, eq, isNotNull, lt, ne } from 'drizzle-orm';
import { Elysia, t } from 'elysia';

export const billingRouter = new Elysia({ prefix: '/billing' })
	.use(authPlugin({ admin: true }))
	.get(
		'/usage',
		async ({ activeUser }) => {
			const plan = await getTenantPlan(activeUser.slug, true);
			const limits = PLANS[plan];

			const [storageUsage, embedUsage, messageUsage, refillMessages] =
				await Promise.all([
					getStorageUsage(activeUser.slug, true),
					getEmbedUsage(activeUser.slug, true),
					getMessageUsage(activeUser.slug, true),
					getRefillMessages(activeUser.slug, true),
				]);

			return {
				plan,
				messages: {
					used: messageUsage,
					limit: (limits.messageLimit ?? 0) + refillMessages,
				},
				embeds: {
					used: embedUsage,
					limit: limits.embedLimit,
				},
				storage: {
					used: storageUsage,
					limit: limits.storageLimit,
				},
			};
		},
		{ detail: { summary: 'Read usage consumption and limits' } },
	)
	.get(
		'/last-bill',
		async ({ activeUser }) =>
			(
				await db
					.select()
					.from(bill)
					.where(
						and(
							eq(bill.slug, activeUser.slug),
							ne(bill.source, BillSource.REFILL),
						),
					)
					.orderBy(desc(bill.createdAt))
					.limit(1)
			)[0]!,
		{ detail: { summary: 'Read last bill' } },
	)
	.get(
		'/last-refill-bill',
		async ({ activeUser }) =>
			(
				await db
					.select()
					.from(bill)
					.where(
						and(
							eq(bill.slug, activeUser.slug),
							eq(bill.source, BillSource.REFILL),
						),
					)
					.orderBy(desc(bill.createdAt))
					.limit(1)
			)[0]!,
		{ detail: { summary: 'Read last refill bill' } },
	)
	.put(
		'/refill',
		async ({ activeUser, body }) => {
			const plan = await getTenantPlan(activeUser.slug);
			const limits = PLANS[plan];

			if (limits.messageLimit === null)
				throw httpError(
					HttpCode.FORBIDDEN,
					ErrorCode.REFILL_NOT_ALLOWED,
					activeUser.language,
				);

			const amount = calculateRefillAmount(body.messages);
			const billId = crypto.randomUUID();

			await db.insert(bill).values({
				id: billId,
				slug: activeUser.slug,
				amount: amount.toString(),
				plan,
				source: BillSource.REFILL,
				paid: false,
				details: {
					messages: body.messages,
					perMessage: REFILL_PRICING.perMessage,
				},
			});

			return { billId, amount };
		},
		{
			detail: { summary: 'Refill with messages' },
			body: tObject({ messages: t.Integer({ min: 1 }) }),
		},
	)
	.get(
		'/bills',
		({ activeUser, query }) =>
			db
				.select()
				.from(bill)
				.where(
					and(
						eq(bill.slug, activeUser.slug),
						query.cursor ? lt(bill.createdAt, query.cursor) : undefined,
					),
				)
				.orderBy(desc(bill.createdAt))
				.limit(query.limit),
		{
			detail: { summary: 'List bills' },
			query: tObject({
				cursor: Nullish(t.String({ format: 'date' }), {
					description:
						'Cursor for pagination, based on createdAt prop (creation date).',
				}),
				limit: t.Number({
					default: 100,
					description: 'Limit for pagination.',
				}),
			}),
		},
	)
	.put(
		'/plan',
		async ({ activeUser, body }) => {
			if (body.plan === Plan.PAY_AS_YOU_GO)
				throw httpError(
					HttpCode.FORBIDDEN,
					ErrorCode.PLAN_CHANGE_NOT_ALLOWED,
					activeUser.language,
				);

			const currentPlan = await getTenantPlan(activeUser.slug);
			if (currentPlan === body.plan) return { plan: currentPlan };

			const newLimits = PLANS[body.plan];
			const currentLimits = PLANS[currentPlan];

			if (newLimits.storageLimit !== null) {
				const storageUsage = await getStorageUsage(activeUser.slug);
				if (storageUsage > newLimits.storageLimit)
					throw httpError(
						HttpCode.PRECONDITION_FAILED,
						ErrorCode.STORAGE_LIMIT_REACHED,
						activeUser.language,
					);
			}

			await Promise.all([
				db
					.delete(bill)
					.where(and(eq(bill.slug, activeUser.slug), eq(bill.paid, false))),
				db
					.update(tenant)
					.set({ plan: body.plan })
					.where(eq(tenant.slug, activeUser.slug)),
			]);

			const b = await generateBillForTenant(
				activeUser.slug,
				body.plan,
				BillSource.PLAN_CHANGE,
			);

			if (currentLimits.hasApiAccess && !newLimits.hasApiAccess) {
				const usersWithKeys = await db
					.select({ id: user.id })
					.from(user)
					.where(and(eq(user.slug, activeUser.slug), isNotNull(user.apiKey)));

				if (usersWithKeys.length)
					await cache.del(...usersWithKeys.map((u) => `apikey:${u.id}`));
			}

			return { plan: body.plan, billId: b.billId };
		},
		{
			detail: { summary: 'Change tenant plan' },
			body: tObject({ plan: t.Enum(Plan) }),
		},
	)
	.get(
		'/batch-preview',
		async ({ activeUser, query }) => {
			const unpaidBill = (
				await db
					.select()
					.from(bill)
					.where(
						and(
							eq(bill.slug, activeUser.slug),
							eq(bill.paid, false),
							ne(bill.source, BillSource.REFILL),
						),
					)
					.orderBy(desc(bill.createdAt))
					.limit(1)
			).at(0);

			if (!unpaidBill)
				throw httpError(
					HttpCode.NOT_FOUND,
					ErrorCode.BILL_NOT_FOUND,
					activeUser.language as Language,
				);

			const details = unpaidBill.details as BillDetails;
			const discountRate = calculateBatchDiscount(query.months);
			const batchAmount = calculateBatchBillAmount(
				unpaidBill.plan,
				details,
				query.months,
			);
			const originalAmount = Number(unpaidBill.amount);

			return {
				billId: unpaidBill.id,
				originalAmount,
				batchAmount,
				months: query.months,
				discountRate,
				savings:
					Math.round((originalAmount * query.months - batchAmount) * 100) / 100,
				tiers: BATCH_DISCOUNTS,
			};
		},
		{
			detail: {
				summary: 'Preview batch billing',
				description:
					'Preview the cost of paying multiple months in advance for the current unpaid bill.',
			},
			query: tObject({
				months: t.Integer({
					minimum: 1,
					maximum: 24,
					description: 'Number of months to pay in advance.',
				}),
			}),
		},
	)
	.put(
		'/batch',
		async ({ activeUser, body }) => {
			const unpaidBill = (
				await db
					.select()
					.from(bill)
					.where(
						and(
							eq(bill.slug, activeUser.slug),
							eq(bill.paid, false),
							ne(bill.source, BillSource.REFILL),
						),
					)
					.orderBy(desc(bill.createdAt))
					.limit(1)
			).at(0);

			if (!unpaidBill)
				throw httpError(
					HttpCode.NOT_FOUND,
					ErrorCode.BILL_NOT_FOUND,
					activeUser.language as Language,
				);

			const details = unpaidBill.details as BillDetails;
			const discountRate = calculateBatchDiscount(body.months);
			const batchAmount = calculateBatchBillAmount(
				unpaidBill.plan,
				details,
				body.months,
			);

			await Promise.allSettled([
				db
					.update(bill)
					.set({
						amount: batchAmount.toString(),
						months: body.months,
						details: {
							...details,
							discountRate,
							originalAmount: Number(unpaidBill.amount),
							months: body.months,
						},
					})
					.where(eq(bill.id, unpaidBill.id)),
				cache.del(UNPAID_KEY(activeUser.slug)),
			]);

			return {
				billId: unpaidBill.id,
				amount: batchAmount,
				months: body.months,
				discountRate,
			};
		},
		{
			detail: {
				summary: 'Batch billing',
				description:
					'Modify the current unpaid bill to cover multiple months in advance with a discount.',
			},
			body: tObject({
				months: t.Integer({
					minimum: 1,
					maximum: 24,
					description: 'Number of months to pay in advance.',
				}),
			}),
		},
	);
