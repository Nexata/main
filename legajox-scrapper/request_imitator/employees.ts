import { getCiSession } from './get_cookies';
import { InvalidCookieError, legajoxHeaders } from './session';

const URL_EMPLOYEES = 'https://app.legajox.com/legajos/empleados';

export interface Employee {
	leg_id: string;
	leg_empresas_emp_id: string;
	leg_usuarios_usr_id: string;
	leg_reporta_usr_id: string;
	leg_turnos_tur_id: string | null;
	leg_sucursales_suc_id: string | null;
	leg_sectores_sec_id: string | null;
	leg_files_file_id: string;
	leg_puestos_pts_id: string | null;
	leg_cargos_car_id: string | null;
	leg_cnf_id: string;
	leg_legajo: string;
	leg_nombre: string;
	leg_apellido: string;
	leg_dni: string;
	leg_email: string;
	leg_celular: string;
	leg_direccion: string | null;
	leg_pais: string | null;
	leg_codigo_postal: string | null;
	leg_ciudad: string | null;
	leg_provincia: string | null;
	leg_fecha_nacimiento: string | null;
	leg_cuil: string;
	leg_estado_civil: string | null;
	leg_sexo: string | null;
	leg_fecha_egreso: string | null;
	leg_fecha_ingreso: string;
	leg_fecha_baja: string | null;
	leg_situacion_baja: string | null;
	prv_id: string | null;
	prv_paises_pa_id: string | null;
	prv_nombre: string | null;
	prv_codigo: string | null;
	pa_id: string | null;
	pa_nombre: string | null;
	pa_codigo: string | null;
	pa_default: string | null;
	pa_prefijo: string | null;
	usr_id: string;
	usr_files_file_id: string;
	usr_roles_rol_id: string;
	usr_estudio_id: string | null;
	usr_nombre: string;
	usr_apellido: string;
	usr_telefono: string | null;
	usr_email: string;
	usr_activo: string;
	usr_emp_id_default: string;
	usr_fecha_registro: string;
	usr_fecha_confirmacion: string | null;
	usr_fecha_plan: string | null;
	usr_fecha_ultimo_login: string | null;
	usr_responsable_venta: string;
	usr_fecha_responsable: string | null;
	img_legajo: string | null;
	// Extra fields extracted from table columns (not in the JSON payload)
	emp_nombre: string | null;
	estado: string | null;
}

