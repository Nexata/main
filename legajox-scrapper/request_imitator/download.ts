import * as fs from 'node:fs';
import * as path from 'node:path';
import { fetchDocsPage, parseDocs } from './list-docs';
import { InvalidCookieError, legajoxHeaders } from './session';

const BASE_URL = 'https://app.legajox.com';
const BASE_HOST = 'app.legajox.com';
const OUTPUT_DIR = path.resolve('outputs', '_descargas_tmp');

const CONTENT_TYPE_EXTENSION: Record<string, string> = {
	'application/pdf': 'pdf',
	'application/msword': 'doc',
	'application/rtf': 'rtf',
	'application/vnd.ms-excel': 'xls',
	'application/vnd.ms-powerpoint': 'ppt',
	'application/vnd.openxmlformats-officedocument.presentationml.presentation':
		'pptx',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
		'docx',
	'application/vnd.oasis.opendocument.presentation': 'odp',
	'application/vnd.oasis.opendocument.spreadsheet': 'ods',
	'application/vnd.oasis.opendocument.text': 'odt',
	'image/gif': 'gif',
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/svg+xml': 'svg',
	'image/webp': 'webp',
	'text/csv': 'csv',
	'text/html': 'html',
	'text/markdown': 'md',
	'text/plain': 'txt',
};

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

function hasExtension(filename: string): boolean {
	return extractExtension(filename) !== '';
}

function extensionFromContentType(contentType: string | null): string {
	if (!contentType) return '';
	const mime = contentType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
	return CONTENT_TYPE_EXTENSION[mime] ?? '';
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

function decodeContentDispositionValue(value: string): string {
	try {
		return decodeURIComponent(value.replace(/^UTF-8''/i, ''));
	} catch {
		return value;
	}
}

function filenameFromContentDisposition(value: string | null): string | null {
	if (!value) return null;

	const encodedMatch = value.match(/filename\*=([^;]+)/i);
	if (encodedMatch?.[1]) {
		return decodeContentDispositionValue(
			encodedMatch[1].trim().replace(/^"|"$/g, ''),
		);
	}

	const plainMatch = value.match(/filename="?([^";]+)"?/i);
	return plainMatch?.[1]?.trim() ?? null;
}

function looksLikeHtml(buffer: Buffer): boolean {
	const prefix = buffer
		.subarray(0, 2048)
		.toString('utf8')
		.trimStart()
		.toLowerCase();
	return (
		prefix.startsWith('<!doctype html') ||
		prefix.startsWith('<html') ||
		prefix.includes('action="/login"') ||
		prefix.includes("action='/login'") ||
		prefix.includes('id="usr_email"') ||
		prefix.includes('id="usr_password"')
	);
}

function assertDownloadedContent(
	buffer: Buffer,
	contentType: string | null,
	contentDisposition: string | null,
	pathname: string,
) {
	const isHtml =
		(contentType ?? '').toLowerCase().includes('text/html') ||
		looksLikeHtml(buffer);
	if (!isHtml) return;

	const html = buffer.subarray(0, 8192).toString('utf8');
	if (
		html.includes('action="/login"') ||
		html.includes("action='/login'") ||
		html.includes('id="usr_email"') ||
		html.includes('id="usr_password"')
	) {
		throw new InvalidCookieError(
			'Session invalid — login form found in download',
		);
	}

	if (!contentDisposition) {
		throw new Error(
			`Unexpected HTML response while downloading ${pathname}; expected a document file.`,
		);
	}
}

