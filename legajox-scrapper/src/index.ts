import openapi, { fromTypes } from '@elysiajs/openapi';
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
import { cached } from './cache-utils';

// ── Config ───────────────────────────────────────────────────────────────────

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = '0.0.0.0';
const DOCS_PATH = '/docs';
const OPENAPI_JSON_PATH = '/docs/json';

const OPENAPI_DESCRIPTION =
	'HTTP wrapper around Puppeteer-based Legajox scrapers for employees, profile data, organizational chart, payroll actions, absences, vacation balances, and Legajox documents.';

const OPENAPI_TYPE_REFERENCES = `{
	"/employees": {
		get: {
			query: {
				user?: string;
				password?: string;
				search?: string;
				page?: string;
			};
			response: {
				200: { employees: import('../scripts/employees').Employee[]; errors?: string[] };
				400: { error: string };
				401: { error: string };
				500: { error: string; details?: string[] };
			};
		};
	};
	"/info": {
		get: {
			query: { user?: string; password?: string };
			response: {
				200: { info: import('../scripts/general_information').GeneralInfo; errors?: string[] };
				400: { error: string };
				401: { error: string };
				500: { error: string; details?: string[] };
			};
		};
	};
	"/org-chart": {
		get: {
			query: { user?: string; password?: string };
			response: {
				200: { chart: import('../scripts/org_chart').OrgChart; errors?: string[] };
				400: { error: string };
				401: { error: string };
				500: { error: string; details?: string[] };
			};
		};
	};
	"/liquidaciones": {
		get: {
			query: { user?: string; password?: string; search?: string; page?: string };
			response: {
				200: { liquidaciones: import('../scripts/pending_actions').Liquidacion[]; total: number; errors?: string[] };
				400: { error: string };
				401: { error: string };
				500: { error: string; details?: string[] };
			};
		};
	};
	"/ausencias": {
		get: {
			query: { user?: string; password?: string; name?: string; from?: string; to?: string; historial?: string; motivo?: string; estado?: string };
			response: {
				200: { ausencias: import('../scripts/absences').Ausencia[]; total: number; errors?: string[] };
				400: { error: string };
				401: { error: string };
				500: { error: string; details?: string[] };
			};
		};
	};
	"/vacaciones": {
		get: {
			query: { user?: string; password?: string };
			response: {
				200: { registros: import('../scripts/vacation_days').VacacionEmpleado[]; total: number; errors?: string[] };
				400: { error: string };
				401: { error: string };
				500: { error: string; details?: string[] };
			};
		};
	};
}`;

const ErrorResponse = t.Object({
	error: t.String({ description: 'Human-readable error message.' }),
});

const CacheMetadata = t.Optional(
	t.Object({
		hit: t.Boolean(),
		key: t.String(),
		ttl: t.Number(),
	}),
);

const ScrapeFailureResponse = t.Object({
	error: t.String({ description: 'Top-level scrape failure message.' }),
	details: t.Array(t.String(), {
		description: 'Underlying scraper errors collected during execution.',
	}),
});

const EmployeeResponse = t.Object({
	nombre: t.String(),
	dni: t.String(),
	cuil: t.String(),
	email: t.String(),
	telefono: t.String(),
	empresa: t.String(),
	legajo: t.String(),
	fechaIngreso: t.String(),
	locacion: t.String(),
	estado: t.String(),
});

const EmployeesResponse = t.Object({
	employees: t.Array(EmployeeResponse),
	errors: t.Optional(t.Array(t.String())),
	_cache: CacheMetadata,
});

const EmpresaResponse = t.Object({
	nombre: t.String(),
	cuit: t.String(),
});

const ModuloResponse = t.Object({
	nombre: t.String(),
	activo: t.Boolean(),
});

const AnuncioResponse = t.Object({
	autor: t.String(),
	fecha: t.String(),
	texto: t.String(),
});

