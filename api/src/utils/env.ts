export const requireEnv = (key: string): string =>
	process.env[key] ||
	(() => {
		throw new Error(`${key} is not defined`);
	})();

export const warnEnv = (key: string): string => {
	const value = process.env[key];
	if (!value) console.warn(`${key} is not defined`);
	return value ?? '';
};
