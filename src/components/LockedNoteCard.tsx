import { memo } from 'react';
import type { Note } from '../types';
import { formatRelativeTime } from '../utils/formatTime';

/**
 * A note whose ciphertext would not open (item 41).
 *
 * It renders as itself — a note that is here, dated, and closed — rather than as a
 * blank card or as nothing at all. Before this, one corrupt payload made the whole
 * library render empty behind a toast, which reads as "your notes are gone".
 *
 * There is nothing of the note's content here to show, and nothing to leak: the locked
 * note carries empty title and content by construction.
 */
export interface LockedNoteCardProps {
  note: Note;
  /** Re-read the library and try the ciphertext again. */
  onRetry: () => void;
  isCompact?: boolean;
}

export const LockedNoteCard = memo(function LockedNoteCard({
  note,
  onRetry,
  isCompact = false,
}: LockedNoteCardProps) {
  return (
    <article
      className={`note-card relative rounded-xl ${isCompact ? 'p-4' : 'p-5'}`}
      data-testid="locked-note-card"
      style={{
        background: 'var(--color-bg-secondary)',
        border: '1px dashed var(--glass-border)',
      }}
      aria-label="A note that could not be opened"
    >
      <div className="flex items-start gap-3">
        <span
          className="shrink-0 mt-0.5"
          aria-hidden="true"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
        </span>

        <div className="min-w-0">
          <h3
            className="text-base mb-1"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--color-text-primary)',
              fontWeight: 400,
            }}
          >
            This note could not be opened
          </h3>
          <p
            className="text-sm mb-3"
            style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-secondary)' }}
          >
            It is still here and it is still encrypted — this device just could not
            unlock it. Your other notes are unaffected.
          </p>

          <button
            type="button"
            onClick={onRetry}
            className="focus-ring bg-transparent border-none p-0 text-sm cursor-pointer underline underline-offset-4"
            style={{ fontFamily: 'var(--font-body)', color: 'var(--color-accent)' }}
          >
            Try again
          </button>
        </div>
      </div>

      <p
        className="mt-4 text-xs"
        style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-tertiary)' }}
      >
        Last saved {formatRelativeTime(note.updatedAt)}
      </p>
    </article>
  );
});