const GeneralInfoResponse = t.Object({
	nombreApellido: t.String(),
	dni: t.String(),
	cuit: t.String(),
	email: t.String(),
	celular: t.String(),
	locacion: t.String(),
	puestoSector: t.String(),
	fechaContratacion: t.String(),
	tipoColaborador: t.String(),
	reportaA: t.String(),
	legajo: t.String(),
	fechaNacimiento: t.String(),
	estadoCivil: t.String(),
	sexo: t.String(),
	domicilio: t.String(),
	codigoPostal: t.String(),
	pais: t.String(),
	provincia: t.String(),
	ciudad: t.String(),
	puestoLaboral: t.String(),
	sectorLaboral: t.String(),
	turno: t.String(),
	fechaContratacionLaboral: t.String(),
	empresas: t.Array(EmpresaResponse),
	legajosUsados: t.String(),
	legajosTotal: t.String(),
	modulos: t.Array(ModuloResponse),
	miResponsable: t.String(),
	reportanAMi: t.Array(t.String()),
	anuncios: t.Array(AnuncioResponse),
});

const InfoResponse = t.Object({
	info: GeneralInfoResponse,
	errors: t.Optional(t.Array(t.String())),
	_cache: CacheMetadata,
});

const OrgNodeResponse = t.Object({
	usrId: t.String(),
	legId: t.String(),
	nombre: t.String(),
	apellido: t.String(),
	email: t.String(),
	grupo: t.String(),
	reportaA: t.String(),
	subordinados: t.Array(t.Any()),
});

const OrgChartResponse = t.Object({
	totalEmpleados: t.String(),
	sinPerfilAsignado: t.String(),
	raiz: t.Union([OrgNodeResponse, t.Null()]),
	noAsignados: t.Array(OrgNodeResponse),
});

const OrgChartEnvelope = t.Object({
	chart: OrgChartResponse,
	errors: t.Optional(t.Array(t.String())),
	_cache: CacheMetadata,
});

const LiquidacionResponse = t.Object({
	id: t.String(),
	descripcion: t.String(),
	estado: t.String(),
	pdfUrl: t.String(),
});

const LiquidacionesResponse = t.Object({
	liquidaciones: t.Array(LiquidacionResponse),
	total: t.Number(),
	errors: t.Optional(t.Array(t.String())),
	_cache: CacheMetadata,
});

const AusenciaResponse = t.Object({
	tipo: t.String(),
	fechaDesde: t.String(),
	fechaHasta: t.String(),
	estado: t.String(),
	nombre: t.String(),
	dni: t.String(),
	cuil: t.String(),
	email: t.String(),
	telefono: t.String(),
	locacion: t.String(),
	fechaContratacion: t.String(),
	comentario: t.String(),
});

const AusenciasResponse = t.Object({
	ausencias: t.Array(AusenciaResponse),
	total: t.Number(),
	errors: t.Optional(t.Array(t.String())),
	_cache: CacheMetadata,
});

const VacacionEmpleadoResponse = t.Object({
	nombre: t.String(),
	asignacionInicial: t.String(),
	prorrateo: t.String(),
	acarreo: t.String(),
	disfrutados: t.String(),
	planeados: t.String(),
	proximoCiclo: t.String(),
	disponibles: t.String(),
});

const VacacionesResponse = t.Object({
	registros: t.Array(VacacionEmpleadoResponse),
	total: t.Number(),
	errors: t.Optional(t.Array(t.String())),
	_cache: CacheMetadata,
});

const DocumentListEntryResponse = t.Object({
	id: t.String(),
	name: t.String(),
	nexataId: t.Union([t.String(), t.Null()]),
	url: t.Optional(t.String()),
	size: t.Optional(t.Number()),
	path: t.Optional(t.String()),
	ext: t.Optional(t.String()),
	updatedAt: t.Optional(t.Date()),
	extra: t.Optional(t.Record(t.String(), t.Any())),
});

const DocumentListResponse = t.Object({
	cursor: t.Union([t.String(), t.Null()]),
	entries: t.Array(DocumentListEntryResponse),
	_cache: CacheMetadata,
});

const NocacheQuery = t.Optional(
	t.String({
		description: 'Set to "true" to bypass cache and force a fresh scrape.',
	}),
);

