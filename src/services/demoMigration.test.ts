/**
 * demoMigration.test.ts — Phase 2a
 *
 * Tests demo-to-account migration: tag deduplication, encrypted note
 * creation, empty state handling, and cleanup.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock functions (vi.mock calls are hoisted above imports by Vitest)
const mockGetDemoDataForMigration = vi.fn();
const mockClearDemoState = vi.fn();
const mockFetchTagsOffline = vi.fn();
const mockCreateTagOffline = vi.fn();
const mockAddTagToNoteOffline = vi.fn();
const mockCreateEncryptedNote = vi.fn();
const mockSanitizeHtml = vi.fn((html: string) => html);

vi.mock('./demoStorage', () => ({
  getDemoDataForMigration: (...args: unknown[]) => mockGetDemoDataForMigration(...args),
  clearDemoState: (...args: unknown[]) => mockClearDemoState(...args),
}));

vi.mock('./offlineTags', () => ({
  fetchTagsOffline: (...args: unknown[]) => mockFetchTagsOffline(...args),
  createTagOffline: (...args: unknown[]) => mockCreateTagOffline(...args),
}));

vi.mock('./offlineNotes', () => ({
  addTagToNoteOffline: (...args: unknown[]) => mockAddTagToNoteOffline(...args),
}));

vi.mock('./encryptedNotes', () => ({
  createEncryptedNote: (...args: unknown[]) => mockCreateEncryptedNote(...args),
}));

vi.mock('../utils/sanitize', () => ({
  sanitizeHtml: (...args: unknown[]) => mockSanitizeHtml(...args),
}));

import { migrateDemoToAccount } from './demoMigration';
import type { DerivedKeys } from '../lib/encryption';

const TEST_USER = 'user-123';
const MOCK_KEYS = { encryptionKey: {}, hashKey: {}, salt: new Uint8Array(16) } as unknown as DerivedKeys;

beforeEach(() => {
  // resetAllMocks (not clearAllMocks): each test re-configures mock return values from scratch
  vi.resetAllMocks();
});

describe('migrateDemoToAccount', () => {
  it('should return empty result and clear state when no demo notes', async () => {
    mockGetDemoDataForMigration.mockReturnValue({ notes: [], tags: [] });

    const result = await migrateDemoToAccount(TEST_USER, MOCK_KEYS);

    expect(result.migratedNotes).toHaveLength(0);
    expect(result.newTags).toHaveLength(0);
    expect(result.noteCount).toBe(0);
    expect(mockClearDemoState).toHaveBeenCalled();
  });

  it('should create encrypted notes from demo notes', async () => {
    mockGetDemoDataForMigration.mockReturnValue({
      notes: [{ title: 'My Note', content: '<p>Hello</p>', tagIds: [] }],
      tags: [],
    });
    mockFetchTagsOffline.mockResolvedValue([]);
    mockCreateEncryptedNote.mockResolvedValue({
      id: 'note-1',
      title: 'My Note',
      content: '<p>Hello</p>',
    });

    const result = await migrateDemoToAccount(TEST_USER, MOCK_KEYS);

    expect(result.noteCount).toBe(1);
    expect(result.migratedNotes).toHaveLength(1);
    expect(mockCreateEncryptedNote).toHaveBeenCalledWith(
      TEST_USER, 'My Note', '<p>Hello</p>', MOCK_KEYS
    );
    expect(mockSanitizeHtml).toHaveBeenCalledWith('<p>Hello</p>');
    expect(mockClearDemoState).toHaveBeenCalled();
  });

  it('should deduplicate tags by case-insensitive name', async () => {
    mockGetDemoDataForMigration.mockReturnValue({
      notes: [{ title: 'Note', content: '<p>x</p>', tagIds: ['demo-tag-1'] }],
      tags: [{ localId: 'demo-tag-1', name: 'Journal', color: 'terracotta' }],
    });
    // Existing tag with same name but different case
    mockFetchTagsOffline.mockResolvedValue([
      { id: 'existing-tag-1', name: 'journal', color: 'gold' },
    ]);
    mockCreateEncryptedNote.mockResolvedValue({ id: 'note-1', title: 'Note', content: '<p>x</p>' });

    const result = await migrateDemoToAccount(TEST_USER, MOCK_KEYS);

    // Should NOT create a new tag — should reuse existing
    expect(mockCreateTagOffline).not.toHaveBeenCalled();
    expect(result.newTags).toHaveLength(0);
    // Should add the existing tag to the note
    expect(mockAddTagToNoteOffline).toHaveBeenCalledWith(TEST_USER, 'note-1', 'existing-tag-1');
  });

  it('should create new tags when no match exists', async () => {
    mockGetDemoDataForMigration.mockReturnValue({
      notes: [{ title: 'Note', content: '<p>x</p>', tagIds: ['demo-tag-1'] }],
      tags: [{ localId: 'demo-tag-1', name: 'Ideas', color: 'gold' }],
    });
    mockFetchTagsOffline.mockResolvedValue([]);
    mockCreateTagOffline.mockResolvedValue({ id: 'new-tag-1', name: 'Ideas', color: 'gold' });
    mockCreateEncryptedNote.mockResolvedValue({ id: 'note-1', title: 'Note', content: '<p>x</p>' });

    const result = await migrateDemoToAccount(TEST_USER, MOCK_KEYS);

    expect(mockCreateTagOffline).toHaveBeenCalledWith(TEST_USER, 'Ideas', 'gold');
    expect(result.newTags).toHaveLength(1);
    expect(result.newTags[0].name).toBe('Ideas');
  });

  it('should handle notes with multiple tags', async () => {
    mockGetDemoDataForMigration.mockReturnValue({
      notes: [{ title: 'Note', content: '<p>x</p>', tagIds: ['t1', 't2'] }],
      tags: [
        { localId: 't1', name: 'Tag1', color: 'terracotta' },
        { localId: 't2', name: 'Tag2', color: 'gold' },
      ],
    });
    mockFetchTagsOffline.mockResolvedValue([]);
    mockCreateTagOffline
      .mockResolvedValueOnce({ id: 'new-t1', name: 'Tag1', color: 'terracotta' })
      .mockResolvedValueOnce({ id: 'new-t2', name: 'Tag2', color: 'gold' });
    mockCreateEncryptedNote.mockResolvedValue({ id: 'note-1', title: 'Note', content: '<p>x</p>' });

    const result = await migrateDemoToAccount(TEST_USER, MOCK_KEYS);

    expect(mockAddTagToNoteOffline).toHaveBeenCalledTimes(2);
    expect(result.migratedNotes[0].tags).toHaveLength(2);
  });

  it('should handle multiple notes', async () => {
    mockGetDemoDataForMigration.mockReturnValue({
      notes: [
        { title: 'Note 1', content: '<p>A</p>', tagIds: [] },
        { title: 'Note 2', content: '<p>B</p>', tagIds: [] },
        { title: 'Note 3', content: '<p>C</p>', tagIds: [] },
      ],
      tags: [],
    });
    mockFetchTagsOffline.mockResolvedValue([]);
    mockCreateEncryptedNote
      .mockResolvedValueOnce({ id: 'n1', title: 'Note 1', content: '<p>A</p>' })
      .mockResolvedValueOnce({ id: 'n2', title: 'Note 2', content: '<p>B</p>' })
      .mockResolvedValueOnce({ id: 'n3', title: 'Note 3', content: '<p>C</p>' });

    const result = await migrateDemoToAccount(TEST_USER, MOCK_KEYS);

    expect(result.noteCount).toBe(3);
    expect(result.migratedNotes).toHaveLength(3);
    expect(mockCreateEncryptedNote).toHaveBeenCalledTimes(3);
  });

  it('should skip tags with no mapping (orphaned tagIds)', async () => {
    mockGetDemoDataForMigration.mockReturnValue({
      notes: [{ title: 'Note', content: '<p>x</p>', tagIds: ['nonexistent-tag'] }],
      tags: [], // No tags defined, so no mapping for 'nonexistent-tag'
    });
    mockFetchTagsOffline.mockResolvedValue([]);
    mockCreateEncryptedNote.mockResolvedValue({ id: 'note-1', title: 'Note', content: '<p>x</p>' });

    const result = await migrateDemoToAccount(TEST_USER, MOCK_KEYS);

    expect(mockAddTagToNoteOffline).not.toHaveBeenCalled();
    expect(result.migratedNotes[0].tags).toHaveLength(0);
  });

  it('should sanitize note content during migration', async () => {
    mockGetDemoDataForMigration.mockReturnValue({
      notes: [{ title: 'Note', content: '<script>alert("xss")</script><p>Safe</p>', tagIds: [] }],
      tags: [],
    });
    mockFetchTagsOffline.mockResolvedValue([]);
    mockSanitizeHtml.mockReturnValue('<p>Safe</p>');
    mockCreateEncryptedNote.mockResolvedValue({ id: 'note-1', title: 'Note', content: '<p>Safe</p>' });

    await migrateDemoToAccount(TEST_USER, MOCK_KEYS);

    expect(mockSanitizeHtml).toHaveBeenCalledWith('<script>alert("xss")</script><p>Safe</p>');
    expect(mockCreateEncryptedNote).toHaveBeenCalledWith(
      TEST_USER, 'Note', '<p>Safe</p>', MOCK_KEYS
    );
  });

  it('should NOT clear demo state if migration throws', async () => {
    mockGetDemoDataForMigration.mockReturnValue({
      notes: [{ title: 'Note', content: '<p>x</p>', tagIds: [] }],
      tags: [],
    });
    mockFetchTagsOffline.mockResolvedValue([]);
    mockCreateEncryptedNote.mockRejectedValue(new Error('Encryption failed'));

    await expect(migrateDemoToAccount(TEST_USER, MOCK_KEYS)).rejects.toThrow('Encryption failed');
    expect(mockClearDemoState).not.toHaveBeenCalled();
  });
});
