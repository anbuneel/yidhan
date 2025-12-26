import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import * as Sentry from '@sentry/react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isChunkError: boolean;
}

/**
 * Detect if an error is a chunk/module loading failure
 * This happens when the app is open and a new deployment occurs
 */
function isChunkLoadError(error: Error): boolean {
  const message = error.message || '';
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Loading chunk') ||
    message.includes('Loading CSS chunk') ||
    message.includes("Importing a module script failed")
  );
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, isChunkError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      isChunkError: isChunkLoadError(error),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Don't report chunk loading errors to Sentry - they're expected during deployments
    if (!isChunkLoadError(error)) {
      Sentry.captureException(error, {
        extra: {
          componentStack: errorInfo.componentStack,
        },
      });
    }
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const { isChunkError } = this.state;

      return (
        <div
          className="min-h-screen flex items-center justify-center px-4"
          style={{ background: 'var(--color-bg-primary, #1a1f1a)' }}
        >
          <div
            className="w-full max-w-md p-8 text-center"
            style={{
              background: 'var(--color-bg-secondary, #232823)',
              borderRadius: '2px 24px 4px 24px',
              border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.08))',
            }}
          >
            {/* Decorative icon */}
            <div
              className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{
                background: isChunkError
                  ? 'var(--color-accent-glow, rgba(212, 175, 55, 0.15))'
                  : 'rgba(220, 38, 38, 0.1)',
              }}
            >
              {isChunkError ? (
                // Refresh/update icon for chunk errors
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="var(--color-accent, #D4AF37)"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              ) : (
                // Warning icon for other errors
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="#DC2626"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              )}
            </div>

            <h1
              className="text-2xl font-semibold mb-4"
              style={{
                fontFamily: 'var(--font-display, Georgia, serif)',
                color: 'var(--color-text-primary, #f5f5f0)',
              }}
            >
              {isChunkError ? 'New version available' : 'Something went wrong'}
            </h1>
            <p
              className="mb-6"
              style={{
                fontFamily: 'var(--font-body, Inter, sans-serif)',
                color: 'var(--color-text-secondary, rgba(245, 245, 240, 0.7))',
                fontSize: '0.95rem',
                lineHeight: 1.6,
              }}
            >
              {isChunkError
                ? 'Zenote has been updated since you last loaded the page. Please refresh to get the latest version.'
                : "We're sorry, but something unexpected happened. Please try refreshing the page."}
            </p>

            {/* Only show error details for non-chunk errors */}
            {this.state.error && !isChunkError && (
              <details
                className="mb-6 text-left"
                style={{
                  background: 'var(--color-bg-tertiary, #1a1f1a)',
                  borderRadius: '8px',
                  padding: '12px',
                }}
              >
                <summary
                  className="cursor-pointer text-sm mb-2"
                  style={{
                    fontFamily: 'var(--font-body, Inter, sans-serif)',
                    color: 'var(--color-text-secondary, rgba(245, 245, 240, 0.7))',
                  }}
                >
                  Error details
                </summary>
                <pre
                  className="text-xs overflow-auto"
                  style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    color: 'var(--color-destructive, #DC2626)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {this.state.error.message}
                </pre>
              </details>
            )}

            <button
              onClick={this.handleReload}
              className="px-6 py-3 rounded-lg font-medium transition-all duration-200"
              style={{
                fontFamily: 'var(--font-body, Inter, sans-serif)',
                background: 'var(--color-accent, #D4AF37)',
                color: '#fff',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-accent-hover, #C9A42E)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--color-accent, #D4AF37)';
              }}
            >
              {isChunkError ? 'Refresh to Update' : 'Refresh Page'}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
