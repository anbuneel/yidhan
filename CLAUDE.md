# Yidhan — working agreement

A calm, distraction-free, end-to-end-encrypted note-taking app. React 19 +
TypeScript + Vite, Tailwind v4, Tiptap, Supabase, Capacitor (Android).
Live at https://yidhan.vercel.app.

This file is always in context. It owns operating rules and architectural
invariants — the things an agent must not violate. It deliberately does **not**
mirror the codebase: counts, field lists and file inventories belong to the files
that own them.

## Where things live

| Question | Owner |
|---|---|
| Why does this product exist? Who is it for? What will it never do? | `PRODUCT.md` |
| Why did it become this way? | `DECISIONS.md` |
| Colour, type, spacing, component rules, voice | `DESIGN.md` |
| What shipped, and when | `docs/progress.md` |
| What's deferred, and what's refused | `docs/roadmap.md` |
| What we're working on right now | the one `Status: ACTIVE` plan in `docs/plans/` |
| Database schema | `docs/technical-spec.md` |
| Screen layouts, keyboard shortcuts, slash commands | `docs/ui-layout.md` |
| User-facing behaviour specs | `docs/reference/` |
| Configuration how-to (OAuth, CI, E2E) | `docs/setup/` |
| Frozen history — **not authoritative for anything** | `docs/archive/` |

There is no doc index and no `status.md`. Glob and grep; the routing table above is
already in context.

## Working rules

**Retrieval lanes.** `docs/archive/` is excluded from default search by the
repo-root `.ignore`. It is frozen, flat, unindexed, and describes surfaces that may
no longer exist — a document being there *is* the supersession notice. Never cite it
as authority for current behaviour. For archaeology use `rg --no-ignore` or a direct
path. **Tools that bypass ignore files — `grep`, `find`, `Select-String` — will
happily return archive content; scope them with a path or prefer `rg`.**

**Plans.** Live plans sit in `docs/plans/`, date-prefixed, opening with two
plain-text lines at column 0 — no bold, no emoji:

```
Status: PROPOSAL | ACTIVE | COMPLETE | SUPERSEDED
Last verified: YYYY-MM-DD
```

**At most one plan is ACTIVE**, enforced by `.githooks/pre-commit`. Intent shifts →
the old plan flips to SUPERSEDED in the same commit that creates its replacement.
Work ships → it flips to COMPLETE and moves to `docs/archive/`. A blocker's detail
belongs in its GitHub issue; the plan links it and records only the effect on the
milestone.

**Decisions.** When a consequential choice is made, append to `DECISIONS.md`
(newest first) with the constraint that forced it and what was rejected. It is
append-only: the only permitted edits are flipping `Status` to `Superseded` and
adding a dated erratum. It carries no live state.

**Doc updates.** Significant changes update the owner from the routing table, and
only that owner. Also add a `src/data/changelog.ts` entry — that is a product
surface (release notes rendered in the app), not documentation.

**Review audits.** Write one only when findings were **rejected or disputed**.
Otherwise the PR thread is the record.

**No agent-name file suffixes** (`-claude`, `-codex`) and no per-doc model
attribution — they encode who typed a file, not what it is. Date prefixes on dated
artifacts are fine.

## Commands

`package.json` is the full list. The ones worth knowing:

```bash
npm run dev            # Dev server
npm run check          # typecheck + lint + test + build — mirrors CI, run before pushing
npm run test:coverage  # CI additionally enforces coverage thresholds; check locally
npm run e2e            # Playwright E2E (dev server — produces NO service worker)
npm run e2e:sw         # Service worker update tests (real production build)
npm run cap:android    # Build, sync, open Android Studio
npm run theme:generate # Regenerate theme CSS from src/themes/
npm run docs:sync-agents:check  # CI check that AGENTS.md matches CLAUDE.md
```

## Git workflow

Feature work always goes through a branch and a PR:

```bash
git checkout -b feature/name
npm run check                      # must pass
git add . && git commit -m "feat: ..."
git push -u origin feature/name
```

Small, low-risk changes (typos, doc touch-ups) may go direct to main after
`npm run check`.

`AGENTS.md` is generated from `CLAUDE.md` — never edit it directly. The pre-commit
hook regenerates and stages it from the staged blob. Arm hooks once with
`git config core.hooksPath .githooks`.

## Architectural invariants

These are the rules an agent would plausibly "clean up" and thereby break. Each
states what must hold and what goes wrong if it changes.

