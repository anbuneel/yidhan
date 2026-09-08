import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { LibraryScreen } from './components/LibraryScreen';
import { FadedNotesScreen } from './components/FadedNotesScreen';
import { NoteEditorView } from './components/NoteEditorView';
import { AppModals } from './components/AppModals';
import { renderEntryScreen } from './components/entryScreens';
import { renderAccountGate } from './components/accountGates';
import { LoadingFallback } from './components/LoadingFallback';
import { LIBRARY_SEARCH_INPUT_ID, scheduleSearchFocus } from './utils/searchFocus';
import { clearScrollMemory, routeToViewMode, useRouter } from './routing';
import { useAuth } from './contexts/AuthContext';
import { useEncryption } from './contexts/EncryptionContext';
import { createEncryptedNote } from './services/encryptedNotes';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { useSchemaGuard } from './hooks/useSchemaGuard';
import { useNotesSync } from './hooks/useNotesSync';
import { useAppTheme } from './hooks/useAppTheme';
import { useAppNavigation } from './hooks/useAppNavigation';
import { useLibrarySearch } from './hooks/useLibrarySearch';
import { useAppShortcuts } from './hooks/useAppShortcuts';
import { useLibraryCardNavigation } from './hooks/useLibraryCardNavigation';
import { useAppLoader } from './hooks/useAppLoader';
import { useEditorChunk } from './hooks/useEditorChunk';
import { useShareRoute } from './hooks/useShareRoute';
import { useVisibleNotes } from './hooks/useVisibleNotes';
import { useLibraryArrangement } from './hooks/useLibraryArrangement';
import { useSessionGuards } from './hooks/useSessionGuards';
import { useImport } from './hooks/useImport';
import { useDemoMigration } from './hooks/useDemoMigration';
import { useShareTargetNote } from './hooks/useShareTargetNote';
import { useNoteActions } from './hooks/useNoteActions';
import { useLockedNotes } from './hooks/useLockedNotes';
import { useFadedNotes } from './hooks/useFadedNotes';
import { useSyncActions } from './hooks/useSyncActions';
import { useTagActions } from './hooks/useTagActions';
import { useViewTransition } from './hooks/useViewTransition';
import { useInstallPrompt } from './hooks/useInstallPrompt';
import { useShareTarget } from './hooks/useShareTarget';
import { migrateLocalStorageKeys } from './utils/legacyStorageKeys';
import './App.css';

// Run before React renders, so a returning user's preferences survive the rebrand.
migrateLocalStorageKeys();

