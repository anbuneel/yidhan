import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useSettingsModalState } from './useSettingsModalState';

describe('useSettingsModalState', () => {
  it('closes Settings when the vault locks', () => {
    const { result, rerender } = renderHook(({ unlocked }) => useSettingsModalState(unlocked), {
      initialProps: { unlocked: true },
    });
    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);

    rerender({ unlocked: false });
    expect(result.current[0]).toBe(false);
  });

  it('stays closed after the next unlock', () => {
    const { result, rerender } = renderHook(({ unlocked }) => useSettingsModalState(unlocked), {
      initialProps: { unlocked: true },
    });
    act(() => result.current[1](true));
    rerender({ unlocked: false });
    rerender({ unlocked: true });
    expect(result.current[0]).toBe(false);
  });

  it('does not close Settings while the vault stays unlocked', () => {
    const { result, rerender } = renderHook(({ unlocked }) => useSettingsModalState(unlocked), {
      initialProps: { unlocked: true },
    });
    act(() => result.current[1](true));
    rerender({ unlocked: true });
    expect(result.current[0]).toBe(true);
  });

  it('does not open Settings on unlock', () => {
    const { result, rerender } = renderHook(({ unlocked }) => useSettingsModalState(unlocked), {
      initialProps: { unlocked: false },
    });
    rerender({ unlocked: true });
    expect(result.current[0]).toBe(false);
  });

  it('can still be opened and closed by hand', () => {
    const { result } = renderHook(() => useSettingsModalState(true));
    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);
    act(() => result.current[1](false));
    expect(result.current[0]).toBe(false);
  });
});
