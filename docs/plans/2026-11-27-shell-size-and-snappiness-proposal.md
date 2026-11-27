Status: PROPOSAL
Last verified: 2026-11-27

# App shell size and snappiness — every idea, for review
Two independent audits of the same build, merged. Nothing is dropped. Nothing here is decided. Mark each item keep, drop or later.
## How to read this
**Check** says how far the claim was confirmed on 2026-11-27:

- **Verified** — confirmed in the code or the build output.
  
- **Site verified** — the code is there, but the cost or saving was not measured.
  
- **Not verified** — taken from one audit, not re-checked.
  
- **Disputed** — the two audits disagree, or the claim looks overstated. The row says why.
  

Sizes are gzip unless marked raw. Savings are estimates. No change has been made.
## The shell today
Measured with `VITE_SENTRY_DSN` set, as CI builds it. Limit: 330 KB (`scripts/bundle-budget.json`).

| Chunk | gzip KB | raw KB | Holds |
| --- | ---: | ---: | --- |
| `AppShell` | 129.5 | 414.1 | App code (about 290 raw) and unsplit packages (about 122 raw) |
| `vendor-react` | 59.1 | 188.8 | React 19, ReactDOM |
| `vendor-supabase` | 48.3 | 184.4 | Auth, PostgREST, Realtime, Functions, unused Storage |
| `vendor-sentry` | 43.8 | 127.9 | Sentry core, BrowserTracing |
| `vendor-dexie` | 31.2 | 93.5 | IndexedDB |
| `main`, `boot.js`, `Footer`, `sentryClient` | 18.3 | 55.0 | Entry, router, public shell |
| **Shell total** | **330.2** | **1,063.7** | Before any note opens |
| `Editor` + Tiptap core chunk (lazy) | 140.3 | 453.7 | Tiptap, ProseMirror, linkifyjs |
| `vendor-sentry-replay` (deferred) | 38.7 | 120.7 | Session Replay |

Packages inside `AppShell`, raw minified KB: dompurify 22.2, @use-gesture 20.2, @react-spring 39.0, minisearch 17.7, react-hot-toast + goober 11.5, @capacitor 8.1, react-masonry-css 3.7.

