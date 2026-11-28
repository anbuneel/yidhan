import { useState, type ComponentProps, type ComponentType } from 'react';
import { lazyWithRetry } from './lazyWithRetry';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = ComponentType<any>;

export type PreloadableComponent<T extends AnyComponent> = ((props: ComponentProps<T>) => React.ReactNode) & {
  /** Starts the chunk fetch. Safe to call any number of times; never throws. */
  preload: () => Promise<void>;
};

/**
 * A lazyWithRetry component that can be fetched before it renders.
 *
 * Call `preload()` on intent (a click that is about to show it). Once the chunk has
 * arrived, a new mount renders the component directly and never suspends, so the first
 * open shows no fallback. A mount that starts before the chunk arrives suspends as a
 * plain lazyWithRetry component would, with the same service-worker recovery.
 *
 * Each mount picks once, so a mounted instance never switches component type and loses
 * its state.
 */
export function preloadableLazy<T extends AnyComponent>(
  importFn: () => Promise<{ default: T }>
): PreloadableComponent<T> {
  let loaded: T | null = null;
  let pending: Promise<{ default: T }> | null = null;

  const load = () => {
    pending ??= importFn().then(
      (module) => {
        loaded = module.default;
        return module;
      },
      (error: unknown) => {
        // Let the next call, or lazyWithRetry's retry, fetch again.
        pending = null;
        throw error;
      }
    );
    return pending;
  };

  const Lazy = lazyWithRetry(load);

  function Preloadable(props: ComponentProps<T>) {
    const [Component] = useState<AnyComponent>(() => loaded ?? Lazy);
    return <Component {...props} />;
  }

  Preloadable.preload = () =>
    load().then(
      () => undefined,
      () => undefined
    );

  return Preloadable;
}
