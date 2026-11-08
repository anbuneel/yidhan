// The auth context object and its hooks, apart from AuthProvider. AuthProvider
// imports Supabase; this file imports only types, so the public pages can ask "is
// anyone signed in?" without loading it (item 61, step 5). On those pages there is no
// provider at all: nobody is signed in until the app shell loads.
import { createContext, use } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import type { DbAccountDeletionRequest } from '../types/database';

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isPasswordRecovery: boolean;
  clearPasswordRecovery: () => void;
  signIn: (email: string, password: string) => Promise<{ data: { user: User | null; session: Session | null } | null; error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithGitHub: () => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  updateProfile: (fullName: string) => Promise<{ error: Error | null }>;
  // Offboarding ("Letting Go")
  initiateOffboarding: (confirmationToken: string) => Promise<{ error: Error | null }>;
  cancelOffboarding: () => Promise<{ error: Error | null }>;
  accountDeletionRequest: DbAccountDeletionRequest | null;
  isDeparting: boolean;
  daysUntilRelease: number | null;
  // Offline support
  isHydrating: boolean;
  hydrateOfflineDb: () => Promise<void>;
  // Re-authentication for sensitive actions
  verifyPassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  confirmAccountDeletion: (password: string) => Promise<{
    success: boolean;
    confirmationToken?: string;
    error?: string;
  }>;
  startAccountDeletionOtp: () => Promise<{ success: boolean; error?: string }>;
  confirmAccountDeletionOtp: (otp: string) => Promise<{
    success: boolean;
    confirmationToken?: string;
    error?: string;
  }>;
  /** Mark re-auth timestamp (for OAuth users who verify via email) */
  markReauth: () => void;
  lastReauthAt: number | null;
  /** Check if user recently re-authenticated (within grace window) */
  isRecentlyReauthed: () => boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = use(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * The auth context where there may be none. The public pages render without an
 * AuthProvider until the visitor signs in, so a component shared between them and the
 * app (the header) reads it this way and treats `null` as signed out.
 */
export function useOptionalAuth(): AuthContextType | null {
  return use(AuthContext) ?? null;
}
