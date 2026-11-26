import type { ChangelogEntry } from '../data/changelog';

/** One day on the changelog page: every release made that day, read as one update. */
export interface ChangelogDay {
  date: string;
  /** Versions released that day, newest first. */
  versions: string[];
  /** The day's changes, newest release first, in the order each release lists them. */
  changes: ChangelogEntry['changes'];
}

/**
 * Group releases by day. Entries are newest first; so are the days. Several patch
 * versions on one day become one update (design critique K12).
 */
export function groupChangelogByDay(entries: readonly ChangelogEntry[]): ChangelogDay[] {
  const days: ChangelogDay[] = [];
  const byDate = new Map<string, ChangelogDay>();
  for (const entry of entries) {
    let day = byDate.get(entry.date);
    if (!day) {
      day = { date: entry.date, versions: [], changes: [] };
      byDate.set(entry.date, day);
      days.push(day);
    }
    day.versions.push(entry.version);
    day.changes.push(...entry.changes);
  }
  return days;
}

/** The day's versions, oldest first: "3.20.6", or "3.20.9, 3.20.10, 3.20.11". Every
 *  version is listed, so a version number from a bug report can be found on the page. */
export function formatDayVersions(versions: readonly string[]): string {
  return [...versions].reverse().join(', ');
}
