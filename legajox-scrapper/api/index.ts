import { Elysia, t } from 'elysia';
import { type AusenciasFilters, scrapeAusencias } from '../scripts/absences';
import { scrapeDownload } from '../scripts/documents/download-docs';
import { scrapeFileSearch } from '../scripts/documents/file-search';
import { scrapeListDirs } from '../scripts/documents/list-dirs';
import { scrapeListDocs } from '../scripts/documents/list-docs';
import { scrapeEmployees } from '../scripts/employees';
import { scrapeGeneralInfo } from '../scripts/general_information';
import { scrapeOrgChart } from '../scripts/org_chart';
import { scrapeLiquidaciones } from '../scripts/pending_actions';
import { scrapeVacaciones } from '../scripts/vacation_days';
import { validateCredentials } from '../scripts/validate_credentials';

// ── Config ───────────────────────────────────────────────────────────────────

const DEFAULT_PORT = 3000;

// ── Helpers ──────────────────────────────────────────────────────────────────

type ScrapeBase = {
	success: boolean;
	errors: string[];
	outputFile: string | null;
};

type Credentials = {
	user: string;
	password: string;
};

type DownloadSelection = {
	id: string;
	isDir: boolean;
};

export type AppDependencies = {
	validateCredentials: typeof validateCredentials;
	scrapeEmployees: typeof scrapeEmployees;
	scrapeGeneralInfo: typeof scrapeGeneralInfo;
	scrapeOrgChart: typeof scrapeOrgChart;
	scrapeLiquidaciones: typeof scrapeLiquidaciones;
	scrapeAusencias: typeof scrapeAusencias;
	scrapeVacaciones: typeof scrapeVacaciones;
	scrapeListDirs: typeof scrapeListDirs;
	scrapeListDocs: typeof scrapeListDocs;
	scrapeFileSearch: typeof scrapeFileSearch;
	scrapeDownload: typeof scrapeDownload;
};

type AppConfig = {
	apiKey: string;
	defaultUser?: string;
	defaultPassword?: string;
	dependencies?: Partial<AppDependencies>;
};

type ServerConfig = AppConfig & {
	port?: number;
};

/**
 * Strips internal-only fields from scrape results before sending to clients.
 * Includes `errors` only when non-empty (keeps responses lean for LLM consumption).
 */
function toResponse<T extends ScrapeBase>(
	result: T,
): Omit<T, 'success' | 'outputFile' | 'errors'> & { errors?: string[] } {
	const { success: _s, outputFile: _f, errors, ...data } = result;
	const response = errors.length > 0 ? { ...data, errors } : data;
	return response as ReturnType<typeof toResponse<T>>;
}

function missingCreds() {
	return {
		error:
			"Query params 'user' and 'password' are required when DEFAULT_USER and DEFAULT_PASSWORD are not configured.",
	};
}

function hasCredential(value: string | undefined): value is string {
	return value != null && value !== '';
}

function resolveCredentials(
	query: Record<string, string | undefined>,
	defaults: { defaultUser?: string; defaultPassword?: string },
): Credentials | null {
	const user = hasCredential(query.user) ? query.user : defaults.defaultUser;
	const password = hasCredential(query.password)
		? query.password
		: defaults.defaultPassword;

	if (!hasCredential(user) || !hasCredential(password)) return null;

	return { user, password };
}

function getServerConfigFromEnv(): ServerConfig {
	const apiKey = process.env.API_KEY;

	if (!apiKey) {
		throw new Error('Fatal: API_KEY environment variable is required.');
	}

	const portRaw = process.env.PORT;
	const port = portRaw == null ? DEFAULT_PORT : Number(portRaw);
	if (!Number.isInteger(port) || port < 1 || port > 65_535) {
		throw new Error(
			`Fatal: invalid PORT value '${portRaw}'. Expected 1-65535.`,
		);
	}

	return {
		apiKey,
		port,
		defaultUser: process.env.DEFAULT_USER,
		defaultPassword: process.env.DEFAULT_PASSWORD,
	};
}

function assertLegajoxRelativePath(
	value: string,
	kind: 'directory' | 'document',
) {
	if (!value.startsWith('/')) {
		throw new Error(`Invalid ${kind} id: expected a Legajox relative path.`);
	}

	if (value.startsWith('//')) {
		throw new Error(
			`Invalid ${kind} id: protocol-relative paths are not allowed.`,
		);
	}

	if (!/^\/[A-Za-z0-9/_\-.~%?=&]+$/.test(value)) {
		throw new Error(`Invalid ${kind} id: unsupported characters in path.`);
	}
}

