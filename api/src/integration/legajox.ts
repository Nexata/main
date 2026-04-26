import { authPlugin } from '@api/auth';
import { db } from '@api/env';
import { NexataFile } from '@api/file';
import {
	getFileCategory,
	getMimeTypeFromExt,
	isSupportedExt,
} from '@api/file/lib/types';
import {
	getIngestedDirIds,
	getIngestedFileIds,
	isFileUnmodified,
	type NexataListDir,
	type NexataListDirEntry,
} from '@api/integration/lib';
import { FileHost, file, type Language, TraceType, trace } from '@api/schema';
import type { ActiveUser } from '@api/utils/auth';
import {
	checkBatchCapacity,
	checkTenantCanIngest,
	clearIngestStopFlag,
	type FileEstimate,
	isIngestStopped,
	setIngestStopFlag,
} from '@api/utils/billing';
import { log, requireEnv } from '@api/utils/env';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { Nullish, tObject } from '@api/utils/type';
import { captureException } from '@sentry/bun';
import { and, eq } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import pLimit from 'p-limit';

const INGEST_CONCURRENCY = 8;
const RECHECK_INTERVAL = 50;
const REQUEST_TIMEOUT_MS = 180_000;
const SLOW_REQUEST_MS = 30_000;

const LEGAJOX_ALLOWED_SLUGS = (process.env.LEGAJOX_ALLOWED_SLUGS ?? '')
	.split(',')
	.filter(Boolean);

export function isLegajoxAllowed(activeUser: ActiveUser): boolean {
	return activeUser.isAdmin && LEGAJOX_ALLOWED_SLUGS.includes(activeUser.slug);
}

function assertLegajoxAccess(activeUser: ActiveUser) {
	if (!isLegajoxAllowed(activeUser))
		throw httpError(
			HttpCode.FORBIDDEN,
			ErrorCode.NO_CREDENTIAL_PERMISSION,
			activeUser.language as Language,
		);
}

export namespace Legajox {
	function baseUrl() {
		return requireEnv('LEGAJOX_API_URL');
	}

	function apiKey() {
		return requireEnv('LEGAJOX_API_KEY');
	}

	async function timedFetch(
		url: string,
		init: RequestInit,
		metadata: { path: string; method: string },
	): Promise<Response> {
		const startedAt = Date.now();
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

		try {
			const res = await fetch(url, { ...init, signal: controller.signal });
			const elapsedMs = Date.now() - startedAt;

			if (elapsedMs > SLOW_REQUEST_MS)
				log('warn', {
					message: 'Slow Legajox request',
					path: metadata.path,
					method: metadata.method,
					status: res.status,
					elapsedMs,
				});

			return res;
		} catch (error) {
			const elapsedMs = Date.now() - startedAt;
			captureException(error, {
				tags: { source: 'Legajox.timedFetch' },
				extra: {
					path: metadata.path,
					method: metadata.method,
					elapsedMs,
					timeoutMs: REQUEST_TIMEOUT_MS,
				},
			});

			throw httpError(HttpCode.CONFLICT, ErrorCode.EXTERNAL_ERROR);
		} finally {
			clearTimeout(timeout);
		}
	}

	async function request<T>(
		path: string,
		options?: { method?: string; body?: unknown },
	): Promise<T> {
		const url = `${baseUrl()}${path}`;
		const method = options?.method ?? 'GET';
		const res = await timedFetch(
			url,
			{
				method,
				headers: {
					Authorization: `Bearer ${apiKey()}`,
					...(options?.body ? { 'Content-Type': 'application/json' } : {}),
				},
				body: options?.body ? JSON.stringify(options.body) : undefined,
			},
			{ path, method },
		);

		if (!res.ok) {
			const text = await res.text().catch(() => '');
			captureException(new Error('Legajox request failed'), {
				tags: { source: 'Legajox.request' },
				extra: { path, method, status: res.status, body: text },
			});
			throw httpError(HttpCode.CONFLICT, ErrorCode.EXTERNAL_ERROR);
		}

		return res.json() as Promise<T>;
	}

	async function download(url: string, path: string) {
		return timedFetch(
			url,
			{
				method: 'GET',
				headers: {
					Authorization: `Bearer ${apiKey()}`,
				},
			},
			{ path, method: 'GET' },
		);
	}

