import { useMemo, useState, useEffect, useCallback } from 'react';
import type { Note } from '../types';
import { ChapterSection } from './ChapterSection';
import { ChapterNav } from './ChapterNav';
import { TimeRibbon } from './TimeRibbon';
import {
  groupNotesByChapter,
  getDefaultExpansionState,
  type ChapterKey,
} from '../utils/temporalGrouping';

interface ChapteredLibraryProps {
  notes: Note[];
  onNoteClick: (id: string) => void;
  onNoteDelete: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  searchQuery?: string;
}

export function ChapteredLibrary({
  notes,
  onNoteClick,
  onNoteDelete,
  onTogglePin,
  searchQuery,
}: ChapteredLibraryProps) {
  // Sort notes: pinned first, then by most recent within each chapter
  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => {
      // Pinned notes come first
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      // Within same pin status, sort by updated time
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
  }, [notes]);

  // Group notes by chapter (only returns non-empty chapters)
  const chapters = useMemo(() => {
    return groupNotesByChapter(sortedNotes);
  }, [sortedNotes]);

  // Get default expansion state based on total note count
  const defaultExpansion = useMemo(() => {
    return getDefaultExpansionState(notes.length);
  }, [notes.length]);

  // Track current chapter for navigation
  const [currentChapter, setCurrentChapter] = useState<ChapterKey | null>(
    chapters.length > 0 ? (chapters[0].key as ChapterKey) : null
  );

  // Intersection Observer for scroll detection
  useEffect(() => {
    if (chapters.length === 0) return;

    const observers: IntersectionObserver[] = [];

    chapters.forEach((chapter) => {
      const element = document.getElementById(`chapter-${chapter.key}`);
      if (!element) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && entry.intersectionRatio >= 0.3) {
              setCurrentChapter(chapter.key as ChapterKey);
            }
          });
        },
        {
          threshold: [0.3, 0.5, 0.7],
          rootMargin: '-100px 0px -50% 0px',
        }
      );

      observer.observe(element);
      observers.push(observer);
    });

    return () => {
      observers.forEach((observer) => observer.disconnect());
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
    return chapters.map((c) => ({ key: c.key as ChapterKey, label: c.label }));
  }, [chapters]);

  // Empty state
  if (notes.length === 0) {
    const isSearching = searchQuery && searchQuery.trim().length > 0;

    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          {isSearching ? (
            <>
              <svg
                className="w-12 h-12 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p
                className="text-lg mb-2"
                style={{
                  fontFamily: 'var(--font-display)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                No results for "{searchQuery}"
              </p>
              <p
                className="text-sm"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-tertiary)',
                }}
              >
                Try searching with different keywords
              </p>
            </>
          ) : (
            <>
              <p
                className="text-lg mb-2"
                style={{
                  fontFamily: 'var(--font-display)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                No notes yet
              </p>
              <p
                className="text-sm"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-tertiary)',
                }}
              >
                Create your first note to get started
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <main
        className="flex-1 overflow-y-auto pb-32"
        style={{ scrollbarWidth: 'none' }}
      >
        {/* Render each non-empty chapter */}
        {chapters.map((chapter) => (
          <ChapterSection
            key={chapter.key}
            chapterKey={chapter.key as ChapterKey}
            label={chapter.label}
            notes={chapter.notes}
            defaultExpanded={defaultExpansion[chapter.key as ChapterKey]}
            onNoteClick={onNoteClick}
            onNoteDelete={onNoteDelete}
            onTogglePin={onTogglePin}
          />
        ))}
      </main>

      {/* Chapter Navigation - Desktop (right sidebar) */}
      <ChapterNav
        chapters={navChapters}
        currentChapter={currentChapter}
        onChapterClick={scrollToChapter}
      />

      {/* Time Ribbon - Mobile (bottom scrubber) */}
      <TimeRibbon
        chapters={navChapters}
        currentChapter={currentChapter}
        onChapterClick={scrollToChapter}
      />
    </>
  );
}
