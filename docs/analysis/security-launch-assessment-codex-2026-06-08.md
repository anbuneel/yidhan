# Yidhan Security Launch Assessment

**Version:** 1.1
**Last Updated:** 2026-06-08
**Status:** Complete
**Author:** Codex (GPT-5)
**Review ID:** d2c8a91f

---

## Original Prompt

> I am getting ready to launch Yidhan to the public. Do a full security assessment of the app! We want full e2e encryption and  bullet proof security. validate the app  delivers these

---

## Executive Summary

Yidhan does not yet meet the launch bar for "full E2EE" or "bulletproof security." The core cryptographic primitives are mostly sound: note title/content encryption uses AES-GCM with random 96-bit IVs, note/user AAD binding, and HMAC content hashes; encrypted share links use per-share random keys and token-bound AAD. Focused crypto/security tests passed.

At the time of the initial audit, the blockers were around enforcement and launch hardening, not the AES implementation. The app accepted plaintext note rows, had plaintext fallback write paths, had a weak passphrase policy for an offline-guessable verifier, lacked reproducible core RLS migrations, exposed unscoped SECURITY DEFINER cleanup functions, had current DOMPurify advisories while rendering user HTML, and only applied CSP/security headers to shared-note routes.

**Launch verdict at initial audit:** Not ready for public launch with current E2EE/privacy claims. The first remediation pass has since addressed several client/runtime findings locally, but backend/database verification and enforcement remain required before a strong public E2EE claim.

## Plain-English Security Model

The confusing part is that "E2EE app" is not one single property. For Yidhan, it means four different layers must all hold at the same time:

1. Client encryption: the browser encrypts note title and content before anything is sent to Supabase.
2. Sync and offline behavior: IndexedDB, sync queues, imports, realtime updates, and conflict resolution must never accidentally trust or create plaintext notes.
3. Backend/database enforcement: Supabase must reject bad writes even if someone bypasses the UI and calls the API directly.
4. Operational/web hardening: CSP headers, dependency hygiene, Sentry scrubbing, share-link secrecy, account deletion, RLS, and logs must support the privacy promise.

The first remediation pass on branch `codex/security-launch-hardening` mainly addressed layers 1, 2, and part of 4. It made encrypted accounts fail closed in client and sync paths, strengthened passphrase setup, hardened sanitization and clipboard handling, added app-wide security headers, deepened Sentry scrubbing, and cleaned the dependency audit. The remaining public-launch blockers are mostly layer 3: live Supabase/RLS proof, database-level encrypted-write enforcement, share RPC/function scoping, and backend deletion guarantees.

## What Was Risky

Before the first hardening pass, the app had real E2EE primitives, but it also had compatibility paths that could accept plaintext note rows. That is common during migrations, but risky before a public launch.

Example:

1. The product says notes are encrypted.
2. A stale client, import path, sync conflict, or direct API call creates a plaintext note row.
3. The app quietly accepts and displays it.
4. Supabase now contains readable note content.

That does not mean the app was intentionally leaking notes. It means the system was not strict enough to support a strong public E2EE claim.

## What The First Fix Pass Changed

The first local remediation pass changed the client to fail closed:

- Server notes without encrypted payload metadata are rejected.
- Sync skips/errors on plaintext server rows instead of saving them locally.
- Conflict resolution refuses to keep plaintext server versions.
- Imports require an unlocked vault and create encrypted notes only.
- Passphrase setup now enforces stronger input.
- Sentry scrubbing removes sensitive fields, share fragments, keys, tokens, titles, and content.
- App-wide CSP/security headers are stronger.
- The dependency audit is clean locally after lockfile updates.

These changes make the app much less likely to accidentally weaken E2EE from the frontend/runtime side.

## What Still Needs Backend Proof

After the first client/runtime hardening pass, the remaining gaps were backend proof and enforcement:

