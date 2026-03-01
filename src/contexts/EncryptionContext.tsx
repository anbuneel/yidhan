import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import type { DerivedKeys, SessionKeyBlob } from '../lib/encryption';
import { deriveKeys, createKeyCheck, verifyKeyCheck, exportSessionKeys, importSessionKeys } from '../lib/encryption';

interface EncryptionContextType {
  /** Derived encryption keys (null when locked) */
  keys: DerivedKeys | null;
  /** Whether the vault is unlocked (keys are in memory) */
  isUnlocked: boolean;
  /** Whether encryption has been set up (salt exists in user_metadata) */
  isEncryptionSetup: boolean;
  /** Set up passphrase for the first time. Returns derived keys for immediate use. */
  setupPassphrase: (passphrase: string) => Promise<DerivedKeys>;
  /** Unlock with existing passphrase */
  unlockWithPassphrase: (passphrase: string) => Promise<boolean>;
  /** Clear keys from memory. Reason controls what storage is cleared. */
  lockVault: (reason?: 'auto-lock' | 'manual' | 'sign-out') => void;
  /** Persist current in-memory keys to localStorage (when enabling remember-browser while unlocked) */
  persistToLocal: () => void;
}

const EncryptionContext = createContext<EncryptionContextType | undefined>(undefined);

// sessionStorage key, namespaced per user
function sessionKey(userId: string): string {
  return `yidhan-${userId}-vault-session`;
}

/** Persist key material to sessionStorage (survives refresh, clears on tab close) */
function persistSession(userId: string, keys: DerivedKeys): void {
  try {
    const blob = exportSessionKeys(keys);
    sessionStorage.setItem(sessionKey(userId), JSON.stringify(blob));
  } catch (err) {
    console.warn('[EncryptionContext] Failed to persist vault session — refresh will require passphrase:', err);
  }
}

/** Clear session key material */
function clearSession(userId: string | null): void {
  if (!userId) return;
  try {
    sessionStorage.removeItem(sessionKey(userId));
  } catch (err) {
    console.error('[EncryptionContext] Failed to clear vault session from sessionStorage:', err);
  }
}

/** Try to restore keys from sessionStorage */
async function restoreSession(userId: string): Promise<DerivedKeys | null> {
  try {
    const raw = sessionStorage.getItem(sessionKey(userId));
    if (!raw) return null;
    const blob: SessionKeyBlob = JSON.parse(raw);
    if (!blob.encKey || !blob.hashKey || !blob.salt) return null;
    return await importSessionKeys(blob);
  } catch {
    // Corrupted or invalid blob — clear it
    clearSession(userId);
    return null;
  }
}

// ============================================================================
// localStorage persistence (survives browser restarts when "Remember" is on)
// ============================================================================

function localKey(userId: string): string {
  return `yidhan-${userId}-vault-persisted-keys`;
}

/** Read the rememberBrowser setting directly from localStorage (avoids circular context dependency with useVaultSettings) */
function isRememberBrowserEnabled(userId: string | null): boolean {
  if (!userId) return false;
  try {
    return localStorage.getItem(`yidhan-${userId}-vault-remember-browser`) === 'true';
  } catch {
    return false;
  }
}

/** Persist key material to localStorage (survives tab close + browser restart) */
function persistLocal(userId: string, keys: DerivedKeys): void {
  try {
    const blob = exportSessionKeys(keys);
    localStorage.setItem(localKey(userId), JSON.stringify(blob));
  } catch (err) {
    console.warn('[EncryptionContext] Failed to persist vault keys to localStorage:', err);
  }
}

/** Clear persisted key material from localStorage */
function clearLocal(userId: string | null): void {
  if (!userId) return;
  try {
    localStorage.removeItem(localKey(userId));
  } catch (err) {
    console.error('[EncryptionContext] Failed to clear vault keys from localStorage:', err);
  }
}

/** Try to restore keys from localStorage */
async function restoreLocal(userId: string): Promise<DerivedKeys | null> {
  try {
    const raw = localStorage.getItem(localKey(userId));
    if (!raw) return null;
    const blob: SessionKeyBlob = JSON.parse(raw);
    if (!blob.encKey || !blob.hashKey || !blob.salt) return null;
    return await importSessionKeys(blob);
  } catch {
    clearLocal(userId);
    return null;
  }
}

// Store keys alongside the userId they belong to, so a user change auto-locks.
// Discriminated union prevents invalid states (e.g. keys without userId).
type KeyState =
  | { keys: null; userId: null }
  | { keys: DerivedKeys; userId: string };