**Service worker `registerType` stays `'autoUpdate'`** (`vite.config.ts`).
Under `'prompt'` a new worker parks in `waiting` until the page posts
`SKIP_WAITING` — and a client running stale code cannot post it, so browsers stay
pinned to an old precached shell indefinitely. This is what stranded clients on
pre-hardening code against a migrated database. Registration is explicit in
`src/utils/serviceWorkerUpdates.ts`, not vite-plugin-pwa's injected script, so the
path is testable. **The main E2E suite cannot catch a regression here** — it runs
against the dev server, which produces no service worker at all. That is why
`npm run e2e:sw` exists, and why the original breakage went unnoticed.

**Migrations are applied by hand.** A client shipped ahead of its migration fails
**only on writes**, silently, while reads keep working — which presents as a sync
bug, not a missing migration. Run `supabase/migrations/verify_migration_state.sql`
in the SQL editor after deploying; every row should read `applied`.
`default_user_id_to_auth_uid.sql` is **required**: clients stopped sending
`user_id` on note and tag inserts, so without the column default every create fails
RLS (`42501`) or NOT NULL (`23502`) and blocks in the sync queue.

**`reconcileNoteTags` runs a full paginated scan on every pull, not just on
reconnect.** `note_tags` has no `updated_at` column, so there is no incremental
signal. Realtime is the only steady-state signal for membership; gating the scan
would leave a dropped event uncorrected until the next reconnect. The cost is one
membership scan per sync cycle — accepted deliberately. Revisit if `note_tags`
gains a timestamp column.

**Server note rows must be encrypted.** `launch_security_hardening.sql` requires
encrypted payload metadata and empty plaintext `title`/`content` columns, and
intentionally *fails* if existing rows violate it. Do not reintroduce
plaintext-note compatibility, a repair UI, or the removed legacy plaintext APIs —
lint checks that those service APIs have not returned. If preflight reports unsafe
rows, that is a data incident: fail closed.

**Encrypted reads fail closed.** Reads, realtime upserts, sync pulls, conflict
resolution and authenticated imports all reject plaintext note payloads rather than
degrading. Do not add a permissive fallback.

**Fonts are self-hosted and never fetched from Google Fonts.** Subsets live in
`src/assets/fonts/`, declared in `src/fonts.css`; `font-src 'self'` only in
`vercel.json`. The service worker precaches them — **no runtime font caching**, and
never a `statuses: [0, 200]` cache, which can pin a browser to fallback fonts
permanently. Upstream licences in `public/licenses/fonts/` must travel with the
fonts.

**Server timestamps are authoritative on UPDATE only.**
`notes_updated_at_trigger` fires on UPDATE to defeat client clock skew; INSERT
deliberately preserves client-supplied timestamps so imports keep their original
chronology.

**Self-echo suppression.** A `pendingMutations` set stops realtime from
re-applying the client's own changes. Removing it causes write loops.

## Security invariants

- **RLS on every table**; all note and tag operations are scoped to the
  authenticated user. Public share access goes through the ciphertext-only
  `fetch_shared_note` RPC — **not** a public table SELECT policy.
- **E2EE:** title + content encrypted together as a JSON blob, AES-256-GCM with AAD
  (`noteId:userId`) to prevent note-swapping. Keys derived from the passphrase via
  Argon2id (`hash-wasm`). **Tags and metadata stay plaintext** — an accepted,
  documented trade (`DECISIONS.md`), not an oversight to fix casually.
- **Key storage:** React state plus sessionStorage; optional localStorage via
  opt-in "Remember this browser" (default off). Every restore path — including
  refresh-time sessionStorage — must verify `encryption_key_check` before
  unlocking, so a stale key after a passphrase change is caught. The blob checksum
  is FNV-1a for corruption detection only; `verifyKeyCheck()` is the security gate.
  **Fails closed:** if localStorage is unavailable, the preference is not enabled.
- **Lock reason changes behaviour:** `auto-lock` preserves localStorage for silent
  re-unlock; `manual` and `sign-out` clear all storage.
- **Re-auth for deletion:** email/password users verify by password; Google/GitHub
  users need a server-checked email OTP. Typed-email confirmation is not proof.
- **Share as Letter:** per-share random AES-256-GCM key lives in the URL fragment
  (`#k=…`), so it never reaches the server. Max 30-day TTL, capped in the database.
- **Sanitization** (`src/utils/sanitize.ts`): `sanitizeHtml` strips arbitrary
  classes and unsafe inline styles and adds `rel="noopener noreferrer"` to external
  links. Note titles are sanitized with DOMPurify.
