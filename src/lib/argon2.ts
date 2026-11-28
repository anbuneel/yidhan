// Argon2id, the one key-derivation path (shell-size plan C1). Every Argon2id call in
// the app goes through deriveArgon2id: the legacy 64-byte key, the 32-byte KEK, and
// the backup key. Never import hash-wasm statically from app code.
//
// The derivation runs in a Web Worker (src/lib/argon2.worker.ts), so the unlock
// screen stays live for the second or more it takes. Each worker runs one
// derivation and is then terminated, which also frees its 64 MB of wasm memory. A
// fresh, empty worker is started on idle (preloadArgon2), and again straight after
// each derivation, so the next one does not wait for a worker to start.
//
// A deploy can remove the worker file mid-session. A worker started after that fails
// to load, so preloadArgon2 also loads the main-thread fallback chunk: it is then in
// the module registry for the life of the tab, and a fallback after a deploy needs
// no fetch. Loading it allocates no wasm memory until a derivation runs.
//
// Fallback: when a worker cannot be created, fails to load, or reports an error, the
// same derivation runs on the main thread through ./argon2Wasm, loaded with import()
// (item 61, step 7). That chunk is precached by the JS glob, as is the worker file.
// A failed load of the fallback throws KdfLoadError and is not cached here, so the
// next attempt imports again. Callers must let it propagate: it is not a wrong
// passphrase.
//
// A reply of the wrong shape or length is KdfResultError, never a key.
// cancelArgon2Derivations() (lock, sign-out, user change) terminates every running
// worker and makes every pending call reject with KdfCancelledError, so a late reply
// cannot unlock anything.
//
// Nothing here logs, and no error message carries the passphrase, salt or key.

import type * as Argon2Wasm from './argon2Wasm';
import { readArgon2Reply, type Argon2Params, type Argon2WorkerRequest } from './argon2Protocol';

export type { Argon2Params } from './argon2Protocol';

type HashWasm = typeof Argon2Wasm;

export class KdfLoadError extends Error {
  constructor(cause: unknown) {
    super('Could not load the encryption module. Check your connection, then reload the page and try again.');
    this.name = 'KdfLoadError';
    this.cause = cause;
  }
}

/** A lock, sign-out or user change ended the derivation. Not a wrong passphrase. */
export class KdfCancelledError extends Error {
  constructor() {
    super('Unlock was cancelled.');
    this.name = 'KdfCancelledError';
  }
}

/** The worker replied with something that is not a key of the expected length. */
export class KdfResultError extends Error {
  constructor() {
    super('The encryption module returned an unexpected result. Reload the page and try again.');
    this.name = 'KdfResultError';
  }
}

// ---------------------------------------------------------------------------
// Main-thread fallback
// ---------------------------------------------------------------------------

let loading: Promise<HashWasm> | null = null;

