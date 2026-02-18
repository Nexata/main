import { cache, db } from '@api/env';
import { type Language, tenant } from '@api/schema';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { eq, exists } from 'drizzle-orm';

export async function isSlugAvailable(slug: string): Promise<boolean> {
	const cacheKey = `slug-check:${slug}`;
	const cached = await cache.get<boolean>(cacheKey);
	if (cached !== null) return cached;

	const [result] = await db
		.select({
			e: exists(
				db.select({ s: tenant.slug }).from(tenant).where(eq(tenant.slug, slug)),
			),
		})
		.from(tenant);

	const available = !result?.e;
	await cache.set(cacheKey, available, { ex: 120 });
	return available;
}

export async function resolveSlug(
	slug: string | null | undefined,
	displayName: string,
	language?: Language,
): Promise<string> {
	if (slug && (await isSlugAvailable(slug))) return slug;

	const candidate = displayName
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '')
		.slice(0, 16);

	if (candidate.length >= 2 && (await isSlugAvailable(candidate)))
		return candidate;

	for (let i = 0; i < 10; i++) {
		const random = crypto
			.randomUUID()
			.replace(/-/g, '')
			.slice(0, 6 + Math.floor(Math.random() * 3));
		if (await isSlugAvailable(random)) return random;
	}

	throw httpError(HttpCode.CONFLICT, ErrorCode.SLUG_UNAVAILABLE, language);
}
