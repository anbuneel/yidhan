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
- Items marked `—` came from the product roadmap and never had a ledger number.

To start work on an item, move it into the ACTIVE plan and delete it from here.

---

## Deferred work

### Keys and privacy

| # | Item | Effort | Needs |
|---|------|--------|-------|
| 24 | Wrapped master key: keep the derived key pair as `K`; derive a KEK from the passphrase with a fresh salt; store `wrap(KEK, K)` in `user_metadata` with a version flag; migrate on next unlock | weeks | Needs #23, #36 |
| 25 | Passphrase change by re-wrapping `K` | days | Needs #24 |
| 26 | Recovery kit: random 256-bit key, `wrap(RK, K)`, shown once as grouped base32 with print and copy, confirmation required; unlock via recovery key then set a new passphrase | weeks | Needs #24 |
| 38 | Encrypted backup export (`.yidhan`: v2 JSON under a backup key) and import | days |  |
| 39 | Threat-model page at `/security` in the product voice; `security.txt`; states visible metadata (timestamps, sizes, tag names until #101) | days |  |
| 40 | Outbound data audit: Sentry allowlisted fields, URLs, demo and capture paths, error strings | days |  |
| 41 | One undecryptable note renders as a locked card with retry; library stays usable; exports report incomplete | days |  |
| 47 | Private capture: POST `share_target` with `multipart/form-data` intercepted by the service worker; content stored locally in IndexedDB and encrypted immediately when the vault is unlocked; when locked, held locally in a "waiting for unlock" state and encrypted on unlock; never sent to any server unencrypted; failure and fallback paths defined | weeks | Needs #28, service-worker test harness |
| 101 | Encrypt tag names (and future collection and attachment names) with AAD `tagId:userId`; append-only migration | weeks | Needs #24, #36 |
| 102 | Key exposure at rest, stated honestly: on the web the unlocked key is held in a dedicated Worker so page scripts cannot read it directly (execution isolation, which limits but does not remove XSS reach); persistent protection comes only from a platform keystore (native, #106) or a passkey-wrapped blob (#135); "Remember this browser" copy states the device and XSS exposure plainly | weeks |  |
| 103 | Compromise rotation: generate a new `K`, re-encrypt every note and attachment under it with sync paused, re-wrap, then resume; distinct from the #25 passphrase change | weeks | Needs #24, #23 |
| 104 | Independent security review covering encryption, migrations, auth, deletion, sharing, recovery, and delivery chain; before broad public assurances | external review | Needs #24, #101 |
| 106 | Biometric unlock on native: remembered blob held in the secure keystore behind Face ID or fingerprint | weeks | Needs #24, #105 |
| 135 | Passkey unlock on the web via WebAuthn PRF | weeks | Start when #24 shipped; PRF support in the cohort's browsers measured |
| 136 | Move the salt out of `user_metadata` (issue #170 D1) | days | Start when #24 shipped |

### Sync

| # | Item | Effort | Needs |
|---|------|--------|-------|
| 35 | Server write contract: an RPC `update_note_checked(note_id, expected_hash, expected_updated_at, client_mutation_id, payload)` that returns one of `updated`, `stale` (with the current server row), `missing`, `forbidden`; `client_mutation_id` stored so a replay after a lost response returns the original result; `stale` raises a conflict with both versions preserved; `missing` alone may trigger the local rebuild path; `forbidden` blocks with its reason | days | Needs #36 |
| 69 | Deletion policy, decided before anything purges: a queued update for a note hard-deleted or purged elsewhere becomes a conflict ("this note was released on another device: restore or discard"), never a silent reinsertion; a permanently failing `create` expires into a blocked state the user can export or discard | days | Needs #35 |
| 70 | Tombstones for notes and tags written by trigger and pulled by cursor; end the two full-table sweeps | weeks | Needs #36 |
| 71 | Cross-tab queue ownership with the Web Locks API or a recoverable lease | days |  |
| 72 | `isRetryableError` classifies by error code and type, not substrings; `delete` no longer string-matches "0 rows" | days |  |
| 73 | `fadedNotesCount` derived from data, not incremented optimistically | days |  |
| 74 | Card deletion is exactly-once with deliberate undo: the delete action runs once whether the animation finishes or the card unmounts; a failed delete restores the card with a message; Undo is the only cancellation path | days |  |
| 75 | Server-side `pg_cron` purge for faded notes instead of client-load purge | days | Needs #69, #70 |
| 143 | Delta uploads instead of the full blob per autosave | weeks | Start when #118 shipped and #80 shows autosave payloads above 100 KB in normal use |
| 144 | Evaluate Yjs or Automerge for note bodies | a month or more | Start when #143 shipped and conflicts exceed one per user-week in the cohort |

### Saving

| # | Item | Effort | Needs |
|---|------|--------|-------|
| 58 | Revision id on every save; the UI acknowledges a specific revision; the #35 RPC carries it | days | Needs #35 |
| 59 | Bounded local encrypted revision history per note (last 20 snapshots or 7 days), preview, restore, save-as-copy; snapshot before conflict resolution | weeks | Needs #58 |
| 118 | Revision history synced so recovery survives a lost device; retention and deletion defined | weeks | Needs #59, #38 |
| 119 | Remove `savePhaseTimeoutRef` dead code; stop listener churn in the visibility effect | days |  |

### Editor

| # | Item | Effort | Needs |
|---|------|--------|-------|
| 31 | Structured document format: ProseMirror JSON is the canonical stored form with a `docVersion` inside the encrypted payload; a schema validator (node and mark allow-list checked with the editor schema, not DOMPurify) rejects unknown or malformed nodes on read and write; HTML is derived from JSON for cards, exports, and letters and still passes `sanitizeHtml`; older clients that meet a newer `docVersion` open the note read-only with an "update Yidhan to edit" notice | weeks | Needs #36 |
| 34 | Images in the editor: paste, drop, slash command; 5 MB cap, 2048 px downscale, WebP; blob URLs at render | a month or more | Needs #32 |
| 52 | Markdown paste through `handlePaste` and `markdownToHtml` | days |  |
| 53 | Typography extension: smart quotes, dashes, ellipsis | days |  |
| 54 | Word and character count, reading time, hover-revealed in the title-zone metadata | days |  |
| 55 | Find and replace in note: `Cmd+F`, next and previous, decoration highlights | days |  |
| 56 | Toolbar and sidebar subscribe to editor transactions so active states stay fresh | days |  |
| 57 | One command model: same capability set in sidebar, inline toolbar, mobile bar, slash menu, shortcuts, with overflow by width; fixes the hidden inline toolbar at 1100 px and wider; text-align gets UI or the extension is dropped; inline code button | weeks |  |
| 97 | Heading outline for long notes, hover-revealed on desktop | weeks |  |
| 112 | `spellcheck` and `lang` on the editor; remove the dead `prose-editor` class | days |  |
| 113 | Code block language and highlighting via lowlight | days | Needs #31 |
| 114 | Undo history isolated per note (`setContent` with history cleared, `emitUpdate: false`) | days |  |
| 115 | Untouched new note fades silently on leave | days |  |
| 116 | Slash menu flips and clamps to the viewport and follows scroll; renderer lifecycle bug on Escape fixed | days |  |
| 117 | Overflow menu: touch and scroll close, `menuitem` roles, arrow keys | days |  |
| 127 | Simple tables (Tiptap Table, no formulas, no sorting) | weeks | Start when #31 shipped and the cohort asks for tables |
| 128 | Heading folding | weeks | Start when #97 shipped and long notes over 3,000 words exceed 10 % of the cohort's notes |
| 129 | Footnotes | weeks | Start when #31 shipped and cohort demand |
| 130 | Replace triple-tap focus mode with a gesture that does not fight the OS | days | Start when Real-device testing (#81) records a conflict |
| — | Typewriter mode: keep the current line vertically centred, smooth scroll while typing | weeks |  |

### Library

| # | Item | Effort | Needs |
|---|------|--------|-------|
| 30 | List view: one line per note, toggle in header, remembered per device | weeks |  |
| 48 | Sort and chapter basis: last edited or created; within chapter by edited, created, title | days |  |
| 49 | Card preview mask only when text overflows; cap age fade at 0.9 | days |  |
| 92 | Note links: `[[` opens the switcher and inserts `/n/<id>`; titles resolve client-side; "Mentioned in" list at the bottom | weeks | Needs #28, #42, #31 |
| 93 | Tag quality of life: search in selector, rename preserves assignments, Tags page with counts, `#tag` autocomplete in the editor | days |  |
| 94 | Templates (notes tagged `template`) and a "Today" daily page in the palette | days | Needs #42 |
| 95 | Saved searches in the palette | days | Needs #42, #50 |
| 98 | Multi-select and bulk actions in list view only: tag, pin, fade, export | weeks | Needs #30 |
| 99 | Virtualize the list view once measured at 2,000 notes | weeks | Needs #30 |
| 111 | Pinned chapter as a compact row when it holds fewer than three notes | days |  |
| 139 | "Set aside" true archive action | days | Start when #30 shipped and the cohort asks for an archive |
| 140 | Lightweight named collections | weeks | Start when #95 shipped and the cohort still asks for collections |

### Search

| # | Item | Effort | Needs |
|---|------|--------|-------|
| 50 | Query semantics: multi-term AND, quoted phrases, `tag:`, `is:pinned`, `before:`, `after:`; all matches highlighted | days | Needs #11 |
| 51 | In-memory index (MiniSearch or FlexSearch) with ranking and fuzziness, incremental rebuild; moved to a worker if the main thread shows it | days | Needs #11 |
| 100 | Search results honour progressive rendering and virtualization instead of rendering every match at once | days | Needs #99 |
| 142 | Persisted encrypted search index | weeks | Start when #80 shows load-time indexing above 500 ms at the cohort's library size |

### Navigation

| # | Item | Effort | Needs |
|---|------|--------|-------|
| 28 | Note URLs: `/n/<id>`, `/faded`, `/`; history push and pop; scroll restore; routing extracted to `src/routing/` | weeks |  |
| 29 | Faded view routeable; editor with a missing note redirects instead of `return null` | days |  |
| 42 | Quick switcher and command palette: `Cmd+K` focuses it in the library, `Cmd+P` opens it anywhere, `>` lists actions, arrow keys and Enter | weeks | Needs #28 |
| 43 | Keyboard navigation over cards: arrows or j/k, Enter, p, t, Delete with undo | days |  |
| 44 | Quick capture: PWA `shortcuts` "New note" to `/n/new`; `Cmd+N` inside the editor | days | Needs #28 |
| 45 | "Start writing" reaches an editable draft in one action on desktop and mobile; mobile landing CTA opens a new Practice Space note | days |  |
| 96 | Append-to-existing-note capture (append to today's page from the share target) | days | Needs #47, #94 |
| 145 | Browser clipper with encrypted staging | a month or more | Start when #47 shipped and cohort demand |

### Import and export

| # | Item | Effort | Needs |
|---|------|--------|-------|
| 76 | Per-note Markdown export in a real zip with front matter | days | Needs #78 |
| 77 | Timestamps, tag colours, and pinned state preserved on every import path | days |  |
| 78 | Real Markdown parser and serializer with fixtures, replacing the regex chain | weeks |  |
| 89 | Importers: Markdown folders and zips, Bear and TextBundle, Notion export, Apple Notes export workflows, Obsidian folders with `[[links]]` mapped to #92 | weeks | Needs #78 |
| 90 | Import preview before, counts and reconciliation after, unsupported formatting explained | days | Needs #89 |
| 91 | Print stylesheet and readable PDF via print | days |  |
| 133 | Evernote `.enex` importer with attachments | weeks | Start when #34 shipped |
| 134 | DOCX export | weeks | Start when #78 shipped and cohort demand |

### Sharing

| # | Item | Effort | Needs |
|---|------|--------|-------|
| 122 | Optional passphrase on a letter (second wrap of the share key) | days |  |
| 123 | "Refresh this letter" re-encrypts under the existing token; opt-in live letters | days |  |
| 141 | Public Garden as static pre-rendered pages | a month or more | Start when #28 and #34 shipped, and at least a quarter of the cohort asks to publish |

### Pictures and files

| # | Item | Effort | Needs |
|---|------|--------|-------|
| 32 | Attachment model: per-attachment key inside the note payload; Supabase Storage under `attachments/<userId>/<id>` with path RLS; Dexie blob table; sanitizer allows `img[data-attachment-id]` only and never an external `src` | weeks | Needs #31, #24 |
| 33 | Encrypted originals, filenames, thumbnails, and manifests; resumable upload; offline availability; quota handling; orphan cleanup; included in export and backup | weeks | Needs #32 |
| 88 | Letters carry attachments; Markdown zip includes an `attachments/` folder; encrypted backup includes them | days | Needs #34, #38 |
| 131 | PDFs as attachments | weeks | Start when #34 shipped |
| 132 | Local OCR for images and PDFs | a month or more | Start when #131 shipped and search for image text is requested by the cohort |

### Phone

| # | Item | Effort | Needs |
|---|------|--------|-------|
| 83 | Remove the doubled title in the mobile editor; `h-screen` to `100dvh` | days |  |
| 84 | iOS keyboard feasibility spike (one week, needs a Mac): Capacitor shell with the current editor; measure keyboard height tracking, selection, and focus mode in WKWebView; decide go or no-go for #105 | days |  |
| 85 | Real-device testing checklist per release (keyboards, installed PWA, gestures) | days |  |
| 105 | iOS Capacitor project: haptics, status bar, keyboard, share sheet, secure storage; App Store privacy labels; TestFlight | weeks | Start when items 1 to 22 and the recovery key (#23 to #27) have shipped, a real-device browser pass (#81) is recorded, and the keyboard spike (#84) says go |
| 107 | Touch targets under 44 px on narrow layouts fixed; metadata and navigation legibility on phones | days |  |
| 137 | Home-screen widget (quick capture, today's page), share extension, Siri Shortcuts | a month or more | Start when #105 in the App Store |
| 138 | Landscape and iPad: max line length, sidebar at the iPad breakpoint | weeks | Start when #105 in the App Store |

### Design

| # | Item | Effort | Needs |
|---|------|--------|-------|
| 64 | Manuscript grows with content; minimum height about 60 vh | days |  |
| 65 | Title capped at two lines with a smaller size past 60 characters; mirrors body H1 metrics | days |  |
| 66 | Edge states designed: locked note, offline editor, failed sync, expired letter, on-this-device-only | days |  |
| 67 | Playwright axe pass in CI; reduced motion and contrast checks per theme | days | Needs #37 |
| 68 | Screen-reader verification: editor labelling, status announcements, focus order, modal behaviour | days |  |
| 108 | Card-to-manuscript view transition and its reverse, progressive enhancement | weeks | Needs #28 |
| 109 | Reading settings: text size (three steps), line length, body typeface; expose Washi and Mori | days |  |
| 110 | In-product hints: one per first three notes; empty search suggests an operator; no tour | days |  |
| 124 | Task tests for long titles, dense tags, RTL, Tamil and CJK input, zoom, real virtual keyboards | days |  |
| — | Landing page redesign: remove the inline demo, surface the Practice Space CTA, add trust signals | days |  |
| — | App icon and OG image as shippable branding assets | days |  |

### Onboarding

| # | Item | Effort | Needs |
|---|------|--------|-------|
| 27 | Passphrase setup rewritten as three steps: passphrase, recovery key, done | days | Needs #26 |
| 46 | Practice Space to account in one step is the primary demo CTA | days |  |
| 86 | Custom SMTP for auth email; magic-link sign-in | weeks |  |
| — | Additional OAuth providers, Apple Sign-In first | days |  |

### Speed and code

| # | Item | Effort | Needs |
|---|------|--------|-------|
| 60 | Prerender `/`, `/privacy`, `/terms`, `/support`, `/changelog`, `/roadmap`; hydrate only theme toggle and CTA | weeks |  |
| 61 | Defer Supabase to first auth, `hash-wasm` to `deriveKey`, Sentry replay via `lazyLoadIntegration`; split the demo page; fix the React chunk; resolve the five static-plus-dynamic import warnings; keep offline assets and font licences precached | days |  |
| 62 | Input-path work: stop lifting `getHTML()` into `Editor` state on every keystroke; stop re-attaching visibility listeners per character; measure KDF and library decryption | weeks |  |
| 63 | Decompose `App.tsx` and `Editor.tsx`: routing, `useNotesSync`, `useImport`, `useDemoMigration`, `useShareTarget`, `PublicPage`; clear interfaces for persistence, note lifecycle, search, attachments, vault | weeks | Needs #28 |
| 120 | Fix set-state-during-render (`ChapterSection`, `TimeRibbon`); retire react-doctor suppressions progressively | days |  |
| 121 | Migration ordering and drift verification automated in CI against a staging database, plus the release-time check against production from #36 | weeks | Needs #36 |

### Testing

| # | Item | Effort | Needs |
|---|------|--------|-------|
| 79 | Journeys, first half: continuous typing, interrupt, reload, recover; two tabs with one offline; network flaps, expired auth, rejected writes, quota pressure, denied persistence, blocked mutations | weeks | Needs #37 |
| 80 | Acceptance targets measured nightly on a defined device and dataset: warm launch to editable p95 under 1 s; typing p95 under 100 ms; search p95 under 200 ms at 10k notes; cross-device visibility p95 under 5 s; zero lost acknowledged edits in fault injection; backup restores in a fresh profile | weeks | Needs #37 |
| 81 | Cross-browser matrix: Chrome, Edge, Firefox, Safari; real iPhone, iPad, Android; installed PWA | days |  |
| 82 | Editor fixture tests: selection preserved, native undo, IME composition, paste fidelity, mobile keyboard | days |  |
| 125 | Journeys, second half: PWA upgrade with dirty work and lazy chunks; import, export, restore with nested formatting, Unicode, attachments, links; lock, sign out, rotate, recover, older offline device; account deletion gates | weeks | Needs #79, #24, #103 |

### Process

| # | Item | Effort | Needs |
|---|------|--------|-------|
| 126 | Test willingness to pay before promising unlimited attachments and backups; model storage, transfer, retention, support, and review costs; Bloom tier | days | Needs #87 |
| 146 | Re-validate Quiet Intelligence against the privacy and writing goals; keep publishing, collaboration, databases, graph view, and cloud AI deferred until demand is observed | days | Start when #87 findings available |
| 147 | Keep `docs/prd.md`, `docs/roadmap.md`, and `src/data/roadmap.ts` in step with each shipped phase; mark ledger items done with their PR | days | Start when every phase exit |
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
