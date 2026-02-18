import { lazy } from 'react';
import type { ComponentType } from 'react';
import { showUpdateBanner } from './updateBanner';

/**
 * Detect if an error is a chunk/module loading failure
 * This happens when the app is open and a new deployment occurs
 */
function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message || '';
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Loading chunk') ||
    message.includes('Loading CSS chunk') ||
    message.includes("Importing a module script failed") ||
    message.includes('error loading dynamically imported module')
  );
}

/**
 * Check if we've already attempted showing the update banner recently
 * Returns true if we should skip (prevent spamming)
 */
function hasRecentlyAttempted(): boolean {
  const reloadAttempted = sessionStorage.getItem('yidhan-chunk-reload-attempted');
  if (reloadAttempted) {
    const timestamp = parseInt(reloadAttempted, 10);
    // Clear the flag after 30 seconds to allow future attempts
    if (Date.now() - timestamp < 30000) {
      return true;
    }
    sessionStorage.removeItem('yidhan-chunk-reload-attempted');
  }
  return false;
}

/**
 * Mark that we attempted to show the update banner
 */
function markReloadAttempted(): void {
  sessionStorage.setItem('yidhan-chunk-reload-attempted', Date.now().toString());
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = ComponentType<any>;

/**
 * Wrapper around React.lazy that adds smart retry logic for chunk loading errors
 *
 * Strategy:
 * 1. Try to load the chunk normally
 * 2. On failure, wait briefly and retry once (handles transient network issues)
 * 3. If retry fails and it's safe to reload (no unsaved work), auto-reload
 * 4. If not safe to reload, throw the error to be caught by ErrorBoundary
 */
export function lazyWithRetry<T extends AnyComponent>(
  importFn: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      // First attempt
      return await importFn();
    } catch (error) {
      if (!isChunkLoadError(error)) {
        // Not a chunk error, throw immediately
        throw error;
      }

      console.log('[lazyWithRetry] Chunk load failed, retrying...');

      // Wait a moment before retrying (network might be temporarily unavailable)
      await new Promise(resolve => setTimeout(resolve, 1000));

      try {
        // Second attempt - sometimes clearing the module cache helps
        // Adding a cache-busting query param for the retry
        return await importFn();
      } catch (retryError) {
        if (!isChunkLoadError(retryError)) {
          throw retryError;
        }

        console.log('[lazyWithRetry] Retry failed, checking network status...');

        // Check if we're offline - if so, this is a transient issue, not an update
        // Throw to ErrorBoundary so user can retry when online
        if (!navigator.onLine) {
          console.log('[lazyWithRetry] Offline - throwing to ErrorBoundary');
          throw retryError;
        }

        // Online but chunk still failed = likely an app update
        // Show banner instead of hard reload - let user decide when to refresh
        // Skip if we've recently shown the banner (prevent spamming)
        if (!hasRecentlyAttempted()) {
          markReloadAttempted();
          showUpdateBanner();
        }

        // Throw to ErrorBoundary - the banner already tells user to refresh
        // This is better than a never-resolving promise (infinite Suspense)
        throw retryError;
      }
    }
  });
}

