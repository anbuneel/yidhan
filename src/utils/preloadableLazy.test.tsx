import { Suspense, useState } from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { preloadableLazy } from './preloadableLazy';

function Greeting({ name }: { name: string }) {
  const [count, setCount] = useState(0);
  return (
    <button type="button" onClick={() => setCount((c) => c + 1)}>
      Hello {name} {count}
    </button>
  );
}

function deferred() {
  let resolve!: (value: { default: typeof Greeting }) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<{ default: typeof Greeting }>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const fallback = <p>Loading</p>;

describe('preloadableLazy', () => {
  it('does not fetch until rendered or preloaded', () => {
    const importFn = vi.fn(() => Promise.resolve({ default: Greeting }));
    preloadableLazy(importFn);
    expect(importFn).not.toHaveBeenCalled();
  });

  it('suspends like a lazy component when nothing was preloaded', async () => {
    const pending = deferred();
    const Lazy = preloadableLazy(() => pending.promise);
    render(
      <Suspense fallback={fallback}>
        <Lazy name="Ada" />
      </Suspense>
    );
    expect(screen.getByText('Loading')).toBeInTheDocument();
    await act(async () => pending.resolve({ default: Greeting }));
    expect(await screen.findByRole('button', { name: 'Hello Ada 0' })).toBeInTheDocument();
  });

  it('renders at once, with no fallback, after a preload has finished', async () => {
    const importFn = vi.fn(() => Promise.resolve({ default: Greeting }));
    const Lazy = preloadableLazy(importFn);
    await Lazy.preload();
    render(
      <Suspense fallback={fallback}>
        <Lazy name="Ada" />
      </Suspense>
    );
    expect(screen.queryByText('Loading')).toBeNull();
    expect(screen.getByRole('button', { name: 'Hello Ada 0' })).toBeInTheDocument();
    expect(importFn).toHaveBeenCalledTimes(1);
  });

  it('fetches once however often it is preloaded and rendered', async () => {
    const importFn = vi.fn(() => Promise.resolve({ default: Greeting }));
    const Lazy = preloadableLazy(importFn);
    void Lazy.preload();
    void Lazy.preload();
    const { unmount } = render(
      <Suspense fallback={fallback}>
        <Lazy name="Ada" />
      </Suspense>
    );
    expect(await screen.findByRole('button', { name: 'Hello Ada 0' })).toBeInTheDocument();
    unmount();
    render(
      <Suspense fallback={fallback}>
        <Lazy name="Ada" />
      </Suspense>
    );
    expect(screen.getByRole('button', { name: 'Hello Ada 0' })).toBeInTheDocument();
    expect(importFn).toHaveBeenCalledTimes(1);
  });

  it('keeps a mounted instance and its state when the chunk arrives later', async () => {
    const pending = deferred();
    const Lazy = preloadableLazy(() => pending.promise);
    const { rerender } = render(
      <Suspense fallback={fallback}>
        <Lazy name="Ada" />
      </Suspense>
    );
    await act(async () => pending.resolve({ default: Greeting }));
    const button = await screen.findByRole('button', { name: 'Hello Ada 0' });
    await act(async () => button.click());
    rerender(
      <Suspense fallback={fallback}>
        <Lazy name="Ada" />
      </Suspense>
    );
    expect(screen.getByRole('button', { name: 'Hello Ada 1' })).toBe(button);
  });

  it('a failed preload never throws and lets the next attempt fetch again', async () => {
    const importFn = vi
      .fn<() => Promise<{ default: typeof Greeting }>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ default: Greeting });
    const Lazy = preloadableLazy(importFn);
    await expect(Lazy.preload()).resolves.toBeUndefined();
    await Lazy.preload();
    expect(importFn).toHaveBeenCalledTimes(2);
    render(<Lazy name="Ada" />);
    expect(screen.getByRole('button', { name: 'Hello Ada 0' })).toBeInTheDocument();
  });
});
