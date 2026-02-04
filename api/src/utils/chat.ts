import { cache, db } from '@api/env';
import { TraceType, tenant, trace, user } from '@api/schema';
import { coalesce } from '@api/utils/sql';
import { and, eq, sql, sum } from 'drizzle-orm';

export async function getMessageCount(
	slug: string,
): Promise<{ limit: number; count: number }> {
	const cached = await cache.get<{ limit: number; count: number }>(
		`tenant:${slug}:message-count`,
	);
	if (cached) return cached;

	const result = (
		await db
			.select({
				limit: tenant.messageLimit,
				count: coalesce(
					sum(
						sql<number>`case when ${trace.metadata}->>'extraReason' = 'true' then 2 else 1 end`,
					),
					sql<number>`0`,
				),
			})
			.from(tenant)
			.innerJoin(user, eq(user.slug, tenant.slug))
			.leftJoin(
				trace,
				and(eq(trace.userId, user.id), eq(trace.type, TraceType.MESSAGE_SENT)),
			)
			.where(eq(tenant.slug, slug))
			.groupBy(tenant.slug)
	).at(0)!;

	const c = { ...result, count: Number(result.count) };

	await cache.set(`tenant:${slug}:message-count`, c, { ex: 60 * 60 });
	return c;
}
