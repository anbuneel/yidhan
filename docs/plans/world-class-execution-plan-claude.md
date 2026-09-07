# Yidhan World-Class Execution Plan — The Master Ledger

**Version:** 1.0
**Last Updated:** 2026-09-07
**Status:** Living Document
**Author:** Claude (Claude Code)

---

## Original Prompt

> Is everything from your original analysis covered: world-class-improvements-claude.md? How do we now make the proposal an actionable plan that's sequenced right and doesn't miss any of yours and codex's findings?

---

## What this document is

One numbered ledger that every finding from both reviews maps into, sequenced by dependency, grouped into work packages that ship on their own. If an item is not in this ledger, it is not in the plan. Two coverage appendices at the end map every section of the Claude review and every section of the Codex review to ledger IDs, so completeness can be checked line by line.

Inputs:
- Claude review: `docs/analysis/world-class-improvements-claude.md` (sections 4.1 to 4.12, section 6 decisions, section 7 measures, Appendix A 25 defects, Appendices B and C designs).
- Codex review: `.impeccable/critique/2026-09-06T20-15-28Z__src-app-tsx.md` on `main` (commit `613da6d`).
- Cross-check: `docs/analysis/improvement-review-crosscheck-claude.md`.

Every item has: an ID, a one-line description, a source (**C** Claude, **X** Codex, **CX** both, with the section), a size (**S** under a week, **M** one to three weeks, **L** three to six weeks), and a "done when" clause that can become an issue's acceptance criterion.

ID prefixes: ED editor · SAVE save and revisions · NAV navigation and capture · LIB library and organization · SRCH search · SYNC sync and correctness · KEY privacy and keys · PORT import and export · ATT attachments · SHR sharing · MOB mobile and iOS · PERF performance and code health · DES design polish · ONB onboarding and copy · QA quality gates · OPS process and research.

---

## Board

Status lives here and nowhere else. Move an ID between lists in the same PR that changes its state. A PR title carries the IDs it closes, for example `fix(ED-01, ED-02): title Enter and slash-menu Escape`.

**Now**

- (nothing started)

**Next** (Phase 0, in PR order; see "Phase 0 as twelve pull requests")

- PR 1 · ED-01, ED-02, ED-16
- PR 2 · ED-03
- PR 3 · SAVE-01, SAVE-02, SAVE-03
- PR 4 · SYNC-01
- PR 5 · SYNC-02
- PR 6 · SYNC-03, SYNC-05
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

Nine chains decide the order. Everything else can float within its phase.

| Chain | Order | Why |
|-------|-------|-----|
| Routes | NAV-01 → NAV-03, NAV-05, LIB-05, KEY-13, MOB-05, SHR-03 | A note needs an address before it can be linked, switched to, captured into, or targeted by a widget |
| Keys | KEY-01 → KEY-02, KEY-03, KEY-07, KEY-08, ONB-02 | Passphrase change, recovery, passkeys, and biometrics all need a wrapped key |
| Save and revisions | SAVE-01/02 → SAVE-04 + SYNC-05 → SAVE-05 → SYNC-11 | Honest failures first, then a revision id the server can check, then history, then deltas |
| Document format | ED-22 + ATT-01 → ED-17 → ATT-03 → ATT-04, PORT-06 (Evernote) | Images need a place to live in the document and in storage; PDFs and OCR follow images |
| Search | SRCH-01 → SRCH-02, SRCH-03 → SRCH-06, LIB-12 → SRCH-04 | Cache first, then semantics and ranking, then render at scale, then persist only if needed |
| Library | LIB-01 → LIB-03 → LIB-12 | List view before bulk actions before virtualization |
| iOS | MOB-04 → KEY-08 → MOB-05 | The shell, then biometric unlock, then widgets and the share extension |
| Structure | PERF-04 runs alongside NAV-01 | Routing extraction is the first slice of the `App.tsx` split |
| Quality | QA-01 → QA-02 → QA-03 | A fixture that can sign in and unlock, then the journeys, then the numeric targets |

Rules used for sequencing:
1. A bug a writer meets in the first five minutes outranks a feature.
2. A finding that risks losing words outranks everything else in its phase.
3. Nothing that needs a Mac blocks anything that does not.
4. Copy fixes ship the week they are found.
5. Each phase ends with a shippable release; no phase depends on the next.

---

## Phase 0: Trust the notebook, fix the snags (2 to 3 weeks)

Goal: a writer never loses words, never gets misled about what is saved or encrypted, and the five-minute snags are gone.

### WP0.1 Keystrokes and honest saving

