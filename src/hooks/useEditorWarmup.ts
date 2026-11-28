import { useEffect } from 'react';

/** Longest the idle preload waits for the main thread to go quiet. */
export const EDITOR_IDLE_TIMEOUT_MS = 1500;
/** Where there is no requestIdleCallback (Safari): a short delay instead. */
export const EDITOR_FALLBACK_DELAY_MS = 500;

const CARD_SELECTOR = '[data-library-card-id]';

/**
 * Fetch the Editor chunk once the library is up, without competing with the unlock's
 * decrypt and first render (shell-size plan C17).
 *
 * It runs on idle, with a timeout, so a touch reader's first tap still finds the
 * Editor warm in the common case. A pointer over or focus on a note card fetches at
 * once. Both listen on the document, so the cards themselves need no wiring.
 */
export function useEditorWarmup(enabled: boolean, preload: () => Promise<void>): void {
  useEffect(() => {
    if (!enabled) return;

    let done = false;
    let cancelScheduled = () => {};

    const onIntent = (event: Event) => {
      if (event.target instanceof Element && event.target.closest(CARD_SELECTOR)) run();
    };

    const stop = () => {
      cancelScheduled();
      document.removeEventListener('pointerover', onIntent);
      document.removeEventListener('focusin', onIntent);
    };

    function run() {
      if (done) return;
      done = true;
      stop();
      void preload();
    }

    document.addEventListener('pointerover', onIntent, { passive: true });
    document.addEventListener('focusin', onIntent);

    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(run, { timeout: EDITOR_IDLE_TIMEOUT_MS });
      cancelScheduled = () => window.cancelIdleCallback(handle);
    } else {
      const handle = window.setTimeout(run, EDITOR_FALLBACK_DELAY_MS);
      cancelScheduled = () => window.clearTimeout(handle);
    }

    return stop;
  }, [enabled, preload]);
}
