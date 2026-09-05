import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const { mockEnsure, mockIsNative } = vi.hoisted(() => ({
  mockEnsure: vi.fn(),
  mockIsNative: vi.fn(() => false),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => mockIsNative() },
}));

vi.mock('../utils/reliabilityTelemetry', () => ({
  addReliabilityBreadcrumb: vi.fn(),
  reportReliabilityIssue: vi.fn(),
}));

import * as persistence from '../utils/storagePersistence';
import {
  useStoragePersistence,
  resetStoragePersistenceHookForTests,
} from './useStoragePersistence';

describe('useStoragePersistence', () => {
  beforeEach(() => {
    persistence.resetStoragePersistenceForTests();
    resetStoragePersistenceHookForTests();
    mockEnsure.mockReset();
    vi.spyOn(persistence, 'ensurePersistentStorage').mockImplementation(
      (...args) => mockEnsure(...args)
    );
    mockEnsure.mockResolvedValue('unknown');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requests persistent storage once on first mount, not once per component', () => {
    const first = renderHook(() => useStoragePersistence());
    const second = renderHook(() => useStoragePersistence());

    expect(mockEnsure).toHaveBeenCalledTimes(1);
    expect(mockEnsure).toHaveBeenCalledWith('launch');

    first.unmount();
    second.unmount();
  });

  it('re-requests when the app is installed, since that is when Chrome grants it', () => {
    renderHook(() => useStoragePersistence());
    mockEnsure.mockClear();

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    expect(mockEnsure).toHaveBeenCalledWith('installed');
    // Exactly once: the reset seam unbinds the previous test's listener, so a
    // leaked one would show up here instead of being masked by the idempotent
    // request underneath.
    expect(mockEnsure).toHaveBeenCalledTimes(1);
  });

  it('exposes isDenied only for an explicit refusal', async () => {
    // Drive the real store rather than the mocked request so the hook's
    // subscription is what is under test.
    vi.restoreAllMocks();
    Object.defineProperty(navigator, 'storage', {
      value: {
        persisted: vi.fn().mockResolvedValue(false),
        persist: vi.fn().mockResolvedValue(false),
      },
      configurable: true,
      writable: true,
    });

    const { result } = renderHook(() => useStoragePersistence());

    await waitFor(() => expect(result.current.state).toBe('denied'));
    expect(result.current.isDenied).toBe(true);

    Object.defineProperty(navigator, 'storage', { value: undefined, configurable: true });
  });

  it('does not flag unsupported browsers as at-risk', async () => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, 'storage', { value: undefined, configurable: true });

    const { result } = renderHook(() => useStoragePersistence());

    await waitFor(() => expect(result.current.state).toBe('unsupported'));
    expect(result.current.isDenied).toBe(false);
  });

  it('lets a caller ask again on demand', async () => {
    const { result } = renderHook(() => useStoragePersistence());
    mockEnsure.mockClear();

    await act(async () => {
      await result.current.request();
    });

    expect(mockEnsure).toHaveBeenCalledWith('manual');
  });
});
