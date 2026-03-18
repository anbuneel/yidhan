/**
 * DemoPage
 *
 * Full-featured demo experience for Yidhan.
 * Users can create notes, use tags, and experience the full editor
 * without signing up. Notes persist in localStorage.
 *
 * Shows soft signup prompts after engagement thresholds
 * (3+ notes AND 5+ minutes).
 */

import { useState, useCallback, useEffect, useMemo, Suspense, useRef } from 'react';
import type { Note, Tag, Theme, TagColor } from '../types';
import { useDemoState } from '../hooks/useDemoState';
import { useSoftPrompt } from '../hooks/useSoftPrompt';
import { ImpermanenceRibbon } from '../components/demo/ImpermanenceRibbon';
import { InvitationModal } from '../components/demo/InvitationModal';
import { ChapteredLibrary } from '../components/ChapteredLibrary';
import { TagFilterBar } from '../components/TagFilterBar';
import { Footer } from '../components/Footer';
import { HeaderShell } from '../components/HeaderShell';
import { LoadingFallback } from '../components/LoadingFallback';
import { Logo } from '../components/Logo';
import { DEMO_SEARCH_INPUT_ID, scheduleSearchFocus } from '../utils/searchFocus';
import { htmlToPlainText } from '../utils/sanitize';
import { lazyWithRetry } from '../utils/lazyWithRetry';

// Lazy load heavy components
const Editor = lazyWithRetry(() =>
  import('../components/Editor').then((module) => ({ default: module.Editor }))
);
const TagModal = lazyWithRetry(() =>
  import('../components/TagModal').then((module) => ({ default: module.TagModal }))
);
const KeyboardShortcutsModal = lazyWithRetry(() =>
  import('../components/KeyboardShortcutsModal').then((module) => ({ default: module.KeyboardShortcutsModal }))
);

// Demo-specific user ID (used internally, not a real user)
const DEMO_USER_ID = 'demo-user';
let lastHandledDemoSearchFocusToken = 0;

interface DemoPageProps {
  onSignUp: () => void;
  onSignIn: () => void;
  theme: Theme;
  onThemeToggle: () => void;
  onChangelogClick: () => void;
  onRoadmapClick: () => void;
}

