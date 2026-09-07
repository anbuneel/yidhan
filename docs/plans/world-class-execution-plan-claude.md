# Yidhan Improvement Plan

**Version:** 2.0
**Last Updated:** 2026-09-07
**Status:** Living Document
**Author:** Claude (Claude Code)

---

## Original Prompt

> How do we now make the proposal an actionable plan that's sequenced right and doesn't miss any of yours and codex's findings?

Then, after review: "I am getting lost with the naming conventions" and "yes go ahead and renumber it". Version 2.0 keeps every item from version 1.2 and drops the phases, work packages, letter IDs, dispositions, and gates in favour of three words.

---

## How to read this

Three words.

- **Item.** One thing to do, with a plain number. A lower number means sooner. The area next to it says what part of the app it touches.
- **List.** Every item sits in exactly one of four lists: **Now**, **Next**, **Later**, **Done**. Move an item by editing this file in the same PR that changes it.
- **PR.** A pull request closes one or more items. Its title names them: `Fix items 1 and 2: title Enter, slash-menu Escape`.

Effort is **days** (under a week), **weeks** (one to three), or **a month or more**. Dates come from measured pace, not from this file.

"Needs" names items that must land first. "Start when" names the condition that opens an item that is deliberately parked.

The two source reviews and the cross-check are:
- `docs/analysis/world-class-improvements-claude.md`
- `.impeccable/critique/2026-09-06T20-15-28Z__src-app-tsx.md` (Codex, on `main`)
- `docs/analysis/improvement-review-crosscheck-claude.md`

The lookup table at the end maps the old letter IDs to these numbers, so the review documents and earlier commits still cross-reference.

---

## Now

(nothing)

---

## Next

Fix what is broken. Items 1 to 22 are all small, need no Mac, no migration, and no design decision. Do them in this order.

