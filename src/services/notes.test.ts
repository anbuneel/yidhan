import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchNotes,
  createNote,
  createNotesBatch,
  updateNote,
  softDeleteNote,
  restoreNote,
  permanentDeleteNote,
  toggleNotePin,
  searchNotes,
  fetchFadedNotes,
  countFadedNotes,
  emptyFadedNotes,
  cleanupExpiredFadedNotes,
  subscribeToNotes,
  createNoteShare,
  getNoteShare,
  updateNoteShareExpiration,
  revokeNoteShare,
  fetchSharedNote,
} from './notes';
import {
  createMockNote,
  createMockTag,
  createMockQueryBuilder,
  createMockChannel,
  type MockQueryBuilder,
  type MockChannel,
} from '../test/factories';

// Mock the supabase client with type-safe builders
vi.mock('../lib/supabase', () => {
  return {
    supabase: {
      from: vi.fn(() => createMockQueryBuilder()),
      channel: vi.fn(() => createMockChannel()),
      removeChannel: vi.fn().mockResolvedValue('ok'),
      rpc: vi.fn(),
    },
  };
});

// Import supabase after mocking
import { supabase } from '../lib/supabase';

// Type assertion helper for supabase.from mock - eliminates 'as never' throughout tests
function mockSupabaseFrom(builder: MockQueryBuilder): void {
  vi.mocked(supabase.from).mockReturnValue(builder);
}

// Type assertion helper for supabase.channel mock
function mockSupabaseChannel(channel: MockChannel): void {
  vi.mocked(supabase.channel).mockReturnValue(channel);
}

// Helper to create a chainable mock builder for fetchNotes
// fetchNotes calls .order() twice (for pinned and updated_at), so we track call count
// Client-side filtering happens after fetch, so mock returns all data for filter tests
function createFetchNotesBuilder(data: unknown[] = [], error: Error | null = null): MockQueryBuilder {
  let orderCallCount = 0;
  const mockBuilder = createMockQueryBuilder();
  mockBuilder.order = vi.fn().mockImplementation(() => {
    orderCallCount++;
    // Return this for first call (pinned), resolve on second call (updated_at)
    if (orderCallCount < 2) {
      return mockBuilder;
    }
    return Promise.resolve({ data, error });
  }) as MockQueryBuilder['order'];
  return mockBuilder;
}

// Helper to create a DB note (what Supabase returns)
function createDbNote(overrides: Partial<{
  id: string;
  user_id: string;
  title: string;
  content: string;
  pinned: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}> = {}) {
  return {
    id: 'db-note-id',
    user_id: 'user-123',
    title: 'Test Note',
    content: '<p>Test content</p>',
    pinned: false,
    deleted_at: null,
    created_at: '2024-01-01T12:00:00.000Z',
    updated_at: '2024-01-15T12:00:00.000Z',
    ...overrides,
  };
}

// Mock encryption module for share tests
vi.mock('../lib/encryption', () => ({
  generateShareToken: vi.fn(() => 'mock-share-token-22ch'),
  generateShareKey: vi.fn(() => new Uint8Array(32)),
  encryptSharePayload: vi.fn(() => Promise.resolve({
    ciphertext: 'encrypted-payload-base64',
    iv: 'mock-iv-base64',
    version: 1,
  })),
  fromBase64Url: vi.fn((s: string) => new Uint8Array(s.length)),
}));

// Helper to create a DB note share
function createDbNoteShare(overrides: Partial<{
  id: string;
  note_id: string;
  user_id: string;
  share_token: string;
  expires_at: string | null;
  created_at: string;
  encrypted_payload: string | null;
  iv: string | null;
  encryption_version: number;
  revoked_at: string | null;
}> = {}) {
  return {
    id: 'share-id',
    note_id: 'note-123',
    user_id: 'user-123',
    share_token: 'abc123def456',
    expires_at: null,
    created_at: '2024-01-15T12:00:00.000Z',
    encrypted_payload: 'encrypted-payload',
    iv: 'mock-iv',
    encryption_version: 1,
    revoked_at: null,
    ...overrides,
  };
}

