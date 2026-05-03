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
	type IngestResult,
	type IngestSelection,
	isFileUnmodified,
	type NexataListDir,
	type NexataListDirEntry,
} from '@api/integration/lib';
import {
	externalDir,
	FileHost,
	file,
	type Language,
	TraceType,
	trace,
} from '@api/schema';
import type { ActiveUser } from '@api/utils/auth';
import {
	checkBatchCapacity,
	checkTenantCanIngest,
	clearIngestStopFlag,
	type FileEstimate,
	invalidateStorageUsage,
	isIngestStopped,
	setIngestStopFlag,
} from '@api/utils/billing';
import { log, requireEnv } from '@api/utils/env';
import { ErrorCode, HttpCode, httpError } from '@api/utils/error';
import { isLegajoxAllowed } from '@api/utils/legajox';
import { Nullish, tObject } from '@api/utils/type';
import { captureException } from '@sentry/bun';
import { and, eq, notInArray } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import pLimit from 'p-limit';

export { isLegajoxAllowed } from '@api/utils/legajox';

const INGEST_CONCURRENCY = 8;
const RECHECK_INTERVAL = 50;
const REQUEST_TIMEOUT_MS = 180_000;
const SLOW_REQUEST_MS = 30_000;

function assertLegajoxAccess(activeUser: ActiveUser) {
	if (!isLegajoxAllowed(activeUser))
		throw httpError(
			HttpCode.FORBIDDEN,
			ErrorCode.NO_CREDENTIAL_PERMISSION,
			activeUser.language as Language,
		);
}

export namespace Legajox {
	type SearchInput = {
		Q?: string;
		q?: string;
		Path?: string | null;
		path?: string | null;
	};
	type ListDirInput = { Path?: string | null; path?: string | null };
	type SelectionInput = {
		Id?: string;
		id?: string;
		IsDir?: boolean;
		isDir?: boolean;
	};
	type EmployeesInput = {
		Search?: string | null;
		search?: string | null;
		Page?: string | null;
		page?: string | null;
		Legajo?: string | null;
		Name?: string | null;
		Active?: string | boolean | null;
		IngresoFrom?: string | null;
		IngresoTo?: string | null;
		EgresoFrom?: string | null;
		EgresoTo?: string | null;
	};
	type PayrollInput = {
		Search?: string | null;
		search?: string | null;
		Page?: string | null;
		page?: string | null;
	};
	type AbsencesInput = {
		Name?: string | null;
		name?: string | null;
		From?: string | null;
		from?: string | null;
		To?: string | null;
		to?: string | null;
		Historial?: string | boolean | null;
		historial?: string | boolean | null;
		Motivo?: string | null;
		motivo?: string | null;
		Estado?: string | null;
		estado?: string | null;
	};
	type AbsenceDetailInput = { Id?: string; id?: string };
	type NotificationsInput = {
		Query?: string | null;
		query?: string | null;
		From?: string | null;
		from?: string | null;
		To?: string | null;
		to?: string | null;
	};

	function baseUrl() {
		return requireEnv('LEGAJOX_API_URL');
	}

	function apiKey() {
		return requireEnv('LEGAJOX_API_KEY');
	}

	function legajoxUrl(pathOrUrl: string) {
		const value = pathOrUrl.trim();
		if (value.startsWith('http://') || value.startsWith('https://'))
			return value;

		return `${baseUrl().replace(/\/+$/, '')}/${value.replace(/^\/+/, '')}`;
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
		const url = legajoxUrl(path);
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

	function appendParam(
		params: URLSearchParams,
		key: string,
		value: string | boolean | null | undefined,
	) {
		if (value === null || value === undefined || value === '') return;
		params.set(key, String(value));
	}

	function queryString(params: URLSearchParams) {
		const qs = params.toString();
		return qs ? `?${qs}` : '';
	}

	function normalizeSelection(selection: SelectionInput[]) {
		return selection.map((item) => ({
			id: normalizeLegajoxSelectionId(item.Id ?? item.id ?? ''),
			isDir: item.IsDir ?? item.isDir ?? false,
		}));
	}

	function dedupeSelection(selection: { isDir: boolean; id: string }[]) {
		const unique = new Map<string, { isDir: boolean; id: string }>();

		for (const item of selection) unique.set(`${item.isDir}:${item.id}`, item);

		return [...unique.values()];
	}

	function normalizeLegajoxSelectionId(id: string) {
		const value = id.trim();
		if (!value.startsWith('http://') && !value.startsWith('https://'))
			return value;

		try {
			const url = new URL(value);
			if (url.host !== 'app.legajox.com') return value;
			return `${url.pathname}${url.search}`;
		} catch {
			return value;
		}
	}

	function legajoxAppUrl(id: string) {
		const value = id.trim();
		if (value.startsWith('http://') || value.startsWith('https://'))
			return value;
		return `https://app.legajox.com/${value.replace(/^\/+/, '')}`;
	}

	async function downloadDownloadedFile(filePath: string, path: string) {
		return timedFetch(
			legajoxUrl(`/documents/file?path=${encodeURIComponent(filePath)}`),
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
			Q: t.String({
				minLength: 3,
				description: 'Search term, minimum 3 characters.',
			}),
		}),
	] as const;

