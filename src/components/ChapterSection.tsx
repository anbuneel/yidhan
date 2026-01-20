import { useState } from 'react';
import Masonry from 'react-masonry-css';
import type { Note } from '../types';
import type { ChapterKey } from '../utils/temporalGrouping';
import { NoteCard } from './NoteCard';
import { SwipeableNoteCard } from './SwipeableNoteCard';
import { useTouchCapable } from '../hooks/useMobileDetect';

interface ChapterSectionProps {
  chapterKey: ChapterKey;
  label: string;
  notes: Note[];
  defaultExpanded: boolean;
  isPinned?: boolean;
  onNoteClick: (id: string) => void;
  onNoteDelete: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  isCompact?: boolean;
}

// Visual treatment based on chapter age (subtle opacity reduction for older notes)
const CHAPTER_OPACITY: Record<ChapterKey, number> = {
  pinned: 1.0,
  thisWeek: 1.0,
  lastWeek: 0.95,
  thisMonth: 0.90,
  earlier: 0.85,
  archive: 0.80,
};

export function ChapterSection({
  chapterKey,
  label,
  notes,
  defaultExpanded,
  isPinned = false,
  onNoteClick,
  onNoteDelete,
  onTogglePin,
  isCompact = false,
}: ChapterSectionProps) {
  // Detect touch capability for swipe gestures
  const isTouchDevice = useTouchCapable();

  // Pinned section is always expanded, others follow defaultExpanded
  // Using a key-based reset pattern instead of useEffect to avoid lint warning
  const [isExpanded, setIsExpanded] = useState(isPinned ? true : defaultExpanded);
  const [prevDefaultExpanded, setPrevDefaultExpanded] = useState(defaultExpanded);

  // Sync with defaultExpanded when it changes (except for pinned)
  if (defaultExpanded !== prevDefaultExpanded) {
    setPrevDefaultExpanded(defaultExpanded);
    if (!isPinned) {
      setIsExpanded(defaultExpanded);
    }
  }

  const opacity = CHAPTER_OPACITY[chapterKey];

  // Get first 3 note titles for collapsed preview
  const previewTitles = notes
    .slice(0, 3)
    .map((n) => n.title || 'Untitled')
    .join(' · ');

  // Determine if this section should be collapsible
  // Pinned is never collapsible, others are collapsible if they have 20+ notes
  const isCollapsible = !isPinned && notes.length >= 20;

  // If section is not collapsible, it must always be expanded
  // (prevents stuck-collapsed state when defaultExpanded=false but isCollapsible=false)
  const effectiveExpanded = isCollapsible ? isExpanded : true;

  return (
    <section
      id={`chapter-${chapterKey}`}
      className="mb-0"
      aria-label={`${label} - ${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`}
      style={isPinned ? {
        background: 'rgba(var(--color-accent-rgb), 0.03)',
        borderRadius: '8px',
        marginBottom: '0.75rem',
        padding: '0.25rem 0',
      } : undefined}
    >
      {/* Whisper Header - compact single line, z-index above lifted cards */}
      <div
        className={`
          relative z-10
          flex items-center
          px-6 md:px-12
          py-1
          ${isCollapsible ? 'cursor-pointer hover:bg-[var(--color-bg-secondary)] transition-colors duration-200' : ''}
        `}
        style={{
          borderLeft: '2px solid var(--color-accent-muted)',
          marginLeft: '1rem',
          paddingLeft: 'calc(1.5rem - 2px)',
        }}
        onClick={isCollapsible ? () => setIsExpanded(!isExpanded) : undefined}
        role={isCollapsible ? 'button' : undefined}
        aria-expanded={isCollapsible ? effectiveExpanded : undefined}
        aria-controls={isCollapsible ? `chapter-content-${chapterKey}` : undefined}
        tabIndex={isCollapsible ? 0 : undefined}
        onKeyDown={isCollapsible ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        } : undefined}
      >
        {/* Label with optional chevron for collapsible sections */}
        <div className="flex items-center gap-2 shrink-0">
          {isCollapsible && (
            <svg
              className={`
                w-3 h-3
                transition-transform duration-200
                ${isExpanded ? 'rotate-0' : '-rotate-90'}
              `}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}

          <span
            className="text-sm font-medium"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--color-text-secondary)',
            }}
          >
            {label}
          </span>
        </div>

        {/* Dashed line separator */}
        <div
          className="flex-1 mx-3 border-b border-dashed"
          style={{ borderColor: 'var(--glass-border)' }}
        />

        {/* Note count */}
        <span
          className="text-xs shrink-0"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-text-tertiary)',
          }}
        >
          {notes.length} {notes.length === 1 ? 'note' : 'notes'}
        </span>
      </div>

      {/* Collapsed Preview (only for collapsible sections) */}
      {isCollapsible && !effectiveExpanded && previewTitles && (
        <div
          className="px-6 md:px-12 pb-2"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-text-tertiary)',
            fontSize: '0.75rem',
            opacity: 0.7,
          }}
        >
          {previewTitles}
          {notes.length > 3 && ' ...'}
        </div>
      )}

      {/* Expanded Content */}
      {effectiveExpanded && (
        <div
          id={`chapter-content-${chapterKey}`}
          style={{ opacity }}
        >
          <Masonry
            breakpointCols={{
              default: 3,
              1100: 2,
              700: 1,
            }}
            className="masonry-grid px-6 md:px-12"
            columnClassName="masonry-grid-column"
          >
            {notes.map((note, index) => (
              <div
                key={note.id}
                className="note-card-entrance"
                style={{
                  animationDelay: `${Math.min(index * 0.05, 0.5)}s`,
                }}
              >
                {isTouchDevice ? (
                  <SwipeableNoteCard
                    note={note}
                    onClick={onNoteClick}
                    onDelete={onNoteDelete}
                    onTogglePin={onTogglePin}
                    isCompact={isCompact}
                  />
                ) : (
                  <NoteCard
                    note={note}
                    onClick={onNoteClick}
                    onDelete={onNoteDelete}
                    onTogglePin={onTogglePin}
                    isCompact={isCompact}
                  />
                )}
              </div>
            ))}
          </Masonry>
        </div>
      )}
    </section>
  );
}
