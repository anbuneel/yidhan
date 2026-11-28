import type { RefObject } from 'react';
import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import type { Note, NoteDeleteHandler } from '../types';
import { ChapterSection } from './ChapterSection';
import { LibraryArrangeBar } from './LibraryArrangeBar';
import { ChapterNav } from './ChapterNav';
import { LogoMark } from './LogoMark';
import { TimeRibbon } from './TimeRibbon';
import { PullToRefresh } from './PullToRefresh';
import { useTouchCapable, useMobileDetect } from '../hooks/useMobileDetect';
import {
  groupNotesByChapter,
  getDefaultExpansionState,
  DEFAULT_ARRANGEMENT,
  type ChapterArrangement,
  type ChapterBasis,
  type ChapterKey,
  type LibrarySectionKey,
  type NoteSortKey,
} from '../utils/temporalGrouping';
import { scrollRegionProps } from '../routing';

/** A locked card without a retry wired up simply does nothing on click. */
const noop = () => undefined;

// Mobile breakpoint matching masonry grid (< 700px)
const COMPACT_VIEWPORT_QUERY = '(max-width: 699px)';

// Tracks whether the library has already painted notes in this page session.
// Returning from a note remounts ChapteredLibrary; skipping the entrance stagger
// on subsequent mounts keeps back-navigation immediate.
let libraryHasPaintedInSession = false;

export function resetLibraryEntranceForTests(): void {
  libraryHasPaintedInSession = false;
}

interface ChapteredLibraryProps {
  footerRef?: RefObject<HTMLElement | null>;
  notes: Note[];
  onNoteClick: (id: string) => void;
  /** Re-read the library so a note that failed to decrypt can be tried again. */
  onRetryLockedNote?: () => void;
  onNoteDelete: NoteDeleteHandler;
  onTogglePin: (id: string, pinned: boolean) => void;
  onNewNote?: () => void;
  onRefresh?: () => Promise<void>;
  searchQuery?: string;
  isSearching?: boolean;
  isRankedSearch?: boolean;
  searchMatchTerms?: ReadonlyMap<string, readonly string[]>;
  isLoading?: boolean;
  focusedNoteId?: string | null;
  /** How chapters are grouped and ordered. Defaults to the long-standing behaviour. */
  arrangement?: ChapterArrangement;
  /** Supply both handlers to offer the reader the arrangement controls. */
  onBasisChange?: (basis: ChapterBasis) => void;
  onSortChange?: (sort: NoteSortKey) => void;
}

type EmptyState = 'loading' | 'search-empty' | 'library-empty' | null;

function emptyStateOf(noteCount: number, isSearching: boolean, isLoading: boolean): EmptyState {
  if (noteCount > 0) return null;
  if (isLoading) return 'loading';
  return isSearching ? 'search-empty' : 'library-empty';
}

const EMPTY_STATE_ANNOUNCEMENTS: Record<'search-empty' | 'library-empty', string> = {
  'search-empty': 'No thoughts found. Try a different search.',
  'library-empty': 'Your notes await.',
};

/**
 * A polite live region that stays mounted across every library state, so a
 * search that empties the list is announced. The state reached on first load
 * is the baseline and is never announced: the reader did not cause it.
 */
function LibraryEmptyAnnouncer({ noteCount, isSearching, isLoading }: {
  noteCount: number;
  isSearching: boolean;
  isLoading: boolean;
}) {
  const state = emptyStateOf(noteCount, isSearching, isLoading);
  const baselineSeen = useRef(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (state === 'loading') return;
    if (!baselineSeen.current) {
      baselineSeen.current = true;
      return;
    }
    setMessage(state ? EMPTY_STATE_ANNOUNCEMENTS[state] : '');
  }, [state]);

  return (
    <output aria-live="polite" className="sr-only" data-testid="library-announcer">
      {message}
    </output>
  );
}

export function ChapteredLibrary(props: ChapteredLibraryProps) {
  return (
    <>
      <LibraryEmptyAnnouncer
        noteCount={props.notes.length}
        isSearching={props.isSearching ?? false}
        isLoading={props.isLoading ?? false}
      />
      <ChapteredLibraryView {...props} />
    </>
  );
}

