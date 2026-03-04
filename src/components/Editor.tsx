import { useState, useEffect, useRef, useCallback } from 'react';
import type { Editor as TiptapEditor } from '@tiptap/react';
import type { Note, Tag, Theme } from '../types';
import { RichTextEditor } from './RichTextEditor';
import { EditorToolbar } from './EditorToolbar';
import { TagSelector } from './TagSelector';
import { ShareModal } from './ShareModal';
import { formatShortDate, formatRelativeTime } from '../utils/formatTime';
import { HeaderShell } from './HeaderShell';
import { WhisperBack } from './WhisperBack';
import { useMobileDetect } from '../hooks/useMobileDetect';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';
import {
  exportNoteToMarkdown,
  exportNoteToJSON,
  getSanitizedFilename,
  downloadFile,
  copyNoteToClipboard,
  copyNoteWithFormatting,
} from '../utils/exportImport';
import {
  saveScrollPosition,
  getEditorPosition,
  createThrottledSave,
  type ThrottledSave,
} from '../utils/editorPosition';

// Position restoration constants
const RESUME_SCROLL_THRESHOLD_PX = 400; // Show resume chip if scrolled > 400px
const RESUME_CHIP_MIN_VISIBLE_MS = 2000; // Keep chip visible for at least 2 seconds
const SCROLL_SAVE_THROTTLE_MS = 1000; // Save scroll position at most every 1 second
const TRIPLE_TAP_WINDOW_MS = 500; // Time window for triple-tap detection

// E2EE sharing re-enabled: shares are encrypted client-side with per-share random keys.
// The decryption key lives in the URL fragment and never reaches the server.
const sharingEnabled = true;

