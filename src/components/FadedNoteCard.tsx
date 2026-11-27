import { useState } from 'react';
import type { Note } from '../types';
import { TagBadgeList } from './TagBadge';
import { sanitizeHtml, sanitizeText } from '../utils/sanitize';
import { getDeletionCountdown } from '../utils/deletionCopy';

interface FadedNoteCardProps {
  note: Note;
  onRestore: (id: string) => void;
  onPermanentDelete: (id: string) => void;
}

/**
 * Calculate days remaining before permanent deletion (30 day limit)
 */
const DAY_MS = 24 * 60 * 60 * 1000;

function getDaysRemaining(deletedAt: Date): number {
  // Calendar days from today to the deletion day (deletedAt + 30 days), so "today"
  // and "tomorrow" mean the reader's own calendar days.
  const deadline = new Date(deletedAt.getTime() + 30 * DAY_MS);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.max(0, Math.round((startOf(deadline) - startOf(new Date())) / DAY_MS));
}



export function FadedNoteCard({ note, onRestore, onPermanentDelete }: FadedNoteCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPermanentDelete(note.id);
    setShowDeleteConfirm(false);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(false);
  };

  const handleRestoreClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRestore(note.id);
  };

  const daysRemaining = note.deletedAt ? getDaysRemaining(note.deletedAt) : 30;
  const countdown = getDeletionCountdown(daysRemaining);

  return (
    <article
      className="
        group
        relative
        overflow-hidden
        p-6 pb-5
        flex flex-col
        transition-all duration-500
      "
      style={{
        background: 'var(--color-card-bg)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-sm)',
        transitionTimingFunction: 'var(--spring-smooth)',
        minHeight: '200px',
        maxHeight: '300px',
        // Faded visual treatment - paper left in sunlight
        opacity: 0.8,
        filter: 'saturate(0.6) sepia(0.08)',
      }}
    >

      {/* Restore button - top-right corner */}
      <button type="button"
        onClick={handleRestoreClick}
        className="
          absolute top-2 right-2
          size-10
          rounded-full
          flex items-center justify-center
          transition-all duration-200
          focus:outline-none
          focus:ring-2
          focus:ring-[var(--color-accent)]
          focus:opacity-100
          opacity-0 group-hover:opacity-100
          [@media(hover:none)]:opacity-100
          [@media(any-pointer:coarse)]:opacity-100
        "
        style={{
          background: 'var(--color-bg-secondary)',
          color: 'var(--color-text-tertiary)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--color-accent)';
          e.currentTarget.style.background = 'var(--color-accent-glow)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--color-text-tertiary)';
          e.currentTarget.style.background = 'var(--color-bg-secondary)';
        }}
        aria-label="Restore note"
        title="Restore note"
      >
        <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
      </button>

      {/* Title - lighter weight for faded effect */}
      <h3
        className="
          text-xl
          font-medium
          line-clamp-2
          mb-3
          leading-tight
          shrink-0
        "
        style={{
          fontFamily: 'var(--font-display)',
          color: 'var(--color-text-secondary)',
          letterSpacing: '0.01em',
        }}
        dangerouslySetInnerHTML={{ __html: sanitizeText(note.title) || 'Untitled' }}
      />

      {/* Preview */}
      <div
        className="note-card-preview flex-1 overflow-hidden"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(note.content) }}
      />

      {/* Footer: Tags + Deletion info + Delete button */}
      <div className="flex items-center justify-between mt-auto pt-4 shrink-0">
        {/* Tag badges */}
        <div className="flex-1 min-w-0">
          {note.tags && note.tags.length > 0 ? (
            <TagBadgeList tags={note.tags} maxDisplay={2} />
          ) : (
            <span />
          )}
        </div>

        {/* Deletion info */}
        <div
          className="
            text-xs
            italic
            shrink-0
            ml-3
            text-right
          "
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-text-tertiary)',
          }}
        >
          <div style={{
            color: daysRemaining <= 6 ? 'var(--color-destructive)' : 'var(--color-text-secondary)',
          }}>
            {countdown}
          </div>
        </div>

        {/* Permanent delete button */}
        <button type="button"
          onClick={handleDeleteClick}
          className="
            size-10
            rounded-full
            flex items-center justify-center
            opacity-0
            group-hover:opacity-100
            [@media(hover:none)]:opacity-100
            [@media(any-pointer:coarse)]:opacity-100
            transition-all duration-200
            focus:outline-none
            focus:ring-2
            focus:ring-[var(--color-accent)]
            focus:opacity-100
            ml-2
            -mr-2
            shrink-0
          "
          style={{
            background: 'var(--color-bg-secondary)',
            color: 'var(--color-text-tertiary)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--color-destructive)';
            e.currentTarget.style.background = 'var(--color-error-light)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--color-text-tertiary)';
            e.currentTarget.style.background = 'var(--color-bg-secondary)';
          }}
          aria-label="Delete permanently"
          title="Delete permanently"
        >
          <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Permanent Delete Confirmation Overlay */}
      {showDeleteConfirm && (
        <div
          className="
            absolute inset-0
            flex flex-col items-center justify-center
            gap-4
            p-6
          "
          style={{
            background: 'var(--color-card-bg)',
            borderRadius: 'var(--radius-card)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <p
            className="text-center text-sm"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--color-text-secondary)',
            }}
          >
            Delete permanently?
          </p>
          <p
            className="text-center text-sm -mt-2"
            style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-primary)' }}
            dangerouslySetInnerHTML={{ __html: sanitizeText(note.title) || 'Untitled' }}
          />
          <p
            className="text-center text-xs"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--color-text-tertiary)',
            }}
          >
            This can't be undone.
          </p>
          <div className="flex gap-2">
            <button type="button"
              onClick={handleCancelDelete}
              className="
                px-4 py-2
                rounded-[var(--radius-button)]
                text-sm font-medium
                transition-all duration-200
              "
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-secondary)',
                background: 'transparent',
                border: '1px solid var(--glass-border)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-text-secondary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--glass-border)';
              }}
            >
              Cancel
            </button>
            <button type="button"
              onClick={handleConfirmDelete}
              className="
                px-4 py-2
                rounded-[var(--radius-button)]
                text-sm font-medium
                transition-all duration-200
              "
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-destructive-text)',
                background: 'var(--color-destructive)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              Delete permanently
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
