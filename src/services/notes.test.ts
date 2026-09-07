import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
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