describe('notes service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchNotes', () => {
    // fetchNotes calls .order() twice (for pinned and updated_at), so we need
    // orderCallsBeforeResolve=1 to chain the first call and resolve on the second
    it('returns empty array when no notes exist', async () => {
      const mockBuilder = createMockQueryBuilder({ data: [], orderCallsBeforeResolve: 1 });
      mockSupabaseFrom(mockBuilder);

      const result = await fetchNotes();

      expect(result).toEqual([]);
      expect(supabase.from).toHaveBeenCalledWith('notes');
    });

    it('returns notes with tags', async () => {
      const dbNotes = [
        {
          ...createDbNote({ id: '1', title: 'Note 1' }),
          note_tags: [
            { tags: { id: 't1', name: 'Work', color: 'terracotta', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' } },
          ],
        },
      ];
      const mockBuilder = createFetchNotesBuilder(dbNotes);
      mockSupabaseFrom(mockBuilder);

      const result = await fetchNotes();

      expect(result).toHaveLength(1);
      expect(result[0].tags).toHaveLength(1);
      expect(result[0].tags[0].name).toBe('Work');
    });

    it('excludes soft-deleted notes', async () => {
      const mockBuilder = createFetchNotesBuilder([]);
      mockSupabaseFrom(mockBuilder);

      await fetchNotes();

      expect(mockBuilder.is).toHaveBeenCalledWith('deleted_at', null);
    });

    it('filters by tag IDs using AND logic', async () => {
      const dbNotes = [
        {
          ...createDbNote({ id: '1' }),
          note_tags: [
            { tags: { id: 't1', name: 'Work', color: 'terracotta', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' } },
            { tags: { id: 't2', name: 'Important', color: 'gold', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' } },
          ],
        },
        {
          ...createDbNote({ id: '2' }),
          note_tags: [
            { tags: { id: 't1', name: 'Work', color: 'terracotta', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' } },
          ],
        },
      ];
      const mockBuilder = createFetchNotesBuilder(dbNotes);
      mockSupabaseFrom(mockBuilder);

      // Filter by both t1 AND t2
      const result = await fetchNotes(['t1', 't2']);

      // Only note 1 has both tags
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('orders by pinned first, then by updated_at', async () => {
      const mockBuilder = createFetchNotesBuilder([]);
      mockSupabaseFrom(mockBuilder);

      await fetchNotes();

      expect(mockBuilder.order).toHaveBeenCalledWith('pinned', { ascending: false });
      expect(mockBuilder.order).toHaveBeenCalledWith('updated_at', { ascending: false });
    });

    it('throws error when fetch fails', async () => {
      const mockBuilder = createFetchNotesBuilder([], new Error('Database error'));
      mockSupabaseFrom(mockBuilder);

      await expect(fetchNotes()).rejects.toThrow('Database error');
    });
  });

  describe('createNote', () => {
    it('creates a note with default empty values', async () => {
      const dbNote = createDbNote({ id: 'new-note' });
      const mockBuilder = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: dbNote, error: null }),
      };
      mockSupabaseFrom(mockBuilder);

      const result = await createNote('user-123');

      expect(result.id).toBe('new-note');
      expect(mockBuilder.insert).toHaveBeenCalledWith({
        user_id: 'user-123',
        title: '',
        content: '',
      });
    });

    it('creates a note with title and content', async () => {
      const dbNote = createDbNote({ title: 'My Note', content: '<p>Content</p>' });
      const mockBuilder = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: dbNote, error: null }),
      };
      mockSupabaseFrom(mockBuilder);

      const result = await createNote('user-123', 'My Note', '<p>Content</p>');

      expect(result.title).toBe('My Note');
      expect(result.content).toBe('<p>Content</p>');
    });

    it('preserves original timestamps when provided', async () => {
      const createdAt = new Date('2023-06-01T10:00:00Z');
      const updatedAt = new Date('2023-06-15T15:00:00Z');
      const dbNote = createDbNote();
      const mockBuilder = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: dbNote, error: null }),
      };
      mockSupabaseFrom(mockBuilder);

      await createNote('user-123', 'Imported Note', '<p>Content</p>', { createdAt, updatedAt });

      expect(mockBuilder.insert).toHaveBeenCalledWith({
        user_id: 'user-123',
        title: 'Imported Note',
        content: '<p>Content</p>',
        created_at: '2023-06-01T10:00:00.000Z',
        updated_at: '2023-06-15T15:00:00.000Z',
      });
    });

    it('returns note with empty tags array', async () => {
      const dbNote = createDbNote();
      const mockBuilder = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: dbNote, error: null }),
      };
      mockSupabaseFrom(mockBuilder);

      const result = await createNote('user-123');

      expect(result.tags).toEqual([]);
    });

    it('throws error when insert fails', async () => {
      const mockBuilder = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: new Error('Insert failed') }),
      };
      mockSupabaseFrom(mockBuilder);

      await expect(createNote('user-123')).rejects.toThrow('Insert failed');
    });
  });

  describe('createNotesBatch', () => {
    it('creates multiple notes in a single batch', async () => {
      const dbNotes = [
        createDbNote({ id: '1', title: 'Note 1' }),
        createDbNote({ id: '2', title: 'Note 2' }),
      ];
      const mockBuilder = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: dbNotes, error: null }),
      };
      mockSupabaseFrom(mockBuilder);

      const notes = [
        { title: 'Note 1', content: '<p>Content 1</p>' },
        { title: 'Note 2', content: '<p>Content 2</p>' },
      ];
      const result = await createNotesBatch('user-123', notes);

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Note 1');
      expect(result[1].title).toBe('Note 2');
    });

    it('returns empty array for empty input', async () => {
      const result = await createNotesBatch('user-123', []);

      expect(result).toEqual([]);
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('calls progress callback after each batch', async () => {
      const dbNotes = [createDbNote()];
      const mockBuilder = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: dbNotes, error: null }),
      };
      mockSupabaseFrom(mockBuilder);

      const onProgress = vi.fn();
      const notes = [{ title: 'Note', content: '' }];
      await createNotesBatch('user-123', notes, onProgress);

      expect(onProgress).toHaveBeenCalledWith(1, 1);
    });

    it('preserves timestamps during batch import', async () => {
      const dbNotes = [createDbNote()];
      const mockBuilder = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: dbNotes, error: null }),
      };
      mockSupabaseFrom(mockBuilder);

      const createdAt = new Date('2023-01-01T00:00:00Z');
      const notes = [{ title: 'Note', content: '', createdAt, updatedAt: createdAt }];
      await createNotesBatch('user-123', notes);

      expect(mockBuilder.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          created_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z',
        }),
      ]);
    });

    it('throws error when batch insert fails', async () => {
      const mockBuilder = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: null, error: new Error('Batch failed') }),
      };
      mockSupabaseFrom(mockBuilder);

      const notes = [{ title: 'Note', content: '' }];
      await expect(createNotesBatch('user-123', notes)).rejects.toThrow('Batch failed');
    });
  });

  describe('updateNote', () => {
    it('updates note title and content', async () => {
      const note = createMockNote({ id: 'note-123', title: 'Updated', content: '<p>New</p>' });
      const dbNote = createDbNote({ title: 'Updated', content: '<p>New</p>' });
      const mockBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: dbNote, error: null }),
      };
      mockSupabaseFrom(mockBuilder);

      const result = await updateNote(note);

      expect(result.title).toBe('Updated');
      expect(mockBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Updated', content: '<p>New</p>' })
      );
      expect(mockBuilder.eq).toHaveBeenCalledWith('id', 'note-123');
    });

    it('preserves existing tags', async () => {
      const tags = [createMockTag({ name: 'Work' })];
      const note = createMockNote({ tags });
      const dbNote = createDbNote();
      const mockBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: dbNote, error: null }),
      };
      mockSupabaseFrom(mockBuilder);

      const result = await updateNote(note);

      expect(result.tags).toEqual(tags);
    });

    it('does not send updated_at (server trigger handles it)', async () => {
      const note = createMockNote();
      const dbNote = createDbNote();
      const mockBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: dbNote, error: null }),
      };
      mockSupabaseFrom(mockBuilder);

      await updateNote(note);

      const payload = mockBuilder.update.mock.calls[0][0];
      expect(payload).not.toHaveProperty('updated_at');
    });

    it('throws error when update fails', async () => {
      const note = createMockNote();
      const mockBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: new Error('Update failed') }),
      };
      mockSupabaseFrom(mockBuilder);

      await expect(updateNote(note)).rejects.toThrow('Update failed');
    });
  });

  describe('softDeleteNote', () => {
    it('sets deleted_at timestamp', async () => {
      const mockBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      mockSupabaseFrom(mockBuilder);

      await softDeleteNote('note-123');

      expect(supabase.from).toHaveBeenCalledWith('notes');
      expect(mockBuilder.update).toHaveBeenCalledWith({
        deleted_at: expect.any(String),
      });
      expect(mockBuilder.eq).toHaveBeenCalledWith('id', 'note-123');
    });

    it('throws error when soft delete fails', async () => {
      const mockBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: new Error('Delete failed') }),
      };
      mockSupabaseFrom(mockBuilder);

      await expect(softDeleteNote('note-123')).rejects.toThrow('Delete failed');
    });
  });

  describe('restoreNote', () => {
    it('clears deleted_at timestamp', async () => {
      const mockBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      mockSupabaseFrom(mockBuilder);

      await restoreNote('note-123');

      expect(mockBuilder.update).toHaveBeenCalledWith({ deleted_at: null });
      expect(mockBuilder.eq).toHaveBeenCalledWith('id', 'note-123');
    });

    it('throws error when restore fails', async () => {
      const mockBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: new Error('Restore failed') }),
      };
      mockSupabaseFrom(mockBuilder);

      await expect(restoreNote('note-123')).rejects.toThrow('Restore failed');
    });
  });

  describe('permanentDeleteNote', () => {
    it('permanently deletes a note', async () => {
      const mockBuilder = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      mockSupabaseFrom(mockBuilder);

      await permanentDeleteNote('note-123');

      expect(supabase.from).toHaveBeenCalledWith('notes');
      expect(mockBuilder.delete).toHaveBeenCalled();
      expect(mockBuilder.eq).toHaveBeenCalledWith('id', 'note-123');
    });

    it('throws error when permanent delete fails', async () => {
      const mockBuilder = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: new Error('Delete failed') }),
      };
      mockSupabaseFrom(mockBuilder);

      await expect(permanentDeleteNote('note-123')).rejects.toThrow('Delete failed');
    });
  });

  describe('toggleNotePin', () => {
    it('pins a note', async () => {
      const mockBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      mockSupabaseFrom(mockBuilder);

      await toggleNotePin('note-123', true);

      expect(mockBuilder.update).toHaveBeenCalledWith({ pinned: true });
      expect(mockBuilder.eq).toHaveBeenCalledWith('id', 'note-123');
    });

    it('unpins a note', async () => {
      const mockBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      mockSupabaseFrom(mockBuilder);

      await toggleNotePin('note-123', false);

      expect(mockBuilder.update).toHaveBeenCalledWith({ pinned: false });
    });

    it('throws error when toggle fails', async () => {
      const mockBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: new Error('Toggle failed') }),
      };
      mockSupabaseFrom(mockBuilder);

      await expect(toggleNotePin('note-123', true)).rejects.toThrow('Toggle failed');
    });
  });

  describe('searchNotes', () => {
    // Helper to create a chainable mock builder for searchNotes
    function createSearchBuilder(data: unknown[] = [], error: Error | null = null, includeOr = true) {
      let orderCallCount = 0;
      const mockBuilder: Record<string, ReturnType<typeof vi.fn>> = {
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockImplementation(function(this: typeof mockBuilder) {
          orderCallCount++;
          if (orderCallCount < 2) {
            return this;
          }
          return Promise.resolve({ data, error });
        }),
      };
      if (includeOr) {
        mockBuilder.or = vi.fn().mockReturnThis();
      }
      return mockBuilder;
    }

    it('returns all notes for empty query', async () => {
      const dbNotes = [{ ...createDbNote(), note_tags: [] }];
      // Empty query calls fetchNotes, not the search path
      const mockBuilder = createSearchBuilder(dbNotes, null, false);
      mockSupabaseFrom(mockBuilder);

      const result = await searchNotes('');

      expect(result).toHaveLength(1);
    });

    it('searches by title and content', async () => {
      const dbNotes = [{ ...createDbNote({ title: 'Found' }), note_tags: [] }];
      const mockBuilder = createSearchBuilder(dbNotes);
      mockSupabaseFrom(mockBuilder);

      const result = await searchNotes('test');

      expect(mockBuilder.or).toHaveBeenCalledWith('title.ilike."%test%",content.ilike."%test%"');
      expect(result).toHaveLength(1);
    });

    it('excludes soft-deleted notes from search', async () => {
      const mockBuilder = createSearchBuilder([]);
      mockSupabaseFrom(mockBuilder);

      await searchNotes('query');

      expect(mockBuilder.is).toHaveBeenCalledWith('deleted_at', null);
    });

    it('throws error when search fails', async () => {
      const mockBuilder = createSearchBuilder([], new Error('Search failed'));
      mockSupabaseFrom(mockBuilder);

      await expect(searchNotes('query')).rejects.toThrow('Search failed');
    });
  });

  describe('fetchFadedNotes', () => {
    it('returns only soft-deleted notes', async () => {
      const dbNotes = [
        { ...createDbNote({ deleted_at: '2024-01-10T00:00:00Z' }), note_tags: [] },
      ];
      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: dbNotes, error: null }),
      };
      mockSupabaseFrom(mockBuilder);

      const result = await fetchFadedNotes();

      expect(result).toHaveLength(1);
      expect(result[0].deletedAt).toBeTruthy();
      expect(mockBuilder.not).toHaveBeenCalledWith('deleted_at', 'is', null);
    });

    it('orders by deleted_at descending', async () => {
      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      mockSupabaseFrom(mockBuilder);

      await fetchFadedNotes();

      expect(mockBuilder.order).toHaveBeenCalledWith('deleted_at', { ascending: false });
    });

    it('throws error when fetch fails', async () => {
      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: new Error('Fetch failed') }),
      };
      mockSupabaseFrom(mockBuilder);

      await expect(fetchFadedNotes()).rejects.toThrow('Fetch failed');
    });
  });

  describe('countFadedNotes', () => {
    it('returns count of faded notes', async () => {
      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        not: vi.fn().mockResolvedValue({ count: 5, error: null }),
      };
      mockSupabaseFrom(mockBuilder);

      const result = await countFadedNotes();

      expect(result).toBe(5);
      expect(mockBuilder.select).toHaveBeenCalledWith('*', { count: 'exact', head: true });
    });

    it('returns 0 when no faded notes', async () => {
      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        not: vi.fn().mockResolvedValue({ count: null, error: null }),
      };
      mockSupabaseFrom(mockBuilder);

      const result = await countFadedNotes();

      expect(result).toBe(0);
    });

    it('throws error when count fails', async () => {
      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        not: vi.fn().mockResolvedValue({ count: null, error: new Error('Count failed') }),
      };
      mockSupabaseFrom(mockBuilder);

      await expect(countFadedNotes()).rejects.toThrow('Count failed');
    });
  });

  describe('emptyFadedNotes', () => {
    it('permanently deletes all faded notes', async () => {
      const mockBuilder = {
        delete: vi.fn().mockReturnThis(),
        not: vi.fn().mockResolvedValue({ error: null }),
      };
      mockSupabaseFrom(mockBuilder);

      await emptyFadedNotes();

      expect(supabase.from).toHaveBeenCalledWith('notes');
      expect(mockBuilder.delete).toHaveBeenCalled();
      expect(mockBuilder.not).toHaveBeenCalledWith('deleted_at', 'is', null);
    });

    it('throws error when empty fails', async () => {
      const mockBuilder = {
        delete: vi.fn().mockReturnThis(),
        not: vi.fn().mockResolvedValue({ error: new Error('Empty failed') }),
      };
      mockSupabaseFrom(mockBuilder);

      await expect(emptyFadedNotes()).rejects.toThrow('Empty failed');
    });
  });

  describe('cleanupExpiredFadedNotes', () => {
    it('deletes notes older than 30 days', async () => {
      const mockBuilder = {
        delete: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: [{ id: '1' }, { id: '2' }], error: null }),
      };
      mockSupabaseFrom(mockBuilder);

      const result = await cleanupExpiredFadedNotes();

      expect(result).toBe(2);
      expect(mockBuilder.not).toHaveBeenCalledWith('deleted_at', 'is', null);
      expect(mockBuilder.lt).toHaveBeenCalledWith('deleted_at', expect.any(String));
    });

    it('returns 0 when no expired notes', async () => {
      const mockBuilder = {
        delete: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      mockSupabaseFrom(mockBuilder);

      const result = await cleanupExpiredFadedNotes();

      expect(result).toBe(0);
    });

    it('returns 0 on error without throwing', async () => {
      const mockBuilder = {
        delete: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: null, error: new Error('Cleanup failed') }),
      };
      mockSupabaseFrom(mockBuilder);

      // Should not throw - cleanup is non-critical
      const result = await cleanupExpiredFadedNotes();

      expect(result).toBe(0);
    });
  });

  describe('subscribeToNotes', () => {
    it('creates channel subscription for note changes', () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnValue({ status: 'SUBSCRIBED' }),
      };
      mockSupabaseChannel(mockChannel);

      subscribeToNotes('user-123', vi.fn(), vi.fn(), vi.fn());

      expect(supabase.channel).toHaveBeenCalledWith('notes-changes');
      expect(mockChannel.on).toHaveBeenCalledTimes(3);
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });

    it('returns unsubscribe function', () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnValue({ status: 'SUBSCRIBED' }),
      };
      mockSupabaseChannel(mockChannel);

      const unsubscribe = subscribeToNotes('user-123', vi.fn(), vi.fn(), vi.fn());

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
      expect(supabase.removeChannel).toHaveBeenCalled();
    });

    it('subscribes to INSERT, UPDATE, DELETE events', () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnValue({ status: 'SUBSCRIBED' }),
      };
      mockSupabaseChannel(mockChannel);

      subscribeToNotes('user-123', vi.fn(), vi.fn(), vi.fn());

      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({ event: 'INSERT', table: 'notes' }),
        expect.any(Function)
      );
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({ event: 'UPDATE', table: 'notes' }),
        expect.any(Function)
      );
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({ event: 'DELETE', table: 'notes' }),
        expect.any(Function)
      );
    });
  });

  describe('createNoteShare', () => {
    const mockNote = createMockNote({
      id: 'note-123',
      title: 'Test Note',
      content: '<p>Hello</p>',
      tags: [],
    });

    it('creates share via insert when no existing row', async () => {
      const dbShare = createDbNoteShare({
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
      // First call: check for existing row → null
      const checkBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      // Second call: insert new row
      const insertBuilder = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: dbShare, error: null }),
      };
      vi.mocked(supabase.from)
        .mockReturnValueOnce(checkBuilder)
        .mockReturnValueOnce(insertBuilder);

      const result = await createNoteShare('note-123', 'user-123', mockNote, 7);

      expect(result.share.noteId).toBe('note-123');
      expect(result.shareKey).toBeInstanceOf(Uint8Array);
      expect(result.shareKey.length).toBe(32);
    });

    it('upserts when existing row found', async () => {
      const dbShare = createDbNoteShare();
      // First call: check for existing row → found
      const checkBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'existing-id' }, error: null }),
      };
      // Second call: update existing row
      const updateBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: dbShare, error: null }),
      };
      vi.mocked(supabase.from)
        .mockReturnValueOnce(checkBuilder)
        .mockReturnValueOnce(updateBuilder);

      const result = await createNoteShare('note-123', 'user-123', mockNote, 7);

      expect(result.share).toBeTruthy();
      expect(updateBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          share_token: expect.any(String),
          encrypted_payload: expect.any(String),
          iv: expect.any(String),
          revoked_at: null,
        })
      );
    });

    it('caps expiration at 30 days', async () => {
      const dbShare = createDbNoteShare();
      const checkBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      const insertBuilder = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: dbShare, error: null }),
      };
      vi.mocked(supabase.from)
        .mockReturnValueOnce(checkBuilder)
        .mockReturnValueOnce(insertBuilder);

      await createNoteShare('note-123', 'user-123', mockNote, 90);

      // Verify the inserted expiry is ~30 days out, not 90
      const insertCall = insertBuilder.insert.mock.calls[0][0];
      const expiryDate = new Date(insertCall.expires_at);
      const daysDiff = (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeLessThanOrEqual(31);
      expect(daysDiff).toBeGreaterThan(29);
    });

    it('throws error when insert fails', async () => {
      const checkBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      const insertBuilder = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: new Error('Insert failed') }),
      };
      vi.mocked(supabase.from)
        .mockReturnValueOnce(checkBuilder)
        .mockReturnValueOnce(insertBuilder);

      await expect(
        createNoteShare('note-123', 'user-123', mockNote)
      ).rejects.toThrow('Insert failed');
    });
  });

  describe('getNoteShare', () => {
    it('returns active share for note', async () => {
      const dbShare = createDbNoteShare({
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      });
      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: dbShare, error: null }),
      };
      mockSupabaseFrom(mockBuilder);

      const result = await getNoteShare('note-123');

      expect(result).toBeTruthy();
      expect(result!.noteId).toBe('note-123');
      // Should filter revoked shares
      expect(mockBuilder.is).toHaveBeenCalledWith('revoked_at', null);
    });

    it('returns null when no share exists', async () => {
      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      mockSupabaseFrom(mockBuilder);

      const result = await getNoteShare('note-123');

      expect(result).toBeNull();
    });

    it('returns null for expired share (client-side check)', async () => {
      const dbShare = createDbNoteShare({
        expires_at: new Date(Date.now() - 1000).toISOString(),
      });
      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: dbShare, error: null }),
      };
      mockSupabaseFrom(mockBuilder);

      const result = await getNoteShare('note-123');

      expect(result).toBeNull();
    });

    it('throws error when fetch fails', async () => {
      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: new Error('Fetch failed') }),
      };
      mockSupabaseFrom(mockBuilder);

      await expect(getNoteShare('note-123')).rejects.toThrow('Fetch failed');
    });
  });

  describe('updateNoteShareExpiration', () => {
    it('updates expiration date', async () => {
      const dbShare = createDbNoteShare({
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
      const mockBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: dbShare, error: null }),
      };
      mockSupabaseFrom(mockBuilder);

      const result = await updateNoteShareExpiration('note-123', 30);

      expect(result.expiresAt).toBeTruthy();
      expect(mockBuilder.update).toHaveBeenCalledWith({
        expires_at: expect.any(String),
      });
      // Should filter revoked shares
      expect(mockBuilder.is).toHaveBeenCalledWith('revoked_at', null);
    });

    it('caps at 30 days even if more requested', async () => {
      const dbShare = createDbNoteShare();
      const mockBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: dbShare, error: null }),
      };
      mockSupabaseFrom(mockBuilder);

      await updateNoteShareExpiration('note-123', 90);

      const updateCall = mockBuilder.update.mock.calls[0][0];
      const expiryDate = new Date(updateCall.expires_at);
      const daysDiff = (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeLessThanOrEqual(31);
      expect(daysDiff).toBeGreaterThan(29);
    });

    it('throws error when update fails', async () => {
      const mockBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: new Error('Update failed') }),
      };
      mockSupabaseFrom(mockBuilder);

      await expect(updateNoteShareExpiration('note-123', 7)).rejects.toThrow('Update failed');
    });
  });

  describe('revokeNoteShare', () => {
    it('soft-deletes by setting revoked_at', async () => {
      const mockBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ error: null }),
      };
      mockSupabaseFrom(mockBuilder);

      await revokeNoteShare('note-123');

      expect(supabase.from).toHaveBeenCalledWith('note_shares');
      expect(mockBuilder.update).toHaveBeenCalledWith({
        revoked_at: expect.any(String),
      });
      expect(mockBuilder.eq).toHaveBeenCalledWith('note_id', 'note-123');
      expect(mockBuilder.is).toHaveBeenCalledWith('revoked_at', null);
    });

    it('throws error when revoke fails', async () => {
      const mockBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ error: new Error('Revoke failed') }),
      };
      mockSupabaseFrom(mockBuilder);

      await expect(revokeNoteShare('note-123')).rejects.toThrow('Revoke failed');
    });
  });

  describe('fetchSharedNote', () => {
    it('returns encrypted data via RPC for valid token', async () => {
      const rpcResult = [{
        encrypted_payload: 'ciphertext-base64',
        iv: 'iv-base64',
        encryption_version: 1,
      }];
      vi.mocked(supabase.rpc).mockResolvedValue({ data: rpcResult, error: null });

      const result = await fetchSharedNote('valid-token');

      expect(result).toEqual({
        ciphertext: 'ciphertext-base64',
        iv: 'iv-base64',
        version: 1,
      });
      expect(supabase.rpc).toHaveBeenCalledWith('fetch_shared_note', {
        share_token_param: 'valid-token',
      });
    });

    it('returns null for invalid/expired/revoked token (empty RPC result)', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null });

      const result = await fetchSharedNote('bad-token');

      expect(result).toBeNull();
    });

    it('returns null when RPC returns null data', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null });

      const result = await fetchSharedNote('bad-token');

      expect(result).toBeNull();
    });

    it('throws on RPC error', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: new Error('RPC error'),
      });

      await expect(fetchSharedNote('token')).rejects.toThrow('RPC error');
    });
  });
});
