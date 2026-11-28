/**
 * Argon2id, the one derivation path (shell-size plan C1). It runs in a Web Worker,
 * with the main-thread hash-wasm chunk as the fallback (item 61, step 7).
 *
 * jsdom has no Worker. These tests drive the worker's real message handler
 * (argon2WorkerCore.ts) behind a fake Worker (src/test/fakeArgon2Worker.ts). The
 * real worker file only runs in a browser: e2e-sw/argon2-worker.spec.ts checks it
 * produces the same vectors under the production CSP.
 *
 * The vectors below were captured from the code before this change (commit
 * d4c1377, main-thread hash-wasm with hex output). A changed byte here locks users
 * out of their notes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { argon2id as directArgon2id } from 'hash-wasm';
import { FakeArgon2Worker } from '../../test/fakeArgon2Worker';

const VECTORS = [
  {
    passphrase: 'correct horse battery staple',
    salt: '000102030405060708090a0b0c0d0e0f',
    legacy:
      'f583c66eb0c983f6be0f1801d34580dba6ce391a35def61fed043c365dc37c52f1c2815097615f218797ed574c7084ed21fd2609b8d0b3706bffd4dec7e6aeb8',
    kek: '0d1a3c6523c8f06e4e0af9c515aa5b5448cfebd6838f2d52c3d8b6ef8ddc3c2e',
  },
  {
    passphrase: 'Ünïcødé passphrase — 🔐 with emoji',
    salt: 'a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5',
    legacy:
      'f27fd0bb365a8443d0400c1ee53e2b11de506696e748ab3d93d52cec43582b2553978581d4fdece8d6cfc686f8dbd321360aec92ba70f772d461d485eb4710d9',
    kek: '507536609830fd96c9dbe50da7c8334b808cb04d5260fd6228f9c137a68e83d4',
  },
] as const;

/** Cheap parameters for the behaviour tests; the vector tests use the real ones. */
const CHEAP = {
  password: 'a passphrase that is long',
  salt: new Uint8Array(16).fill(7),
  parallelism: 1,
  iterations: 2,
  memorySize: 1024,
  hashLength: 32,
} as const;

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex: string) => Uint8Array.from(hex.match(/../g)!, (h) => parseInt(h, 16));

const loadState = vi.hoisted(() => ({ failures: 0, loads: 0 }));

// Each import of the fallback chunk runs this factory; while `failures` is above
// zero it throws, the way a dynamic import rejects when the chunk cannot be fetched.
// The fake worker's own handler was imported before this, so it is unaffected.
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

type Argon2Module = typeof import('../argon2');

/** A fresh argon2.ts, with fake workers unless `worker` is false. */
async function freshArgon2({ worker = true } = {}): Promise<Argon2Module> {
  await freshModules();
  const mod = await import('../argon2');
  mod.setArgon2WorkerFactoryForTests(worker ? () => new FakeArgon2Worker() as unknown as Worker : null);
  return mod;
}

const used = () => FakeArgon2Worker.instances.filter((w) => w.posted.length > 0);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(async () => {
  // Let a spare that an earlier test scheduled start, before counting from zero.
  await flush();
  FakeArgon2Worker.instances = [];
  FakeArgon2Worker.hold = false;
  FakeArgon2Worker.throwOnCreate = null;
});

afterEach(() => {
  vi.doUnmock('../argon2Wasm');
  loadState.failures = 0;
  loadState.loads = 0;
});

describe('parameters', () => {
  it('are the ones existing keys were derived with', async () => {
    const { ARGON2_PARAMS } = await import('../encryption');
    const { KEK_ARGON2_PARAMS } = await import('../vaultKey');
    expect(ARGON2_PARAMS).toEqual({ parallelism: 1, iterations: 3, memorySize: 65536, hashLength: 64 });
    expect(KEK_ARGON2_PARAMS).toEqual({ parallelism: 1, iterations: 3, memorySize: 65536, hashLength: 32 });
  });
});

