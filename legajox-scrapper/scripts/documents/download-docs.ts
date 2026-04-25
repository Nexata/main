import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Browser, Page } from 'puppeteer';
import { launchBrowser } from '../browser.js';
import { login } from '../validate_credentials.js';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Types ────────────────────────────────────────────────────────────────────

export interface DocumentMetadata {
	/** Nombre completo del archivo (ej: "contrato-plazo-fijo.pdf") */
	nombre: string;
	/** Extensión del archivo sin punto (ej: "pdf") */
	extension: string;
	/** URL directa de descarga */
	downloadUrl: string;
	/** Carpeta/directorio al que pertenece (ej: "/files/edit/11111") */
	dir: string;
	/** Nombre legible de la carpeta (ej: "Contratos") — vacío si viene de link directo */
	dirNombre: string;
	/** Fecha del documento tal como aparece en la tabla (ej: "31/07/2025 11:25hs") */
	fecha: string;
	/** Si el documento lleva firma */
	firmado: boolean;
	/** Peso del archivo en bytes */
	pesoBytes: number;
	/** Peso legible (ej: "1.2 MB") */
	pesoLegible: string;
	/** Ruta local donde se guardó el archivo */
	rutaLocal: string;
	/** Estado de la descarga */
	estado: 'ok' | 'error' | 'duplicado';
	/** Detalle del error si falló */
	errorDetalle?: string;
}

// ── Config ───────────────────────────────────────────────────────────────────

const BASE_URL = 'https://app.legajox.com';
const BASE_HOST = new URL(BASE_URL).host;
const OUTPUT_DIR = path.resolve('outputs', '_descargas_tmp');

// ── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeFilename(name: string): string {
	return name.replace(/[<>:"/\\|?*]/g, '_').trim();
}

function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	const val = bytes / 1024 ** i;
	return `${val.toFixed(i > 0 ? 2 : 0)} ${units[i]}`;
}

function extractExtension(filename: string): string {
	const dot = filename.lastIndexOf('.');
	return dot !== -1 ? filename.substring(dot + 1).toLowerCase() : '';
}

function extractFilenameFromUrl(url: string): string {
	try {
		const pathname = new URL(url, BASE_URL).pathname;
		const parts = pathname.split('/');
		return decodeURIComponent(parts[parts.length - 1] || 'archivo_desconocido');
	} catch {
		return 'archivo_desconocido';
	}
}

function sanitizePathSegment(value: string): string {
	return (
		value
			.replace(/[^A-Za-z0-9._-]/g, '_')
			.replace(/_+/g, '_')
			.trim() || 'item'
	);
}

function normalizeLegajoxUrl(url: string): URL {
	const parsed = new URL(url, BASE_URL);
	if (parsed.host !== BASE_HOST) {
		throw new Error(`Invalid download host: expected ${BASE_HOST}.`);
	}
	return parsed;
}

function resolveDownloadTarget(url: string, dir = '') {
	const parsed = normalizeLegajoxUrl(url);
	const rawName = extractFilenameFromUrl(parsed.toString());
	const safeName = sanitizeFilename(rawName);
	const fallbackName =
		safeName === 'archivo_desconocido' ? 'documento' : safeName;
	const uniqueSeed = [dir, parsed.pathname, parsed.search]
		.filter(Boolean)
		.join('|');
	const uniqueSuffix = Bun.hash(uniqueSeed).toString(16).slice(0, 10);
	const finalName = `${uniqueSuffix}-${fallbackName}`;
	const dirSegment = dir ? sanitizePathSegment(dir) : 'direct-links';
	const folder = path.join(OUTPUT_DIR, dirSegment);
	return {
		parsed,
		fileName: finalName,
		destPath: path.join(folder, finalName),
	};
}

// ── Scraping de documentos (reutilizado de list-docs) ────────────────────────

interface DocRow {
	nombre: string;
	url: string;
	fecha: string;
	firmado: boolean;
}

