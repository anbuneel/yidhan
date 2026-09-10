import type { Note } from '../types';

// Chapter keys including pinned (which is handled separately from temporal)
export type ChapterKey = 'pinned' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'earlier' | 'archive';

/** Search results use one ranked section instead of chronology-based chapters. */
export type LibrarySectionKey = ChapterKey | 'search';

/**
 * Which timestamp decides the chapter a note falls into.
 *
 * `'updated'` is what the library has always done. `'created'` means an edit does not
 * move a note: something written in March stays in the chapter its writing date earned,
 * however often it is revised afterwards.
 */
export type ChapterBasis = 'updated' | 'created';

/** How notes are ordered inside a chapter. */
export type NoteSortKey = 'updated' | 'created' | 'title';

export interface ChapterArrangement {
  basis: ChapterBasis;
  sort: NoteSortKey;
}

export const CHAPTER_BASIS_VALUES: readonly ChapterBasis[] = ['updated', 'created'];
export const NOTE_SORT_VALUES: readonly NoteSortKey[] = ['updated', 'created', 'title'];

/** The library's long-standing behaviour: chapters by last edited, newest edit first. */
export const DEFAULT_ARRANGEMENT: ChapterArrangement = { basis: 'updated', sort: 'updated' };

/** "Written" reads warmer than "Created" and means the same timestamp. */
export const CHAPTER_BASIS_LABELS: Record<ChapterBasis, string> = {
  updated: 'Edited',
  created: 'Written',
};

export const NOTE_SORT_LABELS: Record<NoteSortKey, string> = {
  updated: 'Edited',
  created: 'Written',
  title: 'Title',
};

export function isChapterBasis(value: unknown): value is ChapterBasis {
  return CHAPTER_BASIS_VALUES.includes(value as ChapterBasis);
}

export function isNoteSortKey(value: unknown): value is NoteSortKey {
  return NOTE_SORT_VALUES.includes(value as NoteSortKey);
}

// Chapter-aware waterline text (displayed below the last visible card row)
export const WATERLINE_TEXT: Record<LibrarySectionKey, (count: number) => string> = {
  search: (n) => `${n} more results...`,
  pinned: (n) => `${n} more pinned...`,
  thisWeek: (n) => `${n} more from this week...`,
  lastWeek: (n) => `${n} more from last week...`,
  thisMonth: (n) => `${n} more this month...`,
  earlier: (n) => `${n} quieter thoughts...`,
  archive: (n) => `${n} resting here...`,
};

export interface ChapterGroup {
  key: ChapterKey;
  label: string;
  notes: Note[];
  isPinned?: boolean; // Special flag for pinned section
}

export const CHAPTER_LABELS: Record<ChapterKey, string> = {
  pinned: 'Pinned',
  thisWeek: 'This Week',
  lastWeek: 'Last Week',
  thisMonth: 'This Month',
  earlier: 'Earlier',
  archive: 'Archive',
};

// Temporal chapters only (pinned is handled separately in groupNotesByChapter)
const TEMPORAL_CHAPTER_ORDER: ChapterKey[] = ['thisWeek', 'lastWeek', 'thisMonth', 'earlier', 'archive'];

// Full order including pinned (for navigation)
const FULL_CHAPTER_ORDER: ChapterKey[] = ['pinned', ...TEMPORAL_CHAPTER_ORDER];

/**
 * Get the chapter label for a given chapter key
 */
export function getChapterLabel(key: ChapterKey): string {
  return CHAPTER_LABELS[key];
}

/**
 * Determine which temporal chapter a date belongs to based on how long ago it was
 * Note: This does not return 'pinned' - pinned status is determined by note.pinned flag
 *
 * @param date The date to categorize
 * @param referenceTime Optional timestamp for "start of today" to avoid recalculating it
 */
export function getChapterForDate(date: Date, referenceTime?: number): Exclude<ChapterKey, 'pinned'> {
  let startOfTodayTime = referenceTime;

  // Calculate start of today if not provided (backward compatibility)
  if (startOfTodayTime === undefined) {
    const now = new Date();
    startOfTodayTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }

  // Calculate start of the date's day
  // We need to use local time boundaries consistent with startOfTodayTime
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

  const diffMs = startOfTodayTime - dateStart;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // This Week: 0-7 days (today through 7 days ago)
  if (diffDays < 8) {
    return 'thisWeek';
  }

  // Last Week: 8-14 days ago
  if (diffDays < 15) {
    return 'lastWeek';
  }

  // This Month: 15-30 days ago
  if (diffDays < 31) {
    return 'thisMonth';
  }

  // Earlier: 31-90 days ago
  if (diffDays < 91) {
    return 'earlier';
  }

  // Archive: 90+ days ago
  return 'archive';
}

function isUsableDate(date: Date | null | undefined): date is Date {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

function timeOf(date: Date | null | undefined): number {
  return isUsableDate(date) ? date.getTime() : 0;
}

/**
 * The timestamp the chapter is decided by. A note whose basis date is missing or
 * unparseable falls back to the other timestamp: an invalid date sorts as the epoch,
 * so without the fallback choosing a basis would drop such a note into Archive.
 */
function chapterDate(note: Note, basis: ChapterBasis): Date {
  const preferred = basis === 'created' ? note.createdAt : note.updatedAt;
  if (isUsableDate(preferred)) return preferred;

  const fallback = basis === 'created' ? note.updatedAt : note.createdAt;
  return isUsableDate(fallback) ? fallback : new Date(0);
}

/**
 * Titles order A to Z, ignoring case and accents, with digits read as numbers so
 * "Chapter 2" precedes "Chapter 10". An untitled note has no title to order by, so it
 * goes last rather than heading the chapter.
 */
function compareTitles(a: Note, b: Note): number {
  const left = (a.title ?? '').trim();
  const right = (b.title ?? '').trim();
  if (!left || !right) return left ? -1 : right ? 1 : 0;
  return left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true });
}

