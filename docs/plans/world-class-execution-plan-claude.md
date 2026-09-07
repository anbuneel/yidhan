# Yidhan World-Class Execution Plan — The Master Ledger

**Version:** 1.2
**Last Updated:** 2026-09-07
**Status:** Living Document
**Author:** Claude (Claude Code)

---

## Original Prompt

> Is everything from your original analysis covered: world-class-improvements-claude.md? How do we now make the proposal an actionable plan that's sequenced right and doesn't miss any of yours and codex's findings?

Revision 1.2 responds to the Codex plan review of 2026-09-07 (read-only review of commit `0ac1d56`). Appendix C maps each review point to what changed.

---

## What this document is

One numbered ledger that every finding from both reviews maps into, sequenced by dependency, grouped into work packages. If an item is not in this ledger, it is not in the plan. Appendices A and B map every section of the Claude review and every section of the Codex review to ledger IDs; Appendix C maps the Codex plan review to revisions.

Inputs:
- Claude review: `docs/analysis/world-class-improvements-claude.md`.
- Codex review: `.impeccable/critique/2026-09-06T20-15-28Z__src-app-tsx.md` on `main` (commit `613da6d`).
- Cross-check: `docs/analysis/improvement-review-crosscheck-claude.md`.
- Codex plan review of 2026-09-07 (delivered in conversation; summarised in Appendix C).

Every item has an ID, a one-line description, a source (**C** Claude, **X** Codex, **CX** both, **P** plan review), a size, prerequisites where they matter, and a "done when" clause written as observable product behaviour plus the verification evidence that proves it.

**Sizes** are engineer-effort, not calendar: **S** up to one engineer-week, **M** one to three engineer-weeks, **L** three to six engineer-weeks.

**Disposition** is set per work package and overridden per row where noted:
- **Committed**: in scope for the phase; the phase does not exit without it.
- **Proposed**: agreed direction, can slip to the next phase without breaking exit criteria.
- **Gated**: keeps its ID and place, starts only when its named gate is met (a measurement, a demand signal from the cohort, or a prerequisite release).

ID prefixes: ED editor · SAVE save and revisions · NAV navigation and capture · LIB library and organization · SRCH search · SYNC sync and correctness · KEY privacy and keys · PORT import and export · ATT attachments · SHR sharing · MOB mobile and iOS · PERF performance and code health · DES design polish · ONB onboarding and copy · QA quality gates · OPS process and research.

---

## Board

Status lives here and nowhere else. Move an ID between lists in the same PR that changes its state. A PR title carries the IDs it closes, for example `fix(ED-01, ED-02): title Enter and slash-menu Escape`.

**Now**

- (nothing started)

**Next** (Phase 0, in PR order; see "Phase 0 as twelve pull requests")

- PR 1 · ED-01, ED-02, ED-16
- PR 2 · ED-03
- PR 3 · SAVE-01, SAVE-02, SAVE-03 (with the S0 scenario tests)
- PR 4 · SYNC-01
- PR 5 · SYNC-02
- PR 6 · PERF-07a then SYNC-03, SYNC-05
- PR 7 · SRCH-01, SRCH-05
- PR 8 · ONB-01, KEY-13a, MOB-01, OPS-05, OPS-06
- PR 9 · PORT-01, PORT-02
- PR 10 · SHR-04, PERF-05
- PR 11 · NAV-01, NAV-02
- PR 12 · QA-01

**Done**

- OPS-03 · work off the ledger (this document)

---

## The dependency spine

Eleven chains decide the order. Everything else can float within its phase.

| Chain | Order | Why |
|-------|-------|-----|
| Deployment safety | PERF-07a → SYNC-05 (first database-dependent change) → every later migration | The app must never ship ahead of its schema; the guard comes before the first change that needs one |
| Routes | NAV-01 → NAV-03, NAV-05, LIB-05, KEY-13b, MOB-05, SHR-03 | A note needs an address before it can be linked, switched to, captured into, or targeted by a widget |
| Keys | KEY-04 → KEY-01 → KEY-02, KEY-03, KEY-16, KEY-07, KEY-08, ONB-02 | The migration and rotation design is written and tested before the wrapped key ships; everything else hangs off it |
| Save and revisions | SAVE-01/02 → SAVE-04 + SYNC-05 → SAVE-05a → SAVE-05b → SYNC-11 | Honest failures first, then a revision the server can check, then history, then deltas |
| Deletion policy | SYNC-10 + SYNC-04 → SYNC-13 | The remote-deletion and reinsertion policy is settled before anything purges rows permanently |
| Document format | ED-22 + ATT-01 → ED-17 → ATT-03 → ATT-04, PORT-06b | Images need a validated place in the document and in storage; PDFs and OCR follow images |
| Search | SRCH-01 → SRCH-02, SRCH-03 → SRCH-06, LIB-12 → SRCH-04 | Cache first, then semantics and ranking, then render at scale, then persist only if measured |
| Library | LIB-01 → LIB-03 → LIB-12 | List view before bulk actions before virtualization |
| Browser before native | Phase 1 exit + QA-04 real-device browser pass → MOB-04b → KEY-08 → MOB-05 | The browser product is proven on real devices before the native package is committed; MOB-04a is a spike, not the shell |
| Structure | PERF-04 runs alongside NAV-01 | Routing extraction is the first slice of the `App.tsx` split |
| Quality | QA-01 → QA-02a → QA-03 → QA-02b | A fixture that can sign in and unlock, then the journeys, then the numeric targets |

Rules used for sequencing:
1. A bug a writer meets in the first five minutes outranks a feature.
2. A finding that risks losing words or leaking them is worked immediately, whatever phase is current.
3. Nothing that needs a Mac blocks anything that does not.
4. Copy fixes ship the week they are found.
5. Each phase ends with a shippable release; no phase depends on the next.
6. A test that proves a feature's "done when" ships in the same PR as the feature, never in a later phase.
7. Any change that needs a migration ships behind the deployment guard (PERF-07a) and is verified against the deployment target, not only staging.

---

## Sizing and forecasting

The phases are a priority order. Calendar dates come from measured throughput, not from the phase headings.

| Phase | Committed items | Proposed items | Gated items | Committed effort (engineer-weeks, mid-range) |
|-------|-----------------|----------------|-------------|-----------------------------------------------|
| 0 | 31 S/M | 0 | 0 | about 12 |
| 1 core | 24 (10 M, 14 S) | — | 0 | about 26 |
| 1 stretch | — | 25 | 0 | about 17 |
| 2 | — | 44 | 4 | about 60 |
| 3 | — | — | 22 | not forecast |

Assumption: one focused engineer plus review, as the original review states. At that staffing Phase 0 is roughly a quarter, Phase 1 core roughly two quarters. Two engineers roughly halve those. After Phase 0 ships, measure items per week and forecast Phase 1 from that number; write the forecast into the Board when the phase starts. The old calendar labels ("2 to 3 weeks", "6 to 8 weeks") were wrong at one engineer and are withdrawn.

---

## Phase 0: Trust the notebook, fix the snags

Disposition: **Committed** for every row.

Goal: a writer never loses an acknowledged edit in the named scenarios, never gets misled about what is saved or encrypted, and the five-minute snags are gone.

**Scenario set S0** (each has an automated test that ships with the feature it protects):
- S0-1 save fails on Escape, logo, footer, back, and search exit.
- S0-2 continuous typing for 30 s, then the tab is killed.
- S0-3 two tabs edit the same note, one offline, then both reconnect.
- S0-4 offline edit, reconnect, server holds a newer revision.
- S0-5 an update targets a note another device hard-deleted.

### WP0.1 Keystrokes and honest saving

