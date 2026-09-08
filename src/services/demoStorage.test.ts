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
