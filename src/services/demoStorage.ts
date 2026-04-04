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

export const DEMO_STORAGE_KEY = 'yidhan-demo-state';
export const DEMO_STORAGE_VERSION = 1;

const STARTER_NOTES: DemoNote[] = [
  {
    localId: 'starter-welcome',
    title: 'Welcome to Yidhan',
    content: `<p>A calm space for your thoughts. Pin important notes, organize with tags, and write in focus mode.</p>
<p>Your notes are end-to-end encrypted — only you can read them.</p>`,
    pinned: true,
    tagIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    localId: 'starter-books',
    title: 'Book Recommendations',
    content: `<p>Books people keep telling me to read:</p>
<ul>
<li>Atomic Habits</li>
<li>The Almanack of Naval Ravikant</li>
<li>Four Thousand Weeks</li>
</ul>
<p>Started Four Thousand Weeks last night. The bit about how we'll never "get on top of everything" was oddly freeing.</p>`,
    pinned: false,
    tagIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    localId: 'starter-recipe',
    title: 'Recipe — Overnight Oats',
    content: `<p>Equal parts oats and milk. Spoon of yogurt, pinch of salt, honey to taste. Mix, fridge overnight. Top with whatever fruit is around.</p>
<p>The trick is the salt — makes everything else pop.</p>`,
    pinned: false,
    tagIds: ['tag-recipes'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    localId: 'starter-weekend',
    title: 'Weekend Plans',
    content: `<ul>
<li>Farmers market Saturday morning</li>
<li>Fix the kitchen shelf (finally)</li>
<li>Try that new coffee place on 5th</li>
</ul>`,
    pinned: false,
    tagIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

// IDs of all starter notes for detection
const STARTER_NOTE_IDS = new Set(STARTER_NOTES.map((n) => n.localId));

const DEFAULT_TAGS: DemoTag[] = [
  { localId: 'tag-journal', name: 'Journal', color: 'terracotta', createdAt: Date.now() },
  { localId: 'tag-ideas', name: 'Ideas', color: 'gold', createdAt: Date.now() },
  { localId: 'tag-recipes', name: 'Recipes', color: 'sage', createdAt: Date.now() },
];

function createDefaultState(): DemoState {
  const now = Date.now();
  // Stagger timestamps so notes appear in the right temporal order
  return {
    version: DEMO_STORAGE_VERSION,
    notes: STARTER_NOTES.map((note, i) => ({
      ...note,
      createdAt: now - i * 60_000, // 1 minute apart, newest first
      updatedAt: now - i * 60_000,
    })),
    tags: DEFAULT_TAGS.map((tag) => ({ ...tag, createdAt: now })),
    metadata: {
      createdAt: now,
      lastVisit: now,
      totalNotesCreated: STARTER_NOTES.length,
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
 * Check if a starter note has been edited from its default state
 */
function hasStarterNoteBeenEdited(note: DemoNote): boolean {
  const original = STARTER_NOTES.find((s) => s.localId === note.localId);
  if (!original) return false;
  return (
    note.title !== original.title ||
    note.content !== original.content ||
    note.pinned !== original.pinned
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
