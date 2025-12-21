import { useState, useEffect } from 'react';
import Masonry from 'react-masonry-css';
import type { Note } from '../types';
import type { ChapterKey } from '../utils/temporalGrouping';
import { NoteCard } from './NoteCard';

interface ChapterSectionProps {
  chapterKey: ChapterKey;
  label: string;
  notes: Note[];
  defaultExpanded: boolean;
  onNoteClick: (id: string) => void;
  onNoteDelete: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
}

// Visual treatment based on chapter age
const CHAPTER_OPACITY: Record<ChapterKey, number> = {
  today: 1.0,
  thisWeek: 0.95,
  thisMonth: 0.90,
  lastMonth: 0.85,
  seasonsPast: 0.80,
};

export function ChapterSection({
  chapterKey,
  label,
  notes,
  defaultExpanded,
  onNoteClick,
  onNoteDelete,
  onTogglePin,
}: ChapterSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Sync with defaultExpanded when it changes (e.g., from preferences)
  useEffect(() => {
    setIsExpanded(defaultExpanded);
  }, [defaultExpanded]);

  const opacity = CHAPTER_OPACITY[chapterKey];

  // Get first 3 note titles for collapsed preview
  const previewTitles = notes
    .slice(0, 3)
    .map((n) => n.title || 'Untitled')
    .join(' · ');

  return (
    <section
      id={`chapter-${chapterKey}`}
      className="mb-8"
      aria-label={`${label} - ${notes.length} notes`}
    >
      {/* Chapter Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="
          w-full
          flex items-center justify-between
          px-6 md:px-12
          py-3
          text-left
          transition-all duration-200
          hover:bg-[var(--color-bg-secondary)]
          focus:outline-none
          focus:bg-[var(--color-bg-secondary)]
          group
        "
        aria-expanded={isExpanded}
        aria-controls={`chapter-content-${chapterKey}`}
      >
        <div className="flex items-center gap-3">
          {/* Chevron */}
          <svg
            className={`
              w-4 h-4
              transition-transform duration-200
              ${isExpanded ? 'rotate-0' : '-rotate-90'}
            `}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
          </svg>

          {/* Chapter Label */}
          <h2
            className="text-lg font-semibold"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--color-text-primary)',
            }}
          >
            {label}
          </h2>
        </div>

        {/* Note Count */}
        <span
          className="text-sm"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-text-tertiary)',
          }}
        >
          {notes.length} {notes.length === 1 ? 'note' : 'notes'}
        </span>
      </button>

      {/* Divider Line */}
      <div
        className="mx-6 md:mx-12 mb-4"
        style={{
          borderTop: isExpanded
            ? '1px solid var(--glass-border)'
            : '1px dashed var(--glass-border)',
        }}
      />

      {/* Collapsed Preview */}
      {!isExpanded && previewTitles && (
        <div
          className="px-6 md:px-12 pb-4"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-text-tertiary)',
            fontSize: '0.875rem',
            opacity: 0.7,
          }}
        >
          {previewTitles}
          {notes.length > 3 && ' ...'}
        </div>
      )}

      {/* Expanded Content */}
      {isExpanded && (
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
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onClick={onNoteClick}
                onDelete={onNoteDelete}
                onTogglePin={onTogglePin}
              />
            ))}
          </Masonry>
        </div>
      )}
    </section>
  );
}
