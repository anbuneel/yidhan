/**
 * Sentry's initialisation. Loaded only by `startMonitoring` in ./monitoring, with a
 * dynamic import after the window `load` event (item 61, step 2), so nothing here is
 * in the entry path. Replay is a separate chunk again (./sentryReplay).
 *
 * E2EE: every event and every breadcrumb passes through the scrubbers below before
 * it is sent, including the ones queued before init.
 */
import {
  addBreadcrumb,
  addIntegration,
  browserTracingIntegration,
  captureException,
  captureMessage,
  init,
  type Breadcrumb,
  type BrowserOptions,
  type ErrorEvent,
} from '@sentry/react';
import { scrubSensitiveData, scrubShareSecrets } from './sentryScrubber';
import type { Reporter } from './monitoring';

export { addIntegration };

/** Strip note title/content, share tokens and URL fragments from an error report. */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.extra) {
    event.extra = scrubSensitiveData(event.extra) as Record<string, unknown>;
  }
  if (event.contexts) {
    event.contexts = scrubSensitiveData(event.contexts) as typeof event.contexts;
  }
  // URL fragments may hold share decryption keys; /s/<token> is a capability credential.
  if (event.request?.url) {
    event.request.url = scrubShareSecrets(event.request.url);
  }
  // Defence in depth: the same for exception values and stack frame filenames.
  event.exception?.values?.forEach((ex) => {
    if (ex.value) ex.value = scrubShareSecrets(ex.value);
    ex.stacktrace?.frames?.forEach((frame) => {
      if (frame.filename) frame.filename = scrubShareSecrets(frame.filename);
      if (frame.abs_path) frame.abs_path = scrubShareSecrets(frame.abs_path);
    });
  });
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb);
  }
  return event;
}

/** Strip note content and share secrets from a breadcrumb as it is recorded. */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  if (breadcrumb.message) breadcrumb.message = scrubShareSecrets(breadcrumb.message);
  if (breadcrumb.data) {
    breadcrumb.data = scrubSensitiveData(breadcrumb.data) as Record<string, unknown>;
  }
  return breadcrumb;
}

interface SentryConfig {
  dsn: string;
  environment: string;
  isSharedRoute: boolean;
}

export function sentryOptions({ dsn, environment, isSharedRoute }: SentryConfig): BrowserOptions {
  return {
    dsn,
    environment,
    // Replay is added after init (./sentryReplay), and never on shared routes.
    integrations: [browserTracingIntegration()],
    // Performance monitoring sample rate (10% of transactions)
    tracesSampleRate: 0.1,
    // Session replay: 10% of sessions, 100% on error. Zero on shared routes, which
    // show decrypted content and never load the integration.
    replaysSessionSampleRate: isSharedRoute ? 0 : 0.1,
    replaysOnErrorSampleRate: isSharedRoute ? 0 : 1.0,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  };
}

export function startSentry(config: SentryConfig): Reporter {
  init(sentryOptions(config));
  return { captureException, captureMessage, addBreadcrumb };
}
