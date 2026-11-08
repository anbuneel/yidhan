/**
 * Resolves once the app shell starts, straight away or on a handoff from the public
 * shell (src/shells/Root.tsx). Session Replay waits for it (src/utils/monitoring.ts):
 * the anonymous public pages are static, and Replay is the largest thing they would
 * otherwise load after `load` (item 61, step 5).
 */
let resolveStarted: () => void = () => {};

export const appShellStarted = new Promise<void>((resolve) => {
  resolveStarted = resolve;
});

export function markAppShellStarted(): void {
  resolveStarted();
}
