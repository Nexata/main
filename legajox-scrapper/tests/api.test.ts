import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { treaty } from '@elysiajs/eden';
import { parseVacations } from '../request_imitator/vacations';
import type { AppDependencies } from '../src/index';
import { createApp, getServerConfigFromEnv } from '../src/index';

const API_KEY = 'test-api-key';
const QUERY_CREDS = {
	user: 'user@example.com',
	password: 'super-secret',
};
const DEFAULT_CREDS = {
	defaultUser: 'default@example.com',
	defaultPassword: 'default-secret',
};
const DOWNLOAD_OUTPUT_DIR = path.resolve('outputs', '_descargas_tmp');

function makeDeps(): AppDependencies {
	return {
		validateCredentials: mock(async () => true),
		scrapeEmployees: mock(async () => ({
			success: true,
			employees: [],
			errors: [],
			outputFile: null,
		})),
		scrapeGeneralInfo: mock(async () => ({
			success: true,
			info: null,
			errors: [],
			outputFile: null,
		})),
		scrapeOrgChart: mock(async () => ({
			success: true,
			chart: null,
			errors: [],
			outputFile: null,
		})),
		scrapeLiquidaciones: mock(async () => ({
			success: true,
			liquidaciones: [],
			total: 0,
			errors: [],
			outputFile: null,
		})),
		scrapeAusencias: mock(async () => ({
			success: true,
			ausencias: [],
			total: 0,
			errors: [],
			outputFile: null,
		})),
		scrapeAbsenceDetail: mock(async () => ({
			success: true,
			detail: null,
			errors: [],
			outputFile: null,
		})),
		scrapeNotifications: mock(async () => ({
			success: true,
			notificaciones: [],
			total: 0,
			errors: [],
			outputFile: null,
		})),
		scrapeVacaciones: mock(async () => ({
			success: true,
			registros: [],
			total: 0,
			errors: [],
			outputFile: null,
		})),
		scrapeListDirs: mock(async () => ({
			success: true,
			carpetas: [],
			errors: [],
		})),
		scrapeListDocs: mock(async () => ({
			success: true,
			documentos: [],
			errors: [],
		})),
		scrapeFileSearch: mock(async () => ({
			success: true,
			results: [],
			errors: [],
		})),
		scrapeDownload: mock(async () => ({
			success: true,
			metadata: [],
			errors: [],
		})),
	};
}

function makeClient(
	dependencies: Partial<AppDependencies> = {},
	config: {
		defaultUser?: string;
		defaultPassword?: string;
		authHeader?: string | null;
	} = {},
) {
	const deps = { ...makeDeps(), ...dependencies } satisfies AppDependencies;
	const app = createApp({
		apiKey: API_KEY,
		defaultUser: config.defaultUser,
		defaultPassword: config.defaultPassword,
		dependencies: deps,
	});

	const client = treaty(app, {
		headers:
			config.authHeader === null
				? {}
				: {
						Authorization: config.authHeader ?? `Bearer ${API_KEY}`,
					},
	});

	return { client, deps, app };
}

beforeEach(() => {
	mock.restore();
});

afterEach(() => {
	mock.restore();
});

describe('Auth guard', () => {
	test('allows docs without Authorization', async () => {
		const { client } = makeClient({}, { authHeader: null });

		const res = await client.docs.get();

		expect(res.status).toBe(200);
	});

	test('serves OpenAPI json without Authorization', async () => {
		const { client } = makeClient({}, { authHeader: null });

		const res = await client.docs.json.get();

		expect(res.status).toBe(200);
		expect(res.data).toMatchObject({
			openapi: expect.any(String),
			info: expect.objectContaining({
				title: 'Legajox Scrapper API',
			}),
		});
	});

	test('rejects requests without Authorization', async () => {
		const { client } = makeClient({}, { authHeader: null });

		const res = await client.validate.get({ query: QUERY_CREDS });

		expect(res.status).toBe(401);
		expect(res.error?.value).toEqual({ error: 'Unauthorized' });
	});

	test('rejects requests with a wrong API key', async () => {
		const { client } = makeClient({}, { authHeader: 'Bearer wrong-key' });

		const res = await client.validate.get({ query: QUERY_CREDS });

		expect(res.status).toBe(401);
		expect(res.error?.value).toEqual({ error: 'Unauthorized' });
	});
});