const CredentialsQuery = t.Object({
	user: t.Optional(
		t.String({ description: 'Legajox username. Falls back to DEFAULT_USER.' }),
	),
	password: t.Optional(
		t.String({
			description: 'Legajox password. Falls back to DEFAULT_PASSWORD.',
		}),
	),
	nocache: NocacheQuery,
});

const SearchAndPageQuery = t.Object({
	user: t.Optional(t.String()),
	password: t.Optional(t.String()),
	search: t.Optional(
		t.String({
			description: 'Free-text filter applied through the UI search box.',
		}),
	),
	page: t.Optional(t.String({ description: '1-based page number to scrape.' })),
	nocache: NocacheQuery,
});

const DocumentsListQuery = t.Object({
	user: t.Optional(t.String()),
	password: t.Optional(t.String()),
	path: t.Optional(
		t.String({
			description: 'Folder path returned by /documents/list top-level entries.',
		}),
	),
	nocache: NocacheQuery,
});

const DocumentsSearchQuery = t.Object({
	user: t.Optional(t.String()),
	password: t.Optional(t.String()),
	q: t.String({ description: 'Search term, minimum 3 characters.' }),
	nocache: NocacheQuery,
});

const AusenciasQuery = t.Object({
	user: t.Optional(t.String()),
	password: t.Optional(t.String()),
	name: t.Optional(t.String()),
	from: t.Optional(
		t.String({ description: 'Inclusive start date in YYYY-MM-DD.' }),
	),
	to: t.Optional(
		t.String({ description: 'Inclusive end date in YYYY-MM-DD.' }),
	),
	historial: t.Optional(
		t.String({
			description: 'true for history, false for upcoming, absent for both.',
		}),
	),
	motivo: t.Optional(t.String()),
	estado: t.Optional(t.String()),
	nocache: NocacheQuery,
});

const DownloadRequest = t.Object({
	selection: t.Array(
		t.Object({
			id: t.String({
				description:
					'Legajox folder path or document path, depending on isDir.',
			}),
			isDir: t.Boolean({
				description:
					'true when id is a folder path, false for a document path.',
			}),
		}),
	),
});

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

function isDocsPath(path: string) {
	return path === DOCS_PATH || path === OPENAPI_JSON_PATH;
}

