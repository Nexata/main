import { getCiSession } from './get_cookies';
import { InvalidCookieError, legajoxHeaders } from './session';

const BASE_URL = 'https://app.legajox.com/ausencias/ver';

export interface AbsenceDetail {
	au_id: string;
	au_legajo_id: string;
	au_empresa_id: string;
	au_autorizo_usr_id: string;
	au_tipo_id: string;
	au_fecha_inicio: string;
	au_fecha_fin: string;
	au_fecha_autorizacion: string | null;
	au_motivo_rechazo: string;
	au_descripcion: string;
	au_comentarios: string;
	au_estado: string;
	au_created_at: string;
	au_deleted_at: string | null;
	au_motivo_editar: string | null;
	au_fecha_inicio_format: string;
	au_fecha_fin_format: string;
	// Legajo fields
	leg_id: string;
	leg_legajo: string;
	leg_nombre: string;
	leg_apellido: string;
	leg_dni: string;
	leg_email: string;
	leg_celular: string;
	leg_fecha_ingreso: string;
	leg_fecha_egreso: string | null;
	// Tipo ausencia
	ta_id: string;
	ta_nombre: string;
	// Autorizer
	usr_autorizo: {
		usr_nombre: string;
		usr_apellido: string | null;
	} | null;
	rol: string;
	usr_id: string;
}

export async function fetchAbsenceDetail(
	absenceId: string,
	cookie: string,
): Promise<AbsenceDetail> {
	const url = `${BASE_URL}/${absenceId}`;

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			...legajoxHeaders(
				cookie,
				'application/json, text/javascript, */*; q=0.01',
			),
			'X-Requested-With': 'XMLHttpRequest',
			'Content-Length': '0',
		},
	});

	if (response.url.includes('/login')) {
		throw new InvalidCookieError('Session invalid — redirected to login page');
	}

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}

	const json = (await response.json()) as {
		status?: number;
		error?: boolean;
		data?: Record<string, string | null>;
		rol?: string;
		usr_id?: string;
		usr_autorizo?: { usr_nombre: string; usr_apellido: string | null };
		messages?: string;
	};

	if (json.error === true) {
		const msg = json.messages ?? 'Unknown error from server';
		// A session error typically returns an error flag — treat lack of usr_id as auth failure
		if (!json.usr_id) {
			throw new InvalidCookieError(
				`Session invalid — server returned error: ${msg}`,
			);
		}
		throw new Error(`Server error: ${msg}`);
	}

	if (!json.data) {
		throw new Error('Unexpected response format: missing "data" field');
	}

	const d = json.data;

	return {
		au_id: d.au_id ?? '',
		au_legajo_id: d.au_legajo_id ?? '',
		au_empresa_id: d.au_empresa_id ?? '',
		au_autorizo_usr_id: d.au_autorizo_usr_id ?? '',
		au_tipo_id: d.au_tipo_id ?? '',
		au_fecha_inicio: d.au_fecha_inicio ?? '',
		au_fecha_fin: d.au_fecha_fin ?? '',
		au_fecha_autorizacion: d.au_fecha_autorizacion ?? null,
		au_motivo_rechazo: d.au_motivo_rechazo ?? '',
		au_descripcion: d.au_descripcion ?? '',
		au_comentarios: d.au_comentarios ?? '',
		au_estado: d.au_estado ?? '',
		au_created_at: d.au_created_at ?? '',
		au_deleted_at: d.au_deleted_at ?? null,
		au_motivo_editar: d.au_motivo_editar ?? null,
		au_fecha_inicio_format: d.au_fecha_inicio_format ?? '',
		au_fecha_fin_format: d.au_fecha_fin_format ?? '',
		leg_id: d.leg_id ?? '',
		leg_legajo: d.leg_legajo ?? '',
		leg_nombre: d.leg_nombre ?? '',
		leg_apellido: d.leg_apellido ?? '',
		leg_dni: d.leg_dni ?? '',
		leg_email: d.leg_email ?? '',
		leg_celular: d.leg_celular ?? '',
		leg_fecha_ingreso: d.leg_fecha_ingreso ?? '',
		leg_fecha_egreso: d.leg_fecha_egreso ?? null,
		ta_id: d.ta_id ?? '',
		ta_nombre: d.ta_nombre ?? '',
		usr_autorizo: json.usr_autorizo ?? null,
		rol: json.rol ?? '',
		usr_id: json.usr_id ?? '',
	};
}

function logAbsenceDetail(detail: AbsenceDetail): void {
	console.log('\n=== Detalle de Ausencia ===\n');

	console.log('-- Ausencia --');
	console.log(`  ID:                   ${detail.au_id}`);
	console.log(`  Estado:               ${detail.au_estado}`);
	console.log(
		`  Tipo:                 ${detail.ta_nombre} (ID: ${detail.ta_id})`,
	);
	console.log(`  Descripción:          ${detail.au_descripcion || '—'}`);
	console.log(`  Comentarios:          ${detail.au_comentarios.trim() || '—'}`);
	console.log(`  Fecha inicio:         ${detail.au_fecha_inicio_format}`);
	console.log(`  Fecha fin:            ${detail.au_fecha_fin_format}`);
	if (detail.au_fecha_autorizacion) {
		console.log(`  Fecha autorización:   ${detail.au_fecha_autorizacion}`);
	}
	if (detail.au_motivo_rechazo) {
		console.log(`  Motivo rechazo:       ${detail.au_motivo_rechazo}`);
	}
	console.log(`  Creado en:            ${detail.au_created_at}`);

	console.log('\n-- Empleado --');
	console.log(
		`  Nombre:               ${detail.leg_nombre} ${detail.leg_apellido}`,
	);
	console.log(`  Legajo:               ${detail.leg_legajo}`);
	console.log(`  DNI:                  ${detail.leg_dni}`);
	console.log(`  Email:                ${detail.leg_email}`);
	console.log(`  Celular:              ${detail.leg_celular || '—'}`);
	console.log(`  Fecha ingreso:        ${detail.leg_fecha_ingreso}`);
	if (detail.leg_fecha_egreso) {
		console.log(`  Fecha egreso:         ${detail.leg_fecha_egreso}`);
	}

	if (detail.usr_autorizo) {
		const autorizador = [
			detail.usr_autorizo.usr_nombre,
			detail.usr_autorizo.usr_apellido,
		]
			.filter(Boolean)
			.join(' ')
			.trim();
		console.log('\n-- Autorizador --');
		console.log(`  Usuario:              ${autorizador}`);
		console.log(`  ID:                   ${detail.au_autorizo_usr_id}`);
	}

	console.log('');
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
	const args = process.argv.slice(2);

	if (args.length < 2) {
		console.error(
			'Usage: bun request_imitator/absence_detail.ts <ci_session_cookie> <absence_id>',
		);
		process.exit(1);
	}

	let cookie = args[0];
	const absenceId = args[1];

	if (!/^\d+$/.test(absenceId)) {
		console.error(
			`Invalid absence ID "${absenceId}" — must be a positive integer.`,
		);
		process.exit(1);
	}

	console.log(`Fetching absence #${absenceId}…`);

	let detail: AbsenceDetail;
	try {
		detail = await fetchAbsenceDetail(absenceId, cookie);
	} catch (err) {
		if (err instanceof InvalidCookieError) {
			console.warn(`[auth] ${err.message}. Attempting to refresh…`);
			try {
				cookie = await refreshCookie();
				console.log('[auth] Retrying fetch with fresh cookie…');
				detail = await fetchAbsenceDetail(absenceId, cookie);
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

	logAbsenceDetail(detail!);
}

if (import.meta.main) {
	main();
}
