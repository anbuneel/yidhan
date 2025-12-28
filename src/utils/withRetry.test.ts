import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry, isRetryableError } from './withRetry';

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

  it('returns false for 4xx errors', () => {
    expect(isRetryableError(new Error('400 Bad Request'))).toBe(false);
    expect(isRetryableError(new Error('401 Unauthorized'))).toBe(false);
    expect(isRetryableError(new Error('403 Forbidden'))).toBe(false);
    expect(isRetryableError(new Error('404 Not Found'))).toBe(false);
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
