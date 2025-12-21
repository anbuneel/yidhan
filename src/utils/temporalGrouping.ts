import type { Note } from '../types';

export type ChapterKey = 'today' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'seasonsPast';

export interface ChapterGroup {
  key: ChapterKey;
  label: string;
  notes: Note[];
}

const CHAPTER_LABELS: Record<ChapterKey, string> = {
  today: 'Today',
  thisWeek: 'This Week',
  thisMonth: 'This Month',
  lastMonth: 'Last Month',
  seasonsPast: 'Seasons Past',
};

const CHAPTER_ORDER: ChapterKey[] = ['today', 'thisWeek', 'thisMonth', 'lastMonth', 'seasonsPast'];

/**
 * Get the chapter label for a given chapter key
 */
export function getChapterLabel(key: ChapterKey): string {
  return CHAPTER_LABELS[key];
}

/**
 * Determine which chapter a date belongs to based on how long ago it was
 */
export function getChapterForDate(date: Date): ChapterKey {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = startOfToday.getTime() - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Today: within the last 24 hours (same calendar day or yesterday if it's early morning)
  if (diffDays < 1) {
    return 'today';
  }

  // This Week: 1-7 days ago
  if (diffDays < 7) {
    return 'thisWeek';
  }

  // This Month: 7-30 days ago
  if (diffDays < 30) {
    return 'thisMonth';
  }

  // Last Month: 30-60 days ago
  if (diffDays < 60) {
    return 'lastMonth';
  }

  // Seasons Past: 60+ days ago
  return 'seasonsPast';
}

/**
 * Group notes by their temporal chapter based on updatedAt timestamp
 * Returns only chapters that have notes (honest presence)
 */
export function groupNotesByChapter(notes: Note[]): ChapterGroup[] {
  // Initialize map with empty arrays for each chapter
  const chapterMap = new Map<ChapterKey, Note[]>();
  CHAPTER_ORDER.forEach((key) => chapterMap.set(key, []));

  // Sort notes into chapters based on updatedAt
  notes.forEach((note) => {
    const chapterKey = getChapterForDate(note.updatedAt);
    chapterMap.get(chapterKey)?.push(note);
  });

  // Convert to array, filtering out empty chapters (honest presence)
  const chapters: ChapterGroup[] = [];
  CHAPTER_ORDER.forEach((key) => {
    const chapterNotes = chapterMap.get(key) || [];
    if (chapterNotes.length > 0) {
      chapters.push({
        key,
        label: CHAPTER_LABELS[key],
        notes: chapterNotes,
      });
    }
  });

  return chapters;
}

/**
 * Get default expansion state based on total note count
 * More notes = fewer chapters expanded by default
 */
export function getDefaultExpansionState(totalNotes: number): Record<ChapterKey, boolean> {
  if (totalNotes < 20) {
    // All chapters expanded
    return {
      today: true,
      thisWeek: true,
      thisMonth: true,
      lastMonth: true,
      seasonsPast: true,
    };
  }

  if (totalNotes < 50) {
    // Today, This Week, This Month expanded
    return {
      today: true,
      thisWeek: true,
      thisMonth: true,
      lastMonth: false,
      seasonsPast: false,
    };
  }

  if (totalNotes < 100) {
    // Today, This Week expanded
    return {
      today: true,
      thisWeek: true,
      thisMonth: false,
      lastMonth: false,
      seasonsPast: false,
    };
  }

  // 100+ notes: Only Today expanded
  return {
    today: true,
    thisWeek: false,
    thisMonth: false,
    lastMonth: false,
    seasonsPast: false,
  };
}

/**
 * Get the chapter order array (for navigation)
 */
export function getChapterOrder(): ChapterKey[] {
  return [...CHAPTER_ORDER];
}
