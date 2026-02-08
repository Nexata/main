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
		'/usage',
		async ({ activeUser }) => {
			const [consumption, limits] = await Promise.all([
				db
					.select({
						type: billableEvent.type,
						consumption: sum(billableEvent.consumption),
					})
					.from(billableEvent)
					.where(
						and(
							eq(billableEvent.slug, activeUser.slug),
							isNull(billableEvent.billId),
						),
					)
					.groupBy(billableEvent.type),
				db
					.select({
						storageLimit: tenant.storageLimit,
						embedLimit: tenant.embedLimit,
						usageBasedBilling: tenant.usageBasedBilling,
					})
					.from(tenant)
					.where(eq(tenant.slug, activeUser.slug)),
			]);

			const embeds = Number(
				consumption.find((c) => c.type === BillableEventType.EMBED)
					?.consumption ?? 0,
			);

			const storage = Number(
				consumption.find((c) => c.type === BillableEventType.STORAGE)
					?.consumption ?? 0,
			);

			const { storageLimit, embedLimit, usageBasedBilling } = limits.at(0)!;

			return {
				embeds: { used: embeds, limit: embedLimit },
				storage: { used: storage, limit: storageLimit },
				usageBasedBilling,
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
