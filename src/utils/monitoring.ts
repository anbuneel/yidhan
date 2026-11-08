/**
 * Error reporting that works before Sentry has loaded (item 61, step 2).
 *
 * Sentry is about 85 KB gzip, so it no longer loads with the entry. `startMonitoring`
 * fetches it after the window `load` event. Until then, reports made through this
 * module and uncaught errors seen by `bufferUncaughtErrors` wait in a small queue and
 * are sent once Sentry has initialised, so its `beforeSend` and `beforeBreadcrumb`
 * scrubbers still see every one of them.
 *
 * The queue is bounded, and it holds scrubbed context only: breadcrumb data and
 * `extra` pass through `scrubSensitiveData` on the way in. Without a DSN nothing is
 * queued, because nothing would ever send it.
 *
 * Import reporting functions from here, never from `@sentry/react`: a static import
 * of Sentry anywhere in the entry path puts all of it back before `load`.
 */
import type * as SentryApi from '@sentry/react';
import { scrubSensitiveData, scrubShareSecrets } from './sentryScrubber';
import { whenPageLoaded } from './whenPageLoaded';

export type Reporter = Pick<typeof SentryApi, 'captureException' | 'captureMessage' | 'addBreadcrumb'>;

type ExceptionHint = Parameters<Reporter['captureException']>[1];
type MessageContext = Parameters<Reporter['captureMessage']>[1];
type Breadcrumb = Parameters<Reporter['addBreadcrumb']>[0];

type Queued =
  | { kind: 'exception'; error: unknown; hint?: ExceptionHint }
  | { kind: 'message'; message: string; context?: MessageContext }
  | { kind: 'breadcrumb'; breadcrumb: Breadcrumb };

/** Reports kept before init. Later ones are dropped: the first error is the useful one. */
export const MAX_QUEUED_REPORTS = 50;

let reporter: Reporter | null = null;
let disabled = false;
let queue: Queued[] = [];
let detachUncaught: (() => void) | null = null;

function enqueue(item: Queued): void {
  if (disabled || queue.length >= MAX_QUEUED_REPORTS) return;
  queue.push(item);
}

function scrubContext<T>(context: T): T {
  if (!context || typeof context !== 'object' || typeof context === 'function') return context;
  const copy = { ...(context as Record<string, unknown>) };
  if (copy.extra) copy.extra = scrubSensitiveData(copy.extra);
  if (copy.contexts) copy.contexts = scrubSensitiveData(copy.contexts);
  return copy as T;
}

export function captureException(error: unknown, hint?: ExceptionHint): void {
  if (reporter) {
    reporter.captureException(error, hint);
    return;
  }
  enqueue({ kind: 'exception', error, hint: scrubContext(hint) });
}

export function captureMessage(message: string, context?: MessageContext): void {
  if (reporter) {
    reporter.captureMessage(message, context);
    return;
  }
  enqueue({ kind: 'message', message: scrubShareSecrets(message), context: scrubContext(context) });
}

export function addBreadcrumb(breadcrumb: Breadcrumb): void {
  if (reporter) {
    reporter.addBreadcrumb(breadcrumb);
    return;
  }
  enqueue({
    kind: 'breadcrumb',
    breadcrumb: {
      ...breadcrumb,
      message: breadcrumb.message === undefined ? undefined : scrubShareSecrets(breadcrumb.message),
      data: breadcrumb.data === undefined ? undefined : (scrubSensitiveData(breadcrumb.data) as Breadcrumb['data']),
    },
  });
}

/**
 * Queue errors and unhandled rejections thrown before Sentry initialises. Sentry's
 * own global handlers replace these listeners when `attachReporter` runs.
 */
export function bufferUncaughtErrors(target: Window = window): void {
  if (detachUncaught || reporter || disabled) return;

  const onError = (event: ErrorEvent) => {
    captureException(event.error ?? event.message, {
      mechanism: { type: 'onerror', handled: false },
    });
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    captureException(event.reason, {
      mechanism: { type: 'onunhandledrejection', handled: false },
    });
  };

  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);
  detachUncaught = () => {
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onRejection);
    detachUncaught = null;
  };
}

/** Sentry is initialised: send everything queued, in order, and report directly from now on. */
export function attachReporter(next: Reporter): void {
  detachUncaught?.();
  reporter = next;
  const pending = queue;
  queue = [];
  for (const item of pending) {
    if (item.kind === 'exception') next.captureException(item.error, item.hint);
    else if (item.kind === 'message') next.captureMessage(item.message, item.context);
    else next.addBreadcrumb(item.breadcrumb);
  }
}

/** No DSN, or Sentry failed to load: drop the queue and stop queueing. */
export function disableReporting(): void {
  detachUncaught?.();
  disabled = true;
  queue = [];
}

interface MonitoringConfig {
  dsn: string;
  environment: string;
  pathname: string;
  /**
   * Replay waits for this as well as for init. main.tsx passes the moment the app
   * shell starts (src/shells/appShellStarted.ts): an anonymous visit to the public
   * pages never loads Replay's 39 KB (item 61, step 5). Default: at once.
   */
  replayAfter?: Promise<unknown>;
}

/**
 * Load and initialise Sentry after `load`, then Replay. Replay is never imported on a
 * shared-note route (`/s/*`): those pages show decrypted content.
 */
export async function startMonitoring({
  dsn,
  environment,
  pathname,
  replayAfter,
}: MonitoringConfig): Promise<void> {
  const isSharedRoute = pathname.startsWith('/s/');
  try {
    await whenPageLoaded();
    const sentry = await import('./sentryClient');
    attachReporter(sentry.startSentry({ dsn, environment, isSharedRoute }));
    if (isSharedRoute) return;
    await replayAfter;
    // Asked again: Replay can start well after page load, and the app shell can start
    // on a navigation to a shared note (Back from `/` to `/s/...`).
    if (window.location.pathname.startsWith('/s/')) return;
    const { createReplayIntegration } = await import('./sentryReplay');
    sentry.addIntegration(createReplayIntegration());
  } catch (error) {
    // Monitoring must never break the app. If Sentry itself did not load, there is
    // nothing to report to; keep holding nothing.
    if (!reporter) disableReporting();
    console.warn('Error monitoring did not start:', error);
  }
}

/** Test-only reset of module state. */
export function resetMonitoringForTests(): void {
  detachUncaught?.();
  reporter = null;
  disabled = false;
  queue = [];
}
