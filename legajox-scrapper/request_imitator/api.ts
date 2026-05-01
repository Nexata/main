import { fetchAbsenceDetail } from './absence_detail';
import {
	type Estado,
	fetchAbsences,
	filterAbsences,
	parseAbsences,
} from './absences';
import {
	fetchDashboard,
	fetchNotifications,
	filterNotifications,
	parseDashboard,
} from './dashboard';
import { processDirectLinks, processDirs } from './download';
import { fetchEmployees, filterEmployees, parseEmployees } from './employees';
import { fetchInvoicesPage, parseInvoices } from './invoices';
import { fetchDocs, parseDirs } from './list-dirs';
import { fetchDocsPage, parseDocs } from './list-docs';
import {
	fetchOrgChart,
	parseEmployees as parseOrgEmployees,
} from './org-chart';
import { fetchPersonalInfo, parsePersonalInfo } from './personal_information';
import { fetchSearchResults } from './search-docs';
import { getSessionCookie, withSessionRetry } from './session';

type ScrapeBase = {
	success: boolean;
	errors: string[];
	outputFile: string | null;
};

export type Employee = {
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
};

export type GeneralInfo = {
	nombreApellido: string;
	dni: string;
	cuit: string;
	email: string;
	celular: string;
	locacion: string;
	puestoSector: string;
	fechaContratacion: string;
	tipoColaborador: string;
	reportaA: string;
	legajo: string;
	fechaNacimiento: string;
	estadoCivil: string;
	sexo: string;
	domicilio: string;
	codigoPostal: string;
	pais: string;
	provincia: string;
	ciudad: string;
	puestoLaboral: string;
	sectorLaboral: string;
	turno: string;
	fechaContratacionLaboral: string;
	empresas: { nombre: string; cuit: string }[];
	legajosUsados: string;
	legajosTotal: string;
	modulos: { nombre: string; activo: boolean }[];
	miResponsable: string;
	reportanAMi: string[];
	anuncios: { autor: string; fecha: string; texto: string }[];
};

export type OrgNode = {
	usrId: string;
	legId: string;
	nombre: string;
	apellido: string;
	email: string;
	grupo: string;
	reportaA: string;
	subordinados: OrgNode[];
};

export type OrgChart = {
	totalEmpleados: string;
	sinPerfilAsignado: string;
	raiz: OrgNode | null;
	noAsignados: OrgNode[];
};

export type Liquidacion = {
	id: string;
	descripcion: string;
	estado: string;
	pdfUrl: string;
};

export type Ausencia = {
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
};

