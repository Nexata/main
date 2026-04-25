import { fileURLToPath } from "url";
import puppeteer, { Browser, Page, ElementHandle } from "puppeteer";
import { login } from "./validate_credentials";

// ============================================================
// CONFIG
// ============================================================

const PAGE_AUSENCIAS_LEGAJO = "https://app.legajox.com/ausencias_legajo";

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ============================================================
// TYPES
// ============================================================

export interface Ausencia {
  tipo:              string;
  fechaDesde:        string;
  fechaHasta:        string;
  estado:            string;
  nombre:            string;
  dni:               string;
  cuil:              string;
  email:             string;
  telefono:          string;
  locacion:          string;
  fechaContratacion: string;
  comentario:        string;
}

export interface ScrapeResult {
  success:    boolean;
  ausencias:  Ausencia[];
  total:      number;
  errors:     string[];
  outputFile: string | null;
}

export interface AusenciasFilters {
  name?:      string | null;
  from?:      string | null;  // ISO date YYYY-MM-DD — include absences with fechaDesde >= from
  to?:        string | null;  // ISO date YYYY-MM-DD — include absences with fechaHasta <= to
  historial?: boolean | null; // true → historial tab only | false → próximas tab only | null → both
  motivo?:    string | null;  // case-insensitive match on tipo (reason/type of absence)
  estado?:    "Aprobada" | "Pendiente" | "Rechazada" | null;
}

// ============================================================
// UTILS
// ============================================================

function clean(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

async function extractText(page: Page, selector: string): Promise<string> {
  try {
    return clean(await page.$eval(selector, (el) => (el as HTMLElement).innerText));
  } catch {
    return "";
  }
}

/** Parses a date string in DD/MM/YYYY format to a Date. */
function parseDateDMY(str: string): Date | null {
  const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1]);
}

/** Applies client-side filters to a list of ausencias. */
function applyAusenciasFilters(ausencias: Ausencia[], filters: AusenciasFilters): Ausencia[] {
  return ausencias.filter((a) => {
    if (filters.name   && !a.nombre.toLowerCase().includes(filters.name.toLowerCase()))  return false;
    if (filters.motivo && !a.tipo.toLowerCase().includes(filters.motivo.toLowerCase()))  return false;
    if (filters.estado && a.estado !== filters.estado)                                   return false;
    if (filters.from) {
      const from      = new Date(filters.from);
      const fechaDesde = parseDateDMY(a.fechaDesde);
      if (!isNaN(from.getTime()) && fechaDesde && fechaDesde < from) return false;
    }
    if (filters.to) {
      const to       = new Date(filters.to);
      const fechaHasta = parseDateDMY(a.fechaHasta);
      if (!isNaN(to.getTime()) && fechaHasta && fechaHasta > to) return false;
    }
    return true;
  });
}

// ============================================================
// STATUS DETECTION — based on SVG fill colours
// ============================================================

async function getEstadoFromCard(card: ElementHandle<Element>): Promise<string> {
  try {
    if ((await card.$$('path[fill="#01B671"]')).length > 0) return "Aprobada";
    if ((await card.$$('path[fill="#ff9900"]')).length > 0) return "Pendiente";
    if ((await card.$$('circle[fill="#EA232A"], path[fill="#EA232A"]')).length > 0) return "Rechazada";
  } catch { /* ignore */ }
  return "Desconocido";
}

// ============================================================
// MODAL SCRAPING
// ============================================================

async function scrapeAusenciaModal(page: Page): Promise<Omit<Ausencia, "estado">> {
  await page.waitForSelector(".au_tipo", { visible: true, timeout: 5_000 });
  await delay(400);

  const tipo = await extractText(page, ".au_tipo");

  // Parse date range — "📅 05/07/2024 al 05/07/2024"
  const fechaText = await extractText(page, "#fecha_aus");
  const fechaMatch = fechaText.match(/(\d{2}\/\d{2}\/\d{4})\s*al\s*(\d{2}\/\d{2}\/\d{4})/);
  const fechaDesde = fechaMatch ? fechaMatch[1] : fechaText;
  const fechaHasta = fechaMatch ? fechaMatch[2] : "";

  const nombre            = await extractText(page, "#name_aus");
  const dni               = (await extractText(page, "#us_DNI")).replace(/^DNI:\s*/i, "");
  const cuil              = (await extractText(page, "#us_CUIL")).replace(/^CUIL:\s*/i, "");
  const email             = (await extractText(page, "#us_email")).replace(/^Email:\s*/i, "");
  const telefono          = (await extractText(page, "#us_cel")).replace(/^Teléfono:\s*/i, "");
  const locacion          = (await extractText(page, "#us_loc")).replace(/^Locación:\s*/i, "");
  const fechaContratacion = (await extractText(page, "#us_ing")).replace(/^Fecha contratación:\s*/i, "");

  // Collect all comments (may have .au_descripcion and .au_motivo)
  const commentParts: string[] = [];
  try {
    const descEls = await page.$$(".au_descripcion");
    for (let c = 0; c < descEls.length; c++) {
      const raw = await descEls[c].evaluate((el) => (el as HTMLElement).innerText);
      const cleaned = clean(raw);
      if (cleaned) commentParts.push(cleaned);
    }
  } catch { /* no comment */ }
  try {
    const motEls = await page.$$(".au_motivo");
    for (let c = 0; c < motEls.length; c++) {
      const raw = await motEls[c].evaluate((el) => (el as HTMLElement).innerText);
      const cleaned = clean(raw);
      if (cleaned) commentParts.push(cleaned);
    }
  } catch { /* no motivo */ }
  const comentario = commentParts.join(" | ");

  return {
    tipo, fechaDesde, fechaHasta, nombre,
    dni, cuil, email, telefono, locacion,
    fechaContratacion, comentario,
  };
}