function App() {
  const libraryFooterRef = useRef<HTMLElement>(null);
  const { user, loading: authLoading, isPasswordRecovery, clearPasswordRecovery, isDeparting, daysUntilRelease, isHydrating, signOut } = useAuth();
  const { keys, isEncryptionSetup, isUnlocked, lockVault, persistToLocal } = useEncryption();
  // Ref for encryption keys — used in realtime handlers to avoid stale closures
  // when the vault is locked/unlocked (avoids resubscribing Supabase channels)
  const keysRef = useRef(keys);
  keysRef.current = keys;
  const appLoadingMessage = 'Preparing your space...';

  // Network connectivity monitoring
  useNetworkStatus();

  // The migration level the database is at, read once the reader is signed in. The
  // result starts as `unknown`, which fails open: an offline reader must not be locked
  // out of their own notes because a version check could not reach the server.
  const {
    compatibility: schemaCompatibility,
    isChecking: isCheckingSchema,
    recheck: recheckSchema,
  } = useSchemaGuard(Boolean(user));

  // View transitions for smooth navigation
  const { startTransition } = useViewTransition();

  // The URL is the single source of truth for where the app is. `view`, `isDemo`,
  // `notFound` and `selectedNoteId` are all read off it rather than kept beside it —
  // four states that could disagree with the address bar became one that cannot.
  const { route, navigate, replaceRoute } = useRouter({ allowPlayground: import.meta.env.DEV });
  const view = routeToViewMode(route);
  const isDemo = route.name === 'demo';

  const { navigateToRoute, navigateHome, navigateToDemo, navigateToDemoDraft, publicPageNav } =
    useAppNavigation({ navigate, runInTransition: startTransition });

  // The note the reader currently has open, read inside realtime handlers so the
  // Supabase channel is not re-subscribed every time a note is opened or closed.
  const selectedNoteIdRef = useRef<string | null>(null);

  const {
    notes, setNotes, loading,
    tags, setTags,
    selectedTagIds, setSelectedTagIds,
    fadedNotesCount, refreshFadedNotesCount,
    conflicts, removeConflict, triggerSync, triggerCoalescedSync,
  } = useNotesSync({
    userId: user?.id,
    keys,
    isHydrating,
    openNoteIdRef: selectedNoteIdRef,
    onOpenNoteRemoved: () => replaceRoute({ name: 'library' }),
    // Sign-out drops the scroll offsets remembered for this session's history entries.
    onSignedOut: clearScrollMemory,
  });

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

  const {
    sessionSettings,
    vaultSettings,
    showSessionTimeoutModal,
    sessionMinutesRemaining,
    handleSessionStay,
    handleSessionSignOut,
  } = useSessionGuards({
    userId: user?.id,
    isEncryptionSetup,
    isUnlocked,
    lockVault,
    signOut,
  });

  const showAppLoader = useAppLoader(authLoading || loading);

  const { LoadedEditor, preloadEditorRoute, warmEditorRoute } = useEditorChunk();

  // `/n/<id>` is the note's address, so the open note is read off the route rather
  // than tracked next to it. A refresh reopens the note for free; there is no second
  // copy of "which note is open" to fall out of step with the URL.
  const selectedNoteId = route.name === 'note' ? route.noteId : null;
  selectedNoteIdRef.current = selectedNoteId;
  const { theme, toggleTheme: handleThemeToggle } = useAppTheme();

  // Search filters the visible library
  const {
    searchQuery,
    debouncedSearchQuery,
    isSearching,
    searchFocusToken,
    handleSearchChange,
    requestSearchFocus,
  } = useLibrarySearch();

  // Import state with progress tracking
  const { importProgress, handleExportJSON, handleExportMarkdown, handleImportFile, backupRestore } =
    useImport({ userId: user?.id, keys, notes, tags, setNotes, setTags });

  // Settings modal state
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Offboarding ("Letting Go") modal state
  const [showLettingGoModal, setShowLettingGoModal] = useState(false);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);

  // Keyboard shortcuts modal state
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // Auth modal state (for landing page)
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('signup');

  const { shareRoute, dismissShareRoute } = useShareRoute();

  // Ref for stable delete callback (avoid re-creating handler on every notes change)
  const notesRef = useRef(notes);
  notesRef.current = notes;

  // Redirect from /demo to library when user logs in.
  // Replaced, not pushed: Back from the library should not return to a demo the
  // user has already left behind.
  useEffect(() => {
    if (isDemo && user) {
      replaceRoute({ name: 'library' });
    }
  }, [isDemo, user, replaceRoute]);

  useEffect(() => {
    if (user && isEncryptionSetup && isUnlocked && view === 'library') {
      void preloadEditorRoute();
    }
  }, [user, isEncryptionSetup, isUnlocked, view, preloadEditorRoute]);

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

  useDemoMigration({
    userId: user?.id,
    keys,
    isHydrating,
    setNotes,
    setTags,
    onNoteCreated: (noteId) => navigate({ name: 'note', noteId }),
  });

  useShareTargetNote({
    userId: user?.id,
    keys,
    sharedData,
    clearSharedData,
    setNotes,
    onNoteCreated: (noteId) => navigate({ name: 'note', noteId }),
    onNoteTracked: trackNoteCreated,
    runInTransition: startTransition,
  });

  const displayNotes = useVisibleNotes(notes, selectedTagIds, debouncedSearchQuery);

  const { arrangement, setBasis, setSort } = useLibraryArrangement(user?.id ?? null);

  const selectedNoteRecord = notes.find((n) => n.id === selectedNoteId);
  const selectedNote = selectedNoteRecord?.decryptionFailed ? undefined : selectedNoteRecord;
  // `replaceRoute`, not a push: the reader arrived at `/n/<locked>`, and pushing `/`
  // would leave that address one Back away.
  const { retryLockedNotes } = useLockedNotes({
    openNote: selectedNoteRecord,
    userId: user?.id,
    keys,
    setNotes,
    onLockedNoteOpened: useCallback(() => replaceRoute({ name: 'library' }), [replaceRoute]),
  });

  const handleNoteClick = useCallback((id: string) => {
    void warmEditorRoute().then(() => {
      navigateToRoute({ name: 'note', noteId: id });
    });
  }, [navigateToRoute, warmEditorRoute]);

  // Back from a note is an ordinary navigation, not a history pop: the reader may
  // have arrived at `/n/<id>` directly, in which case there is nothing behind it.
  // The scroll offset is restored either way, because the router files it by history
  // entry rather than by address.
  const handleBack = () => {
    navigateToRoute({ name: 'library' });
  };

  const requestLibrarySearch = useCallback(() => {
    navigateToRoute({ name: 'library' });
    startTransition(() => {
      requestSearchFocus();
    });
    scheduleSearchFocus(LIBRARY_SEARCH_INPUT_ID);
  }, [navigateToRoute, requestSearchFocus, startTransition]);

  const handleNewNote = useCallback(async () => {
    if (!user) return;
    if (!keys) {
      toast.error('Please unlock your vault first');
      return;
    }
    try {
      const newNote = await createEncryptedNote(user.id, '', '', keys);
      trackNoteCreated(); // Track for install prompt engagement
      await warmEditorRoute();
      startTransition(() => {
        setNotes((prev) => [newNote, ...prev]);
        navigate({ name: 'note', noteId: newNote.id });
      });
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  }, [user, keys, navigate, setNotes, startTransition, trackNoteCreated, warmEditorRoute]);

  const { handleNoteUpdate, handleNoteDelete, handleTogglePin } = useNoteActions({
    userId: user?.id,
    keys,
    notes,
    notesRef,
    setNotes,
    refreshFadedNotesCount,
    openNoteIdRef: selectedNoteIdRef,
    onOpenNoteClosed: () => replaceRoute({ name: 'library' }),
    triggerCoalescedSync,
  });

  const { focusedNoteId, handleLibraryCardKeyDown } = useLibraryCardNavigation({
    notes: displayNotes,
    arrangement,
    onOpen: handleNoteClick,
    onTogglePin: handleTogglePin,
    onDelete: handleNoteDelete,
  });

  const {
    fadedNotes,
    fadedNotesLoading,
    handleRestoreNote,
    handlePermanentDelete,
    handleEmptyFadedNotes,
  } = useFadedNotes({
    userId: user?.id,
    keys,
    isViewingFaded: view === 'faded',
    setNotes,
    refreshFadedNotesCount,
  });

  const handleFadedNotesClick = () => {
    if (!user) return;
    if (!keys) {
      toast.error('Please unlock your vault first');
      return;
    }
    navigateToRoute({ name: 'faded' });
  };

  const {
    activeConflict,
    isRetryingBlockedChanges,
    handleConflictResolve,
    handleConflictDismiss,
    handleRefresh,
    handleRetryBlockedChanges,
  } = useSyncActions({
    userId: user?.id,
    keys,
    setNotes,
    setTags,
    conflicts,
    removeConflict,
    triggerSync,
    openNoteIdRef: selectedNoteIdRef,
    onOpenNoteClosed: () => replaceRoute({ name: 'library' }),
  });

  const {
    showTagModal,
    editingTag,
    handleTagToggle,
    handleClearTagFilter,
    handleAddTag,
    handleEditTag,
    handleSaveTag,
    handleDeleteTag,
    handleCloseTagModal,
    handleNoteTagToggle,
  } = useTagActions({
    userId: user?.id,
    notes,
    tags,
    setNotes,
    setTags,
    setSelectedTagIds,
  });

  // Card shortcuts are destructive (Delete fades a note), so they stay off while any
  // dialog is open. The roving-focus target check already rejects most of these, but
  // not every modal moves focus off the card when it opens.
  const isAnyModalOpen =
    showSettingsModal ||
    showLettingGoModal ||
    showWelcomeBack ||
    showShortcutsModal ||
    showAuthModal ||
    showTagModal;

  useAppShortcuts({
    enabled: Boolean(user) && !isAnyModalOpen,
    view,
    onNewNote: () => { void handleNewNote(); },
    onFocusSearch: () => {
      requestSearchFocus();
      scheduleSearchFocus(LIBRARY_SEARCH_INPUT_ID);
    },
    onRequestLibrarySearch: requestLibrarySearch,
    onShowShortcuts: () => setShowShortcutsModal(true),
    onLibraryCardKeyDown: handleLibraryCardKeyDown,
  });

  // Item 29: a note address that no longer resolves. The editor used to `return null`
  // here, which left a blank page and a URL still claiming to point at a note. Wait
  // until the notes have actually loaded and the vault is open before deciding a note
  // is missing — otherwise a refresh would evict the reader from a note that was
  // simply still decrypting.
  // `selectedNoteRecord`, not `selectedNote`: a locked note (item 41) is present but
  // deliberately not opened, and it is not missing. Testing the filtered value would
  // fire this alongside the locked-note redirect above and tell the reader their note
  // is gone when it is sitting on the server, readable elsewhere.
  const missingNoteId =
    route.name === 'note' && user && isUnlocked && !loading && !selectedNoteRecord
      ? route.noteId
      : null;

  useEffect(() => {
    if (!missingNoteId) return;
    replaceRoute({ name: 'library' });
    toast('That note is no longer here.');
  }, [missingNoteId, replaceRoute]);


  // Show loading while checking auth or fetching notes
  if (showAppLoader) {
    return (
      <LoadingFallback message={appLoadingMessage} />
    );
  }

  const entryScreen = renderEntryScreen({
    route,
    theme,
    onThemeToggle: handleThemeToggle,
    isSignedIn: Boolean(user),
    isPasswordRecovery,
    onPasswordResetComplete: clearPasswordRecovery,
    shareRoute,
    onShareInvalid: () => {
      dismissShareRoute();
      replaceRoute({ name: 'library' });
    },
    nav: publicPageNav,
    onDemoClick: navigateToDemo,
    onDemoDraftClick: navigateToDemoDraft,
    onDemoNoteStarted: () => replaceRoute({ name: 'demo' }),
    onSignIn: () => {
      setAuthModalMode('login');
      setShowAuthModal(true);
    },
    onSignUp: () => {
      setAuthModalMode('signup');
      setShowAuthModal(true);
    },
    onSettingsClick: () => setShowSettingsModal(true),
    authModal: { isOpen: showAuthModal, mode: authModalMode, onClose: () => setShowAuthModal(false) },
  });
  if (entryScreen) return entryScreen;

  // renderEntryScreen returns the landing page whenever there is no user, so this is
  // unreachable. The guard is for the type checker, not for a case that happens.
  if (!user) return null;

  // The deployment guard and the vault, in that order.
  const accountGate = renderAccountGate({
    schemaCompatibility,
    isCheckingSchema,
    onRecheckSchema: recheckSchema,
    isEncryptionSetup,
    isUnlocked,
  });
  if (accountGate) return accountGate;

  if (view === 'faded') {
    return (
      <FadedNotesScreen
        notes={fadedNotes}
        isLoading={fadedNotesLoading}
        onBack={navigateHome}
        onRestore={handleRestoreNote}
        onPermanentDelete={handlePermanentDelete}
        onEmptyAll={handleEmptyFadedNotes}
        theme={theme}
        onThemeToggle={handleThemeToggle}
        onSettingsClick={() => setShowSettingsModal(true)}
      />
    );
  }

  const sharedModalProps = {
    tags,
    showTagModal,
    editingTag,
    onCloseTagModal: handleCloseTagModal,
    onSaveTag: handleSaveTag,
    onDeleteTag: handleDeleteTag,
    keys,
    activeConflict,
    onConflictResolve: handleConflictResolve,
    onConflictDismiss: handleConflictDismiss,
  };

  // Library View
  if (view === 'library') {
    return (
      <LibraryScreen
        header={{
          theme,
          onThemeToggle: handleThemeToggle,
          onNewNote: handleNewNote,
          searchFocusToken,
          searchQuery,
          onSearchChange: handleSearchChange,
          onExportJSON: handleExportJSON,
          onExportMarkdown: handleExportMarkdown,
          onImportFile: handleImportFile,
          onSettingsClick: () => setShowSettingsModal(true),
          onFadedNotesClick: handleFadedNotesClick,
          fadedNotesCount,
          onRetryBlockedChanges: handleRetryBlockedChanges,
          isRetryingBlockedChanges,
        }}
        tagFilter={{
          tags,
          selectedTagIds,
          onTagToggle: handleTagToggle,
          onClearFilter: handleClearTagFilter,
          onAddTag: handleAddTag,
          onEditTag: handleEditTag,
        }}
        library={{
          footerRef: libraryFooterRef,
          notes: displayNotes,
          onNoteClick: handleNoteClick,
          onRetryLockedNote: () => { void retryLockedNotes(); },
          onNoteDelete: handleNoteDelete,
          onTogglePin: handleTogglePin,
          onNewNote: handleNewNote,
          onRefresh: handleRefresh,
          searchQuery: debouncedSearchQuery,
          isSearching,
          isLoading: loading && notes.length === 0,
          focusedNoteId,
          arrangement,
          onBasisChange: setBasis,
          onSortChange: setSort,
        }}
        footer={{
          ref: libraryFooterRef,
          onChangelogClick: publicPageNav.onChangelogClick,
          onRoadmapClick: publicPageNav.onRoadmapClick,
          onShortcutsClick: () => setShowShortcutsModal(true),
          onPrivacyClick: publicPageNav.onPrivacyClick,
          onTermsClick: publicPageNav.onTermsClick,
          onSupportClick: publicPageNav.onSupportClick,
        }}
        modals={
          <AppModals
            scope="library"
            {...sharedModalProps}
            theme={theme}
            onThemeToggle={handleThemeToggle}
            notes={notes}
            showSettingsModal={showSettingsModal}
            onCloseSettings={() => setShowSettingsModal(false)}
            onLetGoClick={() => setShowLettingGoModal(true)}
            sessionSettings={sessionSettings}
            vaultSettings={vaultSettings}
            isVaultUnlocked={isUnlocked}
            onLockVault={() => lockVault('manual')}
            onPersistToLocal={persistToLocal}
            showLettingGoModal={showLettingGoModal}
            onCloseLettingGo={() => setShowLettingGoModal(false)}
            showWelcomeBack={showWelcomeBack}
            daysUntilRelease={daysUntilRelease}
            onDismissWelcomeBack={() => setShowWelcomeBack(false)}
            importProgress={importProgress}
            backupRestore={backupRestore}
            shouldShowInstallPrompt={shouldShowPrompt}
            onInstall={triggerInstall}
            onDismissInstall={dismissPrompt}
            shouldShowIOSGuide={shouldShowIOSGuide}
            onDismissIOSGuide={dismissIOSGuide}
            showSessionTimeoutModal={showSessionTimeoutModal}
            onSessionStay={handleSessionStay}
            onSessionSignOut={handleSessionSignOut}
            sessionMinutesRemaining={sessionMinutesRemaining}
            showShortcutsModal={showShortcutsModal}
            onCloseShortcuts={() => setShowShortcutsModal(false)}
          />
        }
      />
    );
  }

  // Editor View
  if (view === 'editor' && selectedNote) {
    return (
      <NoteEditorView
        note={selectedNote}
        tags={tags}
        userId={user.id}
        theme={theme}
        onBack={handleBack}
        onRequestSearch={requestLibrarySearch}
        onUpdate={handleNoteUpdate}
        onDelete={handleNoteDelete}
        onToggleTag={handleNoteTagToggle}
        onCreateTag={handleAddTag}
        onThemeToggle={handleThemeToggle}
        onSettingsClick={() => setShowSettingsModal(true)}
        loadedEditor={LoadedEditor}
        modals={<AppModals scope="editor" {...sharedModalProps} />}
      />
    );
  }

  // Reached for the single frame between a note address failing to resolve and the
  // effect above replacing it with the library. Never a blank page.
  return <LoadingFallback />;
}

export default App;