describe('fixed vectors', () => {
  for (const path of ['worker', 'main thread'] as const) {
    it(`deriveKeys and deriveKekBytes match the captured bytes (${path})`, async () => {
      await freshArgon2({ worker: path === 'worker' });
      const { deriveKeys } = await import('../encryption');
      const { deriveKekBytes } = await import('../vaultKey');
      for (const v of VECTORS) {
        const keys = await deriveKeys(v.passphrase, fromHex(v.salt));
        expect(toHex(keys.rawEncryptionKey) + toHex(keys.rawHashKey)).toBe(v.legacy);
        expect(toHex(await deriveKekBytes(v.passphrase, fromHex(v.salt)))).toBe(v.kek);
      }
      if (path === 'worker') {
        expect(used()).toHaveLength(4);
        expect(loadState.loads).toBe(0);
      } else {
        expect(loadState.loads).toBe(1);
      }
    }, 120_000);
  }

  it('the worker and main-thread paths agree on other inputs and lengths', async () => {
    const worker = await freshArgon2();
    const params = { ...CHEAP, password: 'x'.repeat(300), salt: Uint8Array.from({ length: 16 }, (_, i) => i * 13) };
    for (const hashLength of [16, 32, 64]) {
      const fromWorker = await worker.deriveArgon2id({ ...params, hashLength });
      worker.setArgon2WorkerFactoryForTests(null);
      const fromMain = await worker.deriveArgon2id({ ...params, hashLength });
      worker.setArgon2WorkerFactoryForTests(() => new FakeArgon2Worker() as unknown as Worker);
      expect(fromWorker).toHaveLength(hashLength);
      expect(toHex(fromWorker)).toBe(toHex(fromMain));
    }
  });
});

describe('the worker path', () => {
  it('sends a copy of the salt, transfers it, and leaves the caller\'s salt intact', async () => {
    const { deriveArgon2id } = await freshArgon2();
    const salt = new Uint8Array(16).fill(9);
    await deriveArgon2id({ ...CHEAP, salt });
    expect(salt).toEqual(new Uint8Array(16).fill(9));
    const [{ data, transfer }] = used()[0].posted;
    const request = data as Record<string, unknown>;
    expect(Object.keys(request).sort()).toEqual(
      ['hashLength', 'id', 'iterations', 'memorySize', 'parallelism', 'password', 'salt', 'type'].sort()
    );
    expect(request.salt).not.toBe(salt);
    expect(transfer).toEqual([(request.salt as Uint8Array).buffer]);
  });

  it('terminates the worker after one derivation, and starts a fresh spare', async () => {
    const { deriveArgon2id } = await freshArgon2();
    await deriveArgon2id(CHEAP);
    expect(used()[0].terminated).toBe(true);
    await flush();
    expect(FakeArgon2Worker.instances).toHaveLength(2);
    expect(FakeArgon2Worker.instances[1].terminated).toBe(false);
    // The next derivation takes the spare rather than making another.
    await deriveArgon2id(CHEAP);
    expect(used()).toEqual(FakeArgon2Worker.instances.slice(0, 2));
  });

  it('preloadArgon2 starts an empty worker, not the main-thread chunk', async () => {
    const { deriveArgon2id, preloadArgon2 } = await freshArgon2();
    preloadArgon2();
    expect(FakeArgon2Worker.instances).toHaveLength(1);
    expect(FakeArgon2Worker.instances[0].posted).toHaveLength(0);
    await deriveArgon2id(CHEAP);
    expect(used()).toEqual([FakeArgon2Worker.instances[0]]);
    expect(loadState.loads).toBe(0);
  });

  it('a spare that fails to load is dropped and the fallback chunk is warmed', async () => {
    const { preloadArgon2 } = await freshArgon2();
    preloadArgon2();
    FakeArgon2Worker.instances[0].fail();
    expect(FakeArgon2Worker.instances[0].terminated).toBe(true);
    await vi.waitFor(() => expect(loadState.loads).toBe(1));
  });
});

