import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_public')({
	component: PublicLayout,
});

function PublicLayout() {
	return (
	  <div className="min-h-dvh w-full bg-background text-foreground">
			<Outlet />
		</div>
	);
}
