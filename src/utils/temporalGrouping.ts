import type { Note } from '../types';

// Chapter keys including pinned (which is handled separately from temporal)
export type ChapterKey = 'pinned' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'earlier' | 'archive';

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

/**
 * Group notes by their temporal chapter based on updatedAt timestamp
 * Pinned notes are extracted into a separate "Pinned" chapter that appears first
 * Returns only chapters that have notes (honest presence)
 */
export function groupNotesByChapter(notes: Note[]): ChapterGroup[] {
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
      const chapterKey = getChapterForDate(note.updatedAt, startOfTodayTime);
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
      notes: pinnedNotes,
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
        notes: chapterNotes,
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
