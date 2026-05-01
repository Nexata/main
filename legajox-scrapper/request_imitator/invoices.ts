import { getCiSession } from './get_cookies';
import { InvalidCookieError, legajoxHeaders } from './session';

const URL_INVOICES = 'https://app.legajox.com/mis_facturas';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Invoice {
	numero: string;
	periodo: string;
	fecha: string;
	importe: string;
	estado: string;
	url: string;
}

// ── Fetch ────────────────────────────────────────────────────────────────────

export async function fetchInvoicesPage(cookie: string): Promise<string> {
	const response = await fetch(URL_INVOICES, {
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

// ── Parse ────────────────────────────────────────────────────────────────────

export function parseInvoices(html: string): Invoice[] {
	const invoices: Invoice[] = [];

	// Each invoice row starts with <tr> and contains the download link in the first <td>
	// Split on <tr> boundaries — rows with a stored/planpagos link are invoice rows
	const rows = html.split('<tr>');

	for (let i = 1; i < rows.length; i++) {
		const row = rows[i];

		// Only rows with a stored planpagos PDF link are invoice rows
		if (!row.includes('stored/planpagos')) continue;

		// 1. Download URL — href on the <a target="_blank"> in the first td
		const urlMatch = row.match(
			/href="(https:\/\/app\.legajox\.com\/stored\/planpagos\/[^"]+)"/,
		);
		const url = urlMatch ? urlMatch[1] : '';

		// Split the row into td segments for positional parsing
		const tds = row.split('<td');

		// td[1] = download link (already captured above)
		// td[2] = fecha  class="text-center">DD/MM/YYYY</td>
		// td[3] = numero e.g. A-0001-00000305
		// td[4] = periodo e.g. Abril 2026
		// td[5] = estado  <span class='activo'>Pagado</span>
		// td[6] = importe e.g. 434.273,84

		const extractText = (td: string) =>
			td
				.replace(/<[^>]+>/g, '')
				.replace(/\s+/g, ' ')
				.trim();

		const fecha = tds[2] ? extractText(tds[2]) : '';
		const numero = tds[3] ? extractText(tds[3]) : '';
		const periodo = tds[4] ? extractText(tds[4]) : '';

		// Estado is inside a <span> tag — just grab inner text
		const estadoMatch = tds[5]
			? tds[5].match(/<span[^>]*>\s*([^<]+)\s*<\/span>/)
			: null;
		const estado = estadoMatch
			? estadoMatch[1].trim()
			: tds[5]
				? extractText(tds[5])
				: '';

		const importe = tds[6] ? extractText(tds[6]) : '';

		if (!numero && !url) continue;

		invoices.push({ numero, periodo, fecha, importe, estado, url });
	}

	return invoices;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

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

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
	const [, , cookieArg] = process.argv;

	if (!cookieArg) {
		console.error(
			'Usage: bun request_imitator/invoices.ts <ci_session_cookie>',
		);
		process.exit(1);
	}

	let cookie = cookieArg;

	console.log('Fetching invoices…');

	let html: string;
	try {
		html = await fetchInvoicesPage(cookie);
	} catch (err) {
		if (err instanceof InvalidCookieError) {
			console.warn(`[auth] ${err.message}. Attempting to refresh…`);
			try {
				cookie = await refreshCookie();
				console.log('[auth] Retrying with fresh cookie…');
				html = await fetchInvoicesPage(cookie);
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

	const invoices = parseInvoices(html!);

	console.log(`\n=== Facturas encontradas: ${invoices.length} ===\n`);
	for (let i = 0; i < invoices.length; i++) {
		const inv = invoices[i];
		console.log(
			`  [${i + 1}] ${inv.numero}  |  ${inv.periodo}  |  ${inv.fecha}  |  $${inv.importe}  |  ${inv.estado}`,
		);
		console.log(`       PDF: ${inv.url}`);
	}
	console.log();
}

if (import.meta.main) {
	main();
}
