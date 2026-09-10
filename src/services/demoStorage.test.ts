import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEMO_STORAGE_KEY,
  createDemoNote,
  createDemoStarterPreviewState,
  getDemoState,
  hasDemoState,
  hasPracticeWork,
  getDemoDataForMigration,
  updateDemoNote,
  deleteDemoNote,
  restoreDemoNote,
  type DemoState,
} from './demoStorage';

/** The welcome note as it shipped before the copy was corrected. */
const OLD_WELCOME_CONTENT = `<p>A calm space for your thoughts. Pin important notes, organize with tags, and write in focus mode.</p>
<p>Your notes are end-to-end encrypted — only you can read them.</p>`;

function seedState(mutate: (state: DemoState) => void): void {
  const state = createDemoStarterPreviewState();
  mutate(state);
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
}

function welcomeNote(state: DemoState) {
  return state.notes.find((n) => n.localId === 'starter-welcome')!;
}

describe('starter copy correction (item 152)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('replaces the superseded encryption claim in an untouched starter', () => {
    seedState((state) => {
      welcomeNote(state).content = OLD_WELCOME_CONTENT;
    });

    const content = welcomeNote(getDemoState()).content;

    expect(content).not.toContain('end-to-end encrypted');
    expect(content).toContain('not encrypted');
  });

  it('persists the correction, so it happens once rather than on every read', () => {
    seedState((state) => {
      welcomeNote(state).content = OLD_WELCOME_CONTENT;
    });

    getDemoState();

    const stored = JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY)!) as DemoState;
    expect(welcomeNote(stored).content).not.toContain('end-to-end encrypted');
  });

  it('leaves a starter the reader has edited exactly as they left it', () => {
    const edited = `${OLD_WELCOME_CONTENT}\n<p>My own thought.</p>`;
    seedState((state) => {
      welcomeNote(state).content = edited;
    });

    expect(welcomeNote(getDemoState()).content).toBe(edited);
  });

  it('leaves a starter replaced outright alone', () => {
    seedState((state) => {
      welcomeNote(state).content = '<p>Entirely my own words.</p>';
    });

    expect(welcomeNote(getDemoState()).content).toBe('<p>Entirely my own words.</p>');
  });

  it('does not touch the reader’s own notes', () => {
    seedState((state) => {
      welcomeNote(state).content = OLD_WELCOME_CONTENT;
      state.notes.push({
        localId: 'mine',
        title: 'Mine',
        content: OLD_WELCOME_CONTENT,
        pinned: false,
        tagIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const state = getDemoState();
    expect(state.notes.find((n) => n.localId === 'mine')!.content).toBe(OLD_WELCOME_CONTENT);
  });

  it('leaves a current starter untouched', () => {
    const before = welcomeNote(createDemoStarterPreviewState()).content;
    seedState(() => {});

    expect(welcomeNote(getDemoState()).content).toBe(before);
  });

  it('preserves the starter’s pin state and timestamps while correcting it', () => {
    let createdAt = 0;
    seedState((state) => {
      const note = welcomeNote(state);
      note.content = OLD_WELCOME_CONTENT;
      createdAt = note.createdAt;
    });

    const note = welcomeNote(getDemoState());
    expect(note.pinned).toBe(true);
    expect(note.createdAt).toBe(createdAt);
  });

  it('stops an untouched old starter from reading as the reader’s work', () => {
    // Before the correction, an old starter differed from the current copy, so it
    // looked edited — which carried the false encryption claim into the account.
    seedState((state) => {
      welcomeNote(state).content = OLD_WELCOME_CONTENT;
    });

    getDemoState();

    expect(hasDemoState()).toBe(false);
    expect(getDemoDataForMigration().notes).toHaveLength(0);
  });

  it('still migrates a genuinely edited starter', () => {
    seedState(() => {});
    updateDemoNote('starter-welcome', { content: '<p>My words.</p>' });

    expect(hasDemoState()).toBe(true);
    expect(getDemoDataForMigration().notes.map((n) => n.localId)).toEqual(['starter-welcome']);
  });
});

describe('Practice Space deletion', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('restores an undone note with its original identity, tags, and timestamps', () => {
    const created = createDemoNote({
      title: 'Keep this thought',
      content: '<p>Still here</p>',
      pinned: true,
      tagIds: ['tag-ideas'],
    });

    expect(deleteDemoNote(created.localId)).toBe(true);
    expect(restoreDemoNote(created)).toBe(true);

    expect(getDemoState().notes[0]).toEqual(created);
  });
});

describe('hasPracticeWork', () => {
  const starters = createDemoStarterPreviewState().notes.map((n) => ({
    id: n.localId,
    title: n.title,
    content: n.content,
    pinned: n.pinned,
  }));

  it('is false for untouched starters', () => {
    expect(hasPracticeWork(starters)).toBe(false);
  });

  it('is false for no notes at all', () => {
    expect(hasPracticeWork([])).toBe(false);
  });

  it('is true once the reader creates a note', () => {
    expect(
      hasPracticeWork([...starters, { id: 'mine', title: '', content: '', pinned: false }])
    ).toBe(true);
  });

  it('is true when a starter is edited', () => {
    const edited = starters.map((n) =>
      n.id === 'starter-welcome' ? { ...n, content: '<p>Changed.</p>' } : n
    );
    expect(hasPracticeWork(edited)).toBe(true);
  });

  it('counts unpinning a starter as work', () => {
    const unpinned = starters.map((n) =>
      n.id === 'starter-welcome' ? { ...n, pinned: false } : n
    );
    expect(hasPracticeWork(unpinned)).toBe(true);
  });
});

describe('carrying practice work into an account (item 46)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('offers the reader’s first note to the migration, and no starters with it', () => {
    seedState(() => {});
    createDemoNote({ title: 'First thought', content: '<p>Mine.</p>', pinned: false, tagIds: [] });

    const { notes } = getDemoDataForMigration();

    expect(notes.map((n) => n.title)).toEqual(['First thought']);
  });

  it('carries the reader’s note even when they arrived through /demo/new', () => {
    // The arrival note is created empty and typed into, which is exactly the shape
    // the mobile "Start writing" path produces.
    seedState(() => {});
    const arrival = createDemoNote({ title: '', content: '', pinned: false, tagIds: [] });
    updateDemoNote(arrival.localId, { title: 'On the train', content: '<p>Half a thought.</p>' });

    const { notes } = getDemoDataForMigration();

    expect(notes).toHaveLength(1);
    expect(notes[0].content).toBe('<p>Half a thought.</p>');
  });

  it('has nothing to keep before the reader writes anything', () => {
    seedState(() => {});

    expect(hasDemoState()).toBe(false);
    expect(getDemoDataForMigration().notes).toHaveLength(0);
  });

  it('keeps the tags a migrated note refers to', () => {
    seedState(() => {});
    createDemoNote({
      title: 'Tagged',
      content: '<p>x</p>',
      pinned: false,
      tagIds: ['tag-journal'],
    });

    const { notes, tags } = getDemoDataForMigration();

    expect(notes[0].tagIds).toEqual(['tag-journal']);
    expect(tags.map((t) => t.localId)).toContain('tag-journal');
  });
});

