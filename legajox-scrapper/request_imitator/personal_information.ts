import { getCiSession } from './get_cookies';
import { InvalidCookieError, legajoxHeaders } from './session';

const URL_PERSONAL_INFO = 'https://app.legajox.com/usuarios/perfil';

export interface PersonalInfo {
	// Session
	userId: number | null;
	// Navbar user pill
	displayName: string | null;
	navEmail: string | null;
	// Summary card (top of page)
	nombreApellido: string | null;
	summaryEmail: string | null;
	summaryDni: string | null;
	summaryCuit: string | null;
	cel: string | null;
	locacion: string | null;
	puestoSector: string | null;
	fechaContratacionSummary: string | null;
	// "Mi perfil" tab
	profileEmail: string | null;
	tipoColaborador: string | null;
	reportaA: string | null;
	// Datos básicos (personal tab)
	nombre: string | null;
	apellido: string | null;
	legajo: string | null;
	dni: string | null;
	celular: string | null;
	// Datos personales
	fechaNacimiento: string | null;
	cuil: string | null;
	estadoCivil: string | null;
	sexo: string | null;
	// Domicilio
	direccion: string | null;
	codigoPostal: string | null;
	pais: string | null;
	provincia: string | null;
	ciudad: string | null;
	// Datos laborales
	puesto: string | null;
	sector: string | null;
	turno: string | null;
	fechaContratacion: string | null;
}

export async function fetchPersonalInfo(cookie: string): Promise<string> {
	const response = await fetch(URL_PERSONAL_INFO, {
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

	// When authenticated, the page always contains `init_funtion(<userId>)` with a real ID.
	// If it's absent the server returned a blank/unauthenticated page.
	if (!/init_funtion\(\d+\)/.test(html)) {
		throw new InvalidCookieError(
			'Session invalid — page returned without user context',
		);
	}

	return html;
}

// Extract the value="" attribute from an <input> tag that has id="fieldId"
function getInputValue(html: string, fieldId: string): string | null {
	// Escape special regex chars in fieldId (just in case)
	const escaped = fieldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const tagMatch = html.match(new RegExp(`<input[^>]+id="${escaped}"[^>]*>`));
	if (!tagMatch) return null;
	const valMatch = tagMatch[0].match(/value="([^"]*)"/);
	return valMatch !== null ? valMatch[1].trim() : null;
}

// Find the selected <option> inside a <select id="selectId">
function getSelectedOption(
	html: string,
	selectId: string,
): { value: string; label: string } | null {
	const idIdx = html.indexOf(`id="${selectId}"`);
	if (idIdx === -1) return null;
	const tagStart = html.lastIndexOf('<select', idIdx);
	if (tagStart === -1) return null;
	const selectEnd = html.indexOf('</select>', idIdx);
	if (selectEnd === -1) return null;
	const block = html.slice(tagStart, selectEnd);
	const selectedMatch = block.match(
		/<option[^>]+selected[^>]*>([^<]*)<\/option>/i,
	);
	if (!selectedMatch) return null;
	const valueMatch = selectedMatch[0].match(/value="([^"]*)"/);
	return {
		value: valueMatch?.[1] ?? '',
		label: selectedMatch[1].trim().replace(/\s+/g, ' '),
	};
}

// Parse a summary-card label→value pair of the form:
// "Label:\n<span class="small ...">VALUE</span>"
function getSummaryField(html: string, label: string): string | null {
	const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const re = new RegExp(
		`${escaped}:[^<]*<span class="small[^"]*"[^>]*>([^<]*)<\\/span>`,
	);
	const m = html.match(re);
	if (!m) return null;
	const val = m[1].trim();
	return val.length > 0 ? val : null;
}

const PLACEHOLDER_LABELS = new Set([
	'Seleccione una opción',
	'Seleccioná una opción',
	'Estado civil',
]);

function resolveSelect(
	opt: { value: string; label: string } | null,
): string | null {
	if (!opt) return null;
	return PLACEHOLDER_LABELS.has(opt.label) ? null : opt.label || null;
}

