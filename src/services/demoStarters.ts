/**
 * The Practice Space's starter notes and default state, apart from the storage code
 * in demoStorage.ts. The landing page hero renders these, so this module is on its
 * critical path; the reads, writes, migration and legacy-copy repair are not, and stay
 * in demoStorage.ts (item 61, step 5).
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
// Starters
// ============================================================================

const DEMO_STORAGE_VERSION = 1;

/**
 * The note shown in the landing page hero. It is a starter too, so the page and the
 * Practice Space agree about what the first note looks like.
 */
export const HERO_STARTER_NOTE_ID = 'starter-opening';

export const STARTER_NOTES: DemoNote[] = [
  {
    localId: 'starter-welcome',
    title: 'Welcome to Yidhan',
    content: `<p>This is the Practice Space. Write, edit and tag notes to see how it works.</p>
<p>Notes here are saved in this browser and are not encrypted. Sign up to encrypt and sync them.</p>`,
    pinned: true,
    tagIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    localId: HERO_STARTER_NOTE_ID,
    title: 'Opening draft',
    content: `<p>By nine, everyone in the building had received the same letter. Except Sam.</p>
<p>He checked the empty mailbox again, then knocked on his neighbour’s door.</p>
<p>[Try starting with the knock. Explain the letter later.]</p>`,
    pinned: false,
    tagIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    localId: 'starter-used-books',
    title: 'Why I still buy used books',
    content: `<p>Start with the cookbook with handwritten substitutions.</p>
<p>Main point: someone else has already tested what’s on the page.</p>
<p>Find another example. The ending repeats the introduction.</p>`,
    pinned: false,
    tagIds: ['tag-ideas'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    localId: 'starter-revision',
    title: 'Revision notes',
    content: `<p>The opening takes too long. Start at the station.</p>
<p>Cut the second explanation of why she left.</p>
<p>Read the dialogue aloud. Both characters sound the same.</p>`,
    pinned: false,
    tagIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    localId: 'starter-tuesday',
    title: 'Tuesday',
    content: `<p>Tried writing before checking email. Finished the opening section in about half an hour.</p>
<p>Still stuck on the ending. Tomorrow, read the whole draft before changing anything.</p>`,
    pinned: false,
    tagIds: ['tag-journal'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

const DEFAULT_TAGS: DemoTag[] = [
  { localId: 'tag-journal', name: 'Journal', color: 'terracotta', createdAt: Date.now() },
  { localId: 'tag-ideas', name: 'Ideas', color: 'gold', createdAt: Date.now() },
  { localId: 'tag-reading', name: 'Reading', color: 'sage', createdAt: Date.now() },
];

export function createDefaultState(): DemoState {
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

export function createDemoStarterPreviewState(): DemoState {
  return createDefaultState();
}

