const SYNC_LOCK_PREFIX = 'yidhan:sync-queue';

// Web Locks is the cross-tab authority. The fallback only preserves the
// existing same-realm guarantee on older WebViews that do not expose the API;
// supported browsers use the process-owned lock, which the browser releases
// automatically if a tab closes or crashes.
const fallbackTails = new Map<string, Promise<void>>();

function runWithInProcessLock<T>(name: string, task: () => Promise<T>): Promise<T> {
  const previous = fallbackTails.get(name) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(task);
  const tail = run.then(() => undefined, () => undefined);
  fallbackTails.set(name, tail);

  void tail.finally(() => {
    if (fallbackTails.get(name) === tail) {
      fallbackTails.delete(name);
    }
  });

  return run;
}

/**
 * Run one user's outbound queue with exclusive ownership across tabs.
 *
 * A Web Lock is deliberately held for the lifetime of `task`. Web Locks are
 * owned by the tab's execution context, so a killed tab cannot strand a
 * durable lease: the browser releases the lock and wakes the next waiter.
 */
export async function withCrossTabSyncLock<T>(
  userId: string,
  task: () => Promise<T>
): Promise<T> {
  const name = `${SYNC_LOCK_PREFIX}:${userId}`;
  const lockManager = typeof navigator === 'undefined' ? undefined : navigator.locks;

  if (lockManager) {
    return lockManager.request(name, { mode: 'exclusive' }, task);
  }

  return runWithInProcessLock(name, task);
}
