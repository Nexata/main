import { fileURLToPath } from 'node:url';
import type { Browser, Page } from 'puppeteer';
import { launchBrowser } from '../browser.js';
import { login } from '../validate_credentials.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Carpeta {
	nombre: string;
	href: string;
	cantidadArchivos: number;
}

// ── Scraping ─────────────────────────────────────────────────────────────────

async function scrapeCarpetas(page: Page): Promise<Carpeta[]> {
	await page.goto('https://app.legajox.com/documentos', {
		timeout: 60_000,
		waitUntil: 'domcontentloaded',
	});

	await page.waitForSelector('div.row.mt-4.dragfile', { timeout: 15_000 });
	await page.waitForSelector('div.row.mt-4.dragfile div.ddcur', {
		timeout: 15_000,
	});
	await page.waitForNetworkIdle({ timeout: 30_000 }).catch(() => {});

	const carpetas = await page.$$eval(
		'div.row.mt-4.dragfile div.ddcur',
		(cards) =>
			cards.map((card) => {
				const linkEl = card.querySelector<HTMLAnchorElement>('a.d-flex.w-320');
				const nombre =
					linkEl?.querySelector('h6.m-0')?.textContent?.trim() ?? '';
				const href = linkEl?.getAttribute('href') ?? '';
				const qtyText =
					card.querySelector('.fileqty span')?.textContent?.trim() ?? '0';
				const cantidadArchivos = parseInt(qtyText, 10) || 0;
				return { nombre, href, cantidadArchivos };
			}),
	);

	return carpetas;
}

// ── Exported API function ───────────────────────────────────────────────────

export interface ListDirsResult {
	success: boolean;
	carpetas: Carpeta[];
	errors: string[];
}

export async function scrapeListDirs(
	user: string,
	password: string,
	signal?: AbortSignal,
): Promise<ListDirsResult> {
	const errors: string[] = [];
	let browser: Browser | null = null;
	try {
		browser = await launchBrowser(signal);
		const page = await browser.newPage();
		await login(page, user, password);
		const carpetas = await scrapeCarpetas(page);
		return { success: true, carpetas, errors };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		if (signal?.aborted) {
			errors.push('Scrape aborted');
			return { success: false, carpetas: [], errors };
		}
		errors.push(msg);
		return { success: false, carpetas: [], errors };
	} finally {
		try {
			await Promise.race([
				browser?.close(),
				new Promise<void>((r) => setTimeout(r, 5_000)),
			]);
		} catch {}
	}
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
	const [, , user, password] = process.argv;
	if (!user || !password) {
		console.error(
			'Usage: bun scripts/documents/list-dirs.ts <user> <password>',
		);
		process.exit(1);
	}

	let browser: Browser | null = null;
	try {
		browser = await launchBrowser();
		const page = await browser.newPage();

		console.log(`Logging in as ${user}…`);
		await login(page, user, password);
		console.log('Login OK.\n');

		console.log('Navegando a /documentos…');
		const carpetas = await scrapeCarpetas(page);

		console.log(`\n=== Carpetas encontradas: ${carpetas.length} ===\n`);
		for (const c of carpetas) {
			console.log(
				`  📁 ${c.nombre}  (${c.cantidadArchivos} archivos)  →  ${c.href}`,
			);
		}
		console.log();

		process.exit(0);
	} catch (err) {
		console.error('Error:', err instanceof Error ? err.message : String(err));
		process.exit(1);
	} finally {
		try {
			await Promise.race([
				browser?.close(),
				new Promise<void>((r) => setTimeout(r, 5_000)),
			]);
		} catch {}
	}
}

const isEntryPoint: boolean =
	(import.meta as { main?: boolean }).main ??
	process.argv[1] === fileURLToPath(import.meta.url);

if (isEntryPoint) {
	main().catch((err) => {
		console.error(err instanceof Error ? err.message : err);
		process.exit(1);
	});
}
