import {
	createFileRoute,
	Outlet,
	redirect,
	useMatches,
} from '@tanstack/react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { useRef } from 'react';
import Sidebar from '@/components/sidebar/sidebar';
import { isAuthenticated } from '@/lib/auth';

export const Route = createFileRoute('/_private')({
	beforeLoad: () => {
		if (!isAuthenticated()) {
			throw redirect({
				to: '/login',
			});
		}
	},
	component: PrivateLayout,
});

function PrivateLayout() {
	const matches = useMatches();
	const currentMatch = matches[matches.length - 1];
	const hasMountedRef = useRef(false);

	return (
		<div className="flex h-screen w-screen overflow-hidden font-noto-sans antialiased">
			<Sidebar />

			<div className="flex-1 overflow-hidden relative bg-background text-foreground">
				<AnimatePresence mode="wait">
					<motion.div
						key={currentMatch?.id}
						initial={hasMountedRef.current ? { opacity: 0, x: 40 } : false}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: -40 }}
						transition={{
							duration: 0.35,
							ease: 'easeInOut',
						}}
						onAnimationComplete={() => {
							hasMountedRef.current = true;
						}}
						className="absolute inset-0 overflow-y-auto p-6"
					>
						<Outlet />
					</motion.div>
				</AnimatePresence>
			</div>
		</div>
	);
}
