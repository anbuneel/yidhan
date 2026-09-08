# Yidhan — working agreement

A calm, distraction-free, end-to-end-encrypted note-taking app. React 19 +
TypeScript + Vite, Tailwind v4, Tiptap, Supabase, Capacitor (Android).
Live at https://yidhan.vercel.app.

This file owns operating rules and architectural invariants — the things an agent
must not violate. It deliberately does **not** mirror the codebase: counts, field
lists and file inventories belong to the files that own them.

## Where things live

| Question | Owner |
|---|---|
| Why does this product exist? Who is it for? What will it never do? | `PRODUCT.md` |
| Why did it become this way? | `DECISIONS.md` |
| Colour, type, spacing, component rules, voice | `DESIGN.md` |
| What shipped, and when | `docs/progress.md` |
| What's deferred, and what's refused | `docs/roadmap.md` |
| What we're working on right now | the `Status: ACTIVE` plans in `docs/plans/` |
| Database schema, and the order to change it in | `docs/technical-spec.md` |
| Screen layouts, keyboard shortcuts, slash commands | `docs/ui-layout.md` |
| User-facing behaviour specs, incl. export and backup | `docs/reference/` |
| Why a review finding was rejected | `docs/reviews/` |
| Configuration how-to (OAuth, CI, E2E) | `docs/setup/` |
| Frozen history — **not authoritative for anything** | `docs/archive/` |

There is no doc index and no `status.md`. Glob and grep; the routing table above is
already in context.

## Working rules

**Retrieval lanes.** `docs/archive/` is excluded from default search by the repo-root
`.ignore`. It is frozen and describes surfaces that may no longer exist — a document
being there *is* the supersession notice. Never cite it as authority for current
behaviour. For archaeology use `rg --no-ignore` or a direct path. **Tools that bypass
ignore files — `grep`, `find`, `Select-String` — will happily return archive content;
scope them with a path or prefer `rg`.**

**Plans.** Live plans sit in `docs/plans/`, date-prefixed, opening with two plain-text
lines at column 0 — no bold, no emoji:

```
Status: PROPOSAL | ACTIVE | COMPLETE | SUPERSEDED
Last verified: YYYY-MM-DD
```

**One plan is ACTIVE**, enforced by `.githooks/pre-commit`. It was two while the
documentation overhaul ran alongside the product ledger; that shipped, so the cap is
back to one (`DECISIONS.md`, 2026-09-08). To open a second, close the first, or record
why in `DECISIONS.md` and raise `MAX_ACTIVE_PLANS`.
Intent shifts → the old plan flips to SUPERSEDED in the same commit that creates its
replacement. Work ships → it flips to COMPLETE and moves to `docs/archive/`. A
blocker's detail belongs in its GitHub issue; the plan links it and records only the
effect on the milestone.

**Decisions.** When a consequential choice is made, append to `DECISIONS.md` (newest
first) with the constraint that forced it and what was rejected. It is append-only: the
only permitted edits are flipping `Status` to `Superseded` and adding a dated erratum.

**Doc updates.** Significant changes update the owner from the routing table, and only
that owner. Also add a `src/data/changelog.ts` entry — that is a product surface
(release notes rendered in the app), not documentation.

**Review audits.** Write one only when findings were **rejected or disputed**. Otherwise
the PR thread is the record.

**Test where the feature should not fire, not just where it should.** A "done when"
says what the feature does, so tests written from it check only that. The bugs are
usually where new code meets old code. Write those cases first: does it fire from the
other surface, behind an open dialog, on the wrong element, or break after a remount?
Item 43 passed every check with six of these bugs, then passed again with one left
(`DECISIONS.md`, 2026-09-08).

**No agent-name file suffixes** (`-claude`, `-codex`) and no per-doc model attribution.
Date prefixes on dated artifacts are fine.

## Session economy

Context is the scarce resource. Each rule below costs a sentence and saves tens of
thousands of tokens.

**One lane per session.** A plan may batch six items; a session should not. Finish one
cohesive change, then start fresh with a short state summary. Holding `Editor.tsx` and
`syncEngine.ts` together is roughly 30k tokens of source before any reasoning happens.

**Never read a large file whole.** `changelog.ts`, `Editor.tsx`, `index.css`,
`syncEngine.ts` and `Editor.test.tsx` each exceed 10k tokens. Grep for the symbol, or
read a line range.

**The syncEngine tests are four files**, split by concern: `syncEngine.state`,
`.queue`, `.conflicts`, `.pull`. Module mocks live in `src/test/syncEngineMocks.ts`,
builders and `resetSyncTestState` in `src/test/syncEngineTestKit.ts` — add a mocked
dependency to the first, a builder to the second, never to the test files.

**Appending to `src/data/changelog.ts`:** entries are newest-first. Read `head -40`, then
insert the new entry directly after `export const changelog: ChangelogEntry[] = [`. Never
read the file whole.

**Run only the test file you changed** while iterating —
`npx vitest run src/services/<name>.test.ts`. Run `npm run check` once, before pushing,
not after every edit.

