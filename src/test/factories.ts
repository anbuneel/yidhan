import type { Note, Tag, TagColor, NoteShare } from '../types';

/**
 * Test data factories for creating mock objects
 * Use these to create consistent test data across all test files
 */

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
