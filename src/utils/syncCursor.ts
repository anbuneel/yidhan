export function latestSyncTime(rows: readonly { syncStatus: string; lastSyncedAt: number | null }[]): number {
  return rows.reduce((latest, row) => row.syncStatus === 'synced' ? Math.max(latest, row.lastSyncedAt || 0) : latest, 0);
}
