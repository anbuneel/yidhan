import type { Note, Tag, TagColor, NoteShare } from '../types';
import type { Mock } from 'vitest';

/**
 * Test data factories for creating mock objects
 * Use these to create consistent test data across all test files
 */

// ============================================================================
// Supabase Mock Types
// ============================================================================

/**
 * Type-safe Supabase query builder mock
 * Provides proper typing for chained query methods and eliminates 'as never' casts
 */
export interface MockQueryBuilder {
  select: Mock<[], MockQueryBuilder>;
  insert: Mock<[unknown], MockQueryBuilder>;
  update: Mock<[unknown], MockQueryBuilder>;
  delete: Mock<[], MockQueryBuilder>;
  eq: Mock<[string, unknown], MockQueryBuilder>;
  is: Mock<[string, unknown], MockQueryBuilder>;
  not: Mock<[string, string, unknown], MockQueryBuilder>;
  lt: Mock<[string, string], MockQueryBuilder>;
  or: Mock<[string], MockQueryBuilder>;
  order: Mock<[string, { ascending: boolean }?], MockQueryBuilder | Promise<{ data: unknown; error: unknown }>>;
  single: Mock<[], Promise<{ data: unknown; error: unknown }>>;
  maybeSingle: Mock<[], Promise<{ data: unknown; error: unknown }>>;
}

/**
 * Type-safe Supabase realtime channel mock
 */
export interface MockChannel {
  on: Mock<[string, unknown, (payload: unknown) => void], MockChannel>;
  subscribe: Mock<[], { status: string }>;
}

/**
 * Type-safe mock Supabase client
 */
export interface MockSupabaseClient {
  from: Mock<[string], MockQueryBuilder>;
  channel: Mock<[string], MockChannel>;
  removeChannel: Mock<[MockChannel], Promise<string>>;
}

// ============================================================================
// Mock Builder Factories
// ============================================================================

/**
 * Create a type-safe mock query builder for Supabase operations
 *
 * @param options Configuration for the mock's final response
 * @returns A properly typed mock builder that can be used with vi.mocked(supabase.from)
 *
 * @example
 * // Basic usage - returns empty data
 * const builder = createMockQueryBuilder();
 * vi.mocked(supabase.from).mockReturnValue(builder);
 *
 * @example
 * // With data
 * const builder = createMockQueryBuilder({
 *   data: [{ id: '1', name: 'Test' }]
 * });
 *
 * @example
 * // With error
 * const builder = createMockQueryBuilder({
 *   error: new Error('Database error')
 * });
 *
 * @example
 * // With custom single() behavior
 * const builder = createMockQueryBuilder({
 *   singleResult: { data: { id: '1' }, error: null }
 * });
 */
export function createMockQueryBuilder(options: {
  data?: unknown;
  error?: unknown;
  singleResult?: { data: unknown; error: unknown };
  orderCallsBeforeResolve?: number;
} = {}): MockQueryBuilder {
  const {
    data = null,
    error = null,
    singleResult,
    orderCallsBeforeResolve = 0
  } = options;

  let orderCallCount = 0;

  const builder: MockQueryBuilder = {
    select: vi.fn().mockReturnThis() as Mock<[], MockQueryBuilder>,
    insert: vi.fn().mockReturnThis() as Mock<[unknown], MockQueryBuilder>,
    update: vi.fn().mockReturnThis() as Mock<[unknown], MockQueryBuilder>,
    delete: vi.fn().mockReturnThis() as Mock<[], MockQueryBuilder>,
    eq: vi.fn().mockReturnThis() as Mock<[string, unknown], MockQueryBuilder>,
    is: vi.fn().mockReturnThis() as Mock<[string, unknown], MockQueryBuilder>,
    not: vi.fn().mockReturnThis() as Mock<[string, string, unknown], MockQueryBuilder>,
    lt: vi.fn().mockReturnThis() as Mock<[string, string], MockQueryBuilder>,
    or: vi.fn().mockReturnThis() as Mock<[string], MockQueryBuilder>,
    order: vi.fn().mockImplementation(() => {
      orderCallCount++;
      if (orderCallCount <= orderCallsBeforeResolve) {
        return builder;
      }
      return Promise.resolve({ data, error });
    }) as Mock<[string, { ascending: boolean }?], MockQueryBuilder | Promise<{ data: unknown; error: unknown }>>,
    single: vi.fn().mockResolvedValue(
      singleResult ?? { data, error }
    ) as Mock<[], Promise<{ data: unknown; error: unknown }>>,
    maybeSingle: vi.fn().mockResolvedValue(
      singleResult ?? { data, error }
    ) as Mock<[], Promise<{ data: unknown; error: unknown }>>,
  };

  return builder;
}

