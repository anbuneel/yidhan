import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { hydrateFromServer, clearOfflineData, needsHydration } from '../services/offlineNotes';

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
  const [isHydrating, setIsHydrating] = useState(false);

  // Hydrate offline database from server
  const hydrateOfflineDb = useCallback(async () => {
    if (!user) return;

    try {
      setIsHydrating(true);
      const needs = await needsHydration(user.id);
      if (needs) {
        await hydrateFromServer(user.id);
      }
    } catch (error) {
      console.error('Failed to hydrate offline DB:', error);
      // Non-fatal - app continues to work online
    } finally {
      setIsHydrating(false);
    }
  }, [user]);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Detect password recovery flow
        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Hydrate offline DB when user is available
  useEffect(() => {
    if (user && !loading) {
      hydrateOfflineDb();
    }
  }, [user, loading, hydrateOfflineDb]);

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