| ID | Item | Source | Size | Done when (behaviour · evidence) |
|----|------|--------|------|----------------------------------|
| ED-01 | `Enter` in the title moves focus to the body at position 0 | C 4.1, defect 1 | S | Typing a title and pressing Enter puts the caret in the body · E2E keystroke test |
| ED-02 | `Escape` handler returns early on `defaultPrevented` or any open popover; slash menu calls `preventDefault` | C 4.1, defect 2 | S | Escape on the slash menu closes only the menu; note stays open · E2E test |
| ED-03 | Link extension: `openOnClick: false`, link popover (insert, edit, remove), entries in toolbar, sidebar, slash menu; `Cmd+K` with a selection inserts a link | C 4.1, defect 4 | S | A link can be added, edited, and removed by mouse; clicking one stays in the app · E2E test |
| ED-16 | Remove the duplicate `Underline` registration | C defect 19 | S | No Tiptap duplicate-name warning · console assertion in the editor unit test |
| SAVE-01 | Every exit path checks the save result; a failed save keeps the draft, shows a persistent "Not saved" state with Retry and Copy, visible in focus mode | X first release | S | S0-1: the note stays open with the state on screen until the save succeeds or the user copies · E2E with a forced `onUpdate` rejection |
| SAVE-02 | Maximum save interval of 10 s during continuous typing; encrypted local checkpoint | X first release | S | S0-2: the killed tab loses at most the last 10 s; reopening shows the checkpoint · E2E |
| SAVE-03 | Save indicator distinguishes "Saved on this device" from "Synced"; never implies another device has text before the server confirms the revision | X first release, X design P1 | S | Offline typing shows "Saved here", "Synced" appears only after the server acknowledges · unit test on the status state machine |

### WP0.2 Sync correctness

| ID | Item | Source | Size | Prerequisites | Done when (behaviour · evidence) |
|----|------|--------|------|---------------|----------------------------------|
| SYNC-01 | Conflict modal decrypts both sides: title, excerpt, word count, device and time, paragraph-level diff; both versions preserved until the user chooses | C 4.5, defect 5; X "preserve both revisions" | S | — | Both cards show readable text and a diff; choosing either keeps the other as a revision (SAVE-05a) or a copy · component test with two ciphertexts |
| SYNC-02 | `note_tags` pulled incrementally and subscribed in realtime | C 4.5, defect 6 | S | — | A tag added on device A appears on device B within the QA-03 cross-device budget without re-login · two-client integration test |
| SYNC-03 | Replace the `Math.max(...spread)` cursor computation | C defect 7 | S | — | Cursor computed by reduce · unit test at 100k rows |
| SYNC-05 | Server write contract: an RPC `update_note_checked(note_id, expected_hash, expected_updated_at, client_mutation_id, payload)` that returns one of `updated`, `stale` (with the current server row), `missing`, `forbidden`; `client_mutation_id` stored so a replay after a lost response returns the original result; `stale` raises a conflict with both versions preserved; `missing` alone may trigger the local rebuild path; `forbidden` blocks with its reason | X first release; P #2 | S | PERF-07a | S0-3 and S0-4: two clients writing the same note produce a conflict, never a silent overwrite; a replayed mutation is a no-op; a stale write is never mistaken for a missing row · integration tests for all four outcomes and for replay |
| SRCH-01 | Memoize plaintext per note keyed on `contentHash`; memoize the card snippet | C 4.4; X scale | S | — | No `DOMParser` work per keystroke after the first query · profiler assertion in a unit test with 2,000 notes |
| SRCH-05 | Delete `searchNotesOffline`, `searchDecryptedNotes`, and the stale "focused-gaze" comment | C 4.4 | S | — | Dead code gone · lint passes with the unused-export rule on |
| PERF-07a | Deployment guard: the client reads a `schema_version` row at startup and refuses writes when the app is ahead of the database; `verify_migration_state.sql` becomes a mandatory release step run against the deployment target, recorded in the PR | X sustainable; P #4 | S | — | An app built ahead of its migration shows a "database update pending" state instead of blocking the queue · unit test on the guard; release checklist in `docs/setup/` |

### WP0.3 Honest words and first impressions

| ID | Item | Source | Size | Done when (behaviour · evidence) |
|----|------|--------|------|----------------------------------|
| ONB-01 | Practice Space starter note and landing seal say plainly that drafts are not encrypted until signed up | X privacy 1, X design P1 | S | No screen claims encryption for localStorage content · copy review and a text assertion in the demo E2E |
| KEY-13a | Remove the GET `share_target` from the manifest until KEY-13b ships; the in-app paste path remains; note the removal in the changelog | X privacy 2; P #1 | S | The manifest has no `share_target`; no request to any server can carry shared text · manifest assertion in the build test |
| MOB-01 | Replace the "Quick gesture" modal with a one-line caption under the first card | C 4.9 | S | No modal on first mobile visit · mobile E2E |
| OPS-05 | Update `docs/roadmap.md` "Not Building": tables → databases only; backlinks → graph only; recovery → recovery key planned | C §6 | S | Doc changed |
| OPS-06 | Raise issue #170 to P1 and link it to KEY-01 to KEY-04 and KEY-16 | cross-check | S | Issue updated |

### WP0.4 Portability fixes

| ID | Item | Source | Size | Done when (behaviour · evidence) |
|----|------|--------|------|----------------------------------|
| PORT-01 | Lossless Markdown round-trip: highlight, underline, `h4` to `h6`, alignment | C 4.7, defect 9 | S | Editor HTML → Markdown → HTML → sanitized equals the original for every construct the editor can produce · property test |
| PORT-02 | Import accepts the v2 full-account backup; share rows labelled from decrypted titles | C 4.7, defects 8 and 10 | S | The offboarding export re-imports with identical note count, tags, pinned state, and timestamps · E2E |
| SHR-04 | Replace obsolete sharing expectations with current ones: remove the "never expires" case; the anonymous-view test must carry the `#k=` fragment and decrypt; assert the 30-day cap and the `/s/<token>/<slug>` route | X quality gates; P #6 | S | The sharing suite passes against current behaviour and fails if the fragment is dropped · E2E |
| PERF-05 | Delete the dead plaintext write paths and unused helpers | C 4.10, defect 22 | S | No caller can violate the E2EE CHECK constraint · lint with the unused-export rule; grep in CI for the removed names |

### WP0.5 Foundations started

| ID | Item | Source | Size | Done when (behaviour · evidence) |
|----|------|--------|------|----------------------------------|
| NAV-01 | Note URLs: `/n/<id>`, `/faded`, `/`; history push and pop; scroll restore; routing extracted to `src/routing/` | C 4.2; X connections | M | Browser Back from a note returns to the library at the same scroll position; refresh reopens the note · E2E |
| NAV-02 | Faded view routeable; editor with a missing note redirects instead of `return null` | C defects 13 and 14 | S | Opening `/n/<deleted>` lands on the library with a quiet notice · E2E |
| QA-01 | Authenticated E2E fixture (test account, vault unlock) and the full Playwright suite in CI | C 4.10; X quality gates | S | `npm run e2e` runs in CI on every PR with no skipped authenticated tests · CI log |
| OPS-03 | Work off the ledger: no issue tracker duplication; PR titles carry the IDs they close; the Board is the only status record | this doc | S | Done: convention adopted |

**Exit criteria (demonstrable):** zero lost acknowledged edits across S0-1 to S0-5 in CI; `note_tags` and conflict tests green; every screen's encryption claim matches storage; Back and refresh work on a note URL; the deployment guard is live.

---

## Phase 0 as twelve pull requests

Each PR is one reviewable change with its own tests. PRs 1 to 10 are independent of each other and can run in parallel; PR 6 lands PERF-07a before SYNC-05 inside the same PR.