| ID | Item | Source | Size | Done when |
|----|------|--------|------|-----------|
| ED-01 | `Enter` in the title moves focus to the body at position 0 | C 4.1, defect 1 | S | Typing a title and pressing Enter puts the caret in the body |
| ED-02 | `Escape` handler returns early on `defaultPrevented` or any open popover; slash menu calls `preventDefault` | C 4.1, defect 2 | S | Escape on the slash menu closes only the menu |
| ED-03 | Link extension: `openOnClick: false`, link popover (insert, edit, remove), entries in toolbar, sidebar, slash menu; `Cmd+K` with a selection inserts a link | C 4.1, defect 4 | S | A link can be added and removed with the mouse; clicking one does not leave the app |
| ED-16 | Remove the duplicate `Underline` registration | C defect 19 | S | No Tiptap duplicate-name warning |
| SAVE-01 | Every exit path (Escape, logo, footer, back, search) checks the save result; a failed save keeps the draft, shows a persistent "Not saved" state with Retry and Copy, visible in focus mode | X first release | S | A forced save failure leaves the note open with the state on screen until resolved |
| SAVE-02 | Maximum save interval of 10 s during continuous typing; encrypted local checkpoint | X first release | S | Typing for 30 s without pause produces at least two local writes |
| SAVE-03 | Save indicator distinguishes "Saved on this device" from "Synced"; never implies another device has text before the server confirms | X first release, X design P1 | S | Offline typing shows "Saved here", never "Synced" |

### WP0.2 Sync correctness

| ID | Item | Source | Size | Done when |
|----|------|--------|------|-----------|
| SYNC-01 | Conflict modal decrypts both sides: title, excerpt, word count, device and time, paragraph-level diff | C 4.5, defect 5; X "preserve both revisions" | S | Both cards show readable text |
| SYNC-02 | `note_tags` pulled incrementally and subscribed in realtime; regression test across two clients | C 4.5, defect 6 | S | A tag added on device A appears on device B without re-login |
| SYNC-03 | Replace the `Math.max(...spread)` cursor computation | C defect 7 | S | Cursor computed by reduce; test at 100k rows |
| SYNC-05 | Server-side write precondition: update `where content_hash = expected` (or `updated_at`), idempotent mutation id; stale writes rejected and surfaced as conflicts | X first release | S | Two clients writing the same note cannot silently overwrite each other |
| SRCH-01 | Memoize plaintext per note keyed on `contentHash`; memoize the card snippet | C 4.4, X scale | S | No `DOMParser` work on keystroke after first query |
| SRCH-05 | Delete `searchNotesOffline`, `searchDecryptedNotes`, and the stale "focused-gaze" comment | C 4.4 | S | Dead code gone |

### WP0.3 Honest words and first impressions

| ID | Item | Source | Size | Done when |
|----|------|--------|------|-----------|
| ONB-01 | Practice Space starter note and landing seal say plainly that drafts are not encrypted until signed up | X privacy 1, X design P1 | S | No screen claims encryption for localStorage content |
| KEY-13a | Share target: strip title and text from the address bar immediately on arrival; do not stage plaintext in localStorage while the vault is locked longer than needed | X privacy 2 | S | Query string removed before first paint; interim only, see KEY-13b |
| MOB-01 | Replace the "Quick gesture" modal with a one-line caption under the first card | C 4.9 | S | No modal on first mobile visit |
| OPS-05 | Update `docs/roadmap.md` "Not Building": tables → databases only; backlinks → graph only; recovery → recovery key planned | C §6 | S | Doc changed |
| OPS-06 | Raise issue #170 to P1 and link it to KEY-01 to KEY-04 | cross-check | S | Issue updated |

### WP0.4 Portability fixes

| ID | Item | Source | Size | Done when |
|----|------|--------|------|-----------|
| PORT-01 | Lossless Markdown round-trip: highlight, underline, `h4` to `h6`, alignment; property test over every editor construct | C 4.7, defect 9 | S | Round-trip test passes |
| PORT-02 | Import accepts the v2 full-account backup; share rows labelled from decrypted titles | C 4.7, defects 8 and 10 | S | Offboarding export re-imports cleanly |
| SHR-04 | Delete the stale "never expires" share E2E test | X quality gates | S | Suite reflects the 30-day cap |
| PERF-05 | Delete the dead plaintext write paths and unused helpers | C 4.10, defect 22 | S | No caller can violate the E2EE CHECK constraint |

### WP0.5 Foundations started

| ID | Item | Source | Size | Done when |
|----|------|--------|------|-----------|
| NAV-01 | Note URLs: `/n/<id>`, `/faded`, `/`; history push and pop; scroll restore; routing extracted to `src/routing/` | C 4.2; X connections | M | Browser Back from a note returns to the library; refresh reopens the note |
| NAV-02 | Faded view routeable; editor with a missing note redirects instead of `return null` | C defects 13 and 14 | S | Part of NAV-01 |
| QA-01 | Authenticated E2E fixture (test account, vault unlock) and the full Playwright suite in CI | C 4.10; X quality gates | S | `npm run e2e` runs green in CI |
| OPS-03 | Work off the ledger: no issue tracker duplication; PR titles carry the IDs they close; the Board section is the only status record | this doc | S | Done: convention adopted |

