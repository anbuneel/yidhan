# Progress

Append-only history, newest last. One entry per merged change.

**History only.** This file is never authority for current architecture or
behaviour — it records what happened, not what is true now. For current
architecture see `CLAUDE.md`; for the visual system `DESIGN.md`; for what is
deferred `docs/roadmap.md`. Entries are not rewritten; a later entry corrects an
earlier one.

`src/data/changelog.ts` is a *product surface* — the release notes rendered inside
the app for users. It is not documentation and is not this file's duplicate: it
speaks to users about features, this file records engineering history.

Entries before 2026-03-28 predate the working clone's visible git history and are
not reconstructed here; see `docs/archive/` for the plans of that era.

---

## 2026-03

- **2026-03-28** — Landing page redesigned as a unified single-canvas composition. (#183)
- **2026-03-29** — UI quality sweep: accessibility, responsive, performance, theming (18 items). (#184)

## 2026-04

- **2026-04-04** — UI quality sweep 2: 404 page, demo starter notes, Auth refactor. (#185)

## 2026-05

- **2026-05-16** — App updates made quiet; UI sweep unifying the logo, filter search and hover states. (#186)
- **2026-05-17** — Route transitions smoothed; landing header unified with `HeaderShell`; scrollbar gutter stabilised.
- **2026-05-18** — Calm hover sweep: pin/delete alignment, lifts removed, ambient feedback retained.
- **2026-05-23** — Post-login navigation quietened.
- **2026-05-25** — Re-auth guardrail switch added. (#187)
- **2026-05-31** — React Doctor score brought to 100.

## 2026-06

- **2026-06-02** — `CLAUDE.md` trimmed below the 40k character limit.
- **2026-06-08** — Landing page reimagined. (#191)
- **2026-06-21** — Launch security posture hardened: RLS policies reset, public
  table-read share policies removed, encrypted-only note rows enforced, share
  writes capped at 30 days. (#192)
- **2026-06-21** — Native dialog chrome reset on the auth modal.

## 2026-07

- **2026-07-14** — Server-owned account deletion workflow added, with a 14-day
  grace period and a service-role worker. (#194)

## 2026-08

- **2026-08-09** — Landing page and note masonry polished. (#195)

## 2026-09

- **2026-09-04** — App updates restored (service worker `registerType` returned to
  `autoUpdate`) and stuck sync queue entries unblocked. (#196)
- **2026-09-04** — Fonts self-hosted; logo mark made theme-aware. (#197)
- **2026-09-05** — Browser asked to persist the offline database via
  `navigator.storage.persist()`. (#199)
- **2026-09-07** — Editor keyboard navigation and link controls fixed — ledger items 1–4. (#200)
- **2026-09-07** — Saving and recovery: failed saves retain the draft with Retry
  and Copy; ten-second local checkpoints; "Saved here" distinguished from
  "Synced" — ledger items 5–7. (#201)
- **2026-09-07** — Tag sync reconciliation, readable conflict previews, and
  large-library cursor handling — ledger items 8–10. (#202)
- **2026-09-07** — Search caching, mobile spacing, and practice-privacy copy;
  manifest share target removed — ledger items 11–16, 21, 22. (#203)
- **2026-09-07** — Lossless Markdown export, account backup restore fidelity,
  sharing verification, and removal of legacy plaintext note APIs — ledger
  items 17–20. (#204)
- **2026-09-07** — Documentation and instruction layer overhauled: 169 files
  quarantined to `docs/archive/` behind a retrieval lane, six canonical docs
  installed (`CLAUDE.md`, `PRODUCT.md`, `DECISIONS.md`, `DESIGN.md`,
  `docs/progress.md`, `docs/roadmap.md`), plan lifecycle enforced by a pre-commit
  hook, and per-doc model-attribution rituals dropped.
- **2026-09-07** — Execution ledger split so each fact has one owner: shipped
  items folded into this file, the 128 deferred items moved to
  `docs/roadmap.md` keeping their numbers, and the review-coverage appendices
  frozen in `docs/archive/`. The ledger had listed items 5–22 in both its Next
  and Done tables, contradicting its own rule that an item sits in exactly one
  list. It now carries only committed work, alongside the ledger convention
  adopted as item 148.
- **2026-09-07** — Conflict choices retire stale queued note writes; outbound
  sync is exclusive across tabs and recovers when a tab dies; retry decisions
  use structured failures; card fading is exactly once with visible failure
  recovery; and unused exports are guarded by an exact audited baseline —
  ledger items 71, 72, 74, 150, 151.
- **2026-09-07** — Key migration and rotation designed before any of it is built —
  ledger item 23. `docs/plans/2026-09-07-key-migration-and-rotation-design.md`
  fixes the wrapped material as the full 64 bytes (both the AES and the HMAC half,
  because wrapping only the AES key would silently break every save-confirmation
  path), separates the three key-change flows that were previously one undifferentiated
  idea, and attaches 29 named tests to items 24, 25, 26 and 103. Review then found
  four more ways the design could have lost words or left a retired passphrase
  working — a rotation holding its new key only in memory, a sync gate that stopped
  only the rotating tab, a lock keyed on a counter that does not move until the pass
  ends, and a passphrase change that left the legacy credential describing the old
  passphrase. Each is now refused by name, with the reasoning that was wrong kept
  next to it rather than deleted.
- **2026-09-07** — The deployment guard — ledger item 36. A `schema_version` table
  holds one row naming the migration level the database is at; the client carries the
  level it requires and reads the other at startup. When the app is ahead, it shows
  "a database update is pending" and stops, instead of letting the sync queue fill with
  writes that cannot land. That silent mode of failure is what
  `default_user_id_to_auth_uid.sql` produced in production: reads kept working, so
  nothing looked broken, while every new note failed RLS. The guard **fails open** —
  offline, unreachable, and an unseeded table all resolve to `unknown`, and `unknown`
  writes normally, because an offline-first app must not lock a reader out of their own
  notes over a version check that could not reach the server. Only a version number
  lower than the build's closes anything. `docs/setup/release-checklist.md` makes
  `verify_migration_state.sql` a recorded release step, with its output pasted into the
  PR rather than summarised.
- **2026-09-07** — One undecryptable note stops taking the library with it — ledger
  item 41. `fetchDecryptedNotes` threw if any single payload failed, App caught it, and
  the reader's whole library rendered empty behind a toast telling them to lock and
  unlock their vault. Decryption failures are now typed: a row that is not encrypted at
  all, or still carries plaintext columns, is a violation of the launch invariant and
  still fails the whole read, closed; a row whose ciphertext will not open is one locked
  note. Locked notes come back with empty title and content and render as
  `LockedNoteCard` with a retry, are refused by the editor and by the save path — an
  empty autosave would destroy ciphertext another device can still read — and are left
  out of every export with the count reported.
- **2026-09-07** — Encrypted backups — ledger item 38. A `.yidhan` file is the existing
  v2 account export sealed with AES-256-GCM under a key derived from a backup
  passphrase the reader chooses, so a backup on a shared machine or a cloud drive is
  not a plaintext copy of everything they have written. The backup key is deliberately
  **not** the vault key: a backup sealed under `K` would stop opening the moment `K`
  changed, so a compromise rotation (item 103) would turn every old backup into noise —
  see `docs/plans/2026-09-07-key-migration-and-rotation-design.md` §4.3. The salt and
  format version are bound into the AAD, so an envelope cannot be relabelled or have
  one file's header swapped onto another's ciphertext. A damaged or truncated file and a
  wrong passphrase are separated deliberately: structural checks run before any crypto,
  so the two failures carry different messages, and only one of them is something the
  reader can act on.
- **2026-09-07** — The threat model, written down — ledger items 39 and 40. `/security`
  says what an attacker would get and what they would not, including the parts that are
  not solved: an unlocked vault does not survive a compromised browser, "Remember this
  browser" trades a real convenience for a real cost, a forgotten passphrase is
  unrecoverable, practice drafts are unencrypted on the device, and there has been no
  independent review. It names the metadata encryption does not hide — timestamps,
  sizes, counts, and tag names, which are plaintext on the server until item 101 —
  rather than letting "end-to-end encrypted" carry an implication it cannot support.
  `/.well-known/security.txt` publishes where to report, and `/privacy` links across.
  `docs/reference/outbound-data.md` is the inventory behind it: every request type the
  app makes and every field it may carry, with one scrubber test per row. Writing it
  found something — `encryption_salt` was reaching Sentry unredacted. The salt is not a
  secret, but it is a stable per-user identifier and an error report has no use for one,
  so it is redacted now.
- **2026-09-07** — Editor paste, typography, writing metrics, formatting-state
  feedback, find and replace, command access across widths, and the mobile slash
  menu completed — ledger items 52–57 and 116.
- **2026-09-07** — Notes have addresses — ledger items 28 and 29. `/n/<id>`,
  `/faded` and `/` are real routes, extracted to `src/routing/`: a pure route table,
  a scroll memory keyed by history entry rather than by path, and a `useRouter` that
  owns the History API. Four states that could disagree with the address bar — `view`,
  `isDemo`, `notFound`, `selectedNoteId` — became one that cannot, and the
  `yidhan-nav-*` sessionStorage restore they needed is gone with them. Back from a
  note lands on the library where the reader left it; a refresh reopens the note; a
  note address that no longer resolves replaces itself with the library and says so,
  where the editor used to `return null` onto a blank page under a URL still claiming
  to point at a note.
- **2026-09-07** — `App.tsx` decomposed, 2,699 lines to 598 — ledger item 63. Twelve
  hooks and six components, each named for what it owns: `useNotesSync` (the data
  layer and both realtime subscriptions), `useNoteActions`, `useFadedNotes`,
  `useTagActions`, `useSyncActions`, `useImport`, `useDemoMigration`,
  `useShareTargetNote`, `useShareRoute`, `useVisibleNotes`, `useLibrarySearch`,
  `useAppShortcuts`, `useAppLoader`, `useSessionGuards`, `useAppTheme`,
  `useEditorChunk`; `LibraryScreen`, `NoteEditorView`, `AppModals`, `PublicPage`,
  `ImportProgressOverlay`, `entryScreens`. No behaviour change — the five public
  pages had been written out five times over, and an `isImporting: true` nobody ever
  read rode along on every import-progress write. The item's `Editor.tsx` half is
  Lane A's, per the file ownership split, and stays open.
- **2026-09-07** — The Practice Space becomes a place you can start writing and a place
  you can leave with your words — ledger items 45, 46 and 152. `/demo/new` is a real
  address: on a phone "Start writing" now reaches a blinking caret in one tap instead
  of a library, and the intent is consumed by a route replacement so a refresh does not
  open a second empty draft. A "Keep these notes" CTA sits in the Practice Space header
  as the primary action, appearing once there is anything a migration would carry, with
  New Note stepping back to a secondary treatment so there is one primary rather than
  two; carrying work into an account was previously reachable only through a dismissible
  ribbon and a modal that waits for three notes and five minutes. And the welcome
  starter note stops claiming practice drafts are end-to-end encrypted: the source copy
  was corrected in an earlier release, but `createDefaultState()` only runs for a
  browser with no stored state, so every existing Practice Space still showed the old
  words. Stored starters are now corrected in place, matched byte-for-byte against the
  superseded text so any edit at all leaves the reader's words alone. That also fixes a
  second-order bug: an untouched old starter compared unequal to the current copy, so it
  read as edited — which carried the false claim into the account on migration.

- **2026-09-07** — Instruction layer and CI hardening. `npm run typecheck` was
  `tsc --noEmit` against a root `tsconfig.json` holding `"files": []`, so it compiled
  zero files and always passed; the only real typecheck was the `tsc -b` inside
  `npm run build`, and CI's Type check step had the same no-op. It is now `tsc -b`.
  The 86-test Playwright suite was written for CI (`forbidOnly`, `retries: 2`,
  `workers: 1`) but never had a job, so it gated nothing; it now runs as an `e2e` job
  whose heavy steps are gated on `VITE_SUPABASE_URL` being present, because
  `src/lib/supabase.ts` throws without it and an unconfigured repo would go red.
  `PassphraseUnlock.test.tsx` was intermittently failing two tests under parallel
  load: the lockout case types 80 characters, user-event's per-keystroke delay pushed
  it past the 5s timeout, and the keystrokes still in flight landed in the next test's
  input — so an unrelated test failed with an interleaved passphrase. Typing delay is
  now disabled in that file. `syncEngine.test.ts` (2,386 lines, ~22k tokens) is four
  files by concern, with module mocks in `src/test/syncEngineMocks.ts` and builders in
  `src/test/syncEngineTestKit.ts`; the mocks file must not reach `syncEngine`, since
  the `vi.mock` factories import it while the mocked modules are resolving. Test count
  is unchanged at 1,253. `CLAUDE.md` drops derivable sections and gains a session
  economy section; the `D:\anbs-dev` parent `CLAUDE.md` is deleted and the Roughdraft
  instructions moved to a skill, taking the always-loaded layer from ~5,800 to ~4,100
  tokens.
- **2026-09-08** — The browser suite runs in CI on every PR, and the authenticated
  fixture unlocks the vault — ledger item 37, closing #223. The `e2e` job existed but
  gated every step on the `VITE_SUPABASE_URL` secret, which was never added, so it
  passed in seconds having run nothing while `e2e/auth.spec.ts` sat on `main` asserting
  behaviour item 45 had already replaced. The job is now ungated: the unauthenticated
  half of the suite makes no Supabase network call, so placeholder values boot the app:
  66 passed, 128 skipped, 0 failed against `https://placeholder.invalid` across Desktop
  Chrome and Pixel 5 (`DECISIONS.md`, 2026-09-08). Forks and first-time contributors get the same gating
  suite as the maintainer. `loginUser()` now waits for whichever of the library, the
  unlock form or the setup form arrives after sign-in, fills `E2E_TEST_PASSPHRASE` on
  the unlock form, and fails with a provisioning message on the setup form rather than
  creating a second vault over an account that already has notes. The per-test timeout
  moves to 60s to cover the Argon2id derivation.

  **Not verified end to end.** The unlock path has not been run against a real account:
  that needs a test user in Supabase whose vault has been created once by hand, plus
  the five repository secrets (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`, `E2E_TEST_PASSPHRASE`), and only the
  maintainer can do that. Until then the authenticated tests skip in CI and item 37's
  "done when" — no skipped authenticated tests — is not met. Item 153 stays blocked on
  it. #210 exists because a previous entry claimed verification that had not happened;
  this entry does not repeat that.
- **2026-09-08** — Faded Notes badge count is reconciled from IndexedDB after
  local changes, realtime events, sync pulls, and expiry cleanup instead of
  being incremented optimistically — ledger item 73. (#227)
- **2026-09-08** — Library cards support keyboard selection — ledger item 43.
  Arrow keys or J/K move a roving focus across chapter boundaries; Enter opens
  the selected note, P pins it, and Delete fades it with the existing Undo
  toast. Selecting an unrendered or collapsed card reveals it first, so long
  libraries remain progressively rendered without trapping the keyboard. `t`
  is deferred to the roadmap until item 93 supplies a per-note tag picker.
- **2026-09-08** — The reader chooses how the library is arranged — ledger item 48.
  "Chapters by" picks the timestamp a chapter is decided from: `Edited`, as before, or
  `Written`, which leaves an old note in the chapter its writing date earned however
  often it is revised. "Notes by" picks the order inside a chapter — edited, written, or
  title. Both are remembered per user in localStorage and default to today's behaviour,
  so nothing changes for a reader who never touches them.

  `groupNotesByChapter` now owns the within-chapter order as well as the grouping. That
  is deliberate: `useLibraryCardNavigation` groups a second time to build its keyboard
  order, and two sorts in two places would have drifted apart, which is exactly the
  class of bug item 43 shipped six of. `useVisibleNotes` keeps its baseline sort but no
  longer decides what the reader sees.

  The Practice Space keeps the default arrangement: there is no account to remember a
  choice against, so the controls are not offered there.

  Pinned notes ignore the basis — a pinned note is pinned whichever timestamp is read —
  though the order within Pinned does follow the chosen sort. Grouping only reorders: it
  never filters, so a search result stays a search result under any arrangement. Title
  order is case- and accent-insensitive and reads digits as numbers; untitled notes go
  last, and duplicate titles fall back to the newest edit and then the id so the order
  cannot shuffle between renders. `ChapterSection` is untouched, which keeps this clear
  of item 49.

  **Not done:** a card still shows its last-edited time. Under the `Written` basis a card
  in Earlier can read "2 hours ago", which is honest about the card and confusing about
  the chapter. Making the card's timestamp follow the basis means passing the choice
  through `ChapterSection` into `NoteCard`, and item 49 is changing the card's age fade
  in the same files. It should be picked up once item 49 has landed.
- **2026-09-08** — Library card previews fade only when their content is
  clipped, and chapter age fading stops at 90% opacity so Archive notes remain
  legible — ledger item 49.
- **2026-09-08** — Library search understands multiple required terms, quoted
  phrases, and `tag:`, `is:pinned`, `before:`, and `after:` filters — ledger
  item 50. Tags match without regard to case. Date filters use the note's
  updated calendar date and include the named day or month. Invalid operators,
  including an empty `tag:` or an invalid date, are ignored rather than shown as
  errors. Operators inside quotes are literal text. Every
  visible free-text match is highlighted; locked notes remain in an unfiltered
  library but cannot match text they could not decrypt. The plaintext cache
  remains memory-only and is never written to localStorage or IndexedDB.
- **2026-09-08** — Library free-text search uses an incrementally maintained
  MiniSearch index with ranked, prefix, and fuzzy results — ledger item 51.
  Title matches always precede content-only matches. Locked notes never enter
  the index; edits replace their exact entry, deletes remove it, and a note
  created during an active query appears immediately. One-character terms use
  exact-token matching only, so typo tolerance cannot turn them into library-wide
  noise. The plaintext index is component-owned memory and makes no storage or
  network writes. A generated 10,000-note test measured 42.13 ms p95 across 40
  mixed queries, with no claim that the unbuilt item 80 fixture exists.
- **2026-09-10** — The note title stops rendering twice in the editor — ledger item 83.
  The header breadcrumb copy is a scroll-to-top button, so it now appears only once the
  editable title has scrolled under the header. It used to be gated only by a
  `hidden sm:inline` breakpoint, which left both titles on screen from 640px up: a phone
  in landscape, a small tablet, and every desktop sitting at the top of a note. The
  640px floor stays — a phone header has no room for a breadcrumb, and WhisperBack
  already scrolls back — but it moved into the same expression as the scroll test, so
  one place decides whether the header title shows. Visibility is written straight to
  the node from a rAF-throttled scroll handler, like the manuscript glow, so scrolling
  still causes no re-renders; the handler also listens for resize, because rotating a
  phone into landscape crosses the floor without scrolling, and watches the scroll
  container's children, because the resume chip and the remote-update banner sit above
  the writing area in flow and move the title without either event. Focus mode never brings it
  back, and an untitled note shows one "Untitled", not two. The item's other half,
  `h-screen` to `100dvh`, already shipped with #219 and is asserted in `Editor.test.tsx`.

  **Not done:** the item's "done when" asks for a real-device check that iOS Safari's
  bars no longer clip the toolbar. That check belongs to item 81, the cross-browser
  matrix, which is unbuilt and still on `docs/roadmap.md`. There is no matrix to run, so
  the device check is outstanding, not passed.
- **2026-09-10** — Landing page rebuilt around a two-column first screen: the
  headline names the product, the sub-headline carries both the no-setup and the
  encrypted-before-sync messages, and a static rendering of the real editor sits
  beside them with a starter note in it. Every "Try writing" opens the Practice
  Space draft at every width; the in-page textarea, the scroll cue, the gallery,
  the lock illustration and the scroll-reveal observer are gone. Proof is one line
  of four facts; trust is a plain section. Practice Space
  starters replaced by four short personal notes, one of which is the hero note,
  so the landing samples and the Practice Space agree. Closes the roadmap's
  unnumbered landing redesign item.
- **2026-09-10** — Launch hygiene for the landing page. The title tag, description
  and share tags carry one message, the share image is regenerated with the new
  tagline and its address is versioned so cached cards refresh. A static copy of
  the first screen now lives in `index.html`, painted before the bundle and
  replaced by React on mount; `public/boot.js` sets the theme first and hides the
  shell off the home path or when a session exists. Roadmap item 60's full
  prerender and JavaScript budget remain open.
- **2026-09-10** — `/.well-known/security.txt` now exists. The 2026-05 entry above
  says the security page published the contact address there; the page linked to
  it, but the file was never added, so the SPA rewrite answered with the app and
  the link landed on the 404 page. The file follows RFC 9116 (Contact, Expires
  under a year out, Canonical, Policy). The service worker's navigation fallback
  now excludes `/.well-known/`, so an installed app reaches the file rather than
  the shell. A routing spec asserts the file is served as text.
- **2026-11-07** — Items 154 and 155 from the public launch plan. The repository is
  licensed AGPL-3.0-only: `LICENSE` at the root holds the unmodified licence text
  under a copyright line for Anbu Neelamegam, 2026, and `package.json` names the
  same licence. The landing page's "Free and open source" fact now opens the LICENSE
  file on GitHub, in `LandingPage.tsx` and in the `index.html` shell. The font
  licences are unchanged. Public pages set their own document title ("Privacy ·
  Yidhan"; the Practice Space and the not-found page too) from `routeToDocumentTitle`
  in the route table; the library, the editor, `/faded` and shared letters keep the
  shell's title, so a note title never reaches the tab. `public/sitemap.xml` lists
  the public pages and `robots.txt` points to it. The navigation fallback denylist
  moved to `src/pwa/navigateFallbackDenylist.ts` so `vite.config.ts` and the routing
  spec read one list, and it now excludes `/sitemap.xml` as it does `/.well-known/`.
  The routing spec asserts each title, the sitemap as XML, and the denylist entry;
  the service-worker suite asserts a real worker leaves the sitemap to the network.
- **2026-11-07** — First-visit weight, item 61 steps 1, 3 and 6, with the budget
  enforcement that keeps them. The precache drops the iOS splash screens, the share
  image, icons above 192 px, the apple-touch icons, `robots.txt` and the duplicate
  `includeAssets` entries; it keeps `favicon.png`, `icon-192`, the logo WebP and the
  font licences. `src/data/changelog.ts` now loads with the Changelog page instead of
  the entry chunk. The service worker registers one task after the window `load`
  event; `registerType` stays `'autoUpdate'` and registration stays explicit in
  `serviceWorkerUpdates.ts`. `scripts/check-bundle-budget.mjs` runs at the end of
  `npm run build` against `scripts/bundle-budget.json`; CI builds with a dummy
  `VITE_SENTRY_DSN`, and the check fails under GitHub Actions if Sentry is missing.
  `e2e-sw/first-visit.spec.ts` checks the same budgets in a browser, that
  registration happens after `load`, and that `/`, `/demo` and `/changelog` open
  offline with the self-hosted fonts.

  | Measure | Before (`dc34a40`) | After | Target |
  |---|---:|---:|---:|
  | JS requested on `/` before `load`, gzip | 401.5 KB, 7 scripts | 380.1 KB, 5 scripts | ≤ 90 KB |
  | Everything requested on `/` until network idle, gzip | 555.4 KB | 536.9 KB | ≤ 300 KB |
  | App-shell JS, Editor excluded (the entry path today), gzip | 398.7 KB | 380.1 KB | ≤ 330 KB |
  | Largest JS chunk (`main`), gzip | 263.9 KB | 245.4 KB | ≤ 150 KB |
  | Precache | 70 entries, 5,165.9 KB, 3 URLs twice | 45 entries, 1,021.9 KB, none twice | ≤ 1,100 KB |
  | Service worker registers | before `load` (`readyState` `interactive`) | after `load` | after `load` |

  Measured from `dist/` built with a dummy DSN: text at gzip level 9, images and
  fonts as stored, each precache URL counted once. That is why the precache "before"
  is 5,166 KB here and 5,766 KB in the proposal, which counted raw text and the
  duplicates. The browser rows come from the new spec with one preloaded font held
  back 1.5 s, so `load` is late enough to tell the two registration timings apart;
  unthrottled, the old code also registered just after `load` and the check could
  not fail. The four budgets not yet met are set in the JSON to the "after" value,
  rounded up to the next whole KB, so they can only go down. The page-total limit is
  538 KB, not 537: #244 (items 154 and 155) merged first and added 0.3 KB to `/`.
  Item 61 stays open for steps 2, 4, 5 and 7.
- **2026-11-08** — First-visit weight, item 61 steps 4 and 2. Step 4: `manualChunks`
  in `vite.config.ts` is now a function, so `react`, `react-dom` and `scheduler` share
  `vendor-react` (the object form left `react-dom/client` in `main` and put `react` in
  `vendor-sentry`). The six static-plus-dynamic imports are now static: every one of
  them (`supabase`, `offlineDb`, `offlineNotes`, `encryption`, `encryptedNotes`,
  `@capacitor/network`) was already in the entry chunk, so the `import()` split
  nothing. Step 5 needs `AuthContext`'s import of Supabase made lazy, not these. A
  Rollup `onwarn` now fails the build on that warning. Step 2: Sentry loads after the
  window `load` event from `src/utils/monitoring.ts`, which every caller now reports
  through; `src/utils/sentryClient.ts` holds the init and the scrubbers, now also set
  as `beforeBreadcrumb`. Replay is imported from our bundle
  (`src/utils/sentryReplay.ts`, its own `vendor-sentry-replay` chunk) after init, and
  never on `/s/*`. Errors, unhandled rejections and reports made before init are held
  in a queue of at most 50, with context scrubbed on the way in, and sent after
  init; without a DSN nothing is queued. ESLint rejects a value import of
  `@sentry/react` outside those two files. The budget check now also asserts react and
  react-dom share a chunk and no Sentry chunk is in the entry path; the first-visit
  spec asserts no Sentry chunk before `load`, Sentry and Replay after it, and no
  Replay on a shared note.

  | Measure | Before (`d90d1d6`) | After | Target |
  |---|---:|---:|---:|
  | JS requested on `/` before `load`, gzip | 380.3 KB, 5 scripts | 296.7 KB, 4 scripts | ≤ 90 KB |
  | Everything requested on `/` until network idle, gzip | 537.2 KB | 536.7 KB | ≤ 300 KB |
  | App-shell JS, Editor excluded, gzip | 380.3 KB | 340.9 KB, Sentry included | ≤ 330 KB |
  | Largest JS chunk (`main`), gzip | 245.6 KB | 188.7 KB | ≤ 150 KB |
  | Precache | 45 entries, 1,022.4 KB | 48 entries, 1,021.8 KB | ≤ 1,100 KB |

  Same method as the entry above. The page total barely moves: Sentry (about 45 KB)
  and Replay (about 39 KB) still arrive before network idle, only after `load` now.
  The app-shell figure now counts the entry path plus Sentry without Replay, as the
  proposal's 330 KB target does; on the old definition it is 296.6 KB. The limits in
  `scripts/bundle-budget.json` are the "after" values rounded up: 297, 537, 341 and
  189 KB. Item 61 stays open for steps 5 and 7.
- **2026-11-08** — Issue #205, a launch gate. A note released or deleted on another
  device no longer closes the editor while it holds unsaved words (a failed save, a
  draft mid-debounce, or a save in flight). The editor reports its unsaved state to
  `useReleasedDraft`, which App uses for both ways a note can leave: the realtime
  handlers in `useNotesSync`, and a sync pull that rehydrates the library without
  it. When the editor holds words, App keeps the last copy of the note on screen
  and the editor stops saving. A banner offers Keep as new note, Copy and Let go.
  Retry on a released note means Keep as new note: the words go into a new note, so
  the other device's choice stands (the note stays in its Faded Notes, or stays
  gone) and nothing is written into a note that no longer exists. The new note
  keeps the pin and any tags that still exist. Once shown, the banner stays until
  the writer chooses or the note comes back, so a late save or an undone edit cannot
  close the editor mid-thought. Delete and tagging are off on a released note, and
  the writer's own delete of a failed draft still closes it. A clean note still
  returns to the library. Not reproduced against two live devices.
- **2026-11-08** — Item 24 from the public launch plan: the wrapped master key, as
  §3 of `2026-09-07-key-migration-and-rotation-design.md` describes it. `K` is the
  64 bytes the legacy derivation already produces. On a passphrase unlock of an
  account with no `vault`, `src/lib/vaultKey.ts` derives a 32-byte KEK with Argon2id
  over a fresh 16-byte salt, wraps `K` with AES-GCM under AAD
  `vault:<userId>:<wrapVersion>`, and makes a key-check under `K`. One `updateUser`
  call writes the whole `user_metadata.vault` object, `migratedAt` included, and a
  read-back confirms it. The legacy fields are not touched and no note is
  re-encrypted. The migration runs after the unlock commits and never blocks it:
  a failed or killed write leaves no vault and retries on the next passphrase
  unlock. Before writing it checks that `K` still verifies the legacy key-check,
  that the new wrap reopens to the same bytes, that the session is still the same
  user, and that no other device has written a vault. A migrated account unlocks by
  unwrapping; the restore paths verify `K` against the vault key-check. If the vault
  does not open but the legacy key-check does, the unlock goes through the legacy
  path and the vault is left alone (`DECISIONS.md`). Restores cannot migrate,
  because they have no passphrase. New accounts are still set up on the legacy path
  and migrate on their first passphrase unlock; item 27 rewrites setup. No database
  change. Tests 24-T1 to 24-T8 are in `vaultKey.test.ts` and
  `EncryptionContext.migration.test.tsx`, the second with real Argon2id against a
  fake server, including a write killed mid-flight and a write that landed but
  reported an error. The vault code (`vaultKey.ts`, `vaultMetadata.ts`,
  `services/vaultUnlock.ts`) loads with `import()` on unlock and restore. The
  legacy key-check upgrade and `parseKeyCheckVersion` moved into that chunk too,
  so the entry chunk grows by about 10 bytes gzip and stays inside the budget.
- **2026-11-08** — Item 26 from the public launch plan: the recovery kit, §2.4 of
  `2026-09-07-key-migration-and-rotation-design.md`. A recovery key is 32 random
  bytes, shown once as 52 base32 characters in groups of four, with Copy and Print.
  It is saved only after the writer types it back, as `vault.recoveryWrap`:
  AES-GCM of `K` under the key itself, AAD `vault-recovery:<userId>:<recoveryVersion>`,
  with its own schema version. The key is never stored or sent; only the wrap is.
  The offer appears after a passphrase unlock on an account with none, before the
  library opens, and "Not now" brings it back next time; Settings → Security makes
  or replaces one at any time. An account that has not migrated migrates first and
  the save waits for it. "Use your recovery key" on the unlock screen unwraps `K`
  and verifies the vault key-check, then holds the keys back until a new
  passphrase is saved: §2.1 in one `updateUser` call, with a fresh KEK salt, both
  versions advanced, the old passphrase wrap overwritten, the recovery wrap carried
  over, and the legacy key-check replaced by one no passphrase verifies
  (`DECISIONS.md`). A failed or interrupted write leaves the old passphrase and the
  recovery key both working; a landed write reported as an error is recognised on
  retry; a vault changed on another device is not overwritten. `user_metadata` has
  no compare-and-set, so each write is a fresh read, the write and a read-back;
  item 136 closes that. Tests 26-T1, 26-T3 and 26-T4 are unit and integration
  tests (`recoveryKey.test.ts`, `EncryptionContext.recovery.test.tsx`,
  `RecoveryKeyKit.test.tsx`); 26-T2 is `e2e/recovery-kit.spec.ts`, which needs the
  E2E credentials and has not been run. The recovery code and screens load with
  `import()`, and so does `PassphraseSetup`, which shows once per account: that is
  what keeps the app shell inside its budget (340.9 KB, from 341.1). A key is never
  shown when it could not be saved (no vault yet, a failed migration, or one already
  made on another device unless Settings asks to replace it). Review findings
  rejected or taken in part: `docs/reviews/2026-11-08-item-26-recovery-kit.md`.
  Remembered devices are not re-prompted after the new passphrase;
  that is item 25's `keyCheckVersion` check (25-T7).
- **2026-11-08** — Item 27 from the public launch plan: passphrase setup in three
  steps, passphrase, recovery key, done. New accounts set up straight into the
  wrapped vault: `K` is 64 random bytes, wrapped under an Argon2id KEK as for a
  migrated account, and nothing is written until the writer has typed the recovery
  key back. Then one `updateUser` call writes `encryption_salt`, a legacy key-check
  no passphrase verifies, and the whole vault with its key-check and
  `recoveryWrap`, so no account can hold a vault without a recovery key; an
  interruption before it leaves the account unset and the next sign-in starts at
  step 1 (`DECISIONS.md`). An account set up elsewhere meanwhile is never
  overwritten, and a landed write reported as an error is recognised on retry. The
  keys are installed when the writer leaves step 3, after the starter notes are
  written, so the library's first load includes them. Step 1 suggests six words
  from a 1,831-word list (BIP-0039 English less 217 words that do not suit the
  app), about 65 bits, with one-tap copy; the list lives in the lazy setup chunk.
  The old acknowledgement checkbox and its copy are gone. From an outside launch
  review, three lines of copy: setup tells the account password and the passphrase
  apart, the password-reset form says a new password does not open encrypted notes,
  and step 3 says devices already open keep working after a recovery and take the
  new passphrase when next asked. The privacy, security and terms pages stop saying a
  forgotten passphrase cannot be recovered, which has been false since item 26. A
  setup put away while its write was in flight (the writer left for a public page)
  no longer leaves a dead step 1 once the write lands: putting it away before the
  write is confirmed ends the setup screen, and the gate goes by the metadata. Existing accounts keep
  the legacy unlock and migration and never see the new setup. Tests: generator and
  policy (`passphraseGenerator.test.ts`), each step and the places it must not fire
  (`PassphraseSetup.test.tsx`, `accountGates.test.tsx`), the whole flow against the
  fake server with real Argon2id (`EncryptionContext.setup.test.tsx`), and
  `e2e/passphrase-setup.spec.ts`, which signs in as the shared test account and
  answers its metadata requests in the browser, because a fresh account needs a
  confirmed email. It needs the E2E credentials and has not been run with them; a
  copy with sign-in faked as well passed in Chromium. The entry chunk grows by
  0.1 KB gzip and stays inside its budget. Review findings rejected or taken in
  part: `docs/reviews/2026-11-08-item-27-three-step-setup.md`.
- **2026-11-08** — Item 159: conditional note writes. The queued note `update` now
  filters on the exact `updated_at` string the pre-write read returned, so a write
  from another device that lands between the read and the update matches zero rows
  instead of being overwritten. A zero-row result re-reads the row: missing still
  rebuilds from the local record; newer with different words raises the existing
  conflict path (both versions, local note marked `conflict`), with or without a
  registered handler; newer with only metadata changed writes once more over the
  newer version and keeps the metadata the other device changed; unchanged retries.
  A failed pre-write read now fails the entry instead of falling through to an
  unconditional write. First-ever syncs (no `lastSyncedAt`) are unfiltered, as the
  conflict check is. `soft_delete`, `restore` and `pin` are unchanged: each writes one
  column and cannot replace words. No database change. No conflict E2E exists, so the
  evidence is unit tests in `syncEngine.conflicts` and `syncEngine.queue`. Review
  findings rejected or left out of scope: `docs/reviews/2026-11-08-item-159-conditional-note-writes.md`.
