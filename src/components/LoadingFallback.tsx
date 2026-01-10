/**
 * LoadingFallback Component
 *
 * Consistent loading UI for Suspense boundaries.
 * Uses theme CSS variables for consistent styling.
 */

interface LoadingFallbackProps {
  message?: string;
}

export function LoadingFallback({ message = 'Loading...' }: LoadingFallbackProps) {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--color-bg-primary)' }}
    >
      <div className="text-center">
        <div
          className="w-8 h-8 mx-auto mb-4 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }}
        />
        <p style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>
          {message}
        </p>
      </div>
    </div>
  );
}