function resolveDownloadTarget(url: string, dir = '', preferredName?: string) {
	const parsed = normalizeLegajoxUrl(url);
	const rawName = preferredName ?? extractFilenameFromUrl(parsed.toString());
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

function buildDownloadedFilename(
	url: string,
	contentType: string | null,
	contentDisposition: string | null,
): string {
	const parsed = normalizeLegajoxUrl(url);
	const dispositionName = filenameFromContentDisposition(contentDisposition);
	const urlName = extractFilenameFromUrl(parsed.toString());
	const ext = extensionFromContentType(contentType);
	let filename = dispositionName ?? urlName;

	if (filename === 'archivo_desconocido' || filename === '') {
		filename = parsed.pathname.startsWith('/enviar_doc/')
			? `documento-${parsed.pathname.split('/').pop()}`
			: 'documento';
	}

	if (!hasExtension(filename) && ext) filename = `${filename}.${ext}`;
	return filename;
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

// ── Download ─────────────────────────────────────────────────────────────────

async function downloadFile(
	url: string,
	cookie: string,
	dir = '',
): Promise<{
	nombre: string;
	extension: string;
	pesoBytes: number;
	pesoLegible: string;
	rutaLocal: string;
	downloadUrl: string;
	estado: 'ok' | 'duplicado';
}> {
	const parsed = normalizeLegajoxUrl(url);
	const response = await fetch(parsed.toString(), {
		headers: legajoxHeaders(cookie, '*/*'),
	});
	<<<<<<< HEAD
	// Detect redirect to login page (missing/expired session)
	if (new URL(response.url).pathname.includes('/login')) {
		throw new InvalidCookieError(
			`Download redirected to login for ${parsed.pathname}`,
		);
	}

	=======
	// Detect redirect to login page (missing/expired session)
	if (new URL(response.url).pathname.includes('/login')) {
		throw new InvalidCookieError(
			`Download redirected to login for ${parsed.pathname}`,
		);
	}
	>>>>>>> 1d89c16500eaf716d9e31df4cd8d42f1261ed255
	if (!response.ok) {
		throw new Error(`HTTP ${response.status} al descargar ${parsed.pathname}`);
	}

	const responseUrl = response.url || parsed.toString();
	const responseParsed = normalizeLegajoxUrl(responseUrl);
	const contentType = response.headers.get('content-type');
	const contentDisposition = response.headers.get('content-disposition');
	const buffer = Buffer.from(await response.arrayBuffer());
	assertDownloadedContent(
		buffer,
		contentType,
		contentDisposition,
		responseParsed.pathname,
	);

	const preferredName = buildDownloadedFilename(
		responseParsed.toString(),
		contentType,
		contentDisposition,
	);
	const { fileName, destPath } = resolveDownloadTarget(
		responseParsed.toString(),
		dir,
		preferredName,
	);

	if (fs.existsSync(destPath)) {
		const stat = fs.statSync(destPath);
		return {
			nombre: fileName,
			extension: extractExtension(fileName),
			pesoBytes: stat.size,
			pesoLegible: formatBytes(stat.size),
			rutaLocal: destPath,
			downloadUrl: responseParsed.pathname + responseParsed.search,
			estado: 'duplicado',
		};
	}

	fs.mkdirSync(path.dirname(destPath), { recursive: true });
	fs.writeFileSync(destPath, buffer);
	return {
		nombre: fileName,
		extension: extractExtension(fileName),
		pesoBytes: buffer.length,
		pesoLegible: formatBytes(buffer.length),
		rutaLocal: destPath,
		downloadUrl: responseParsed.pathname + responseParsed.search,
		estado: 'ok',
	};
}

// ── Procesamiento de Dirs ─────────────────────────────────────────────────────

export async function processDirs(
	dirs: string[],
	initialCookie: string,
): Promise<{ results: DocumentMetadata[]; cookie: string }> {
	const cookie = initialCookie;
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
				throw err;
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

			try {
				<<<<<<< HEAD
				const downloaded = await downloadFile(doc.url, cookie, dir);
				=======
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
				>>>>>>> 1d89c16500eaf716d9e31df4cd8d42f1261ed255
				results.push(
				nombre: downloaded.nombre, extension;
				: downloaded.extension,
					downloadUrl: downloaded.downloadUrl,
					dir,
					dirNombre,
					fecha: doc.fecha,
					firmado: doc.firmado,
<<<<<<< HEAD
					pesoBytes: downloaded.pesoBytes,
					pesoLegible: downloaded.pesoLegible,
					rutaLocal: downloaded.rutaLocal,
					estado: downloaded.estado,
=======
					pesoBytes: size!,
					pesoLegible: formatBytes(size!),
					rutaLocal: destPath,
					estado: 'ok',
>>>>>>> 1d89c16500eaf716d9e31df4cd8d42f1261ed255
				)
				const icon = downloaded.estado === 'duplicado' ? '⏭️ ' : '✅';
				console.log(
<<<<<<< HEAD
					`  ${icon} [${i + 1}/${docs.length}] ${downloaded.nombre} (${downloaded.pesoLegible})`,
=======
					`  ✅ [${i + 1}/${docs.length}] ${fileName} (${formatBytes(size!)})`,
>>>>>>> 1d89c16500eaf716d9e31df4cd8d42f1261ed255
				);
			} catch (err) {
				if (isAuthError(err)) throw err;

				const msg = err instanceof Error ? err.message : String(err);
				const { fileName } = resolveDownloadTarget(doc.url, dir);
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
	const cookie = initialCookie;
	const results: DocumentMetadata[] = [];

	if (links.length === 0) return { results, cookie };

	console.log(`\n━━━ Procesando ${links.length} link(s) directo(s) ━━━`);

	for (let i = 0; i < links.length; i++) {
		const url = links[i];
		const parsed = normalizeLegajoxUrl(url);

		try {
			const downloaded = await downloadFile(url, cookie);
			results.push({
				nombre: downloaded.nombre,
				extension: downloaded.extension,
				downloadUrl: downloaded.downloadUrl,
				dir: '',
				dirNombre: '',
				fecha: '',
				firmado: false,
				pesoBytes: downloaded.pesoBytes,
				pesoLegible: downloaded.pesoLegible,
				rutaLocal: downloaded.rutaLocal,
				estado: downloaded.estado,
			});
			const icon = downloaded.estado === 'duplicado' ? '⏭️ ' : '✅';
			console.log(
				`  ${icon} [${i + 1}/${links.length}] ${downloaded.nombre} (${downloaded.pesoLegible})`,
			);
		} catch (err) {
			if (isAuthError(err)) throw err;

			const msg = err instanceof Error ? err.message : String(err);
			const { fileName } = resolveDownloadTarget(url);
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
