/// <reference types="vitest" />
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { NAVIGATE_FALLBACK_DENYLIST } from './src/pwa/navigateFallbackDenylist'
import { publicPageDocumentsPlugin } from './scripts/public-page-documents.mjs'

// https://vite.dev/config/
export default defineConfig({
  build: {
    // Keep fonts and the logo masks as files, even under the default inline
    // limit (the 4KB seed mask is). An inlined font is embedded in the CSS as
    // base64 — always downloaded, which defeats unicode-range, and larger than
    // the file.
    assetsInlineLimit: (filePath) =>
      /[\\/]assets[\\/](brand|fonts)[\\/]/.test(filePath) ? false : undefined,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      // Item 61, step 4: a module both imported statically and with import() stays in
      // the static importer's chunk, so the dynamic import splits nothing and only
      // hides where the module really loads. Fail the build instead of warning.
      onwarn(warning, defaultHandler) {
        if (/dynamic import will not move module into another chunk/.test(warning.message)) {
          throw new Error(`Static-plus-dynamic import: ${warning.message}`)
        }
        defaultHandler(warning)
      },
      output: {
        // A function, not the object form: the object form claims only the module a
        // name resolves to, so `react-dom` took its index stub while react-dom/client
        // and its code stayed in main, and `react` itself landed in vendor-sentry.
        // scripts/check-bundle-budget.mjs asserts react and react-dom share a chunk.
        manualChunks(id) {
          // With hash-wasm, so the chunk src/lib/argon2.ts imports holds Argon2id and
          // nothing else. Left to Rollup, shared app code was merged into it and the app
          // shell imported hash-wasm statically again (item 61, step 7).
          if (id.endsWith('/src/lib/argon2Wasm.ts')) return 'vendor-hash-wasm'
          if (!id.includes('/node_modules/')) return undefined
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react'
          if (id.includes('/node_modules/@supabase/')) return 'vendor-supabase'
          // Its own chunk, so the app shell stays under the largest-chunk budget and the
          // first-visit spec can see by name that the landing never requests it (item
          // 61, step 5).
          if (id.includes('/node_modules/dexie/')) return 'vendor-dexie'
          // Loaded with import() by src/lib/argon2.ts on the first key derivation; named
          // so the budget check can assert the app shell never imports it statically.
          if (id.includes('/node_modules/hash-wasm/')) return 'vendor-hash-wasm'
          // Replay apart from the rest of Sentry: it is imported later, on its own
          // (src/utils/sentryReplay.ts), and never on shared-note routes.
          if (/\/node_modules\/@sentry-internal\/replay(-canvas)?\//.test(id)) return 'vendor-sentry-replay'
          if (/\/node_modules\/@sentry(-internal)?\//.test(id)) return 'vendor-sentry'
          return undefined
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    // The JavaScript-off documents for the six public pages, served by the dev server.
    // A production build writes them after `vite build` instead (item 60).
    publicPageDocumentsPlugin(),
    VitePWA({
      // Must stay 'autoUpdate'. Under 'prompt' a new worker parks in `waiting`
      // until the page sends SKIP_WAITING — and a client running stale code
      // cannot send it, so browsers stayed pinned to an old precached shell
      // indefinitely. Mid-session activation can invalidate lazy chunk URLs;
      // lazyWithRetry and the chunk-error handler in main.tsx recover from that.
      registerType: 'autoUpdate',
      // Registration is explicit in src/utils/serviceWorkerUpdates.ts so the
      // update path is testable instead of relying on an injected script.
      injectRegister: null,
      // The precache is what an offline visit reads, nothing more (item 61, step 1).
      // Kept: the icons the shell links (favicon, icon-16, icon-48, icon-192) and the font
      // licences, which travel with the precached fonts. Left out: the iOS splash
      // screens (Safari fetches them when adding to the home screen, not through the
      // worker), og-image.png (read by crawlers), icons above 192 px and the
      // apple-touch icons (the OS copies installed icons at install time), and
      // robots.txt. scripts/check-bundle-budget.mjs fails the build if any return.
      includeAssets: [
        'favicon.png',
        'icons/icon-16.png',
        'icons/icon-48.png',
        'icons/icon-192.png',
        'licenses/fonts/*.txt',
      ],
      // The manifest still lists icon-512 and maskable-512 for installability; they
      // are fetched from the network at install. Adding manifest icons here also
      // listed favicon and icon-192 a second time.
      includeManifestIcons: false,
      workbox: {
        // No png/svg/ico glob: the PNGs worth precaching are named in includeAssets.
        globPatterns: ['**/*.{js,css,html,webp,woff2}'],
        // Serve index.html for all navigation requests (full offline-first)
        navigateFallback: 'index.html',
        // Real files (security.txt, sitemap.xml) must reach the network, never the
        // app shell. The list and its reasons live in the imported module.
        navigateFallbackDenylist: NAVIGATE_FALLBACK_DENYLIST,
        // No runtime caching: fonts are self-hosted (src/fonts.css) and land in
        // the precache through the woff2 glob above. The Google Fonts routes
        // this replaced were CacheFirst with `statuses: [0, 200]` and a 1-year
        // TTL — one opaque/failed first fetch was cached and served for a year,
        // pinning that browser to Georgia/system-ui until Cache Storage was
        // cleared by hand.
      },
      manifest: {
        name: 'Yidhan',
        short_name: 'Yidhan',
        description: 'A quiet space for your mind',
        theme_color: '#151C18',
        background_color: '#151C18',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            // Full bleed; the mark sits inside the 40% safe zone.
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    // Use vmThreads pool to avoid "failed to find runner" bug on Windows
    pool: 'vmThreads',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/test/**',
        'src/types/**',
        'src/data/**',
        'src/themes/**',
      ],
      reporter: ['text', 'text-summary', 'lcov'],
      reportsDirectory: './coverage',
      thresholds: {
        // Global floor — ratchet up as Phase 1-3 tests land
        // Phase 0 baseline (2026-03-01): lines 26.6, branches 23.6, functions 23.1, statements 25.6
        // Phase 1 ratchet (2026-03-01): lines 35.3, branches 30.5, functions 29.0, statements 34.0
        // Phase 2-3 observed (2026-03-01): lines 41.0, branches 36.6, functions 33.8, statements 39.6
        // Thresholds set ~1pt below observed for CI headroom
        lines: 40,
        branches: 35,
        functions: 32,
        statements: 38,
      },
    },
  },
})
