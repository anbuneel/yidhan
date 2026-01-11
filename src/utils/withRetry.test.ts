import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry, isRetryableError, isRateLimitError, parseRetryAfter } from './withRetry';

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const resultPromise = withRetry(fn);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and succeeds on second attempt', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success');

    const resultPromise = withRetry(fn, { initialDelayMs: 100 });
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on failure and succeeds on third attempt', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    const resultPromise = withRetry(fn, { initialDelayMs: 100 });
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws after max attempts exceeded', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('persistent failure'));

    const resultPromise = withRetry(fn, { maxAttempts: 3, initialDelayMs: 100 });

    // Attach rejection handler before running timers to avoid unhandled rejection
    const expectation = expect(resultPromise).rejects.toThrow('persistent failure');
    await vi.runAllTimersAsync();
    await expectation;

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('uses exponential backoff for delays', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    const resultPromise = withRetry(fn, {
      initialDelayMs: 1000,
      backoffMultiplier: 2,
    });

    // First call happens immediately
    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1);

    // After 1000ms, second attempt
    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(2);

    // After 2000ms more (1000 * 2), third attempt
    await vi.advanceTimersByTimeAsync(2000);
    expect(fn).toHaveBeenCalledTimes(3);

    const result = await resultPromise;
    expect(result).toBe('success');
  });

  it('calls onRetry callback on each retry', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    const onRetry = vi.fn();

    const resultPromise = withRetry(fn, {
      initialDelayMs: 100,
      onRetry,
    });
    await vi.runAllTimersAsync();
    await resultPromise;

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(Error));
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, expect.any(Error));
  });

  it('does not call onRetry on success', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const onRetry = vi.fn();

    const resultPromise = withRetry(fn, { onRetry });
    await vi.runAllTimersAsync();
    await resultPromise;

    expect(onRetry).not.toHaveBeenCalled();
  });

  it('respects custom maxAttempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    const resultPromise = withRetry(fn, { maxAttempts: 5, initialDelayMs: 100 });

    // Attach rejection handler before running timers to avoid unhandled rejection
    const expectation = expect(resultPromise).rejects.toThrow('fail');
    await vi.runAllTimersAsync();
    await expectation;

    expect(fn).toHaveBeenCalledTimes(5);
  });

  it('handles non-Error throws', async () => {
    const fn = vi.fn().mockRejectedValue('string error');

    const resultPromise = withRetry(fn, { maxAttempts: 1 });

    // Attach rejection handler before running timers to avoid unhandled rejection
    const expectation = expect(resultPromise).rejects.toThrow('string error');
    await vi.runAllTimersAsync();
    await expectation;
  });

  it('does not retry 4xx errors by default', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('400 Bad Request'));

    const resultPromise = withRetry(fn, { maxAttempts: 3, initialDelayMs: 100 });

    const expectation = expect(resultPromise).rejects.toThrow('400 Bad Request');
    await vi.runAllTimersAsync();
    await expectation;

    // Should only try once - no retries for 4xx
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries 5xx errors by default', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('500 Internal Server Error'))
      .mockResolvedValue('success');

    const resultPromise = withRetry(fn, { maxAttempts: 3, initialDelayMs: 100 });
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries network errors by default', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockResolvedValue('success');

    const resultPromise = withRetry(fn, { maxAttempts: 3, initialDelayMs: 100 });
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('respects custom shouldRetry function', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('custom error'));
    const shouldRetry = vi.fn().mockReturnValue(false);

    const resultPromise = withRetry(fn, {
      maxAttempts: 3,
      initialDelayMs: 100,
      shouldRetry,
    });

    const expectation = expect(resultPromise).rejects.toThrow('custom error');
    await vi.runAllTimersAsync();
    await expectation;

    // Should only try once when shouldRetry returns false
    expect(fn).toHaveBeenCalledTimes(1);
    expect(shouldRetry).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe('isRetryableError', () => {
  it('returns true for network errors', () => {
    expect(isRetryableError(new Error('Network request failed'))).toBe(true);
    expect(isRetryableError(new Error('Failed to fetch'))).toBe(true);
    expect(isRetryableError(new Error('Connection timeout'))).toBe(true);
  });

  it('returns false for 4xx errors (except 429)', () => {
    expect(isRetryableError(new Error('400 Bad Request'))).toBe(false);
    expect(isRetryableError(new Error('401 Unauthorized'))).toBe(false);
    expect(isRetryableError(new Error('403 Forbidden'))).toBe(false);
    expect(isRetryableError(new Error('404 Not Found'))).toBe(false);
  });

  it('returns true for 429 rate limit errors', () => {
    expect(isRetryableError(new Error('429 Too Many Requests'))).toBe(true);
    expect(isRetryableError(new Error('Rate limit exceeded'))).toBe(true);
    expect(isRetryableError(new Error('Too many requests'))).toBe(true);
  });

  it('returns true for 5xx errors', () => {
    expect(isRetryableError(new Error('500 Internal Server Error'))).toBe(true);
    expect(isRetryableError(new Error('502 Bad Gateway'))).toBe(true);
    expect(isRetryableError(new Error('503 Service Unavailable'))).toBe(true);
  });

  it('returns true for unknown errors', () => {
    expect(isRetryableError(new Error('Something went wrong'))).toBe(true);
  });
});

