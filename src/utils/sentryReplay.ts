/**
 * Sentry Session Replay, in its own chunk (item 61, step 2). `startMonitoring` imports
 * this from our own bundle after Sentry has initialised. Sentry's `lazyLoadIntegration`
 * would fetch it from Sentry's CDN instead, which the CSP (`script-src 'self'`) blocks.
 *
 * Never imported on shared-note routes (`/s/*`): those pages show decrypted content.
 */
import { replayIntegration } from '@sentry/react';

export function createReplayIntegration() {
  return replayIntegration({
    // Mask note content in session replays for privacy
    maskAllText: true,
    maskAllInputs: true,
    blockAllMedia: false,
    // Block sensitive content selectors (decrypted note titles, previews, editor)
    block: ['.rich-text-editor', '.ProseMirror', '[data-sensitive]', '.note-card'],
  });
}
