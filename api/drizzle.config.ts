import { type Config, defineConfig } from 'drizzle-kit';

export default defineConfig({
	verbose: true,
	dialect: 'postgresql',
	schema: './src/schema/index.ts',
	out: './migrations',
	casing: 'snake_case',

	migrations: {
		prefix: 'timestamp',
		table: '__migrations',
		schema: 'public',
	},

	breakpoints: false,
	strict: true,

	dbCredentials: {
		url:
			(process.env.ENV === 'production'
				? process.env.PROD_DATABASE_URL
				: process.env.DATABASE_URL) ?? '',
	},
}) satisfies Config;