| PR | IDs | Title | Size | Notes |
|----|-----|-------|------|-------|
| 1 | ED-01, ED-02, ED-16 | Title Enter, slash-menu Escape, duplicate Underline | S | Add an E2E for each keystroke |
| 2 | ED-03 | Link popover and `openOnClick: false` | S | `Cmd+K` with a selection inserts a link; library search keeps `Cmd+K` without one |
| 3 | SAVE-01, SAVE-02, SAVE-03 | Honest saving: failures block exit, 10 s cap, "saved here" versus "synced" | S | Ships S0-1 and S0-2 tests |
| 4 | SYNC-01 | Conflict modal decrypts both sides and shows a paragraph diff | S | Keys are in memory; no schema change |
| 5 | SYNC-02 | `note_tags` incremental pull and realtime | S | Two-client regression test |
| 6 | PERF-07a, SYNC-03, SYNC-05 | Deployment guard, cursor without spread, checked-update RPC with mutation ids | S | One migration: `schema_version` row plus the RPC; ships S0-3, S0-4, S0-5 tests |
| 7 | SRCH-01, SRCH-05 | Memoized plaintext by `contentHash`; delete dead search paths | S | Measure with the 2,000-note fixture |
| 8 | ONB-01, KEY-13a, MOB-01, OPS-05, OPS-06 | Honest words: Practice Space copy, remove the GET share target, gesture whisper, roadmap and #170 updates | S | Copy, manifest, and docs |
| 9 | PORT-01, PORT-02 | Lossless Markdown round-trip; v2 backup import | S | Property test over every editor construct |
| 10 | SHR-04, PERF-05 | Current sharing tests; delete the dead plaintext layer | S | Rewrite, not just delete |
| 11 | NAV-01, NAV-02 | Note URLs, history, faded route, missing-note redirect; routing extracted | M | After PRs 1 to 10 merge, to avoid conflicts in `App.tsx`; first slice of PERF-04 |
| 12 | QA-01 | Authenticated E2E fixture; full Playwright suite in CI | S | Needs the test-account secrets in repository settings; can start any time |

---

## Phase 1: Table stakes

Goal: recovery, addresses, list view, smart search, a fast front page, and the writing fluency every rival has.

### WP1.1 Keys and recovery — Committed

| ID | Item | Source | Size | Prerequisites | Done when (behaviour · evidence) |
|----|------|--------|------|---------------|----------------------------------|
| KEY-04 | Key migration and rotation design, written and reviewed before KEY-01: the wrapped material is the full 64 bytes (AES key and HMAC key); three distinct flows (passphrase change by re-wrap; remembered-device invalidation by key-check version bump; compromise rotation by new key and full re-encryption, KEY-16); interrupted migration resumes; two devices changing concurrently resolve to one winner and the other re-prompts; old offline devices with a stale wrap detect the version and re-unlock; restored backups from before the migration open | X privacy 4; P #3 | S | — | Every later key change can name the flow it belongs to and the test that covers it · design doc in `docs/plans/` with the test list, each test attached to KEY-01, KEY-02, KEY-03, or KEY-16 |
| KEY-01 | Wrapped master key: keep the derived key pair as `K`; derive a KEK from the passphrase with a fresh salt; store `wrap(KEK, K)` in `user_metadata` with a version flag; migrate on next unlock | C 4.6, App B; X privacy 4; #170 | M | KEY-04, PERF-07a | Existing users migrate without re-encrypting a note; killing the app mid-migration and reopening completes it; the key-check still verifies `K` · unit tests for interrupted migration and for both keys surviving the wrap |
| KEY-02 | Passphrase change by re-wrapping `K` | CX | S | KEY-01 | The new wrap is written and confirmed by the server before the old wrap is invalidated; the key-check version bumps; every other device requires re-unlock on next use; a concurrent change from a second device fails cleanly with a re-prompt · two-device integration test; offline attempt is queued and reported as pending, never as complete |
| KEY-03 | Recovery kit: random 256-bit key, `wrap(RK, K)`, shown once as grouped base32 with print and copy, confirmation required; unlock via recovery key then set a new passphrase | CX | M | KEY-01 | A user who forgets the passphrase enters the recovery key, sees their notes, and sets a new passphrase; the old wrap is then invalidated as in KEY-02 · E2E through the whole path |
| KEY-06 | Encrypted backup export (`.yidhan`: v2 JSON under a backup key) and import | C 4.6, 4.7; X first release | S | — | A backup restores into a fresh browser profile with identical notes, tags, pinned state, timestamps, and (later) attachments; a truncated file is rejected with a clear message · restore test in CI |
| KEY-09 | Threat-model page at `/security` in the product voice; `security.txt`; states visible metadata (timestamps, sizes, tag names until KEY-05) | C 4.6; X "define the promise" | S | — | Page live and linked from `/privacy` · copy review |
| KEY-12 | Outbound data audit: Sentry allowlisted fields, URLs, demo and capture paths, error strings | X privacy 5 | S | — | Audit doc lists every outbound request type and the fields it may carry; scrubber tests cover each · unit tests |
| KEY-15 | One undecryptable note renders as a locked card with retry; library stays usable; exports report incomplete | C 4.10; X first release | S | — | Corrupting one payload leaves every other note readable and the export banner says "1 note could not be included" · unit and E2E tests |
| ONB-02 | Passphrase setup rewritten as three steps: passphrase, recovery key, done | C 4.12 | S | KEY-03 | New users cannot finish setup without confirming the recovery key · E2E |

### WP1.2 Navigation and capture — Committed (KEY-13b Proposed)

| ID | Item | Source | Size | Prerequisites | Done when (behaviour · evidence) |
|----|------|--------|------|---------------|----------------------------------|
| NAV-03 | Quick switcher and command palette: `Cmd+K` focuses it in the library, `Cmd+P` opens it anywhere, `>` lists actions, arrow keys and Enter | C 4.2; X retrieval | M | NAV-01 | Any note reachable in three keystrokes from anywhere · E2E |
| NAV-04 | Keyboard navigation over cards: arrows or j/k, Enter, p, t, Delete with undo | C 4.2; X keyboard selection | S | — | Library usable without a mouse; focus ring visible · E2E and axe |
| NAV-05 | Quick capture: PWA `shortcuts` "New note" to `/n/new`; `Cmd+N` inside the editor | C 4.2; X capture | S | NAV-01 | Two capture paths work on Android and desktop · E2E |
| NAV-07 | "Start writing" reaches an editable draft in one action on desktop and mobile; mobile landing CTA opens a new Practice Space note | C 4.12; X design P2 | S | — | One tap, caret blinking · mobile E2E |
| ONB-05 | Practice Space to account in one step is the primary demo CTA | C 4.12; launch review #13 | S | — | The first note is carried into the account · E2E |
| KEY-13b | Private capture: POST `share_target` with `multipart/form-data` intercepted by the service worker; content stored locally in IndexedDB and encrypted immediately when the vault is unlocked; when locked, held locally in a "waiting for unlock" state and encrypted on unlock; never sent to any server unencrypted; failure and fallback paths defined | X privacy 2; P #1 | M | NAV-01, service-worker test harness | A share from another app creates a note without any network request carrying the text, with the vault locked or unlocked · service-worker E2E asserting the request log; locked-vault case covered |

### WP1.3 Library and search — Committed

| ID | Item | Source | Size | Prerequisites | Done when (behaviour · evidence) |
|----|------|--------|------|---------------|----------------------------------|
| LIB-01 | List view: one line per note, toggle in header, remembered per device | C 4.3 | M | — | Toggle works; cards remain the default; 2,000 notes render without jank · E2E and the QA-03 fixture |
| LIB-02 | Sort and chapter basis: last edited or created; within chapter by edited, created, title | C 4.3 | S | — | Editing an old note can stay in its chapter when "created" is chosen · unit test on grouping |
| LIB-10 | Card preview mask only when text overflows; cap age fade at 0.9 | X design P2 | S | — | Short previews fully legible; contrast on the Archive chapter passes AA · visual regression and axe |
| SRCH-02 | Query semantics: multi-term AND, quoted phrases, `tag:`, `is:pinned`, `before:`, `after:`; all matches highlighted | C 4.4; X retrieval | S | SRCH-01 | `tag:journal before:2026-03 "exact phrase"` returns only notes matching all three · unit test per operator; operators listed in the `?` modal |
| SRCH-03 | In-memory index (MiniSearch or FlexSearch) with ranking and fuzziness, incremental rebuild; moved to a worker if the main thread shows it | C 4.4; X scale | S | SRCH-01 | Title matches rank first; p95 under 200 ms at 10k notes · QA-03 fixture |

### WP1.4 Editor fluency — Core rows Committed (ED-04, ED-07, ED-09, SAVE-04, SAVE-05a); the rest Proposed

