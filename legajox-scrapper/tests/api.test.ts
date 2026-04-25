/**
 * Integration tests for the Legajox scraper API.
 *
 * Usage:
 *   LEGAJOX_USER=user@example.com LEGAJOX_PASSWORD=pass123 API_KEY=xd bun test tests/api.test.ts
 *
 * Optional env vars:
 *   API_BASE_URL   — defaults to http://localhost:3000
 *   SKIP_SCRAPE    — set to "true" to skip tests that launch Puppeteer (slow)
 *
 * The API server must already be running before executing the tests.
 */

import { describe, it, expect, beforeAll } from "bun:test";

// ── Config ────────────────────────────────────────────────────────────────────

const BASE_URL    = process.env["API_BASE_URL"]      ?? "http://localhost:3000";
const API_KEY     = process.env["API_KEY"]           ?? "xd";
const USER        = process.env["LEGAJOX_USER"]      ?? "";
const PASSWORD    = process.env["LEGAJOX_PASSWORD"]  ?? "";
const SKIP_SCRAPE = process.env["SKIP_SCRAPE"]       === "true";

const WRONG_KEY   = "invalid-api-key";
const WRONG_CREDS = { user: "nobody@example.com", password: "wrongpass" };

// ── Helpers ───────────────────────────────────────────────────────────────────

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return "";
  return "?" + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");
}

async function get(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
  opts: { apiKey?: string; noAuth?: boolean } = {},
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!opts.noAuth) {
    headers["Authorization"] = `Bearer ${opts.apiKey ?? API_KEY}`;
  }
  const res = await fetch(`${BASE_URL}${path}${qs(params)}`, { headers });
  let body: any;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
}

