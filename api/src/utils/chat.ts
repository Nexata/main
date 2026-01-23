import { cache, db } from '@api/env';
import { TraceType, tenant, trace, user } from '@api/schema';
import { coalesce } from '@api/utils/sql';
import { and, count, eq, sql } from 'drizzle-orm';

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
				count: coalesce(count(trace.id), sql<number>`0`),
			})
			.from(tenant)
			.leftJoin(trace, eq(trace.type, TraceType.MESSAGE_SENT))
			.leftJoin(user, eq(user.id, trace.userId))
			.where(and(eq(tenant.slug, slug), eq(user.slug, slug)))
			.groupBy(tenant.slug)
	).at(0)!;

	await cache.set(`tenant:${slug}:message-count`, result, { ex: 60 * 60 });
	return result;
}
