import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './contexts/AuthContext'
import { ErrorBoundary } from './components/ErrorBoundary'

// Handle chunk loading errors (happens when app is open during deployment)
// These errors occur outside React's error boundary, so we catch them globally
window.addEventListener('unhandledrejection', (event) => {
  const message = event.reason?.message || String(event.reason)
  const isChunkError =
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Loading chunk') ||
    message.includes('Loading CSS chunk') ||
    message.includes('Importing a module script failed')

  if (isChunkError) {
    // Prevent the error from being logged to console (it's expected)
    event.preventDefault()
    // Reload to get the new version
    window.location.reload()
  }
})

// Initialize Sentry for error monitoring (only in production with DSN configured)
const sentryDsn = import.meta.env.VITE_SENTRY_DSN
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    // Performance monitoring sample rate (10% of transactions)
    tracesSampleRate: 0.1,
    // Session replay sample rate (10% of sessions, 100% on error)
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
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
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