export function parsePersonalInfo(html: string): PersonalInfo {
	// User ID from body onload="init_funtion(N)"
	const userIdMatch = html.match(/init_funtion\((\d+)\)/);
	const userId = userIdMatch ? parseInt(userIdMatch[1], 10) : null;

	// Navbar user pill: <strong>NAME</strong> and sibling <div class="fz-12">EMAIL</div>
	const displayNameMatch = html.match(
		/<div\s+class="lwtitle"><strong>([^<]+)<\/strong>/,
	);
	const displayName = displayNameMatch
		? displayNameMatch[1].trim().replace(/\s+/g, ' ')
		: null;
	// The nav email sits just below in the same pill block
	const navEmailMatch = html.match(
		/<div class="fz-12">([^\s<][^<]*@[^<]+)<\/div>/,
	);
	const navEmail = navEmailMatch ? navEmailMatch[1].trim() : null;

	// Summary card fields
	const nombreApellido = getSummaryField(html, 'Nombre y apellido');
	const summaryEmail = getSummaryField(html, 'Email');
	const summaryDni = getSummaryField(html, 'DNI');
	const summaryCuit = getSummaryField(html, 'CUIT');
	const cel = getSummaryField(html, 'Cel');
	const locacion = getSummaryField(html, 'Locación');
	const puestoSector = getSummaryField(html, 'Puesto\\/Sector');
	const fechaContratacionSummary = getSummaryField(html, 'Fecha contratación');

	// "Mi perfil" tab — disabled email input (no id, matched by disabled+type=email)
	const disabledEmailMatch = html.match(
		/<input\s+disabled\s+value="([^"]+)"[^>]+type="email"/,
	);
	const profileEmail = disabledEmailMatch ? disabledEmailMatch[1].trim() : null;

	// Tipo de colaborador select
	const tipoColaborador = resolveSelect(
		getSelectedOption(html, 'usr_colaborador'),
	);

	// Reporta a select
	const reportaA = resolveSelect(getSelectedOption(html, 'leg_reporta'));

	// Datos básicos
	const nombre = getInputValue(html, 'leg_nombre');
	const apellido = getInputValue(html, 'leg_apellido') || null;
	const legajo = getInputValue(html, 'leg_legajo') || null;
	const dni = getInputValue(html, 'leg_dni') || null;
	const celular = getInputValue(html, 'leg_telefono') || null;

	// Datos personales
	const fechaNacimiento = getInputValue(html, 'leg_fecha_nac') || null;
	const cuil = getInputValue(html, 'leg_cuil') || null;

	const estadoCivilOpt = getSelectedOption(html, 'leg_estado_civil');
	const estadoCivil = resolveSelect(estadoCivilOpt);

	const sexoOpt = getSelectedOption(html, 'leg_sexo');
	const sexoMap: Record<string, string> = { V: 'Hombre', M: 'Mujer' };
	const sexo =
		sexoOpt?.value && sexoOpt.value !== '0'
			? (sexoMap[sexoOpt.value] ?? sexoOpt.label)
			: null;

	// Domicilio
	const direccion = getInputValue(html, 'leg_domicilio') || null;
	const codigoPostal = getInputValue(html, 'leg_codigo_postal') || null;
	const pais = resolveSelect(getSelectedOption(html, 'pais_id'));
	const provincia = resolveSelect(getSelectedOption(html, 'prv_id'));
	const ciudad = getInputValue(html, 'leg_ciudad') || null;

	// Datos laborales
	const puesto = resolveSelect(getSelectedOption(html, 'leg_puesto'));
	const sector = resolveSelect(getSelectedOption(html, 'leg_sector'));
	const turno = resolveSelect(getSelectedOption(html, 'leg_turno'));
	const fechaContratacion =
		getInputValue(html, 'leg_fecha_contratacion') || null;

	return {
		userId,
		displayName,
		navEmail,
		nombreApellido,
		summaryEmail,
		summaryDni,
		summaryCuit,
		cel,
		locacion,
		puestoSector,
		fechaContratacionSummary,
		profileEmail,
		tipoColaborador,
		reportaA,
		nombre,
		apellido,
		legajo,
		dni,
		celular,
		fechaNacimiento,
		cuil,
		estadoCivil,
		sexo,
		direccion,
		codigoPostal,
		pais,
		provincia,
		ciudad,
		puesto,
		sector,
		turno,
		fechaContratacion,
	};
}