export async function fetchEmployees(cookie: string): Promise<string> {
	const response = await fetch(URL_EMPLOYEES, {
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
		throw new InvalidCookieError('Session invalid — redirected to login page');
	}

	return html;
}

export function parseEmployees(html: string): Employee[] {
	const employees: Employee[] = [];

	// Split on each employee row
	const rows = html.split('<tr class="p5px">');

	for (let i = 1; i < rows.length; i++) {
		const row = rows[i];

		// The full employee payload is embedded in the modalVerUsuario JS call
		const jsonMatch = row.match(/javascript:modalVerUsuario\(`(\{[^`]+\})`\)/);
		if (!jsonMatch) continue;

		try {
			// Convert single-quoted JS object literal to valid JSON
			const jsonStr = jsonMatch[1].replace(/'/g, '"');
			const data = JSON.parse(jsonStr) as Record<string, string | null>;

			// Plain-text <td> cells (no child HTML tags), trimmed and non-empty:
			// index 0 = email, index 1 = company name, index 2 = phone,
			// index 3 = cuil, index 4 = display legajo number, index 5 = reporta_usr_id
			const plainTds = [...row.matchAll(/<td>([^<]+)<\/td>/g)]
				.map((m) => m[1].trim())
				.filter((t) => t.length > 0);

			const emp_nombre = plainTds[1] ?? null;

			// Status badge: tag-verde = Activo, tag-rojo = Inactivo, etc.
			const statusMatch = row.match(/<span class="tag-[^"]+">([^<]+)<\/span>/);
			const estado = statusMatch ? statusMatch[1].trim() : null;

			employees.push({
				leg_id: data.leg_id ?? '',
				leg_empresas_emp_id: data.leg_empresas_emp_id ?? '',
				leg_usuarios_usr_id: data.leg_usuarios_usr_id ?? '',
				leg_reporta_usr_id: data.leg_reporta_usr_id ?? '',
				leg_turnos_tur_id: data.leg_turnos_tur_id ?? null,
				leg_sucursales_suc_id: data.leg_sucursales_suc_id ?? null,
				leg_sectores_sec_id: data.leg_sectores_sec_id ?? null,
				leg_files_file_id: data.leg_files_file_id ?? '',
				leg_puestos_pts_id: data.leg_puestos_pts_id ?? null,
				leg_cargos_car_id: data.leg_cargos_car_id ?? null,
				leg_cnf_id: data.leg_cnf_id ?? '',
				leg_legajo: data.leg_legajo ?? '',
				leg_nombre: data.leg_nombre ?? '',
				leg_apellido: data.leg_apellido ?? '',
				leg_dni: data.leg_dni ?? '',
				leg_email: data.leg_email ?? '',
				leg_celular: data.leg_celular ?? '',
				leg_direccion: data.leg_direccion ?? null,
				leg_pais: data.leg_pais ?? null,
				leg_codigo_postal: data.leg_codigo_postal ?? null,
				leg_ciudad: data.leg_ciudad ?? null,
				leg_provincia: data.leg_provincia ?? null,
				leg_fecha_nacimiento: data.leg_fecha_nacimiento ?? null,
				leg_cuil: data.leg_cuil ?? '',
				leg_estado_civil: data.leg_estado_civil ?? null,
				leg_sexo: data.leg_sexo ?? null,
				leg_fecha_egreso: data.leg_fecha_egreso ?? null,
				leg_fecha_ingreso: data.leg_fecha_ingreso ?? '',
				leg_fecha_baja: data.leg_fecha_baja ?? null,
				leg_situacion_baja: data.leg_situacion_baja ?? null,
				prv_id: data.prv_id ?? null,
				prv_paises_pa_id: data.prv_paises_pa_id ?? null,
				prv_nombre: data.prv_nombre ?? null,
				prv_codigo: data.prv_codigo ?? null,
				pa_id: data.pa_id ?? null,
				pa_nombre: data.pa_nombre ?? null,
				pa_codigo: data.pa_codigo ?? null,
				pa_default: data.pa_default ?? null,
				pa_prefijo: data.pa_prefijo ?? null,
				usr_id: data.usr_id ?? '',
				usr_files_file_id: data.usr_files_file_id ?? '',
				usr_roles_rol_id: data.usr_roles_rol_id ?? '',
				usr_estudio_id: data.usr_estudio_id ?? null,
				usr_nombre: data.usr_nombre ?? '',
				usr_apellido: data.usr_apellido ?? '',
				usr_telefono: data.usr_telefono ?? null,
				usr_email: data.usr_email ?? '',
				usr_activo: data.usr_activo ?? '',
				usr_emp_id_default: data.usr_emp_id_default ?? '',
				usr_fecha_registro: data.usr_fecha_registro ?? '',
				usr_fecha_confirmacion: data.usr_fecha_confirmacion ?? null,
				usr_fecha_plan: data.usr_fecha_plan ?? null,
				usr_fecha_ultimo_login: data.usr_fecha_ultimo_login ?? null,
				usr_responsable_venta: data.usr_responsable_venta ?? '',
				usr_fecha_responsable: data.usr_fecha_responsable ?? null,
				img_legajo: data.img_legajo ?? null,
				emp_nombre,
				estado,
			});
		} catch {
			// skip malformed rows
		}
	}

	return employees;
}

interface Filters {
	legajo: string | null;
	active: boolean | null;
	name: string | null;
	ingresoFrom: Date | null;
	ingresoTo: Date | null;
	egresoFrom: Date | null;
	egresoTo: Date | null;
}

function parseIsoDate(val: string | undefined): Date | null {
	if (!val) return null;
	const d = new Date(val);
	return Number.isNaN(d.getTime()) ? null : d;
}

// leg_fecha_ingreso / leg_fecha_egreso are in YYYY-MM-DD format
function parseFieldDate(val: string | null): Date | null {
	if (!val) return null;
	const d = new Date(val);
	return Number.isNaN(d.getTime()) ? null : d;
}

export function filterEmployees(
	employees: Employee[],
	filters: Filters,
): Employee[] {
	return employees.filter((emp) => {
		if (filters.legajo !== null) {
			if (!emp.leg_legajo.toLowerCase().includes(filters.legajo.toLowerCase()))
				return false;
		}

		if (filters.active !== null) {
			const estadoStr =
				emp.estado ?? (emp.usr_activo === '1' ? 'Activo' : 'Inactivo');
			const isActive =
				estadoStr.toLowerCase().includes('activo') &&
				!estadoStr.toLowerCase().includes('inactivo');
			if (filters.active !== isActive) return false;
		}

		if (filters.name !== null) {
			const fullName = `${emp.leg_nombre} ${emp.leg_apellido}`.toLowerCase();
			if (!fullName.includes(filters.name.toLowerCase())) return false;
		}

		if (filters.ingresoFrom || filters.ingresoTo) {
			const d = parseFieldDate(emp.leg_fecha_ingreso);
			if (!d) return true;
			if (filters.ingresoFrom && d < filters.ingresoFrom) return false;
			if (filters.ingresoTo && d > filters.ingresoTo) return false;
		}

		if (filters.egresoFrom || filters.egresoTo) {
			const d = parseFieldDate(emp.leg_fecha_egreso);
			if (!d) return false; // no egreso date — exclude when filtering by egreso range
			if (filters.egresoFrom && d < filters.egresoFrom) return false;
			if (filters.egresoTo && d > filters.egresoTo) return false;
		}

		return true;
	});
}

function logEmployees(employees: Employee[]): void {
	console.log(`\n=== Empleados (${employees.length} registros) ===\n`);

	for (const emp of employees) {
		const nombre = `${emp.leg_nombre} ${emp.leg_apellido}`.trim();
		console.log(`[leg_id: ${emp.leg_id}] ${nombre}`);
		console.log(`  Legajo:          ${emp.leg_legajo}`);
		console.log(
			`  Estado:          ${emp.estado ?? (emp.usr_activo === '1' ? 'Activo' : 'Inactivo')}`,
		);
		console.log(
			`  Empresa:         ${emp.emp_nombre ?? `(emp_id: ${emp.leg_empresas_emp_id})`}`,
		);
		console.log(`  DNI:             ${emp.leg_dni}`);
		console.log(`  CUIL:            ${emp.leg_cuil}`);
		console.log(`  Email:           ${emp.leg_email}`);
		console.log(`  Celular:         ${emp.leg_celular}`);
		if (emp.usr_telefono) console.log(`  Teléfono:        ${emp.usr_telefono}`);
		if (emp.leg_direccion)
			console.log(`  Dirección:       ${emp.leg_direccion}`);
		if (emp.leg_ciudad) console.log(`  Ciudad:          ${emp.leg_ciudad}`);
		if (emp.prv_nombre ?? emp.leg_provincia)
			console.log(`  Provincia:       ${emp.prv_nombre ?? emp.leg_provincia}`);
		if (emp.pa_nombre) console.log(`  País:            ${emp.pa_nombre}`);
		if (emp.leg_fecha_nacimiento)
			console.log(`  Nacimiento:      ${emp.leg_fecha_nacimiento}`);
		console.log(`  Fecha ingreso:   ${emp.leg_fecha_ingreso}`);
		if (emp.leg_fecha_egreso)
			console.log(`  Fecha egreso:    ${emp.leg_fecha_egreso}`);
		if (emp.leg_fecha_baja)
			console.log(`  Fecha baja:      ${emp.leg_fecha_baja}`);
		console.log(`  Sexo:            ${emp.leg_sexo ?? '-'}`);
		if (emp.leg_estado_civil)
			console.log(`  Estado civil:    ${emp.leg_estado_civil}`);
		console.log(`  Reporta a:       usr_id ${emp.leg_reporta_usr_id}`);
		console.log(`  usr_id:          ${emp.usr_id}`);
		console.log(`  Último login:    ${emp.usr_fecha_ultimo_login ?? '-'}`);
		if (emp.img_legajo) console.log(`  Foto:            ${emp.img_legajo}`);
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

function parseArgs(argv: string[]): { cookie: string; filters: Filters } {
	const args = argv.slice(2);
	const flags: Record<string, string> = {};
	const positional: string[] = [];

	for (let i = 0; i < args.length; i++) {
		if (args[i].startsWith('--')) {
			const key = args[i].slice(2);
			const next = args[i + 1];
			if (next && !next.startsWith('--')) {
				flags[key] = next;
				i++;
			} else {
				flags[key] = 'true';
			}
		} else {
			positional.push(args[i]);
		}
	}

	let active: boolean | null = null;
	if (flags.active !== undefined) {
		active = flags.active !== 'false';
	}

	return {
		cookie: positional[0] ?? '',
		filters: {
			legajo: flags.legajo ?? null,
			active,
			name: flags.name ?? null,
			ingresoFrom: parseIsoDate(flags['ingreso-from']),
			ingresoTo: parseIsoDate(flags['ingreso-to']),
			egresoFrom: parseIsoDate(flags['egreso-from']),
			egresoTo: parseIsoDate(flags['egreso-to']),
		},
	};
}

async function main(): Promise<void> {
	const { cookie: cookieArg, filters } = parseArgs(process.argv);

	if (!cookieArg) {
		console.error(
			'Usage: bun request_imitator/employees.ts <ci_session_cookie> [--legajo <str>] [--active true|false] [--name <str>] [--ingreso-from YYYY-MM-DD] [--ingreso-to YYYY-MM-DD] [--egreso-from YYYY-MM-DD] [--egreso-to YYYY-MM-DD]',
		);
		process.exit(1);
	}

	let cookie = cookieArg;

	console.log('Fetching employees…');

	let html: string;
	try {
		html = await fetchEmployees(cookie);
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
				html = await fetchEmployees(cookie);
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

	const all = parseEmployees(html!);

	if (all.length === 0) {
		console.warn(
			'No employees found. The cookie may be expired or the page structure changed.',
		);
		process.exit(1);
	}

	const employees = filterEmployees(all, filters);
	if (employees.length !== all.length) {
		console.log(
			`Filters applied: ${employees.length}/${all.length} employees match.`,
		);
	}

	logEmployees(employees);
}

if (import.meta.main) {
	main();
}
