import type { HeldSave } from '../stores/heldSaves';
import type { Note } from '../types';

export type HeldSaveOutcome = 'already-saved' | 'saved' | 'kept-as-copy';

export interface RetryHeldSaveDeps {
  /** The note's current stored copy, if this device has one. */
  current: Note | undefined;
  /** An open Editor on this note holds unsaved words of its own. */
  openDraft?: boolean;
  /** Save over the stored note, as the editor does. */
  saveOver: (note: Note) => Promise<void>;
  /** Write the words into a new note. */
  keepAsCopy: (entry: HeldSave, current: Note | undefined) => Promise<void>;
}

/**
 * Retry a held save without overwriting newer text (issue #288).
 *
 * Saves over the note only while it still holds the text the words were written over.
 * If it changed since, was deleted, cannot be read on this device, or is open with
 * unsaved words of its own, both are kept:
 * the words go into a new note, as conflict resolution keeps the unchosen side.
 */
export async function retryHeldSave(entry: HeldSave, deps: RetryHeldSaveDeps): Promise<HeldSaveOutcome> {
  const { current } = deps;
  const readable = current !== undefined && !current.decryptionFailed && !current.deletedAt;

  if (readable && current.title === entry.title && current.content === entry.content) {
    return 'already-saved';
  }
  if (readable && !deps.openDraft && current.title === entry.baseTitle && current.content === entry.baseContent) {
    await deps.saveOver({ ...current, title: entry.title, content: entry.content, updatedAt: new Date() });
    return 'saved';
  }
  await deps.keepAsCopy(entry, current);
  return 'kept-as-copy';
}
