/**
 * Tags: the filter, the modal, and the writes behind both.
 *
 * Every write touches two places — the tag list and the copies of that tag embedded in
 * each note — and forgetting the second is how a renamed tag used to keep its old
 * label on the cards until a reload.
 */

import { useState, type Dispatch, type SetStateAction } from 'react';
import type { Note, Tag, TagColor } from '../types';
import {
  createTagOffline,
  updateTagOffline,
  deleteTagOffline,
} from '../services/offlineTags';
import {
  addTagToNoteOffline,
  removeTagFromNoteOffline,
} from '../services/offlineNotes';

export interface UseTagActionsOptions {
  userId: string | undefined;
  notes: Note[];
  tags: Tag[];
  setNotes: Dispatch<SetStateAction<Note[]>>;
  setTags: Dispatch<SetStateAction<Tag[]>>;
  setSelectedTagIds: Dispatch<SetStateAction<string[]>>;
}

export interface TagActions {
  showTagModal: boolean;
  editingTag: Tag | null;
  handleTagToggle: (tagId: string) => void;
  handleClearTagFilter: () => void;
  handleAddTag: () => void;
  handleEditTag: (tag: Tag) => void;
  handleSaveTag: (name: string, color: TagColor) => Promise<void>;
  handleDeleteTag: () => Promise<void>;
  handleCloseTagModal: () => void;
  handleNoteTagToggle: (noteId: string, tagId: string) => Promise<void>;
}

export function useTagActions({
  userId,
  notes,
  tags,
  setNotes,
  setTags,
  setSelectedTagIds,
}: UseTagActionsOptions): TagActions {
  const [showTagModal, setShowTagModal] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);

  // Tag filter handlers
  const handleTagToggle = (tagId: string) => {
    // Tag toggle preserves search query — displayNotes re-filters via useMemo
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

  const handleSaveTag = async (name: string, color: TagColor) => {
    if (!userId) return;

    if (editingTag) {
      // Update existing tag
      const updated = await updateTagOffline(userId, editingTag.id, { name, color });
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
      const newTag = await createTagOffline(userId, name, color);
      setTags((prev) => [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name)));
    }
    setEditingTag(null);
  };

  const handleDeleteTag = async () => {
    if (!editingTag || !userId) return;
    await deleteTagOffline(userId, editingTag.id);
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
    if (!userId) return;

    const note = notes.find((n) => n.id === noteId);
    if (!note) return;

    const hasTag = note.tags.some((t) => t.id === tagId);
    const tag = tags.find((t) => t.id === tagId);

    try {
      if (hasTag) {
        await removeTagFromNoteOffline(userId, noteId, tagId);
        // Update local state
        setNotes((prev) =>
          prev.map((n) =>
            n.id === noteId
              ? { ...n, tags: n.tags.filter((t) => t.id !== tagId) }
              : n
          )
        );
      } else if (tag) {
        await addTagToNoteOffline(userId, noteId, tagId);
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


  return {
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
  };
}
