import { fileURLToPath } from "url";
import puppeteer, { Browser, Page, ElementHandle } from "puppeteer";
import { login } from "./validate_credentials";

// ============================================================
// CONFIG
// ============================================================

const PROFILE_URL    = "https://app.legajox.com/usuarios/perfil";
const DASHBOARD_URL  = "https://app.legajox.com/dashboard";

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ============================================================
// TYPES
// ============================================================

export interface Empresa {
  nombre: string;
  cuit:   string;
}

export interface Modulo {
  nombre: string;
  activo: boolean;
}

export interface Anuncio {
  autor:  string;
  fecha:  string;
  texto:  string;
}

export interface GeneralInfo {
  nombreApellido:    string;
  dni:               string;
  cuit:              string;
  email:             string;
  celular:           string;
  locacion:          string;
  puestoSector:      string;
  fechaContratacion: string;
  tipoColaborador:   string;
  reportaA:          string;
  // Personal tab
  legajo:            string;
  fechaNacimiento:   string;
  estadoCivil:       string;
  sexo:              string;
  // Personal tab — domicilio
  domicilio:         string;
  codigoPostal:      string;
  pais:              string;
  provincia:         string;
  ciudad:            string;
  // Personal tab — datos laborales
  puestoLaboral:             string;
  sectorLaboral:             string;
  turno:                     string;
  fechaContratacionLaboral:  string;
  // Empresas (dashboard dropdown)
  empresas:                  Empresa[];
  // Plan (dashboard dropdown)
  legajosUsados:             string;
  legajosTotal:              string;
  modulos:                   Modulo[];
  // Personas a cargo (dashboard card)
  miResponsable:             string;
  reportanAMi:               string[];
  // Tablón de anuncios (dashboard card, paginated)
  anuncios:                  Anuncio[];
}

export interface ScrapeResult {
  success:    boolean;
  info:       GeneralInfo | null;
  errors:     string[];
  outputFile: string | null;
}

// ============================================================
// UTILS
// ============================================================

function clean(text: string | null | undefined): string {
  return text?.trim().replace(/\s+/g, " ") ?? "";
}

/**
 * Extracts the value from a label/value span pair.
 * Pattern: <span class="color_negro font-weight-bold">Label: <span class="small">Value</span></span>
 */
async function extractFieldByLabel(page: Page, label: string): Promise<string> {
  try {
    return clean(await page.evaluate((lbl) => {
      const spans = document.querySelectorAll("span.color_negro.font-weight-bold");
      for (const span of spans) {
        if (span.textContent?.includes(lbl)) {
          const small = span.querySelector("span.small");
          return small?.textContent?.trim() ?? "";
        }
      }
      return "";
    }, label));
  } catch {
    return "";
  }
}

/**
 * Reads the selected option text from a <select> element.
 */
async function extractSelectedOption(page: Page, selector: string): Promise<string> {
  try {
    const text = await page.$eval(selector, (sel) => {
      const s = sel as unknown as { options: { value: string; textContent: string | null }[]; selectedIndex: number };
      const opt = s.options[s.selectedIndex];
      return opt && opt.value !== "0" ? opt.textContent : "";
    });
    return clean(text);
  } catch {
    return "";
  }
}

/**
 * Reads the value attribute of an <input> element.
 */
async function extractInputValue(page: Page, selector: string): Promise<string> {
  try {
    const val = await page.$eval(selector, (el) => (el as HTMLInputElement).value);
    return clean(val);
  } catch {
    return "";
  }
}

// ============================================================
// CORE — exportable for API integration
// ============================================================

