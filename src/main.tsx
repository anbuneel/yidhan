import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './contexts/AuthContext'
import { EncryptionProvider } from './contexts/EncryptionContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { isChunkLoadError, reloadForUpdatedApp } from './utils/updateRecovery'

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
        delete event.extra.title
        delete event.extra.content
        delete event.extra.noteTitle
        delete event.extra.noteContent
      }
      // Strip URL fragments (may contain share decryption keys)
      // Also scrub /s/<token> path segments — token is a capability credential
      const scrubSharePath = (url: string) =>
        url.replace(/#.*$/, '').replace(/\/s\/[A-Za-z0-9_-]{16,}(\/[^?#]*)?/, '/s/[REDACTED]')
      if (event.request?.url) {
        event.request.url = scrubSharePath(event.request.url)
      }
      // Strip fragments and share tokens from stack frame filenames (defense in depth)
      if (event.exception?.values) {
        event.exception.values.forEach(ex => {
          ex.stacktrace?.frames?.forEach(frame => {
            if (frame.filename) frame.filename = scrubSharePath(frame.filename)
            if (frame.abs_path) frame.abs_path = scrubSharePath(frame.abs_path)
          })
        })
      }
      // Scrub breadcrumb data that might contain note content or share URLs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map(bc => {
          if (bc.data) {
            delete bc.data.title
            delete bc.data.content
            delete bc.data.noteTitle
            delete bc.data.noteContent
            // Strip share tokens and URL fragments from navigation breadcrumbs
            if (typeof bc.data.url === 'string') bc.data.url = scrubSharePath(bc.data.url)
            if (typeof bc.data.from === 'string') bc.data.from = scrubSharePath(bc.data.from)
            if (typeof bc.data.to === 'string') bc.data.to = scrubSharePath(bc.data.to)
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