function logPersonalInfo(info: PersonalInfo): void {
	console.log('\n=== Información Personal ===\n');

	if (info.userId !== null)
		console.log(`  User ID:              ${info.userId}`);
	if (info.displayName)
		console.log(`  Nombre (display):     ${info.displayName}`);
	if (info.navEmail) console.log(`  Email (nav):          ${info.navEmail}`);

	console.log('\n-- Resumen --');
	if (info.nombreApellido)
		console.log(`  Nombre y Apellido:    ${info.nombreApellido}`);
	if (info.summaryEmail)
		console.log(`  Email:                ${info.summaryEmail}`);
	if (info.summaryDni)
		console.log(`  DNI:                  ${info.summaryDni}`);
	if (info.summaryCuit)
		console.log(`  CUIT:                 ${info.summaryCuit}`);
	if (info.cel) console.log(`  Celular:              ${info.cel}`);
	if (info.locacion) console.log(`  Locación:             ${info.locacion}`);
	if (info.puestoSector)
		console.log(`  Puesto/Sector:        ${info.puestoSector}`);
	if (info.fechaContratacionSummary)
		console.log(`  Fecha contratación:   ${info.fechaContratacionSummary}`);

	console.log('\n-- Mi perfil (tab) --');
	if (info.profileEmail)
		console.log(`  Email:                ${info.profileEmail}`);
	if (info.tipoColaborador)
		console.log(`  Tipo colaborador:     ${info.tipoColaborador}`);
	if (info.reportaA) console.log(`  Reporta a:            ${info.reportaA}`);

	console.log('\n-- Datos básicos --');
	if (info.nombre) console.log(`  Nombre:               ${info.nombre}`);
	if (info.apellido) console.log(`  Apellido:             ${info.apellido}`);
	if (info.legajo) console.log(`  Legajo:               ${info.legajo}`);
	if (info.dni) console.log(`  DNI:                  ${info.dni}`);
	if (info.celular) console.log(`  Celular:              ${info.celular}`);

	console.log('\n-- Datos personales --');
	if (info.fechaNacimiento)
		console.log(`  Fecha nacimiento:     ${info.fechaNacimiento}`);
	if (info.cuil) console.log(`  CUIL:                 ${info.cuil}`);
	if (info.estadoCivil)
		console.log(`  Estado civil:         ${info.estadoCivil}`);
	if (info.sexo) console.log(`  Sexo:                 ${info.sexo}`);

	console.log('\n-- Domicilio --');
	if (info.direccion) console.log(`  Dirección:            ${info.direccion}`);
	if (info.codigoPostal)
		console.log(`  Código postal:        ${info.codigoPostal}`);
	if (info.pais) console.log(`  País:                 ${info.pais}`);
	if (info.provincia) console.log(`  Provincia:            ${info.provincia}`);
	if (info.ciudad) console.log(`  Ciudad:               ${info.ciudad}`);

	console.log('\n-- Datos laborales --');
	if (info.puesto) console.log(`  Puesto:               ${info.puesto}`);
	if (info.sector) console.log(`  Sector:               ${info.sector}`);
	if (info.turno) console.log(`  Turno:                ${info.turno}`);
	if (info.fechaContratacion)
		console.log(`  Fecha contratación:   ${info.fechaContratacion}`);

	console.log('');
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
	const [, , cookieArg] = process.argv;

	if (!cookieArg) {
		console.error(
			'Usage: bun request_imitator/personal_information.ts <ci_session_cookie>',
		);
		process.exit(1);
	}

	let cookie = cookieArg;

	console.log('Fetching personal information…');

	let html: string;
	try {
		html = await fetchPersonalInfo(cookie);
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
				html = await fetchPersonalInfo(cookie);
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

	const info = parsePersonalInfo(html!);
	logPersonalInfo(info);
}

if (import.meta.main) {
	main();
}
