# Account Deletion Flow — Production Readiness Assessment

**Version:** 1.0
**Last Updated:** 2026-08-10
**Status:** Complete
**Author:** Claude

---

## Original Prompt

> Evalute the status of the e2e account deletion flow. are we ready for production? are we doing what we are promising to the user that we don't own and see any data and deletions are truly deletions?

---

## Verdict

**The deletion mechanism is sound. The product around it is not yet ready for a broad public launch.**

The cryptographic and authorization design holds up: deletions are genuine hard deletes, the client is not the deletion authority, and confirmation is server-verified. What is not ready is everything that surrounds the mechanism — the public copy contradicts the shipped feature, a permanently-failed deletion is invisible to everyone, and the grace-period UX traps the user.

None of the gaps below are E2EE or crypto defects. They are trust, consistency, and operational-safety defects — which for an irreversible destructive flow matter just as much.

| Area | Status |
|------|--------|
| Deletion is a real deletion (server side) | Correct |
| Authorization / confirmation gate | Correct |
| "We can't read your notes" claim | Accurate and honestly qualified |
| Public copy consistency | **Contradicts the shipped feature** |
| Failure observability | **Silent permanent failure possible** |
| Grace-period UX | Traps the user |
| Client-side residue after deletion | Survives on other devices |
| Automated test coverage on the destructive path | Effectively none |

---

## Are we doing what we promise?

### "We don't own and can't see your data" — yes, and the copy is honest about the edges

- Note titles and content are AES-256-GCM encrypted client-side with an Argon2id-derived key before they ever reach Supabase. `launch_security_hardening.sql` enforces this at the database level: server rows must carry encrypted payload metadata and empty plaintext `title`/`content`.
- Share links are ciphertext-only through the `fetch_shared_note` RPC; the per-share key lives in the URL fragment and never reaches the server.
- Sentry sets no user context, has no `sendDefaultPii`, scrubs encrypted fields and share tokens in `beforeSend`, masks all text/inputs in replays, and disables replay entirely on `/s/*` routes.
- `PrivacyPage.tsx:108` explicitly discloses what is *not* encrypted — tag names, timestamps, pinned state. That is the right call and it is stated plainly rather than buried.

This claim is being kept.

### "Deletions are truly deletions" — yes on the server, with four caveats

The worker performs real `DELETE` statements, not soft flags:

- `delete_account_app_data()` hard-deletes `note_shares`, `note_tags`, `notes`, `tags` for the user.
- `supabase.auth.admin.deleteUser(id)` hard-deletes the auth user (the SDK soft-delete flag defaults to false), which takes `user_metadata` — including the E2EE salt and key-check — with it.
- `account_deletion_requests` and `sensitive_action_confirmations` both `REFERENCES auth.users(id) ON DELETE CASCADE`, so they vanish with the user.

The caveats, none of which are currently disclosed to users:

1. **`account_deletion_audit` retains the raw user UUID forever.** The table has a `user_id_hash` column designed for exactly this, and the worker never populates it — it writes `user_id` instead (`process-account-deletions/index.ts:47`). A permanent identifier for a deleted account is a residual record.
2. **Supabase backups / PITR** retain deleted rows for the retention window. Note content is ciphertext there, so the E2EE claim survives, but tag names are plaintext and the privacy copy never mentions backups.
3. **Local copies on other devices survive.** `clearOfflineData()` is only called from the explicit `signOut()` path (`AuthContext.tsx:281`). When the auth user is deleted, other devices' refresh tokens fail and `onAuthStateChange` clears React state — but nothing clears IndexedDB. On a device where the user enabled "Remember this browser," the encrypted notes *and* the decryption key both remain in local storage after the account is gone.
4. **A silently-failed deletion never happens at all** (see B2 below).

---

## Ship blockers

### B1 — Public copy contradicts the shipped feature

`ACCOUNT_OFFBOARDING_ENABLED = true` and the "Let go of Yidhan →" entry point is live in Settings, but:

- `PrivacyPage.tsx:213` — *"Self-serve account deletion is paused for public launch until a server-owned deletion workflow is available; contact support if you need account removal before that flow returns."*
- `SupportPage.tsx:125` — same claim in the FAQ.
- The privacy policy footer still reads **"Last updated March 2026."**

A user reading the privacy policy is told the feature does not exist while the button sits in their Settings. The policy also never states what deletion actually does, how long the grace period is, or what is retained afterward — so there is currently no accurate public description of the deletion flow anywhere.

**Fix:** rewrite both sections to describe the real flow (verify identity → 14-day grace → permanent deletion of notes, tags, shares, and the account), disclose the audit-record and backup-window retention, and bump the policy date.

### B2 — A permanently failed deletion is invisible

`claim_due_account_deletions()` filters on `attempt_count < 10`. After ten failures the row is never claimed again: status stays `failed`, `next_attempt_at` is set but irrelevant, and the account remains fully intact.

Nothing surfaces this. The Edge Function only does `console.error`, there is no Sentry reporting from either function, no alert on `outcome = 'failed'` rows in `account_deletion_audit`, and no query anyone runs on a schedule. The user signed out believing their account was gone.

