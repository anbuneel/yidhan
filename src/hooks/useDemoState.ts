/**
 * useDemoState Hook
 *
 * React hook for managing demo state. Provides reactive access to demo notes and tags
 * stored in localStorage, with CRUD operations that automatically update the UI.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  getDemoState,
  createDemoNote,
  updateDemoNote,
  deleteDemoNote,
  getDemoNote,
  createDemoTag,
  updateDemoTag,
  deleteDemoTag,
  addTagToDemoNote,
  removeTagFromDemoNote,
  dismissDemoPrompt,
  dismissDemoRibbon,
  clearDemoState,
  type DemoState,
  type DemoNote,
  type DemoTag,
  type DemoMetadata,
} from '../services/demoStorage';
import type { Note, Tag, TagColor } from '../types';

// Convert DemoNote to Note format (for compatibility with existing components)
function demoNoteToNote(demoNote: DemoNote, tags: DemoTag[]): Note {
  const noteTags = demoNote.tagIds
    .map((tagId) => tags.find((t) => t.localId === tagId))
    .filter((t): t is DemoTag => t !== undefined)
    .map((t) => ({
      id: t.localId,
      name: t.name,
      color: t.color,
      createdAt: new Date(t.createdAt),
    }));

  return {
    id: demoNote.localId,
    title: demoNote.title,
    content: demoNote.content,
    pinned: demoNote.pinned,
    createdAt: new Date(demoNote.createdAt),
    updatedAt: new Date(demoNote.updatedAt),
    tags: noteTags,
  };
}

// Convert DemoTag to Tag format
function demoTagToTag(demoTag: DemoTag): Tag {
  return {
    id: demoTag.localId,
    name: demoTag.name,
    color: demoTag.color,
    createdAt: new Date(demoTag.createdAt),
  };
}

export interface UseDemoStateReturn {
  // State
  notes: Note[];
  tags: Tag[];
  metadata: DemoMetadata | null;
  loading: boolean;

  // Note operations
  createNote: (note: { title: string; content: string; pinned?: boolean; tagIds?: string[] }) => Note;
  updateNote: (id: string, updates: { title?: string; content?: string; pinned?: boolean }) => Note | null;
  deleteNote: (id: string) => boolean;
  getNote: (id: string) => Note | null;

  // Tag operations
  createTag: (tag: { name: string; color: TagColor }) => Tag;
  updateTag: (id: string, updates: { name?: string; color?: TagColor }) => Tag | null;
  deleteTag: (id: string) => boolean;

  // Note-Tag operations
  addTagToNote: (noteId: string, tagId: string) => boolean;
  removeTagFromNote: (noteId: string, tagId: string) => boolean;

  // Metadata operations
  dismissPrompt: () => void;
  dismissRibbon: () => void;
  clearAllData: () => void;

  // Derived state
  userNoteCount: number; // Notes excluding welcome note
  isWelcomeNote: (noteId: string) => boolean;
}

export function useDemoState(): UseDemoStateReturn {
  // Initialize state from localStorage synchronously (lazy initialization)
  const [state, setState] = useState<DemoState | null>(() => {
    // Only run on client side
    if (typeof window === 'undefined') return null;
    return getDemoState();
  });

  // Helper to refresh state from localStorage
  const refreshState = useCallback(() => {
    setState(getDemoState());
  }, []);

  // Convert notes to Note format
  const notes = useMemo(() => {
    if (!state) return [];
    return state.notes.map((n) => demoNoteToNote(n, state.tags));
  }, [state]);

  // Convert tags to Tag format
  const tags = useMemo(() => {
    if (!state) return [];
    return state.tags.map(demoTagToTag);
  }, [state]);

  // Count user-created notes (excluding welcome note)
  const userNoteCount = useMemo(() => {
    if (!state) return 0;
    return state.notes.filter((n) => n.localId !== 'welcome-note').length;
  }, [state]);

  // Check if a note is the welcome note
  const isWelcomeNote = useCallback((noteId: string) => {
    return noteId === 'welcome-note';
  }, []);

  // Note operations
  const createNoteHandler = useCallback(
    (note: { title: string; content: string; pinned?: boolean; tagIds?: string[] }): Note => {
      const newDemoNote = createDemoNote({
        title: note.title,
        content: note.content,
        pinned: note.pinned ?? false,
        tagIds: note.tagIds ?? [],
      });
      refreshState();
      const currentState = getDemoState();
      return demoNoteToNote(newDemoNote, currentState.tags);
    },
    [refreshState]
  );

  const updateNoteHandler = useCallback(
    (id: string, updates: { title?: string; content?: string; pinned?: boolean }): Note | null => {
      const updated = updateDemoNote(id, updates);
      if (!updated) return null;
      refreshState();
      const currentState = getDemoState();
      return demoNoteToNote(updated, currentState.tags);
    },
    [refreshState]
  );

  const deleteNoteHandler = useCallback(
    (id: string): boolean => {
      const deleted = deleteDemoNote(id);
      if (deleted) refreshState();
      return deleted;
    },
    [refreshState]
  );

  const getNoteHandler = useCallback(
    (id: string): Note | null => {
      const demoNote = getDemoNote(id);
      if (!demoNote) return null;
      const currentState = getDemoState();
      return demoNoteToNote(demoNote, currentState.tags);
    },
    []
  );

  // Tag operations
  const createTagHandler = useCallback(
    (tag: { name: string; color: TagColor }): Tag => {
      const newDemoTag = createDemoTag(tag);
      refreshState();
      return demoTagToTag(newDemoTag);
    },
    [refreshState]
  );

  const updateTagHandler = useCallback(
    (id: string, updates: { name?: string; color?: TagColor }): Tag | null => {
      const updated = updateDemoTag(id, updates);
      if (!updated) return null;
      refreshState();
      return demoTagToTag(updated);
    },
    [refreshState]
  );

  const deleteTagHandler = useCallback(
    (id: string): boolean => {
      const deleted = deleteDemoTag(id);
      if (deleted) refreshState();
      return deleted;
    },
    [refreshState]
  );

  // Note-Tag operations
  const addTagToNoteHandler = useCallback(
    (noteId: string, tagId: string): boolean => {
      const added = addTagToDemoNote(noteId, tagId);
      if (added) refreshState();
      return added;
    },
    [refreshState]
  );

  const removeTagFromNoteHandler = useCallback(
    (noteId: string, tagId: string): boolean => {
      const removed = removeTagFromDemoNote(noteId, tagId);
      if (removed) refreshState();
      return removed;
    },
    [refreshState]
  );

  // Metadata operations
  const dismissPromptHandler = useCallback(() => {
    dismissDemoPrompt();
    refreshState();
  }, [refreshState]);

  const dismissRibbonHandler = useCallback(() => {
    dismissDemoRibbon();
    refreshState();
  }, [refreshState]);

  const clearAllDataHandler = useCallback(() => {
    clearDemoState();
    setState(null);
  }, []);

  return {
    notes,
    tags,
    metadata: state?.metadata ?? null,
    loading: false, // Always false - localStorage is synchronous (kept for API stability)

    createNote: createNoteHandler,
    updateNote: updateNoteHandler,
    deleteNote: deleteNoteHandler,
    getNote: getNoteHandler,

    createTag: createTagHandler,
    updateTag: updateTagHandler,
    deleteTag: deleteTagHandler,

    addTagToNote: addTagToNoteHandler,
    removeTagFromNote: removeTagFromNoteHandler,

    dismissPrompt: dismissPromptHandler,
    dismissRibbon: dismissRibbonHandler,
    clearAllData: clearAllDataHandler,

    userNoteCount,
    isWelcomeNote,
  };
}