| ID | Item | Source | Size | Prerequisites | Done when (behaviour · evidence) |
|----|------|--------|------|---------------|----------------------------------|
| ED-04 | Markdown paste through `handlePaste` and `markdownToHtml` | C 4.1 | S | — | `## Heading` pastes as a heading; HTML clipboard content is untouched · unit test |
| ED-05 | Typography extension: smart quotes, dashes, ellipsis | C 4.1 | S | — | Enabled with a setting to disable; code blocks exempt · unit test |
| ED-06 | Word and character count, reading time, hover-revealed in the title-zone metadata | C 4.1; X counts | S | — | Visible on hover on desktop, tap on mobile · component test |
| ED-07 | Find and replace in note: `Cmd+F`, next and previous, decoration highlights | C 4.1, 4.4; X find/replace | S | — | Works in focus mode; replace-all is undoable in one step · E2E |
| ED-08 | Toolbar and sidebar subscribe to editor transactions so active states stay fresh | C 4.1 | S | — | Arrow into bold text lights the button · component test |
| ED-09 | One command model: same capability set in sidebar, inline toolbar, mobile bar, slash menu, shortcuts, with overflow by width; fixes the hidden inline toolbar at 1100 px and wider; text-align gets UI or the extension is dropped; inline code button | X design P2; C 4.1 | M | — | Every command reachable by mouse at every width from 320 px to 1920 px · E2E across four widths |
| SAVE-04 | Revision id on every save; the UI acknowledges a specific revision; the SYNC-05 RPC carries it | X first release | S | SYNC-05 | "Synced" names the revision the server confirmed · unit test on the state machine |
| SAVE-05a | Bounded local encrypted revision history per note (last 20 snapshots or 7 days), preview, restore, save-as-copy; snapshot before conflict resolution | X first release | M | SAVE-04 | A replaced paragraph is recoverable from the history panel; restoring creates a new revision rather than rewriting history · E2E |

### WP1.5 Speed and structure — PERF-01, PERF-02, PERF-04 Committed; the rest Proposed

| ID | Item | Source | Size | Prerequisites | Done when (behaviour · evidence) |
|----|------|--------|------|---------------|----------------------------------|
| PERF-01 | Prerender `/`, `/privacy`, `/terms`, `/support`, `/changelog`, `/roadmap`; hydrate only theme toggle and CTA | C 4.10 | M | — | Landing JavaScript under 50 KB gzip; content visible with JavaScript disabled · size budget test in CI |
| PERF-02 | Defer Supabase to first auth, `hash-wasm` to `deriveKey`, Sentry replay via `lazyLoadIntegration`; split the demo page; fix the React chunk; resolve the five static-plus-dynamic import warnings; keep offline assets and font licences precached | C 4.10; X sustainable | S | — | `main` under 300 KB; zero import warnings; offline shell still complete · build assertion and the service-worker E2E |
| PERF-03 | Input-path work: stop lifting `getHTML()` into `Editor` state on every keystroke; stop re-attaching visibility listeners per character; measure KDF and library decryption | X sustainable; C 4.1 audit | M | — | Typing p95 under 100 ms on the long-note fixture · QA-03 |
| PERF-04 | Decompose `App.tsx` and `Editor.tsx`: routing, `useNotesSync`, `useImport`, `useDemoMigration`, `useShareTarget`, `PublicPage`; clear interfaces for persistence, note lifecycle, search, attachments, vault | C 4.10; X sustainable | M | NAV-01 | `App.tsx` under 600 lines with no behaviour change · existing test suite green after each extraction |
| DES-01 | Manuscript grows with content; minimum height about 60 vh | C 4.11 | S | — | Short notes read as a page · visual regression |
| DES-02 | Title capped at two lines with a smaller size past 60 characters; mirrors body H1 metrics | C 4.11 | S | — | A 120-character title fits in two lines at 1440 px · visual regression |
| DES-06 | Edge states designed: locked note, offline editor, failed sync, expired letter, on-this-device-only | C 4.11; X status visibility | S | — | Each state has a screen and a Storybook-style fixture · visual regression |
| DES-07 | Playwright axe pass in CI; reduced motion and contrast checks per theme | C 4.11 | S | QA-01 | CI fails on new violations · CI log |
| DES-08 | Screen-reader verification: editor labelling, status announcements, focus order, modal behaviour | X personas | S | — | Checklist passed with VoiceOver and NVDA; the save status is announced · checklist in repo |

### WP1.6 Sync hardening — Committed

| ID | Item | Source | Size | Prerequisites | Done when (behaviour · evidence) |
|----|------|--------|------|---------------|----------------------------------|
| SYNC-10 | Deletion policy, decided before anything purges: a queued update for a note hard-deleted or purged elsewhere becomes a conflict ("this note was released on another device: restore or discard"), never a silent reinsertion; a permanently failing `create` expires into a blocked state the user can export or discard | C 4.5; X first release; P #2 | S | SYNC-05 | S0-5: the reinsertion path only runs for the `missing` outcome on notes with no server tombstone · integration test with a tombstoned note |
| SYNC-04 | Tombstones for notes and tags written by trigger and pulled by cursor; end the two full-table sweeps | C 4.5; launch review | M | PERF-07a | Sync makes no `select id` sweep; a note deleted on device A disappears on device B via the tombstone · integration test and query log assertion |
| SYNC-06 | Cross-tab queue ownership with the Web Locks API or a recoverable lease | X first release | S | — | Two tabs never sync concurrently; a tab that dies mid-sync releases the lock within 30 s · E2E with two pages |
| SYNC-07 | `isRetryableError` classifies by error code and type, not substrings; `delete` no longer string-matches "0 rows" | C defect 21 | S | — | A server error whose message contains "network" is not retried unless its code is transient · unit tests |
| SYNC-08 | `fadedNotesCount` derived from data, not incremented optimistically | C defect 16 | S | — | Count equals the faded list length after any sequence of local and realtime deletes · unit test |
| SYNC-09 | Card deletion is exactly-once with deliberate undo: the delete action runs once whether the animation finishes or the card unmounts; a failed delete restores the card with a message; Undo is the only cancellation path | C defects 15 and 17; P #6 | S | — | Typing in search during the delete animation still deletes exactly once; a rejected delete restores the card · component test with unmount-mid-animation and with a rejected `onDelete` |
| SYNC-13 | Server-side `pg_cron` purge for faded notes instead of client-load purge | C defect 25 | S | SYNC-10, SYNC-04 | A purged note leaves a tombstone; a device with a queued update for it gets the SYNC-10 conflict, not a resurrection · integration test |

### WP1.7 Portability — Proposed

| ID | Item | Source | Size | Prerequisites | Done when (behaviour · evidence) |
|----|------|--------|------|---------------|----------------------------------|
| PORT-03 | Per-note Markdown export in a real zip with front matter | C 4.7; X migration | S | PORT-05 | Obsidian opens the folder with titles, tags, and dates intact · fixture comparison |
| PORT-04 | Timestamps, tag colours, and pinned state preserved on every import path | C 4.7 | S | — | Round-trip equality on all three fields · property test |
| PORT-05 | Real Markdown parser and serializer with fixtures, replacing the regex chain | X migration | M | — | Fixture suite of at least 40 documents passes; PORT-01 property test still passes · CI |

### WP1.8 Quality gates and mobile fit — QA-01, QA-02a, QA-03 Committed; the rest Proposed

