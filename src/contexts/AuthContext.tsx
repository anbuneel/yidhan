import { createContext, use, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { hydrateFromServer, clearOfflineData, needsHydration } from '../services/offlineNotes';
import { clearSyncState } from '../services/syncEngine';
import {
  cancelAccountDeletion,
  confirmAccountDeletionWithEmailOtp,
  confirmAccountDeletionWithPassword,
  fetchAccountDeletionRequest,
  isActiveAccountDeletionRequest,
  requestAccountDeletion,
  startAccountDeletionEmailOtp,
} from '../services/accountDeletion';
import type { DbAccountDeletionRequest } from '../types/database';

interface AuthContextType {
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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Grace window: 10 minutes after re-auth, skip re-auth prompts
// Defined at module level to avoid recreating on each render
const REAUTH_GRACE_WINDOW_MS = 10 * 60 * 1000;

const signIn: AuthContextType['signIn'] = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

const signInWithGoogle: AuthContextType['signInWithGoogle'] = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });
  return { error };
};

const signInWithGitHub: AuthContextType['signInWithGitHub'] = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: window.location.origin,
    },
  });
  return { error };
};

const signUp: AuthContextType['signUp'] = async (email, password, fullName) => {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: fullName ? {
      data: { full_name: fullName }
    } : undefined,
  });
  return { error };
};