	// --- Documents: search ---

	export const [searchDescription, searchInput] = [
		'Legajox tool to search for documents by name. Minimum 3 characters.',
		tObject({
			q: t.String({
				minLength: 3,
				description: 'Search term, minimum 3 characters.',
			}),
		}),
	] as const;

	export async function search(input: { q: string }): Promise<NexataListDir> {
		const data = await request<{
			cursor: string | null;
			entries: {
				id: string;
				name: string;
				nexataId: string | null;
				url?: string;
				size?: number;
				path?: string;
				ext?: string;
				updatedAt?: string;
			}[];
		}>(`/documents/search?q=${encodeURIComponent(input.q)}`);

		const entries: NexataListDirEntry[] = data.entries.map((e) => ({
			id: e.id,
			name: e.name,
			nexataId: e.nexataId,
			url: e.url,
			size: e.size,
			path: e.path,
			ext: e.ext,
			updatedAt: e.updatedAt ? new Date(e.updatedAt) : undefined,
		}));

		const fileIds = entries.filter((e) => e.ext !== 'dir').map((e) => e.id);
		const dirIds = entries.filter((e) => e.ext === 'dir').map((e) => e.id);
		const [ingestedFiles, ingestedDirs] = await Promise.all([
			getIngestedFileIds(fileIds, FileHost.LEGAJOX),
			getIngestedDirIds(dirIds, FileHost.LEGAJOX),
		]);

		return {
			cursor: data.cursor,
			entries: entries.map((e) => ({
				...e,
				nexataId:
					e.ext === 'dir'
						? (ingestedDirs.get(e.id) ?? null)
						: (ingestedFiles.get(e.id) ?? null),
			})),
		};
	}

	// --- Documents: list ---

	export const [listDirDescription, listDirInput] = [
		'Legajox tool to list document folders and files. Without path returns top-level folders; with path returns files inside that folder.',
		tObject({
			path: Nullish(t.String(), {
				description:
					'Folder path to list contents of. Omit for top-level folders.',
			}),
		}),
	] as const;

	export async function listDir(input: {
		path?: string | null;
	}): Promise<NexataListDir> {
		const params = input.path ? `?path=${encodeURIComponent(input.path)}` : '';
		const data = await request<{
			cursor: string | null;
			entries: {
				id: string;
				name: string;
				nexataId: string | null;
				url?: string;
				size?: number;
				path?: string;
				ext?: string;
				updatedAt?: string;
			}[];
		}>(`/documents/list${params}`);

		const entries: NexataListDirEntry[] = data.entries.map((e) => ({
			id: e.id,
			name: e.name,
			nexataId: e.nexataId,
			url: e.url,
			size: e.size,
			path: e.path,
			ext: e.ext,
			updatedAt: e.updatedAt ? new Date(e.updatedAt) : undefined,
		}));

		const fileIds = entries.filter((e) => e.ext !== 'dir').map((e) => e.id);
		const dirIds = entries.filter((e) => e.ext === 'dir').map((e) => e.id);
		const [ingestedFiles, ingestedDirs] = await Promise.all([
			getIngestedFileIds(fileIds, FileHost.LEGAJOX),
			getIngestedDirIds(dirIds, FileHost.LEGAJOX),
		]);

		return {
			cursor: data.cursor,
			entries: entries.map((e) => ({
				...e,
				nexataId:
					e.ext === 'dir'
						? (ingestedDirs.get(e.id) ?? null)
						: (ingestedFiles.get(e.id) ?? null),
			})),
		};
	}

	// --- Documents: ingest ---

	export const [ingestDescription, ingestInput] = [
		'Legajox tool to ingest (download and vectorize) files or folders from Legajox into Nexata. Use LegajoxSearch or LegajoxListDir first to find items, then pass their IDs here. Directories are ingested recursively. Only use when the user explicitly requests ingestion.',
		tObject({
			selection: t.Array(
				tObject({
					id: t.String({
						description: 'Legajox folder path or document path.',
					}),
					isDir: t.Boolean({
						description:
							'true when id is a folder path, false for a document path.',
					}),
				}),
				{ minItems: 1 },
			),
		}),
	] as const;