describe('isRateLimitError', () => {
  it('returns true for 429 errors', () => {
    expect(isRateLimitError(new Error('429 Too Many Requests'))).toBe(true);
    expect(isRateLimitError(new Error('HTTP 429'))).toBe(true);
  });

  it('returns true for rate limit message variants', () => {
    expect(isRateLimitError(new Error('Rate limit exceeded'))).toBe(true);
    expect(isRateLimitError(new Error('Too many requests'))).toBe(true);
    expect(isRateLimitError(new Error('You have been rate limited'))).toBe(true);
  });

  it('returns false for other errors', () => {
    expect(isRateLimitError(new Error('400 Bad Request'))).toBe(false);
    expect(isRateLimitError(new Error('500 Internal Server Error'))).toBe(false);
    expect(isRateLimitError(new Error('Network error'))).toBe(false);
  });
});

describe('parseRetryAfter', () => {
  it('parses Retry-After header format', () => {
    expect(parseRetryAfter(new Error('429 Too Many Requests. Retry-After: 30'))).toBe(30);
    expect(parseRetryAfter(new Error('Rate limited. retry-after: 60'))).toBe(60);
  });

  it('parses "wait X seconds" format', () => {
    expect(parseRetryAfter(new Error('Too many requests. Please wait 45 seconds'))).toBe(45);
    expect(parseRetryAfter(new Error('Wait 10s before retrying'))).toBe(10);
  });

  it('parses "try again in X" format', () => {
    expect(parseRetryAfter(new Error('Rate limited. Try again in 20 seconds'))).toBe(20);
    expect(parseRetryAfter(new Error('Try again in 5s'))).toBe(5);
  });

  it('returns fallback when no time found', () => {
    expect(parseRetryAfter(new Error('429 Too Many Requests'))).toBe(10);
    expect(parseRetryAfter(new Error('Rate limited'), 15)).toBe(15);
  });

  it('caps at 5 minutes maximum', () => {
    expect(parseRetryAfter(new Error('Retry-After: 600'))).toBe(300);
    expect(parseRetryAfter(new Error('Retry-After: 1000'))).toBe(300);
  });
});

describe('withRetry rate limit handling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries 429 errors', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('429 Too Many Requests'))
      .mockResolvedValue('success');

    const resultPromise = withRetry(fn, { maxAttempts: 3, initialDelayMs: 100 });
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('calls onRateLimit callback with wait time', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('429 Too Many Requests. Retry-After: 30'))
      .mockResolvedValue('success');
    const onRateLimit = vi.fn();

    const resultPromise = withRetry(fn, {
      maxAttempts: 3,
      initialDelayMs: 100,
      onRateLimit,
    });
    await vi.runAllTimersAsync();
    await resultPromise;

    expect(onRateLimit).toHaveBeenCalledWith(30);
  });

  it('waits for Retry-After duration before retrying', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('429 Too Many Requests. Retry-After: 5'))
      .mockResolvedValue('success');

    const resultPromise = withRetry(fn, { maxAttempts: 3, initialDelayMs: 100 });

    // First call happens immediately
    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1);

    // After 4 seconds, still waiting
    await vi.advanceTimersByTimeAsync(4000);
    expect(fn).toHaveBeenCalledTimes(1);

    // After 5 seconds total, should retry
    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(2);

    const result = await resultPromise;
    expect(result).toBe('success');
  });

  it('does not call onRetry for rate limit errors (calls onRateLimit instead)', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('429 Too Many Requests'))
      .mockResolvedValue('success');
    const onRetry = vi.fn();
    const onRateLimit = vi.fn();

    const resultPromise = withRetry(fn, {
      maxAttempts: 3,
      initialDelayMs: 100,
      onRetry,
      onRateLimit,
    });
    await vi.runAllTimersAsync();
    await resultPromise;

    expect(onRetry).not.toHaveBeenCalled();
    expect(onRateLimit).toHaveBeenCalledTimes(1);
  });
});
