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

/** "3.20.6", or "3.20.7 to 3.20.11" for a day with several releases. */
export function formatDayVersions(versions: readonly string[]): string {
  if (versions.length <= 1) return versions[0] ?? '';
  return `${versions[versions.length - 1]} to ${versions[0]}`;
}