const resetPassword: AuthContextType['resetPassword'] = async (email) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/?reset=true`,
  });
  return { error };
};

const updatePassword: AuthContextType['updatePassword'] = async (newPassword) => {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  return { error };
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  // Start as true to prevent race condition: App.tsx should wait for hydration check
  // before fetching notes from potentially empty IndexedDB
  const [isHydrating, setIsHydrating] = useState(true);
  // Track last re-authentication time for "recently reauthed" grace window
  const [lastReauthAt, setLastReauthAt] = useState<number | null>(null);
  const [accountDeletionRequest, setAccountDeletionRequest] = useState<DbAccountDeletionRequest | null>(null);

  const userId = user?.id ?? null;

  // Track the current user ID to prevent race conditions during hydration
  const hydrationUserIdRef = useRef<string | null>(null);

  // Track previous user ID to clear re-auth grace window on user change
  const prevUserIdRef = useRef<string | null>(null);

  // Clear re-auth grace window when user changes (security: prevent carryover)
  useEffect(() => {
    if (prevUserIdRef.current !== null && prevUserIdRef.current !== userId) {
      // User changed without explicit signOut - clear grace window
      setLastReauthAt(null);
    }
    prevUserIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setAccountDeletionRequest(null);
      return;
    }

    let isCurrent = true;

    fetchAccountDeletionRequest().then(({ request, error }) => {
      if (!isCurrent) return;
      if (error) {
        console.warn('Failed to load account deletion status:', error);
        return;
      }
      setAccountDeletionRequest(request);
    });

    return () => {
      isCurrent = false;
    };
  }, [userId]);

  // Hydrate offline database from server
  const hydrateOfflineDb = useCallback(async () => {
    if (!userId) return;

    // Store the user ID we're hydrating for
    const hydratingForUserId = userId;
    hydrationUserIdRef.current = hydratingForUserId;

    // Timeout to prevent hanging forever (10 seconds)
    const HYDRATION_TIMEOUT = 10000;

    try {
      setIsHydrating(true);

      // Wrap hydration in a timeout
      const hydrationPromise = (async () => {
        const needs = await needsHydration(hydratingForUserId);

        // Check if user changed during async operation
        if (hydrationUserIdRef.current !== hydratingForUserId) {
          return;
        }

        if (needs) {
          await hydrateFromServer(hydratingForUserId);
        }
      })();

      const timeoutPromise = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('Hydration timeout')), HYDRATION_TIMEOUT)
      );

      await Promise.race([hydrationPromise, timeoutPromise]);
    } catch (error) {
      // Only log error if we're still hydrating for the same user
      if (hydrationUserIdRef.current === hydratingForUserId) {
        console.warn('Hydration failed or timed out, continuing with local data:', error);
      }
      // Non-fatal - app continues to work with local data or online
    } finally {
      // Only update state if we're still hydrating for the same user
      if (hydrationUserIdRef.current === hydratingForUserId) {
        setIsHydrating(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    // Keep auth loading until we receive an auth state change.
    // Fallback after 5s to avoid hanging on Android WebView edge cases.
    const authInitTimeout = setTimeout(() => {
      console.warn('Auth init timed out after 5s');
      setLoading(false);
    }, 5000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
    }).catch((error) => {
      console.error('getSession failed:', error);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        clearTimeout(authInitTimeout);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Detect password recovery flow
        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true);
        }
      }
    );

    return () => {
      clearTimeout(authInitTimeout);
      subscription.unsubscribe();
    };
  }, []);

  // Hydrate offline DB when user is available, or clear hydrating state if no user
  useEffect(() => {
    if (loading) return; // Wait for auth to initialize

    if (userId) {
      if (hydrationUserIdRef.current !== userId) {
        hydrateOfflineDb();
      }
    } else {
      // No user (logged out or landing page) - no hydration needed
      hydrationUserIdRef.current = null;
      setIsHydrating(false);
    }
  }, [userId, loading, hydrateOfflineDb]);

  const clearPasswordRecovery = useCallback(() => {
    setIsPasswordRecovery(false);
  }, []);

  const signOut = useCallback(async () => {
    // Clear hydration state to prevent race conditions
    hydrationUserIdRef.current = null;
    // Clear re-auth grace window (security: prevent new user from inheriting)
    setLastReauthAt(null);
    setAccountDeletionRequest(null);
    // Clear sync state to prevent memory leaks
    clearSyncState();
    // Clear offline database on logout (security: prevent data leakage)
    await clearOfflineData();
    await supabase.auth.signOut();
  }, []);

  const updateProfile = useCallback(async (fullName: string) => {
    const { data, error } = await supabase.auth.updateUser({
      data: { full_name: fullName },
    });
    if (!error && data.user) {
      setUser(data.user);
    }
    return { error };
  }, []);

  // Verify current password for step-up authentication (sensitive actions)
  // NOTE: signInWithPassword may fire onAuthStateChange and refresh tokens.
  // This is acceptable - it validates credentials without creating a new session.
  const verifyPassword = useCallback(async (password: string): Promise<{ success: boolean; error?: string }> => {
    if (!user?.email) {
      return { success: false, error: 'No user logged in' };
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    });

    if (error) {
      return { success: false, error: 'Incorrect password' };
    }

    // Track successful re-auth for grace window
    setLastReauthAt(Date.now());
    return { success: true };
  }, [user?.email]);

  const confirmAccountDeletion = useCallback(async (
    password: string
  ): Promise<{ success: boolean; confirmationToken?: string; error?: string }> => {
    const result = await confirmAccountDeletionWithPassword(password);

    if (result.error || !result.confirmationToken) {
      return {
        success: false,
        error: result.error?.message ?? 'Could not confirm account deletion',
      };
    }

    setLastReauthAt(Date.now());
    return {
      success: true,
      confirmationToken: result.confirmationToken,
    };
  }, []);

  const startAccountDeletionOtp = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    const result = await startAccountDeletionEmailOtp();

    if (result.error || !result.success) {
      return {
        success: false,
        error: result.error?.message ?? 'Could not send verification code',
      };
    }

    return { success: true };
  }, []);

  const confirmAccountDeletionOtp = useCallback(async (
    otp: string
  ): Promise<{ success: boolean; confirmationToken?: string; error?: string }> => {
    const result = await confirmAccountDeletionWithEmailOtp(otp);

    if (result.error || !result.confirmationToken) {
      return {
        success: false,
        error: result.error?.message ?? 'Could not verify code',
      };
    }

    setLastReauthAt(Date.now());
    return {
      success: true,
      confirmationToken: result.confirmationToken,
    };
  }, []);

  // Mark re-auth timestamp (for OAuth users who verify via email confirmation)
  const markReauth = useCallback(() => {
    setLastReauthAt(Date.now());
  }, []);

  // Check if user recently re-authenticated (within grace window)
  const isRecentlyReauthed = useCallback(() => {
    if (!lastReauthAt) return false;
    return Date.now() - lastReauthAt < REAUTH_GRACE_WINDOW_MS;
  }, [lastReauthAt]);

  // Offboarding ("Letting Go") - initiate account departure with 14-day grace period
  const initiateOffboarding = useCallback(async (confirmationToken: string) => {
    const { request, error } = await requestAccountDeletion(confirmationToken);
    if (!error) {
      setAccountDeletionRequest(request);
    }
    return { error };
  }, []);

  // Cancel offboarding - user decided to stay
  const cancelOffboarding = useCallback(async () => {
    const { request, error } = await cancelAccountDeletion();
    if (!error) {
      setAccountDeletionRequest(request);
    }
    return { error };
  }, []);

  // Computed: is the user in departure grace period?
  const activeAccountDeletionRequest = isActiveAccountDeletionRequest(accountDeletionRequest)
    ? accountDeletionRequest
    : null;
  const isDeparting = Boolean(activeAccountDeletionRequest);

  // Computed: days until account release (null if not departing)
  function calculateDaysUntilRelease(): number | null {
    if (!activeAccountDeletionRequest) return null;
    const releaseDate = new Date(activeAccountDeletionRequest.release_at);
    const msRemaining = releaseDate.getTime() - Date.now();
    const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));
    return Math.max(0, daysRemaining);
  }
  const daysUntilRelease = calculateDaysUntilRelease();
  const contextValue = useMemo<AuthContextType>(() => ({
    user,
    session,
    loading,
    isPasswordRecovery,
    clearPasswordRecovery,
    signIn,
    signInWithGoogle,
    signInWithGitHub,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    updateProfile,
    initiateOffboarding,
    cancelOffboarding,
    accountDeletionRequest,
    isDeparting,
    daysUntilRelease,
    isHydrating,
    hydrateOfflineDb,
    verifyPassword,
    confirmAccountDeletion,
    startAccountDeletionOtp,
    confirmAccountDeletionOtp,
    markReauth,
    lastReauthAt,
    isRecentlyReauthed,
  }), [
    user,
    session,
    loading,
    isPasswordRecovery,
    clearPasswordRecovery,
    signOut,
    updateProfile,
    initiateOffboarding,
    cancelOffboarding,
    accountDeletionRequest,
    isDeparting,
    daysUntilRelease,
    isHydrating,
    hydrateOfflineDb,
    verifyPassword,
    confirmAccountDeletion,
    startAccountDeletionOtp,
    confirmAccountDeletionOtp,
    markReauth,
    lastReauthAt,
    isRecentlyReauthed,
  ]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = use(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
