Status: PROPOSAL
Last verified: 2026-11-07

# First-visit weight: targets and steps for items 60 and 61

A proposal for lane 2 of `2026-11-07-public-launch-plan.md`. It sets byte budgets for
the landing route, the signed-in app shell and the service worker precache, ranks the
work by bytes saved per day, and replaces two "done when" lines that measure the wrong
thing. Nothing here is implemented yet.

## How this was measured

- `npm run build` at `3d7b2df`, with placeholder Supabase values **and a dummy
  `VITE_SENTRY_DSN`**. Without a DSN, Vite folds `if (sentryDsn)` to `false` and drops
  Sentry: `vendor-sentry` is 19 KB instead of 263 KB. Production sets a DSN, so any
  budget check must build with one too.
- Chunk contents from source maps (`vite build --sourcemap` into a scratch directory).
- A fresh Chromium profile loading `/` from `vite preview`, recording every request from
  the page and from the service worker.
- Sizes are gzip level 9 of the built file. Vercel serves Brotli, so real transfer is
  somewhat smaller. PNG, WebP and WOFF2 are counted as-is.

## Current state

### What an anonymous visitor to `/` downloads

| When | File | Raw KB | Gzip KB | Why it is there |
|---|---|---:|---:|---|
| HTML | `index.html` | 12.5 | 3.4 | Landing shell, paints before the bundle |
| Before parse | `boot.js` | 1.3 | 0.7 | Theme and shell visibility |
| Preload | 2 latin fonts (Cormorant, Source Sans) | 65 | 65 | Shell typography |
| Entry | `main.js` | 853 | 264 | Everything not lazy: whole app, all public pages |
| Modulepreload | `vendor-sentry.js` | 256 | 85 | Sentry + Replay (and, by accident, `react`) |
| Modulepreload | `vendor-supabase.js` | 184 | 48 | Supabase client, imported by `AuthContext` |
| Modulepreload | `vendor-react.js` | 3.6 | 1.4 | Only the `react-dom` index stub |
| CSS | `main.css` | 77 | 15 | All app CSS |
| After mount | `pwa-register`, `workbox-window` | 6.6 | 2.9 | SW registration (`immediate: true`) |
| After mount | logo WebP ×2, JetBrains Mono latin | 69 | 69 | Landing art, mono face |
| **Page total** | | **~1,530** | **553** | Of which JS **402 KB gzip, 1.3 MB to parse** |

The `load` event fires at about 290 ms unthrottled and about 3.3 s with 4× CPU and a
1.6 Mbps link (local preview server, indicative only). The shell paints first (FCP
about 1 s throttled), so the cost is time until the landing is interactive and CPU on
phones, not a blank screen.

### Inside `main.js` (gzip estimated per group)

| Group | Raw KB | Gzip KB | Needed on `/`? |
|---|---:|---:|---|
| `react-dom` + `scheduler` | 178 | 56 | Yes |
| App components (library, auth, modals, public pages) | 178 | 41 | Landing, header, note card only (~10) |
| `dexie` | 95 | 32 | No |
| `src/data/changelog.ts` | 58 | 19 | Only `/changelog` |
| Services, hooks, contexts, utils, lib | 158 | 50 | Router and theme only (~5) |
| `hash-wasm` | 28 | 11 | No — only at unlock |
| `dompurify` | 23 | 9 | Yes, while the hero uses `NoteCard` |
| `@react-spring/*`, `@use-gesture/*` | 59 | 23 | No |
| `minisearch` | 18 | 6 | No |
| Other (`react-hot-toast`, Capacitor, masonry, demo page) | 58 | 17 | Partly |

### Precache

The service worker registers as soon as `main.js` runs and its first precache request
starts at about 345 ms — while the landing is still fetching images and fonts.

| Category | Entries | KB | Needed offline? |
|---|---:|---:|---|
| iOS splash PNGs | 14 | 3,207 | No. Safari fetches these at add-to-home-screen, not through the cache |
| Icons, favicons, apple-touch | 11 | 1,337 | Only `favicon.png` and `icon-192` for the shell |
| `og-image.png` | 1 | 279 | No. Read by crawlers |
| JS except Editor (gzip) | 15 | 421 | Yes |
| `Editor.js` (gzip) | 1 | 136 | Yes (offline editing) |
| Fonts, 18 subsets | 18 | 315 | Latin + latin-ext (185 KB) always; the rest by script |
| Logo WebP, CSS, HTML, licences, manifest | 11 | 73 | Yes |
| **Total** | **70** | **5,766** | 3 URLs listed twice (`favicon.png`, `icon-192`, `icon-512`) |

## Problems with the current "done when"

