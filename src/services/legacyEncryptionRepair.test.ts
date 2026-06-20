import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DerivedKeys } from '../lib/encryption';
import {
  inspectLegacyPlaintextNotes,
  repairLegacyPlaintextNotes,
} from './legacyEncryptionRepair';

const {
  mockSupabaseFrom,
  mockEncryptNote,
  mockGetOfflineDb,
} = vi.hoisted(() => ({
  mockSupabaseFrom: vi.fn(),
  mockEncryptNote: vi.fn(),
  mockGetOfflineDb: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: mockSupabaseFrom,
  },
}));

vi.mock('../lib/encryption', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/encryption')>();
  return {
    ...actual,
    encryptNote: mockEncryptNote,
  };
});

vi.mock('../lib/offlineDb', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/offlineDb')>();
  return {
    ...actual,
    getOfflineDb: mockGetOfflineDb,
  };
});

const TEST_USER_ID = 'user-1';
const TEST_KEYS = {} as DerivedKeys;

interface TestRow {
  id: string;
  user_id: string;
  title: string | null;
  content: string | null;
  created_at: string;
  updated_at: string;
  display_updated_at: string | null;
  pinned: boolean;
  deleted_at: string | null;
  encrypted_payload: string | null;
  encryption_iv: string | null;
  encryption_version: number | null;
  content_hash: string | null;
}

function createRow(overrides: Partial<TestRow> = {}): TestRow {
  return {
    id: 'note-1',
    user_id: TEST_USER_ID,
    title: '',
    content: '',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
    display_updated_at: '2026-01-03T00:00:00.000Z',
    pinned: false,
    deleted_at: null,
    encrypted_payload: 'ciphertext',
    encryption_iv: 'iv',
    encryption_version: 1,
    content_hash: 'hash',
    ...overrides,
  };
}

function setupDb({ pendingCount = 0, hasLocalNote = true } = {}) {
  const notesUpdate = vi.fn().mockResolvedValue(1);
  mockGetOfflineDb.mockReturnValue({
    syncQueue: {
      filter: vi.fn(() => ({
        count: vi.fn().mockResolvedValue(pendingCount),
      })),
    },
    notes: {
      get: vi.fn().mockResolvedValue(hasLocalNote ? { id: 'note-1' } : undefined),
      update: notesUpdate,
    },
  });

  return { notesUpdate };
}

function setupSupabaseRows(rows: TestRow[]) {
  const updatePayloads: unknown[] = [];
  mockSupabaseFrom.mockImplementation(() => ({
    select: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ data: rows, error: null }),
    })),
    update: vi.fn((payload) => {
      updatePayloads.push(payload);
      return {
        eq: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
      };
    }),
  }));

  return { updatePayloads };
}

beforeEach(() => {
  vi.clearAllMocks();
  setupDb();
  mockEncryptNote.mockResolvedValue({
    ciphertext: 'new-ciphertext',
    iv: 'new-iv',
    version: 1,
    contentHash: 'new-hash',
  });
});

describe('legacy encryption repair', () => {
  it('classifies unsafe legacy note rows', async () => {
    setupSupabaseRows([
      createRow({ id: 'safe' }),
      createRow({ id: 'repairable', encrypted_payload: null, encryption_iv: null, encryption_version: null, content_hash: null, title: 'Plain', content: '<p>Plain</p>' }),
      createRow({ id: 'empty-legacy', encrypted_payload: null, encryption_iv: null, encryption_version: null, content_hash: null }),
      createRow({ id: 'scrub-only', title: 'Old plain title' }),
      createRow({ id: 'irreparable', encrypted_payload: 'ciphertext', encryption_iv: null, encryption_version: 1, content_hash: null }),
    ]);

    const inspection = await inspectLegacyPlaintextNotes(TEST_USER_ID);

    expect(inspection).toMatchObject({
      totalNotes: 5,
      unsafeNotes: 4,
      missingEncryptionFields: 3,
      plaintextColumns: 2,
      repairablePlaintextNotes: 2,
      encryptedRowsNeedingScrub: 1,
      irreparableNotes: 1,
      pendingLocalNoteMutations: 0,
    });
  });

  it('encrypts repairable rows and scrubs encrypted rows with lingering plaintext', async () => {
    const { updatePayloads } = setupSupabaseRows([
      createRow({ id: 'repairable', encrypted_payload: null, encryption_iv: null, encryption_version: null, content_hash: null, title: 'Plain', content: '<script>alert(1)</script><p>Safe</p>' }),
      createRow({ id: 'scrub-only', title: 'Old plain title' }),
    ]);
    const { notesUpdate } = setupDb();

    const result = await repairLegacyPlaintextNotes(TEST_USER_ID, TEST_KEYS);

    expect(result.repaired).toBe(1);
    expect(result.scrubbed).toBe(1);
    expect(result.failed).toBe(0);
    expect(mockEncryptNote).toHaveBeenCalledWith(
      'repairable',
      TEST_USER_ID,
      'Plain',
      '<p>Safe</p>',
      TEST_KEYS
    );
    expect(updatePayloads).toEqual([
      expect.objectContaining({
        title: '',
        content: '',
        encrypted_payload: 'new-ciphertext',
        encryption_iv: 'new-iv',
        encryption_version: 1,
        content_hash: 'new-hash',
      }),
      expect.objectContaining({
        title: '',
        content: '',
      }),
    ]);
    expect(notesUpdate).toHaveBeenCalledTimes(2);
  });

  it('refuses to repair while local note mutations are queued', async () => {
    setupSupabaseRows([
      createRow({ encrypted_payload: null, encryption_iv: null, encryption_version: null, content_hash: null, title: 'Plain' }),
    ]);
    setupDb({ pendingCount: 1 });

    await expect(repairLegacyPlaintextNotes(TEST_USER_ID, TEST_KEYS)).rejects.toThrow(
      /local note mutation/
    );
    expect(mockEncryptNote).not.toHaveBeenCalled();
  });
});