describe('Downloaded document file route', () => {
	test('returns a downloaded file from the controlled output directory', async () => {
		const filePath = path.join(DOWNLOAD_OUTPUT_DIR, 'api-test-file.txt');
		await fs.mkdir(path.dirname(filePath), { recursive: true });
		await fs.writeFile(filePath, 'downloaded content');

		try {
			const { app } = makeClient();
			const res = await app.handle(
				new Request(
					`http://localhost/documents/file?path=${encodeURIComponent(filePath)}`,
					{ headers: { Authorization: `Bearer ${API_KEY}` } },
				),
			);

			expect(res.status).toBe(200);
			expect(await res.text()).toBe('downloaded content');
		} finally {
			await fs.rm(filePath, { force: true });
		}
	});

	test('returns 404 when downloaded file does not exist', async () => {
		const { client } = makeClient();
		const res = await client.documents.file.get({
			query: {
				path: path.join(DOWNLOAD_OUTPUT_DIR, 'missing-file.pdf'),
			},
		});

		expect(res.status).toBe(404);
		expect(res.error?.value).toEqual({ error: 'File not found' });
	});

	test('rejects paths outside the controlled output directory', async () => {
		const outsidePath = path.resolve('outputs', 'api-test-outside.txt');
		await fs.mkdir(path.dirname(outsidePath), { recursive: true });
		await fs.writeFile(outsidePath, 'secret');

		try {
			const { client } = makeClient();
			const res = await client.documents.file.get({
				query: { path: outsidePath },
			});

			expect(res.status).toBe(400);
			expect(res.error?.value).toEqual({
				error: 'Invalid file path: outside download directory.',
			});
		} finally {
			await fs.rm(outsidePath, { force: true });
		}
	});
});