**Playwright is not in `npm run check`, but the suite does run in CI** — the `e2e` job
runs `npm run e2e` on every PR, so a red spec blocks the merge. Still do not run
`npm run e2e` by default; it is minutes. If you changed a flow it covers, run that spec
alone: `npx playwright test e2e/<name>.spec.ts --project=chromium --reporter=line`.
The authenticated specs need `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD` and
`E2E_TEST_PASSPHRASE` and skip without them.

**Never poll a subagent or a CI run.** Spawn independent agents in one message, then end
the turn — completion arrives as a notification. Re-checking "is it done yet" replays the
whole context each time. When only an external job remains, stop; do not keep reasoning
beside it.

**Don't delegate what you can do in three tool calls.** An agent costs a spawn, a wait and
a report. Multi-agent review is for changes touching encryption, sync or auth; a single
`/code-review` pass covers the rest.

## Commands

`package.json` is the full list. `npm run check` (typecheck + lint + test + build)
mirrors CI and must pass before pushing; CI also enforces coverage thresholds, so check
`npm run test:coverage` locally. `npm run e2e` runs against the dev server and produces
**no service worker** — `npm run e2e:sw` is the only suite that tests service worker
behaviour.

## Git workflow

Feature work goes through a branch and a PR. Small, low-risk changes (typos, doc
touch-ups) may go direct to main after `npm run check`.

`AGENTS.md` is generated from `CLAUDE.md` — never edit it directly. The pre-commit hook
regenerates and stages it from the staged blob. Arm hooks once with
`git config core.hooksPath .githooks`.

## Architectural invariants

Rules an agent would plausibly "clean up" and thereby break. `DECISIONS.md` holds the
incident history behind them.

**Service worker `registerType` stays `'autoUpdate'`** (`vite.config.ts`). Under
`'prompt'` a new worker parks in `waiting` until the page posts `SKIP_WAITING`, and a
client running stale code cannot post it — so browsers stay pinned to an old precached
shell indefinitely. Registration is explicit in `src/utils/serviceWorkerUpdates.ts`, not
vite-plugin-pwa's injected script, so the path is testable. Only `npm run e2e:sw` can
catch a regression here.

**Migrations are applied by hand.** A client shipped ahead of its migration fails **only
on writes**, silently, while reads keep working — which presents as a sync bug, not a
missing migration. Run `supabase/migrations/verify_migration_state.sql` in the SQL editor
after deploying; every row should read `applied`. `default_user_id_to_auth_uid.sql` is
**required**: clients stopped sending `user_id` on note and tag inserts, so without the
column default every create fails RLS (`42501`) or NOT NULL (`23502`) and blocks in the
sync queue.

**`reconcileNoteTags` runs a full paginated scan on every pull, not just on reconnect.**
`note_tags` has no `updated_at` column, so there is no incremental signal. Realtime is the
only steady-state signal for membership; gating the scan would leave a dropped event
uncorrected until the next reconnect. One membership scan per sync cycle is the accepted
cost. Revisit if `note_tags` gains a timestamp column.

**Server note rows must be encrypted.** `launch_security_hardening.sql` requires encrypted
payload metadata and empty plaintext `title`/`content` columns, and intentionally *fails*
if existing rows violate it. Do not reintroduce plaintext-note compatibility, a repair UI,
or the removed legacy plaintext APIs — lint checks that those service APIs have not
returned. If preflight reports unsafe rows, that is a data incident: fail closed.

**Encrypted reads fail closed — but a locked note is not a plaintext one.** Reads, realtime
upserts, sync pulls, conflict resolution and authenticated imports reject **plaintext**
payloads rather than degrading; one such row fails the whole read. No permissive fallback.
A note whose *ciphertext* will not open is different: it returns `decryptionFailed` with
empty title and content and renders as a locked card (`NoteDecryptionError.reason`). It is
never opened in the editor and never saved over — an empty autosave would destroy
ciphertext another device can still read — and exports omit it and report the count.

**Fonts are self-hosted and never fetched from Google Fonts.** Subsets live in
`src/assets/fonts/`, declared in `src/fonts.css`; `font-src 'self'` only in `vercel.json`.
The service worker precaches them — **no runtime font caching**, and never a
`statuses: [0, 200]` cache, which can pin a browser to fallback fonts permanently.
Upstream licences in `public/licenses/fonts/` must travel with the fonts.

**Server timestamps are authoritative on UPDATE only.** `notes_updated_at_trigger` fires
on UPDATE to defeat client clock skew; INSERT deliberately preserves client-supplied
timestamps so imports keep their original chronology.

**Self-echo suppression.** A `pendingMutations` set stops realtime from re-applying the
client's own changes. Removing it causes write loops.

## Security invariants

- **RLS on every table**; all note and tag operations are scoped to the authenticated
  user. Public share access goes through the ciphertext-only `fetch_shared_note` RPC —
  **not** a public table SELECT policy.