| Item | Current | Problem | Replacement |
|---|---|---|---|
| 61 | `main` under 300 KB | Unit not stated. `main` is already 264 KB gzip (853 raw), so as gzip it passes today; as raw it is the wrong target. Entry-chunk size ignores the 134 KB of modulepreloaded vendor chunks | Budgets on what the visitor fetches (table below), asserted from the built files |
| 61 | Five static-plus-dynamic import warnings | There are six (`supabase`, `offlineDb`, `offlineNotes`, `encryption`, `encryptedNotes`, `@capacitor/network`) | Zero, enforced by the build failing on that warning |
| 61 | Sentry replay via `lazyLoadIntegration` | `lazyLoadIntegration` loads from `browser.sentry-cdn.com`; the CSP's `script-src 'self'` blocks it | Dynamic `import()` of the replay integration from our own bundle |
| 60 | Landing JavaScript under 50 KB gzip | Unreachable with React: `react-dom` alone is 54 KB gzip | 90 KB gzip with React (below). 50 KB only if public routes drop React — a separate decision |
| 60 | Content visible with JavaScript disabled | Already true for `/` via the shell (`e2e/landing-shell.spec.ts`) | Keep for the other public routes only |
| 60 | Hydrate only theme toggle and CTA | Conflicts with `DECISIONS.md` 2026-09-10 (shell replaced, no hydration). Not needed to hit the budget | Decide when item 60 starts, after 61 lands |

## Targets

| Budget | Now | Target | Reasoning |
|---|---:|---:|---|
| JS the page requests on `/` before `load` (gzip) | 402 KB | **≤ 90 KB** | Floor is React 19: `react-dom` 54 + `react` 3. Landing, header, hero card, router, theme and DOMPurify add about 20. 15 KB headroom. Supabase, Sentry, Dexie and the app stay off this path |
| Everything the page requests on `/` until network idle, excluding the precache (gzip) | 553 KB | **≤ 300 KB** | 90 JS + Sentry after `load` (~45 without Replay) + 15 CSS + 3 HTML + 86 fonts + 48 logo art. Leaves ~15 |
| JS to render the unlocked library, Editor excluded (gzip) | 402 KB | **≤ 330 KB** | Needs React 57, Supabase 48, Dexie 32, sync/services/hooks ~50, components ~40, Sentry ~45, spring/gesture 23, `hash-wasm` 11, MiniSearch 6, DOMPurify 9 ≈ 320. Replay stays deferred |
| Largest single JS chunk (gzip) | 264 KB | **≤ 150 KB** | Editor (136) is the largest thing that must load as one unit; no chunk should beat it |
| Precache transfer | 5,766 KB, 70 entries | **≤ 1,100 KB**, no duplicates | All JS (557) + CSS, HTML, licences, logo (~70) + fonts (315) + two icons (78) ≈ 1,020 after step 1. Route splitting moves bytes between chunks but not out of the precache. 80 KB headroom |
| When the precache starts | ~345 ms, during landing load | **After the `load` event** | Precache is for the next visit; it should not compete with this one |

## Steps, ranked by bytes saved per day

Precache bytes and critical-path bytes are counted separately; they are not comparable.

| # | Step | Precache KB saved | Critical-path KB saved | Effort |
|---|---|---:|---:|---:|
| 1 | Trim the precache: drop `splash/`, `og-image.png`, icons above 192 px, and the duplicate `includeAssets` entries | 4,745 | 0 | 0.5 d |
| 2 | Defer Sentry until after `load`; load Replay with `import()` from our bundle; a pre-init buffer in `main.tsx` queues errors and unhandled rejections and flushes them after init | 0 | 85 | 1 d |
| 3 | Lazy-load `changelog.ts` with the Changelog page | 0 | 19 | 0.25 d |
| 4 | Fix the React chunk and the six import warnings | 0 | 0 (prerequisite for 5) | 1 d |
| 5 | Split public routes from the app shell; load Supabase only when there is a session, an auth callback, or the visitor opens sign-in | 0 | ~225 on `/` (main ~185, Supabase 48) | 4 d |
| 6 | Register the service worker after `load` | 0 | 0 (moves ~1 MB of precache traffic after `load`) | 0.5 d |
| 7 | `hash-wasm` loaded inside `deriveKey` | 0 | 11 (app shell) | 0.5 d |

Order: 1, 3, 6, 4, 2, 5, 7. Steps 1, 3 and 6 are hours each and independent. Step 5 is the one that meets the
landing budget; 2 and 4 must land before it.

Considered and declined: precaching only latin and latin-ext font subsets. It saves
130 KB but changes the font precache invariant, which has an incident behind it.

### What each step risks, and what constrains it