describe('fallback to the main thread', () => {
  it('when a worker cannot be created: the same bytes', async () => {
    const { deriveArgon2id } = await freshArgon2();
    FakeArgon2Worker.throwOnCreate = new Error('SecurityError');
    await expect(deriveArgon2id(CHEAP)).resolves.toEqual(await directArgon2id({ ...CHEAP, outputType: 'binary' }));
    expect(loadState.loads).toBe(1);
  });

  it('when the worker fails to load or crashes mid-derivation: the same bytes', async () => {
    const { deriveArgon2id } = await freshArgon2();
    const expected = await deriveArgon2id(CHEAP);
    FakeArgon2Worker.hold = true;
    const pending = deriveArgon2id(CHEAP);
    await vi.waitFor(() => expect(used()).toHaveLength(2));
    used()[1].fail();
    await expect(pending).resolves.toEqual(expected);
    expect(used()[1].terminated).toBe(true);
  });

  it('when the worker reports an error: the same bytes', async () => {
    const { deriveArgon2id } = await freshArgon2();
    const expected = await deriveArgon2id(CHEAP);
    FakeArgon2Worker.hold = true;
    const pending = deriveArgon2id(CHEAP);
    await vi.waitFor(() => expect(used()).toHaveLength(2));
    const worker = used()[1];
    worker.reply({ type: 'error', id: (worker.posted[0].data as { id: number }).id });
    await expect(pending).resolves.toEqual(expected);
  });

  it('throws KdfLoadError when the worker fails and the fallback chunk does not load, then retries', async () => {
    const { deriveArgon2id, KdfLoadError } = await freshArgon2();
    FakeArgon2Worker.throwOnCreate = new Error('no workers');
    loadState.failures = 1;
    const failed = deriveArgon2id(CHEAP);
    await expect(failed).rejects.toBeInstanceOf(KdfLoadError);
    await expect(failed).rejects.toThrow(
      'Could not load the encryption module. Check your connection, then reload the page and try again.'
    );
    await expect(deriveArgon2id(CHEAP)).resolves.toHaveLength(32);
    expect(loadState.loads).toBe(2);
  });
});

describe('a malformed worker reply is an error, never a key', () => {
  const malformed: [string, (id: number) => unknown][] = [
    ['too short', (id) => ({ type: 'result', id, hash: new ArrayBuffer(31) })],
    ['too long', (id) => ({ type: 'result', id, hash: new ArrayBuffer(64) })],
    ['another request', (id) => ({ type: 'result', id: id + 1, hash: new ArrayBuffer(32) })],
    ['not an ArrayBuffer', (id) => ({ type: 'result', id, hash: Array.from({ length: 32 }, () => 0) })],
    ['a typed array', (id) => ({ type: 'result', id, hash: new Uint8Array(32) })],
    ['a string', () => 'f'.repeat(64)],
    ['null', () => null],
    ['no type', (id) => ({ id, hash: new ArrayBuffer(32) })],
  ];
  for (const [name, make] of malformed) {
    it(name, async () => {
      const { deriveArgon2id, KdfResultError } = await freshArgon2();
      FakeArgon2Worker.hold = true;
      const pending = deriveArgon2id(CHEAP);
      await vi.waitFor(() => expect(used()).toHaveLength(1));
      const worker = used()[0];
      worker.reply(make((worker.posted[0].data as { id: number }).id));
      await expect(pending).rejects.toBeInstanceOf(KdfResultError);
      expect(worker.terminated).toBe(true);
      // The real answer arriving afterwards changes nothing.
      worker.release();
      expect(loadState.loads).toBe(0);
    });
  }

  it('deriveKeys rejects, so no unlock can use it', async () => {
    await freshArgon2();
    const { deriveKeys } = await import('../encryption');
    const { KdfResultError } = await import('../argon2');
    FakeArgon2Worker.hold = true;
    const pending = deriveKeys('a passphrase that is long', new Uint8Array(16));
    await vi.waitFor(() => expect(used()).toHaveLength(1));
    const worker = used()[0];
    worker.reply({ type: 'result', id: (worker.posted[0].data as { id: number }).id, hash: new ArrayBuffer(32) });
    await expect(pending).rejects.toBeInstanceOf(KdfResultError);
  });
});

describe('cancelArgon2Derivations', () => {
  it('terminates a running worker and rejects; a late reply does nothing', async () => {
    const { deriveArgon2id, cancelArgon2Derivations, KdfCancelledError } = await freshArgon2();
    FakeArgon2Worker.hold = true;
    const pending = deriveArgon2id(CHEAP);
    await vi.waitFor(() => expect(used()[0]?.held).not.toBeNull());
    cancelArgon2Derivations();
    await expect(pending).rejects.toBeInstanceOf(KdfCancelledError);
    expect(used()[0].terminated).toBe(true);
    used()[0].release();
    expect(loadState.loads).toBe(0);
  });

  it('cancels every derivation in flight, including two at once', async () => {
    const { deriveArgon2id, cancelArgon2Derivations, KdfCancelledError } = await freshArgon2();
    FakeArgon2Worker.hold = true;
    const first = deriveArgon2id(CHEAP);
    const second = deriveArgon2id(CHEAP);
    await vi.waitFor(() => expect(used()).toHaveLength(2));
    cancelArgon2Derivations();
    await expect(first).rejects.toBeInstanceOf(KdfCancelledError);
    await expect(second).rejects.toBeInstanceOf(KdfCancelledError);
    expect(used().every((w) => w.terminated)).toBe(true);
  });

  it('discards a main-thread result that finishes after it', async () => {
    const { deriveArgon2id, cancelArgon2Derivations, KdfCancelledError } = await freshArgon2({ worker: false });
    const pending = deriveArgon2id(CHEAP);
    cancelArgon2Derivations();
    await expect(pending).rejects.toBeInstanceOf(KdfCancelledError);
  });

  it('does not affect a derivation started after it', async () => {
    const { deriveArgon2id, cancelArgon2Derivations } = await freshArgon2();
    cancelArgon2Derivations();
    await expect(deriveArgon2id(CHEAP)).resolves.toHaveLength(32);
  });
});