Exit criteria: no known way to lose words; both sync bugs fixed; every screen tells the truth about encryption; Back works.

---

## Phase 1: Table stakes (6 to 8 weeks)

Goal: recovery, addresses, list view, smart search, a fast front page, and the writing fluency every rival has.

### WP1.1 Keys and recovery

| ID | Item | Source | Size | Done when |
|----|------|--------|------|-----------|
| KEY-01 | Wrapped master key: keep note key `K`; derive KEK from passphrase with a fresh salt; store `wrap(KEK, K)`; version flag; migrate on next unlock | C 4.6, App B; X privacy 4; #170 | M | Existing users migrate without re-encrypting a note |
| KEY-02 | Passphrase change by re-wrapping `K`; invalidate remembered blobs elsewhere via key-check version | CX | S | Change completes offline in seconds |
| KEY-03 | Recovery kit: random 256-bit key, `wrap(RK, K)`, shown once as grouped base32 with print and copy, confirmation required; unlock via recovery key then set a new passphrase | CX | M | A user who forgets the passphrase gets their notes back |
| KEY-04 | Versioned migration plan: old offline devices, restored backups, compromise rotation, remembered devices | X privacy 4 | S | Written and reviewed before KEY-01 ships |
| KEY-06 | Encrypted backup export (`.yidhan`: v2 JSON under a backup key) and import; restore test in CI | C 4.6, 4.7; X first release | S | A backup restores into a fresh browser profile in CI |
| KEY-09 | Threat-model page at `/security` in the product voice; `security.txt`; states visible metadata (timestamps, sizes, tag names until KEY-05) | C 4.6; X "define the promise" | S | Page live |
| KEY-12 | Outbound data audit: Sentry allowlisted fields, URLs, demo and capture paths, error strings | X privacy 5 | S | Audit doc and fixes merged |
| KEY-15 | One undecryptable note renders as a locked card with retry; library stays usable; exports report incomplete | C 4.10; X first release | S | Corrupting one payload does not blank the library |
| ONB-02 | Passphrase setup rewritten as three steps: passphrase, recovery key, done | C 4.12 | S | Depends on KEY-03 |

### WP1.2 Navigation and capture

| ID | Item | Source | Size | Done when |
|----|------|--------|------|-----------|
| NAV-03 | Quick switcher and command palette: `Cmd+K` focuses it in the library, `Cmd+P` opens it anywhere, `>` lists actions, arrow keys and Enter | C 4.2; X retrieval | M | Any note reachable in three keystrokes |
| NAV-04 | Keyboard navigation over cards: arrows or j/k, Enter, p, t, Delete with undo | C 4.2; X keyboard selection | S | Library usable without a mouse |
| NAV-05 | Quick capture: PWA `shortcuts` "New note" to `/n/new`; share target lands in the new note's editor; `Cmd+N` inside the editor | C 4.2; X capture | S | Three capture paths work on Android and desktop |
| NAV-07 | "Start writing" reaches an editable draft in one action on desktop and mobile; mobile landing CTA opens a new Practice Space note | C 4.12; X design P2 | S | One tap, caret blinking |
| ONB-05 | Practice Space to account in one step is the primary demo CTA; resolves the "no account needed" tension | C 4.12; launch review #13 | S | First note carried into the account |

### WP1.3 Library and search

| ID | Item | Source | Size | Done when |
|----|------|--------|------|-----------|
| LIB-01 | List view: one line per note, toggle in header, remembered per device | C 4.3 | M | Toggle works; cards remain default |
| LIB-02 | Sort and chapter basis: last edited or created; within chapter by edited, created, title | C 4.3 | S | Editing an old note can stay in its chapter |
| LIB-10 | Card preview mask only when text overflows; cap age fade at 0.9 | X design P2 | S | Short previews fully legible |
| SRCH-02 | Query semantics: multi-term AND, quoted phrases, `tag:`, `is:pinned`, `before:`, `after:`; all matches highlighted | C 4.4; X retrieval | S | Operators documented in the `?` modal |
| SRCH-03 | In-memory index (MiniSearch or FlexSearch) with ranking and fuzziness, incremental rebuild; move to a worker if the main thread shows it | C 4.4; X scale | S | Title matches rank first; p95 under 200 ms at 10k notes (QA-03) |

### WP1.4 Editor fluency

