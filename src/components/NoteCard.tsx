import { useState } from 'react';
import type { Note } from '../types';
import { formatRelativeTime } from '../utils/formatTime';
import { TagBadgeList } from './TagBadge';
import { sanitizeHtml, sanitizeText } from '../utils/sanitize';

interface NoteCardProps {
  note: Note;
  onClick: (id: string) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
}

export function NoteCard({ note, onClick, onDelete, onTogglePin }: NoteCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(note.id);
    setShowDeleteConfirm(false);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(false);
  };

  const handlePinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTogglePin(note.id, !note.pinned);
  };

  return (
    <article
      className="
        group
        relative
        overflow-hidden
        cursor-pointer
        p-10
        flex flex-col
        transition-all duration-500
        focus:outline-none
        focus:ring-2
        focus:ring-[var(--color-accent)]
        focus:ring-offset-2
        active:scale-[0.98]
      "
      style={{
        background: 'var(--color-card-bg)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-md)',
        transitionTimingFunction: 'cubic-bezier(0.25, 0.8, 0.25, 1)',
      }}
      role="button"
      tabIndex={0}
      onClick={() => onClick(note.id)}
      onKeyDown={(e) => e.key === 'Enter' && onClick(note.id)}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-10px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Accent line - persistent for pinned, animates on hover for unpinned */}
      <div
        className={`
          absolute top-0 left-0 w-full h-[2px]
          bg-[var(--color-accent)]
          origin-left
          transition-transform duration-500 ease-out
          ${note.pinned ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-50 group-hover:scale-x-100'}
        `}
      />

      {/* Pin button - top-left corner */}
      <button
        onClick={handlePinClick}
        className={`
          absolute top-3 left-3
          w-8 h-8
          rounded-full
          flex items-center justify-center
          transition-all duration-200
          focus:outline-none
          focus:opacity-100
          hover:scale-110
          ${note.pinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
        `}
        style={{
          background: note.pinned ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
          color: note.pinned ? 'var(--color-bg-primary)' : 'var(--color-text-tertiary)',
        }}
        onMouseEnter={(e) => {
          if (!note.pinned) {
            e.currentTarget.style.color = 'var(--color-accent)';
            e.currentTarget.style.background = 'rgba(var(--color-accent-rgb), 0.1)';
          }
        }}
        onMouseLeave={(e) => {
          if (!note.pinned) {
            e.currentTarget.style.color = 'var(--color-text-tertiary)';
            e.currentTarget.style.background = 'var(--color-bg-secondary)';
          }
        }}
        aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
        title={note.pinned ? 'Unpin note' : 'Pin note'}
      >
        <svg className="w-4 h-4" fill={note.pinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      </button>

      {/* Title - sanitized to prevent XSS */}
      <h3
        className="
          text-[1.8rem]
          font-semibold
          line-clamp-2
          mb-4
          leading-tight
        "
        style={{
          fontFamily: 'var(--font-display)',
          color: 'var(--color-text-primary)',
        }}
        dangerouslySetInnerHTML={{ __html: sanitizeText(note.title) || 'Untitled' }}
      />

      {/* Preview - Rendered HTML content (sanitized to prevent XSS) */}
      <div
        className="note-card-preview flex-1 overflow-hidden"
        style={{
          maxHeight: '6rem',
        }}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(note.content) }}
      />

      {/* Footer: Tags + Timestamp + Delete */}
      <div className="flex items-center justify-between mt-auto pt-6">
        {/* Tag badges */}
        <div className="flex-1 min-w-0">
          {note.tags && note.tags.length > 0 ? (
            <TagBadgeList tags={note.tags} maxDisplay={2} />
          ) : (
            <span />
          )}
        </div>

        {/* Timestamp */}
        <time
          className="
            text-[0.65rem]
            uppercase
            tracking-[0.1em]
            font-medium
            shrink-0
            ml-3
          "
          dateTime={note.updatedAt.toISOString()}
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-text-tertiary)',
          }}
        >
          {formatRelativeTime(note.updatedAt)}
        </time>

        {/* Delete button - bottom-right, appears on hover */}
        <button
          onClick={handleDeleteClick}
          className="
            w-7 h-7
            rounded-full
            flex items-center justify-center
            opacity-0
            group-hover:opacity-100
            transition-all duration-200
            focus:outline-none
            focus:opacity-100
            hover:scale-110
            ml-2
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
          aria-label="Delete note"
          title="Delete note"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Delete Confirmation Overlay */}
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
            Delete "<span
              style={{ color: 'var(--color-text-primary)' }}
              dangerouslySetInnerHTML={{ __html: sanitizeText(note.title) || 'Untitled' }}
            />"?
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
                color: 'var(--color-bg-primary)',
                background: 'var(--color-accent)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-accent-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--color-accent)';
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
