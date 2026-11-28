import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import {
  resetGestureRuntimeForTests,
  scheduleGestureRuntimeAfterPaint,
  setGestureBundleImporterForTests,
  useGestureRuntime,
  type GestureRuntime,
} from './gestureRuntime';

const fakeRuntime = { marker: 'runtime' } as unknown as GestureRuntime;

/** An importer that fails `failures` times, then resolves. */
function flakyImporter(failures: number) {
  let calls = 0;
  const importer = vi.fn(() => {
    calls += 1;
    return calls <= failures
      ? Promise.reject(new TypeError('Failed to fetch dynamically imported module'))
      : Promise.resolve({ gestureRuntime: fakeRuntime });
  });
  return importer;
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

describe('gesture runtime loading (F4)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetGestureRuntimeForTests();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    resetGestureRuntimeForTests();
    warnSpy.mockRestore();
  });

  it('stays inert and says so when the chunk fails, without retrying on its own', async () => {
    const importer = flakyImporter(1);
    setGestureBundleImporterForTests(importer);

    const { result } = renderHook(() => useGestureRuntime('immediate'));
    await settle();

    expect(result.current).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    // No timer-driven retry loop and no reload: nothing happens until a trigger.
    await settle();
    expect(importer).toHaveBeenCalledTimes(1);
  });

  it('retries when the browser comes back online', async () => {
    const importer = flakyImporter(1);
    setGestureBundleImporterForTests(importer);
    const { result } = renderHook(() => useGestureRuntime('immediate'));
    await settle();
    expect(result.current).toBeNull();

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(result.current).toBe(fakeRuntime));
    expect(importer).toHaveBeenCalledTimes(2);
  });

  it('retries on the next library mount', async () => {
    const importer = flakyImporter(1);
    setGestureBundleImporterForTests(importer);
    const passive = renderHook(() => useGestureRuntime('passive'));

    scheduleGestureRuntimeAfterPaint();
    await waitFor(() => expect(warnSpy).toHaveBeenCalledTimes(1));
    expect(importer).toHaveBeenCalledTimes(1);
    expect(passive.result.current).toBeNull();

    // A later library mount schedules again, and this time the chunk arrives.
    scheduleGestureRuntimeAfterPaint();
    await waitFor(() => expect(passive.result.current).toBe(fakeRuntime));
    expect(importer).toHaveBeenCalledTimes(2);
  });

  it('retries on the next sheet open', async () => {
    const importer = flakyImporter(1);
    setGestureBundleImporterForTests(importer);
    const first = renderHook(() => useGestureRuntime('immediate'));
    await settle();
    expect(first.result.current).toBeNull();
    first.unmount();

    const second = renderHook(() => useGestureRuntime('immediate'));
    await waitFor(() => expect(second.result.current).toBe(fakeRuntime));
    expect(importer).toHaveBeenCalledTimes(2);
  });

  it('does not import again on online once the runtime has loaded', async () => {
    const importer = flakyImporter(0);
    setGestureBundleImporterForTests(importer);
    const { result } = renderHook(() => useGestureRuntime('immediate'));
    await waitFor(() => expect(result.current).toBe(fakeRuntime));

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await settle();
    expect(importer).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