async function scrapeDocumentosFromDir(
	page: Page,
	carpetaUrl: string,
): Promise<DocRow[]> {
	await page.goto(`${BASE_URL}${carpetaUrl}`, {
		timeout: 60_000,
		waitUntil: 'domcontentloaded',
	});

	await page.waitForSelector('table.datatableDocsCat tbody tr', {
		timeout: 15_000,
	});
	await page.waitForNetworkIdle({ timeout: 30_000 }).catch(() => {});

	// Mostrar 100 registros por página
	await page.evaluate(() => {
		const select = document.querySelector<HTMLSelectElement>(
			"select[name='DataTables_Table_1_length']",
		);
		if (select) {
			select.value = '100';
			select.dispatchEvent(new Event('change', { bubbles: true }));
		}
	});
	await delay(2_000);
	await page.waitForNetworkIdle({ timeout: 15_000 }).catch(() => {});

	const allDocs: DocRow[] = [];

	while (true) {
		const docs = await page.$$eval('table.datatableDocsCat tbody tr', (rows) =>
			rows.map((row) => {
				const linkEl = row.querySelector<HTMLAnchorElement>('a.file-name-link');
				const url = linkEl?.getAttribute('href') ?? '';
				const nombre =
					linkEl?.getAttribute('data-original-title') ??
					linkEl?.textContent?.trim() ??
					'';
				const fechaTd = row.querySelectorAll('td')[2];
				const fechaTexto = fechaTd?.textContent?.trim() ?? '';
				const fecha = fechaTexto.replace(/^\d{14}\s*/, '').trim();
				const firmadoEl = row.querySelectorAll('td')[3];
				const firmado = firmadoEl?.textContent?.trim().toLowerCase() === 'si';
				return { nombre, url, fecha, firmado };
			}),
		);

		allDocs.push(...docs);

		const nextBtn = await page.$('#DataTables_Table_1_next');
		if (!nextBtn) break;
		const isDisabled = await nextBtn.evaluate((el) =>
			el.classList.contains('disabled'),
		);
		if (isDisabled) break;

		await nextBtn.click();
		await delay(1_500);
		await page.waitForNetworkIdle({ timeout: 15_000 }).catch(() => {});
	}

	return allDocs;
}

/** Obtiene el nombre visible de la carpeta desde la página */
async function scrapeDirName(page: Page): Promise<string> {
	const title = await page
		.$eval(
			'h5.titulo_categoria, .breadcrumb .active, h3',
			(el) => el.textContent?.trim() ?? '',
		)
		.catch(() => '');
	return title || 'sin_nombre';
}

// ── Descarga ─────────────────────────────────────────────────────────────────

async function downloadFile(
	page: Page,
	url: string,
	destPath: string,
): Promise<{ bytes: Buffer; size: number }> {
	const parsedUrl = normalizeLegajoxUrl(url);
	const fullUrl = parsedUrl.toString();
	const cookies = await page.cookies();
	const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
	fs.mkdirSync(path.dirname(destPath), { recursive: true });
	const response = await fetch(fullUrl, { headers: { Cookie: cookieHeader } });
	if (!response.ok) {
		throw new Error(`HTTP ${response.status} al descargar ${fullUrl}`);
	}
	const buffer = Buffer.from(await response.arrayBuffer());
	fs.writeFileSync(destPath, buffer);
	return { bytes: buffer, size: buffer.length };
}

// ── Procesamiento de Dirs ────────────────────────────────────────────────────

async function processDirs(
	page: Page,
	dirs: string[],
): Promise<DocumentMetadata[]> {
	const results: DocumentMetadata[] = [];

	for (const dir of dirs) {
		console.log(`\n━━━ Procesando directorio: ${dir} ━━━`);

		await page.goto(`${BASE_URL}${dir}`, {
			timeout: 60_000,
			waitUntil: 'domcontentloaded',
		});

		const dirNombre = await scrapeDirName(page);
		console.log(`  Carpeta: ${dirNombre}`);

		const docs = await scrapeDocumentosFromDir(page, dir);
		console.log(`  Documentos encontrados: ${docs.length}`);

		for (let i = 0; i < docs.length; i++) {
			const doc = docs[i];
			if (!doc.url) {
				results.push(
					buildErrorMeta(
						doc.nombre,
						dir,
						dirNombre,
						doc,
						'Sin URL de descarga',
					),
				);
				continue;
			}

			const { fileName, destPath } = resolveDownloadTarget(doc.url, dir);

			// Duplicado
			if (fs.existsSync(destPath)) {
				const stat = fs.statSync(destPath);
				results.push({
					nombre: fileName,
					extension: extractExtension(fileName),
					downloadUrl: doc.url,
					dir,
					dirNombre,
					fecha: doc.fecha,
					firmado: doc.firmado,
					pesoBytes: stat.size,
					pesoLegible: formatBytes(stat.size),
					rutaLocal: destPath,
					estado: 'duplicado',
				});
				console.log(`  ⏭️  [${i + 1}/${docs.length}] Duplicado: ${fileName}`);
				continue;
			}

			try {
				const { size } = await downloadFile(page, doc.url, destPath);
				results.push({
					nombre: fileName,
					extension: extractExtension(fileName),
					downloadUrl: doc.url,
					dir,
					dirNombre,
					fecha: doc.fecha,
					firmado: doc.firmado,
					pesoBytes: size,
					pesoLegible: formatBytes(size),
					rutaLocal: destPath,
					estado: 'ok',
				});
				console.log(
					`  ✅ [${i + 1}/${docs.length}] ${fileName} (${formatBytes(size)})`,
				);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				results.push(buildErrorMeta(fileName, dir, dirNombre, doc, msg));
				console.log(`  ❌ [${i + 1}/${docs.length}] ${fileName} — ${msg}`);
			}
		}
	}

	return results;
}

