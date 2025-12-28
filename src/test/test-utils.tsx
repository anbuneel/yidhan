/* eslint-disable react-refresh/only-export-components */
import { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';

/**
 * Mock AuthContext value for testing
 */
export interface MockAuthContextValue {
  user: null | { id: string; email: string; user_metadata?: Record<string, unknown> };
  session: null | { access_token: string };
  loading: boolean;
  isPasswordRecovery: boolean;
  clearPasswordRecovery: () => void;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithGitHub: () => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  updateProfile: (fullName: string) => Promise<{ error: Error | null }>;
  initiateOffboarding: () => Promise<{ error: Error | null }>;
  cancelOffboarding: () => Promise<{ error: Error | null }>;
  isDeparting: boolean;
  daysUntilRelease: number | null;
}

export const defaultMockAuthContext: MockAuthContextValue = {
  user: null,
  session: null,
  loading: false,
  isPasswordRecovery: false,
  clearPasswordRecovery: vi.fn(),
  signIn: vi.fn().mockResolvedValue({ error: null }),
  signInWithGoogle: vi.fn().mockResolvedValue({ error: null }),
  signInWithGitHub: vi.fn().mockResolvedValue({ error: null }),
  signUp: vi.fn().mockResolvedValue({ error: null }),
  signOut: vi.fn().mockResolvedValue(undefined),
  resetPassword: vi.fn().mockResolvedValue({ error: null }),
  updatePassword: vi.fn().mockResolvedValue({ error: null }),
  updateProfile: vi.fn().mockResolvedValue({ error: null }),
  initiateOffboarding: vi.fn().mockResolvedValue({ error: null }),
  cancelOffboarding: vi.fn().mockResolvedValue({ error: null }),
  isDeparting: false,
  daysUntilRelease: null,
};

/**
 * Create an authenticated mock auth context
 */
export function createAuthenticatedContext(
  overrides: Partial<MockAuthContextValue> = {}
): MockAuthContextValue {
  return {
    ...defaultMockAuthContext,
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      user_metadata: { full_name: 'Test User' },
    },
    session: { access_token: 'mock-access-token' },
    ...overrides,
  };
}

/**
 * Mock AuthProvider for testing components that use useAuth
 */
interface MockAuthProviderProps {
  children: ReactNode;
  value?: Partial<MockAuthContextValue>;
}

// We'll create a simple context mock that can be used in tests
// The actual AuthContext import is avoided to prevent Supabase initialization
import { createContext, useContext } from 'react';

const MockAuthContext = createContext<MockAuthContextValue | undefined>(undefined);

export function MockAuthProvider({ children, value = {} }: MockAuthProviderProps) {
  const contextValue = { ...defaultMockAuthContext, ...value };
  return (
    <MockAuthContext.Provider value={contextValue}>
      {children}
    </MockAuthContext.Provider>
  );
}

export function useMockAuth() {
  const context = useContext(MockAuthContext);
  if (context === undefined) {
    throw new Error('useMockAuth must be used within a MockAuthProvider');
  }
  return context;
}

/**
 * Custom render options
 */
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  authContext?: Partial<MockAuthContextValue>;
}

/**
 * Render with all providers (AuthProvider, etc.)
 * Use this for integration tests that need the full provider stack
 */
export function renderWithProviders(
  ui: ReactElement,
  { authContext, ...renderOptions }: CustomRenderOptions = {}
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MockAuthProvider value={authContext}>
        {children}
      </MockAuthProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

/**
 * Wait for async operations to complete
 * Useful for testing components with useEffect
 */
export async function waitForAsync() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Flush all pending promises
 */
export async function flushPromises() {
  await new Promise((resolve) => setImmediate(resolve));
}

// Re-export everything from @testing-library/react
export * from '@testing-library/react';

// Export render as the default (for simple tests that don't need providers)
export { render };
