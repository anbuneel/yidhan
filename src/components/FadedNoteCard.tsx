import { useState } from 'react';
import type { Note } from '../types';
import { TagBadgeList } from './TagBadge';
import { sanitizeHtml, sanitizeText } from '../utils/sanitize';

interface FadedNoteCardProps {
  note: Note;
  onRestore: (id: string) => void;
  onPermanentDelete: (id: string) => void;
}

/**
 * Format how long ago the note was deleted
 */
function formatDeletedTime(deletedAt: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - deletedAt.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      return 'Just now';
    }
    return `${diffHours}h ago`;
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return '1 week ago';
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} ago`;
}

/**
 * Calculate days remaining before permanent deletion (30 day limit)
 */
function getDaysRemaining(deletedAt: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - deletedAt.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, 30 - diffDays);
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
  const deletedTimeAgo = note.deletedAt ? formatDeletedTime(note.deletedAt) : 'Unknown';

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
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-md)',
        transitionTimingFunction: 'cubic-bezier(0.25, 0.8, 0.25, 1)',
        minHeight: '200px',
        maxHeight: '300px',
        // Faded visual treatment
        opacity: 0.75,
        filter: 'saturate(0.7)',
      }}
    >
      {/* Muted accent line */}
      <div
        className="absolute top-0 left-0 w-full h-[2px]"
        style={{
          background: 'var(--color-accent)',
          opacity: 0.3,
        }}
      />

      {/* Restore button - top-right corner */}
      <button
        onClick={handleRestoreClick}
        className="
          absolute top-3 right-3
          w-8 h-8
          rounded-full
          flex items-center justify-center
          transition-all duration-200
          focus:outline-none
          focus:opacity-100
          hover:scale-110
          opacity-0 group-hover:opacity-100
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
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
      </button>

      {/* Title */}
      <h3
        className="
          text-xl
          font-semibold
          line-clamp-2
          mb-3
          leading-tight
          shrink-0
        "
        style={{
          fontFamily: 'var(--font-display)',
          color: 'var(--color-text-primary)',
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
            text-[0.6rem]
            uppercase
            tracking-[0.08em]
            font-medium
            shrink-0
            ml-3
            text-right
          "
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-text-tertiary)',
          }}
        >
          <div>{deletedTimeAgo}</div>
          <div style={{ color: daysRemaining <= 7 ? 'var(--color-destructive)' : 'var(--color-text-tertiary)' }}>
            {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left
          </div>
        </div>

        {/* Permanent delete button */}
        <button
          onClick={handleDeleteClick}
          className="
            w-8 h-8
            rounded-full
            flex items-center justify-center
            opacity-0
            group-hover:opacity-100
            transition-all duration-200
            focus:outline-none
            focus:opacity-100
            hover:scale-110
            ml-3
            -mr-3
            shrink-0
          "
          style={{
            background: 'var(--color-bg-secondary)',
            color: 'var(--color-text-tertiary)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--color-destructive)';
            e.currentTarget.style.background = 'rgba(220, 38, 38, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--color-text-tertiary)';
            e.currentTarget.style.background = 'var(--color-bg-secondary)';
          }}
          aria-label="Delete permanently"
          title="Delete permanently"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
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
            Permanently delete "<span
              style={{ color: 'var(--color-text-primary)' }}
              dangerouslySetInnerHTML={{ __html: sanitizeText(note.title) || 'Untitled' }}
            />"?
          </p>
          <p
            className="text-center text-xs"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--color-text-tertiary)',
            }}
          >
            This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleCancelDelete}
              className="
                px-4 py-2
                rounded-lg
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
            <button
              onClick={handleConfirmDelete}
              className="
                px-4 py-2
                rounded-lg
                text-sm font-medium
                transition-all duration-200
              "
              style={{
                fontFamily: 'var(--font-body)',
                color: '#fff',
                background: 'var(--color-destructive)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              Delete Forever
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