| # | What could break | Invariant in `CLAUDE.md` | CI assertion |
|---|---|---|---|
| 1 | Installed PWA icon or iOS splash missing offline. Installed icons are copied by the OS at install time; splash is fetched by Safari, not the page. Keep `favicon.png`, `icon-192`, the logo WebP and the font licences | Service worker; font licences travel with fonts | Build script: precache total ≤ 1,100 KB, no URL twice, no `splash/` or `og-image`, no PNG over 100 KB |
| 2 | Errors thrown before Sentry loads would be lost without the pre-init buffer; the buffer must not grow without bound or hold note content; scrubbers must still run on every event; Replay must stay off `/s/*` | Sentry scrubber; shared notes never replayed | `e2e-sw` spec: no Sentry chunk requested before `load`; unit test that `beforeSend` and `beforeBreadcrumb` are the scrubbers; unit test that `/s/` never imports Replay; unit test that an error thrown before init is reported after it |
| 3 | Changelog page flashes a fallback | Lazy chunks recover via `lazyWithRetry` | Build script: `changelog` not in the entry's static import closure |
| 4 | Changing `manualChunks` can move `react` into a different shared chunk; making the six dynamic imports static is the honest fix where the module is already eager | Self-echo suppression, sync engine invariants (no behaviour change intended) | Build fails on Rollup's "dynamic import will not move module" warning; build script: `react` and `react-dom` in the same chunk |
| 5 | Signed-in visitor on `/`; OAuth callback (tokens in URL) must still reach Supabase at once; demo-to-account migration; landing → sign-in without a reload; mid-session SW activation invalidating the new chunks | Landing shell mirrors `LandingPage.tsx` and `boot.js` session check must agree with the new gate; encrypted reads fail closed; lazy chunk recovery | `e2e-sw` spec: JS before `load` on `/` ≤ 90 KB, no `supabase`/`dexie` chunk requested; existing `auth.spec.ts`, `routing.spec.ts`, `practice-space.spec.ts`, `landing-shell.spec.ts` |
| 6 | First-visit offline readiness arrives a few hundred ms later. `registerType` must stay `'autoUpdate'`; only the call site moves, inside `serviceWorkerUpdates.ts` | Service worker `registerType` and explicit registration | `e2e-sw` spec: first SW request after `load`; existing update tests in `e2e-sw/service-worker-update.spec.ts` |
| 7 | Unlock slower by one small fetch; offline unlock needs the chunk precached (it will be, via the JS glob) | Key storage: every restore path verifies `encryption_key_check` | Existing `EncryptionContext` tests; build script: `hash-wasm` not in entry closure |

## How the budgets are enforced

- **`scripts/check-bundle-budget.mjs`**, run by `npm run build` after
  `check-manifest.mjs`, so the `fast-checks` job fails on a regression. It reads
  `dist/index.html` and `dist/sw.js`, follows static imports from the entry, and checks
  the numbers above against `scripts/bundle-budget.json`. Budgets live in that one file
  so a change to them shows up in review.
- **CI builds with a dummy `VITE_SENTRY_DSN`.** Otherwise the check measures a bundle
  without Sentry and passes by accident.
- **`e2e-sw/first-visit.spec.ts`** in the existing `service-worker` job, which already
  builds for production and serves it statically. Fresh context, `/`: sum script bytes
  requested before `load` (sizes taken from `dist/`, so the number does not depend on
  the server's compression), assert no Supabase, Sentry or Dexie chunk before `load`,
  assert the first service-worker request comes after `load`, then go offline and
  check `/`, the library route and `/changelog` render with the self-hosted fonts.
- **Rollup `onwarn`** in `vite.config.ts` throws on the static-plus-dynamic warning.
- **Closing evidence, not a CI gate:** item 61 closes with one Lighthouse run against
  the Vercel preview, recorded in its `docs/progress.md` entry.

## Not measured

- Real transfer from Vercel (Brotli, HTTP/2). Gzip figures are an upper bound.
- Real phones. The throttled timings come from desktop Chromium against a local
  preview server and are indicative only. No Lighthouse or field data.
- Whether iOS Safari ever reads splash images through the service worker after
  install. Step 1 assumes not; check on a real iPhone during item 81.
- The Lighthouse run that closes item 61 resolves the first two: real transfer and a
  throttled mobile profile against the deployed build.
- The signed-in library's real request list. It needs the authenticated E2E
  credentials; the app-shell figure above is built from the chunk breakdown.

## Approval asks

1. Accept the six targets in the Targets table, replacing the "done when" on items 60
   and 61 as set out in the problems table.
2. Approve steps 1–7 as item 61's scope, in the order: 1, 3, 6, 4, 2, 5, 7.
3. Leave item 60's prerender and hydration question until 61 has landed; with 61 done,
   `/` meets its budget without prerendering.
