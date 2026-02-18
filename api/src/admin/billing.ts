import { authPlugin } from '@api/auth';
import { cache, db } from '@api/env';
import {
	BillableEventType,
	bill,
	billableEvent,
	PLANS,
	Plan,
	tenant,
	user,
} from '@api/schema';
import {
	generateBillForTenant,
	getEmbedUsage,
	getMessageUsage,
	getRefillMessages,
	getStorageUsage,
	getTenantPlan,
} from '@api/utils/billing';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { tObject } from '@api/utils/type';
import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { Elysia, t } from 'elysia';

export const billingRouter = new Elysia({ prefix: '/billing' })
	.use(authPlugin({ admin: true }))
	.get(
		'/usage',
		async ({ activeUser }) => {
			const plan = await getTenantPlan(activeUser.slug);
			const limits = PLANS[plan];

			const [storageUsage, embedUsage, messageUsage, refillMessages] =
				await Promise.all([
					getStorageUsage(activeUser.slug),
					getEmbedUsage(activeUser.slug),
					getMessageUsage(activeUser.slug),
					getRefillMessages(activeUser.slug),
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
					.where(eq(bill.slug, activeUser.slug))
					.orderBy(desc(bill.createdAt))
					.limit(1)
			)[0]!,
		{ detail: { summary: 'Read last bill' } },
	)
	.put(
		'/refill',
		async ({ activeUser, body }) => {
			await db.insert(billableEvent).values({
				type: BillableEventType.REFILL,
				slug: activeUser.slug,
				userId: activeUser.id,
				consumption: body.messages.toString(),
			});
			await cache.del(`tenant:${activeUser.slug}:refill-messages`);
		},
		{
			detail: { summary: 'Refill with messages' },
			body: tObject({ messages: t.Integer({ min: 1 }) }),
		},
	)
	.get(
		'/bills',
		({ activeUser }) =>
			db
				.select()
				.from(bill)
				.where(eq(bill.slug, activeUser.slug))
				.orderBy(desc(bill.createdAt)),
		{ detail: { summary: 'List bills' } },
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

			if (newLimits.baseBill < currentLimits.baseBill) {
				const unpaidBills = await db
					.select({ id: bill.id })
					.from(bill)
					.where(and(eq(bill.slug, activeUser.slug), eq(bill.paid, false)))
					.limit(1);

				if (unpaidBills.length > 0)
					throw httpError(
						HttpCode.PRECONDITION_FAILED,
						ErrorCode.PLAN_CHANGE_UNPAID_BILLS,
						activeUser.language,
					);
			}

			await db
				.update(tenant)
				.set({ plan: body.plan })
				.where(eq(tenant.slug, activeUser.slug));

			await generateBillForTenant(activeUser.slug, body.plan);

			if (currentLimits.hasApiAccess && !newLimits.hasApiAccess) {
				const usersWithKeys = await db
					.select({ id: user.id })
					.from(user)
					.where(and(eq(user.slug, activeUser.slug), isNotNull(user.apiKey)));

				if (usersWithKeys.length > 0)
					await cache.del(...usersWithKeys.map((u) => `apikey:${u.id}`));
			}

			return { plan: body.plan };
		},
		{
			detail: { summary: 'Change tenant plan' },
			body: tObject({ plan: t.Enum(Plan) }),
		},
	)
	.get(
		'/usd-ars-quote',
		async ({ activeUser }) => {
			const res = await fetch('https://dolarapi.com/v1/dolares');

			if (!res.ok)
				throw httpError(
					HttpCode.CONFLICT,
					ErrorCode.EXTERNAL_ERROR,
					activeUser.language,
				);

			const arr: { casa: string; venta: number }[] = await res.json();
			const oficial = arr.find((x) => x.casa === 'oficial');

			if (!oficial?.venta)
				throw httpError(
					HttpCode.CONFLICT,
					ErrorCode.EXTERNAL_ERROR,
					activeUser.language,
				);

			return oficial?.venta;
		},
		{
			detail: { summary: 'Get current USD-ARS quote' },
		},
	);
