import puppeteer, { Browser, Page } from "puppeteer";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const URL_LOGIN = "https://legajox.com/login";
const DEBUG_DIR  = path.join(path.dirname(fileURLToPath(import.meta.url)), "outputs", "debug");
/**
 * Performs the Legajox login flow on an existing page.
 * Throws if the login fails or the dashboard is never reached.
 */
export async function login(page: Page, user: string, password: string): Promise<void> {
  // Block resources irrelevant to the login flow for faster page load
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (/\.(png|jpg|jpeg|gif|svg|woff|woff2|ttf)$/i.test(req.url())) {
      req.abort();
    } else {
      req.continue();
    }
  });

  await page.goto(URL_LOGIN, { waitUntil: "domcontentloaded" });
  await page.type("#usr_email", user);
  await page.type("#usr_password", password);
  await page.click("button[type='submit']");

  // Race: URL leaves /login (success) vs SweetAlert2 error icon (invalid credentials).
  // Both branches catch their own timeout so Promise.race always resolves, never rejects.
  const outcome = await Promise.race([
    page
      .waitForFunction("!location.href.includes('/login')", { timeout: 20_000 })
      .then(() => "success" as const)
      .catch(() => "timeout" as const),
    page
      .waitForSelector(".swal2-icon.swal2-error", { visible: true, timeout: 20_000 })
      .then(() => "invalid_credentials" as const)
      .catch(() => "timeout" as const),
  ]);

  if (outcome === "invalid_credentials") {
    throw new Error("Invalid credentials");
  }

  if (outcome === "timeout") {
    fs.mkdirSync(DEBUG_DIR, { recursive: true });
    const shot = path.join(DEBUG_DIR, `login-timeout-${Date.now()}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    throw new Error(`Login timed out after 20s. URL: ${page.url()} — Screenshot: ${shot}`);
  }
}

/**
 * Launches a disposable browser, attempts login, and returns whether
 * the supplied credentials are valid.
 */
export async function validateCredentials(user: string, password: string): Promise<boolean> {
  let browser: Browser | null = null;
  try {
    browser = await puppeteer.launch({
      headless: process.env["DEBUG_HEADLESS"] !== "false",
      channel: "chrome",
    });
    const page = await browser.newPage();
    await login(page, user, password);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[validateCredentials] failed:", msg);
    return false;
  } finally {
    try {
      await Promise.race([
        browser?.close(),
        new Promise<void>((resolve) => setTimeout(resolve, 5_000)),
      ]);
    } catch {
      // ignore close errors — they must never override the return value above
    }
  }
}

async function main(): Promise<void> {
  const [, , user, password] = process.argv;

  if (!user || !password) {
    console.error("Usage: bun validate_credentials.ts <user> <password>");
    process.exit(1);
  }

  console.log(`Validating credentials for: ${user}`);
  const valid = await validateCredentials(user, password);

  if (valid) {
    console.log("Credentials valid.");
    process.exit(0);
  } else {
    console.error("Invalid credentials.");
    process.exit(1);
  }
}

// import.meta.main is Bun-specific; under Node.js/tsx it is undefined, so fall
// back to comparing process.argv[1] against this file's resolved path.
const isEntryPoint: boolean =
  (import.meta as { main?: boolean }).main ??
  process.argv[1] === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
