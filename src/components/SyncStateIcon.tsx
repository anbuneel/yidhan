/**
 * One small line icon per save or sync state. The accent is green, so colour
 * cannot carry the meaning: each state has its own shape as well as its own
 * word. Drawn in currentColor, so it takes the label's neutral text colour.
 */

export type SyncStateKind =
  | 'saving'
  | 'not-saved'
  | 'saved'
  | 'synced'
  | 'copied'
  | 'pending'
  | 'offline'
  | 'blocked';

const PATHS: Record<SyncStateKind, string[]> = {
  // An open ring: work in progress.
  saving: ['M12 4a8 8 0 1 0 8 8'],
  // An empty circle: nothing kept yet.
  'not-saved': ['M12 5a7 7 0 1 0 0 14a7 7 0 1 0 0-14'],
  // A tick: kept on this device.
  saved: ['M5 13l4 4L19 7'],
  // A cloud with a tick: the server has confirmed it.
  synced: ['M7 18a4 4 0 0 1-.6-7.95A6 6 0 0 1 17.7 9 4.5 4.5 0 0 1 17.5 18H7z', 'M9.5 13.5l2 2 3.5-3.5'],
  // Two sheets: copied to the clipboard.
  copied: ['M9 9h10v11H9z', 'M5 15V4h10'],
  // A clock: waiting to sync.
  pending: ['M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16', 'M12 8v4l2.5 1.5'],
  // A cloud with a cross: no connection.
  offline: ['M3 15a4 4 0 004 4h9a5 5 0 10-5-5 4 4 0 00-8 1z', 'M18.5 5.5l-3 3m0-3l3 3'],
  // A warning sign: needs a retry.
  blocked: ['M12 4l9 16H3z', 'M12 10v4', 'M12 17h.01'],
};

export function SyncStateIcon({ kind, className = 'size-3.5' }: { kind: SyncStateKind; className?: string }) {
  return (
    <svg
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
      data-sync-icon={kind}
    >
      {PATHS[kind].map((d) => (
        <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={d} />
      ))}
    </svg>
  );
}
