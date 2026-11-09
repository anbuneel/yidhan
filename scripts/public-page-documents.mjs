// Static documents for the six public pages, for visitors with JavaScript off (item 60).
// The markup comes from src/prerender/publicPageDocument.tsx; this file runs it.
//
// - `node scripts/public-page-documents.mjs` after `vite build` writes
//   dist/<page>.html from dist/index.html. It runs after the build on purpose: the
//   service worker's precache is already written, so these documents stay out of it.
//   A visitor with the worker installed has JavaScript, and gets index.html from the
//   precache as before. scripts/check-bundle-budget.mjs fails the build if they appear.
// - publicPageDocumentsPlugin() serves the same documents from the dev server, which
//   the Playwright suite runs against. `vite preview` needs nothing: it already serves
//   dist/privacy.html for /privacy.
//
// Vercel serves them through explicit rewrites in vercel.json, ahead of the catch-all.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const DOCUMENT_MODULE = '/src/prerender/publicPageDocument.tsx';

/** The public page a request path names, or null. `/privacy/` counts; `/privacy/x` does not. */
export function publicPageForPath(pathname, pageNames) {
  const segment = pathname.replace(/\/+$/, '').replace(/^\//, '');
  return pageNames.includes(segment) ? segment : null;
}

function acceptsHtml(req) {
  const accept = req.headers.accept;
  return accept === undefined || accept === '' || accept.includes('text/html') || accept.includes('*/*');
}

/** Dev only. Production builds write the files instead. */
export function publicPageDocumentsPlugin() {
  return {
    name: 'yidhan-public-page-documents',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if ((req.method !== 'GET' && req.method !== 'HEAD') || !req.url || !acceptsHtml(req)) return next();
        try {
          const pathname = new URL(req.url, 'http://localhost').pathname;
          // One lowercase segment, or the SSR loader is not worth starting.
          if (!/^\/[a-z]+\/?$/.test(pathname)) return next();
          const mod = await server.ssrLoadModule(DOCUMENT_MODULE);
          const page = publicPageForPath(pathname, mod.PUBLIC_PAGE_NAMES);
          if (!page) return next();
          const source = readFileSync(join(server.config.root, 'index.html'), 'utf8');
          const template = await server.transformIndexHtml(req.url, source);
          // The dev server injects CSS from JavaScript; link it so the page is styled
          // without JavaScript too, as it is in production.
          const styled = template.replace('</head>', '<link rel="stylesheet" href="/src/index.css?direct">\n</head>');
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(mod.publicPageDocument(styled, page));
        } catch (error) {
          next(error);
        }
      });
    },
  };
}

/** Writes dist/<page>.html for every public page. Returns the file names. */
export async function writePublicPageDocuments(root = process.cwd(), distDir = join(root, 'dist')) {
  const { createServer } = await import('vite');
  const { default: react } = await import('@vitejs/plugin-react');
  const server = await createServer({
    root,
    configFile: false,
    logLevel: 'error',
    mode: 'production',
    appType: 'custom',
    plugins: [react()],
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    const mod = await server.ssrLoadModule(DOCUMENT_MODULE);
    const template = readFileSync(join(distDir, 'index.html'), 'utf8');
    const written = [];
    for (const page of mod.PUBLIC_PAGE_NAMES) {
      const file = `${page}.html`;
      writeFileSync(join(distDir, file), mod.publicPageDocument(template, page));
      written.push(file);
    }
    return written;
  } finally {
    await server.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const written = await writePublicPageDocuments();
  console.log(`Public page documents: ${written.map((file) => `dist/${file}`).join(', ')}`);
}
