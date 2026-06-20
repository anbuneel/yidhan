import { supabase } from '../lib/supabase';
import { getOfflineDb, MIGRATION_SYNC_SENTINEL } from '../lib/offlineDb';
import { encryptNote, type DerivedKeys } from '../lib/encryption';
import { sanitizeHtml } from '../utils/sanitize';
import { validateNoteContentLength, validateNoteTitle } from '../utils/validation';

interface LegacyRepairRow {
  id: string;
  user_id: string;
  title: string | null;
  content: string | null;
  created_at: string;
  updated_at: string;
  display_updated_at: string | null;
  pinned: boolean | null;
  deleted_at: string | null;
  encrypted_payload: string | null;
  encryption_iv: string | null;
  encryption_version: number | null;
  content_hash: string | null;
}

export interface LegacyRepairInspection {
  totalNotes: number;
  unsafeNotes: number;
  missingEncryptionFields: number;
  plaintextColumns: number;
  repairablePlaintextNotes: number;
  encryptedRowsNeedingScrub: number;
  irreparableNotes: number;
  pendingLocalNoteMutations: number;
}

export interface LegacyRepairProgress {
  completed: number;
  total: number;
  currentNoteId?: string;
}

export interface LegacyRepairResult extends LegacyRepairInspection {
  repaired: number;
  scrubbed: number;
  failed: number;
  failures: Array<{ id: string; reason: string }>;
}

const NOTE_SELECT = [
  'id',
  'user_id',
  'title',
  'content',
  'created_at',
  'updated_at',
  'display_updated_at',
  'pinned',
  'deleted_at',
  'encrypted_payload',
  'encryption_iv',
  'encryption_version',
  'content_hash',
].join(',');

function hasCompleteEncryption(row: LegacyRepairRow): boolean {
  return Boolean(
    row.encrypted_payload &&
    row.encryption_iv &&
    row.encryption_version != null &&
    row.encryption_version >= 1 &&
    row.content_hash
  );
}

function hasPlaintextColumns(row: LegacyRepairRow): boolean {
  return Boolean((row.title ?? '') || (row.content ?? ''));
}

function hasAnyEncryptionMaterial(row: LegacyRepairRow): boolean {
  return Boolean(
    row.encrypted_payload ||
    row.encryption_iv ||
    row.encryption_version != null ||
    row.content_hash
  );
}

function isUnsafe(row: LegacyRepairRow): boolean {
  return !hasCompleteEncryption(row) || hasPlaintextColumns(row);
}

function canEncryptFromPlaintext(row: LegacyRepairRow): boolean {
  return !hasCompleteEncryption(row) && (hasPlaintextColumns(row) || !hasAnyEncryptionMaterial(row));
}

function canScrubOnly(row: LegacyRepairRow): boolean {
  return hasCompleteEncryption(row) && hasPlaintextColumns(row);
}

function preserveDisplayTimestamp(row: LegacyRepairRow): string {
  const base = new Date(row.display_updated_at ?? row.updated_at ?? row.created_at);
  if (Number.isNaN(base.getTime())) {
    return new Date().toISOString();
  }

  // The current DB trigger advances display_updated_at when it is unchanged.
  // Nudge by 1ms so chronology is preserved instead of every repaired note
  // moving to "now".
  return new Date(base.getTime() + 1).toISOString();
}

async function fetchUserNotes(userId: string): Promise<LegacyRepairRow[]> {
  const { data, error } = await supabase
    .from('notes')
    .select(NOTE_SELECT)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as LegacyRepairRow[];
}

async function countPendingLocalNoteMutations(userId: string): Promise<number> {
  const db = getOfflineDb(userId);
  return db.syncQueue
    .filter((entry) => entry.entityType === 'note')
    .count();
}

function summarizeRows(
  rows: LegacyRepairRow[],
  pendingLocalNoteMutations: number
): LegacyRepairInspection {
  const unsafeRows = rows.filter(isUnsafe);
  const missingEncryptionRows = rows.filter((row) => !hasCompleteEncryption(row));
  const plaintextRows = rows.filter(hasPlaintextColumns);
  const repairableRows = rows.filter(canEncryptFromPlaintext);
  const scrubOnlyRows = rows.filter(canScrubOnly);

  return {
    totalNotes: rows.length,
    unsafeNotes: unsafeRows.length,
    missingEncryptionFields: missingEncryptionRows.length,
    plaintextColumns: plaintextRows.length,
    repairablePlaintextNotes: repairableRows.length,
    encryptedRowsNeedingScrub: scrubOnlyRows.length,
    irreparableNotes: unsafeRows.length - repairableRows.length - scrubOnlyRows.length,
    pendingLocalNoteMutations,
  };
}

