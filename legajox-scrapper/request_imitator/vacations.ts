import { InvalidCookieError, legajoxHeaders } from './session';

const URL_VACATIONS =
	'https://app.legajox.com/config/dias_vacaciones_empleados';

export interface VacationBalance {
	nombre: string;
	asignacionInicial: string;
	prorrateo: string;
	acarreo: string;
	disfrutados: string;
	planeados: string;
	proximoCiclo: string;
	disponibles: string;
}

export async function fetchVacationsPage(cookie: string): Promise<string> {
	const response = await fetch(URL_VACATIONS, {
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

function decodeHtmlEntities(value: string): string {
	return value
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>');
}

function textContent(html: string): string {
	return decodeHtmlEntities(html)
		.replace(/<script[\s\S]*?<\/script>/gi, '')
		.replace(/<style[\s\S]*?<\/style>/gi, '')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export function parseVacations(html: string): VacationBalance[] {
	const registros: VacationBalance[] = [];
	const rowPattern =
		/<tr\b(?=[^>]*class="[^"]*\bp5px\b)[^>]*>([\s\S]*?)<\/tr>/gi;
	let rowMatch: RegExpExecArray | null;

	while ((rowMatch = rowPattern.exec(html)) !== null) {
		const row = rowMatch[1];
		const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(
			(match) => textContent(match[1]),
		);

		if (cells.length < 8) continue;

		const nameMatch = row.match(
			/<span\b(?=[^>]*class="[^"]*\bnombre_empleados\b)[^>]*>([\s\S]*?)<\/span>/i,
		);
		const nombre = nameMatch ? textContent(nameMatch[1]) : cells[0];
		if (!nombre && cells.every((cell) => cell === '')) continue;

		registros.push({
			nombre,
			asignacionInicial: cells[1] ?? '',
			prorrateo: cells[2] ?? '',
			acarreo: cells[3] ?? '',
			disfrutados: cells[4] ?? '',
			planeados: cells[5] ?? '',
			proximoCiclo: cells[6] ?? '',
			disponibles: cells[7] ?? '',
		});
	}

	return registros;
}
