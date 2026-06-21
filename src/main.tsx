import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { EncryptionProvider } from './contexts/EncryptionContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { isChunkLoadError, reloadForUpdatedApp } from './utils/updateRecovery'
import { scrubSensitiveData, scrubShareSecrets } from './utils/sentryScrubber'

// Handle chunk loading errors (happens when app is open during deployment)
// These errors occur outside React's error boundary, so we catch them globally
window.addEventListener('unhandledrejection', (event) => {
  if (isChunkLoadError(event.reason)) {
    // Prevent the error from being logged to console (it's expected)
    event.preventDefault()
    reloadForUpdatedApp()
  }
})

// Initialize Sentry for error monitoring (only in production with DSN configured)
const sentryDsn = import.meta.env.VITE_SENTRY_DSN
const isSharedRoute = window.location.pathname.startsWith('/s/')
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      // Disable session replay entirely on shared note routes to prevent
      // capturing decrypted content (title, tags, note body) in replays
      ...(!isSharedRoute ? [Sentry.replayIntegration({
        // Mask note content in session replays for privacy
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: false,
        // Block sensitive content selectors (decrypted note titles, previews, editor)
        block: ['.rich-text-editor', '.ProseMirror', '[data-sensitive]', '.note-card'],
      })] : []),
    ],
    // Performance monitoring sample rate (10% of transactions)
    tracesSampleRate: 0.1,
    // Session replay sample rate (10% of sessions, 100% on error)
    // Disabled on shared routes (replay integration not loaded)
    replaysSessionSampleRate: isSharedRoute ? 0 : 0.1,
    replaysOnErrorSampleRate: isSharedRoute ? 0 : 1.0,
    // E2EE: Strip note title/content and URL fragments from error reports
    beforeSend(event) {
      if (event.extra) {
        event.extra = scrubSensitiveData(event.extra) as Record<string, unknown>
      }
      if (event.contexts) {
        event.contexts = scrubSensitiveData(event.contexts) as typeof event.contexts
      }
      // Strip URL fragments (may contain share decryption keys)
      // Also scrub /s/<token> path segments — token is a capability credential
      if (event.request?.url) {
        event.request.url = scrubShareSecrets(event.request.url)
      }
      // Strip fragments and share tokens from stack frame filenames (defense in depth)
      if (event.exception?.values) {
        event.exception.values.forEach(ex => {
          if (ex.value) ex.value = scrubShareSecrets(ex.value)
          ex.stacktrace?.frames?.forEach(frame => {
            if (frame.filename) frame.filename = scrubShareSecrets(frame.filename)
            if (frame.abs_path) frame.abs_path = scrubShareSecrets(frame.abs_path)
          })
        })
      }
      // Scrub breadcrumb data that might contain note content or share URLs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map(bc => {
          if (bc.message) bc.message = scrubShareSecrets(bc.message)
          if (bc.data) {
            bc.data = scrubSensitiveData(bc.data) as Record<string, unknown>
          }
          return bc
        })
      }
      return event
    },
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