Realistic total if most of section A lands: 45–65 KB off the shell.
## A. Shell size
| # | Idea | Saving | Check | Risk and notes |
|---|---|---|---|---|
| A1a | Load `@react-spring` and `@use-gesture` only on touch devices. `BottomSheet`, `PullToRefresh` and `SwipeableNoteCard` are the only users. | ~19 KB on desktop, 0 on touch | Verified (3 import sites, 59 KB raw) | Lowest risk to feel: touch motion is unchanged. Saves nothing on phones and Android, where parse cost matters most (D4). Needs a no-gesture fallback while the chunk loads. `springMotion.ts` also imports `Globals`. |
| A1b | Or remove both libraries. Rewrite the three components with Pointer Events and CSS transforms (`cubic-bezier` or `linear()` easing). | ~19 KB everywhere, and out of the precache | Site verified | Highest risk to "buttery". Rubber-banding, velocity hand-off and interruptible springs are hard to match in CSS. Reduced-motion handling must be redone. Needs device testing. A1a, A1b and A1c are alternatives. |
| A1c | Or keep both libraries but load them after the library paints, on every device. | ~19 KB off the cold-boot path everywhere; still downloaded and precached | Not verified | Middle path: phones stop parsing it before first paint, and the motion is unchanged. Swipe and pull-to-refresh are inert for the first moments. |
| A2 | Lazy-load the signed-out screens: `DemoPage` (with `demoStorage`), `Auth`, `NotFoundPage`. All three are static imports in `entryScreens.tsx`. | ~11 KB | Verified | Signed-out visitors opening sign-in see one more chunk fetch. Preload on CTA hover or focus. |
| A3 | Lazy-load rare modals and screens: `EncryptedConflictModal`, `BackupPassphraseModal`, `SessionTimeoutModal`, `WelcomeBackPrompt`, `InstallPrompt`, `ImportProgressOverlay`, `DatabaseUpdatePending`, `FadedNotesScreen`. Keep `PassphraseUnlock` eager. | ~6.6 KB | Site verified | `SessionTimeoutModal` and the conflict modal guard data. A lock-path screen must not wait on a fetch (`DECISIONS.md`, 2026-11-26, rejected lazy-loading the lock hook for that reason). Consider keeping those two eager. |
| A4 | Load `minisearch` on idle after the library paints, or on search focus / `Cmd+K`. | ~6 KB | Verified (settled: the 9.4 figure counted `searchQuery.ts` and `searchText.ts`, which stay eager) | The index must still reconcile synchronously once loaded (`CLAUDE.md`, Library). A search typed before the chunk arrives needs a defined behaviour. See `DECISIONS.md`, 2026-09-08. |
| A5 | Dynamic-import `exportImport.ts` and `encryptedBackup.ts` on click. | ~5 KB | Site verified | `copyNoteToClipboard` is used by held saves (`useHeldSaveActions`) and must stay reachable offline. `markdownToHtml` is used by `RichTextEditor`. Split the file first. |
| A6 | Import `@capacitor/network` only on native. | ~2.5 KB | Site verified (scope settled) | `@capacitor/*` is imported in five files, including `syncEngine.ts`. Four reportedly only call `Capacitor.isNativePlatform()`; a small helper reading `window.Capacitor?.isNativePlatform?.()` could replace `@capacitor/core` in all five (not checked). Small win, touches sync. |
| A7 | Drop `browserTracingIntegration` and set Sentry's tree-shaking flags. | ~10 KB | Not verified | Only if nobody reads the 10% performance traces. Loses Sentry web vitals, see D1. |
| A8 | Build the Supabase client from `auth-js`, `postgrest-js`, `realtime-js` and `functions-js`, without `storage-js`. | 12–15 KB claimed | Not verified | One audit rated this not worth it; the other sized it at 12–15 KB. Measure before deciding. Touches auth. |
| A9 | Replace `react-hot-toast` or `react-masonry-css`. | ~5 KB | Verified sizes | Considered and not recommended: 35 call sites for toast, small gain. |
| A10 | React (59 KB) and Dexie (31 KB). | 0 | Verified | Fixed cost. Listed so the floor is clear: about 110 KB before app code. |
## B. Outside the shell
| # | Idea | Saving | Check | Risk and notes |
|---|---|---|---|---|
| B1 | Stop Settings loading Tiptap. `EditorSettings.tsx` imports two `localStorage` helpers from `SmartTypography.ts`, a Tiptap extension. Move them to `src/editor/smartTypographyPreference.ts`. | 83 KB off opening Settings | Verified (`SettingsModal` statically imports the Tiptap core chunk) | Minutes of work. Add a budget assertion so it cannot return. |
| B2 | Give Tiptap and ProseMirror a named chunk in `manualChunks`. Today they sit in a chunk Rollup named `useKeyboardHeight`. | 0 | Verified | Makes B1 assertable by name, like `vendor-dexie`. `BottomSheet` imports `useKeyboardHeight`, so check it does not drag the chunk along. |
| B3 | Lazy-load `ShareModal` (11.5 KB raw) and `FindReplacePanel` (2.8 KB raw) inside the Editor chunk. | ~4 KB off note open | Verified (static imports in `Editor.tsx`) | Revised: lazy-load `ShareModal` only. Keep `FindReplacePanel` eager, so `Ctrl+F` never waits on a fetch for under 1 KB. |
| B4 | `linkifyjs` is 17 KB raw in the Editor chunk, only for autolink while typing. | up to ~6 KB | Verified size | Information only. Removing it removes autolink. |
| B5 | Move editor CSS out of `main.css` (84 KB raw, 15.8 KB gzip, render-blocking) into the lazy Editor chunk. | a few KB off first paint | Site verified (46 ProseMirror selectors in `index.css`) | Note cards and shared notes render note HTML too. Styles they share must stay in `main.css`. |
| B6 | Watch `ChangelogPage`: 26.4 KB and growing every release, against the 1,108 KB precache limit. | future | Verified | Options later: paginate, or keep only recent entries in the chunk. |
| B7 | The precache holds 21 font subsets, about 315 KB. | 0 | Verified | Keep. The font precache is an invariant (`CLAUDE.md`). Listed for awareness. |
| B8 | Every deploy invalidates the whole `AppShell` chunk (129.5 KB), because all app code is one chunk. | smaller updates | Verified | A2, A3 and A5 shrink it. No separate work. |
## C. Runtime: main-thread time and smoothness
Returning users load from the service worker cache. For them the cost is parse and execution, not download.

