import puppeteer, { Browser, Page } from "puppeteer";
import { fileURLToPath } from "url";
import { login } from "../validate_credentials.js";

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ── Types ────────────────────────────────────────────────────────────────────

export interface Documento {
  nombre: string;
  url: string;
  fecha: string;
  firmado: boolean;
}

// ── Scraping ─────────────────────────────────────────────────────────────────

async function scrapeDocumentos(page: Page, carpetaUrl: string): Promise<Documento[]> {
  await page.goto(`https://app.legajox.com${carpetaUrl}`, {
    timeout: 60_000,
    waitUntil: "domcontentloaded",
  });

  // Esperar que la tabla cargue
  await page.waitForSelector("table.datatableDocsCat tbody tr", { timeout: 15_000 });
  await page.waitForNetworkIdle({ timeout: 30_000 }).catch(() => {});

  // Cambiar select a 100 para traer la mayor cantidad posible por página
  // El select puede no ser visible (DataTables lo oculta), así que usamos JS directo
  await page.evaluate(() => {
    const select = document.querySelector<HTMLSelectElement>(
      "select[name='DataTables_Table_1_length']"
    );
    if (select) {
      select.value = "100";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  await delay(2_000);
  await page.waitForNetworkIdle({ timeout: 15_000 }).catch(() => {});

  const allDocumentos: Documento[] = [];

  while (true) {
    const docs = await page.$$eval(
      "table.datatableDocsCat tbody tr",
      (rows) =>
        rows.map((row) => {
          const linkEl = row.querySelector<HTMLAnchorElement>("a.file-name-link");
          const url = linkEl?.getAttribute("href") ?? "";
          const nombre =
            linkEl?.getAttribute("data-original-title") ??
            linkEl?.textContent?.trim() ??
            "";

          // Fecha: la celda tiene un <span class="ocultar"> con timestamp y luego el texto visible
          const fechaTd = row.querySelectorAll("td")[2];
          const fechaTexto = fechaTd?.textContent?.trim() ?? "";
          const fecha = fechaTexto.replace(/^\d{14}\s*/, "").trim();

          // Firmado
          const firmadoEl = row.querySelectorAll("td")[3];
          const firmado = firmadoEl?.textContent?.trim().toLowerCase() === "si";

          return { nombre, url, fecha, firmado };
        })
    );

    allDocumentos.push(...docs);

    // Verificar si hay una página siguiente
    const nextBtn = await page.$("#DataTables_Table_1_next");
    if (!nextBtn) break;

    const isDisabled = await nextBtn.evaluate((el) =>
      el.classList.contains("disabled")
    );
    if (isDisabled) break;

    await nextBtn.click();
    await delay(1_500);
    await page.waitForNetworkIdle({ timeout: 15_000 }).catch(() => {});
  }

  return allDocumentos;
}

// ── Exported API function ───────────────────────────────────────────────────

export interface ListDocsResult {
  success:    boolean;
  documentos: Documento[];
  errors:     string[];
}

export async function scrapeListDocs(
  user: string,
  password: string,
  carpetaUrl: string,
): Promise<ListDocsResult> {
  const errors: string[] = [];
  let browser: Browser | null = null;
  try {
    browser = await puppeteer.launch({
      headless: process.env["DEBUG_HEADLESS"] !== "false",
      channel: "chrome",
    });
    const page = await browser.newPage();
    await login(page, user, password);
    const documentos = await scrapeDocumentos(page, carpetaUrl);
    return { success: true, documentos, errors };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(msg);
    return { success: false, documentos: [], errors };
  } finally {
    try {
      await Promise.race([
        browser?.close(),
        new Promise<void>((r) => setTimeout(r, 5_000)),
      ]);
    } catch {}
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const [, , user, password, carpetaUrl] = process.argv;
  if (!user || !password || !carpetaUrl) {
    console.error(
      "Usage: bun scripts/documents/list-docs.ts <user> <password> <carpetaUrl>"
    );
    console.error("Example: bun scripts/documents/list-docs.ts user@mail.com pass123 /files/edit/11111");
    process.exit(1);
  }

  let browser: Browser | null = null;
  try {
    browser = await puppeteer.launch({
      headless: process.env["DEBUG_HEADLESS"] !== "false",
      channel: "chrome",
    });
    const page = await browser.newPage();

    console.log(`Logging in as ${user}…`);
    await login(page, user, password);
    console.log("Login OK.\n");

    console.log(`Navegando a ${carpetaUrl}…`);
    const documentos = await scrapeDocumentos(page, carpetaUrl);

    console.log(`\n=== Documentos encontrados: ${documentos.length} ===\n`);
    for (let i = 0; i < documentos.length; i++) {
      const d = documentos[i];
      console.log(
        `  📄 [${i + 1}] ${d.nombre}  |  ${d.fecha}  |  Firmado: ${d.firmado ? "Si" : "No"}  →  ${d.url}`
      );
    }
    console.log();

    process.exit(0);
  } catch (err) {
    console.error(
      "Error:",
      err instanceof Error ? err.message : String(err)
    );
    process.exit(1);
  } finally {
    try {
      await Promise.race([
        browser?.close(),
        new Promise<void>((r) => setTimeout(r, 5_000)),
      ]);
    } catch {}
  }
}

const isEntryPoint: boolean =
  (import.meta as { main?: boolean }).main ??
  process.argv[1] === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
