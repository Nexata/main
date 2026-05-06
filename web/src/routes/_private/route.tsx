import {
	createFileRoute,
	Outlet,
	redirect,
	useRouterState,
} from '@tanstack/react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { IoMenu } from 'react-icons/io5';
import Sidebar from '@/components/sidebar/sidebar';
import { TenantLogo } from '@/components/tenant-logo/tenant-logo';
import ToolDetailPanel, {
	MobileToolDetailPanel,
} from '@/components/tool-detail-panel/tool-detail-panel';
import { WalkthroughProvider } from '@/components/walkthrough/walkthrough-provider';
import { useIsMobile } from '@/hooks/use-mobile';
import { isAuthenticated } from '@/lib/auth';
import { useMobileSidebarStore } from '@/lib/mobile-sidebar.store';
import { useSidebarStore } from '@/lib/sidebar.store';
import { useToolDetailStore } from '@/lib/tool-detail.store';
import { useMe, useMyTenant } from '@/lib/user';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_private')({
	beforeLoad: () => {
		const isPublicSharedChat =
			window.location.pathname === '/chat' &&
			new URLSearchParams(window.location.search).has('id');

		if (!isAuthenticated() && !isPublicSharedChat) {
			throw redirect({
				to: '/login',
			});
		}
	},
	component: PrivateLayout,
});

function PrivateLayout() {
	const { location } = useRouterState();
	const isPublicSharedChat =
		!isAuthenticated() &&
		location.pathname === '/chat' &&
		new URLSearchParams(window.location.search).has('id');
	const shouldLoadSessionData =
		!isPublicSharedChat && location.pathname !== '/credential-callback';
	const controlsRef = useRef<HTMLDivElement>(null);
	const isMobile = useIsMobile();
	const isChatRoute = location.pathname === '/chat';
	const {
		isOpen: isMobileSidebarOpen,
		close: closeMobileSidebar,
		toggle: toggleMobileSidebar,
	} = useMobileSidebarStore();
	const { data: myTenant, isLoading: tenantLoading } = useMyTenant(
		shouldLoadSessionData,
	);
	const { data: me } = useMe(shouldLoadSessionData);

	// CTRL+B / CMD+B to toggle sidebar (desktop only)
	useEffect(() => {
		if (isPublicSharedChat) return;
		const onKeyDown = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
				e.preventDefault();
				if (isMobile) {
					toggleMobileSidebar();
				} else {
					useSidebarStore.getState().toggle();
				}
			}
		};
		document.addEventListener('keydown', onKeyDown);
		return () => document.removeEventListener('keydown', onKeyDown);
	}, [isMobile, toggleMobileSidebar, isPublicSharedChat]);

	// Close mobile sidebar on route change
	useEffect(() => {
		if (isPublicSharedChat) return;
		closeMobileSidebar();
	}, [closeMobileSidebar, isPublicSharedChat]);

	// Close tool detail panel when leaving /chat
	useEffect(() => {
		const isOnChat =
			location.pathname === '/chat' || location.pathname.startsWith('/chat/');
		if (!isOnChat) {
			useToolDetailStore.getState().close();
		}
	}, [location.pathname]);

	useEffect(() => {
		if (isPublicSharedChat) return;
		controlsRef.current?.animate(
			[
				{
					opacity: 0,
					transform: 'translateY(6px)',
				},
				{
					opacity: 1,
					transform: 'translateY(0px)',
				},
			],
			{
				duration: 500,
				easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
				fill: 'both',
			},
		);
	}, [isPublicSharedChat]);

	if (isPublicSharedChat) {
		return (
			<div className="flex h-dvh w-screen overflow-hidden bg-background text-foreground font-noto-sans antialiased">
				<div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
					<Outlet />
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-dvh w-screen overflow-hidden font-noto-sans antialiased">
			{/* Desktop sidebar */}
			{!isMobile && <Sidebar />}

			{/* Mobile sidebar overlay */}
			{isMobile && (
				<AnimatePresence>
					{isMobileSidebarOpen && (
						<>
							{/* Backdrop */}
							<motion.div
								key="mobile-sidebar-backdrop"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.2 }}
								className="fixed inset-0 z-40 bg-black/50"
								onClick={closeMobileSidebar}
							/>

							{/* Sidebar drawer */}
							<motion.div
								key="mobile-sidebar-drawer"
								initial={{ x: '-100%' }}
								animate={{ x: 0 }}
								exit={{ x: '-100%' }}
								transition={{ type: 'spring', stiffness: 300, damping: 30 }}
								className="fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw]"
							>
								<Sidebar isMobileOverlay onClose={closeMobileSidebar} />
							</motion.div>
						</>
					)}
				</AnimatePresence>
			)}

			<div className="flex flex-1 flex-col overflow-hidden">
				{/* Mobile top bar */}
				{isMobile && (
					<div
						className="flex items-center justify-between border-b border-border bg-sidebar px-4 py-3"
						style={{
							paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))',
						}}
					>
						{/* Izquierda: botón menú */}
						<button
							onClick={toggleMobileSidebar}
							className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted transition-colors"
						>
							<IoMenu className="h-5 w-5" />
						</button>

						{/* Derecha: logos */}
						<div className="flex items-center gap-3">
							<img
								src="/nexata_logo.png"
								alt="Nexata"
								className="h-6 w-auto object-contain"
							/>
							{myTenant?.logoUrl && (
								<>
									<div className="h-6 w-px bg-border" />
									<TenantLogo
										loading={tenantLoading}
										logoUrl={myTenant.logoUrl}
										displayName={myTenant.displayName}
									/>
								</>
							)}
						</div>
					</div>
				)}

				<motion.div
					ref={controlsRef}
					initial={{ opacity: 1, x: 0 }}
					className={cn(
						'flex-1 overflow-y-auto bg-background text-foreground',
						isMobile && isChatRoute ? 'p-0' : 'p-3 sm:p-4 md:p-6',
					)}
				>
					<Outlet />
				</motion.div>
			</div>

			{/* Tool detail panel */}
			{!isMobile && <ToolDetailPanel />}
			{isMobile && <MobileToolDetailPanel />}

			{/* Walkthrough tour — only on desktop, runs once */}
			{!isMobile && (
				<WalkthroughProvider
					isAdmin={me?.isAdmin ?? false}
					isReady={!!me && !tenantLoading}
				/>
			)}
		</div>
	);
}
