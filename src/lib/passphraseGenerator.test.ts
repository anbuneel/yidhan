/**
 * Item 27: the generated passphrase, and that it passes the strength policy the
 * setup screen and `EncryptionContext` both enforce.
 */

import { describe, it, expect } from 'vitest';
import {
  GENERATED_PASSPHRASE_BITS,
  GENERATED_PASSPHRASE_SEPARATOR,
  GENERATED_PASSPHRASE_WORDS,
  generatePassphrase,
  uniformIndex,
} from './passphraseGenerator';
import { PASSPHRASE_WORDS } from '../data/passphraseWords';
import { evaluatePassphraseStrength, validatePassphrasePolicy } from '../utils/passphrasePolicy';

describe('the word list', () => {
  it('holds distinct lowercase words of three to eight letters', () => {
    expect(PASSPHRASE_WORDS.length).toBe(1831);
    expect(new Set(PASSPHRASE_WORDS).size).toBe(PASSPHRASE_WORDS.length);
    for (const word of PASSPHRASE_WORDS) {
      expect(word).toMatch(/^[a-z]{3,8}$/);
    }
  });

  it('tells every word apart by its first four letters', () => {
    const prefixes = new Set(PASSPHRASE_WORDS.map((w) => w.slice(0, 4)));
    expect(prefixes.size).toBe(PASSPHRASE_WORDS.length);
  });

  it('leaves out words that do not belong in a calm app', () => {
    for (const word of ['bomb', 'gun', 'war', 'kill', 'blood', 'disease', 'prison', 'ugly', 'satoshi']) {
      expect(PASSPHRASE_WORDS).not.toContain(word);
    }
  });
});

describe('generatePassphrase', () => {
  it('is six words from the list, joined by hyphens', () => {
    const words = generatePassphrase().split(GENERATED_PASSPHRASE_SEPARATOR);
    expect(words).toHaveLength(GENERATED_PASSPHRASE_WORDS);
    for (const word of words) expect(PASSPHRASE_WORDS).toContain(word);
  });

  it('carries about 65 bits of entropy', () => {
    expect(GENERATED_PASSPHRASE_BITS).toBe(65);
    expect(GENERATED_PASSPHRASE_WORDS * Math.log2(PASSPHRASE_WORDS.length)).toBeGreaterThanOrEqual(65);
  });

  it('passes the strength policy every time', () => {
    for (let i = 0; i < 2000; i++) {
      const passphrase = generatePassphrase();
      expect(validatePassphrasePolicy(passphrase)).toBeNull();
    }
  });

  it('passes the strength policy at its shortest possible length', () => {
    const shortest = PASSPHRASE_WORDS.filter((w) => w.length === 3).slice(0, GENERATED_PASSPHRASE_WORDS);
    expect(shortest).toHaveLength(GENERATED_PASSPHRASE_WORDS);
    const passphrase = shortest.join(GENERATED_PASSPHRASE_SEPARATOR);
    expect(passphrase).toHaveLength(23);
    expect(validatePassphrasePolicy(passphrase)).toBeNull();
    expect(evaluatePassphraseStrength(passphrase)?.label).toBe('Good');
  });

  it('does not repeat itself', () => {
    const seen = new Set(Array.from({ length: 200 }, () => generatePassphrase()));
    expect(seen.size).toBe(200);
  });

  it('uses every position of the list, not only the first ones', () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 3000; i++) {
      for (const word of generatePassphrase().split('-')) counts.set(word, (counts.get(word) ?? 0) + 1);
    }
    // 18,000 draws over 1,831 words: almost every word appears.
    // A list sliced short, or an index that never reaches the end, falls far below.
    expect(counts.size).toBeGreaterThan(1700);
  });
});

describe('uniformIndex', () => {
  it('draws again when a value falls in the last, partial block', () => {
    const count = 1831;
    const limit = 2 ** 32 - (2 ** 32 % count);
    const values = [limit, 2 ** 32 - 1, 5];
    let calls = 0;
    const index = uniformIndex(count, (buffer) => {
      buffer[0] = values[calls++];
      return buffer;
    });
    expect(calls).toBe(3);
    expect(index).toBe(5);
  });

  it('accepts the last value below the limit', () => {
    const count = 1831;
    const limit = 2 ** 32 - (2 ** 32 % count);
    const index = uniformIndex(count, (buffer) => {
      buffer[0] = limit - 1;
      return buffer;
    });
    expect(index).toBe(count - 1);
  });

  it('refuses a count it cannot draw from', () => {
    expect(() => uniformIndex(0)).toThrow();
    expect(() => uniformIndex(1.5)).toThrow();
  });
});
