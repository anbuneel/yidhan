/**
 * Item 61, step 7: Argon2id loads hash-wasm on first use. These tests check the
 * lazy loader gives the same output as hash-wasm, and that a failed chunk load
 * surfaces as a retryable error from every key-derivation path, never as a wrong
 * passphrase (which would count toward the unlock lockout).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { argon2id as directArgon2id } from 'hash-wasm';

const PARAMS = {
  password: 'correct horse battery staple',
  salt: new Uint8Array(16).fill(7),
  parallelism: 1,
  iterations: 2,
  memorySize: 1024,
  hashLength: 32,
} as const;

const loadState = vi.hoisted(() => ({ failures: 0, loads: 0 }));

// Each import of the module runs this factory; while `failures` is above zero it
// throws, the way a dynamic import rejects when the chunk cannot be fetched.
// Registered per test with doMock, after resetModules, so every test starts with
// nothing loaded.
async function freshModules() {
  vi.resetModules();
  vi.doMock('../argon2Wasm', async (importOriginal) => {
    loadState.loads += 1;
    if (loadState.failures > 0) {
      loadState.failures -= 1;
      throw new TypeError('Failed to fetch dynamically imported module');
    }
    return importOriginal();
  });
}

async function freshArgon2() {
  await freshModules();
  return import('../argon2');
}

afterEach(() => {
  vi.doUnmock('../argon2Wasm');
  loadState.failures = 0;
  loadState.loads = 0;
});

describe('lazy argon2id', () => {
  it('returns the same hex and binary output as hash-wasm', async () => {
    const { argon2id } = await freshArgon2();
    await expect(argon2id({ ...PARAMS, outputType: 'hex' })).resolves.toBe(
      await directArgon2id({ ...PARAMS, outputType: 'hex' })
    );
    await expect(argon2id({ ...PARAMS, outputType: 'binary' })).resolves.toEqual(
      await directArgon2id({ ...PARAMS, outputType: 'binary' })
    );
  });

  it('loads the chunk once for concurrent and later calls', async () => {
    const { argon2id } = await freshArgon2();
    await Promise.all([
      argon2id({ ...PARAMS, outputType: 'hex' }),
      argon2id({ ...PARAMS, outputType: 'hex' }),
    ]);
    await argon2id({ ...PARAMS, outputType: 'hex' });
    expect(loadState.loads).toBe(1);
  });

  it('throws KdfLoadError when the chunk does not load, and fetches again on the next call', async () => {
    const { argon2id, KdfLoadError } = await freshArgon2();
    loadState.failures = 1;

    const failed = argon2id({ ...PARAMS, outputType: 'hex' });
    await expect(failed).rejects.toBeInstanceOf(KdfLoadError);
    await expect(failed).rejects.toThrow(
      'Could not load the encryption module. Check your connection, then reload the page and try again.'
    );

    await expect(argon2id({ ...PARAMS, outputType: 'hex' })).resolves.toBe(
      await directArgon2id({ ...PARAMS, outputType: 'hex' })
    );
    expect(loadState.loads).toBe(2);
  });
});

describe('preloadArgon2', () => {
  it('loads the chunk ahead of the first derivation, which then does not load it again', async () => {
    const { argon2id, preloadArgon2 } = await freshArgon2();
    preloadArgon2();
    await vi.waitFor(() => expect(loadState.loads).toBe(1));
    await argon2id({ ...PARAMS, outputType: 'hex' });
    expect(loadState.loads).toBe(1);
  });

  it('swallows a failed preload, and the next derivation loads again', async () => {
    const { argon2id, preloadArgon2 } = await freshArgon2();
    loadState.failures = 1;
    preloadArgon2();
    await vi.waitFor(() => expect(loadState.loads).toBe(1));
    await expect(argon2id({ ...PARAMS, outputType: 'hex' })).resolves.toBe(
      await directArgon2id({ ...PARAMS, outputType: 'hex' })
    );
    expect(loadState.loads).toBe(2);
  });
});

describe('key derivation when the hash-wasm chunk does not load', () => {
  it('deriveKeys (legacy unlock and setup) rejects with KdfLoadError', async () => {
    await freshModules();
    const { deriveKeys } = await import('../encryption');
    const { KdfLoadError } = await import('../argon2');
    loadState.failures = 1;
    await expect(deriveKeys('a passphrase that is long', new Uint8Array(16))).rejects.toBeInstanceOf(KdfLoadError);
  });

  it('deriveKek (vault unlock, setup and recovery reset) rejects with KdfLoadError', async () => {
    await freshModules();
    const { deriveKek } = await import('../vaultKey');
    const { KdfLoadError } = await import('../argon2');
    loadState.failures = 1;
    await expect(deriveKek('a passphrase that is long', new Uint8Array(16))).rejects.toBeInstanceOf(KdfLoadError);
  });
});