| ID | Item | Source | Size | Done when |
|----|------|--------|------|-----------|
| ED-04 | Markdown paste through `handlePaste` and `markdownToHtml` | C 4.1 | S | `## Heading` pastes as a heading |
| ED-05 | Typography extension: smart quotes, dashes, ellipsis | C 4.1 | S | Enabled with a setting to disable |
| ED-06 | Word and character count, reading time, hover-revealed in the title-zone metadata | C 4.1; X counts | S | Visible on hover on desktop, tap on mobile |
| ED-07 | Find and replace in note: `Cmd+F`, next and previous, decoration highlights | C 4.1, 4.4; X find/replace | S | Works in focus mode |
| ED-08 | Toolbar and sidebar subscribe to editor transactions so active states stay fresh | C 4.1 | S | Arrow into bold text lights the button |
| ED-09 | One command model: same capability set in sidebar, inline toolbar, mobile bar, slash menu, shortcuts, with overflow by width; fixes the hidden inline toolbar at 1100 px and wider; add text-align UI or drop the extension; inline code button | X design P2; C 4.1 | M | Every command reachable by mouse at every width |
| SAVE-04 | Revision id on every save; UI acknowledges a specific revision; server precondition uses it | X first release | S | Depends on SYNC-05 |
| SAVE-05a | Bounded local encrypted revision history per note (last 20 snapshots or 7 days), preview, restore, save-as-copy; snapshot before conflict resolution | X first release | M | A replaced paragraph can be recovered |

### WP1.5 Speed and structure

| ID | Item | Source | Size | Done when |
|----|------|--------|------|-----------|
| PERF-01 | Prerender `/`, `/privacy`, `/terms`, `/support`, `/changelog`, `/roadmap`; hydrate only theme toggle and CTA | C 4.10 | M | Landing JavaScript under 50 KB gzip |
| PERF-02 | Defer Supabase to first auth, `hash-wasm` to `deriveKey`, Sentry replay via `lazyLoadIntegration`; split the demo page; fix the React chunk; resolve the five static-plus-dynamic import warnings; keep offline assets and font licences | C 4.10; X sustainable | S | `main` under 300 KB; zero import warnings |
| PERF-03 | Input-path work: stop lifting `getHTML()` into `Editor` state on every keystroke; stop re-attaching visibility listeners per character; measure KDF and library decryption | X sustainable; C 4.1 audit | M | Typing p95 under 100 ms on the long-note fixture (QA-03) |
| PERF-04 | Decompose `App.tsx` and `Editor.tsx`: routing, `useNotesSync`, `useImport`, `useDemoMigration`, `useShareTarget`, `PublicPage`; clear interfaces for persistence, note lifecycle, search, attachments, vault | C 4.10; X sustainable | M | `App.tsx` under 600 lines; ongoing per touch |
| DES-01 | Manuscript grows with content; minimum height about 60 vh | C 4.11 | S | Short notes read as a page |
| DES-02 | Title capped at two lines with a smaller size past 60 characters; mirrors body H1 metrics | C 4.11 | S | Long titles no longer wrap to three display lines |
| DES-06 | Edge states designed: locked note, offline editor, failed sync, expired letter, on-this-device-only | C 4.11; X status visibility | S | Each state has a screen |
| DES-07 | Playwright axe pass in CI; reduced motion and contrast checks per theme | C 4.11 | S | CI fails on new violations |
| DES-08 | Screen-reader verification: editor labelling, status announcements, focus order, modal behaviour | X personas | S | Checklist passed with VoiceOver and NVDA |

### WP1.6 Sync hardening

| ID | Item | Source | Size | Done when |
|----|------|--------|------|-----------|
| SYNC-04 | Tombstones for notes and tags written by trigger and pulled by cursor; end the two full-table sweeps | C 4.5; launch review | M | Sync makes no `select id` sweep |
| SYNC-06 | Cross-tab queue ownership with the Web Locks API or a recoverable lease | X first release | S | Two tabs never sync concurrently |
| SYNC-07 | `isRetryableError` classifies by error code and type, not substrings; `delete` no longer string-matches "0 rows" | C defect 21 | S | Unit tests on classification |
| SYNC-08 | `fadedNotesCount` derived from data, not incremented optimistically | C defect 16 | S | Count matches the faded list |
| SYNC-09 | `NoteCard` cleanup no longer deletes on unmount mid-animation; `ChapteredLibrary` consumes the delete result | C defects 15 and 17 | S | Typing in search during a delete animation cannot delete |
| SYNC-13 | Server-side `pg_cron` purge for faded notes instead of client-load purge | C defect 25 | S | Cron enabled and verified |

### WP1.7 Portability

| ID | Item | Source | Size | Done when |
|----|------|--------|------|-----------|
| PORT-03 | Per-note Markdown export in a real zip with front matter | C 4.7; X migration | S | Obsidian opens the folder |
| PORT-04 | Timestamps, tag colours, and pinned state preserved on every import path | C 4.7 | S | Round-trip test |
| PORT-05 | Real Markdown parser and serializer with fixtures, replacing the regex chain | X migration | M | Fixture suite passes |

