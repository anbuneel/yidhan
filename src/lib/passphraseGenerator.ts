/**
 * Item 27: the passphrase setup offers a generated passphrase as the default.
 *
 * Six words drawn uniformly from `PASSPHRASE_WORDS` with `crypto.getRandomValues`,
 * joined by hyphens: `maple-orbit-velvet-harbor-candle-ripple`. With 1,831 words
 * that is 6 × log2(1831) ≈ 65.0 bits. Every guess also costs the attacker one
 * Argon2id run at 64 MB, so 65 bits is far out of reach of an offline search.
 *
 * Lowercase letters and hyphens are two character classes and the shortest
 * possible result is 23 characters, so every output passes `validatePassphrasePolicy`
 * (the tests check the shortest case and a large sample).
 *
 * Imported only by the lazy setup screen: the word list must not reach the entry
 * chunk.
 */

import { PASSPHRASE_WORDS } from '../data/passphraseWords';

export const GENERATED_PASSPHRASE_WORDS = 6;
export const GENERATED_PASSPHRASE_SEPARATOR = '-';

/** Bits of entropy in one generated passphrase, rounded down. */
export const GENERATED_PASSPHRASE_BITS = Math.floor(
  GENERATED_PASSPHRASE_WORDS * Math.log2(PASSPHRASE_WORDS.length)
);

/**
 * A uniform index below `count`, by rejection sampling: values in the last,
 * partial block of 2^32 are drawn again, so no word is more likely than another.
 */
export function uniformIndex(
  count: number,
  random: (buffer: Uint32Array) => Uint32Array = (b) => crypto.getRandomValues(b)
): number {
  if (!Number.isInteger(count) || count < 1 || count > 2 ** 32) {
    throw new Error('count must be an integer from 1 to 2^32');
  }
  const limit = 2 ** 32 - (2 ** 32 % count);
  const buffer = new Uint32Array(1);
  for (;;) {
    const value = random(buffer)[0];
    if (value < limit) return value % count;
  }
}

/** A new random passphrase. Never logged or stored by this module. */
export function generatePassphrase(): string {
  const words: string[] = [];
  for (let i = 0; i < GENERATED_PASSPHRASE_WORDS; i++) {
    words.push(PASSPHRASE_WORDS[uniformIndex(PASSPHRASE_WORDS.length)]);
  }
  return words.join(GENERATED_PASSPHRASE_SEPARATOR);
}
