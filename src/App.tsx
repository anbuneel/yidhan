import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import toast from 'react-hot-toast';
import type { Note, Tag, ViewMode, Theme } from './types';
import { Header } from './components/Header';
import { Library } from './components/Library';
import { Auth } from './components/Auth';
import { LandingPage } from './components/LandingPage';

// Lazy load the Editor component (includes heavy Tiptap dependencies)
const Editor = lazy(() => import('./components/Editor').then(module => ({ default: module.Editor })));
import { TagFilterBar } from './components/TagFilterBar';
import { TagModal } from './components/TagModal';
import { SettingsModal } from './components/SettingsModal';
import { ChangelogPage } from './components/ChangelogPage';
import { RoadmapPage } from './components/RoadmapPage';
import { Footer } from './components/Footer';
import { useAuth } from './contexts/AuthContext';
import { fetchNotes, createNote, updateNote, deleteNote, subscribeToNotes, searchNotes, toggleNotePin } from './services/notes';
import { fetchTags, subscribeToTags, addTagToNote, removeTagFromNote, createTag, updateTag, deleteTag } from './services/tags';
import {
  exportNotesToJSON,
  downloadFile,
  parseImportedJSON,
  readFileAsText,
  downloadMarkdownZip,
  markdownToHtml,
  ValidationError,
  MAX_IMPORT_FILE_SIZE,
} from './utils/exportImport';
import { sanitizeHtml } from './utils/sanitize';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import './App.css';