function normalizeDownloadSelection(selection: DownloadSelection[]) {
	const dirs: string[] = [];
	const links: string[] = [];

	for (const item of selection) {
		const id = item.id.trim();
		if (id === '') {
			throw new Error('Invalid selection id: value cannot be blank.');
		}

		if (item.isDir) {
			assertLegajoxRelativePath(id, 'directory');
			dirs.push(id);
			continue;
		}

		assertLegajoxRelativePath(id, 'document');
		links.push(id);
	}

	return { dirs, links };
}

async function withScrapeTimeout<T>(
	run: (signal: AbortSignal) => Promise<T>,
	timeoutMs = 300_000,
): Promise<T> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);

	try {
		return await run(controller.signal);
	} catch (error) {
		if (controller.signal.aborted) {
			throw new Error('Scrape timeout after 5 minutes');
		}
		throw error;
	} finally {
		clearTimeout(timer);
	}
}

// ── Document types ─────────────────────────────────────────────────────────────

type NexataListDirEntry = {
	id: string;
	name: string;
	nexataId: string | null;
	url?: string;
	size?: number; // in MB
	path?: string;
	ext?: 'dir' | string;
	updatedAt?: Date;
	extra?: object;
};

type NexataListDir = {
	cursor: string | null;
	entries: NexataListDirEntry[];
};

// ── Document mapping helpers ───────────────────────────────────────────────────

/** Parses a date string in the format "DD/MM/YYYY HH:MMhs" to a Date. */
function parseDocDate(dateStr: string): Date | undefined {
	const m = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
	if (!m) return undefined;
	return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]);
}

function carpetaToEntry(c: {
	nombre: string;
	href: string;
	cantidadArchivos: number;
}): NexataListDirEntry {
	return {
		id: c.href,
		name: c.nombre,
		nexataId: null,
		path: c.href,
		ext: 'dir',
		extra: { cantidadArchivos: c.cantidadArchivos },
	};
}

function documentoToEntry(d: {
	nombre: string;
	url: string;
	fecha: string;
	firmado: boolean;
}): NexataListDirEntry {
	const ext = d.nombre.includes('.')
		? d.nombre.split('.').pop()!.toLowerCase()
		: undefined;
	return {
		id: d.url,
		name: d.nombre,
		nexataId: null,
		url: d.url,
		ext,
		updatedAt: parseDocDate(d.fecha),
		extra: {
			firmado: d.firmado,
			fechaRaw: d.fecha, // Original date string (e.g. "31/07/2025 11:25hs")
		},
	};
}

function searchResultToEntry(r: {
	carpeta: string;
	nombre: string;
	href: string;
	url: string;
}): NexataListDirEntry {
	const ext = r.nombre.includes('.')
		? r.nombre.split('.').pop()!.toLowerCase()
		: undefined;
	return {
		id: r.href,
		name: r.nombre,
		nexataId: null,
		url: r.url,
		path: r.href,
		ext,
		extra: { carpeta: r.carpeta },
	};
}

function metadataToEntry(m: {
	nombre: string;
	downloadUrl: string;
	pesoBytes: number;
	extension: string;
	fecha: string;
	firmado: boolean;
	dirNombre: string;
	rutaLocal: string;
	estado: string;
	errorDetalle?: string;
	pesoLegible?: string;
	dir?: string;
}): NexataListDirEntry {
	return {
		id: m.downloadUrl,
		name: m.nombre,
		nexataId: null,
		url: m.downloadUrl,
		size: m.pesoBytes > 0 ? m.pesoBytes / (1024 * 1024) : undefined,
		path: m.rutaLocal || undefined,
		ext: m.extension || undefined,
		updatedAt: parseDocDate(m.fecha),
		extra: {
			estado: m.estado,
			firmado: m.firmado,
			dirNombre: m.dirNombre,
			dirPath: m.dir || null,
			pesoBytes: m.pesoBytes,
			pesoLegible: m.pesoLegible,
			fechaRaw: m.fecha,
			...(m.errorDetalle ? { errorDetalle: m.errorDetalle } : {}),
		},
	};
}

// ── Server ───────────────────────────────────────────────────────────────────

