import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * ReloadPrompt - Shows a subtle prompt when a new app version is available
 *
 * Instead of auto-reloading (which disrupts users mid-task), this shows
 * a non-intrusive banner that lets users choose when to update.
 *
 * Aligns with Yidhan's calm, non-disruptive philosophy.
 */
export function ReloadPrompt() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | undefined>(undefined);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(reg: ServiceWorkerRegistration | undefined) {
      // Store registration in state to trigger useEffect
      setRegistration(reg);
    },
    onRegisterError(error: Error) {
      console.error('SW registration error:', error);
    },
  });

  // Check for updates periodically (every 4 hours)
  // Using useEffect ensures proper cleanup on unmount/remount (StrictMode safe)
  useEffect(() => {
    if (!registration) return;

    const intervalId = setInterval(() => {
      registration.update();
    }, 4 * 60 * 60 * 1000); // 4 hours

    return () => clearInterval(intervalId);
  }, [registration]);

  const handleUpdate = () => {
    updateServiceWorker(true);
  };

  const handleDismiss = () => {
    setNeedRefresh(false);
  };

  if (!needRefresh) return null;

  return (
    <div
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-fade-in"
      role="alert"
      aria-live="polite"
    >
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg"
        style={{
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--glass-border)',
          fontFamily: 'var(--font-body)',
        }}
      >
        {/* Subtle refresh icon */}
        <svg
          className="w-5 h-5 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          style={{ color: 'var(--color-accent)' }}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>

        <span
          className="text-sm"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          A new version is available
        </span>

        <button
          onClick={handleUpdate}
          className="px-3 py-1.5 text-sm font-medium rounded transition-colors duration-200"
          style={{
            background: 'var(--color-cta-bg)',
            color: 'var(--color-cta-text)',
          }}
        >
          Refresh
        </button>

        <button
          onClick={handleDismiss}
          className="p-1 rounded transition-opacity duration-200 hover:opacity-70"
          style={{ color: 'var(--color-text-tertiary)' }}
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
