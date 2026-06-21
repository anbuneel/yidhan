import { describe, expect, it } from 'vitest';
import { scrubSensitiveData, scrubShareSecrets } from './sentryScrubber';

describe('sentryScrubber', () => {
  it('removes shared-note fragments and capability tokens from urls', () => {
    expect(
      scrubShareSecrets('https://yidhan.vercel.app/s/abcdefghijklmnop/letter#k=secret')
    ).toBe('https://yidhan.vercel.app/s/[REDACTED]');
  });

  it('redacts nested sensitive fields and handles cycles', () => {
    const payload: Record<string, unknown> = {
      safe: 'visible',
      nested: {
        title: 'Private note',
        url: 'https://yidhan.vercel.app/s/abcdefghijklmnop/letter#k=secret',
      },
    };
    payload.self = payload;

    expect(scrubSensitiveData(payload)).toEqual({
      safe: 'visible',
      nested: {
        title: '[REDACTED]',
        url: 'https://yidhan.vercel.app/s/[REDACTED]',
      },
      self: '[REDACTED]',
    });
  });
});
