import {
  createFileRoute,
  Outlet,
  redirect,
  useRouterState,
} from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
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
  const { location } = useRouterState();
  const controlsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
      }
    );
  }, [location.pathname]);


  return (
    <div className="flex h-screen w-screen overflow-hidden font-noto-sans antialiased">
      <Sidebar />

      <motion.div
        ref={controlsRef}
        initial={{ opacity: 1, x: 0 }}
        className="flex-1 overflow-y-auto bg-background text-foreground p-6"
      >
        <Outlet />
      </motion.div>
    </div>
  );
}
