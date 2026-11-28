import { preloadableLazy } from '../utils/preloadableLazy';

// The signed-out screens the app shell can show: sign-in, the Practice Space and the
// 404. Each is its own chunk, so a signed-in reader never downloads them (shell-size
// plan A2). Root and the public shell import this file to start a fetch on intent;
// it holds only import() calls, so it adds nothing heavy to the landing page's path.

export const Auth = preloadableLazy(() => import('./Auth').then((m) => ({ default: m.Auth })));

export const DemoPage = preloadableLazy(() =>
  import('../pages/DemoPage').then((m) => ({ default: m.DemoPage }))
);

export const NotFoundPage = preloadableLazy(() =>
  import('./NotFoundPage').then((m) => ({ default: m.NotFoundPage }))
);