### WP1.8 Quality gates and mobile fit

| ID | Item | Source | Size | Done when |
|----|------|--------|------|-----------|
| QA-02a | Journeys, first half: continuous typing, interrupt, reload, recover; two tabs with one offline; network flaps, expired auth, rejected writes, quota pressure, denied persistence, blocked mutations | X quality gates | M | Green in CI |
| QA-03 | Acceptance targets measured in CI on a defined device and dataset: warm launch to editable p95 under 1 s; typing p95 under 100 ms; search p95 under 200 ms at 10k notes; cross-device visibility p95 under 5 s; zero lost acknowledged edits; backup restores in a fresh profile | X quality gates; C §7 | M | Dashboard in CI |
| QA-04 | Cross-browser matrix: Chrome, Edge, Firefox, Safari; real iPhone, iPad, Android; installed PWA | X quality gates | S | Matrix documented and run per release |
| QA-06 | Editor fixture tests: selection preserved, native undo, IME composition, paste fidelity, mobile keyboard | X next release | S | Green |
| MOB-02 | Time ribbon gets its own room: bottom padding, hidden near the footer, hidden under 20 notes | C 4.9 | S | No overlap on a 390 px viewport |
| MOB-03 | Remove the doubled title in the mobile editor; `h-screen` to `100dvh` | C 4.9 | S | iOS Safari bars no longer clip the toolbar |
| MOB-08 | Real-device testing checklist per release (keyboards, installed PWA, gestures) | X; C mobile docs | S | Checklist in repo |
| ONB-03 | Custom SMTP for auth email; magic-link sign-in | C 4.12; backlog P1 | M | OTP emails reliable in production |
| OPS-01 | Validation cohort: 8 to 12 target writers for several weeks with their own material and consent for content-free diagnostics; observe capture-to-save, finding an old note, long writing, interruptions, migration, restoration | X sequence | ongoing | Findings feed Phase 2 scope |

Exit criteria: recovery kit live; every note has an address; list view and operators shipped; landing under 50 KB; the cohort is writing.

---

## Phase 2: Depth (8 to 12 weeks)

Goal: pictures, importers, connections between notes, encrypted tags, and the iPhone app.

### WP2.1 Attachments

| ID | Item | Source | Size | Done when |
|----|------|--------|------|-----------|
| ED-22 | Versioned document format: ProseMirror JSON stored alongside HTML behind the same sanitizer; HTML export kept | X next release | M | New nodes round-trip without HTML hacks |
| ATT-01 | Attachment model: per-attachment key inside the note payload; Supabase Storage under `attachments/<userId>/<id>` with path RLS; Dexie blob table; sanitizer allows `img[data-attachment-id]` only | C App C; X attachments | M | Design reviewed |
| ATT-02 | Encrypted originals, filenames, thumbnails, and manifests; resumable upload; offline availability; quota handling; orphan cleanup; included in export | X attachments | M | Attachment lifecycle tests green |
| ED-17 | Images in the editor: paste, drop, slash command; 5 MB cap, 2048 px downscale, WebP; blob URLs at render | C 4.1; CX | L | A photo pasted offline syncs and renders on another device |
| ATT-05 | Letters carry attachments; Markdown zip includes an `attachments/` folder; encrypted backup includes them | C App C | S | Export and share tests |

### WP2.2 Importers and output

| ID | Item | Source | Size | Done when |
|----|------|--------|------|-----------|
| PORT-06a | Importers: Markdown folders and zips, Bear and TextBundle, Notion export, Apple Notes export workflows, Obsidian folders with `[[links]]` mapped to LIB-05 | C 4.7; X migration | M | Each importer is a pure function with fixtures |
| PORT-07 | Import preview before, counts and reconciliation after, unsupported formatting explained | X migration | S | Preview screen |
| PORT-08a | Print stylesheet and readable PDF via print | X next release | S | A note prints cleanly |

### WP2.3 Connections and organization

