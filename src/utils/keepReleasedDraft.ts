import toast from 'react-hot-toast';
import type { DerivedKeys } from '../lib/encryption';
import { createEncryptedNote } from '../services/encryptedNotes';
import { addTagToNoteOffline } from '../services/offlineNotes';
import { VaultLockedSaveError } from './saveErrors';
import type { Note, Tag } from '../types';

/**
 * Issue #205: write the words of a note released on another device into a new note.
 * The new note carries the released note's pin and its tags that still exist. Loaded
 * on demand from App, because it runs only on this rare path. Says what it kept.
 * Also keeps the writer's words that "Load changes" replaces (issue #284).
 */
export async function keepReleasedDraft(
  userId: string | undefined,
  keys: DerivedKeys | null,
  title: string,
  content: string,
  /** The note the words came from: the new note takes its pin and live tags. */
  source: Note | undefined,
  liveTags: Tag[],
  keptMessage = 'Kept as a new note.'
): Promise<Note> {
  if (!userId) throw new Error('Cannot save without a signed-in user');
  if (!keys) throw new VaultLockedSaveError();
  const newNote = await createEncryptedNote(userId, title, content, keys, source?.pinned ?? false);
  const keptTags: Tag[] = [];
  let tagsDropped = false;
  for (const tag of source?.tags ?? []) {
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
  toast(tagsDropped ? `${keptMessage} Some of its tags are gone.` : keptMessage);
  return { ...newNote, tags: keptTags };
}
