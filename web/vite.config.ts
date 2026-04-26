import path from 'node:path';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
	build: {
		sourcemap: true,
	},
	plugins: [
		tanstackRouter({ target: 'react', autoCodeSplitting: true }),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/paraglide',
		}),
		react(),
		tailwindcss(),
		VitePWA({
			registerType: 'prompt',
			includeAssets: ['icon.ico', 'pwa/apple-touch-icon-180x180.png'],
			manifest: {
				name: 'Nexata',
				short_name: 'Nexata',
				description: 'Nexata — AI-powered business assistant',
				theme_color: '#171926',
				background_color: '#171926',
				display: 'standalone',
				orientation: 'portrait',
				scope: '/',
				start_url: '/',
				icons: [
					{
						src: 'pwa/pwa-64x64.png',
						sizes: '64x64',
						type: 'image/png',
					},
					{
						src: 'pwa/pwa-192x192.png',
						sizes: '192x192',
						type: 'image/png',
					},
					{
						src: 'pwa/pwa-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'any',
					},
					{
						src: 'pwa/maskable-icon-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable',
					},
				],
			},
			workbox: {
				maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
				globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
				navigateFallback: 'index.html',
				navigateFallbackDenylist: [/^\/robots\.txt$/, /^\/sitemap\.xml$/],
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/.*\/api\/.*/i,
						handler: 'NetworkFirst',
						options: {
							cacheName: 'api-cache',
							expiration: {
								maxEntries: 50,
								maxAgeSeconds: 60 * 60 * 24, // 1 day
							},
							cacheableResponse: {
								statuses: [0, 200],
							},
						},
					},
				],
			},
			devOptions: {
				enabled: false,
			},
		}),
		sentryVitePlugin({
			org: process.env.SENTRY_ORG,
			project: process.env.SENTRY_PROJECT,
			authToken: process.env.SENTRY_AUTH_TOKEN,
			sourcemaps: {
				filesToDeleteAfterUpload: ['./dist/**/*.map'],
			},
			disable: !process.env.SENTRY_AUTH_TOKEN,
		}),
	],
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
			'@api': path.resolve(__dirname, '../api/src'),
		},
	},
	optimizeDeps: {
		exclude: ['drizzle-orm', 'remark-math', 'rehype-katex'],
	},
});
