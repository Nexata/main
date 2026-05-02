import * as fs from 'node:fs';
import * as path from 'node:path';
import { getCiSession } from './get_cookies';
import { fetchDocsPage, parseDocs } from './list-docs';
import { InvalidCookieError, legajoxHeaders } from './session';

const BASE_URL = 'https://app.legajox.com';
const BASE_HOST = 'app.legajox.com';
const OUTPUT_DIR = path.resolve('outputs', '_descargas_tmp');

// ── Types ────────────────────────────────────────────────────────────────────

export interface DocumentMetadata {
	/** Nombre del archivo (puede incluir un prefijo hash para unicidad) */
	nombre: string;
	/** Extensión sin punto */
	extension: string;
	/** URL/path de descarga */
	downloadUrl: string;
	/** Path de la carpeta, ej: /files/edit/14746 */
	dir: string;
	/** Nombre legible de la carpeta */
	dirNombre: string;
	/** Fecha del documento según la tabla */
	fecha: string;
	/** Si lleva firma */
	firmado: boolean;
	/** Tamaño en bytes */
	pesoBytes: number;
	/** Tamaño legible, ej: "1.2 MB" */
	pesoLegible: string;
	/** Ruta local donde se guardó */
	rutaLocal: string;
	/** Estado de la operación */
	estado: 'ok' | 'error' | 'duplicado';
	/** Detalle del error si falló */
	errorDetalle?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isAuthError(err: unknown): boolean {
	return err instanceof Error && err.name === 'InvalidCookieError';
}

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
	const parsed = new URL(url.startsWith('/') ? `${BASE_URL}${url}` : url);
	if (parsed.host !== BASE_HOST) {
		throw new Error(
			`Invalid download host: expected ${BASE_HOST}, got ${parsed.host}`,
		);
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

function extractDirName(html: string): string {
	// Try <h5 class="titulo_categoria">...</h5>
	let m = html.match(/<[^>]*titulo_categoria[^>]*>([^<]+)</);
	if (m) return m[1].trim();
	// Try active breadcrumb item
	m = html.match(
		/<li[^>]*class="[^"]*breadcrumb-item[^"]*active[^"]*"[^>]*>\s*([^<]{3,60})\s*<\/li>/,
	);
	if (m) return m[1].trim();
	// Try first h3–h5 with meaningful text
	m = html.match(/<h[3-5][^>]*>\s*([^<]{3,60})\s*<\/h[3-5]>/);
	if (m) return m[1].trim();
	return 'carpeta';
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

// ── Download ─────────────────────────────────────────────────────────────────

async function downloadFile(
	url: string,
	destPath: string,
	cookie: string,
): Promise<number> {
	const parsed = normalizeLegajoxUrl(url);
	fs.mkdirSync(path.dirname(destPath), { recursive: true });
	const response = await fetch(parsed.toString(), {
		headers: legajoxHeaders(cookie, '*/*'),
	});
	// Detect redirect to login page (missing/expired session)
	if (new URL(response.url).pathname.includes('/login')) {
		throw new InvalidCookieError(
			`Download redirected to login for ${parsed.pathname}`,
		);
	}
	if (!response.ok) {
		throw new Error(`HTTP ${response.status} al descargar ${parsed.pathname}`);
	}
	const buffer = Buffer.from(await response.arrayBuffer());
	fs.writeFileSync(destPath, buffer);
	return buffer.length;
}

// ── Procesamiento de Dirs ─────────────────────────────────────────────────────

export async function processDirs(
	dirs: string[],
	initialCookie: string,
): Promise<{ results: DocumentMetadata[]; cookie: string }> {
	let cookie = initialCookie;
	const results: DocumentMetadata[] = [];

	for (const dir of dirs) {
		console.log(`\n━━━ Procesando directorio: ${dir} ━━━`);

		// Extract numeric folder ID from "/files/edit/14746"
		const idMatch = dir.match(/\/(\d+)\s*$/);
		if (!idMatch) {
			console.warn(
				`  ⚠️  Path inválido (se espera /files/edit/<id>), se omite: ${dir}`,
			);
			continue;
		}
		const folderId = idMatch[1];

		// Fetch the folder page (with auth retry)
		let html: string;
		try {
			html = await fetchDocsPage(folderId, cookie);
		} catch (err) {
			if (isAuthError(err)) {
				console.warn(`[auth] ${(err as Error).message}. Refreshing cookie…`);
				try {
					cookie = await refreshCookie();
					html = await fetchDocsPage(folderId, cookie);
				} catch (retryErr) {
					console.error(
						`  ❌ No se pudo obtener la carpeta ${dir}: ${retryErr instanceof Error ? retryErr.message : retryErr}`,
					);
					continue;
				}
			} else {
				console.error(
					`  ❌ Error al obtener carpeta ${dir}: ${err instanceof Error ? err.message : err}`,
				);
				continue;
			}
		}

		const dirNombre = extractDirName(html!);
		console.log(`  Carpeta: ${dirNombre}`);

		const docs = parseDocs(html!);
		console.log(`  Documentos encontrados: ${docs.length}`);

		for (let i = 0; i < docs.length; i++) {
			const doc = docs[i];

			if (!doc.url) {
				results.push({
					nombre: doc.nombre || `doc-${i + 1}`,
					extension: extractExtension(doc.nombre),
					downloadUrl: '',
					dir,
					dirNombre,
					fecha: doc.fecha,
					firmado: doc.firmado,
					pesoBytes: 0,
					pesoLegible: '0 B',
					rutaLocal: '',
					estado: 'error',
					errorDetalle: 'Sin URL de descarga',
				});
				console.log(`  ⚠️  [${i + 1}/${docs.length}] Sin URL: ${doc.nombre}`);
				continue;
			}

			const { fileName, destPath } = resolveDownloadTarget(doc.url, dir);

			// Already downloaded
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
				let size: number;
				try {
					size = await downloadFile(doc.url, destPath, cookie);
				} catch (err) {
					if (isAuthError(err)) {
						console.warn(
							`[auth] Cookie expired during download of ${fileName}. Refreshing…`,
						);
						cookie = await refreshCookie();
						size = await downloadFile(doc.url, destPath, cookie);
					} else {
						throw err;
					}
				}
				results.push({
					nombre: fileName,
					extension: extractExtension(fileName),
					downloadUrl: doc.url,
					dir,
					dirNombre,
					fecha: doc.fecha,
					firmado: doc.firmado,
					pesoBytes: size!,
					pesoLegible: formatBytes(size!),
					rutaLocal: destPath,
					estado: 'ok',
				});
				console.log(
					`  ✅ [${i + 1}/${docs.length}] ${fileName} (${formatBytes(size!)})`,
				);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				results.push({
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
					errorDetalle: msg,
				});
				console.log(`  ❌ [${i + 1}/${docs.length}] ${fileName} — ${msg}`);
			}
		}
	}

	return { results, cookie };
}

// ── Procesamiento de Links directos ──────────────────────────────────────────

export async function processDirectLinks(
	links: string[],
	initialCookie: string,
): Promise<{ results: DocumentMetadata[]; cookie: string }> {
	let cookie = initialCookie;
	const results: DocumentMetadata[] = [];

	if (links.length === 0) return { results, cookie };

	console.log(`\n━━━ Procesando ${links.length} link(s) directo(s) ━━━`);

	for (let i = 0; i < links.length; i++) {
		const url = links[i];
		const { fileName, destPath, parsed } = resolveDownloadTarget(url);

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
			const size = await downloadFile(url, destPath, cookie);
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
			// If auth error on download, try refreshing
			if (isAuthError(err)) {
				console.warn(`[auth] Cookie expired during download. Refreshing…`);
				try {
					cookie = await refreshCookie();
					const size = await downloadFile(url, destPath, cookie);
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
					continue;
				} catch (retryErr) {
					const msg =
						retryErr instanceof Error ? retryErr.message : String(retryErr);
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
						rutaLocal: '',
						estado: 'error',
						errorDetalle: msg,
					});
					console.log(`  ❌ [${i + 1}/${links.length}] ${fileName} — ${msg}`);
					continue;
				}
			}

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
				rutaLocal: '',
				estado: 'error',
				errorDetalle: msg,
			});
			console.log(`  ❌ [${i + 1}/${links.length}] ${fileName} — ${msg}`);
		}
	}

	return { results, cookie };
}

