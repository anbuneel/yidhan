/**
 * Editor Position Persistence
 *
 * Persists cursor and scroll positions per note in localStorage
 * to enable "resume where you left off" across sessions.
 *
 * Storage key: yidhan-editor-positions
 * Format: { [noteId]: { cursor: { from, to }, scroll: number, updatedAt: number } }
 */

const STORAGE_KEY = 'yidhan-editor-positions';
const MAX_ENTRIES = 100; // Limit storage to last 100 notes
const POSITION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface CursorPosition {
  from: number;
  to: number;
}

export interface EditorPosition {
  cursor: CursorPosition;
  scroll: number;
  updatedAt: number;
}

type PositionStore = Record<string, EditorPosition>;

/**
 * Get all stored positions from localStorage
 */
function getStore(): PositionStore {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return {};
    return JSON.parse(data) as PositionStore;
  } catch {
    return {};
  }
}

/**
 * Save positions to localStorage with cleanup of old entries
 */
function setStore(store: PositionStore): void {
  try {
    // Clean up old entries before saving
    const now = Date.now();
    const entries = Object.entries(store);

    // Remove expired entries
    const validEntries = entries.filter(
      ([, pos]) => now - pos.updatedAt < POSITION_TTL_MS
    );

    // If still too many, keep only the most recent
    const sortedEntries = validEntries.sort(
      ([, a], [, b]) => b.updatedAt - a.updatedAt
    );
    const trimmedEntries = sortedEntries.slice(0, MAX_ENTRIES);

    const cleanStore = Object.fromEntries(trimmedEntries);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanStore));
  } catch {
    // Ignore storage errors (quota exceeded, etc.)
  }
}

/**
 * Save cursor position for a note
 */
export function saveCursorPosition(noteId: string, cursor: CursorPosition): void {
  const store = getStore();
  const existing = store[noteId] || { cursor: { from: 0, to: 0 }, scroll: 0, updatedAt: 0 };
  store[noteId] = {
    ...existing,
    cursor,
    updatedAt: Date.now(),
  };
  setStore(store);
}

/**
 * Save scroll position for a note
 */
export function saveScrollPosition(noteId: string, scroll: number): void {
  const store = getStore();
  const existing = store[noteId] || { cursor: { from: 0, to: 0 }, scroll: 0, updatedAt: 0 };
  store[noteId] = {
    ...existing,
    scroll,
    updatedAt: Date.now(),
  };
  setStore(store);
}

/**
 * Save both cursor and scroll position for a note
 */
export function saveEditorPosition(
  noteId: string,
  cursor: CursorPosition,
  scroll: number
): void {
  const store = getStore();
  store[noteId] = {
    cursor,
    scroll,
    updatedAt: Date.now(),
  };
  setStore(store);
}

/**
 * Get stored position for a note (returns null if not found or expired)
 */
export function getEditorPosition(noteId: string): EditorPosition | null {
  const store = getStore();
  const position = store[noteId];

  if (!position) return null;

  // Check if expired
  if (Date.now() - position.updatedAt > POSITION_TTL_MS) {
    // Clean up expired entry
    delete store[noteId];
    setStore(store);
    return null;
  }

  return position;
}

/**
 * Clear stored position for a note
 */
export function clearEditorPosition(noteId: string): void {
  const store = getStore();
  delete store[noteId];
  setStore(store);
}

/**
 * Check if stored scroll position is "far" from top (threshold in pixels)
 * Used to decide whether to show "Resume" prompt
 */
export function isScrollPositionFar(noteId: string, threshold = 500): boolean {
  const position = getEditorPosition(noteId);
  return position !== null && position.scroll > threshold;
}

/**
 * Throttle utility for saving positions during typing/scrolling
 */
export function createThrottledSave(
  saveFn: () => void,
  delay = 1000
): () => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastSaved = 0;

  return () => {
    const now = Date.now();

    // If enough time has passed, save immediately
    if (now - lastSaved >= delay) {
      lastSaved = now;
      saveFn();
      return;
    }

    // Otherwise, schedule a save
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      lastSaved = Date.now();
      saveFn();
      timeoutId = null;
    }, delay - (now - lastSaved));
  };
}