describe('Direct document downloads', () => {
	test('uses Content-Disposition filename for /enviar_doc downloads', async () => {
		const originalFetch = globalThis.fetch;
		const fetchMock = mock(
			async () =>
				new Response('pdf bytes', {
					status: 200,
					headers: {
						'content-type': 'application/pdf',
						'content-disposition': 'attachment; filename="contrato.pdf"',
					},
				}),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		try {
			const { processDirectLinks } = await import(
				'../request_imitator/download'
			);
			const { results } = await processDirectLinks(
				['/enviar_doc/46461'],
				'cookie',
			);

			expect(results).toHaveLength(1);
			expect(results[0]).toMatchObject({
				estado: 'ok',
				extension: 'pdf',
				downloadUrl: '/enviar_doc/46461',
				pesoBytes: 9,
			});
			expect(results[0]?.nombre).toEndWith('-contrato.pdf');
			expect(results[0]?.rutaLocal).toContain('contrato.pdf');
		} finally {
			globalThis.fetch = originalFetch;
			await fs.rm(path.join(DOWNLOAD_OUTPUT_DIR, 'direct-links'), {
				force: true,
				recursive: true,
			});
		}
	});

	test('infers filename extension from Content-Type for /enviar_doc downloads', async () => {
		const originalFetch = globalThis.fetch;
		const fetchMock = mock(
			async () =>
				new Response('pdf bytes', {
					status: 200,
					headers: { 'content-type': 'application/pdf' },
				}),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		try {
			const { processDirectLinks } = await import(
				'../request_imitator/download'
			);
			const { results } = await processDirectLinks(
				['/enviar_doc/46461'],
				'cookie',
			);

			expect(results).toHaveLength(1);
			expect(results[0]).toMatchObject({
				estado: 'ok',
				extension: 'pdf',
				downloadUrl: '/enviar_doc/46461',
			});
			expect(results[0]?.nombre).toEndWith('-46461.pdf');
		} finally {
			globalThis.fetch = originalFetch;
			await fs.rm(path.join(DOWNLOAD_OUTPUT_DIR, 'direct-links'), {
				force: true,
				recursive: true,
			});
		}
	});

	test('propagates login HTML as an auth error for session retry', async () => {
		const originalFetch = globalThis.fetch;
		const fetchMock = mock(
			async () =>
				new Response(
					'<html><form action="/login"><input id="usr_email"></form>',
					{
						status: 200,
						headers: { 'content-type': 'text/html' },
					},
				),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		try {
			const { processDirectLinks } = await import(
				'../request_imitator/download'
			);
			await expect(
				processDirectLinks(['/enviar_doc/46461'], 'cookie'),
			).rejects.toThrow('Session invalid');
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});

describe('Credential resolution', () => {
	test('returns 400 when query credentials and defaults are both missing', async () => {
		const { client } = makeClient();

		const res = await client.validate.get();

		expect(res.status).toBe(400);
		expect(res.error?.value).toEqual({
			error:
				"Query params 'user' and 'password' are required when DEFAULT_USER and DEFAULT_PASSWORD are not configured.",
		});
	});

	test('falls back to configured default credentials', async () => {
		const validateCredentials = mock(async () => true);
		const { client } = makeClient({ validateCredentials }, DEFAULT_CREDS);

		const res = await client.validate.get();

		expect(res.status).toBe(200);
		expect(res.data).toEqual({ valid: true });
		expect(validateCredentials).toHaveBeenCalledWith(
			DEFAULT_CREDS.defaultUser,
			DEFAULT_CREDS.defaultPassword,
		);
	});

	test('prefers explicit query credentials over configured defaults', async () => {
		const scrapeEmployees = mock(async () => ({
			success: true,
			employees: [],
			errors: [],
			outputFile: null,
		}));
		const { client } = makeClient({ scrapeEmployees }, DEFAULT_CREDS);

		const res = await client.employees.get({ query: QUERY_CREDS });

		expect(res.status).toBe(200);
		expect(scrapeEmployees).toHaveBeenCalledWith(
			QUERY_CREDS.user,
			QUERY_CREDS.password,
			{ search: null, page: null },
			expect.anything(),
		);
	});
});

describe('Validate route', () => {
	test('returns the scraper validation result', async () => {
		const validateCredentials = mock(async () => false);
		const { client } = makeClient({ validateCredentials });

		const res = await client.validate.get({ query: QUERY_CREDS });

		expect(res.status).toBe(200);
		expect(res.data).toEqual({ valid: false });
		expect(validateCredentials).toHaveBeenCalledWith(
			QUERY_CREDS.user,
			QUERY_CREDS.password,
		);
	});
});

describe('Server config', () => {
	test('reads PORT from env', () => {
		const config = getServerConfigFromEnv({
			API_KEY,
			PORT: '8080',
			DEFAULT_USER: DEFAULT_CREDS.defaultUser,
			DEFAULT_PASSWORD: DEFAULT_CREDS.defaultPassword,
		});

		expect(config.port).toBe(8080);
		expect(config.apiKey).toBe(API_KEY);
	});

	test('rejects invalid PORT values', () => {
		expect(() =>
			getServerConfigFromEnv({
				API_KEY,
				PORT: 'abc',
			}),
		).toThrow("Fatal: invalid PORT value 'abc'. Expected 1-65535.");
	});

	test('prefers PUBLIC_URL in generated OpenAPI servers', async () => {
		const previous = process.env.PUBLIC_URL;
		process.env.PUBLIC_URL = 'https://scrapper.example.com';

		try {
			const { client } = makeClient({}, { authHeader: null });
			const res = await client.docs.json.get();

			expect(res.status).toBe(200);
			expect(res.data?.servers).toEqual([
				{ url: 'https://scrapper.example.com', description: 'Deployment' },
			]);
		} finally {
			if (previous == null) delete process.env.PUBLIC_URL;
			else process.env.PUBLIC_URL = previous;
		}
	});
});

describe('Employees route', () => {
	test('rejects invalid page values before scraping', async () => {
		const scrapeEmployees = mock(async () => ({
			success: true,
			employees: [],
			errors: [],
			outputFile: null,
		}));
		const { client } = makeClient({ scrapeEmployees });

		const res = await client.employees.get({
			query: { ...QUERY_CREDS, page: '0' },
		});

		expect(res.status).toBe(400);
		expect(res.error?.value).toEqual({
			error: "Query param 'page' must be a positive integer.",
		});
		expect(scrapeEmployees).not.toHaveBeenCalled();
	});

	test('passes search and page options through to the scraper', async () => {
		const scrapeEmployees = mock(async () => ({
			success: true,
			employees: [
				{
					nombre: 'Ada Lovelace',
					dni: '123',
					cuil: '20-123-4',
					email: 'ada@example.com',
					telefono: '1234',
					empresa: 'Nexata',
					legajo: 'EMP-1',
					fechaIngreso: '2024-01-01',
					locacion: 'Remote',
					estado: 'Activo',
				},
			],
			errors: [],
			outputFile: null,
		}));
		const { client } = makeClient({ scrapeEmployees });

		const res = await client.employees.get({
			query: { ...QUERY_CREDS, search: 'ada', page: '2' },
		});

		expect(res.status).toBe(200);
		expect(res.data?.employees).toHaveLength(1);
		expect(scrapeEmployees).toHaveBeenCalledWith(
			QUERY_CREDS.user,
			QUERY_CREDS.password,
			{ search: 'ada', page: 2 },
			expect.anything(),
		);
	});

	test('maps scraper failures to 500 responses', async () => {
		const scrapeEmployees = mock(async () => ({
			success: false,
			employees: [],
			errors: ['boom'],
			outputFile: null,
		}));
		const { client } = makeClient({ scrapeEmployees });

		const res = await client.employees.get({ query: QUERY_CREDS });

		expect(res.status).toBe(500);
		expect(res.error?.value).toEqual({
			error: 'Scrape failed',
			details: ['boom'],
		});
	});
});

describe('Liquidaciones route', () => {
	test('strips internal fields and preserves non-empty errors', async () => {
		const scrapeLiquidaciones = mock(async () => ({
			success: true,
			liquidaciones: [
				{
					id: 'liq-1',
					descripcion: 'Recibo marzo',
					estado: 'Pendiente',
					pdfUrl: 'https://example.com/liq.pdf',
				},
			],
			total: 1,
			errors: ['partial warning'],
			outputFile: null,
		}));
		const { client } = makeClient({ scrapeLiquidaciones });

		const res = await client.liquidaciones.get({ query: QUERY_CREDS });

		expect(res.status).toBe(200);
		expect(res.data).toEqual({
			liquidaciones: [
				{
					id: 'liq-1',
					descripcion: 'Recibo marzo',
					estado: 'Pendiente',
					pdfUrl: 'https://example.com/liq.pdf',
				},
			],
			total: 1,
			errors: ['partial warning'],
		});
	});
});

describe('Ausencias route', () => {
	test('rejects unsupported estado values before scraping', async () => {
		const scrapeAusencias = mock(async () => ({
			success: true,
			ausencias: [],
			total: 0,
			errors: [],
			outputFile: null,
		}));
		const { client } = makeClient({ scrapeAusencias });

		const res = await client.ausencias.get({
			query: { ...QUERY_CREDS, estado: 'Invalida' as never },
		});

		expect(res.status).toBe(400);
		expect(res.error?.value).toEqual({
			error:
				"Query param 'estado' must be one of: Aprobada, Pendiente, Rechazada.",
		});
		expect(scrapeAusencias).not.toHaveBeenCalled();
	});

	test('normalizes filters before passing them to the scraper', async () => {
		const scrapeAusencias = mock(async () => ({
			success: true,
			ausencias: [],
			total: 0,
			errors: [],
			outputFile: null,
		}));
		const { client } = makeClient({ scrapeAusencias });

		const res = await client.ausencias.get({
			query: {
				...QUERY_CREDS,
				name: 'Ada',
				from: '2024-01-01',
				to: '2024-12-31',
				historial: 'true',
				motivo: 'licencia',
				estado: 'Aprobada',
			},
		});

		expect(res.status).toBe(200);
		expect(scrapeAusencias).toHaveBeenCalledWith(
			QUERY_CREDS.user,
			QUERY_CREDS.password,
			{
				name: 'Ada',
				from: '2024-01-01',
				to: '2024-12-31',
				historial: true,
				motivo: 'licencia',
				estado: 'Aprobada',
			},
			expect.anything(),
		);
	});
});

describe('Absence detail and notifications routes', () => {
	test('rejects invalid absence detail ids before scraping', async () => {
		const scrapeAbsenceDetail = mock(async () => ({
			success: true,
			detail: null,
			errors: [],
			outputFile: null,
		}));
		const { client } = makeClient({ scrapeAbsenceDetail });

		const res = await client.ausencias({ id: 'abc' }).get({
			query: QUERY_CREDS,
		});

		expect(res.status).toBe(400);
		expect(res.error?.value).toEqual({
			error: "Path param 'id' must be a positive integer.",
		});
		expect(scrapeAbsenceDetail).not.toHaveBeenCalled();
	});

	test('returns absence detail without internal scraper fields', async () => {
		const scrapeAbsenceDetail = mock(async () => ({
			success: true,
			detail: {
				id: '35',
				legajoId: '10',
				empresaId: '20',
				autorizoUsuarioId: '30',
				tipoId: '1',
				fechaInicio: '2024-01-01',
				fechaFin: '2024-01-02',
				fechaAutorizacion: null,
				motivoRechazo: '',
				descripcion: 'Licencia',
				comentarios: 'Comentario',
				estado: 'Aprobada',
				createdAt: '01/01/2024 10:00hs',
				deletedAt: null,
				motivoEditar: null,
				fechaInicioFormat: '01/01/2024',
				fechaFinFormat: '02/01/2024',
				empleado: {
					id: '10',
					legajo: 'EMP-1',
					nombre: 'Ada',
					apellido: 'Lovelace',
					dni: '123',
					email: 'ada@example.com',
					celular: '1234',
					fechaIngreso: '2020-01-01',
					fechaEgreso: null,
				},
				tipo: { id: '1', nombre: 'Vacaciones' },
				autorizador: { nombre: 'Grace', apellido: 'Hopper' },
				rol: 'admin',
				usuarioId: '99',
			},
			errors: [],
			outputFile: null,
		}));
		const { client } = makeClient({ scrapeAbsenceDetail });

		const res = await client
			.ausencias({ id: '35' })
			.get({ query: QUERY_CREDS });

		expect(res.status).toBe(200);
		expect(scrapeAbsenceDetail).toHaveBeenCalledWith(
			QUERY_CREDS.user,
			QUERY_CREDS.password,
			'35',
			expect.anything(),
		);
		expect(res.data).toEqual({
			detail: expect.objectContaining({ id: '35', estado: 'Aprobada' }),
		});
	});

	test('passes notification filters to scraper', async () => {
		const scrapeNotifications = mock(async () => ({
			success: true,
			notificaciones: [
				{
					id: '1',
					titulo: 'Ausencia aprobada',
					texto: 'Tu ausencia fue aprobada',
					fechaLeido: null,
					createdAt: '01/01/2024 10:00hs',
					tipo: 'ausencia',
					ausencia: 35,
				},
			],
			total: 1,
			errors: [],
			outputFile: null,
		}));
		const { client } = makeClient({ scrapeNotifications });

		const res = await client.notificaciones.get({
			query: {
				...QUERY_CREDS,
				query: 'ausencia',
				from: '2024-01-01',
				to: '2024-01-31',
			},
		});

		expect(res.status).toBe(200);
		expect(scrapeNotifications).toHaveBeenCalledWith(
			QUERY_CREDS.user,
			QUERY_CREDS.password,
			{ query: 'ausencia', from: '2024-01-01', to: '2024-01-31' },
			expect.anything(),
		);
		expect(res.data).toEqual({
			notificaciones: [
				{
					id: '1',
					titulo: 'Ausencia aprobada',
					texto: 'Tu ausencia fue aprobada',
					fechaLeido: null,
					createdAt: '01/01/2024 10:00hs',
					tipo: 'ausencia',
					ausencia: 35,
				},
			],
			total: 1,
		});
	});
});

describe('Info, org chart and vacaciones routes', () => {
	test('returns info without internal scraper fields', async () => {
		const scrapeGeneralInfo = mock(async () => ({
			success: true,
			info: {
				nombreApellido: 'Ada Lovelace',
				dni: '123',
				cuit: '20-123-4',
				email: 'ada@example.com',
				celular: '1234',
				locacion: 'Remote',
				puestoSector: 'Engineering',
				fechaContratacion: '2024-01-01',
				tipoColaborador: 'Empleado',
				reportaA: 'Grace Hopper',
				legajo: 'EMP-1',
				fechaNacimiento: '1990-01-01',
				estadoCivil: 'Soltera',
				sexo: 'F',
				domicilio: 'Main St',
				codigoPostal: '1000',
				pais: 'AR',
				provincia: 'Buenos Aires',
				ciudad: 'CABA',
				puestoLaboral: 'Engineer',
				sectorLaboral: 'Tech',
				turno: 'Manana',
				fechaContratacionLaboral: '2024-01-01',
				empresas: [{ nombre: 'Nexata', cuit: '30-12345678-9' }],
				legajosUsados: '1',
				legajosTotal: '10',
				modulos: [{ nombre: 'RRHH', activo: true }],
				miResponsable: 'Grace Hopper',
				reportanAMi: ['Team Member'],
				anuncios: [],
			},
			errors: [],
			outputFile: null,
		}));
		const { client } = makeClient({ scrapeGeneralInfo });

		const res = await client.info.get({ query: QUERY_CREDS });

		expect(res.status).toBe(200);
		expect(res.data).toEqual({
			info: expect.objectContaining({ nombreApellido: 'Ada Lovelace' }),
		});
	});

	test('returns org-chart payloads without internal fields', async () => {
		const scrapeOrgChart = mock(async () => ({
			success: true,
			chart: {
				totalEmpleados: '1',
				sinPerfilAsignado: '0',
				raiz: {
					usrId: '1',
					legId: '10',
					nombre: 'Ada',
					apellido: 'Lovelace',
					email: 'ada@example.com',
					grupo: 'Engineering',
					reportaA: '',
					subordinados: [],
				},
				noAsignados: [],
			},
			errors: [],
			outputFile: null,
		}));
		const { client } = makeClient({ scrapeOrgChart });

		const res = await client['org-chart'].get({ query: QUERY_CREDS });

		expect(res.status).toBe(200);
		expect(res.data).toEqual({
			chart: expect.objectContaining({ totalEmpleados: '1' }),
		});
	});

	test('returns vacation balances without internal fields', async () => {
		const scrapeVacaciones = mock(async () => ({
			success: true,
			registros: [
				{
					nombre: 'Ada Lovelace',
					asignacionInicial: '10',
					prorrateo: '0',
					acarreo: '0',
					disfrutados: '2',
					planeados: '1',
					proximoCiclo: '0',
					disponibles: '7',
				},
			],
			total: 1,
			errors: [],
			outputFile: null,
		}));
		const { client } = makeClient({ scrapeVacaciones });

		const res = await client.vacaciones.get({ query: QUERY_CREDS });

		expect(res.status).toBe(200);
		expect(res.data).toEqual({
			registros: [expect.objectContaining({ nombre: 'Ada Lovelace' })],
			total: 1,
		});
	});
});

describe('Vacations parser', () => {
	test('parses vacation balance rows from Legajox table html', () => {
		const html = `
			<body onload="init_funtion(123)">
				<table id="DataTables_Table_0">
					<tbody>
						<tr class="p5px odd">
							<td><span class="nombre_empleados">Ada Lovelace</span></td>
							<td>10</td>
							<td>0</td>
							<td>1</td>
							<td>2</td>
							<td>3</td>
							<td>4</td>
							<td>6</td>
						</tr>
					</tbody>
				</table>
			</body>`;

		expect(parseVacations(html)).toEqual([
			{
				nombre: 'Ada Lovelace',
				asignacionInicial: '10',
				prorrateo: '0',
				acarreo: '1',
				disfrutados: '2',
				planeados: '3',
				proximoCiclo: '4',
				disponibles: '6',
			},
		]);
	});

	test('returns empty list when vacation table has no rows', () => {
		expect(
			parseVacations('<table id="DataTables_Table_0"><tbody /></table>'),
		).toEqual([]);
	});
});

describe('Documents routes', () => {
	test('maps top-level document folders', async () => {
		const scrapeListDirs = mock(async () => ({
			success: true,
			carpetas: [
				{
					nombre: 'Recibos',
					href: '/files/edit/123',
					cantidadArchivos: 5,
				},
			],
			errors: [],
		}));
		const { client } = makeClient({ scrapeListDirs });

		const res = await client.documents.list.get({ query: QUERY_CREDS });

		expect(res.status).toBe(200);
		expect(res.data).toEqual({
			cursor: null,
			entries: [
				{
					id: '/files/edit/123',
					name: 'Recibos',
					nexataId: null,
					path: '/files/edit/123',
					ext: 'dir',
					extra: { cantidadArchivos: 5 },
				},
			],
		});
	});

	test('maps document files for a folder path', async () => {
		const scrapeListDocs = mock(async () => ({
			success: true,
			documentos: [
				{
					nombre: 'recibo.pdf',
					url: 'https://example.com/recibo.pdf',
					fecha: '31/07/2025 11:25hs',
					firmado: true,
				},
			],
			errors: [],
		}));
		const { client } = makeClient({ scrapeListDocs });

		const res = await client.documents.list.get({
			query: { ...QUERY_CREDS, path: '/files/edit/123' },
		});

		expect(res.status).toBe(200);
		expect(res.data?.entries[0]).toEqual(
			expect.objectContaining({
				id: 'https://example.com/recibo.pdf',
				name: 'recibo.pdf',
				ext: 'pdf',
				extra: {
					firmado: true,
					fechaRaw: '31/07/2025 11:25hs',
				},
			}),
		);
		expect(res.data?.entries[0]?.updatedAt).toBeInstanceOf(Date);
	});

	test('validates search query length before scraping', async () => {
		const scrapeFileSearch = mock(async () => ({
			success: true,
			results: [],
			errors: [],
		}));
		const { client } = makeClient({ scrapeFileSearch });

		const res = await client.documents.search.get({
			query: { ...QUERY_CREDS, q: 'ab' },
		});

		expect(res.status).toBe(400);
		expect(res.error?.value).toEqual({
			error: "Query param 'q' must be at least 3 characters.",
		});
		expect(scrapeFileSearch).not.toHaveBeenCalled();
	});

	test('maps search results to entries', async () => {
		const scrapeFileSearch = mock(async () => ({
			success: true,
			results: [
				{
					carpeta: 'Contratos',
					nombre: 'contrato.pdf',
					href: '/enviar_doc/1',
					url: 'https://example.com/contrato.pdf',
				},
			],
			errors: [],
		}));
		const { client } = makeClient({ scrapeFileSearch });

		const res = await client.documents.search.get({
			query: { ...QUERY_CREDS, q: 'contrato' },
		});

		expect(res.status).toBe(200);
		expect(res.data).toEqual({
			cursor: null,
			entries: [
				{
					id: '/enviar_doc/1',
					name: 'contrato.pdf',
					nexataId: null,
					url: 'https://example.com/contrato.pdf',
					path: '/enviar_doc/1',
					ext: 'pdf',
					extra: { carpeta: 'Contratos' },
				},
			],
		});
	});

	test('searches within a folder path using list docs', async () => {
		const scrapeFileSearch = mock(async () => ({
			success: true,
			results: [],
			errors: [],
		}));
		const scrapeListDocs = mock(async () => ({
			success: true,
			documentos: [
				{
					nombre: 'recibo-marzo.pdf',
					url: 'https://example.com/recibo-marzo.pdf',
					fecha: '31/03/2026 11:25hs',
					firmado: true,
				},
				{
					nombre: 'contrato.pdf',
					url: 'https://example.com/contrato.pdf',
					fecha: '31/07/2025 11:25hs',
					firmado: false,
				},
			],
			errors: [],
		}));
		const { client } = makeClient({ scrapeFileSearch, scrapeListDocs });

		const res = await client.documents.search.get({
			query: { ...QUERY_CREDS, q: 'recibo', path: '/files/edit/123' },
		});

		expect(res.status).toBe(200);
		expect(scrapeFileSearch).not.toHaveBeenCalled();
		expect(scrapeListDocs).toHaveBeenCalledWith(
			QUERY_CREDS.user,
			QUERY_CREDS.password,
			'/files/edit/123',
			expect.anything(),
		);
		expect(res.data?.entries).toHaveLength(1);
		expect(res.data?.entries[0]).toEqual(
			expect.objectContaining({
				id: 'https://example.com/recibo-marzo.pdf',
				name: 'recibo-marzo.pdf',
				ext: 'pdf',
			}),
		);
	});

	test('rejects invalid folder paths for scoped search', async () => {
		const scrapeListDocs = mock(async () => ({
			success: true,
			documentos: [],
			errors: [],
		}));
		const { client } = makeClient({ scrapeListDocs });

		const res = await client.documents.search.get({
			query: { ...QUERY_CREDS, q: 'recibo', path: '../secrets' },
		});

		expect(res.status).toBe(400);
		expect(res.error?.value).toEqual({
			error: 'Invalid directory id: expected a Legajox relative path.',
		});
		expect(scrapeListDocs).not.toHaveBeenCalled();
	});

	test('requires a non-empty selection for downloads', async () => {
		const scrapeDownload = mock(async () => ({
			success: true,
			metadata: [],
			errors: [],
		}));
		const { client } = makeClient({ scrapeDownload });

		const res = await client.documents.download.post(
			{ selection: [] },
			{ query: QUERY_CREDS },
		);

		expect(res.status).toBe(400);
		expect(res.error?.value).toEqual({
			error: "Body 'selection' must be a non-empty array.",
		});
		expect(scrapeDownload).not.toHaveBeenCalled();
	});

	test('rejects absolute external URLs for direct downloads', async () => {
		const scrapeDownload = mock(async () => ({
			success: true,
			metadata: [],
			errors: [],
		}));
		const { client } = makeClient({ scrapeDownload });

		const res = await client.documents.download.post(
			{
				selection: [{ id: 'https://evil.example/file.pdf', isDir: false }],
			},
			{ query: QUERY_CREDS },
		);

		expect(res.status).toBe(400);
		expect(res.error?.value).toEqual({
			error: 'Invalid document id: expected a Legajox relative path.',
		});
		expect(scrapeDownload).not.toHaveBeenCalled();
	});

	test('rejects malformed directory ids for downloads', async () => {
		const scrapeDownload = mock(async () => ({
			success: true,
			metadata: [],
			errors: [],
		}));
		const { client } = makeClient({ scrapeDownload });

		const res = await client.documents.download.post(
			{
				selection: [{ id: '../secrets', isDir: true }],
			},
			{ query: QUERY_CREDS },
		);

		expect(res.status).toBe(400);
		expect(res.error?.value).toEqual({
			error: 'Invalid directory id: expected a Legajox relative path.',
		});
		expect(scrapeDownload).not.toHaveBeenCalled();
	});

	test('splits selected dirs and direct links for download', async () => {
		const scrapeDownload = mock(async () => ({
			success: true,
			metadata: [
				{
					nombre: 'contrato.pdf',
					downloadUrl: 'https://example.com/contrato.pdf',
					pesoBytes: 1048576,
					extension: 'pdf',
					fecha: '31/07/2025 11:25hs',
					firmado: true,
					dirNombre: 'Contratos',
					rutaLocal: 'outputs/_descargas_tmp/contrato.pdf',
					estado: 'ok',
					pesoLegible: '1.00 MB',
					dir: '/files/edit/123',
				},
			],
			errors: [],
		}));
		const { client } = makeClient({ scrapeDownload });

		const res = await client.documents.download.post(
			{
				selection: [
					{ id: '/files/edit/123', isDir: true },
					{ id: '/storage/contrato.pdf?token=abc', isDir: false },
				],
			},
			{ query: QUERY_CREDS },
		);

		expect(res.status).toBe(200);
		expect(scrapeDownload).toHaveBeenCalledWith(
			QUERY_CREDS.user,
			QUERY_CREDS.password,
			['/files/edit/123'],
			['/storage/contrato.pdf?token=abc'],
			expect.anything(),
		);
		expect(res.data?.entries[0]).toEqual(
			expect.objectContaining({
				id: 'https://example.com/contrato.pdf',
				name: 'contrato.pdf',
				size: 1,
				path: 'outputs/_descargas_tmp/contrato.pdf',
				ext: 'pdf',
				extra: {
					estado: 'ok',
					firmado: true,
					dirNombre: 'Contratos',
					dirPath: '/files/edit/123',
					pesoBytes: 1048576,
					pesoLegible: '1.00 MB',
					fechaRaw: '31/07/2025 11:25hs',
				},
			}),
		);
		expect(res.data?.entries[0]?.updatedAt).toBeInstanceOf(Date);
	});
});
