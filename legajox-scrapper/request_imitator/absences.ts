import { getCiSession } from './get_cookies';
import { InvalidCookieError, legajoxHeaders } from './session';

const URL_ABSENCES = 'https://app.legajox.com/ausencias_legajo';

// State is determined by which SVG fill color is rendered inside the absence card.
// Aprobada → #01B671 (green check)   Pendiente → #ff9900 (orange bang)   Rechazada → #EA232A (red X)
// We detect this by scanning the inner HTML of each absence card for one of three sentinel strings.
export type Estado = 'Aprobada' | 'Pendiente' | 'Rechazada';

export interface Absence {
	ausenciaId: string; // from href="javascript:modalVerAusencia('35');"
	legajoId: string; // data-leg-id
	tipoAusenciaId: string; // data-au-tipo-id
	// Date range parsed from the calendar widgets
	fechaInicioMes: string;
	fechaIniciaDia: string;
	fechaFinMes: string;
	fechaFinDia: string;
	// Derived full dates (YYYY-MM-DD) — best-effort using current year
	fechaInicio: string | null;
	fechaFin: string | null;
	nombre: string;
	motivo: string;
	estado: Estado | null;
}

export async function fetchAbsences(cookie: string): Promise<string> {
	const response = await fetch(URL_ABSENCES, {
		headers: legajoxHeaders(cookie),
	});

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}

	if (response.url.includes('/login')) {
		throw new InvalidCookieError('Session invalid — redirected to login page');
	}

	const html = await response.text();

	if (html.includes('action="/login"') || html.includes("action='/login'")) {
		throw new InvalidCookieError(
			'Session invalid — login form found in response',
		);
	}

	if (!/init_funtion\(\d+\)/.test(html)) {
		throw new InvalidCookieError(
			'Session invalid — page returned without user context',
		);
	}

	return html;
}

const MONTH_MAP: Record<string, string> = {
	ene: '01',
	jan: '01',
	feb: '02',
	mar: '03',
	abr: '04',
	apr: '04',
	may: '05',
	jun: '06',
	jul: '07',
	ago: '08',
	aug: '08',
	sep: '09',
	oct: '10',
	nov: '11',
	dic: '12',
	dec: '12',
};

function resolveDate(
	mesAbrev: string,
	dia: string,
	referenceYear: number,
): string | null {
	const monthNum = MONTH_MAP[mesAbrev.toLowerCase().trim()];
	if (!monthNum) return null;
	const paddedDay = dia.trim().padStart(2, '0');
	return `${referenceYear}-${monthNum}-${paddedDay}`;
}

function detectEstado(cardHtml: string): Estado | null {
	// The status SVG colours are unique per state
	if (cardHtml.includes('#01B671') || cardHtml.includes('fill="#01B671"'))
		return 'Aprobada';
	if (cardHtml.includes('#ff9900') || cardHtml.includes('fill="#ff9900"'))
		return 'Pendiente';
	if (cardHtml.includes('#EA232A') || cardHtml.includes('fill="#EA232A"'))
		return 'Rechazada';
	return null;
}

export function parseAbsences(html: string): Absence[] {
	const absences: Absence[] = [];
	const currentYear = new Date().getFullYear();

	// Split on each absence card. They all share class "ausencia" and have data-leg-id.
	const parts = html.split('<div class="col-12 mx-auto cajas_vacaciones');

	for (let i = 1; i < parts.length; i++) {
		const raw = parts[i];

		// Close off at the next card start so we don't bleed into next card's HTML
		const card = raw;

		// data-leg-id and data-au-tipo-id
		const legajoIdMatch = card.match(/data-leg-id="(\d+)"/);
		const tipoIdMatch = card.match(/data-au-tipo-id="(\d+)"/);
		if (!legajoIdMatch) continue;

		const legajoId = legajoIdMatch[1];
		const tipoAusenciaId = tipoIdMatch?.[1] ?? '';

		// ausencia ID from the first modalVerAusencia call in the card
		const ausenciaIdMatch = card.match(/modalVerAusencia\('(\d+)'\)/);
		if (!ausenciaIdMatch) continue;
		const ausenciaId = ausenciaIdMatch[1];

		// Calendar widgets: two .calendario-ini blocks (start → end)
		const calBlocks = [
			...card.matchAll(
				/<div class="calendario-ini[^"]*">[\s\S]*?<span class="mes_calendario-ini">([^<]+)<\/span>[\s\S]*?<span class="dia_calendario-ini">([^<]+)<\/span>[\s\S]*?<\/div>/g,
			),
		];

		const fechaInicioMes = calBlocks[0]?.[1]?.trim() ?? '';
		const fechaIniciaDia = calBlocks[0]?.[2]?.trim() ?? '';
		const fechaFinMes = calBlocks[1]?.[1]?.trim() ?? fechaInicioMes;
		const fechaFinDia = calBlocks[1]?.[2]?.trim() ?? fechaIniciaDia;

		const fechaInicio = resolveDate(
			fechaInicioMes,
			fechaIniciaDia,
			currentYear,
		);
		const fechaFin = resolveDate(fechaFinMes, fechaFinDia, currentYear);

		// Employee name: inside .w-ausen > h6 > a
		const nombreMatch = card.match(
			/class="d-flex nombre_empleados"[^>]*>([^<]+)<\/a>/,
		);
		const nombre = nombreMatch ? nombreMatch[1].trim() : '';

		// Motivo (tipo ausencia): inside .estado-vacaciones > h6 > a (first link)
		const motivoMatch = card.match(
			/class="d-flex nombre_empleados mt-1 mr-2"[^>]*>([^<]+)<\/a>/,
		);
		const motivo = motivoMatch ? motivoMatch[1].trim() : '';

		const estado = detectEstado(card);

		absences.push({
			ausenciaId,
			legajoId,
			tipoAusenciaId,
			fechaInicioMes,
			fechaIniciaDia,
			fechaFinMes,
			fechaFinDia,
			fechaInicio,
			fechaFin,
			nombre,
			motivo,
			estado,
		});
	}

	return absences;
}

