import { useState } from 'react';
import type { Note } from '../types';
import { formatRelativeTime } from '../utils/formatTime';
import { TagBadgeList } from './TagBadge';
import { sanitizeHtml, sanitizeText, htmlToPlainText } from '../utils/sanitize';

interface NoteCardProps {
  note: Note;
  onClick: (id: string) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  isCompact?: boolean;
}

export function NoteCard({ note, onClick, onDelete, onTogglePin, isCompact = false }: NoteCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  // Extract plain text preview for compact mode (no HTML escaping - React handles it)
  const compactPreview = (() => {
    if (!isCompact) return '';
    const text = htmlToPlainText(note.content);
    return text.slice(0, 80) + (text.length > 80 ? '...' : '');
  })();

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Start fade animation
    setIsDeleting(true);
    // After animation completes, trigger actual delete
    setTimeout(() => {
      onDelete(note.id);
    }, 300);
  };

  const handlePinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTogglePin(note.id, !note.pinned);
  };

  return (
    <article
      className={`
        group
        note-card
        relative
        overflow-hidden
        cursor-pointer
        flex flex-col
        transition-all duration-300
        focus:outline-none
        focus:ring-2
        focus:ring-[var(--color-accent)]
        focus:ring-offset-2
        active:scale-[0.98]
        ${isDeleting ? 'deleting' : ''}
        ${isCompact ? 'note-card-compact p-3' : 'p-6 pb-5'}
      `}
      style={{
        background: 'var(--color-card-bg)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-card)',
        boxShadow: isCompact ? 'var(--shadow-sm)' : 'var(--shadow-md)',
        transitionTimingFunction: 'var(--spring-bounce)',
        minHeight: isCompact ? 'auto' : '200px',
        maxHeight: isCompact ? '120px' : '300px',
      }}
      role="button"
      tabIndex={0}
      onClick={() => onClick(note.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(note.id);
        }
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = isCompact ? 'translateY(-3px)' : 'translateY(-6px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Accent line - animates on hover (hidden in compact mode) */}
      {!isCompact && (
        <div
          className="
            absolute top-0 left-0 w-full h-[2px]
            bg-[var(--color-accent)]
            opacity-50
            origin-left
            transition-transform duration-500 ease-out
            scale-x-0
            group-hover:scale-x-100
          "
        />
      )}

      {/* Pin button - top-right corner (only in full mode) */}
      {!isCompact && (
        <button
          onClick={handlePinClick}
          className={`
            absolute top-3 right-3
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
            background: note.pinned ? 'var(--color-accent-glow)' : 'var(--color-bg-secondary)',
            color: note.pinned ? 'var(--color-accent-muted)' : 'var(--color-text-tertiary)',
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
      )}

      {/* Title row - with inline pin in compact mode */}
      <div className={`flex items-center gap-2 ${isCompact ? 'mb-1' : 'mb-3'} shrink-0`}>
        {/* Inline pin icon (compact mode only) */}
        {isCompact && note.pinned && (
          <svg
            className="w-3.5 h-3.5 shrink-0"
            fill="currentColor"
            viewBox="0 0 24 24"
            style={{ color: 'var(--color-accent)' }}
          >
            <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        )}
        {/* Title - sanitized to prevent XSS */}
        <h3
          className={`
            font-semibold
            leading-tight
            ${isCompact ? 'text-base truncate' : 'text-xl line-clamp-2'}
          `}
          style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--color-text-primary)',
          }}
          dangerouslySetInnerHTML={{ __html: sanitizeText(note.title) || 'Untitled' }}
        />
      </div>

      {/* Preview - Full HTML in normal mode, single line text in compact */}
      {isCompact ? (
        <p
          className="text-sm truncate flex-1"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-text-secondary)',
          }}
        >
          {compactPreview || 'No content'}
        </p>
      ) : (
        /* Preview - Rendered HTML content (sanitized to prevent XSS) */
        <div
          className="note-card-preview flex-1 overflow-hidden"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(note.content) }}
        />
      )}

      {/* Footer: Tags + Timestamp + Delete */}
      <div className={`flex items-center justify-between mt-auto shrink-0 ${isCompact ? 'pt-2' : 'pt-4'}`}>
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
          className={`
            uppercase
            tracking-[0.1em]
            font-medium
            shrink-0
            ml-3
            ${isCompact ? 'text-[0.6rem]' : 'text-[0.65rem]'}
          `}
          dateTime={note.updatedAt.toISOString()}
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-text-tertiary)',
          }}
        >
          {formatRelativeTime(note.updatedAt)}
        </time>

        {/* Delete button - hidden in compact mode (use swipe instead) */}
        {!isCompact && (
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
            aria-label="Delete note"
            title="Delete note"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>

    </article>
  );
}