| ID | Item | Source | Size | Prerequisites | Done when (behaviour · evidence) |
|----|------|--------|------|---------------|----------------------------------|
| QA-02a | Journeys, first half: continuous typing, interrupt, reload, recover; two tabs with one offline; network flaps, expired auth, rejected writes, quota pressure, denied persistence, blocked mutations | X quality gates | M | QA-01 | Each scenario asserts the acknowledged revision survives and the UI shows the true state; none is skipped in CI · CI log |
| QA-03 | Acceptance targets measured nightly on a defined device and dataset: warm launch to editable p95 under 1 s; typing p95 under 100 ms; search p95 under 200 ms at 10k notes; cross-device visibility p95 under 5 s; zero lost acknowledged edits in fault injection; backup restores in a fresh profile | X quality gates; C §7 | M | QA-01 | The nightly job fails when any target regresses and publishes the numbers in its summary · CI |
| QA-04 | Cross-browser matrix: Chrome, Edge, Firefox, Safari; real iPhone, iPad, Android; installed PWA | X quality gates | S | — | Matrix documented; the release checklist records a pass per release · checklist |
| QA-06 | Editor fixture tests: selection preserved, native undo, IME composition, paste fidelity, mobile keyboard | X next release | S | — | Each fixture asserts the document after the interaction · unit tests |
| MOB-02 | Time ribbon gets its own room: bottom padding, hidden near the footer, hidden under 20 notes | C 4.9 | S | — | No overlap on a 390 px viewport · mobile E2E and visual regression |
| MOB-03 | Remove the doubled title in the mobile editor; `h-screen` to `100dvh` | C 4.9 | S | — | iOS Safari bars no longer clip the toolbar · real-device check in QA-04 |
| MOB-04a | iOS keyboard feasibility spike (one week, needs a Mac): Capacitor shell with the current editor; measure keyboard height tracking, selection, and focus mode in WKWebView; decide go or no-go for MOB-04b | P #7 | S | — | A written result with measurements and the decision · doc in `docs/plans/` |
| MOB-08 | Real-device testing checklist per release (keyboards, installed PWA, gestures) | X; C mobile docs | S | — | A release cannot merge without a recorded device pass · checklist in repo, referenced from the release PR template |
| ONB-03 | Custom SMTP for auth email; magic-link sign-in | C 4.12; backlog P1 | M | — | OTP and magic-link emails arrive within one minute in production for 50 consecutive sends · manual verification log |
| OPS-01 | Validation cohort: 8 to 12 target writers for several weeks with their own material and consent for content-free diagnostics; observe capture-to-save, finding an old note, long writing, interruptions, migration, restoration | X sequence | ongoing | Phase 0 shipped | Findings written up and used to reorder Phase 2 · doc in `docs/reviews/` |

**Exit criteria (demonstrable):** recovery kit and passphrase change pass their two-device tests; every note has an address and the switcher reaches it; list view and operators shipped; landing under 50 KB; the S0 set plus QA-02a green nightly with QA-03 numbers published; the cohort is writing.

---

## Phase 2: Depth

Disposition: **Proposed** unless marked Gated.

Goal: pictures, importers, connections between notes, encrypted tags, and (gated) the iPhone app.

### WP2.1 Attachments

| ID | Item | Source | Size | Prerequisites | Done when (behaviour · evidence) |
|----|------|--------|------|---------------|----------------------------------|
| ED-22 | Structured document format: ProseMirror JSON is the canonical stored form with a `docVersion` inside the encrypted payload; a schema validator (node and mark allow-list checked with the editor schema, not DOMPurify) rejects unknown or malformed nodes on read and write; HTML is derived from JSON for cards, exports, and letters and still passes `sanitizeHtml`; older clients that meet a newer `docVersion` open the note read-only with an "update Yidhan to edit" notice | X next release; P architecture | M | PERF-07a | A note with a new node type renders in a newer client, opens read-only in an older client, and exports to clean HTML and Markdown; a malformed JSON payload is rejected without crashing · unit tests for validator, degradation, and export |
| ATT-01 | Attachment model: per-attachment key inside the note payload; Supabase Storage under `attachments/<userId>/<id>` with path RLS; Dexie blob table; sanitizer allows `img[data-attachment-id]` only and never an external `src` | C App C; X attachments | M | ED-22, KEY-01 | An image uploaded from device A renders on device B, including offline after sync; the server holds only ciphertext; a note payload referencing an external `src` is rejected · integration tests and a storage-bucket assertion |
| ATT-02 | Encrypted originals, filenames, thumbnails, and manifests; resumable upload; offline availability; quota handling; orphan cleanup; included in export and backup | X attachments | M | ATT-01 | A 5 MB upload interrupted at 50 % resumes and completes; deleting the last referencing note removes the blob within a day; the account quota is shown and enforced · integration tests |
| ED-17 | Images in the editor: paste, drop, slash command; 5 MB cap, 2048 px downscale, WebP; blob URLs at render | C 4.1; CX | L | ATT-01 | A photo pasted offline syncs and renders on another device; a 20 MB photo is downscaled below the cap · E2E |
| ATT-05 | Letters carry attachments; Markdown zip includes an `attachments/` folder; encrypted backup includes them | C App C | S | ED-17, KEY-06 | A shared letter shows its images; a restored backup restores them · E2E |

### WP2.2 Importers and output

| ID | Item | Source | Size | Prerequisites | Done when (behaviour · evidence) |
|----|------|--------|------|---------------|----------------------------------|
| PORT-06a | Importers: Markdown folders and zips, Bear and TextBundle, Notion export, Apple Notes export workflows, Obsidian folders with `[[links]]` mapped to LIB-05 | C 4.7; X migration | M | PORT-05 | Each importer is a pure function with at least five real-world fixtures; counts match the source · unit tests |
| PORT-07 | Import preview before, counts and reconciliation after, unsupported formatting explained | X migration | S | PORT-06a | The preview lists what will and will not carry over; the summary matches the created notes · E2E |
| PORT-08a | Print stylesheet and readable PDF via print | X next release | S | — | A 3,000-word note prints with headings, lists, and code intact and no UI chrome · print snapshot |

### WP2.3 Connections and organization

