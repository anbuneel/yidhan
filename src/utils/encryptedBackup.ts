/**
 * The `.yidhan` encrypted backup (item 38).
 *
 * A full account export — notes, tags, pinned state, original timestamps — sealed
 * under a key derived from a **backup passphrase the reader chooses**, not under the
 * vault key.
 *
 * That separation is deliberate and it is the whole design. A backup encrypted under
 * the vault key would stop opening the moment the vault key changed: a compromise
 * rotation (item 103) would turn every old backup into noise, which is the opposite of
 * what a backup is for. Nothing in this file references the vault key, the wrap
 * version or the key-check, and nothing should be added that does — see
 * `docs/plans/2026-09-07-key-migration-and-rotation-design.md` §4.3.
 */

import { argon2id } from 'hash-wasm';
import { toBase64, fromBase64 } from '../lib/encryption';

export const BACKUP_FORMAT = 'yidhan-backup';
export const BACKUP_FORMAT_VERSION = 1;
export const BACKUP_FILE_EXTENSION = '.yidhan';

/** Same cost as the vault's KDF. A backup is offline-attackable, so it gets the same. */
export const BACKUP_ARGON2_PARAMS = {
  parallelism: 1,
  iterations: 3,
  memorySize: 65536, // 64 MB
  hashLength: 32, // one AES-256 key; no HMAC half is needed here
} as const;

const SALT_LENGTH_BYTES = 16;
const IV_LENGTH_BYTES = 12;
/** AES-GCM appends a 16-byte tag; anything shorter cannot be a sealed payload. */
const GCM_TAG_LENGTH_BYTES = 16;

/** Guard against a hostile file asking for gigabytes of allocation. */
export const MAX_BACKUP_FILE_SIZE = 50 * 1024 * 1024;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export interface EncryptedBackupEnvelope {
  format: typeof BACKUP_FORMAT;
  formatVersion: number;
  createdAt: string;
  kdf: {
    name: 'argon2id';
    salt: string;
    iterations: number;
    memorySize: number;
    parallelism: number;
  };
  cipher: {
    name: 'AES-256-GCM';
    iv: string;
  };
  ciphertext: string;
}

/** The file is not a Yidhan backup, or it is damaged or incomplete. */
export class BackupFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupFormatError';
  }
}

/** The file is a well-formed backup; this passphrase does not open it. */
export class BackupPassphraseError extends Error {
  constructor(message = 'That passphrase did not open this backup.') {
    super(message);
    this.name = 'BackupPassphraseError';
  }
}

async function deriveBackupKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const hashHex = await argon2id({
    password: passphrase,
    salt,
    parallelism: BACKUP_ARGON2_PARAMS.parallelism,
    iterations: BACKUP_ARGON2_PARAMS.iterations,
    memorySize: BACKUP_ARGON2_PARAMS.memorySize,
    hashLength: BACKUP_ARGON2_PARAMS.hashLength,
    outputType: 'hex',
  });

  const keyBytes = new Uint8Array(BACKUP_ARGON2_PARAMS.hashLength);
  for (let i = 0; i < keyBytes.length; i++) {
    keyBytes[i] = parseInt(hashHex.substring(i * 2, i * 2 + 2), 16);
  }

  return crypto.subtle.importKey('raw', keyBytes as BufferSource, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

/**
 * Bind the ciphertext to the header describing it, so an envelope cannot be relabelled
 * — a v1 blob presented as a future v2, or one file's salt swapped onto another's
 * ciphertext.
 */
function buildAad(formatVersion: number, saltBase64: string): Uint8Array {
  return textEncoder.encode(`${BACKUP_FORMAT}:${formatVersion}:${saltBase64}`);
}

/** Seal a JSON payload into a `.yidhan` file body. */
export async function createEncryptedBackup(
  payloadJson: string,
  passphrase: string
): Promise<string> {
  if (!passphrase) {
    throw new BackupFormatError('A backup passphrase is required.');
  }

  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const saltBase64 = toBase64(salt);

  const key = await deriveBackupKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      additionalData: buildAad(BACKUP_FORMAT_VERSION, saltBase64) as BufferSource,
    },
    key,
    textEncoder.encode(payloadJson)
  );

  const envelope: EncryptedBackupEnvelope = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    createdAt: new Date().toISOString(),
    kdf: {
      name: 'argon2id',
      salt: saltBase64,
      iterations: BACKUP_ARGON2_PARAMS.iterations,
      memorySize: BACKUP_ARGON2_PARAMS.memorySize,
      parallelism: BACKUP_ARGON2_PARAMS.parallelism,
    },
    cipher: { name: 'AES-256-GCM', iv: toBase64(iv) },
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };

  return JSON.stringify(envelope, null, 2);
}

const DAMAGED = 'This backup file looks incomplete or damaged.';

