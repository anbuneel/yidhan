import { describe, expect, it } from 'vitest';
import type { ErrorEvent } from '@sentry/react';
import { scrubBreadcrumb, scrubEvent, sentryOptions } from './sentryClient';

const config = { dsn: 'https://k@example.invalid/1', environment: 'test' };

describe('sentryOptions', () => {
  it('uses the scrubbers as beforeSend and beforeBreadcrumb', () => {
    const options = sentryOptions({ ...config, isSharedRoute: false });
    expect(options.beforeSend).toBe(scrubEvent);
    expect(options.beforeBreadcrumb).toBe(scrubBreadcrumb);
  });

  it('keeps the scrubbers on shared routes too', () => {
    const options = sentryOptions({ ...config, isSharedRoute: true });
    expect(options.beforeSend).toBe(scrubEvent);
    expect(options.beforeBreadcrumb).toBe(scrubBreadcrumb);
  });

  it('never configures Replay at init, and samples none on shared routes', () => {
    const shared = sentryOptions({ ...config, isSharedRoute: true });
    const names = (shared.integrations as { name: string }[]).map((integration) => integration.name);
    expect(names).not.toContain('Replay');
    expect(shared.replaysSessionSampleRate).toBe(0);
    expect(shared.replaysOnErrorSampleRate).toBe(0);

    const app = sentryOptions({ ...config, isSharedRoute: false });
    expect((app.integrations as { name: string }[]).map((integration) => integration.name)).not.toContain('Replay');
    expect(app.replaysSessionSampleRate).toBe(0.1);
    expect(app.replaysOnErrorSampleRate).toBe(1);
  });
});

describe('scrubEvent', () => {
  it('strips note content, share tokens and fragments', () => {
    const token = 'abcdefghijklmnopqrstuvwx';
    const event = scrubEvent({
      type: undefined,
      extra: { title: 'Diary', count: 1 },
      contexts: { note: { content: 'body' } },
      request: { url: `https://yidhan.app/s/${token}#k=key` },
      exception: {
        values: [
          {
            value: `failed at /s/${token}`,
            stacktrace: { frames: [{ filename: `https://yidhan.app/s/${token}#k=key`, abs_path: '/a#b' }] },
          },
        ],
      },
      breadcrumbs: [{ message: `/s/${token}`, data: { encryptedPayload: 'x' } }],
    } as ErrorEvent);

    expect(event.extra).toEqual({ title: '[REDACTED]', count: 1 });
    expect(event.contexts).toEqual({ note: { content: '[REDACTED]' } });
    expect(event.request?.url).toBe('https://yidhan.app/s/[REDACTED]');
    expect(event.exception?.values?.[0].value).toBe('failed at /s/[REDACTED]');
    expect(event.exception?.values?.[0].stacktrace?.frames?.[0]).toEqual({
      filename: 'https://yidhan.app/s/[REDACTED]',
      abs_path: '/a',
    });
    expect(event.breadcrumbs).toEqual([{ message: '/s/[REDACTED]', data: { encryptedPayload: '[REDACTED]' } }]);
  });
});

describe('scrubBreadcrumb', () => {
  it('strips sensitive data from a breadcrumb as it is recorded', () => {
    expect(
      scrubBreadcrumb({ category: 'ui', message: 'open #k=secret', data: { noteTitle: 'x', id: 'n1' } })
    ).toEqual({ category: 'ui', message: 'open ', data: { noteTitle: '[REDACTED]', id: 'n1' } });
  });
});
