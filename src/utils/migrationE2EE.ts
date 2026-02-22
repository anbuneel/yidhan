/**
 * E2EE Migration Script
 *
 * One-time operation to encrypt existing plaintext notes in Supabase.
 * Idempotent — safe to re-run. Skips already-encrypted notes.
 *
 * Process:
 * 1. Fetch all notes from Supabase
 * 2. Skip notes that are already encrypted
 * 3. Encrypt title + content
 * 4. Push encrypted fields to Supabase
 * 5. Verify by reading back and decrypting
 * 6. If verified: clear plaintext (title/content → '')
 * 7. If verification fails: skip, preserve plaintext
 */

import { supabase } from '../lib/supabase';
import type { DerivedKeys } from '../lib/encryption';
import { encryptNote, decryptNote } from '../lib/encryption';
import { getOfflineDb } from '../lib/offlineDb';

const BATCH_SIZE = 10;

export interface MigrationResult {
  migrated: number;
  skipped: number;
  failed: number;
  errors: Array<{ noteId: string; error: string }>;
}

/**
 * Rewrite any pending sync queue entries that contain plaintext note payloads.
 *
 * Without this, resumeSync() after migration would push stale plaintext
 * from old queue entries back to Supabase, overwriting the encrypted data
 * that migration just wrote. This closes the queue-coordination hole
 * identified in code review (Codex R3).
 */
async function encryptPendingSyncQueue(
  userId: string,
  keys: DerivedKeys
): Promise<void> {
  const db = getOfflineDb(userId);
  const allEntries = await db.syncQueue.toArray();

  for (const entry of allEntries) {
    if (entry.entityType !== 'note') continue;
    if (entry.operation !== 'create' && entry.operation !== 'update') continue;

    const payload = entry.payload as Record<string, unknown>;

    // Skip entries that are already encrypted (from encryptedNotes.ts path)
    if (payload.encrypted_payload !== undefined) continue;

    // Skip entries without plaintext to encrypt (soft_delete, pin, etc.)
    const title = payload.title as string | undefined;
    const content = payload.content as string | undefined;
    if (title === undefined && content === undefined) continue;

    // Read the local note to get its current content for encryption.
    // For 'update' entries, the payload may only contain title/content
    // but we need the noteId for AAD.
    const noteId = entry.entityId;
    const plainTitle = (title ?? '') as string;
    const plainContent = (content ?? '') as string;

    const encrypted = await encryptNote(noteId, userId, plainTitle, plainContent, keys);

    // Rewrite the payload with encrypted fields, clear plaintext.
    // Spread preserves other fields (e.g. pinned for creates, createdAt, etc.)
    const encryptedPayload: Record<string, unknown> = {
      ...payload,
      title: '',
      content: '',
      encrypted_payload: encrypted.ciphertext,
      encryption_iv: encrypted.iv,
      encryption_version: encrypted.version,
      content_hash: encrypted.contentHash,
    };

    await db.syncQueue.update(entry.id!, { payload: encryptedPayload });
  }
}

export async function migrateExistingNotes(
  userId: string,
  keys: DerivedKeys,
  onProgress?: (completed: number, total: number) => void
): Promise<MigrationResult> {
  const result: MigrationResult = {
    migrated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  // CRITICAL: Encrypt any pending sync queue entries BEFORE touching Supabase.
  // Without this, resumeSync() would push stale plaintext from old queue
  // entries, overwriting the encrypted data we're about to write.
  await encryptPendingSyncQueue(userId, keys);

  // Fetch all notes from Supabase (including soft-deleted)
  const { data: allNotes, error: fetchError } = await supabase
    .from('notes')
    .select('id, title, content, encrypted_payload, encryption_iv')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (fetchError) {
    throw new Error(`Failed to fetch notes: ${fetchError.message}`);
  }

  if (!allNotes || allNotes.length === 0) {
    return result;
  }

  const total = allNotes.length;
  let completed = 0;

  // Process in batches of BATCH_SIZE
  for (let i = 0; i < allNotes.length; i += BATCH_SIZE) {
    const batch = allNotes.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (note) => {
        try {
          // Skip if already encrypted (idempotent check)
          // Note: don't increment completed here — the finally block handles it
          if (
            note.encrypted_payload != null &&
            note.title === '' &&
            note.content === ''
          ) {
            result.skipped++;
            return;
          }

          const plainTitle = note.title;
          const plainContent = note.content;

          // Encrypt
          const encrypted = await encryptNote(
            note.id,
            userId,
            plainTitle,
            plainContent,
            keys
          );

          // Write encrypted fields to Supabase
          const { error: updateError } = await supabase
            .from('notes')
            .update({
              encrypted_payload: encrypted.ciphertext,
              encryption_iv: encrypted.iv,
              encryption_version: encrypted.version,
              content_hash: encrypted.contentHash,
            })
            .eq('id', note.id)
            .eq('user_id', userId);

          if (updateError) {
            throw new Error(`Update failed: ${updateError.message}`);
          }

          // Read back and verify
          const { data: readBack, error: readError } = await supabase
            .from('notes')
            .select('encrypted_payload, encryption_iv')
            .eq('id', note.id)
            .single();

          if (readError || !readBack?.encrypted_payload || !readBack?.encryption_iv) {
            throw new Error('Verification read-back failed');
          }

          const decrypted = await decryptNote(
            note.id,
            userId,
            { ciphertext: readBack.encrypted_payload, iv: readBack.encryption_iv },
            keys.encryptionKey
          );

          if (decrypted.title !== plainTitle || decrypted.content !== plainContent) {
            throw new Error('Verification mismatch: decrypted content does not match original');
          }

          // Verified — clear plaintext in Supabase
          const { error: clearError } = await supabase
            .from('notes')
            .update({ title: '', content: '' })
            .eq('id', note.id)
            .eq('user_id', userId);

          if (clearError) {
            throw new Error(`Failed to clear plaintext: ${clearError.message}`);
          }

          // Also update IndexedDB so local state matches server
          // Without this, a refresh before the next sync pull would
          // still show plaintext in IDB.
          const db = getOfflineDb(userId);
          await db.notes.update(note.id, {
            title: '',
            content: '',
            encryptedPayload: encrypted.ciphertext,
            encryptionIv: encrypted.iv,
            encryptionVersion: encrypted.version,
            contentHash: encrypted.contentHash,
          });

          result.migrated++;
        } catch (err) {
          result.failed++;
          result.errors.push({
            noteId: note.id,
            error: err instanceof Error ? err.message : String(err),
          });
        } finally {
          completed++;
          onProgress?.(completed, total);
        }
      })
    );
  }

  return result;
}
