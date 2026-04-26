/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />
/// <reference types="vite-plugin-pwa/info" />

interface ImportMetaEnv {
	readonly VITE_API_URL: string;
	readonly VITE_FRONT_URL: string;
	readonly VITE_SENTRY_DSN?: string;
	readonly VITE_LEGAJOX_ALLOWED_SLUGS?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
