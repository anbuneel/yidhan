import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type MiniSearch from 'minisearch';
import {
  getLoadedMiniSearch,
  loadMiniSearch,
  resetMiniSearchRuntimeForTests,
  setMiniSearchImporterForTests,
  signalSearchIntent,
  subscribeSearchIntent,
} from './miniSearchRuntime';

const fakeMiniSearch = class FakeMiniSearch {} as unknown as typeof MiniSearch;

function flakyImporter(failures: number) {
  let calls = 0;
  return vi.fn(() => {
    calls += 1;
    return calls <= failures
      ? Promise.reject(new TypeError('Failed to fetch dynamically imported module'))
      : Promise.resolve({ default: fakeMiniSearch });
  });
}

describe('miniSearchRuntime', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetMiniSearchRuntimeForTests();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    resetMiniSearchRuntimeForTests();
    warnSpy.mockRestore();
  });

  it('returns null and warns once on chunk failure without retrying on its own', async () => {
    const importer = flakyImporter(1);
    setMiniSearchImporterForTests(importer);

    const loaded = await loadMiniSearch();

    expect(loaded).toBeNull();
    expect(getLoadedMiniSearch()).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(importer).toHaveBeenCalledTimes(1);
  });

  it('retries cleanly on the next call after a chunk failure and caches success', async () => {
    const importer = flakyImporter(1);
    setMiniSearchImporterForTests(importer);

    expect(await loadMiniSearch()).toBeNull();
    expect(await loadMiniSearch()).toBe(fakeMiniSearch);
    expect(getLoadedMiniSearch()).toBe(fakeMiniSearch);

    // Subsequent calls reuse the loaded module without importing again.
    expect(await loadMiniSearch()).toBe(fakeMiniSearch);
    expect(importer).toHaveBeenCalledTimes(2);
  });

  it('coalesces concurrent loads into one dynamic import', async () => {
    const importer = flakyImporter(0);
    setMiniSearchImporterForTests(importer);

    const [first, second] = await Promise.all([loadMiniSearch(), loadMiniSearch()]);

    expect(first).toBe(fakeMiniSearch);
    expect(second).toBe(fakeMiniSearch);
    expect(importer).toHaveBeenCalledTimes(1);
  });

  it('notifies only active search-intent subscribers', () => {
    const active = vi.fn();
    const removed = vi.fn();
    const unsubActive = subscribeSearchIntent(active);
    const unsubRemoved = subscribeSearchIntent(removed);

    unsubRemoved();
    signalSearchIntent();

    expect(active).toHaveBeenCalledTimes(1);
    expect(removed).not.toHaveBeenCalled();
    unsubActive();
  });
});
