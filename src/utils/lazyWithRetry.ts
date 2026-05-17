import { lazy } from 'react';
import type { ComponentType } from 'react';
import { isChunkLoadError, reloadForUpdatedApp, waitForUpdateReload } from './updateRecovery';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = ComponentType<any>;

/**
 * Wrapper around React.lazy that adds smart retry logic for chunk loading errors
 *
 * Strategy:
 * 1. Try to load the chunk normally
 * 2. On failure, wait briefly and retry once (handles transient network issues)
 * 3. If retry fails while online, reload once without prompting
 * 4. If recovery already failed recently, throw to ErrorBoundary
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

        // Online but chunk still failed = likely an app update. Reload once and
        // keep the Suspense boundary active so no update prompt flashes first.
        if (reloadForUpdatedApp()) {
          return await waitForUpdateReload();
        }

        // Recovery already happened recently and the chunk still failed.
        throw retryError;
      }
    }
  });
}

