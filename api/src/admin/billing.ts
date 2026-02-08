import { authPlugin } from '@api/auth';
import { cache, db } from '@api/env';
import { BillableEventType, bill, billableEvent, tenant } from '@api/schema';
import { getMessageCount } from '@api/utils/chat';
import { tObject } from '@api/utils/type';
import { and, desc, eq, isNull, sql, sum } from 'drizzle-orm';
import { Elysia, t } from 'elysia';

export const billingRouter = new Elysia({ prefix: '/billing' })
	.use(authPlugin({ admin: true }))
	.get(
		'/messages',
		async ({ activeUser }) => getMessageCount(activeUser.slug),
		{ detail: { summary: 'Read messages consumption' } },
	)
	.get(
		'/embeds',
		async ({ activeUser }) =>
			(
				await db
					.select({ consumption: sum(billableEvent.consumption) })
					.from(billableEvent)
					.where(
						and(
							eq(billableEvent.type, BillableEventType.EMBED),
							eq(billableEvent.slug, activeUser.slug),
							isNull(billableEvent.billId),
						),
					)
			)[0]!.consumption,
		{ detail: { summary: 'Read embeddings consumption' } },
	)
	.get(
		'/storage',
		async ({ activeUser }) =>
			(
				await db
					.select({ consumption: sum(billableEvent.consumption) })
					.from(billableEvent)
					.where(
						and(
							eq(billableEvent.type, BillableEventType.STORAGE),
							eq(billableEvent.slug, activeUser.slug),
							isNull(billableEvent.billId),
						),
					)
			)[0]!.consumption,
		{ detail: { summary: 'Read storage consumption' } },
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
		async ({ activeUser, body }) =>
			Promise.all([
				db.batch([
					db
						.update(tenant)
						.set({
							messageLimit: sql`${tenant.messageLimit} + ${body.messages}`,
						})
						.where(eq(tenant.slug, activeUser.slug)),
					db.insert(billableEvent).values({
						type: BillableEventType.REFILL,
						slug: activeUser.slug,
						userId: activeUser.id,
						consumption: body.messages.toString(),
					}),
				]),
				cache.del(`tenant:${activeUser.slug}:message-count`),
			]),
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
	);
