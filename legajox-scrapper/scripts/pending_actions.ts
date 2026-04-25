import { fileURLToPath } from 'node:url';
import type { Browser, Page } from 'puppeteer';
import { launchBrowser } from './browser';
import { login } from './validate_credentials';

// ============================================================
// CONFIG
// ============================================================

const PAGE_URL =
	'https://app.legajox.com/acciones_pendientes/todas_acciones_pendientes';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ============================================================
// TYPES
// ============================================================

export interface Liquidacion {
	id: string;
	descripcion: string;
	estado: string;
	pdfUrl: string;
}

export interface ScrapeResult {
	success: boolean;
	liquidaciones: Liquidacion[];
	total: number;
	errors: string[];
	outputFile: string | null;
}

// ============================================================
// CORE — exportable for API integration
// ============================================================

export async function scrapeLiquidaciones(
	user: string,
	password: string,
	options?: { search?: string | null; page?: number | null },
	signal?: AbortSignal,
): Promise<ScrapeResult> {
	const errors: string[] = [];
	let browser: Browser | null = null;

	try {
		browser = await launchBrowser(signal);

		const page = await browser.newPage();

		// — Login —
		console.log('[liquidaciones] Signing in...');
		await login(page, user, password);
		console.log(`[liquidaciones] Signed in — ${page.url()}`);

		// — Navigate to pending actions page —
		console.log('[liquidaciones] Navigating to acciones pendientes...');
		await page.goto(PAGE_URL, {
			waitUntil: 'domcontentloaded',
			timeout: 60_000,
		});
		await page.waitForNetworkIdle({ timeout: 30_000 }).catch(() => {});

		// — Check for access error (SweetAlert2 or page-level error) —
		let pageAccessible = true;
		try {
			await page.waitForSelector('.swal2-icon.swal2-error', {
				visible: true,
				timeout: 2_000,
			});
			pageAccessible = false;
		} catch {
			// No error alert — page is accessible
		}

		if (!pageAccessible) {
			console.warn(
				'[liquidaciones] Access denied — user does not have permissions for this page.',
			);
			errors.push(
				'Access denied: user does not have permissions for liquidaciones.',
			);
			return {
				success: true,
				liquidaciones: [],
				total: 0,
				errors,
				outputFile: null,
			};
		}

		// Also check if the table exists at all
		try {
			await page.waitForSelector('#DataTables_Table_0', {
				visible: true,
				timeout: 15_000,
			});
		} catch {
			console.warn(
				'[liquidaciones] Table not found — possibly no permissions or no data.',
			);
			errors.push('Table #DataTables_Table_0 not found on the page.');
			return {
				success: true,
				liquidaciones: [],
				total: 0,
				errors,
				outputFile: null,
			};
		}

		// — Apply search query —
		if (options?.search) {
			const q = options.search.trim();
			console.log(`[liquidaciones] Applying search filter: "${q}"`);
			try {
				const searchSelector =
					'input[type="search"][aria-controls="DataTables_Table_0"]';
				await page.waitForSelector(searchSelector, { timeout: 5_000 });
				await page.click(searchSelector, { clickCount: 3 });
				await page.type(searchSelector, q);
				await delay(500);
				await page.waitForNetworkIdle({ timeout: 15_000 }).catch(() => {});
			} catch (err) {
				const msg = `Could not apply search filter: ${err instanceof Error ? err.message : err}`;
				console.warn(`[liquidaciones] ${msg}`);
				errors.push(msg);
			}
		}

		// — Extract total count from info text —
		let totalRecords = 0;
		try {
			const infoText = await page.$eval(
				'#DataTables_Table_0_info',
				(el) => (el as HTMLElement).innerText,
			);
			const match = infoText.match(/de\s+(\d+)\s+registros/i);
			if (match) totalRecords = parseInt(match[1], 10);
			console.log(`[liquidaciones] Total registros: ${totalRecords}`);
		} catch {
			console.warn('[liquidaciones] Could not read total records count.');
		}

		const targetPage = options?.page ?? null;

		// — Scrape all pages (or a specific page) —
		const allLiquidaciones: Liquidacion[] = [];
		let currentPage = 1;

		// If a specific page is requested, navigate to it first
		if (targetPage !== null && targetPage > 1) {
			console.log(`[liquidaciones] Navigating to page ${targetPage}...`);
			while (currentPage < targetPage) {
				const nextEl = await page.$('#DataTables_Table_0_next');
				const isDisabled = nextEl
					? await nextEl.evaluate((el) => el.classList.contains('disabled'))
					: true;
				if (isDisabled) {
					console.log(
						`[liquidaciones] Page ${targetPage} does not exist — returning empty.`,
					);
					return {
						success: true,
						liquidaciones: [],
						total: 0,
						errors,
						outputFile: null,
					};
				}
				await page.click('#DataTables_Table_0_next a');
				await delay(400);
				try {
					await page.waitForSelector('#DataTables_Table_0 tbody tr', {
						visible: true,
						timeout: 5_000,
					});
				} catch {
					console.log(
						`[liquidaciones] Page ${targetPage} does not exist — returning empty.`,
					);
					return {
						success: true,
						liquidaciones: [],
						total: 0,
						errors,
						outputFile: null,
					};
				}
				currentPage++;
			}
		}

		while (true) {
			console.log(`[liquidaciones] Scraping page ${currentPage}...`);
			const pageItems = await scrapeCurrentPage(page, errors);
			allLiquidaciones.push(...pageItems);
			console.log(
				`[liquidaciones] Page ${currentPage}: ${pageItems.length} row(s) scraped. Total so far: ${allLiquidaciones.length}`,
			);

			// If a specific page was requested, stop after scraping it
			if (targetPage !== null) {
				console.log(`[liquidaciones] Page ${targetPage} scraped — stopping.`);
				break;
			}

			// Try to go to next page
			const nextEl = await page.$('#DataTables_Table_0_next');
			if (!nextEl) break;
			const isDisabled = await nextEl.evaluate((el) =>
				el.classList.contains('disabled'),
			);
			if (isDisabled) break;

			try {
				await page.click('#DataTables_Table_0_next a');
				await delay(400);
				// Wait for table to re-render
				await page.waitForSelector('#DataTables_Table_0 tbody tr', {
					visible: true,
					timeout: 5_000,
				});
				currentPage++;
			} catch (err) {
				const msg = `Error navigating to page ${currentPage + 1}: ${err instanceof Error ? err.message : err}`;
				console.warn(`[liquidaciones] ${msg}`);
				errors.push(msg);
				break;
			}
		}

		console.log(
			`[liquidaciones] Scraping complete: ${allLiquidaciones.length} liquidaciones in total.`,
		);

		if (errors.length > 0) {
			console.warn(
				`[liquidaciones] Finished with ${errors.length} non-fatal error(s).`,
			);
		}

		return {
			success: true,
			liquidaciones: allLiquidaciones,
			total: totalRecords || allLiquidaciones.length,
			errors,
			outputFile: null,
		};
	} catch (err) {
		const msg = `Fatal: ${err instanceof Error ? err.message : err}`;
		if (signal?.aborted) {
			errors.push('Scrape aborted');
			return {
				success: false,
				liquidaciones: [],
				total: 0,
				errors,
				outputFile: null,
			};
		}
		console.error(`[liquidaciones] ${msg}`);
		errors.push(msg);
		return {
			success: false,
			liquidaciones: [],
			total: 0,
			errors,
			outputFile: null,
		};
	} finally {
		try {
			await Promise.race([
				browser?.close(),
				new Promise<void>((resolve) => setTimeout(resolve, 5_000)),
			]);
		} catch {
			// swallow close errors
		}
	}
}