/**
 * Order two notes by the reader's chosen key. Ties fall through to the newest edit and
 * then the id, so duplicate titles and identical timestamps hold one stable order
 * instead of shuffling between renders.
 */
export function compareNotes(a: Note, b: Note, sort: NoteSortKey): number {
  const primary = sort === 'title'
    ? compareTitles(a, b)
    : timeOf(sort === 'created' ? b.createdAt : b.updatedAt)
      - timeOf(sort === 'created' ? a.createdAt : a.updatedAt);
  if (primary !== 0) return primary;

  const byEdit = timeOf(b.updatedAt) - timeOf(a.updatedAt);
  return byEdit !== 0 ? byEdit : a.id.localeCompare(b.id);
}

/**
 * Group notes into temporal chapters, ordered inside each chapter by the reader's
 * chosen key.
 *
 * `basis` picks the timestamp a chapter is decided by; `sort` picks the order within
 * one. Pinned notes are extracted into a separate "Pinned" chapter that appears first
 * and the basis never applies to them — a pinned note is pinned whichever timestamp is
 * being read. The order within Pinned does follow `sort`, since Pinned is a chapter.
 *
 * Grouping only reorders: every note in, exactly once out, under any arrangement. It
 * never filters, so a search result stays a search result whatever the reader chose.
 *
 * Returns only chapters that have notes (honest presence).
 */
export function groupNotesByChapter(
  notes: Note[],
  arrangement: Partial<ChapterArrangement> = {}
): ChapterGroup[] {
  const basis = arrangement.basis ?? DEFAULT_ARRANGEMENT.basis;
  const sort = arrangement.sort ?? DEFAULT_ARRANGEMENT.sort;
  const byChosenKey = (a: Note, b: Note) => compareNotes(a, b, sort);
  // Pre-calculate start of today to avoid doing it for every note
  const now = new Date();
  const startOfTodayTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const pinnedNotes: Note[] = [];

  // Initialize map with empty arrays for each temporal chapter
  const chapterMap = new Map<ChapterKey, Note[]>();
  TEMPORAL_CHAPTER_ORDER.forEach((key) => chapterMap.set(key, []));

  // Single pass through notes to separate pinned and categorize unpinned
  for (const note of notes) {
    if (note.pinned) {
      pinnedNotes.push(note);
    } else {
      const chapterKey = getChapterForDate(chapterDate(note, basis), startOfTodayTime);
      chapterMap.get(chapterKey)?.push(note);
    }
  }

  // Build result array, starting with pinned if any exist
  const chapters: ChapterGroup[] = [];

  // Add pinned chapter first (if there are pinned notes)
  if (pinnedNotes.length > 0) {
    chapters.push({
      key: 'pinned',
      label: CHAPTER_LABELS.pinned,
      notes: pinnedNotes.sort(byChosenKey),
      isPinned: true,
    });
  }

  // Add temporal chapters (filtering out empty ones - honest presence)
  TEMPORAL_CHAPTER_ORDER.forEach((key) => {
    const chapterNotes = chapterMap.get(key) || [];
    if (chapterNotes.length > 0) {
      chapters.push({
        key,
        label: CHAPTER_LABELS[key],
        notes: chapterNotes.sort(byChosenKey),
      });
    }
  });

  return chapters;
}

/**
 * Get default expansion state based on total note count
 * More notes = fewer chapters expanded by default
 * Pinned is always expanded
 */
export function getDefaultExpansionState(totalNotes: number): Record<ChapterKey, boolean> {
  if (totalNotes < 20) {
    // All chapters expanded
    return {
      pinned: true,
      thisWeek: true,
      lastWeek: true,
      thisMonth: true,
      earlier: true,
      archive: true,
    };
  }

  if (totalNotes < 50) {
    // Pinned, This Week, Last Week, This Month expanded
    return {
      pinned: true,
      thisWeek: true,
      lastWeek: true,
      thisMonth: true,
      earlier: false,
      archive: false,
    };
  }

  if (totalNotes < 100) {
    // Pinned, This Week, Last Week expanded
    return {
      pinned: true,
      thisWeek: true,
      lastWeek: true,
      thisMonth: false,
      earlier: false,
      archive: false,
    };
  }

  // 100+ notes: Only Pinned and This Week expanded
  return {
    pinned: true,
    thisWeek: true,
    lastWeek: false,
    thisMonth: false,
    earlier: false,
    archive: false,
  };
}

/**
 * Get the full chapter order array (for navigation, includes pinned)
 */
export function getChapterOrder(): ChapterKey[] {
  return [...FULL_CHAPTER_ORDER];
}

/**
 * Get temporal chapter order only (excludes pinned)
 */
export function getTemporalChapterOrder(): ChapterKey[] {
  return [...TEMPORAL_CHAPTER_ORDER];
}
