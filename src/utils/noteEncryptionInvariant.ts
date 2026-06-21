type EncryptionVersionValue = string | number | null | undefined;

interface PlaintextColumns {
  title?: unknown;
  content?: unknown;
}

interface CamelEncryptionFields extends PlaintextColumns {
  encryptedPayload?: unknown;
  encryptionIv?: unknown;
  encryptionVersion?: EncryptionVersionValue;
  contentHash?: unknown;
}

interface SnakeEncryptionFields extends PlaintextColumns {
  encrypted_payload?: unknown;
  encryption_iv?: unknown;
  encryption_version?: EncryptionVersionValue;
  content_hash?: unknown;
}

export interface EncryptedQueuePayload {
  encrypted_payload: string;
  encryption_iv: string;
  encryption_version: number;
  content_hash: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function normalizeEncryptionVersion(value: EncryptionVersionValue): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function hasEmptyPlaintextColumns(note: PlaintextColumns): boolean {
  return (note.title ?? '') === '' && (note.content ?? '') === '';
}

export function hasRequiredCamelEncryptionFields(note: CamelEncryptionFields): boolean {
  return Boolean(
    isNonEmptyString(note.encryptedPayload) &&
    isNonEmptyString(note.encryptionIv) &&
    normalizeEncryptionVersion(note.encryptionVersion) != null &&
    isNonEmptyString(note.contentHash)
  );
}

function hasRequiredSnakeEncryptionFields(note: SnakeEncryptionFields): boolean {
  return Boolean(
    isNonEmptyString(note.encrypted_payload) &&
    isNonEmptyString(note.encryption_iv) &&
    normalizeEncryptionVersion(note.encryption_version) != null &&
    isNonEmptyString(note.content_hash)
  );
}

export function isLaunchEncryptedAppNote(note: CamelEncryptionFields): boolean {
  return hasEmptyPlaintextColumns(note) && hasRequiredCamelEncryptionFields(note);
}

export function isLaunchEncryptedDbNote(note: SnakeEncryptionFields): boolean {
  return hasEmptyPlaintextColumns(note) && hasRequiredSnakeEncryptionFields(note);
}

export function assertLaunchEncryptedAppNote(
  note: CamelEncryptionFields,
  noteId: string,
  source: string
): void {
  if (!isLaunchEncryptedAppNote(note)) {
    throw new Error(`Refusing ${source} for unsafe plaintext note ${noteId}`);
  }
}

export function assertLaunchEncryptedDbNote(
  note: SnakeEncryptionFields,
  noteId: string,
  source: string
): void {
  if (!isLaunchEncryptedDbNote(note)) {
    throw new Error(`Refusing ${source} for unsafe plaintext server note ${noteId}`);
  }
}

export function requireEncryptedQueuePayload(
  payload: Record<string, unknown>,
  noteId: string,
  operation: string
): EncryptedQueuePayload {
  const encryptionVersion = normalizeEncryptionVersion(payload.encryption_version as EncryptionVersionValue);

  if (!isLaunchEncryptedDbNote(payload) || encryptionVersion == null) {
    throw new Error(`Refusing ${operation} sync for unsafe plaintext note ${noteId}`);
  }

  return {
    encrypted_payload: payload.encrypted_payload as string,
    encryption_iv: payload.encryption_iv as string,
    encryption_version: encryptionVersion,
    content_hash: payload.content_hash as string,
  };
}
