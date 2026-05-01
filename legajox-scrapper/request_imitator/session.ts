import { cache } from '../src/env';
import { getCiSession } from './get_cookies';

const SESSION_TTL_SECONDS = 15 * 60;

export class InvalidCookieError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'InvalidCookieError';
	}
}

export function isInvalidCookieError(err: unknown): err is InvalidCookieError {
	return err instanceof Error && err.name === 'InvalidCookieError';
}

export function legajoxHeaders(
	cookie: string,
	accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
) {
	return {
		Cookie: `ci_session=${cookie}`,
		'User-Agent':
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
		Accept: accept,
		'Accept-Language': 'es-AR,es;q=0.9',
	};
}

function sessionKey(user: string): string {
	return `legajox:session:${Bun.hash(user).toString(16)}`;
}

async function getCachedSession(user: string): Promise<string | null> {
	try {
		return await cache.get<string>(sessionKey(user));
	} catch (err) {
		console.warn(`[cache] GET session failed for ${user}:`, err);
		return null;
	}
}

async function saveCachedSession(user: string, cookie: string): Promise<void> {
	try {
		await cache.set(sessionKey(user), cookie, { ex: SESSION_TTL_SECONDS });
	} catch (err) {
		console.warn(`[cache] SET session failed for ${user}:`, err);
	}
}

export async function invalidateCachedSession(user: string): Promise<void> {
	try {
		await cache.del(sessionKey(user));
	} catch (err) {
		console.warn(`[cache] DEL session failed for ${user}:`, err);
	}
}

export async function getSessionCookie(
	user: string,
	password: string,
	options?: { forceRefresh?: boolean },
): Promise<string> {
	if (!options?.forceRefresh) {
		const cached = await getCachedSession(user);
		if (cached) return cached;
	}

	const cookie = await getCiSession(user, password);
	await saveCachedSession(user, cookie);
	return cookie;
}

export async function withSessionRetry<T>(
	user: string,
	password: string,
	run: (cookie: string) => Promise<T>,
): Promise<T> {
	let cookie = await getSessionCookie(user, password);

	try {
		return await run(cookie);
	} catch (err) {
		if (!isInvalidCookieError(err)) throw err;
		await invalidateCachedSession(user);
		cookie = await getSessionCookie(user, password, { forceRefresh: true });
		return await run(cookie);
	}
}

export function assertAuthenticatedHtml(html: string, message: string): void {
	if (
		html.includes('action="/login"') ||
		html.includes("action='/login'") ||
		html.includes('id="usr_email"') ||
		html.includes('id="usr_password"')
	) {
		throw new InvalidCookieError(message);
	}
}