interface EditorProps {
  note: Note;
  tags: Tag[];
  userId: string;
  onBack: () => void;
  onUpdate: (note: Note) => Promise<void>;
  onDelete: (id: string) => void;
  onToggleTag: (noteId: string, tagId: string) => void;
  onCreateTag?: () => void;
  theme: Theme;
  onThemeToggle: () => void;
  onSettingsClick: () => void;
  isDemo?: boolean; // Hide share functionality in demo mode
  noteSyncStatus?: 'synced' | 'pending' | 'conflict'; // Note-specific sync status (3A)
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'synced' | 'copied' | 'error';

export function Editor({ note, tags, userId, onBack, onUpdate, onDelete, onToggleTag, onCreateTag, theme, onThemeToggle, onSettingsClick, isDemo = false, noteSyncStatus }: EditorProps) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [editor, setEditor] = useState<TiptapEditor | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showResumeChip, setShowResumeChip] = useState(false);
  const [savedScrollPosition, setSavedScrollPosition] = useState<number | null>(null);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const isMobile = useMobileDetect();
  useKeyboardHeight(); // Sets --keyboard-height CSS var for bottom toolbar positioning
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tapCountRef = useRef(0);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const throttledScrollSaveRef = useRef<ThrottledSave | null>(null);
  // Store pending scroll save data (captured at scroll time, not timer execution time)
  // This prevents saving wrong scroll position if note switches before timer fires
  const pendingScrollSaveRef = useRef<{ noteId: string; scroll: number } | null>(null);
  // Track when resume chip was shown to prevent immediate hiding
  const resumeChipShownAtRef = useRef<number>(0);
  // Track the active note ID synchronously (updated during render, not in effects)
  // This allows scroll handlers to detect stale closures during DOM reflow
  const activeNoteIdRef = useRef(note.id);
  activeNoteIdRef.current = note.id; // Update synchronously on every render
  // Separate refs for save indicator phases to avoid nested timeout issues
  const savePhaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideIndicatorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track in-flight save promise to await on navigation
  const inFlightSaveRef = useRef<Promise<void> | null>(null);
  const [currentNoteId, setCurrentNoteId] = useState(note.id);

  // Remote update tracking (2B): detect when the note prop changes from
  // another device's sync, distinguish from our own save echoing back
  const lastSavedTitleRef = useRef(note.title);
  const lastSavedContentRef = useRef(note.content);
  const [remoteUpdate, setRemoteUpdate] = useState<{
    title: string;
    content: string;
  } | null>(null);
  // Track the last dismissed remote version so the detection effect
  // doesn't re-show the banner after the next sync rehydration
  const dismissedRemoteRef = useRef<{ title: string; content: string } | null>(null);

  // Reset local state when switching to a different note
  useEffect(() => {
    if (currentNoteId !== note.id) {
      // Flush any pending scroll save for the previous note before switching
      throttledScrollSaveRef.current?.flush();

      setCurrentNoteId(note.id);
      setTitle(note.title);
      setContent(note.content);
      // Update lastSaved refs for the new note (2B)
      lastSavedTitleRef.current = note.title;
      lastSavedContentRef.current = note.content;
      setRemoteUpdate(null);
      dismissedRemoteRef.current = null;
      // Reset resume chip, scroll save, and focus mode for new note
      setShowResumeChip(false);
      setSavedScrollPosition(null);
      setIsFocusMode(false);
      resumeChipShownAtRef.current = 0;
      throttledScrollSaveRef.current = null;
      pendingScrollSaveRef.current = null; // Clear pending data for old note
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  // Detect remote updates to the currently open note (2B)
  // When the note prop changes (from sync rehydration) while the same note is open:
  // - Self-echo: incoming matches what we last saved → ignore
  // - Clean editor: no unsaved changes → silently update local state
  // - Dirty editor: user has unsaved changes → show "Updated on another device" banner
  useEffect(() => {
    // Only watch for changes when the note ID hasn't changed (same note open)
    if (note.id !== currentNoteId) return;

    // Check if the prop actually changed
    const propTitleChanged = note.title !== lastSavedTitleRef.current;
    const propContentChanged = note.content !== lastSavedContentRef.current;
    if (!propTitleChanged && !propContentChanged) return;

    // Skip if this is a version the user already dismissed via "Keep mine"
    if (
      dismissedRemoteRef.current &&
      note.title === dismissedRemoteRef.current.title &&
      note.content === dismissedRemoteRef.current.content
    ) return;

    // Check if the local editor has unsaved changes
    const hasUnsavedChanges =
      title !== lastSavedTitleRef.current ||
      content !== lastSavedContentRef.current;

    if (hasUnsavedChanges) {
      // Dirty editor: show banner to let user choose
      setRemoteUpdate({ title: note.title, content: note.content });
    } else {
      // Clean editor: silently update local state
      setTitle(note.title);
      setContent(note.content);
      lastSavedTitleRef.current = note.title;
      lastSavedContentRef.current = note.content;
      if (editor) {
        editor.commands.setContent(note.content, { emitUpdate: false });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.title, note.content, note.id]);

  // Load saved scroll position and show Resume chip if far from top
  useEffect(() => {
    const stored = getEditorPosition(note.id);

    if (stored && stored.scroll > RESUME_SCROLL_THRESHOLD_PX) {
      setSavedScrollPosition(stored.scroll);
      setShowResumeChip(true);
      resumeChipShownAtRef.current = Date.now(); // Track when chip was shown
    } else {
      setSavedScrollPosition(null);
      setShowResumeChip(false);
      resumeChipShownAtRef.current = 0;
    }
  }, [note.id]);

  // Track scroll position (throttled save to localStorage)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Ignore scroll events from stale handlers during DOM reflow
      // The activeNoteIdRef is updated synchronously during render, before effects cleanup
      // So if note.id (from closure) differs, this is an OLD handler firing after note switch
      if (note.id !== activeNoteIdRef.current) return;

      // Capture both noteId and scrollTop NOW at scroll time
      // This prevents saving wrong data if note switches before timer fires
      pendingScrollSaveRef.current = {
        noteId: note.id,
        scroll: container.scrollTop,
      };

      // Create throttled save if not exists
      if (!throttledScrollSaveRef.current) {
        throttledScrollSaveRef.current = createThrottledSave(() => {
          // Read from ref (captured at scroll time) instead of closure/DOM
          const pending = pendingScrollSaveRef.current;
          if (pending) {
            saveScrollPosition(pending.noteId, pending.scroll);
          }
        }, SCROLL_SAVE_THROTTLE_MS);
      }
      throttledScrollSaveRef.current.save();

      // Hide resume chip after minimum visible time has passed
      // This prevents programmatic scrolls (focus, keyboard resize) from hiding it immediately
      if (showResumeChip) {
        const elapsed = Date.now() - resumeChipShownAtRef.current;
        if (elapsed >= RESUME_CHIP_MIN_VISIBLE_MS) {
          setShowResumeChip(false);
        }
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });

    // Flush any pending scroll save on cleanup (component unmount or note switch)
    return () => {
      container.removeEventListener('scroll', handleScroll);
      throttledScrollSaveRef.current?.flush();
    };
  }, [note.id, showResumeChip]);

  // Handle resume button click
  const handleResumeScroll = useCallback(() => {
    if (savedScrollPosition && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: savedScrollPosition,
        behavior: 'smooth',
      });
      setShowResumeChip(false);
    }
  }, [savedScrollPosition]);

  // Perform the actual save (async with proper status tracking)
  const performSave = useCallback(async () => {
    if (title === note.title && content === note.content) return;

    // Clear any existing indicator timeouts
    if (savePhaseTimeoutRef.current) {
      clearTimeout(savePhaseTimeoutRef.current);
    }
    if (hideIndicatorTimeoutRef.current) {
      clearTimeout(hideIndicatorTimeoutRef.current);
    }

    setSaveStatus('saving');

    // Update lastSaved refs BEFORE the async call (2B fix).
    // The optimistic setNotes() inside onUpdate triggers a React re-render;
    // if refs still have old values, the remote-detection effect would
    // misclassify our own save as a remote update and show a false banner.
    const prevSavedTitle = lastSavedTitleRef.current;
    const prevSavedContent = lastSavedContentRef.current;
    lastSavedTitleRef.current = title;
    lastSavedContentRef.current = content;

    // Create and track the save promise
    const savePromise = (async () => {
      try {
        await onUpdate({
          ...note,
          title,
          content,
          updatedAt: new Date(),
        });

        // Show success state
        setSaveStatus('saved');

        // Hide indicator after 2 seconds
        hideIndicatorTimeoutRef.current = setTimeout(() => {
          setSaveStatus('idle');
        }, 2000);
      } catch {
        // Revert refs so the detection effect correctly identifies
        // the state as "unsaved changes" after a failed save
        lastSavedTitleRef.current = prevSavedTitle;
        lastSavedContentRef.current = prevSavedContent;

        // Save failed after retries - show error state
        setSaveStatus('error');

        // Keep error visible for 5 seconds
        hideIndicatorTimeoutRef.current = setTimeout(() => {
          setSaveStatus('idle');
        }, 5000);
      } finally {
        // Clear the in-flight ref when done
        inFlightSaveRef.current = null;
      }
    })();

    inFlightSaveRef.current = savePromise;
    await savePromise;
  }, [title, content, note, onUpdate]);

  // Auto-save when content changes (debounced)
  useEffect(() => {
    // Don't auto-save if nothing changed
    if (title === note.title && content === note.content) return;

    // Clear any existing auto-save timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Schedule auto-save after 800ms of inactivity (reduced from 1.5s for faster sync)
    autoSaveTimeoutRef.current = setTimeout(() => {
      performSave();
    }, 800);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [title, content, note.title, note.content, performSave]);

  // Flush pending auto-save on visibility change / page hide.
  // When user switches apps on mobile, the pending debounce timer may never fire.
  // This ensures edits are saved to IndexedDB before the page becomes hidden.
  const flushingRef = useRef(false);
  useEffect(() => {
    const flush = async () => {
      // Guard: prevent double-dispatch if both visibilitychange and pagehide fire
      if (flushingRef.current) return;
      flushingRef.current = true;

      try {
        // Cancel the debounce timer
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current);
          autoSaveTimeoutRef.current = null;
        }

        // Await any in-flight save before starting a new one
        if (inFlightSaveRef.current) {
          await inFlightSaveRef.current;
        }

        // Only save if there are unsaved changes
        if (title !== note.title || content !== note.content) {
          await performSave();
        }
      } finally {
        flushingRef.current = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flush();
      }
    };

    const handlePageHide = () => {
      flush();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [title, content, note.title, note.content, performSave]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Cmd/Ctrl+Shift+F: toggle focus mode
      if (e.key.toLowerCase() === 'f' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        setIsFocusMode((prev) => !prev);
        return;
      }
      // Escape: exit focus mode first, then save and go back
      if (e.key === 'Escape') {
        if (isFocusMode) {
          setIsFocusMode(false);
          return;
        }
        // First await any existing in-flight save
        if (inFlightSaveRef.current) {
          await inFlightSaveRef.current;
        }
        // Then trigger a new save if needed and await it
        await performSave();
        onBack();
      }
      // Cmd/Ctrl+Shift+C: copy note to clipboard
      if (e.key === 'c' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        const currentNote = { ...note, title, content };
        copyNoteToClipboard(currentNote).then(() => {
          showCopiedIndicator();
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [performSave, onBack, note, title, content, isFocusMode]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    // Capture refs to clear on cleanup (required by exhaustive-deps rule)
    const autoSaveTimeout = autoSaveTimeoutRef;
    const savePhaseTimeout = savePhaseTimeoutRef;
    const hideIndicatorTimeout = hideIndicatorTimeoutRef;
    const tapTimeout = tapTimeoutRef;

    return () => {
      // Clear any pending timeouts when component unmounts
      if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current);
      if (savePhaseTimeout.current) clearTimeout(savePhaseTimeout.current);
      if (hideIndicatorTimeout.current) clearTimeout(hideIndicatorTimeout.current);
      if (tapTimeout.current) clearTimeout(tapTimeout.current);
    };
  }, []);

  // Note-specific sync indicator (3A): when this note transitions from 'pending'
  // to 'synced', briefly show the "Synced" cloud-check status.
  // Only fires when the editor is in 'saved' or 'idle' state to avoid interrupting
  // active save indicators.
  const prevSyncStatusRef = useRef(noteSyncStatus);
  useEffect(() => {
    const prev = prevSyncStatusRef.current;
    prevSyncStatusRef.current = noteSyncStatus;

    if (
      prev === 'pending' &&
      noteSyncStatus === 'synced' &&
      (saveStatus === 'saved' || saveStatus === 'idle')
    ) {
      // Clear any existing indicator timeouts
      if (savePhaseTimeoutRef.current) clearTimeout(savePhaseTimeoutRef.current);
      if (hideIndicatorTimeoutRef.current) clearTimeout(hideIndicatorTimeoutRef.current);

      setSaveStatus('synced');
      hideIndicatorTimeoutRef.current = setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    }
  }, [noteSyncStatus, saveStatus]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTitle(e.target.value);
    // Auto-resize
    if (titleRef.current) {
      titleRef.current.style.height = 'auto';
      titleRef.current.style.height = titleRef.current.scrollHeight + 'px';
    }
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Focus will move to the editor naturally
    }
  };

  // Remote update banner handlers (2B)
  const handleLoadRemoteChanges = useCallback(() => {
    if (!remoteUpdate) return;
    setTitle(remoteUpdate.title);
    setContent(remoteUpdate.content);
    lastSavedTitleRef.current = remoteUpdate.title;
    lastSavedContentRef.current = remoteUpdate.content;
    if (editor) {
      editor.commands.setContent(remoteUpdate.content, { emitUpdate: false });
    }
    setRemoteUpdate(null);
  }, [remoteUpdate, editor]);

  const handleKeepMine = useCallback(() => {
    if (remoteUpdate) {
      dismissedRemoteRef.current = remoteUpdate;
    }
    setRemoteUpdate(null);
  }, [remoteUpdate]);

  // Check if note has meaningful content (not just empty HTML)
  // Uses current content state, not note.content prop, to handle unsaved changes
  const hasContent = (() => {
    const stripped = content.replace(/<[^>]*>/g, '').trim();
    return stripped.length > 0;
  })();

  // Auto-resize title on mount and handle initial focus
  useEffect(() => {
    if (titleRef.current) {
      titleRef.current.style.height = 'auto';
      titleRef.current.style.height = titleRef.current.scrollHeight + 'px';

      // Focus title if note is empty (new note)
      if (!hasContent) {
        titleRef.current.focus();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    onDelete(note.id);
  };

  // Handle logo click: save and go back (awaits any in-flight save)
  const handleLogoClick = async () => {
    // First await any existing in-flight save
    if (inFlightSaveRef.current) {
      await inFlightSaveRef.current;
    }
    // Then trigger a new save if needed and await it
    await performSave();
    onBack();
  };

  // Scroll to top of note (like Twitter header behavior)
  const handleScrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Export handlers
  const handleExportMarkdown = () => {
    const currentNote = { ...note, title, content };
    const markdown = exportNoteToMarkdown(currentNote);
    const filename = `${getSanitizedFilename(title)}.md`;
    downloadFile(markdown, filename, 'text/markdown');
    setShowExportMenu(false);
  };

  const handleExportJSON = () => {
    const currentNote = { ...note, title, content };
    const json = exportNoteToJSON(currentNote);
    const filename = `${getSanitizedFilename(title)}.json`;
    downloadFile(json, filename, 'application/json');
    setShowExportMenu(false);
  };

  // Copy handlers
  const handleCopyPlainText = async () => {
    const currentNote = { ...note, title, content };
    await copyNoteToClipboard(currentNote);
    setShowExportMenu(false);
    showCopiedIndicator();
  };

  const handleCopyWithFormatting = async () => {
    const currentNote = { ...note, title, content };
    await copyNoteWithFormatting(currentNote);
    setShowExportMenu(false);
    showCopiedIndicator();
  };

  // Get save status styling based on current status
  function getSaveStatusStyle(status: SaveStatus): { color: string; background: string } {
    switch (status) {
      case 'saving':
        return { color: 'var(--color-accent)', background: 'var(--color-accent-glow)' };
      case 'error':
        return { color: 'var(--color-error)', background: 'var(--color-error-light)' };
      case 'synced':
        return { color: 'var(--color-accent)', background: 'var(--color-accent-glow)' };
      default:
        return { color: 'var(--color-success)', background: 'var(--color-success-glow)' };
    }
  }

  const showCopiedIndicator = () => {
    // Clear any existing indicator timeouts
    if (savePhaseTimeoutRef.current) {
      clearTimeout(savePhaseTimeoutRef.current);
    }
    if (hideIndicatorTimeoutRef.current) {
      clearTimeout(hideIndicatorTimeoutRef.current);
    }

    setSaveStatus('copied');

    // Hide the indicator after 2 seconds
    hideIndicatorTimeoutRef.current = setTimeout(() => {
      setSaveStatus('idle');
    }, 2000);
  };

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showExportMenu]);

  const handleToggleFocusMode = useCallback(() => setIsFocusMode(prev => !prev), []);

  // Track touch start position to distinguish taps from scrolls
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  // Triple-tap on mobile writing area toggles focus mode
  // Only counts stationary taps (movement < 10px), ignoring scrolls and drags
  // Ignores taps on interactive elements (buttons, dropdowns) to prevent accidental triggers
  const handleTapEnd = useCallback((e: React.TouchEvent) => {
    const start = touchStartRef.current;
    if (!start) return;

    const touch = e.changedTouches[0];
    const dx = Math.abs(touch.clientX - start.x);
    const dy = Math.abs(touch.clientY - start.y);
    touchStartRef.current = null;

    // Ignore if touch moved (scroll/drag, not a tap)
    if (dx > 10 || dy > 10) return;

    // Ignore taps on interactive child elements (TagSelector, toolbar, footer links)
    const target = e.target as HTMLElement;
    if (target.closest('button, select, input, textarea, [role="menu"], [role="listbox"]')) return;

    tapCountRef.current += 1;
    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);

    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0;
      // Clear native text selection that triple-tap may have triggered
      window.getSelection()?.removeAllRanges();
      setIsFocusMode((prev) => !prev);
      return;
    }

    tapTimeoutRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, TRIPLE_TAP_WINDOW_MS);
  }, []);

  // Left content: Logo + Breadcrumb (integrated for visual continuity)
  const leftContent = (
    <div className="flex items-center min-w-0">
      {/* Clickable Logo */}
      <button
        onClick={handleLogoClick}
        className="text-[1.4rem] md:text-[1.75rem] font-semibold tracking-tight transition-colors duration-200 hover:text-[var(--color-accent)] shrink-0"
        style={{
          fontFamily: 'var(--font-display)',
          color: 'var(--color-text-primary)',
          letterSpacing: '-0.5px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        Yidhan
      </button>

      {/* Separator - visible on desktop */}
      <span
        className="hidden sm:inline mx-2 md:mx-3 text-xl"
        style={{ color: 'var(--color-text-tertiary)' }}
      >
        /
      </span>

      {/* Note Title - visible on desktop, clicks to scroll to top */}
      <button
        onClick={handleScrollToTop}
        className="hidden sm:inline truncate text-xl max-w-[200px] md:max-w-[300px] hover:text-[var(--color-accent)] transition-colors duration-200"
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 400,
          fontStyle: 'italic',
          color: 'var(--color-text-primary)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
        title="Scroll to top"
      >
        {title || 'Untitled'}
      </button>
    </div>
  );

  // Center content: Mobile note title only (clicks to scroll to top)
  const centerContent = (
    <button
      onClick={handleScrollToTop}
      className="sm:hidden flex items-center min-w-0"
      style={{ background: 'none', border: 'none', cursor: 'pointer' }}
    >
      <span
        className="truncate text-sm font-medium"
        style={{
          fontFamily: 'var(--font-body)',
          color: 'var(--color-text-primary)',
        }}
      >
        {title || 'Untitled'}
      </span>
    </button>
  );

  // Right actions: Save status + Export button + Delete button
  const rightActions = (
    <div className="flex items-center gap-2">
      {/* Save/Copy Status Indicator */}
      {saveStatus !== 'idle' && (
        <span
          data-save-status={saveStatus}
          className={`
            shrink-0 text-xs px-2 py-1 rounded-full flex items-center gap-1.5
            transition-opacity duration-300
            ${saveStatus === 'saved' || saveStatus === 'copied' ? 'opacity-80' : 'opacity-100'}
          `}
          style={{
            fontFamily: 'var(--font-body)',
            ...getSaveStatusStyle(saveStatus),
          }}
        >
          {saveStatus === 'saving' && (
            <>
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ background: 'var(--color-accent)' }}
              />
              Saving...
            </>
          )}
          {saveStatus === 'error' && (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Save failed
            </>
          )}
          {saveStatus === 'copied' && (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Copied
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </>
          )}
          {saveStatus === 'synced' && (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12.5l2 2 4-4" />
              </svg>
              Synced
            </>
          )}
        </span>
      )}

      {/* Export button with dropdown */}
      <div className="relative" ref={exportMenuRef}>
        <button
          onClick={() => setShowExportMenu(!showExportMenu)}
          className="
            w-9 h-9
            rounded-full
            flex items-center justify-center
            transition-all duration-200
            focus:outline-none
            focus:ring-2
            focus:ring-[var(--color-accent)]
          "
          style={{
            color: showExportMenu ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
            background: showExportMenu ? 'var(--color-accent-glow)' : 'transparent',
          }}
          onMouseEnter={(e) => {
            if (!showExportMenu) {
              e.currentTarget.style.color = 'var(--color-accent)';
              e.currentTarget.style.background = 'var(--color-accent-glow)';
            }
          }}
          onMouseLeave={(e) => {
            if (!showExportMenu) {
              e.currentTarget.style.color = 'var(--color-text-tertiary)';
              e.currentTarget.style.background = 'transparent';
            }
          }}
          aria-label="Export note"
          title="Export note"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        </button>

        {/* Export dropdown menu */}
        {showExportMenu && (
          <div
            className="absolute right-0 mt-2 py-1 rounded-lg shadow-lg z-50 min-w-[180px]"
            style={{
              background: 'var(--color-bg-primary)',
              border: '1px solid var(--glass-border)',
            }}
          >
            {/* Copy options */}
            <button
              onClick={handleCopyPlainText}
              className="w-full px-4 py-2 text-left text-sm flex items-center gap-3 transition-colors duration-150"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-primary)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-bg-secondary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <svg className="w-4 h-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              Copy as text
            </button>
            <button
              onClick={handleCopyWithFormatting}
              className="w-full px-4 py-2 text-left text-sm flex items-center gap-3 transition-colors duration-150"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-primary)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-bg-secondary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <svg className="w-4 h-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Copy with formatting
            </button>

            {/* Share option - hidden in demo mode and when E2EE is active */}
            {sharingEnabled && !isDemo && (
              <>
                {/* Divider */}
                <div
                  className="my-1 mx-3"
                  style={{ borderTop: '1px solid var(--glass-border)' }}
                />

                <button
                  onClick={async () => {
                    setShowExportMenu(false);
                    // Flush any unsaved edits so ShareModal encrypts the latest content
                    if (autoSaveTimeoutRef.current) {
                      clearTimeout(autoSaveTimeoutRef.current);
                      autoSaveTimeoutRef.current = null;
                    }
                    await performSave();
                    setShowShareModal(true);
                  }}
                  className="w-full px-4 py-2 text-left text-sm flex items-center gap-3 transition-colors duration-150"
                  style={{
                    fontFamily: 'var(--font-body)',
                    color: 'var(--color-text-primary)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--color-bg-secondary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <svg className="w-4 h-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share as Letter
                </button>
              </>
            )}

            {/* Divider */}
            <div
              className="my-1 mx-3"
              style={{ borderTop: '1px solid var(--glass-border)' }}
            />

            {/* Export options */}
            <button
              onClick={handleExportMarkdown}
              className="w-full px-4 py-2 text-left text-sm flex items-center gap-3 transition-colors duration-150"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-primary)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-bg-secondary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <svg className="w-4 h-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download (.md)
            </button>
            <button
              onClick={handleExportJSON}
              className="w-full px-4 py-2 text-left text-sm flex items-center gap-3 transition-colors duration-150"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-primary)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-bg-secondary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <svg className="w-4 h-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download (.json)
            </button>
          </div>
        )}
      </div>

      {/* Delete button */}
      <button
        onClick={handleDelete}
        className="
          w-9 h-9
          rounded-full
          flex items-center justify-center
          transition-all duration-200
          focus:outline-none
          focus:ring-2
          focus:ring-[var(--color-accent)]
        "
        style={{ color: 'var(--color-text-tertiary)' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--color-destructive)';
          e.currentTarget.style.background = 'var(--color-error-light)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--color-text-tertiary)';
          e.currentTarget.style.background = 'transparent';
        }}
        aria-label="Delete note"
        title="Delete note"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );

  return (
    <div
      ref={scrollContainerRef}
      className={`h-screen overflow-y-auto ${isFocusMode ? 'focus-mode-active' : ''}`}
      style={{ background: 'var(--color-bg-primary)' }}
      data-testid="note-editor"
    >
      {/* Sticky Zone: Header only */}
      <div
        className="editor-sticky-zone focus-mode-target"
        style={{ background: 'var(--color-bg-primary)' }}
      >
        <HeaderShell
          theme={theme}
          onThemeToggle={onThemeToggle}
          leftContent={leftContent}
          center={centerContent}
          rightActions={rightActions}
          onSettingsClick={onSettingsClick}
        />
      </div>

      {/* Resume chip - shown when reopening a note with saved scroll position */}
      {showResumeChip && (
        <div className="flex justify-center py-2 focus-mode-target">
          <button
            onClick={handleResumeScroll}
            aria-label="Resume editing at your last position"
            className="
              flex items-center gap-2
              px-4 py-2
              text-xs
              rounded-full
              transition-all duration-300
              hover:scale-105
              active:scale-95
              animate-fade-in
            "
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--color-accent)',
              background: 'var(--color-accent-glow)',
              border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)',
            }}
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
            Resume where you left off
          </button>
        </div>
      )}

      {/* Remote update banner (2B) — shown when another device updates this note
           while the editor has unsaved local changes */}
      {remoteUpdate && (
        <div
          className="max-w-[900px] mx-auto px-4 sm:px-10"
          role="alert"
        >
          <div
            className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg animate-fade-in"
            style={{
              background: 'var(--color-accent-glow)',
              border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)',
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <svg
                className="w-4 h-4 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ color: 'var(--color-accent)' }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                />
              </svg>
              <span
                className="text-sm truncate"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-primary)',
                }}
              >
                Updated on another device
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleKeepMine}
                className="text-xs px-3 py-1.5 rounded-md transition-colors duration-200"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-secondary)',
                  background: 'transparent',
                  border: '1px solid var(--glass-border)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-text-secondary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--glass-border)';
                }}
              >
                Keep mine
              </button>
              <button
                onClick={handleLoadRemoteChanges}
                className="text-xs px-3 py-1.5 rounded-md transition-colors duration-200"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-cta-text)',
                  background: 'var(--color-cta-bg)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.85';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                Load changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editor Content */}
      <main onTouchStart={handleTouchStart} onTouchEnd={handleTapEnd}>
        <div className="max-w-[900px] mx-auto px-4 sm:px-10 pt-2 pb-12 editor-writing-area">
          {/* Title */}
          <textarea
            ref={titleRef}
            value={title}
            onChange={handleTitleChange}
            onKeyDown={handleTitleKeyDown}
            onBlur={performSave}
            placeholder="Untitled"
            className="
              w-full
              font-semibold
              bg-transparent
              outline-none
              resize-none
              overflow-hidden
              leading-tight
              mb-2
            "
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '2.25rem',
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.02em',
              caretColor: 'var(--color-accent)',
            }}
            rows={1}
          />

          {/* Timestamps */}
          <div
            className="text-xs mb-1 focus-mode-target"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--color-text-tertiary)',
            }}
          >
            Created {formatShortDate(note.createdAt)} · Edited {formatRelativeTime(note.updatedAt)}
          </div>

          {/* Tag Selector */}
          <div className="mb-1 focus-mode-target">
            <TagSelector
              tags={tags}
              selectedTagIds={note.tags.map((t) => t.id)}
              onToggleTag={(tagId) => onToggleTag(note.id, tagId)}
              onCreateTag={onCreateTag}
            />
          </div>

          {/* Toolbar - desktop: flows after tags, sticky on scroll */}
          {!isMobile && (
            <div className="editor-toolbar-sticky focus-mode-target">
              <EditorToolbar editor={editor} onToggleFocusMode={handleToggleFocusMode} />
            </div>
          )}

          {/* Rich Text Content */}
          <RichTextEditor
            content={content}
            onChange={handleContentChange}
            onBlur={performSave}
            noteId={note.id}
            autoFocus={hasContent}
            onEditorReady={setEditor}
          />

        </div>

        {/* Organic Footer - sits below the elevated page surface */}
        <footer
          className="max-w-[900px] mx-auto mt-16 mb-8 flex flex-col items-center gap-4 focus-mode-target"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          {/* Decorative dots - like end of a letter */}
          <div className="flex gap-2 opacity-40">
            <span className="w-1 h-1 rounded-full bg-current" />
            <span className="w-1 h-1 rounded-full bg-current" />
            <span className="w-1 h-1 rounded-full bg-current" />
          </div>

          {/* Return link - larger touch target on mobile */}
          <button
            onClick={handleLogoClick}
            className="
              flex items-center gap-2
              px-4 py-3
              min-h-[44px]
              text-sm
              transition-colors duration-300
              hover:text-[var(--color-accent)]
              active:text-[var(--color-accent)]
            "
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--color-text-tertiary)',
            }}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Return to notes
          </button>

          {/* Keyboard hint - desktop only */}
          <span
            className="hidden sm:block text-xs opacity-50"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Press <kbd className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--color-bg-secondary)]">Esc</kbd> to save & exit
          </span>
        </footer>
      </main>

      {/* Mobile: Bottom toolbar — fixed at thumb zone */}
      {isMobile && !isFocusMode && (
        <div className="editor-toolbar-bottom">
          <EditorToolbar editor={editor} variant="bottom" onToggleFocusMode={handleToggleFocusMode} />
        </div>
      )}

      {/* Floating scroll-to-top button — hidden in focus mode */}
      {!isFocusMode && <WhisperBack scrollContainerRef={scrollContainerRef} />}

      {/* Focus Mode indicator pill + screen reader announcement */}
      <div role="status" aria-live="polite" className="sr-only">
        {isFocusMode ? 'Focus mode on' : 'Focus mode off'}
      </div>
      {isFocusMode && (
        <button
          onClick={() => setIsFocusMode(false)}
          className="focus-mode-indicator"
          aria-label="Exit focus mode"
          title={isMobile ? 'Exit focus mode (tap)' : 'Exit focus mode (Esc)'}
        >
          <span className="focus-mode-indicator-dot" />
          {isMobile ? 'Focus · tap to exit' : 'Focus · Esc'}
        </button>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            className="
              w-[400px]
              p-8
              shadow-2xl
            "
            style={{
              background: 'var(--color-bg-secondary)',
              borderRadius: 'var(--radius-card)',
              border: '1px solid var(--glass-border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="delete-dialog-title"
              className="text-xl font-semibold mb-3"
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--color-text-primary)',
              }}
            >
              Delete this note?
            </h3>
            <p
              className="mb-8"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-secondary)',
                fontSize: '0.95rem',
                lineHeight: 1.6,
              }}
            >
              This action cannot be undone. The note will be permanently removed from your library.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="
                  px-5 py-2.5
                  rounded-lg
                  text-sm font-medium
                  transition-all duration-200
                "
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-secondary)',
                  background: 'transparent',
                  border: '1px solid var(--glass-border)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-text-secondary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--glass-border)';
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="
                  px-5 py-2.5
                  rounded-lg
                  text-sm font-medium
                  transition-all duration-200
                "
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-destructive-text)',
                  background: 'var(--color-destructive)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.85';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal - only rendered in authenticated mode when sharing is enabled */}
      {sharingEnabled && !isDemo && (
        <ShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          note={note}
          userId={userId}
        />
      )}
    </div>
  );
}