export function DemoPage({
  onSignUp,
  onSignIn,
  theme,
  onThemeToggle,
  onChangelogClick,
  onRoadmapClick,
}: DemoPageProps) {
  // Demo state management
  const {
    notes,
    tags,
    metadata,
    loading,
    createNote,
    updateNote,
    deleteNote,
    createTag,
    updateTag,
    deleteTag,
    addTagToNote,
    removeTagFromNote,
    dismissPrompt,
    dismissRibbon,
    userNoteCount,
  } = useDemoState();

  // Soft prompt logic
  const {
    shouldShowPrompt,
    shouldShowRibbon,
    noteCount,
  } = useSoftPrompt({
    metadata,
    userNoteCount,
    onDismissPrompt: dismissPrompt,
    onDismissRibbon: dismissRibbon,
  });

  // First-run: show welcome intro until user creates their first note
  const isFirstRun = notes.length > 0 && notes.every((n) => n.id.startsWith('starter-'));


  // View state
  const [view, setView] = useState<'library' | 'editor'>('library');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  // Search state (focused-gaze model: highlights matches instead of filtering)
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [searchFocusToken, setSearchFocusToken] = useState(0);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tag filter state
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // Tag modal state
  const [showTagModal, setShowTagModal] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);

  // Shortcuts modal state
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // Get selected note
  const selectedNote = useMemo(() => {
    if (!selectedNoteId) return null;
    return notes.find((n) => n.id === selectedNoteId) ?? null;
  }, [notes, selectedNoteId]);

  // Determine which notes to display (tag-filtered only; search uses highlight, not filtering)
  const displayNotes = useMemo(() => {
    if (selectedTagIds.length === 0) return notes;

    return notes.filter((note) => {
      const noteTagIds = note.tags.map((t) => t.id);
      return selectedTagIds.every((tagId) => noteTagIds.includes(tagId));
    });
  }, [notes, selectedTagIds]);

  // Debounced search handler (focused-gaze: highlights, doesn't filter)
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!query.trim()) {
      setDebouncedSearchQuery('');
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(query);
    }, 300);
  }, []);

  // Clean up search timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Compute matchedNoteIds from debounced query (stable reference via useMemo)
  const matchedNoteIds = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return undefined;
    const q = debouncedSearchQuery.toLowerCase();
    const matched = new Set<string>();
    for (const note of displayNotes) {
      const titleMatch = note.title.toLowerCase().includes(q);
      const contentMatch = htmlToPlainText(note.content).toLowerCase().includes(q);
      if (titleMatch || contentMatch) {
        matched.add(note.id);
      }
    }
    return matched;
  }, [debouncedSearchQuery, displayNotes]);

  // Handlers - defined before effects that use them
  const handleNewNote = useCallback(() => {
    const newNote = createNote({
      title: '',
      content: '',
      pinned: false,
      tagIds: [],
    });
    setSelectedNoteId(newNote.id);
    setView('editor');
  }, [createNote]);

  // Keyboard shortcut: Cmd/Ctrl + N to create new note
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (view !== 'library') return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        handleNewNote();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, handleNewNote]);

  const handleNoteClick = (id: string) => {
    setSelectedNoteId(id);
    setView('editor');
  };

  const handleBack = () => {
    setView('library');
    setSelectedNoteId(null);
  };

  const handleRequestSearch = useCallback(() => {
    setView('library');
    setSelectedNoteId(null);
    setSearchFocusToken((prev) => prev + 1);
  }, []);

  const handleNoteUpdate = useCallback(
    async (updatedNote: Note): Promise<void> => {
      updateNote(updatedNote.id, {
        title: updatedNote.title,
        content: updatedNote.content,
        pinned: updatedNote.pinned,
      });
    },
    [updateNote]
  );

  const handleNoteDelete = useCallback(
    (id: string) => {
      deleteNote(id);
      if (selectedNoteId === id) {
        setView('library');
        setSelectedNoteId(null);
      }
    },
    [deleteNote, selectedNoteId]
  );

  const handleTogglePin = useCallback(
    (id: string, pinned: boolean) => {
      updateNote(id, { pinned });
    },
    [updateNote]
  );

  const handleNoteTagToggle = useCallback(
    (noteId: string, tagId: string) => {
      const note = notes.find((n) => n.id === noteId);
      if (!note) return;

      const hasTag = note.tags.some((t) => t.id === tagId);
      if (hasTag) {
        removeTagFromNote(noteId, tagId);
      } else {
        addTagToNote(noteId, tagId);
      }
    },
    [notes, addTagToNote, removeTagFromNote]
  );

  // Tag filter handlers
  const handleTagToggle = (tagId: string) => {
    // Tag toggle preserves search query — matchedNoteIds recomputes via useMemo
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleClearTagFilter = () => {
    setSelectedTagIds([]);
  };

  const handleAddTag = () => {
    setShowTagModal(true);
  };

  const handleEditTag = (tag: Tag) => {
    setEditingTag(tag);
    setShowTagModal(true);
  };

  const handleSaveTag = useCallback(
    async (name: string, color: TagColor) => {
      if (editingTag) {
        updateTag(editingTag.id, { name, color });
      } else {
        createTag({ name, color });
      }
      setEditingTag(null);
      setShowTagModal(false);
    },
    [editingTag, createTag, updateTag]
  );

  const handleDeleteTag = useCallback(async () => {
    if (editingTag) {
      deleteTag(editingTag.id);
      setSelectedTagIds((prev) => prev.filter((id) => id !== editingTag.id));
    }
    setEditingTag(null);
    setShowTagModal(false);
  }, [editingTag, deleteTag]);

  const handleCloseTagModal = () => {
    setShowTagModal(false);
    setEditingTag(null);
  };

  // Loading state
  if (loading) {
    return <LoadingFallback message="Preparing your space..." />;
  }

  // Shared modals (rendered once, regardless of view)
  const sharedModals = (
    <>
      {/* Tag Modal */}
      {showTagModal && (
        <Suspense fallback={null}>
          <TagModal
            isOpen={showTagModal}
            onClose={handleCloseTagModal}
            onSave={handleSaveTag}
            onDelete={handleDeleteTag}
            editingTag={editingTag}
            existingTags={tags}
          />
        </Suspense>
      )}

      {/* Invitation Modal */}
      {shouldShowPrompt && (
        <InvitationModal
          noteCount={noteCount}
          onSignUp={onSignUp}
          onDismiss={dismissPrompt}
        />
      )}

      {/* Keyboard Shortcuts Modal */}
      {showShortcutsModal && (
        <Suspense fallback={null}>
          <KeyboardShortcutsModal
            isOpen={showShortcutsModal}
            onClose={() => setShowShortcutsModal(false)}
          />
        </Suspense>
      )}
    </>
  );

  // Editor view
  if (view === 'editor' && selectedNote) {
    return (
      <>
        <Suspense fallback={<LoadingFallback message="Loading editor..." />}>
          <Editor
            note={selectedNote}
            tags={tags}
            userId={DEMO_USER_ID}
            onBack={handleBack}
            onRequestSearch={handleRequestSearch}
            onUpdate={handleNoteUpdate}
            onDelete={handleNoteDelete}
            onToggleTag={handleNoteTagToggle}
            onCreateTag={handleAddTag}
            theme={theme}
            onThemeToggle={onThemeToggle}
            onSettingsClick={onSignUp} // Settings opens signup in demo
            isDemo // Hide share functionality
          />
        </Suspense>
        {sharedModals}
      </>
    );
  }

  // Library view
  return (
    <>
      <div
        className="min-h-screen flex flex-col"
        style={{ background: 'var(--color-bg-primary)' }}
      >
        {/* Impermanence Ribbon */}
        {shouldShowRibbon && (
          <ImpermanenceRibbon onSignUp={onSignUp} onDismiss={dismissRibbon} />
        )}

        {/* Header */}
        <DemoHeader
          theme={theme}
          onThemeToggle={onThemeToggle}
          onNewNote={handleNewNote}
          searchFocusToken={searchFocusToken}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onSignIn={onSignIn}
          matchedCount={matchedNoteIds?.size}
          totalCount={displayNotes.length}
        />

        <div
          className="w-full flex-1 flex flex-col relative"
          style={{ maxWidth: '1400px', margin: '0 auto' }}
        >
        {/* Ambient warmth — subtle radial glow unique to practice space */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 60% 40% at 50% 20%, var(--color-accent-glow), transparent 70%)',
            opacity: 0.4,
          }}
        />

        {/* Tag Filter Bar */}
        <TagFilterBar
          tags={tags}
          selectedTagIds={selectedTagIds}
          onTagToggle={handleTagToggle}
          onClearFilter={handleClearTagFilter}
          onAddTag={handleAddTag}
          onEditTag={handleEditTag}
        />

        {/* First-run welcome — disappears once user creates a note */}
        {isFirstRun && (
          <div
            className="text-center px-6 pt-4 pb-2"
            style={{
              animation: 'fade-in 0.6s ease-out backwards',
              animationDelay: '0.15s',
            }}
          >
            <p
              className="text-lg sm:text-xl"
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--color-text-primary)',
                fontWeight: 500,
                letterSpacing: '-0.01em',
              }}
            >
              Write freely — no account needed
            </p>
            <p
              className="text-sm mt-1.5"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-primary)',
                opacity: 0.6,
              }}
            >
              These starter notes are yours to edit, delete, or ignore
            </p>
          </div>
        )}

        <div>
          <ChapteredLibrary
            notes={displayNotes}
            onNoteClick={handleNoteClick}
            onNoteDelete={handleNoteDelete}
            onTogglePin={handleTogglePin}
            onNewNote={handleNewNote}
            searchQuery={searchQuery}
            matchedNoteIds={matchedNoteIds}
          />
        </div>
        </div>

        {/* Footer */}
        <Footer
          onChangelogClick={onChangelogClick}
          onRoadmapClick={onRoadmapClick}
          onShortcutsClick={() => setShowShortcutsModal(true)}
        />
      </div>
      {sharedModals}
    </>
  );
}

