import { Logger } from 'elysia-logger';

export const _log = new Logger({
	context: 'Nexata',
	autoLogging: false,
	level: 'trace',
});

export const log = (
	lvl: 'error' | 'warn' | 'log' | 'debug' | 'verbose',
	x: unknown,
) => _log[lvl](typeof x === 'string' ? x : JSON.stringify(x, null, 2));

export const requireEnv = (key: string): string =>
	process.env[key] ||
	(() => {
		throw new Error(`${key} is not defined`);
	})();

export function warnEnv(key: string): string | undefined;
export function warnEnv(key: string, fb: string): string;
export function warnEnv(key: string, fb?: string): string | undefined {
	const value = process.env[key];
	if (!value) log('warn', `${key} is not defined`);
	return value ?? fb;
}
