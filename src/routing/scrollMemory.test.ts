import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  clearScrollMemory,
  forgetScroll,
  recallScroll,
  rememberScroll,
} from './scrollMemory';

describe('scrollMemory', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('recalls what it remembered, per history entry', () => {
    rememberScroll(1, 420);
    rememberScroll(2, 0);

    expect(recallScroll(1)).toBe(420);
    expect(recallScroll(2)).toBe(0);
  });

  it('returns null for an entry that was never left', () => {
    expect(recallScroll(99)).toBeNull();
  });

  it('distinguishes a remembered zero from an unremembered entry', () => {
    rememberScroll(1, 0);
    expect(recallScroll(1)).toBe(0);
    expect(recallScroll(2)).toBeNull();
  });

  it('overwrites the offset for an entry that is left twice', () => {
    rememberScroll(1, 100);
    rememberScroll(1, 250);
    expect(recallScroll(1)).toBe(250);
  });

  it('ignores a nonsensical offset rather than storing it', () => {
    rememberScroll(1, -5);
    rememberScroll(2, Number.NaN);
    rememberScroll(3, Number.POSITIVE_INFINITY);

    expect(recallScroll(1)).toBeNull();
    expect(recallScroll(2)).toBeNull();
    expect(recallScroll(3)).toBeNull();
  });

  it('forgets one entry without touching the others', () => {
    rememberScroll(1, 10);
    rememberScroll(2, 20);
    forgetScroll(1);

    expect(recallScroll(1)).toBeNull();
    expect(recallScroll(2)).toBe(20);
  });

  it('clears everything on demand', () => {
    rememberScroll(1, 10);
    rememberScroll(2, 20);
    clearScrollMemory();

    expect(recallScroll(1)).toBeNull();
    expect(recallScroll(2)).toBeNull();
  });

  it('drops the oldest entries once the memory is full', () => {
    for (let key = 1; key <= 60; key++) {
      rememberScroll(key, key);
    }

    // 60 entries written, 50 kept: the ten oldest are gone, the newest survive.
    expect(recallScroll(1)).toBeNull();
    expect(recallScroll(10)).toBeNull();
    expect(recallScroll(11)).toBe(11);
    expect(recallScroll(60)).toBe(60);
  });

  it('survives corrupted storage without throwing', () => {
    sessionStorage.setItem('yidhan-scroll-memory', 'not json');
    expect(recallScroll(1)).toBeNull();

    rememberScroll(1, 42);
    expect(recallScroll(1)).toBe(42);
  });

  it('discards non-numeric values found in storage', () => {
    sessionStorage.setItem('yidhan-scroll-memory', JSON.stringify({ '1': 'top', '2': 30 }));
    expect(recallScroll(1)).toBeNull();
    expect(recallScroll(2)).toBe(30);
  });

  it('degrades to no memory when storage refuses to answer', () => {
    // A browser with site data blocked throws on the property access itself. Losing
    // the scroll position is acceptable; throwing during navigation is not.
    const original = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get() {
        throw new DOMException('denied');
      },
    });

    try {
      expect(() => rememberScroll(1, 42)).not.toThrow();
      expect(() => clearScrollMemory()).not.toThrow();
      expect(recallScroll(1)).toBeNull();
    } finally {
      if (original) Object.defineProperty(window, 'sessionStorage', original);
    }
  });

  it('degrades quietly when a write is refused for quota', () => {
    const setItem = vi
      .spyOn(window.sessionStorage, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });

    expect(() => rememberScroll(1, 42)).not.toThrow();
    expect(recallScroll(1)).toBeNull();
    expect(setItem).toHaveBeenCalled();
  });
});
