/**
 * Shared by the service-worker specs: one production build and a static server
 * for `dist/`, the way Vercel serves it.
 */
import { execFileSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

/**
 * `npm run build`, which also runs scripts/check-bundle-budget.mjs.
 *
 * The dummy Sentry DSN matters: without one Vite drops Sentry from the bundle,
 * so the budget check measures the wrong bundle (and fails under GitHub Actions).
 * Its host is `.invalid`, so an event the app sends can never reach anything.
 */
export function buildForProduction(): void {
  execFileSync('npm', ['run', 'build'], {
    cwd: repoRoot,
    stdio: 'pipe',
    env: {
      ...process.env,
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? 'https://placeholder.supabase.co',
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
      VITE_SENTRY_DSN:
        process.env.VITE_SENTRY_DSN ?? 'https://00000000000000000000000000000000@placeholder.invalid/0',
    },
  });
}

/**
 * Serve whatever `dirRef.current` points at, so a spec can swap the deployed
 * build under a running browser the way a real deploy does. Unknown paths fall
 * back to index.html, like the Vercel rewrites.
 */
export function startStaticServer(
  dirRef: { current: string },
  { spaFallback = false }: { spaFallback?: boolean } = {}
): Promise<{ server: Server; port: number }> {
  const server = createServer((req, res) => {
    const requested = decodeURIComponent((req.url ?? '/').split('?')[0]);
    let relative = requested === '/' ? 'index.html' : requested.replace(/^\/+/, '');
    let filePath = path.join(dirRef.current, relative);

    // path.relative rather than startsWith: a prefix test lets a sibling
    // directory through when it shares the prefix (…/v1 vs …/v10).
    const escapesRoot = path.relative(dirRef.current, filePath).startsWith('..');
    const isFile = !escapesRoot && existsSync(filePath) && statSync(filePath).isFile();

    if (!isFile && spaFallback && !escapesRoot && !path.extname(relative)) {
      relative = 'index.html';
      filePath = path.join(dirRef.current, relative);
    } else if (!isFile) {
      res.writeHead(404).end('not found');
      return;
    }

    res.writeHead(200, {
      'Content-Type': CONTENT_TYPES[path.extname(filePath)] ?? 'application/octet-stream',
      // A service worker script must never be served stale, or an update check
      // cannot see the new version.
      'Cache-Control': 'no-cache',
    });
    createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({ server, port });
    });
  });
}
