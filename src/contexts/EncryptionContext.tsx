import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import type { DerivedKeys } from '../lib/encryption';
import { deriveKeys, createKeyCheck, verifyKeyCheck } from '../lib/encryption';

interface EncryptionContextType {
  /** Derived encryption keys (null when locked) */
  keys: DerivedKeys | null;
  /** Whether the vault is unlocked (keys are in memory) */
  isUnlocked: boolean;
  /** Whether encryption has been set up (salt exists in user_metadata) */
  isEncryptionSetup: boolean;
  /** Set up passphrase for the first time */
  setupPassphrase: (passphrase: string) => Promise<void>;
  /** Unlock with existing passphrase */
  unlockWithPassphrase: (passphrase: string) => Promise<boolean>;
  /** Clear keys from memory */
  lockVault: () => void;
}

const EncryptionContext = createContext<EncryptionContextType | undefined>(undefined);

// Store keys alongside the userId they belong to, so a user change auto-locks
interface KeyState {
  keys: DerivedKeys | null;
  userId: string | null;
}

export function EncryptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [keyState, setKeyState] = useState<KeyState>({ keys: null, userId: null });

  // Determine if encryption is set up by checking user_metadata
  const encryptionSalt = user?.user_metadata?.encryption_salt as string | undefined;
  const isEncryptionSetup = Boolean(encryptionSalt);

  // Auto-lock: if the current user doesn't match the user who unlocked,
  // the keys are invalid. This is a derived value — no effect needed.
  const currentUserId = user?.id ?? null;
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
  const setupPassphrase = useCallback(async (passphrase: string) => {
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

    // Store in user_metadata
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

    // Keep keys in memory, tagged with the current user
    setKeyState({ keys: derivedKeys, userId: user.id });
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
      return true;
    }

    return false;
  }, [user, encryptionSalt]);

  /**
   * Lock the vault — clear keys from memory.
   */
  const lockVault = useCallback(() => {
    setKeyState({ keys: null, userId: null });
  }, []);

  return (
    <EncryptionContext.Provider value={{
      keys,
      isUnlocked,
      isEncryptionSetup,
      setupPassphrase,
      unlockWithPassphrase,
      lockVault,
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
