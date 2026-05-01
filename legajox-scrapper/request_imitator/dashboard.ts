import { getCiSession } from './get_cookies';
import { InvalidCookieError, legajoxHeaders } from './session';

const URL_DASHBOARD = 'https://app.legajox.com/dashboard';

export interface Company {
	id: string;
	nombre: string;
	cuit: string;
	esFavorita: boolean;
}

export interface Module {
	nombre: string;
	activo: boolean;
}

export interface PlanInfo {
	legajosUsados: number;
	legajosTotal: number;
	modulos: Module[];
}

export interface Announcement {
	id: string;
	autor: string;
	fecha: string;
	texto: string;
}

export interface Notification {
	not_id: string;
	not_usr_id: string;
	not_titulo: string;
	not_texto: string;
	not_fecha_leido: string | null;
	not_created_at: string;
	not_deleted_at: string | null;
	not_tipo_not: string;
	not_ausencia: number;
	// raw fields preserved
	[key: string]: unknown;
}

export interface DashboardData {
	empresaActiva: { nombre: string; cuit: string } | null;
	empresas: Company[];
	plan: PlanInfo | null;
	notificacionesId: number | null;
	anuncios: Announcement[];
}

export async function fetchNotifications(
	cookie: string,
	notifId: number,
): Promise<Notification[]> {
	const url = `https://app.legajox.com/notificaciones/ver/${notifId}`;
	const response = await fetch(url, {
		method: 'POST',
		headers: {
			...legajoxHeaders(
				cookie,
				'application/json, text/javascript, */*; q=0.01',
			),
			Accept: 'application/json, text/javascript, */*; q=0.01',
			'X-Requested-With': 'XMLHttpRequest',
		},
	});

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}

	const json = (await response.json()) as {
		status: number;
		error: boolean;
		data: Notification[];
	};
	return json.data ?? [];
}

export function filterNotifications(
	notifications: Notification[],
	opts: { query: string | null; from: Date | null; to: Date | null },
): Notification[] {
	return notifications.filter((n) => {
		// query: case-insensitive contains on title or text
		if (opts.query) {
			const q = opts.query.toLowerCase();
			const haystack = `${n.not_titulo} ${n.not_texto}`.toLowerCase();
			if (!haystack.includes(q)) return false;
		}

		// from / to filters on not_created_at (format: "DD/MM/YYYY HH:MMhs")
		if (opts.from || opts.to) {
			const dateMatch = n.not_created_at.match(/(\d{2})\/(\d{2})\/(\d{4})/);
			if (!dateMatch) return true; // can't parse — keep
			const notDate = new Date(
				`${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`,
			);
			if (opts.from && notDate < opts.from) return false;
			if (opts.to && notDate > opts.to) return false;
		}

		return true;
	});
}

function logNotifications(notifications: Notification[], total: number): void {
	console.log(`\n=== Notificaciones (${notifications.length}/${total}) ===\n`);
	for (const n of notifications) {
		const leido = n.not_fecha_leido ? `leído ${n.not_fecha_leido}` : 'no leído';
		console.log(`[not_id: ${n.not_id}] ${n.not_created_at} — ${leido}`);
		console.log(`  Título: ${n.not_titulo}`);
		console.log(`  Texto:  ${n.not_texto}`);
		console.log(`  Tipo:   ${n.not_tipo_not}`);
		console.log('');
	}
}

export async function fetchDashboard(cookie: string): Promise<string> {
	const response = await fetch(URL_DASHBOARD, {
		headers: legajoxHeaders(cookie),
	});

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}

	// If fetch followed a redirect to the login page, response.url will differ
	if (response.url.includes('/login')) {
		throw new InvalidCookieError('Session invalid — redirected to login page');
	}

	const html = await response.text();

	// Fallback: the login page has a <form> whose action points to the login route
	if (html.includes('action="/login"') || html.includes("action='/login'")) {
		throw new InvalidCookieError('Session invalid — redirected to login page');
	}

	return html;
}

