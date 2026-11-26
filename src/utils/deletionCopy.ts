/** When a faded note will be deleted, as a day count. */
export function getDeletionCountdown(daysRemaining: number): string {
  if (daysRemaining <= 0) return 'Deleted today';
  if (daysRemaining === 1) return 'Deleted tomorrow';
  return `Deleted in ${daysRemaining} days`;
}

/** Days between choosing "Let go" and permanent deletion (`initiate_offboarding`). */
const OFFBOARDING_GRACE_DAYS = 14;

/** The date an account deleted now would be removed, e.g. "10 December 2026". */
export function formatDeletionDate(from: Date = new Date()): string {
  const date = new Date(from.getTime() + OFFBOARDING_GRACE_DAYS * 24 * 60 * 60 * 1000);
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}
