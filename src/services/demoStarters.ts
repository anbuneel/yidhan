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
export const HERO_STARTER_NOTE_ID = 'starter-saturday';

export const STARTER_NOTES: DemoNote[] = [
  {
    localId: 'starter-welcome',
    title: 'Welcome to Yidhan',
    content: `<p>A calm space for your thoughts. Pin important notes, organize with tags, and write in focus mode.</p>
<p>Practice drafts are saved on this device and are not encrypted. Sign up and set up your vault to encrypt your notes.</p>`,
    pinned: true,
    tagIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    localId: HERO_STARTER_NOTE_ID,
    title: 'An idea for Saturday',
    content: `<p>Leave the morning unplanned.</p>
<p>Walk to the market. Pick up something for lunch. Take the longer way home.</p>
<p>Maybe that is enough.</p>`,
    pinned: false,
    tagIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    localId: 'starter-say',
    title: 'What I wanted to say',
    content: `<p>I do not need an answer yet. I just need to put this into words before it turns into something else.</p>`,
    pinned: false,
    tagIds: ['tag-journal'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    localId: 'starter-passage',
    title: 'A passage worth keeping',
    content: `<p>“Attention is the rarest and purest form of generosity.” — Simone Weil</p>
<p>Something to come back to when the week gets loud.</p>`,
    pinned: false,
    tagIds: ['tag-reading'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    localId: 'starter-train',
    title: 'Tuesday, on the train',
    content: `<p>Three things I keep circling: the flat, October, whether to say yes to the Sunday thing. Not deciding today.</p>`,
    pinned: false,
    tagIds: [],
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

