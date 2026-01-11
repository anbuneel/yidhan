import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import toast from 'react-hot-toast';
import type { Note, Tag, ViewMode, Theme } from './types';
import { Header } from './components/Header';
import { ChapteredLibrary } from './components/ChapteredLibrary';
import { Auth } from './components/Auth';
import { LandingPage } from './components/LandingPage';
import { sanitizeText } from './utils/sanitize';
import { lazyWithRetry } from './utils/lazyWithRetry';

// Lazy load heavy components with smart retry (auto-reloads on chunk errors when safe)
const Editor = lazyWithRetry(() => import('./components/Editor').then(module => ({ default: module.Editor })));
const ChangelogPage = lazyWithRetry(() => import('./components/ChangelogPage').then(module => ({ default: module.ChangelogPage })));
const RoadmapPage = lazyWithRetry(() => import('./components/RoadmapPage').then(module => ({ default: module.RoadmapPage })));
const FadedNotesView = lazyWithRetry(() => import('./components/FadedNotesView').then(module => ({ default: module.FadedNotesView })));
const SharedNoteView = lazyWithRetry(() => import('./components/SharedNoteView').then(module => ({ default: module.SharedNoteView })));
const DemoPage = lazyWithRetry(() => import('./pages/DemoPage').then(module => ({ default: module.DemoPage })));

import { TagFilterBar } from './components/TagFilterBar';
import { WelcomeBackPrompt } from './components/WelcomeBackPrompt';
import { Footer } from './components/Footer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingFallback } from './components/LoadingFallback';

// Lazy load modals with smart retry (only loaded when opened)
const TagModal = lazyWithRetry(() => import('./components/TagModal').then(module => ({ default: module.TagModal })));
const SettingsModal = lazyWithRetry(() => import('./components/SettingsModal').then(module => ({ default: module.SettingsModal })));
const LettingGoModal = lazyWithRetry(() => import('./components/LettingGoModal').then(module => ({ default: module.LettingGoModal })));
import { useAuth } from './contexts/AuthContext';
import {
  subscribeToNotes,
  cleanupExpiredFadedNotes,
  emptyFadedNotes,
} from './services/notes';
import { subscribeToTags } from './services/tags';
import {
  fetchNotesOffline,
  createNoteOffline,
  createNotesBatchOffline,
  updateNoteOffline,
  searchNotesOffline,
  toggleNotePinOffline,
  softDeleteNoteOffline,
  restoreNoteOffline,
  permanentDeleteNoteOffline,
  fetchFadedNotesOffline,
  countFadedNotesOffline,
  addTagToNoteOffline,
  removeTagFromNoteOffline,
  upsertNoteFromServer,
  deleteNoteFromServer,
  upsertTagFromServer,
  deleteTagFromServer,
} from './services/offlineNotes';
import {
  fetchTagsOffline,
  createTagOffline,
  updateTagOffline,
  deleteTagOffline,
} from './services/offlineTags';
import {
  exportNotesToJSON,
  downloadFile,
  parseImportedJSON,
  readFileAsText,
  downloadMarkdownZip,
  markdownToHtml,
  parseMultiNoteMarkdown,
  ValidationError,
  MAX_IMPORT_FILE_SIZE,
} from './utils/exportImport';
import { hasDemoState } from './services/demoStorage';
import { migrateDemoToAccount } from './services/demoMigration';
import { sanitizeHtml } from './utils/sanitize';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { useSyncEngine, resolveConflict } from './hooks/useSyncEngine';
import { useViewTransition } from './hooks/useViewTransition';
import { useInstallPrompt } from './hooks/useInstallPrompt';
import { useShareTarget, formatSharedContent } from './hooks/useShareTarget';
import { ConflictModal } from './components/ConflictModal';
import { InstallPrompt } from './components/InstallPrompt';
import { IOSInstallGuide } from './components/IOSInstallGuide';
import './App.css';

const DEMO_STORAGE_KEY = 'zenote-demo-content';

