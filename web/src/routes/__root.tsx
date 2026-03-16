import * as Sentry from '@sentry/react';
import { createRootRoute, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import '../index.css';

function ErrorFallback() {
	return (
		<div className="flex min-h-dvh items-center justify-center">
			<div className="text-center">
				<h1 className="text-2xl font-bold">Algo salió mal</h1>
				<p className="mt-2 text-muted-foreground">
					Ocurrió un error inesperado. Por favor, recarga la página.
				</p>
				<button
					className="mt-4 rounded bg-primary px-4 py-2 text-primary-foreground"
					onClick={() => window.location.reload()}
				>
					Recargar
				</button>
			</div>
		</div>
	);
}

const RootLayout = () => (
	<Sentry.ErrorBoundary fallback={ErrorFallback}>
		<Outlet />
		<TanStackRouterDevtools />
	</Sentry.ErrorBoundary>
);

export const Route = createRootRoute({ component: RootLayout });