// ── Procesamiento de Links directos ──────────────────────────────────────────

async function processDirectLinks(
	page: Page,
	links: string[],
): Promise<DocumentMetadata[]> {
	const results: DocumentMetadata[] = [];

	if (links.length > 0) {
		console.log(`\n━━━ Procesando ${links.length} link(s) directo(s) ━━━`);
	}

	for (let i = 0; i < links.length; i++) {
		const url = links[i];
		const { fileName, destPath, parsed } = resolveDownloadTarget(url);

		// Duplicado
		if (fs.existsSync(destPath)) {
			const stat = fs.statSync(destPath);
			results.push({
				nombre: fileName,
				extension: extractExtension(fileName),
				downloadUrl: parsed.pathname + parsed.search,
				dir: '',
				dirNombre: '',
				fecha: '',
				firmado: false,
				pesoBytes: stat.size,
				pesoLegible: formatBytes(stat.size),
				rutaLocal: destPath,
				estado: 'duplicado',
			});
			console.log(`  ⏭️  [${i + 1}/${links.length}] Duplicado: ${fileName}`);
			continue;
		}

		try {
			const { size } = await downloadFile(page, url, destPath);
			results.push({
				nombre: fileName,
				extension: extractExtension(fileName),
				downloadUrl: parsed.pathname + parsed.search,
				dir: '',
				dirNombre: '',
				fecha: '',
				firmado: false,
				pesoBytes: size,
				pesoLegible: formatBytes(size),
				rutaLocal: destPath,
				estado: 'ok',
			});
			console.log(
				`  ✅ [${i + 1}/${links.length}] ${fileName} (${formatBytes(size)})`,
			);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			results.push({
				nombre: fileName,
				extension: extractExtension(fileName),
				downloadUrl: parsed.pathname + parsed.search,
				dir: '',
				dirNombre: '',
				fecha: '',
				firmado: false,
				pesoBytes: 0,
				pesoLegible: '0 B',
				rutaLocal: destPath,
				estado: 'error',
				errorDetalle: msg,
			});
			console.log(`  ❌ [${i + 1}/${links.length}] ${fileName} — ${msg}`);
		}
	}

	return results;
}

// ── Helper para metadata de error ────────────────────────────────────────────

function buildErrorMeta(
	fileName: string,
	dir: string,
	dirNombre: string,
	doc: DocRow,
	errorMsg: string,
): DocumentMetadata {
	return {
		nombre: fileName,
		extension: extractExtension(fileName),
		downloadUrl: doc.url,
		dir,
		dirNombre,
		fecha: doc.fecha,
		firmado: doc.firmado,
		pesoBytes: 0,
		pesoLegible: '0 B',
		rutaLocal: '',
		estado: 'error',
		errorDetalle: errorMsg,
	};
}

// ── Resumen por consola ──────────────────────────────────────────────────────

