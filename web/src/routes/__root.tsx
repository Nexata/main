import '../index.css';
import { createRootRoute, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import '../index.css';

const RootLayout = () => (
	<>
		<Outlet />
		<TanStackRouterDevtools />
	</>
);

export const Route = createRootRoute({ component: RootLayout });
