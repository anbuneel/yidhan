/**
 * Paths the service worker's navigation fallback must not answer with index.html.
 *
 * `navigateFallback` serves the app shell for every navigation so the app opens
 * offline. These paths are real files or server routes, so a navigation there must
 * reach the network: `.well-known` holds security.txt, and `sitemap.xml` is read by
 * crawlers and by anyone who opens it from robots.txt.
 *
 * It lives in its own module so `vite.config.ts` and the routing spec read the same
 * list.
 */
export const NAVIGATE_FALLBACK_DENYLIST: RegExp[] = [
  /^\/api/,
  /^\/share\//,
  /^\/s\//,
  /^\/\.well-known\//,
  /^\/sitemap\.xml$/,
];
