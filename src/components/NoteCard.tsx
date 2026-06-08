import { useState, useMemo, useRef, useEffect, memo } from 'react';
import type { Note } from '../types';
import { formatRelativeTime } from '../utils/formatTime';
import { TagBadgeList } from './TagBadge';
import { sanitizeHtml, sanitizeText, htmlToPlainText, escapeHtml } from '../utils/sanitize';

interface NoteCardProps {
  note: Note;
  onClick: (id: string) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  isCompact?: boolean;
  isDecorative?: boolean;
  searchQuery?: string;
}

export const NoteCard = memo(function NoteCard({
  note,
  onClick,
  onDelete,
  onTogglePin,
  isCompact = false,
  isDecorative = false,
  searchQuery
}: NoteCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Plain text for compact mode and search (memoized to avoid repeated DOMPurify calls)
  const plainText = useMemo(() => htmlToPlainText(note.content), [note.content]);
  const compactPreview = plainText.slice(0, 80) + (plainText.length > 80 ? '...' : '');
  // Sanitized HTML preview preserves task list checkboxes, formatting structure
  const htmlPreview = useMemo(() => sanitizeHtml(note.content), [note.content]);

  // Search snippet: ~40 chars around the first match with <mark> highlighting
  const searchSnippet = (() => {
    if (!searchQuery) return null;
    const query = searchQuery.toLowerCase();
    const idx = plainText.toLowerCase().indexOf(query);
    if (idx === -1) return null;

    const start = Math.max(0, idx - 20);
    const end = Math.min(plainText.length, idx + searchQuery.length + 20);
    const before = escapeHtml(plainText.slice(start, idx));
    const match = escapeHtml(plainText.slice(idx, idx + searchQuery.length));
    const after = escapeHtml(plainText.slice(idx + searchQuery.length, end));
    return `${start > 0 ? '...' : ''}${before}<mark>${match}</mark>${after}${end < plainText.length ? '...' : ''}`;
  })();

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleting(true);
  };

  useEffect(() => {
    if (!isDeleting) return;
    const el = cardRef.current;
    if (!el) return;
    const noteId = note.id;
    const deleteNote = onDelete;
    let called = false;
    const handleAnimationEnd = () => {
      if (!called) {
        called = true;
        deleteNote(noteId);
      }
    };
    el.addEventListener('animationend', handleAnimationEnd, { once: true });
    return () => {
      el.removeEventListener('animationend', handleAnimationEnd);
      if (!called) {
        called = true;
        deleteNote(noteId);
      }
    };
  }, [isDeleting, note.id, onDelete]);

  const handlePinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTogglePin(note.id, !note.pinned);
  };

  return (
    <div
      ref={cardRef}
      className={`
        group
        note-card
        relative
        overflow-hidden
        flex flex-col
        transition-all duration-300
        focus:outline-none
        focus:ring-2
        focus:ring-[var(--color-accent)]
        focus:ring-offset-2
        ${isDecorative ? '' : 'cursor-pointer active:scale-[0.98]'}
        ${isDeleting ? 'deleting' : ''}
        ${isCompact ? 'note-card-compact p-3' : 'p-6 pb-5'}
      `}
      style={{
        background: 'linear-gradient(to bottom, var(--color-card-bg), color-mix(in srgb, var(--color-card-bg) 97%, var(--color-accent)))',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-card)',
        boxShadow: isCompact ? 'var(--shadow-sm)' : 'var(--shadow-md)',
        transitionTimingFunction: 'var(--ease-out-quint)',
        minHeight: isCompact ? 'auto' : '280px',
        maxHeight: isCompact ? '120px' : '300px',
      }}
      onMouseEnter={(e) => {
        if (!isCompact && !isDecorative) {
          e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
        }
      }}
      onMouseLeave={(e) => {
        if (isDecorative) return;
        e.currentTarget.style.boxShadow = isCompact ? 'var(--shadow-sm)' : 'var(--shadow-md)';
      }}
    >
      {!isDecorative && (
        <button
          type="button"
          className="absolute inset-0 z-10 h-full w-full rounded-[inherit] border-0 bg-transparent p-0 focus-ring"
          aria-label={`Open note: ${note.title || 'Untitled'}`}
          onClick={() => onClick(note.id)}
        />
      )}

      {/* Pin button - top-right corner (only in full mode) */}
      {!isCompact && !isDecorative && (
        <button type="button"
          onClick={handlePinClick}
          className={`
            absolute top-2 right-2
            z-20
            size-10
            rounded-full
            flex items-center justify-center
            transition-opacity duration-200
            focus:outline-none
            focus:ring-2
            focus:ring-[var(--color-accent)]
            focus-visible:opacity-100
            ${note.pinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-40 hover:!opacity-85'}
          `}
          style={{
            background: note.pinned ? 'var(--color-accent-glow)' : 'transparent',
            color: note.pinned ? 'var(--color-accent-muted)' : 'var(--color-text-tertiary)',
          }}
          aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
          title={note.pinned ? 'Unpin note' : 'Pin note'}
        >
          <svg className="size-4" fill={note.pinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </button>
      )}
      {!isCompact && isDecorative && note.pinned && (
        <span
          className="absolute top-4 right-4 z-20 flex size-6 items-center justify-center"
          style={{ color: 'var(--color-accent-muted)' }}
          aria-hidden="true"
        >
          <svg className="size-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </span>
      )}

      {/* Title row - with inline pin in compact mode */}
      <div className={`flex items-center gap-2 ${isCompact ? 'mb-1' : 'mb-3'} shrink-0`}>
        {/* Inline pin icon (compact mode only) */}
        {isCompact && note.pinned && (
          <svg
            className="size-3.5 shrink-0"
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

      {/* Preview - HTML in full mode (preserves task lists), plain text in compact */}
      {isCompact ? (
        <p
          className="flex-1 overflow-hidden text-sm truncate"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-text-secondary)',
          }}
        >
          {compactPreview || 'No content'}
        </p>
      ) : (
        <div
          className="flex-1 overflow-hidden note-card-preview"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-text-secondary)',
          }}
          dangerouslySetInnerHTML={{ __html: htmlPreview || 'No content' }}
        />
      )}

      {/* Search snippet with match highlighting */}
      {searchSnippet && (
        <p
          className="text-xs mt-1 overflow-hidden"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-text-tertiary)',
            lineHeight: 1.4,
          }}
          dangerouslySetInnerHTML={{ __html: searchSnippet }}
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
        {!isCompact && !isDecorative && (
          <button type="button"
            onClick={handleDeleteClick}
            className="
              relative z-20
              size-10
              rounded-full
              flex items-center justify-center
              opacity-0
              group-hover:opacity-40
              hover:!opacity-85
              transition-opacity duration-200
              focus:outline-none
              focus:ring-2
              focus:ring-[var(--color-accent)]
              focus-visible:opacity-100
              ml-2
              -mr-4
              shrink-0
            "
            style={{
              background: 'transparent',
              color: 'var(--color-text-tertiary)',
            }}
            aria-label="Delete note"
            title="Delete note"
          >
            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>

    </div>
  );
}, (prev, next) =>
  prev.note === next.note &&
  prev.isCompact === next.isCompact &&
  prev.isDecorative === next.isDecorative &&
  prev.searchQuery === next.searchQuery
);