- **Import limits:** 10MB file, 1000 notes, strict schema validation. Tag names
  1–20 chars, enforced client- and server-side.
- **Passwords:** account minimum 8 characters; E2EE passphrases minimum 12 plus a
  strength policy, enforced in both the UI and `EncryptionContext`.
- **Sentry:** a breadcrumb scrubber strips encrypted fields before send. Auth errors
  are mapped to user-friendly text to avoid information disclosure.
- **Never hardcode colours** — use the theme tokens (`DESIGN.md`).

## Sync engine notes

Offline-first: IndexedDB (Dexie) → sync queue → Supabase, every payload encrypted.

- Queue entries use `pending` / `blocked` state so repeated failures stay
  recoverable instead of being dropped. `lastError` retains the Postgres code and
  surfaces in the sync indicator.
- Note writes use `.maybeSingle()`: a zero-row update rebuilds the row from the
  local encrypted record rather than blocking on `PGRST116`. `add_tag` treats a
  foreign-key violation (`23503`) as an ordering problem and retries.
- Stale entries (over 24h, 3+ retries, non-create) auto-block, preventing permanent
  "pending" state.
- `buildQueueBatches()` runs batches with bounded concurrency;
  **noteTag entries force batch barriers** — removing the barrier reorders tag
  writes against the notes they depend on.
- Conflicts route through a typed `SyncConflictError`. Conflict previews decrypt
  both versions in memory and save the unchosen content as a separate copy *before*
  resolving.
- Startup hydration uses local metadata and merge behaviour so recovery paths
  cannot clear queued local work.
- **Persistent storage:** an unsynced note lives only in IndexedDB, which browsers
  may clear under disk pressure. `useStoragePersistence` requests
  `navigator.storage.persist()` on launch and on `appinstalled`. Native counts as
  granted; a browser without the API is not flagged; an API that *throws* counts as
  denied, because only a grant makes storage safe.

## Area notes

**Editor** — content is Tiptap `getHTML()`, encrypted before storage. Toolbar lives
in `EditorToolbar.tsx` (`variant: 'inline' | 'bottom'`); the ≥1100px vertical
sidebar in `EditorSidebar.tsx` supplements rather than replaces it. Focus mode uses
a parent-class strategy: `focus-mode-active` on the scroll container fades
descendant `.focus-mode-target` elements. Autosave debounces 800ms with a 10-second
checkpoint; "Synced" requires the server-confirmed content hash to match. Save
failures retain the draft with persistent Retry/Copy controls. The manuscript glow
is positioned by a ref-based `requestAnimationFrame` scroll handler — zero
re-renders; keep it that way.

**Library** — search filters `displayNotes` by debounced query over title and
plaintext content, reusing a cache keyed by note content hash. Progressive
rendering suspends during search so all matches render at once; chapters
force-expand. Search-empty ("No thoughts found") is deliberately distinct from
library-empty ("Your notes await").

**Lazy chunks** — mid-session service worker activation can invalidate lazy chunk
URLs. `lazyWithRetry` plus the `unhandledrejection` handler in `main.tsx` recover
with one cooldown-guarded reload.

**Export** — Markdown export uses sanitized HTML blocks only where plain Markdown
would lose editor formatting; imports sanitize those blocks before use. v1 note
exports and v2 account backups both restore notes, tags, pin state and original
timestamps.

**Key locations** — `src/contexts/AuthContext.tsx`, `src/contexts/EncryptionContext.tsx`,
`src/services/notes.ts`, `src/services/encryptedNotes.ts`, `src/services/syncEngine.ts`,
`src/components/SettingsModal.tsx`.

## Environment

```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
VITE_SENTRY_DSN=...        # optional — leave empty to disable
```

Deployed on Vercel, auto-deploying from `main`. `vercel.json` holds the rewrites for
`/s/*` share routes, app-wide security headers, and no-store cache headers on shared
note pages. When deploying to a new domain, update Supabase → Authentication → URL
Configuration (Site URL and Redirect URLs) or OAuth will break.

## Common tasks

**New feature** — check patterns in similar components first; use theme tokens, never
hardcoded colours; match the wabi-sabi aesthetic per `DESIGN.md`.

**Database change** — update the schema in the Supabase SQL editor, add a migration
under `supabase/migrations/`, update `src/types/database.ts`, then the service
functions, then `src/types.ts` if needed. Run `verify_migration_state.sql` after
deploying.

**New Tiptap extension** — install and configure in `RichTextEditor.tsx`; editor
styles live under `.rich-text-editor` in `src/index.css`.
