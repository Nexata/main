import { useRegisterSW } from "virtual:pwa-register/react";
import { RefreshCw, X } from "lucide-react";
import {
  "pwa.offline_ready" as pwa_offline_ready,
  "pwa.new_version" as pwa_new_version,
  "pwa.reload_hint" as pwa_reload_hint,
  "pwa.reload" as pwa_reload,
} from "@/paraglide/messages.js";

const INTERVAL_MS = 60 * 60 * 1000; // check for updates every hour

export default function PwaReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        setInterval(() => registration.update(), INTERVAL_MS);
      }
    },
    onRegisterError(error) {
      console.error("SW registration error:", error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 z-200 max-w-sm">
      <div className="flex items-start gap-3 rounded-xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur-md">
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium text-foreground">
            {offlineReady
              ? pwa_offline_ready()
              : pwa_new_version()}
          </p>
          {needRefresh && (
            <p className="text-xs text-muted-foreground">
              {pwa_reload_hint()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {needRefresh && (
            <button
              type="button"
              onClick={() => updateServiceWorker(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <RefreshCw className="h-3 w-3" />
              {pwa_reload()}
            </button>
          )}
          <button
            type="button"
            onClick={close}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