async function closeAusenciaModal(page: Page): Promise<void> {
  try {
    await page.click('button.close[data-dismiss="modal"]');
  } catch {
    await page.keyboard.press("Escape");
  }
  try {
    await page.waitForSelector(".au_tipo", { hidden: true, timeout: 5_000 });
  } catch { /* proceed anyway */ }
  await delay(300);
}

// ============================================================
// PAGE-LEVEL SCRAPING
// ============================================================

async function scrapeCards(
  page: Page,
  errors: string[],
  scopeSelector = "",
): Promise<Ausencia[]> {
  const cards = await page.$$(`${scopeSelector}div.ausencia`);
  const results: Ausencia[] = [];

  // Empty page — valid scenario (no absences)
  if (cards.length === 0) return results;

  console.log(`[ausencias] Found ${cards.length} record(s) to scrape.`);

  for (let i = 0; i < cards.length; i++) {
    try {
      const card = cards[i];

      // 1. Detect status from SVG icon inside the card
      const estado = await getEstadoFromCard(card);

      // 2. Open dropdown menu (three-dots)
      const dropdownToggle = await card.$("a.dropdown-toggle");
      await dropdownToggle!.click();
      await delay(300);

      // 3. Click "Ver"
      const verItem = await card.$('a.dropdown-item[title="Ver"]');
      await verItem!.click();

      // 4. Scrape the modal
      const modalData = await scrapeAusenciaModal(page);
      const ausencia: Ausencia = { ...modalData, estado };
      results.push(ausencia);

      console.log(`  [${i + 1}/${cards.length}] ${ausencia.nombre} — ${ausencia.tipo} (${ausencia.estado})`);

      // 5. Close modal
      await closeAusenciaModal(page);

    } catch (err) {
      const msg = `Card ${i}: ${err instanceof Error ? err.message : err}`;
      console.warn(`  [!] ${msg}`);
      errors.push(msg);

      // Try to close any leftover modal before continuing
      try { await closeAusenciaModal(page); } catch { /* ignore */ }
    }
  }

  return results;
}

// ============================================================
// SECTION: ausencias_legajo
// ============================================================

