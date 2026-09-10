# Roadmap

What is deferred, and what is refused. Nothing here is approved work.

**Entries are candidates, not commitments.** Approval happens by moving an item
into the `Status: ACTIVE` plan in `docs/plans/` — not by appearing in this table.
An item can sit here indefinitely without that meaning anything is owed.

Shipped work is **not** listed here; `docs/progress.md` owns history and
`src/data/changelog.ts` is the user-facing release surface. Reasoning behind
architectural choices belongs in `DECISIONS.md`. Permanent non-goals — the things
refused on principle rather than on current fit — belong to `PRODUCT.md`.

**Update trigger:** an outcome is deferred, or refused.

## How to read it

Items carry the numbers used by the engineering ledger, so commit messages, PR
titles and issue cross-references keep resolving. A number is an identifier, not a
priority: **lower is not sooner** once an item is here.

- **Effort** is an order of magnitude — `days` (under a week), `weeks` (one to
  three), `a month or more` — not an estimate.
- **Needs** names items that must land first. An item with unmet needs cannot be
  promoted.
- **Done when** is the acceptance test the item ships with: the observable behaviour,
  then the evidence that proves it. It travels with the item into the ACTIVE plan.
- Items marked `—` came from the product roadmap and never had a ledger number.

To start work on an item, move it into the ACTIVE plan and delete it from here.

---

## Deferred work

### Keys and privacy

Items 24, 25, 26 and 103 are designed in
`docs/plans/2026-09-07-key-migration-and-rotation-design.md` (item 23). It names the
flow each key change belongs to and carries the test list each of those four items
must satisfy; the "done when" below is the summary, that document is the detail.