| ID | Item | Source | Size | Done when |
|----|------|--------|------|-----------|
| LIB-05 | Note links: `[[` opens the switcher and inserts `/n/<id>`; titles resolve client-side; "Mentioned in" list at the bottom | C 4.3; X connections | M | Rename updates link text |
| LIB-04 | Tag quality of life: search in selector, rename preserves assignments, Tags page with counts, `#tag` autocomplete in the editor | C 4.3 | S | Autocomplete assigns the tag |
| LIB-06 | Templates (notes tagged `template`) and a "Today" daily page in the palette | C 4.3 | S | Today opens or creates today's note |
| LIB-08 | Saved searches in the palette | X retrieval | S | A saved search reopens with its operators |
| NAV-06 | Append-to-existing-note capture (append to today's page from the share target) | X capture | S | Shared text lands in today's page |
| ED-19 | Heading outline for long notes, hover-revealed on desktop | X next release | M | Outline follows scroll |
| LIB-03 | Multi-select and bulk actions in list view only: tag, pin, fade, export | C 4.3 | M | Shift-click ranges |
| LIB-12 | Virtualize the list view once measured at 2,000 notes | C 4.10; X scale | M | 10k-note fixture scrolls at 60 fps |
| SRCH-06 | Search results honour progressive rendering and virtualization instead of rendering every match at once | X scale | S | 10k matching notes render in under 200 ms |

### WP2.4 Privacy depth

| ID | Item | Source | Size | Done when |
|----|------|--------|------|-----------|
| KEY-05 | Encrypt tag names (and future collection and attachment names) with AAD `tagId:userId`; append-only migration | C 4.6; X privacy 3 | M | Server holds no plaintext tag names |
| KEY-10 | Reduce key exposure at rest: key in a Worker or keystore; honest "Remember this browser" copy about device and XSS exposure | C 4.6; X privacy 5 | M | Raw key bytes no longer in `localStorage` |
| KEY-13b | Share target redesign: POST target intercepted by the service worker with locked-vault, failure, and fallback paths; shipped with the iOS share extension design | X privacy 2 | M | No private text in any URL |
| KEY-11 | Independent security review covering encryption, migrations, auth, deletion, sharing, recovery, and delivery chain; before broad public assurances | X privacy 6 | L (external) | Report received, findings triaged |

### WP2.5 iOS

| ID | Item | Source | Size | Done when |
|----|------|--------|------|-----------|
| MOB-04 | iOS Capacitor project: haptics, status bar, keyboard, share sheet, secure storage; WKWebView keyboard validated in week one; App Store privacy labels; TestFlight | C 4.9; X release 4 | M | TestFlight build in hand |
| KEY-08 | Biometric unlock on native: remembered blob held in the secure keystore behind Face ID or fingerprint | C 4.6; X "protected device key storage" | M | Depends on KEY-01 and MOB-04 |
| MOB-07 | Touch targets under 44 px on narrow layouts fixed; metadata and navigation legibility on phones | X minor observations | S | Audit passes |

### WP2.6 Polish and housekeeping

| ID | Item | Source | Size | Done when |
|----|------|--------|------|-----------|
| DES-03 | Card-to-manuscript view transition and its reverse, progressive enhancement | C 4.11 | M | Works in Chrome and Safari; instant elsewhere |
| DES-04 | Reading settings: text size (three steps), line length, body typeface; expose Washi and Mori | C 4.11 | S | Settings persist per device |
| DES-05 | In-product hints: one per first three notes; empty search suggests an operator; no tour | C 4.11; X help heuristic | S | Hints dismiss forever |
| LIB-11 | Pinned chapter as a compact row when it holds fewer than three notes | C 4.11 | S | No lone card in a wide band |
| ED-10 | `spellcheck` and `lang` on the editor; remove the dead `prose-editor` class | C 4.1 | S | Browser spellcheck works |
| ED-11 | Code block language and highlighting via lowlight | C 4.1 | S | Language picker in the block |
| ED-12 | Undo history isolated per note (`setContent` with history cleared, `emitUpdate: false`) | C defect 18 | S | Undo cannot cross notes |
| ED-13 | Untouched new note fades silently on leave | C 4.2 | S | No blank notes accumulate |
| ED-14 | Slash menu flips and clamps to the viewport and follows scroll; renderer lifecycle bug on Escape fixed | C defect 20 | S | Menu never opens off-screen |
| ED-23 | Overflow menu: touch and scroll close, `menuitem` roles, arrow keys | C 4.9 | S | Axe clean |
| SAVE-05b | Revision history synced so recovery survives a lost device; retention and deletion defined | X first release | M | Revisions restore on a new device |
| SAVE-06 | Remove `savePhaseTimeoutRef` dead code; stop listener churn in the visibility effect | C 4.1 audit | S | Lint clean |
| SYNC-10 | Policy for permanently failing creates and for reinsert-on-remote-delete; blocked-create expiry | C 4.5 | S | Documented and tested |
| PERF-06 | Fix set-state-during-render (`ChapterSection`, `TimeRibbon`); retire react-doctor suppressions progressively | C defect 24 | S | Suppressions under 5 |
| PERF-07 | Migration ordering and drift verification automated in CI against a staging database | X sustainable | M | CI fails when app is ahead of schema |
| SHR-01 | Optional passphrase on a letter (second wrap of the share key) | C 4.8 | S | Link alone is not enough |
| SHR-02 | "Refresh this letter" re-encrypts under the existing token; opt-in live letters | C 4.8; roadmap | S | Link stays valid after refresh |
| DES-09 | Task tests for long titles, dense tags, RTL, Tamil and CJK input, zoom, real virtual keyboards | X personas | S | Fixtures added |
| QA-02b | Journeys, second half: PWA upgrade with dirty work and lazy chunks; import, export, restore with nested formatting, Unicode, attachments, links; lock, sign out, rotate, recover, older offline device; account deletion gates | X quality gates | M | Green in CI |
| OPS-02 | Test willingness to pay before promising unlimited attachments and backups; model storage, transfer, retention, support, and review costs; Bloom tier | X sustainable; monetization docs | S | Pricing decision recorded |

Exit criteria: pictures sync; five importers; note links; tags encrypted; TestFlight build; security review commissioned.

---

## Phase 3: Distinction (ongoing)

| ID | Item | Source | Size | Depends on |
|----|------|--------|------|------------|
| ED-18 | Simple tables (Tiptap Table, no formulas, no sorting) | CX; decision revisit | M | ED-22 |
| ED-20 | Heading folding | X | M | ED-19 |
| ED-21 | Footnotes | X | M | ED-22 |
| ED-15 | Replace triple-tap focus mode with a gesture that does not fight the OS | C 4.1 | S | — |
| ATT-03 | PDFs as attachments | X | M | ED-17 |
| ATT-04 | Local OCR for images and PDFs | X | L | ATT-03 |
| PORT-06b | Evernote `.enex` importer with attachments | C 4.7; X | M | ED-17 |
| PORT-08b | DOCX export | X | M | PORT-05 |
| KEY-07 | Passkey unlock on the web via WebAuthn PRF | C 4.6 | M | KEY-01 |
| KEY-14 | Move the salt out of `user_metadata` (issue #170 D1) | X via #170 | S | KEY-01 |
| MOB-05 | Home-screen widget (quick capture, today's page), share extension, Siri Shortcuts | C 4.9; X release 4 | L | NAV-01, MOB-04 |
| MOB-06 | Landscape and iPad: max line length, sidebar at the iPad breakpoint | C 4.9 | M | MOB-04 |
| LIB-07 | "Set aside" true archive action | C 4.3 | S | LIB-01 |
| LIB-09 | Lightweight named collections, only if the cohort asks after LIB-08 | X connections | M | LIB-08, OPS-01 |
| SHR-03 | Public Garden as static pre-rendered pages | C 4.8; roadmap | L | NAV-01, ED-17 |
| SRCH-04 | Persisted encrypted search index | C 4.4 | M | SRCH-03, measured need |
| SYNC-11 | Delta uploads instead of the full blob per autosave | C 4.5 | M | SAVE-05 |
| SYNC-12 | Evaluate Yjs or Automerge for note bodies | C 4.5 | L | SYNC-11 |
| NAV-08 | Browser clipper with encrypted staging | X capture | L | KEY-13b |
| OPS-07 | Keep `docs/prd.md`, `docs/roadmap.md`, and `src/data/roadmap.ts` in step with each shipped phase; mark ledger items done with their PR | this doc | S | ongoing |
| OPS-04 | Re-validate Quiet Intelligence against the privacy and writing goals; keep publishing, collaboration, databases, graph view, and cloud AI deferred until demand is observed | X sequence; C | S | OPS-01 |

---

## Operating model

- **The ledger is the tracker.** No GitHub issues are created from it. A PR's title and commit messages carry the IDs it closes. When a PR merges, the same PR moves those IDs to **Done** on the Board and, if a new item starts, to **Now**. Anyone can see the state of the plan by reading the Board.
- **Pick from the current phase only,** in the PR order given for Phase 0 and by the dependency spine after that. When a phase's exit criteria are met, write the next phase's PR order into the Board before starting it.
- **Gates.** `npm run check` on every PR, and `npm run e2e` once QA-01 lands. Axe (DES-07) on every PR from Phase 1. The QA-03 targets run nightly and block a release when they regress.
- **Docs.** Each PR adds its line to `src/data/changelog.ts`. When a phase ships, update `docs/prd.md`, `docs/roadmap.md`, and `src/data/roadmap.ts`. Ledger rows are never deleted; a finished row stays where it is and its ID appears under Done.
- **Re-planning.** The cohort (OPS-01) and the nightly targets are the only two inputs that reorder the plan. Anything new goes into the ledger with the next free ID in its area and a phase, then into the Board when it is picked.
- **What stays out.** Real-time collaboration, folders, push notifications, gamification, floating selection toolbars, analytics tracking, and cloud AI stay out, as both reviews agreed.

## Phase 0 as twelve pull requests

Each PR is one reviewable change with its own tests. Order matters only where noted; PRs 1 to 10 are independent of each other and can run in parallel.

| PR | IDs | Title | Size | Notes |
|----|-----|-------|------|-------|
| 1 | ED-01, ED-02, ED-16 | Title Enter, slash-menu Escape, duplicate Underline | S | Add an E2E for each keystroke |
| 2 | ED-03 | Link popover and `openOnClick: false` | S | `Cmd+K` with a selection inserts a link; library search keeps `Cmd+K` without a selection |
| 3 | SAVE-01, SAVE-02, SAVE-03 | Honest saving: failures block exit, 10 s cap, "saved here" versus "synced" | S | Force a failing `onUpdate` in tests |
| 4 | SYNC-01 | Conflict modal decrypts both sides and shows a paragraph diff | S | Keys are in memory; no schema change |
| 5 | SYNC-02 | `note_tags` incremental pull and realtime | S | Two-client regression test |
| 6 | SYNC-03, SYNC-05 | Cursor without spread; server rejects stale writes by `content_hash` | S | One migration for the precondition if done as an RPC |
| 7 | SRCH-01, SRCH-05 | Memoized plaintext by `contentHash`; delete dead search paths | S | Measure with the 2,000-note fixture |
| 8 | ONB-01, KEY-13a, MOB-01, OPS-05, OPS-06 | Honest words: Practice Space copy, share-target URL scrub, gesture whisper, roadmap and #170 updates | S | Copy and docs; no schema |
| 9 | PORT-01, PORT-02 | Lossless Markdown round-trip; v2 backup import | S | Property test over every editor construct |
| 10 | SHR-04, PERF-05 | Delete the stale share test and the dead plaintext layer | S | Pure removal |
| 11 | NAV-01, NAV-02 | Note URLs, history, faded route, missing-note redirect; routing extracted to `src/routing/` | M | Do after PR 1 to 10 merge to avoid conflicts in `App.tsx`; first slice of PERF-04 |
| 12 | QA-01 | Authenticated E2E fixture; full Playwright suite in CI | S | Needs the test-account secrets in the repository settings; can start any time |

Phase 0 exits when all twelve are merged and the four exit criteria hold: no known way to lose words, both sync bugs fixed, every screen honest about encryption, Back works.

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
| §4.9 recommendations 1 to 5 | MOB-01, MOB-02, MOB-04 and KEY-08, MOB-05, MOB-06 |
| §4.10 measurements and structure | PERF-01/02 (bundle), PERF-04 (App.tsx), PERF-06 (set-state-in-render), KEY-15 (eager decrypt throws) |
| §4.10 recommendations 1 to 7 | PERF-01, PERF-02, KEY-15, LIB-12, PERF-04, PERF-05 and SAVE-06, QA-01 |
| §4.11 items 1 to 8 | DES-01, LIB-11, DES-02, DES-03, DES-04, DES-05, DES-06, DES-07 |
| §4.12 items (4) | ONB-02, ONB-03, NAV-07, ONB-05 |
| §5 phases | replaced by this document's phases |
| §6 decisions to revisit | OPS-05, ED-18, LIB-05, KEY-03 |
| §7 success measures | QA-03, OPS-01 |
| Appendix A defects 1 to 25 | 1 ED-01 · 2 ED-02 · 3 ED-04 · 4 ED-03 · 5 SYNC-01 · 6 SYNC-02 · 7 SYNC-03 · 8 PORT-02 · 9 PORT-01 · 10 PORT-02 · 11 MOB-01 · 12 MOB-02 · 13 NAV-02 · 14 NAV-02 · 15 SYNC-09 · 16 SYNC-08 · 17 SYNC-09 · 18 ED-12 · 19 ED-16 · 20 ED-14 · 21 SYNC-07 · 22 PERF-05 · 23 PERF-02 · 24 PERF-06 · 25 SYNC-13 |
| Appendix B key hierarchy | KEY-01, KEY-02, KEY-03, KEY-07 |
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
| First release: concurrent updates safe at the server | SYNC-05, SYNC-06 |
| First release: isolate damaged records | KEY-15 |
| Privacy 1: correct the practice-space promise | ONB-01 |
| Privacy 2: protect incoming capture | KEY-13a, KEY-13b |
| Privacy 3: encrypt semantic metadata | KEY-05 |
| Privacy 4: usable recovery and key rotation; issue #170 (D1 salt, D19 rotation) | KEY-01, KEY-02, KEY-03, KEY-04, KEY-14, OPS-06 |
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
| Sustainable: migration ordering and drift | PERF-07 |
| Sustainable: willingness to pay and cost model | OPS-02 |
| Sequence table and defer list | this document's phases; OPS-04 |
| Validation cohort of 8 to 12 writers | OPS-01 |
| Heuristic score 25/40 | informational; its P1 and P2 items are mapped above |