| # | Area | Item | Effort | Needs / start when | Done when |
|---|------|------|--------|--------------------|-----------|
| 5 | Saving | Every exit path checks the save result; a failed save keeps the draft, shows a persistent "Not saved" state with Retry and Copy, visible in focus mode | days |  | the note stays open with the state on screen until the save succeeds or the user copies · E2E with a forced `onUpdate` rejection |
| 6 | Saving | Maximum save interval of 10 s during continuous typing; encrypted local checkpoint | days |  | the killed tab loses at most the last 10 s; reopening shows the checkpoint · E2E |
| 7 | Saving | Save indicator distinguishes "Saved on this device" from "Synced"; never implies another device has text before the server confirms the revision | days |  | Offline typing shows "Saved here", "Synced" appears only after the server acknowledges · unit test on the status state machine |
| 8 | Sync | `note_tags` pulled incrementally and subscribed in realtime | days |  | A tag added on device A appears on device B within the #80 cross-device budget without re-login · two-client integration test |
| 9 | Sync | Conflict modal decrypts both sides: title, excerpt, word count, device and time, paragraph-level diff; both versions preserved until the user chooses | days |  | Both cards show readable text and a diff; choosing either keeps the other as a revision (#59) or a copy · component test with two ciphertexts |
| 10 | Sync | Replace the `Math.max(...spread)` cursor computation | days |  | Cursor computed by reduce · unit test at 100k rows |
| 11 | Search | Memoize plaintext per note keyed on `contentHash`; memoize the card snippet | days |  | No `DOMParser` work per keystroke after the first query · profiler assertion in a unit test with 2,000 notes |
| 12 | Search | Delete `searchNotesOffline`, `searchDecryptedNotes`, and the stale "focused-gaze" comment | days |  | Dead code gone · lint passes with the unused-export rule on |
| 13 | Phone | Replace the "Quick gesture" modal with a one-line caption under the first card | days |  | No modal on first mobile visit · mobile E2E |
| 14 | Phone | Time ribbon gets its own room: bottom padding, hidden near the footer, hidden under 20 notes | days |  | No overlap on a 390 px viewport · mobile E2E and visual regression |
| 15 | Onboarding | Practice Space starter note and landing seal say plainly that drafts are not encrypted until signed up | days |  | No screen claims encryption for localStorage content · copy review and a text assertion in the demo E2E |
| 16 | Keys and privacy | Remove the GET `share_target` from the manifest until #47 ships; the in-app paste path remains; note the removal in the changelog | days |  | The manifest has no `share_target`; no request to any server can carry shared text · manifest assertion in the build test |
| 17 | Import and export | Lossless Markdown round-trip: highlight, underline, `h4` to `h6`, alignment | days |  | Editor HTML → Markdown → HTML → sanitized equals the original for every construct the editor can produce · property test |
| 18 | Import and export | Import accepts the v2 full-account backup; share rows labelled from decrypted titles | days |  | The offboarding export re-imports with identical note count, tags, pinned state, and timestamps · E2E |
| 19 | Sharing | Replace obsolete sharing expectations with current ones: remove the "never expires" case; the anonymous-view test must carry the `#k=` fragment and decrypt; assert the 30-day cap and the `/s/<token>/<slug>` route | days |  | The sharing suite passes against current behaviour and fails if the fragment is dropped · E2E |
| 20 | Speed and code | Delete the dead plaintext write paths and unused helpers | days |  | No caller can violate the E2EE CHECK constraint · lint with the unused-export rule; grep in CI for the removed names |
| 21 | Process | Update `docs/roadmap.md` "Not Building": tables → databases only; backlinks → graph only; recovery → recovery key planned | days |  | Doc changed |
| 22 | Process | Raise issue #170 to P1 and link it to #24 to #23 and #103 | days |  | Issue updated |

---

## Later

Items 23 to 34 are the five things that change what the product is: a recovery key, a web address for every note with Back that works, a list view, and pictures. After that the order is a suggestion, to be reshaped by what the first real writers say.

| # | Area | Item | Effort | Needs / start when | Done when |
|---|------|------|--------|--------------------|-----------|
| 23 | Keys and privacy | Key migration and rotation design, written and reviewed before #24: the wrapped material is the full 64 bytes (AES key and HMAC key); three distinct flows (passphrase change by re-wrap; remembered-device invalidation by key-check version bump; compromise rotation by new key and full re-encryption, #103); interrupted migration resumes; two devices changing concurrently resolve to one winner and the other re-prompts; old offline devices with a stale wrap detect the version and re-unlock; restored backups from before the migration open | days |  | Every later key change can name the flow it belongs to and the test that covers it · design doc in `docs/plans/` with the test list, each test attached to #24, #25, #26, or #103 |
| 24 | Keys and privacy | Wrapped master key: keep the derived key pair as `K`; derive a KEK from the passphrase with a fresh salt; store `wrap(KEK, K)` in `user_metadata` with a version flag; migrate on next unlock | weeks | Needs #23, #36 | Existing users migrate without re-encrypting a note; killing the app mid-migration and reopening completes it; the key-check still verifies `K` · unit tests for interrupted migration and for both keys surviving the wrap |
| 25 | Keys and privacy | Passphrase change by re-wrapping `K` | days | Needs #24 | The new wrap is written and confirmed by the server before the old wrap is invalidated; the key-check version bumps; every other device requires re-unlock on next use; a concurrent change from a second device fails cleanly with a re-prompt · two-device integration test; offline attempt is queued and reported as pending, never as complete |
| 26 | Keys and privacy | Recovery kit: random 256-bit key, `wrap(RK, K)`, shown once as grouped base32 with print and copy, confirmation required; unlock via recovery key then set a new passphrase | weeks | Needs #24 | A user who forgets the passphrase enters the recovery key, sees their notes, and sets a new passphrase; the old wrap is then invalidated as in #25 · E2E through the whole path |
| 27 | Onboarding | Passphrase setup rewritten as three steps: passphrase, recovery key, done | days | Needs #26 | New users cannot finish setup without confirming the recovery key · E2E |
| 28 | Navigation | Note URLs: `/n/<id>`, `/faded`, `/`; history push and pop; scroll restore; routing extracted to `src/routing/` | weeks |  | Browser Back from a note returns to the library at the same scroll position; refresh reopens the note · E2E |
| 29 | Navigation | Faded view routeable; editor with a missing note redirects instead of `return null` | days |  | Opening `/n/<deleted>` lands on the library with a quiet notice · E2E |
| 30 | Library | List view: one line per note, toggle in header, remembered per device | weeks |  | Toggle works; cards remain the default; 2,000 notes render without jank · E2E and the #80 fixture |
| 31 | Editor | Structured document format: ProseMirror JSON is the canonical stored form with a `docVersion` inside the encrypted payload; a schema validator (node and mark allow-list checked with the editor schema, not DOMPurify) rejects unknown or malformed nodes on read and write; HTML is derived from JSON for cards, exports, and letters and still passes `sanitizeHtml`; older clients that meet a newer `docVersion` open the note read-only with an "update Yidhan to edit" notice | weeks | Needs #36 | A note with a new node type renders in a newer client, opens read-only in an older client, and exports to clean HTML and Markdown; a malformed JSON payload is rejected without crashing · unit tests for validator, degradation, and export |
| 32 | Pictures and files | Attachment model: per-attachment key inside the note payload; Supabase Storage under `attachments/<userId>/<id>` with path RLS; Dexie blob table; sanitizer allows `img[data-attachment-id]` only and never an external `src` | weeks | Needs #31, #24 | An image uploaded from device A renders on device B, including offline after sync; the server holds only ciphertext; a note payload referencing an external `src` is rejected · integration tests and a storage-bucket assertion |
| 33 | Pictures and files | Encrypted originals, filenames, thumbnails, and manifests; resumable upload; offline availability; quota handling; orphan cleanup; included in export and backup | weeks | Needs #32 | A 5 MB upload interrupted at 50 % resumes and completes; deleting the last referencing note removes the blob within a day; the account quota is shown and enforced · integration tests |
| 34 | Editor | Images in the editor: paste, drop, slash command; 5 MB cap, 2048 px downscale, WebP; blob URLs at render | a month or more | Needs #32 | A photo pasted offline syncs and renders on another device; a 20 MB photo is downscaled below the cap · E2E |
| 35 | Sync | Server write contract: an RPC `update_note_checked(note_id, expected_hash, expected_updated_at, client_mutation_id, payload)` that returns one of `updated`, `stale` (with the current server row), `missing`, `forbidden`; `client_mutation_id` stored so a replay after a lost response returns the original result; `stale` raises a conflict with both versions preserved; `missing` alone may trigger the local rebuild path; `forbidden` blocks with its reason | days | Needs #36 | two clients writing the same note produce a conflict, never a silent overwrite; a replayed mutation is a no-op; a stale write is never mistaken for a missing row · integration tests for all four outcomes and for replay |
| 36 | Speed and code | Deployment guard: the client reads a `schema_version` row at startup and refuses writes when the app is ahead of the database; `verify_migration_state.sql` becomes a mandatory release step run against the deployment target, recorded in the PR | days |  | An app built ahead of its migration shows a "database update pending" state instead of blocking the queue · unit test on the guard; release checklist in `docs/setup/` |
| 37 | Testing | Authenticated E2E fixture (test account, vault unlock) and the full Playwright suite in CI | days |  | `npm run e2e` runs in CI on every PR with no skipped authenticated tests · CI log |
| 38 | Keys and privacy | Encrypted backup export (`.yidhan`: v2 JSON under a backup key) and import | days |  | A backup restores into a fresh browser profile with identical notes, tags, pinned state, timestamps, and (later) attachments; a truncated file is rejected with a clear message · restore test in CI |
| 39 | Keys and privacy | Threat-model page at `/security` in the product voice; `security.txt`; states visible metadata (timestamps, sizes, tag names until #101) | days |  | Page live and linked from `/privacy` · copy review |
| 40 | Keys and privacy | Outbound data audit: Sentry allowlisted fields, URLs, demo and capture paths, error strings | days |  | Audit doc lists every outbound request type and the fields it may carry; scrubber tests cover each · unit tests |
| 41 | Keys and privacy | One undecryptable note renders as a locked card with retry; library stays usable; exports report incomplete | days |  | Corrupting one payload leaves every other note readable and the export banner says "1 note could not be included" · unit and E2E tests |
| 42 | Navigation | Quick switcher and command palette: `Cmd+K` focuses it in the library, `Cmd+P` opens it anywhere, `>` lists actions, arrow keys and Enter | weeks | Needs #28 | Any note reachable in three keystrokes from anywhere · E2E |
| 43 | Navigation | Keyboard navigation over cards: arrows or j/k, Enter, p, t, Delete with undo | days |  | Library usable without a mouse; focus ring visible · E2E and axe |
| 44 | Navigation | Quick capture: PWA `shortcuts` "New note" to `/n/new`; `Cmd+N` inside the editor | days | Needs #28 | Two capture paths work on Android and desktop · E2E |
| 45 | Navigation | "Start writing" reaches an editable draft in one action on desktop and mobile; mobile landing CTA opens a new Practice Space note | days |  | One tap, caret blinking · mobile E2E |
| 46 | Onboarding | Practice Space to account in one step is the primary demo CTA | days |  | The first note is carried into the account · E2E |
| 47 | Keys and privacy | Private capture: POST `share_target` with `multipart/form-data` intercepted by the service worker; content stored locally in IndexedDB and encrypted immediately when the vault is unlocked; when locked, held locally in a "waiting for unlock" state and encrypted on unlock; never sent to any server unencrypted; failure and fallback paths defined | weeks | Needs #28, service-worker test harness | A share from another app creates a note without any network request carrying the text, with the vault locked or unlocked · service-worker E2E asserting the request log; locked-vault case covered |
| 48 | Library | Sort and chapter basis: last edited or created; within chapter by edited, created, title | days |  | Editing an old note can stay in its chapter when "created" is chosen · unit test on grouping |
| 49 | Library | Card preview mask only when text overflows; cap age fade at 0.9 | days |  | Short previews fully legible; contrast on the Archive chapter passes AA · visual regression and axe |
| 50 | Search | Query semantics: multi-term AND, quoted phrases, `tag:`, `is:pinned`, `before:`, `after:`; all matches highlighted | days | Needs #11 | `tag:journal before:2026-03 "exact phrase"` returns only notes matching all three · unit test per operator; operators listed in the `?` modal |
| 51 | Search | In-memory index (MiniSearch or FlexSearch) with ranking and fuzziness, incremental rebuild; moved to a worker if the main thread shows it | days | Needs #11 | Title matches rank first; p95 under 200 ms at 10k notes · #80 fixture |
| 52 | Editor | Markdown paste through `handlePaste` and `markdownToHtml` | days |  | `## Heading` pastes as a heading; HTML clipboard content is untouched · unit test |
| 53 | Editor | Typography extension: smart quotes, dashes, ellipsis | days |  | Enabled with a setting to disable; code blocks exempt · unit test |
| 54 | Editor | Word and character count, reading time, hover-revealed in the title-zone metadata | days |  | Visible on hover on desktop, tap on mobile · component test |
| 55 | Editor | Find and replace in note: `Cmd+F`, next and previous, decoration highlights | days |  | Works in focus mode; replace-all is undoable in one step · E2E |
| 56 | Editor | Toolbar and sidebar subscribe to editor transactions so active states stay fresh | days |  | Arrow into bold text lights the button · component test |
| 57 | Editor | One command model: same capability set in sidebar, inline toolbar, mobile bar, slash menu, shortcuts, with overflow by width; fixes the hidden inline toolbar at 1100 px and wider; text-align gets UI or the extension is dropped; inline code button | weeks |  | Every command reachable by mouse at every width from 320 px to 1920 px · E2E across four widths |
| 58 | Saving | Revision id on every save; the UI acknowledges a specific revision; the #35 RPC carries it | days | Needs #35 | "Synced" names the revision the server confirmed · unit test on the state machine |
| 59 | Saving | Bounded local encrypted revision history per note (last 20 snapshots or 7 days), preview, restore, save-as-copy; snapshot before conflict resolution | weeks | Needs #58 | A replaced paragraph is recoverable from the history panel; restoring creates a new revision rather than rewriting history · E2E |
| 60 | Speed and code | Prerender `/`, `/privacy`, `/terms`, `/support`, `/changelog`, `/roadmap`; hydrate only theme toggle and CTA | weeks |  | Landing JavaScript under 50 KB gzip; content visible with JavaScript disabled · size budget test in CI |
| 61 | Speed and code | Defer Supabase to first auth, `hash-wasm` to `deriveKey`, Sentry replay via `lazyLoadIntegration`; split the demo page; fix the React chunk; resolve the five static-plus-dynamic import warnings; keep offline assets and font licences precached | days |  | `main` under 300 KB; zero import warnings; offline shell still complete · build assertion and the service-worker E2E |
| 62 | Speed and code | Input-path work: stop lifting `getHTML()` into `Editor` state on every keystroke; stop re-attaching visibility listeners per character; measure KDF and library decryption | weeks |  | Typing p95 under 100 ms on the long-note fixture · #80 |
| 63 | Speed and code | Decompose `App.tsx` and `Editor.tsx`: routing, `useNotesSync`, `useImport`, `useDemoMigration`, `useShareTarget`, `PublicPage`; clear interfaces for persistence, note lifecycle, search, attachments, vault | weeks | Needs #28 | `App.tsx` under 600 lines with no behaviour change · existing test suite green after each extraction |
| 64 | Design | Manuscript grows with content; minimum height about 60 vh | days |  | Short notes read as a page · visual regression |
| 65 | Design | Title capped at two lines with a smaller size past 60 characters; mirrors body H1 metrics | days |  | A 120-character title fits in two lines at 1440 px · visual regression |
| 66 | Design | Edge states designed: locked note, offline editor, failed sync, expired letter, on-this-device-only | days |  | Each state has a screen and a Storybook-style fixture · visual regression |
| 67 | Design | Playwright axe pass in CI; reduced motion and contrast checks per theme | days | Needs #37 | CI fails on new violations · CI log |
| 68 | Design | Screen-reader verification: editor labelling, status announcements, focus order, modal behaviour | days |  | Checklist passed with VoiceOver and NVDA; the save status is announced · checklist in repo |
| 69 | Sync | Deletion policy, decided before anything purges: a queued update for a note hard-deleted or purged elsewhere becomes a conflict ("this note was released on another device: restore or discard"), never a silent reinsertion; a permanently failing `create` expires into a blocked state the user can export or discard | days | Needs #35 | the reinsertion path only runs for the `missing` outcome on notes with no server tombstone · integration test with a tombstoned note |
| 70 | Sync | Tombstones for notes and tags written by trigger and pulled by cursor; end the two full-table sweeps | weeks | Needs #36 | Sync makes no `select id` sweep; a note deleted on device A disappears on device B via the tombstone · integration test and query log assertion |
| 71 | Sync | Cross-tab queue ownership with the Web Locks API or a recoverable lease | days |  | Two tabs never sync concurrently; a tab that dies mid-sync releases the lock within 30 s · E2E with two pages |
| 72 | Sync | `isRetryableError` classifies by error code and type, not substrings; `delete` no longer string-matches "0 rows" | days |  | A server error whose message contains "network" is not retried unless its code is transient · unit tests |
| 73 | Sync | `fadedNotesCount` derived from data, not incremented optimistically | days |  | Count equals the faded list length after any sequence of local and realtime deletes · unit test |
| 74 | Sync | Card deletion is exactly-once with deliberate undo: the delete action runs once whether the animation finishes or the card unmounts; a failed delete restores the card with a message; Undo is the only cancellation path | days |  | Typing in search during the delete animation still deletes exactly once; a rejected delete restores the card · component test with unmount-mid-animation and with a rejected `onDelete` |
| 75 | Sync | Server-side `pg_cron` purge for faded notes instead of client-load purge | days | Needs #69, #70 | A purged note leaves a tombstone; a device with a queued update for it gets the #69 conflict, not a resurrection · integration test |
| 76 | Import and export | Per-note Markdown export in a real zip with front matter | days | Needs #78 | Obsidian opens the folder with titles, tags, and dates intact · fixture comparison |
| 77 | Import and export | Timestamps, tag colours, and pinned state preserved on every import path | days |  | Round-trip equality on all three fields · property test |
| 78 | Import and export | Real Markdown parser and serializer with fixtures, replacing the regex chain | weeks |  | Fixture suite of at least 40 documents passes; #17 property test still passes · CI |
| 79 | Testing | Journeys, first half: continuous typing, interrupt, reload, recover; two tabs with one offline; network flaps, expired auth, rejected writes, quota pressure, denied persistence, blocked mutations | weeks | Needs #37 | Each scenario asserts the acknowledged revision survives and the UI shows the true state; none is skipped in CI · CI log |
| 80 | Testing | Acceptance targets measured nightly on a defined device and dataset: warm launch to editable p95 under 1 s; typing p95 under 100 ms; search p95 under 200 ms at 10k notes; cross-device visibility p95 under 5 s; zero lost acknowledged edits in fault injection; backup restores in a fresh profile | weeks | Needs #37 | The nightly job fails when any target regresses and publishes the numbers in its summary · CI |
| 81 | Testing | Cross-browser matrix: Chrome, Edge, Firefox, Safari; real iPhone, iPad, Android; installed PWA | days |  | Matrix documented; the release checklist records a pass per release · checklist |
| 82 | Testing | Editor fixture tests: selection preserved, native undo, IME composition, paste fidelity, mobile keyboard | days |  | Each fixture asserts the document after the interaction · unit tests |
| 83 | Phone | Remove the doubled title in the mobile editor; `h-screen` to `100dvh` | days |  | iOS Safari bars no longer clip the toolbar · real-device check in #81 |
| 84 | Phone | iOS keyboard feasibility spike (one week, needs a Mac): Capacitor shell with the current editor; measure keyboard height tracking, selection, and focus mode in WKWebView; decide go or no-go for #105 | days |  | A written result with measurements and the decision · doc in `docs/plans/` |
| 85 | Phone | Real-device testing checklist per release (keyboards, installed PWA, gestures) | days |  | A release cannot merge without a recorded device pass · checklist in repo, referenced from the release PR template |
| 86 | Onboarding | Custom SMTP for auth email; magic-link sign-in | weeks |  | OTP and magic-link emails arrive within one minute in production for 50 consecutive sends · manual verification log |
| 87 | Process | Validation cohort: 8 to 12 target writers for several weeks with their own material and consent for content-free diagnostics; observe capture-to-save, finding an old note, long writing, interruptions, migration, restoration | ongoing | Needs items 1 to 22 shipped | Findings written up and used to reorder the Later list · doc in `docs/reviews/` |
| 88 | Pictures and files | Letters carry attachments; Markdown zip includes an `attachments/` folder; encrypted backup includes them | days | Needs #34, #38 | A shared letter shows its images; a restored backup restores them · E2E |
| 89 | Import and export | Importers: Markdown folders and zips, Bear and TextBundle, Notion export, Apple Notes export workflows, Obsidian folders with `[[links]]` mapped to #92 | weeks | Needs #78 | Each importer is a pure function with at least five real-world fixtures; counts match the source · unit tests |
| 90 | Import and export | Import preview before, counts and reconciliation after, unsupported formatting explained | days | Needs #89 | The preview lists what will and will not carry over; the summary matches the created notes · E2E |
| 91 | Import and export | Print stylesheet and readable PDF via print | days |  | A 3,000-word note prints with headings, lists, and code intact and no UI chrome · print snapshot |
| 92 | Library | Note links: `[[` opens the switcher and inserts `/n/<id>`; titles resolve client-side; "Mentioned in" list at the bottom | weeks | Needs #28, #42, #31 | Renaming a note updates every link's text; the linked note lists the mention · E2E |
| 93 | Library | Tag quality of life: search in selector, rename preserves assignments, Tags page with counts, `#tag` autocomplete in the editor | days |  | Typing `#jour` and Enter assigns "journal" without leaving the editor · E2E |
| 94 | Library | Templates (notes tagged `template`) and a "Today" daily page in the palette | days | Needs #42 | "Today" opens today's note or creates it once · E2E |
| 95 | Library | Saved searches in the palette | days | Needs #42, #50 | A saved search reopens with its operators and result set · E2E |
| 96 | Navigation | Append-to-existing-note capture (append to today's page from the share target) | days | Needs #47, #94 | Shared text lands at the end of today's page, encrypted · service-worker E2E |
| 97 | Editor | Heading outline for long notes, hover-revealed on desktop | weeks |  | The outline follows scroll and clicking a heading scrolls to it · E2E |
| 98 | Library | Multi-select and bulk actions in list view only: tag, pin, fade, export | weeks | Needs #30 | Shift-click ranges; bulk fade is undoable in one step · E2E |
| 99 | Library | Virtualize the list view once measured at 2,000 notes | weeks | Needs #30 | 10k-note fixture scrolls at 60 fps with search open · #80 fixture |
| 100 | Search | Search results honour progressive rendering and virtualization instead of rendering every match at once | days | Needs #99 | 10k matching notes render in under 200 ms · #80 fixture |
| 101 | Keys and privacy | Encrypt tag names (and future collection and attachment names) with AAD `tagId:userId`; append-only migration | weeks | Needs #24, #36 | The server holds no plaintext tag names; filtering and autocomplete still work offline · migration test and a database assertion |
| 102 | Keys and privacy | Key exposure at rest, stated honestly: on the web the unlocked key is held in a dedicated Worker so page scripts cannot read it directly (execution isolation, which limits but does not remove XSS reach); persistent protection comes only from a platform keystore (native, #106) or a passkey-wrapped blob (#135); "Remember this browser" copy states the device and XSS exposure plainly | weeks |  | Raw key bytes are no longer readable from `localStorage` or page scope; the setting's copy passes review · unit test on the Worker boundary |
| 103 | Keys and privacy | Compromise rotation: generate a new `K`, re-encrypt every note and attachment under it with sync paused, re-wrap, then resume; distinct from the #25 passphrase change | weeks | Needs #24, #23 | After rotation no ciphertext on the server decrypts under the old key; an old device is forced to re-unlock and re-pull · integration test |
| 104 | Keys and privacy | Independent security review covering encryption, migrations, auth, deletion, sharing, recovery, and delivery chain; before broad public assurances | external review | Needs #24, #101 | Report received; every finding triaged into this ledger · report in `docs/reviews/` |
| 105 | Phone | iOS Capacitor project: haptics, status bar, keyboard, share sheet, secure storage; App Store privacy labels; TestFlight | weeks | Start when items 1 to 22 and the recovery key (#23 to #27) have shipped, a real-device browser pass (#81) is recorded, and the keyboard spike (#84) says go | TestFlight build passes the #81 device checklist and the failure scenarios · checklist and CI |
| 106 | Keys and privacy | Biometric unlock on native: remembered blob held in the secure keystore behind Face ID or fingerprint | weeks | Needs #24, #105 | The key never touches `localStorage` on native; a failed biometric falls back to the passphrase · device test |
| 107 | Phone | Touch targets under 44 px on narrow layouts fixed; metadata and navigation legibility on phones | days |  | Axe target-size rule passes at 390 px · axe |
| 108 | Design | Card-to-manuscript view transition and its reverse, progressive enhancement | weeks | Needs #28 | Works in Chrome and Safari; instant elsewhere; respects reduced motion · visual check per browser |
| 109 | Design | Reading settings: text size (three steps), line length, body typeface; expose Washi and Mori | days |  | Settings persist per device and survive a refresh · E2E |
| 110 | Design | In-product hints: one per first three notes; empty search suggests an operator; no tour | days |  | Hints dismiss forever and never reappear after sign-in elsewhere · E2E |
| 111 | Library | Pinned chapter as a compact row when it holds fewer than three notes | days |  | No lone card in a wide band at 1440 px · visual regression |
| 112 | Editor | `spellcheck` and `lang` on the editor; remove the dead `prose-editor` class | days |  | Browser spellcheck underlines a misspelling · E2E |
| 113 | Editor | Code block language and highlighting via lowlight | days | Needs #31 | Language picker in the block; highlighting survives export · unit test |
| 114 | Editor | Undo history isolated per note (`setContent` with history cleared, `emitUpdate: false`) | days |  | Undo after switching notes cannot alter the previous note · unit test |
| 115 | Editor | Untouched new note fades silently on leave | days |  | Leaving a blank new note leaves no card behind · E2E |
| 116 | Editor | Slash menu flips and clamps to the viewport and follows scroll; renderer lifecycle bug on Escape fixed | days |  | The menu is fully visible at the bottom of a 390 px viewport · mobile E2E |
| 117 | Editor | Overflow menu: touch and scroll close, `menuitem` roles, arrow keys | days |  | Axe clean; arrow keys move focus · component test |
| 118 | Saving | Revision history synced so recovery survives a lost device; retention and deletion defined | weeks | Needs #59, #38 | A revision made on a lost device restores on a new one; deleted notes purge their revisions with #75 · integration test |
| 119 | Saving | Remove `savePhaseTimeoutRef` dead code; stop listener churn in the visibility effect | days |  | Listeners attach once per mount · unit test counting listeners |
| 120 | Speed and code | Fix set-state-during-render (`ChapterSection`, `TimeRibbon`); retire react-doctor suppressions progressively | days |  | Suppressions under 5 with no behaviour change · lint |
| 121 | Speed and code | Migration ordering and drift verification automated in CI against a staging database, plus the release-time check against production from #36 | weeks | Needs #36 | CI fails when the app is ahead of the staging schema; the release PR records the production check · CI |
| 122 | Sharing | Optional passphrase on a letter (second wrap of the share key) | days |  | The link alone shows a passphrase prompt; the wrong phrase reveals nothing · E2E |
| 123 | Sharing | "Refresh this letter" re-encrypts under the existing token; opt-in live letters | days |  | The link stays valid after refresh and shows the new text · E2E |
| 124 | Design | Task tests for long titles, dense tags, RTL, Tamil and CJK input, zoom, real virtual keyboards | days |  | Each fixture renders without clipping or overlap · visual regression |
| 125 | Testing | Journeys, second half: PWA upgrade with dirty work and lazy chunks; import, export, restore with nested formatting, Unicode, attachments, links; lock, sign out, rotate, recover, older offline device; account deletion gates | weeks | Needs #79, #24, #103 | Each scenario asserts the acknowledged revision survives and the resulting state is the documented one; none is skipped · CI |
| 126 | Process | Test willingness to pay before promising unlimited attachments and backups; model storage, transfer, retention, support, and review costs; Bloom tier | days | Needs #87 | Pricing decision and cost model recorded · doc |
| 127 | Editor | Simple tables (Tiptap Table, no formulas, no sorting) | weeks | Start when #31 shipped and the cohort asks for tables | A three-column table round-trips through export and a letter · E2E |
| 128 | Editor | Heading folding | weeks | Start when #97 shipped and long notes over 3,000 words exceed 10 % of the cohort's notes | Folded state persists per note · E2E |
| 129 | Editor | Footnotes | weeks | Start when #31 shipped and cohort demand | Footnotes export to Markdown and print correctly · unit test |
| 130 | Editor | Replace triple-tap focus mode with a gesture that does not fight the OS | days | Start when Real-device testing (#81) records a conflict | No accidental focus-mode toggles in a 10-minute device session · device test |
| 131 | Pictures and files | PDFs as attachments | weeks | Start when #34 shipped | A PDF attached offline syncs and opens on another device · E2E |
| 132 | Pictures and files | Local OCR for images and PDFs | a month or more | Start when #131 shipped and search for image text is requested by the cohort | Text in an attached image is searchable without leaving the device · unit test with a fixture image |
| 133 | Import and export | Evernote `.enex` importer with attachments | weeks | Start when #34 shipped | An `.enex` with images imports with counts matching · fixture test |
| 134 | Import and export | DOCX export | weeks | Start when #78 shipped and cohort demand | A note exports to a `.docx` that opens in Word with headings and lists intact · fixture comparison |
| 135 | Keys and privacy | Passkey unlock on the web via WebAuthn PRF | weeks | Start when #24 shipped; PRF support in the cohort's browsers measured | A passkey unlocks the vault without the passphrase; the passphrase still works · E2E in Chrome and Safari |
| 136 | Keys and privacy | Move the salt out of `user_metadata` (issue #170 D1) | days | Start when #24 shipped | The JWT carries no salt; unlock still works on every device · integration test |
| 137 | Phone | Home-screen widget (quick capture, today's page), share extension, Siri Shortcuts | a month or more | Start when #105 in the App Store | A widget tap opens a new note in under 1 s; the share extension creates an encrypted note · device test |
| 138 | Phone | Landscape and iPad: max line length, sidebar at the iPad breakpoint | weeks | Start when #105 in the App Store | Lines are 60 to 75 characters on iPad landscape · visual regression |
| 139 | Library | "Set aside" true archive action | days | Start when #30 shipped and the cohort asks for an archive | Set-aside notes leave the chapters and return on request · E2E |
| 140 | Library | Lightweight named collections | weeks | Start when #95 shipped and the cohort still asks for collections | A collection is a saved query with a name, not a container; deleting it deletes no notes · E2E |
| 141 | Sharing | Public Garden as static pre-rendered pages | a month or more | Start when #28 and #34 shipped, and at least a quarter of the cohort asks to publish | A published note is readable with JavaScript disabled and unpublishes within a minute · E2E |
| 142 | Search | Persisted encrypted search index | weeks | Start when #80 shows load-time indexing above 500 ms at the cohort's library size | Cold start with 10k notes reaches a searchable state under 1 s · #80 |
| 143 | Sync | Delta uploads instead of the full blob per autosave | weeks | Start when #118 shipped and #80 shows autosave payloads above 100 KB in normal use | A one-word edit to a 200 KB note uploads under 5 KB · network assertion |
| 144 | Sync | Evaluate Yjs or Automerge for note bodies | a month or more | Start when #143 shipped and conflicts exceed one per user-week in the cohort | Written evaluation with a prototype and a decision · doc |
| 145 | Navigation | Browser clipper with encrypted staging | a month or more | Start when #47 shipped and cohort demand | A clipped page becomes an encrypted note without plaintext leaving the browser · extension test |
| 146 | Process | Re-validate Quiet Intelligence against the privacy and writing goals; keep publishing, collaboration, databases, graph view, and cloud AI deferred until demand is observed | days | Start when #87 findings available | Decision recorded per idea · doc |
| 147 | Process | Keep `docs/prd.md`, `docs/roadmap.md`, and `src/data/roadmap.ts` in step with each shipped phase; mark ledger items done with their PR | days | Start when every phase exit | Docs match shipped behaviour · review at phase exit |

---

## Done

| # | Area | Item | Effort | Needs / start when | Done when |
|---|------|------|--------|--------------------|-----------|
| 1 | Editor | `Enter` in the title moves focus to the body at position 0 | days |  | Typing a title and pressing Enter puts the caret in the body · integrated-browser keystroke verification (owner override: no Playwright) |
| 2 | Editor | `Escape` handler returns early on `defaultPrevented` or any open popover; slash menu calls `preventDefault` | days |  | Escape on the slash menu closes only the menu; note stays open · editor unit tests and integrated-browser verification (owner override: no Playwright) |
| 3 | Editor | Link extension: `openOnClick: false`, link popover (insert, edit, remove), entries in toolbar, sidebar, slash menu; `Cmd+K` with a selection inserts a link | days |  | A link can be added, edited, and removed by mouse; clicking one stays in the app · component tests and integrated-browser verification (owner override: no Playwright) |
| 4 | Editor | Remove the duplicate `Underline` registration | days |  | No Tiptap duplicate-name warning · console assertion in the editor unit test |
| 5 | Saving | Every exit path checks the save result; a failed save keeps the draft, shows a persistent "Not saved" state with Retry and Copy, visible in focus mode | days |  | the note stays open with the state on screen until the save succeeds or the user copies · component tests with forced `onUpdate` rejection (owner override: no Playwright) |
| 6 | Saving | Maximum save interval of 10 s during continuous typing; encrypted local checkpoint | days |  | the killed tab loses at most the last 10 s; reopening shows the checkpoint · timer component test and encrypted persistence/reopen integration test (owner override: no Playwright) |
| 7 | Saving | Save indicator distinguishes "Saved on this device" from "Synced"; never implies another device has text before the server confirms the revision | days |  | Offline typing shows "Saved here", "Synced" appears only after the server acknowledges · unit test on the status state machine |
| 148 | Process | Work off the ledger: no issue tracker duplication; PR titles carry the IDs they close; the Board is the only status record | days |  | Done: convention adopted |

---

## Working rules

- Work from **Next**. A lower number goes first. Anything that risks losing or leaking words jumps the queue.
- A PR closes items. Its title names them. The same PR moves them to **Done** and adds a line to `src/data/changelog.ts`.
- The "done when" is the test. It ships in the same PR as the item, never later.
- Anything that needs a database change ships with the migration check (item #36) and `verify_migration_state.sql` run against production.
- `npm run check` on every PR. `npm run e2e` once item #37 lands.
- When a real writer or a measurement says the order is wrong, change the order. Nothing else reorders it.
- What stays out: real-time collaboration, folders, push notifications, gamification, floating selection toolbars, analytics tracking, and cloud AI.

---

## Lookup: old IDs to numbers

| Old ID | # | Source |
|--------|---|--------|
| ATT-01 | 32 | C App C; X attachments |
| ATT-02 | 33 | X attachments |
| ATT-03 | 131 | X |
| ATT-04 | 132 | X |
| ATT-05 | 88 | C App C |
| DES-01 | 64 | C 4.11 |
| DES-02 | 65 | C 4.11 |
| DES-03 | 108 | C 4.11 |
| DES-04 | 109 | C 4.11 |
| DES-05 | 110 | C 4.11; X help heuristic |
| DES-06 | 66 | C 4.11; X status visibility |
| DES-07 | 67 | C 4.11 |
| DES-08 | 68 | X personas |
| DES-09 | 124 | X personas |
| ED-01 | 1 | C 4.1, defect 1 |
| ED-02 | 2 | C 4.1, defect 2 |
| ED-03 | 3 | C 4.1, defect 4 |
| ED-04 | 52 | C 4.1 |
| ED-05 | 53 | C 4.1 |
| ED-06 | 54 | C 4.1; X counts |
| ED-07 | 55 | C 4.1, 4.4; X find/replace |
| ED-08 | 56 | C 4.1 |
| ED-09 | 57 | X design P2; C 4.1 |
| ED-10 | 112 | C 4.1 |
| ED-11 | 113 | C 4.1 |
| ED-12 | 114 | C defect 18 |
| ED-13 | 115 | C 4.2 |
| ED-14 | 116 | C defect 20 |
| ED-15 | 130 | C 4.1 |
| ED-16 | 4 | C defect 19 |
| ED-17 | 34 | C 4.1; CX |
| ED-18 | 127 | CX; decision revisit |
| ED-19 | 97 | X next release |
| ED-20 | 128 | X |
| ED-21 | 129 | X |
| ED-22 | 31 | X next release; P architecture |
| ED-23 | 117 | C 4.9 |
| KEY-01 | 24 | C 4.6, App B; X privacy 4; #170 |
| KEY-02 | 25 | CX |
| KEY-03 | 26 | CX |
| KEY-04 | 23 | X privacy 4; P #3 |
| KEY-05 | 101 | C 4.6; X privacy 3 |
| KEY-06 | 38 | C 4.6, 4.7; X first release |
| KEY-07 | 135 | C 4.6 |
| KEY-08 | 106 | C 4.6; X "protected device key storage" |
| KEY-09 | 39 | C 4.6; X "define the promise" |
| KEY-10 | 102 | C 4.6; X privacy 5; P architecture |
| KEY-11 | 104 | X privacy 6 |
| KEY-12 | 40 | X privacy 5 |
| KEY-13a | 16 | X privacy 2; P #1 |
| KEY-13b | 47 | X privacy 2; P #1 |
| KEY-14 | 136 | X via #170 |
| KEY-15 | 41 | C 4.10; X first release |
| KEY-16 | 103 | X privacy 4; P #3 |
| LIB-01 | 30 | C 4.3 |
| LIB-02 | 48 | C 4.3 |
| LIB-03 | 98 | C 4.3 |
| LIB-04 | 93 | C 4.3 |
| LIB-05 | 92 | C 4.3; X connections |
| LIB-06 | 94 | C 4.3 |
| LIB-07 | 139 | C 4.3 |
| LIB-08 | 95 | X retrieval |
| LIB-09 | 140 | X connections |
| LIB-10 | 49 | X design P2 |
| LIB-11 | 111 | C 4.11 |
| LIB-12 | 99 | C 4.10; X scale |
| MOB-01 | 13 | C 4.9 |
| MOB-02 | 14 | C 4.9 |
| MOB-03 | 83 | C 4.9 |
| MOB-04a | 84 | P #7 |
| MOB-04b | 105 | C 4.9; X release 4; P #7 |
| MOB-05 | 137 | C 4.9; X release 4 |
| MOB-06 | 138 | C 4.9 |
| MOB-07 | 107 | X minor observations |
| MOB-08 | 85 | X; C mobile docs |
| NAV-01 | 28 | C 4.2; X connections |
| NAV-02 | 29 | C defects 13 and 14 |
| NAV-03 | 42 | C 4.2; X retrieval |
| NAV-04 | 43 | C 4.2; X keyboard selection |
| NAV-05 | 44 | C 4.2; X capture |
| NAV-06 | 96 | X capture |
| NAV-07 | 45 | C 4.12; X design P2 |
| NAV-08 | 145 | X capture |
| ONB-01 | 15 | X privacy 1, X design P1 |
| ONB-02 | 27 | C 4.12 |
| ONB-03 | 86 | C 4.12; backlog P1 |
| ONB-05 | 46 | C 4.12; launch review #13 |
| OPS-01 | 87 | X sequence |
| OPS-02 | 126 | X sustainable; monetization docs |
| OPS-03 | 148 | this doc |
| OPS-04 | 146 | X sequence; C |
| OPS-05 | 21 | C §6 |
| OPS-06 | 22 | cross-check |
| OPS-07 | 147 | this doc |
| PERF-01 | 60 | C 4.10 |
| PERF-02 | 61 | C 4.10; X sustainable |
| PERF-03 | 62 | X sustainable; C 4.1 audit |
| PERF-04 | 63 | C 4.10; X sustainable |
| PERF-05 | 20 | C 4.10, defect 22 |
| PERF-06 | 120 | C defect 24 |
| PERF-07a | 36 | X sustainable; P #4 |
| PERF-07b | 121 | X sustainable |
| PORT-01 | 17 | C 4.7, defect 9 |
| PORT-02 | 18 | C 4.7, defects 8 and 10 |
| PORT-03 | 76 | C 4.7; X migration |
| PORT-04 | 77 | C 4.7 |
| PORT-05 | 78 | X migration |
| PORT-06a | 89 | C 4.7; X migration |
| PORT-06b | 133 | C 4.7; X |
| PORT-07 | 90 | X migration |
| PORT-08a | 91 | X next release |
| PORT-08b | 134 | X |
| QA-01 | 37 | C 4.10; X quality gates |
| QA-02a | 79 | X quality gates |
| QA-02b | 125 | X quality gates |
| QA-03 | 80 | X quality gates; C §7 |
| QA-04 | 81 | X quality gates |
| QA-06 | 82 | X next release |
| SAVE-01 | 5 | X first release |
| SAVE-02 | 6 | X first release |
| SAVE-03 | 7 | X first release, X design P1 |
| SAVE-04 | 58 | X first release |
| SAVE-05a | 59 | X first release |
| SAVE-05b | 118 | X first release |
| SAVE-06 | 119 | C 4.1 audit |
| SHR-01 | 122 | C 4.8 |
| SHR-02 | 123 | C 4.8; roadmap |
| SHR-03 | 141 | C 4.8; roadmap |
| SHR-04 | 19 | X quality gates; P #6 |
| SRCH-01 | 11 | C 4.4; X scale |
| SRCH-02 | 50 | C 4.4; X retrieval |
| SRCH-03 | 51 | C 4.4; X scale |
| SRCH-04 | 142 | C 4.4 |
| SRCH-05 | 12 | C 4.4 |
| SRCH-06 | 100 | X scale |
| SYNC-01 | 9 | C 4.5, defect 5; X "preserve both revisions" |
| SYNC-02 | 8 | C 4.5, defect 6 |
| SYNC-03 | 10 | C defect 7 |
| SYNC-04 | 70 | C 4.5; launch review |
| SYNC-05 | 35 | X first release; P #2 |
| SYNC-06 | 71 | X first release |
| SYNC-07 | 72 | C defect 21 |
| SYNC-08 | 73 | C defect 16 |
| SYNC-09 | 74 | C defects 15 and 17; P #6 |
| SYNC-10 | 69 | C 4.5; X first release; P #2 |
| SYNC-11 | 143 | C 4.5 |
| SYNC-12 | 144 | C 4.5 |
| SYNC-13 | 75 | C defect 25 |

---

## Appendix A: Coverage of the Claude review

| Claude review section | Ledger IDs |
|-----------------------|-----------|
| §1 ten moves | 1 #24/02/03 · 2 #34, #32/02 · 3 #1/02/03/04 · 4 #28/03 · 5 #30/02, #50/03 · 6 #9/02/03 · 7 #17/02/03/06, #38 · 8 #60/02 · 9 #13/02/03/04, #106 · 10 #63 |
| §4.1 findings table (15 rows) | #1, #2, #3, #52, #34, #56, #54 and #55, #53, #112, #113, #57 (TextAlign and inline code), #114, #115, #116 and #130, #4 |
| §4.1 recommendations 1 to 8 | #1/02, #3, #52, #53/06, #55, #34, #56, #127 |
| §4.2 recommendations 1 to 5 | #28/02, #42, #43, #44, #115 |
| §4.3 recommendations 1 to 8 | #30, #48, #11/02/03, #98, #93, #92, #94, #139 |
| §4.4 recommendations 1 to 6 | #11, #50, #51, #142, #55, #12 |
| §4.5 findings table (10 rows) | #9, #8, #10, #70, #144 (merge), #143 (blob per save), #69, #72, #73, #74 |
| §4.5 recommendations 1 to 5 | #9, #8, #70, #10, #144 |
| §4.6 recommendations 1 to 6 | #24/02/03 and #27, #101, #38, #135 and #106, #39, #102 |
| §4.7 recommendations 1 to 5 | #17, #18 and #38, #76, #89/b, #77 |
| §4.8 recommendations 1 to 3 | #122, #123, #141 |
| §4.9 findings table (5 rows) | #13, #14, #83 (title), #83 (dvh), #117 |
| §4.9 recommendations 1 to 5 | #13, #14, #84/b and #106, #137, #138 |
| §4.10 measurements and structure | #60/02 (bundle), #63 (App.tsx), #120 (set-state-in-render), #41 (eager decrypt throws) |
| §4.10 recommendations 1 to 7 | #60, #61, #41, #99, #63, #20 and #119, #37 |
| §4.11 items 1 to 8 | #64, #111, #65, #108, #109, #110, #66, #67 |
| §4.12 items (4) | #27, #86, #45, #46 |
| §5 phases | replaced by the Next and Later lists |
| §6 decisions to revisit | #21, #127, #92, #26 |
| §7 success measures | #80, #87 |
| Appendix A defects 1 to 25 | 1 #1 · 2 #2 · 3 #52 · 4 #3 · 5 #9 · 6 #8 · 7 #10 · 8 #18 · 9 #17 · 10 #18 · 11 #13 · 12 #14 · 13 #29 · 14 #29 · 15 #74 · 16 #73 · 17 #74 · 18 #114 · 19 #4 · 20 #116 · 21 #72 · 22 #20 · 23 #61 · 24 #120 · 25 #75 |
| Appendix B key hierarchy | #24, #25, #26, #135, #103 |
| Appendix C attachments | #32, #33, #34, #88 |
| Operating model (this document) | #148, #147 |

## Appendix B: Coverage of the Codex review

| Codex section | Ledger IDs |
|---------------|-----------|
| Recommendation (complete journey; retain the architecture) | framing; no rewrite is a rule of this plan |
| What deserves preservation | "What stays out" and the design identity are protected in every phase |
| Competitive benchmarks (Apple ADP, Bear Web, Notion offline, Craft, Notesnook) | Scorecard corrected in the cross-check; no work items |
| First release: save state must describe durable state | #5, #6, #7, #58 |
| First release: encrypted revision history and independent recovery | #59, #118, #38 |
| First release: concurrent updates safe at the server | #35, #71, #69 |
| First release: isolate damaged records | #41 |
| Privacy 1: correct the practice-space promise | #15 |
| Privacy 2: protect incoming capture | #16, #47 |
| Privacy 3: encrypt semantic metadata | #101 |
| Privacy 4: usable recovery and key rotation; issue #170 (D1 salt, D19 rotation) | #24, #25, #26, #23, #136, #103, #22 |
| Privacy 5: browser key persistence and outbound data | #102, #40 |
| Privacy 6: independent security review | #104 |
| Next release: outline, find/replace, counts, folding, tables, footnotes | #97, #55, #54, #128, #127, #129 |
| Next release: preserve selection, undo, IME, paste, keyboard | #82 |
| Next release: PDF/print, Markdown, DOCX | #91, #17/05, #134 |
| Next release: one document-command model | #57 |
| Next release: versioned structured document format, no editor replacement | #31 |
| Capture: one action to a draft, private new-note URL, shortcuts, append capture, clipper | #45, #28, #44, #96, #145 |
| Retrieval: switcher, ranked search, filters, snippets, keyboard, saved searches | #42, #51, #50, #11, #43, #95 |
| Connections: note URLs, links/backlinks, lightweight collections | #28, #92, #140 |
| Scale: cache text, worker index, encrypted-at-rest index, virtualize results | #11, #51, #142, #99 and #100 |
| Attachments: images and PDFs, OCR, encrypted lifecycle | #34, #32, #33, #131, #132 |
| Migration: previewed imports, counts, real parser, per-note export | #89/b, #90, #78, #76 |
| Design critique P1 privacy and storage language | #15, #7 |
| Design critique P1 actionable failure status | #5 |
| Design critique P2 responsive command consistency | #57 |
| Design critique P2 preserve readable words | #49 |
| Design critique P2 capture and browser navigation | #45, #28 |
| Personas, cognitive load, accessibility | #68, #124, #107, #110 |
| Quality gates: browsers and devices | #81, #85 |
| Quality gates: fixture and journey list | #37, #79, #125 |
| Quality gates: stale E2E expectations | #19 |
| Quality gates: recommended targets | #80 |
| Sustainable: extract responsibilities | #63 |
| Sustainable: input path and dynamic imports; preserve offline assets | #62, #61 |
| Sustainable: migration ordering and drift | #36, #121 |
| Sustainable: willingness to pay and cost model | #126 |
| Sequence table and defer list | the Later list; #146 |
| Validation cohort of 8 to 12 writers | #87 |
| Heuristic score 25/40 | informational; its P1 and P2 items are mapped above |

## Appendix C: Codex plan review (2026-09-07) and what changed in 1.2

> Historical. "Phase" and "WP" below refer to the structure of version 1.2, replaced by the numbered lists in version 2.0. Item numbers have been substituted for the old IDs.

| # | Codex point | Verified against code | Change in this revision |
|---|-------------|-----------------------|-------------------------|
| 1 | The interim capture fix was a no-op: the URL is already scrubbed at init (`src/hooks/useShareTarget.ts:98`); the exposure is the initial GET request itself | Yes | #16 now removes the GET `share_target` in Phase 0; #47 (service-worker-intercepted POST with locked-vault handling and a no-plaintext-on-the-wire test) moves from Phase 2 to Phase 1 and no longer waits for the iOS share extension |
| 2 | A bare conditional update cannot distinguish a stale write from a missing row, and the zero-row path re-creates the note (`src/services/syncEngine.ts:634`); reinsertion resurrects remote deletes (`:380`); #75 purged before #69 settled the policy | Yes | #35 is now an RPC contract with four outcomes, mutation ids, and replay semantics, with S0-3 to S0-5 tests; #69 moved to Phase 1 and made a prerequisite of #75; a "Deletion policy" chain added to the spine |
| 3 | #25 "completes offline in seconds" was unsafe shorthand; both keys must be wrapped (`src/lib/encryption.ts:37`); passphrase change, device invalidation, and compromise rotation are different things | Yes | #23 is now a written prerequisite of #24 with the test list; #25 requires server confirmation before invalidating the old wrap and defines concurrent-change behaviour; #103 added for compromise rotation by re-encryption; interrupted-migration and old-device tests attached in Phase 1 |
| 4 | "No known way to lose words" overstated Phase 0; fault-injection and migration checks arrived later | Yes | Phase 0 exit rewritten as zero lost acknowledged edits across the named S0 set with tests shipped in the same PRs; #36 (schema guard plus release check against the deployment target) added to Phase 0 before the first database change; sequencing rules 6 and 7 added |
| 5 | Calendar estimates contradicted item sizes at one engineer | Yes | Calendar labels withdrawn; "Sizing and forecasting" section added with engineer-week totals per phase; Phase 1 split into Committed core and Proposed stretch; forecasting from measured throughput after Phase 0 |
| 6 | ID coverage is not acceptance coverage; Phase 3 had no "done when"; "Green", "Design reviewed", "Dashboard in CI" named activities not behaviour; #74 as written could cancel an intended delete (`src/components/NoteCard.tsx:50`); #19 also had to fix the anonymous-view test dropping the `#k=` fragment (`e2e/sharing.spec.ts:131`) | Yes | Every row now has behaviour plus evidence; Phase 3 has a gate column and a "done when" column; #74 rewritten as exactly-once with failure recovery and deliberate Undo; #19 rewritten to replace obsolete expectations including the fragment |
| 7 | Browser readiness should gate iOS; the Android wrapper does not establish iOS readiness; exploratory items need explicit gates; urgent trust fixes should cross phases | Accepted | #84/#105 split into a one-week spike (#84, Phase 1) and the shell (#105, gated on Phase 1 exit, a #81 device pass, and a spike "go"); a "Browser before native" chain added; every Phase 3 row carries a demand or measurement gate; the operating model allows trust fixes across phases |
| A | A Worker gives execution isolation, not protected persistent storage | Accepted | #102 rewritten to say exactly that and to point persistent protection at #135 and #106 |
| B | "JSON behind the same sanitizer" is insufficient; the sanitizer takes HTML strings (`src/utils/sanitize.ts:57`) | Yes | #31 rewritten: JSON is canonical with a `docVersion`, validated against the editor schema, HTML derived for display and export, older clients open newer documents read-only |
| C | Generate issues incrementally for ready work | Declined by the repository owner | The ledger and Board remain the tracker (#148) |
| 149 | Testing | Stabilize the existing PassphraseUnlock component tests under CPU contention; an untouched full-suite run timed out during typing and leaked partial input into the next case | days | No key-behavior changes | Repeated suite runs isolate cleanup and pass under load |

