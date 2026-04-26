import { fileURLToPath } from 'node:url';
import type { Browser, ElementHandle, Page } from 'puppeteer';
import { launchBrowser } from './browser';
import { login } from './validate_credentials';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ============================================================
// TYPES
// ============================================================

export interface Employee {
	nombre: string;
	dni: string;
	cuil: string;
	email: string;
	telefono: string;
	empresa: string;
	legajo: string;
	fechaIngreso: string;
	locacion: string;
	estado: string;
}

export interface ScrapeResult {
	success: boolean;
	employees: Employee[];
	errors: string[];
	outputFile: string | null;
}

// ============================================================
// SCRAPING HELPERS
// ============================================================

async function scrapeRow(
	_page: Page,
	row: ElementHandle<Element>,
	index: number,
	total: number | string,
): Promise<Employee> {
	// Extract data from visible table cells AND modal payload (if available)
	const rowData = await row.evaluate((el) => {
		const tds = el.querySelectorAll('td');
		const c = (t: string | null | undefined) =>
			(t ?? '').replace(/\s+/g, ' ').trim();

		// Extract visible cell texts
		const cells: string[] = [];
		for (let i = 0; i < tds.length; i++) {
			cells.push(c((tds[i] as HTMLElement).innerText));
		}

		const estadoEl = el.querySelector(
			'span.tag-verde, span.tag-rojo, span.tag-amarillo',
		);
		const estado = estadoEl ? c((estadoEl as HTMLElement).innerText) : '';

		// Try to extract modal payload data (legacy approach)
		const link =
			el.querySelector("a[href*='modalVerUsuario']") ||
			el.querySelector("a[onclick*='modalVerUsuario']");
		const attrValue =
			link?.getAttribute('href') ?? link?.getAttribute('onclick') ?? '';
		const match = attrValue.match(/modalVerUsuario\(`?([\s\S]+?)`?\)/);
		const parseModalPayload = (raw: string) => {
			const parsed: Record<string, string | null> = {};
			const entryPattern =
				/([A-Za-z0-9_]+)\s*:\s*'((?:\\'|[^'])*)'|([A-Za-z0-9_]+)\s*:\s*null/g;
			for (const entry of raw.matchAll(entryPattern)) {
				if (entry[1]) {
					parsed[entry[1]] = entry[2]
						.replace(/\\'/g, "'")
						.replace(/\\\\/g, '\\');
				} else if (entry[3]) {
					parsed[entry[3]] = null;
				}
			}
			return parsed;
		};
		const modalData = match ? parseModalPayload(match[1]) : {};

		// Also try data attributes on the row or link
		const dataAttrs: Record<string, string> = {};
		const allLinks = el.querySelectorAll('a[data-leg_nombre], a[data-nombre]');
		if (allLinks.length > 0) {
			const a = allLinks[0] as HTMLElement;
			for (const attr of Array.from(a.attributes)) {
				if (attr.name.startsWith('data-')) {
					dataAttrs[attr.name.slice(5)] = attr.value;
				}
			}
		}

		return { cells, estado, modalData, dataAttrs };
	});

	const { cells, estado, modalData, dataAttrs } = rowData;

	const getModal = (key: string): string =>
		((modalData[key] ?? '') as string).trim();
	const getAttr = (key: string): string => (dataAttrs[key] ?? '').trim();

	// Build employee from modal data if available, otherwise fall back to cell data
	const hasModalData =
		Object.keys(modalData).length > 0 &&
		(getModal('leg_nombre') || getModal('leg_apellido'));
	const hasAttrData = Object.keys(dataAttrs).length > 0;

	let nombre: string;
	let dni: string;
	let cuil: string;
	let email: string;
	let telefono: string;
	let empresa: string;
	let legajo: string;
	let fechaIngreso: string;
	let locacion: string;

	if (hasModalData) {
		// Legacy modal approach
		nombre = `${getModal('leg_nombre')} ${getModal('leg_apellido')}`.trim();
		dni = getModal('leg_dni');
		cuil = getModal('leg_cuil');
		email = getModal('leg_email') || getModal('usr_email');
		telefono = getModal('leg_celular');
		empresa = cells[2] || '';
		legajo = getModal('leg_legajo');
		fechaIngreso = getModal('leg_fecha_ingreso');
		locacion = [getModal('leg_ciudad'), getModal('prv_nombre')]
			.filter(Boolean)
			.join(', ');
	} else if (hasAttrData) {
		// Data attributes approach
		nombre =
			`${getAttr('leg_nombre') || getAttr('nombre')} ${getAttr('leg_apellido') || getAttr('apellido')}`.trim();
		dni = getAttr('leg_dni') || getAttr('dni');
		cuil = getAttr('leg_cuil') || getAttr('cuil');
		email = getAttr('leg_email') || getAttr('email') || getAttr('usr_email');
		telefono = getAttr('leg_celular') || getAttr('celular');
		empresa = cells[2] || getAttr('empresa');
		legajo = getAttr('leg_legajo') || getAttr('legajo');
		fechaIngreso = getAttr('leg_fecha_ingreso') || getAttr('fecha_ingreso');
		locacion = [
			getAttr('leg_ciudad') || getAttr('ciudad'),
			getAttr('prv_nombre') || getAttr('provincia'),
		]
			.filter(Boolean)
			.join(', ');
	} else {
		// Fallback: extract from visible table cells
		// Common Legajox table layout:
		// [0]: checkbox/avatar, [1]: nombre, [2]: empresa, [3]: legajo, [4]: DNI/CUIL, [5]: email, [6]: estado
		// The exact layout may vary, so we try to be smart about it
		nombre = cells[1] || '';
		empresa = cells[2] || '';
		legajo = cells[3] || '';
		// Try to identify DNI/CUIL from cells that look like numbers
		dni = '';
		cuil = '';
		email = '';
		telefono = '';
		fechaIngreso = '';
		locacion = '';

		for (let i = 3; i < cells.length; i++) {
			const cell = cells[i];
			if (!cell) continue;
			// DNI: 7-8 digit number
			if (!dni && /^\d{7,8}$/.test(cell.replace(/\./g, ''))) {
				dni = cell;
			}
			// CUIL: XX-XXXXXXXX-X pattern
			else if (!cuil && /^\d{2}-\d{7,8}-\d{1}$/.test(cell)) {
				cuil = cell;
			}
			// Email
			else if (!email && cell.includes('@')) {
				email = cell;
			}
			// Date (dd/mm/yyyy)
			else if (!fechaIngreso && /^\d{2}\/\d{2}\/\d{4}$/.test(cell)) {
				fechaIngreso = cell;
			}
		}
	}

	if (!hasModalData && !hasAttrData && !nombre) {
		console.warn(
			`  [${index}/${total}] WARNING: Could not extract employee data. Cells: ${JSON.stringify(cells.slice(0, 6))}`,
		);
	} else {
		console.log(`  [${index}/${total}] ${nombre || '(sin nombre)'}`);
	}

	return {
		nombre,
		dni,
		cuil,
		email,
		telefono,
		empresa,
		legajo,
		fechaIngreso,
		locacion,
		estado,
	};
}

// ============================================================
// CORE — exportable for API integration
// ============================================================

export async function scrapeEmployees(
	user: string,
	password: string,
	options?: { search?: string | null; page?: number | null },
	signal?: AbortSignal,
): Promise<ScrapeResult> {
	const errors: string[] = [];
	const employees: Employee[] = [];
	let browser: Browser | null = null;

	try {
		browser = await launchBrowser(signal);

		const page: Page = await browser.newPage();

		// — Login —
		console.log('[employees] Signing in...');
		await login(page, user, password);
		console.log(`[employees] Signed in — ${page.url()}`);

		// — Navigate to Employees —
		console.log('[employees] Navigating to employees section...');
		try {
			await page.goto('https://app.legajox.com/legajos/empleados', {
				waitUntil: 'domcontentloaded',
				timeout: 30_000,
			});
			await page.waitForNetworkIdle({ timeout: 15_000 }).catch(() => {});
		} catch (err) {
			const msg = `Cannot access employees section — possibly insufficient permissions: ${err instanceof Error ? err.message : err}`;
			console.error(`[employees] ${msg}`);
			errors.push(msg);
			return { success: false, employees, errors, outputFile: null };
		}

		// — Remove 'Activo' filter to see all states —
		console.log('[employees] Applying filters...');
		try {
			await page.click('#selectestado_id_ms');
			await delay(600);
			const isChecked = await page.$eval(
				'#ui-multiselect-0-selectestado_id-option-1',
				(el) => (el as HTMLInputElement).checked,
			);
			if (isChecked) {
				await page.click('#ui-multiselect-0-selectestado_id-option-1');
			}
			await delay(600);
			await page.click('#selectestado_id_ms');
			await page.waitForNetworkIdle({ timeout: 15_000 }).catch(() => {});
		} catch (err) {
			const msg = `Filter controls not found — continuing with default filters: ${err instanceof Error ? err.message : err}`;
			console.warn(`[employees] ${msg}`);
			errors.push(msg);
		}

		// — Apply search query —
		if (options?.search) {
			const q = options.search.trim();
			console.log(`[employees] Applying search filter: "${q}"`);
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
				console.warn(`[employees] ${msg}`);
				errors.push(msg);
			}
		}

		// — Read total from DataTable footer —
		let total: number | string = '?';
		try {
			const infoText = await page.$eval(
				'#DataTables_Table_0_info',
				(el) => (el as HTMLElement).innerText,
			);
			const match = infoText.match(/de (\d+) registros/);
			total = match ? parseInt(match[1], 10) : '?';
		} catch {
			console.warn(
				'[employees] Could not read employee count from table footer.',
			);
		}
		console.log(`[employees] Total employees found: ${total}`);

		// — Check if there are any rows at all —
		try {
			await page.waitForSelector('tr.p5px', { visible: true, timeout: 10_000 });
		} catch {
			const msg =
				'No employee rows visible — the table may be empty or access is restricted.';
			console.warn(`[employees] ${msg}`);
			errors.push(msg);
			return { success: true, employees, errors, outputFile: null };
		}

		// — Paginated scraping —
		const targetPage = options?.page ?? null;
		let pageNum = 1;

		// If a specific page is requested, navigate to it first
		if (targetPage !== null && targetPage > 1) {
			console.log(`[employees] Navigating to page ${targetPage}...`);
			while (pageNum < targetPage) {
				const nextClass = await page
					.$eval('#DataTables_Table_0_next', (el) => el.className)
					.catch(() => 'disabled');
				if (nextClass.includes('disabled')) {
					console.log(
						`[employees] Page ${targetPage} does not exist — returning empty.`,
					);
					return { success: true, employees: [], errors, outputFile: null };
				}
				await page.click('#DataTables_Table_0_next a');
				await page.waitForNetworkIdle({ timeout: 15_000 }).catch(() => {});
				try {
					await page.waitForSelector('tr.p5px', {
						visible: true,
						timeout: 10_000,
					});
				} catch {
					console.log(
						`[employees] Page ${targetPage} does not exist — returning empty.`,
					);
					return { success: true, employees: [], errors, outputFile: null };
				}
				pageNum++;
			}
		}

		while (true) {
			console.log(`\n[employees] Processing page ${pageNum}...`);

			const rows = await page.$$('tr.p5px');

			for (let i = 0; i < rows.length; i++) {
				try {
					const emp = await scrapeRow(
						page,
						rows[i],
						employees.length + 1,
						total,
					);
					employees.push(emp);
				} catch (err) {
					const msg = `Row ${i} on page ${pageNum}: ${err instanceof Error ? err.message : err}`;
					console.error(`  [!] ${msg}`);
					errors.push(msg);
				}
			}

			// If a specific page was requested, stop after scraping it
			if (targetPage !== null) {
				console.log(`\n[employees] Page ${targetPage} scraped — stopping.`);
				break;
			}

			// Check if there's a next page
			const nextClass = await page.$eval(
				'#DataTables_Table_0_next',
				(el) => el.className,
			);
			if (nextClass.includes('disabled')) {
				console.log('\n[employees] Last page processed.');
				break;
			}

			await page.click('#DataTables_Table_0_next a');
			await page.waitForNetworkIdle({ timeout: 15_000 }).catch(() => {});

			// Re-check rows are loaded before next iteration
			try {
				await page.waitForSelector('tr.p5px', {
					visible: true,
					timeout: 10_000,
				});
			} catch {
				console.warn('[employees] No rows loaded after pagination — stopping.');
				break;
			}

			pageNum++;
		}

		if (errors.length > 0) {
			console.warn(
				`[employees] Finished with ${errors.length} non-fatal error(s).`,
			);
		}

		return { success: true, employees, errors, outputFile: null };
	} catch (err) {
		const msg = `Fatal: ${err instanceof Error ? err.message : err}`;
		if (signal?.aborted) {
			errors.push('Scrape aborted');
			return { success: false, employees, errors, outputFile: null };
		}
		console.error(`[employees] ${msg}`);
		errors.push(msg);
		return { success: false, employees, errors, outputFile: null };
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
// STANDALONE ENTRY POINT
// ============================================================

async function main(): Promise<void> {
	const user = process.argv[2] ?? process.env.LEGAJOX_USER;
	const password = process.argv[3] ?? process.env.LEGAJOX_PASSWORD;

	if (!user || !password) {
		console.error('Usage: bun scripts/employees.ts <user> <password>');
		console.error(
			'   or: LEGAJOX_USER=x LEGAJOX_PASSWORD=y bun scripts/employees.ts',
		);
		process.exit(1);
	}

	const result = await scrapeEmployees(user, password);

	if (!result.success) {
		console.error('[employees] Scrape failed.');
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
			'[employees] Unhandled:',
			err instanceof Error ? err.message : err,
		);
		process.exit(1);
	});
}
