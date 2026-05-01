import puppeteer from 'puppeteer';

function getLaunchArgs(): string[] {
	const args: string[] = [];

	if (process.env.PUPPETEER_DISABLE_DEV_SHM_USAGE !== 'false') {
		args.push('--disable-dev-shm-usage');
	}

	if (process.env.PUPPETEER_NO_SANDBOX === 'true') {
		args.push('--no-sandbox', '--disable-setuid-sandbox');
	}

	return args;
}

export async function launchBrowser(signal?: AbortSignal) {
	if (signal?.aborted) {
		throw new Error('Scrape aborted');
	}

	const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
	const args = getLaunchArgs();
	const browser = await puppeteer.launch({
		headless: process.env.DEBUG_HEADLESS !== 'false',
		...(args.length > 0 ? { args } : {}),
		...(executablePath ? { executablePath } : { channel: 'chrome' as const }),
	});

	if (signal) {
		const closeOnAbort = () => {
			void browser.close().catch(() => {});
		};

		signal.addEventListener('abort', closeOnAbort, { once: true });
		browser.once('disconnected', () => {
			signal.removeEventListener('abort', closeOnAbort);
		});
	}

	return browser;
}
