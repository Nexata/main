import * as Sentry from '@sentry/react';
import { createRootRoute, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import {
	'error_boundary.description' as error_boundary_description,
	'error_boundary.reload' as error_boundary_reload,
	'error_boundary.title' as error_boundary_title,
} from '@/paraglide/messages.js';
import '../index.css';

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
					onClick={() => window.location.reload()}
				>
					{error_boundary_reload()}
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
