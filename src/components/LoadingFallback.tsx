/**
 * LoadingFallback Component
 *
 * Consistent loading UI for Suspense boundaries.
 * Uses theme CSS variables for consistent styling.
 */

import { useBootDelayElapsed } from '../hooks/useAppLoader';

interface LoadingFallbackProps {
  message?: string;
}

export function LoadingFallback({ message = 'Loading...' }: LoadingFallbackProps) {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--page-background)' }}
    >
      <div className="text-center">
        <div
          className="size-8 mx-auto mb-4 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }}
        />
        <p style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>
          {message}
        </p>
      </div>
    </div>
  );
}

/**
 * The boot delay's blank frame: the theme's background and nothing else, so nothing
 * wrong paints while auth or the vault resolves (shell-size plan C7).
 */
export function BootBlankScreen() {
  return (
    <div
      className="min-h-screen"
      style={{ background: 'var(--page-background)' }}
      aria-busy="true"
      data-testid="boot-blank"
    />
  );
}

/** A Suspense fallback for the boot path: blank inside the boot delay, the loader after it. */
export function BootLoadingFallback({ message }: LoadingFallbackProps) {
  const showLoader = useBootDelayElapsed(true);
  return showLoader ? <LoadingFallback message={message} /> : <BootBlankScreen />;
}
