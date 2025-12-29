import { lazy } from 'react';
import type { ComponentType } from 'react';

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
 * Check if it's safe to auto-reload the page
 * Returns false if there's unsaved work or user is in the middle of something
 */
function canSafelyReload(): boolean {
  // Check if we already tried to reload (prevent infinite loops)
  const reloadAttempted = sessionStorage.getItem('zenote-chunk-reload-attempted');
  if (reloadAttempted) {
    // Clear the flag after 30 seconds to allow future reloads
    const timestamp = parseInt(reloadAttempted, 10);
    if (Date.now() - timestamp < 30000) {
      return false;
    }
    sessionStorage.removeItem('zenote-chunk-reload-attempted');
  }

  // Check for open modals/dialogs
  const hasOpenModal = document.querySelector('[role="dialog"]') !== null;
  if (hasOpenModal) {
    return false;
  }

  // Check for elements indicating active editing
  // Look for saving indicator or focused editor
  const savingIndicator = document.querySelector('[data-save-status="saving"]');
  if (savingIndicator) {
    return false;
  }

  // Check if user is actively typing (focused on an input/editor)
  const activeElement = document.activeElement;
  if (activeElement) {
    const tagName = activeElement.tagName.toLowerCase();
    const isEditable = activeElement.getAttribute('contenteditable') === 'true';
    if (tagName === 'input' || tagName === 'textarea' || isEditable) {
      return false;
    }
  }

  return true;
}

/**
 * Mark that we attempted a reload to prevent infinite loops
 */
function markReloadAttempted(): void {
  sessionStorage.setItem('zenote-chunk-reload-attempted', Date.now().toString());
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

        console.log('[lazyWithRetry] Retry failed, checking if safe to reload...');

        // Check if we can safely reload
        if (canSafelyReload()) {
          console.log('[lazyWithRetry] Safe to reload, refreshing page...');
          markReloadAttempted();
          window.location.reload();
          // Return a never-resolving promise while page reloads
          return new Promise(() => {});
        }

        console.log('[lazyWithRetry] Not safe to reload, showing error boundary');
        // Not safe to reload - let ErrorBoundary handle it
        throw retryError;
      }
    }
  });
}

/**
 * Preload a lazy component without rendering it
 * Useful for preloading on hover or when navigation is likely
 */
export function preloadComponent(
  importFn: () => Promise<{ default: AnyComponent }>
): void {
  importFn().catch(() => {
    // Silently ignore preload failures - will be handled when actually needed
  });
}
