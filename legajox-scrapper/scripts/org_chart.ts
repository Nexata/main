import { fileURLToPath } from "url";
import puppeteer, { Browser } from "puppeteer";
import { login } from "./validate_credentials";

// ============================================================
// CONFIG
// ============================================================

const ORG_URL     = "https://app.legajox.com/legajos/organigrama";

// ============================================================
// TYPES
// ============================================================

export interface OrgNode {
  usrId:       string;
  legId:       string;
  nombre:      string;
  apellido:    string;
  email:       string;
  grupo:       string;
  reportaA:    string;   // usr_id of parent
  subordinados: OrgNode[];
}

export interface OrgChart {
  totalEmpleados:     string;
  sinPerfilAsignado:  string;
  raiz:               OrgNode | null;
  noAsignados:        OrgNode[];
}

export interface ScrapeResult {
  success:    boolean;
  chart:      OrgChart | null;
  errors:     string[];
  outputFile: string | null;
}

// ============================================================
// UTILS
// ============================================================

function clean(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

/** Build a tree from a flat list of nodes using reportaA → usrId. */
function buildTree(nodes: OrgNode[]): { root: OrgNode | null; orphans: OrgNode[] } {
  const byUsrId = new Map<string, OrgNode>();
  for (const n of nodes) byUsrId.set(n.usrId, n);

  const orphans: OrgNode[] = [];
  let root: OrgNode | null = null;

  for (const n of nodes) {
    const parent = byUsrId.get(n.reportaA);
    if (parent && parent !== n) {
      parent.subordinados.push(n);
    } else if (!root || n.reportaA === "" || !byUsrId.has(n.reportaA)) {
      // The node whose parent is not in the set is the root
      if (root) {
        // Multiple roots — first one wins, rest are orphans
        orphans.push(n);
      } else {
        root = n;
      }
    }
  }

  return { root, orphans };
}

// ============================================================
// CORE — exportable for API integration
// ============================================================

export async function scrapeOrgChart(user: string, password: string): Promise<ScrapeResult> {
  const errors: string[] = [];
  let browser: Browser | null = null;

  try {
    browser = await puppeteer.launch({
      headless: process.env["DEBUG_HEADLESS"] !== "false",
      channel: "chrome",
    });

    const page = await browser.newPage();

    // — Login —
    console.log("[org-chart] Signing in...");
    await login(page, user, password);
    console.log(`[org-chart] Signed in — ${page.url()}`);

    // — Navigate to org chart —
    console.log("[org-chart] Navigating to organigrama...");
    await page.goto(ORG_URL, { waitUntil: "domcontentloaded" });
    await page.waitForNetworkIdle({ timeout: 15_000 }).catch(() => {});

    // — Extract summary stats —
    let totalEmpleados = "";
    let sinPerfilAsignado = "";

    try {
      const statsCard = await page.$(".cajas_dash.text-center");
      if (statsCard) {
        const h2s = await statsCard.$$("h2");
        if (h2s.length >= 1) totalEmpleados = clean(await h2s[0].evaluate((el) => el.innerText));
        if (h2s.length >= 2) sinPerfilAsignado = clean(await h2s[1].evaluate((el) => el.innerText));
      }
      console.log(`[org-chart] Stats: ${totalEmpleados} empleados, ${sinPerfilAsignado} sin perfil.`);
    } catch (err) {
      const msg = `Error reading stats: ${err instanceof Error ? err.message : err}`;
      console.warn(`[org-chart] ${msg}`);
      errors.push(msg);
    }

    // — Extract all org nodes from data-usuario JSON —
    console.log("[org-chart] Extracting org chart nodes...");
    const allNodes: OrgNode[] = [];

    try {
      const links = await page.$$("#org-chart a.ver-usuario");

      for (let i = 0; i < links.length; i++) {
        try {
          const raw = await links[i].evaluate((el) => el.getAttribute("data-usuario"));
          if (!raw) continue;
          const data = JSON.parse(raw);
          allNodes.push({
            usrId:        String(data.usr_id ?? ""),
            legId:        String(data.leg_id ?? ""),
            nombre:       clean(data.leg_nombre),
            apellido:     clean(data.leg_apellido),
            email:        clean(data.leg_email),
            grupo:        clean(data.leg_grupo_nombre),
            reportaA:     String(data.leg_reporta_usr_id ?? ""),
            subordinados: [],
          });
        } catch (err) {
          const msg = `Error parsing node at index ${i}: ${err instanceof Error ? err.message : err}`;
          console.warn(`[org-chart] ${msg}`);
          errors.push(msg);
        }
      }

      console.log(`[org-chart] Found ${allNodes.length} node(s) in org chart.`);
    } catch (err) {
      const msg = `Error reading org chart nodes: ${err instanceof Error ? err.message : err}`;
      console.warn(`[org-chart] ${msg}`);
      errors.push(msg);
    }

    // — Extract "Personal Adicional" (no asignados) —
    const noAsignadosNodes: OrgNode[] = [];

    try {
      const noAsigLinks = await page.$$("#noAsignados a.ver-usuario");

      for (let i = 0; i < noAsigLinks.length; i++) {
        try {
          const raw = await noAsigLinks[i].evaluate((el) => el.getAttribute("data-usuario"));
          if (!raw) continue;
          const data = JSON.parse(raw);
          noAsignadosNodes.push({
            usrId:        String(data.usr_id ?? ""),
            legId:        String(data.leg_id ?? ""),
            nombre:       clean(data.leg_nombre),
            apellido:     clean(data.leg_apellido),
            email:        clean(data.leg_email),
            grupo:        clean(data.leg_grupo_nombre),
            reportaA:     "",
            subordinados: [],
          });
        } catch (err) {
          const msg = `Error parsing noAsignado at index ${i}: ${err instanceof Error ? err.message : err}`;
          console.warn(`[org-chart] ${msg}`);
          errors.push(msg);
        }
      }

      if (noAsignadosNodes.length > 0) {
        console.log(`[org-chart] Found ${noAsignadosNodes.length} unassigned employee(s).`);
      }
    } catch (err) {
      const msg = `Error reading noAsignados: ${err instanceof Error ? err.message : err}`;
      console.warn(`[org-chart] ${msg}`);
      errors.push(msg);
    }

    // — Build tree —
    const { root, orphans } = buildTree(allNodes);
    // Orphans go to noAsignados
    noAsignadosNodes.push(...orphans);

    const chart: OrgChart = {
      totalEmpleados,
      sinPerfilAsignado,
      raiz: root,
      noAsignados: noAsignadosNodes,
    };

    console.log(`[org-chart] Tree built: root=${root ? clean(`${root.nombre} ${root.apellido}`) : "(none)"}`);

    if (errors.length > 0) {
      console.warn(`[org-chart] Finished with ${errors.length} non-fatal error(s).`);
    }

    return { success: true, chart, errors, outputFile: null };

  } catch (err) {
    const msg = `Fatal: ${err instanceof Error ? err.message : err}`;
    console.error(`[org-chart] ${msg}`);
    errors.push(msg);
    return { success: false, chart: null, errors, outputFile: null };

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
    console.error("Usage: bun scripts/org_chart.ts <user> <password>");
    console.error("   or: LEGAJOX_USER=x LEGAJOX_PASSWORD=y bun scripts/org_chart.ts");
    process.exit(1);
  }

  const result = await scrapeOrgChart(user, password);

  if (!result.success) {
    console.error("[org-chart] Scrape failed.");
    process.exit(1);
  }

  process.exit(0);
}

const isEntryPoint: boolean =
  (import.meta as { main?: boolean }).main ??
  process.argv[1] === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  main().catch((err) => {
    console.error("[org-chart] Unhandled:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