function decodeOrThrow(value: unknown, field: string): Uint8Array {
  if (typeof value !== 'string' || value.length === 0) {
    throw new BackupFormatError(DAMAGED);
  }
  try {
    return fromBase64(value);
  } catch {
    throw new BackupFormatError(`${DAMAGED} (${field} could not be read)`);
  }
}

/**
 * Read a `.yidhan` file body and check its shape before touching any crypto.
 *
 * A truncated file fails here rather than at decryption, which is what lets the two
 * failures carry different messages: "this file is damaged" and "that passphrase did
 * not open it" are different problems and a reader can only act on one of them.
 */
export function parseBackupEnvelope(fileText: string): EncryptedBackupEnvelope {
  if (fileText.length > MAX_BACKUP_FILE_SIZE) {
    throw new BackupFormatError('This backup file is too large to open.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fileText);
  } catch {
    // A file cut off partway through is not valid JSON, so this is where truncation
    // usually lands.
    throw new BackupFormatError(DAMAGED);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new BackupFormatError('This does not look like a Yidhan backup.');
  }

  const envelope = parsed as Partial<EncryptedBackupEnvelope>;

  if (envelope.format !== BACKUP_FORMAT) {
    throw new BackupFormatError('This does not look like a Yidhan backup.');
  }

  if (typeof envelope.formatVersion !== 'number') {
    throw new BackupFormatError(DAMAGED);
  }

  if (envelope.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new BackupFormatError(
      'This backup was made by a newer version of Yidhan. Update the app, then try again.'
    );
  }

  if (!envelope.kdf || envelope.kdf.name !== 'argon2id') {
    throw new BackupFormatError(`${DAMAGED} (unknown key derivation)`);
  }

  if (!envelope.cipher || envelope.cipher.name !== 'AES-256-GCM') {
    throw new BackupFormatError(`${DAMAGED} (unknown cipher)`);
  }

  const salt = decodeOrThrow(envelope.kdf.salt, 'salt');
  if (salt.length !== SALT_LENGTH_BYTES) {
    throw new BackupFormatError(`${DAMAGED} (salt is the wrong length)`);
  }

  const iv = decodeOrThrow(envelope.cipher.iv, 'iv');
  if (iv.length !== IV_LENGTH_BYTES) {
    throw new BackupFormatError(`${DAMAGED} (nonce is the wrong length)`);
  }

  const ciphertext = decodeOrThrow(envelope.ciphertext, 'contents');
  if (ciphertext.length <= GCM_TAG_LENGTH_BYTES) {
    throw new BackupFormatError(`${DAMAGED} (its contents are missing)`);
  }

  for (const field of ['iterations', 'memorySize', 'parallelism'] as const) {
    const value = envelope.kdf[field];
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      throw new BackupFormatError(`${DAMAGED} (${field} is not a number)`);
    }
  }

  return envelope as EncryptedBackupEnvelope;
}

/**
 * Open a `.yidhan` file body and return the JSON payload inside.
 *
 * Throws `BackupFormatError` when the file is not a backup or is damaged, and
 * `BackupPassphraseError` when it is a backup this passphrase does not open.
 */
export async function openEncryptedBackup(
  fileText: string,
  passphrase: string
): Promise<string> {
  const envelope = parseBackupEnvelope(fileText);

  // Read the parameters from the file rather than from the constants above, so a
  // backup made under different costs still opens after they are changed.
  const salt = fromBase64(envelope.kdf.salt);
  const hashHex = await argon2id({
    password: passphrase,
    salt,
    parallelism: envelope.kdf.parallelism,
    iterations: envelope.kdf.iterations,
    memorySize: envelope.kdf.memorySize,
    hashLength: BACKUP_ARGON2_PARAMS.hashLength,
    outputType: 'hex',
  });

  const keyBytes = new Uint8Array(BACKUP_ARGON2_PARAMS.hashLength);
  for (let i = 0; i < keyBytes.length; i++) {
    keyBytes[i] = parseInt(hashHex.substring(i * 2, i * 2 + 2), 16);
  }
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: fromBase64(envelope.cipher.iv) as BufferSource,
        additionalData: buildAad(envelope.formatVersion, envelope.kdf.salt) as BufferSource,
      },
      key,
      fromBase64(envelope.ciphertext) as BufferSource
    );
  } catch {
    // GCM does not distinguish a wrong key from tampering, and it does not need to:
    // the structural checks above have already ruled out a merely damaged file, so
    // what is left is a passphrase that does not open this backup.
    throw new BackupPassphraseError();
  }

  return textDecoder.decode(plaintext);
}

/** `yidhan-backup-2026-09-07-142530.yidhan` */
export function buildBackupFilename(now: Date = new Date()): string {
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
  return `yidhan-backup-${date}-${time}${BACKUP_FILE_EXTENSION}`;
}
