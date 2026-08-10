import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X, WifiOff } from 'lucide-react';

// Surfaces the two states vite-plugin-pwa's Workbox service worker can reach:
// (1) offlineReady — first successful install, app shell is now cached and the
//     app will keep working with no network. Shown once, auto-dismissible.
// (2) needRefresh — a new deploy's service worker is waiting. Deliberately NOT
//     auto-applied (registerType: 'prompt' in vite.config.js) — swapping the
//     app's JS/CSS out from under a live session mid-use could desync a
//     long-lived tab from its already-hydrated Zustand stores. The user reloads
//     on their own terms, same philosophy as lazyRetry's stale-chunk recovery.
export default function PwaUpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(url, reg) {
      // Check for a new build once an hour while the tab stays open — the
      // default only checks on hard navigation, which a SPA rarely does.
      if (reg) setInterval(() => reg.update(), 60 * 60 * 1000);
    },
  });

  if (!offlineReady && !needRefresh) return null;

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] bg-card border border-line rounded-xl shadow-xl px-4 py-3 flex items-center gap-3 text-sm max-w-sm">
      {needRefresh ? (
        <>
          <RefreshCw size={16} className="text-accent shrink-0" />
          <span className="flex-1">Nouvelle version disponible.</span>
          <button
            onClick={() => updateServiceWorker(true)}
            className="text-accent font-medium hover:underline cursor-pointer shrink-0"
          >
            Rafraîchir
          </button>
        </>
      ) : (
        <>
          <WifiOff size={16} className="text-good shrink-0" />
          <span className="flex-1">AUDAX fonctionne maintenant hors ligne.</span>
        </>
      )}
      <button onClick={close} className="text-mute hover:text-ink shrink-0 cursor-pointer">
        <X size={14} />
      </button>
    </div>
  );
}
