import { db } from '@api/env';
import {
	BillableEventType,
	billableEvent,
	chunk,
	file,
	user,
} from '@api/schema';
import {
	generateBillForTenant,
	getTenantsDueForBilling,
} from '@api/utils/billing';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { eq, sql } from 'drizzle-orm';
import { Elysia } from 'elysia';

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
				throw httpError(
					HttpCode.PRECONDITION_FAILED,
					ErrorCode.NO_STORAGE_USED,
				);

			return db
				.insert(billableEvent)
				.values(
					storageByTenant.map((t) => ({
						type: BillableEventType.STORAGE,
						slug: t.slug,
						consumption: t.consumption,
					})),
				)
				.returning({ id: billableEvent.id });
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
			const dueTenants = await getTenantsDueForBilling();
			return await Promise.all(
				dueTenants.map(async (t) => {
					const result = await generateBillForTenant(t.slug, t.plan);
					return { slug: t.slug, ...result };
				}),
			);
		},
		{
			detail: {
				summary: 'Generate billing',
				description:
					'Generates bills for tenants due for billing and advances their billingAt. Expected to run once a day at midnight.',
			},
		},
	);
