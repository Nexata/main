import type { Page } from 'puppeteer';
import { cache } from './env';

/**
 * Generic cache-aside helper. Returns cached data if available,
 * otherwise executes `fn`, stores the result with the given TTL, and returns it.
 */
export async function cached<T>(
	key: string,
	ttlSeconds: number,
	fn: () => Promise<T>,
	options?: { nocache?: boolean },
): Promise<{ data: T; _cache: { hit: boolean; key: string; ttl: number } }> {
	if (!options?.nocache) {
		try {
			const hit = await cache.get<T>(key);
			if (hit !== null && hit !== undefined) {
				return { data: hit, _cache: { hit: true, key, ttl: ttlSeconds } };
			}
		} catch (err) {
			console.warn(`[cache] GET ${key} failed:`, err);
		}
	}

	const data = await fn();

	try {
		await cache.set(key, data, { ex: ttlSeconds });
	} catch (err) {
		console.warn(`[cache] SET ${key} failed:`, err);
	}

	return { data, _cache: { hit: false, key, ttl: ttlSeconds } };
}

// ── Session cookie caching ──────────────────────────────────────────────────

const SESSION_TTL = 15 * 60; // 15 minutes

function sessionKey(user: string): string {
	return `session:${user}`;
}

/**
 * Attempts to restore a cached Legajox session on the page.
 * Returns true if cookies were set (caller should verify session validity).
 */
export async function restoreSession(
	page: Page,
	user: string,
): Promise<boolean> {
	try {
		const cookies = await cache.get<object[]>(sessionKey(user));
		if (!cookies || cookies.length === 0) return false;
		await page.setCookie(...(cookies as Parameters<Page['setCookie']>[0][]));
		return true;
	} catch (err) {
		console.warn(`[cache] restoreSession failed for ${user}:`, err);
		return false;
	}
}

/**
 * Saves the current page cookies to cache for session reuse.
 */
export async function saveSession(page: Page, user: string): Promise<void> {
	try {
		const cookies = await page.cookies();
		await cache.set(sessionKey(user), cookies, { ex: SESSION_TTL });
	} catch (err) {
		console.warn(`[cache] saveSession failed for ${user}:`, err);
	}
}

/**
 * Invalidates a cached session.
 */
export async function invalidateSession(user: string): Promise<void> {
	try {
		await cache.del(sessionKey(user));
	} catch (err) {
		console.warn(`[cache] invalidateSession failed for ${user}:`, err);
	}
}