function ChapteredLibraryView({
  footerRef,
  notes,
  onNoteClick,
  onRetryLockedNote,
  onNoteDelete,
  onTogglePin,
  onNewNote,
  onRefresh,
  searchQuery,
  isSearching = false,
  isRankedSearch = false,
  searchMatchTerms,
  isLoading = false,
  focusedNoteId,
  arrangement = DEFAULT_ARRANGEMENT,
  onBasisChange,
  onSortChange,
}: ChapteredLibraryProps) {
  // Auto-detect compact mode via matchMedia (avoids resize churn when mobile browser chrome hides)
  const [isCompact, setIsCompact] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia(COMPACT_VIEWPORT_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mediaQuery = window.matchMedia(COMPACT_VIEWPORT_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      setIsCompact(event.matches);
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(handleChange);
      return () => {
        if (typeof mediaQuery.removeListener === 'function') {
          mediaQuery.removeListener(handleChange);
        }
      };
    }
  }, []);

  // Entrance stagger runs only on the first library load of the session, never on
  // back-navigation (remount) or search results.
  const [allowEntranceStagger, setAllowEntranceStagger] = useState(
    () => !libraryHasPaintedInSession && !isSearching
  );

  useEffect(() => {
    if (!isLoading && notes.length > 0) {
      libraryHasPaintedInSession = true;
    }
  }, [isLoading, notes.length]);

  useEffect(() => {
    if (isSearching && allowEntranceStagger) {
      setAllowEntranceStagger(false);
    }
  }, [isSearching, allowEntranceStagger]);

  const animateEntrance = allowEntranceStagger && !isSearching;

  // Detect touch capability for pull-to-refresh
  const isTouchDevice = useTouchCapable();

  // Detect mobile for gesture hint
  const isMobile = useMobileDetect();

  // Search ranking is global, so search results stay in one section. Chronological
  // chapters would otherwise reorder a high-ranking older result below a newer one.
  const chapters = useMemo(() => {
    if (isRankedSearch) {
      return [{ key: 'search' as const, label: 'Search results', notes }];
    }
    return groupNotesByChapter(notes, arrangement);
  }, [notes, arrangement, isRankedSearch]);

  // Get default expansion state based on total note count
  const defaultExpansion = useMemo(() => {
    return getDefaultExpansionState(notes.length);
  }, [notes.length]);

  // Track current chapter for navigation
  const [currentChapter, setCurrentChapter] = useState<LibrarySectionKey | null>(
    chapters.length > 0 ? chapters[0].key : null
  );

  // Intersection Observer for scroll detection
  useEffect(() => {
    if (chapters.length === 0) return;

    // Use a single observer for all chapters to improve performance
    // Bolt: Optimized from N observers to 1 observer
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.1) {
            // Extract chapter key from element ID (format: "chapter-{key}")
            const chapterKey = entry.target.id.replace('chapter-', '');
            if (chapterKey) {
              setCurrentChapter(chapterKey as LibrarySectionKey);
            }
          }
        });
      },
      {
        threshold: [0.1, 0.3, 0.5],
        rootMargin: '-80px 0px -20% 0px',
      }
    );

    chapters.forEach((chapter) => {
      const element = document.getElementById(`chapter-${chapter.key}`);
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [chapters]);

  // Smooth scroll to chapter
  const scrollToChapter = useCallback((key: ChapterKey) => {
    const element = document.getElementById(`chapter-${key}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Navigation chapters (for ChapterNav and TimeRibbon)
  const navChapters = useMemo(() => {
    if (isRankedSearch) return [];
    return chapters.map((c) => ({ key: c.key as ChapterKey, label: c.label }));
  }, [chapters, isRankedSearch]);

  if (isLoading && notes.length === 0) {
    return (
      <main
        className="flex-1 overflow-y-auto pb-[calc(8rem+env(safe-area-inset-bottom))] relative"
        style={{ scrollbarWidth: 'none' }}
        data-testid="library-view"
        aria-busy="true"
        {...scrollRegionProps}
      />
    );
  }

  // Search-active empty state — show distinct "No thoughts found" message
  if (notes.length === 0 && isSearching) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <p
            className="text-2xl mb-3"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--color-text-primary)',
              fontWeight: 400,
              letterSpacing: '-0.01em',
            }}
          >
            No thoughts found
          </p>
          <p
            className="text-base"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--color-text-tertiary)',
              lineHeight: 1.6,
            }}
          >
            Try a different search
          </p>
        </div>
      </div>
    );
  }

  // Empty state (no notes at all)
  if (notes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
            <>
              {/* The mark, decorative: the heading below names the state. */}
              <LogoMark size={64} className="mx-auto mb-6" />
              <p
                className="text-2xl mb-3"
                style={{
                  fontFamily: 'var(--font-display)',
                  color: 'var(--color-text-primary)',
                  fontWeight: 400,
                  letterSpacing: '-0.01em',
                }}
              >
                Your notes await
              </p>
              <p
                className="text-base mb-8"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-tertiary)',
                  lineHeight: 1.6,
                }}
              >
                Write a note to get started.
              </p>
              {onNewNote && (
                <button type="button"
                  onClick={onNewNote}
                  className="px-6 py-3 font-medium transition-[background-color,transform] duration-300 mb-4 touch-press focus-ring"
                  style={{
                    fontFamily: 'var(--font-body)',
                    background: 'var(--color-cta-bg)',
                    color: 'var(--color-cta-text)',
                    borderRadius: 'var(--radius-button)',
                    boxShadow: 'none',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--color-cta-bg-hover)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--color-cta-bg)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  Create your first note
                </button>
              )}
              <p
                className="text-xs"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-tertiary)',
                }}
              >
                or press{' '}
                <kbd
                  className="px-1.5 py-0.5 rounded text-xs"
                  style={{
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--glass-border)',
                  }}
                >
                  {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}
                </kbd>
                {' + '}
                <kbd
                  className="px-1.5 py-0.5 rounded text-xs"
                  style={{
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--glass-border)',
                  }}
                >
                  N
                </kbd>
              </p>
            </>
        </div>
      </div>
    );
  }

  // Library content (rendered inside or outside PullToRefresh based on device)
  const libraryContent = (
    <main
      className="flex-1 overflow-y-auto pb-[calc(8rem+env(safe-area-inset-bottom))] relative"
      style={{ scrollbarWidth: 'none' }}
      data-testid="library-view"
      {...scrollRegionProps}
    >
      {onBasisChange && onSortChange && (
        <LibraryArrangeBar
          arrangement={arrangement}
          onBasisChange={onBasisChange}
          onSortChange={onSortChange}
        />
      )}

      {/* Render each non-empty chapter */}
      {chapters.map((chapter, chapterIndex) => (
        <ChapterSection
          showGestureHint={isMobile && chapterIndex === 0}
          key={chapter.key}
          chapterKey={chapter.key}
          label={chapter.label}
          notes={chapter.notes}
          defaultExpanded={chapter.key === 'search' ? true : defaultExpansion[chapter.key]}
          isPinned={chapter.key === 'search' ? false : chapter.isPinned}
          onNoteClick={onNoteClick}
          onRetryLockedNote={onRetryLockedNote ?? noop}
          onNoteDelete={onNoteDelete}
          onTogglePin={onTogglePin}
          isCompact={isCompact}
          searchQuery={searchQuery}
          searchMatchTerms={searchMatchTerms}
          isSearching={isSearching}
          animateEntrance={animateEntrance}
          focusedNoteId={focusedNoteId}
        />
      ))}
    </main>
  );

  return (
    <>
      {/* Wrap with PullToRefresh on touch devices when onRefresh is provided */}
      {isTouchDevice && onRefresh ? (
        <PullToRefresh onRefresh={onRefresh}>
          {libraryContent}
        </PullToRefresh>
      ) : (
        libraryContent
      )}

      {/* Chapter Navigation - Desktop (right sidebar) */}
      <ChapterNav
        chapters={navChapters}
        currentChapter={currentChapter === 'search' ? null : currentChapter}
        onChapterClick={scrollToChapter}
      />

      {/* Time Ribbon - Mobile (bottom scrubber) */}
      <TimeRibbon
        footerRef={footerRef}
        noteCount={notes.length}
        chapters={navChapters}
        currentChapter={currentChapter === 'search' ? null : currentChapter}
        onChapterClick={scrollToChapter}
      />
    </>
  );
}