export function createApp({
	apiKey,
	defaultUser,
	defaultPassword,
	dependencies,
}: AppConfig) {
	const resolveRouteCredentials = (
		query: Record<string, string | undefined>,
	): Credentials | null =>
		resolveCredentials(query, { defaultUser, defaultPassword });
	const deps: AppDependencies = {
		validateCredentials,
		scrapeEmployees,
		scrapeGeneralInfo,
		scrapeOrgChart,
		scrapeLiquidaciones,
		scrapeAusencias,
		scrapeVacaciones,
		scrapeListDirs,
		scrapeListDocs,
		scrapeFileSearch,
		scrapeDownload,
		...dependencies,
	};

	return (
		new Elysia()

			// ── Auth guard ─────────────────────────────────────────────────────────────
			.onBeforeHandle(({ headers, status }) => {
				const raw = (headers.authorization as string | undefined) ?? '';
				const key = raw.startsWith('Bearer ') ? raw.slice(7) : raw;
				if (key !== apiKey) return status(401, { error: 'Unauthorized' });
			})

			// ── GET /validate ──────────────────────────────────────────────────────────
			// Checks whether the supplied Legajox credentials are valid.
			// If omitted, falls back to DEFAULT_USER / DEFAULT_PASSWORD.
			.get('/validate', async ({ query, status }) => {
				const queryParams = query as Record<string, string | undefined>;
				const creds = resolveRouteCredentials(queryParams);
				if (!creds) return status(400, missingCreds());
				const valid = await deps.validateCredentials(
					creds.user,
					creds.password,
				);
				return { valid };
			})

			// ── GET /employees ─────────────────────────────────────────────────────────
			// Returns all employees with their profile data (nombre, DNI, email, estado, etc.)
			// Optional: search (string) — filters via DataTable search box before scraping
			// Optional: page (int)     — scrapes only the given page (1-based); returns empty if out of range
			.get('/employees', async ({ query, status }) => {
				const queryParams = query as Record<string, string | undefined>;
				const { search, page } = queryParams;
				const creds = resolveRouteCredentials(queryParams);
				if (!creds) return status(400, missingCreds());
				const parsedPage = page != null ? parseInt(page, 10) : null;
				if (
					parsedPage !== null &&
					(Number.isNaN(parsedPage) || parsedPage < 1)
				) {
					return status(400, {
						error: "Query param 'page' must be a positive integer.",
					});
				}
				const options = { search: search ?? null, page: parsedPage };
				try {
					const result = await withScrapeTimeout((signal) =>
						deps.scrapeEmployees(creds.user, creds.password, options, signal),
					);
					if (!result.success)
						return status(500, {
							error: 'Scrape failed',
							details: result.errors,
						});
					return toResponse(result);
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					console.error(`[api] /employees error: ${msg}`);
					return status(500, { error: msg });
				}
			})

			// ── GET /info ──────────────────────────────────────────────────────────────
			// Returns the authenticated user's profile, company data, plan, and dashboard info.
			.get('/info', async ({ query, status }) => {
				const queryParams = query as Record<string, string | undefined>;
				const creds = resolveRouteCredentials(queryParams);
				if (!creds) return status(400, missingCreds());
				try {
					const result = await withScrapeTimeout((signal) =>
						deps.scrapeGeneralInfo(creds.user, creds.password, signal),
					);
					if (!result.success)
						return status(500, {
							error: 'Scrape failed',
							details: result.errors,
						});
					return toResponse(result);
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					console.error(`[api] /info error: ${msg}`);
					return status(500, { error: msg });
				}
			})

			// ── GET /org-chart ─────────────────────────────────────────────────────────
			// Returns the organizational chart as a hierarchical tree structure.
			.get('/org-chart', async ({ query, status }) => {
				const queryParams = query as Record<string, string | undefined>;
				const creds = resolveRouteCredentials(queryParams);
				if (!creds) return status(400, missingCreds());
				try {
					const result = await withScrapeTimeout((signal) =>
						deps.scrapeOrgChart(creds.user, creds.password, signal),
					);
					if (!result.success)
						return status(500, {
							error: 'Scrape failed',
							details: result.errors,
						});
					return toResponse(result);
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					console.error(`[api] /org-chart error: ${msg}`);
					return status(500, { error: msg });
				}
			})

			// ── GET /liquidaciones ─────────────────────────────────────────────────────
			// Returns pending payroll actions (recibos de sueldo, liquidaciones, Aconpy).
			// Optional: search (string) — filters via DataTable search box before scraping
			// Optional: page (int)     — scrapes only the given page (1-based); returns empty if out of range
			.get('/liquidaciones', async ({ query, status }) => {
				const queryParams = query as Record<string, string | undefined>;
				const { search, page } = queryParams;
				const creds = resolveRouteCredentials(queryParams);
				if (!creds) return status(400, missingCreds());
				const parsedPage = page != null ? parseInt(page, 10) : null;
				if (
					parsedPage !== null &&
					(Number.isNaN(parsedPage) || parsedPage < 1)
				) {
					return status(400, {
						error: "Query param 'page' must be a positive integer.",
					});
				}
				const options = { search: search ?? null, page: parsedPage };
				try {
					const result = await withScrapeTimeout((signal) =>
						deps.scrapeLiquidaciones(
							creds.user,
							creds.password,
							options,
							signal,
						),
					);
					if (!result.success) {
						console.error(`[api] /liquidaciones: scrape flagged as failed`);
						return status(500, {
							error: 'Scrape failed',
							details: result.errors,
						});
					}
					const response = toResponse(result);
					// Pre-serialize to detect serialization errors (kept as a safe check)
					try {
						JSON.stringify(response);
					} catch (serErr) {
						const msg =
							serErr instanceof Error ? serErr.message : String(serErr);
						console.error(
							`[api] /liquidaciones: JSON serialization failed:`,
							msg,
						);
						return status(500, { error: `JSON serialization failed: ${msg}` });
					}
					return response;
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					console.error(`[api] /liquidaciones error: ${msg}`);
					return status(500, { error: msg });
				}
			})

			// ── GET /ausencias ─────────────────────────────────────────────────────────
			// Returns absence records (licencias, permisos, inasistencias, faltas).
			// Optional filters (all nullable, applied client-side after scraping):
			//   name      — case-insensitive match on employee name
			//   from      — ISO date YYYY-MM-DD: include absences with fechaDesde >= from
			//   to        — ISO date YYYY-MM-DD: include absences with fechaHasta <= to
			//   historial — "true" → historial tab only | "false" → próximas tab only | absent → both
			//   motivo    — case-insensitive match on tipo (reason/type of absence)
			//   estado    — exact match: "Aprobada" | "Pendiente" | "Rechazada"
			.get('/ausencias', async ({ query, status }) => {
				const queryParams = query as Record<string, string | undefined>;
				const { name, from, to, historial, motivo, estado } = queryParams;
				const creds = resolveRouteCredentials(queryParams);
				if (!creds) return status(400, missingCreds());
				const validEstados = ['Aprobada', 'Pendiente', 'Rechazada'] as const;
				if (
					estado &&
					!validEstados.includes(estado as (typeof validEstados)[number])
				) {
					return status(400, {
						error: `Query param 'estado' must be one of: ${validEstados.join(', ')}.`,
					});
				}
				const filters: AusenciasFilters = {
					name: name ?? null,
					from: from ?? null,
					to: to ?? null,
					historial: historial != null ? historial === 'true' : null,
					motivo: motivo ?? null,
					estado: (estado as AusenciasFilters['estado']) ?? null,
				};
				try {
					const result = await withScrapeTimeout((signal) =>
						deps.scrapeAusencias(creds.user, creds.password, filters, signal),
					);
					if (!result.success)
						return status(500, {
							error: 'Scrape failed',
							details: result.errors,
						});
					return toResponse(result);
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					console.error(`[api] /ausencias error: ${msg}`);
					return status(500, { error: msg });
				}
			})

			// ── GET /vacaciones ────────────────────────────────────────────────────────
			// Returns vacation day balances per employee.
			.get('/vacaciones', async ({ query, status }) => {
				const queryParams = query as Record<string, string | undefined>;
				const creds = resolveRouteCredentials(queryParams);
				if (!creds) return status(400, missingCreds());
				try {
					const result = await withScrapeTimeout((signal) =>
						deps.scrapeVacaciones(creds.user, creds.password, signal),
					);
					if (!result.success)
						return status(500, {
							error: 'Scrape failed',
							details: result.errors,
						});
					return toResponse(result);
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					console.error(`[api] /vacaciones error: ${msg}`);
					return status(500, { error: msg });
				}
			})

			// ── GET /documents/list ──────────────────────────────────────────────────
			// path absent → top-level folders (list-dirs).
			// path provided → files inside that folder (list-docs).
			.get('/documents/list', async ({ query, status }) => {
				const queryParams = query as Record<string, string | undefined>;
				const { path: dirPath } = queryParams;
				const creds = resolveRouteCredentials(queryParams);
				if (!creds) return status(400, missingCreds());
				try {
					if (!dirPath) {
						const result = await withScrapeTimeout((signal) =>
							deps.scrapeListDirs(creds.user, creds.password, signal),
						);
						if (!result.success)
							return status(500, {
								error: 'Scrape failed',
								details: result.errors,
							});
						const entries: NexataListDirEntry[] =
							result.carpetas.map(carpetaToEntry);
						return { cursor: null, entries } as NexataListDir;
					} else {
						assertLegajoxRelativePath(dirPath.trim(), 'directory');
						const result = await withScrapeTimeout((signal) =>
							deps.scrapeListDocs(
								creds.user,
								creds.password,
								dirPath.trim(),
								signal,
							),
						);
						if (!result.success)
							return status(500, {
								error: 'Scrape failed',
								details: result.errors,
							});
						const entries: NexataListDirEntry[] =
							result.documentos.map(documentoToEntry);
						return { cursor: null, entries } as NexataListDir;
					}
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					console.error(`[api] /documents/list error: ${msg}`);
					return status(500, { error: msg });
				}
			})

			// ── GET /documents/search ─────────────────────────────────────────────────
			// Full-text file search. Query param 'q' is required (min 3 characters).
			.get('/documents/search', async ({ query, status }) => {
				const queryParams = query as Record<string, string | undefined>;
				const { q } = queryParams;
				const creds = resolveRouteCredentials(queryParams);
				if (!creds) return status(400, missingCreds());
				if (!q) return status(400, { error: "Query param 'q' is required." });
				if (q.trim().length < 3)
					return status(400, {
						error: "Query param 'q' must be at least 3 characters.",
					});
				try {
					const result = await withScrapeTimeout((signal) =>
						deps.scrapeFileSearch(creds.user, creds.password, q.trim(), signal),
					);
					if (!result.success)
						return status(500, {
							error: 'Scrape failed',
							details: result.errors,
						});
					const entries: NexataListDirEntry[] =
						result.results.map(searchResultToEntry);
					return { cursor: null, entries } as NexataListDir;
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					console.error(`[api] /documents/search error: ${msg}`);
					return status(500, { error: msg });
				}
			})

			// ── POST /documents/download ──────────────────────────────────────────────
			// Triggers download of selected dirs / files; returns per-item metadata.
			// isDir: true  → id is a folder path (e.g. "/files/edit/11111")
			// isDir: false → id is a direct download URL (e.g. from /documents/list)
			.post(
				'/documents/download',
				async ({ body, query, status }) => {
					const queryParams = query as Record<string, string | undefined>;
					const creds = resolveRouteCredentials(queryParams);
					if (!creds) return status(400, missingCreds());
					const { selection } = body;
					if (selection.length === 0) {
						return status(400, {
							error: "Body 'selection' must be a non-empty array.",
						});
					}
					try {
						const { dirs, links } = normalizeDownloadSelection(selection);
						const result = await withScrapeTimeout((signal) =>
							deps.scrapeDownload(
								creds.user,
								creds.password,
								dirs,
								links,
								signal,
							),
						);
						if (!result.success)
							return status(500, {
								error: 'Scrape failed',
								details: result.errors,
							});
						const entries: NexataListDirEntry[] =
							result.metadata.map(metadataToEntry);
						return { cursor: null, entries } as NexataListDir;
					} catch (err) {
						const msg = err instanceof Error ? err.message : String(err);
						if (msg.startsWith('Invalid ')) {
							return status(400, { error: msg });
						}
						console.error(`[api] /documents/download error: ${msg}`);
						return status(500, { error: msg });
					}
				},
				{
					body: t.Object({
						selection: t.Array(
							t.Object({
								id: t.String(),
								isDir: t.Boolean(),
							}),
						),
					}),
				},
			)
	);
}

export type App = ReturnType<typeof createApp>;

export function startServer(config: ServerConfig = getServerConfigFromEnv()) {
	const { port = DEFAULT_PORT, ...appConfig } = config;
	const app = createApp(appConfig);

	app.listen({ port, idleTimeout: 255 }); // max allowed by Bun
	console.log(`Legajox API listening on http://localhost:${port}`);

	return app;
}

if (import.meta.main) {
	try {
		startServer();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(message);
		process.exit(1);
	}
}
