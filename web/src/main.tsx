import { createRouter, RouterProvider } from '@tanstack/react-router';
import { StrictMode, useEffect, useState } from 'react'; 
import type { ReactNode } from 'react'; 
import ReactDOM from 'react-dom/client';
import { routeTree } from './routeTree.gen';
import { ThemeProvider } from './components/theme-provider';
import { Toaster } from './components/ui/toaster';

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

function AppLayout({ children }: { children: (darkMode: boolean, setDarkMode: (val: boolean) => void) => ReactNode }) {
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <div className="min-h-screen antialiased font-noto-sans">
      {children(darkMode, setDarkMode)}
      <Toaster />
    </div>
  );
}

// biome-ignore lint/style/noNonNullAssertion: react root
const rootElement = document.getElementById('root')!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
root.render(
  <StrictMode>
      <ThemeProvider defaultTheme="dark">
        <AppLayout>
          {(darkMode, setDarkMode) => (
            <RouterProvider router={router} context={{ darkMode, setDarkMode }} />
          )}
        </AppLayout>
      </ThemeProvider>
  </StrictMode>
);
}