export function parseDashboard(html: string): DashboardData {
	// ── Empresa activa (shown in nav) ─────────────────────────────────────
	const empresaActivaNombre =
		html
			.match(
				/<div class="fw-600 bcolor lwtitle" id="empName">([^<]+)<\/div>/,
			)?.[1]
			?.trim() ?? null;
	const empresaActivaCuit =
		html
			.match(
				/<div class="fz-12 bcolor" style="opacity:\.7">CUIT ([^<]+)<\/div>/,
			)?.[1]
			?.trim() ?? null;
	const empresaActiva =
		empresaActivaNombre && empresaActivaCuit
			? { nombre: empresaActivaNombre, cuit: empresaActivaCuit }
			: null;

	// ── Company list from dropdown ────────────────────────────────────────
	const empresas: Company[] = [];
	// Each company entry wraps an <a href="javascript:cambiar_empresa('ID');">
	const companyBlockPattern =
		/javascript:cambiar_empresa\('(\d+)'\)[\s\S]*?<span[^>]*>([^<]+)<\/span>[\s\S]*?CUIT ([^<]+)<\/span>[\s\S]*?(<svg[^>]*fill="#ff9900")?/g;

	let m: RegExpExecArray | null;
	while ((m = companyBlockPattern.exec(html)) !== null) {
		empresas.push({
			id: m[1],
			nombre: m[2].trim(),
			cuit: m[3].trim(),
			esFavorita: !!m[4],
		});
	}

	// ── Plan / legajos ────────────────────────────────────────────────────
	let plan: PlanInfo | null = null;
	const legajosMatch = html.match(/Legajos[:\s]+([\d]+)\/([\d]+)/);
	if (legajosMatch) {
		const legajosUsados = parseInt(legajosMatch[1], 10);
		const legajosTotal = parseInt(legajosMatch[2], 10);

		// Modules: <span class="pr-2">NAME</span> followed by plan-pill or plan-pill-n
		const modulos: Module[] = [];
		const modulePattern =
			/<span class="pr-2">([^<]+)<\/span>\s*<span class="(plan-pill[^"]*)">[^<]+<\/span>/g;
		let mm: RegExpExecArray | null;
		while ((mm = modulePattern.exec(html)) !== null) {
			modulos.push({
				nombre: mm[1].trim(),
				activo: mm[2] === 'plan-pill',
			});
		}

		plan = { legajosUsados, legajosTotal, modulos };
	}

	// ── Notification count (vernotificaciones arg) ────────────────────────
	const notifMatch = html.match(/vernotificaciones\((\d+),/);
	const notificacionesId = notifMatch ? parseInt(notifMatch[1], 10) : null;

	// ── Announcements ─────────────────────────────────────────────────────
	const anuncios: Announcement[] = [];
	// Split the HTML from the container start, then cut at each mensaje div
	const containerStart = html.indexOf('<div id="mensajesContainer">');
	if (containerStart !== -1) {
		const containerHtml = html.slice(containerStart);
		// Split on every <div class="mensaje" …>  opening tag
		const blocks = containerHtml.split('<div class="mensaje"');

		for (let i = 1; i < blocks.length; i++) {
			const block = blocks[i];

			// id from editModalButton data-id (first occurrence)
			const id = block.match(/data-id="(\d+)"/)?.[1] ?? '';

			// Author name
			const autor =
				block
					.match(
						/<h6 class="mb-0 fz-14 lwtitle"[^>]*>\s*([\s\S]*?)\s*<\/h6>/,
					)?.[1]
					?.replace(/\s+/g, ' ')
					.trim() ?? '';

			// Date
			const fecha = block.match(/<small>([^<]+)<\/small>/)?.[1]?.trim() ?? '';

			// Body text — locate anunTextBody div manually to handle nested tags
			const bodyMarker = '<div id="anunTextBody">';
			const bodyStart = block.indexOf(bodyMarker);
			let texto = '';
			if (bodyStart !== -1) {
				const afterOpen = block.slice(bodyStart + bodyMarker.length);
				// Walk past nested tags to find the matching </div>
				let depth = 1;
				let pos = 0;
				while (pos < afterOpen.length && depth > 0) {
					const nextOpen = afterOpen.indexOf('<div', pos);
					const nextClose = afterOpen.indexOf('</div>', pos);
					if (nextClose === -1) break;
					if (nextOpen !== -1 && nextOpen < nextClose) {
						depth++;
						pos = nextOpen + 1;
					} else {
						depth--;
						if (depth === 0) {
							texto = afterOpen
								.slice(0, nextClose)
								.replace(/<[^>]+>/g, '')
								.replace(/\n\s*\n/g, '\n')
								.trim();
						}
						pos = nextClose + 1;
					}
				}
			}

			if (id || autor || texto) {
				anuncios.push({ id, autor, fecha, texto });
			}
		}
	}

	return { empresaActiva, empresas, plan, notificacionesId, anuncios };
}

