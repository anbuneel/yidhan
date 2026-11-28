import { describe, expect, it } from 'vitest';
import type { ErrorEvent } from '@sentry/react';
import { scrubBreadcrumb, scrubEvent, sentryOptions } from './sentryClient';

const config = { dsn: 'https://k@example.invalid/1', environment: 'test' };

describe('sentryOptions', () => {
  it('uses the scrubbers as beforeSend and beforeBreadcrumb', () => {
    const options = sentryOptions(config);
    expect(options.beforeSend).toBe(scrubEvent);
    expect(options.beforeBreadcrumb).toBe(scrubBreadcrumb);
  });

  // Shell-size plan A7: errors only, no performance tracing.
  it('configures no tracing integration and no trace sampling', () => {
    const options = sentryOptions(config);
    expect(options.integrations ?? []).toEqual([]);
    expect(options.tracesSampleRate).toBeUndefined();
    expect(options.tracesSampler).toBeUndefined();
  });

  // Shell-size plan D2: no Session Replay, on any route.
  it('configures no Replay integration and no replay sampling', () => {
    const options = sentryOptions(config);
    const names = (options.integrations as { name: string }[]).map((integration) => integration.name);
    expect(names).not.toContain('Replay');
    expect(options.replaysSessionSampleRate).toBeUndefined();
    expect(options.replaysOnErrorSampleRate).toBeUndefined();
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