	export async function ingest(
		userId: string,
		slug: string,
		selection: { id: string; isDir: boolean }[],
	): Promise<{ ok: number; unmodified: number; failed: number }> {
		const blockReason = await checkTenantCanIngest(slug);
		if (blockReason) {
			if (blockReason === 'PAYMENT_REQUIRED')
				throw httpError(HttpCode.PAYMENT_REQUIRED, ErrorCode.PAYMENT_REQUIRED);
			throw httpError(
				HttpCode.PRECONDITION_FAILED,
				ErrorCode[blockReason as keyof typeof ErrorCode],
			);
		}

		// Call Legajox download endpoint to get file metadata + URLs
		const data = await request<{
			cursor: string | null;
			entries: {
				id: string;
				name: string;
				nexataId: string | null;
				url?: string;
				size?: number;
				path?: string;
				ext?: string;
				updatedAt?: string;
			}[];
		}>('/documents/download', {
			method: 'POST',
			body: { selection },
		});

		const entries = data.entries.filter((e) => isSupportedExt(e.name));

		const estimates: FileEstimate[] = entries.map((e) => ({
			sizeBytes: (e.size ?? 0) * 1024 * 1024,
			category: getFileCategory(e.name),
		}));

		const capacity = await checkBatchCapacity(slug, estimates);
		if (!capacity.canProceed)
			return { ok: 0, unmodified: 0, failed: entries.length };

		const entriesToProcess =
			capacity.maxFiles !== null
				? entries.slice(0, capacity.maxFiles)
				: entries;

		const results = { ok: 0, unmodified: 0, failed: 0 };
		if (capacity.maxFiles !== null)
			results.failed += entries.length - capacity.maxFiles;

		await clearIngestStopFlag(slug);
		const limit = pLimit(INGEST_CONCURRENCY);
		let processedCount = 0;

		const taskResults = await Promise.allSettled(
			entriesToProcess.map((entry) =>
				limit(async () => {
					if (await isIngestStopped(slug)) return 'FAILED';

					if (++processedCount % RECHECK_INTERVAL === 0) {
						const reason = await checkTenantCanIngest(slug);
						if (reason) {
							await setIngestStopFlag(slug);
							return 'FAILED';
						}
					}

					return ingestSingleFile(userId, slug, entry);
				}),
			),
		);

		for (const r of taskResults) {
			if (r.status === 'rejected') {
				results.failed++;
			} else {
				const key = r.value.toLowerCase() as keyof typeof results;
				results[key]++;
			}
		}

		return results;
	}

	async function ingestSingleFile(
		userId: string,
		slug: string,
		entry: {
			id: string;
			name: string;
			url?: string;
			size?: number;
			updatedAt?: string;
		},
	): Promise<string> {
		try {
			if (!entry.url) return 'FAILED';

			const modifiedAt = entry.updatedAt
				? new Date(entry.updatedAt)
				: undefined;
			if (await isFileUnmodified(FileHost.LEGAJOX, entry.id, modifiedAt))
				return 'UNMODIFIED';

			const res = await download(entry.url, `/documents/file/${entry.id}`);
			if (!res.ok) return 'FAILED';

			const buffer = await res.arrayBuffer();
			const mimeType = getMimeTypeFromExt(entry.name);
			if (mimeType === 'unsupported') return 'FAILED';

			const f = new File([buffer], entry.name, { type: mimeType });

			const result = await NexataFile.ingest(
				{
					userId,
					slug,
					provider: FileHost.LEGAJOX,
					externalId: entry.id,
					url: entry.url,
					name: entry.name,
					type: mimeType,
					modifiedAt,
				},
				f,
			);

			return result;
		} catch (error) {
			captureException(error, {
				tags: { source: 'Legajox.ingestSingleFile' },
				extra: { userId, entry },
			});

			await db.insert(trace).values({
				userId,
				type: TraceType.INGEST_FAILED,
				metadata: {
					provider: FileHost.LEGAJOX,
					externalId: entry.id,
					name: entry.name,
					error: error instanceof Error ? error.message : 'UNKNOWN',
				},
			});

			return 'FAILED';
		}
	}

	// --- Re-ingest (refresh folders) ---