/**
 * Create a type-safe mock realtime channel for Supabase subscriptions
 *
 * @example
 * const channel = createMockChannel();
 * vi.mocked(supabase.channel).mockReturnValue(channel);
 */
export function createMockChannel(): MockChannel {
  const channel: MockChannel = {
    on: vi.fn().mockReturnThis() as Mock<[string, unknown, (payload: unknown) => void], MockChannel>,
    subscribe: vi.fn().mockReturnValue({ status: 'SUBSCRIBED' }) as Mock<[], { status: string }>,
  };
  return channel;
}

// Need to import vi for the mock functions
import { vi } from 'vitest';

// ============================================================================
// Data Factories
// ============================================================================

let idCounter = 0;

function generateId(): string {
  idCounter += 1;
  return `test-id-${idCounter}`;
}

// Reset counter between test suites if needed
export function resetIdCounter() {
  idCounter = 0;
}

/**
 * Create a mock Tag with sensible defaults
 */
export function createMockTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: generateId(),
    name: 'Test Tag',
    color: 'terracotta' as TagColor,
    createdAt: new Date('2024-01-01T12:00:00'),
    updatedAt: new Date('2024-01-01T12:00:00'),
    ...overrides,
  };
}

/**
 * Create multiple mock tags
 */
export function createMockTags(count: number, overrides: Partial<Tag> = {}): Tag[] {
  return Array.from({ length: count }, (_, i) =>
    createMockTag({
      name: `Tag ${i + 1}`,
      ...overrides,
    })
  );
}

/**
 * Create a mock Note with sensible defaults
 */
export function createMockNote(overrides: Partial<Note> = {}): Note {
  const now = new Date('2024-01-15T12:00:00');
  return {
    id: generateId(),
    title: 'Test Note',
    content: '<p>Test content</p>',
    createdAt: now,
    updatedAt: now,
    tags: [],
    pinned: false,
    deletedAt: null,
    ...overrides,
  };
}

/**
 * Create multiple mock notes
 */
export function createMockNotes(count: number, overrides: Partial<Note> = {}): Note[] {
  return Array.from({ length: count }, (_, i) =>
    createMockNote({
      title: `Note ${i + 1}`,
      ...overrides,
    })
  );
}

/**
 * Create a mock note with a specific date for temporal grouping tests
 */
export function createMockNoteWithDate(
  daysAgo: number,
  overrides: Partial<Note> = {}
): Note {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return createMockNote({
    updatedAt: date,
    createdAt: date,
    ...overrides,
  });
}

/**
 * Create a mock NoteShare with sensible defaults
 */
export function createMockNoteShare(overrides: Partial<NoteShare> = {}): NoteShare {
  return {
    id: generateId(),
    noteId: generateId(),
    userId: generateId(),
    shareToken: 'test-share-token-abc123',
    expiresAt: null,
    createdAt: new Date('2024-01-15T12:00:00'),
    revokedAt: null,
    ...overrides,
  };
}

/**
 * Create a mock User object (for auth testing)
 */
export interface MockUser {
  id: string;
  email: string;
  user_metadata: {
    full_name?: string;
    departing_at?: string | null;
  };
  created_at: string;
}

export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: generateId(),
    email: 'test@example.com',
    user_metadata: {
      full_name: 'Test User',
      departing_at: null,
    },
    created_at: new Date('2024-01-01T12:00:00').toISOString(),
    ...overrides,
  };
}

/**
 * Create a mock Session object (for auth testing)
 */
export interface MockSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  user: MockUser;
}

export function createMockSession(overrides: Partial<MockSession> = {}): MockSession {
  const user = overrides.user ?? createMockUser();
  return {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
    expires_at: Date.now() + 3600000,
    user,
    ...overrides,
  };
}

/**
 * Available tag colors for testing
 */
export const TAG_COLOR_OPTIONS: TagColor[] = [
  'terracotta',
  'gold',
  'forest',
  'stone',
  'indigo',
  'clay',
  'sage',
  'plum',
];
