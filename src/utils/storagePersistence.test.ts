import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockIsNative, mockBreadcrumb, mockReport } = vi.hoisted(() => ({
  mockIsNative: vi.fn(() => false),
  mockBreadcrumb: vi.fn(),
  mockReport: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => mockIsNative() },
}));

vi.mock('./reliabilityTelemetry', () => ({
  addReliabilityBreadcrumb: (...args: unknown[]) => mockBreadcrumb(...args),
  reportReliabilityIssue: (...args: unknown[]) => mockReport(...args),
}));

import {
  ensurePersistentStorage,
  getStoragePersistenceSnapshot,
  resetStoragePersistenceForTests,
  subscribeToStoragePersistence,
} from './storagePersistence';

function stubStorage(overrides: Partial<StorageManager> | undefined) {
  Object.defineProperty(navigator, 'storage', {
    value: overrides,
    configurable: true,
    writable: true,
  });
}

describe('storagePersistence', () => {
  beforeEach(() => {
    resetStoragePersistenceForTests();
    mockIsNative.mockReturnValue(false);
  });

  afterEach(() => {
    stubStorage(undefined);
  });

  it('reports granted when the browser already persists this origin', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    stubStorage({ persisted: vi.fn().mockResolvedValue(true), persist });

    await expect(ensurePersistentStorage()).resolves.toBe('granted');
    // No need to ask again for something already granted.
    expect(persist).not.toHaveBeenCalled();
    expect(getStoragePersistenceSnapshot().state).toBe('granted');
  });

  it('requests persistence and reports granted when the browser agrees', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    stubStorage({ persisted: vi.fn().mockResolvedValue(false), persist });

    await expect(ensurePersistentStorage('launch')).resolves.toBe('granted');
    expect(persist).toHaveBeenCalledTimes(1);
    expect(mockReport).not.toHaveBeenCalled();
  });

  it('reports denied, and files one warning per session, when the browser declines', async () => {
    stubStorage({
      persisted: vi.fn().mockResolvedValue(false),
      persist: vi.fn().mockResolvedValue(false),
    });

    await expect(ensurePersistentStorage('launch')).resolves.toBe('denied');
    await expect(ensurePersistentStorage('manual')).resolves.toBe('denied');

    expect(getStoragePersistenceSnapshot().state).toBe('denied');
    // This is the population whose unsynced notes can be lost — report it,
    // but not on every poll.
    expect(mockReport).toHaveBeenCalledTimes(1);
    expect(mockReport.mock.calls[0][0]).toMatchObject({ category: 'storage', level: 'warning' });
    // One record per outcome: the first denial is the report alone (it
    // leaves its own breadcrumb); only the repeat gets a plain breadcrumb.
    expect(mockBreadcrumb).toHaveBeenCalledTimes(1);
    expect(mockBreadcrumb.mock.calls[0][0]).toMatchObject({ message: 'Persistent storage denied' });
  });

  it('reports unsupported when the Storage API is absent', async () => {
    stubStorage(undefined);

    await expect(ensurePersistentStorage()).resolves.toBe('unsupported');
    expect(mockReport).not.toHaveBeenCalled();
  });

  it('treats a throwing API as denied, since only a grant makes storage safe', async () => {
    // Storage is evictable by default; an API that fails has not changed that.
    // Failing toward the warning keeps it in front of exactly the people it is
    // for, and the telemetry names the cause so it is not mistaken for a decline.
    stubStorage({
      persisted: vi.fn().mockRejectedValue(new DOMException('blocked', 'SecurityError')),
      persist: vi.fn(),
    });

    await expect(ensurePersistentStorage('launch')).resolves.toBe('denied');
    expect(getStoragePersistenceSnapshot().state).toBe('denied');
    expect(mockReport).toHaveBeenCalledTimes(1);
    expect(mockReport.mock.calls[0][0]).toMatchObject({
      data: { trigger: 'launch', error: 'SecurityError' },
    });
  });

  it('treats native platforms as granted without touching the browser API', async () => {
    mockIsNative.mockReturnValue(true);
    const persist = vi.fn();
    stubStorage({ persisted: vi.fn(), persist });

    await expect(ensurePersistentStorage()).resolves.toBe('granted');
    expect(persist).not.toHaveBeenCalled();
  });

  it('shares one in-flight request between concurrent callers', async () => {
    let resolvePersist: (value: boolean) => void = () => {};
    const persist = vi.fn(
      () => new Promise<boolean>((resolve) => { resolvePersist = resolve; })
    );
    stubStorage({ persisted: vi.fn().mockResolvedValue(false), persist });

    const first = ensurePersistentStorage();
    const second = ensurePersistentStorage();
    // persist() is only reached after persisted() resolves, so wait for it
    // before releasing it — resolving earlier would release a no-op.
    await vi.waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
    resolvePersist(true);

    await expect(Promise.all([first, second])).resolves.toEqual(['granted', 'granted']);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers when the state changes and records the estimate', async () => {
    const listener = vi.fn();
    subscribeToStoragePersistence(listener);
    stubStorage({
      persisted: vi.fn().mockResolvedValue(false),
      persist: vi.fn().mockResolvedValue(true),
      estimate: vi.fn().mockResolvedValue({ usage: 1024, quota: 4096 }),
    });

    await ensurePersistentStorage();
    // estimate() resolves on its own tick.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(listener).toHaveBeenCalled();
    expect(getStoragePersistenceSnapshot()).toMatchObject({
      state: 'granted',
      usageBytes: 1024,
      quotaBytes: 4096,
    });
  });
});
