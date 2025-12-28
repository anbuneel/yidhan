import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getChapterForDate,
  groupNotesByChapter,
  getDefaultExpansionState,
  getChapterLabel,
  getChapterOrder,
  getTemporalChapterOrder,
  CHAPTER_LABELS,
  type ChapterKey,
} from './temporalGrouping';
import { createMockNote, createMockNoteWithDate } from '../test/factories';

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