- **E2EE:** title + content encrypted together as a JSON blob, AES-256-GCM with AAD
  (`noteId:userId`) to prevent note-swapping. Keys derived from the passphrase via
  Argon2id (`hash-wasm`). **Tags and metadata stay plaintext** — an accepted, documented
  trade (`DECISIONS.md`), not an oversight to fix casually.
- **Key storage:** React state plus sessionStorage; optional localStorage via opt-in
  "Remember this browser" (default off). Every restore path — including refresh-time
  sessionStorage — must verify `encryption_key_check` before unlocking, so a stale key
  after a passphrase change is caught. The blob checksum is FNV-1a for corruption
  detection only; `verifyKeyCheck()` is the security gate. **Fails closed:** if
  localStorage is unavailable, the preference is not enabled.
- **Lock reason changes behaviour:** `auto-lock` preserves localStorage for silent
  re-unlock; `manual` and `sign-out` clear all storage.
- **Re-auth for deletion:** email/password users verify by password; Google/GitHub users
  need a server-checked email OTP. Typed-email confirmation is not proof.
- **Share as Letter:** per-share random AES-256-GCM key lives in the URL fragment (`#k=…`),
  so it never reaches the server. Max 30-day TTL, capped in the database.
- **Sanitization** (`src/utils/sanitize.ts`): `sanitizeHtml` strips arbitrary classes and
  unsafe inline styles and adds `rel="noopener noreferrer"` to external links. Note titles
  are sanitized with DOMPurify. Imported HTML blocks are sanitized before use.
- **Import limits:** 10MB file, 1000 notes, strict schema validation. Tag names 1–20
  chars, enforced client- and server-side.
- **Passwords:** account minimum 8 characters; E2EE passphrases minimum 12 plus a strength
  policy, enforced in both the UI and `EncryptionContext`.
- **Sentry:** a breadcrumb scrubber strips encrypted fields before send. Auth errors are
  mapped to user-friendly text to avoid information disclosure.
- **Never hardcode colours** — use the theme tokens (`DESIGN.md`).

## Sync engine

Offline-first: IndexedDB (Dexie) → sync queue → Supabase, every payload encrypted. The
mechanics live in `src/services/syncEngine.ts`. Five things not to change:

- **noteTag entries force batch barriers** in `buildQueueBatches()` — removing the barrier
  reorders tag writes against the notes they depend on.
- Note writes use `.maybeSingle()`: a zero-row update rebuilds the row from the local
  encrypted record rather than blocking on `PGRST116`.
- Stale entries (over 24h, 3+ retries, non-create) auto-block, so repeated failures stay
  recoverable instead of stuck in permanent "pending".
- Conflict previews decrypt both versions in memory and save the unchosen content as a
  separate copy *before* resolving.
- Startup hydration uses local metadata and merge behaviour so recovery paths cannot clear
  queued local work.

**Persistent storage:** an unsynced note lives only in IndexedDB, which browsers may clear
under disk pressure. `useStoragePersistence` requests `navigator.storage.persist()` on
launch and on `appinstalled`. Native counts as granted; a browser without the API is not
flagged; an API that *throws* counts as denied, because only a grant makes storage safe.

## Area notes

**Editor** — content is Tiptap `getHTML()`, encrypted before storage. Toolbar lives in
`EditorToolbar.tsx` (`variant: 'inline' | 'bottom'`); the ≥1100px vertical sidebar in
`EditorSidebar.tsx` supplements rather than replaces it. Focus mode uses a parent-class
strategy: `focus-mode-active` on the scroll container fades descendant
`.focus-mode-target` elements. Autosave debounces 800ms with a 10-second checkpoint;
"Synced" requires the server-confirmed content hash to match. Save failures retain the
draft with persistent Retry/Copy controls. The manuscript glow is positioned by a
ref-based `requestAnimationFrame` scroll handler — zero re-renders; keep it that way.

**Library** — search filters `displayNotes` by debounced query over title and plaintext
content, reusing a cache keyed by note content hash. Progressive rendering suspends during
search so all matches render at once; chapters force-expand. Search-empty ("No thoughts
found") is deliberately distinct from library-empty ("Your notes await").

**Lazy chunks** — mid-session service worker activation can invalidate lazy chunk URLs.
`lazyWithRetry` plus the `unhandledrejection` handler in `main.tsx` recover with one
cooldown-guarded reload.

## Environment

```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
VITE_SENTRY_DSN=...        # optional — leave empty to disable
```

Deployed on Vercel, auto-deploying from `main`. `vercel.json` holds the rewrites for
`/s/*` share routes, app-wide security headers, and no-store cache headers on shared note
pages. When deploying to a new domain, update Supabase → Authentication → URL
Configuration (Site URL and Redirect URLs) or OAuth will break.

## Writing style

Write in plain, direct language. Lead with what happened and what I need to do. No
literary phrasing, no build-up, no flourishes. Keep sentences short.

This applies to everything you write: chat replies, docs, code comments, commit messages,
and PR descriptions.
