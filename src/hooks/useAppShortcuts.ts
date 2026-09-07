/**
 * The three global keyboard shortcuts: Cmd/Ctrl+N for a new note, Cmd/Ctrl+K for
 * search, and `?` for the shortcut list.
 *
 * All three are view-aware and all three refuse to fire while the reader is typing in
 * a field. `useEffectEvent` keeps the listeners attached once for the life of the app
 * while still reading the current view.
 */

import { useEffect, useEffectEvent } from 'react';
import type { ViewMode } from '../types';

export interface UseAppShortcutsOptions {
  enabled: boolean;
  view: ViewMode;
  onNewNote: () => void;
  onFocusSearch: () => void;
  onRequestLibrarySearch: () => void;
  onShowShortcuts: () => void;
}

/** True when the event landed in something the reader is typing into. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  );
}

export function useAppShortcuts({
  enabled,
  view,
  onNewNote,
  onFocusSearch,
  onRequestLibrarySearch,
  onShowShortcuts,
}: UseAppShortcutsOptions): void {
  const handleCreateNoteShortcut = useEffectEvent((e: KeyboardEvent) => {
    if (!enabled || view !== 'library') return;

    if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
      e.preventDefault();
      onNewNote();
    }
  });

  const handleLibrarySearchShortcut = useEffectEvent((e: KeyboardEvent) => {
    if (!enabled || view === 'editor') return;

    const isSearchKey = e.code === 'KeyK' || e.key.toLowerCase() === 'k';
    if (!(e.metaKey || e.ctrlKey) || e.altKey || !isSearchKey) return;
    if (isTypingTarget(e.target)) return;

    e.preventDefault();

    if (view === 'library') {
      onFocusSearch();
      return;
    }

    onRequestLibrarySearch();
  });

  const handleShortcutsShortcut = useEffectEvent((e: KeyboardEvent) => {
    if (!enabled || view !== 'library') return;
    if (isTypingTarget(e.target)) return;

    if (e.key === '?') {
      e.preventDefault();
      onShowShortcuts();
    }
  });

  useEffect(() => {
    window.addEventListener('keydown', handleCreateNoteShortcut);
    return () => window.removeEventListener('keydown', handleCreateNoteShortcut);
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleLibrarySearchShortcut, true);
    return () => document.removeEventListener('keydown', handleLibrarySearchShortcut, true);
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleShortcutsShortcut);
    return () => window.removeEventListener('keydown', handleShortcutsShortcut);
  }, []);
}