// ============================================================
// PAGE-LEVEL SCRAPING
// ============================================================

async function scrapeCurrentPage(
	page: Page,
	errors: string[],
): Promise<Liquidacion[]> {
	try {
		return await page.$$eval('#DataTables_Table_0 tbody tr', (rows) => {
			const clean = (t: string | null | undefined) =>
				(t ?? '').replace(/\s+/g, ' ').trim();
			const results: {
				id: string;
				descripcion: string;
				estado: string;
				pdfUrl: string;
			}[] = [];

			for (const row of rows) {
				const tds = row.querySelectorAll('td');
				if (tds.length < 3) continue;

				const id = clean((tds[0] as HTMLElement).innerText);
				const descripcion = clean((tds[1] as HTMLElement).innerText);
				const estado = clean((tds[2] as HTMLElement).innerText);

				let pdfUrl = '';
				if (tds.length >= 4) {
					for (const item of tds[3].querySelectorAll('a.dropdown-item')) {
						if ((item.textContent ?? '').includes('Vista Previa')) {
							const href = item.getAttribute('href') ?? '';
							const m = href.match(/showPdfIframe\('([^']+)'\)/);
							if (m) pdfUrl = m[1];
							break;
						}
					}
				}

				results.push({ id, descripcion, estado, pdfUrl });
			}

			return results;
		});
	} catch (err) {
		const msg = `Error scraping page: ${err instanceof Error ? err.message : String(err)}`;
		console.warn(`[liquidaciones] ${msg}`);
		errors.push(msg);
		return [];
	}
}

// ============================================================
// STANDALONE ENTRY POINT
// ============================================================

async function main(): Promise<void> {
	const user = process.argv[2] ?? process.env.LEGAJOX_USER;
	const password = process.argv[3] ?? process.env.LEGAJOX_PASSWORD;

	if (!user || !password) {
		console.error('Usage: bun scripts/pending_actions.ts <user> <password>');
		console.error(
			'   or: LEGAJOX_USER=x LEGAJOX_PASSWORD=y bun scripts/pending_actions.ts',
		);
		process.exit(1);
	}

	const result = await scrapeLiquidaciones(user, password);

	if (!result.success) {
		console.error('[liquidaciones] Scrape failed.');
		process.exit(1);
	}

	process.exit(0);
}

const isEntryPoint: boolean =
	(import.meta as { main?: boolean }).main ??
	process.argv[1] === fileURLToPath(import.meta.url);

if (isEntryPoint) {
	main().catch((err) => {
		console.error(
			'[liquidaciones] Unhandled:',
			err instanceof Error ? err.message : err,
		);
		process.exit(1);
	});
}
