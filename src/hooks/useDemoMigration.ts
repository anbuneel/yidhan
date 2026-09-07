/**
 * Bringing work made before signing up into the account.
 *
 * Two paths, and they are not the same: a single draft typed into the landing page
 * hero (`yidhan-demo-content`, plain text), and a whole Practice Space of notes and
 * tags (`yidhan-demo-state`). Both wait for the vault keys, so nothing crosses into
 * the account unencrypted, and both guard against Strict Mode running them twice.
 */

import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import toast from 'react-hot-toast';
import type { Note, Tag } from '../types';
import type { DerivedKeys } from '../lib/encryption';
import { DEMO_CONTENT_STORAGE_KEY, hasDemoState } from '../services/demoStorage';
import { migrateDemoToAccount } from '../services/demoMigration';
import { createEncryptedNote } from '../services/encryptedNotes';
import { sanitizeText } from '../utils/sanitize';

export interface UseDemoMigrationOptions {
  userId: string | undefined;
  keys: DerivedKeys | null;
  isHydrating: boolean;
  setNotes: Dispatch<SetStateAction<Note[]>>;
  setTags: Dispatch<SetStateAction<Tag[]>>;
  /** Open the note the migration created. */
  onNoteCreated: (noteId: string) => void;
}

export function useDemoMigration({
  userId,
  keys,
  isHydrating,
  setNotes,
  setTags,
  onNoteCreated,
}: UseDemoMigrationOptions): void {
  const hasMigratedDemoContent = useRef(false);
  const hasMigratedDemoNotes = useRef(false);

  const onNoteCreatedRef = useRef(onNoteCreated);
  onNoteCreatedRef.current = onNoteCreated;

  // Migrate demo content from landing page to user's first note
  // Dependency: userId (string) instead of user (object) because:
  // 1. Using the full user object would cause unnecessary re-runs on any user property change
  // 2. We only care about identity (userId), not other user metadata
  // 3. String comparison is stable; object reference changes on every auth state update
  useEffect(() => {
    if (!userId) {
      hasMigratedDemoContent.current = false;
      return;
    }
    if (hasMigratedDemoContent.current) return;

    const demoContent = localStorage.getItem(DEMO_CONTENT_STORAGE_KEY);
    if (!demoContent?.trim()) {
      return;
    }

    // Wait for encryption keys before creating note so demo content is encrypted.
    if (!keys) return;

    hasMigratedDemoContent.current = true;

    // Create note with demo content (sanitize and wrap plain text in paragraph tags for Tiptap)
    const sanitized = sanitizeText(demoContent);
    const htmlContent = `<p>${sanitized.replace(/\n/g, '</p><p>')}</p>`;
    createEncryptedNote(userId, 'My first note', htmlContent, keys)
      .then((newNote) => {
        // Clear demo content from localStorage
        localStorage.removeItem(DEMO_CONTENT_STORAGE_KEY);
        // Show toast notification
        toast.success('Your first note has been saved!');
        // Add to notes list
        setNotes((prev) => [newNote, ...prev]);
        // Open the note in editor
        onNoteCreatedRef.current(newNote.id);
      })
      .catch((error: unknown) => {
        console.error('Failed to migrate demo content:', error);
        // Reset flag so user can try again
        hasMigratedDemoContent.current = false;
      });
  }, [userId, keys, setNotes]);

  // Migrate demo notes to authenticated user's account
  // IMPORTANT: Must wait for hydration to complete to avoid:
  // 1. needsHydration returning false (skipping server pull)
  // 2. Hydration clearing IndexedDB and losing demo notes
  useEffect(() => {
    // Gate on hydration complete to avoid race conditions
    if (isHydrating) return;
    if (!userId) {
      hasMigratedDemoNotes.current = false;
      return;
    }
    if (hasMigratedDemoNotes.current) return;

    // Wait for encryption keys before migrating so demo notes are encrypted.
    if (!keys) return;

    // Check if user has demo notes to migrate
    if (!hasDemoState()) {
      hasMigratedDemoNotes.current = true;
      return;
    }

    hasMigratedDemoNotes.current = true;

    // Migrate demo data asynchronously
    (async () => {
      try {
        const { migratedNotes, newTags, noteCount } = await migrateDemoToAccount(userId, keys);

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
  }, [userId, isHydrating, keys, setNotes, setTags]);
}
