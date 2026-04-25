import { fileURLToPath } from 'node:url';
import type { Browser, Page } from 'puppeteer';
import { launchBrowser } from './browser';
import { login } from './validate_credentials';

// ============================================================
// CONFIG
// ============================================================

const PAGE_URL = 'https://app.legajox.com/config/dias_vacaciones_empleados';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ============================================================
// TYPES
// ============================================================

export interface VacacionEmpleado {
	nombre: string;
	asignacionInicial: string;
	prorrateo: string;
	acarreo: string;
	disfrutados: string;
	planeados: string;
	proximoCiclo: string;
	disponibles: string;
}

export interface ScrapeResult {
	success: boolean;
	registros: VacacionEmpleado[];
	total: number;
	errors: string[];
	outputFile: string | null;
}

// ============================================================
// TABLE SCRAPING (one page of DataTables)
// ============================================================

async function scrapeCurrentPage(page: Page): Promise<VacacionEmpleado[]> {
	return page.$$eval('#DataTables_Table_0 tbody tr.p5px', (rows) =>
		rows.map((row) => {
			const c = (t: string | null | undefined) =>
				(t ?? '').replace(/\s+/g, ' ').trim();
			const tds = row.querySelectorAll('td');
			return {
				nombre: c(
					(row.querySelector('span.nombre_empleados') as HTMLElement | null)
						?.innerText,
				),
				asignacionInicial: c((tds[1] as HTMLElement | undefined)?.innerText),
				prorrateo: c((tds[2] as HTMLElement | undefined)?.innerText),
				acarreo: c((tds[3] as HTMLElement | undefined)?.innerText),
				disfrutados: c((tds[4] as HTMLElement | undefined)?.innerText),
				planeados: c((tds[5] as HTMLElement | undefined)?.innerText),
				proximoCiclo: c((tds[6] as HTMLElement | undefined)?.innerText),
				disponibles: c((tds[7] as HTMLElement | undefined)?.innerText),
			};
		}),
	);
}

// ============================================================
// PAGINATION + FULL SCRAPE
// ============================================================

async function scrapeAllPages(
	page: Page,
	_errors: string[],
): Promise<VacacionEmpleado[]> {
	const allRecords: VacacionEmpleado[] = [];
	let pageNum = 1;

	// Parse total from info text: "Mostrando 1 a 25 de 104 registros"
	let totalLabel = '?';
	try {
		const infoText = await page.$eval(
			'#DataTables_Table_0_info',
			(el) => (el as HTMLElement).innerText,
		);
		const m = infoText.match(/de\s+([\d.]+)\s+registros/i);
		if (m) totalLabel = m[1];
	} catch {
		/* proceed without total */
	}

	while (true) {
		console.log(`[vacaciones] Scraping page ${pageNum}...`);
		const pageRecords = await scrapeCurrentPage(page);
		allRecords.push(...pageRecords);
		console.log(
			`[vacaciones] Page ${pageNum}: ${pageRecords.length} rows (${allRecords.length}/${totalLabel} total)`,
		);

		// Check if "Next" button is available (not disabled)
		const nextEl = await page.$('#DataTables_Table_0_next');
		if (!nextEl) break;
		const isDisabled = await nextEl.evaluate((el) =>
			el.classList.contains('disabled'),
		);
		if (isDisabled) break;

		await page.click('#DataTables_Table_0_next a');
		await delay(800);
		pageNum++;
	}

	return allRecords;
}

// ============================================================
// CORE — exportable for API integration
// ============================================================

export async function scrapeVacaciones(
	user: string,
	password: string,
	signal?: AbortSignal,
): Promise<ScrapeResult> {
	const errors: string[] = [];
	let browser: Browser | null = null;

	try {
		browser = await launchBrowser(signal);

		const page = await browser.newPage();

		// Login
		console.log('[vacaciones] Signing in...');
		await login(page, user, password);
		console.log(`[vacaciones] Signed in — ${page.url()}`);

		// Navigate
		console.log('[vacaciones] Navigating to dias_vacaciones_empleados...');
		await page.goto(PAGE_URL, {
			waitUntil: 'domcontentloaded',
			timeout: 60_000,
		});
		await page.waitForNetworkIdle({ timeout: 30_000 }).catch(() => {});

		// Check for permission error (SweetAlert2)
		try {
			await page.waitForSelector('.swal2-icon.swal2-error', {
				visible: true,
				timeout: 2_000,
			});
			console.warn(
				'[vacaciones] Access denied — no permissions for dias_vacaciones_empleados.',
			);
			errors.push(
				'Access denied: no permissions for dias_vacaciones_empleados.',
			);
			return {
				success: true,
				registros: [],
				total: 0,
				errors,
				outputFile: null,
			};
		} catch {
			/* no error alert — accessible */
		}

		// Wait for DataTable
		try {
			await page.waitForSelector('#DataTables_Table_0 tbody tr.p5px', {
				visible: true,
				timeout: 15_000,
			});
		} catch {
			console.log('[vacaciones] Table empty or not found.');
			return {
				success: true,
				registros: [],
				total: 0,
				errors,
				outputFile: null,
			};
		}

		// Scrape all pages
		const registros = await scrapeAllPages(page, errors);
		const total = registros.length;

		console.log(`[vacaciones] Scraping complete: ${total} registros.`);

		if (errors.length > 0) {
			console.warn(
				`[vacaciones] Finished with ${errors.length} non-fatal error(s).`,
			);
		}

		return { success: true, registros, total, errors, outputFile: null };
	} catch (err) {
		const msg = `Fatal: ${err instanceof Error ? err.message : err}`;
		if (signal?.aborted) {
			errors.push('Scrape aborted');
			return {
				success: false,
				registros: [],
				total: 0,
				errors,
				outputFile: null,
			};
		}
		console.error(`[vacaciones] ${msg}`);
		errors.push(msg);
		return {
			success: false,
			registros: [],
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
			/* swallow close errors */
		}
	}
}

// ============================================================
// STANDALONE ENTRY POINT
// ============================================================

async function main(): Promise<void> {
	const user = process.argv[2] ?? process.env.LEGAJOX_USER;
	const password = process.argv[3] ?? process.env.LEGAJOX_PASSWORD;

	if (!user || !password) {
		console.error('Usage: bun scripts/vacation_days.ts <user> <password>');
		console.error(
			'   or: LEGAJOX_USER=x LEGAJOX_PASSWORD=y bun scripts/vacation_days.ts',
		);
		process.exit(1);
	}

	const result = await scrapeVacaciones(user, password);
	process.exit(result.success ? 0 : 1);
}

if (
	(import.meta as { main?: boolean }).main ??
	process.argv[1] === fileURLToPath(import.meta.url)
) {
	main();
}
