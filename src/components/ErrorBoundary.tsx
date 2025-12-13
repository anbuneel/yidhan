import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import * as Sentry from '@sentry/react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    // Report to Sentry with component stack trace
    Sentry.captureException(error, {
      extra: {
        componentStack: errorInfo.componentStack,
      },
    });
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
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
            <h1
              className="text-2xl font-semibold mb-4"
              style={{
                fontFamily: 'var(--font-display, Georgia, serif)',
                color: 'var(--color-text-primary, #f5f5f0)',
              }}
            >
              Something went wrong
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
              We're sorry, but something unexpected happened. Please try refreshing the page.
            </p>
            {this.state.error && (
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
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
