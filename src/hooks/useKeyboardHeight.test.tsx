import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { useKeyboardHeight, useKeyboardHeightCssVariable } from './useKeyboardHeight';

// jsdom has no Visual Viewport API, so stand one up and drive it by hand.
function installViewport(height: number) {
  const listeners = new Map<string, Set<() => void>>();
  const viewport = {
    height,
    addEventListener: (type: string, fn: () => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener: (type: string, fn: () => void) => listeners.get(type)?.delete(fn),
  };
  Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true, writable: true });
  return {
    resizeTo(next: number) {
      viewport.height = next;
      act(() => { listeners.get('resize')?.forEach((fn) => fn()); });
    },
  };
}

describe('useKeyboardHeight', () => {
  let viewport: ReturnType<typeof installViewport>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true, writable: true });
    viewport = installViewport(800);
  });

  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.style.removeProperty('--keyboard-height');
    document.documentElement.style.removeProperty('--keyboard-visible');
  });

  it('sets the CSS variables without re-rendering a CSS-only consumer', () => {
    const renders = vi.fn();
    function CssOnly() {
      renders();
      useKeyboardHeightCssVariable();
      return null;
    }
    render(<CssOnly />);
    const before = renders.mock.calls.length;

    viewport.resizeTo(500); // keyboard up

    // The whole point of the variant: the editor subtree must not re-render
    // every time the keyboard opens or closes.
    expect(renders.mock.calls.length).toBe(before);
    expect(document.documentElement.style.getPropertyValue('--keyboard-height')).toBe('300px');
    expect(document.documentElement.style.getPropertyValue('--keyboard-visible')).toBe('1');
  });

  it('still re-renders and reports the height for a consumer that needs the number', () => {
    const seen: number[] = [];
    function NeedsNumber() {
      const height = useKeyboardHeight();
      seen.push(height);
      return null;
    }
    render(<NeedsNumber />);

    viewport.resizeTo(500);

    expect(seen.at(-1)).toBe(300);
    expect(document.documentElement.style.getPropertyValue('--keyboard-height')).toBe('300px');
  });

  it('ignores changes under the jitter threshold on both variants', () => {
    const renders = vi.fn();
    function NeedsNumber() {
      renders();
      useKeyboardHeight();
      return null;
    }
    render(<NeedsNumber />);
    const before = renders.mock.calls.length;
    // Own baseline: a previous test's unmount cleanup writes 0px, and RTL's
    // auto-cleanup runs after this file's afterEach, so the property can carry
    // over between tests.
    document.documentElement.style.removeProperty('--keyboard-height');

    // Address bar hide/show is ~5px here — under the 10px floor, so neither the
    // CSS variable nor a render should move.
    viewport.resizeTo(795);

    expect(renders.mock.calls.length).toBe(before);
    expect(document.documentElement.style.getPropertyValue('--keyboard-height')).toBe('');
  });

  it('marks the keyboard not visible for a change above the jitter floor but below a keyboard', () => {
    render(<Probe />);

    // 45px: bigger than jitter, far smaller than a keyboard. The height updates,
    // but --keyboard-visible must stay 0 or the toolbar would reposition for an
    // address bar.
    viewport.resizeTo(755);

    expect(document.documentElement.style.getPropertyValue('--keyboard-height')).toBe('45px');
    expect(document.documentElement.style.getPropertyValue('--keyboard-visible')).toBe('0');
  });

  it('resets the CSS variables when the last consumer unmounts', () => {
    const view = render(<Probe />);
    viewport.resizeTo(500);
    expect(document.documentElement.style.getPropertyValue('--keyboard-height')).toBe('300px');

    view.unmount();

    expect(document.documentElement.style.getPropertyValue('--keyboard-height')).toBe('0px');
    expect(document.documentElement.style.getPropertyValue('--keyboard-visible')).toBe('0');
  });
});

function Probe() {
  useKeyboardHeightCssVariable();
  return null;
}
