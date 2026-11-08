import type { DerivedKeys } from '../lib/encryption';
import { createEncryptedNote } from '../services/encryptedNotes';
import { addTagToNoteOffline } from '../services/offlineNotes';
import type { Note, Tag } from '../types';

/**
 * Issue #205: write the words of a note released on another device into a new note.
 * The new note carries the released note's pin and its tags that still exist. Loaded
 * on demand from App, because it runs only on this rare path.
 */
export async function keepReleasedDraft(
  userId: string,
  keys: DerivedKeys,
  title: string,
  content: string,
  releasedNote: Note | undefined,
  liveTags: Tag[]
): Promise<{ note: Note; tagsDropped: boolean }> {
  const newNote = await createEncryptedNote(userId, title, content, keys, releasedNote?.pinned ?? false);
  const keptTags: Tag[] = [];
  let tagsDropped = false;
  for (const tag of releasedNote?.tags ?? []) {
    const liveTag = liveTags.find((t) => t.id === tag.id);
    if (!liveTag) {
      tagsDropped = true;
      continue;
    }
    try {
      await addTagToNoteOffline(userId, newNote.id, liveTag.id);
      keptTags.push(liveTag);
    } catch (error) {
      console.error('Failed to carry a tag to the kept note:', error);
      tagsDropped = true;
    }
  }
  return { note: { ...newNote, tags: keptTags }, tagsDropped };
}
