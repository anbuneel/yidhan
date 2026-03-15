import { useState, useEffect, useRef, useMemo, memo } from 'react';
import Masonry from 'react-masonry-css';
import type { Note } from '../types';
import type { ChapterKey } from '../utils/temporalGrouping';
import { WATERLINE_TEXT } from '../utils/temporalGrouping';
import { NoteCard } from './NoteCard';
import { SwipeableNoteCard } from './SwipeableNoteCard';
import { useTouchCapable } from '../hooks/useMobileDetect';

const INITIAL_CARD_COUNT = 6;
const BATCH_SIZE = 6;

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
  searchQuery?: string;
  matchedNoteIds?: Set<string>;
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

export const ChapterSection = memo(function ChapterSection({
  chapterKey,
  label,
  notes,
  defaultExpanded,
  isPinned = false,
  onNoteClick,
  onNoteDelete,
  onTogglePin,
  isCompact = false,
  searchQuery,
  matchedNoteIds,
}: ChapterSectionProps) {
  // Detect touch capability for swipe gestures
  const isTouchDevice = useTouchCapable();

  // Pinned section is always expanded, others follow defaultExpanded
  const [isExpanded, setIsExpanded] = useState(isPinned ? true : defaultExpanded);
  const [prevDefaultExpanded, setPrevDefaultExpanded] = useState(defaultExpanded);

  // Sync with defaultExpanded when it changes (except for pinned)
  if (defaultExpanded !== prevDefaultExpanded) {
    setPrevDefaultExpanded(defaultExpanded);
    if (!isPinned) {
      setIsExpanded(defaultExpanded);
    }
  }

  // --- Progressive rendering ---
  const [visibleCount, setVisibleCount] = useState(INITIAL_CARD_COUNT);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(false);

  // Fingerprint: detect when the note set meaningfully changes (memoized to avoid rebuilding on unrelated renders)
  const fingerprint = useMemo(() => notes.map(n => n.id).join(','), [notes]);

  // Reset visibleCount when fingerprint changes (derive-from-props pattern)
  const [prevFingerprint, setPrevFingerprint] = useState(fingerprint);
  if (fingerprint !== prevFingerprint) {
    setPrevFingerprint(fingerprint);
    if (visibleCount !== INITIAL_CARD_COUNT) {
      setVisibleCount(INITIAL_CARD_COUNT);
    }
  }

  // Search is "active" only after debounce settles (matchedNoteIds is defined)
  const isSearchActive = matchedNoteIds !== undefined;

  // Determine if this section should be collapsible
  const isCollapsible = !isPinned && notes.length >= 20;

  // Force-expand during search so matches in collapsed chapters are visible
  const effectiveExpanded = isSearchActive
    ? true
    : isCollapsible
      ? isExpanded
      : true;

  const displayNotes = isSearchActive ? notes : notes.slice(0, visibleCount);
  const hasMore = !isSearchActive && visibleCount < notes.length;
  const remainingCount = Math.max(0, notes.length - visibleCount);

  // IntersectionObserver for progressive loading
  useEffect(() => {
    if (!sentinelRef.current || isSearchActive) return;

    readyRef.current = false;
    const sentinel = sentinelRef.current;

    const totalNotes = notes.length;
    let rafId: number | undefined;

    // Drain loop: check if sentinel is still visible after each batch
    const drainCheck = () => {
      if (!sentinel) return;
      const rect = sentinel.getBoundingClientRect();
      const inViewport = rect.top < window.innerHeight + 200;
      if (inViewport) {
        setVisibleCount(prev => {
          const next = Math.min(prev + BATCH_SIZE, totalNotes);
          if (next > prev) {
            rafId = requestAnimationFrame(drainCheck);
          }
          return next;
        });
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (!readyRef.current) return;
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleCount(prev => Math.min(prev + BATCH_SIZE, totalNotes));
            rafId = requestAnimationFrame(drainCheck);
          }
        });
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinel);

    const timer = setTimeout(() => {
      readyRef.current = true;
      drainCheck();
    }, 100);

    return () => {
      observer.disconnect();
      clearTimeout(timer);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isSearchActive, notes.length, fingerprint, effectiveExpanded]);

  const opacity = CHAPTER_OPACITY[chapterKey];

  // Get first 3 note titles for collapsed preview
  const previewTitles = notes
    .slice(0, 3)
    .map((n) => n.title || 'Untitled')
    .join(' · ');

  return (
    <section
      id={`chapter-${chapterKey}`}
      className="mb-0"
      aria-label={`${label} - ${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`}
      style={isPinned ? {
        background: 'color-mix(in srgb, var(--color-accent) 3%, transparent)',
        borderRadius: '8px',
        marginBottom: '0.75rem',
        padding: '0.25rem 0',
      } : undefined}
    >
      {/* Whisper Header */}
      <div
        className={`
          relative z-10
          flex items-center
          px-6 md:px-12
          py-1
          ${isCollapsible && !isSearchActive ? 'cursor-pointer hover:bg-[var(--color-bg-secondary)] transition-colors duration-200' : ''}
        `}
        style={{
          borderLeft: '2px solid var(--color-accent-muted)',
          marginLeft: '1rem',
          paddingLeft: 'calc(1.5rem - 2px)',
        }}
        onClick={isCollapsible && !isSearchActive ? () => setIsExpanded(!isExpanded) : undefined}
        role={isCollapsible && !isSearchActive ? 'button' : undefined}
        aria-expanded={isCollapsible && !isSearchActive ? effectiveExpanded : undefined}
        aria-controls={isCollapsible && !isSearchActive ? `chapter-content-${chapterKey}` : undefined}
        tabIndex={isCollapsible && !isSearchActive ? 0 : undefined}
        onKeyDown={isCollapsible && !isSearchActive ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        } : undefined}
      >
        {/* Label with optional chevron for collapsible sections */}
        <div className="flex items-center gap-2 shrink-0">
          {isCollapsible && !isSearchActive && (
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
            className="text-base font-medium"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--color-text-primary)',
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

      {/* Collapsed Preview (only for collapsible sections when not searching) */}
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
            {displayNotes.map((note, index) => {
              const isFaded = isSearchActive && matchedNoteIds && !matchedNoteIds.has(note.id);
              const isMatch = isSearchActive && matchedNoteIds && matchedNoteIds.has(note.id);

              return (
                <div
                  key={note.id}
                  className={`note-card-entrance${isFaded ? ' note-card-search-fade' : ''}${isMatch ? ' note-card-search-match' : ''}`}
                  style={{
                    animationDelay: `${Math.min(index * 0.06, 0.6)}s`,
                  }}
                  {...(isFaded ? { 'aria-hidden': true, inert: true } : {})}
                >
                  {isTouchDevice ? (
                    <SwipeableNoteCard
                      note={note}
                      onClick={onNoteClick}
                      onDelete={onNoteDelete}
                      onTogglePin={onTogglePin}
                      isCompact={isCompact}
                      searchQuery={isMatch ? searchQuery : undefined}
                    />
                  ) : (
                    <NoteCard
                      note={note}
                      onClick={onNoteClick}
                      onDelete={onNoteDelete}
                      onTogglePin={onTogglePin}
                      isCompact={isCompact}
                      searchQuery={isMatch ? searchQuery : undefined}
                    />
                  )}
                </div>
              );
            })}
          </Masonry>

          {/* Sentinel for IntersectionObserver */}
          {hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}

          {/* Waterline */}
          {hasMore && (
            <div className="waterline">
              <p className="waterline-text">
                {WATERLINE_TEXT[chapterKey](remainingCount)}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}, (prev, next) =>
  prev.notes === next.notes &&
  prev.chapterKey === next.chapterKey &&
  prev.label === next.label &&
  prev.defaultExpanded === next.defaultExpanded &&
  prev.isPinned === next.isPinned &&
  prev.isCompact === next.isCompact &&
  prev.searchQuery === next.searchQuery &&
  prev.matchedNoteIds === next.matchedNoteIds &&
  prev.onNoteClick === next.onNoteClick &&
  prev.onNoteDelete === next.onNoteDelete &&
  prev.onTogglePin === next.onTogglePin
);
