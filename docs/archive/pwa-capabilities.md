# PWA Capabilities - What Zenote Gets

**Implemented:** v1.7.0 (2025-12-25)

---

## What PWA Gives Zenote

| Feature | What It Means |
|---------|---------------|
| **Install to Home Screen** | Users tap "Add to Home Screen" and get an app icon. Opens without browser UI (no address bar). |
| **Faster Load Times** | After first visit, assets (JS, CSS, fonts) load from cache. Feels instant. |
| **Offline UI Shell** | If offline, the app UI still loads (header, sidebar, etc.). Data operations will fail, but user sees the app, not a browser error page. |
| **Update Automatically** | Service worker auto-updates in background when you deploy new code. |

## What PWA Does NOT Give Us (Yet)

| Missing | Why |
|---------|-----|
| **Offline data access** | Notes are still fetched from Supabase. No local database. |
| **Offline editing** | Can't create/edit notes without connection. |
| **Background sync** | Changes made offline won't queue and sync later. |

## User Experience

**When user goes offline:**
1. Toast appears: "Writing locally. Will sync when the path clears." (雲 icon)
2. App UI remains visible (cached shell)
3. Clicking a note or creating one will fail until back online

**When user comes back online:**
1. Toast appears: "The path has cleared." (〇 icon)
2. Normal functionality resumes

## Technical Implementation

- **Plugin:** vite-plugin-pwa with Workbox
- **Caching Strategy:** Precache all static assets (JS, CSS, HTML, icons, fonts)
- **Google Fonts:** Runtime cache with stale-while-revalidate
- **Service Worker:** Auto-updates when new version deployed

## Future Enhancement: Full Offline Support

For complete offline capability, we would need:
- IndexedDB local storage (via Dexie.js)
- Offline queue for pending changes
- Sync engine with conflict resolution
- Estimated effort: 4-7 days

See `docs/active/offline-support-implementation-plan.md` for the full offline roadmap.

## Related Files

- `vite.config.ts` - PWA plugin configuration
- `public/icons/` - App icons (SVG source + generated PNGs)
- `scripts/generate-icons.ts` - Icon generation script
- `src/hooks/useNetworkStatus.ts` - Zen-style network messages
