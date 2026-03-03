/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split heavy vendor dependencies into separate chunks
          // These cache independently and don't block initial render
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-sentry': ['@sentry/react'],
          'vendor-react': ['react', 'react-dom'],
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.png', 'robots.txt'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Exclude large files from precache (yidhan-logo.svg is 3.65MB, exceeds 2MB limit)
        globIgnores: ['**/yidhan-logo.svg'],
        // Serve index.html for all navigation requests (full offline-first)
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/share\//, /^\/s\//],
        runtimeCaching: [
          {
            // Cache Google Fonts stylesheets
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Cache Google Fonts files
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'Yidhan',
        short_name: 'Yidhan',
        description: 'A quiet space for your mind',
        theme_color: '#1a1f1a',
        background_color: '#1a1f1a',
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
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        // Share Target API - receive shared text from other apps
        share_target: {
          action: '/?share=true',
          method: 'GET',
          params: {
            title: 'title',
            text: 'text',
            url: 'url',
          },
        },
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
