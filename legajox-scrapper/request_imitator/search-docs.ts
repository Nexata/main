import { getCiSession } from './get_cookies';
import { InvalidCookieError, legajoxHeaders } from './session';

const BASE_URL = 'https://app.legajox.com';
const BASE_HOST = 'app.legajox.com';

// ── Types ────────────────────────────────────────────────────────────────────

export interface FileSearchResult {
	carpeta: string;
	nombre: string;
	href: string;
	url: string;
}

// Matches the raw JSON shape returned by the endpoint
interface ApiSearchResult {
	carpeta: string;
	path: string;
	name: string;
	cf_id: string;
	href?: string;
	url?: string;
	download_url?: string;
}

// ── Fetch ────────────────────────────────────────────────────────────────────

export async function fetchSearchResults(
	query: string,
	cookie: string,
): Promise<FileSearchResult[]> {
	const url = `${BASE_URL}/search_docs/0?query=${encodeURIComponent(query)}`;

	const response = await fetch(url, {
		headers: {
			...legajoxHeaders(
				cookie,
				'application/json, text/javascript, */*; q=0.01',
			),
			Accept: 'application/json, text/javascript, */*; q=0.01',
			'X-Requested-With': 'XMLHttpRequest',
		},
	});

	if (response.url.includes('/login')) {
		throw new InvalidCookieError('Session invalid — redirected to login page');
	}

	const contentType = response.headers.get('content-type') ?? '';

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}

	// If the server returned HTML instead of JSON, the session has expired
	if (
		!contentType.includes('application/json') &&
		!contentType.includes('javascript')
	) {
		const text = await response.text();
		if (text.includes('action="/login"') || text.includes("action='/login'")) {
			throw new InvalidCookieError(
				'Session invalid — login form found in response',
			);
		}
		if (!/init_funtion\(\d+\)/.test(text)) {
			throw new InvalidCookieError(
				'Session invalid — non-JSON response without user context',
			);
		}
		throw new Error(`Unexpected content-type "${contentType}" — expected JSON`);
	}

	const data = (await response.json()) as ApiSearchResult[];

	return data.flatMap((item) => {
		const href = normalizeSearchHref(item);
		if (!href) return [];

		return {
			carpeta: item.carpeta,
			nombre: item.name,
			href,
			url: `${BASE_URL}${href}`,
		};
	});
}

function normalizeSearchHref(item: ApiSearchResult): string | null {
	const candidates = [
		item.href,
		item.url,
		item.download_url,
		item.path,
		item.cf_id ? `/enviar_doc/${item.cf_id}` : undefined,
	];

	for (const candidate of candidates) {
		if (!candidate) continue;
		const href = normalizeLegajoxFileHref(candidate);
		if (href) return href;
	}

	return null;
}

function normalizeLegajoxFileHref(value: string): string | null {
	try {
		const parsed = new URL(value, BASE_URL);
		if (parsed.host !== BASE_HOST) return null;
		if (parsed.pathname.includes('/login')) return null;
		if (parsed.pathname.startsWith('/files/edit/')) return null;
		return parsed.pathname + parsed.search;
	} catch {
		return null;
	}
}

// ── Auth ─────────────────────────────────────────────────────────────────────

async function refreshCookie(): Promise<string> {
	const user = process.env.DEFAULT_USER;
	const password = process.env.DEFAULT_PASSWORD;

	if (!user || !password) {
		throw new Error(
			'DEFAULT_USER and DEFAULT_PASSWORD must be set in .env to auto-refresh the cookie.',
		);
	}

	console.log(`[auth] Logging in as ${user} to obtain a fresh cookie…`);
	const fresh = await getCiSession(user, password);
	console.log('[auth] Fresh ci_session obtained.');
	return fresh;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
	const args = process.argv.slice(2);

	if (args.length < 2) {
		console.error(
			'Usage: bun request_imitator/search-docs.ts <ci_session_cookie> <query>',
		);
		console.error(
			'Example: bun request_imitator/search-docs.ts <cookie> "contrato"',
		);
		process.exit(1);
	}

	let cookie = args[0];
	const query = args.slice(1).join(' ');

	console.log(`[file-search] Searching for: "${query}"`);

	let results: FileSearchResult[];
	try {
		results = await fetchSearchResults(query, cookie);
	} catch (err) {
		if (err instanceof InvalidCookieError) {
			console.warn(`[auth] ${err.message}. Attempting to refresh…`);
			try {
				cookie = await refreshCookie();
				console.log('[auth] Retrying search with fresh cookie…');
				results = await fetchSearchResults(query, cookie);
			} catch (retryErr) {
				console.error(
					`[error] Retry failed: ${retryErr instanceof Error ? retryErr.message : retryErr}`,
				);
				process.exit(1);
			}
		} else {
			console.error(`[error] ${err instanceof Error ? err.message : err}`);
			process.exit(1);
		}
	}

	console.log(`\n=== Resultados para "${query}": ${results!.length} ===\n`);
	for (let i = 0; i < results!.length; i++) {
		const r = results![i];
		console.log(`  [${i + 1}] ${r.nombre}`);
		console.log(`       Carpeta: ${r.carpeta}`);
		console.log(`       URL:     ${r.url}`);
	}
	console.log();
}

if (import.meta.main) {
	main();
}
