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
import { validatePassphrasePolicy } from '../utils/passphrasePolicy';
// The vault code (metadata reader, crypto, unlock and migration) is loaded with
// import() on the paths that need it, so it stays out of the entry chunk. The
// chunks are precached, so offline unlock still works. Never import those
// modules statically from app code: Rollup would fold them back into the entry.

function loadVaultUnlock() {
  return import('../services/vaultUnlock');
}

function loadRecoveryKit() {
  return import('../services/recoveryKit');
}

// Types only: erased at build time, so they cost the entry chunk nothing.
import type { PreparedRecoveryKit, RecoveryReset, RecoveryUnlockResult } from '../services/recoveryKit';
export type { PreparedRecoveryKit };

/** What a recovery-key unlock found. `ok` means a new passphrase is now required. */
export type RecoveryUnlockStatus = RecoveryUnlockResult['status'];

/**
 * The key-check a restore path verifies against: `vault.keyCheck` on a migrated
 * account (design §1.2), the legacy one otherwise. Takes the metadata as JSON so
 * the effects that call it can depend on a string, not an object identity.
 */
async function resolveRestoreKeyCheck(metadataJson: string) {
  const { selectKeyCheck } = await loadVaultUnlock();
  return selectKeyCheck(JSON.parse(metadataJson) as Record<string, unknown>);
}

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
  /**
   * Item 26. Open the vault with a recovery key. On `ok` the keys are verified
   * but held back: the vault stays locked until `setPassphraseAfterRecovery`.
   */
  unlockWithRecoveryKey: (recoveryKey: string) => Promise<RecoveryUnlockStatus>;
  /**
   * Which recovery screen the account gate shows, if any. `reset`: a recovery key
   * opened the vault and a new passphrase is required. `offer`: this passphrase
   * unlock is followed by the recovery-key offer.
   */
  recoveryScreen: 'reset' | 'offer' | null;
  /** Save a new passphrase after a recovery-key unlock, then unlock. Throws `RecoveryKitError`. */
  setPassphraseAfterRecovery: (passphrase: string) => Promise<void>;
  /** Leave a recovery without setting a passphrase. Nothing on the server changed. */
  cancelRecovery: (reason?: LockReason) => void;
  dismissRecoveryKeyOffer: () => void;
  /**
   * Make a recovery key for the unlocked vault. The caller must `discard` it.
   * Refuses with `exists` when one is stored, unless `replace` is set.
   */
  prepareRecoveryKit: (options?: { replace?: boolean }) => Promise<PreparedRecoveryKit>;
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

/** Keys opened by a recovery key, held back until a new passphrase is saved. */
interface PendingRecovery {
  userId: string;
  keys: DerivedKeys;
  reset: RecoveryReset;
  /** Set when a lock, sign-out or cancel dropped it, so a late save does not unlock. */
  dropped: boolean;
}