	export async function reingest(
		userId: string,
		slug: string,
		selection: { id: string; isDir: boolean }[],
	) {
		// For re-ingest, resolve nexata file IDs back to external IDs
		const _externalIds: string[] = [];
		const resolvedSelection: { id: string; isDir: boolean }[] = [];

		for (const item of selection) {
			if (item.isDir) {
				// Folder re-ingest: pass the path directly
				resolvedSelection.push(item);
			} else {
				// File re-ingest: look up external ID from file table
				const existing = (
					await db
						.select({ externalId: file.externalId })
						.from(file)
						.where(
							and(eq(file.id, item.id), eq(file.provider, FileHost.LEGAJOX)),
						)
				).at(0);
				if (existing?.externalId)
					resolvedSelection.push({ id: existing.externalId, isDir: false });
			}
		}

		if (!resolvedSelection.length) return { ok: 0, unmodified: 0, failed: 0 };
		return ingest(userId, slug, resolvedSelection);
	}

	// --- Employees ---

	export const [listEmployeesDescription, listEmployeesInput] = [
		'Legajox tool to list employees from the HR system. Defaults to page 1 to avoid unbounded scrapes. Use page for pagination; for company-wide aggregates, query pages sequentially until an empty page is returned.',
		tObject({
			search: Nullish(t.String(), {
				description: 'Free-text filter applied through the search box.',
			}),
			page: Nullish(t.String(), {
				description: '1-based page number. Defaults to 1 when omitted.',
			}),
		}),
	] as const;

	export async function listEmployees(input: {
		search?: string | null;
		page?: string | null;
	}) {
		const params = new URLSearchParams();
		if (input.search) params.set('search', input.search);
		params.set('page', input.page ?? '1');
		const qs = params.toString();

		return request<{
			employees: {
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
			}[];
			errors?: string[];
		}>(`/employees${qs ? `?${qs}` : ''}`);
	}

	// --- Profile info ---

	export const [getInfoDescription, getInfoInput] = [
		'Legajox tool to get authenticated profile info, dashboard data, companies, plan usage, manager data, and announcements.',
		tObject({}),
	] as const;

	export async function getInfo() {
		return request<{ info: Record<string, unknown>; errors?: string[] }>(
			'/info',
		);
	}

	// --- Org chart ---

	export const [getOrgChartDescription, getOrgChartInput] = [
		'Legajox tool to get the organizational chart hierarchy.',
		tObject({}),
	] as const;

	export async function getOrgChart() {
		return request<{ chart: Record<string, unknown>; errors?: string[] }>(
			'/org-chart',
		);
	}

	// --- Payroll ---

	export const [listPayrollDescription, listPayrollInput] = [
		'Legajox tool to list pending payroll actions (payslips). Defaults to page 1 to avoid unbounded scrapes. Use page for pagination; query pages sequentially when a complete scan is needed.',
		tObject({
			search: Nullish(t.String(), {
				description: 'Free-text filter.',
			}),
			page: Nullish(t.String(), {
				description: '1-based page number. Defaults to 1 when omitted.',
			}),
		}),
	] as const;

	export async function listPayroll(input: {
		search?: string | null;
		page?: string | null;
	}) {
		const params = new URLSearchParams();
		if (input.search) params.set('search', input.search);
		params.set('page', input.page ?? '1');
		const qs = params.toString();

		return request<{
			liquidaciones: {
				id: string;
				descripcion: string;
				estado: string;
				pdfUrl: string;
			}[];
			total: number;
			errors?: string[];
		}>(`/liquidaciones${qs ? `?${qs}` : ''}`);
	}

	// --- Absences ---

	export const [listAbsencesDescription, listAbsencesInput] = [
		'Legajox tool to list absence records. Supports filtering by employee name, date range, reason, state, and historial mode.',
		tObject({
			name: Nullish(t.String(), { description: 'Employee name filter.' }),
			from: Nullish(t.String(), {
				description: 'Inclusive start date (YYYY-MM-DD).',
			}),
			to: Nullish(t.String(), {
				description: 'Inclusive end date (YYYY-MM-DD).',
			}),
			historial: Nullish(t.String(), {
				description: 'true for history, false for upcoming, omit for both.',
			}),
			motivo: Nullish(t.String(), { description: 'Absence reason filter.' }),
			estado: Nullish(t.String(), { description: 'State filter.' }),
		}),
	] as const;