describe('legacy starters in an existing Practice Space', () => {
  /** The three starters that shipped before 2026-09-10, byte-for-byte. */
  const LEGACY = [
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
      tagIds: ['tag-ideas'],
    },
    {
      localId: 'starter-recipe',
      title: 'Recipe — Overnight Oats',
      content: `<p>Equal parts oats and milk. Spoon of yogurt, pinch of salt, honey to taste. Mix, fridge overnight. Top with whatever fruit is around.</p>
<p>The trick is the salt — makes everything else pop.</p>`,
      tagIds: ['tag-recipes'],
    },
    {
      localId: 'starter-weekend',
      title: 'Weekend Plans',
      content: `<ul>
<li>Farmers market Saturday morning</li>
<li>Fix the kitchen shelf (finally)</li>
<li>Try that new coffee place on 5th</li>
</ul>`,
      tagIds: ['tag-journal'],
    },
  ];

  /** A stored space exactly as the previous release created it. */
  function seedLegacySpace(mutate: (state: DemoState) => void = () => {}): void {
    seedState((state) => {
      const welcome = welcomeNote(state);
      const now = Date.now();
      state.notes = [
        welcome,
        ...LEGACY.map((n, i) => ({
          ...n,
          pinned: false,
          createdAt: now - (i + 1) * 60_000,
          updatedAt: now - (i + 1) * 60_000,
        })),
      ];
      state.tags = state.tags
        .filter((t) => t.localId !== 'tag-reading')
        .concat({ localId: 'tag-recipes', name: 'Recipes', color: 'sage', createdAt: now });
      mutate(state);
    });
  }

  beforeEach(() => {
    localStorage.clear();
  });

  it('never counts untouched legacy starters as the reader’s work', () => {
    seedLegacySpace();

    expect(hasDemoState()).toBe(false);
    expect(getDemoDataForMigration().notes).toHaveLength(0);
  });

  it('keeps an edited legacy starter as the reader’s, and only that one', () => {
    seedLegacySpace((state) => {
      state.notes.find((n) => n.localId === 'starter-recipe')!.content = '<p>Add cinnamon.</p>';
    });

    expect(hasDemoState()).toBe(true);
    const { notes } = getDemoDataForMigration();
    expect(notes.map((n) => n.localId)).toEqual(['starter-recipe']);
    expect(notes[0].content).toBe('<p>Add cinnamon.</p>');
    // The edited note survives the read untouched, and its untouched siblings stay put.
    expect(getDemoState().notes.map((n) => n.localId)).toEqual([
      'starter-welcome',
      'starter-books',
      'starter-recipe',
      'starter-weekend',
    ]);
  });

  it('refreshes a pristine legacy space to the current starters and tags', () => {
    seedLegacySpace();

    const state = getDemoState();

    expect(state.notes.map((n) => n.localId)).toEqual(
      createDemoStarterPreviewState().notes.map((n) => n.localId)
    );
    expect(state.tags.map((t) => t.localId)).toContain('tag-reading');
    // The reader's existing tags are not taken away.
    expect(state.tags.map((t) => t.localId)).toContain('tag-recipes');
    expect(hasDemoState()).toBe(false);
  });

  it('leaves a legacy space alone once the reader has written anything', () => {
    seedLegacySpace((state) => {
      state.notes.push({
        localId: 'mine',
        title: 'On the train',
        content: '<p>Half a thought.</p>',
        pinned: false,
        tagIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const state = getDemoState();

    expect(state.notes.map((n) => n.localId)).toContain('mine');
    expect(state.notes.map((n) => n.localId)).toContain('starter-books');
    expect(state.notes.map((n) => n.localId)).not.toContain('starter-saturday');
    expect(getDemoDataForMigration().notes.map((n) => n.localId)).toEqual(['mine']);
  });
});