This is the single most serious threat to the promise, because the failure mode is *silence* — a user who believes they deleted their account and did not is worse off than one who got an error.

**Fix:** report failures to Sentry from the worker, and add a scheduled check that alerts on any request older than its `release_at` still in `pending`/`failed`, or any `attempt_count >= 10`.

---

## Should fix before a broad launch

### S1 — Cancel-during-processing can delete the notes but keep the account

`cancel_account_deletion()` accepts `status = 'processing'`. The worker checks cancellation before app-data deletion and again before auth-user deletion, which narrows but does not close the window: a cancel landing between the first check and `delete_account_app_data` results in the notes being deleted, the second check seeing `cancelled`, and the account surviving empty.

Rare, but the outcome is unrecoverable data loss for a user who explicitly chose to stay. Either reject cancellation once `status = 'processing'` (telling the user deletion is already underway), or move the cancellation check inside the same transaction as the delete.

### S2 — No email at any stage

No email when a deletion is requested, no reminder before release, no confirmation after. Two consequences: a user whose session was hijacked gets no warning during the 14 days they could still cancel, and nobody ever receives proof the deletion completed. A "your account was deleted" email is also the cheapest possible mitigation for B2.

### S3 — The grace period locks the user out

`App.tsx:706` shows `WelcomeBackPrompt` whenever `user && isDeparting`. It is a fixed full-screen overlay with no dismiss, no backdrop-click, and no Escape handler — only "Continue letting go" (signs out) and "Stay" (cancels the deletion).

A user in the grace period therefore cannot open the app to export their notes without first cancelling their own deletion. That is the opposite of what the Letting Go modal implies with *"You may return anytime before then."* It should be dismissible, with a persistent banner and a cancel affordance in Settings.

### S4 — No cancel/status affordance in Settings

Related to S3: the only place a pending deletion is visible or cancellable is the sign-in-time prompt. There is no persistent indicator and no cancel button anywhere in the app.

### S5 — Client-side residue (caveat 3 above)

Clear IndexedDB and any persisted key blob when the session dies from token-refresh failure, not just on explicit `signOut()`.

---

## Lower priority

- **No automated coverage of the destructive path.** The 13 unit tests cover the client service and modal wiring only — they assert that the right RPC is called, never what it does. There are no Deno tests for either Edge Function, no SQL regression harness for the RPCs, and `e2e/settings.spec.ts:140` only checks that the modal opens. Every claim about actual deletion behavior currently rests on one manual throwaway-account drill.
- **`sensitive_action_confirmations` is never purged.** Consumed and expired rows accumulate indefinitely; there is no cleanup cron (unlike faded notes). Hashes only, so low risk — hygiene.
- **`Access-Control-Allow-Origin: '*'`** on `confirm-sensitive-action`. Not exploitable (bearer-token auth, not cookies) but should be pinned to the app origin.
- **No app-level throttle on the password confirmation.** `ReAuthModal` has no lockout, unlike the passphrase unlock path. Worth verifying the Supabase rate-limit behavior here: `signInWithPassword` is called *from the Edge Function*, so the auth server sees the function's egress IP rather than the user's — meaning all users may share one rate-limit bucket, which both weakens the throttle against an attacker and risks locking out legitimate users.
- **Dangling sessions.** `signInWithPassword` and `verifyOtp` in `confirm-sensitive-action` mint real sessions that are discarded without `signOut()`, leaving unused refresh tokens behind on every confirmation.
- **`released` / `released_at` are dead columns** — the request row cascades away before either is ever written. Harmless, but the schema implies a state that never exists.

---

## What is genuinely well built

Worth stating plainly, because the list above is long:

- The client is not the deletion authority. `initiateOffboarding` cannot delete anything on its own — it must present a token the server minted and stored as a SHA-256 hash.
- Confirmation tokens are 32 random bytes, hashed at rest, single-use, 10-minute TTL, consumed inside the same transaction that creates the request — so a failed request rolls the consumption back.
- The OAuth hole is properly closed: Google/GitHub users go through a server-verified email OTP, and typed-email confirmation is not accepted as proof.
- Worker claiming uses `FOR UPDATE SKIP LOCKED` with a one-hour stale-processing reclaim, so concurrent workers cannot double-process and a crashed worker cannot wedge a request.
- Least privilege is real and verified: `authenticated` gets `SELECT` on its own request row and `EXECUTE` on exactly two RPCs; every worker function is `service_role`-only and asserts `auth.role()` internally on top of the grants. `account_deletion_verification.sql` checks all of this and fails loudly.
- The scheduler template correctly anticipates that the Edge Function gateway requires a bearer token *in addition to* the shared secret, and keeps all three values in Vault.

---

## Recommendation

Fix **B1** and **B2** before the next public push — B1 is an afternoon of copywriting, B2 is a Sentry call plus one scheduled query. Together they close the gap between what the app promises and what it can prove.

Treat **S1–S5** as the next workstream. S3 in particular undercuts the emotional promise the feature is built around: a "grace period" the user cannot actually use is not a grace period.

The underlying answer to the question is: **the deletion is real, and the encryption claim is honest — but right now we cannot prove the deletion happened, and we are telling users in writing that the feature does not exist.**