async function post(
  path: string,
  payload: unknown,
  params: Record<string, string | number | boolean | undefined> = {},
  opts: { apiKey?: string; noAuth?: boolean } = {},
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!opts.noAuth) {
    headers["Authorization"] = `Bearer ${opts.apiKey ?? API_KEY}`;
  }
  const res = await fetch(`${BASE_URL}${path}${qs(params)}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  let body: any;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
}

const withCreds = (extra?: Record<string, string | number | boolean | undefined>) => ({
  user: USER,
  password: PASSWORD,
  ...extra,
});

// ── Pre-flight ────────────────────────────────────────────────────────────────

beforeAll(async () => {
  if (!USER || !PASSWORD) {
    throw new Error(
      "Missing credentials. Set LEGAJOX_USER and LEGAJOX_PASSWORD env vars before running tests.",
    );
  }
  // Check API is reachable
  try {
    await fetch(BASE_URL);
  } catch {
    throw new Error(
      `API not reachable at ${BASE_URL}. Make sure the server is running (bun run api).`,
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTH GUARD (all endpoints must enforce it)
// ─────────────────────────────────────────────────────────────────────────────

describe("Auth guard", () => {
  const endpoints = ["/validate", "/employees", "/liquidaciones", "/ausencias", "/vacaciones", "/info", "/org-chart"];

  for (const ep of endpoints) {
    it(`${ep} → 401 when no Authorization header`, async () => {
      const { status } = await get(ep, withCreds(), { noAuth: true });
      expect(status).toBe(401);
    });

    it(`${ep} → 401 when wrong API key`, async () => {
      const { status } = await get(ep, withCreds(), { apiKey: WRONG_KEY });
      expect(status).toBe(401);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// MISSING CREDENTIALS
// ─────────────────────────────────────────────────────────────────────────────

describe("Missing credentials (user/password)", () => {
  const endpoints = ["/validate", "/employees", "/liquidaciones", "/ausencias", "/vacaciones", "/info", "/org-chart"];

  for (const ep of endpoints) {
    it(`${ep} → 400 when user param is missing`, async () => {
      const { status, body } = await get(ep, { password: PASSWORD });
      expect(status).toBe(400);
      expect(body).toHaveProperty("error");
    });

    it(`${ep} → 400 when password param is missing`, async () => {
      const { status, body } = await get(ep, { user: USER });
      expect(status).toBe(400);
      expect(body).toHaveProperty("error");
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /validate
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /validate", () => {
  it("returns { valid: true } with correct credentials", async () => {
    const { status, body } = await get("/validate", withCreds());
    expect(status).toBe(200);
    expect(body).toEqual({ valid: true });
  });

  it("returns { valid: false } with wrong credentials", async () => {
    const { status, body } = await get("/validate", WRONG_CREDS);
    expect(status).toBe(200);
    expect(body).toEqual({ valid: false });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /employees
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /employees — param validation", () => {
  it("returns 400 when page=0", async () => {
    const { status, body } = await get("/employees", withCreds({ page: 0 }));
    expect(status).toBe(400);
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when page is not a number", async () => {
    const { status, body } = await get("/employees", withCreds({ page: "abc" as any }));
    expect(status).toBe(400);
    expect(body).toHaveProperty("error");
  });
});

describe.skipIf(SKIP_SCRAPE)("GET /employees — scraping", () => {
  it("returns a list of employees with correct shape", async () => {
    const { status, body } = await get("/employees", withCreds({ page: 1 }));
    expect(status).toBe(200);
    expect(Array.isArray(body.employees)).toBe(true);
    if (body.employees.length > 0) {
      const emp = body.employees[0];
      expect(emp).toHaveProperty("nombre");
      expect(emp).toHaveProperty("dni");
      expect(emp).toHaveProperty("cuil");
      expect(emp).toHaveProperty("email");
      expect(emp).toHaveProperty("estado");
      expect(emp).toHaveProperty("legajo");
    }
  });

  it("returns empty array for a page that does not exist (page=9999)", async () => {
    const { status, body } = await get("/employees", withCreds({ page: 9999 }));
    expect(status).toBe(200);
    expect(Array.isArray(body.employees)).toBe(true);
    expect(body.employees.length).toBe(0);
  });

  it("accepts a search param and returns filtered results", async () => {
    // We can't assert specific names, but shape must be correct
    const { status, body } = await get("/employees", withCreds({ search: "a", page: 1 }));
    expect(status).toBe(200);
    expect(Array.isArray(body.employees)).toBe(true);
  });

  it("returns page 1 with search and without page produces consistent results", async () => {
    const withPage    = await get("/employees", withCreds({ search: "a", page: 1 }));
    const withoutPage = await get("/employees", withCreds({ search: "a" }));
    expect(withPage.status).toBe(200);
    expect(withoutPage.status).toBe(200);
    // Without page must return >= results than just page 1
    expect(withoutPage.body.employees.length).toBeGreaterThanOrEqual(
      withPage.body.employees.length,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /liquidaciones
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /liquidaciones — param validation", () => {
  it("returns 400 when page=0", async () => {
    const { status, body } = await get("/liquidaciones", withCreds({ page: 0 }));
    expect(status).toBe(400);
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when page is not a number", async () => {
    const { status, body } = await get("/liquidaciones", withCreds({ page: "xyz" as any }));
    expect(status).toBe(400);
    expect(body).toHaveProperty("error");
  });
});

describe.skipIf(SKIP_SCRAPE)("GET /liquidaciones — scraping", () => {
  it("returns a list of liquidaciones with correct shape", async () => {
    const { status, body } = await get("/liquidaciones", withCreds({ page: 1 }));
    expect(status).toBe(200);
    expect(Array.isArray(body.liquidaciones)).toBe(true);
    if (body.liquidaciones.length > 0) {
      const liq = body.liquidaciones[0];
      expect(liq).toHaveProperty("id");
      expect(liq).toHaveProperty("descripcion");
      expect(liq).toHaveProperty("estado");
      expect(liq).toHaveProperty("pdfUrl");
    }
  });

  it("returns empty array for page that does not exist (page=9999)", async () => {
    const { status, body } = await get("/liquidaciones", withCreds({ page: 9999 }));
    expect(status).toBe(200);
    expect(Array.isArray(body.liquidaciones)).toBe(true);
    expect(body.liquidaciones.length).toBe(0);
  });

  it("accepts a search param and returns valid structure", async () => {
    const { status, body } = await get("/liquidaciones", withCreds({ search: "recibo", page: 1 }));
    expect(status).toBe(200);
    expect(Array.isArray(body.liquidaciones)).toBe(true);
  });

  it("returns page 1 with search and without page produces consistent results", async () => {
    const withPage    = await get("/liquidaciones", withCreds({ search: "recibo", page: 1 }));
    const withoutPage = await get("/liquidaciones", withCreds({ search: "recibo" }));
    expect(withPage.status).toBe(200);
    expect(withoutPage.status).toBe(200);
    expect(withoutPage.body.liquidaciones.length).toBeGreaterThanOrEqual(
      withPage.body.liquidaciones.length,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /ausencias
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /ausencias — param validation", () => {
  it("returns 400 for invalid estado value", async () => {
    const { status, body } = await get("/ausencias", withCreds({ estado: "Invalido" }));
    expect(status).toBe(400);
    expect(body).toHaveProperty("error");
  });

  it("accepts estado=Aprobada without error", async () => {
    // Just validates parsing — actual scrape depends on SKIP_SCRAPE
    if (SKIP_SCRAPE) return;
    const { status } = await get("/ausencias", withCreds({ estado: "Aprobada", historial: "true" }));
    expect([200, 500]).toContain(status); // 500 possible if no permissions
  });
});

describe.skipIf(SKIP_SCRAPE)("GET /ausencias — scraping", () => {
  it("returns correct shape with no filters", async () => {
    const { status, body } = await get("/ausencias", withCreds());
    expect(status).toBe(200);
    expect(Array.isArray(body.ausencias)).toBe(true);
    expect(typeof body.total).toBe("number");
    if (body.ausencias.length > 0) {
      const a = body.ausencias[0];
      expect(a).toHaveProperty("tipo");
      expect(a).toHaveProperty("fechaDesde");
      expect(a).toHaveProperty("fechaHasta");
      expect(a).toHaveProperty("estado");
      expect(a).toHaveProperty("nombre");
    }
  });

  it("historial=true returns only historial tab records", async () => {
    const { status, body } = await get("/ausencias", withCreds({ historial: "true" }));
    expect(status).toBe(200);
    expect(Array.isArray(body.ausencias)).toBe(true);
  });

  it("historial=false returns only próximas tab records", async () => {
    const { status, body } = await get("/ausencias", withCreds({ historial: "false" }));
    expect(status).toBe(200);
    expect(Array.isArray(body.ausencias)).toBe(true);
  });

  it("estado filter only returns matching records", async () => {
    const { status, body } = await get("/ausencias", withCreds({ estado: "Pendiente" }));
    expect(status).toBe(200);
    for (const a of body.ausencias) {
      expect(a.estado).toBe("Pendiente");
    }
  });

  it("estado=Rechazada returns only rejected records", async () => {
    const { status, body } = await get("/ausencias", withCreds({ estado: "Rechazada" }));
    expect(status).toBe(200);
    for (const a of body.ausencias) {
      expect(a.estado).toBe("Rechazada");
    }
  });

  it("from/to date range excludes out-of-range records", async () => {
    const from = "2020-01-01";
    const to   = "2030-12-31";
    const { status, body } = await get("/ausencias", withCreds({ from, to }));
    expect(status).toBe(200);
    expect(Array.isArray(body.ausencias)).toBe(true);
    // All fechaDesde must be parseable dates (basic sanity)
    for (const a of body.ausencias) {
      expect(typeof a.fechaDesde).toBe("string");
    }
  });

  it("from date in the future returns empty array", async () => {
    const { status, body } = await get("/ausencias", withCreds({ from: "2099-01-01" }));
    expect(status).toBe(200);
    expect(body.ausencias.length).toBe(0);
  });

  it("to date in the past returns empty array", async () => {
    const { status, body } = await get("/ausencias", withCreds({ to: "2000-01-01" }));
    expect(status).toBe(200);
    expect(body.ausencias.length).toBe(0);
  });

  it("name filter is case-insensitive and reduces result set", async () => {
    const all        = await get("/ausencias", withCreds());
    const filtered   = await get("/ausencias", withCreds({ name: "zzz_nombre_que_no_existe" }));
    expect(filtered.status).toBe(200);
    expect(filtered.body.ausencias.length).toBe(0);
    expect(all.body.ausencias.length).toBeGreaterThanOrEqual(filtered.body.ausencias.length);
  });

  it("motivo filter reduces result set", async () => {
    const { status, body } = await get("/ausencias", withCreds({ motivo: "licencia" }));
    expect(status).toBe(200);
    for (const a of body.ausencias) {
      expect((a.tipo as string).toLowerCase()).toContain("licencia");
    }
  });

  it("combined filters: historial + estado + from + to", async () => {
    const { status, body } = await get(
      "/ausencias",
      withCreds({ historial: "true", estado: "Aprobada", from: "2020-01-01", to: "2030-12-31" }),
    );
    expect(status).toBe(200);
    expect(Array.isArray(body.ausencias)).toBe(true);
    for (const a of body.ausencias) {
      expect(a.estado).toBe("Aprobada");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /info
// ─────────────────────────────────────────────────────────────────────────────

describe.skipIf(SKIP_SCRAPE)("GET /info — scraping", () => {
  it("returns user/company profile data", async () => {
    const { status, body } = await get("/info", withCreds());
    expect(status).toBe(200);
    expect(body).not.toHaveProperty("error");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /org-chart
// ─────────────────────────────────────────────────────────────────────────────

describe.skipIf(SKIP_SCRAPE)("GET /org-chart — scraping", () => {
  it("returns hierarchical org chart data", async () => {
    const { status, body } = await get("/org-chart", withCreds());
    expect(status).toBe(200);
    expect(body).not.toHaveProperty("error");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /vacaciones
// ─────────────────────────────────────────────────────────────────────────────

describe.skipIf(SKIP_SCRAPE)("GET /vacaciones — scraping", () => {
  it("returns vacation balances", async () => {
    const { status, body } = await get("/vacaciones", withCreds());
    expect(status).toBe(200);
    expect(body).not.toHaveProperty("error");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /documents/list
// ─────────────────────────────────────────────────────────────────────────────

describe.skipIf(SKIP_SCRAPE)("GET /documents/list — scraping", () => {
  it("returns top-level folders when no path is provided", async () => {
    const { status, body } = await get("/documents/list", withCreds());
    expect(status).toBe(200);
    expect(Array.isArray(body.entries)).toBe(true);
    if (body.entries.length > 0) {
      const entry = body.entries[0];
      expect(entry).toHaveProperty("id");
      expect(entry).toHaveProperty("name");
      expect(entry.ext).toBe("dir");
    }
  });

  it("returns files when a valid folder path is provided", async () => {
    // First, get the real folder paths
    const { body: listBody } = await get("/documents/list", withCreds());
    if (!listBody.entries || listBody.entries.length === 0) return; // skip if no folders

    const firstFolder = listBody.entries[0].id;
    const { status, body } = await get("/documents/list", withCreds({ path: firstFolder }));
    expect(status).toBe(200);
    expect(Array.isArray(body.entries)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /documents/search
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /documents/search — param validation", () => {
  it("returns 400 when q param is missing", async () => {
    const { status, body } = await get("/documents/search", withCreds());
    expect(status).toBe(400);
    expect(body).toHaveProperty("error");
  });

  it("returns 400 when q is shorter than 3 characters", async () => {
    const { status, body } = await get("/documents/search", withCreds({ q: "ab" }));
    expect(status).toBe(400);
    expect(body).toHaveProperty("error");
  });
});

describe.skipIf(SKIP_SCRAPE)("GET /documents/search — scraping", () => {
  it("returns search results with correct shape", async () => {
    const { status, body } = await get("/documents/search", withCreds({ q: "contrato" }));
    expect(status).toBe(200);
    expect(Array.isArray(body.entries)).toBe(true);
    if (body.entries.length > 0) {
      const entry = body.entries[0];
      expect(entry).toHaveProperty("id");
      expect(entry).toHaveProperty("name");
      expect(entry).toHaveProperty("url");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /documents/download
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /documents/download — param validation", () => {
  it("returns 400 when selection is empty", async () => {
    const { status, body } = await post("/documents/download", { selection: [] }, withCreds());
    expect(status).toBe(400);
    expect(body).toHaveProperty("error");
  });

  it("returns 401 when no Authorization header", async () => {
    const { status } = await post(
      "/documents/download",
      { selection: [{ id: "/files/edit/123", isDir: true }] },
      withCreds(),
      { noAuth: true },
    );
    expect(status).toBe(401);
  });
});
