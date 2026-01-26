import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { hydrateFromServer, clearOfflineData, needsHydration } from '../services/offlineNotes';
import { clearSyncState } from '../services/syncEngine';

interface AuthContextType {
  user: User | null;
  session: Session | null;
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
  // Offboarding ("Letting Go")
  initiateOffboarding: () => Promise<{ error: Error | null }>;
  cancelOffboarding: () => Promise<{ error: Error | null }>;
  isDeparting: boolean;
  daysUntilRelease: number | null;
  // Offline support
  isHydrating: boolean;
  hydrateOfflineDb: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  // Start as true to prevent race condition: App.tsx should wait for hydration check
  // before fetching notes from potentially empty IndexedDB
  const [isHydrating, setIsHydrating] = useState(true);

  const userId = user?.id ?? null;

  // Track the current user ID to prevent race conditions during hydration
  const hydrationUserIdRef = useRef<string | null>(null);

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

  const clearPasswordRecovery = () => {
    setIsPasswordRecovery(false);
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    return { error };
  };

  const signInWithGitHub = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: window.location.origin,
      },
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: fullName ? {
        data: { full_name: fullName }
      } : undefined,
    });
    return { error };
  };

  const signOut = async () => {
    // Clear hydration state to prevent race conditions
    hydrationUserIdRef.current = null;
    // Clear sync state to prevent memory leaks
    clearSyncState();
    // Clear offline database on logout (security: prevent data leakage)
    await clearOfflineData();
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/?reset=true`,
    });
    return { error };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    return { error };
  };

  const updateProfile = async (fullName: string) => {
    const { data, error } = await supabase.auth.updateUser({
      data: { full_name: fullName },
    });
    if (!error && data.user) {
      setUser(data.user);
    }
    return { error };
  };

  // Offboarding ("Letting Go") - initiate account departure with 14-day grace period
  const initiateOffboarding = async () => {
    const { data, error } = await supabase.auth.updateUser({
      data: { departing_at: new Date().toISOString() },
    });
    if (!error && data.user) {
      setUser(data.user);
    }
    return { error };
  };

  // Cancel offboarding - user decided to stay
  const cancelOffboarding = async () => {
    const { data, error } = await supabase.auth.updateUser({
      data: { departing_at: null },
    });
    if (!error && data.user) {
      setUser(data.user);
    }
    return { error };
  };

  // Computed: is the user in departure grace period?
  const departingAt = user?.user_metadata?.departing_at as string | undefined;
  const isDeparting = Boolean(departingAt);

  // Computed: days until account release (null if not departing)
  const daysUntilRelease = (() => {
    if (!departingAt) return null;
    const departureDate = new Date(departingAt);
    const releaseDate = new Date(departureDate.getTime() + 14 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const msRemaining = releaseDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));
    return Math.max(0, daysRemaining);
  })();

  return (
    <AuthContext.Provider value={{ user, session, loading, isPasswordRecovery, clearPasswordRecovery, signIn, signInWithGoogle, signInWithGitHub, signUp, signOut, resetPassword, updatePassword, updateProfile, initiateOffboarding, cancelOffboarding, isDeparting, daysUntilRelease, isHydrating, hydrateOfflineDb }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
