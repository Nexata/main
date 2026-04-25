import type { Browser, Page } from 'puppeteer';
import { launchBrowser } from '../browser.js';
import { login } from '../validate_credentials.js';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const BASE_URL = 'https://app.legajox.com';

// ── Types ────────────────────────────────────────────────────────────────────

export interface FileSearchResult {
	carpeta: string; // folder name from span[data-original-text]
	nombre: string; // file name from a[data-original-text]
	href: string; // e.g. /enviar_doc/45812
	url: string; // full URL
}

// ── Scraping ─────────────────────────────────────────────────────────────────

async function searchFiles(
	page: Page,
	query: string,
): Promise<FileSearchResult[]> {
	console.log(`[file-search] Navigating to /documentos…`);
	await page.goto(`${BASE_URL}/documentos`, {
		timeout: 60_000,
		waitUntil: 'domcontentloaded',
	});
	await page.waitForNetworkIdle({ timeout: 15_000 }).catch(() => {});

	// Wait for the search input to be ready
	await page.waitForSelector('#file-search', {
		visible: true,
		timeout: 15_000,
	});

	console.log(`[file-search] Typing query: "${query}"`);
	await page.click('#file-search');
	await page.type('#file-search', query, { delay: 80 });

	// Wait for the results list to appear and populate
	console.log(`[file-search] Waiting for results…`);
	try {
		await page.waitForSelector('#file-list li', {
			visible: true,
			timeout: 10_000,
		});
	} catch {
		console.log(`[file-search] No results found for "${query}".`);
		return [];
	}

	// Give the list time to fully populate (debounced search)
	await delay(800);

	const results = await page.$$eval(
		'#file-list li',
		(items, baseUrl) =>
			items.map((li) => {
				const carpetaEl = li.querySelector<HTMLElement>('span.busc-span');
				const fileEl = li.querySelector<HTMLAnchorElement>('a.busc-span');

				const carpeta =
					carpetaEl?.getAttribute('data-original-text')?.trim() ??
					carpetaEl?.textContent?.trim() ??
					'';
				const nombre =
					fileEl?.getAttribute('data-original-text')?.trim() ??
					fileEl?.textContent?.trim() ??
					'';
				const href = fileEl?.getAttribute('href') ?? '';
				const url = href ? `${baseUrl}${href}` : '';

				return { carpeta, nombre, href, url };
			}),
		BASE_URL,
	);

	return results;
}

// ── Exported API function ───────────────────────────────────────────────────

export interface FileSearchResponse {
	success: boolean;
	results: FileSearchResult[];
	errors: string[];
}

export async function scrapeFileSearch(
	user: string,
	password: string,
	query: string,
	signal?: AbortSignal,
): Promise<FileSearchResponse> {
	const errors: string[] = [];
	let browser: Browser | null = null;
	try {
		browser = await launchBrowser(signal);
		const page = await browser.newPage();
		await login(page, user, password);
		const results = await searchFiles(page, query);
		return { success: true, results, errors };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		if (signal?.aborted) {
			errors.push('Scrape aborted');
			return { success: false, results: [], errors };
		}
		errors.push(msg);
		return { success: false, results: [], errors };
	} finally {
		await browser?.close().catch(() => {});
	}
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
	const [, , user, password, ...queryParts] = process.argv;
	const query = queryParts.join(' ');

	if (!user || !password || !query) {
		console.error(
			'Usage: bun scripts/documents/file-search.ts <user> <password> <query>',
		);
		console.error(
			'Example: bun scripts/documents/file-search.ts user@mail.com pass123 "contrato"',
		);
		process.exit(1);
	}

	let browser: Browser | null = null;
	try {
		browser = await launchBrowser();
		const page = await browser.newPage();

		console.log(`[file-search] Logging in as ${user}…`);
		await login(page, user, password);
		console.log(`[file-search] Login OK.`);

		const results = await searchFiles(page, query);

		console.log(`\n=== Resultados para "${query}": ${results.length} ===\n`);
		for (let i = 0; i < results.length; i++) {
			const r = results[i];
			console.log(`  [${i + 1}] ${r.nombre}`);
			console.log(`       Carpeta: ${r.carpeta}`);
			console.log(`       URL:     ${r.url}`);
		}
		console.log();

		process.exit(0);
	} catch (err) {
		console.error(
			'[file-search] Error:',
			err instanceof Error ? err.message : String(err),
		);
		process.exit(1);
	} finally {
		await browser?.close().catch(() => {});
	}
}

const isMain =
	(import.meta as { main?: boolean }).main ??
	process.argv[1]?.endsWith('file-search.ts');
if (isMain) main();
