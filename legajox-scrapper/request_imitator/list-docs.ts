import { getCiSession } from './get_cookies';
import { InvalidCookieError, legajoxHeaders } from './session';

const BASE_URL = 'https://app.legajox.com/files/edit';

export interface Documento {
	nombre: string;
	url: string;
	fecha: string;
	firmado: boolean;
}

export async function fetchDocsPage(
	folderId: string,
	cookie: string,
): Promise<string> {
	const response = await fetch(`${BASE_URL}/${folderId}`, {
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

export function parseDocs(html: string): Documento[] {
	const documentos: Documento[] = [];

	// Split on each table row
	const rows = html.split('<tr>');

	for (let i = 1; i < rows.length; i++) {
		const row = rows[i];

		// Must contain a file-name-link to be a document row
		if (!row.includes('file-name-link')) continue;

		// Full file name from the title attribute (most reliable)
		const titleMatch = row.match(
			/title="([^"]+\.(?:pdf|docx?|xlsx?|png|jpe?g|gif|zip|rar)[^"]*)"/i,
		);
		// Fallback to truncated link text if no title
		const linkTextMatch = row.match(
			/class="[^"]*file-name-link[^"]*"[^>]*>([^<]+)<\/a>/,
		);
		const nombre = titleMatch
			? titleMatch[1].trim()
			: linkTextMatch
				? linkTextMatch[1].trim()
				: '';

		// href URL on the file-name-link anchor
		const urlMatch = row.match(
			/class="[^"]*file-name-link[^"]*"[^>]*href="([^"]+)"/,
		);
		const url = urlMatch ? urlMatch[1].trim() : '';

		// Date: the visible text is after the <span class="ocultar">TIMESTAMP</span> inside the 3rd <td>
		// We strip the hidden timestamp span and grab the remaining text
		const dateColMatch = row.match(
			/<span class="ocultar">\d+\s*<\/span>\s*([\d/: a-zA-Z]+hs)/,
		);
		const fecha = dateColMatch ? dateColMatch[1].trim() : '';

		// Signed: 4th <td> contains <span class="c-verde ...">Si</span> if signed
		const firmado = row.includes('c-verde') && />\s*Si\s*</.test(row);

		if (!url) continue;

		documentos.push({ nombre, url, fecha, firmado });
	}

	return documentos;
}

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

async function main(): Promise<void> {
	const args = process.argv.slice(2);

	if (args.length < 2) {
		console.error(
			'Usage: bun request_imitator/list-docs.ts <ci_session_cookie> <folder_id>',
		);
		console.error('Example: bun request_imitator/list-docs.ts <cookie> 14746');
		process.exit(1);
	}

	let cookie = args[0];
	const folderId = args[1];

	if (!/^\d+$/.test(folderId)) {
		console.error(
			`Invalid folder ID "${folderId}" — must be a positive integer.`,
		);
		process.exit(1);
	}

	console.log(`Fetching documents in folder ${folderId}…`);

	let html: string;
	try {
		html = await fetchDocsPage(folderId, cookie);
	} catch (err) {
		if (err instanceof InvalidCookieError) {
			console.warn(`[auth] ${err.message}. Attempting to refresh…`);
			try {
				cookie = await refreshCookie();
				console.log('[auth] Retrying fetch with fresh cookie…');
				html = await fetchDocsPage(folderId, cookie);
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

	const documentos = parseDocs(html!);

	console.log(`\n=== Documentos encontrados: ${documentos.length} ===\n`);
	for (let i = 0; i < documentos.length; i++) {
		const d = documentos[i];
		console.log(
			`  📄 [${i + 1}] ${d.nombre}  |  ${d.fecha}  |  Firmado: ${d.firmado ? 'Si' : 'No'}  →  ${d.url}`,
		);
	}
	console.log();
}

if (import.meta.main) {
	main();
}