| ID | Item | Source | Size | Prerequisites | Done when (behaviour · evidence) |
|----|------|--------|------|---------------|----------------------------------|
| LIB-05 | Note links: `[[` opens the switcher and inserts `/n/<id>`; titles resolve client-side; "Mentioned in" list at the bottom | C 4.3; X connections | M | NAV-01, NAV-03, ED-22 | Renaming a note updates every link's text; the linked note lists the mention · E2E |
| LIB-04 | Tag quality of life: search in selector, rename preserves assignments, Tags page with counts, `#tag` autocomplete in the editor | C 4.3 | S | — | Typing `#jour` and Enter assigns "journal" without leaving the editor · E2E |
| LIB-06 | Templates (notes tagged `template`) and a "Today" daily page in the palette | C 4.3 | S | NAV-03 | "Today" opens today's note or creates it once · E2E |
| LIB-08 | Saved searches in the palette | X retrieval | S | NAV-03, SRCH-02 | A saved search reopens with its operators and result set · E2E |
| NAV-06 | Append-to-existing-note capture (append to today's page from the share target) | X capture | S | KEY-13b, LIB-06 | Shared text lands at the end of today's page, encrypted · service-worker E2E |
| ED-19 | Heading outline for long notes, hover-revealed on desktop | X next release | M | — | The outline follows scroll and clicking a heading scrolls to it · E2E |
| LIB-03 | Multi-select and bulk actions in list view only: tag, pin, fade, export | C 4.3 | M | LIB-01 | Shift-click ranges; bulk fade is undoable in one step · E2E |
| LIB-12 | Virtualize the list view once measured at 2,000 notes | C 4.10; X scale | M | LIB-01 | 10k-note fixture scrolls at 60 fps with search open · QA-03 fixture |
| SRCH-06 | Search results honour progressive rendering and virtualization instead of rendering every match at once | X scale | S | LIB-12 | 10k matching notes render in under 200 ms · QA-03 fixture |

### WP2.4 Privacy depth

| ID | Item | Source | Size | Prerequisites | Done when (behaviour · evidence) |
|----|------|--------|------|---------------|----------------------------------|
| KEY-05 | Encrypt tag names (and future collection and attachment names) with AAD `tagId:userId`; append-only migration | C 4.6; X privacy 3 | M | KEY-01, PERF-07a | The server holds no plaintext tag names; filtering and autocomplete still work offline · migration test and a database assertion |
| KEY-10 | Key exposure at rest, stated honestly: on the web the unlocked key is held in a dedicated Worker so page scripts cannot read it directly (execution isolation, which limits but does not remove XSS reach); persistent protection comes only from a platform keystore (native, KEY-08) or a passkey-wrapped blob (KEY-07); "Remember this browser" copy states the device and XSS exposure plainly | C 4.6; X privacy 5; P architecture | M | — | Raw key bytes are no longer readable from `localStorage` or page scope; the setting's copy passes review · unit test on the Worker boundary |
| KEY-16 | Compromise rotation: generate a new `K`, re-encrypt every note and attachment under it with sync paused, re-wrap, then resume; distinct from the KEY-02 passphrase change | X privacy 4; P #3 | M | KEY-01, KEY-04 | After rotation no ciphertext on the server decrypts under the old key; an old device is forced to re-unlock and re-pull · integration test |
| KEY-11 | Independent security review covering encryption, migrations, auth, deletion, sharing, recovery, and delivery chain; before broad public assurances | X privacy 6 | L (external) | KEY-01, KEY-05 | Report received; every finding triaged into this ledger · report in `docs/reviews/` |

### WP2.5 iOS — Gated on Phase 1 exit, a QA-04 real-device browser pass, and a "go" from MOB-04a

| ID | Item | Source | Size | Prerequisites | Done when (behaviour · evidence) |
|----|------|--------|------|---------------|----------------------------------|
| MOB-04b | iOS Capacitor project: haptics, status bar, keyboard, share sheet, secure storage; App Store privacy labels; TestFlight | C 4.9; X release 4; P #7 | M | Gate above | TestFlight build passes the QA-04 device checklist and the S0 set · checklist and CI |
| KEY-08 | Biometric unlock on native: remembered blob held in the secure keystore behind Face ID or fingerprint | C 4.6; X "protected device key storage" | M | KEY-01, MOB-04b | The key never touches `localStorage` on native; a failed biometric falls back to the passphrase · device test |
| MOB-07 | Touch targets under 44 px on narrow layouts fixed; metadata and navigation legibility on phones | X minor observations | S | — | Axe target-size rule passes at 390 px · axe |

### WP2.6 Polish and housekeeping

| ID | Item | Source | Size | Prerequisites | Done when (behaviour · evidence) |
|----|------|--------|------|---------------|----------------------------------|
| DES-03 | Card-to-manuscript view transition and its reverse, progressive enhancement | C 4.11 | M | NAV-01 | Works in Chrome and Safari; instant elsewhere; respects reduced motion · visual check per browser |
| DES-04 | Reading settings: text size (three steps), line length, body typeface; expose Washi and Mori | C 4.11 | S | — | Settings persist per device and survive a refresh · E2E |
| DES-05 | In-product hints: one per first three notes; empty search suggests an operator; no tour | C 4.11; X help heuristic | S | — | Hints dismiss forever and never reappear after sign-in elsewhere · E2E |
| LIB-11 | Pinned chapter as a compact row when it holds fewer than three notes | C 4.11 | S | — | No lone card in a wide band at 1440 px · visual regression |
| ED-10 | `spellcheck` and `lang` on the editor; remove the dead `prose-editor` class | C 4.1 | S | — | Browser spellcheck underlines a misspelling · E2E |
| ED-11 | Code block language and highlighting via lowlight | C 4.1 | S | ED-22 | Language picker in the block; highlighting survives export · unit test |
| ED-12 | Undo history isolated per note (`setContent` with history cleared, `emitUpdate: false`) | C defect 18 | S | — | Undo after switching notes cannot alter the previous note · unit test |
| ED-13 | Untouched new note fades silently on leave | C 4.2 | S | — | Leaving a blank new note leaves no card behind · E2E |
| ED-14 | Slash menu flips and clamps to the viewport and follows scroll; renderer lifecycle bug on Escape fixed | C defect 20 | S | — | The menu is fully visible at the bottom of a 390 px viewport · mobile E2E |
| ED-23 | Overflow menu: touch and scroll close, `menuitem` roles, arrow keys | C 4.9 | S | — | Axe clean; arrow keys move focus · component test |
| SAVE-05b | Revision history synced so recovery survives a lost device; retention and deletion defined | X first release | M | SAVE-05a, KEY-06 | A revision made on a lost device restores on a new one; deleted notes purge their revisions with SYNC-13 · integration test |
| SAVE-06 | Remove `savePhaseTimeoutRef` dead code; stop listener churn in the visibility effect | C 4.1 audit | S | — | Listeners attach once per mount · unit test counting listeners |
| PERF-06 | Fix set-state-during-render (`ChapterSection`, `TimeRibbon`); retire react-doctor suppressions progressively | C defect 24 | S | — | Suppressions under 5 with no behaviour change · lint |
| PERF-07b | Migration ordering and drift verification automated in CI against a staging database, plus the release-time check against production from PERF-07a | X sustainable | M | PERF-07a | CI fails when the app is ahead of the staging schema; the release PR records the production check · CI |
| SHR-01 | Optional passphrase on a letter (second wrap of the share key) | C 4.8 | S | — | The link alone shows a passphrase prompt; the wrong phrase reveals nothing · E2E |
| SHR-02 | "Refresh this letter" re-encrypts under the existing token; opt-in live letters | C 4.8; roadmap | S | — | The link stays valid after refresh and shows the new text · E2E |
| DES-09 | Task tests for long titles, dense tags, RTL, Tamil and CJK input, zoom, real virtual keyboards | X personas | S | — | Each fixture renders without clipping or overlap · visual regression |
| QA-02b | Journeys, second half: PWA upgrade with dirty work and lazy chunks; import, export, restore with nested formatting, Unicode, attachments, links; lock, sign out, rotate, recover, older offline device; account deletion gates | X quality gates | M | QA-02a, KEY-01, KEY-16 | Each scenario asserts the acknowledged revision survives and the resulting state is the documented one; none is skipped · CI |
| OPS-02 | Test willingness to pay before promising unlimited attachments and backups; model storage, transfer, retention, support, and review costs; Bloom tier | X sustainable; monetization docs | S | OPS-01 | Pricing decision and cost model recorded · doc |

**Exit criteria (demonstrable):** an image round-trips between devices offline; five importers pass their fixtures; note links resolve; the server holds no plaintext tag names; QA-02b green; the security review is commissioned. The iOS gate is evaluated separately and does not block Phase 2 exit.

---

## Phase 3: Distinction

Disposition: **Gated** for every row. Each row names the gate that starts it and the behaviour that finishes it.

| ID | Item | Source | Size | Gate (starts when) | Done when (behaviour · evidence) |
|----|------|--------|------|--------------------|----------------------------------|
| ED-18 | Simple tables (Tiptap Table, no formulas, no sorting) | CX; decision revisit | M | ED-22 shipped and the cohort asks for tables | A three-column table round-trips through export and a letter · E2E |
| ED-20 | Heading folding | X | M | ED-19 shipped and long notes over 3,000 words exceed 10 % of the cohort's notes | Folded state persists per note · E2E |
| ED-21 | Footnotes | X | M | ED-22 shipped and cohort demand | Footnotes export to Markdown and print correctly · unit test |
| ED-15 | Replace triple-tap focus mode with a gesture that does not fight the OS | C 4.1 | S | Real-device testing (QA-04) records a conflict | No accidental focus-mode toggles in a 10-minute device session · device test |
| ATT-03 | PDFs as attachments | X | M | ED-17 shipped | A PDF attached offline syncs and opens on another device · E2E |
| ATT-04 | Local OCR for images and PDFs | X | L | ATT-03 shipped and search for image text is requested by the cohort | Text in an attached image is searchable without leaving the device · unit test with a fixture image |
| PORT-06b | Evernote `.enex` importer with attachments | C 4.7; X | M | ED-17 shipped | An `.enex` with images imports with counts matching · fixture test |
| PORT-08b | DOCX export | X | M | PORT-05 shipped and cohort demand | A note exports to a `.docx` that opens in Word with headings and lists intact · fixture comparison |
| KEY-07 | Passkey unlock on the web via WebAuthn PRF | C 4.6 | M | KEY-01 shipped; PRF support in the cohort's browsers measured | A passkey unlocks the vault without the passphrase; the passphrase still works · E2E in Chrome and Safari |
| KEY-14 | Move the salt out of `user_metadata` (issue #170 D1) | X via #170 | S | KEY-01 shipped | The JWT carries no salt; unlock still works on every device · integration test |
| MOB-05 | Home-screen widget (quick capture, today's page), share extension, Siri Shortcuts | C 4.9; X release 4 | L | MOB-04b in the App Store | A widget tap opens a new note in under 1 s; the share extension creates an encrypted note · device test |
| MOB-06 | Landscape and iPad: max line length, sidebar at the iPad breakpoint | C 4.9 | M | MOB-04b in the App Store | Lines are 60 to 75 characters on iPad landscape · visual regression |
| LIB-07 | "Set aside" true archive action | C 4.3 | S | LIB-01 shipped and the cohort asks for an archive | Set-aside notes leave the chapters and return on request · E2E |
| LIB-09 | Lightweight named collections | X connections | M | LIB-08 shipped and the cohort still asks for collections | A collection is a saved query with a name, not a container; deleting it deletes no notes · E2E |
| SHR-03 | Public Garden as static pre-rendered pages | C 4.8; roadmap | L | NAV-01 and ED-17 shipped, and at least a quarter of the cohort asks to publish | A published note is readable with JavaScript disabled and unpublishes within a minute · E2E |
| SRCH-04 | Persisted encrypted search index | C 4.4 | M | QA-03 shows load-time indexing above 500 ms at the cohort's library size | Cold start with 10k notes reaches a searchable state under 1 s · QA-03 |
| SYNC-11 | Delta uploads instead of the full blob per autosave | C 4.5 | M | SAVE-05b shipped and QA-03 shows autosave payloads above 100 KB in normal use | A one-word edit to a 200 KB note uploads under 5 KB · network assertion |
| SYNC-12 | Evaluate Yjs or Automerge for note bodies | C 4.5 | L | SYNC-11 shipped and conflicts exceed one per user-week in the cohort | Written evaluation with a prototype and a decision · doc |
| NAV-08 | Browser clipper with encrypted staging | X capture | L | KEY-13b shipped and cohort demand | A clipped page becomes an encrypted note without plaintext leaving the browser · extension test |
| OPS-04 | Re-validate Quiet Intelligence against the privacy and writing goals; keep publishing, collaboration, databases, graph view, and cloud AI deferred until demand is observed | X sequence; C | S | OPS-01 findings available | Decision recorded per idea · doc |
| OPS-07 | Keep `docs/prd.md`, `docs/roadmap.md`, and `src/data/roadmap.ts` in step with each shipped phase; mark ledger items done with their PR | this doc | S | every phase exit | Docs match shipped behaviour · review at phase exit |

---

## Operating model

- **The ledger is the tracker.** No GitHub issues are created from it. A PR's title and commit messages carry the IDs it closes. When a PR merges, the same PR moves those IDs to **Done** on the Board and, if a new item starts, to **Now**.
- **Pick from the current phase,** in the PR order given for Phase 0 and by the dependency spine after that. **Exception:** a finding that risks losing or leaking words is worked immediately, whatever phase is current, and gets the next free ID in its area.
- **Committed, Proposed, Gated.** Only Committed items hold a phase's exit. Proposed items may slip one phase. Gated items start only when their named gate is met; a gate can be a measurement from QA-03 or a demand signal from the cohort, and the gate is recorded in the PR that starts the item.
- **Tests ship with features.** The "done when" evidence lands in the same PR. A phase's exit criteria are the union of its Committed items' evidence, all green in CI, not a separate promise.
- **Deployment safety.** Every migration goes behind PERF-07a: the app's schema guard, plus `verify_migration_state.sql` run against the deployment target and recorded in the release PR.
- **Gates.** `npm run check` on every PR, and `npm run e2e` once QA-01 lands. Axe (DES-07) on every PR from Phase 1. The QA-03 targets run nightly and block a release when they regress.
- **Docs.** Each PR adds its line to `src/data/changelog.ts`. When a phase ships, update `docs/prd.md`, `docs/roadmap.md`, and `src/data/roadmap.ts` (OPS-07). Ledger rows are never deleted.
- **Forecasting.** After Phase 0, forecast Phase 1 from measured items per week and write the forecast into the Board. Re-forecast at each phase exit.
- **Re-planning inputs.** The cohort (OPS-01), the nightly targets (QA-03), and the security review (KEY-11) are the only inputs that reorder the plan.
- **What stays out.** Real-time collaboration, folders, push notifications, gamification, floating selection toolbars, analytics tracking, and cloud AI stay out, as both reviews agreed.

---

## Appendix A: Coverage of the Claude review

| Claude review section | Ledger IDs |
|-----------------------|-----------|
| §1 ten moves | 1 KEY-01/02/03 · 2 ED-17, ATT-01/02 · 3 ED-01/02/03/04 · 4 NAV-01/03 · 5 LIB-01/02, SRCH-02/03 · 6 SYNC-01/02/03 · 7 PORT-01/02/03/06, KEY-06 · 8 PERF-01/02 · 9 MOB-01/02/03/04, KEY-08 · 10 PERF-04 |
| §4.1 findings table (15 rows) | ED-01, ED-02, ED-03, ED-04, ED-17, ED-08, ED-06 and ED-07, ED-05, ED-10, ED-11, ED-09 (TextAlign and inline code), ED-12, ED-13, ED-14 and ED-15, ED-16 |
| §4.1 recommendations 1 to 8 | ED-01/02, ED-03, ED-04, ED-05/06, ED-07, ED-17, ED-08, ED-18 |
| §4.2 recommendations 1 to 5 | NAV-01/02, NAV-03, NAV-04, NAV-05, ED-13 |
| §4.3 recommendations 1 to 8 | LIB-01, LIB-02, SRCH-01/02/03, LIB-03, LIB-04, LIB-05, LIB-06, LIB-07 |
| §4.4 recommendations 1 to 6 | SRCH-01, SRCH-02, SRCH-03, SRCH-04, ED-07, SRCH-05 |
| §4.5 findings table (10 rows) | SYNC-01, SYNC-02, SYNC-03, SYNC-04, SYNC-12 (merge), SYNC-11 (blob per save), SYNC-10, SYNC-07, SYNC-08, SYNC-09 |
| §4.5 recommendations 1 to 5 | SYNC-01, SYNC-02, SYNC-04, SYNC-03, SYNC-12 |
| §4.6 recommendations 1 to 6 | KEY-01/02/03 and ONB-02, KEY-05, KEY-06, KEY-07 and KEY-08, KEY-09, KEY-10 |
| §4.7 recommendations 1 to 5 | PORT-01, PORT-02 and KEY-06, PORT-03, PORT-06a/b, PORT-04 |
| §4.8 recommendations 1 to 3 | SHR-01, SHR-02, SHR-03 |
| §4.9 findings table (5 rows) | MOB-01, MOB-02, MOB-03 (title), MOB-03 (dvh), ED-23 |
| §4.9 recommendations 1 to 5 | MOB-01, MOB-02, MOB-04a/b and KEY-08, MOB-05, MOB-06 |
| §4.10 measurements and structure | PERF-01/02 (bundle), PERF-04 (App.tsx), PERF-06 (set-state-in-render), KEY-15 (eager decrypt throws) |
| §4.10 recommendations 1 to 7 | PERF-01, PERF-02, KEY-15, LIB-12, PERF-04, PERF-05 and SAVE-06, QA-01 |
| §4.11 items 1 to 8 | DES-01, LIB-11, DES-02, DES-03, DES-04, DES-05, DES-06, DES-07 |
| §4.12 items (4) | ONB-02, ONB-03, NAV-07, ONB-05 |
| §5 phases | replaced by this document's phases |
| §6 decisions to revisit | OPS-05, ED-18, LIB-05, KEY-03 |
| §7 success measures | QA-03, OPS-01 |
| Appendix A defects 1 to 25 | 1 ED-01 · 2 ED-02 · 3 ED-04 · 4 ED-03 · 5 SYNC-01 · 6 SYNC-02 · 7 SYNC-03 · 8 PORT-02 · 9 PORT-01 · 10 PORT-02 · 11 MOB-01 · 12 MOB-02 · 13 NAV-02 · 14 NAV-02 · 15 SYNC-09 · 16 SYNC-08 · 17 SYNC-09 · 18 ED-12 · 19 ED-16 · 20 ED-14 · 21 SYNC-07 · 22 PERF-05 · 23 PERF-02 · 24 PERF-06 · 25 SYNC-13 |
| Appendix B key hierarchy | KEY-01, KEY-02, KEY-03, KEY-07, KEY-16 |
| Appendix C attachments | ATT-01, ATT-02, ED-17, ATT-05 |
| Operating model (this document) | OPS-03, OPS-07 |

## Appendix B: Coverage of the Codex review

| Codex section | Ledger IDs |
|---------------|-----------|
| Recommendation (complete journey; retain the architecture) | framing; no rewrite is a rule of this plan |
| What deserves preservation | "What stays out" and the design identity are protected in every phase |
| Competitive benchmarks (Apple ADP, Bear Web, Notion offline, Craft, Notesnook) | Scorecard corrected in the cross-check; no work items |
| First release: save state must describe durable state | SAVE-01, SAVE-02, SAVE-03, SAVE-04 |
| First release: encrypted revision history and independent recovery | SAVE-05a, SAVE-05b, KEY-06 |
| First release: concurrent updates safe at the server | SYNC-05, SYNC-06, SYNC-10 |
| First release: isolate damaged records | KEY-15 |
| Privacy 1: correct the practice-space promise | ONB-01 |
| Privacy 2: protect incoming capture | KEY-13a, KEY-13b |
| Privacy 3: encrypt semantic metadata | KEY-05 |
| Privacy 4: usable recovery and key rotation; issue #170 (D1 salt, D19 rotation) | KEY-01, KEY-02, KEY-03, KEY-04, KEY-14, KEY-16, OPS-06 |
| Privacy 5: browser key persistence and outbound data | KEY-10, KEY-12 |
| Privacy 6: independent security review | KEY-11 |
| Next release: outline, find/replace, counts, folding, tables, footnotes | ED-19, ED-07, ED-06, ED-20, ED-18, ED-21 |
| Next release: preserve selection, undo, IME, paste, keyboard | QA-06 |
| Next release: PDF/print, Markdown, DOCX | PORT-08a, PORT-01/05, PORT-08b |
| Next release: one document-command model | ED-09 |
| Next release: versioned structured document format, no editor replacement | ED-22 |
| Capture: one action to a draft, private new-note URL, shortcuts, append capture, clipper | NAV-07, NAV-01, NAV-05, NAV-06, NAV-08 |
| Retrieval: switcher, ranked search, filters, snippets, keyboard, saved searches | NAV-03, SRCH-03, SRCH-02, SRCH-01, NAV-04, LIB-08 |
| Connections: note URLs, links/backlinks, lightweight collections | NAV-01, LIB-05, LIB-09 |
| Scale: cache text, worker index, encrypted-at-rest index, virtualize results | SRCH-01, SRCH-03, SRCH-04, LIB-12 and SRCH-06 |
| Attachments: images and PDFs, OCR, encrypted lifecycle | ED-17, ATT-01, ATT-02, ATT-03, ATT-04 |
| Migration: previewed imports, counts, real parser, per-note export | PORT-06a/b, PORT-07, PORT-05, PORT-03 |
| Design critique P1 privacy and storage language | ONB-01, SAVE-03 |
| Design critique P1 actionable failure status | SAVE-01 |
| Design critique P2 responsive command consistency | ED-09 |
| Design critique P2 preserve readable words | LIB-10 |
| Design critique P2 capture and browser navigation | NAV-07, NAV-01 |
| Personas, cognitive load, accessibility | DES-08, DES-09, MOB-07, DES-05 |
| Quality gates: browsers and devices | QA-04, MOB-08 |
| Quality gates: fixture and journey list | QA-01, QA-02a, QA-02b |
| Quality gates: stale E2E expectations | SHR-04 |
| Quality gates: recommended targets | QA-03 |
| Sustainable: extract responsibilities | PERF-04 |
| Sustainable: input path and dynamic imports; preserve offline assets | PERF-03, PERF-02 |
| Sustainable: migration ordering and drift | PERF-07a, PERF-07b |
| Sustainable: willingness to pay and cost model | OPS-02 |
| Sequence table and defer list | this document's phases; OPS-04 |
| Validation cohort of 8 to 12 writers | OPS-01 |
| Heuristic score 25/40 | informational; its P1 and P2 items are mapped above |

## Appendix C: Codex plan review (2026-09-07) and what changed in 1.2

| # | Codex point | Verified against code | Change in this revision |
|---|-------------|-----------------------|-------------------------|
| 1 | The interim capture fix was a no-op: the URL is already scrubbed at init (`src/hooks/useShareTarget.ts:98`); the exposure is the initial GET request itself | Yes | KEY-13a now removes the GET `share_target` in Phase 0; KEY-13b (service-worker-intercepted POST with locked-vault handling and a no-plaintext-on-the-wire test) moves from Phase 2 to Phase 1 and no longer waits for the iOS share extension |
| 2 | A bare conditional update cannot distinguish a stale write from a missing row, and the zero-row path re-creates the note (`src/services/syncEngine.ts:634`); reinsertion resurrects remote deletes (`:380`); SYNC-13 purged before SYNC-10 settled the policy | Yes | SYNC-05 is now an RPC contract with four outcomes, mutation ids, and replay semantics, with S0-3 to S0-5 tests; SYNC-10 moved to Phase 1 and made a prerequisite of SYNC-13; a "Deletion policy" chain added to the spine |
| 3 | KEY-02 "completes offline in seconds" was unsafe shorthand; both keys must be wrapped (`src/lib/encryption.ts:37`); passphrase change, device invalidation, and compromise rotation are different things | Yes | KEY-04 is now a written prerequisite of KEY-01 with the test list; KEY-02 requires server confirmation before invalidating the old wrap and defines concurrent-change behaviour; KEY-16 added for compromise rotation by re-encryption; interrupted-migration and old-device tests attached in Phase 1 |
| 4 | "No known way to lose words" overstated Phase 0; fault-injection and migration checks arrived later | Yes | Phase 0 exit rewritten as zero lost acknowledged edits across the named S0 set with tests shipped in the same PRs; PERF-07a (schema guard plus release check against the deployment target) added to Phase 0 before the first database change; sequencing rules 6 and 7 added |
| 5 | Calendar estimates contradicted item sizes at one engineer | Yes | Calendar labels withdrawn; "Sizing and forecasting" section added with engineer-week totals per phase; Phase 1 split into Committed core and Proposed stretch; forecasting from measured throughput after Phase 0 |
| 6 | ID coverage is not acceptance coverage; Phase 3 had no "done when"; "Green", "Design reviewed", "Dashboard in CI" named activities not behaviour; SYNC-09 as written could cancel an intended delete (`src/components/NoteCard.tsx:50`); SHR-04 also had to fix the anonymous-view test dropping the `#k=` fragment (`e2e/sharing.spec.ts:131`) | Yes | Every row now has behaviour plus evidence; Phase 3 has a gate column and a "done when" column; SYNC-09 rewritten as exactly-once with failure recovery and deliberate Undo; SHR-04 rewritten to replace obsolete expectations including the fragment |
| 7 | Browser readiness should gate iOS; the Android wrapper does not establish iOS readiness; exploratory items need explicit gates; urgent trust fixes should cross phases | Accepted | MOB-04 split into a one-week spike (MOB-04a, Phase 1) and the shell (MOB-04b, gated on Phase 1 exit, a QA-04 device pass, and a spike "go"); a "Browser before native" chain added; every Phase 3 row carries a demand or measurement gate; the operating model allows trust fixes across phases |
| A | A Worker gives execution isolation, not protected persistent storage | Accepted | KEY-10 rewritten to say exactly that and to point persistent protection at KEY-07 and KEY-08 |
| B | "JSON behind the same sanitizer" is insufficient; the sanitizer takes HTML strings (`src/utils/sanitize.ts:57`) | Yes | ED-22 rewritten: JSON is canonical with a `docVersion`, validated against the editor schema, HTML derived for display and export, older clients open newer documents read-only |
| C | Generate issues incrementally for ready work | Declined by the repository owner | The ledger and Board remain the tracker (OPS-03) |
