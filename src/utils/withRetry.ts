/**
 * Retry utility with exponential backoff
 *
 * Retries a failed async operation with increasing delays between attempts.
 * Default: 3 attempts with delays of 1s, 2s, 4s (exponential backoff)
 *
 * By default, only retries network/5xx errors. 4xx errors (validation, auth)
 * are not retried since they won't succeed on retry.
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay in ms before first retry (default: 1000) */
  initialDelayMs?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Optional callback on each retry attempt */
  onRetry?: (attempt: number, error: Error) => void;
  /**
   * Determines if an error should be retried (default: isRetryableError)
   * Return true to retry, false to fail immediately
   */
  shouldRetry?: (error: Error) => boolean;
}

/**
 * Default retry logic: retry network errors and 5xx, skip 4xx
 */
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();

  // Network errors - always retry
  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout') ||
    message.includes('connection')
  ) {
    return true;
  }

  // Check for HTTP status codes in error message
  // 4xx errors (client errors) - don't retry
  if (/\b4\d{2}\b/.test(message) || message.includes('bad request') || message.includes('unauthorized') || message.includes('forbidden') || message.includes('not found')) {
    return false;
  }

  // 5xx errors (server errors) - retry
  if (/\b5\d{2}\b/.test(message) || message.includes('internal server') || message.includes('service unavailable')) {
    return true;
  }

  // Default: retry unknown errors (conservative approach)
  return true;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry' | 'shouldRetry'>> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
};

/**
 * Wraps an async function with retry logic
 *
 * @param fn - Async function to retry on failure
 * @param options - Retry configuration
 * @returns Result of the function if successful
 * @throws Last error if all retries fail
 *
 * @example
 * const result = await withRetry(
 *   () => fetchData(),
 *   { maxAttempts: 3, onRetry: (n) => console.log(`Retry ${n}`) }
 * );
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts,
    initialDelayMs,
    backoffMultiplier,
  } = { ...DEFAULT_OPTIONS, ...options };
  const { onRetry, shouldRetry = isRetryableError } = options;

  let lastError: Error = new Error('Unknown error');
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on the last attempt
      if (attempt === maxAttempts) {
        break;
      }

      // Check if error is retryable (skip 4xx, retry 5xx/network)
      if (!shouldRetry(lastError)) {
        break;
      }

      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt, lastError);
      }

      // Wait before retrying
      await sleep(delay);

      // Increase delay for next retry (exponential backoff)
      delay *= backoffMultiplier;
    }
  }

  throw lastError;
}

/**
 * Promise-based sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