function printMetadataReport(metadata: DocumentMetadata[]): void {
	console.log(`\n${'═'.repeat(80)}`);
	console.log('  REPORTE DE DESCARGA');
	console.log('═'.repeat(80));

	const ok = metadata.filter((m) => m.estado === 'ok');
	const dup = metadata.filter((m) => m.estado === 'duplicado');
	const err = metadata.filter((m) => m.estado === 'error');
	const totalBytes = ok.reduce((sum, m) => sum + m.pesoBytes, 0);

	console.log(`  Total procesados: ${metadata.length}`);
	console.log(`  ✅ Descargados:   ${ok.length}  (${formatBytes(totalBytes)})`);
	console.log(`  ⏭️  Duplicados:    ${dup.length}`);
	console.log(`  ❌ Errores:       ${err.length}`);
	console.log('─'.repeat(80));

	console.log('\n  METADATA POR ARCHIVO:\n');
	for (const m of metadata) {
		const icon =
			m.estado === 'ok' ? '✅' : m.estado === 'duplicado' ? '⏭️' : '❌';
		console.log(`  ${icon} ${m.nombre}`);
		console.log(`     Extensión:  ${m.extension}`);
		console.log(`     Peso:       ${m.pesoLegible}`);
		if (m.dir) console.log(`     Dir:        ${m.dir}`);
		if (m.dirNombre) console.log(`     Dir nombre: ${m.dirNombre}`);
		if (m.fecha) console.log(`     Fecha:      ${m.fecha}`);
		console.log(`     Firmado:    ${m.firmado ? 'Sí' : 'No'}`);
		console.log(`     URL:        ${m.downloadUrl}`);
		if (m.rutaLocal) console.log(`     Local:      ${m.rutaLocal}`);
		if (m.errorDetalle) console.log(`     Error:      ${m.errorDetalle}`);
		console.log();
	}
}
// ── Exported API function ───────────────────────────────────────────────────

export interface DownloadResult {
	success: boolean;
	metadata: DocumentMetadata[];
	errors: string[];
}

export async function scrapeDownload(
	user: string,
	password: string,
	dirs: string[],
	links: string[],
	signal?: AbortSignal,
): Promise<DownloadResult> {
	const errors: string[] = [];
	let browser: Browser | null = null;
	try {
		fs.mkdirSync(OUTPUT_DIR, { recursive: true });
		browser = await launchBrowser(signal);
		const page = await browser.newPage();
		await login(page, user, password);
		const allMetadata: DocumentMetadata[] = [];
		if (dirs.length > 0) {
			allMetadata.push(...(await processDirs(page, dirs)));
		}
		if (links.length > 0) {
			allMetadata.push(...(await processDirectLinks(page, links)));
		}
		return { success: true, metadata: allMetadata, errors };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		if (signal?.aborted) {
			errors.push('Scrape aborted');
			return { success: false, metadata: [], errors };
		}
		errors.push(msg);
		return { success: false, metadata: [], errors };
	} finally {
		try {
			await Promise.race([
				browser?.close(),
				new Promise<void>((r) => setTimeout(r, 5_000)),
			]);
		} catch {}
	}
}
// ── CLI Args Parsing ─────────────────────────────────────────────────────────

function parseArgs(): {
	user: string;
	password: string;
	dirs: string[];
	links: string[];
} {
	const args = process.argv.slice(2);
	if (args.length < 2) {
		console.error(
			'Usage: bun scripts/documents/download-docs.ts <user> <password> [--dirs dir1,dir2] [--links url1,url2]',
		);
		console.error(
			'Example: bun scripts/documents/download-docs.ts user@mail.com pass --dirs "/files/edit/11111,/files/edit/22222" --links "https://...pdf,https://...pdf"',
		);
		process.exit(1);
	}

	const user = args[0];
	const password = args[1];
	let dirs: string[] = [];
	let links: string[] = [];

	for (let i = 2; i < args.length; i++) {
		if (args[i] === '--dirs' && args[i + 1]) {
			dirs = args[i + 1]
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean);
			i++;
		} else if (args[i] === '--links' && args[i + 1]) {
			links = args[i + 1]
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean);
			i++;
		}
	}

	return { user, password, dirs, links };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
	const { user, password, dirs, links } = parseArgs();

	if (dirs.length === 0 && links.length === 0) {
		console.log('No se proporcionaron dirs ni links. Nada que procesar.');
		return;
	}

	// Asegurar carpeta de salida
	if (!fs.existsSync(OUTPUT_DIR)) {
		fs.mkdirSync(OUTPUT_DIR, { recursive: true });
	}

	let browser: Browser | null = null;
	try {
		browser = await launchBrowser();
		const page = await browser.newPage();

		console.log(`Logging in as ${user}…`);
		await login(page, user, password);
		console.log('Login OK.');

		console.log(`\nDirs a procesar:  ${dirs.length}`);
		console.log(`Links a procesar: ${links.length}`);

		const allMetadata: DocumentMetadata[] = [];

		// 1. Procesar directorios
		if (dirs.length > 0) {
			const dirResults = await processDirs(page, dirs);
			allMetadata.push(...dirResults);
		}

		// 2. Procesar links directos
		if (links.length > 0) {
			const linkResults = await processDirectLinks(page, links);
			allMetadata.push(...linkResults);
		}

		// 3. Reporte final
		printMetadataReport(allMetadata);

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
