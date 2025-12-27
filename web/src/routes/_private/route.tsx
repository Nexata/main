import { useState, type ReactNode } from "react";
import { Outlet, createFileRoute } from "@tanstack/react-router";
import Sidebar from "@/components/sidebar/sidebar";

export const Route = createFileRoute("/_private")({
  component: PrivateLayout,
});

function PrivateLayout({ children }: { children?: ReactNode }) {
  const [darkMode, setDarkMode] = useState(true);
  const [activeView, setActiveView] = useState<"settings" | "user">("user");

  return (
    <div className="flex h-screen w-screen overflow-hidden font-noto-sans antialiased">
        <Sidebar darkMode={darkMode} setDarkMode={setDarkMode} setActiveView={setActiveView} />
        <main className="flex-1 overflow-auto p-6 bg-[var(--background)] text-[var(--foreground)]">
            {children ?? <Outlet />}
        </main>
    </div>
  );
}
