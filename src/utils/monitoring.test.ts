import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const loaded = vi.hoisted(() => ({ replay: 0, client: 0 }));
const fakeSentry = vi.hoisted(() => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
  addIntegration: vi.fn(),
  startSentry: vi.fn(),
}));

vi.mock('./sentryClient', () => {
  loaded.client += 1;
  return { startSentry: fakeSentry.startSentry, addIntegration: fakeSentry.addIntegration };
});
vi.mock('./sentryReplay', () => {
  loaded.replay += 1;
  return { createReplayIntegration: () => ({ name: 'Replay' }) };
});

import {
  MAX_QUEUED_REPORTS,
  addBreadcrumb,
  attachReporter,
  bufferUncaughtErrors,
  captureException,
  captureMessage,
  disableReporting,
  resetMonitoringForTests,
  startMonitoring,
} from './monitoring';

const reporter = () => ({
  captureException: fakeSentry.captureException,
  captureMessage: fakeSentry.captureMessage,
  addBreadcrumb: fakeSentry.addBreadcrumb,
});

/** A synthetic uncaught error, cancelled so the test runner does not treat it as its own. */
function uncaught(error: Error): ErrorEvent {
  return new ErrorEvent('error', { error, message: error.message, cancelable: true });
}
const cancel = (event: Event) => event.preventDefault();

function rejection(reason: unknown): Event {
  return Object.assign(new Event('unhandledrejection'), { reason });
}

beforeEach(() => {
  window.addEventListener('error', cancel);
  resetMonitoringForTests();
  vi.clearAllMocks();
  fakeSentry.startSentry.mockImplementation(reporter);
});

afterEach(() => {
  window.removeEventListener('error', cancel);
  resetMonitoringForTests();
});

describe('before Sentry initialises', () => {
  it('reports an error thrown before init once Sentry has initialised', () => {
    bufferUncaughtErrors();
    const early = new Error('thrown during startup');
    window.dispatchEvent(uncaught(early));
    window.dispatchEvent(rejection(new Error('rejected during startup')));

    expect(fakeSentry.captureException).not.toHaveBeenCalled();

    attachReporter(reporter());

    expect(fakeSentry.captureException).toHaveBeenCalledTimes(2);
    expect(fakeSentry.captureException).toHaveBeenNthCalledWith(1, early, {
      mechanism: { type: 'onerror', handled: false },
    });
    expect(fakeSentry.captureException.mock.calls[1][0]).toMatchObject({ message: 'rejected during startup' });
    expect(fakeSentry.captureException.mock.calls[1][1]).toEqual({
      mechanism: { type: 'onunhandledrejection', handled: false },
    });
  });

  it('stops listening once Sentry is attached, so its own handlers do not double-report', () => {
    bufferUncaughtErrors();
    attachReporter(reporter());
    window.dispatchEvent(uncaught(new Error('after init')));
    expect(fakeSentry.captureException).not.toHaveBeenCalled();
  });

  it('flushes queued reports in the order they were made', () => {
    addBreadcrumb({ category: 'sync', message: 'first' });
    captureMessage('second');
    captureException(new Error('third'));

    attachReporter(reporter());

    const order = [
      fakeSentry.addBreadcrumb.mock.invocationCallOrder[0],
      fakeSentry.captureMessage.mock.invocationCallOrder[0],
      fakeSentry.captureException.mock.invocationCallOrder[0],
    ];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('holds scrubbed context only', () => {
    addBreadcrumb({ category: 'sync', message: 'opened /s/abcdefghijklmnopqrstuvwx#k=secret', data: { title: 'Diary' } });
    captureException(new Error('boom'), { extra: { content: 'my note', count: 2 } });

    attachReporter(reporter());

    expect(fakeSentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'opened /s/[REDACTED]', data: { title: '[REDACTED]' } })
    );
    expect(fakeSentry.captureException.mock.calls[0][1]).toEqual({ extra: { content: '[REDACTED]', count: 2 } });
  });

  it('is bounded', () => {
    for (let i = 0; i < MAX_QUEUED_REPORTS + 20; i += 1) captureMessage(`message ${i}`);
    attachReporter(reporter());
    expect(fakeSentry.captureMessage).toHaveBeenCalledTimes(MAX_QUEUED_REPORTS);
    expect(fakeSentry.captureMessage).toHaveBeenLastCalledWith(`message ${MAX_QUEUED_REPORTS - 1}`, undefined);
  });

  it('queues nothing without a DSN', () => {
    disableReporting();
    bufferUncaughtErrors();
    window.dispatchEvent(uncaught(new Error('no dsn')));
    captureMessage('dropped');
    attachReporter(reporter());
    expect(fakeSentry.captureException).not.toHaveBeenCalled();
    expect(fakeSentry.captureMessage).not.toHaveBeenCalled();
  });

  it('reports directly once attached', () => {
    attachReporter(reporter());
    const error = new Error('direct');
    captureException(error, { tags: { area: 'x' } });
    expect(fakeSentry.captureException).toHaveBeenCalledWith(error, { tags: { area: 'x' } });
  });
});

describe('startMonitoring', () => {
  // Order matters: the shared route runs first, before anything has imported Replay.
  it('never imports Replay on a shared-note route', async () => {
    await startMonitoring({ dsn: 'https://k@example.invalid/1', environment: 'test', pathname: '/s/abcdefghijklmnopqrstuvwx' });

    expect(fakeSentry.startSentry).toHaveBeenCalledWith({
      dsn: 'https://k@example.invalid/1',
      environment: 'test',
      isSharedRoute: true,
    });
    expect(loaded.replay).toBe(0);
    expect(fakeSentry.addIntegration).not.toHaveBeenCalled();
  });

  it('adds Replay after init everywhere else, and flushes what was queued', async () => {
    captureMessage('queued before init');
    await startMonitoring({ dsn: 'https://k@example.invalid/1', environment: 'test', pathname: '/' });

    expect(fakeSentry.startSentry).toHaveBeenCalledWith(expect.objectContaining({ isSharedRoute: false }));
    expect(fakeSentry.captureMessage).toHaveBeenCalledWith('queued before init', undefined);
    expect(loaded.replay).toBe(1);
    expect(fakeSentry.addIntegration).toHaveBeenCalledWith({ name: 'Replay' });
    expect(fakeSentry.startSentry.mock.invocationCallOrder[0]).toBeLessThan(
      fakeSentry.addIntegration.mock.invocationCallOrder[0]
    );
  });

  it('waits for the load event before loading Sentry', async () => {
    const readyState = vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    const started = startMonitoring({ dsn: 'https://k@example.invalid/1', environment: 'test', pathname: '/' });
    await Promise.resolve();
    expect(fakeSentry.startSentry).not.toHaveBeenCalled();

    readyState.mockReturnValue('complete');
    window.dispatchEvent(new Event('load'));
    await started;
    expect(fakeSentry.startSentry).toHaveBeenCalledTimes(1);
    readyState.mockRestore();
  });

  it('does not break the app if Sentry fails to start, and stops queueing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fakeSentry.startSentry.mockImplementation(() => {
      throw new Error('init failed');
    });
    await expect(
      startMonitoring({ dsn: 'https://k@example.invalid/1', environment: 'test', pathname: '/' })
    ).resolves.toBeUndefined();
    captureMessage('after failure');
    attachReporter(reporter());
    expect(fakeSentry.captureMessage).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
