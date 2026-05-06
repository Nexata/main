import * as Sentry from '@sentry/react';
import { createRootRoute, HeadContent, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { API_BASE_URL } from '@/api';
import { getAccessToken } from '@/lib/auth';
import { getFingerprint } from '@/lib/fingerprint';
import {
	'error_boundary.description' as error_boundary_description,
	'error_boundary.reload' as error_boundary_reload,
	'error_boundary.title' as error_boundary_title,
} from '@/paraglide/messages.js';
import '../index.css';

function clearPersistedStores() {
	const storeKeys = ['chat-ui-store', 'currency-store', 'sidebar-store'];
	for (const key of storeKeys) {
		localStorage.removeItem(key);
	}
}

async function deleteBrokenThread() {
	const url = new URL(window.location.href);
	if (url.pathname !== '/chat') return;

	const threadId = url.searchParams.get('id');
	if (!threadId) return;

	const token = getAccessToken();
	if (!token) return;

	try {
		const fingerprint = await getFingerprint();
		await fetch(`${API_BASE_URL}/chat/thread/${encodeURIComponent(threadId)}`, {
			method: 'DELETE',
			headers: {
				authorization: `Bearer ${token}`,
				fingerprint,
			},
		});
	} catch {
		// Best-effort: if delete fails, we still redirect away from the broken thread
	}
}

async function handleReload() {
	clearPersistedStores();
	await deleteBrokenThread();

	const url = new URL(window.location.href);
	if (url.pathname === '/chat' && url.searchParams.has('id')) {
		window.location.href = '/chat';
	} else {
		window.location.reload();
	}
}

function ErrorFallback() {
	return (
		<div className="flex min-h-dvh items-center justify-center">
			<div className="text-center">
				<h1 className="text-2xl font-bold">{error_boundary_title()}</h1>
				<p className="mt-2 text-muted-foreground">
					{error_boundary_description()}
				</p>
				<button
					className="mt-4 rounded bg-primary px-4 py-2 text-primary-foreground"
					onClick={handleReload}
				>
					{error_boundary_reload()}
				</button>
			</div>
		</div>
	);
}

const RootLayout = () => (
	<Sentry.ErrorBoundary fallback={ErrorFallback}>
		<HeadContent />
		<Outlet />
		<TanStackRouterDevtools />
	</Sentry.ErrorBoundary>
);

export const Route = createRootRoute({
	component: RootLayout,
	head: () => ({
		meta: [
			{ title: 'Nexata — Asistente de negocios con IA' },
			{
				name: 'description',
				content:
					'Nexata es un asistente empresarial potenciado por inteligencia artificial. Conecta tus herramientas, centraliza tu informacion y obtiene respuestas al instante.',
			},
			{ property: 'og:site_name', content: 'Nexata' },
			{ property: 'og:type', content: 'website' },
			{ property: 'og:image', content: 'https://nexata.app/og-image.png' },
			{ property: 'og:image:width', content: '1200' },
			{ property: 'og:image:height', content: '630' },
			{ property: 'og:locale', content: 'es_ES' },
			{ name: 'twitter:card', content: 'summary_large_image' },
			{ name: 'twitter:image', content: 'https://nexata.app/og-image.png' },
		],
	}),
});
