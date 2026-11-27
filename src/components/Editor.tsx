import { VaultLockedSaveError } from '../utils/saveErrors';
import type { OpenDraftState } from '../hooks/useReleasedDraft';
import { useMenuButton } from '../hooks/useMenuButton';
import type { DerivedKeys } from '../lib/encryption';
import { keepReleasedDraft } from '../utils/keepReleasedDraft';
import { replaceContentWithFreshHistory } from '../utils/editorHistory';
import toast from 'react-hot-toast';
import { MAX_NOTE_TITLE_LENGTH } from '../utils/validation';
import { heldSaves } from '../stores/heldSaves';
import { noteSaveQueue } from '../stores/noteSaveQueue';
import { useState, useEffect, useLayoutEffect, useEffectEvent, useRef, useCallback } from 'react';
import type { Editor as TiptapEditor } from '@tiptap/react';
import { getSaveLabel } from '../utils/saveStatus';
import { SyncStateIcon, type SyncStateKind } from './SyncStateIcon';
import type { Note, NoteDeleteHandler, Tag, Theme } from '../types';
import { LinkPopover } from './LinkPopover';
import { RichTextEditor } from './RichTextEditor';
import { EditorToolbar } from './EditorToolbar';
import { EditorSidebar } from './EditorSidebar';
import { EditorMetrics } from './EditorMetrics';
import { FindReplacePanel } from './FindReplacePanel';
import { TagSelector } from './TagSelector';
import { ShareModal } from './ShareModal';
import { formatShortDate, formatRelativeTime } from '../utils/formatTime';
import { HeaderShell } from './HeaderShell';
import { Logo } from './Logo';
import { WhisperBack } from './WhisperBack';
import { ModalBackdropButton } from './ModalBackdropButton';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap';
import { useMobileDetect } from '../hooks/useMobileDetect';
import { useKeyboardHeightCssVariable } from '../hooks/useKeyboardHeight';
import {
  exportNoteToMarkdown,
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
const HEADER_TITLE_MIN_WIDTH_PX = 640; // Narrower than this, the header has no room for a title
const OVERLAY_GUARD_SELECTOR =
  '[aria-expanded="true"], [role="dialog"], dialog[open], [role="menu"], [data-editor-popover]';

// E2EE sharing re-enabled: shares are encrypted client-side with per-share random keys.
// The decryption key lives in the URL fragment and never reaches the server.
const sharingEnabled = true;

interface EditorProps {
  note: Note;
  tags: Tag[];
  userId: string;
  onBack: () => void;
  onRequestSearch: () => void;
  onUpdate: (note: Note) => Promise<void>;
  onDelete: NoteDeleteHandler;
  onToggleTag: (noteId: string, tagId: string) => void;
  onCreateTag?: () => void;
  theme: Theme;
  onThemeToggle: () => void;
  onSettingsClick: () => void;
  isDemo?: boolean; // Hide share functionality in demo mode
  noteSyncStatus?: 'synced' | 'pending' | 'conflict'; // Note-specific sync status (3A)
  /**
   * The note was released on another device while this screen held unsaved words
   * (issue #205). Saving stops; the writer chooses to keep, copy, or let go.
   */
  releasedElsewhere?: boolean;
  /** The released draft was kept as this new note; the app adds it and opens it. */
  onKeptReleasedDraft?: (note: Note) => void;
  /**
   * "Load changes" replaced the writer's unsaved words with another device's. They
   * were kept as this new note first (issue #284); the app adds it to the list.
   */
  onKeptReplacedDraft?: (note: Note) => void;
  /** Vault keys, for writing a released draft into a new note. */
  vaultKeys?: DerivedKeys | null;
  /** The writer chose to let the words of a released note go. Defaults to onBack. */
  onLetGoReleasedDraft?: () => void;
  /** Reports whether this screen holds words the stored note does not. */
  onDraftStateChange?: (state: OpenDraftState | null) => void;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'copied';

interface NoteSnapshot {
  title: string;
  content: string;
  tagSignature: string;
}

function buildTagSignature(tags: Tag[]): string {
  return tags
    .map((tag) => tag.id)
    .sort()
    .join('|');
}

function buildSnapshot(title: string, content: string, tags: Tag[]): NoteSnapshot {
  return {
    title,
    content,
    tagSignature: buildTagSignature(tags),
  };
}

function sameSnapshot(a: NoteSnapshot | null, b: NoteSnapshot | null): boolean {
  return (
    a !== null &&
    b !== null &&
    a.title === b.title &&
    a.content === b.content &&
    a.tagSignature === b.tagSignature
  );
}

function sameTitleAndContent(a: NoteSnapshot | null, b: NoteSnapshot | null): boolean {
  return a !== null && b !== null && a.title === b.title && a.content === b.content;
}

// An empty note: no title and no body beyond empty paragraphs. A body with an image
// or a divider is not blank.
function isBlank(title: string, content: string): boolean {
  return title.trim() === '' && /^(?:\s|<p>(?:\s|<br\s*\/?>)*<\/p>)*$/.test(content);
}

// Names each Editor instance, so a held save belongs to the instance that held it.
let editorInstanceCount = 0;

// The save pill is neutral roman text; the icon tells the states apart.
const SAVE_LABEL_ICON: Record<ReturnType<typeof getSaveLabel>, SyncStateKind> = {
  'Not saved': 'not-saved',
  'Saved here': 'saved',
  Synced: 'synced',
};

/**
 * One instance per note: `NoteEditorView` keys it by `note.id` (issue #288), so a
 * switch is an unmount and a mount and every ref here belongs to one note. On unmount
 * the Editor saves what it had on screen under its own note's id.
 */
export function Editor({ note, tags, userId, onBack, onRequestSearch, onUpdate, onDelete, onToggleTag, onCreateTag, theme, onThemeToggle, onSettingsClick, isDemo = false, noteSyncStatus, releasedElsewhere = false, onKeptReleasedDraft, onKeptReplacedDraft, vaultKeys = null, onLetGoReleasedDraft, onDraftStateChange }: EditorProps) {
  // Words for this note still waiting to be written by an Editor the writer left
  // (issue #288). They are newer than the list's copy, so this Editor starts from them.
  const [startingDraft] = useState(() => noteSaveQueue.pendingDraft(note.id));
  const [title, setTitle] = useState(startingDraft?.title ?? note.title);
  const [content, setContent] = useState(startingDraft?.content ?? note.content);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const keepWritingButtonRef = useRef<HTMLButtonElement>(null);
  const deleteDialogRef = useModalFocusTrap({
    isOpen: showDeleteConfirm,
    onClose: () => setShowDeleteConfirm(false),
    initialFocusRef: keepWritingButtonRef,
  });
  const [hasSaveError, setHasSaveError] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [saveErrorDetail, setSaveErrorDetail] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [keepFailed, setKeepFailed] = useState(false);
  const [isKeeping, setIsKeeping] = useState(false);
  // Set while Keep as new note is writing, so a second click does nothing.
  const keepingFromNoteIdRef = useRef<string | null>(null);
  // The new note Keep wrote, and the words it wrote. The route then moves to it, which
  // unmounts this Editor; anything typed during the write is saved into it on the way.
  const keptRef = useRef<{ note: Note; title: string; content: string } | null>(null);
  // Each release starts a fresh episode, without the last one's warnings or an
  // open delete dialog for a note that is no longer there.
  const [prevReleased, setPrevReleased] = useState(releasedElsewhere);
  if (prevReleased !== releasedElsewhere) {
    setPrevReleased(releasedElsewhere);
    setKeepFailed(false);
    setCopyFailed(false);
    if (releasedElsewhere) setShowDeleteConfirm(false);
  }
  const [editor, setEditor] = useState<TiptapEditor | null>(null);
  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      editor?.commands.focus('start');
    }
  };
  const [showLinkPopover, setShowLinkPopover] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const closeLinkPopover = useCallback(() => setShowLinkPopover(false), []);
  const openLinkPopover = useCallback(() => {
    editor?.chain().extendMarkRange('link').run();
    setShowLinkPopover(true);
  }, [editor]);
  const openFindReplace = useCallback(() => setShowFindReplace(true), []);
  useEffect(() => {
    const requestAction = (event: Event) => {
      if (event.target !== editor?.view?.dom) return;
      const action = (event as CustomEvent<{ action?: string }>).detail?.action;
      if (action === 'link') openLinkPopover();
      if (action === 'findReplace') openFindReplace();
      if (action === 'focusMode') setIsFocusMode((active) => !active);
    };
    document.addEventListener('yidhan:editor-action', requestAction);
    return () => document.removeEventListener('yidhan:editor-action', requestAction);
  }, [editor, openFindReplace, openLinkPopover]);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showResumeChip, setShowResumeChip] = useState(false);
  const savedScrollPositionRef = useRef<number | null>(null);
  const isMobile = useMobileDetect();
  useKeyboardHeightCssVariable(); // Sets --keyboard-height for bottom toolbar positioning, without re-rendering the editor
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const { triggerProps: exportTriggerProps, menuProps: exportMenuProps } = useMenuButton({
    menuId: 'editor-export-menu',
    isOpen: showExportMenu,
    setOpen: setShowExportMenu,
  });
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomToolbarRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const headerTitleRef = useRef<HTMLSpanElement>(null);
  const stickyZoneRef = useRef<HTMLDivElement>(null);
  const tapCountRef = useRef(0);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const throttledScrollSaveRef = useRef<ThrottledSave | null>(null);
  const flushPendingScrollSave = useCallback(() => {
    throttledScrollSaveRef.current?.flush();
  }, []);
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
  const pendingEditorContentRef = useRef<string | null>(null);
  // Track in-flight save promise to await on navigation
  const inFlightSaveRef = useRef<Promise<boolean> | null>(null);
  const [instanceKey] = useState(() => `editor-${++editorInstanceCount}`);
  // False once this Editor has unmounted: its saves then report to the held store.
  const mountedRef = useRef(false);
  // Set when the writer deleted the note here, so leaving does not save it.
  const deletedRef = useRef(false);
  // Set when the writer chose Let go on a note released elsewhere.
  const letGoRef = useRef(false);
  // The last committed draft and props, for saves that run after unmount. Written in
  // a layout effect below, never during render.
  const draftRef = useRef({ title, content });
  const releasedRef = useRef(releasedElsewhere);
  const onUpdateRef = useRef(onUpdate);
  const prevSyncStatusRef = useRef(noteSyncStatus);
  const shouldStartSyncedStatusTimerRef = useRef(false);

  // Remote update tracking (2B): detect when the note prop changes from
  // another device's sync, distinguish from our own save echoing back
  const committedSnapshotRef = useRef<NoteSnapshot | null>(null);
  if (committedSnapshotRef.current === null) {
    committedSnapshotRef.current = buildSnapshot(note.title, note.content, note.tags);
  }
  const inFlightSnapshotRef = useRef<NoteSnapshot | null>(null);
  const [remoteUpdate, setRemoteUpdate] = useState<NoteSnapshot | null>(null);
  // Track the last dismissed remote version so the detection effect
  // doesn't re-show the banner after the next sync rehydration
  const dismissedRemoteRef = useRef<NoteSnapshot | null>(null);

  // Detect remote updates to the currently open note (2B)
  // When the note prop changes (from sync rehydration) while the same note is open:
  // - Self-echo: incoming matches what we last saved → ignore
  // - Clean editor: no unsaved changes → silently update local state
  // - Dirty editor: user has unsaved changes → show "Updated on another device" banner
  {
    const incomingSnapshot = buildSnapshot(note.title, note.content, note.tags);
    const committedSnapshot = committedSnapshotRef.current;
    const activeInFlightSnapshot = inFlightSnapshotRef.current;

    const titleOrContentChangedAgainstCommitted =
      !sameTitleAndContent(incomingSnapshot, committedSnapshot);
    const titleOrContentChangedAgainstInFlight =
      activeInFlightSnapshot === null || !sameTitleAndContent(incomingSnapshot, activeInFlightSnapshot);

    if (!titleOrContentChangedAgainstCommitted) {
      if (!sameSnapshot(committedSnapshot, incomingSnapshot)) {
        committedSnapshotRef.current = incomingSnapshot;
      }
    } else if (
      titleOrContentChangedAgainstInFlight &&
      !sameSnapshot(dismissedRemoteRef.current, incomingSnapshot)
    ) {
      const hasUnsavedChanges =
        title !== committedSnapshot.title ||
        content !== committedSnapshot.content;
      // The incoming copy is exactly what is on screen: an earlier Editor's save of
      // these same words landing (issue #288). Nothing differs, so nothing to show.
      const matchesScreen = title === note.title && content === note.content;

      if (matchesScreen) {
        committedSnapshotRef.current = incomingSnapshot;
        if (remoteUpdate !== null) setRemoteUpdate(null);
      } else if (hasUnsavedChanges) {
        if (!sameSnapshot(remoteUpdate, incomingSnapshot)) {
          setRemoteUpdate(incomingSnapshot);
        }
      } else {
        if (title !== note.title) setTitle(note.title);
        if (content !== note.content) {
          setContent(note.content);
          pendingEditorContentRef.current = note.content;
        }
        committedSnapshotRef.current = incomingSnapshot;
        if (remoteUpdate !== null) setRemoteUpdate(null);
      }
    }
  }

  useEffect(() => {
    if (!editor || pendingEditorContentRef.current === null) return;
    // Another device's text: undo must not bring back what it replaced (issue #284).
    replaceContentWithFreshHistory(editor, pendingEditorContentRef.current);
    pendingEditorContentRef.current = null;
  // note.content included so same-note remote updates also trigger this effect (not just note switches)
  }, [editor, note.id, note.content]);

  // null sentinel ensures the block fires on first mount, not just note switches
  const resumeNoteIdRef = useRef<string | null>(null);
  if (resumeNoteIdRef.current !== note.id) {
    resumeNoteIdRef.current = note.id;
    const stored = getEditorPosition(note.id);

    if (stored && stored.scroll > RESUME_SCROLL_THRESHOLD_PX) {
      savedScrollPositionRef.current = stored.scroll;
      setShowResumeChip(true);
      resumeChipShownAtRef.current = Date.now(); // Track when chip was shown
    } else {
      savedScrollPositionRef.current = null;
      setShowResumeChip(false);
      resumeChipShownAtRef.current = 0;
    }
  }

  // Track scroll position (throttled save to localStorage)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const capturedNoteId = note.id;
      const capturedScroll = container.scrollTop;

      // Ignore scroll events from stale handlers during DOM reflow
      // The activeNoteIdRef is updated synchronously during render, before effects cleanup
      // So if note.id (from closure) differs, this is an OLD handler firing after note switch
      if (capturedNoteId !== activeNoteIdRef.current) return;

      // Capture both noteId and scrollTop NOW at scroll time
      // This prevents saving wrong data if note switches before timer fires
      pendingScrollSaveRef.current = {
        noteId: capturedNoteId,
        scroll: capturedScroll,
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
      flushPendingScrollSave();
    };
  }, [note.id, showResumeChip, flushPendingScrollSave]);

  // Update manuscript glow position on scroll — direct DOM mutation, no re-renders
  useEffect(() => {
    const scrollEl = scrollContainerRef.current;
    const glowEl = glowRef.current;
    if (!scrollEl || !glowEl) return;

    const writingArea = glowEl.closest('.editor-writing-area') as HTMLElement | null;

    let ticking = false;
    const handleGlowScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrollTop = scrollEl.scrollTop;
          const areaOffset = writingArea?.offsetTop ?? 0;
          const areaHeight = writingArea?.scrollHeight ?? scrollEl.scrollHeight;
          const viewportCenter = scrollTop + scrollEl.clientHeight * 0.4 - areaOffset;
          const maxTop = areaHeight - 600;
          const top = Math.max(0, Math.min(viewportCenter - 300, maxTop));
          glowEl.style.top = `${top}px`;
          ticking = false;
        });
        ticking = true;
      }
    };

    scrollEl.addEventListener('scroll', handleGlowScroll, { passive: true });
    handleGlowScroll(); // Initial position

    return () => scrollEl.removeEventListener('scroll', handleGlowScroll);
  }, []);

  // Show the header title only once the editable title has scrolled out of view.
  // The header copy is a scroll-to-top button, so it says nothing while the title it
  // scrolls to is on screen — that was the doubled title (ledger item 83). Width is
  // decided here too rather than in a `sm:` class, so there is one answer to "is it
  // showing?" instead of a CSS half and a JS half that can disagree.
  // Same ref-based rAF pattern as the manuscript glow: direct DOM writes, no re-renders.
  useEffect(() => {
    const scrollEl = scrollContainerRef.current;
    const headerTitleEl = headerTitleRef.current;
    if (!scrollEl || !headerTitleEl) return;

    const applyVisibility = () => {
      const titleEl = titleRef.current;
      const writingArea = titleEl?.closest('.editor-writing-area') as HTMLElement | null;
      // Bottom edge of the editable title, in the scroll container's coordinates.
      const titleBottom =
        (writingArea?.offsetTop ?? 0) + (titleEl?.offsetTop ?? 0) + (titleEl?.offsetHeight ?? 0);
      // The sticky header covers the top of the viewport, so the title is gone
      // once its bottom edge passes under the header, not once it passes zero.
      const headerHeight = stickyZoneRef.current?.offsetHeight ?? 0;
      // Before layout every offset reads 0. Treat that as "title still on screen"
      // so the header copy stays hidden rather than flashing in on first paint.
      const scrolledPast = titleBottom > 0 && scrollEl.scrollTop + headerHeight >= titleBottom;
      // A phone header is already logo, save status, delete, theme and avatar. A
      // breadcrumb there would overflow it, and WhisperBack covers scrolling back.
      const hasRoom = window.innerWidth >= HEADER_TITLE_MIN_WIDTH_PX;
      // Focus mode strips the chrome; it must not bring the header title back.
      const show = scrolledPast && hasRoom && !isFocusMode;
      headerTitleEl.style.display = show ? 'inline-flex' : 'none';
    };

    let ticking = false;
    const handleTitleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        applyVisibility();
        ticking = false;
      });
    };

    scrollEl.addEventListener('scroll', handleTitleScroll, { passive: true });
    // Rotating a phone into landscape crosses the width test without scrolling.
    window.addEventListener('resize', handleTitleScroll);
    // The resume chip and the remote-update banner are in flow above the writing
    // area, so showing one moves the editable title down without a scroll or a
    // resize. Left unmeasured, that puts the title back on screen beside a header
    // copy that is still showing — the doubled title again. Watching the scroll
    // container's own children catches both, and anything in flow added later.
    const chromeObserver = new MutationObserver(handleTitleScroll);
    chromeObserver.observe(scrollEl, { childList: true });
    applyVisibility(); // Initial state, and on note switch or focus-mode toggle

    return () => {
      scrollEl.removeEventListener('scroll', handleTitleScroll);
      window.removeEventListener('resize', handleTitleScroll);
      chromeObserver.disconnect();
    };
  }, [isFocusMode, note.id]);

  // Handle resume button click
  const handleResumeScroll = useCallback(() => {
    if (savedScrollPositionRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: savedScrollPositionRef.current,
        behavior: 'smooth',
      });
      setShowResumeChip(false);
    }
  }, []);

  const cancelPendingAutoSave = useCallback(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }
  }, []);

  // Perform the actual save (async with proper status tracking)
  const performSave = useCallback((): Promise<boolean> => heldSaves.trackSave((async (): Promise<boolean> => {
    // A released note has nowhere to save to: writing would edit a note another
    // device let go, or one that no longer exists. Report "not saved" so Back and
    // Escape keep the writer here; the released banner offers the ways out.
    if (releasedElsewhere) return false;

    // The vault session this save belongs to. If the vault locks or the user changes
    // while it waits, it must not write, or hold its words, in the next session.
    const fromSession = heldSaves.session();
    const draftSnapshot = buildSnapshot(title, content, note.tags);

    // Nothing to write means nothing is unsaved, so any banner left by an
    // earlier failure is now untrue. Without this, reverting a draft back to
    // the last committed text and then pressing Retry took this path and left
    // the "Not saved" banner on screen with no way to dismiss it.
    const nothingToSave = (): boolean => {
      setHasSaveError(false);
      setSaveErrorDetail('');
      setCopyFailed(false);
      return true;
    };

    if (sameTitleAndContent(draftSnapshot, committedSnapshotRef.current)) {
      return nothingToSave();
    }

    // These words are not on disk yet. A new Editor for this note, opened while they
    // wait or are written, starts from them rather than from older text.
    const pendingDraft = { title: draftSnapshot.title, content: draftSnapshot.content };
    noteSaveQueue.setPendingDraft(note.id, pendingDraft);
    try {
      // Wait until no save for this note is running. A loop, not one wait: another
      // waiter (the debounce, the leave save) may start the next save first, and then
      // this one may have nothing left to write.
      let pending = inFlightSaveRef.current ?? noteSaveQueue.get(note.id);
      if (pending) {
        while (pending) {
          await pending;
          const next: Promise<boolean> | undefined = inFlightSaveRef.current ?? noteSaveQueue.get(note.id);
          if (next === pending) break;
          pending = next;
        }
        if (sameTitleAndContent(draftSnapshot, committedSnapshotRef.current)) {
          return nothingToSave();
        }
        if (releasedRef.current) return false;
      }
      if (heldSaves.session() !== fromSession) return false;

      // The stored text these words are written over, for a held save's Retry.
      const baseSnapshot = committedSnapshotRef.current;

      if (mountedRef.current) {
        // Clear any existing indicator timeouts
        if (savePhaseTimeoutRef.current) {
          clearTimeout(savePhaseTimeoutRef.current);
        }
        if (hideIndicatorTimeoutRef.current) {
          clearTimeout(hideIndicatorTimeoutRef.current);
        }

        setSaveStatus('saving');
      }
      inFlightSnapshotRef.current = draftSnapshot;

      // Register the save before it starts, so a write that settles at once still
      // leaves no stale entry behind.
      let finishSave!: (saved: boolean) => void;
      const savePromise = new Promise<boolean>((resolve) => { finishSave = resolve; });
      inFlightSaveRef.current = savePromise;
      noteSaveQueue.set(note.id, savePromise);

      // Words this Editor held before this write started. Its success covers them;
      // an entry held later (leaving a released note) holds newer words and stays.
      const heldBefore = heldSaves.get(instanceKey)?.revision;

      let saved = false;
      try {
        await onUpdate({
          ...note,
          title: draftSnapshot.title,
          content: draftSnapshot.content,
          updatedAt: new Date(),
        });
        saved = true;

        committedSnapshotRef.current = draftSnapshot;
        if (sameSnapshot(inFlightSnapshotRef.current, draftSnapshot)) {
          inFlightSnapshotRef.current = null;
        }
        if (heldBefore !== undefined) heldSaves.release(instanceKey, heldBefore);
        if (!mountedRef.current) return true;

        setRemoteUpdate(null);

        // Show success state. A save that worked closes out the whole failure
        // episode, so a later, unrelated one starts without this one's
        // clipboard warning.
        setCopyFailed(false);
        setHasSaveError(false);
        setSaveStatus('saved');

        // Hide indicator after 2 seconds
        hideIndicatorTimeoutRef.current = setTimeout(() => {
          setSaveStatus('idle');
        }, 2000);
        return true;
      } catch (error) {
        if (sameSnapshot(inFlightSnapshotRef.current, draftSnapshot)) {
          inFlightSnapshotRef.current = null;
        }

        if (!mountedRef.current) {
          // The writer has left this note (issue #288). Hold the words above the
          // Editor so the app can offer Retry and Copy. Not when the vault locked:
          // decrypted text must not outlive it. Not for a note deleted here or kept
          // as a new note: those words already went where the writer chose. Not for a
          // note released elsewhere: leaving it held its newest words already (or the
          // writer chose Let go), and this older save must not replace them.
          const settled = deletedRef.current || keptRef.current !== null || releasedRef.current;
          if (!settled && !(error instanceof VaultLockedSaveError)) {
            heldSaves.hold({
              key: instanceKey,
              noteId: note.id,
              title: draftSnapshot.title,
              content: draftSnapshot.content,
              baseTitle: baseSnapshot?.title ?? note.title,
              baseContent: baseSnapshot?.content ?? note.content,
              attemptedAt: Date.now(),
              detail: '',
            }, fromSession);
          }
          return false;
        }

        setSaveErrorDetail(error instanceof VaultLockedSaveError ? error.message : '');

        // Save failed after retries. The banner carries the message, so the
        // header indicator just stops claiming anything. copyFailed is left
        // alone: a background retry that also failed has not fixed the
        // clipboard, so silently dropping that warning would be a lie.
        setHasSaveError(true);
        setSaveStatus('idle');

        return false;
      } finally {
        // Clear the in-flight refs before waiters resume.
        if (inFlightSaveRef.current === savePromise) {
          inFlightSaveRef.current = null;
        }
        noteSaveQueue.settle(note.id, savePromise);
        finishSave(saved);
      }
    } finally {
      noteSaveQueue.clearPendingDraft(note.id, pendingDraft);
    }
  })()), [title, content, note, onUpdate, releasedElsewhere, instanceKey]);

  // The last committed render's save and draft, for the unmount save. Written in a
  // layout effect, not during render, so a render React discards never lands here.
  const performSaveRef = useRef(performSave);
  useLayoutEffect(() => {
    performSaveRef.current = performSave;
    draftRef.current = { title, content };
    releasedRef.current = releasedElsewhere;
    onUpdateRef.current = onUpdate;
  });

  // Tell the app whether this screen holds words the stored note does not, so a
  // delete from another device does not close the editor over them (issue #205).
  // A save in flight counts: its words are not on disk until it resolves.
  const holdsUnsavedWords =
    hasSaveError || saveStatus === 'saving' || title !== note.title || content !== note.content;
  const holdsUnsavedWordsRef = useRef(holdsUnsavedWords);
  holdsUnsavedWordsRef.current = holdsUnsavedWords;
  useEffect(() => {
    onDraftStateChange?.({ noteId: note.id, unsaved: holdsUnsavedWords });
  }, [onDraftStateChange, note.id, holdsUnsavedWords]);
  const onDraftStateChangeRef = useRef(onDraftStateChange);
  onDraftStateChangeRef.current = onDraftStateChange;
  useEffect(() => () => onDraftStateChangeRef.current?.(null), []);

  const handleKeepReleasedDraft = async () => {
    if (!onKeptReleasedDraft || keepingFromNoteIdRef.current !== null) return;
    keepingFromNoteIdRef.current = note.id;
    setIsKeeping(true);
    setKeepFailed(false);
    try {
      // `note` is the released copy, so the new note carries its pin and tags;
      // `tags` is the live list, so a tag deleted meanwhile is not resurrected.
      const kept = await keepReleasedDraft(userId, vaultKeys, title, content, note, tags);
      keptRef.current = { note: kept, title, content };
      onKeptReleasedDraft(kept);
    } catch (error) {
      console.error('Failed to keep released draft as a new note:', error);
      setKeepFailed(true);
    } finally {
      keepingFromNoteIdRef.current = null;
      setIsKeeping(false);
    }
  };

  // Auto-save when content changes (debounced)
  useEffect(() => {
    // Don't auto-save if nothing changed, or if the note was released elsewhere
    if (releasedElsewhere) return;
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
  }, [title, content, note.title, note.content, performSave, releasedElsewhere]);

  // Leaving the note (issue #288): switch, Back, browser Back, or the note closing.
  // The Editor is keyed by note id, so this is the one path for all of them. It saves
  // this Editor's own last words under its own note's id; a failure is held above the
  // Editor by `performSave`. While mounted, the Editor registers the same flush so a
  // vault lock can save what is on screen first.
  useEffect(() => {
    mountedRef.current = true;
    const unregister = heldSaves.registerFlusher(() => {
      cancelPendingAutoSave();
      return performSaveRef.current();
    });
    return () => {
      mountedRef.current = false;
      unregister();
      cancelPendingAutoSave();
      const { title: lastTitle, content: lastContent } = draftRef.current;

      // Keep as new note wrote the draft into a new note and moved there. Words typed
      // during that write go into the new note, never into the released one.
      const kept = keptRef.current;
      if (kept) {
        if (lastTitle === kept.title && lastContent === kept.content) return;
        const fromSession = heldSaves.session();
        // In the per-note queue and tracked, like every other save: the kept note's new
        // Editor may save too, and a lock waits for this one.
        void heldSaves.trackSave(noteSaveQueue.run(kept.note.id, () => {
          if (heldSaves.session() !== fromSession) throw new VaultLockedSaveError();
          return onUpdateRef.current({ ...kept.note, title: lastTitle, content: lastContent, updatedAt: new Date() });
        }))
          .catch((error: unknown) => {
            console.error('Failed to save words typed during Keep:', error);
            if (error instanceof VaultLockedSaveError) return;
            heldSaves.hold({
              key: instanceKey,
              noteId: kept.note.id,
              title: lastTitle,
              content: lastContent,
              baseTitle: kept.title,
              baseContent: kept.content,
              attemptedAt: Date.now(),
              detail: '',
            }, fromSession);
          });
        return;
      }

      // Deleted here: the writer let these words go.
      if (deletedRef.current) return;
      const committed = committedSnapshotRef.current;
      const { title: storedTitle, content: storedContent } = committed ?? { title: '', content: '' };

      // Released elsewhere: there is no note to save into. Unless the writer chose
      // Let go, words left on screen (browser Back, a route change) are held, and
      // Retry keeps them as a new note.
      if (releasedRef.current) {
        if (letGoRef.current || (lastTitle === storedTitle && lastContent === storedContent)) return;
        heldSaves.hold({
          key: instanceKey,
          noteId: note.id,
          title: lastTitle,
          content: lastContent,
          baseTitle: storedTitle,
          baseContent: storedContent,
          attemptedAt: Date.now(),
          detail: 'This note was released on another device.',
        }, heldSaves.session());
        return;
      }
      // An empty draft never replaces words on the way out. Clearing a note is saved
      // by the debounce while the writer stays on it.
      if (isBlank(lastTitle, lastContent) && committed && !isBlank(committed.title, committed.content)) return;

      void performSaveRef.current();
    };
  }, [cancelPendingAutoSave, instanceKey, note.id]);

  // Bound continuous typing using the same encrypted local-save path as autosave.
  const checkpoint = useEffectEvent(() => { void performSave(); });
  useEffect(() => {
    const timer = setInterval(() => checkpoint(), 10_000);
    return () => clearInterval(timer);
  }, []);

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
        cancelPendingAutoSave();

        // Await any in-flight save before starting a new one
        if (inFlightSaveRef.current) {
          await inFlightSaveRef.current;
        }

        await performSave();
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
  }, [cancelPendingAutoSave, title, content, note.title, note.content, performSave]);

  const handleEditorShortcut = useEffectEvent(async (e: KeyboardEvent) => {
    // Cmd/Ctrl+F: find within the current note, including in focus mode.
    if (e.key.toLowerCase() === 'f' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
      if (!editor) return;
      e.preventDefault();
      if (showFindReplace || document.querySelector(OVERLAY_GUARD_SELECTOR)) return;
      setShowFindReplace(true);
      return;
    }
    // Cmd/Ctrl+Shift+F: toggle focus mode
    if (e.key.toLowerCase() === 'f' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
      e.preventDefault();
      setIsFocusMode((prev) => !prev);
      return;
    }
    // Escape: exit focus mode first, then save and go back
    if (e.key === 'Escape') {
      if (e.defaultPrevented || showLinkPopover || showFindReplace || showExportMenu || showShareModal || showDeleteConfirm ||
        document.querySelector(OVERLAY_GUARD_SELECTOR)) {
        return;
      }
      if (isFocusMode) {
        setIsFocusMode(false);
        return;
      }
      cancelPendingAutoSave();
      // First await any existing in-flight save
      if (inFlightSaveRef.current) {
        await inFlightSaveRef.current;
      }
      // Then trigger a new save if needed and await it
      if (await performSave()) onBack();
    }
    // Cmd/Ctrl+Shift+C: copy note to clipboard
    if (e.key === 'c' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
      e.preventDefault();
      const currentNote = { ...note, title, content };
      void copyNoteToClipboard(currentNote).then(() => {
        showCopiedIndicator();
      });
    }
  });

  const handleSearchShortcut = useEffectEvent(async (e: KeyboardEvent) => {
    const isSearchKey = e.code === 'KeyK' || e.key.toLowerCase() === 'k';
    if (!(e.metaKey || e.ctrlKey) || e.altKey || !isSearchKey) {
      return;
    }

    // Cmd/Ctrl+K is the link shortcut while the cursor is in the note — the near-universal
    // one, and what the toolbar tooltip and `editorCommands` both promise. Anywhere else
    // on this screen it keeps the meaning the shortcuts modal gives it: focus search.
    //
    // The `return` that used to sit on the unfocused branch left the key doing nothing
    // *and* not preventing default, so the browser took Cmd/Ctrl+K to its own address
    // bar — and search became unreachable from the editor except on Cmd/Ctrl+Shift+K,
    // which no help surface named.
    if (!e.shiftKey && editor?.isFocused) {
      e.preventDefault();
      openLinkPopover();
      return;
    }

    e.preventDefault();
    cancelPendingAutoSave();
    if (inFlightSaveRef.current) {
      await inFlightSaveRef.current;
    }
    const didSave = await performSave();
    if (didSave) {
      onRequestSearch();
    }
  });

  // Handle keyboard shortcuts
  useEffect(() => {
    window.addEventListener('keydown', handleEditorShortcut);
    return () => window.removeEventListener('keydown', handleEditorShortcut);
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleSearchShortcut, true);
    return () => document.removeEventListener('keydown', handleSearchShortcut, true);
  }, []);

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

  // Note-specific sync indicator: when this note transitions from 'pending'
  // to 'synced', briefly show the "Saved" status as confirmation.
  // Only fires when the editor is idle to avoid interrupting active save indicators.
  const shouldShowSyncedStatus =
    prevSyncStatusRef.current === 'pending' &&
    noteSyncStatus === 'synced' &&
    saveStatus === 'idle';
  if (prevSyncStatusRef.current !== noteSyncStatus) {
    prevSyncStatusRef.current = noteSyncStatus;
    if (shouldShowSyncedStatus) {
      if (savePhaseTimeoutRef.current) clearTimeout(savePhaseTimeoutRef.current);
      if (hideIndicatorTimeoutRef.current) clearTimeout(hideIndicatorTimeoutRef.current);
      shouldStartSyncedStatusTimerRef.current = true;
      setSaveStatus('saved');
    }
  }

  useEffect(() => {
    if (saveStatus !== 'saved' || !shouldStartSyncedStatusTimerRef.current) return;
    shouldStartSyncedStatusTimerRef.current = false;

    hideIndicatorTimeoutRef.current = setTimeout(() => {
      hideIndicatorTimeoutRef.current = null;
      setSaveStatus('idle');
    }, 2000);

    return () => {
      if (hideIndicatorTimeoutRef.current) {
        clearTimeout(hideIndicatorTimeoutRef.current);
        hideIndicatorTimeoutRef.current = null;
      }
    };
  }, [saveStatus]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTitle(e.target.value);
    // Auto-resize
    if (titleRef.current) {
      const el = titleRef.current;
      el.style.height = 'auto';
      requestAnimationFrame(() => {
        if (el) {
          el.style.height = el.scrollHeight + 'px';
        }
      });
    }
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
  };

  // Remote update banner handlers (2B)
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);
  const loadingRemoteRef = useRef(false);
  const handleLoadRemoteChanges = useCallback(async () => {
    if (!remoteUpdate || loadingRemoteRef.current) return;
    const incoming = remoteUpdate;
    // The banner shows only over unsaved words, and loading replaces them. Undo cannot
    // bring them back (issue #284), so keep them as a new note first. If that fails,
    // nothing is replaced and the banner stays.
    const dropped = { title, content };
    const worthKeeping = !isBlank(dropped.title, dropped.content)
      && !(dropped.title === incoming.title && dropped.content === incoming.content);
    if (worthKeeping) {
      loadingRemoteRef.current = true;
      setIsLoadingRemote(true);
      try {
        const suffix = ' (my version)';
        const copyTitle = dropped.title.slice(0, MAX_NOTE_TITLE_LENGTH - suffix.length).replace(/[\uD800-\uDBFF]$/, '') + suffix;
        const kept = await keepReleasedDraft(userId, vaultKeys, copyTitle, dropped.content, { ...note, pinned: false }, tags, 'Your version was kept as a new note.');
        onKeptReplacedDraft?.(kept);
      } catch (error) {
        console.error('Failed to keep the replaced draft as a new note:', error);
        toast.error('Your version could not be kept, so nothing was replaced.');
        return;
      } finally {
        loadingRemoteRef.current = false;
        if (mountedRef.current) setIsLoadingRemote(false);
      }
      if (!mountedRef.current) return;
      // Words typed while the copy was written are not in it. Leave them on screen;
      // the banner stays for the writer to choose again.
      if (draftRef.current.title !== dropped.title || draftRef.current.content !== dropped.content) return;
    }
    setTitle(incoming.title);
    setContent(incoming.content);
    committedSnapshotRef.current = incoming;
    inFlightSnapshotRef.current = null;
    if (editor) {
      replaceContentWithFreshHistory(editor, incoming.content);
    }
    setRemoteUpdate(null);
  }, [remoteUpdate, editor, title, content, userId, vaultKeys, note, tags, onKeptReplacedDraft]);

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
      const el = titleRef.current;
      const shouldFocus = !hasContent;
      requestAnimationFrame(() => {
        if (el) {
          el.style.height = el.scrollHeight + 'px';
          if (shouldFocus) {
            el.focus();
          }
        }
      });
    }
  }, [note.id, hasContent]);

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    // Deleting wins. Flush the draft first so a restored note carries the last
    // words, but a save that fails must never leave the button looking inert:
    // someone releasing a note is not asking to keep its final edit.
    await performSave();
    // The writer chose to let these words go, so the note leaving the library is
    // not a release to hold the editor open for (issue #205). If the delete fails,
    // the words are still here and still unsaved.
    onDraftStateChange?.({ noteId: note.id, unsaved: false });
    deletedRef.current = true;
    if (!(await onDelete(note.id))) {
      deletedRef.current = false;
      onDraftStateChange?.({ noteId: note.id, unsaved: holdsUnsavedWordsRef.current });
    }
  };

  // Handle logo click: save and go back (awaits any in-flight save)
  const handleLogoClick = async () => {
    cancelPendingAutoSave();
    // First await any existing in-flight save
    if (inFlightSaveRef.current) {
      await inFlightSaveRef.current;
    }
    // Then trigger a new save if needed and await it
    if (await performSave()) onBack();
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
      <Logo onClick={handleLogoClick} className="shrink-0" />

      {/* Separator + note title. The effect above owns `display` — no breakpoint
          class here, or the two would have to agree about when this shows. */}
      <span
        ref={headerTitleRef}
        data-testid="header-note-title"
        className="items-center min-w-0"
        style={{ display: 'none' }}
      >
        <span
          className="mx-2 md:mx-3 text-xl"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          /
        </span>

        {/* Clicks to scroll back to the editable title */}
        <button type="button"
          onClick={handleScrollToTop}
          className="truncate text-xl max-w-[200px] md:max-w-[300px] py-1 hover:text-[var(--color-accent-text)] transition-colors duration-200"
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
      </span>
    </div>
  );

  // Right actions: Save status + Export button + Delete button. Under 400px the gap
  // and the pill's own padding tighten so the save pill clears the wordmark (a 30px
  // logo leaves no room) while the separator before the theme toggle stays.
  const rightActions = (
    <div className="flex items-center gap-2 max-[399px]:gap-1" data-testid="editor-header-actions">
      {/* Save/Copy Status Indicator. The status region is always mounted, so a screen
          reader hears each change; only its contents come and go. sr-only while idle
          takes it out of the row's flex gap. */}
      <span role="status" className={saveStatus === 'idle' ? 'sr-only' : 'shrink-0'}>
      {saveStatus !== 'idle' && (
        <span
          data-save-status={saveStatus}
          className="shrink-0 text-sm px-2 max-[399px]:px-1 py-1 rounded-full flex items-center gap-1.5"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-text-secondary)',
          }}
        >
          {saveStatus === 'saving' && (
            <>
              <SyncStateIcon kind="saving" className="size-3.5 animate-pulse" />
              Saving&hellip;
            </>
          )}
          {saveStatus === 'copied' && (
            <>
              <SyncStateIcon kind="copied" />
              Copied
            </>
          )}
          {saveStatus === 'saved' && (() => {
            const label = getSaveLabel({ localSaved: title === committedSnapshotRef.current?.title && content === committedSnapshotRef.current?.content, synced: noteSyncStatus === 'synced',
              matchesDraft: note.title === title && note.content === content,
              hash: note.contentHash, confirmedHash: note.confirmedContentHash });
            return (
              <>
                <SyncStateIcon kind={SAVE_LABEL_ICON[label]} />
                {label}
              </>
            );
          })()}
        </span>
      )}
      </span>

      {/* Export button with dropdown */}
      <div className="relative" ref={exportMenuRef}>
        <button type="button"
          {...exportTriggerProps}
          onClick={() => setShowExportMenu(!showExportMenu)}
          className="
            size-9
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
          aria-label="Share and export"
          title="Share and export"
        >
          <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        </button>

        {/* Export dropdown menu */}
        {showExportMenu && (
          <div
            {...exportMenuProps}
            aria-label="Share and export"
            className="absolute right-0 mt-2 py-1 rounded-lg shadow-[var(--shadow-lg)] z-50 min-w-[180px]"
            style={{
              background: 'var(--color-bg-primary)',
              border: '1px solid var(--glass-border)',
            }}
          >
            {/* Share option first - hidden in demo mode and when sharing is off */}
            {sharingEnabled && !isDemo && (
              <>
                <button type="button" role="menuitem" tabIndex={-1}
                  onClick={async () => {
                    setShowExportMenu(false);
                    // Flush any unsaved edits so ShareModal encrypts the latest content
                    cancelPendingAutoSave();
                    if (await performSave()) setShowShareModal(true);
                  }}
                  className="w-full px-4 py-2 text-left text-sm flex items-center gap-3 transition-colors duration-150 focus-ring focus-visible:bg-[var(--color-bg-secondary)]"
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
                  <svg className="size-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share as letter
                </button>
                {/* Divider */}
                <div
                  role="separator"
                  className="my-1 mx-3"
                  style={{ borderTop: '1px solid var(--glass-border)' }}
                />
              </>
            )}

            {/* Copy options */}
            <button type="button" role="menuitem" tabIndex={-1}
              onClick={handleCopyPlainText}
              className="w-full px-4 py-2 text-left text-sm flex items-center gap-3 transition-colors duration-150 focus-ring focus-visible:bg-[var(--color-bg-secondary)]"
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
              <svg className="size-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              Copy as text
            </button>
            <button type="button" role="menuitem" tabIndex={-1}
              onClick={handleCopyWithFormatting}
              className="w-full px-4 py-2 text-left text-sm flex items-center gap-3 transition-colors duration-150 focus-ring focus-visible:bg-[var(--color-bg-secondary)]"
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
              <svg className="size-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Copy with formatting
            </button>

            {/* Divider */}
            <div
              role="separator"
              className="my-1 mx-3"
              style={{ borderTop: '1px solid var(--glass-border)' }}
            />

            {/* Export options */}
            <button type="button" role="menuitem" tabIndex={-1}
              onClick={handleExportMarkdown}
              className="w-full px-4 py-2 text-left text-sm flex items-center gap-3 transition-colors duration-150 focus-ring focus-visible:bg-[var(--color-bg-secondary)]"
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
              <svg className="size-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download (.md)
            </button>
          </div>
        )}
      </div>

      {/* Delete button */}
      <button type="button"
        onClick={handleDelete}
        disabled={releasedElsewhere}
        className="
          size-9
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
        <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );

  return (
    <div
      ref={scrollContainerRef}
      className={`h-[100dvh] overflow-y-auto ${isFocusMode ? 'focus-mode-active' : ''}`}
      style={{ background: 'var(--page-background)' }}
      data-testid="note-editor"
    >
      {releasedElsewhere && (
        <div role="alert" data-testid="released-draft-banner" className="fixed bottom-20 left-4 right-4 z-50 mx-auto flex max-w-md flex-wrap items-center gap-3 rounded-[var(--radius-plain)] border border-[var(--color-error)] bg-[var(--color-bg-secondary)] px-4 py-3 text-sm text-[var(--color-text-primary)]">
          <span className="mr-auto basis-full">This note was released on another device. Your words here are not saved.
            {keepFailed && <span className="block">Could not keep them as a new note. Copy them instead.</span>}
            {copyFailed && <span className="block">Could not copy — select the text and copy it by hand.</span>}</span>
          <button type="button" onClick={() => { void handleKeepReleasedDraft(); }} disabled={isKeeping}
            className="rounded-[var(--radius-button)] px-3 py-1.5 text-sm font-medium transition-all duration-200"
            style={{ fontFamily: 'var(--font-body)', background: 'var(--color-cta-bg)', color: 'var(--color-cta-text)' }}>Keep as new note</button>
          <button type="button" onClick={async () => {
            try {
              await copyNoteToClipboard({ ...note, title, content });
              setCopyFailed(false);
              showCopiedIndicator();
            } catch { setCopyFailed(true); }
          }}
            className="rounded-[var(--radius-button)] border px-3 py-1.5 text-sm font-medium transition-all duration-200"
            style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-secondary)', background: 'transparent', borderColor: 'var(--glass-border)' }}>Copy</button>
          <button type="button" onClick={() => { letGoRef.current = true; (onLetGoReleasedDraft ?? onBack)(); }}
            className="rounded-[var(--radius-button)] px-3 py-1.5 text-sm font-medium transition-all duration-200"
            style={{ fontFamily: 'var(--font-body)', color: 'var(--color-destructive-text)', background: 'var(--color-destructive)' }}>Let go</button>
        </div>
      )}
      {hasSaveError && !releasedElsewhere && (
        <div role="alert" className="fixed bottom-20 left-4 right-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-[var(--radius-plain)] border border-[var(--color-error)] bg-[var(--color-bg-secondary)] px-4 py-3 text-sm text-[var(--color-text-primary)]">
          <span className="mr-auto">Not saved{saveErrorDetail && <span className="block">{saveErrorDetail}</span>}
            {copyFailed && <span className="block">Could not copy — select the text and copy it by hand.</span>}</span>
          <button type="button" onClick={() => { setCopyFailed(false); void performSave(); }}
            className="rounded-[var(--radius-button)] px-3 py-1.5 text-sm font-medium transition-all duration-200"
            style={{ fontFamily: 'var(--font-body)', background: 'var(--color-cta-bg)', color: 'var(--color-cta-text)' }}>Retry</button>
          <button type="button" onClick={async () => {
            try {
              await copyNoteToClipboard({ ...note, title, content });
              setCopyFailed(false);
              setHasSaveError(false);
              showCopiedIndicator();
            } catch { setCopyFailed(true); }
          }}
            className="rounded-[var(--radius-button)] border px-3 py-1.5 text-sm font-medium transition-all duration-200"
            style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-secondary)', background: 'transparent', borderColor: 'var(--glass-border)' }}>Copy</button>
        </div>
      )}
      {/* Sticky Zone: Header only */}
      <div
        ref={stickyZoneRef}
        className="editor-sticky-zone focus-mode-target"
        style={{ background: 'var(--page-background)' }}
      >
        <HeaderShell
          theme={theme}
          onThemeToggle={onThemeToggle}
          leftContent={leftContent}
          rightActions={rightActions}
          // Settings is where a locked vault gets unlocked, so it must not be
          // gated on a save that fails because the vault is locked. The header
          // only surfaces it for an authenticated user, which the editor does
          // not pass today, so this is a latent trap rather than a live one.
          onSettingsClick={async () => { await performSave(); onSettingsClick(); }}
        />
      </div>

      {showFindReplace && editor && (
        <FindReplacePanel editor={editor} onClose={() => setShowFindReplace(false)} />
      )}

      {/* Resume chip - shown when reopening a note with saved scroll position */}
      {showResumeChip && (
        <div className="flex justify-center py-2 focus-mode-target">
          <button type="button"
            onClick={handleResumeScroll}
            aria-label="Resume editing at your last position"
            className="
              flex items-center gap-2
              px-4 py-2
              text-xs
              rounded-[var(--radius-button)]
              transition-all duration-300
              active:scale-95
              animate-fade-in
            "
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--color-accent-text)',
              background: 'var(--color-accent-glow)',
              border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)',
            }}
          >
            <svg
              className="size-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
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
                className="size-4 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ color: 'var(--color-accent)' }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
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
              <button type="button"
                onClick={handleKeepMine}
                className="text-xs px-3 py-1.5 rounded-[var(--radius-button)] transition-colors duration-200"
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
              <button type="button"
                onClick={() => { void handleLoadRemoteChanges(); }}
                disabled={isLoadingRemote}
                className="text-xs px-3 py-1.5 rounded-[var(--radius-button)] transition-colors duration-200"
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

      {/* Vertical sidebar — desktop only; CSS hides below 1100px where inline toolbar shows instead */}
      {!isMobile && (
        <EditorSidebar
          editor={editor}
          isFocusMode={isFocusMode}
          onFindReplace={openFindReplace}
          onToggleFocusMode={handleToggleFocusMode}
          onLink={openLinkPopover}
        />
      )}

      {/* Editor Content */}
      <main id="main-content" onTouchStart={handleTouchStart} onTouchEnd={handleTapEnd}>
        <div className="max-w-[900px] mx-auto px-4 sm:px-10 pt-2 pb-12 editor-writing-area">
          {/* Viewport-following manuscript glow — position updated via ref, not state */}
          <div
            ref={glowRef}
            className="editor-manuscript-glow"
            aria-hidden="true"
          />

          {isDemo && (
            <p
              className="mb-2 text-xs focus-mode-target"
              data-testid="demo-editor-notice"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-tertiary)',
              }}
            >
              Demo · saved in this browser · not encrypted
            </p>
          )}

          {/* Title Zone */}
          <div className="editor-title-zone">
            {/* Title */}
            <textarea
              ref={titleRef}
              value={title}
              aria-label="Note title"
              onChange={handleTitleChange}
              onKeyDown={handleTitleKeyDown}
              onBlur={performSave}
              placeholder="Untitled"
              className="editor-title w-full font-medium bg-transparent outline-none resize-none overflow-hidden leading-tight"
              style={{
                // The display cut has one weight, 500 (font-medium).
                fontFamily: 'var(--font-title)',
                fontSize: '2.25rem',
                color: 'var(--color-text-primary)',
                letterSpacing: '-0.02em',
                caretColor: 'var(--color-accent)',
              }}
              rows={1}
            />

            {/* Metadata row — tags left, timestamp right */}
            <div className="editor-metadata-row focus-mode-target">
              {/* A released note has no row left to tag. */}
              {!releasedElsewhere && (
                <TagSelector
                  tags={tags}
                  selectedTagIds={note.tags.map((t) => t.id)}
                  onToggleTag={(tagId) => onToggleTag(note.id, tagId)}
                  onCreateTag={onCreateTag}
                  variant="inline"
                />
              )}
              <span className="editor-title-meta-details">
                <EditorMetrics editor={editor} isMobile={isMobile} />
                <span
                  className="editor-timestamps text-xs"
                  style={{
                    fontFamily: 'var(--font-body)',
                    color: 'var(--color-text-tertiary)',
                  }}
                >
                  {formatShortDate(note.createdAt)} · {formatRelativeTime(note.updatedAt)}
                </span>
              </span>
            </div>
          </div>

          {/* Inline toolbar — 768px and up. Where the sidebar renders (pointer devices), CSS hides
              this from 1100px and the sidebar takes over; touch tablets keep it at every width. */}
          <div
            className="editor-toolbar-sticky editor-toolbar-inline focus-mode-target"
            data-has-sidebar={!isMobile || undefined}
          >
            <EditorToolbar
              editor={editor}
              isFocusMode={isFocusMode}
              onFindReplace={openFindReplace}
              onToggleFocusMode={handleToggleFocusMode}
              onLink={openLinkPopover}
            />
          </div>

          {/* Decorative divider — gradient line between title zone and body */}
          <div className="editor-title-divider focus-mode-target" aria-hidden="true" />

          {/* Rich Text Content — generous top margin for breathing room */}
          <div className="mt-8">
            <RichTextEditor
              content={content}
              onChange={handleContentChange}
              onBlur={performSave}
              noteId={note.id}
              autoFocus={hasContent}
              onEditorReady={setEditor}
            />
          </div>

        </div>

        {/* Footer: sits below the page surface */}
        <footer
          className="max-w-[900px] mx-auto mt-16 mb-8 flex flex-col items-center gap-4 focus-mode-target"
          style={{ color: 'var(--color-text-tertiary)' }}
        >

          {/* Return link - larger touch target on mobile */}
          <button type="button"
            onClick={handleLogoClick}
            className="
              flex items-center gap-2
              px-4 py-3
              min-h-[44px]
              text-sm font-medium
              transition-colors duration-300
              hover:text-[var(--color-accent-text)]
              active:text-[var(--color-accent-text)]
            "
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--color-text-tertiary)',
            }}
          >
            <svg
              className="size-4"
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
            className="hidden sm:block text-[13px]"
            style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-tertiary)' }}
          >
            Press <kbd className="px-1.5 py-0.5 rounded text-xs bg-[var(--color-bg-secondary)]">Esc</kbd> to save & exit
          </span>
        </footer>
      </main>

      {/* Mobile: Bottom toolbar — fixed at thumb zone */}
      {!isFocusMode && (
        <div className="editor-toolbar-bottom" ref={bottomToolbarRef}>
          <EditorToolbar
            editor={editor}
            variant="bottom"
            isFocusMode={isFocusMode}
            onFindReplace={openFindReplace}
            onToggleFocusMode={handleToggleFocusMode}
            onLink={openLinkPopover}
          />
        </div>
      )}

      {/* Floating scroll-to-top button — hidden in focus mode */}
      {!isFocusMode && <WhisperBack scrollContainerRef={scrollContainerRef} bottomToolbarRef={bottomToolbarRef} />}

      {/* Focus Mode indicator pill + screen reader announcement */}
      <output aria-live="polite" className="sr-only">
        {isFocusMode ? 'Focus mode on' : 'Focus mode off'}
      </output>
      {isFocusMode && (
        <button type="button"
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
      {showLinkPopover && editor && <LinkPopover editor={editor} onClose={closeLinkPopover} />}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop"
        >
          <ModalBackdropButton
            label="Cancel deleting note"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <dialog
            open
            ref={deleteDialogRef}
            tabIndex={-1}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            aria-describedby="delete-dialog-description"
            className="
              relative z-10 w-full max-w-[400px] mx-4
              p-8
              shadow-[var(--shadow-lg)]
              border-0
            "
            style={{
              background: 'var(--color-bg-secondary)',
              borderRadius: 'var(--radius-plain)',
              border: '1px solid var(--glass-border)',
              margin: 0,
            }}
          >
            <h3
              id="delete-dialog-title"
              className="text-xl font-semibold mb-3"
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--color-text-primary)',
              }}
            >
              Let this note fade?
            </h3>
            <p
              id="delete-dialog-description"
              className="mb-8"
              style={{
                fontFamily: 'var(--font-body)',
                color: 'var(--color-text-secondary)',
                fontSize: '0.95rem',
                lineHeight: 1.6,
              }}
            >
              {isDemo
                ? 'This note will be permanently removed from your practice space.'
                : 'It stays in Faded notes for 30 days, then is deleted permanently.'}
            </p>
            <div className="flex gap-3 justify-end">
              <button type="button"
                ref={keepWritingButtonRef}
                onClick={() => setShowDeleteConfirm(false)}
                className="
                  px-5 py-2.5
                  rounded-[var(--radius-button)]
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
                Keep writing
              </button>
              <button type="button"
                onClick={confirmDelete}
                className="
                  px-5 py-2.5
                  rounded-[var(--radius-button)]
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
                Let it fade
              </button>
            </div>
          </dialog>
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
