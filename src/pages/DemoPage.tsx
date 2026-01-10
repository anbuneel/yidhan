/**
 * DemoPage
 *
 * Full-featured demo experience for Zenote.
 * Users can create notes, use tags, and experience the full editor
 * without signing up. Notes persist in localStorage.
 *
 * Shows soft signup prompts after engagement thresholds
 * (3+ notes AND 5+ minutes).
 */

import { useState, useCallback, useEffect, useMemo, Suspense } from 'react';
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
import { lazyWithRetry } from '../utils/lazyWithRetry';

// Lazy load heavy components
const Editor = lazyWithRetry(() =>
  import('../components/Editor').then((module) => ({ default: module.Editor }))
);
const TagModal = lazyWithRetry(() =>
  import('../components/TagModal').then((module) => ({ default: module.TagModal }))
);

// Demo-specific user ID (used internally, not a real user)
const DEMO_USER_ID = 'demo-user';

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

  // View state
  const [view, setView] = useState<'library' | 'editor'>('library');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Tag filter state
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // Tag modal state
  const [showTagModal, setShowTagModal] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);

  // Get selected note
  const selectedNote = useMemo(() => {
    if (!selectedNoteId) return null;
    return notes.find((n) => n.id === selectedNoteId) ?? null;
  }, [notes, selectedNoteId]);

  // Filter notes by search and tags
  const filteredNotes = useMemo(() => {
    let result = notes;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (note) =>
          note.title.toLowerCase().includes(query) ||
          note.content.toLowerCase().includes(query)
      );
    }

    // Apply tag filter
    if (selectedTagIds.length > 0) {
      result = result.filter((note) => {
        const noteTagIds = note.tags.map((t) => t.id);
        return selectedTagIds.every((tagId) => noteTagIds.includes(tagId));
      });
    }

    return result;
  }, [notes, searchQuery, selectedTagIds]);

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

  const handleNoteClick = useCallback((id: string) => {
    setSelectedNoteId(id);
    setView('editor');
  }, []);

  const handleBack = useCallback(() => {
    setView('library');
    setSelectedNoteId(null);
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
  const handleTagToggle = useCallback((tagId: string) => {
    setSearchQuery('');
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }, []);

  const handleClearTagFilter = useCallback(() => {
    setSelectedTagIds([]);
  }, []);

  const handleAddTag = useCallback(() => {
    setShowTagModal(true);
  }, []);

  const handleEditTag = useCallback((tag: Tag) => {
    setEditingTag(tag);
    setShowTagModal(true);
  }, []);

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

  const handleCloseTagModal = useCallback(() => {
    setShowTagModal(false);
    setEditingTag(null);
  }, []);

  // Loading state
  if (loading) {
    return <LoadingFallback message="Preparing your practice space..." />;
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
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSignIn={onSignIn}
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

        {/* Note Library */}
        <ChapteredLibrary
          notes={filteredNotes}
          onNoteClick={handleNoteClick}
          onNoteDelete={handleNoteDelete}
          onTogglePin={handleTogglePin}
          onNewNote={handleNewNote}
          searchQuery={searchQuery}
        />

        {/* Footer */}
        <Footer onChangelogClick={onChangelogClick} onRoadmapClick={onRoadmapClick} />
      </div>
      {sharedModals}
    </>
  );
}

// ============================================================================
// Demo Header Component
// ============================================================================

interface DemoHeaderProps {
  theme: Theme;
  onThemeToggle: () => void;
  onNewNote: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSignIn: () => void;
}

function DemoHeader({
  theme,
  onThemeToggle,
  onNewNote,
  searchQuery,
  onSearchChange,
  onSignIn,
}: DemoHeaderProps) {
  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('demo-search-input');
        searchInput?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <HeaderShell
      theme={theme}
      onThemeToggle={onThemeToggle}
      onSignIn={onSignIn}
      leftContent={
        <a
          href="/"
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          style={{ textDecoration: 'none' }}
        >
          <span
            className="text-xl sm:text-2xl"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.02em',
            }}
          >
            Zenote
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--color-accent)',
              background: 'var(--color-accent-glow)',
              border: '1px solid var(--color-accent)',
              opacity: 0.9,
            }}
          >
            Practice
          </span>
        </a>
      }
      center={
        <div className="relative w-full max-w-sm">
          <input
            id="demo-search-input"
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-4 py-2 text-sm rounded-lg transition-all duration-200"
            style={{
              fontFamily: 'var(--font-body)',
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--glass-border)',
              color: 'var(--color-text-primary)',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-accent)';
              e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-accent-glow)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--glass-border)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
          <div
            className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 text-xs"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <kbd
              className="px-1.5 py-0.5 rounded"
              style={{
                background: 'var(--color-bg-tertiary)',
                border: '1px solid var(--glass-border)',
              }}
            >
              {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}
            </kbd>
            <kbd
              className="px-1.5 py-0.5 rounded"
              style={{
                background: 'var(--color-bg-tertiary)',
                border: '1px solid var(--glass-border)',
              }}
            >
              K
            </kbd>
          </div>
        </div>
      }
      rightActions={
        <button
          onClick={onNewNote}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg font-medium transition-all duration-200"
          style={{
            fontFamily: 'var(--font-body)',
            background: 'var(--color-accent)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-accent-hover)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--color-accent)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden sm:inline">New Note</span>
        </button>
      }
    />
  );
}