1. Database encrypted-write constraints: Supabase should reject note rows that lack encrypted fields for encrypted accounts.
2. Live RLS verification: production policies must prove that user A cannot read or write user B's data.
3. Share RPC hardening: unauthenticated shared-note access must stay tightly scoped to one encrypted blob, especially if `SECURITY DEFINER` functions are involved.
4. Offboarding deletion guarantee: if public copy promises account deletion, the backend must actually perform and audit that deletion.
5. External scans: Semgrep/Gitleaks or equivalent tooling should still run before launch.

The second fix pass below adds repo-level backend enforcement for these items. The remaining launch work is to apply and verify that migration against the live Supabase project.

## Second Fix Pass: Backend Enforcement

On 2026-06-20, branch `codex/security-launch-hardening` added repo-level backend hardening for the no-active-users launch posture:

- Added `supabase/migrations/launch_security_hardening.sql`, which intentionally fails if existing server notes are plaintext, partially encrypted, or retain plaintext title/content.
- Replaced the old all-or-nothing encryption constraint with an encrypted-only notes constraint.
- Reset core RLS policies for `notes`, `tags`, `note_tags`, and `note_shares` to canonical owner-scoped policies.
- Removed public table-read sharing assumptions; public share access is limited to the ciphertext-only `fetch_shared_note` RPC.
- Hardened `fetch_shared_note` with token-shape validation, note/share owner matching, explicit `search_path`, explicit grants, and explicit revokes from `PUBLIC`.
- Added encrypted share-row constraints and a trigger preventing direct API writes from extending share expiry beyond 30 days from the write.
- Revoked normal-client access to global `SECURITY DEFINER` cleanup and timestamp-restore functions, leaving them for service-owned execution.
- Hid self-serve "Letting Go" offboarding behind a disabled launch flag and corrected public support/privacy copy so the app no longer promises account deletion before a server-owned deletion workflow exists.
- Added a temporary legacy encryption repair tool for the pre-hardening window. When enabled with `VITE_ENABLE_LEGACY_REPAIR=true` or in local dev, Settings > Security can scan the authenticated user's own legacy plaintext rows, encrypt repairable rows in place with the unlocked vault key, clear plaintext columns, and refuse to run if local note mutations are still queued.

This does not replace live Supabase verification. Before public launch, the migration must be applied to the production project and RLS/function grants should be verified against the live database.

## No Active Users Impact

Having no active users other than the founder changes rollout pressure, not the security standard.

It means Yidhan can harden aggressively without migration pain: old plaintext compatibility paths can be removed, constraints can be added, and test data can be reset if needed. It also means no customer migration or communications plan is needed right now.

It does not mean Yidhan can publicly claim full E2EE without backend enforcement, RLS verification, and share-RPC hardening. The practical conclusion is: use the quiet pre-launch window to make the security invariant stricter now.

## Methodology

Scope covered:

- Client E2EE and key management: `src/lib/encryption.ts`, `src/contexts/EncryptionContext.tsx`, encrypted note services, sync/conflict flows, browser storage.
- Supabase access control: migrations, RLS-dependent service calls, share RPC, soft-delete cleanup functions, offboarding behavior.
- Web/client hardening: HTML sanitization, `dangerouslySetInnerHTML`, Sentry, CSP, PWA/service worker, dependency advisories, local/session storage.
- Tooling: `npm audit`, `npm audit --omit=dev`, targeted security tests.
- Native subagents: focused E2EE, Supabase/RLS, and web-hardening reviewers.

Skipped or limited coverage:

- Semgrep was not installed.
- Gitleaks was not installed.
- Live Supabase policies were not inspected, so the repo can show intended behavior but cannot prove production DB state.
- No professional penetration test, dynamic browser attack testing, or live account abuse testing was performed.

## Validation Results

Positive validation:

- `encryptNote()` encrypts title and content together and binds ciphertext to `noteId:userId` via AES-GCM AAD.
- `decryptNote()` fails on wrong key, tampering, or wrong AAD.
- Per-note IVs are random 12-byte values.
- Conflict comparison uses HMAC content hashes rather than plaintext for encrypted notes.
- Session/local restored keys are verified with the key-check before unlock.
- Share links use 128-bit server lookup tokens plus 256-bit fragment keys; the fragment key is not sent to the server.
- `fetch_shared_note()` returns ciphertext only and checks revocation, expiration, and soft-deleted note state.
- Focused tests passed: `npm run test:run -- src/lib/__tests__/encryption.test.ts src/lib/__tests__/shareEncryption.test.ts src/services/encryptedNotes.test.ts src/utils/sanitize.test.ts src/services/notes_security.test.ts`.

## Launch Blockers

The findings below preserve the initial audit findings and evidence. Some client/runtime items have since been remediated locally on `codex/security-launch-hardening`; see "What The First Fix Pass Changed" above for the current remediation snapshot.

### 1. Plaintext Server Rows Are Still Accepted

**Severity:** High  
**Files:** `src/services/encryptedNotes.ts:48`, `src/services/syncEngine.ts:1037`, `supabase/migrations/add_encryption_columns.sql:15`

Encrypted accounts still accept notes where all encryption fields are null. `decryptNoteIfNeeded()` returns such notes as-is, and `pullRemoteChanges()` persists server `title`/`content` into IndexedDB. The database constraint also explicitly allows all encryption fields to be null.

Why this matters:

- A stale client can write plaintext.
- A malicious or compromised backend path can inject plaintext rows.
- The app will display those rows as valid notes, which weakens the "only encrypted note content is trusted" invariant.

Required fix:

- For accounts with E2EE metadata, reject or quarantine plaintext note rows in the client.
- Add DB constraints/triggers/RLS checks that prevent plaintext `title`/`content` writes after E2EE setup, while preserving a deliberate migration path for historical rows if needed.
- Replace tests that assert plaintext fallback with tests that enforce fail-closed behavior for encrypted accounts.

### 2. Authenticated Write and Import Paths Still Have Plaintext Fallbacks

**Severity:** High  
**Files:** `src/App.tsx:1863`, `src/App.tsx:1932`, `src/App.tsx:2007`, `src/services/offlineNotes.ts:583`, `src/services/syncEngine.ts:337`

Normal rendering gates make these harder to reach, but import handlers still choose plaintext helpers when `keys` is null. The sync engine also still supports plaintext queue payloads and sends `title`/`content` to Supabase.

Required fix:

- Remove plaintext note creation/update fallbacks from authenticated app paths.
- Make import/save fail closed with a vault-unlock requirement.
- Keep plaintext helpers only for demo or explicit legacy migration scopes, not general authenticated writing.

### 3. Weak Passphrase Policy Enables Offline Guessing

**Severity:** High  
**Files:** `src/components/PassphraseSetup.tsx:105`, `src/contexts/EncryptionContext.tsx:537`, `src/lib/encryption.ts:396`

Supabase user metadata stores the salt and an encrypted key-check verifier. This is expected for client-side passphrase verification, but anyone with backend metadata access can run offline guesses. Argon2id slows guessing, but an 8-character minimum is not enough for a public E2EE product.

Required fix:

- Require a stronger passphrase policy, preferably length-first: for example 14-16+ characters minimum, with clear user copy favoring passphrases.
- Consider rejecting "Weak" and possibly "Fair" scores at setup.
- Document that the E2EE security model depends on a strong passphrase because the server stores a verifier.

### 4. Core Supabase RLS Is Not Captured as Enforceable Migrations

**Severity:** High  
**Files:** `supabase/migrations/security_audit_checklist.sql:66`, `src/services/notes.ts:49`, `src/services/tags.ts:40`

The repo has a checklist with commented core RLS policies, but no tracked baseline migration that creates/enforces policies for `notes`, `tags`, and `note_tags`. The client relies on RLS instead of filtering by `user_id`, which is the right design only if live RLS is correct.

This is not proof production is currently misconfigured. It is proof that the repo cannot reproduce or validate the critical access-control boundary.

Required fix:

- Verify live Supabase RLS for all core tables before launch.
- Add an enforceable baseline migration or schema dump for RLS policies.
- Add automated SQL checks for RLS enabled, expected policy names, and expected predicates.