export async function scrapeGeneralInfo(user: string, password: string): Promise<ScrapeResult> {
  const errors: string[] = [];
  let browser: Browser | null = null;

  try {
    browser = await puppeteer.launch({
      headless: process.env["DEBUG_HEADLESS"] !== "false",
      channel: "chrome",
    });

    const page: Page = await browser.newPage();

    // — Login —
    console.log("[general-info] Signing in...");
    await login(page, user, password);
    console.log(`[general-info] Signed in — ${page.url()}`);

    // — Navigate to profile —
    let nombreApellido    = "";
    let dni               = "";
    let cuit              = "";
    let email             = "";
    let celular           = "";
    let locacion          = "";
    let puestoSector      = "";
    let fechaContratacion = "";
    let tipoColaborador   = "";
    let reportaA          = "";
    let legajo            = "";
    let fechaNacimiento   = "";
    let estadoCivil       = "";
    let sexo              = "";

    let domicilio    = "";
    let codigoPostal = "";
    let pais         = "";
    let provincia    = "";
    let ciudad       = "";

    let puestoLaboral            = "";
    let sectorLaboral            = "";
    let turno                    = "";
    let fechaContratacionLaboral = "";

    let profileAccessible = false;

    console.log("[general-info] Navigating to profile...");
    try {
      await page.goto(PROFILE_URL, { waitUntil: "domcontentloaded" });
      await page.waitForNetworkIdle({ timeout: 15_000 }).catch(() => {});
      profileAccessible = true;
    } catch (err) {
      const msg = `Cannot access profile page — possibly insufficient permissions: ${err instanceof Error ? err.message : err}`;
      console.warn(`[general-info] ${msg}`);
      errors.push(msg);
    }

    if (profileAccessible) {
    // — Scrape fields —
    console.log("[general-info] Extracting profile data...");

    nombreApellido    = await extractFieldByLabel(page, "Nombre y apellido:");
    dni               = await extractFieldByLabel(page, "DNI:");
    cuit              = await extractFieldByLabel(page, "CUIT:");
    email             = await extractFieldByLabel(page, "Email:");
    celular           = await extractFieldByLabel(page, "Cel:");
    locacion          = await extractFieldByLabel(page, "Locación:");
    puestoSector      = await extractFieldByLabel(page, "Puesto/Sector:");
    fechaContratacion = await extractFieldByLabel(page, "Fecha contratación:");
    tipoColaborador   = await extractSelectedOption(page, "#usr_colaborador");
    reportaA          = await extractSelectedOption(page, "#leg_reporta");

    try {
      await page.click("#personal_tab");
      await delay(400);

      legajo = await extractInputValue(page, "#leg_legajo");

      // Expand the collapsible section (chevron toggle)
      try {
        const chevron = await page.$("#personal .feather-chevron-up, #personal .feather-chevron-down");
        if (chevron) {
          await chevron.click();
          await delay(200);
        }
      } catch {
        // Section might already be expanded or not collapsible — continue
      }

      fechaNacimiento = await extractInputValue(page, "#leg_fecha_nac");
      estadoCivil     = await extractSelectedOption(page, "#leg_estado_civil");
      sexo            = await extractSelectedOption(page, "#leg_sexo");
    } catch (err) {
      const msg = `Error reading Personal tab (datos personales): ${err instanceof Error ? err.message : err}`;
      console.warn(`[general-info] ${msg}`);
      errors.push(msg);
    }

    // — Expand domicilio section & scrape —

    try {
      // Click the next chevron to expand the address section
      const chevrons = await page.$$("#personal .feather-chevron-up, #personal .feather-chevron-down");
      // The second chevron is the address section (first was datos personales)
      if (chevrons.length >= 2) {
        await chevrons[1].click();
        await delay(200);
      } else if (chevrons.length === 1) {
        // Only one chevron — might be the address one if datos personales was already open
        await chevrons[0].click();
        await delay(200);
      }

      domicilio    = await extractInputValue(page, "#leg_domicilio");
      codigoPostal = await extractInputValue(page, "#leg_codigo_postal");
      pais         = await extractSelectedOption(page, "#pais_id");
      provincia    = await extractSelectedOption(page, "#prv_id");
      ciudad       = await extractInputValue(page, "#leg_ciudad");
    } catch (err) {
      const msg = `Error reading Personal tab (domicilio): ${err instanceof Error ? err.message : err}`;
      console.warn(`[general-info] ${msg}`);
      errors.push(msg);
    }

    // — Expand "Datos laborales" accordion & scrape —

    try {
      await page.click("[data-target='#defaultAccordionThree']");
      await delay(400);

      // select2 rendered spans hold the visible text
      puestoLaboral = clean(await page.$eval("#select2-leg_puesto-container", (el) => el.getAttribute("title") ?? ""));
      if (puestoLaboral === "Seleccione una opción") puestoLaboral = "";

      sectorLaboral = clean(await page.$eval("#select2-leg_sector-container", (el) => el.getAttribute("title") ?? ""));
      if (sectorLaboral === "Seleccione una opción") sectorLaboral = "";

      turno = clean(await page.$eval("#select2-leg_turno-container", (el) => el.getAttribute("title") ?? ""));
      if (turno === "Seleccione una opción") turno = "";

      fechaContratacionLaboral = await extractInputValue(page, "#leg_fecha_contratacion");
    } catch (err) {
      const msg = `Error reading Personal tab (datos laborales): ${err instanceof Error ? err.message : err}`;
      console.warn(`[general-info] ${msg}`);
      errors.push(msg);
    }

    } // end if (profileAccessible)

    // — Navigate to dashboard —
    console.log("[general-info] Navigating to dashboard...");
    let dashboardAccessible = false;

    try {
      await page.goto(DASHBOARD_URL, { waitUntil: "domcontentloaded" });
      await page.waitForNetworkIdle({ timeout: 15_000 }).catch(() => {});
      dashboardAccessible = true;
    } catch (err) {
      const msg = `Cannot access dashboard — possibly insufficient permissions: ${err instanceof Error ? err.message : err}`;
      console.warn(`[general-info] ${msg}`);
      errors.push(msg);
    }

    const empresas: Empresa[] = [];
    let legajosUsados = "";
    let legajosTotal  = "";
    const modulos: Modulo[] = [];
    let miResponsable = "";
    const reportanAMi: string[] = [];
    const anuncios: Anuncio[] = [];

    // — Scrape empresas dropdown —
    if (dashboardAccessible) {
    try {
      // Open the empresas dropdown
      await page.click("#empresasDropdown");
      await delay(200);

      // Each company block lives inside .add-contact-content.hovergrisa
      const blocks = await page.$$(".add-contact-content.hovergrisa");

      for (let i = 0; i < blocks.length; i++) {
        try {
          const block = blocks[i];
          const nombre = clean(await block.$eval("span[style*='font-size:15px']", (el) => el.innerText));
          const cuitRaw = clean(await block.$eval("span.fz-12", (el) => el.innerText));
          const cuitVal = cuitRaw.replace(/^CUIT\s*/i, "");
          if (nombre) {
            empresas.push({ nombre, cuit: cuitVal });
          }
        } catch (err) {
          const msg = `Error reading empresa at index ${i}: ${err instanceof Error ? err.message : err}`;
          console.warn(`[general-info] ${msg}`);
          errors.push(msg);
        }
      }

      console.log(`[general-info] Found ${empresas.length} empresa(s).`);
    } catch (err) {
      const msg = `Error scraping empresas dropdown: ${err instanceof Error ? err.message : err}`;
      console.warn(`[general-info] ${msg}`);
      errors.push(msg);
    }

    // — Scrape plan dropdown (same dashboard page) —
    console.log("[general-info] Scraping plan dropdown...");

    try {
      // Close empresas dropdown first by clicking elsewhere
      await page.mouse.click(0, 0);
      await delay(200);

      await page.click("#planDropdown");
      await delay(200);

      // Extract legajos and modules from the plan dropdown
      const planData = await page.evaluate(() => {
        const dropdown = document.querySelector("#planDropdown");
        const parent = dropdown?.closest(".nav-item") ?? dropdown?.parentElement;
        const progressBar = parent?.querySelector(".dropdown-menu .progress-bar");
        const usados = progressBar?.getAttribute("aria-valuenow") ?? "";
        const total = progressBar?.getAttribute("aria-valuemax") ?? "";

        const items = parent?.querySelectorAll(".dropdown-menu .dropdown-item") ?? [];
        const mods = Array.from(items).map((item) => ({
          nombre: item.querySelector("span.pr-2")?.textContent?.trim() ?? "",
          pillText: item.querySelector("span[class^='plan-pill']")?.textContent?.trim() ?? "",
        }));

        return { usados, total, mods };
      });

      legajosUsados = planData.usados;
      legajosTotal = planData.total;

      for (const m of planData.mods) {
        if (m.nombre) {
          modulos.push({ nombre: m.nombre, activo: m.pillText === "Activo" });
        }
      }

      console.log(`[general-info] Plan: ${legajosUsados}/${legajosTotal} legajos, ${modulos.length} módulo(s).`);
    } catch (err) {
      const msg = `Error scraping plan dropdown: ${err instanceof Error ? err.message : err}`;
      console.warn(`[general-info] ${msg}`);
      errors.push(msg);
    }

    // — Scrape "Personas a cargo" card (same dashboard page) —
    console.log("[general-info] Scraping personas a cargo...");

    try {
      // Close any open dropdown first
      await page.mouse.click(0, 0);
      await delay(200);

      // Find the card containing "Personas a cargo"
      const allCards = await page.$$(".cajas_dash");
      let personasCard: ElementHandle<Element> | null = null;
      for (const card of allCards) {
        const text = await card.evaluate((el) => el.textContent ?? "");
        if (text.includes("Personas a cargo")) {
          personasCard = card;
          break;
        }
      }

      if (personasCard) {
        // "Mi responsable" — the first h6.fz-14.lwtitle
        const responsableSection = await personasCard.$(".d-flex.align-items-center");
        if (responsableSection) {
          const h6 = await responsableSection.$("h6.fz-14.lwtitle");
          if (h6) {
            miResponsable = clean(await h6.evaluate((el) => el.innerText));
          }
        }

        // "Reportan a mí" — all a.nombre_empleados links
        const reportees = await personasCard.$$("a.nombre_empleados");
        for (const r of reportees) {
          try {
            const name = clean(await r.evaluate((el) => el.innerText));
            if (name) reportanAMi.push(name);
          } catch {
            // skip individual failures
          }
        }
      }

      console.log(`[general-info] Responsable: ${miResponsable || "(none)"}, reportan a mí: ${reportanAMi.length} persona(s).`);
    } catch (err) {
      const msg = `Error scraping personas a cargo: ${err instanceof Error ? err.message : err}`;
      console.warn(`[general-info] ${msg}`);
      errors.push(msg);
    }

    // — Scrape "Tablón de anuncios" card (same dashboard page, paginated) —
    console.log("[general-info] Scraping tablón de anuncios...");

    try {
      const allCards = await page.$$(".cajas_dash");
      let anuncioCard: ElementHandle<Element> | null = null;
      for (const card of allCards) {
        const text = await card.evaluate((el) => el.textContent ?? "");
        if (text.includes("Tablón de anuncios")) {
          anuncioCard = card;
          break;
        }
      }

      if (anuncioCard) {
        // Read total pages from the pagination indicator "X/Y"
        const pagEl = await anuncioCard.$("#anuncioPag");
        const pagText = pagEl ? clean(await pagEl.evaluate((el) => (el as HTMLElement).innerText)) : "1/1";
        const pagParts = pagText.split("/");
        const totalPages = pagParts.length === 2 ? parseInt(pagParts[1], 10) || 1 : 1;

        for (let pg = 1; pg <= totalPages; pg++) {
          // Scrape all visible messages on the current page
          const msgs = await anuncioCard.$$("#mensajesContainer .mensaje");

          for (let i = 0; i < msgs.length; i++) {
            try {
              const msg = msgs[i];
              const autorEl = await msg.$("h6.fz-14.lwtitle");
              const autor = autorEl ? clean(await autorEl.evaluate((el) => el.innerText)) : "";
              const fechaEl = await msg.$("small");
              const fecha = fechaEl ? clean(await fechaEl.evaluate((el) => el.innerText)) : "";
              const textoEl = await msg.$("#anunTextBody");
              const texto = textoEl ? clean(await textoEl.evaluate((el) => (el as HTMLElement).innerText)) : "";
              if (autor || texto) {
                anuncios.push({ autor, fecha, texto });
              }
            } catch (err) {
              const emsg = `Error reading anuncio at page ${pg} index ${i}: ${err instanceof Error ? err.message : err}`;
              console.warn(`[general-info] ${emsg}`);
              errors.push(emsg);
            }
          }

          // Navigate to next page if not the last one
          if (pg < totalPages) {
            const nextBtnEl = await anuncioCard.$("#nextBtn");
            if (nextBtnEl) await nextBtnEl.click();
            await delay(200);
          }
        }
      }

      console.log(`[general-info] Anuncios: ${anuncios.length} anuncio(s).`);
    } catch (err) {
      const msg = `Error scraping tablón de anuncios: ${err instanceof Error ? err.message : err}`;
      console.warn(`[general-info] ${msg}`);
      errors.push(msg);
    }

    } // end if (dashboardAccessible)

    const info: GeneralInfo = {
      nombreApellido,
      dni,
      cuit,
      email,
      celular,
      locacion,
      puestoSector,
      fechaContratacion,
      tipoColaborador,
      reportaA,
      legajo,
      fechaNacimiento,
      estadoCivil,
      sexo,
      domicilio,
      codigoPostal,
      pais,
      provincia,
      ciudad,
      puestoLaboral,
      sectorLaboral,
      turno,
      fechaContratacionLaboral,
      empresas,
      legajosUsados,
      legajosTotal,
      modulos,
      miResponsable,
      reportanAMi,
      anuncios,
    };

    console.log(`[general-info] Profile scraped: ${nombreApellido || "(no name)"}`);

    if (errors.length > 0) {
      console.warn(`[general-info] Finished with ${errors.length} non-fatal error(s).`);
    }

    return { success: true, info, errors, outputFile: null };

  } catch (err) {
    const msg = `Fatal: ${err instanceof Error ? err.message : err}`;
    console.error(`[general-info] ${msg}`);
    errors.push(msg);
    return { success: false, info: null, errors, outputFile: null };

  } finally {
    try {
      await Promise.race([
        browser?.close(),
        new Promise<void>((resolve) => setTimeout(resolve, 5_000)),
      ]);
    } catch {
      // swallow close errors
    }
  }
}

// ============================================================
// STANDALONE ENTRY POINT
// ============================================================

async function main(): Promise<void> {
  const user     = process.argv[2] ?? process.env["LEGAJOX_USER"];
  const password = process.argv[3] ?? process.env["LEGAJOX_PASSWORD"];

  if (!user || !password) {
    console.error("Usage: bun scripts/general_information.ts <user> <password>");
    console.error("   or: LEGAJOX_USER=x LEGAJOX_PASSWORD=y bun scripts/general_information.ts");
    process.exit(1);
  }

  const result = await scrapeGeneralInfo(user, password);

  if (!result.success) {
    console.error("[general-info] Scrape failed.");
    process.exit(1);
  }

  process.exit(0);
}

const isEntryPoint: boolean =
  (import.meta as { main?: boolean }).main ??
  process.argv[1] === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  main().catch((err) => {
    console.error("[general-info] Unhandled:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