function App() {
  const { user, loading: authLoading, isPasswordRecovery, clearPasswordRecovery, isDeparting, daysUntilRelease, isHydrating } = useAuth();

  // Network connectivity monitoring
  useNetworkStatus();

  // Sync engine for offline support
  const { conflicts, removeConflict } = useSyncEngine();
  const [activeConflict, setActiveConflict] = useState<typeof conflicts[0] | null>(null);

  // View transitions for smooth navigation
  const { startTransition } = useViewTransition();

  // PWA install prompt management
  const {
    shouldShowPrompt,
    triggerInstall,
    dismissPrompt,
    trackNoteCreated,
    shouldShowIOSGuide,
    dismissIOSGuide,
  } = useInstallPrompt();

  // Share Target handling
  const { sharedData, clearSharedData, hasStoredShare } = useShareTarget();

  // Show first conflict when conflicts array changes
  useEffect(() => {
    if (conflicts.length > 0 && !activeConflict) {
      setActiveConflict(conflicts[0]);
    }
  }, [conflicts, activeConflict]);

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

  // Import state with progress tracking
  const [importProgress, setImportProgress] = useState<{
    isImporting: boolean;
    current: number;
    total: number;
    phase: 'parsing' | 'importing' | 'finalizing';
  } | null>(null);

  // Tags state
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);

  // Settings modal state
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Offboarding ("Letting Go") modal state
  const [showLettingGoModal, setShowLettingGoModal] = useState(false);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);

  // Auth modal state (for landing page)
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('signup');

  // Faded notes state
  const [fadedNotes, setFadedNotes] = useState<Note[]>([]);
  const [fadedNotesCount, setFadedNotesCount] = useState(0);
  const [fadedNotesLoading, setFadedNotesLoading] = useState(false);

  // Share token state (for viewing shared notes)
  const [shareToken, setShareToken] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('s');
  });

  // Demo page state (for /demo route)
  const [isDemo, setIsDemo] = useState<boolean>(() => {
    return window.location.pathname === '/demo';
  });

  // Debounce timer refs
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track if we've migrated demo content (prevent duplicate migrations)
  // Using a ref instead of state because:
  // 1. We don't need to trigger re-renders when this changes
  // 2. The value persists across renders without causing effect re-runs
  // 3. Prevents race conditions if multiple effects try to migrate simultaneously
  const hasMigratedDemoContent = useRef(false);
  const isCreatingNoteFromShare = useRef(false);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('zenote-theme', theme);
  }, [theme]);

  // Redirect from /demo to library when user logs in
  // Using useEffect to avoid state updates during render
  useEffect(() => {
    if (isDemo && user) {
      window.history.replaceState({}, '', '/');
      setIsDemo(false);
    }
  }, [isDemo, user]);

  // Show WelcomeBackPrompt when user signs in during grace period
  useEffect(() => {
    if (user && isDeparting) {
      setShowWelcomeBack(true);
    }
  }, [user, isDeparting]);

  // Show auth modal for unauthenticated users with shared content
  useEffect(() => {
    if (!user && hasStoredShare) {
      setAuthModalMode('signup');
      setShowAuthModal(true);
    }
  }, [user, hasStoredShare]);

  // Fetch notes when user is authenticated and hydration is complete
  // Use user?.id as dependency to avoid refetching when user object reference changes
  // (e.g., when Supabase refreshes the session on tab focus)
  // Wait for hydration to complete so first-time users see their notes from server
  const userId = user?.id;

  // Track if we've bypassed hydration due to timeout (state to trigger re-render)
  const [hydrationBypassed, setHydrationBypassed] = useState(false);

  // Reset bypass flag when user changes
  useEffect(() => {
    setHydrationBypassed(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setNotes([]);
      setLoading(false);
      return;
    }

    // Don't fetch until hydration is complete (first-time users need server data)
    // UNLESS we've already waited too long (failsafe for Android WebView hangs)
    if (isHydrating && !hydrationBypassed) {
      setLoading(true);

      // Failsafe: Maximum wait time for hydration (15 seconds)
      // This ensures the app never gets stuck on "Loading notes..." forever
      // even if all other timeout mechanisms fail (Android WebView edge cases)
      const failsafeTimeout = setTimeout(() => {
        console.warn('Hydration failsafe triggered - bypassing hydration wait');
        setHydrationBypassed(true); // This triggers a re-render and effect re-run
      }, 15000);

      return () => clearTimeout(failsafeTimeout);
    }

    setLoading(true);
    fetchNotesOffline(userId)
      .then(setNotes)
      .catch(console.error)
      .finally(() => setLoading(false));

    // Subscribe to real-time changes (also write to IndexedDB to keep IDB in sync)
    const unsubscribe = subscribeToNotes(
      userId,
      (newNote) => {
        // Write to IndexedDB first
        upsertNoteFromServer(userId, newNote).catch(console.error);

        setNotes((prev) => {
          // Avoid duplicates
          if (prev.some((n) => n.id === newNote.id)) return prev;
          // New notes from real-time don't have tags; they'll be fetched on next full load
          return [newNote, ...prev];
        });
      },
      (updatedNote) => {
        // Write to IndexedDB first
        upsertNoteFromServer(userId, updatedNote).catch(console.error);

        // Check if this is a soft-delete (note now has deletedAt set)
        if (updatedNote.deletedAt) {
          // Remove from active notes and update faded count
          setNotes((prev) => prev.filter((n) => n.id !== updatedNote.id));
          setFadedNotesCount((prev) => prev + 1);
          if (selectedNoteId === updatedNote.id) {
            setView('library');
            setSelectedNoteId(null);
          }
          return;
        }

        // Check if this is a restore (note no longer has deletedAt)
        // This handles notes restored from another tab
        setNotes((prev) => {
          const existingNote = prev.find((n) => n.id === updatedNote.id);
          if (existingNote) {
            // Note exists, update it preserving tags
            return prev.map((n) => {
              if (n.id === updatedNote.id) {
                return { ...updatedNote, tags: n.tags };
              }
              return n;
            });
          } else {
            // Note doesn't exist in active list (was restored from faded)
            // Add it back (tags will be empty, will refresh on next full load)
            setFadedNotesCount((prev) => Math.max(0, prev - 1));
            return [updatedNote, ...prev];
          }
        });
      },
      (deletedId) => {
        // Remove from IndexedDB
        deleteNoteFromServer(userId, deletedId).catch(console.error);

        setNotes((prev) => prev.filter((n) => n.id !== deletedId));
        if (selectedNoteId === deletedId) {
          setView('library');
          setSelectedNoteId(null);
        }
      }
    );

    return () => unsubscribe();
  }, [userId, selectedNoteId, isHydrating, hydrationBypassed]);

  // Migrate demo content from landing page to user's first note
  // Dependency: userId (string) instead of user (object) because:
  // 1. Using the full user object would cause unnecessary re-runs on any user property change
  // 2. We only care about identity (userId), not other user metadata
  // 3. String comparison is stable; object reference changes on every auth state update
  useEffect(() => {
    if (!userId || hasMigratedDemoContent.current) return;

    const demoContent = localStorage.getItem(DEMO_STORAGE_KEY);
    if (demoContent?.trim()) {
      hasMigratedDemoContent.current = true;

      // Create note with demo content (sanitize and wrap plain text in paragraph tags for Tiptap)
      const sanitized = sanitizeText(demoContent);
      const htmlContent = `<p>${sanitized.replace(/\n/g, '</p><p>')}</p>`;
      createNoteOffline(userId, 'My first note', htmlContent)
        .then((newNote) => {
          // Clear demo content from localStorage
          localStorage.removeItem(DEMO_STORAGE_KEY);
          // Show toast notification
          toast.success('Your demo note has been saved!');
          // Add to notes list
          setNotes((prev) => [newNote, ...prev]);
          // Open the note in editor
          setSelectedNoteId(newNote.id);
          setView('editor');
        })
        .catch((error: unknown) => {
          console.error('Failed to migrate demo content:', error);
          // Reset flag so user can try again
          hasMigratedDemoContent.current = false;
        });
    } else {
      hasMigratedDemoContent.current = true;
    }
  }, [userId]);

  // Migrate demo notes to authenticated user's account
  // IMPORTANT: Must wait for hydration to complete to avoid:
  // 1. needsHydration returning false (skipping server pull)
  // 2. Hydration clearing IndexedDB and losing demo notes
  const hasMigratedDemoNotes = useRef(false);
  useEffect(() => {
    // Gate on hydration complete to avoid race conditions
    if (isHydrating) return;
    if (!userId || hasMigratedDemoNotes.current) return;

    // Check if user has demo notes to migrate
    if (!hasDemoState()) {
      hasMigratedDemoNotes.current = true;
      return;
    }

    hasMigratedDemoNotes.current = true;

    // Migrate demo data asynchronously
    (async () => {
      try {
        const { migratedNotes, newTags, noteCount } = await migrateDemoToAccount(userId);

        if (noteCount === 0) return;

        // Update React state with migrated data
        if (newTags.length > 0) {
          setTags((prev) => [...prev, ...newTags].sort((a, b) => a.name.localeCompare(b.name)));
        }
        setNotes((prev) => [...migratedNotes, ...prev]);

        toast.success(
          noteCount === 1
            ? 'Your demo note has been migrated!'
            : `${noteCount} demo notes have been migrated!`
        );
      } catch (error) {
        console.error('Failed to migrate demo notes:', error);
        toast.error('Some notes could not be migrated. Please try refreshing.');
        // Don't clear demo state on error so user can retry
        hasMigratedDemoNotes.current = false;
      }
    })();
  }, [userId, isHydrating]);

  // Handle Share Target data for authenticated users
  useEffect(() => {
    if (!userId || !sharedData) return;
    // Prevent duplicate note creation (race condition in Strict Mode)
    if (isCreatingNoteFromShare.current) return;
    isCreatingNoteFromShare.current = true;

    const { title, content } = formatSharedContent(sharedData);

    createNoteOffline(userId, title, content)
      .then((newNote) => {
        clearSharedData();
        trackNoteCreated();
        toast.success('Note created from share');
        startTransition(() => {
          setNotes((prev) => [newNote, ...prev]);
          setSelectedNoteId(newNote.id);
          setView('editor');
        });
      })
      .catch((error: unknown) => {
        console.error('Failed to create note from share:', error);
        toast.error('Failed to create note from share');
      })
      .finally(() => {
        // Reset flag to allow future share-target launches in same session
        isCreatingNoteFromShare.current = false;
      });
  }, [userId, sharedData, clearSharedData, trackNoteCreated, startTransition]);

  // Fetch tags when user is authenticated and hydration is complete
  useEffect(() => {
    if (!userId) {
      setTags([]);
      setSelectedTagIds([]);
      return;
    }

    // Don't fetch until hydration is complete (first-time users need server data)
    if (isHydrating) return;

    fetchTagsOffline(userId)
      .then(setTags)
      .catch(console.error);

    // Subscribe to real-time tag changes (also write to IndexedDB to keep IDB in sync)
    const unsubscribeTags = subscribeToTags(
      userId,
      (newTag) => {
        // Write to IndexedDB first
        upsertTagFromServer(userId, newTag).catch(console.error);

        setTags((prev) => {
          if (prev.some((t) => t.id === newTag.id)) return prev;
          return [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name));
        });
      },
      (updatedTag) => {
        // Write to IndexedDB first
        upsertTagFromServer(userId, updatedTag).catch(console.error);

        setTags((prev) =>
          prev.map((t) => (t.id === updatedTag.id ? updatedTag : t))
        );
      },
      (deletedId) => {
        // Remove from IndexedDB
        deleteTagFromServer(userId, deletedId).catch(console.error);

        setTags((prev) => prev.filter((t) => t.id !== deletedId));
        setSelectedTagIds((prev) => prev.filter((id) => id !== deletedId));
      }
    );

    return () => unsubscribeTags();
  }, [userId, isHydrating]);

  // Fetch faded notes count when user is authenticated and hydration is complete
  useEffect(() => {
    if (!userId) {
      setFadedNotesCount(0);
      setFadedNotes([]);
      return;
    }

    // Don't fetch until hydration is complete (first-time users need server data)
    if (isHydrating) return;

    // Cleanup expired notes first, then fetch count
    // This ensures users never see notes past their 30-day window
    cleanupExpiredFadedNotes()
      .then(() => countFadedNotesOffline(userId))
      .then(setFadedNotesCount)
      .catch(console.error);
  }, [userId, isHydrating]);

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
    startTransition(() => {
      setSelectedNoteId(id);
      setView('editor');
    });
  };

  const handleBack = () => {
    startTransition(() => {
      setView('library');
      setSelectedNoteId(null);
    });
  };

  const handleNewNote = useCallback(async () => {
    if (!user) return;
    try {
      const newNote = await createNoteOffline(user.id);
      trackNoteCreated(); // Track for install prompt engagement
      startTransition(() => {
        setNotes((prev) => [newNote, ...prev]);
        setSelectedNoteId(newNote.id);
        setView('editor');
      });
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  }, [user, startTransition, trackNoteCreated]);

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

  // Note update with offline-first approach
  // Writes to IndexedDB immediately, queues for sync
  // Returns a Promise so Editor can track save status accurately
  const handleNoteUpdate = useCallback(async (updatedNote: Note): Promise<void> => {
    if (!user) return;

    // Store previous state for potential rollback
    const previousNote = notes.find((n) => n.id === updatedNote.id);

    // Update local state immediately for responsiveness (optimistic update)
    setNotes((prev) =>
      prev.map((n) => (n.id === updatedNote.id ? updatedNote : n))
    );

    try {
      // Save to IndexedDB (immediate, works offline)
      // Sync engine will push to server when online
      await updateNoteOffline(user.id, updatedNote);
    } catch (error) {
      console.error('Note save failed:', error);

      // Rollback optimistic update
      if (previousNote) {
        setNotes((prev) =>
          prev.map((n) => (n.id === updatedNote.id ? previousNote : n))
        );
      }

      // Show error toast
      toast.error('Failed to save note locally. Please try again.', {
        duration: 5000,
      });

      // Re-throw so Editor can show error state
      throw error;
    }
  }, [user, notes]);

  // Soft delete a note (move to Faded Notes)
  // Returns true on success, false on failure (for UI recovery in swipe gestures)
  const handleNoteDelete = async (id: string): Promise<boolean> => {
    if (!user) return false;

    // Find the note before deleting (for potential undo)
    const deletedNote = notes.find((n) => n.id === id);

    try {
      await softDeleteNoteOffline(user.id, id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setFadedNotesCount((prev) => prev + 1);
      if (selectedNoteId === id) {
        setView('library');
        setSelectedNoteId(null);
      }

      // Show toast with undo button
      toast(
        (t) => (
          <div className="flex items-center gap-3">
            <span>Note moved to Faded Notes</span>
            <button
              onClick={async () => {
                toast.dismiss(t.id);
                try {
                  await restoreNoteOffline(user.id, id);
                  if (deletedNote) {
                    setNotes((prev) => [{ ...deletedNote, deletedAt: null }, ...prev]);
                  }
                  setFadedNotesCount((prev) => Math.max(0, prev - 1));
                  toast.success('Note restored');
                } catch {
                  toast.error('Failed to undo');
                }
              }}
              className="px-2 py-1 text-sm font-medium rounded transition-colors"
              style={{
                background: 'var(--color-accent)',
                color: 'var(--color-bg-primary)',
              }}
            >
              Undo
            </button>
          </div>
        ),
        { duration: 5000 }
      );
      return true;
    } catch (error) {
      console.error('Failed to delete note:', error);
      toast.error('Failed to delete note');
      return false;
    }
  };

  // Restore a note from Faded Notes
  const handleRestoreNote = async (id: string) => {
    if (!user) return;

    try {
      await restoreNoteOffline(user.id, id);
      // Find the note in fadedNotes and move it back
      const restoredNote = fadedNotes.find((n) => n.id === id);
      if (restoredNote) {
        setFadedNotes((prev) => prev.filter((n) => n.id !== id));
        setNotes((prev) => [{ ...restoredNote, deletedAt: null }, ...prev]);
      }
      setFadedNotesCount((prev) => Math.max(0, prev - 1));
      toast.success('Note restored');
    } catch (error) {
      console.error('Failed to restore note:', error);
      toast.error('Failed to restore note');
    }
  };

  // Permanently delete a note
  const handlePermanentDelete = async (id: string) => {
    if (!user) return;

    try {
      await permanentDeleteNoteOffline(user.id, id);
      setFadedNotes((prev) => prev.filter((n) => n.id !== id));
      setFadedNotesCount((prev) => Math.max(0, prev - 1));
      toast.success('Note permanently deleted');
    } catch (error) {
      console.error('Failed to permanently delete note:', error);
      toast.error('Failed to delete note');
    }
  };

  // Empty all faded notes
  const handleEmptyFadedNotes = async () => {
    try {
      await emptyFadedNotes();
      setFadedNotes([]);
      setFadedNotesCount(0);
      toast.success('All faded notes deleted');
    } catch (error) {
      console.error('Failed to empty faded notes:', error);
      toast.error('Failed to empty faded notes');
    }
  };

  // Navigate to Faded Notes view
  const handleFadedNotesClick = async () => {
    if (!user) return;

    startTransition(() => {
      setView('faded');
    });
    setFadedNotesLoading(true);
    try {
      const faded = await fetchFadedNotesOffline(user.id);
      setFadedNotes(faded);
    } catch (error) {
      console.error('Failed to fetch faded notes:', error);
      toast.error('Failed to load faded notes');
    } finally {
      setFadedNotesLoading(false);
    }
  };

  const handleTogglePin = async (id: string, pinned: boolean) => {
    if (!user) return;

    try {
      // Update local state immediately for responsiveness
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, pinned } : n))
      );
      // Persist to IndexedDB, queue for sync
      await toggleNotePinOffline(user.id, id, pinned);
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

  // Conflict resolution handler
  const handleConflictResolve = async (choice: 'local' | 'server' | 'both') => {
    if (!activeConflict || !user) return;

    try {
      await resolveConflict(user.id, activeConflict, choice);
      removeConflict(activeConflict.entityId);

      // Refresh notes from IndexedDB after conflict resolution
      const refreshedNotes = await fetchNotesOffline(user.id);
      setNotes(refreshedNotes);
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      toast.error('Failed to resolve conflict. Please try again.');
      // Still remove the conflict to prevent infinite retry loops
      // User can trigger a sync to re-detect conflicts if needed
      removeConflict(activeConflict.entityId);
    }
  };

  const handleConflictDismiss = () => {
    if (activeConflict) {
      removeConflict(activeConflict.entityId);
    }
    setActiveConflict(null);
  };

  // Pull-to-refresh handler - refreshes notes from IndexedDB/server
  const handleRefresh = useCallback(async () => {
    if (!user) return;

    try {
      const refreshedNotes = await fetchNotesOffline(user.id);
      setNotes(refreshedNotes);
      toast.success('Notes refreshed', { duration: 1500, icon: '🔄' });
    } catch (error) {
      console.error('Refresh failed:', error);
      toast.error('Failed to refresh notes');
    }
  }, [user]);

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
      const updated = await updateTagOffline(user.id, editingTag.id, { name, color });
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
      const newTag = await createTagOffline(user.id, name, color);
      setTags((prev) => [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name)));
    }
    setEditingTag(null);
  };

  const handleDeleteTag = async () => {
    if (!editingTag || !user) return;
    await deleteTagOffline(user.id, editingTag.id);
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
    if (!user) return;

    const note = notes.find((n) => n.id === noteId);
    if (!note) return;

    const hasTag = note.tags.some((t) => t.id === tagId);
    const tag = tags.find((t) => t.id === tagId);

    try {
      if (hasTag) {
        await removeTagFromNoteOffline(user.id, noteId, tagId);
        // Update local state
        setNotes((prev) =>
          prev.map((n) =>
            n.id === noteId
              ? { ...n, tags: n.tags.filter((t) => t.id !== tagId) }
              : n
          )
        );
      } else if (tag) {
        await addTagToNoteOffline(user.id, noteId, tagId);
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
      if (!user) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      try {
        const results = await searchNotesOffline(user.id, query);
        setSearchResults(results);
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, [user]);

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

    setImportProgress({ isImporting: true, current: 0, total: 0, phase: 'parsing' });
    try {
      const content = await readFileAsText(file);
      const isJSON = file.name.endsWith('.json');
      const isMarkdown = file.name.endsWith('.md') || file.name.endsWith('.markdown');

      if (isJSON) {
        // Import JSON backup with validation
        const data = parseImportedJSON(content);
        const totalNotes = data.notes.length;

        setImportProgress({ isImporting: true, current: 0, total: totalNotes, phase: 'importing' });

        // Create tags first (if they don't exist)
        const tagMap = new Map<string, string>(); // name -> id
        for (const tagData of data.tags) {
          const existingTag = tags.find(t => t.name.toLowerCase() === tagData.name.toLowerCase());
          if (existingTag) {
            tagMap.set(tagData.name, existingTag.id);
          } else {
            const newTag = await createTagOffline(user.id, tagData.name, tagData.color as import('./types').TagColor);
            tagMap.set(tagData.name, newTag.id);
            setTags(prev => [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name)));
          }
        }

        // Prepare notes for batch insert (keep original tags for later)
        const originalTagsMap = new Map<number, string[]>();
        const notesToImport = data.notes.map((noteData, index) => {
          originalTagsMap.set(index, noteData.tags);
          return {
            title: noteData.title,
            content: sanitizeHtml(noteData.content),
            createdAt: noteData.createdAt ? new Date(noteData.createdAt) : undefined,
            updatedAt: noteData.updatedAt ? new Date(noteData.updatedAt) : undefined,
          };
        });

        // Batch insert notes with progress callback (offline-first)
        const createdNotes = await createNotesBatchOffline(
          user.id,
          notesToImport,
          (completed, total) => {
            setImportProgress({ isImporting: true, current: completed, total, phase: 'importing' });
          }
        );

        // Add tags to notes (this still needs to be sequential due to junction table)
        setImportProgress({ isImporting: true, current: 0, total: createdNotes.length, phase: 'finalizing' });
        for (let i = 0; i < createdNotes.length; i++) {
          const note = createdNotes[i];
          const originalTags = originalTagsMap.get(i) || [];
          for (const tagName of originalTags) {
            const tagId = tagMap.get(tagName);
            if (tagId) {
              await addTagToNoteOffline(user.id, note.id, tagId);
            }
          }
          setImportProgress({ isImporting: true, current: i + 1, total: createdNotes.length, phase: 'finalizing' });
        }

        toast.success(`Successfully imported ${createdNotes.length} note${createdNotes.length === 1 ? '' : 's'}`);

        // Refresh notes from IndexedDB
        const refreshedNotes = await fetchNotesOffline(user.id);
        setNotes(refreshedNotes);

      } else if (isMarkdown) {
        // Try to parse as combined multi-note export first
        const multiNotes = parseMultiNoteMarkdown(content);

        if (multiNotes) {
          const totalNotes = multiNotes.length;
          setImportProgress({ isImporting: true, current: 0, total: totalNotes, phase: 'importing' });

          // Collect all unique tags from imported notes
          const allTagNames = new Set<string>();
          for (const noteData of multiNotes) {
            for (const tagName of noteData.tags) {
              allTagNames.add(tagName);
            }
          }

          // Create tag map (create missing tags)
          const tagMap = new Map<string, string>(); // name -> id
          for (const tagName of allTagNames) {
            const existingTag = tags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
            if (existingTag) {
              tagMap.set(tagName, existingTag.id);
            } else {
              const newTag = await createTagOffline(user.id, tagName, 'stone');
              tagMap.set(tagName, newTag.id);
              setTags(prev => [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name)));
            }
          }

          // Prepare notes for batch insert (keep original tags for later)
          const originalTagsMap = new Map<number, string[]>();
          const notesToImport = multiNotes.map((noteData, index) => {
            originalTagsMap.set(index, noteData.tags);
            return {
              title: noteData.title,
              content: sanitizeHtml(markdownToHtml(noteData.content)),
            };
          });

          // Batch insert notes with progress callback (offline-first)
          const createdNotes = await createNotesBatchOffline(
            user.id,
            notesToImport,
            (completed, total) => {
              setImportProgress({ isImporting: true, current: completed, total, phase: 'importing' });
            }
          );

          // Add tags to notes if any tags were present
          if (tagMap.size > 0) {
            setImportProgress({ isImporting: true, current: 0, total: createdNotes.length, phase: 'finalizing' });
            for (let i = 0; i < createdNotes.length; i++) {
              const note = createdNotes[i];
              const originalTags = originalTagsMap.get(i) || [];
              for (const tagName of originalTags) {
                const tagId = tagMap.get(tagName);
                if (tagId) {
                  await addTagToNoteOffline(user.id, note.id, tagId);
                }
              }
              setImportProgress({ isImporting: true, current: i + 1, total: createdNotes.length, phase: 'finalizing' });
            }
          }

          // Refresh notes from IndexedDB
          const refreshedNotes = await fetchNotesOffline(user.id);
          setNotes(refreshedNotes);

          toast.success(`Successfully imported ${createdNotes.length} note${createdNotes.length === 1 ? '' : 's'}`);
        } else {
          // Import single markdown file as a note
          setImportProgress({ isImporting: true, current: 0, total: 1, phase: 'importing' });

          const lines = content.split('\n');
          let title = file.name.replace(/\.(md|markdown)$/, '');
          let noteContent = content;
          let noteTags: string[] = [];
          let contentStartIndex = 0;

          // Extract title from first H1 if present
          if (lines[0]?.startsWith('# ')) {
            title = lines[0].substring(2).trim();
            contentStartIndex = 1;
          }

          // Check for Tags line (e.g., "Tags: tag1, tag2")
          const nextLine = lines[contentStartIndex]?.trim();
          if (nextLine?.startsWith('Tags:')) {
            const tagsStr = nextLine.substring(5).trim();
            noteTags = tagsStr.split(',').map(t => t.trim()).filter(t => t.length > 0);
            contentStartIndex++;
          }

          // Skip empty line after tags if present
          if (lines[contentStartIndex]?.trim() === '') {
            contentStartIndex++;
          }

          noteContent = lines.slice(contentStartIndex).join('\n').trim();

          // Create tag map (create missing tags)
          const tagMap = new Map<string, string>();
          for (const tagName of noteTags) {
            const existingTag = tags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
            if (existingTag) {
              tagMap.set(tagName, existingTag.id);
            } else {
              const newTag = await createTagOffline(user.id, tagName, 'stone');
              tagMap.set(tagName, newTag.id);
              setTags(prev => [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name)));
            }
          }

          // Convert markdown to HTML and sanitize
          const htmlContent = sanitizeHtml(markdownToHtml(noteContent));

          // Create the note
          const newNote = await createNoteOffline(user.id, title, htmlContent);

          // Add tags to the note
          for (const tagName of noteTags) {
            const tagId = tagMap.get(tagName);
            if (tagId) {
              await addTagToNoteOffline(user.id, newNote.id, tagId);
            }
          }

          // Refresh from IndexedDB to get the note with tags
          const refreshedNotes = await fetchNotesOffline(user.id);
          setNotes(refreshedNotes);

          toast.success(`Imported "${title}"`);
        }
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
      setImportProgress(null);
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

  // Show shared note view if share token is present
  if (shareToken) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<LoadingFallback message="Loading shared note..." />}>
          <SharedNoteView
          token={shareToken}
          theme={theme}
          onThemeToggle={handleThemeToggle}
          onInvalidToken={() => {
            // Clear URL and show landing/library
            window.history.replaceState({}, '', window.location.pathname);
            setShareToken(null);
          }}
          onChangelogClick={() => startTransition(() => setView('changelog'))}
          onRoadmapClick={() => startTransition(() => setView('roadmap'))}
        />
        </Suspense>
      </ErrorBoundary>
    );
  }

  // Show demo page for /demo route (accessible without login)
  if (isDemo && !user) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<LoadingFallback message="Preparing your practice space..." />}>
          <DemoPage
            onSignUp={() => {
              setAuthModalMode('signup');
              setShowAuthModal(true);
            }}
            onSignIn={() => {
              setAuthModalMode('login');
              setShowAuthModal(true);
            }}
            theme={theme}
            onThemeToggle={handleThemeToggle}
            onChangelogClick={() => startTransition(() => setView('changelog'))}
            onRoadmapClick={() => startTransition(() => setView('roadmap'))}
          />
        </Suspense>
        {showAuthModal && (
          <Auth
            theme={theme}
            onThemeToggle={handleThemeToggle}
            initialMode={authModalMode}
            isModal
            onClose={() => setShowAuthModal(false)}
          />
        )}
      </ErrorBoundary>
    );
  }

  // Public pages (accessible without login)
  if (view === 'changelog') {
    return (
      <>
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <ChangelogPage
              theme={theme}
              onThemeToggle={handleThemeToggle}
              onSignIn={() => {
                setAuthModalMode('login');
                setShowAuthModal(true);
              }}
              onLogoClick={() => startTransition(() => setView('library'))}
              onRoadmapClick={() => startTransition(() => setView('roadmap'))}
              onSettingsClick={() => setShowSettingsModal(true)}
            />
          </Suspense>
        </ErrorBoundary>
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
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <RoadmapPage
              theme={theme}
              onThemeToggle={handleThemeToggle}
              onSignIn={() => {
                setAuthModalMode('login');
                setShowAuthModal(true);
              }}
              onLogoClick={() => startTransition(() => setView('library'))}
              onChangelogClick={() => startTransition(() => setView('changelog'))}
              onSettingsClick={() => setShowSettingsModal(true)}
            />
          </Suspense>
        </ErrorBoundary>
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
          onChangelogClick={() => startTransition(() => setView('changelog'))}
          onRoadmapClick={() => startTransition(() => setView('roadmap'))}
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

  // Faded Notes View
  if (view === 'faded') {
    return (
      <ErrorBoundary>
        <Suspense fallback={<LoadingFallback message="Loading faded notes..." />}>
          <FadedNotesView
            notes={fadedNotes}
            isLoading={fadedNotesLoading}
            onBack={() => startTransition(() => setView('library'))}
            onRestore={handleRestoreNote}
            onPermanentDelete={handlePermanentDelete}
            onEmptyAll={handleEmptyFadedNotes}
            theme={theme}
            onThemeToggle={handleThemeToggle}
            onSettingsClick={() => setShowSettingsModal(true)}
          />
        </Suspense>
      </ErrorBoundary>
    );
  }

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
          onFadedNotesClick={handleFadedNotesClick}
          fadedNotesCount={fadedNotesCount}
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
          <ChapteredLibrary
            notes={displayNotes}
            onNoteClick={handleNoteClick}
            onNoteDelete={handleNoteDelete}
            onTogglePin={handleTogglePin}
            onNewNote={handleNewNote}
            onRefresh={handleRefresh}
            searchQuery={searchQuery}
          />
        )}

        {/* Tag Modal */}
        {showTagModal && (
          <ErrorBoundary>
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
          </ErrorBoundary>
        )}

        {/* Settings Modal */}
        {showSettingsModal && (
          <ErrorBoundary>
            <Suspense fallback={null}>
              <SettingsModal
                isOpen={showSettingsModal}
                onClose={() => setShowSettingsModal(false)}
                theme={theme}
                onThemeToggle={handleThemeToggle}
                onLetGoClick={() => setShowLettingGoModal(true)}
              />
            </Suspense>
          </ErrorBoundary>
        )}

        {/* Letting Go Modal (offboarding) */}
        {showLettingGoModal && (
          <ErrorBoundary>
            <Suspense fallback={null}>
              <LettingGoModal
                isOpen={showLettingGoModal}
                onClose={() => setShowLettingGoModal(false)}
                notes={notes}
                tags={tags}
              />
            </Suspense>
          </ErrorBoundary>
        )}

        {/* Welcome Back Prompt (shown when user signs in during grace period) */}
        {showWelcomeBack && daysUntilRelease !== null && (
          <WelcomeBackPrompt
            daysRemaining={daysUntilRelease}
            onStay={() => setShowWelcomeBack(false)}
            onContinue={() => setShowWelcomeBack(false)}
          />
        )}

        {/* Footer */}
        <Footer
          onChangelogClick={() => startTransition(() => setView('changelog'))}
          onRoadmapClick={() => startTransition(() => setView('roadmap'))}
        />

        {/* Import Loading Overlay with Progress */}
        {importProgress && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)' }}
          >
            <div
              className="px-8 py-6 rounded-lg text-center min-w-[280px]"
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
                {importProgress.phase === 'parsing' && 'Parsing file...'}
                {importProgress.phase === 'importing' && (
                  importProgress.total > 0
                    ? `Importing notes... ${importProgress.current}/${importProgress.total}`
                    : 'Importing notes...'
                )}
                {importProgress.phase === 'finalizing' && (
                  `Adding tags... ${importProgress.current}/${importProgress.total}`
                )}
              </p>
              {importProgress.total > 0 && importProgress.phase !== 'parsing' && (
                <div className="mt-3">
                  <div
                    className="h-2 rounded-full overflow-hidden"
                    style={{ background: 'var(--color-bg-tertiary)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.round((importProgress.current / importProgress.total) * 100)}%`,
                        background: 'var(--color-accent)',
                      }}
                    />
                  </div>
                  <p
                    className="text-xs mt-2"
                    style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-body)' }}
                  >
                    {Math.round((importProgress.current / importProgress.total) * 100)}% complete
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Conflict Resolution Modal */}
        <ConflictModal
          conflict={activeConflict}
          onResolve={handleConflictResolve}
          onDismiss={handleConflictDismiss}
        />

        {/* PWA Install Prompt (Chrome/Android) */}
        {shouldShowPrompt && (
          <InstallPrompt
            onInstall={triggerInstall}
            onDismiss={dismissPrompt}
          />
        )}

        {/* iOS Install Guide (Safari) */}
        {shouldShowIOSGuide && (
          <IOSInstallGuide onDismiss={dismissIOSGuide} />
        )}
      </div>
    );
  }

  // Editor View
  if (view === 'editor' && selectedNote) {
    return (
      <>
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback message="Loading editor..." />}>
          <Editor
            note={selectedNote}
            tags={tags}
            userId={user.id}
            onBack={handleBack}
            onUpdate={handleNoteUpdate}
            onDelete={handleNoteDelete}
            onToggleTag={handleNoteTagToggle}
            onCreateTag={handleAddTag}
            theme={theme}
            onThemeToggle={handleThemeToggle}
            onSettingsClick={() => setShowSettingsModal(true)}
          />
          </Suspense>
        </ErrorBoundary>
        {/* Tag Modal */}
        {showTagModal && (
          <ErrorBoundary>
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
          </ErrorBoundary>
        )}

        {/* Conflict Resolution Modal */}
        <ConflictModal
          conflict={activeConflict}
          onResolve={handleConflictResolve}
          onDismiss={handleConflictDismiss}
        />
      </>
    );
  }

  return null;
}

export default App;