function logDashboard(data: DashboardData): void {
	console.log('\n=== Dashboard ===\n');

	// Empresa activa
	if (data.empresaActiva) {
		console.log('Empresa activa:');
		console.log(`  Nombre: ${data.empresaActiva.nombre}`);
		console.log(`  CUIT:   ${data.empresaActiva.cuit}`);
	}

	// Empresa list
	if (data.empresas.length > 0) {
		console.log(`\nMis Empresas (${data.empresas.length}):`);
		for (const emp of data.empresas) {
			const fav = emp.esFavorita ? ' ⭐' : '';
			console.log(`  [id: ${emp.id}]${fav} ${emp.nombre} — CUIT ${emp.cuit}`);
		}
	}

	// Plan
	if (data.plan) {
		const { legajosUsados, legajosTotal, modulos } = data.plan;
		const pct = ((legajosUsados / legajosTotal) * 100).toFixed(1);
		console.log(`\nPlan:`);
		console.log(`  Legajos: ${legajosUsados}/${legajosTotal} (${pct}%)`);
		if (modulos.length > 0) {
			console.log('  Módulos:');
			for (const mod of modulos) {
				const estado = mod.activo ? 'Activo' : 'No Activo';
				console.log(`    - ${mod.nombre}: ${estado}`);
			}
		}
	}

	// Notifications
	if (data.notificacionesId !== null) {
		console.log(
			`\nNotificaciones (vernotificaciones id): ${data.notificacionesId}`,
		);
	}

	// Announcements
	if (data.anuncios.length > 0) {
		console.log(`\nTablón de anuncios (${data.anuncios.length}):`);
		for (const ann of data.anuncios) {
			console.log(`\n  [id: ${ann.id}] ${ann.autor} — ${ann.fecha}`);
			console.log(`  ${ann.texto.replace(/\n/g, '\n  ')}`);
		}
	} else {
		console.log('\nNo hay anuncios.');
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

function parseArgs(argv: string[]): {
	cookie: string;
	includeNotifications: boolean;
	query: string | null;
	from: Date | null;
	to: Date | null;
} {
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

	const cookie = positional[0] ?? '';
	const includeNotifications = flags['include-notifications'] === 'true';
	const query = flags.query ?? null;

	const parseDate = (val: string | undefined): Date | null => {
		if (!val) return null;
		const d = new Date(val);
		return Number.isNaN(d.getTime()) ? null : d;
	};

	return {
		cookie,
		includeNotifications,
		query,
		from: parseDate(flags.from),
		to: parseDate(flags.to),
	};
}

async function main(): Promise<void> {
	const {
		cookie: cookieArg,
		includeNotifications,
		query,
		from,
		to,
	} = parseArgs(process.argv);

	if (!cookieArg) {
		console.error(
			'Usage: bun request_imitator/dashboard.ts <ci_session_cookie> [--include-notifications] [--query <text>] [--from YYYY-MM-DD] [--to YYYY-MM-DD]',
		);
		process.exit(1);
	}

	let cookie = cookieArg;

	console.log('Fetching dashboard…');

	let html: string;
	try {
		html = await fetchDashboard(cookie);
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
				html = await fetchDashboard(cookie);
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

	const data = parseDashboard(html!);
	logDashboard(data);

	if (includeNotifications) {
		if (data.notificacionesId === null) {
			console.warn(
				'[notifications] Could not determine vernotificaciones id — skipping.',
			);
		} else {
			try {
				console.log(`\nFetching notifications (id: ${data.notificacionesId})…`);
				const all = await fetchNotifications(cookie, data.notificacionesId);
				const filtered = filterNotifications(all, { query, from, to });
				logNotifications(filtered, all.length);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				console.error(`[error] Notifications fetch failed: ${msg}`);
			}
		}
	}
}

if (import.meta.main) {
	main();
}