describe('without Worker support', () => {
  it('preloadArgon2 loads the fallback chunk once, and the derivation reuses it', async () => {
    const { deriveArgon2id, preloadArgon2 } = await freshArgon2({ worker: false });
    preloadArgon2();
    await vi.waitFor(() => expect(loadState.loads).toBe(1));
    await deriveArgon2id(CHEAP);
    expect(loadState.loads).toBe(1);
  });

  it('a failed preload is swallowed, and the next derivation loads again', async () => {
    const { deriveArgon2id, preloadArgon2 } = await freshArgon2({ worker: false });
    loadState.failures = 1;
    preloadArgon2();
    await vi.waitFor(() => expect(loadState.loads).toBe(1));
    await expect(deriveArgon2id(CHEAP)).resolves.toHaveLength(32);
    expect(loadState.loads).toBe(2);
  });

  it('deriveKeys and deriveKek reject with KdfLoadError when the chunk does not load', async () => {
    await freshArgon2({ worker: false });
    const { deriveKeys } = await import('../encryption');
    const { deriveKek } = await import('../vaultKey');
    const { KdfLoadError } = await import('../argon2');
    loadState.failures = 2;
    await expect(deriveKeys('a passphrase that is long', new Uint8Array(16))).rejects.toBeInstanceOf(KdfLoadError);
    await expect(deriveKek('a passphrase that is long', new Uint8Array(16))).rejects.toBeInstanceOf(KdfLoadError);
  });
});

describe('the worker handler', () => {
  it('answers a malformed request with an error that carries nothing', async () => {
    const { handleArgon2Message } = await import('../argon2WorkerCore');
    const replies: unknown[] = [];
    await handleArgon2Message({ type: 'derive', id: 1, password: 'secret passphrase', salt: 'not bytes' }, (m) => replies.push(m));
    expect(replies).toEqual([{ type: 'error', id: null }]);
  });

  it('zeroes the salt it received and answers a hash-wasm failure with a bare error', async () => {
    const { handleArgon2Message } = await import('../argon2WorkerCore');
    const salt = new Uint8Array(4).fill(3); // hash-wasm rejects a salt under 8 bytes
    const replies: unknown[] = [];
    await handleArgon2Message({ ...CHEAP, type: 'derive', id: 5, salt }, (m) => replies.push(m));
    expect(replies).toEqual([{ type: 'error', id: 5 }]);
    expect(salt).toEqual(new Uint8Array(4));
  });
});

describe('errors carry nothing secret', () => {
  it('no error from any failure path holds the passphrase or salt', async () => {
    const secret = { ...CHEAP, password: 'SECRET-PASSPHRASE-MARKER', salt: new Uint8Array(16).fill(0xab) };
    const errors: unknown[] = [];
    const capture = (p: Promise<unknown>) => p.catch((e: unknown) => errors.push(e));

    const mod = await freshArgon2();
    FakeArgon2Worker.hold = true;
    const cancelled = capture(mod.deriveArgon2id(secret));
    await vi.waitFor(() => expect(used()).toHaveLength(1));
    mod.cancelArgon2Derivations();
    await cancelled;

    const malformed = capture(mod.deriveArgon2id(secret));
    await vi.waitFor(() => expect(used()).toHaveLength(2));
    used()[1].reply({ type: 'result', id: -1, hash: new ArrayBuffer(1) });
    await malformed;

    FakeArgon2Worker.throwOnCreate = new Error('no workers');
    loadState.failures = 1;
    await capture(mod.deriveArgon2id(secret));

    expect(errors).toHaveLength(3);
    for (const error of errors) {
      const text = `${String(error)} ${JSON.stringify(error)} ${(error as Error).stack ?? ''}`;
      expect(text).not.toContain('SECRET-PASSPHRASE-MARKER');
      expect(text.toLowerCase()).not.toContain('abababab');
    }
  });
});
