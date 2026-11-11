/**
 * Demo Storage Service
 *
 * Manages localStorage persistence for the demo writing experience.
 * Notes and tags are stored locally until user signs up, then migrated to Supabase.
 */

import {
  createDefaultState,
  STARTER_NOTES,
  type DemoNote,
  type DemoState,
  type DemoTag,
} from './demoStarters';

// Re-exported so callers keep one import. The landing page imports demoStarters.ts
// directly: it needs the starters, not the storage code (item 61, step 5).
export {
  createDemoStarterPreviewState,
  type DemoMetadata,
  type DemoNote,
  type DemoState,
  type DemoTag,
} from './demoStarters';

// ============================================================================
// Constants
// ============================================================================

export const DEMO_STORAGE_KEY = 'yidhan-demo-state';
export const DEMO_CONTENT_STORAGE_KEY = 'yidhan-demo-content';

/**
 * A short, stable fingerprint of a string (cyrb53, 53 bits). Retired starter copy is
 * recognised by fingerprint rather than by shipping its text: that text sits on the app
 * shell's path, and the bundle budget has no room for words nobody is shown any more.
 */
function fingerprint(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** What a stored starter is compared on: its title, content and pin, exactly. */
function starterFingerprint(note: Pick<DemoNote, 'title' | 'content' | 'pinned'>): string {
  return fingerprint(JSON.stringify([note.title, note.content, note.pinned]));
}

/**
 * Starters that are no longer offered, by ID, as the fingerprint of what shipped. The
 * first set (books, recipe, weekend) shipped until 2026-09-10; the second (Saturday, what
 * I wanted to say, a passage, the train) until 2026-11-10. A browser that already holds
 * them keeps recognising them as starters: an untouched one is not the reader's work and
 * must never migrate into an account, and an edited one is theirs and is kept exactly as
 * they left it. Any edit at all changes the fingerprint.
 */
const LEGACY_STARTER_FINGERPRINTS: Readonly<Record<string, string>> = {
  'starter-books': '19ciza7d82j',
  'starter-recipe': '2e3hqbz77k8',
  'starter-weekend': '289lka7sm1i',
  'starter-saturday': 'fbm771233o',
  'starter-say': '5etqp1ahmq',
  'starter-passage': '1imwbrvlw45',
  'starter-train': 'klxttobnbp',
};

// IDs of all starter notes for detection, current and legacy
const STARTER_NOTE_IDS = new Set([
  ...STARTER_NOTES.map((n) => n.localId),
  ...Object.keys(LEGACY_STARTER_FINGERPRINTS),
]);

/**
 * Starter copy that shipped in an earlier release and is no longer offered, as content
 * fingerprints.
 *
 * `createDefaultState()` only runs for a browser with no stored state, so correcting
 * the source above left every existing Practice Space still showing the old words. The
 * first welcome note claimed practice drafts were end-to-end encrypted; they are not, and
 * they never were — a practice draft lives in localStorage in the clear. The second was
 * accurate, and was replaced when the landing copy changed on 2026-11-10.
 *
 * A stored note is corrected only when its content matches one of these *exactly*. Any
 * edit at all, however small, means the words are the reader's and are left alone.
 *
 * There is a second consequence worth naming. `hasStarterNoteBeenEdited()` compares
 * against the current copy, so an untouched old starter reads as edited — which makes
 * `hasDemoState()` true and carries the old words into the account on migration.
 * Correcting the content at read time fixes that too.
 */
const SUPERSEDED_STARTER_CONTENT: Readonly<Record<string, readonly string[]>> = {
  'starter-welcome': ['1p2h2uug9xg', 'axmeffbsbu'],
};

/**
 * Replace superseded starter copy with the current wording, in place.
 * Returns true when anything changed, so the caller knows to persist.
 */
function refreshSupersededStarterCopy(state: DemoState): boolean {
  let changed = false;

  for (const note of state.notes) {
    const superseded = SUPERSEDED_STARTER_CONTENT[note.localId];
    if (!superseded?.includes(fingerprint(note.content))) continue;

    const current = STARTER_NOTES.find((s) => s.localId === note.localId);
    if (!current || current.content === note.content) continue;

    note.content = current.content;
    changed = true;
  }

  return changed;
}

/**
 * Replace a legacy starter set with the current one, in place. Only a space with no
 * practice work at all is touched — every note an untouched starter, current or legacy —
 * because that is exactly what a first-time visitor gets. A space holding anything the
 * reader wrote or edited is left alone; its untouched legacy starters stay recognised
 * as starters and never migrate. Returns true when anything changed.
 */
function refreshLegacyStarterSet(state: DemoState): boolean {
  const hasLegacy = state.notes.some((n) => n.localId in LEGACY_STARTER_FINGERPRINTS);
  if (!hasLegacy) return false;
  const pristine = state.notes.every(
    (n) => STARTER_NOTE_IDS.has(n.localId) && !hasStarterNoteBeenEdited(n)
  );
  if (!pristine) return false;

  const fresh = createDefaultState();
  state.notes = fresh.notes;
  const known = new Set(state.tags.map((t) => t.localId));
  for (const tag of fresh.tags) {
    if (!known.has(tag.localId)) state.tags.push(tag);
  }
  return true;
}

// ============================================================================
// Core Storage Operations
// ============================================================================

/**
 * Read demo state from localStorage
 */
export function getDemoState(): DemoState {
  try {
    const stored = localStorage.getItem(DEMO_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as DemoState;
      // Correct any starter note still carrying superseded copy. The state is written
      // back on every read anyway, for lastVisit, so this costs nothing extra.
      refreshSupersededStarterCopy(parsed);
      refreshLegacyStarterSet(parsed);
      // Update last visit timestamp
      parsed.metadata.lastVisit = Date.now();
      saveDemoState(parsed);
      return parsed;
    }
  } catch (e) {
    console.error('Failed to read demo state:', e);
  }

  // Initialize with defaults
  const defaultState = createDefaultState();
  saveDemoState(defaultState);
  return defaultState;
}

/**
 * Save demo state to localStorage
 */
export function saveDemoState(state: DemoState): void {
  try {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save demo state:', e);
    // Handle quota exceeded - could show a message to user
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.warn('localStorage quota exceeded for demo state');
    }
  }
}