| # | Idea | Check | Risk and notes |
|---|---|---|---|
| C1 | Run Argon2id in a Web Worker. It is 64 MB, 3 iterations, on the main thread; `src` has no `Worker`. The unlock screen freezes for the whole derivation. | Verified (no worker). Freeze length not measured. | Touches encryption: multi-agent review. The CSP already allows workers (`worker-src 'self' blob:` in `vercel.json`); emit a same-origin worker file all the same. That file must land in the precache for offline unlock and must not break the `vendor-hash-wasm` budget check. Design it together with roadmap item 102, which moves the unlocked key into a Worker. Key bytes cross by `postMessage`. Every restore path must still verify the key check. |
| C2 | `NoteCard` runs DOMPurify twice per card: `htmlToPlainText` and `sanitizeHtml`. Full cards do not show the plain text outside search; compact cards do not show the HTML. The search index sanitises each note a third time. Run only what the mode needs. | Verified | Low risk. Sanitising must still happen before any `dangerouslySetInnerHTML`. |
| C3 | The card preview injects the whole note's HTML and clips it at `8em`. Cut the note to its first few blocks before sanitising. | Verified | A long note becomes a large hidden DOM in every card. Truncate on block boundaries, then sanitise. |
| C4 | Each card creates its own `ResizeObserver` and reads `scrollHeight` in a layout effect. Use one shared observer, a batched frame, or a CSS-only fade. | Verified | A CSS mask needs no measurement at all, but fades short notes too unless handled. |
| C5 | `useNotesSync` calls `fetchDecryptedNotes` on refresh, which decrypts every note again and returns new objects. That defeats `NoteCard`'s `memo` and reruns search reconciliation. Cache decrypted notes in memory by note id and content hash. | Site verified (two call sites; the re-render effect was not measured) | The cache holds decrypted text. Key it with a `WeakMap` on the keys object, so it becomes unreachable when the vault locks or the user changes, with no manual clear to forget. That holds only if nothing else retains the old keys object; check stale closures. Risk drops from high to medium. A locked note must never be cached as empty. Touches sync and encryption: multi-agent review. |
| C6 | On unlock of a large library, decrypt the first screen first, or yield between batches. | Not verified | Startup hydration must not clear queued local work (`CLAUDE.md`, Sync engine). A partial library must not look like a complete one to sync. |
| C7 | `useAppLoader` holds the loader for at least 200 ms. Flip it: wait about 150 ms before showing a loader at all. | Verified (`APP_LOADER_MIN_MS = 200`) | The floor exists to stop a flash. Delay-before-show solves the same thing without the wait. |
| C8 | Note click awaits `warmEditorRoute()` before navigating. Navigate synchronously when the Editor is already loaded. | Dropped | Both audits now agree. The code is as described. When the chunk is loaded the await costs one microtask, which resolves before the next paint. Likely no visible gain. |
| C9 | Card entrance stagger is 60 ms per card, capped at 0.6 s. Tighten to 20–25 ms capped near 150 ms; skip it on back-navigation and search. | Verified | A design choice, not a defect. Check `DESIGN.md` motion rules before changing. |
| C10 | Search debounce is 300 ms for a local in-memory search. Drop to 80–100 ms with `useDeferredValue`. | Verified | The file's comments call the debounce deliberate ("calm"). Do C2 first or faster search re-sanitises more. Progressive rendering suspends during search, so every match renders at once. |
| C11 | `RichTextEditor` calls `editor.getHTML()` on every keystroke and pushes it into React state. Mark dirty on keystroke; serialise on the autosave timer, blur and unmount. | Verified (`RichTextEditor.tsx:143`). Lag on long notes not measured. | Highest-risk item here. The save path was just rebuilt (`DECISIONS.md`, 2026-11-26, #288). Leaving a note must still save its last words. Word count and "Synced" state read this content. |
| C12 | Replace `transition-all` (31 files) with named properties. | Verified count | Mechanical. Check each for a property that was relying on `all`. |
| C13 | `NoteCard` sets `boxShadow` from `onMouseEnter` / `onMouseLeave`. Use CSS `:hover`, or fade a pre-rendered shadow on `::after`. | Verified | Low risk. The `::after` form animates opacity only. |
| C14 | Replace the `feTurbulence` paper grain (`--paper-grain`) with a pre-baked 180×180 tile. | Disputed | It is an SVG data-URI background image. Browsers normally rasterise such a tile once and cache it, not per frame. Desktop Chromium is fine; mobile WebKit and Android WebView are the open question. Measure scroll raster on a device before doing this. `index.html` and `boot.js` mirror the value. |
| C15 | Drop the animated `filter: blur(2px)` from `card-delete`. | Verified | 0.3 s, one card. Small. Visual change. |
| C16 | Add `content-visibility: auto` with `contain-intrinsic-size` to off-screen chapters. | Verified (0 uses today) | Interacts with the progressive-render sentinels, masonry height and keyboard selection across chapters. |
| C17 | `preloadEditorRoute()` fires the moment the library unlocks and competes with decrypt and first render. Move it to `requestIdleCallback`; trigger at once on card `pointerenter` or focus. | Verified (`App.tsx:221`) | Touch has no hover: keep an idle fallback so the first tap is still warm. |
| C18 | `App.tsx` passes fresh object and arrow props (`header`, `tagFilter`, `library`) each render, so each search keystroke re-renders the tree. Move search input state into `Header`, memoise the slices, or evaluate React Compiler. | Not verified | React Compiler is a build-wide change; trial it on its own branch. |
| C19 | `ChapteredLibrary` and `useMobileDetect` listen to `window.resize`, which fires as mobile browser chrome hides and shows. Use `matchMedia(...).addEventListener('change')`. | Verified | Low risk. |
| C20 | `SearchDocument.source` keeps a second copy of every note's HTML for staleness checks. Key on `contentHash` or `updatedAt` instead. | Verified (`useNoteSearch.ts:59,64`) | An index that lags the library returns stale notes; the key must change whenever content does. |
| C21 | Have `boot.js` add a `modulepreload` for `AppShell` when it sees a session. Today `main` must run before `AppShell` is requested. | Dropped | `boot.js` is an unprocessed file in `public/`; it cannot know the hashed chunk name without a build step, and the budget check would count the preload on `/`. Helps only the first load after a deploy. `boot.js` must keep matching `appGate.ts`. |
| C22 | `backdrop-filter` (4 uses) and `will-change` (5 uses). | Verified | Considered. No action needed. |
| C23 | `useSyncStatus` reads the sync queue from IndexedDB every 10 s, forever, including in a background tab. Update on queue change instead, or pause while `document.hidden` and skip the state set when counts are unchanged. | Verified (`setInterval(refresh, 10000)`); the per-tick re-render was not checked | Battery and wake-ups on Android. The indicator must still show a blocked or pending queue promptly. |
## D. Things not being thought about
| #   | Point | Check | Notes |
| --- | --- | --- | --- |
| D1  | Budgets measure bytes, not time. Nothing measures unlock-to-library, note open or typing latency. Add a throttled-CPU Playwright spec for those three. | Verified (no such spec) | Without it, section C cannot be proven or protected. Do this before C. |
| D2  | Session Replay buffers on every signed-in session. `replaysOnErrorSampleRate: 1.0` keeps the recorder attached so an error can be replayed; the 10% rate only decides what is uploaded. That is a DOM observer running while the user types, plus 38.7 KB. | Verified config; CPU cost not measured | Corrects an earlier reading that only 10% of sessions pay. Note text is masked and cards and the editor are blocked, so replays show little. Decision: lower the on-error rate, or drop Replay. |
| D3  | gzip hides parse cost. Cold boot parses about 1.06 MB of JS, and about 1.58 MB with Editor and Replay. | Verified sizes | Section A helps cached loads too, for this reason. |
| D4  | On Android (Capacitor) files are local. Download size is irrelevant; parse and execution are everything. | Verified | Test section C on a mid-range Android WebView, not desktop Chrome. |
| D5  | Unused code inside `@supabase/supabase-js`. | Not verified | Same as A8. |
| D6  | Precache growth over time. | Verified | Same as B6 and B7. |
## Order: seven PRs, two of them small

One lane per session still holds; several sessions can stack commits on one branch. Each
item is its own commit, so a red build can be bisected. Whoever did not build a PR
reviews it. The two models work in separate worktrees.

| PR | Contains | Builds | Reviews | Notes |
|---|---|---|---|---|
| 0. Timing harness | D1 | Opus | Gemini | Lands alone, first, so nothing rebases onto a moving branch. Seeded fixture; the unlock case needs the `E2E_TEST_*` secrets and skips without them. A local before/after harness with loose CI ceilings, not tight millisecond gates: throttled timings vary on shared runners. |
| 1. Bytes | B1, B2, B3 (`ShareModal` only), A2, A5, C17, the A3 modals that do not guard data, D2, A7 | Opus | Gemini | All bundle-shape changes. One budget ratchet and one `DECISIONS.md` entry. |
| 2. Library feel | C2, C3, C4, C13, C19, C12, C23, then C7, C9, C10, C15, C16, then A1c | Gemini | Opus | A1c is here, not in PR 1: it edits `ChapteredLibrary.tsx` and `ChapterSection.tsx`, which this PR already owns. Try on a phone. Re-measure the budget if PR 1 landed first. |
| 3. Unlock worker | C1, designed with roadmap item 102 | Opus | Gemini | Encryption. Multi-agent review. Revertable alone. |
| 4. Decrypt cache | C5. C6 only if PR 0 shows decrypt time above about 100 ms. | Opus | Gemini | Encrypted read and sync-refresh path. Multi-agent review. Review against stale closures holding old keys, locked notes cached as empty, and refresh races. |
| 5. Search index | A4, C20 | Gemini | Opus | `useNoteSearch.ts` only. No sync-engine code. |
| 6. Editor typing | C11, with the #288 cases as regression tests | Opus | Gemini | Save path. Multi-agent review. Last, alone. |

**PR 0 landed 2026-11-27 (#309).** Baseline on a Windows dev box, 4x throttle: boot to
library 1,231 ms, note open 910 ms cold and 573 ms warm, typing p95 83 ms with 45 long
tasks over 60 keys on a rich 2,500-word note. Two things follow. PR 6 stays: per-keystroke
work is real on a realistic note, but it must profile first, since word-count metrics and
three toolbar instances also run per key. And the unlock and signed-in library-load cases
have not run, so PR 3 has no baseline yet and the C6 gate in PR 4 is still open; both
need one run with the `E2E_TEST_*` credentials.

Next: PR 1 and PR 2 run in parallel; their files are disjoint. Then PR 3
and PR 5 in parallel, then PR 4, then PR 6.

No PR unless a measurement justifies it: A6, A8, C14, C18.

Dropped: C8, C21, A1a, and the `FindReplacePanel` half of B3. Deferred: A1b, until PR 0
can prove it.

After each PR lands, lower `appShellJs.limitKB` to the new measurement plus 1 KB.

## Decisions needed
- A1: **decided 2026-11-27 — A1c, load after first paint.** A1a is dropped (nothing for
  phones). A1b, the rewrite, is deferred until the D1 timing spec can prove it.
  
- D2 and A7: **decided 2026-11-27 — drop Session Replay. Drop performance tracing too,
  unless Sentry's Performance tab is in real use.** Error reporting stays.
  
- C9 and C10: **decided 2026-11-27 — tune both, modestly, after C2.** Stagger stays on
  the first library load, capped near 0.3 s, and is skipped on back-navigation and search
  results. Debounce goes from 300 ms to about 150 ms. Check `DESIGN.md` motion rules and
  try both on a phone first.
  
- The 330 KB target: **decided 2026-11-27 — ratchet it.** The limit drops to the
  measurement plus 1 KB as each step lands, per `bundle-budget.json`. The target drops
  once section A is done, with a `DECISIONS.md` entry. A1c shows as about 19 KB off the
  budget because only static imports are counted; those bytes still load after paint.
