import { cache, db } from '@api/env';
import {
	BillableEventType,
	bill,
	billableEvent,
	chunk,
	file,
	TraceType,
	tenant,
	trace,
	user,
} from '@api/schema';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { Elysia } from 'elysia';
import { HttpError } from 'elysia-logger';

export const billingRouter = new Elysia({ prefix: '/billing' })
	.put(
		'/generate-events',
		async () => {
			const storageByTenant = await db
				.select({
					slug: user.slug,
					consumption: sql<string>`(sum(octet_length(${chunk.text}) + 4096) / (1024.0 * 1024.0))::numeric`,
				})
				.from(chunk)
				.innerJoin(file, eq(file.id, chunk.fileId))
				.innerJoin(user, eq(user.id, file.userId))
				.groupBy(user.slug);

			if (!storageByTenant.length)
				throw HttpError.PreconditionFailed('NO_STORAGE_USED');

			return db.insert(billableEvent).values(
				storageByTenant.map((t) => ({
					type: BillableEventType.STORAGE,
					slug: t.slug,
					consumption: t.consumption,
				})),
			);
		},
		{
			detail: {
				summary: 'Generate billable events',
				description:
					'Generates chronological billable events. Expected to run chronologically at midnight.',
			},
		},
	)
	.put(
		'/generate-bills',
		async () => {
			const billData = await db
				.select({
					slug: tenant.slug,
					baseBill: tenant.baseBill,
					details: sql<Record<
						string,
						string
					> | null>`json_object_agg(${billableEvent.type}, sum(${billableEvent.consumption})) FILTER (WHERE ${billableEvent.slug} IS NOT NULL)`,
				})
				.from(tenant)
				.leftJoin(
					billableEvent,
					and(
						eq(billableEvent.slug, tenant.slug),
						isNull(billableEvent.billId),
					),
				)
				.groupBy(tenant.slug);

			return Promise.all([
				cache.del(...billData.map((t) => `tenant:${t.slug}:message-count`)),
				db.batch([
					db.insert(bill).values(
						billData.map((t) => ({
							slug: t.slug,
							details: {
								...(t.details ?? {}),
								baseBill: t.baseBill,
							},
						})),
					),
					db.delete(trace).where(eq(trace.type, TraceType.MESSAGE_SENT)),
				]),
			]);
		},
		{
			detail: {
				summary: 'Generate billing',
				description:
					'Generates bills for the month and resets consumptions. Expected to run chronologically each first day of the month.',
			},
		},
	);
