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
 * Validate that a value is a valid EditorPosition
 */
function isValidPosition(value: unknown): value is EditorPosition {
  if (typeof value !== 'object' || value === null) return false;
  const pos = value as Record<string, unknown>;

  // Validate cursor
  if (typeof pos.cursor !== 'object' || pos.cursor === null) return false;
  const cursor = pos.cursor as Record<string, unknown>;
  if (typeof cursor.from !== 'number' || typeof cursor.to !== 'number') return false;

  // Validate scroll and updatedAt
  if (typeof pos.scroll !== 'number') return false;
  if (typeof pos.updatedAt !== 'number') return false;

  return true;
}

/**
 * Get all stored positions from localStorage with runtime validation
 * to prevent corrupted data from causing runtime errors
 */
function getStore(): PositionStore {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return {};

    const parsed = JSON.parse(data);

    // Validate top-level structure
    if (typeof parsed !== 'object' || parsed === null) return {};

    // Validate each entry and only keep valid ones
    const validated: PositionStore = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (isValidPosition(value)) {
        validated[key] = value;
      }
    }

    return validated;
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

const DEFAULT_POSITION: EditorPosition = {
  cursor: { from: 0, to: 0 },
  scroll: 0,
  updatedAt: 0,
};

/**
 * Save cursor position for a note
 */
export function saveCursorPosition(noteId: string, cursor: CursorPosition): void {
  const store = getStore();
  const existing = store[noteId] || DEFAULT_POSITION;
  store[noteId] = { ...existing, cursor, updatedAt: Date.now() };
  setStore(store);
}

/**
 * Save scroll position for a note
 */
export function saveScrollPosition(noteId: string, scroll: number): void {
  const store = getStore();
  const existing = store[noteId] || DEFAULT_POSITION;
  store[noteId] = { ...existing, scroll, updatedAt: Date.now() };
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

export interface ThrottledSave {
  /** Call this to trigger a throttled save */
  save: () => void;
  /** Call this on unmount to flush any pending save immediately */
  flush: () => void;
  /** Call this to cancel any pending save without executing it */
  cancel: () => void;
}

/**
 * Throttle utility for saving positions during typing/scrolling
 * Returns an object with save(), flush(), and cancel() methods
 */
export function createThrottledSave(
  saveFn: () => void,
  delay = 1000
): ThrottledSave {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastSaved = 0;
  let hasPending = false;

  const save = () => {
    const now = Date.now();
    hasPending = true;

    // If enough time has passed, save immediately
    if (now - lastSaved >= delay) {
      lastSaved = now;
      hasPending = false;
      saveFn();
      return;
    }

    // Otherwise, schedule a save
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Use Math.max to handle edge case where system clock changes could make this negative
    const remaining = Math.max(0, delay - (now - lastSaved));
    timeoutId = setTimeout(() => {
      lastSaved = Date.now();
      hasPending = false;
      saveFn();
      timeoutId = null;
    }, remaining);
  };

  const flush = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (hasPending) {
      hasPending = false;
      saveFn();
    }
  };

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    hasPending = false;
  };

  return { save, flush, cancel };
}