function dropRecovery(recovery: PendingRecovery | null): void {
  if (!recovery) return;
  recovery.dropped = true;
  recovery.reset.discard();
  clearKeyMaterial(recovery.keys);
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
  /** Parsed by `selectKeyCheck`; null for a format this client does not know. */
  keyCheckVersion: KeyCheckVersion | null;
  source: 'sessionStorage_restore' | 'localStorage_restore' | 'activity_gate';
  invalidMessage: string;
  missingMetadataMessage: string;
  cleanup: () => void;
  cleanupLabel: string;
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

  if (keyCheckVersion === null) {
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
    keyCheckVersion
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

  if (keyCheckVersion !== KEY_CHECK_VERSION) {
    // Not a security step (the v1 key-check still verifies), so a failed chunk
    // load only means the rewrite waits for the next unlock.
    void loadVaultUnlock()
      .then(({ upgradeLegacyKeyCheck }) => upgradeLegacyKeyCheck(userId, restored.encryptionKey, source))
      .catch(() => undefined);
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
  const [recovery, setRecovery] = useState<PendingRecovery | null>(null);
  const [recoveryOfferUserId, setRecoveryOfferUserId] = useState<string | null>(null);

  // Determine if encryption is set up by checking user_metadata
  const encryptionSalt = user?.user_metadata?.encryption_salt as string | undefined;
  const isEncryptionSetup = Boolean(encryptionSalt);

  const currentUserId = user?.id ?? null;

  // What the restore key-check is chosen from, as a string so a token refresh
  // that hands over an equal user object does not re-run (and abort) a restore.
  // The whole metadata object, not just the key-check fields: it changes only on
  // an explicit write, and the shorter form keeps the entry chunk in its budget.
  const keyCheckMetadataJson = JSON.stringify(user?.user_metadata ?? {});

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
    if (recovery !== null) {
      dropRecovery(recovery);
      setRecovery(null);
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

    let cancelled = false;
    (async () => {
      try {
        const { keyCheck, keyCheckIv, keyCheckVersion } = await resolveRestoreKeyCheck(keyCheckMetadataJson);
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
  }, [currentUserId, isEncryptionSetup, keyState.keys, keyCheckMetadataJson]);

  // Activity-gated restore: after auto-lock with rememberBrowser, wait for user activity
  // before restoring keys from localStorage. Calls restoreLocal() directly because
  // useRef mutations don't trigger React re-renders (the restore effect above won't re-run).
  useEffect(() => {
    if (!autoLockedRef.current || !currentUserId || !isEncryptionSetup || keyState.keys !== null) {
      return;
    }
    if (!isRememberBrowserEnabled(currentUserId)) return;

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
        const { keyCheck, keyCheckIv, keyCheckVersion } = await resolveRestoreKeyCheck(keyCheckMetadataJson);
        if (aborted) return;
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
  }, [currentUserId, isEncryptionSetup, keyState.keys, keyCheckMetadataJson]);

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

    const policyError = validatePassphrasePolicy(passphrase);
    if (policyError) {
      throw new Error(policyError);
    }

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
        // A vault left behind by an earlier setup wraps a different key. Clear
        // it in the same write, or the old passphrase would still unwrap it.
        vault: null,
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

    const salt = fromBase64(encryptionSalt);
    const userId = user.id;
    // A small chunk, fetched while Argon2id is about to run anyway. It is
    // precached, so offline unlock still works.
    const { passphraseUnlock, startMigration } = await loadVaultUnlock();
    const result = await passphraseUnlock({
      passphrase,
      salt,
      userId,
      metadata: user.user_metadata,
    });
    if (!result) return false;

    setKeyState({ keys: result.keys, userId });
    persistSession(userId, result.keys);
    if (isRememberBrowserEnabled(userId) && !persistLocal(userId, result.keys)) {
      reportReliabilityIssue({
        category: 'vault',
        message: 'Failed to persist remembered vault keys during unlock',
        level: 'warning',
        data: { source: 'unlock_passphrase' },
      });
    }
    // Mark restore as attempted so auto-lock doesn't trigger immediate re-restore
    sessionRestoreAttemptedRef.current = userId;

    if (result.migration) {
      // Item 24: migrate on unlock, in the background. The unlock has already
      // succeeded; a failed or interrupted migration retries next time.
      // A recovery key made now waits for it (`services/recoveryKit.ts`).
      void startMigration({ ...result.migration, userId, passphrase, legacySalt: salt });
    }
    // Item 26: offer a recovery key. Only after a passphrase unlock, never after
    // a restore, and only when the account has none.
    setRecoveryOfferUserId(result.offerRecoveryKey ? userId : null);

    return true;
  }, [user, encryptionSalt]);

  const unlockWithRecoveryKey = useCallback(async (recoveryKey: string): Promise<RecoveryUnlockStatus> => {
    if (!user || !encryptionSalt) return 'unavailable';
    const userId = user.id;
    const { recoveryUnlock } = await loadRecoveryKit();
    const result = await recoveryUnlock({
      recoveryKey,
      userId,
      salt: fromBase64(encryptionSalt),
      metadata: user.user_metadata,
    });
    if (result.status !== 'ok') return result.status;
    // Verified against the vault key-check, but not committed: no note is
    // decrypted and nothing is stored until a new passphrase is saved.
    setRecovery((prev) => {
      dropRecovery(prev);
      return { userId, keys: result.keys, reset: result.reset, dropped: false };
    });
    // No offer to clear: one is only ever set while unlocked, and a lock clears it.
    return 'ok';
  }, [user, encryptionSalt]);

  const setPassphraseAfterRecovery = useCallback(async (passphrase: string): Promise<void> => {
    const pending = recovery;
    const policyError = validatePassphrasePolicy(passphrase);
    if (!pending || pending.userId !== currentUserId || policyError) {
      throw new Error(policyError ?? 'Unlock your notes first.');
    }
    // Throws `RecoveryKitError`. The recovery stays pending, so the screen can
    // say what happened; on `changed` the writer leaves it with Cancel.
    await pending.reset.setPassphrase(passphrase);

    if (pending.dropped) {
      // Locked or signed out while the write was in flight. The new passphrase
      // is saved; the keys are already zeroed, so do not unlock with them.
      throw new Error('Your new passphrase is saved. Unlock with it.');
    }

    // The server holds the new wrap. Now unlock.
    pending.reset.discard();
    setRecovery(null);
    setKeyState({ keys: pending.keys, userId: pending.userId });
    persistSession(pending.userId, pending.keys);
    // A failed write here only means the next restart asks for the passphrase.
    if (isRememberBrowserEnabled(pending.userId)) persistLocal(pending.userId, pending.keys);
    sessionRestoreAttemptedRef.current = pending.userId;
  }, [recovery, currentUserId]);

  const prepareRecoveryKit = useCallback(async (options?: { replace?: boolean }): Promise<PreparedRecoveryKit> => {
    const current = keyState;
    if (current.keys === null || current.userId !== currentUserId) {
      throw new Error('Unlock your notes first.');
    }
    // Copied before the await: a lock zeroes the originals in place.
    const { prepareRecoveryKit: prepare } = await loadRecoveryKit();
    // `prepare` copies K before its own first await. A lock during the import
    // above zeroes the keys first; `prepare` then refuses, because zeroed bytes
    // fail the vault key-check, and no key is ever shown.
    return prepare({ keys: current.keys, userId: current.userId, replace: options?.replace });
  }, [keyState, currentUserId]);

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
    setRecovery((prev) => {
      dropRecovery(prev);
      return null;
    });
    setRecoveryOfferUserId(null);
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

  // Unlocked implies a current user, so a stale offer for another user never matches.
  const recoveryScreen = recovery !== null && recovery.userId === currentUserId
    ? 'reset'
    : isUnlocked && recoveryOfferUserId === currentUserId ? 'offer' : null;

  const contextValue = useMemo<EncryptionContextType>(() => ({
      keys,
      isUnlocked,
      isEncryptionSetup,
      setupPassphrase,
      unlockWithPassphrase,
      lockVault,
      persistToLocal,
      unlockWithRecoveryKey,
      recoveryScreen,
      setPassphraseAfterRecovery,
      // Leaving a recovery is a manual lock: it drops the held keys too.
      cancelRecovery: lockVault,
      dismissRecoveryKeyOffer: () => setRecoveryOfferUserId(null),
      prepareRecoveryKit,
  }), [
    keys,
    isUnlocked,
    isEncryptionSetup,
    setupPassphrase,
    unlockWithPassphrase,
    lockVault,
    persistToLocal,
    unlockWithRecoveryKey,
    recoveryScreen,
    setPassphraseAfterRecovery,
    prepareRecoveryKit,
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
