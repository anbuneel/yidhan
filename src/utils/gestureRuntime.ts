/**
 * Post-paint loader for the gesture and spring runtime (A1c).
 *
 * Keeps @react-spring/web and @use-gesture/react off the cold-boot static import
 * path on every device. Cards, lists, and sheets render and work immediately;
 * swipe, pull-to-refresh, and mobile sheet drag activate once the chunk loads
 * after first paint.
 */
import { useEffect, useSyncExternalStore } from 'react';
import type { GestureRuntime } from './gestureBundle';

export type { GestureRuntime };

type Listener = () => void;

const listeners = new Set<Listener>();
let loadedRuntime: GestureRuntime | null = null;
let loadPromise: Promise<GestureRuntime | null> | null = null;
let postPaintScheduled = false;
let pendingFrameId: number | null = null;
let pendingTimerId: ReturnType<typeof setTimeout> | null = null;

function notify(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): GestureRuntime | null {
  return loadedRuntime;
}

function getServerSnapshot(): GestureRuntime | null {
  return null;
}

type GestureBundleImporter = () => Promise<{ gestureRuntime: GestureRuntime }>;

const defaultImporter: GestureBundleImporter = () => import('./gestureBundle');
let importGestureBundle: GestureBundleImporter = defaultImporter;
let retryOnOnlineAttached = false;

function handleOnline(): void {
  detachRetryOnOnline();
  void loadGestureRuntime();
}

function attachRetryOnOnline(): void {
  if (retryOnOnlineAttached || typeof window === 'undefined') return;
  retryOnOnlineAttached = true;
  window.addEventListener('online', handleOnline);
}

function detachRetryOnOnline(): void {
  if (!retryOnOnlineAttached || typeof window === 'undefined') return;
  retryOnOnlineAttached = false;
  window.removeEventListener('online', handleOnline);
}

/**
 * Load the gesture runtime immediately (idempotent singleton).
 * Returns null if the dynamic import fails so callers stay safely inert.
 *
 * A failure is retried on the next natural trigger: the next mobile sheet open, the
 * next library mount, or the browser coming back online. It never reloads the page:
 * a held save lives only in memory, and swipe and pull-to-refresh can wait.
 */
function loadGestureRuntime(): Promise<GestureRuntime | null> {
  if (loadedRuntime) return Promise.resolve(loadedRuntime);
  if (loadPromise) return loadPromise;

  loadPromise = importGestureBundle()
    .then((mod) => {
      loadedRuntime = mod.gestureRuntime;
      detachRetryOnOnline();
      notify();
      return loadedRuntime;
    })
    .catch((error: unknown) => {
      loadPromise = null;
      console.warn(
        '[gestures] Could not load the gesture runtime. Swipe and pull-to-refresh stay off until it loads.',
        error
      );
      attachRetryOnOnline();
      return null;
    });

  return loadPromise;
}

/**
 * Schedule loading the gesture runtime strictly after the current frame paints.
 * Shared across all library callers so only one post-paint schedule is created.
 */
export function scheduleGestureRuntimeAfterPaint(): () => void {
  if (loadedRuntime || loadPromise || postPaintScheduled) {
    return () => {};
  }

  postPaintScheduled = true;
  let cancelled = false;

  const triggerLoad = () => {
    pendingTimerId = null;
    if (cancelled) return;
    postPaintScheduled = false;
    void loadGestureRuntime();
  };

  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    pendingFrameId = window.requestAnimationFrame(() => {
      pendingFrameId = null;
      if (cancelled) return;
      // Macrotask inside rAF runs after the browser commits and paints this frame.
      pendingTimerId = setTimeout(triggerLoad, 0);
    });
  } else {
    pendingTimerId = setTimeout(triggerLoad, 0);
  }

  return () => {
    cancelled = true;
    if (pendingFrameId !== null && typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(pendingFrameId);
      pendingFrameId = null;
    }
    if (pendingTimerId !== null) {
      clearTimeout(pendingTimerId);
      pendingTimerId = null;
    }
    postPaintScheduled = false;
  };
}

/**
 * Subscribe to the deferred gesture runtime. Returns null until loaded.
 * Pass `{ loadMode: 'after-paint' }` for library gesture wrappers or
 * `{ loadMode: 'immediate' }` when an interactive sheet is already opening.
 */
export function useGestureRuntime(loadMode: 'passive' | 'after-paint' | 'immediate' = 'passive'): GestureRuntime | null {
  const runtime = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (runtime || loadMode === 'passive') return;
    if (loadMode === 'immediate') {
      void loadGestureRuntime();
      return;
    }
    return scheduleGestureRuntimeAfterPaint();
  }, [runtime, loadMode]);

  return runtime;
}

export function resetGestureRuntimeForTests(): void {
  if (pendingFrameId !== null && typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
    window.cancelAnimationFrame(pendingFrameId);
    pendingFrameId = null;
  }
  if (pendingTimerId !== null) {
    clearTimeout(pendingTimerId);
    pendingTimerId = null;
  }
  loadedRuntime = null;
  loadPromise = null;
  postPaintScheduled = false;
  detachRetryOnOnline();
  importGestureBundle = defaultImporter;
}

/** Tests only: replace the dynamic import, for example with one that fails first. */
export function setGestureBundleImporterForTests(importer: GestureBundleImporter): void {
  importGestureBundle = importer;
}