export function EncryptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [keyState, setKeyState] = useState<KeyState>({ keys: null, userId: null });
  const sessionRestoreAttemptedRef = useRef<string | null>(null);
  /** When true, vault was auto-locked — activity gate must fire before restore */
  const autoLockedRef = useRef(false);

  // Determine if encryption is set up by checking user_metadata
  const encryptionSalt = user?.user_metadata?.encryption_salt as string | undefined;
  const isEncryptionSetup = Boolean(encryptionSalt);

  const currentUserId = user?.id ?? null;

  // Clear keyState when user signs out or switches accounts.
  // Uses React's "adjusting state during render" pattern (not an effect).
  const [prevUserId, setPrevUserId] = useState<string | null>(null);
  if (prevUserId !== currentUserId) {
    setPrevUserId(currentUserId);
    // Always clear sessionStorage for the old user (even if in-memory keys are
    // null — an in-flight restore may not have completed yet).
    if (prevUserId) {
      clearSession(prevUserId);
      clearLocal(prevUserId);
    }
    if (keyState.keys !== null) {
      keyState.keys.rawEncryptionKey.fill(0);
      keyState.keys.rawHashKey.fill(0);
      setKeyState({ keys: null, userId: null });
    }
  }

  // Reset auto-lock state when user changes (refs must not be mutated during render)
  useEffect(() => {
    autoLockedRef.current = false;
  }, [currentUserId]);

  // Attempt to restore keys from sessionStorage (then localStorage) on mount/user change
  useEffect(() => {
    if (!currentUserId || !isEncryptionSetup || keyState.keys !== null) {
      return;
    }

    // Only attempt restore once per userId (activity gate handles post-auto-lock restores)
    if (sessionRestoreAttemptedRef.current === currentUserId) return;
    sessionRestoreAttemptedRef.current = currentUserId;

    const keyCheck = user?.user_metadata?.encryption_key_check as string | undefined;
    const keyCheckIv = user?.user_metadata?.encryption_key_check_iv as string | undefined;

    let cancelled = false;
    (async () => {
      try {
        // Try sessionStorage first (fast path for page refresh)
        let restored = await restoreSession(currentUserId);

        // Fall back to localStorage if rememberBrowser is enabled
        if (!restored && isRememberBrowserEnabled(currentUserId)) {
          restored = await restoreLocal(currentUserId);

          // Verify restored keys against key-check (prevents stale keys after passphrase change)
          if (restored && keyCheck && keyCheckIv) {
            const isValid = await verifyKeyCheck(restored.encryptionKey, keyCheck, keyCheckIv);
            if (!isValid) {
              console.warn('[EncryptionContext] localStorage keys failed key-check — stale or corrupted, clearing');
              clearLocal(currentUserId);
              restored = null;
            }
          }

          // If restored from localStorage, re-populate sessionStorage for this tab
          if (restored) {
            persistSession(currentUserId, restored);
          }
        }

        if (restored && !cancelled) {
          setKeyState((prev) => prev.keys !== null ? prev : { keys: restored, userId: currentUserId });
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('[EncryptionContext] Session restore failed, passphrase required:', err);
          clearSession(currentUserId);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [currentUserId, isEncryptionSetup, keyState.keys, user?.user_metadata?.encryption_key_check, user?.user_metadata?.encryption_key_check_iv]);

  // Activity-gated restore: after auto-lock with rememberBrowser, wait for user activity
  // before restoring keys from localStorage. Calls restoreLocal() directly because
  // useRef mutations don't trigger React re-renders (the restore effect above won't re-run).
  useEffect(() => {
    if (!autoLockedRef.current || !currentUserId || !isEncryptionSetup || keyState.keys !== null) {
      return;
    }
    if (!isRememberBrowserEnabled(currentUserId)) return;

    const keyCheck = user?.user_metadata?.encryption_key_check as string | undefined;
    const keyCheckIv = user?.user_metadata?.encryption_key_check_iv as string | undefined;

    const handleActivity = async () => {
      // autoLockedRef guards against re-entry from a concurrent visibilitychange
      if (!autoLockedRef.current) return;
      autoLockedRef.current = false;
      cleanup();

      try {
        const restored = await restoreLocal(currentUserId);
        if (!restored) return;

        // Verify against key-check
        if (keyCheck && keyCheckIv) {
          const isValid = await verifyKeyCheck(restored.encryptionKey, keyCheck, keyCheckIv);
          if (!isValid) {
            clearLocal(currentUserId);
            return;
          }
        }

        // Valid — repopulate sessionStorage and unlock
        persistSession(currentUserId, restored);
        setKeyState((prev) => prev.keys !== null ? prev : { keys: restored, userId: currentUserId });
      } catch (err) {
        console.warn('[EncryptionContext] Activity-gated restore failed:', err);
        clearLocal(currentUserId);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') handleActivity();
    };

    const events = ['mousedown', 'keydown', 'touchstart'] as const;
    events.forEach((e) => document.addEventListener(e, handleActivity, { once: true }));
    document.addEventListener('visibilitychange', onVisibility);

    function cleanup() {
      events.forEach((e) => document.removeEventListener(e, handleActivity));
      document.removeEventListener('visibilitychange', onVisibility);
    }

    return cleanup;
  }, [currentUserId, isEncryptionSetup, keyState.keys, user?.user_metadata?.encryption_key_check, user?.user_metadata?.encryption_key_check_iv]);

  const keys = useMemo(() => {
    if (keyState.userId === null || keyState.userId !== currentUserId) {
      return null;
    }
    return keyState.keys;
  }, [keyState, currentUserId]);
  const isUnlocked = keys !== null;

  /**
   * Set up encryption for the first time.
   * Derives keys from passphrase, stores salt + key-check in user_metadata.
   */
  const setupPassphrase = useCallback(async (passphrase: string): Promise<DerivedKeys> => {
    if (!user) throw new Error('Must be logged in to set up encryption');

    // Derive keys with a new random salt
    const derivedKeys = await deriveKeys(passphrase);

    // Create key-check blob for later passphrase verification
    const { keyCheck, keyCheckIv } = await createKeyCheck(derivedKeys.encryptionKey);

    // Base64-encode the salt for storage
    let saltBase64 = '';
    const saltBytes = derivedKeys.salt;
    for (let i = 0; i < saltBytes.length; i++) {
      saltBase64 += String.fromCharCode(saltBytes[i]);
    }
    saltBase64 = btoa(saltBase64);

    // Store in user_metadata — MUST succeed before we hold keys in memory.
    const { error } = await supabase.auth.updateUser({
      data: {
        encryption_salt: saltBase64,
        encryption_key_check: keyCheck,
        encryption_key_check_iv: keyCheckIv,
        encryption_version: 1,
      },
    });

    if (error) {
      throw new Error(`Failed to save encryption settings: ${error.message}`);
    }

    // Verify the metadata was actually persisted by re-reading user
    const { data: { user: refreshedUser } } = await supabase.auth.getUser();
    if (!refreshedUser?.user_metadata?.encryption_salt) {
      throw new Error('Encryption settings were not persisted. Please try again.');
    }

    // Metadata confirmed — safe to hold keys in memory and persist to session
    setKeyState({ keys: derivedKeys, userId: user.id });
    persistSession(user.id, derivedKeys);
    if (isRememberBrowserEnabled(user.id)) {
      persistLocal(user.id, derivedKeys);
    }

    return derivedKeys;
  }, [user]);

  /**
   * Unlock the vault with existing passphrase.
   * Returns true if passphrase is correct, false otherwise.
   */
  const unlockWithPassphrase = useCallback(async (passphrase: string): Promise<boolean> => {
    if (!user) return false;
    if (!encryptionSalt) return false;

    const keyCheck = user.user_metadata?.encryption_key_check as string | undefined;
    const keyCheckIv = user.user_metadata?.encryption_key_check_iv as string | undefined;

    if (!keyCheck || !keyCheckIv) {
      return false;
    }

    // Decode the stored salt
    const saltBinary = atob(encryptionSalt);
    const salt = new Uint8Array(saltBinary.length);
    for (let i = 0; i < saltBinary.length; i++) {
      salt[i] = saltBinary.charCodeAt(i);
    }

    // Derive keys from the passphrase + stored salt
    const derivedKeys = await deriveKeys(passphrase, salt);

    // Verify the key-check
    const isValid = await verifyKeyCheck(derivedKeys.encryptionKey, keyCheck, keyCheckIv);

    if (isValid) {
      setKeyState({ keys: derivedKeys, userId: user.id });
      persistSession(user.id, derivedKeys);
      if (isRememberBrowserEnabled(user.id)) {
        persistLocal(user.id, derivedKeys);
      }
      return true;
    }

    return false;
  }, [user, encryptionSalt]);

  /**
   * Lock the vault — clear keys from memory.
   * @param reason Controls what persistent storage is cleared:
   *   - 'auto-lock': preserve localStorage (keys restore on user activity)
   *   - 'manual': clear everything (user explicitly locked)
   *   - 'sign-out': clear everything (security boundary)
   */
  const lockVault = useCallback((reason: 'auto-lock' | 'manual' | 'sign-out' = 'manual') => {
    if (keyState.keys) {
      keyState.keys.rawEncryptionKey.fill(0);
      keyState.keys.rawHashKey.fill(0);
    }
    clearSession(keyState.userId);
    if (reason === 'auto-lock') {
      // Preserve localStorage — activity gate will restore on user return
      autoLockedRef.current = true;
    } else {
      // Manual lock or sign-out — clear everything
      clearLocal(keyState.userId);
      autoLockedRef.current = false;
    }
    setKeyState({ keys: null, userId: null });
  }, [keyState.userId, keyState.keys]);

  /**
   * Persist current in-memory keys to localStorage.
   * Called when user enables "Remember this browser" in Settings while already unlocked.
   */
  const persistToLocal = useCallback(() => {
    if (keyState.keys && keyState.userId) {
      persistLocal(keyState.userId, keyState.keys);
    }
  }, [keyState.keys, keyState.userId]);

  return (
    <EncryptionContext.Provider value={{
      keys,
      isUnlocked,
      isEncryptionSetup,
      setupPassphrase,
      unlockWithPassphrase,
      lockVault,
      persistToLocal,
    }}>
      {children}
    </EncryptionContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useEncryption() {
  const context = useContext(EncryptionContext);
  if (context === undefined) {
    throw new Error('useEncryption must be used within an EncryptionProvider');
  }
  return context;
}