function getOpenApiServers() {
	const publicUrl = process.env.PUBLIC_URL?.trim();
	if (publicUrl) {
		return [{ url: publicUrl, description: 'Deployment' }];
	}

	return [];
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

export function getServerConfigFromEnv(
	env: Record<string, string | undefined> = process.env,
): ServerConfig {
	const apiKey = env.API_KEY;

	if (!apiKey) {
		throw new Error('Fatal: API_KEY environment variable is required.');
	}

	const portRaw = env.PORT;
	const port = portRaw == null ? DEFAULT_PORT : Number(portRaw);
	if (!Number.isInteger(port) || port < 1 || port > 65_535) {
		throw new Error(
			`Fatal: invalid PORT value '${portRaw}'. Expected 1-65535.`,
		);
	}

	return {
		apiKey,
		port,
		defaultUser: env.DEFAULT_USER,
		defaultPassword: env.DEFAULT_PASSWORD,
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
			.use(
				openapi({
					path: DOCS_PATH,
					specPath: OPENAPI_JSON_PATH,
					provider: 'scalar',
					references: fromTypes(OPENAPI_TYPE_REFERENCES),
					documentation: {
						info: {
							title: 'Legajox Scrapper API',
							version: '1.0.0',
							description: OPENAPI_DESCRIPTION,
						},
						servers: getOpenApiServers(),
						tags: [
							{ name: 'auth', description: 'Credential validation endpoints.' },
							{ name: 'employees', description: 'Employee roster scraping.' },
							{
								name: 'profile',
								description: 'Authenticated user profile and dashboard data.',
							},
							{
								name: 'org-chart',
								description: 'Organization structure scraping.',
							},
							{
								name: 'payroll',
								description: 'Pending payroll documents and actions.',
							},
							{ name: 'absences', description: 'Absence records and filters.' },
							{
								name: 'vacations',
								description: 'Vacation balances per employee.',
							},
							{
								name: 'documents',
								description:
									'Document listing, search, and download endpoints.',
							},
						],
						components: {
							securitySchemes: {
								bearerAuth: {
									type: 'http',
									scheme: 'bearer',
									bearerFormat: 'API key',
								},
							},
						},
					},
					scalar: {
						defaultOpenAllTags: true,
						expandAllModelSections: true,
						expandAllResponses: true,
						hideClientButton: true,
						hideDarkModeToggle: true,
						persistAuth: true,
						theme: 'elysiajs',
					},
				}),
			)
			.get('/', () => ({ service: 'legajox-scrapper', docs: DOCS_PATH }), {
				detail: {
					summary: 'Health check',
					tags: ['system'],
					hide: true,
				},
			})

			// ── Auth guard ─────────────────────────────────────────────────────────────
			.onBeforeHandle(({ path, headers, status }) => {
				if (isDocsPath(path)) return;

				const raw = (headers.authorization as string | undefined) ?? '';
				const key = raw.startsWith('Bearer ') ? raw.slice(7) : raw;
				if (key !== apiKey) return status(401, { error: 'Unauthorized' });
			})

			// ── GET /validate ──────────────────────────────────────────────────────────
			// Checks whether the supplied Legajox credentials are valid.
			// If omitted, falls back to DEFAULT_USER / DEFAULT_PASSWORD.
			.get(
				'/validate',
				async ({ query, status }) => {
					const queryParams = query as Record<string, string | undefined>;
					const creds = resolveRouteCredentials(queryParams);
					if (!creds) return status(400, missingCreds());
					const nocache = queryParams.nocache === 'true';
					const cacheKey = `validate:${creds.user}`;
					const { data, _cache } = await cached(
						cacheKey,
						300, // 5 min
						async () => {
							const valid = await deps.validateCredentials(
								creds.user,
								creds.password,
							);
							return { valid };
						},
						{ nocache },
					);
					return { ...data, _cache };
				},
				{
					query: t.Object({
						user: t.Optional(t.String()),
						password: t.Optional(t.String()),
						nocache: NocacheQuery,
					}),
					response: {
						200: t.Object({ valid: t.Boolean(), _cache: CacheMetadata }),
						400: t.Object({ error: t.String() }),
						401: t.Object({ error: t.String() }),
					},
					detail: {
						summary: 'Validate Legajox credentials',
						description:
							'Attempts a real Legajox login using explicit query credentials or configured defaults.',
						tags: ['auth'],
						security: [{ bearerAuth: [] }],
					},
				},
			)

			// ── GET /employees ─────────────────────────────────────────────────────────
			// Returns all employees with their profile data (nombre, DNI, email, estado, etc.)
			// Optional: search (string) — filters via DataTable search box before scraping
			// Optional: page (int)     — scrapes only the given page (1-based); returns empty if out of range
			.get(
				'/employees',
				async ({ query, status }) => {
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
					const nocache = queryParams.nocache === 'true';
					const cacheKey = `employees:${creds.user}:${search ?? ''}:${parsedPage ?? 'all'}`;
					const options = { search: search ?? null, page: parsedPage };
					try {
						const { data, _cache } = await cached(
							cacheKey,
							1800, // 30 min
							async () => {
								const result = await withScrapeTimeout((signal) =>
									deps.scrapeEmployees(
										creds.user,
										creds.password,
										options,
										signal,
									),
								);
								if (!result.success) {
									throw Object.assign(new Error('Scrape failed'), {
										details: result.errors,
									});
								}
								return toResponse(result);
							},
							{ nocache },
						);
						return { ...data, _cache };
					} catch (err) {
						const msg = err instanceof Error ? err.message : String(err);
						if (msg === 'Scrape failed') {
							return status(500, {
								error: msg,
								details: (err as { details?: string[] }).details ?? [],
							});
						}
						console.error(`[api] /employees error: ${msg}`);
						return status(500, { error: msg });
					}
				},
				{
					query: SearchAndPageQuery,
					response: {
						200: EmployeesResponse,
						400: ErrorResponse,
						401: ErrorResponse,
						500: t.Union([ErrorResponse, ScrapeFailureResponse]),
					},
					detail: {
						summary: 'List employees',
						description:
							'Scrapes the Legajox employees table, optionally applying the UI search filter and limiting the scrape to a specific page.',
						tags: ['employees'],
						security: [{ bearerAuth: [] }],
					},
				},
			)

			// ── GET /info ──────────────────────────────────────────────────────────────
			// Returns the authenticated user's profile, company data, plan, and dashboard info.
			.get(
				'/info',
				async ({ query, status }) => {
					const queryParams = query as Record<string, string | undefined>;
					const creds = resolveRouteCredentials(queryParams);
					if (!creds) return status(400, missingCreds());
					const nocache = queryParams.nocache === 'true';
					const cacheKey = `info:${creds.user}`;
					try {
						const { data, _cache } = await cached(
							cacheKey,
							1800, // 30 min
							async () => {
								const result = await withScrapeTimeout((signal) =>
									deps.scrapeGeneralInfo(creds.user, creds.password, signal),
								);
								if (!result.success) {
									throw Object.assign(new Error('Scrape failed'), {
										details: result.errors,
									});
								}
								return toResponse(result);
							},
							{ nocache },
						);
						return { ...data, _cache } as any;
					} catch (err) {
						const msg = err instanceof Error ? err.message : String(err);
						if (msg === 'Scrape failed') {
							return status(500, {
								error: msg,
								details: (err as { details?: string[] }).details ?? [],
							});
						}
						console.error(`[api] /info error: ${msg}`);
						return status(500, { error: msg });
					}
				},
				{
					query: CredentialsQuery,
					response: {
						200: InfoResponse,
						400: ErrorResponse,
						401: ErrorResponse,
						500: t.Union([ErrorResponse, ScrapeFailureResponse]),
					},
					detail: {
						summary: 'Get authenticated profile info',
						description:
							'Scrapes the authenticated profile, dashboard, companies, plan usage, manager data, and announcements visible to the current user.',
						tags: ['profile'],
						security: [{ bearerAuth: [] }],
					},
				},
			)

			// ── GET /org-chart ─────────────────────────────────────────────────────────
			// Returns the organizational chart as a hierarchical tree structure.
			.get(
				'/org-chart',
				async ({ query, status }) => {
					const queryParams = query as Record<string, string | undefined>;
					const creds = resolveRouteCredentials(queryParams);
					if (!creds) return status(400, missingCreds());
					const nocache = queryParams.nocache === 'true';
					const cacheKey = `org-chart:${creds.user}`;
					try {
						const { data, _cache } = await cached(
							cacheKey,
							3600, // 60 min
							async () => {
								const result = await withScrapeTimeout((signal) =>
									deps.scrapeOrgChart(creds.user, creds.password, signal),
								);
								if (!result.success) {
									throw Object.assign(new Error('Scrape failed'), {
										details: result.errors,
									});
								}
								return toResponse(result);
							},
							{ nocache },
						);
						return { ...data, _cache } as any;
					} catch (err) {
						const msg = err instanceof Error ? err.message : String(err);
						if (msg === 'Scrape failed') {
							return status(500, {
								error: msg,
								details: (err as { details?: string[] }).details ?? [],
							});
						}
						console.error(`[api] /org-chart error: ${msg}`);
						return status(500, { error: msg });
					}
				},
				{
					query: CredentialsQuery,
					response: {
						200: OrgChartEnvelope,
						400: ErrorResponse,
						401: ErrorResponse,
						500: t.Union([ErrorResponse, ScrapeFailureResponse]),
					},
					detail: {
						summary: 'Get organizational chart',
						description:
							'Scrapes the Legajox organization chart and returns a hierarchical tree plus unassigned employees.',
						tags: ['org-chart'],
						security: [{ bearerAuth: [] }],
					},
				},
			)

			// ── GET /liquidaciones ─────────────────────────────────────────────────────
			// Returns pending payroll actions (recibos de sueldo, liquidaciones, Aconpy).
			// Optional: search (string) — filters via DataTable search box before scraping
			// Optional: page (int)     — scrapes only the given page (1-based); returns empty if out of range
			.get(
				'/liquidaciones',
				async ({ query, status }) => {
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
					const nocache = queryParams.nocache === 'true';
					const cacheKey = `liquidaciones:${creds.user}:${search ?? ''}:${parsedPage ?? 'all'}`;
					const options = { search: search ?? null, page: parsedPage };
					try {
						const { data, _cache } = await cached(
							cacheKey,
							3600, // 60 min
							async () => {
								const result = await withScrapeTimeout((signal) =>
									deps.scrapeLiquidaciones(
										creds.user,
										creds.password,
										options,
										signal,
									),
								);
								if (!result.success) {
									throw Object.assign(new Error('Scrape failed'), {
										details: result.errors,
									});
								}
								const response = toResponse(result);
								JSON.stringify(response); // validate serialization
								return response;
							},
							{ nocache },
						);
						return { ...data, _cache };
					} catch (err) {
						const msg = err instanceof Error ? err.message : String(err);
						if (msg === 'Scrape failed') {
							console.error('[api] /liquidaciones: scrape flagged as failed');
							return status(500, {
								error: msg,
								details: (err as { details?: string[] }).details ?? [],
							});
						}
						if (msg.startsWith('JSON serialization failed')) {
							console.error(`[api] /liquidaciones: ${msg}`);
							return status(500, { error: msg });
						}
						console.error(`[api] /liquidaciones error: ${msg}`);
						return status(500, { error: msg });
					}
				},
				{
					query: SearchAndPageQuery,
					response: {
						200: LiquidacionesResponse,
						400: ErrorResponse,
						401: ErrorResponse,
						500: t.Union([ErrorResponse, ScrapeFailureResponse]),
					},
					detail: {
						summary: 'List payroll actions',
						description:
							'Scrapes pending payroll actions such as payslips and preview links, optionally filtered by search text and page.',
						tags: ['payroll'],
						security: [{ bearerAuth: [] }],
					},
				},
			)

			// ── GET /ausencias ─────────────────────────────────────────────────────────
			// Returns absence records (licencias, permisos, inasistencias, faltas).
			// Optional filters (all nullable, applied client-side after scraping):
			//   name      — case-insensitive match on employee name
			//   from      — ISO date YYYY-MM-DD: include absences with fechaDesde >= from
			//   to        — ISO date YYYY-MM-DD: include absences with fechaHasta <= to
			//   historial — "true" → historial tab only | "false" → próximas tab only | absent → both
			//   motivo    — case-insensitive match on tipo (reason/type of absence)
			//   estado    — exact match: "Aprobada" | "Pendiente" | "Rechazada"
			.get(
				'/ausencias',
				async ({ query, status }) => {
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
					const nocache = queryParams.nocache === 'true';
					const cacheKey = `ausencias:${creds.user}:${name ?? ''}:${from ?? ''}:${to ?? ''}:${historial ?? ''}:${motivo ?? ''}:${estado ?? ''}`;
					const filters: AusenciasFilters = {
						name: name ?? null,
						from: from ?? null,
						to: to ?? null,
						historial: historial != null ? historial === 'true' : null,
						motivo: motivo ?? null,
						estado: (estado as AusenciasFilters['estado']) ?? null,
					};
					try {
						const { data, _cache } = await cached(
							cacheKey,
							900, // 15 min
							async () => {
								const result = await withScrapeTimeout((signal) =>
									deps.scrapeAusencias(
										creds.user,
										creds.password,
										filters,
										signal,
									),
								);
								if (!result.success) {
									throw Object.assign(new Error('Scrape failed'), {
										details: result.errors,
									});
								}
								return toResponse(result);
							},
							{ nocache },
						);
						return { ...data, _cache };
					} catch (err) {
						const msg = err instanceof Error ? err.message : String(err);
						if (msg === 'Scrape failed') {
							return status(500, {
								error: msg,
								details: (err as { details?: string[] }).details ?? [],
							});
						}
						console.error(`[api] /ausencias error: ${msg}`);
						return status(500, { error: msg });
					}
				},
				{
					query: AusenciasQuery,
					response: {
						200: AusenciasResponse,
						400: ErrorResponse,
						401: ErrorResponse,
						500: t.Union([ErrorResponse, ScrapeFailureResponse]),
					},
					detail: {
						summary: 'List absences',
						description:
							'Scrapes Legajox absence cards and optionally filters the combined result set by employee, date range, reason, state, and historial mode.',
						tags: ['absences'],
						security: [{ bearerAuth: [] }],
					},
				},
			)

			// ── GET /vacaciones ────────────────────────────────────────────────────────
			// Returns vacation day balances per employee.
			.get(
				'/vacaciones',
				async ({ query, status }) => {
					const queryParams = query as Record<string, string | undefined>;
					const creds = resolveRouteCredentials(queryParams);
					if (!creds) return status(400, missingCreds());
					const nocache = queryParams.nocache === 'true';
					const cacheKey = `vacaciones:${creds.user}`;
					try {
						const { data, _cache } = await cached(
							cacheKey,
							1800, // 30 min
							async () => {
								const result = await withScrapeTimeout((signal) =>
									deps.scrapeVacaciones(creds.user, creds.password, signal),
								);
								if (!result.success) {
									throw Object.assign(new Error('Scrape failed'), {
										details: result.errors,
									});
								}
								return toResponse(result);
							},
							{ nocache },
						);
						return { ...data, _cache };
					} catch (err) {
						const msg = err instanceof Error ? err.message : String(err);
						if (msg === 'Scrape failed') {
							return status(500, {
								error: msg,
								details: (err as { details?: string[] }).details ?? [],
							});
						}
						console.error(`[api] /vacaciones error: ${msg}`);
						return status(500, { error: msg });
					}
				},
				{
					query: CredentialsQuery,
					response: {
						200: VacacionesResponse,
						400: ErrorResponse,
						401: ErrorResponse,
						500: t.Union([ErrorResponse, ScrapeFailureResponse]),
					},
					detail: {
						summary: 'List vacation balances',
						description:
							'Scrapes the vacation balance table visible to the authenticated Legajox user.',
						tags: ['vacations'],
						security: [{ bearerAuth: [] }],
					},
				},
			)

			// ── GET /documents/list ──────────────────────────────────────────────────
			// path absent → top-level folders (list-dirs).
			// path provided → files inside that folder (list-docs).
			.get(
				'/documents/list',
				async ({ query, status }) => {
					const queryParams = query as Record<string, string | undefined>;
					const { path: dirPath } = queryParams;
					const creds = resolveRouteCredentials(queryParams);
					if (!creds) return status(400, missingCreds());
					const nocache = queryParams.nocache === 'true';
					const cacheKey = `docs-list:${creds.user}:${dirPath ?? 'root'}`;
					try {
						const { data, _cache } = await cached(
							cacheKey,
							900, // 15 min
							async () => {
								if (!dirPath) {
									const result = await withScrapeTimeout((signal) =>
										deps.scrapeListDirs(creds.user, creds.password, signal),
									);
									if (!result.success) {
										throw Object.assign(new Error('Scrape failed'), {
											details: result.errors,
										});
									}
									const entries: NexataListDirEntry[] =
										result.carpetas.map(carpetaToEntry);
									return { cursor: null, entries } as NexataListDir;
								}

								assertLegajoxRelativePath(dirPath.trim(), 'directory');
								const result = await withScrapeTimeout((signal) =>
									deps.scrapeListDocs(
										creds.user,
										creds.password,
										dirPath.trim(),
										signal,
									),
								);
								if (!result.success) {
									throw Object.assign(new Error('Scrape failed'), {
										details: result.errors,
									});
								}
								const entries: NexataListDirEntry[] =
									result.documentos.map(documentoToEntry);
								return { cursor: null, entries } as NexataListDir;
							},
							{ nocache },
						);
						return { ...data, _cache };
					} catch (err) {
						const msg = err instanceof Error ? err.message : String(err);
						if (msg === 'Scrape failed') {
							return status(500, {
								error: msg,
								details: (err as { details?: string[] }).details ?? [],
							});
						}
						console.error(`[api] /documents/list error: ${msg}`);
						return status(500, { error: msg });
					}
				},
				{
					query: DocumentsListQuery,
					response: {
						200: DocumentListResponse,
						400: ErrorResponse,
						401: ErrorResponse,
						500: t.Union([ErrorResponse, ScrapeFailureResponse]),
					},
					detail: {
						summary: 'List documents or folders',
						description:
							'Without path, returns top-level document folders. With path, returns the files inside a specific Legajox folder.',
						tags: ['documents'],
						security: [{ bearerAuth: [] }],
					},
				},
			)

			// ── GET /documents/search ─────────────────────────────────────────────────
			// Full-text file search. Query param 'q' is required (min 3 characters).
			.get(
				'/documents/search',
				async ({ query, status }) => {
					const queryParams = query as Record<string, string | undefined>;
					const { q } = queryParams;
					const creds = resolveRouteCredentials(queryParams);
					if (!creds) return status(400, missingCreds());
					if (!q) return status(400, { error: "Query param 'q' is required." });
					if (q.trim().length < 3)
						return status(400, {
							error: "Query param 'q' must be at least 3 characters.",
						});
					const nocache = queryParams.nocache === 'true';
					const cacheKey = `docs-search:${creds.user}:${q.trim()}`;
					try {
						const { data, _cache } = await cached(
							cacheKey,
							600, // 10 min
							async () => {
								const result = await withScrapeTimeout((signal) =>
									deps.scrapeFileSearch(
										creds.user,
										creds.password,
										q.trim(),
										signal,
									),
								);
								if (!result.success) {
									throw Object.assign(new Error('Scrape failed'), {
										details: result.errors,
									});
								}
								const entries: NexataListDirEntry[] =
									result.results.map(searchResultToEntry);
								return { cursor: null, entries } as NexataListDir;
							},
							{ nocache },
						);
						return { ...data, _cache };
					} catch (err) {
						const msg = err instanceof Error ? err.message : String(err);
						if (msg === 'Scrape failed') {
							return status(500, {
								error: msg,
								details: (err as { details?: string[] }).details ?? [],
							});
						}
						console.error(`[api] /documents/search error: ${msg}`);
						return status(500, { error: msg });
					}
				},
				{
					query: DocumentsSearchQuery,
					response: {
						200: DocumentListResponse,
						400: ErrorResponse,
						401: ErrorResponse,
						500: t.Union([ErrorResponse, ScrapeFailureResponse]),
					},
					detail: {
						summary: 'Search documents',
						description:
							'Runs the Legajox document full-text search UI and returns matching files as normalized entries.',
						tags: ['documents'],
						security: [{ bearerAuth: [] }],
					},
				},
			)

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
					query: CredentialsQuery,
					body: DownloadRequest,
					response: {
						200: DocumentListResponse,
						400: ErrorResponse,
						401: ErrorResponse,
						500: t.Union([ErrorResponse, ScrapeFailureResponse]),
					},
					detail: {
						summary: 'Download selected documents',
						description:
							'Downloads selected Legajox folders or individual document paths and returns normalized metadata for the processed files.',
						tags: ['documents'],
						security: [{ bearerAuth: [] }],
					},
				},
			)
	);
}

export type App = ReturnType<typeof createApp>;

export function startServer(config: ServerConfig = getServerConfigFromEnv()) {
	const { port = DEFAULT_PORT, ...appConfig } = config;
	const app = createApp(appConfig);

	app.listen({ hostname: DEFAULT_HOST, port, idleTimeout: 255 }); // max allowed by Bun
	console.log(`Legajox API listening on http://${DEFAULT_HOST}:${port}`);

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
