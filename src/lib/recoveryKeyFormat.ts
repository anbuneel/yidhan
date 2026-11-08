/**
 * Recovery key format (item 26): 32 random bytes as RFC 4648 base32, 52
 * characters in groups of four. No crypto beyond the random bytes, so the
 * recovery-key screens can import it without pulling in Argon2id.
 */

export const RECOVERY_KEY_BYTES = 32;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
/** ceil(256 / 5). The last character carries one bit and four zero bits. */
const RECOVERY_KEY_CHARS = 52;
const GROUP_SIZE = 4;

/** 32 random bytes. */
export function generateRecoveryKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(RECOVERY_KEY_BYTES));
}

/** Base32 in groups of four, joined by hyphens: `ABCD-EFGH-…`. */
export function formatRecoveryKey(bytes: Uint8Array): string {
  if (bytes.length !== RECOVERY_KEY_BYTES) {
    throw new Error('A recovery key is 32 bytes');
  }
  let out = '';
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = ((buffer << 8) | byte) & 0xfff;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(buffer >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += ALPHABET[(buffer << (5 - bits)) & 31];
  }
  const groups: string[] = [];
  for (let i = 0; i < out.length; i += GROUP_SIZE) {
    groups.push(out.slice(i, i + GROUP_SIZE));
  }
  return groups.join('-');
}

/**
 * Read a typed or pasted recovery key. Case, spaces and hyphens do not matter,
 * and the digits people misread for letters (0, 1, 8) are read as O, I and B.
 * Returns null for anything that is not exactly one 32-byte key.
 */
export function parseRecoveryKey(text: string): Uint8Array | null {
  const cleaned = text
    .toUpperCase()
    .replace(/[\s-]+/g, '')
    .replace(/0/g, 'O')
    .replace(/1/g, 'I')
    .replace(/8/g, 'B');
  if (cleaned.length !== RECOVERY_KEY_CHARS) return null;

  const out = new Uint8Array(RECOVERY_KEY_BYTES);
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (const char of cleaned) {
    const value = ALPHABET.indexOf(char);
    if (value === -1) {
      out.fill(0);
      return null;
    }
    buffer = ((buffer << 5) | value) & 0xfff;
    bits += 5;
    if (bits >= 8) {
      if (index < RECOVERY_KEY_BYTES) out[index] = (buffer >>> (bits - 8)) & 0xff;
      index += 1;
      bits -= 8;
    }
  }
  // 52 characters hold 260 bits: 256 of key and four that must be zero. A
  // non-zero tail is a typo, not a different key.
  if (index !== RECOVERY_KEY_BYTES || (buffer & ((1 << bits) - 1)) !== 0) {
    out.fill(0);
    return null;
  }
  return out;
}

/** Whether two typed recovery keys are the same key. */
export function recoveryKeysMatch(a: string, b: string): boolean {
  const left = parseRecoveryKey(a);
  const right = parseRecoveryKey(b);
  try {
    if (!left || !right) return false;
    let diff = 0;
    for (let i = 0; i < RECOVERY_KEY_BYTES; i++) diff |= left[i] ^ right[i];
    return diff === 0;
  } finally {
    left?.fill(0);
    right?.fill(0);
  }
}
