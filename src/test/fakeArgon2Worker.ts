/**
 * A stand-in for the Argon2id Web Worker. jsdom has no Worker, so unit tests use
 * this: it runs the worker's real message handler (src/lib/argon2WorkerCore.ts) on
 * the test thread, and lets a test hold, replace or fail a reply.
 *
 * Only the browser runs the real worker file: e2e-sw/argon2-worker.spec.ts and the
 * signed-in unlock spec.
 */
import { handleArgon2Message } from '../lib/argon2WorkerCore';
import { setArgon2WorkerFactoryForTests } from '../lib/argon2';

type Reply = { data: unknown };

export class FakeArgon2Worker {
  static instances: FakeArgon2Worker[] = [];
  /** When true, replies wait for release(). */
  static hold = false;
  /** When set, the next workers fail to construct with this error. */
  static throwOnCreate: Error | null = null;
  /** When true, a request makes the worker fail, as one whose file a deploy removed. */
  static failOnPost = false;

  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null;
  terminated = false;
  posted: { data: unknown; transfer: Transferable[] }[] = [];
  /** A reply the handler produced while `hold` was on. */
  held: Reply | null = null;
  /** Whether the client called preventDefault on the last error event. */
  errorDefaultPrevented = false;

  constructor() {
    if (FakeArgon2Worker.throwOnCreate) throw FakeArgon2Worker.throwOnCreate;
    FakeArgon2Worker.instances.push(this);
  }

  postMessage(data: unknown, transfer: Transferable[] = []): void {
    this.posted.push({ data, transfer });
    if (FakeArgon2Worker.failOnPost) {
      setTimeout(() => this.fail(), 0);
      return;
    }
    // A structured clone, roughly: the worker gets its own salt buffer.
    const request = data as Record<string, unknown>;
    const copy = { ...request, salt: new Uint8Array(request.salt as Uint8Array) };
    void handleArgon2Message(copy, (message) => {
      const reply = { data: message };
      if (FakeArgon2Worker.hold) this.held = reply;
      else setTimeout(() => this.deliver(reply), 0);
    });
  }

  /** Deliver the held reply, the way a slow worker finally answers. */
  release(): void {
    // Releasing nothing means the test lost track of its derivation; fail loudly
    // rather than leave a promise that never settles.
    if (!this.held) throw new Error('FakeArgon2Worker.release(): no reply is held');
    const reply = this.held;
    this.held = null;
    this.deliver(reply);
  }

  /** Answer with anything at all. */
  reply(data: unknown): void {
    this.deliver({ data });
  }

  /** Fire an error event, as a worker that failed to load or crashed does. */
  fail(): void {
    if (this.terminated) return;
    this.errorDefaultPrevented = false;
    this.onerror?.({
      preventDefault: () => { this.errorDefaultPrevented = true; },
      message: 'worker failed',
    } as unknown as ErrorEvent);
  }

  terminate(): void {
    this.terminated = true;
  }

  private deliver(reply: Reply): void {
    // A terminated worker never delivers anything.
    if (this.terminated) return;
    this.onmessage?.({ data: reply.data } as MessageEvent<unknown>);
  }
}

/** Route Argon2id through fake workers until resetFakeArgon2Worker(). */
export function installFakeArgon2Worker(): void {
  FakeArgon2Worker.instances = [];
  FakeArgon2Worker.failOnPost = false;
  FakeArgon2Worker.hold = false;
  FakeArgon2Worker.throwOnCreate = null;
  setArgon2WorkerFactoryForTests(() => new FakeArgon2Worker() as unknown as Worker);
}

/** Back to jsdom's default: no Worker, so the main-thread fallback. */
export function resetFakeArgon2Worker(): void {
  FakeArgon2Worker.hold = false;
  FakeArgon2Worker.failOnPost = false;
  FakeArgon2Worker.throwOnCreate = null;
  setArgon2WorkerFactoryForTests(null);
  FakeArgon2Worker.instances = [];
}

/** The workers that were sent a request, in order. */
export function usedWorkers(): FakeArgon2Worker[] {
  return FakeArgon2Worker.instances.filter((w) => w.posted.length > 0);
}
