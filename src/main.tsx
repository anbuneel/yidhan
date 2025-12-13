import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './contexts/AuthContext'
import { ErrorBoundary } from './components/ErrorBoundary'

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
                primary: '#DC2626',
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
