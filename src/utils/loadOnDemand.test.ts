import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const reloadForUpdatedApp = vi.hoisted(() => vi.fn(() => true));
vi.mock('./updateRecovery', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./updateRecovery')>()),
  reloadForUpdatedApp,
}));

import { loadOnDemand, RETRY_DELAY_MS } from './loadOnDemand';

const chunkError = () => new Error('Failed to fetch dynamically imported module: /assets/exportImport-old.js');

describe('loadOnDemand', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    reloadForUpdatedApp.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the module on the first try, with no wait', async () => {
    const load = vi.fn().mockResolvedValue({ value: 1 });
    await expect(loadOnDemand(load)).resolves.toEqual({ value: 1 });
    expect(load).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('retries once after the delay on a chunk error, and recovers', async () => {
    const load = vi.fn().mockRejectedValueOnce(chunkError()).mockResolvedValueOnce({ value: 2 });
    const result = loadOnDemand(load);

    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS - 1);
    expect(load).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);

    await expect(result).resolves.toEqual({ value: 2 });
    expect(load).toHaveBeenCalledTimes(2);
    expect(reloadForUpdatedApp).not.toHaveBeenCalled();
  });

  it('throws the second chunk error after one retry, and never reloads the page', async () => {
    const second = chunkError();
    const load = vi.fn().mockRejectedValueOnce(chunkError()).mockRejectedValueOnce(second);
    const result = loadOnDemand(load);
    const settled = expect(result).rejects.toBe(second);

    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS);
    await settled;
    expect(load).toHaveBeenCalledTimes(2);
    expect(reloadForUpdatedApp).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS * 5);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('throws at once on an error that is not a chunk error, without retrying', async () => {
    const bug = new TypeError('x is not a function');
    const load = vi.fn().mockRejectedValue(bug);
    await expect(loadOnDemand(load)).rejects.toBe(bug);
    expect(load).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    expect(reloadForUpdatedApp).not.toHaveBeenCalled();
  });
});
