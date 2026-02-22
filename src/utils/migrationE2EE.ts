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

const BATCH_SIZE = 10;

export interface MigrationResult {
  migrated: number;
  skipped: number;
  failed: number;
  errors: Array<{ noteId: string; error: string }>;
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
          if (
            note.encrypted_payload != null &&
            note.title === '' &&
            note.content === ''
          ) {
            result.skipped++;
            completed++;
            onProgress?.(completed, total);
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

          // Verified — clear plaintext
          const { error: clearError } = await supabase
            .from('notes')
            .update({ title: '', content: '' })
            .eq('id', note.id)
            .eq('user_id', userId);

          if (clearError) {
            throw new Error(`Failed to clear plaintext: ${clearError.message}`);
          }

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
