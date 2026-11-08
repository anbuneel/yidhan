/**
 * Reading `user_metadata.vault` (item 24). Small and synchronous, so it can sit
 * in the entry chunk: the restore paths need it during render. The crypto lives
 * in `vaultKey.ts`, which is loaded with `import()`.
 *
 * Design: `docs/plans/2026-09-07-key-migration-and-rotation-design.md`.
 */

import { KEY_CHECK_VERSION } from './encryption';
import type { KeyCheckVersion } from './encryption';

/** Wrap schema version (`vault.version`). */
export const VAULT_VERSION = 1;

export const MASTER_KEY_LENGTH_BYTES = 64;
export const KEK_SALT_LENGTH_BYTES = 16;
export const WRAP_IV_LENGTH_BYTES = 12;
/** AES-GCM ciphertext of the 64-byte `K` plus the 16-byte tag. */
const WRAPPED_KEY_LENGTH_BYTES = MASTER_KEY_LENGTH_BYTES + 16;

// ============================================================================
// Types
// ============================================================================

/** The `user_metadata.vault` object (§1.1). */
export interface VaultMetadata {
  version: typeof VAULT_VERSION;
  wrapVersion: number;
  kekSalt: string;      // base64, 16 bytes
  wrappedKey: string;   // base64, AES-GCM(KEK, K)
  wrapIv: string;       // base64, 12 bytes
  keyCheck: string;     // base64, key-check under K
  keyCheckIv: string;   // base64
  keyCheckVersion: number;
  migratedAt: string;   // ISO timestamp
}

/**
 * What a client finds in `user_metadata.vault`.
 *
 * - `absent`: never migrated. Legacy unlock, then migrate.
 * - `valid`: unwrap path.
 * - `unsupported`: a vault version this client does not know. Behave like an old
 *   client (§3.3): use the legacy fields, never overwrite the vault.
 * - `malformed`: a version-1 vault that is not complete. §3.2 says this is not
 *   reachable by the migration, so it is corruption: use the legacy fields and
 *   leave it alone rather than overwrite something we cannot read.
 */
export type VaultReadResult =
  | { status: 'absent' }
  | { status: 'valid'; vault: VaultMetadata }
  | { status: 'unsupported'; version: unknown }
  | { status: 'malformed' };

// ============================================================================
// Reading the metadata
// ============================================================================

/** Decoded byte length of a base64 string, or -1 if it is not base64. */
function base64ByteLength(value: unknown): number {
  if (typeof value !== 'string' || value.length === 0) return -1;
  try {
    return atob(value).length;
  } catch {
    return -1;
  }
}

function isBase64OfLength(value: unknown, length: number): value is string {
  return base64ByteLength(value) === length;
}

function isNonEmptyBase64(value: unknown): value is string {
  return base64ByteLength(value) > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

/** Classify `user_metadata.vault`. Never throws. */
export function readVaultMetadata(raw: unknown): VaultReadResult {
  if (raw == null) {
    return { status: 'absent' };
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { status: 'malformed' };
  }

  const candidate = raw as Record<string, unknown>;
  if (candidate.version !== VAULT_VERSION) {
    return { status: 'unsupported', version: candidate.version };
  }

  if (
    !isPositiveInteger(candidate.wrapVersion)
    || !isBase64OfLength(candidate.kekSalt, KEK_SALT_LENGTH_BYTES)
    || !isBase64OfLength(candidate.wrappedKey, WRAPPED_KEY_LENGTH_BYTES)
    || !isBase64OfLength(candidate.wrapIv, WRAP_IV_LENGTH_BYTES)
    || !isNonEmptyBase64(candidate.keyCheck)
    || !isBase64OfLength(candidate.keyCheckIv, WRAP_IV_LENGTH_BYTES)
    || !isPositiveInteger(candidate.keyCheckVersion)
    || typeof candidate.migratedAt !== 'string'
    || candidate.migratedAt.length === 0
  ) {
    return { status: 'malformed' };
  }

  return {
    status: 'valid',
    vault: {
      version: VAULT_VERSION,
      wrapVersion: candidate.wrapVersion,
      kekSalt: candidate.kekSalt,
      wrappedKey: candidate.wrappedKey,
      wrapIv: candidate.wrapIv,
      keyCheck: candidate.keyCheck,
      keyCheckIv: candidate.keyCheckIv,
      keyCheckVersion: candidate.keyCheckVersion,
      migratedAt: candidate.migratedAt,
    },
  };
}

/**
 * The key-check a restore path must verify against (§1.2, §2.2). A migrated
 * account verifies `K` against the vault's key-check; anything else uses the
 * legacy one.
 */
export function selectKeyCheck(metadata: Record<string, unknown> | undefined): {
  source: 'vault' | 'legacy';
  keyCheck: string | undefined;
  keyCheckIv: string | undefined;
  /** The key-check format; null when this client does not know it. */
  keyCheckVersion: KeyCheckVersion | null;
} {
  const vault = readVaultMetadata(metadata?.vault);
  if (vault.status === 'valid') {
    return {
      source: 'vault',
      keyCheck: vault.vault.keyCheck,
      keyCheckIv: vault.vault.keyCheckIv,
      // The vault key-check is always written in the current key-check format.
      // `vault.keyCheckVersion` is a generation counter, not the format.
      keyCheckVersion: KEY_CHECK_VERSION,
    };
  }
  return {
    source: 'legacy',
    keyCheck: metadata?.encryption_key_check as string | undefined,
    keyCheckIv: metadata?.encryption_key_check_iv as string | undefined,
    keyCheckVersion: parseKeyCheckVersion(metadata?.encryption_key_check_version),
  };
}

/** Parse `encryption_key_check_version`. Absent means the v1 format; unknown is null. */
export function parseKeyCheckVersion(version: unknown): KeyCheckVersion | null {
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
