import { createContext, use, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import type { DerivedKeys, KeyCheckVersion, SessionKeyBlob } from '../lib/encryption';
import {
  KEY_CHECK_VERSION,
  createKeyCheck,
  deriveKeys,
  exportSessionKeys,
  fromBase64,
  importSessionKeys,
  toBase64,
  verifyKeyCheck,
} from '../lib/encryption';
import {
  addReliabilityBreadcrumb,
  reportReliabilityIssue,
} from '../utils/reliabilityTelemetry';

export type LockReason = 'auto-lock' | 'manual' | 'sign-out';

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
  lockVault: (reason?: LockReason) => void;
  /** Persist current in-memory keys to localStorage (when enabling remember-browser while unlocked) */
  persistToLocal: () => boolean;
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

function clearKeyMaterial(keys: DerivedKeys | null): void {
  if (!keys) return;
  keys.rawEncryptionKey.fill(0);
  keys.rawHashKey.fill(0);
}

/** Try to restore keys from sessionStorage */
async function restoreSession(userId: string): Promise<DerivedKeys | null> {
  try {
    const raw = sessionStorage.getItem(sessionKey(userId));
    if (!raw) return null;
    const blob: SessionKeyBlob = JSON.parse(raw);
    if (!blob.encKey || !blob.hashKey || !blob.salt) return null;
    return await importSessionKeys(blob);
  } catch (err) {
    console.warn('[EncryptionContext] Session restore blob corrupted, clearing:', err);
    reportReliabilityIssue({
      category: 'vault',
      message: 'Vault session restore failed',
      level: 'warning',
      data: { source: 'sessionStorage' },
    }, err);
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

/** Read the rememberBrowser setting directly from localStorage (avoids circular context dependency with useVaultSettings).
 *  Key format must match storageKey(userId, 'remember-browser') in useVaultSettings.ts */
function isRememberBrowserEnabled(userId: string | null): boolean {
  if (!userId) return false;
  try {
    return localStorage.getItem(`yidhan-${userId}-vault-remember-browser`) === 'true';
  } catch (err) {
    console.warn('[EncryptionContext] Failed to read remember-browser setting:', err);
    return false;
  }
}

function hasPersistedLocalKeys(userId: string | null): boolean {
  if (!userId) return false;
  try {
    return localStorage.getItem(localKey(userId)) !== null;
  } catch (err) {
    console.warn('[EncryptionContext] Failed to read persisted vault keys:', err);
    return false;
  }
}

/** Persist key material to localStorage (survives tab close + browser restart) */
function persistLocal(userId: string, keys: DerivedKeys): boolean {
  try {
    const blob = exportSessionKeys(keys);
    localStorage.setItem(localKey(userId), JSON.stringify(blob));
    return true;
  } catch (err) {
    console.warn('[EncryptionContext] Failed to persist vault keys to localStorage:', err);
    return false;
  }
}

/** Clear persisted key material from localStorage.
 *  SECURITY: If this fails, raw encryption key material remains in localStorage.
 *  Callers should be aware that clearing is best-effort. */
function clearLocal(userId: string | null): void {
  if (!userId) return;
  try {
    localStorage.removeItem(localKey(userId));
  } catch (err) {
    console.error('[EncryptionContext] SECURITY: Failed to clear vault keys from localStorage — key material may persist:', err);
  }
}

interface RestoreVerificationOptions {
  userId: string;
  restored: DerivedKeys | null;
  keyCheck?: string;
  keyCheckIv?: string;
  keyCheckVersion?: unknown;
  source: 'sessionStorage_restore' | 'localStorage_restore' | 'activity_gate';
  invalidMessage: string;
  missingMetadataMessage: string;
  cleanup: () => void;
  cleanupLabel: string;
}

function parseKeyCheckVersion(version: unknown): KeyCheckVersion | null {
  if (version == null) {
    return 1;
  }
  if (version === 1 || version === '1') {
    return 1;
  }
  if (version === KEY_CHECK_VERSION || version === String(KEY_CHECK_VERSION)) {
    return KEY_CHECK_VERSION;
  }
  return null;
}

async function upgradeLegacyKeyCheck(
  userId: string,
  encryptionKey: CryptoKey,
  source: RestoreVerificationOptions['source'] | 'unlock_passphrase'
): Promise<void> {
  try {
    const { keyCheck, keyCheckIv, keyCheckVersion } = await createKeyCheck(encryptionKey, userId);
    const { error } = await supabase.auth.updateUser({
      data: {
        encryption_key_check: keyCheck,
        encryption_key_check_iv: keyCheckIv,
        encryption_key_check_version: keyCheckVersion,
      },
    });

    if (error) {
      throw new Error(error.message);
    }
  } catch (err) {
    reportReliabilityIssue({
      category: 'vault',
      message: 'Failed to upgrade legacy key-check metadata',
      level: 'warning',
      data: { source, userId },
    }, err);
  }
}

async function verifyRestoredKeys({
  userId,
  restored,
  keyCheck,
  keyCheckIv,
  keyCheckVersion,
  source,
  invalidMessage,
  missingMetadataMessage,
  cleanup,
  cleanupLabel,
}: RestoreVerificationOptions): Promise<DerivedKeys | null> {
  if (!restored) {
    return null;
  }

  if (!keyCheck || !keyCheckIv) {
    reportReliabilityIssue({
      category: 'vault',
      message: missingMetadataMessage,
      level: 'warning',
      data: { source },
    });
    console.warn(`[EncryptionContext] Cannot verify ${cleanupLabel}: key-check metadata missing`);
    cleanup();
    return null;
  }

  const parsedKeyCheckVersion = parseKeyCheckVersion(keyCheckVersion);
  if (parsedKeyCheckVersion === null) {
    reportReliabilityIssue({
      category: 'vault',
      message: 'Vault restore has unsupported key-check metadata version',
      level: 'warning',
      data: { source },
    });
    console.warn(`[EncryptionContext] Cannot verify ${cleanupLabel}: unsupported key-check version`);
    cleanup();
    return null;
  }

  const isValid = await verifyKeyCheck(
    restored.encryptionKey,
    keyCheck,
    keyCheckIv,
    userId,
    parsedKeyCheckVersion
  );
  if (!isValid) {
    reportReliabilityIssue({
      category: 'vault',
      message: invalidMessage,
      level: 'warning',
      data: { source },
    });
    console.warn(`[EncryptionContext] ${cleanupLabel} failed key-check — stale or corrupted, clearing`);
    cleanup();
    return null;
  }

  if (parsedKeyCheckVersion !== KEY_CHECK_VERSION) {
    void upgradeLegacyKeyCheck(userId, restored.encryptionKey, source);
  }

  return restored;
}

/** Try to restore keys from localStorage */
async function restoreLocal(userId: string): Promise<DerivedKeys | null> {
  try {
    const raw = localStorage.getItem(localKey(userId));
    if (!raw) return null;
    const blob: SessionKeyBlob = JSON.parse(raw);
    if (!blob.encKey || !blob.hashKey || !blob.salt) return null;
    return await importSessionKeys(blob);
  } catch (err) {
    console.warn('[EncryptionContext] localStorage restore blob corrupted, clearing:', err);
    reportReliabilityIssue({
      category: 'vault',
      message: 'Persisted vault restore failed',
      level: 'warning',
      data: { source: 'localStorage' },
    }, err);
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
  const prevUserIdRef = useRef<string | null>(null);
  if (prevUserIdRef.current !== currentUserId) {
    const previousUserId = prevUserIdRef.current;
    prevUserIdRef.current = currentUserId;
    // Always clear sessionStorage for the old user (even if in-memory keys are
    // null — an in-flight restore may not have completed yet).
    if (previousUserId) {
      clearSession(previousUserId);
      clearLocal(previousUserId);
    }
    if (keyState.keys !== null) {
      clearKeyMaterial(keyState.keys);
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
    const keyCheckVersion = user?.user_metadata?.encryption_key_check_version;

    let cancelled = false;
    (async () => {
      try {
        // Try sessionStorage first (fast path for page refresh)
        let restored = await restoreSession(currentUserId);
        restored = await verifyRestoredKeys({
          userId: currentUserId,
          restored,
          keyCheck,
          keyCheckIv,
          keyCheckVersion,
          source: 'sessionStorage_restore',
          invalidMessage: 'Vault session keys failed key-check',
          missingMetadataMessage: 'Vault session restore missing key-check metadata',
          cleanup: () => clearSession(currentUserId),
          cleanupLabel: 'sessionStorage keys',
        });
        const hadPersistedLocalKeys = isRememberBrowserEnabled(currentUserId)
          && hasPersistedLocalKeys(currentUserId);

        // Fall back to localStorage if rememberBrowser is enabled
        if (!restored && isRememberBrowserEnabled(currentUserId)) {
          restored = await restoreLocal(currentUserId);
          restored = await verifyRestoredKeys({
            userId: currentUserId,
            restored,
            keyCheck,
            keyCheckIv,
            keyCheckVersion,
            source: 'localStorage_restore',
            invalidMessage: 'Persisted vault keys failed key-check',
            missingMetadataMessage: 'Persisted vault restore missing key-check metadata',
            cleanup: () => clearLocal(currentUserId),
            cleanupLabel: 'localStorage keys',
          });

        }

        if (restored && !cancelled) {
          persistSession(currentUserId, restored);
          // Only rewrite localStorage when a remembered blob already exists.
          // This preserves checksum upgrades without recreating browser-restart
          // persistence after a manual/sign-out clear in another tab.
          if (hadPersistedLocalKeys && !persistLocal(currentUserId, restored)) {
            reportReliabilityIssue({
              category: 'vault',
              message: 'Failed to refresh persisted vault keys after restore',
              level: 'warning',
              data: { source: 'restore_upgrade' },
            });
          }
          setKeyState((prev) => prev.keys !== null ? prev : { keys: restored, userId: currentUserId });
        }
      } catch (err) {
        if (!cancelled) {
          reportReliabilityIssue({
            category: 'vault',
            message: 'Vault restore flow failed',
            level: 'warning',
            data: { source: 'restore_effect' },
          }, err);
          console.warn('[EncryptionContext] Session restore failed, passphrase required:', err);
          clearSession(currentUserId);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [currentUserId, isEncryptionSetup, keyState.keys, user?.user_metadata?.encryption_key_check, user?.user_metadata?.encryption_key_check_iv, user?.user_metadata?.encryption_key_check_version]);

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
    const keyCheckVersion = user?.user_metadata?.encryption_key_check_version;

    // Abort flag prevents a race where mousedown fires handleActivity (async)
    // and then click fires lockVault('sign-out') synchronously — the in-flight
    // restore could complete after sign-out, re-populating keys.
    let aborted = false;

    const handleActivity = async () => {
      // autoLockedRef guards against re-entry from a concurrent visibilitychange
      if (!autoLockedRef.current) return;
      autoLockedRef.current = false;
      detachListeners();

      try {
        let restored = await restoreLocal(currentUserId);
        if (aborted) return;
        if (!restored) {
          addReliabilityBreadcrumb({
            category: 'vault',
            message: 'Activity-gated restore found no persisted keys',
            level: 'warning',
            data: { source: 'activity_gate' },
          });
          console.warn('[EncryptionContext] Activity-gated restore: no keys found in localStorage, passphrase required');
          return;
        }

        restored = await verifyRestoredKeys({
          userId: currentUserId,
          restored,
          keyCheck,
          keyCheckIv,
          keyCheckVersion,
          source: 'activity_gate',
          invalidMessage: 'Activity-gated restore failed key-check',
          missingMetadataMessage: 'Activity-gated restore missing key-check metadata',
          cleanup: () => clearLocal(currentUserId),
          cleanupLabel: 'activity-gated localStorage keys',
        });
        if (aborted) return;
        if (!restored) {
          return;
        }

        // Valid — repopulate sessionStorage and unlock
        if (aborted) return;
        persistSession(currentUserId, restored);
        if (!persistLocal(currentUserId, restored)) {
          reportReliabilityIssue({
            category: 'vault',
            message: 'Failed to refresh persisted vault keys after activity-gated restore',
            level: 'warning',
            data: { source: 'activity_gate' },
          });
        }
        setKeyState((prev) => prev.keys !== null ? prev : { keys: restored, userId: currentUserId });
      } catch (err) {
        if (aborted) return;
        reportReliabilityIssue({
          category: 'vault',
          message: 'Activity-gated restore failed',
          level: 'warning',
          data: { source: 'activity_gate' },
        }, err);
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

    function detachListeners() {
      events.forEach((e) => document.removeEventListener(e, handleActivity));
      document.removeEventListener('visibilitychange', onVisibility);
    }

    return () => {
      aborted = true;
      detachListeners();
    };
  }, [currentUserId, isEncryptionSetup, keyState.keys, user?.user_metadata?.encryption_key_check, user?.user_metadata?.encryption_key_check_iv, user?.user_metadata?.encryption_key_check_version]);

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
    const { keyCheck, keyCheckIv, keyCheckVersion } = await createKeyCheck(derivedKeys.encryptionKey, user.id);

    // Base64-encode the salt for storage
    const saltBase64 = toBase64(derivedKeys.salt);

    // Store in user_metadata — MUST succeed before we hold keys in memory.
    const { error } = await supabase.auth.updateUser({
      data: {
        encryption_salt: saltBase64,
        encryption_key_check: keyCheck,
        encryption_key_check_iv: keyCheckIv,
        encryption_key_check_version: keyCheckVersion,
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
    if (isRememberBrowserEnabled(user.id) && !persistLocal(user.id, derivedKeys)) {
      reportReliabilityIssue({
        category: 'vault',
        message: 'Failed to persist remembered vault keys during setup',
        level: 'warning',
        data: { source: 'setup_passphrase' },
      });
    }

    // Mark restore as attempted so auto-lock doesn't trigger immediate re-restore
    // via the restore useEffect (which checks this ref before attempting)
    sessionRestoreAttemptedRef.current = user.id;

    return derivedKeys;
  }, [user]);

  /**
   * Unlock the vault with existing passphrase.
   * Returns true if the passphrase is correct, false if incorrect.
   * Throws when vault metadata/configuration is missing or unsupported.
   */
  const unlockWithPassphrase = useCallback(async (passphrase: string): Promise<boolean> => {
    if (!user) {
      throw new Error('You must be signed in to unlock your notes.');
    }
    if (!encryptionSalt) {
      throw new Error('Encryption is not set up for this account.');
    }

    const keyCheck = user.user_metadata?.encryption_key_check as string | undefined;
    const keyCheckIv = user.user_metadata?.encryption_key_check_iv as string | undefined;

    if (!keyCheck || !keyCheckIv) {
      reportReliabilityIssue({
        category: 'vault',
        message: 'Passphrase unlock missing key-check metadata',
        level: 'warning',
        data: { source: 'unlock_passphrase', userId: user.id },
      });
      throw new Error('Vault metadata is incomplete. Please sign out and sign back in.');
    }

    // Decode the stored salt
    const salt = fromBase64(encryptionSalt);
    const parsedKeyCheckVersion = parseKeyCheckVersion(user.user_metadata?.encryption_key_check_version);
    if (parsedKeyCheckVersion === null) {
      reportReliabilityIssue({
        category: 'vault',
        message: 'Passphrase unlock encountered unsupported key-check metadata version',
        level: 'warning',
        data: { source: 'unlock_passphrase', userId: user.id },
      });
      throw new Error('Vault metadata uses an unsupported format. Please sign out and sign back in.');
    }

    // Derive keys from the passphrase + stored salt
    const derivedKeys = await deriveKeys(passphrase, salt);

    // Verify the key-check
    const isValid = await verifyKeyCheck(
      derivedKeys.encryptionKey,
      keyCheck,
      keyCheckIv,
      user.id,
      parsedKeyCheckVersion
    );

    if (isValid) {
      if (parsedKeyCheckVersion !== KEY_CHECK_VERSION) {
        void upgradeLegacyKeyCheck(user.id, derivedKeys.encryptionKey, 'unlock_passphrase');
      }
      setKeyState({ keys: derivedKeys, userId: user.id });
      persistSession(user.id, derivedKeys);
      if (isRememberBrowserEnabled(user.id) && !persistLocal(user.id, derivedKeys)) {
        reportReliabilityIssue({
          category: 'vault',
          message: 'Failed to persist remembered vault keys during unlock',
          level: 'warning',
          data: { source: 'unlock_passphrase' },
        });
      }
      // Mark restore as attempted so auto-lock doesn't trigger immediate re-restore
      sessionRestoreAttemptedRef.current = user.id;
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
  const lockVault = useCallback((reason: LockReason = 'manual') => {
    if (keyState.keys) {
      clearKeyMaterial(keyState.keys);
    }
    // Use currentUserId (from auth) instead of keyState.userId for storage cleanup.
    // After auto-lock, keyState.userId is null but currentUserId still holds the
    // authenticated user's ID — ensuring sign-out from locked state clears localStorage.
    const effectiveUserId = currentUserId ?? keyState.userId;
    clearSession(effectiveUserId);
    if (reason === 'auto-lock') {
      // Preserve localStorage — activity gate will restore on user return
      autoLockedRef.current = true;
    } else {
      // Manual lock or sign-out — clear everything
      clearLocal(effectiveUserId);
      autoLockedRef.current = false;
    }
    setKeyState({ keys: null, userId: null });
  }, [currentUserId, keyState.userId, keyState.keys]);

  /**
   * Persist current in-memory keys to localStorage.
   * Called when user enables "Remember this browser" in Settings while already unlocked.
   */
  const persistToLocal = useCallback((): boolean => {
    if (keyState.keys && keyState.userId) {
      return persistLocal(keyState.userId, keyState.keys);
    }
    return false;
  }, [keyState.keys, keyState.userId]);

  const contextValue = useMemo<EncryptionContextType>(() => ({
      keys,
      isUnlocked,
      isEncryptionSetup,
      setupPassphrase,
      unlockWithPassphrase,
      lockVault,
      persistToLocal,
  }), [
    keys,
    isUnlocked,
    isEncryptionSetup,
    setupPassphrase,
    unlockWithPassphrase,
    lockVault,
    persistToLocal,
  ]);

  return (
    <EncryptionContext.Provider value={contextValue}>
      {children}
    </EncryptionContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useEncryption() {
  const context = use(EncryptionContext);
  if (context === undefined) {
    throw new Error('useEncryption must be used within an EncryptionProvider');
  }
  return context;
}
