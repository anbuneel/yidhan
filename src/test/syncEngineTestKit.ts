/**
 * syncEngineTestKit.ts — shared builders for the syncEngine test files.
 *
 * `syncEngine.test.ts` was one 2,386-line file (~22k tokens), which no session
 * could hold alongside `syncEngine.ts` itself. It is now four files: state,
 * queue, conflicts, pull.
 *
 * `vi.mock()` is hoisted per test file and cannot be shared by importing, so
 * each file declares its own `vi.mock()` calls against `syncEngineMocks.ts`.
 * The builders and the reset helper live here. Add a new mocked dependency to
 * `syncEngineMocks.ts`, and a new builder here — not in the test files.
 */
import { vi } from 'vitest';
import { clearSyncState, type FullSyncResult, type PullError } from '../services/syncEngine';
import { getOfflineDb, type SyncQueueEntry } from '../lib/offlineDb';
import type { DerivedKeys } from '../lib/encryption';
import {
  mockReconcileNoteTags,
  mockUpdateSyncQueueEntry,
  mockMarkSyncQueueEntryBlocked,
  encryptionMock,
  encryptedNotesMock,
} from './syncEngineMocks';

export const TEST_USER_ID = 'test-user-sync';

export const TEST_KEYS = {
  encryptionKey: {} as CryptoKey,
  hashKey: {} as CryptoKey,
  salt: new Uint8Array(16),
  rawEncryptionKey: new Uint8Array(32),
  rawHashKey: new Uint8Array(32),
} satisfies DerivedKeys;

let entryIdCounter = 0;

/** Reset sync state, mocks, and navigator.onLine for behavior tests */
export function resetSyncTestState(): void {
  clearSyncState();
  vi.resetAllMocks();
  mockReconcileNoteTags.mockResolvedValue(0);
  // The conflict-copy path in useSyncEngine imports ../lib/encryption and
  // ../services/encryptedNotes dynamically, so in the old single-file test the
  // vi.mock factories happened to run after this reset and arrived armed. These
  // modules are now loaded eagerly, so re-arm them here rather than depending on
  // import timing.
  encryptionMock.decryptNote.mockResolvedValue({
    title: 'Preserved conflict copy',
    content: '<p>Preserved</p>',
  });
  encryptionMock.encryptNote.mockResolvedValue({
    ciphertext: 'conflict-copy-ciphertext',
    iv: 'conflict-copy-iv',
    version: 1,
    contentHash: 'conflict-copy-hash',
  });
  encryptedNotesMock.createEncryptedNote.mockResolvedValue({ id: 'conflict-copy-note' });
  entryIdCounter = 0;
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  mockUpdateSyncQueueEntry.mockImplementation(async (userId: string, entry: SyncQueueEntry, updates: Partial<SyncQueueEntry>) => {
    const db = getOfflineDb(userId);
    if (typeof entry.id === 'number') {
      await db.syncQueue.update(entry.id, {
        ...updates,
        updatedAt: updates.updatedAt ?? Date.now(),
      });
      return;
    }

    await db.syncQueue
      .where('clientMutationId')
      .equals(entry.clientMutationId)
      .modify({
        ...updates,
        updatedAt: updates.updatedAt ?? Date.now(),
      });
  });
  mockMarkSyncQueueEntryBlocked.mockImplementation(async (userId: string, entry: SyncQueueEntry, retryCount: number, lastError: string) => {
    const db = getOfflineDb(userId);
    const now = Date.now();
    const payload = {
      status: 'blocked' as const,
      retryCount,
      lastError,
      lastAttemptAt: now,
      blockedAt: now,
      updatedAt: now,
    };

    if (typeof entry.id === 'number') {
      await db.syncQueue.update(entry.id, payload);
      return;
    }

    await db.syncQueue
      .where('clientMutationId')
      .equals(entry.clientMutationId)
      .modify(payload);
  });
}

/** Clear all IDB tables used by sync behavior tests */
export async function clearTestDb(...tables: ('notes' | 'tags' | 'noteTags' | 'syncQueue')[]): Promise<void> {
  const db = getOfflineDb(TEST_USER_ID);
  for (const table of tables) {
    await db[table].clear();
  }
}

/** Build a chainable mock simulating supabase.from(table).method()...terminal() */
export function buildChain(result: { data?: unknown; error?: unknown } = {}) {
  const resolved = { data: result.data ?? null, error: result.error ?? null };
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'gt', 'filter']) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.maybeSingle = vi.fn().mockResolvedValue(resolved);
  chain.single = vi.fn().mockResolvedValue(resolved);
  return chain;
}

export function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Build a SyncQueueEntry for testing */
export function buildEntry(overrides: Partial<SyncQueueEntry> = {}): SyncQueueEntry {
  return {
    id: ++entryIdCounter,
    clientMutationId: 'mut-' + Math.random().toString(36).slice(2, 8),
    operation: 'create',
    entityType: 'note',
    entityId: 'note-1',
    payload: {
      title: '',
      content: '',
      pinned: false,
      ...encryptedServerFields('note-1'),
    },
    createdAt: Date.now(),
    retryCount: 0,
    status: 'pending',
    lastError: null,
    lastAttemptAt: null,
    blockedAt: null,
    updatedAt: Date.now(),
    ...overrides,
  };
}

export function encryptedServerFields(seed: string) {
  return {
    encrypted_payload: `ciphertext-${seed}`,
    encryption_iv: `iv-${seed}`,
    encryption_version: 1,
    content_hash: `hash-${seed}`,
  };
}

export function buildResult(overrides: Partial<FullSyncResult> = {}): FullSyncResult {
  return {
    processed: 0,
    failed: 0,
    blocked: 0,
    conflicts: 0,
    errors: [],
    pulled: { notes: 0, tags: 0 },
    deleted: { notes: 0, tags: 0 },
    pullErrors: [],
    ...overrides,
  };
}

export function dataError(entity: 'notes' | 'tags', msg = 'fetch failed'): PullError {
  return { entity, operation: 'data', error: new Error(msg) };
}

export function membershipError(entity: 'notes' | 'tags', msg = 'membership failed'): PullError {
  return { entity, operation: 'membership', error: new Error(msg) };
}
