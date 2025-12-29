import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchTags,
  createTag,
  updateTag,
  deleteTag,
  addTagToNote,
  removeTagFromNote,
  subscribeToTags,
} from './tags';
import {
  TAG_COLOR_OPTIONS,
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

// Helper to create a DB tag (what Supabase returns)
function createDbTag(overrides: Partial<{
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}> = {}) {
  return {
    id: 'db-tag-id',
    user_id: 'user-123',
    name: 'Test Tag',
    color: 'terracotta',
    created_at: '2024-01-01T12:00:00.000Z',
    ...overrides,
  };
}

describe('tags service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchTags', () => {
    it('returns empty array when no tags exist', async () => {
      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      mockSupabaseFrom(mockBuilder);

      const result = await fetchTags();

      expect(result).toEqual([]);
      expect(supabase.from).toHaveBeenCalledWith('tags');
      expect(mockBuilder.select).toHaveBeenCalledWith('*');
      expect(mockBuilder.order).toHaveBeenCalledWith('name', { ascending: true });
    });

    it('returns tags ordered by name', async () => {
      const dbTags = [
        createDbTag({ id: '1', name: 'Alpha' }),
        createDbTag({ id: '2', name: 'Beta' }),
        createDbTag({ id: '3', name: 'Gamma' }),
      ];
      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: dbTags, error: null }),
      };
      mockSupabaseFrom(mockBuilder);

      const result = await fetchTags();

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('Alpha');
      expect(result[1].name).toBe('Beta');
      expect(result[2].name).toBe('Gamma');
    });

    it('converts database tags to app tags', async () => {
      const dbTag = createDbTag({
        id: 'tag-123',
        name: 'Work',
        color: 'forest',
        created_at: '2024-06-15T10:30:00.000Z',
      });
      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [dbTag], error: null }),
      };
      mockSupabaseFrom(mockBuilder);

      const result = await fetchTags();

      expect(result[0]).toEqual({
        id: 'tag-123',
        name: 'Work',
        color: 'forest',
        createdAt: new Date('2024-06-15T10:30:00.000Z'),
      });
    });

    it('throws error when fetch fails', async () => {
      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: null,
          error: new Error('Database error')
        }),
      };
      mockSupabaseFrom(mockBuilder);

      await expect(fetchTags()).rejects.toThrow('Database error');
    });
  });

  describe('createTag', () => {
    it('creates a tag with valid name and color', async () => {
      const dbTag = createDbTag({ id: 'new-tag', name: 'Projects', color: 'gold' });
      const mockBuilder = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: dbTag, error: null }),
      };
      mockSupabaseFrom(mockBuilder);

      const result = await createTag('user-123', 'Projects', 'gold');

      expect(result.name).toBe('Projects');
      expect(result.color).toBe('gold');
      expect(mockBuilder.insert).toHaveBeenCalledWith({
        user_id: 'user-123',
        name: 'Projects',
        color: 'gold',
      });
    });

    it('trims whitespace from tag name', async () => {
      const dbTag = createDbTag({ name: 'Trimmed' });
      const mockBuilder = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: dbTag, error: null }),
      };
      mockSupabaseFrom(mockBuilder);

      await createTag('user-123', '  Trimmed  ', 'terracotta');

      expect(mockBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Trimmed' })
      );
    });

    it('throws error for empty tag name', async () => {
      await expect(createTag('user-123', '', 'terracotta'))
        .rejects.toThrow('Tag name cannot be empty');
    });

    it('throws error for whitespace-only tag name', async () => {
      await expect(createTag('user-123', '   ', 'terracotta'))
        .rejects.toThrow('Tag name cannot be empty');
    });

    it('throws error for tag name exceeding 20 characters', async () => {
      const longName = 'a'.repeat(21);
      await expect(createTag('user-123', longName, 'terracotta'))
        .rejects.toThrow('Tag name must be 20 characters or less');
    });

    it('accepts tag name with exactly 20 characters', async () => {
      const dbTag = createDbTag({ name: 'a'.repeat(20) });
      const mockBuilder = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: dbTag, error: null }),
      };
      mockSupabaseFrom(mockBuilder);

      const result = await createTag('user-123', 'a'.repeat(20), 'terracotta');

      expect(result.name).toBe('a'.repeat(20));
    });

    it('throws error when database insert fails', async () => {
      const mockBuilder = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: new Error('Duplicate tag name')
        }),
      };
      mockSupabaseFrom(mockBuilder);

      await expect(createTag('user-123', 'Duplicate', 'terracotta'))
        .rejects.toThrow('Duplicate tag name');
    });

    it('creates tags with all valid colors', async () => {
      for (const color of TAG_COLOR_OPTIONS) {
        const dbTag = createDbTag({ color });
        const mockBuilder = {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: dbTag, error: null }),
        };
        mockSupabaseFrom(mockBuilder);

        const result = await createTag('user-123', 'Test', color);
        expect(result.color).toBe(color);
      }
    });
  });

  describe('updateTag', () => {
    it('updates tag name', async () => {
      const dbTag = createDbTag({ name: 'Updated Name' });
      const mockBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: dbTag, error: null }),
      };
      mockSupabaseFrom(mockBuilder);

      const result = await updateTag('tag-123', { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
      expect(mockBuilder.update).toHaveBeenCalledWith({ name: 'Updated Name' });
      expect(mockBuilder.eq).toHaveBeenCalledWith('id', 'tag-123');
    });

    it('updates tag color', async () => {
      const dbTag = createDbTag({ color: 'forest' });
      const mockBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: dbTag, error: null }),
      };
      mockSupabaseFrom(mockBuilder);

      const result = await updateTag('tag-123', { color: 'forest' });

      expect(result.color).toBe('forest');
      expect(mockBuilder.update).toHaveBeenCalledWith({ color: 'forest' });
    });

    it('updates both name and color', async () => {
      const dbTag = createDbTag({ name: 'New Name', color: 'gold' });
      const mockBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: dbTag, error: null }),
      };
      mockSupabaseFrom(mockBuilder);

      const result = await updateTag('tag-123', { name: 'New Name', color: 'gold' });

      expect(result.name).toBe('New Name');
      expect(result.color).toBe('gold');
      expect(mockBuilder.update).toHaveBeenCalledWith({
        name: 'New Name',
        color: 'gold'
      });
    });

    it('validates name when updating with too long name', async () => {
      await expect(updateTag('tag-123', { name: 'a'.repeat(21) }))
        .rejects.toThrow('Tag name must be 20 characters or less');
    });

    it('trims and validates name when updating', async () => {
      // Empty string after trim should fail validation
      await expect(updateTag('tag-123', { name: '   ' }))
        .rejects.toThrow('Tag name cannot be empty');
    });

    it('throws error when update fails', async () => {
      const mockBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: new Error('Update failed')
        }),
      };
      mockSupabaseFrom(mockBuilder);

      await expect(updateTag('tag-123', { name: 'Valid' }))
        .rejects.toThrow('Update failed');
    });
  });

  describe('deleteTag', () => {
    it('deletes a tag by id', async () => {
      const mockBuilder = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      mockSupabaseFrom(mockBuilder);

      await deleteTag('tag-123');

      expect(supabase.from).toHaveBeenCalledWith('tags');
      expect(mockBuilder.delete).toHaveBeenCalled();
      expect(mockBuilder.eq).toHaveBeenCalledWith('id', 'tag-123');
    });

    it('throws error when delete fails', async () => {
      const mockBuilder = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: new Error('Delete failed') }),
      };
      mockSupabaseFrom(mockBuilder);

      await expect(deleteTag('tag-123')).rejects.toThrow('Delete failed');
    });
  });

  describe('addTagToNote', () => {
    it('adds a tag to a note', async () => {
      const mockBuilder = {
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
      mockSupabaseFrom(mockBuilder);

      await addTagToNote('note-123', 'tag-456');

      expect(supabase.from).toHaveBeenCalledWith('note_tags');
      expect(mockBuilder.insert).toHaveBeenCalledWith({
        note_id: 'note-123',
        tag_id: 'tag-456',
      });
    });

    it('ignores duplicate key error (tag already added)', async () => {
      const duplicateError = { code: '23505', message: 'Duplicate key' };
      const mockBuilder = {
        insert: vi.fn().mockResolvedValue({ error: duplicateError }),
      };
      mockSupabaseFrom(mockBuilder);

      // Should not throw
      await expect(addTagToNote('note-123', 'tag-456')).resolves.toBeUndefined();
    });

    it('throws error for non-duplicate errors', async () => {
      const otherError = { code: '12345', message: 'Some other error' };
      const mockBuilder = {
        insert: vi.fn().mockResolvedValue({ error: otherError }),
      };
      mockSupabaseFrom(mockBuilder);

      await expect(addTagToNote('note-123', 'tag-456'))
        .rejects.toEqual(otherError);
    });
  });

  describe('removeTagFromNote', () => {
    it('removes a tag from a note', async () => {
      const mockBuilder = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation(function(this: typeof mockBuilder) {
          return this;
        }),
      };
      // Make the second eq call resolve the promise
      mockBuilder.eq.mockImplementationOnce(function(this: typeof mockBuilder) {
        return this;
      }).mockResolvedValueOnce({ error: null });

      mockSupabaseFrom(mockBuilder);

      await removeTagFromNote('note-123', 'tag-456');

      expect(supabase.from).toHaveBeenCalledWith('note_tags');
      expect(mockBuilder.delete).toHaveBeenCalled();
      expect(mockBuilder.eq).toHaveBeenCalledWith('note_id', 'note-123');
      expect(mockBuilder.eq).toHaveBeenCalledWith('tag_id', 'tag-456');
    });

    it('throws error when remove fails', async () => {
      const mockBuilder = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation(function(this: typeof mockBuilder) {
          return this;
        }),
      };
      mockBuilder.eq.mockImplementationOnce(function(this: typeof mockBuilder) {
        return this;
      }).mockResolvedValueOnce({ error: new Error('Remove failed') });

      mockSupabaseFrom(mockBuilder);

      await expect(removeTagFromNote('note-123', 'tag-456'))
        .rejects.toThrow('Remove failed');
    });
  });

  describe('subscribeToTags', () => {
    it('creates a channel subscription for tag changes', () => {
      const onInsert = vi.fn();
      const onUpdate = vi.fn();
      const onDelete = vi.fn();
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnValue({ status: 'SUBSCRIBED' }),
      };
      mockSupabaseChannel(mockChannel);

      subscribeToTags('user-123', onInsert, onUpdate, onDelete);

      expect(supabase.channel).toHaveBeenCalledWith('tags-changes');
      expect(mockChannel.on).toHaveBeenCalledTimes(3);
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });

    it('returns an unsubscribe function that removes the channel', () => {
      const mockChannelInstance = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnValue({ status: 'SUBSCRIBED' }),
      };
      mockSupabaseChannel(mockChannelInstance);

      const unsubscribe = subscribeToTags('user-123', vi.fn(), vi.fn(), vi.fn());

      expect(typeof unsubscribe).toBe('function');

      unsubscribe();

      // The channel instance (before .subscribe()) should be passed to removeChannel
      expect(supabase.removeChannel).toHaveBeenCalled();
    });

    it('subscribes to INSERT events with user filter', () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnValue({ status: 'SUBSCRIBED' }),
      };
      mockSupabaseChannel(mockChannel);

      subscribeToTags('user-123', vi.fn(), vi.fn(), vi.fn());

      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tags',
          filter: 'user_id=eq.user-123',
        },
        expect.any(Function)
      );
    });

    it('subscribes to UPDATE events with user filter', () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnValue({ status: 'SUBSCRIBED' }),
      };
      mockSupabaseChannel(mockChannel);

      subscribeToTags('user-123', vi.fn(), vi.fn(), vi.fn());

      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tags',
          filter: 'user_id=eq.user-123',
        },
        expect.any(Function)
      );
    });

    it('subscribes to DELETE events with user filter', () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnValue({ status: 'SUBSCRIBED' }),
      };
      mockSupabaseChannel(mockChannel);

      subscribeToTags('user-123', vi.fn(), vi.fn(), vi.fn());

      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'tags',
          filter: 'user_id=eq.user-123',
        },
        expect.any(Function)
      );
    });
  });
});