export type AusenciaDetalle = {
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

export type Notificacion = {
	id: string;
	titulo: string;
	texto: string;
	fechaLeido: string | null;
	createdAt: string;
	tipo: string;
	ausencia: number;
};

export type VacacionEmpleado = {
	nombre: string;
	asignacionInicial: string;
	prorrateo: string;
	acarreo: string;
	disfrutados: string;
	planeados: string;
	proximoCiclo: string;
	disponibles: string;
};

export type AusenciasFilters = {
	name: string | null;
	from: string | null;
	to: string | null;
	historial: boolean | null;
	motivo: string | null;
	estado: Estado | null;
};

export type NotificationFilters = {
	query: string | null;
	from: string | null;
	to: string | null;
};

export async function validateCredentials(
	user: string,
	password: string,
): Promise<boolean> {
	try {
		await getSessionCookie(user, password, { forceRefresh: true });
		return true;
	} catch {
		return false;
	}
}

export async function scrapeEmployees(
	user: string,
	password: string,
	options?: { search?: string | null; page?: number | null },
	_signal?: AbortSignal,
): Promise<ScrapeBase & { employees: Employee[] }> {
	try {
		const employees = await withSessionRetry(user, password, async (cookie) => {
			const html = await fetchEmployees(cookie);
			let parsed = parseEmployees(html);
			parsed = filterEmployees(parsed, {
				legajo: null,
				active: null,
				name: options?.search ?? null,
				ingresoFrom: null,
				ingresoTo: null,
				egresoFrom: null,
				egresoTo: null,
			});

			if (options?.page != null) {
				const pageSize = 25;
				const start = (options.page - 1) * pageSize;
				parsed = parsed.slice(start, start + pageSize);
			}

			return parsed.map((emp) => ({
				nombre: `${emp.leg_nombre} ${emp.leg_apellido}`.trim(),
				dni: emp.leg_dni,
				cuil: emp.leg_cuil,
				email: emp.leg_email,
				telefono: emp.leg_celular || emp.usr_telefono || '',
				empresa: emp.emp_nombre ?? '',
				legajo: emp.leg_legajo,
				fechaIngreso: emp.leg_fecha_ingreso,
				locacion: emp.leg_ciudad ?? '',
				estado: emp.estado ?? (emp.usr_activo === '1' ? 'Activo' : 'Inactivo'),
			}));
		});

		return { success: true, employees, errors: [], outputFile: null };
	} catch (err) {
		return failure('employees', err, { employees: [] });
	}
}

export async function scrapeGeneralInfo(
	user: string,
	password: string,
	_signal?: AbortSignal,
): Promise<ScrapeBase & { info: GeneralInfo }> {
	try {
		const info = await withSessionRetry(user, password, async (cookie) => {
			const [personalHtml, dashboardHtml] = await Promise.all([
				fetchPersonalInfo(cookie),
				fetchDashboard(cookie),
			]);
			const personal = parsePersonalInfo(personalHtml);
			const dashboard = parseDashboard(dashboardHtml);

			return {
				nombreApellido: personal.nombreApellido ?? personal.displayName ?? '',
				dni: personal.dni ?? personal.summaryDni ?? '',
				cuit: personal.cuil ?? personal.summaryCuit ?? '',
				email:
					personal.profileEmail ??
					personal.summaryEmail ??
					personal.navEmail ??
					'',
				celular: personal.celular ?? personal.cel ?? '',
				locacion: personal.locacion ?? '',
				puestoSector: personal.puestoSector ?? '',
				fechaContratacion:
					personal.fechaContratacionSummary ?? personal.fechaContratacion ?? '',
				tipoColaborador: personal.tipoColaborador ?? '',
				reportaA: personal.reportaA ?? '',
				legajo: personal.legajo ?? '',
				fechaNacimiento: personal.fechaNacimiento ?? '',
				estadoCivil: personal.estadoCivil ?? '',
				sexo: personal.sexo ?? '',
				domicilio: personal.direccion ?? '',
				codigoPostal: personal.codigoPostal ?? '',
				pais: personal.pais ?? '',
				provincia: personal.provincia ?? '',
				ciudad: personal.ciudad ?? '',
				puestoLaboral: personal.puesto ?? '',
				sectorLaboral: personal.sector ?? '',
				turno: personal.turno ?? '',
				fechaContratacionLaboral: personal.fechaContratacion ?? '',
				empresas: dashboard.empresas.map((empresa) => ({
					nombre: empresa.nombre,
					cuit: empresa.cuit,
				})),
				legajosUsados: String(dashboard.plan?.legajosUsados ?? ''),
				legajosTotal: String(dashboard.plan?.legajosTotal ?? ''),
				modulos: dashboard.plan?.modulos ?? [],
				miResponsable: personal.reportaA ?? '',
				reportanAMi: [],
				anuncios: dashboard.anuncios.map(({ autor, fecha, texto }) => ({
					autor,
					fecha,
					texto,
				})),
			};
		});

		return { success: true, info, errors: [], outputFile: null };
	} catch (err) {
		return failure('info', err, { info: emptyGeneralInfo() });
	}
}

export async function scrapeOrgChart(
	user: string,
	password: string,
	_signal?: AbortSignal,
): Promise<ScrapeBase & { chart: OrgChart }> {
	try {
		const chart = await withSessionRetry(user, password, async (cookie) => {
			const html = await fetchOrgChart(cookie);
			const employees = parseOrgEmployees(html);
			const nodes = employees.map((emp) => ({
				usrId: emp.usr_id,
				legId: emp.leg_id,
				nombre: emp.leg_nombre,
				apellido: emp.leg_apellido ?? '',
				email: emp.leg_email,
				grupo: emp.leg_grupo_nombre ?? '',
				reportaA: emp.leg_reporta_usr_id,
				subordinados: [] as OrgNode[],
			}));
			const byUsrId = new Map(nodes.map((node) => [node.usrId, node]));
			const roots: OrgNode[] = [];

			for (const node of nodes) {
				const parent = node.reportaA ? byUsrId.get(node.reportaA) : null;
				if (parent && parent !== node) parent.subordinados.push(node);
				else roots.push(node);
			}

			return {
				totalEmpleados: String(employees.length),
				sinPerfilAsignado: String(
					employees.filter((emp) => !emp.leg_grupo_nombre).length,
				),
				raiz: roots[0] ?? null,
				noAsignados: roots.slice(1),
			};
		});

		return { success: true, chart, errors: [], outputFile: null };
	} catch (err) {
		return failure('org-chart', err, {
			chart: {
				totalEmpleados: '0',
				sinPerfilAsignado: '0',
				raiz: null,
				noAsignados: [],
			},
		});
	}
}

export async function scrapeLiquidaciones(
	user: string,
	password: string,
	_options?: { search?: string | null; page?: number | null },
	_signal?: AbortSignal,
): Promise<ScrapeBase & { liquidaciones: Liquidacion[]; total: number }> {
	try {
		const liquidaciones = await withSessionRetry(
			user,
			password,
			async (cookie) => {
				const html = await fetchInvoicesPage(cookie);
				return parseInvoices(html).map((invoice) => ({
					id: invoice.numero,
					descripcion: [invoice.periodo, invoice.fecha, invoice.importe]
						.filter(Boolean)
						.join(' - '),
					estado: invoice.estado,
					pdfUrl: invoice.url,
				}));
			},
		);

		return {
			success: true,
			liquidaciones,
			total: liquidaciones.length,
			errors: [
				'/liquidaciones is backed by request_imitator/invoices.ts (mis_facturas), not the previous pending-actions scraper.',
			],
			outputFile: null,
		};
	} catch (err) {
		return failure('liquidaciones', err, { liquidaciones: [], total: 0 });
	}
}

export async function scrapeAusencias(
	user: string,
	password: string,
	filters: AusenciasFilters,
	_signal?: AbortSignal,
): Promise<ScrapeBase & { ausencias: Ausencia[]; total: number }> {
	try {
		const ausencias = await withSessionRetry(user, password, async (cookie) => {
			const html = await fetchAbsences(cookie);
			const parsed = filterAbsences(parseAbsences(html), {
				name: filters.name,
				from: filters.from ? new Date(filters.from) : null,
				to: filters.to ? new Date(filters.to) : null,
				motivo: filters.motivo,
				estado: filters.estado,
			});

			return parsed.map((absence) => ({
				tipo: absence.motivo,
				fechaDesde: absence.fechaInicio ?? '',
				fechaHasta: absence.fechaFin ?? absence.fechaInicio ?? '',
				estado: absence.estado ?? '',
				nombre: absence.nombre,
				dni: '',
				cuil: '',
				email: '',
				telefono: '',
				locacion: '',
				fechaContratacion: '',
				comentario: `ausenciaId=${absence.ausenciaId}; legajoId=${absence.legajoId}`,
			}));
		});

		return {
			success: true,
			ausencias,
			total: ausencias.length,
			errors: [],
			outputFile: null,
		};
	} catch (err) {
		return failure('ausencias', err, { ausencias: [], total: 0 });
	}
}

export async function scrapeAbsenceDetail(
	user: string,
	password: string,
	absenceId: string,
	_signal?: AbortSignal,
): Promise<ScrapeBase & { detail: AusenciaDetalle | null }> {
	try {
		const detail = await withSessionRetry(user, password, async (cookie) => {
			const raw = await fetchAbsenceDetail(absenceId, cookie);

			return {
				id: raw.au_id,
				legajoId: raw.au_legajo_id,
				empresaId: raw.au_empresa_id,
				autorizoUsuarioId: raw.au_autorizo_usr_id,
				tipoId: raw.au_tipo_id,
				fechaInicio: raw.au_fecha_inicio,
				fechaFin: raw.au_fecha_fin,
				fechaAutorizacion: raw.au_fecha_autorizacion,
				motivoRechazo: raw.au_motivo_rechazo,
				descripcion: raw.au_descripcion,
				comentarios: raw.au_comentarios,
				estado: raw.au_estado,
				createdAt: raw.au_created_at,
				deletedAt: raw.au_deleted_at,
				motivoEditar: raw.au_motivo_editar,
				fechaInicioFormat: raw.au_fecha_inicio_format,
				fechaFinFormat: raw.au_fecha_fin_format,
				empleado: {
					id: raw.leg_id,
					legajo: raw.leg_legajo,
					nombre: raw.leg_nombre,
					apellido: raw.leg_apellido,
					dni: raw.leg_dni,
					email: raw.leg_email,
					celular: raw.leg_celular,
					fechaIngreso: raw.leg_fecha_ingreso,
					fechaEgreso: raw.leg_fecha_egreso,
				},
				tipo: { id: raw.ta_id, nombre: raw.ta_nombre },
				autorizador: raw.usr_autorizo
					? {
							nombre: raw.usr_autorizo.usr_nombre,
							apellido: raw.usr_autorizo.usr_apellido,
						}
					: null,
				rol: raw.rol,
				usuarioId: raw.usr_id,
			};
		});

		return { success: true, detail, errors: [], outputFile: null };
	} catch (err) {
		return failure('absence-detail', err, { detail: null });
	}
}

export async function scrapeNotifications(
	user: string,
	password: string,
	filters: NotificationFilters,
	_signal?: AbortSignal,
): Promise<ScrapeBase & { notificaciones: Notificacion[]; total: number }> {
	try {
		const { notificaciones, errors } = await withSessionRetry(
			user,
			password,
			async (cookie) => {
				const dashboard = parseDashboard(await fetchDashboard(cookie));
				if (dashboard.notificacionesId === null) {
					return {
						notificaciones: [],
						errors: [
							'Could not determine Legajox notifications id from dashboard.',
						],
					};
				}

				const parsed = filterNotifications(
					await fetchNotifications(cookie, dashboard.notificacionesId),
					{
						query: filters.query,
						from: filters.from ? new Date(filters.from) : null,
						to: filters.to ? new Date(filters.to) : null,
					},
				);

				return {
					notificaciones: parsed.map((notification) => ({
						id: notification.not_id,
						titulo: notification.not_titulo,
						texto: notification.not_texto,
						fechaLeido: notification.not_fecha_leido,
						createdAt: notification.not_created_at,
						tipo: notification.not_tipo_not,
						ausencia: notification.not_ausencia,
					})),
					errors: [],
				};
			},
		);

		return {
			success: true,
			notificaciones,
			total: notificaciones.length,
			errors,
			outputFile: null,
		};
	} catch (err) {
		return failure('notifications', err, { notificaciones: [], total: 0 });
	}
}

export async function scrapeVacaciones(
	_user: string,
	_password: string,
	_signal?: AbortSignal,
): Promise<ScrapeBase & { registros: VacacionEmpleado[]; total: number }> {
	return {
		success: false,
		registros: [],
		total: 0,
		errors: [
			'Unsupported after request_imitator migration: no request_imitator implementation exists for vacaciones.',
		],
		outputFile: null,
	};
}

export async function scrapeListDirs(
	user: string,
	password: string,
	_signal?: AbortSignal,
): Promise<
	ScrapeBase & {
		carpetas: {
			id: string;
			nombre: string;
			href: string;
			cantidadArchivos: number;
		}[];
	}
> {
	try {
		const carpetas = await withSessionRetry(user, password, async (cookie) =>
			parseDirs(await fetchDocs(cookie)),
		);
		return { success: true, carpetas, errors: [], outputFile: null };
	} catch (err) {
		return failure('list-dirs', err, { carpetas: [] });
	}
}

export async function scrapeListDocs(
	user: string,
	password: string,
	dirPath: string,
	_signal?: AbortSignal,
): Promise<
	ScrapeBase & {
		documentos: {
			nombre: string;
			url: string;
			fecha: string;
			firmado: boolean;
		}[];
	}
> {
	try {
		const folderId = dirPath.match(/\/(\d+)\s*$/)?.[1];
		if (!folderId)
			throw new Error('Invalid directory path: expected /files/edit/<id>.');
		const documentos = await withSessionRetry(user, password, async (cookie) =>
			parseDocs(await fetchDocsPage(folderId, cookie)),
		);
		return { success: true, documentos, errors: [], outputFile: null };
	} catch (err) {
		return failure('list-docs', err, { documentos: [] });
	}
}

export async function scrapeFileSearch(
	user: string,
	password: string,
	query: string,
	_signal?: AbortSignal,
): Promise<
	ScrapeBase & {
		results: { carpeta: string; nombre: string; href: string; url: string }[];
	}
> {
	try {
		const results = await withSessionRetry(user, password, (cookie) =>
			fetchSearchResults(query, cookie),
		);
		return { success: true, results, errors: [], outputFile: null };
	} catch (err) {
		return failure('file-search', err, { results: [] });
	}
}

export async function scrapeDownload(
	user: string,
	password: string,
	dirs: string[],
	links: string[],
	_signal?: AbortSignal,
) {
	try {
		const cookie = await getSessionCookie(user, password);
		const metadata = [];
		let updatedCookie = cookie;

		if (dirs.length > 0) {
			const result = await processDirs(dirs, updatedCookie);
			metadata.push(...result.results);
			updatedCookie = result.cookie;
		}

		if (links.length > 0) {
			const result = await processDirectLinks(links, updatedCookie);
			metadata.push(...result.results);
		}

		return { success: true, metadata, errors: [], outputFile: null };
	} catch (err) {
		return failure('download', err, { metadata: [] });
	}
}

function emptyGeneralInfo(): GeneralInfo {
	return {
		nombreApellido: '',
		dni: '',
		cuit: '',
		email: '',
		celular: '',
		locacion: '',
		puestoSector: '',
		fechaContratacion: '',
		tipoColaborador: '',
		reportaA: '',
		legajo: '',
		fechaNacimiento: '',
		estadoCivil: '',
		sexo: '',
		domicilio: '',
		codigoPostal: '',
		pais: '',
		provincia: '',
		ciudad: '',
		puestoLaboral: '',
		sectorLaboral: '',
		turno: '',
		fechaContratacionLaboral: '',
		empresas: [],
		legajosUsados: '',
		legajosTotal: '',
		modulos: [],
		miResponsable: '',
		reportanAMi: [],
		anuncios: [],
	};
}

function failure<T extends object>(
	scope: string,
	err: unknown,
	data: T,
): ScrapeBase & T {
	const message = err instanceof Error ? err.message : String(err);
	console.error(`[request_imitator:${scope}] ${message}`);
	return {
		success: false,
		errors: [`Fatal: ${message}`],
		outputFile: null,
		...data,
	};
}
