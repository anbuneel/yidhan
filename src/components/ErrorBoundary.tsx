import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { captureException } from '../utils/monitoring';
import { reloadWithPreservedShareContext } from '../utils/shareRoute';
import { isChunkLoadError, reloadForUpdatedApp } from '../utils/updateRecovery';

interface Props {
  children: ReactNode;
  onReload?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isChunkError: boolean;
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
    if (isChunkLoadError(error)) {
      reloadForUpdatedApp({ reload: this.props.onReload });
      return;
    }

    captureException(error, {
      extra: {
        componentStack: errorInfo.componentStack,
      },
    });
  }

  handleReload = (): void => {
    if (this.props.onReload) {
      this.props.onReload();
      return;
    }

    reloadWithPreservedShareContext();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const { isChunkError } = this.state;

      return (
        <div
          className="min-h-screen flex items-center justify-center px-4"
          style={{ background: 'var(--color-bg-primary, #151C18)' }}
        >
          <div
            className="w-full max-w-md p-8 text-center"
            style={{
              background: 'var(--color-bg-secondary, #18211C)',
              borderRadius: 'var(--radius-plain)',
              border: '1px solid var(--glass-border, #33423A)',
            }}
          >
            {/* Decorative icon */}
            <div
              className="size-12 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{
                background: isChunkError
                  ? 'var(--color-accent-glow, rgba(143, 199, 154, 0.14))'
                  : 'var(--color-error-light, #3A2421)',
              }}
            >
              {isChunkError ? (
                // Refresh/update icon for chunk errors
                <svg
                  className="size-6"
                  fill="none"
                  stroke="var(--color-accent, #8FC79A)"
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
                  className="size-6"
                  fill="none"
                  stroke="var(--color-error, #F09A8F)"
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
                color: 'var(--color-text-primary, #E6E3DC)',
              }}
            >
              {isChunkError ? "Couldn't finish loading" : 'Something went wrong'}
            </h1>
            <p
              className="mb-6"
              style={{
                fontFamily: 'var(--font-body, Inter, sans-serif)',
                color: 'var(--color-text-secondary, #B9BFB8)',
                fontSize: '0.95rem',
                lineHeight: 1.6,
              }}
            >
              {isChunkError
                ? 'Refresh the page to recover this session.'
                : "We're sorry, but something unexpected happened. Please try refreshing the page."}
            </p>

            {/* Only show error details for non-chunk errors */}
            {this.state.error && !isChunkError && (
              <details
                className="mb-6 text-left"
                style={{
                  background: 'var(--color-bg-tertiary, #1F2C25)',
                  borderRadius: '8px',
                  padding: '12px',
                }}
              >
                <summary
                  className="cursor-pointer text-sm mb-2"
                  style={{
                    fontFamily: 'var(--font-body, Inter, sans-serif)',
                    color: 'var(--color-text-secondary, #B9BFB8)',
                  }}
                >
                  Error details
                </summary>
                <pre
                  className="text-xs overflow-auto"
                  style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    color: 'var(--color-destructive, #E8877C)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {this.state.error.message}
                </pre>
              </details>
            )}

            <button type="button"
              onClick={this.handleReload}
              className="px-6 py-3 rounded-lg font-medium transition-all duration-200"
              style={{
                fontFamily: 'var(--font-body, Inter, sans-serif)',
                background: 'var(--color-cta-bg, #8FC79A)',
                color: 'var(--color-cta-text, #13201A)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-cta-bg-hover, #A0D2A6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--color-cta-bg, #8FC79A)';
              }}
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
