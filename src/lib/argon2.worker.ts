// Argon2id off the main thread (shell-size plan C1). src/lib/argon2.ts starts this
// worker, sends one request, and terminates it after the reply. The logic is in
// ./argon2WorkerCore.ts.

import { handleArgon2Message } from './argon2WorkerCore';

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
};

scope.onmessage = (event) => {
  void handleArgon2Message(event.data, (message, transfer) => scope.postMessage(message, transfer ?? []));
};