| # | Item | Effort | Needs | Done when |
|---|------|--------|-------|-----------|
| 24 | Wrapped master key: keep the derived key pair as `K`; derive a KEK from the passphrase with a fresh salt; store `wrap(KEK, K)` in `user_metadata` with a version flag; migrate on next unlock | weeks | Needs #23, #36 | Existing users migrate without re-encrypting a note; killing the app mid-migration and reopening completes it; the key-check still verifies `K` · unit tests for interrupted migration and for both keys surviving the wrap |
| 25 | Passphrase change by re-wrapping `K` | days | Needs #24, **#136** | The new wrap is written and confirmed by the server before the old wrap is invalidated; the key-check version bumps; every other device requires re-unlock on next use; a concurrent change from a second device fails cleanly with a re-prompt · two-device integration test; offline attempt is queued and reported as pending, never as complete |
| 26 | Recovery kit: random 256-bit key, `wrap(RK, K)`, shown once as grouped base32 with print and copy, confirmation required; unlock via recovery key then set a new passphrase | weeks | Needs #24 | A user who forgets the passphrase enters the recovery key, sees their notes, and sets a new passphrase; the old wrap is then invalidated as in #25 · E2E through the whole path |
| 47 | Private capture: POST `share_target` with `multipart/form-data` intercepted by the service worker; content stored locally in IndexedDB and encrypted immediately when the vault is unlocked; when locked, held locally in a "waiting for unlock" state and encrypted on unlock; never sent to any server unencrypted; failure and fallback paths defined | weeks | Needs #28, service-worker test harness | A share from another app creates a note without any network request carrying the text, with the vault locked or unlocked · service-worker E2E asserting the request log; locked-vault case covered |
| 101 | Encrypt tag names (and future collection and attachment names) with AAD `tagId:userId`; append-only migration | weeks | Needs #24, #36 | The server holds no plaintext tag names; filtering and autocomplete still work offline · migration test and a database assertion |
| 102 | Key exposure at rest, stated honestly: on the web the unlocked key is held in a dedicated Worker so page scripts cannot read it directly (execution isolation, which limits but does not remove XSS reach); persistent protection comes only from a platform keystore (native, #106) or a passkey-wrapped blob (#135); "Remember this browser" copy states the device and XSS exposure plainly | weeks |  | Raw key bytes are no longer readable from `localStorage` or page scope; the setting's copy passes review · unit test on the Worker boundary |
| 103 | Compromise rotation: generate a new `K`, re-encrypt every note and attachment under it with sync paused, re-wrap, then resume; distinct from the #25 passphrase change | weeks | Needs #23, #24, **#136** | After rotation no ciphertext on the server decrypts under the old key; an old device is forced to re-unlock and re-pull · integration test |
| 104 | Independent security review covering encryption, migrations, auth, deletion, sharing, recovery, and delivery chain; before broad public assurances | external review | Needs #24, #101 | Report received; every finding triaged into this ledger · report in `docs/reviews/` |
| 106 | Biometric unlock on native: remembered blob held in the secure keystore behind Face ID or fingerprint | weeks | Needs #24, #105 | The key never touches `localStorage` on native; a failed biometric falls back to the passphrase · device test |
| 135 | Passkey unlock on the web via WebAuthn PRF | weeks | Start when #24 shipped; PRF support in the cohort's browsers measured | A passkey unlocks the vault without the passphrase; the passphrase still works · E2E in Chrome and Safari |
| 136 | Move the vault object — salt included — out of `user_metadata` and into a table (issue #170 D1). **Gates #25 and #103**, which need a conditional write `supabase.auth.updateUser` cannot offer | days | Needs #24 | The JWT carries no salt; unlock still works on every device; `UPDATE … WHERE wrap_version = n` is a database guarantee rather than a convention · integration test |

### Sync

| # | Item | Effort | Needs | Done when |
|---|------|--------|-------|-----------|
| 35 | Server write contract: an RPC `update_note_checked(note_id, expected_hash, expected_updated_at, client_mutation_id, payload)` that returns one of `updated`, `stale` (with the current server row), `missing`, `forbidden`; `client_mutation_id` stored so a replay after a lost response returns the original result; `stale` raises a conflict with both versions preserved; `missing` alone may trigger the local rebuild path; `forbidden` blocks with its reason | days | Needs #36 | two clients writing the same note produce a conflict, never a silent overwrite; a replayed mutation is a no-op; a stale write is never mistaken for a missing row · integration tests for all four outcomes and for replay |
| 69 | Deletion policy, decided before anything purges: a queued update for a note hard-deleted or purged elsewhere becomes a conflict ("this note was released on another device: restore or discard"), never a silent reinsertion; a permanently failing `create` expires into a blocked state the user can export or discard | days | Needs #35 | the reinsertion path only runs for the `missing` outcome on notes with no server tombstone · integration test with a tombstoned note |
| 70 | Tombstones for notes and tags written by trigger and pulled by cursor; end the two full-table sweeps | weeks | Needs #36 | Sync makes no `select id` sweep; a note deleted on device A disappears on device B via the tombstone · integration test and query log assertion |
| 75 | Server-side `pg_cron` purge for faded notes instead of client-load purge | days | Needs #69, #70 | A purged note leaves a tombstone; a device with a queued update for it gets the #69 conflict, not a resurrection · integration test |
| 143 | Delta uploads instead of the full blob per autosave | weeks | Start when #118 shipped and #80 shows autosave payloads above 100 KB in normal use | A one-word edit to a 200 KB note uploads under 5 KB · network assertion |
| 144 | Evaluate Yjs or Automerge for note bodies | a month or more | Start when #143 shipped and conflicts exceed one per user-week in the cohort | Written evaluation with a prototype and a decision · doc |

### Saving

| # | Item | Effort | Needs | Done when |
|---|------|--------|-------|-----------|
| 58 | Revision id on every save; the UI acknowledges a specific revision; the #35 RPC carries it | days | Needs #35 | "Synced" names the revision the server confirmed · unit test on the state machine |
| 59 | Bounded local encrypted revision history per note (last 20 snapshots or 7 days), preview, restore, save-as-copy; snapshot before conflict resolution | weeks | Needs #58 | A replaced paragraph is recoverable from the history panel; restoring creates a new revision rather than rewriting history · E2E |
| 118 | Revision history synced so recovery survives a lost device; retention and deletion defined | weeks | Needs #59, #38 | A revision made on a lost device restores on a new one; deleted notes purge their revisions with #75 · integration test |
| 119 | Remove `savePhaseTimeoutRef` dead code; stop listener churn in the visibility effect | days |  | Listeners attach once per mount · unit test counting listeners |

### Editor

| # | Item | Effort | Needs | Done when |
|---|------|--------|-------|-----------|
| 31 | Structured document format: ProseMirror JSON is the canonical stored form with a `docVersion` inside the encrypted payload; a schema validator (node and mark allow-list checked with the editor schema, not DOMPurify) rejects unknown or malformed nodes on read and write; HTML is derived from JSON for cards, exports, and letters and still passes `sanitizeHtml`; older clients that meet a newer `docVersion` open the note read-only with an "update Yidhan to edit" notice | weeks | Needs #36 | A note with a new node type renders in a newer client, opens read-only in an older client, and exports to clean HTML and Markdown; a malformed JSON payload is rejected without crashing · unit tests for validator, degradation, and export |
| 34 | Images in the editor: paste, drop, slash command; 5 MB cap, 2048 px downscale, WebP; blob URLs at render | a month or more | Needs #32 | A photo pasted offline syncs and renders on another device; a 20 MB photo is downscaled below the cap · E2E |
| 97 | Heading outline for long notes, hover-revealed on desktop | weeks |  | The outline follows scroll and clicking a heading scrolls to it · E2E |
| 112 | `spellcheck` and `lang` on the editor; remove the dead `prose-editor` class | days |  | Browser spellcheck underlines a misspelling · E2E |
| 113 | Code block language and highlighting via lowlight | days | Needs #31 | Language picker in the block; highlighting survives export · unit test |
| 114 | Undo history isolated per note (`setContent` with history cleared, `emitUpdate: false`) | days |  | Undo after switching notes cannot alter the previous note · unit test |
| 115 | Untouched new note fades silently on leave | days |  | Leaving a blank new note leaves no card behind · E2E |
| 117 | Overflow menu: touch and scroll close, `menuitem` roles, arrow keys | days |  | Axe clean; arrow keys move focus · component test |
| 127 | Simple tables (Tiptap Table, no formulas, no sorting) | weeks | Start when #31 shipped and the cohort asks for tables | A three-column table round-trips through export and a letter · E2E |
| 128 | Heading folding | weeks | Start when #97 shipped and long notes over 3,000 words exceed 10 % of the cohort's notes | Folded state persists per note · E2E |
| 129 | Footnotes | weeks | Start when #31 shipped and cohort demand | Footnotes export to Markdown and print correctly · unit test |
| 130 | Replace triple-tap focus mode with a gesture that does not fight the OS | days | Start when Real-device testing (#81) records a conflict | No accidental focus-mode toggles in a 10-minute device session · device test |
| — | Typewriter mode: keep the current line vertically centred, smooth scroll while typing | weeks |  |

### Library

| # | Item | Effort | Needs | Done when |
|---|------|--------|-------|-----------|
| 30 | List view: one line per note, toggle in header, remembered per device | weeks | Start when the cohort (#87) asks for one | Toggle works; cards remain the default; 2,000 notes render without jank · E2E and the #80 fixture |
| 92 | Note links: `[[` opens the switcher and inserts `/n/<id>`; titles resolve client-side; "Mentioned in" list at the bottom | weeks | Needs #28, #42, #31 | Renaming a note updates every link's text; the linked note lists the mention · E2E |
| 93 | Tag quality of life: search in selector, rename preserves assignments, Tags page with counts, `#tag` autocomplete in the editor | days |  | Typing `#jour` and Enter assigns "journal" without leaving the editor · E2E |
| — | Keyboard tag assignment from a selected library card | days | Needs item 93's note tag picker | `t` opens the existing per-note picker without adding a second card control · E2E |
| 94 | Templates (notes tagged `template`) and a "Today" daily page in the palette | days | Needs #42 | "Today" opens today's note or creates it once · E2E |
| 95 | Saved searches in the palette | days | Needs #42, #50 | A saved search reopens with its operators and result set · E2E |
| 98 | Multi-select and bulk actions in list view only: tag, pin, fade, export | weeks | Needs #30 | Shift-click ranges; bulk fade is undoable in one step · E2E |
| 99 | Virtualize the list view once measured at 2,000 notes | weeks | Needs #30 | 10k-note fixture scrolls at 60 fps with search open · #80 fixture |
| 111 | Pinned chapter as a compact row when it holds fewer than three notes | days |  | No lone card in a wide band at 1440 px · visual regression |
| 139 | "Set aside" true archive action | days | Start when #30 shipped and the cohort asks for an archive | Set-aside notes leave the chapters and return on request · E2E |
| 140 | Lightweight named collections | weeks | Start when #95 shipped and the cohort still asks for collections | A collection is a saved query with a name, not a container; deleting it deletes no notes · E2E |

### Search

| # | Item | Effort | Needs | Done when |
|---|------|--------|-------|-----------|
| 100 | Search results honour progressive rendering and virtualization instead of rendering every match at once | days | Needs #99 | 10k matching notes render in under 200 ms · #80 fixture |
| 142 | Persisted encrypted search index | weeks | Start when #80 shows load-time indexing above 500 ms at the cohort's library size | Cold start with 10k notes reaches a searchable state under 1 s · #80 |

### Navigation

| # | Item | Effort | Needs | Done when |
|---|------|--------|-------|-----------|
| 42 | Quick switcher and command palette: `Cmd+K` focuses it in the library, `Cmd+P` opens it anywhere, `>` lists actions, arrow keys and Enter | weeks | Needs #28 | Any note reachable in three keystrokes from anywhere · E2E |
| 44 | Quick capture: PWA `shortcuts` "New note" to `/n/new`; `Cmd+N` inside the editor | days | Needs #28 | Two capture paths work on Android and desktop · E2E |
| 96 | Append-to-existing-note capture (append to today's page from the share target) | days | Needs #47, #94 | Shared text lands at the end of today's page, encrypted · service-worker E2E |
| 145 | Browser clipper with encrypted staging | a month or more | Start when #47 shipped and cohort demand | A clipped page becomes an encrypted note without plaintext leaving the browser · extension test |

### Import and export

| # | Item | Effort | Needs | Done when |
|---|------|--------|-------|-----------|
| 76 | Per-note Markdown export in a real zip with front matter | days | Needs #78 | Obsidian opens the folder with titles, tags, and dates intact · fixture comparison |
| 77 | Timestamps, tag colours, and pinned state preserved on every import path | days |  | Round-trip equality on all three fields · property test |
| 78 | Real Markdown parser and serializer with fixtures, replacing the regex chain | weeks |  | Fixture suite of at least 40 documents passes; #17 property test still passes · CI |
| 89 | Importers: Markdown folders and zips, Bear and TextBundle, Notion export, Apple Notes export workflows, Obsidian folders with `[[links]]` mapped to #92 | weeks | Needs #78 | Each importer is a pure function with at least five real-world fixtures; counts match the source · unit tests |
| 90 | Import preview before, counts and reconciliation after, unsupported formatting explained | days | Needs #89 | The preview lists what will and will not carry over; the summary matches the created notes · E2E |
| 91 | Print stylesheet and readable PDF via print | days |  | A 3,000-word note prints with headings, lists, and code intact and no UI chrome · print snapshot |
| 133 | Evernote `.enex` importer with attachments | weeks | Start when #34 shipped | An `.enex` with images imports with counts matching · fixture test |
| 134 | DOCX export | weeks | Start when #78 shipped and cohort demand | A note exports to a `.docx` that opens in Word with headings and lists intact · fixture comparison |

### Sharing

| # | Item | Effort | Needs | Done when |
|---|------|--------|-------|-----------|
| 122 | Optional passphrase on a letter (second wrap of the share key) | days |  | The link alone shows a passphrase prompt; the wrong phrase reveals nothing · E2E |
| 123 | "Refresh this letter" re-encrypts under the existing token; opt-in live letters | days |  | The link stays valid after refresh and shows the new text · E2E |
| 141 | Public Garden as static pre-rendered pages | a month or more | Start when #28 and #34 shipped, and at least a quarter of the cohort asks to publish | A published note is readable with JavaScript disabled and unpublishes within a minute · E2E |

### Pictures and files

| # | Item | Effort | Needs | Done when |
|---|------|--------|-------|-----------|
| 32 | Attachment model: per-attachment key inside the note payload; Supabase Storage under `attachments/<userId>/<id>` with path RLS; Dexie blob table; sanitizer allows `img[data-attachment-id]` only and never an external `src` | weeks | Needs #31, #24 | An image uploaded from device A renders on device B, including offline after sync; the server holds only ciphertext; a note payload referencing an external `src` is rejected · integration tests and a storage-bucket assertion |
| 33 | Encrypted originals, filenames, thumbnails, and manifests; resumable upload; offline availability; quota handling; orphan cleanup; included in export and backup | weeks | Needs #32 | A 5 MB upload interrupted at 50 % resumes and completes; deleting the last referencing note removes the blob within a day; the account quota is shown and enforced · integration tests |
| 88 | Letters carry attachments; Markdown zip includes an `attachments/` folder; encrypted backup includes them | days | Needs #34, #38 | A shared letter shows its images; a restored backup restores them · E2E |
| 131 | PDFs as attachments | weeks | Start when #34 shipped | A PDF attached offline syncs and opens on another device · E2E |
| 132 | Local OCR for images and PDFs | a month or more | Start when #131 shipped and search for image text is requested by the cohort | Text in an attached image is searchable without leaving the device · unit test with a fixture image |

### Phone

| # | Item | Effort | Needs | Done when |
|---|------|--------|-------|-----------|
| 84 | iOS keyboard feasibility spike (one week, needs a Mac): Capacitor shell with the current editor; measure keyboard height tracking, selection, and focus mode in WKWebView; decide go or no-go for #105 | days |  | A written result with measurements and the decision · doc in `docs/plans/` |
| 85 | Real-device testing checklist per release (keyboards, installed PWA, gestures) | days |  | A release cannot merge without a recorded device pass · checklist in repo, referenced from the release PR template |
| 105 | iOS Capacitor project: haptics, status bar, keyboard, share sheet, secure storage; App Store privacy labels; TestFlight | weeks | Start when items 1 to 22 and the recovery key (#23 to #27) have shipped, a real-device browser pass (#81) is recorded, and the keyboard spike (#84) says go | TestFlight build passes the #81 device checklist and the failure scenarios · checklist and CI |
| 107 | Touch targets under 44 px on narrow layouts fixed; metadata and navigation legibility on phones | days |  | Axe target-size rule passes at 390 px · axe |
| 137 | Home-screen widget (quick capture, today's page), share extension, Siri Shortcuts | a month or more | Start when #105 in the App Store | A widget tap opens a new note in under 1 s; the share extension creates an encrypted note · device test |
| 138 | Landscape and iPad: max line length, sidebar at the iPad breakpoint | weeks | Start when #105 in the App Store | Lines are 60 to 75 characters on iPad landscape · visual regression |

### Design

| # | Item | Effort | Needs | Done when |
|---|------|--------|-------|-----------|
| 64 | Manuscript grows with content; minimum height about 60 vh | days |  | Short notes read as a page · visual regression |
| 65 | Title capped at two lines with a smaller size past 60 characters; mirrors body H1 metrics | days |  | A 120-character title fits in two lines at 1440 px · visual regression |
| 66 | Edge states designed: locked note, offline editor, failed sync, expired letter, on-this-device-only | days |  | Each state has a screen and a Storybook-style fixture · visual regression |
| 67 | Playwright axe pass in CI; reduced motion and contrast checks per theme | days | Needs #37 | CI fails on new violations · CI log |
| 68 | Screen-reader verification: editor labelling, status announcements, focus order, modal behaviour | days |  | Checklist passed with VoiceOver and NVDA; the save status is announced · checklist in repo |
| 108 | Card-to-manuscript view transition and its reverse, progressive enhancement | weeks | Needs #28 | Works in Chrome and Safari; instant elsewhere; respects reduced motion · visual check per browser |
| 109 | Reading settings: text size (three steps), line length, body typeface; expose Washi and Mori | days |  | Settings persist per device and survive a refresh · E2E |
| 110 | In-product hints: one per first three notes; empty search suggests an operator; no tour | days |  | Hints dismiss forever and never reappear after sign-in elsewhere · E2E |
| 124 | Task tests for long titles, dense tags, RTL, Tamil and CJK input, zoom, real virtual keyboards | days |  | Each fixture renders without clipping or overlap · visual regression |
| — | Landing page redesign: remove the inline demo, surface the Practice Space CTA, add trust signals | days |  |
| — | App icon and OG image as shippable branding assets | days |  |

### Onboarding

| # | Item | Effort | Needs | Done when |
|---|------|--------|-------|-----------|
| 27 | Passphrase setup rewritten as three steps: passphrase, recovery key, done | days | Needs #26 | New users cannot finish setup without confirming the recovery key · E2E |
| 86 | Custom SMTP for auth email; magic-link sign-in | weeks |  | OTP and magic-link emails arrive within one minute in production for 50 consecutive sends · manual verification log |
| — | Additional OAuth providers, Apple Sign-In first | days |  |

### Speed and code

| # | Item | Effort | Needs | Done when |
|---|------|--------|-------|-----------|
| 60 | Prerender `/`, `/privacy`, `/terms`, `/support`, `/changelog`, `/roadmap`; hydrate only theme toggle and CTA | weeks |  | Landing JavaScript under 50 KB gzip; content visible with JavaScript disabled · size budget test in CI |
| 61 | Defer Supabase to first auth, `hash-wasm` to `deriveKey`, Sentry replay via `lazyLoadIntegration`; split the demo page; fix the React chunk; resolve the five static-plus-dynamic import warnings; keep offline assets and font licences precached | days |  | `main` under 300 KB; zero import warnings; offline shell still complete · build assertion and the service-worker E2E |
| 62 | Input-path work: stop lifting `getHTML()` into `Editor` state on every keystroke; stop re-attaching visibility listeners per character; measure KDF and library decryption | weeks |  | Typing p95 under 100 ms on the long-note fixture · #80 |
| 120 | Fix set-state-during-render (`ChapterSection`, `TimeRibbon`); retire react-doctor suppressions progressively | days |  | Suppressions under 5 with no behaviour change · lint |
| 121 | Migration ordering and drift verification automated in CI against a staging database, plus the release-time check against production from #36 | weeks | Needs #36 | CI fails when the app is ahead of the staging schema; the release PR records the production check · CI |

### Testing

| # | Item | Effort | Needs | Done when |
|---|------|--------|-------|-----------|
| 79 | Journeys, first half: continuous typing, interrupt, reload, recover; two tabs with one offline; network flaps, expired auth, rejected writes, quota pressure, denied persistence, blocked mutations | weeks | Needs #37 | Each scenario asserts the acknowledged revision survives and the UI shows the true state; none is skipped in CI · CI log |
| 80 | Acceptance targets measured nightly on a defined device and dataset: warm launch to editable p95 under 1 s; typing p95 under 100 ms; search p95 under 200 ms at 10k notes; cross-device visibility p95 under 5 s; zero lost acknowledged edits in fault injection; backup restores in a fresh profile | weeks | Needs #37 | The nightly job fails when any target regresses and publishes the numbers in its summary · CI |
| 81 | Cross-browser matrix: Chrome, Edge, Firefox, Safari; real iPhone, iPad, Android; installed PWA | days |  | Matrix documented; the release checklist records a pass per release · checklist |
| 82 | Editor fixture tests: selection preserved, native undo, IME composition, paste fidelity, mobile keyboard | days |  | Each fixture asserts the document after the interaction · unit tests |
| 125 | Journeys, second half: PWA upgrade with dirty work and lazy chunks; import, export, restore with nested formatting, Unicode, attachments, links; lock, sign out, rotate, recover, older offline device; account deletion gates | weeks | Needs #79, #24, #103 | Each scenario asserts the acknowledged revision survives and the resulting state is the documented one; none is skipped · CI |

### Process

| # | Item | Effort | Needs | Done when |
|---|------|--------|-------|-----------|
| 126 | Test willingness to pay before promising unlimited attachments and backups; model storage, transfer, retention, support, and review costs; Bloom tier | days | Needs #87 | Pricing decision and cost model recorded · doc |
| 146 | Re-validate Quiet Intelligence against the privacy and writing goals; keep publishing, collaboration, databases, graph view, and cloud AI deferred until demand is observed | days | Start when #87 findings available | Decision recorded per idea · doc |
| 147 | Keep `docs/prd.md`, `docs/roadmap.md`, and `src/data/roadmap.ts` in step with each shipped phase; mark ledger items done with their PR | days | Start when every phase exit | Docs match shipped behaviour · review at phase exit |
| — | Privacy-respecting usage insights for the writer, computed client-side | weeks |  |
| — | Quiet Intelligence suite (Daily Whisper, Weekly Digest, Resonance Threads, Seasonal Echo, Quiet Questions, The Convergence, Gentle Grounding, The Unsaid) — each must clear the client-side-only bar in PRODUCT.md before it becomes a candidate | a month or more | Needs #146 |
| — | Subscription system: paid tier, payments, feature gating | weeks | Needs #126 |

---

## Won't Do

Refused, with reasons, so they stop resurfacing. The **permanent** non-goals —
the ones refused on principle rather than on current fit — are owned by
`PRODUCT.md`; this table is the working list and repeats a few of them for
convenience.

A recovery key is planned; account recovery is not an omission.

| Feature | Why not |
|---------|---------|
| Databases | That's Notion's game |
| Graph view | That's Obsidian's game |
| Real-time collaboration | That's Notion/Craft's game. Single-user only is a design choice |
| Folders / hierarchy | Contradicts temporal chapters philosophy |
| Push notifications | Contradicts calm technology philosophy |
| Gamification | Contradicts wabi-sabi philosophy |
| Floating selection toolbar | Feels out of place with Yidhan's calm, static aesthetic — works for Notion/Medium but not for a quiet journal |

---

## Open GitHub issues

The issue tracker is authoritative for open work. Tracked here for orientation
only: #121, #122, #125, #129–#133, #138–#141, #143, #145, #146, #150.