export interface Filters {
	name: string | null;
	from: Date | null;
	to: Date | null;
	motivo: string | null;
	estado: Estado | null;
}

function parseIsoDate(val: string | undefined): Date | null {
	if (!val) return null;
	const d = new Date(val);
	return Number.isNaN(d.getTime()) ? null : d;
}

export function filterAbsences(
	absences: Absence[],
	filters: Filters,
): Absence[] {
	return absences.filter((abs) => {
		if (filters.name !== null) {
			if (!abs.nombre.toLowerCase().includes(filters.name.toLowerCase()))
				return false;
		}

		if (filters.motivo !== null) {
			if (!abs.motivo.toLowerCase().includes(filters.motivo.toLowerCase()))
				return false;
		}

		if (filters.estado !== null) {
			if (abs.estado?.toLowerCase() !== filters.estado.toLowerCase())
				return false;
		}

		if (filters.from !== null && abs.fechaInicio) {
			const d = new Date(abs.fechaInicio);
			if (!Number.isNaN(d.getTime()) && d < filters.from) return false;
		}

		if (filters.to !== null && abs.fechaFin) {
			const d = new Date(abs.fechaFin);
			if (!Number.isNaN(d.getTime()) && d > filters.to) return false;
		}

		return true;
	});
}

function logAbsences(absences: Absence[]): void {
	if (absences.length === 0) {
		console.log('No absences found matching the given filters.');
		return;
	}

	console.log(`\nFound ${absences.length} absence(s):\n`);

	for (const abs of absences) {
		console.log(
			`  ID: ${abs.ausenciaId}  |  Legajo ID: ${abs.legajoId}  |  Tipo ID: ${abs.tipoAusenciaId}`,
		);
		console.log(`  Nombre:  ${abs.nombre}`);
		console.log(`  Motivo:  ${abs.motivo}`);
		console.log(
			`  Período: ${abs.fechaIniciaDia} ${abs.fechaInicioMes} → ${abs.fechaFinDia} ${abs.fechaFinMes}`,
		);
		if (abs.fechaInicio) {
			console.log(
				`  Fechas:  ${abs.fechaInicio} → ${abs.fechaFin ?? abs.fechaInicio}`,
			);
		}
		console.log(`  Estado:  ${abs.estado ?? 'Desconocido'}`);
		console.log('');
	}
}

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

async function main(): Promise<void> {
	const args = process.argv.slice(2);

	if (args.length === 0 || args[0].startsWith('--')) {
		console.error(
			'Usage: bun request_imitator/absences.ts <ci_session_cookie> [--name <str>] [--from <YYYY-MM-DD>] [--to <YYYY-MM-DD>] [--motivo <str>] [--estado <Aprobada|Pendiente|Rechazada>]',
		);
		process.exit(1);
	}

	let cookie = args[0];

	// Parse optional filter flags
	const get = (flag: string): string | undefined => {
		const idx = args.indexOf(flag);
		return idx !== -1 ? args[idx + 1] : undefined;
	};

	const nameFilter = get('--name') ?? null;
	const fromFilter = parseIsoDate(get('--from'));
	const toFilter = parseIsoDate(get('--to'));
	const motivoFilter = get('--motivo') ?? null;
	const estadoRaw = get('--estado')?.trim();
	let estadoFilter: Estado | null = null;
	if (estadoRaw) {
		const norm = estadoRaw.toLowerCase();
		if (norm === 'aprobada') estadoFilter = 'Aprobada';
		else if (norm === 'pendiente') estadoFilter = 'Pendiente';
		else if (norm === 'rechazada') estadoFilter = 'Rechazada';
		else {
			console.error(
				`Unknown estado "${estadoRaw}". Valid values: Aprobada, Pendiente, Rechazada`,
			);
			process.exit(1);
		}
	}

	const filters: Filters = {
		name: nameFilter,
		from: fromFilter,
		to: toFilter,
		motivo: motivoFilter,
		estado: estadoFilter,
	};

	console.log('Fetching absences…');

	let html: string;
	try {
		html = await fetchAbsences(cookie);
	} catch (err) {
		if (err instanceof InvalidCookieError) {
			console.warn(`[auth] ${err.message}. Attempting to refresh…`);
			try {
				cookie = await refreshCookie();
				console.log('[auth] Retrying fetch with fresh cookie…');
				html = await fetchAbsences(cookie);
			} catch (retryErr) {
				console.error(
					`[error] Retry failed: ${retryErr instanceof Error ? retryErr.message : retryErr}`,
				);
				process.exit(1);
			}
		} else {
			console.error(`[error] ${err instanceof Error ? err.message : err}`);
			process.exit(1);
		}
	}

	const absences = parseAbsences(html!);
	const filtered = filterAbsences(absences, filters);
	logAbsences(filtered);
}

if (import.meta.main) {
	main();
}