async function scrapeAusenciasLegajo(
  page: Page,
  errors: string[],
  historial?: boolean | null,
): Promise<Ausencia[]> {
  console.log("[ausencias] Navigating to ausencias_legajo...");
  await page.goto(PAGE_AUSENCIAS_LEGAJO, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForNetworkIdle({ timeout: 30_000 }).catch(() => {});

  // Check for permission error (SweetAlert2)
  try {
    await page.waitForSelector(".swal2-icon.swal2-error", { visible: true, timeout: 2_000 });
    console.warn("[ausencias] Access denied — no permissions for ausencias_legajo.");
    errors.push("Access denied: no permissions for ausencias_legajo.");
    return [];
  } catch { /* no error alert — accessible */ }

  // — historial = true → scrape "Historial" tab only —
  if (historial === true) {
    console.log("[ausencias] Switching to 'Historial' tab...");
    try {
      // NOTE: update selector below if the tab id differs in the app
      await page.click("#historial_ausencias_tab");
      await delay(1_000);
      try {
        await page.waitForSelector("#historial_ausencias div.ausencia", { visible: true, timeout: 10_000 });
      } catch {
        console.log("[ausencias] Historial — no cards found (empty tab).");
        return [];
      }
      const historialCards = await scrapeCards(page, errors, "#historial_ausencias ");
      console.log(`[ausencias] Historial — ${historialCards.length} ausencia(s) scraped.`);
      return historialCards;
    } catch (err) {
      const msg = `Historial tab: ${err instanceof Error ? err.message : err}`;
      console.warn(`[ausencias] ${msg}`);
      errors.push(msg);
      return [];
    }
  }

  // — historial = false → scrape "Próximas ausencias" tab only —
  if (historial === false) {
    console.log("[ausencias] Switching to 'Próximas ausencias' tab...");
    try {
      await page.click("#proximas_ausencias_tab");
      await delay(1_000);
      try {
        await page.waitForSelector("#proximas_ausencias div.ausencia", { visible: true, timeout: 10_000 });
      } catch {
        console.log("[ausencias] Próximas ausencias — no cards found (empty tab).");
        return [];
      }
      const proximasCards = await scrapeCards(page, errors, "#proximas_ausencias ");
      console.log(`[ausencias] Próximas ausencias — ${proximasCards.length} ausencia(s) scraped.`);
      return proximasCards;
    } catch (err) {
      const msg = `Próximas ausencias tab: ${err instanceof Error ? err.message : err}`;
      console.warn(`[ausencias] ${msg}`);
      errors.push(msg);
      return [];
    }
  }

  // — historial = null/undefined → default: scrape main tab + próximas —
  // Wait for at least one absence card (or detect empty page)
  try {
    await page.waitForSelector("div.ausencia", { visible: true, timeout: 15_000 });
  } catch {
    console.log("[ausencias] No absence cards found — page may be empty.");
    return [];
  }

  // Scrape main tab
  const allAusencias = await scrapeCards(page, errors);

  if (allAusencias.length === 0) {
    console.log("[ausencias] Pestaña principal — 0 ausencias found.");
  } else {
    console.log(`[ausencias] Pestaña principal — ${allAusencias.length} ausencia(s) scraped.`);
  }

  // Scrape "Próximas ausencias" tab
  console.log("[ausencias] Switching to 'Próximas ausencias' tab...");
  try {
    await page.click("#proximas_ausencias_tab");
    await delay(1_000);
    try {
      await page.waitForSelector("#proximas_ausencias div.ausencia", { visible: true, timeout: 10_000 });
    } catch {
      console.log("[ausencias] Próximas ausencias — no cards found (empty tab).");
      return allAusencias;
    }
    const proximasCards = await scrapeCards(page, errors, "#proximas_ausencias ");
    console.log(`[ausencias] Próximas ausencias — ${proximasCards.length} ausencia(s) scraped.`);
    allAusencias.push(...proximasCards);
  } catch (err) {
    const msg = `Próximas ausencias tab: ${err instanceof Error ? err.message : err}`;
    console.warn(`[ausencias] ${msg}`);
    errors.push(msg);
  }

  return allAusencias;
}

// ============================================================
// CORE — exportable for API integration
// ============================================================

export async function scrapeAusencias(
  user: string,
  password: string,
  filters?: AusenciasFilters,
): Promise<ScrapeResult> {
  const errors: string[] = [];
  let browser: Browser | null = null;

  try {
    browser = await puppeteer.launch({
      headless: process.env["DEBUG_HEADLESS"] !== "false",
      channel: "chrome",
    });

    const page = await browser.newPage();

    // Login
    console.log("[ausencias] Signing in...");
    await login(page, user, password);
    console.log(`[ausencias] Signed in — ${page.url()}`);

    // Scrape ausencias_legajo (tab selection driven by filters.historial)
    const ausenciasLegajo = await scrapeAusenciasLegajo(page, errors, filters?.historial);

    const allAusencias = [...ausenciasLegajo];

    // Apply client-side filters (if any)
    const filtered = filters ? applyAusenciasFilters(allAusencias, filters) : allAusencias;
    const total = filtered.length;

    console.log(`[ausencias] Scraping complete: ${allAusencias.length} total, ${total} after filters.`);

    if (errors.length > 0) {
      console.warn(`[ausencias] Finished with ${errors.length} non-fatal error(s).`);
    }

    return { success: true, ausencias: filtered, total, errors, outputFile: null };

  } catch (err) {
    const msg = `Fatal: ${err instanceof Error ? err.message : err}`;
    console.error(`[ausencias] ${msg}`);
    errors.push(msg);
    return { success: false, ausencias: [], total: 0, errors, outputFile: null };

  } finally {
    try {
      await Promise.race([
        browser?.close(),
        new Promise<void>((resolve) => setTimeout(resolve, 5_000)),
      ]);
    } catch { /* swallow close errors */ }
  }
}

// ============================================================
// STANDALONE ENTRY POINT
// ============================================================

async function main(): Promise<void> {
  const user     = process.argv[2] ?? process.env["LEGAJOX_USER"];
  const password = process.argv[3] ?? process.env["LEGAJOX_PASSWORD"];

  if (!user || !password) {
    console.error("Usage: bun scripts/absences.ts <user> <password>");
    console.error("   or: LEGAJOX_USER=x LEGAJOX_PASSWORD=y bun scripts/absences.ts");
    process.exit(1);
  }

  const result = await scrapeAusencias(user, password);
  process.exit(result.success ? 0 : 1);
}

if ((import.meta as { main?: boolean }).main ?? process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
