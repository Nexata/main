import { getCiSession } from './get_cookies';
import { InvalidCookieError, legajoxHeaders } from './session';

const URL_ORG_CHART = 'https://app.legajox.com/legajos/organigrama';

export interface Employee {
	usr_files_file_id: string;
	usr_nombre: string;
	usr_id: string;
	leg_grupo_nombre: string | null;
	leg_id: string;
	leg_nombre: string;
	leg_email: string;
	leg_apellido: string | null;
	leg_reporta_usr_id: string;
	leg_usuarios_usr_id: string;
	img_legajo: string | null;
}

export async function fetchOrgChart(cookie: string): Promise<string> {
	const response = await fetch(URL_ORG_CHART, {
		headers: legajoxHeaders(cookie),
	});

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}

	const html = await response.text();

	// Verify we're not redirected to login
	if (html.includes('id="usr_email"') || html.includes('id="usr_password"')) {
		throw new InvalidCookieError('Session invalid — redirected to login page');
	}

	return html;
}

export function parseEmployees(html: string): Employee[] {
	const employees: Employee[] = [];
	// Extract all data-usuario JSON blobs
	const pattern = /data-usuario='([^']+)'/g;
	let match: RegExpExecArray | null;

	while ((match = pattern.exec(html)) !== null) {
		try {
			// Unescape HTML entities in the attribute value
			const raw = match[1]
				.replace(/&quot;/g, '"')
				.replace(/&#039;/g, "'")
				.replace(/&amp;/g, '&');
			const employee: Employee = JSON.parse(raw);
			employees.push(employee);
		} catch {
			// skip malformed entries
		}
	}

	return employees;
}

function logOrgChart(employees: Employee[]): void {
	console.log(`\n=== Organigrama (${employees.length} empleados) ===\n`);

	for (const emp of employees) {
		const nombre = [emp.leg_nombre, emp.leg_apellido].filter(Boolean).join(' ');
		const perfil = emp.leg_grupo_nombre ?? 'Sin perfil';
		const foto = emp.img_legajo ? emp.img_legajo : '(sin foto)';

		console.log(`[leg_id: ${emp.leg_id}] ${nombre}`);
		console.log(`  usr_id:        ${emp.usr_id}`);
		console.log(`  Email:         ${emp.leg_email}`);
		console.log(`  Perfil:        ${perfil}`);
		console.log(`  Reporta a:     usr_id ${emp.leg_reporta_usr_id}`);
		console.log(`  Foto:          ${foto}`);
		console.log('');
	}
}

async function refreshCookie(): Promise<string> {
	const user = process.env.DEFAULT_USER;
	const password = process.env.DEFAULT_PASSWORD;

	if (!user || !password) {
		throw new Error(
			'DEFAULT_USER and DEFAULT_PASSWORD must be set in .env to auto-refresh the cookie.',
		);
	}

	console.log(`[auth] Logging in as ${user} to obtain a fresh cookie…`);
	const fresh = await getCiSession(user, password);
	console.log('[auth] Fresh ci_session obtained.');
	return fresh;
}

async function main(): Promise<void> {
	const [, , cookieArg] = process.argv;

	if (!cookieArg) {
		console.error(
			'Usage: bun request_imitator/org-chart.ts <ci_session_cookie>',
		);
		process.exit(1);
	}

	let cookie = cookieArg;

	console.log('Fetching org chart…');

	let html: string;
	try {
		html = await fetchOrgChart(cookie);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error(`[error] Fetch failed: ${msg}`);

		if (err instanceof InvalidCookieError) {
			console.warn(
				'[auth] Cookie is invalid or expired. Attempting to refresh…',
			);
			try {
				cookie = await refreshCookie();
				console.log('[auth] Retrying fetch with fresh cookie…');
				html = await fetchOrgChart(cookie);
			} catch (retryErr) {
				const retryMsg =
					retryErr instanceof Error ? retryErr.message : String(retryErr);
				console.error(`[error] Retry failed: ${retryMsg}`);
				process.exit(1);
			}
		} else {
			process.exit(1);
		}
	}

	const employees = parseEmployees(html!);

	if (employees.length === 0) {
		console.warn(
			'No employees found. The cookie may be expired or the page structure changed.',
		);
		process.exit(1);
	}

	logOrgChart(employees);
}

if (import.meta.main) {
	main();
}
