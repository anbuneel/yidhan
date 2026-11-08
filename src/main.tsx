import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Root } from './shells/Root'
import { appShellStarted } from './shells/appShellStarted'
import { isChunkLoadError, reloadForUpdatedApp } from './utils/updateRecovery'
import {
  activateWaitingUpdate,
  registerServiceWorker,
  removeLegacyRuntimeCaches,
} from './utils/serviceWorkerUpdates'
import { bufferUncaughtErrors, disableReporting, startMonitoring } from './utils/monitoring'
import { migrateLocalStorageKeys } from './utils/legacyStorageKeys'

// Sentry loads after `load` (item 61, step 2). Errors and unhandled rejections
// thrown before it initialises are queued here and sent once it has, through the
// same scrubbers. Installed before the service worker, the app and its render.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN
if (sentryDsn) {
  bufferUncaughtErrors()
} else {
  disableReporting()
}

// Handle chunk loading errors (happens when app is open during deployment)
// These errors occur outside React's error boundary, so we catch them globally
window.addEventListener('unhandledrejection', (event) => {
  if (isChunkLoadError(event.reason)) {
    // Prevent the error from being logged to console (it's expected)
    event.preventDefault()
    // Hand over to a waiting worker first, otherwise the reload is served the
    // same stale precache that just failed to produce the chunk.
    void activateWaitingUpdate().finally(() => {
      reloadForUpdatedApp()
    })
  }
})

// Register the service worker explicitly. vite-plugin-pwa's injected script
// only registers; it never surfaces an update, which is how clients ended up
// stranded on an old shell. The call returns at once; registration itself
// waits for the window `load` event (see serviceWorkerUpdates.ts).
void registerServiceWorker()
// Fonts used to be runtime-cached from Google; clear those caches on devices
// that still carry them.
void removeLegacyRuntimeCaches()

// Error monitoring, only with a DSN configured. Waits for `load`; Replay follows in
// its own chunk once the app shell has started, and is never loaded on shared-note
// routes (/s/*).
if (sentryDsn) {
  void startMonitoring({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    pathname: window.location.pathname,
    replayAfter: appShellStarted,
  })
}

// Before React renders, so a returning user's preferences survive the rebrand. It ran
// from App.tsx until App moved into the lazily loaded app shell (item 61, step 5).
// Guarded: where storage throws (site data blocked), the public shell must still
// render, and there is nothing to migrate.
try {
  migrateLocalStorageKeys()
} catch (error) {
  console.warn('Could not migrate stored preferences:', error)
}

// The landing page and the public pages render from a small public shell; the app
// shell, with Supabase and everything signed-in, loads only when this visit needs it
// (src/appGate.ts, item 61, step 5).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </StrictMode>,
)
