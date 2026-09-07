import { expect, it } from 'vitest';
import { latestSyncTime } from './syncCursor';
it('computes the cursor for 100,000 rows without argument spreading', () => {
  const rows = Array.from({ length: 100_000 }, (_, i) => ({ syncStatus: 'synced', lastSyncedAt: i }));
  rows.push({ syncStatus: 'pending', lastSyncedAt: 999_999 });
  expect(latestSyncTime(rows)).toBe(99_999);
  expect(latestSyncTime([])).toBe(0);
});
