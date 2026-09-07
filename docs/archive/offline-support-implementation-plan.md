# Offline Support Implementation Plan

**Author:** Claude (Opus 4.5)
**Date:** 2025-12-25
**Updated:** 2025-12-25
**Status:** Proposed
**Design Reference:** `docs/analysis/offline-support-design-claude.md`

---

## Decision: PWA-Only Approach

After complexity assessment, we're taking a **simpler PWA-only approach** that delivers 70% of the benefit with 20% of the effort.

### What We're Building
- Installable PWA (add to home screen)
- Cached static assets (instant app load)
- Offline reading (if notes were previously loaded)
- Service worker with smart caching

### What We're Deferring
- Local IndexedDB storage
- Offline editing with sync queue
- Conflict resolution UI
- Full local-first architecture

This can be upgraded later if user demand proves the need.

---

## Implementation Plan (1-2 days)

### Step 1: Install Dependencies (15 mins)

```bash
npm install vite-plugin-pwa -D
```

### Step 2: Configure Vite PWA Plugin (1-2 hours)

**Modify `vite.config.ts`:**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Cache Google Fonts
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Cache font files
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
        name: 'Zenote',
        short_name: 'Zenote',
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
      },
    }),
  ],
});
```

### Step 3: Create App Icons (1-2 hours)

**Files to create:**

| File | Size | Purpose |
|------|------|---------|
| `public/icons/icon-192.png` | 192x192 | Standard PWA icon |
| `public/icons/icon-512.png` | 512x512 | Large PWA icon / splash |
| `public/icons/apple-touch-icon.png` | 180x180 | iOS home screen |

**Icon design:**
- Simple leaf/paper motif matching Zenote brand
- Works on both light and dark backgrounds
- Wabi-sabi aesthetic (not overly polished)

### Step 4: Add Meta Tags (30 mins)

**Update `index.html`:**

```html
<head>
  <!-- Existing tags... -->

  <!-- PWA Meta Tags -->
  <meta name="theme-color" content="#1a1f1a" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Zenote" />
  <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />

  <!-- Open Graph (optional but nice) -->
  <meta property="og:title" content="Zenote" />
  <meta property="og:description" content="A quiet space for your mind" />
  <meta property="og:type" content="website" />
</head>
```

### Step 5: Update Network Status Hook (30 mins)

**Modify `src/hooks/useNetworkStatus.ts`:**

Update the offline message to be more Zen:

```typescript
const handleOffline = () => {
  wasOffline.current = true;
  toast('Writing locally. Will sync when the path clears.', {
    icon: '雲',
    duration: 4000,
    style: {
      background: 'var(--color-bg-secondary)',
      color: 'var(--color-text-primary)',
    },
  });
};
```

### Step 6: Test PWA (1 hour)

**Testing checklist:**

- [ ] `npm run build && npm run preview`
- [ ] Open Chrome DevTools → Application → Manifest
- [ ] Verify manifest loads correctly
- [ ] Check "Install" prompt appears
- [ ] Install app to desktop/home screen
- [ ] Verify app launches in standalone mode
- [ ] Test offline: disconnect network, reload app
- [ ] Verify cached assets load offline
- [ ] Test on mobile (iOS Safari, Android Chrome)

---

## File Changes Summary

| File | Action |
|------|--------|
| `vite.config.ts` | Add VitePWA plugin |
| `index.html` | Add PWA meta tags |
| `public/icons/icon-192.png` | Create |
| `public/icons/icon-512.png` | Create |
| `public/icons/apple-touch-icon.png` | Create |
| `src/hooks/useNetworkStatus.ts` | Update message |

---

## What Users Get

| Feature | Benefit |
|---------|---------|
| **Installable** | Add to home screen, app-like experience |
| **Fast loads** | Cached assets = instant startup |
| **Offline shell** | App UI loads even offline |
| **Offline reading** | Previously loaded notes viewable |
| **Auto-updates** | Service worker updates in background |

### Limitations (Accepted)

| Limitation | Workaround |
|------------|------------|
| Can't create notes offline | Show friendly message |
| Can't edit notes offline | Notes are read-only offline |
| Must be online to sync | Standard cloud app behavior |

---

## Future Upgrade Path

If users request full offline editing:

1. Add Dexie.js for IndexedDB storage
2. Implement sync queue
3. Add conflict resolution UI
4. See `docs/analysis/offline-support-design-claude.md` for full design

---

## Timeline

| Task | Time |
|------|------|
| Install & configure PWA plugin | 1-2 hrs |
| Create icons | 1-2 hrs |
| Add meta tags | 30 mins |
| Update network hook | 30 mins |
| Testing | 1 hr |
| **Total** | **4-6 hours** |

---

## Dependencies

```json
{
  "devDependencies": {
    "vite-plugin-pwa": "^0.17.0"
  }
}
```

---

## Related Documents

- Design Philosophy: `docs/analysis/offline-support-design-claude.md`
- Network Status Hook: `src/hooks/useNetworkStatus.ts`
