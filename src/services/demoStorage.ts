/**
 * Demo Storage Service
 *
 * Manages localStorage persistence for the demo writing experience.
 * Notes and tags are stored locally until user signs up, then migrated to Supabase.
 */

import type { TagColor } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface DemoNote {
  localId: string;
  title: string;
  content: string; // HTML from Tiptap
  pinned: boolean;
  tagIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface DemoTag {
  localId: string;
  name: string;
  color: TagColor;
  createdAt: number;
}

export interface DemoMetadata {
  createdAt: number; // First demo session timestamp
  lastVisit: number; // Last activity timestamp
  totalNotesCreated: number; // Cumulative notes created (for soft prompt)
  promptDismissedAt: number | null; // When soft prompt was dismissed
  ribbonDismissedAt: number | null; // When impermanence ribbon was dismissed
}

export interface DemoState {
  version: number;
  notes: DemoNote[];
  tags: DemoTag[];
  metadata: DemoMetadata;
}

// ============================================================================
// Constants
// ============================================================================

export const DEMO_STORAGE_KEY = 'zenote-demo-state';
export const DEMO_STORAGE_VERSION = 1;

const DEFAULT_WELCOME_NOTE: DemoNote = {
  localId: 'welcome-note',
  title: 'Welcome to your practice space',
  content: `<p>This is your quiet corner for writing. Everything you create here is saved in your browser.</p>
<h2>Try these features</h2>
<ul>
  <li>Type <code>/</code> for slash commands</li>
  <li>Press <code>Cmd+N</code> to create a new note</li>
  <li>Add tags to organize your thoughts</li>
  <li>Pin important notes to the top</li>
</ul>
<p>When you're ready, create an account to sync across devices.</p>`,
  pinned: false,
  tagIds: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const DEFAULT_TAGS: DemoTag[] = [
  { localId: 'tag-journal', name: 'Journal', color: 'terracotta', createdAt: Date.now() },
  { localId: 'tag-ideas', name: 'Ideas', color: 'gold', createdAt: Date.now() },
];

function createDefaultState(): DemoState {
  const now = Date.now();
  return {
    version: DEMO_STORAGE_VERSION,
    notes: [{ ...DEFAULT_WELCOME_NOTE, createdAt: now, updatedAt: now }],
    tags: DEFAULT_TAGS.map((tag) => ({ ...tag, createdAt: now })),
    metadata: {
      createdAt: now,
      lastVisit: now,
      totalNotesCreated: 1,
      promptDismissedAt: null,
      ribbonDismissedAt: null,
    },
  };
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
 * Check if a welcome note has been edited from its default state
 */
function hasWelcomeNoteBeenEdited(note: DemoNote): boolean {
  if (note.localId !== 'welcome-note') return false;
  return (
    note.title !== DEFAULT_WELCOME_NOTE.title ||
    note.content !== DEFAULT_WELCOME_NOTE.content ||
    note.pinned !== DEFAULT_WELCOME_NOTE.pinned ||
    note.tagIds.length > 0
  );
}

/**
 * Check if demo state exists in localStorage
 */
export function hasDemoState(): boolean {
  try {
    const stored = localStorage.getItem(DEMO_STORAGE_KEY);
    if (!stored) return false;
    const parsed = JSON.parse(stored) as DemoState;
    // Has state if: user-created notes exist OR welcome note was edited
    return parsed.notes.some(
      (n) => n.localId !== 'welcome-note' || hasWelcomeNoteBeenEdited(n)
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
    // Include welcome note only if it has been edited, exclude if unchanged
    notes: state.notes.filter(
      (n) => n.localId !== 'welcome-note' || hasWelcomeNoteBeenEdited(n)
    ),
    tags: state.tags,
  };
}
