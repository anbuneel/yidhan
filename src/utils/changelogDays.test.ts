import { describe, expect, it } from 'vitest';
import { formatDayVersions, groupChangelogByDay } from './changelogDays';

describe('groupChangelogByDay', () => {
  it('merges same-day releases and keeps days apart', () => {
    const days = groupChangelogByDay([
      { version: '1.0.2', date: '2026-01-02', changes: [{ type: 'fix', text: 'c' }] },
      { version: '1.0.1', date: '2026-01-02', changes: [{ type: 'fix', text: 'b' }] },
      { version: '1.0.0', date: '2026-01-01', changes: [{ type: 'feature', text: 'a' }] },
    ]);
    expect(days.map((d) => d.date)).toEqual(['2026-01-02', '2026-01-01']);
    expect(days[0].versions).toEqual(['1.0.2', '1.0.1']);
    expect(days[0].changes.map((c) => c.text)).toEqual(['c', 'b']);
    expect(days[1].versions).toEqual(['1.0.0']);
  });

  it('lists one version alone and several oldest first', () => {
    expect(formatDayVersions(['1.0.0'])).toBe('1.0.0');
    expect(formatDayVersions(['1.0.2', '1.0.1', '1.0.0'])).toBe('1.0.0, 1.0.1, 1.0.2');
  });
});
