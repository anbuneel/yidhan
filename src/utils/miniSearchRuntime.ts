/**
 * Lazy loader and intent bus for MiniSearch (shell-size plan A4).
 *
 * Keeps `minisearch` out of the static app-shell bundle. The library loads after
 * first library paint (idle), or immediately on search focus, shortcut, or query.
 *
 * A failed chunk import (for example after a mid-session service worker activation)
 * clears the in-flight promise and returns null without reloading the page: a held
 * save lives only in memory. The next search focus retries cleanly.
 */
import type MiniSearch from 'minisearch';

export type MiniSearchConstructor = typeof MiniSearch;
type MiniSearchImporter = () => Promise<{ default: MiniSearchConstructor }>;
type Listener = () => void;

const searchIntentListeners = new Set<Listener>();

let loadedMiniSearch: MiniSearchConstructor | null = null;
let loadPromise: Promise<MiniSearchConstructor | null> | null = null;

const defaultImporter: MiniSearchImporter = () => import('minisearch');
let importMiniSearch: MiniSearchImporter = defaultImporter;

export function getLoadedMiniSearch(): MiniSearchConstructor | null {
  return loadedMiniSearch;
}

/**
 * Notify active, unlocked search hooks that the reader focused search or used
 * the search shortcut. Hooks on a locked vault do not subscribe, so this is a
 * no-op while locked or signed out.
 */
export function signalSearchIntent(): void {
  searchIntentListeners.forEach((listener) => listener());
}

export function subscribeSearchIntent(listener: Listener): () => void {
  searchIntentListeners.add(listener);
  return () => {
    searchIntentListeners.delete(listener);
  };
}

/**
 * Load MiniSearch once (idempotent singleton).
 * Returns null if the dynamic import fails so callers can keep searching via the
 * plain-text fallback and retry on the next search focus.
 */
export function loadMiniSearch(): Promise<MiniSearchConstructor | null> {
  if (loadedMiniSearch) return Promise.resolve(loadedMiniSearch);
  if (loadPromise) return loadPromise;

  loadPromise = importMiniSearch()
    .then((mod) => {
      loadedMiniSearch = mod.default;
      loadPromise = null;
      return loadedMiniSearch;
    })
    .catch((error: unknown) => {
      loadPromise = null;
      console.warn('[search] Search index unavailable; retrying on next focus.', error);
      return null;
    });

  return loadPromise;
}

export function setMiniSearchImporterForTests(importer: MiniSearchImporter | null): void {
  importMiniSearch = importer ?? defaultImporter;
}

export function resetMiniSearchRuntimeForTests(): void {
  loadedMiniSearch = null;
  loadPromise = null;
  importMiniSearch = defaultImporter;
  searchIntentListeners.clear();
}
