import { isChunkLoadError } from './updateRecovery';

export const RETRY_DELAY_MS = 1000;

/**
 * `import()` for code that loads when the reader clicks something: export, import,
 * backup. A failed chunk fetch is retried once after a second, as lazyWithRetry does.
 *
 * Unlike lazyWithRetry, it never reloads the page. A stale chunk URL after a service
 * worker update fails twice and the caller says so; a reload here could drop held saves,
 * which live only in memory. The caller tells the reader to reload.
 */
export async function loadOnDemand<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (!isChunkLoadError(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return load();
  }
}
