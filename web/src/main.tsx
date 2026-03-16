import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { StrictMode, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { initSentry } from '@/lib/sentry';

initSentry();

import PwaReloadPrompt from './components/pwa-reload-prompt/pwa-reload-prompt';
import { ThemeProvider } from './components/theme-provider';
import { Toaster } from './components/ui/toaster';
import { routeTree } from './routeTree.gen';

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
	interface Register {
		router: typeof router;
	}
}

function AppLayout({
	children,
}: {
	children: (
		darkMode: boolean,
		setDarkMode: (val: boolean) => void,
	) => ReactNode;
}) {
	const [darkMode, setDarkMode] = useState(true);

	useEffect(() => {
		if (darkMode) {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
	}, [darkMode]);

	return (
		<div className="min-h-dvh antialiased font-noto-sans">
			{children(darkMode, setDarkMode)}
			<Toaster />
			<PwaReloadPrompt />
		</div>
	);
}

const rootElement = document.getElementById('root')!;
if (!rootElement.innerHTML) {
	const root = ReactDOM.createRoot(rootElement);
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: 1,
				refetchOnWindowFocus: false,
			},
		},
	});

	root.render(
		<StrictMode>
			<QueryClientProvider client={queryClient}>
				<ThemeProvider defaultTheme="dark">
					<AppLayout>
						{(darkMode, setDarkMode) => (
							<RouterProvider
								router={router}
								context={{ darkMode, setDarkMode }}
							/>
						)}
					</AppLayout>
				</ThemeProvider>
			</QueryClientProvider>
		</StrictMode>,
	);
}
