# Yidhan Launch-Readiness Review

> **Author:** Claude (Fable 5, Claude Code)
> **Date:** 2026-07-06
> **Prompt:** "I am very close to getting this production ready and launching it for users. Take a fresh look at the current state of the app comprehensively — user facing plus internal tech stack, design, arch etc. Be direct and no sugarcoating."
> **Scope:** Web only (yidhan.vercel.app). Full source re-read from scratch + live app drive (landing, demo, signup modal, mobile viewport, dark mode, 404, production HTTP headers). Initially read against a stale local checkout (`c809c93`, April); all findings below **re-verified against origin/main `19328c4`** (June, post PR #191–#193). One finding was already fixed by PR #192 and is marked resolved.

---

## Verdict

Yidhan is a genuinely well-built product with award-level design polish and an unusually serious E2EE/sync core — **but it is not launch-ready yet.** There are two integrity problems that would break user trust the first time someone hits them, one likely-fatal ops gap (auth email), and a handful of reliability/config issues. Nothing is months of work; most of it is days.

---

## Launch blockers

### 1. "Letting Go" makes a promise nothing keeps
The modal tells users *"Your account will fade for 14 days, then release."* (`LettingGoModal.tsx:256`) But `departing_at` is just a flag in `user_metadata` (`src/contexts/AuthContext.tsx:285`) — no cron job, edge function, or trigger anywhere in `supabase/migrations/` deletes anything after 14 days (verified including `launch_security_hardening.sql`, which adds faded-note cleanup but not account release). Accounts and encrypted notes live forever.

For a privacy-first product this is the worst category of bug: a data-deletion promise that is silently false (and a GDPR/CCPA exposure with EU/CA users).

**Fix:** scheduled server-side job (pg_cron + edge function with service-role auth) that hard-deletes departing accounts past the grace window — or soften the copy until that exists.

### 2. A forgotten passphrase bricks the account with no exit
`PassphraseUnlock` says "Forgotten passphrases cannot be reset or recovered" — correct and honest. But Settings, offboarding, and note creation all sit behind the unlock gate, so a user who forgets their passphrase can't erase their encrypted notes and start over, can't delete their account, can't do anything but sign out. The E2EE guarantee means losing the *notes* is unavoidable; losing the *account* is not.

**Fix:** a "Release my encrypted notes and begin again" flow on the unlock screen (heavy confirmation + re-auth), which wipes encrypted rows and vault metadata, then routes to PassphraseSetup.

### 3. Supabase auth email throughput — verify before launch
Supabase's built-in SMTP allows only a few auth emails per hour and is explicitly not for production. If custom SMTP (Resend/Postmark/SES) is not configured, signup confirmations and password resets will silently stop arriving under even trivial launch traffic.

**Action:** confirm custom SMTP in the Supabase dashboard before any public announcement.

### 4. Landing-page copy bug in the trust section
The security pitch ("What stays yours") reads: *"so it reaches your other screens, but never ours readable."* Broken sentence in the exact place that asks for the most trust. (`LandingPage` security section.)

---

## High priority

### 5. Dismissed conflicts strand notes outside of sync
On conflict the queue entry is removed (`src/services/syncEngine.ts:855-857`) and the note marked `syncStatus: 'conflict'`. `ConflictModal` is dismissible (Escape/backdrop), and `handleConflictDismiss` (`src/App.tsx:1550`) only removes it from the list. Pull skips conflict notes (`syncEngine.ts:1049`) and nothing re-queues them — the note is silently frozen out of sync until the user happens to edit it again.

**Fix options:** make the modal non-dismissable, re-surface unresolved conflicts on next sync, or a persistent "needs attention" badge.

### 6. ~~Security headers live only in the Vercel dashboard~~ — RESOLVED
**Already fixed on main** (PR #192 era): `vercel.json` now codifies the full CSP + security header set for all routes. Kept here for the record because the finding was made against the stale April checkout.

### 7. Playwright suite never runs in CI
`.github/workflows/ci.yml` runs typecheck/lint/unit/build only. The e2e specs (auth, notes, tags, sharing, export, settings) cover exactly the flows where a sync/E2EE regression destroys user data.

**Fix:** add an e2e job (chromium-only, on PRs, is enough).

### 8. Google Fonts is a runtime dependency and a privacy leak
The stylesheet failed outright (net::ERR_FAILED) in one live test session → fallback typography on a design-led product. It's also a third-party request on every uncached visit — at odds with the privacy positioning — and forces `fonts.googleapis.com` CSP allowances.

**Fix:** self-host Cormorant Garamond, Source Sans 3, JetBrains Mono via `@font-face` + woff2 (the SW already precaches fonts).

---

## Medium priority

### 9. App.tsx is a 2,382-line god component
All note/tag state, realtime handlers, conflict resolution, session/vault timers, and ~250 lines of triplicated import parsing (JSON / multi-markdown / single-markdown repeat the same tag-map + batch-insert + refresh logic three times) live in one file, plus hand-rolled routing via `view` state with five nearly identical public-page branches.

**Post-launch:** extract an `importNotes` service, a `useNotesSync` hook, and a route table.

### 10. Every sync does two full-table scans
`pullRemoteChanges` fetches **all** note IDs and **all** tag IDs on every sync for hard-delete reconciliation (`syncEngine.ts:1061`, `:1148`). Fine at hundreds of notes; meaningful overhead at thousands, given coalesced sync fires ~2s after each save burst.

**Known ceiling:** a `deleted_notes` tombstone table makes pulls fully incremental.

### 11. SEO is meta-tags only
Served HTML has zero content and a static `<title>Yidhan</title>`; everything is client-rendered. Google renders JS, but the landing page deserves better.

**Fix:** prerender `/`, `/privacy`, `/terms` at build time.

### 12. No product analytics — flying blind on the funnel
Sentry only. No way to see whether visitors bounce at the hero, the demo, the signup modal, or the passphrase gate (the highest-friction moment in the product).

**Option:** privacy-respecting counter (Plausible/Umami), disclosed in the privacy page.

### 13. Onboarding copy tension
Hero says "No account needed to start," but typing + "Continue in Yidhan" leads directly to a signup wall; the actual no-account path (Practice Space) is a smaller link.

**Option:** route "Continue" into the demo with the typed text carried along; defer the account ask to the "sign up to keep them" ribbon.

---

## What's genuinely strong (no caveats)

- **E2EE implementation more careful than most commercial products:** Argon2id derivation, AES-GCM with AAD binding (`noteId:userId`), versioned key-checks with legacy auto-upgrade, key zeroing on lock, activity-gated restore after auto-lock, fail-closed persistence.
- **Offline-first sync engine is real engineering:** batched queue with dependency barriers, bounded concurrency (6), retry/blocked states with telemetry, pagination-safe pulls that refuse deletion reconciliation on partial data, self-echo suppression.
- **Design quality is the real thing:** landing, demo, dark mode, 404 — coherent wabi-sabi identity; the hero-becomes-editor moment is genuinely distinctive; the Practice Space with starter notes + "sign up to keep them" ribbon is a textbook-good funnel.
- **Security hygiene broadly present:** strong production headers (codified in `vercel.json`), RLS on all tables, DOMPurify on import, share keys in URL fragments only. PR #192 added DB-level E2EE invariants (`chk_notes_e2ee_only` refuses plaintext rows at the constraint level), a ciphertext-only `fetch_shared_note` RPC, and service-role-gated cleanup functions — defense in depth beyond what most E2EE apps ship.

---

## Cross-cutting observation

Every blocker is a gap between the product's *story* and its *backend*. The client-side craft (encryption, sync, design) is ahead of the operational layer (deletion jobs, email delivery, escape hatches). Pre-launch review should walk every promise in the UI copy and ask: *what process actually fulfills this?*

---

## Open questions (answered by owner, pending)

1. **Supabase plan & backups** — Free or Pro? Daily backups/PITR wanted before real users.
2. **Custom SMTP** — configured, or still Supabase built-in sender? (Blocker 3.)
3. **Domain** — launching on `yidhan.vercel.app` or a custom domain? OAuth redirects migrate easier *before* launch.
4. **Launch scale** — quiet Show HN vs. real push? Decides whether items 10–12 matter now or later.

## Suggested next step

Fix the four blockers as one focused PR: deletion job + unlock-screen escape hatch + copy fix + SMTP verification (config, not code).