function App() {
  const { user, loading: authLoading, isPasswordRecovery, clearPasswordRecovery } = useAuth();

  // Network connectivity monitoring
  useNetworkStatus();

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('library');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('zenote-theme');
    // Validate that saved theme is a valid Theme value
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    return 'dark';
  });

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Note[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Import state
  const [isImporting, setIsImporting] = useState(false);

  // Tags state
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);

  // Settings modal state
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Auth modal state (for landing page)
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('signup');

  // Debounce timer refs
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('zenote-theme', theme);
  }, [theme]);

  // Fetch notes when user is authenticated
  useEffect(() => {
    if (!user) {
      setNotes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchNotes()
      .then(setNotes)
      .catch(console.error)
      .finally(() => setLoading(false));

    // Subscribe to real-time changes
    const unsubscribe = subscribeToNotes(
      user.id,
      (newNote) => {
        setNotes((prev) => {
          // Avoid duplicates
          if (prev.some((n) => n.id === newNote.id)) return prev;
          // New notes from real-time don't have tags; they'll be fetched on next full load
          return [newNote, ...prev];
        });
      },
      (updatedNote) => {
        setNotes((prev) =>
          prev.map((n) => {
            if (n.id === updatedNote.id) {
              // Preserve existing tags since real-time events don't include them
              return { ...updatedNote, tags: n.tags };
            }
            return n;
          })
        );
      },
      (deletedId) => {
        setNotes((prev) => prev.filter((n) => n.id !== deletedId));
        if (selectedNoteId === deletedId) {
          setView('library');
          setSelectedNoteId(null);
        }
      }
    );

    return () => unsubscribe();
  }, [user, selectedNoteId]);

  // Fetch tags when user is authenticated
  useEffect(() => {
    if (!user) {
      setTags([]);
      setSelectedTagIds([]);
      return;
    }

    fetchTags()
      .then(setTags)
      .catch(console.error);

    // Subscribe to real-time tag changes
    const unsubscribeTags = subscribeToTags(
      user.id,
      (newTag) => {
        setTags((prev) => {
          if (prev.some((t) => t.id === newTag.id)) return prev;
          return [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name));
        });
      },
      (updatedTag) => {
        setTags((prev) =>
          prev.map((t) => (t.id === updatedTag.id ? updatedTag : t))
        );
      },
      (deletedId) => {
        setTags((prev) => prev.filter((t) => t.id !== deletedId));
        setSelectedTagIds((prev) => prev.filter((id) => id !== deletedId));
      }
    );

    return () => unsubscribeTags();
  }, [user]);

  // Sort notes: pinned first, then by most recent
  const sortedNotes = [...notes].sort((a, b) => {
    // Pinned notes come first
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    // Within same pin status, sort by updated time
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  const selectedNote = notes.find((n) => n.id === selectedNoteId);

  const handleNoteClick = (id: string) => {
    setSelectedNoteId(id);
    setView('editor');
  };

  const handleBack = () => {
    setView('library');
    setSelectedNoteId(null);
  };

  const handleNewNote = useCallback(async () => {
    if (!user) return;
    try {
      const newNote = await createNote(user.id);
      setNotes((prev) => [newNote, ...prev]);
      setSelectedNoteId(newNote.id);
      setView('editor');
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  }, [user]);

  // Keyboard shortcut: Cmd/Ctrl + N to create new note
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger in library view when user is logged in
      if (!user || view !== 'library') return;

      // Check for Cmd+N (Mac) or Ctrl+N (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        handleNewNote();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [user, view, handleNewNote]);

  // Debounced note update
  const handleNoteUpdate = useCallback((updatedNote: Note) => {
    // Update local state immediately for responsiveness
    setNotes((prev) =>
      prev.map((n) => (n.id === updatedNote.id ? updatedNote : n))
    );

    // Debounce the server update
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    updateTimeoutRef.current = setTimeout(() => {
      updateNote(updatedNote).catch(console.error);
    }, 500);
  }, []);

  const handleNoteDelete = async (id: string) => {
    try {
      await deleteNote(id);
      setNotes(notes.filter((n) => n.id !== id));
      setView('library');
      setSelectedNoteId(null);
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  const handleTogglePin = async (id: string, pinned: boolean) => {
    try {
      // Update local state immediately for responsiveness
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, pinned } : n))
      );
      // Persist to database
      await toggleNotePin(id, pinned);
    } catch (error) {
      console.error('Failed to toggle pin:', error);
      // Revert on error
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, pinned: !pinned } : n))
      );
    }
  };

  const handleThemeToggle = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  // Tag filter handlers
  const handleTagToggle = (tagId: string) => {
    // Clear search when using tag filters
    setSearchQuery('');
    setSearchResults(null);
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
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

  const handleSaveTag = async (name: string, color: import('./types').TagColor) => {
    if (!user) return;

    if (editingTag) {
      // Update existing tag
      const updated = await updateTag(editingTag.id, { name, color });
      setTags((prev) =>
        prev.map((t) => (t.id === updated.id ? updated : t)).sort((a, b) => a.name.localeCompare(b.name))
      );
      // Update tags in notes that have this tag
      setNotes((prev) =>
        prev.map((note) => ({
          ...note,
          tags: note.tags.map((t) => (t.id === updated.id ? updated : t)),
        }))
      );
    } else {
      // Create new tag
      const newTag = await createTag(user.id, name, color);
      setTags((prev) => [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name)));
    }
    setEditingTag(null);
  };

  const handleDeleteTag = async () => {
    if (!editingTag) return;
    await deleteTag(editingTag.id);
    setTags((prev) => prev.filter((t) => t.id !== editingTag.id));
    setSelectedTagIds((prev) => prev.filter((id) => id !== editingTag.id));
    // Remove tag from all notes locally
    setNotes((prev) =>
      prev.map((note) => ({
        ...note,
        tags: note.tags.filter((t) => t.id !== editingTag.id),
      }))
    );
    setEditingTag(null);
  };

  const handleCloseTagModal = () => {
    setShowTagModal(false);
    setEditingTag(null);
  };

  // Toggle tag on a note (add or remove)
  const handleNoteTagToggle = async (noteId: string, tagId: string) => {
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;

    const hasTag = note.tags.some((t) => t.id === tagId);
    const tag = tags.find((t) => t.id === tagId);

    try {
      if (hasTag) {
        await removeTagFromNote(noteId, tagId);
        // Update local state
        setNotes((prev) =>
          prev.map((n) =>
            n.id === noteId
              ? { ...n, tags: n.tags.filter((t) => t.id !== tagId) }
              : n
          )
        );
      } else if (tag) {
        await addTagToNote(noteId, tagId);
        // Update local state
        setNotes((prev) =>
          prev.map((n) =>
            n.id === noteId
              ? { ...n, tags: [...n.tags, tag] }
              : n
          )
        );
      }
    } catch (error) {
      console.error('Failed to toggle tag:', error);
    }
  };

  // Debounced search handler
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // If query is empty, clear results immediately
    if (!query.trim()) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    // Debounce the search
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchNotes(query);
        setSearchResults(results);
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  // Export to JSON
  const handleExportJSON = useCallback(() => {
    const json = exportNotesToJSON(notes, tags);
    const date = new Date().toISOString().split('T')[0];
    downloadFile(json, `zenote-backup-${date}.json`, 'application/json');
  }, [notes, tags]);

  // Export to Markdown
  const handleExportMarkdown = useCallback(() => {
    downloadMarkdownZip(notes);
  }, [notes]);

  // Import file (JSON or Markdown)
  const handleImportFile = useCallback(async (file: File) => {
    if (!user) return;

    // Validate file size before reading
    if (file.size > MAX_IMPORT_FILE_SIZE) {
      const maxSizeMB = Math.round(MAX_IMPORT_FILE_SIZE / (1024 * 1024));
      toast.error(`File too large. Maximum size is ${maxSizeMB}MB.`);
      return;
    }

    setIsImporting(true);
    try {
      const content = await readFileAsText(file);
      const isJSON = file.name.endsWith('.json');
      const isMarkdown = file.name.endsWith('.md') || file.name.endsWith('.markdown');

      if (isJSON) {
        // Import JSON backup with validation
        const data = parseImportedJSON(content);

        // Create tags first (if they don't exist)
        const tagMap = new Map<string, string>(); // name -> id
        for (const tagData of data.tags) {
          const existingTag = tags.find(t => t.name.toLowerCase() === tagData.name.toLowerCase());
          if (existingTag) {
            tagMap.set(tagData.name, existingTag.id);
          } else {
            const newTag = await createTag(user.id, tagData.name, tagData.color as import('./types').TagColor);
            tagMap.set(tagData.name, newTag.id);
            setTags(prev => [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name)));
          }
        }

        // Create notes
        let importedCount = 0;
        for (const noteData of data.notes) {
          // Sanitize content to prevent XSS from malicious backups
          const sanitizedContent = sanitizeHtml(noteData.content);

          // Preserve original timestamps if available
          const options: { createdAt?: Date; updatedAt?: Date } = {};
          if (noteData.createdAt) {
            options.createdAt = new Date(noteData.createdAt);
          }
          if (noteData.updatedAt) {
            options.updatedAt = new Date(noteData.updatedAt);
          }

          const newNote = await createNote(user.id, noteData.title, sanitizedContent, options);

          // Add tags to the note
          for (const tagName of noteData.tags) {
            const tagId = tagMap.get(tagName);
            if (tagId) {
              await addTagToNote(newNote.id, tagId);
            }
          }

          importedCount++;
        }

        toast.success(`Successfully imported ${importedCount} note${importedCount === 1 ? '' : 's'}`);

        // Refresh notes
        const refreshedNotes = await fetchNotes();
        setNotes(refreshedNotes);

      } else if (isMarkdown) {
        // Import single markdown file as a note
        const lines = content.split('\n');
        let title = file.name.replace(/\.(md|markdown)$/, '');
        let noteContent = content;

        // Extract title from first H1 if present
        if (lines[0]?.startsWith('# ')) {
          title = lines[0].substring(2).trim();
          noteContent = lines.slice(1).join('\n').trim();
        }

        // Convert markdown to HTML and sanitize
        const htmlContent = sanitizeHtml(markdownToHtml(noteContent));

        // Create the note
        const newNote = await createNote(user.id, title, htmlContent);
        setNotes(prev => [newNote, ...prev]);

        toast.success(`Imported "${title}"`);
      } else {
        toast.error('Unsupported file format. Please use .json or .md files.');
      }
    } catch (error) {
      console.error('Import failed:', error);
      if (error instanceof ValidationError) {
        toast.error(`Import failed: ${error.message}`);
      } else {
        toast.error('Failed to import file. Please check the file format.');
      }
    } finally {
      setIsImporting(false);
    }
  }, [user, tags]);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--color-bg-primary)' }}
      >
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p>
      </div>
    );
  }

  // Show password reset screen if in recovery mode (even if user is authenticated)
  if (isPasswordRecovery) {
    return (
      <Auth
        theme={theme}
        onThemeToggle={handleThemeToggle}
        initialMode="reset"
        onPasswordResetComplete={clearPasswordRecovery}
      />
    );
  }

  // Public pages (accessible without login)
  if (view === 'changelog') {
    return (
      <>
        <ChangelogPage
          theme={theme}
          onThemeToggle={handleThemeToggle}
          onSignIn={() => {
            setAuthModalMode('login');
            setShowAuthModal(true);
          }}
          onLogoClick={() => setView('library')}
          onRoadmapClick={() => setView('roadmap')}
          isAuthenticated={!!user}
        />
        {showAuthModal && (
          <Auth
            theme={theme}
            onThemeToggle={handleThemeToggle}
            initialMode={authModalMode}
            isModal
            onClose={() => setShowAuthModal(false)}
          />
        )}
      </>
    );
  }

  if (view === 'roadmap') {
    return (
      <>
        <RoadmapPage
          theme={theme}
          onThemeToggle={handleThemeToggle}
          onSignIn={() => {
            setAuthModalMode('login');
            setShowAuthModal(true);
          }}
          onLogoClick={() => setView('library')}
          onChangelogClick={() => setView('changelog')}
          isAuthenticated={!!user}
        />
        {showAuthModal && (
          <Auth
            theme={theme}
            onThemeToggle={handleThemeToggle}
            initialMode={authModalMode}
            isModal
            onClose={() => setShowAuthModal(false)}
          />
        )}
      </>
    );
  }

  // Show landing page with auth modal if not logged in
  if (!user) {
    return (
      <>
        <LandingPage
          onStartWriting={() => {
            setAuthModalMode('signup');
            setShowAuthModal(true);
          }}
          onSignIn={() => {
            setAuthModalMode('login');
            setShowAuthModal(true);
          }}
          theme={theme}
          onThemeToggle={handleThemeToggle}
          onChangelogClick={() => setView('changelog')}
          onRoadmapClick={() => setView('roadmap')}
        />
        {showAuthModal && (
          <Auth
            theme={theme}
            onThemeToggle={handleThemeToggle}
            initialMode={authModalMode}
            isModal
            onClose={() => setShowAuthModal(false)}
          />
        )}
      </>
    );
  }

  // Show loading while fetching notes
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--color-bg-primary)' }}
      >
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading notes...</p>
      </div>
    );
  }

  // Apply tag filtering to notes
  const applyTagFilter = (notesToFilter: Note[]) => {
    if (selectedTagIds.length === 0) return notesToFilter;
    return notesToFilter.filter((note) => {
      const noteTagIds = note.tags.map((t) => t.id);
      return selectedTagIds.every((tagId) => noteTagIds.includes(tagId));
    });
  };

  // Determine which notes to display (search results also respect tag filters)
  const filteredNotes = applyTagFilter(sortedNotes);
  const displayNotes = searchResults !== null
    ? applyTagFilter(searchResults)
    : filteredNotes;

  // Library View
  if (view === 'library') {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg-primary)' }}>
        <Header
          theme={theme}
          onThemeToggle={handleThemeToggle}
          onNewNote={handleNewNote}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onExportJSON={handleExportJSON}
          onExportMarkdown={handleExportMarkdown}
          onImportFile={handleImportFile}
          onSettingsClick={() => setShowSettingsModal(true)}
        />
        <TagFilterBar
          tags={tags}
          selectedTagIds={selectedTagIds}
          onTagToggle={handleTagToggle}
          onClearFilter={handleClearTagFilter}
          onAddTag={handleAddTag}
          onEditTag={handleEditTag}
        />
        {isSearching ? (
          <div className="flex-1 flex items-center justify-center">
            <p style={{ color: 'var(--color-text-secondary)' }}>Searching...</p>
          </div>
        ) : (
          <Library
            notes={displayNotes}
            onNoteClick={handleNoteClick}
            onNoteDelete={handleNoteDelete}
            onTogglePin={handleTogglePin}
            searchQuery={searchQuery}
          />
        )}

        {/* Tag Modal */}
        <TagModal
          isOpen={showTagModal}
          onClose={handleCloseTagModal}
          onSave={handleSaveTag}
          onDelete={handleDeleteTag}
          editingTag={editingTag}
          existingTags={tags}
        />

        {/* Settings Modal */}
        <SettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          theme={theme}
          onThemeToggle={handleThemeToggle}
        />

        {/* Footer */}
        <Footer
          onChangelogClick={() => setView('changelog')}
          onRoadmapClick={() => setView('roadmap')}
        />

        {/* Import Loading Overlay */}
        {isImporting && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)' }}
          >
            <div
              className="px-8 py-6 rounded-lg text-center"
              style={{
                background: 'var(--color-bg-primary)',
                border: '1px solid var(--glass-border)',
              }}
            >
              <div
                className="w-8 h-8 mx-auto mb-4 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }}
              />
              <p style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)' }}>
                Importing...
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Editor View
  if (view === 'editor' && selectedNote) {
    return (
      <>
        <Suspense
          fallback={
            <div
              className="min-h-screen flex items-center justify-center"
              style={{ background: 'var(--color-bg-primary)' }}
            >
              <div className="text-center">
                <div
                  className="w-8 h-8 mx-auto mb-4 border-2 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }}
                />
                <p style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}>
                  Loading editor...
                </p>
              </div>
            </div>
          }
        >
          <Editor
            note={selectedNote}
            tags={tags}
            onBack={handleBack}
            onUpdate={handleNoteUpdate}
            onDelete={handleNoteDelete}
            onToggleTag={handleNoteTagToggle}
            onCreateTag={handleAddTag}
          />
        </Suspense>
        {/* Tag Modal */}
        <TagModal
          isOpen={showTagModal}
          onClose={handleCloseTagModal}
          onSave={handleSaveTag}
          onDelete={handleDeleteTag}
          editingTag={editingTag}
          existingTags={tags}
        />
      </>
    );
  }

  return null;
}

export default App;