export async function inspectLegacyPlaintextNotes(
  userId: string
): Promise<LegacyRepairInspection> {
  const [rows, pendingLocalNoteMutations] = await Promise.all([
    fetchUserNotes(userId),
    countPendingLocalNoteMutations(userId),
  ]);

  return summarizeRows(rows, pendingLocalNoteMutations);
}

async function updateLocalRepairCache(
  userId: string,
  row: LegacyRepairRow,
  encrypted: {
    ciphertext: string;
    iv: string;
    version: number;
    contentHash: string;
  }
): Promise<void> {
  const db = getOfflineDb(userId);
  const existing = await db.notes.get(row.id);
  if (!existing) return;

  const displayTime = new Date(row.display_updated_at ?? row.updated_at ?? row.created_at).getTime();
  const updatedAt = Number.isNaN(displayTime) ? Date.now() : displayTime;

  await db.notes.update(row.id, {
    title: '',
    content: '',
    updatedAt,
    syncStatus: 'synced',
    lastSyncedAt: MIGRATION_SYNC_SENTINEL,
    serverUpdatedAt: null,
    localUpdatedAt: updatedAt,
    encryptedPayload: encrypted.ciphertext,
    encryptionIv: encrypted.iv,
    encryptionVersion: encrypted.version,
    contentHash: encrypted.contentHash,
  });
}

async function scrubLocalRepairCache(userId: string, row: LegacyRepairRow): Promise<void> {
  const db = getOfflineDb(userId);
  const existing = await db.notes.get(row.id);
  if (!existing) return;

  await db.notes.update(row.id, {
    title: '',
    content: '',
    syncStatus: 'synced',
    lastSyncedAt: MIGRATION_SYNC_SENTINEL,
    serverUpdatedAt: null,
  });
}

export async function repairLegacyPlaintextNotes(
  userId: string,
  keys: DerivedKeys,
  onProgress?: (progress: LegacyRepairProgress) => void
): Promise<LegacyRepairResult> {
  const rows = await fetchUserNotes(userId);
  const pendingLocalNoteMutations = await countPendingLocalNoteMutations(userId);
  const inspection = summarizeRows(rows, pendingLocalNoteMutations);

  if (pendingLocalNoteMutations > 0) {
    throw new Error(
      `Refusing to repair while ${pendingLocalNoteMutations} local note mutation(s) are still queued. Sync or clear local pending work first.`
    );
  }

  if (inspection.irreparableNotes > 0) {
    throw new Error(
      `Refusing to repair ${inspection.irreparableNotes} unsafe note(s) that do not have plaintext content available for encryption.`
    );
  }

  const repairRows = rows.filter((row) => canEncryptFromPlaintext(row) || canScrubOnly(row));
  const failures: LegacyRepairResult['failures'] = [];
  let repaired = 0;
  let scrubbed = 0;

  for (const [index, row] of repairRows.entries()) {
    onProgress?.({ completed: index, total: repairRows.length, currentNoteId: row.id });

    try {
      if (canScrubOnly(row)) {
        const { error } = await supabase
          .from('notes')
          .update({
            title: '',
            content: '',
            display_updated_at: preserveDisplayTimestamp(row),
          })
          .eq('id', row.id)
          .eq('user_id', userId);

        if (error) throw error;
        await scrubLocalRepairCache(userId, row);
        scrubbed++;
        continue;
      }

      const validatedTitle = validateNoteTitle(row.title ?? '');
      const content = row.content ?? '';
      validateNoteContentLength(content);
      const sanitizedContent = sanitizeHtml(content);
      const encrypted = await encryptNote(row.id, userId, validatedTitle, sanitizedContent, keys);

      const { error } = await supabase
        .from('notes')
        .update({
          title: '',
          content: '',
          encrypted_payload: encrypted.ciphertext,
          encryption_iv: encrypted.iv,
          encryption_version: encrypted.version,
          content_hash: encrypted.contentHash,
          display_updated_at: preserveDisplayTimestamp(row),
        })
        .eq('id', row.id)
        .eq('user_id', userId);

      if (error) throw error;
      await updateLocalRepairCache(userId, row, encrypted);
      repaired++;
    } catch (error) {
      failures.push({
        id: row.id,
        reason: error instanceof Error ? error.message : 'Unknown repair failure',
      });
    }
  }

  onProgress?.({ completed: repairRows.length, total: repairRows.length });

  return {
    ...inspection,
    repaired,
    scrubbed,
    failed: failures.length,
    failures,
  };
}