	export async function listAbsences(input: {
		name?: string | null;
		from?: string | null;
		to?: string | null;
		historial?: string | null;
		motivo?: string | null;
		estado?: string | null;
	}) {
		const params = new URLSearchParams();
		if (input.name) params.set('name', input.name);
		if (input.from) params.set('from', input.from);
		if (input.to) params.set('to', input.to);
		if (input.historial) params.set('historial', input.historial);
		if (input.motivo) params.set('motivo', input.motivo);
		if (input.estado) params.set('estado', input.estado);
		const qs = params.toString();

		return request<{
			ausencias: {
				tipo: string;
				fechaDesde: string;
				fechaHasta: string;
				estado: string;
				nombre: string;
				dni: string;
				cuil: string;
				email: string;
				telefono: string;
				locacion: string;
				fechaContratacion: string;
				comentario: string;
			}[];
			total: number;
			errors?: string[];
		}>(`/ausencias${qs ? `?${qs}` : ''}`);
	}

	// --- Vacations ---

	export const [listVacationsDescription, listVacationsInput] = [
		'Legajox tool to list vacation balances per employee.',
		tObject({}),
	] as const;

	export async function listVacations() {
		return request<{
			registros: {
				nombre: string;
				asignacionInicial: string;
				prorrateo: string;
				acarreo: string;
				disfrutados: string;
				planeados: string;
				proximoCiclo: string;
				disponibles: string;
			}[];
			total: number;
			errors?: string[];
		}>('/vacaciones');
	}
}

// --- Router ---

export const legajoxRouter = new Elysia({ prefix: '/legajox' })
	.use(authPlugin())
	.resolve(({ activeUser }) => {
		assertLegajoxAccess(activeUser);
		return {};
	})
	.get('/search', async ({ query }) => Legajox.search(query), {
		detail: {
			summary: 'Search Legajox documents',
			description: Legajox.searchDescription,
		},
		query: tObject({
			q: t.String({ minLength: 3 }),
		}),
	})
	.get('/', async ({ query }) => Legajox.listDir(query), {
		detail: {
			summary: 'List Legajox documents/folders',
			description: Legajox.listDirDescription,
		},
		query: tObject({
			path: Nullish(t.String()),
		}),
	})
	.post(
		'/ingest',
		async ({ activeUser, body }) => {
			const blockReason = await checkTenantCanIngest(activeUser.slug);
			if (blockReason) {
				if (blockReason === 'PAYMENT_REQUIRED')
					throw httpError(
						HttpCode.PAYMENT_REQUIRED,
						ErrorCode.PAYMENT_REQUIRED,
						activeUser.language,
					);
				throw httpError(
					HttpCode.PRECONDITION_FAILED,
					ErrorCode[blockReason as keyof typeof ErrorCode],
					activeUser.language,
				);
			}

			return Legajox.ingest(activeUser.id, activeUser.slug, body.selection);
		},
		{
			detail: { summary: 'Ingest from Legajox' },
			body: tObject({
				selection: t.Array(
					tObject({
						id: t.String(),
						isDir: t.Boolean(),
					}),
				),
			}),
		},
	)
	.post(
		'/re-ingest',
		async ({ activeUser, body }) => {
			const blockReason = await checkTenantCanIngest(activeUser.slug);
			if (blockReason) {
				if (blockReason === 'PAYMENT_REQUIRED')
					throw httpError(
						HttpCode.PAYMENT_REQUIRED,
						ErrorCode.PAYMENT_REQUIRED,
						activeUser.language,
					);
				throw httpError(
					HttpCode.PRECONDITION_FAILED,
					ErrorCode[blockReason as keyof typeof ErrorCode],
					activeUser.language,
				);
			}

			return Legajox.reingest(activeUser.id, activeUser.slug, body.selection);
		},
		{
			detail: { summary: 'Re-ingest (refresh) from Legajox' },
			body: tObject({
				selection: t.Array(
					tObject({
						id: t.String(),
						isDir: t.Boolean(),
					}),
				),
			}),
		},
	);