### 5. Unscoped SECURITY DEFINER Cleanup Functions Can Delete Other Users' Notes

**Severity:** High  
**Files:** `supabase/migrations/add_soft_delete.sql:19`, `supabase/migrations/add_soft_delete.sql:34`, `supabase/migrations/add_faded_notes_cleanup_cron.sql:13`

`purge_old_deleted_notes()` and `cleanup_expired_faded_notes()` delete old soft-deleted notes across all users. `purge_old_deleted_notes()` is explicitly granted to `authenticated`; `cleanup_expired_faded_notes()` is also `SECURITY DEFINER` and may inherit default execute privileges unless revoked in live DB.

Required fix:

- Revoke execute from `PUBLIC` and `authenticated` for global cleanup functions.
- Restrict manual/user-callable cleanup to `auth.uid()` scoped deletes.
- Keep global cleanup only for a service role or cron owner.
- Add `SET search_path = 'public'` and explicit grants for all definer functions.

### 6. Current DOMPurify Advisories Affect a Runtime Security Boundary

**Severity:** High  
**Files:** `package.json:130`, `src/utils/sanitize.ts:43`, `src/components/NoteCard.tsx:216`, `src/components/SharedNoteView.tsx:415`

`npm audit --omit=dev` reports current DOMPurify XSS advisories for installed `dompurify@3.3.1`. The app relies on DOMPurify directly before `dangerouslySetInnerHTML`, so a sanitizer bypass becomes app XSS risk against note or shared-note HTML.

Required fix:

- Upgrade DOMPurify to a non-vulnerable version and rerun tests.
- Add regression cases for known sanitizer bypass patterns when possible.

### 7. CSP and Security Headers Only Apply to Shared Routes

**Severity:** High  
**File:** `vercel.json:8`

`vercel.json` applies `Cache-Control`, `Referrer-Policy`, `X-Content-Type-Options`, and CSP only to `/s/*`. The authenticated app shell has no equivalent CSP, no `frame-ancestors`, and no `nosniff` header.

Required fix:

- Add app-wide security headers.
- Keep `/s/*` `no-store` stricter if desired, but enforce at least CSP, `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, and a reasonable referrer policy for all routes.
- Ensure CSP allows Supabase, Sentry, fonts, images, and required inline styles only as narrowly as the current app permits.

### 8. "Letting Go" Promises Account Release Without Server Deletion

**Severity:** High  
**Files:** `src/contexts/AuthContext.tsx:283`, `src/components/LettingGoModal.tsx:256`

The UI promises that an account will fade for 14 days, then release. The implementation only writes `departing_at` into user metadata; no server-side deletion job, admin delete path, or edge function was found.

Required fix:

- Disable/hide offboarding for public launch, or implement a real server-owned deletion workflow.
- Do not promise account deletion until the backend performs it and it is auditable.

## Medium Findings

### Raw Vault Keys Are Persisted in Browser Storage

**Files:** `src/lib/encryption.ts:335`, `src/contexts/EncryptionContext.tsx:47`, `src/contexts/EncryptionContext.tsx:124`

`sessionStorage` always stores raw derived key blobs for refresh persistence, and "Remember this browser" stores them in `localStorage`. Restores are key-check verified, but any same-origin XSS can read the raw key material.

This is not automatically a launch blocker if documented and paired with strong CSP, but it raises the importance of fixing DOMPurify and app-wide CSP first.

Recommended hardening:

- Consider defaulting auto-lock to a nonzero value.
- Keep remember-browser opt-in with stronger warning copy.
- Revisit whether session refresh should persist raw keys by default.

### Sentry Scrubbing Is Incomplete

**Files:** `src/main.tsx:49`, `src/utils/reliabilityTelemetry.ts:18`, `src/utils/reliabilityTelemetry.ts:41`, `src/components/ErrorBoundary.tsx:41`

The current Sentry scrubber removes selected top-level extras and share URLs/fragments, and replay is masked/disabled on share routes. It does not deeply scrub nested extras, breadcrumb messages, exception values, contexts, or arbitrary future payload keys.

Recommended hardening:

- Add a recursive scrubber for sensitive key names and share URL patterns.
- Avoid passing raw error objects from paths that could include note content or key blobs.
- Add tests around `beforeSend` scrubbing.

### Production Dependency Audit Still Has Non-Browser Highs

**Files:** `package.json:112`, `package.json:113`

`npm audit --omit=dev` reported 4 production-class advisories:

- High: `@xmldom/xmldom`, through `@capacitor/cli`.
- High: `tar`, through `@capacitor/cli`.
- Moderate: `brace-expansion`, through `@capacitor/cli`.
- Moderate: `dompurify`, direct runtime dependency.

The Capacitor CLI advisories are not browser-bundled web runtime risk, but `@capacitor/cli` being in `dependencies` makes them production-class in audit output.

Recommended hardening:

- Move `@capacitor/cli` to `devDependencies` if it is only a build/native tooling dependency.
- Upgrade transitive dependencies where available.

### Full Dependency Audit Has Critical/High Dev Tool Advisories

**Files:** `package.json:149`, `package.json:161`, `package.json:163`

Full `npm audit` reported 16 advisories total: 2 critical, 9 high, 5 moderate. Critical items were in `vitest` and `@vitest/coverage-v8`; additional high items included `vite` dev-server advisories.

Recommended hardening:

- Upgrade dev tooling.
- Do not expose Vite/Vitest UI servers outside localhost.

### Pre-Vault Content Is Plaintext in Local Browser Storage

**Files:** `src/components/LandingPage.tsx:152`, `src/hooks/useShareTarget.ts:95`, `src/services/demoStorage.ts:169`

Landing drafts, share-target data, and demo notes persist in localStorage before vault migration. This does not leak to Supabase, but it should not be described as protected by E2EE until migrated.

Recommended hardening:

- Clarify public copy.
- Prefer session-only storage for pre-account drafts, or wipe aggressively after signup/migration.

### Step-Up Auth Is Disabled and OAuth Step-Up Is Not Real Reauth

**Files:** `src/config/featureFlags.ts:2`, `src/components/ReAuthModal.tsx:82`

`REAUTH_FOR_SENSITIVE_ACTIONS` is false. If flipped on, OAuth users "reauthenticate" by typing their email, which is not an actual identity-provider challenge.

Recommended hardening:

- Keep the sensitive-action reauth feature disabled until implemented properly, or implement real OAuth step-up.
- Do not rely on typed-email confirmation for destructive actions.

## Low Findings

### Share Expiry Can Be Indefinite Through Direct API

**Files:** `supabase/migrations/add_note_shares.sql:9`, `supabase/migrations/enable_e2ee_sharing.sql:43`, `src/services/notes.ts:466`

Client code caps share expiry to 30 days, but the database allows `expires_at NULL`, and the RPC treats null as valid.

Recommended hardening:

- Add a DB constraint or trigger that caps `expires_at`.
- If indefinite shares are not desired, reject null.

### Clipboard HTML Can Propagate Raw Note HTML

**Files:** `src/utils/exportImport.ts:690`, `src/components/Editor.tsx:722`

"Copy with formatting" writes raw title/tags/content into `text/html` clipboard output. Current app rendering sanitizes elsewhere, but copied legacy/imported unsafe content could propagate into other rich paste targets.

Recommended hardening:

- Sanitize HTML clipboard output before writing it.

### Sanitizer Allows Generic Inputs

**Files:** `src/utils/sanitize.ts:51`, `src/components/SharedNoteView.tsx:101`

The sanitizer allows `<input>` to support task lists, and shared view later disables checkboxes. This is not direct XSS, but arbitrary rendered inputs can create UI injection or phishing surface.

Recommended hardening:

- Restrict to disabled checkbox task-list inputs.

## Counter-Review Summary

| # | Source | Original Severity | Adjusted Severity | Finding | Disposition | Rationale |
|---|--------|-------------------|-------------------|---------|-------------|-----------|
| 1 | E2EE reviewer | High | High | Plaintext rows accepted | Agree | Valid E2EE enforcement gap and launch blocker. |
| 2 | E2EE reviewer | High | High | Plaintext fallback writes | Agree | Normal UI gates reduce reachability, but services should fail closed. |
| 3 | E2EE reviewer | High | High | Weak passphrase policy | Agree | Offline guessing is realistic because metadata stores a verifier. |
| 4 | E2EE/web reviewers | Medium/High | High | Raw keys plus missing app CSP | Partial | Raw key storage alone is a known product tradeoff; missing app-wide CSP makes it launch-critical. |
| 5 | E2EE reviewer | Medium | Medium | Pre-vault localStorage plaintext | Agree | Local-only but important for accurate privacy claims. |
| 6 | E2EE reviewer | Medium | Medium | Tests preserve plaintext fallback | Agree | Test suite should encode the E2EE invariant. |
| 7 | Web reviewers | High | High | DOMPurify advisories | Agree | Direct runtime sanitizer boundary. |
| 8 | Web reviewers | High | High | Headers only on `/s/*` | Agree | Main authenticated app needs the browser security backstop. |
| 9 | Web reviewers | Medium | Medium | Sentry scrubbing shallow | Agree | Current code avoids obvious content embedding, but scrubber is incomplete. |
| 10 | Supabase reviewer | High | High | Core RLS not tracked in migrations | Partial | Not proof live RLS is wrong; still blocks repo-based launch sign-off until verified. |
| 11 | Supabase reviewer | High | High | Unscoped SECURITY DEFINER cleanup | Agree | Authenticated/global delete risk if callable. |
| 12 | Supabase reviewer | High | High | Offboarding promise lacks deletion backend | Agree | Trust/security blocker for public launch copy. |
| 13 | Supabase reviewer | Medium | Medium | Step-up auth disabled/OAuth weak | Agree | Not immediate if disabled, but do not enable as-is. |
| 14 | Supabase reviewer | Low | Low | Indefinite direct-API shares | Agree | Not a current public UI path, but DB should enforce product limits. |

## Dependency Scan Results

Tool availability:

| Tool | Status |
|------|--------|
| Semgrep | Skipped; not installed |
| Gitleaks | Skipped; not installed |
| npm audit | Ran |

Full `npm audit`:

- Critical: 2
- High: 9
- Moderate: 5
- Total: 16

Production-only `npm audit --omit=dev`:

- Critical: 0
- High: 2
- Moderate: 2
- Total: 4

Manual secret search:

- No obvious committed service-role key, private key, or real Supabase/Sentry secret was found by repository text search.
- This is not equivalent to Gitleaks coverage.

## Launch Readiness Checklist

Required before public launch with full E2EE claims:

1. Enforce encrypted-note-only behavior for encrypted accounts in client and database.
2. Remove authenticated plaintext note write/import fallbacks.
3. Strengthen passphrase requirements and copy.
4. Verify live Supabase RLS and capture core RLS as enforceable migrations/checks.
5. Revoke or scope SECURITY DEFINER cleanup functions.
6. Upgrade DOMPurify and rerun sanitizer/security tests.
7. Add app-wide CSP/security headers.
8. Disable or correctly implement offboarding deletion before promising account release.

Strongly recommended before launch:

1. Upgrade dev tooling vulnerabilities.
2. Move `@capacitor/cli` out of runtime dependencies if appropriate.
3. Deepen Sentry scrubbing.
4. Sanitize clipboard HTML.
5. Restrict task-list input sanitization.
6. Install and run Semgrep plus Gitleaks.
7. Run a live Supabase policy verification script against production.

## Final Verdict

Yidhan has the foundation for real E2EE, but the app does not yet prove or enforce full E2EE end to end. The launch bar should be: no plaintext authenticated note writes, no trusted plaintext server rows for encrypted accounts, reproducible RLS, fixed sanitizer advisories, and app-wide browser hardening. Until those are complete, the public claim should be softened or launch should wait.