/**
 * Check if a starter note has been edited from its default state
 */
function hasStarterNoteBeenEdited(note: DemoNote): boolean {
  const current = STARTER_NOTES.find((s) => s.localId === note.localId);
  if (current) {
    return (
      note.title !== current.title ||
      note.content !== current.content ||
      note.pinned !== current.pinned
    );
  }
  const legacy = LEGACY_STARTER_FINGERPRINTS[note.localId];
  if (!legacy) return false;
  return starterFingerprint(note) !== legacy;
}

/**
 * Whether a set of practice notes contains anything the reader made — a note they
 * created, or a starter they edited. Unedited starters are not their work.
 *
 * Takes notes rather than reading storage so a render can call it freely.
 */
export function hasPracticeWork(
  notes: readonly { id: string; title: string; content: string; pinned: boolean }[]
): boolean {
  return notes.some((note) => {
    if (!STARTER_NOTE_IDS.has(note.id)) return true;

    const original = STARTER_NOTES.find((s) => s.localId === note.id);
    if (!original) return true;
    return (
      note.title !== original.title ||
      note.content !== original.content ||
      note.pinned !== original.pinned
    );
  });
}

/**
 * Check if demo state exists in localStorage
 */
export function hasDemoState(): boolean {
  try {
    const stored = localStorage.getItem(DEMO_STORAGE_KEY);
    if (!stored) return false;
    const parsed = JSON.parse(stored) as DemoState;
    // Has state if: user-created notes exist OR any starter note was edited
    return parsed.notes.some(
      (n) => !STARTER_NOTE_IDS.has(n.localId) || hasStarterNoteBeenEdited(n)
    );
  } catch {
    return false;
  }
}

/**
 * Clear demo state from localStorage
 */
export function clearDemoState(): void {
  localStorage.removeItem(DEMO_STORAGE_KEY);
}

// ============================================================================
// Note Operations
// ============================================================================

/**
 * Create a new demo note
 */
export function createDemoNote(
  note: Omit<DemoNote, 'localId' | 'createdAt' | 'updatedAt'>
): DemoNote {
  const state = getDemoState();
  const now = Date.now();

  const newNote: DemoNote = {
    ...note,
    localId: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };

  state.notes.unshift(newNote);
  state.metadata.totalNotesCreated++;
  saveDemoState(state);

  return newNote;
}

/**
 * Update an existing demo note
 */
export function updateDemoNote(
  localId: string,
  updates: Partial<Omit<DemoNote, 'localId' | 'createdAt'>>
): DemoNote | null {
  const state = getDemoState();
  const index = state.notes.findIndex((n) => n.localId === localId);

  if (index === -1) return null;

  state.notes[index] = {
    ...state.notes[index],
    ...updates,
    updatedAt: Date.now(),
  };

  saveDemoState(state);
  return state.notes[index];
}

