import fs from 'node:fs';
import path from 'node:path';
import type { Browser, Page } from 'puppeteer';
import { launchBrowser } from '../src/browser';

const URL_LOGIN = 'https://legajox.com/login';
const DEBUG_DIR = path.resolve('request_imitator', 'outputs', 'debug');

async function performLogin(
	page: Page,
	user: string,
	password: string,
): Promise<void> {
	await page.setRequestInterception(true);
	page.on('request', (req) => {
		if (/\.(png|jpg|jpeg|gif|svg|woff|woff2|ttf)$/i.test(req.url())) {
			req.abort();
		} else {
			req.continue();
		}
	});

	await page.goto(URL_LOGIN, { waitUntil: 'domcontentloaded' });
	await page.type('#usr_email', user);
	await page.type('#usr_password', password);
	await page.click("button[type='submit']");

	const outcome = await Promise.race([
		page
			.waitForFunction("!location.href.includes('/login')", { timeout: 20_000 })
			.then(() => 'success' as const)
			.catch(() => 'timeout' as const),
		page
			.waitForSelector('.swal2-icon.swal2-error', {
				visible: true,
				timeout: 20_000,
			})
			.then(() => 'invalid_credentials' as const)
			.catch(() => 'timeout' as const),
	]);

	if (outcome === 'invalid_credentials') {
		throw new Error('Invalid credentials');
	}

	if (outcome === 'timeout') {
		fs.mkdirSync(DEBUG_DIR, { recursive: true });
		const shot = path.join(DEBUG_DIR, `login-timeout-${Date.now()}.png`);
		await page.screenshot({ path: shot, fullPage: true });
		throw new Error(
			`Login timed out after 20s. URL: ${page.url()} — Screenshot: ${shot}`,
		);
	}
}

/**
 * Launches a browser, logs in, and returns the ci_session cookie value.
 * Throws if login fails or the cookie is not found.
 */
export async function getCiSession(
	user: string,
	password: string,
): Promise<string> {
	let browser: Browser | null = null;
	try {
		browser = await launchBrowser();
		const page = await browser.newPage();
		await performLogin(page, user, password);

		const cookies = await page.cookies();
		const ciSession = cookies.find((c) => c.name === 'ci_session');

		if (!ciSession) {
			throw new Error('ci_session cookie not found after login.');
		}

		return ciSession.value;
	} finally {
		try {
			await Promise.race([
				browser?.close(),
				new Promise<void>((resolve) => setTimeout(resolve, 5_000)),
			]);
		} catch {
			// ignore close errors
		}
	}
}

async function main(): Promise<void> {
	const [, , user, password] = process.argv;

	if (!user || !password) {
		console.error(
			'Usage: bun request_imitator/get_cookies.ts <user> <password>',
		);
		process.exit(1);
	}

	const cookie = await getCiSession(user, password);
	console.log('ci_session:', cookie);
}

if (import.meta.main) {
	main();
}
