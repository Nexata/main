import { Outlet, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_public')({
	component: PublicLayout,
});

function PublicLayout() {
	return (
		<div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground">
			<Outlet />
		</div>
	);
}
