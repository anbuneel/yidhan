import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  compareNotes,
  getChapterForDate,
  groupNotesByChapter,
  getDefaultExpansionState,
  getChapterLabel,
  getChapterOrder,
  getTemporalChapterOrder,
  CHAPTER_LABELS,
  CHAPTER_BASIS_VALUES,
  NOTE_SORT_VALUES,
  DEFAULT_ARRANGEMENT,
  isChapterBasis,
  isNoteSortKey,
  type ChapterArrangement,
  type ChapterKey,
} from './temporalGrouping';
import { createMockNote, createMockNoteWithDate } from '../test/factories';
import type { Note } from '../types';

describe('temporalGrouping', () => {
  // Fix the current date for consistent tests
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getChapterForDate', () => {
    it('returns "thisWeek" for today', () => {
      const today = new Date('2024-01-15T10:00:00');
      expect(getChapterForDate(today)).toBe('thisWeek');
    });

    it('returns "thisWeek" for 7 days ago', () => {
      const sevenDaysAgo = new Date('2024-01-08T10:00:00');
      expect(getChapterForDate(sevenDaysAgo)).toBe('thisWeek');
    });

    it('returns "lastWeek" for 8 days ago', () => {
      const eightDaysAgo = new Date('2024-01-07T10:00:00');
      expect(getChapterForDate(eightDaysAgo)).toBe('lastWeek');
    });

    it('returns "lastWeek" for 14 days ago', () => {
      const fourteenDaysAgo = new Date('2024-01-01T10:00:00');
      expect(getChapterForDate(fourteenDaysAgo)).toBe('lastWeek');
    });

    it('returns "thisMonth" for 15 days ago', () => {
      const fifteenDaysAgo = new Date('2023-12-31T10:00:00');
      expect(getChapterForDate(fifteenDaysAgo)).toBe('thisMonth');
    });

    it('returns "thisMonth" for 30 days ago', () => {
      const thirtyDaysAgo = new Date('2023-12-16T10:00:00');
      expect(getChapterForDate(thirtyDaysAgo)).toBe('thisMonth');
    });

    it('returns "earlier" for 31 days ago', () => {
      const thirtyOneDaysAgo = new Date('2023-12-15T10:00:00');
      expect(getChapterForDate(thirtyOneDaysAgo)).toBe('earlier');
    });

    it('returns "earlier" for 90 days ago', () => {
      const ninetyDaysAgo = new Date('2023-10-17T10:00:00');
      expect(getChapterForDate(ninetyDaysAgo)).toBe('earlier');
    });

    it('returns "archive" for 91 days ago', () => {
      const ninetyOneDaysAgo = new Date('2023-10-16T10:00:00');
      expect(getChapterForDate(ninetyOneDaysAgo)).toBe('archive');
    });

    it('returns "archive" for very old dates', () => {
      const veryOld = new Date('2020-01-01T10:00:00');
      expect(getChapterForDate(veryOld)).toBe('archive');
    });
  });

  describe('groupNotesByChapter', () => {
    it('returns empty array for empty notes', () => {
      const result = groupNotesByChapter([]);
      expect(result).toEqual([]);
    });

    it('groups a single note into the correct chapter', () => {
      const note = createMockNote({ updatedAt: new Date('2024-01-15T10:00:00') });
      const result = groupNotesByChapter([note]);

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('thisWeek');
      expect(result[0].notes).toHaveLength(1);
      expect(result[0].notes[0].id).toBe(note.id);
    });

    it('separates pinned notes into their own chapter', () => {
      const pinnedNote = createMockNote({
        pinned: true,
        updatedAt: new Date('2024-01-15T10:00:00'),
      });
      const unpinnedNote = createMockNote({
        pinned: false,
        updatedAt: new Date('2024-01-15T10:00:00'),
      });

      const result = groupNotesByChapter([pinnedNote, unpinnedNote]);

      expect(result).toHaveLength(2);
      expect(result[0].key).toBe('pinned');
      expect(result[0].isPinned).toBe(true);
      expect(result[0].notes).toHaveLength(1);
      expect(result[1].key).toBe('thisWeek');
      expect(result[1].notes).toHaveLength(1);
    });

    it('puts pinned chapter first regardless of note dates', () => {
      const oldPinnedNote = createMockNote({
        pinned: true,
        updatedAt: new Date('2020-01-01T10:00:00'),
      });
      const recentNote = createMockNote({
        pinned: false,
        updatedAt: new Date('2024-01-15T10:00:00'),
      });

      const result = groupNotesByChapter([recentNote, oldPinnedNote]);

      expect(result[0].key).toBe('pinned');
      expect(result[1].key).toBe('thisWeek');
    });

    it('groups notes into multiple temporal chapters', () => {
      const thisWeekNote = createMockNoteWithDate(0);
      const lastWeekNote = createMockNoteWithDate(10);
      const archiveNote = createMockNoteWithDate(120);

      const result = groupNotesByChapter([thisWeekNote, lastWeekNote, archiveNote]);

      expect(result).toHaveLength(3);
      expect(result[0].key).toBe('thisWeek');
      expect(result[1].key).toBe('lastWeek');
      expect(result[2].key).toBe('archive');
    });

    it('omits empty chapters (honest presence)', () => {
      // Only create notes for thisWeek and archive
      const thisWeekNote = createMockNoteWithDate(0);
      const archiveNote = createMockNoteWithDate(120);

      const result = groupNotesByChapter([thisWeekNote, archiveNote]);

      // Should only have 2 chapters, not all 5 temporal chapters
      expect(result).toHaveLength(2);
      expect(result.map((c) => c.key)).toEqual(['thisWeek', 'archive']);
    });

    it('maintains temporal chapter order', () => {
      const notes = [
        createMockNoteWithDate(120), // archive
        createMockNoteWithDate(0), // thisWeek
        createMockNoteWithDate(50), // earlier
        createMockNoteWithDate(10), // lastWeek
        createMockNoteWithDate(20), // thisMonth
      ];

      const result = groupNotesByChapter(notes);

      const keys = result.map((c) => c.key);
      expect(keys).toEqual(['thisWeek', 'lastWeek', 'thisMonth', 'earlier', 'archive']);
    });

    it('includes correct labels for each chapter', () => {
      const pinnedNote = createMockNote({ pinned: true });
      const thisWeekNote = createMockNoteWithDate(0);

      const result = groupNotesByChapter([pinnedNote, thisWeekNote]);

      expect(result[0].label).toBe('Pinned');
      expect(result[1].label).toBe('This Week');
    });
  });

  describe('groupNotesByChapter arrangement', () => {
    /** Every combination the reader can choose, for the invariants that hold across all. */
    const ALL_ARRANGEMENTS: ChapterArrangement[] = CHAPTER_BASIS_VALUES.flatMap((basis) =>
      NOTE_SORT_VALUES.map((sort) => ({ basis, sort }))
    );

    const chapterOf = (notes: Note[], id: string, arrangement?: Partial<ChapterArrangement>) =>
      groupNotesByChapter(notes, arrangement).find((chapter) =>
        chapter.notes.some((note) => note.id === id)
      )?.key;

    const idsOf = (notes: Note[], arrangement?: Partial<ChapterArrangement>) =>
      groupNotesByChapter(notes, arrangement).flatMap((chapter) =>
        chapter.notes.map((note) => note.id)
      );

    describe('chapter basis', () => {
      it('groups by last edited when no arrangement is given', () => {
        // Existing callers pass nothing; the library must behave exactly as before.
        const revived = createMockNoteWithDate(40, { updatedAt: new Date('2024-01-15T09:00:00') });

        const result = groupNotesByChapter([revived]);

        expect(result.map((c) => c.key)).toEqual(['thisWeek']);
      });

      it('groups by last edited when the basis is "updated"', () => {
        const revived = createMockNoteWithDate(40, { updatedAt: new Date('2024-01-15T09:00:00') });

        const result = groupNotesByChapter([revived], { basis: 'updated' });

        expect(result.map((c) => c.key)).toEqual(['thisWeek']);
      });

      it('leaves an edited old note in its original chapter when the basis is "created"', () => {
        // The item's "done when": editing an old note does not drag it into This Week.
        const revived = createMockNoteWithDate(40, { updatedAt: new Date('2024-01-15T09:00:00') });

        const result = groupNotesByChapter([revived], { basis: 'created' });

        expect(result.map((c) => c.key)).toEqual(['earlier']);
      });

      it('moves nothing when both timestamps sit in the same chapter', () => {
        const notes = [createMockNoteWithDate(2), createMockNoteWithDate(40)];

        expect(idsOf(notes, { basis: 'updated' })).toEqual(idsOf(notes, { basis: 'created' }));
      });

      it('falls back to the edit date when a note has no usable created date', () => {
        // An invalid date reads as the epoch, which would silently mean Archive.
        const broken = createMockNoteWithDate(2, { createdAt: new Date('nonsense') });

        const result = groupNotesByChapter([broken], { basis: 'created' });

        expect(result.map((c) => c.key)).toEqual(['thisWeek']);
      });

      it('keeps the default when an unknown arrangement value is asked for', () => {
        expect(isChapterBasis('sideways')).toBe(false);
        expect(isNoteSortKey('sideways')).toBe(false);
        expect(isChapterBasis(DEFAULT_ARRANGEMENT.basis)).toBe(true);
        expect(isNoteSortKey(DEFAULT_ARRANGEMENT.sort)).toBe(true);
      });
    });

    describe('what the basis must not touch', () => {
      it('keeps a pinned note in Pinned under either basis', () => {
        // Pinned is not a temporal chapter, so no timestamp may move a note out of it.
        const pinned = createMockNoteWithDate(200, {
          pinned: true,
          updatedAt: new Date('2024-01-15T09:00:00'),
        });

        for (const basis of CHAPTER_BASIS_VALUES) {
          const result = groupNotesByChapter([pinned], { basis });
          expect(result.map((c) => c.key)).toEqual(['pinned']);
        }
      });

      it('keeps Pinned first even when the basis would order chapters differently', () => {
        const pinned = createMockNoteWithDate(200, { pinned: true });
        const recent = createMockNoteWithDate(1);

        for (const basis of CHAPTER_BASIS_VALUES) {
          const result = groupNotesByChapter([pinned, recent], { basis });
          expect(result.map((c) => c.key)).toEqual(['pinned', 'thisWeek']);
        }
      });

      it('shows every note exactly once under every arrangement', () => {
        // A note whose two timestamps disagree is the one that could be lost or doubled.
        const notes = [
          createMockNoteWithDate(40, { id: 'revived', updatedAt: new Date('2024-01-15T09:00:00') }),
          createMockNoteWithDate(0, { id: 'fresh' }),
          createMockNoteWithDate(120, { id: 'old' }),
          createMockNoteWithDate(200, { id: 'pinned-old', pinned: true }),
          createMockNoteWithDate(9, { id: 'last-week' }),
        ];

        for (const arrangement of ALL_ARRANGEMENTS) {
          const ids = idsOf(notes, arrangement);
          expect(new Set(ids).size).toBe(notes.length);
          expect([...ids].sort()).toEqual(notes.map((n) => n.id).sort());
        }
      });

      it('never drops a search result, whatever the arrangement', () => {
        // The library hands grouping an already-filtered list. Grouping only reorders.
        const matches = [
          createMockNoteWithDate(40, { id: 'match-a', title: 'Kyoto', updatedAt: new Date('2024-01-15T09:00:00') }),
          createMockNoteWithDate(1, { id: 'match-b', title: 'Kyoto again' }),
          createMockNoteWithDate(300, { id: 'match-c', title: '' }),
        ];

        for (const arrangement of ALL_ARRANGEMENTS) {
          expect([...idsOf(matches, arrangement)].sort()).toEqual(['match-a', 'match-b', 'match-c']);
        }
      });

      it('does not change chapter membership when only the sort changes', () => {
        const notes = [
          createMockNoteWithDate(1, { id: 'a', title: 'Zebra' }),
          createMockNoteWithDate(20, { id: 'b', title: 'Apple' }),
          createMockNoteWithDate(120, { id: 'c', title: 'Mango' }),
        ];

        for (const sort of NOTE_SORT_VALUES) {
          expect(chapterOf(notes, 'a', { sort })).toBe('thisWeek');
          expect(chapterOf(notes, 'b', { sort })).toBe('thisMonth');
          expect(chapterOf(notes, 'c', { sort })).toBe('archive');
        }
      });

      it('does not reorder the array it was handed', () => {
        // `useVisibleNotes` memoizes the list it passes in; sorting it in place would
        // corrupt that cache for every other reader of it.
        const notes = [
          createMockNoteWithDate(1, { id: 'a', title: 'Zebra' }),
          createMockNoteWithDate(2, { id: 'b', title: 'Apple' }),
        ];

        groupNotesByChapter(notes, { sort: 'title' });

        expect(notes.map((n) => n.id)).toEqual(['a', 'b']);
      });
    });

    describe('within-chapter order', () => {
      it('puts the newest edit first by default', () => {
        const older = createMockNoteWithDate(3, { id: 'older' });
        const newer = createMockNoteWithDate(1, { id: 'newer' });

        const result = groupNotesByChapter([older, newer]);

        expect(result[0].notes.map((n) => n.id)).toEqual(['newer', 'older']);
      });

      it('orders by created date when the sort is "created"', () => {
        // Written first but edited last: the two orders are opposites, so one cannot
        // pass by accident.
        const writtenFirst = createMockNoteWithDate(5, {
          id: 'written-first',
          updatedAt: new Date('2024-01-15T11:00:00'),
        });
        const writtenSecond = createMockNoteWithDate(3, {
          id: 'written-second',
          updatedAt: new Date('2024-01-15T10:00:00'),
        });

        const byCreated = groupNotesByChapter([writtenFirst, writtenSecond], { sort: 'created' });
        const byUpdated = groupNotesByChapter([writtenFirst, writtenSecond], { sort: 'updated' });

        expect(byCreated[0].notes.map((n) => n.id)).toEqual(['written-second', 'written-first']);
        expect(byUpdated[0].notes.map((n) => n.id)).toEqual(['written-first', 'written-second']);
      });

      it('orders by title when the sort is "title"', () => {
        const notes = [
          createMockNoteWithDate(1, { id: 'c', title: 'Mountains' }),
          createMockNoteWithDate(2, { id: 'a', title: 'apples' }),
          createMockNoteWithDate(3, { id: 'b', title: 'Bread' }),
        ];

        const result = groupNotesByChapter(notes, { sort: 'title' });

        expect(result[0].notes.map((n) => n.id)).toEqual(['a', 'b', 'c']);
      });

      it('reads digits in a title as numbers', () => {
        const notes = [
          createMockNoteWithDate(1, { id: 'ten', title: 'Chapter 10' }),
          createMockNoteWithDate(2, { id: 'two', title: 'Chapter 2' }),
        ];

        const result = groupNotesByChapter(notes, { sort: 'title' });

        expect(result[0].notes.map((n) => n.id)).toEqual(['two', 'ten']);
      });

      it('sends untitled notes to the end rather than the top', () => {
        const notes = [
          createMockNoteWithDate(1, { id: 'blank', title: '' }),
          createMockNoteWithDate(2, { id: 'spaces', title: '   ' }),
          createMockNoteWithDate(3, { id: 'named', title: 'Willow' }),
        ];

        const result = groupNotesByChapter(notes, { sort: 'title' });

        expect(result[0].notes.map((n) => n.id)).toEqual(['named', 'blank', 'spaces']);
      });

      it('keeps a stable order for notes sharing one title', () => {
        // Duplicate titles decide nothing, so the newest edit breaks the tie and the
        // order does not shuffle between renders.
        const notes = [
          createMockNoteWithDate(3, { id: 'stale', title: 'Draft' }),
          createMockNoteWithDate(1, { id: 'recent', title: 'Draft' }),
          createMockNoteWithDate(2, { id: 'middling', title: 'draft' }),
        ];

        const first = groupNotesByChapter(notes, { sort: 'title' });
        const second = groupNotesByChapter(notes, { sort: 'title' });

        expect(first[0].notes.map((n) => n.id)).toEqual(['recent', 'middling', 'stale']);
        expect(second[0].notes.map((n) => n.id)).toEqual(first[0].notes.map((n) => n.id));
      });

      it('keeps a stable order for notes sharing every timestamp', () => {
        const shared = { createdAt: new Date('2024-01-14T08:00:00'), updatedAt: new Date('2024-01-14T08:00:00') };
        const notes = [
          createMockNote({ id: 'b-id', title: 'Same', ...shared }),
          createMockNote({ id: 'a-id', title: 'Same', ...shared }),
        ];

        for (const sort of NOTE_SORT_VALUES) {
          const result = groupNotesByChapter(notes, { sort });
          expect(result[0].notes.map((n) => n.id)).toEqual(['a-id', 'b-id']);
        }
      });

      it('orders every chapter, not just the first', () => {
        const notes = [
          createMockNoteWithDate(1, { id: 'week-z', title: 'Zebra' }),
          createMockNoteWithDate(2, { id: 'week-a', title: 'Apple' }),
          createMockNoteWithDate(120, { id: 'archive-z', title: 'Zither' }),
          createMockNoteWithDate(121, { id: 'archive-a', title: 'Anchor' }),
        ];

        const result = groupNotesByChapter(notes, { sort: 'title' });

        expect(result.map((c) => c.key)).toEqual(['thisWeek', 'archive']);
        expect(result[0].notes.map((n) => n.id)).toEqual(['week-a', 'week-z']);
        expect(result[1].notes.map((n) => n.id)).toEqual(['archive-a', 'archive-z']);
      });

      it('orders the Pinned chapter by the chosen sort too', () => {
        const notes = [
          createMockNoteWithDate(1, { id: 'z', title: 'Zebra', pinned: true }),
          createMockNoteWithDate(2, { id: 'a', title: 'Apple', pinned: true }),
        ];

        expect(groupNotesByChapter(notes, { sort: 'title' })[0].notes.map((n) => n.id))
          .toEqual(['a', 'z']);
        expect(groupNotesByChapter(notes, { sort: 'updated' })[0].notes.map((n) => n.id))
          .toEqual(['z', 'a']);
      });
    });

    describe('compareNotes', () => {
      it('is symmetric, so a sort cannot depend on argument order', () => {
        const early = createMockNoteWithDate(5, { id: 'early', title: 'Anchor' });
        const late = createMockNoteWithDate(1, { id: 'late', title: 'Zither' });

        for (const sort of NOTE_SORT_VALUES) {
          expect(Math.sign(compareNotes(early, late, sort)))
            .toBe(-Math.sign(compareNotes(late, early, sort)));
        }
      });

      it('reports no difference between a note and itself', () => {
        const note = createMockNoteWithDate(4, { title: 'Anchor' });

        for (const sort of NOTE_SORT_VALUES) {
          expect(compareNotes(note, note, sort)).toBe(0);
        }
      });
    });
  });

  describe('getDefaultExpansionState', () => {
    it('expands all chapters when total notes < 20', () => {
      const state = getDefaultExpansionState(15);

      expect(state.pinned).toBe(true);
      expect(state.thisWeek).toBe(true);
      expect(state.lastWeek).toBe(true);
      expect(state.thisMonth).toBe(true);
      expect(state.earlier).toBe(true);
      expect(state.archive).toBe(true);
    });

    it('collapses earlier/archive when 20-49 notes', () => {
      const state = getDefaultExpansionState(35);

      expect(state.pinned).toBe(true);
      expect(state.thisWeek).toBe(true);
      expect(state.lastWeek).toBe(true);
      expect(state.thisMonth).toBe(true);
      expect(state.earlier).toBe(false);
      expect(state.archive).toBe(false);
    });

    it('collapses thisMonth/earlier/archive when 50-99 notes', () => {
      const state = getDefaultExpansionState(75);

      expect(state.pinned).toBe(true);
      expect(state.thisWeek).toBe(true);
      expect(state.lastWeek).toBe(true);
      expect(state.thisMonth).toBe(false);
      expect(state.earlier).toBe(false);
      expect(state.archive).toBe(false);
    });

    it('only expands pinned and thisWeek when 100+ notes', () => {
      const state = getDefaultExpansionState(150);

      expect(state.pinned).toBe(true);
      expect(state.thisWeek).toBe(true);
      expect(state.lastWeek).toBe(false);
      expect(state.thisMonth).toBe(false);
      expect(state.earlier).toBe(false);
      expect(state.archive).toBe(false);
    });

    it('always keeps pinned expanded regardless of note count', () => {
      expect(getDefaultExpansionState(0).pinned).toBe(true);
      expect(getDefaultExpansionState(50).pinned).toBe(true);
      expect(getDefaultExpansionState(500).pinned).toBe(true);
    });

    it('handles boundary values correctly', () => {
      // Exactly 20 - should trigger second tier
      expect(getDefaultExpansionState(20).earlier).toBe(false);

      // Exactly 50 - should trigger third tier
      expect(getDefaultExpansionState(50).thisMonth).toBe(false);

      // Exactly 100 - should trigger fourth tier
      expect(getDefaultExpansionState(100).lastWeek).toBe(false);
    });
  });

  describe('getChapterLabel', () => {
    it('returns "Pinned" for pinned key', () => {
      expect(getChapterLabel('pinned')).toBe('Pinned');
    });

    it('returns "This Week" for thisWeek key', () => {
      expect(getChapterLabel('thisWeek')).toBe('This Week');
    });

    it('returns "Last Week" for lastWeek key', () => {
      expect(getChapterLabel('lastWeek')).toBe('Last Week');
    });

    it('returns "This Month" for thisMonth key', () => {
      expect(getChapterLabel('thisMonth')).toBe('This Month');
    });

    it('returns "Earlier" for earlier key', () => {
      expect(getChapterLabel('earlier')).toBe('Earlier');
    });

    it('returns "Archive" for archive key', () => {
      expect(getChapterLabel('archive')).toBe('Archive');
    });
  });

  describe('getChapterOrder', () => {
    it('returns all chapters in correct order including pinned', () => {
      const order = getChapterOrder();
      expect(order).toEqual([
        'pinned',
        'thisWeek',
        'lastWeek',
        'thisMonth',
        'earlier',
        'archive',
      ]);
    });

    it('returns a new array each time (immutable)', () => {
      const order1 = getChapterOrder();
      const order2 = getChapterOrder();
      expect(order1).not.toBe(order2);
      expect(order1).toEqual(order2);
    });
  });

  describe('getTemporalChapterOrder', () => {
    it('returns temporal chapters only (excludes pinned)', () => {
      const order = getTemporalChapterOrder();
      expect(order).toEqual([
        'thisWeek',
        'lastWeek',
        'thisMonth',
        'earlier',
        'archive',
      ]);
      expect(order).not.toContain('pinned');
    });

    it('returns a new array each time (immutable)', () => {
      const order1 = getTemporalChapterOrder();
      const order2 = getTemporalChapterOrder();
      expect(order1).not.toBe(order2);
      expect(order1).toEqual(order2);
    });
  });

  describe('CHAPTER_LABELS constant', () => {
    it('has labels for all chapter keys', () => {
      const expectedKeys: ChapterKey[] = [
        'pinned',
        'thisWeek',
        'lastWeek',
        'thisMonth',
        'earlier',
        'archive',
      ];

      expectedKeys.forEach((key) => {
        expect(CHAPTER_LABELS[key]).toBeDefined();
        expect(typeof CHAPTER_LABELS[key]).toBe('string');
        expect(CHAPTER_LABELS[key].length).toBeGreaterThan(0);
      });
    });
  });
});
