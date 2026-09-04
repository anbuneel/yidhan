/**
 * Plain-language descriptions of sync failures.
 *
 * Blocked queue entries record the raw PostgREST/Postgres error, which is what
 * makes a block diagnosable after the fact. That text is for the console and
 * Sentry, not for the person writing notes: "new row violates row-level
 * security policy for table \"notes\"" tells them nothing they can act on, and
 * leaks schema detail besides. Auth.tsx already maps technical errors to
 * friendly ones; this does the same for sync.
 *
 * The raw string stays untouched in IndexedDB (`lastError`) and in the
 * reliability telemetry — only the presentation changes.
 */

const UNKNOWN_REASON = 'This change could not be saved yet.';

interface FailurePattern {
  matches: (raw: string) => boolean;
  message: string;
}

const PATTERNS: FailurePattern[] = [
  {
    // 23503 — the note or tag this row points at has not reached the server.
    matches: (raw) => raw.includes('[23503]') || raw.includes('foreign key'),
    message: 'Waiting for a related note to finish syncing.',
  },
  {
    // 42501 RLS / 23502 NOT NULL — the server rejected the write outright.
    // Almost always a server-side configuration gap rather than user error.
    matches: (raw) =>
      raw.includes('[42501]') ||
      raw.includes('[23502]') ||
      raw.includes('row-level security') ||
      raw.includes('violates not-null'),
    message: 'The server refused this change. It needs attention from the app owner.',
  },
  {
    // 23514 on the E2EE invariants specifically. Matching the generic phrase
    // would mis-describe any future check constraint as an encryption problem.
    matches: (raw) =>
      raw.includes('chk_notes_e2ee_only') || raw.includes('chk_note_shares_e2ee_only'),
    message: 'This note is missing its encryption details, so it cannot be saved.',
  },
  {
    matches: (raw) => raw.toLowerCase().includes('plaintext'),
    message: 'This note predates the encryption upgrade and needs to be re-saved.',
  },
  {
    matches: (raw) => raw.includes('did not appear on the server'),
    message: 'The server accepted this change but did not confirm it. It will be retried.',
  },
];

/**
 * Turn a recorded `lastError` into something worth showing someone.
 *
 * Returns null when there is nothing to describe, so callers can fall back to
 * their own copy rather than rendering an empty reason.
 */
export function describeSyncFailure(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;

  const match = PATTERNS.find((pattern) => pattern.matches(raw));
  return match ? match.message : UNKNOWN_REASON;
}
