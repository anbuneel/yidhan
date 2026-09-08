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