	export async function search(input: SearchInput): Promise<NexataListDir> {
		const q = input.Q ?? input.q ?? '';
		const path = input.Path ?? input.path;
		const params = new URLSearchParams({ q });
		appendParam(params, 'path', path);
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
		}>(`/documents/search?${params.toString()}`);

		const entries: NexataListDirEntry[] = data.entries.map((e) => ({
			id: normalizeLegajoxSelectionId(e.id),
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
			Path: Nullish(t.String(), {
				description:
					'Folder path to list contents of. Omit for top-level folders.',
			}),
		}),
	] as const;

	export async function listDir(input: ListDirInput): Promise<NexataListDir> {
		const path = input.Path ?? input.path;
		const params = path ? `?path=${encodeURIComponent(path)}` : '';
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
			id: normalizeLegajoxSelectionId(e.id),
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
			Selection: t.Array(
				tObject({
					Id: t.String({
						description: 'Legajox folder path or document path.',
					}),
					IsDir: t.Boolean({
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
		selection: SelectionInput[],
	): Promise<{ ok: number; unmodified: number; failed: number }> {
		return ingestSelection(
			userId,
			slug,
			undefined,
			normalizeSelection(selection),
		);
	}

	async function ingestSelection(
		userId: string,
		slug: string,
		credentialId: string | undefined,
		selection: { id: string; isDir: boolean }[],
	): Promise<IngestResult> {
		const normalizedSelection = dedupeSelection(selection).sort(({ isDir }) =>
			isDir ? -1 : 1,
		);
		const blockReason = await checkTenantCanIngest(slug);
		if (blockReason) {
			if (blockReason === 'PAYMENT_REQUIRED')
				throw httpError(HttpCode.PAYMENT_REQUIRED, ErrorCode.PAYMENT_REQUIRED);
			throw httpError(
				HttpCode.PRECONDITION_FAILED,
				ErrorCode[blockReason as keyof typeof ErrorCode],
			);
		}

		const fileSelection = normalizedSelection.filter((item) => !item.isDir);
		const dirSelection = normalizedSelection.filter((item) => item.isDir);
		const results: IngestResult = { ok: 0, unmodified: 0, failed: 0 };

		if (dirSelection.length) {
			const dirResults = await Promise.allSettled(
				dirSelection.map((dir) =>
					ingestDirectory(userId, slug, credentialId, dir.id),
				),
			);

			for (const result of dirResults) {
				if (result.status === 'rejected') {
					results.failed++;
					continue;
				}

				results.ok += result.value.ok;
				results.unmodified += result.value.unmodified;
				results.failed += result.value.failed;
			}
		}

		if (!fileSelection.length) return results;

		const fileResults = await ingestDownloadedSelection(
			userId,
			slug,
			fileSelection,
			credentialId,
		);
		results.ok += fileResults.ok;
		results.unmodified += fileResults.unmodified;
		results.failed += fileResults.failed;

		return results;
	}

	async function ingestDownloadedSelection(
		userId: string,
		slug: string,
		selection: { id: string; isDir: boolean }[],
		credentialId?: string,
		externalDirId?: string,
	): Promise<IngestResult> {
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

		const entries = data.entries.filter(
			(e) => e.path && e.size !== 0 && isSupportedExt(e.name),
		);
		const discardedEntries = data.entries.length - entries.length;

		const estimates: FileEstimate[] = entries.map((e) => ({
			sizeBytes: (e.size ?? 0) * 1024 * 1024,
			category: getFileCategory(e.name),
		}));

		const capacity = await checkBatchCapacity(slug, estimates);
		if (!capacity.canProceed)
			return {
				ok: 0,
				unmodified: 0,
				failed: entries.length + discardedEntries,
			};

		const entriesToProcess =
			capacity.maxFiles !== null
				? entries.slice(0, capacity.maxFiles)
				: entries;

		const results: IngestResult = {
			ok: 0,
			unmodified: 0,
			failed: discardedEntries,
		};
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

					return ingestSingleFile(
						userId,
						slug,
						entry,
						credentialId,
						externalDirId,
					);
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
			path?: string;
			size?: number;
			updatedAt?: string;
		},
		credentialId?: string,
		externalDirId?: string,
	): Promise<string> {
		try {
			if (!entry.path) return 'FAILED';

			const modifiedAt = entry.updatedAt
				? new Date(entry.updatedAt)
				: undefined;
			if (await isFileUnmodified(FileHost.LEGAJOX, entry.id, modifiedAt))
				return 'UNMODIFIED';

			const res = await downloadDownloadedFile(
				entry.path,
				`/documents/file/${entry.id}`,
			);
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
					externalDirId,
					externalId: entry.id,
					credentialId,
					url: legajoxAppUrl(entry.url ?? entry.id),
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

	async function ingestDirectory(
		userId: string,
		slug: string,
		credentialId: string | undefined,
		dirId: string,
	): Promise<IngestResult> {
		const existing = (
			await db
				.select({ id: externalDir.id })
				.from(externalDir)
				.where(
					and(
						eq(externalDir.provider, FileHost.LEGAJOX),
						eq(externalDir.externalId, dirId),
					),
				)
		).at(0);

		const listed = await listDir({ path: dirId });
		const remoteFiles = listed.entries.filter(
			(entry) => entry.ext !== 'dir' && isSupportedExt(entry.name),
		);
		const currentExternalIds = remoteFiles.map((entry) => entry.id);

		const externalDirId =
			existing?.id ??
			(
				await db
					.insert(externalDir)
					.values({
						externalId: dirId,
						credentialId: credentialId ?? null,
						name: dirId.split('/').filter(Boolean).at(-1) ?? dirId,
						provider: FileHost.LEGAJOX,
						url: legajoxAppUrl(dirId),
						autoSync: false,
						modifiedAt: new Date(),
					})
					.returning({ id: externalDir.id })
			).at(0)?.id;

		if (!externalDirId)
			throw httpError(
				HttpCode.INTERNAL_SERVER_ERROR,
				ErrorCode.EXTERNAL_DIR_FAILED,
			);

		if (existing) {
			const deleted = currentExternalIds.length
				? await db
						.delete(file)
						.where(
							and(
								eq(file.externalDirId, externalDirId),
								eq(file.provider, FileHost.LEGAJOX),
								notInArray(file.externalId, currentExternalIds),
							),
						)
						.returning({ id: file.id })
				: await db
						.delete(file)
						.where(
							and(
								eq(file.externalDirId, externalDirId),
								eq(file.provider, FileHost.LEGAJOX),
							),
						)
						.returning({ id: file.id });

			if (deleted.length) await invalidateStorageUsage(slug);
		}

		const unmodifiedResults = await Promise.all(
			remoteFiles.map(async (entry) => ({
				entry,
				unmodified: await isFileUnmodified(
					FileHost.LEGAJOX,
					entry.id,
					entry.updatedAt,
				),
			})),
		);
		const entriesToDownload = unmodifiedResults
			.filter(({ unmodified }) => !unmodified)
			.map(({ entry }) => entry);
		const unmodified = remoteFiles.length - entriesToDownload.length;

		if (!entriesToDownload.length) return { ok: 0, unmodified, failed: 0 };

		const result = await ingestDownloadedSelection(
			userId,
			slug,
			entriesToDownload.map((entry) => ({ id: entry.id, isDir: false })),
			credentialId,
			externalDirId,
		);

		return {
			ok: result.ok,
			unmodified: result.unmodified + unmodified,
			failed: result.failed,
		};
	}

	// --- Re-ingest (refresh folders) ---

	export async function reingest(
		userId: string,
		slug: string,
		selection: SelectionInput[],
	) {
		// For re-ingest, resolve Nexata IDs back to Legajox paths.
		const resolvedSelection: { id: string; isDir: boolean }[] = [];

		for (const item of normalizeSelection(selection)) {
			if (item.isDir) {
				const existing = (
					await db
						.select({ externalId: externalDir.externalId })
						.from(externalDir)
						.where(
							and(
								eq(externalDir.id, item.id),
								eq(externalDir.provider, FileHost.LEGAJOX),
							),
						)
				).at(0);

				resolvedSelection.push({
					id: existing?.externalId ?? item.id,
					isDir: true,
				});
			} else {
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

	export async function ingestFromCredential(
		userId: string,
		slug: string,
		credentialId: string,
		selection: IngestSelection[],
	): Promise<IngestResult> {
		return ingestSelection(userId, slug, credentialId, selection);
	}

	// --- Employees ---

	export const [listEmployeesDescription, listEmployeesInput] = [
		'Legajox tool to list employees from the HR system. Defaults to page 1 to avoid unbounded scrapes. Use page for pagination; for company-wide aggregates, query pages sequentially until an empty page is returned.',
		tObject({
			Search: Nullish(t.String(), {
				description: 'Free-text filter applied through the search box.',
			}),
			Page: Nullish(t.String(), {
				description: '1-based page number. Defaults to 1 when omitted.',
			}),
			Legajo: Nullish(t.String(), {
				description: 'Employee file number filter.',
			}),
			Name: Nullish(t.String(), {
				description: 'Employee name filter.',
			}),
			Active: Nullish(t.Boolean(), {
				description: 'true for active employees, false for inactive employees.',
			}),
			IngresoFrom: Nullish(t.String(), {
				description: 'Employment start date from YYYY-MM-DD.',
			}),
			IngresoTo: Nullish(t.String(), {
				description: 'Employment start date to YYYY-MM-DD.',
			}),
			EgresoFrom: Nullish(t.String(), {
				description: 'Employment end date from YYYY-MM-DD.',
			}),
			EgresoTo: Nullish(t.String(), {
				description: 'Employment end date to YYYY-MM-DD.',
			}),
		}),
	] as const;

	export async function listEmployees(input: EmployeesInput) {
		const params = new URLSearchParams();
		appendParam(params, 'search', input.Search ?? input.search);
		appendParam(params, 'page', input.Page ?? input.page ?? '1');
		appendParam(params, 'legajo', input.Legajo);
		appendParam(params, 'name', input.Name);
		appendParam(params, 'active', input.Active);
		appendParam(params, 'ingresoFrom', input.IngresoFrom);
		appendParam(params, 'ingresoTo', input.IngresoTo);
		appendParam(params, 'egresoFrom', input.EgresoFrom);
		appendParam(params, 'egresoTo', input.EgresoTo);

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
		}>(`/employees${queryString(params)}`);
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
			Search: Nullish(t.String(), {
				description: 'Free-text filter.',
			}),
			Page: Nullish(t.String(), {
				description: '1-based page number. Defaults to 1 when omitted.',
			}),
		}),
	] as const;

	export async function listPayroll(input: PayrollInput) {
		const params = new URLSearchParams();
		appendParam(params, 'search', input.Search ?? input.search);
		appendParam(params, 'page', input.Page ?? input.page ?? '1');

		return request<{
			liquidaciones: {
				id: string;
				descripcion: string;
				estado: string;
				pdfUrl: string;
			}[];
			total: number;
			errors?: string[];
		}>(`/liquidaciones${queryString(params)}`);
	}

	// --- Absences ---

	export const [listAbsencesDescription, listAbsencesInput] = [
		'Legajox tool to list absence records. Supports filtering by employee name, date range, reason, state, and historial mode.',
		tObject({
			Name: Nullish(t.String(), { description: 'Employee name filter.' }),
			From: Nullish(t.String(), {
				description: 'Inclusive start date (YYYY-MM-DD).',
			}),
			To: Nullish(t.String(), {
				description: 'Inclusive end date (YYYY-MM-DD).',
			}),
			Historial: Nullish(t.Boolean(), {
				description: 'true for history, false for upcoming, omit for both.',
			}),
			Motivo: Nullish(t.String(), { description: 'Absence reason filter.' }),
			Estado: Nullish(t.String(), { description: 'State filter.' }),
		}),
	] as const;

	export async function listAbsences(input: AbsencesInput) {
		const params = new URLSearchParams();
		appendParam(params, 'name', input.Name ?? input.name);
		appendParam(params, 'from', input.From ?? input.from);
		appendParam(params, 'to', input.To ?? input.to);
		appendParam(params, 'historial', input.Historial ?? input.historial);
		appendParam(params, 'motivo', input.Motivo ?? input.motivo);
		appendParam(params, 'estado', input.Estado ?? input.estado);

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
		}>(`/ausencias${queryString(params)}`);
	}

	// --- Absence detail ---

	export const [getAbsenceDetailDescription, getAbsenceDetailInput] = [
		'Legajox tool to get the full detail for a single absence by absence id. Use LegajoxAbsences first to find absence ids when needed.',
		tObject({
			Id: t.String({
				description:
					'Legajox absence id, returned as ausenciaId in absence data.',
			}),
		}),
	] as const;

	export async function getAbsenceDetail(input: AbsenceDetailInput) {
		const id = input.Id ?? input.id ?? '';

		return request<{
			detail: {
				id: string;
				legajoId: string;
				empresaId: string;
				autorizoUsuarioId: string;
				tipoId: string;
				fechaInicio: string;
				fechaFin: string;
				fechaAutorizacion: string | null;
				motivoRechazo: string;
				descripcion: string;
				comentarios: string;
				estado: string;
				createdAt: string;
				deletedAt: string | null;
				motivoEditar: string | null;
				fechaInicioFormat: string;
				fechaFinFormat: string;
				empleado: {
					id: string;
					legajo: string;
					nombre: string;
					apellido: string;
					dni: string;
					email: string;
					celular: string;
					fechaIngreso: string;
					fechaEgreso: string | null;
				};
				tipo: { id: string; nombre: string };
				autorizador: { nombre: string; apellido: string | null } | null;
				rol: string;
				usuarioId: string;
			};
			errors?: string[];
		}>(`/ausencias/${encodeURIComponent(id)}`);
	}

	// --- Notifications ---

	export const [listNotificationsDescription, listNotificationsInput] = [
		'Legajox tool to list dashboard notifications. Supports filtering by notification title/body text and created date range.',
		tObject({
			Query: Nullish(t.String(), {
				description:
					'Case-insensitive match on notification title or body text.',
			}),
			From: Nullish(t.String(), {
				description: 'Inclusive notification created date from YYYY-MM-DD.',
			}),
			To: Nullish(t.String(), {
				description: 'Inclusive notification created date to YYYY-MM-DD.',
			}),
		}),
	] as const;

	export async function listNotifications(input: NotificationsInput) {
		const params = new URLSearchParams();
		appendParam(params, 'query', input.Query ?? input.query);
		appendParam(params, 'from', input.From ?? input.from);
		appendParam(params, 'to', input.To ?? input.to);

		return request<{
			notificaciones: {
				id: string;
				titulo: string;
				texto: string;
				fechaLeido: string | null;
				createdAt: string;
				tipo: string;
				ausencia: number;
			}[];
			total: number;
			errors?: string[];
		}>(`/notificaciones${queryString(params)}`);
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
			path: Nullish(t.String()),
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
	.get(
		'/ausencias/:id',
		async ({ params }) => Legajox.getAbsenceDetail(params),
		{
			detail: {
				summary: 'Get Legajox absence detail',
				description: Legajox.getAbsenceDetailDescription,
			},
			params: tObject({ id: t.String() }),
		},
	)
	.get(
		'/notificaciones',
		async ({ query }) => Legajox.listNotifications(query),
		{
			detail: {
				summary: 'List Legajox notifications',
				description: Legajox.listNotificationsDescription,
			},
			query: tObject({
				query: Nullish(t.String()),
				from: Nullish(t.String()),
				to: Nullish(t.String()),
			}),
		},
	)
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