/**
 * Delete a demo note
 */
export function deleteDemoNote(localId: string): boolean {
  const state = getDemoState();
  const index = state.notes.findIndex((n) => n.localId === localId);

  if (index === -1) return false;

  state.notes.splice(index, 1);
  saveDemoState(state);
  return true;
}

/** Restore a Practice Space note after a short-lived Undo action. */
export function restoreDemoNote(note: DemoNote): boolean {
  const state = getDemoState();
  if (state.notes.some((existing) => existing.localId === note.localId)) return false;

  state.notes.unshift(note);
  saveDemoState(state);
  return true;
}

/**
 * Get a single demo note by localId
 */
export function getDemoNote(localId: string): DemoNote | null {
  const state = getDemoState();
  return state.notes.find((n) => n.localId === localId) ?? null;
}

// ============================================================================
// Tag Operations
// ============================================================================

/**
 * Create a new demo tag
 */
export function createDemoTag(tag: Omit<DemoTag, 'localId' | 'createdAt'>): DemoTag {
  const state = getDemoState();

  const newTag: DemoTag = {
    ...tag,
    localId: crypto.randomUUID(),
    createdAt: Date.now(),
  };

  state.tags.push(newTag);
  saveDemoState(state);

  return newTag;
}

/**
 * Update an existing demo tag
 */
export function updateDemoTag(
  localId: string,
  updates: Partial<Omit<DemoTag, 'localId' | 'createdAt'>>
): DemoTag | null {
  const state = getDemoState();
  const index = state.tags.findIndex((t) => t.localId === localId);

  if (index === -1) return null;

  state.tags[index] = {
    ...state.tags[index],
    ...updates,
  };

  saveDemoState(state);
  return state.tags[index];
}

/**
 * Delete a demo tag (also removes from all notes)
 */
export function deleteDemoTag(localId: string): boolean {
  const state = getDemoState();
  const index = state.tags.findIndex((t) => t.localId === localId);

  if (index === -1) return false;

  // Remove tag from all notes
  state.notes.forEach((note) => {
    note.tagIds = note.tagIds.filter((id) => id !== localId);
  });

  state.tags.splice(index, 1);
  saveDemoState(state);
  return true;
}

// ============================================================================
// Note-Tag Operations
// ============================================================================

/**
 * Add a tag to a note
 */
export function addTagToDemoNote(noteLocalId: string, tagLocalId: string): boolean {
  const state = getDemoState();
  const note = state.notes.find((n) => n.localId === noteLocalId);
  const tag = state.tags.find((t) => t.localId === tagLocalId);

  if (!note || !tag) return false;
  if (note.tagIds.includes(tagLocalId)) return true; // Already has tag

  note.tagIds.push(tagLocalId);
  note.updatedAt = Date.now();
  saveDemoState(state);
  return true;
}

/**
 * Remove a tag from a note
 */
export function removeTagFromDemoNote(noteLocalId: string, tagLocalId: string): boolean {
  const state = getDemoState();
  const note = state.notes.find((n) => n.localId === noteLocalId);

  if (!note) return false;

  const index = note.tagIds.indexOf(tagLocalId);
  if (index === -1) return false;

  note.tagIds.splice(index, 1);
  note.updatedAt = Date.now();
  saveDemoState(state);
  return true;
}

// ============================================================================
// Metadata Operations
// ============================================================================

/**
 * Dismiss the soft signup prompt
 */
export function dismissDemoPrompt(): void {
  const state = getDemoState();
  state.metadata.promptDismissedAt = Date.now();
  saveDemoState(state);
}

/**
 * Dismiss the impermanence ribbon
 */
export function dismissDemoRibbon(): void {
  const state = getDemoState();
  state.metadata.ribbonDismissedAt = Date.now();
  saveDemoState(state);
}

// ============================================================================
// Migration (Demo → Authenticated Account)
// ============================================================================

/**
 * Get demo data for migration (does not clear state - caller should do that after successful migration)
 */
export function getDemoDataForMigration(): {
  notes: DemoNote[];
  tags: DemoTag[];
} {
  const state = getDemoState();
  return {
    // Migration only runs when hasDemoState() is true (user has created or edited notes).
    // Exclude unedited starters so only the user's real work migrates.
    notes: state.notes.filter(
      (n) => !STARTER_NOTE_IDS.has(n.localId) || hasStarterNoteBeenEdited(n)
    ),
    tags: state.tags,
  };
}
