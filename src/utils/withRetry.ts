/**
 * Retry utility with exponential backoff
 *
 * Retries a failed async operation with increasing delays between attempts.
 * Default: 3 attempts with delays of 1s, 2s, 4s (exponential backoff)
 *
 * By default, only retries network/5xx errors. 4xx errors (validation, auth)
 * are not retried since they won't succeed on retry.
 *
 * Special handling for 429 (rate limit) errors:
 * - Respects Retry-After header if present
 * - Calls onRateLimit callback for UX feedback
 * - Retries with appropriate delay
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
  /**
   * Optional callback when rate limited (429 error)
   * Called with the wait time in seconds
   */
  onRateLimit?: (waitSeconds: number) => void;
}

/**
 * Checks if an error is a 429 rate limit error
 */
export function isRateLimitError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    /\b429\b/.test(message) ||
    message.includes('too many requests') ||
    message.includes('rate limit')
  );
}

/**
 * Extracts wait time from a rate limit error
 * Looks for Retry-After header value in error message or defaults to exponential backoff
 *
 * @param error - The error to parse
 * @param fallbackSeconds - Fallback wait time if no Retry-After found (default: 10)
 * @returns Wait time in seconds
 */
export function parseRetryAfter(error: Error, fallbackSeconds: number = 10): number {
  const message = error.message;

  // Try to find Retry-After value in error message
  // Common formats: "Retry-After: 30", "retry after 30 seconds", "wait 30s"
  const patterns = [
    /retry[- ]after[:\s]+(\d+)/i,
    /wait\s+(\d+)\s*(?:s|sec|seconds?)?/i,
    /try again in\s+(\d+)\s*(?:s|sec|seconds?)?/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const seconds = parseInt(match[1], 10);
      if (!isNaN(seconds) && seconds > 0) {
        // Cap at 5 minutes to prevent excessive waits
        return Math.min(seconds, 300);
      }
    }
  }

  return fallbackSeconds;
}

/**
 * Default retry logic: retry network errors, 5xx, and 429; skip other 4xx
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

  // 429 (rate limit) - retry with special handling
  if (isRateLimitError(error)) {
    return true;
  }

  // Check for HTTP status codes in error message
  // 4xx errors (client errors, except 429) - don't retry
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

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry' | 'shouldRetry' | 'onRateLimit'>> = {
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
 *   {
 *     maxAttempts: 3,
 *     onRetry: (n) => console.log(`Retry ${n}`),
 *     onRateLimit: (secs) => toast.info(`Taking a breath... waiting ${secs}s`)
 *   }
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
  const { onRetry, shouldRetry = isRetryableError, onRateLimit } = options;

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

      // Check if error is retryable (skip 4xx except 429, retry 5xx/network)
      if (!shouldRetry(lastError)) {
        break;
      }

      // Special handling for rate limit errors
      if (isRateLimitError(lastError)) {
        const waitSeconds = parseRetryAfter(lastError, delay / 1000);
        const waitMs = waitSeconds * 1000;

        // Call rate limit callback for UX feedback
        if (onRateLimit) {
          onRateLimit(waitSeconds);
        }

        // Wait the appropriate time
        await sleep(waitMs);

        // Don't apply exponential backoff after rate limit wait
        // The next delay will use the Retry-After value as baseline
        delay = Math.max(delay, waitMs);
      } else {
        // Regular retry with exponential backoff
        if (onRetry) {
          onRetry(attempt, lastError);
        }

        await sleep(delay);
        delay *= backoffMultiplier;
      }
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
