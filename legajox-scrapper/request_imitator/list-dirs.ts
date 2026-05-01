import { getCiSession } from './get_cookies';
import { InvalidCookieError, legajoxHeaders } from './session';

const URL_DOCS = 'https://app.legajox.com/documentos';

export interface Carpeta {
	id: string;
	nombre: string;
	href: string;
	cantidadArchivos: number;
}

export async function fetchDocs(cookie: string): Promise<string> {
	const response = await fetch(URL_DOCS, {
		headers: legajoxHeaders(cookie),
	});

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}

	if (response.url.includes('/login')) {
		throw new InvalidCookieError('Session invalid — redirected to login page');
	}

	const html = await response.text();

	if (html.includes('action="/login"') || html.includes("action='/login'")) {
		throw new InvalidCookieError(
			'Session invalid — login form found in response',
		);
	}

	if (!/init_funtion\(\d+\)/.test(html)) {
		throw new InvalidCookieError(
			'Session invalid — page returned without user context',
		);
	}

	return html;
}

export function parseDirs(html: string): Carpeta[] {
	const carpetas: Carpeta[] = [];

	// Split on each folder card
	const parts = html.split('class="px-3 col-12 col-sm-4 mb-3 ddcur"');

	for (let i = 1; i < parts.length; i++) {
		const card = parts[i];

		// href="/files/edit/14746"
		const hrefMatch = card.match(/href="(\/files\/edit\/(\d+))"/);
		if (!hrefMatch) continue;

		const href = hrefMatch[1];
		const id = hrefMatch[2];

		// Folder name from <h6 class="m-0">NAME</h6>
		const nameMatch = card.match(/<h6 class="m-0">([^<]+)<\/h6>/);
		const nombre = nameMatch ? nameMatch[1].trim().replace(/\s+/g, ' ') : '';

		// File count from the first <span> inside .fileqty
		const qtyMatch = card.match(
			/class="[^"]*fileqty[^"]*"[^>]*>[\s\S]*?<span[^>]*>(\d+)<\/span>/,
		);
		const cantidadArchivos = qtyMatch ? parseInt(qtyMatch[1], 10) : 0;

		carpetas.push({ id, nombre, href, cantidadArchivos });
	}

	return carpetas;
}

async function refreshCookie(): Promise<string> {
	const user = process.env.LEGAJOX_USER;
	const password = process.env.LEGAJOX_PASSWORD;

	if (!user || !password) {
		throw new Error(
			'LEGAJOX_USER and LEGAJOX_PASSWORD must be set in .env to auto-refresh the cookie.',
		);
	}

	console.log(`[auth] Logging in as ${user} to obtain a fresh cookie…`);
	const fresh = await getCiSession(user, password);
	console.log('[auth] Fresh ci_session obtained.');
	return fresh;
}

async function main(): Promise<void> {
	const [, , cookieArg] = process.argv;

	if (!cookieArg) {
		console.error(
			'Usage: bun request_imitator/list-dirs.ts <ci_session_cookie>',
		);
		process.exit(1);
	}

	let cookie = cookieArg;

	console.log('Fetching document folders…');

	let html: string;
	try {
		html = await fetchDocs(cookie);
	} catch (err) {
		if (err instanceof InvalidCookieError) {
			console.warn(`[auth] ${err.message}. Attempting to refresh…`);
			try {
				cookie = await refreshCookie();
				console.log('[auth] Retrying fetch with fresh cookie…');
				html = await fetchDocs(cookie);
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

	const carpetas = parseDirs(html!);

	console.log(`\n=== Carpetas encontradas: ${carpetas.length} ===\n`);
	for (const c of carpetas) {
		console.log(
			`  [${c.id}] ${c.nombre}  (${c.cantidadArchivos} archivos)  →  ${c.href}`,
		);
	}
	console.log();
}

if (import.meta.main) {
	main();
}