// ── Reporte ──────────────────────────────────────────────────────────────────

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
			m.estado === 'ok' ? '✅' : m.estado === 'duplicado' ? '⏭️ ' : '❌';
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

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(): { cookie: string; dirs: string[]; links: string[] } {
	const args = process.argv.slice(2);

	if (args.length < 1) {
		console.error(
			'Usage: bun request_imitator/download.ts <ci_session_cookie> [--dirs /files/edit/111,/files/edit/222] [--links url1,url2]',
		);
		console.error(
			'Example: bun request_imitator/download.ts <cookie> --dirs "/files/edit/14746,/files/edit/11111"',
		);
		process.exit(1);
	}

	const cookie = args[0];
	let dirs: string[] = [];
	let links: string[] = [];

	for (let i = 1; i < args.length; i++) {
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

	return { cookie, dirs, links };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
	const { cookie: initialCookie, dirs, links } = parseArgs();

	if (dirs.length === 0 && links.length === 0) {
		console.log('No se proporcionaron --dirs ni --links. Nada que procesar.');
		process.exit(0);
	}

	fs.mkdirSync(OUTPUT_DIR, { recursive: true });

	console.log(`Dirs a procesar:  ${dirs.length}`);
	console.log(`Links a procesar: ${links.length}`);
	console.log(`Carpeta de salida: ${OUTPUT_DIR}`);

	let cookie = initialCookie;
	const allMetadata: DocumentMetadata[] = [];

	if (dirs.length > 0) {
		const { results, cookie: updatedCookie } = await processDirs(dirs, cookie);
		allMetadata.push(...results);
		cookie = updatedCookie;
	}

	if (links.length > 0) {
		const { results } = await processDirectLinks(links, cookie);
		allMetadata.push(...results);
	}

	printMetadataReport(allMetadata);
}

if (import.meta.main) {
	main();
}