// ============================================================================
// Demo Header Component
// ============================================================================

const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const searchShortcutHint = isMac ? '\u2318K' : 'Ctrl+K';

interface DemoHeaderProps {
  theme: Theme;
  onThemeToggle: () => void;
  onNewNote: () => void;
  searchFocusToken: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSignIn: () => void;
  matchedCount?: number;
  totalCount?: number;
}

function DemoHeader({
  theme,
  onThemeToggle,
  onNewNote,
  searchFocusToken,
  searchQuery,
  onSearchChange,
  onSignIn,
  matchedCount,
  totalCount,
}: DemoHeaderProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isSearchKey = e.code === 'KeyK' || e.key.toLowerCase() === 'k';
      if (!(e.metaKey || e.ctrlKey) || e.altKey || !isSearchKey) {
        return;
      }

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      e.preventDefault();
      scheduleSearchFocus(DEMO_SEARCH_INPUT_ID);
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  useEffect(() => {
    if (searchFocusToken === 0 || searchFocusToken === lastHandledDemoSearchFocusToken) {
      return;
    }

    lastHandledDemoSearchFocusToken = searchFocusToken;

    const frame = window.requestAnimationFrame(() => {
      searchRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [searchFocusToken]);

  return (
    <HeaderShell
      theme={theme}
      onThemeToggle={onThemeToggle}
      onSignIn={onSignIn}
      onLogoClick={() => { window.location.href = '/'; }}
      leftContent={
        <div
          className="flex items-center gap-2 sm:gap-3"
          style={{ userSelect: 'none' }}
        >
          <Logo onClick={() => { window.location.href = '/'; }} />
          <span
            className="hidden sm:inline text-base italic"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--color-accent)',
              letterSpacing: '0.02em',
              opacity: 0.75,
            }}
          >
            Practice Space
          </span>
        </div>
      }
      center={
        <div className="flex items-center w-full sm:justify-center">
          <div
            className="flex-1 sm:max-w-[420px] relative transition-all duration-300"
            style={{
              transform: isSearchFocused ? 'scale(1.02)' : 'scale(1)',
            }}
          >
            <div
              className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 rounded-full transition-all duration-300"
              style={{
                background: 'var(--color-bg-secondary)',
                border: isSearchFocused
                  ? '1px solid var(--color-accent)'
                  : '1px solid var(--glass-border)',
                boxShadow: isSearchFocused
                  ? '0 4px 20px var(--color-accent-glow)'
                  : 'none',
              }}
            >
              <svg
                className="w-4 h-4 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ color: isSearchFocused ? 'var(--color-accent)' : 'var(--color-text-tertiary)' }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                id={DEMO_SEARCH_INPUT_ID}
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    onSearchChange('');
                    e.currentTarget.blur();
                  }
                }}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                placeholder="Search..."
                aria-label="Search notes"
                className="flex-1 bg-transparent border-none outline-none text-sm min-w-0"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-primary)',
                }}
              />
              {searchQuery ? (
                <button
                  onClick={() => onSearchChange('')}
                  className="w-5 h-5 rounded-full flex items-center justify-center transition-colors duration-200 shrink-0"
                  style={{
                    background: 'var(--color-bg-tertiary)',
                    color: 'var(--color-text-secondary)',
                  }}
                  aria-label="Clear search"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ) : (
                <span
                  className="hidden sm:inline text-xs px-1.5 py-0.5 rounded shrink-0"
                  style={{
                    background: 'var(--color-bg-tertiary)',
                    color: 'var(--color-text-tertiary)',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  {searchShortcutHint}
                </span>
              )}
            </div>

            {/* Search result count */}
            {searchQuery && matchedCount !== undefined && totalCount !== undefined && (
              <p
                className="text-center mt-1"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-tertiary)',
                  fontSize: '0.7rem',
                }}
                aria-live="polite"
              >
                {matchedCount} of {totalCount} thoughts
              </p>
            )}
          </div>
        </div>
      }
      rightActions={
        <button
          onClick={onNewNote}
          className="
            p-2 sm:px-4 sm:py-2
            rounded-full
            flex items-center gap-2
            transition-all duration-300
            focus:outline-none
            focus:ring-2
            focus:ring-[var(--color-accent)]
            focus:ring-offset-2
            hover:-translate-y-0.5
            shrink-0
            touch-press
          "
          style={{
            background: 'var(--color-cta-bg)',
            color: 'var(--color-cta-text)',
            boxShadow: '0 4px 20px var(--color-accent-glow)',
            fontFamily: 'var(--font-body)',
          }}
          aria-label="New note"
        >
          <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden sm:inline text-sm font-medium">New Note</span>
        </button>
      }
    />
  );
}
