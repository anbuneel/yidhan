import { vi } from 'vitest';

/**
 * Comprehensive Supabase client mock for testing
 * Provides chainable query builders and auth mocks
 */

// Helper to create a chainable query builder
export function createQueryBuilder<T>(data: T[] = [], error: Error | null = null) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    containedBy: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: data[0] ?? null, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data: data[0] ?? null, error }),
    then: vi.fn((resolve) => resolve({ data, error })),
  };

  // Make the builder thenable for await
  Object.defineProperty(builder, 'then', {
    value: (resolve: (value: { data: T[]; error: Error | null }) => void) => {
      return Promise.resolve({ data, error }).then(resolve);
    },
  });

  return builder;
}

// Create a mock for the auth module
export const mockAuth = {
  getSession: vi.fn().mockResolvedValue({
    data: { session: null },
    error: null,
  }),
  getUser: vi.fn().mockResolvedValue({
    data: { user: null },
    error: null,
  }),
  signInWithPassword: vi.fn().mockResolvedValue({
    data: { user: null, session: null },
    error: null,
  }),
  signInWithOAuth: vi.fn().mockResolvedValue({
    data: { provider: '', url: '' },
    error: null,
  }),
  signUp: vi.fn().mockResolvedValue({
    data: { user: null, session: null },
    error: null,
  }),
  signOut: vi.fn().mockResolvedValue({ error: null }),
  resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
  updateUser: vi.fn().mockResolvedValue({
    data: { user: null },
    error: null,
  }),
  onAuthStateChange: vi.fn().mockReturnValue({
    data: {
      subscription: {
        unsubscribe: vi.fn(),
      },
    },
  }),
};

// Create channel mock for realtime subscriptions
export const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnValue({ status: 'SUBSCRIBED' }),
  unsubscribe: vi.fn().mockResolvedValue('ok'),
};

// Main Supabase client mock
export const mockSupabaseClient = {
  from: vi.fn().mockReturnValue(createQueryBuilder()),
  auth: mockAuth,
  channel: vi.fn().mockReturnValue(mockChannel),
  removeChannel: vi.fn().mockResolvedValue('ok'),
};

// Helper to reset all mocks
export function resetSupabaseMocks() {
  vi.clearAllMocks();
  mockSupabaseClient.from.mockReturnValue(createQueryBuilder());
}

// Helper to mock a successful query response
export function mockSupabaseQuery<T>(data: T[], error: Error | null = null) {
  mockSupabaseClient.from.mockReturnValue(createQueryBuilder(data, error));
}

// Helper to mock a single item response
export function mockSupabaseSingle<T>(data: T | null, error: Error | null = null) {
  const builder = createQueryBuilder(data ? [data] : [], error);
  mockSupabaseClient.from.mockReturnValue(builder);
}

// Helper to mock an error response
export function mockSupabaseError(message: string) {
  const error = new Error(message);
  mockSupabaseClient.from.mockReturnValue(createQueryBuilder([], error));
}
