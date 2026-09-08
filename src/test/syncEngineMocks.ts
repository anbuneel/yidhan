/**
 * syncEngineMocks.ts — module mocks for the syncEngine test files.
 *
 * This file must not import `syncEngine` or anything that reaches it. The
 * `vi.mock()` factories in the test files import this module, and those
 * factories run while the mocked modules are being resolved — pulling
 * `syncEngine` in from here would cycle back through them.
 *
 * Builders and the reset helper live in `syncEngineTestKit.ts`, which does
 * import `syncEngine` and is imported normally, not from a mock factory.
 */
import { vi } from 'vitest';

// Mock functions — asserted on directly by the tests
export const mockFrom = vi.fn();
export const mockFetchAllPaginated = vi.fn();
export const mockGetPendingSyncQueue = vi.fn();
export const mockRemoveSyncQueueEntry = vi.fn();
export const mockMarkNoteSynced = vi.fn();
export const mockMarkTagSynced = vi.fn();
export const mockUpdateSyncQueueEntry = vi.fn();
export const mockMarkSyncQueueEntryBlocked = vi.fn();
export const mockQueueSyncOperation = vi.fn();
export const mockClearQueuedNoteCreates = vi.fn();
export const mockReconcileNoteTags = vi.fn();

// Module mock shapes — consumed by the vi.mock factories
export const capacitorMock = {
  Capacitor: { isNativePlatform: () => false },
};

export const supabaseMock = {
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
  fetchAllPaginated: (...args: unknown[]) => mockFetchAllPaginated(...args),
};

export const offlineNotesMock = {
  getPendingSyncQueue: (...args: unknown[]) => mockGetPendingSyncQueue(...args),
  removeSyncQueueEntry: (...args: unknown[]) => mockRemoveSyncQueueEntry(...args),
  markNoteSynced: (...args: unknown[]) => mockMarkNoteSynced(...args),
  updateSyncQueueEntry: (...args: unknown[]) => mockUpdateSyncQueueEntry(...args),
  markSyncQueueEntryBlocked: (...args: unknown[]) => mockMarkSyncQueueEntryBlocked(...args),
  queueSyncOperation: (...args: unknown[]) => mockQueueSyncOperation(...args),
  clearQueuedNoteCreates: (...args: unknown[]) => mockClearQueuedNoteCreates(...args),
};

export const offlineTagsMock = {
  markTagSynced: (...args: unknown[]) => mockMarkTagSynced(...args),
};

export const encryptionMock = {
  decryptNote: vi.fn().mockResolvedValue({
    title: 'Preserved conflict copy',
    content: '<p>Preserved</p>',
  }),
  encryptNote: vi.fn().mockResolvedValue({
    ciphertext: 'conflict-copy-ciphertext',
    iv: 'conflict-copy-iv',
    version: 1,
    contentHash: 'conflict-copy-hash',
  }),
};

export const encryptedNotesMock = {
  createEncryptedNote: vi.fn().mockResolvedValue({ id: 'conflict-copy-note' }),
};

export const noteTagSyncMock = {
  reconcileNoteTags: mockReconcileNoteTags,
};
