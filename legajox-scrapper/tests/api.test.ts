import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { treaty } from '@elysiajs/eden';
import type { AppDependencies } from '../api/index';
import { createApp } from '../api/index';

const API_KEY = 'test-api-key';
const QUERY_CREDS = {
	user: 'user@example.com',
	password: 'super-secret',
};
const DEFAULT_CREDS = {
	defaultUser: 'default@example.com',
	defaultPassword: 'default-secret',
};

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

	return { client, deps };
}

beforeEach(() => {
	mock.restore();
});

describe('Auth guard', () => {
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