function loadHashWasm(): Promise<HashWasm> {
  if (!loading) {
    loading = import('./argon2Wasm').catch((err: unknown) => {
      loading = null;
      throw new KdfLoadError(err);
    });
  }
  return loading;
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

export type Argon2WorkerFactory = () => Worker;

// The literal `new Worker(new URL(...), ...)` form is what Vite detects to bundle the
// worker as its own same-origin file. No blob or inline worker: the CSP allows them,
// but a file is precached and inspectable.
const createRealWorker: Argon2WorkerFactory = () =>
  new Worker(new URL('./argon2.worker.ts', import.meta.url), { type: 'module' });

let workerFactory: Argon2WorkerFactory | null = typeof Worker === 'undefined' ? null : createRealWorker;

/** Tests only: jsdom has no Worker, so unit tests pass a fake, or null for none. */
export function setArgon2WorkerFactoryForTests(factory: Argon2WorkerFactory | null): void {
  workerFactory = factory;
  spare?.terminate();
  spare = null;
}

/** An idle worker with no request sent to it yet. */
let spare: Worker | null = null;
let nextRequestId = 1;
/** Bumped by cancelArgon2Derivations; a call that sees it change rejects. */
let generation = 0;
const running = new Set<() => void>();

const FALLBACK = Symbol('fallback');

function spawnWorker(): Worker | null {
  if (!workerFactory) return null;
  try {
    return workerFactory();
  } catch {
    return null;
  }
}

function takeWorker(): Worker | null {
  const worker = spare;
  spare = null;
  if (worker) {
    worker.onerror = null;
    return worker;
  }
  return spawnWorker();
}

function startSpare(): void {
  if (spare) return;
  const worker = spawnWorker();
  if (!worker) {
    // No worker in this browser: warm the fallback instead.
    void loadHashWasm().catch(() => undefined);
    return;
  }
  spare = worker;
  // A spare that fails to load (no module workers, the file did not fetch) is
  // dropped, and the fallback is warmed so an unlock still has code in memory.
  worker.onerror = (event) => {
    event.preventDefault();
    worker.terminate();
    if (spare === worker) spare = null;
    void loadHashWasm().catch(() => undefined);
  };
}

function runInWorker(worker: Worker, params: Argon2Params): Promise<Uint8Array | typeof FALLBACK> {
  return new Promise((resolve, reject) => {
    const id = nextRequestId++;
    const finish = () => {
      running.delete(cancel);
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      worker.terminate();
    };
    const cancel = () => {
      finish();
      reject(new KdfCancelledError());
    };
    running.add(cancel);

    worker.onmessage = (event: MessageEvent<unknown>) => {
      finish();
      const reply = readArgon2Reply(event.data, id, params.hashLength);
      if (reply === 'error') resolve(FALLBACK);
      else if (reply === null) reject(new KdfResultError());
      else resolve(reply);
    };
    // The worker did not load, or crashed. Its message is not forwarded anywhere.
    worker.onerror = (event: ErrorEvent) => {
      event.preventDefault();
      finish();
      resolve(FALLBACK);
    };
    worker.onmessageerror = () => {
      finish();
      resolve(FALLBACK);
    };

    // A copy, transferred, so the caller's salt is untouched and no second copy stays here.
    const salt = params.salt.slice();
    const request: Argon2WorkerRequest = {
      type: 'derive',
      id,
      password: params.password,
      salt,
      parallelism: params.parallelism,
      iterations: params.iterations,
      memorySize: params.memorySize,
      hashLength: params.hashLength,
    };
    try {
      worker.postMessage(request, [salt.buffer]);
    } catch {
      finish();
      resolve(FALLBACK);
    }
  });
}

async function runOnMainThread(params: Argon2Params, startedIn: number): Promise<Uint8Array> {
  const { argon2id } = await loadHashWasm();
  if (startedIn !== generation) throw new KdfCancelledError();
  const hash = await argon2id({
    password: params.password,
    salt: params.salt,
    parallelism: params.parallelism,
    iterations: params.iterations,
    memorySize: params.memorySize,
    hashLength: params.hashLength,
    outputType: 'binary',
  });
  if (startedIn !== generation) {
    hash.fill(0);
    throw new KdfCancelledError();
  }
  if (hash.length !== params.hashLength) {
    hash.fill(0);
    throw new KdfResultError();
  }
  return hash;
}

/**
 * Argon2id over `password` and `salt`, `hashLength` raw bytes out. Runs in a worker,
 * or on the main thread when no worker is available.
 *
 * Throws KdfLoadError when neither the worker nor the fallback chunk loads,
 * KdfResultError for a malformed worker reply, and KdfCancelledError when
 * cancelArgon2Derivations ran before it finished.
 */
export async function deriveArgon2id(params: Argon2Params): Promise<Uint8Array> {
  const startedIn = generation;
  const worker = takeWorker();
  if (worker) {
    const result = await runInWorker(worker, params);
    // Now, not on idle: a vault unlock with a wrong passphrase runs a second
    // derivation (the legacy fields) straight after the first.
    startSpare();
    if (result !== FALLBACK) {
      if (startedIn !== generation) {
        result.fill(0);
        throw new KdfCancelledError();
      }
      return result;
    }
    if (startedIn !== generation) throw new KdfCancelledError();
  }
  return runOnMainThread(params, startedIn);
}

/**
 * Lock, sign-out or user change: terminate every running worker and reject every
 * pending derivation with KdfCancelledError. A main-thread derivation cannot be
 * stopped, but its result is discarded.
 */
export function cancelArgon2Derivations(): void {
  generation += 1;
  for (const cancel of [...running]) cancel();
}

/**
 * Start an empty worker now, so a later unlock does not wait on it, and load the
 * main-thread fallback chunk, so a fallback after a deploy needs no fetch. A failure
 * is ignored here.
 */
export function preloadArgon2(): void {
  startSpare();
  void loadHashWasm().catch(() => undefined);
}
