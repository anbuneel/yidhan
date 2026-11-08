import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { EncryptionProvider } from './contexts/EncryptionContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { isChunkLoadError, reloadForUpdatedApp } from './utils/updateRecovery'
import {
  activateWaitingUpdate,
  registerServiceWorker,
  removeLegacyRuntimeCaches,
} from './utils/serviceWorkerUpdates'
import { bufferUncaughtErrors, disableReporting, startMonitoring } from './utils/monitoring'

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
// its own chunk and is never loaded on shared-note routes (/s/*).
if (sentryDsn) {
  void startMonitoring({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    pathname: window.location.pathname,
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <EncryptionProvider>
        <App />
        <Toaster
          position="bottom-center"
          toastOptions={{
            duration: 4000,
            style: {
              background: 'var(--color-bg-secondary)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--glass-border)',
              fontFamily: 'var(--font-body)',
              borderRadius: '8px',
            },
            success: {
              iconTheme: {
                primary: 'var(--color-accent)',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: 'var(--color-destructive)',
                secondary: '#fff',
              },
              duration: 5000,
            },
          }}
        />
      </EncryptionProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
