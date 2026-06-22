# Account Deletion Workflow - Implementation Plan

**Version:** 1.1
**Last Updated:** 2026-06-21
**Status:** Draft - implementation spec, feature remains disabled until live verification
**Author:** Claude (Opus 4.8)
**Reviewed/Expanded:** Codex App (GPT-5)

---

## Original Prompt

> I forgot about this... what's missing for: "No account-deletion promise until the server-owned deletion workflow exists. Offboarding stays disabled, and Privacy/Support copy stays silent on deletion." [followed by] yes [write it up as an implementation plan]

---

## Goal

Make "Letting Go" account offboarding a real, server-owned, auditable account deletion workflow before it is re-enabled. Today the UI and 14-day grace-period UX exist, but deletion is not server-enforced: `initiateOffboarding()` writes `departing_at` into user-writable `user_metadata`, `cancelOffboarding()` clears that same metadata, and `daysUntilRelease` is client-side math.

This work adds the missing backend half:

1. A server-authoritative deletion-request store.
2. A server-verifiable re-auth/confirmation gate for account deletion.
3. A service-role worker that deletes app data and the `auth.users` row.
4. Schedule wiring for the worker.
5. Audit logging for every attempt, skip, failure, and release.
6. Verification scripts so production state can be proven before copy or flags are restored.

Out of scope:

- Redesigning the Letting Go UX.
- Changing the E2EE model.
- Email notification lifecycle copy.
- Re-enabling the feature or restoring deletion promises before live verification.

---

## Current State

| Piece | Status | Evidence |
|-------|--------|----------|
| Letting Go modal + keepsakes export | Built | `src/components/LettingGoModal.tsx` |
| Grace-period return / "Welcome back" flow | Built, but client-driven | `src/contexts/AuthContext.tsx` `isDeparting`, `daysUntilRelease` |
| `initiateOffboarding` / `cancelOffboarding` | Built, metadata only | `src/contexts/AuthContext.tsx` |
| Server-owned deletion job | Missing | No `supabase/functions/` directory |
| Trusted deletion-request store | Missing | Current state uses user-writable `user_metadata.departing_at` |
| Schedule / trigger | Missing | No account-deletion cron wiring |
| Audit trail | Missing | No durable deletion audit table |
| Real re-auth before deletion | Missing / faked | OAuth path in `ReAuthModal.tsx` only asks the user to type their email |
| Feature gate | Disabled, correct | `ACCOUNT_OFFBOARDING_ENABLED = false` |

---

## Non-Negotiable Guardrails

These are security requirements, not preferences.

1. **Do not flip flags in the implementation PR.** Keep `ACCOUNT_OFFBOARDING_ENABLED = false` and `REAUTH_FOR_SENSITIVE_ACTIONS = false` until the migration, worker, schedule, tests, and live verification have all passed.
2. **Do not restore Privacy/Support deletion copy in the implementation PR.** Copy restoration is a post-verification enablement step.
3. **Do not use `user_metadata` as an authority.** It may be cleaned up or ignored, but the deletion trigger must read from `account_deletion_requests`.
4. **Do not allow direct client writes to the deletion-request table.** Normal clients get read-only access to their own active request plus RPC execute privileges. Inserts/updates/status changes happen through controlled RPCs.
5. **Do not rely on UI-only re-auth.** A React `lastReauthAt` timestamp prevents accidental clicks, but it does not stop direct RPC calls from a valid session. `request_account_deletion` must require a server-verifiable confirmation token or equivalent proof.
6. **Never expose service-role credentials to client code.** The service-role key exists only in Supabase Edge Function secrets or scheduler secrets.
7. **The worker must be idempotent.** Re-running it must not double-delete, skip audit, or mark partial work as released.
8. **Cancellation wins until the destructive boundary.** The worker must re-check cancellation after claiming a row and immediately before deleting app/auth data.
9. **Partial failure never equals release.** Failures must produce `status = 'failed'`, an error detail, retry metadata, and an audit row.
10. **Migrations are append-only.** Add a new forward migration; do not rewrite previous migrations.

---

## PR Scope vs Enablement Scope

The implementation PR should include:

- SQL migration.
- Edge Function worker.
- Scheduler setup script with placeholders/secrets instructions.
- Client rewiring behind existing disabled feature flags.
- Re-auth/confirmation plumbing.
- Tests and verification scripts.
- Documentation of the final live-verification and flag-flip steps.

The implementation PR should not include:

- `ACCOUNT_OFFBOARDING_ENABLED = true`.
- `REAUTH_FOR_SENSITIVE_ACTIONS = true`.
- Restored public deletion promises in Privacy/Support copy.
- Production secrets, function URLs with real tokens, or live scheduler credentials.

After live production verification passes, do a tiny follow-up change that flips the feature/copy. That follow-up should be easy to review because the sensitive machinery will already be proven.

---

## Architecture

### Components

1. **Database migration**
   - `account_deletion_requests`
   - `account_deletion_audit`
   - `sensitive_action_confirmations` or an equivalent server-verifiable proof store
   - request/cancel/claim/mark RPCs
   - RLS, grants, revokes, and comments

2. **Edge Function: request confirmation**
   - Required unless the PR implements an equivalent server-verifiable proof mechanism.
   - Mints short-lived confirmation tokens only after real credential or challenge proof.

3. **Edge Function: process deletions**
   - Uses service role.
   - Claims due rows.
   - Deletes app data.
   - Deletes the Supabase Auth user via Admin API.
   - Writes audit records.

4. **Scheduler**
   - Preferred: Supabase `pg_cron` + `pg_net` calling the worker with a secret header.
   - Acceptable fallback: external scheduler calling the Edge Function URL with a shared secret.

5. **Client**
   - Reads server deletion request state.
   - Initiates cancellation via RPC.
   - Requests deletion only after server-verifiable confirmation.
   - Keeps the existing flags disabled until live verification.

---

## Design Decisions

### D1. Source of Truth: `account_deletion_requests`

Use a dedicated server-authoritative table. Do not use `auth.users.raw_user_meta_data` / `user_metadata` as deletion input.

Suggested shape:

```sql
account_deletion_requests
  user_id                uuid primary key references auth.users(id) on delete cascade
  requested_at           timestamptz not null default now()
  release_at             timestamptz not null
  cancelled_at           timestamptz
  status                 text not null default 'pending'
  attempt_count          integer not null default 0
  last_attempt_at        timestamptz
  next_attempt_at        timestamptz
  processing_started_at  timestamptz
  processing_worker_id   text
  released_at            timestamptz
  error                  text
  created_at             timestamptz not null default now()
  updated_at             timestamptz not null default now()
```

Constraints:

- `status in ('pending', 'processing', 'cancelled', 'released', 'failed')`
- `release_at >= requested_at`
- `attempt_count >= 0`
- `cancelled_at is not null` when `status = 'cancelled'`
- `released_at is not null` when `status = 'released'` if the row still exists

Client privileges:

- `authenticated` may `SELECT` only its own row.
- `authenticated` must not have direct `INSERT`, `UPDATE`, or `DELETE`.
- `anon` gets no table access.
- `service_role` can manage rows through worker RPCs or service client access.

### D2. Request/Cancel RPCs

Create explicit RPCs with `SECURITY DEFINER`, `SET search_path = public, pg_temp`, and explicit grants/revokes.

`request_account_deletion(confirmation_token text)`:

- Requires `auth.uid()` to be non-null.
- Validates a fresh server-verifiable confirmation token for `auth.uid()` and action `account_deletion`.
- Consumes the confirmation token atomically.
- Creates or resets the user's request:
  - `requested_at = now()`
  - `release_at = now() + interval '14 days'`
  - `cancelled_at = null`
  - `status = 'pending'`
  - retry/processing/error fields cleared
- Returns the request row needed by the client.

`cancel_account_deletion()`:

- Requires `auth.uid()` to be non-null.
- Only operates on the caller's request.
- Sets `cancelled_at = now()`, `status = 'cancelled'`, clears processing fields.
- Returns the updated request row.
- Must be safe if there is no active request.

Important: cancellation may occur close to release time. The worker must re-check cancellation even if the row was claimed moments earlier.

### D3. Server-Verifiable Re-Auth / Confirmation

UI-only re-auth is not enough. A malicious or buggy client with a valid session could call a normal RPC directly. The deletion-request RPC needs proof that the user recently completed a stronger challenge.

Recommended table:

```sql
sensitive_action_confirmations
  id             uuid primary key default gen_random_uuid()
  user_id        uuid not null references auth.users(id) on delete cascade
  action         text not null
  token_hash     text not null unique
  method         text not null
  created_at     timestamptz not null default now()
  expires_at     timestamptz not null
  consumed_at    timestamptz
```

Access:

- No `anon` or `authenticated` table access.
- Confirmation creation is service-owned.
- `request_account_deletion(confirmation_token)` validates by hashing the supplied token and consuming the matching row.

Minimum acceptable confirmation behavior:

- **Email/password users:** verify the current password before minting a confirmation token. This can be done in a dedicated Edge Function over HTTPS. The function should verify credentials against Supabase Auth, confirm the returned user matches the current session user, store only a token hash, and return the raw one-time token to the client.
- **OAuth users:** do not keep the current typed-email fallback. Either:
  1. implement and test a provider challenge flow that mints a server-side confirmation token only after the OAuth redirect completes for the same user, using `signInWithOAuth({ provider, options: { redirectTo, queryParams: { prompt: 'consent' } } })` or a provider-specific stronger prompt where supported; or
  2. implement an email-OTP confirmation flow and mint the confirmation token only after server-side OTP verification; or
  3. keep account deletion unavailable for OAuth users until one of the above is proven.

Do not claim OAuth re-auth is complete just because the client redirected through OAuth. Provider prompting behavior is provider-dependent and must be verified in E2E/manual testing before the feature is enabled.

### D4. Audit Trail

Create `account_deletion_audit` as append-only operational evidence. It should not reference `auth.users` with a foreign key because the user row will be deleted.

Suggested shape:

```sql
account_deletion_audit
  id              bigserial primary key
  user_id         uuid
  user_id_hash    text
  requested_at    timestamptz
  release_at      timestamptz
  attempt_count   integer
  outcome         text not null
  detail          text
  worker_id       text
  created_at      timestamptz not null default now()
```

Outcomes:

- `processing_started`
- `released`
- `failed`
- `skipped_cancelled`
- `no_op`

Access:

- No normal client table access.
- Service-owned writes only.
- If raw `user_id` retention is a concern, populate `user_id_hash` and decide whether raw `user_id` should be nullable or purged after a retention window.

The worker should append `processing_started` before destructive work and append a final outcome afterward. This avoids a total audit gap if the auth user is deleted but a later final audit write fails.

### D5. Worker Claiming, Locking, and Retry Semantics

Do not let concurrent worker invocations process the same user.

Add a service-only claim RPC, for example `claim_due_account_deletions(batch_limit integer, worker_id text)`, that:

- Runs in a database transaction.
- Selects due rows with `FOR UPDATE SKIP LOCKED`.
- Claims rows where:
  - `status in ('pending', 'failed')`
  - `cancelled_at is null`
  - `release_at <= now()`
  - `next_attempt_at is null or next_attempt_at <= now()`
  - retry limit has not been exceeded
- Updates claimed rows to:
  - `status = 'processing'`
  - `processing_started_at = now()`
  - `processing_worker_id = worker_id`
  - `attempt_count = attempt_count + 1`
  - `last_attempt_at = now()`
- Returns the rows needed by the worker.

Failure handling:

- On failure, mark the row `failed`.
- Store sanitized `error`.
- Set `next_attempt_at` using bounded backoff.
- Append a `failed` audit row.
- Never mark `released` unless app data deletion and Admin API user deletion both succeeded.

Stale processing handling:

- Verification/worker logic should detect rows stuck in `processing` beyond a timeout, e.g. 30-60 minutes.
- Either a recovery RPC resets them to `failed` with retry metadata, or the claim RPC treats stale processing rows as retryable after timeout.

### D6. Deletion Worker

Create `supabase/functions/process-account-deletions/`.

Environment/secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PROCESS_ACCOUNT_DELETIONS_SECRET` or equivalent scheduler secret

Request validation:

- Accept only `POST`.
- Require a secret header from the scheduler.
- Do not accept arbitrary user IDs from the request body.
- Worker always processes due rows claimed from the database.

Processing sequence for each claimed row:

1. Append `processing_started` audit.
2. Re-read the request row.
3. If `cancelled_at is not null` or `status = 'cancelled'`, append `skipped_cancelled`, mark cancelled, and stop.
4. Delete app data in FK-safe order:
   - `note_shares` for `user_id`
   - `note_tags` linked to the user's notes or tags
   - `notes` for `user_id`
   - `tags` for `user_id`
   - future Storage objects, if any exist
5. Re-check the request row again for cancellation immediately before auth deletion.
6. Call `supabase.auth.admin.deleteUser(user_id)`.
7. Append `released` audit.

Notes:

- Auth user deletion is intentionally last.
- E2EE keys are not needed; this is row deletion only.
- Service role bypasses RLS, but the code should still scope every delete by `user_id`.
- If Admin API deletion succeeds but the final audit append fails, the `processing_started` row remains as evidence; the worker should log/report this as an incomplete audit condition.

### D7. Scheduler

Preferred scheduler: Supabase `pg_cron` + `pg_net`.

Repository deliverable:

- Add a setup script such as `supabase/account_deletion_schedule.sql`.
- The script must use placeholders for function URL and secret names.
- Do not commit real secrets.
- Do not assume the schedule is active just because the file exists.

Alternative scheduler:

- GitHub Actions or another external scheduler may call the function URL.
- It must use a secret header and must not include service-role credentials.

The live verification step must confirm the chosen schedule exists and points at the intended function.

### D8. Client Rewiring

Update `AuthContext.tsx` so departure state comes from the server request table/RPC, not `user_metadata`.

Required behavior:

- Load the current user's deletion request after auth state settles.
- `isDeparting` is true only when server state is active (`pending`, possibly `processing` before release cleanup).
- `daysUntilRelease` is computed from server `release_at`.
- `initiateOffboarding` calls the confirmation flow and then `request_account_deletion(confirmation_token)`.
- `cancelOffboarding` calls `cancel_account_deletion()`.
- The UI should tolerate stale legacy `user_metadata.departing_at` but not trust it.
- On successful request, sign out as today only after the server request exists.
- On successful cancellation, refresh server request state before showing "Welcome back."

Type updates:

- Extend `src/types/database.ts` for new tables/functions.
- Update `src/test/test-utils.tsx` auth mocks as needed.

### D9. ReAuthModal and Sensitive Actions

Replace the OAuth typed-email fallback. It is not re-authentication.

Implementation expectations:

- Email/password path should verify password and mint a server-side confirmation token for account deletion.
- OAuth path must be one of the proven options in D3; otherwise deletion remains unavailable for OAuth users.
- `lastReauthAt` may remain a UX grace-window optimization for prompts, but it must not be the only gate for `request_account_deletion`.
- Full Backup can continue using the existing disabled flag until the broader reauth strategy is enabled. Do not flip the flag in this PR.

### D10. SQL and Grant Conventions

Match the conventions in `supabase/migrations/launch_security_hardening.sql`:

- `SECURITY DEFINER` functions use explicit `SET search_path = public, pg_temp`.
- Revoke from `PUBLIC`, `anon`, and `authenticated` before granting only intended privileges.
- RLS enabled on new tables.
- Owner-scoped policies for normal user reads.
- No public policies.
- Use comments on tables/functions to document security intent.
- Prefer check constraints for statuses rather than unreviewed free-form text.

### D11. Verification Script

Add `supabase/account_deletion_verification.sql`.

It should be read-only and raise exceptions on failure. It should verify:

- Tables exist.
- RLS is enabled.
- Expected policies exist.
- No unexpected `anon`/`public` table policies exist.
- `authenticated` cannot directly insert/update/delete request rows.
- RPC grants are exactly as intended.
- Service-only worker RPCs are not executable by `anon` or `authenticated`.
- Audit table has no normal client write access.
- Status/check constraints exist and are validated.
- Scheduler object exists if using `pg_cron`.
- Dry-run due-row query excludes cancelled requests.
- No real deletion is performed.

The script should end with a clear success row, e.g.:

```sql
SELECT 'account_deletion_verification_passed' AS result;
```

### D12. Documentation and Enablement Notes

Update docs in the implementation PR to say:

- The workflow is built but intentionally disabled pending live verification.
- Public deletion copy remains silent until live verification passes.
- The final enablement step is a small follow-up: flip flag(s), restore Settings entry/copy, and add changelog entry.

Do not update public-facing copy to promise deletion until production verification has actually passed.

---

## Implementation Steps

1. Create a feature branch.
2. Add the SQL migration for request/audit/confirmation tables and RPCs.
3. Add the deletion worker Edge Function.
4. Add the confirmation Edge Function or an equivalent server-verifiable confirmation mechanism.
5. Add scheduler setup script with placeholders and secret instructions.
6. Add `supabase/account_deletion_verification.sql`.
7. Rewire `AuthContext.tsx` to server request state.
8. Replace the fake OAuth email confirmation path in `ReAuthModal.tsx`; Google/GitHub users must complete the server-verified email OTP flow before a deletion confirmation token is minted.
9. Add/update TypeScript DB types.
10. Add tests per the test plan below.
11. Run `npm run check`.
12. Open a PR with flags still disabled and copy still silent.

---

## Test Plan

### SQL / RLS

If no local Supabase test harness is added, do not pretend Vitest covers RLS. Cover SQL/RLS with verification scripts and manual staging runs.

Required checks:

- User can read only own request row.
- User cannot read another user's request row.
- User cannot directly insert, update, or delete request rows.
- `request_account_deletion` rejects missing/expired/consumed/wrong-user confirmation tokens.
- `request_account_deletion` sets server-computed `requested_at` and `release_at`.
- `cancel_account_deletion` affects only the caller's row.
- Worker claim RPC is service-only.
- Audit table is not writable by normal clients.

### Worker

Unit-test worker logic with injected/mocked Supabase clients:

- Eligible row leads to app-row deletes, Admin API delete, and `released` audit.
- Cancelled row is skipped and audited as `skipped_cancelled`.
- Failure before auth delete sets `failed`, records sanitized error, sets retry metadata, and does not call `deleteUser`.
- Admin API failure sets `failed` and retries later.
- Stale `processing` rows are recoverable.
- Re-running after success is a no-op.
- Request body cannot select arbitrary users.
- Missing scheduler secret returns non-2xx.

### Re-auth / Confirmation

- Email/password confirmation rejects wrong password.
- Email/password confirmation mints a short-lived one-time token for the same user only.
- Consumed/expired confirmation tokens cannot be reused.
- OAuth typed-email fallback is removed.
- OAuth deletion uses the server-verified email OTP flow before minting a deletion confirmation token.

### Client

- `AuthContext` reads server request state.
- `daysUntilRelease` uses server `release_at`.
- Request flow does not sign out unless the server request succeeded.
- Stay/cancel refreshes server state and clears the departure UI.
- Legacy `user_metadata.departing_at` does not trigger deletion UI by itself.

### E2E / Staging

- Use a seeded throwaway account on staging.
- Request deletion, verify server release date and grace UI.
- Cancel, verify worker skips the account.
- Request again, force `release_at` into the past on staging, run worker, verify:
  - `notes`, `tags`, `note_tags`, `note_shares` rows are gone.
  - `auth.users` row is gone.
  - audit records exist.
  - rerunning worker is safe.

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Service-role key exposure | Key only in Edge Function/scheduler secrets; never in client or repo. |
| User-writable deletion trigger | Trigger reads only `account_deletion_requests`; `user_metadata` ignored. |
| Direct RPC call bypasses re-auth | `request_account_deletion` requires a server-verifiable confirmation token. |
| Deleting a user who clicked Stay | Worker re-checks cancellation after claim and before auth delete. |
| Concurrent workers double-process | Claim RPC uses row locking / `FOR UPDATE SKIP LOCKED` semantics. |
| Partial deletion | Auth delete is last; failures mark `failed` with retry metadata. |
| Missing audit after auth deletion | Append `processing_started` before destructive work and final outcome after. |
| OAuth reauth is not actually fresh | Do not enable OAuth deletion unless a real challenge flow is implemented and verified. |
| Accidental public promise before backend proof | Flags and copy remain disabled until live verification passes. |

---

## Definition of Done for Implementation PR

- [ ] Append-only migration creates request, audit, and confirmation structures with RLS/grants/revokes.
- [ ] Request/cancel RPCs are server-authoritative and do not trust `user_metadata`.
- [ ] `request_account_deletion` requires server-verifiable confirmation.
- [ ] Worker claims due rows safely and is idempotent.
- [ ] Worker deletes app data and then `auth.users` via Admin API.
- [ ] Cancellation is re-checked at execution time.
- [ ] Failures produce retry metadata and audit rows.
- [ ] Schedule setup script exists with placeholders and no committed secrets.
- [ ] Verification script exists and ends with `account_deletion_verification_passed`.
- [ ] Client reads server request state and no longer derives deletion state from `user_metadata`.
- [ ] Fake OAuth email confirmation is removed; Google/GitHub deletion uses server-verified email OTP.
- [ ] Tests cover RPC assumptions, worker behavior, re-auth confirmation, client state, and staging/manual verification steps.
- [ ] `npm run check` passes.
- [ ] `ACCOUNT_OFFBOARDING_ENABLED` remains `false`.
- [ ] `REAUTH_FOR_SENSITIVE_ACTIONS` remains `false`.
- [ ] Privacy/Support deletion copy remains silent.

---

## Post-Verification Enablement DoD

Only after the implementation PR is merged and live production verification passes:

- [ ] Apply migration to production.
- [ ] Deploy Edge Function(s).
- [ ] Configure scheduler secrets and schedule.
- [ ] Run `supabase/account_deletion_verification.sql` against production.
- [ ] Run a staging or production throwaway-account deletion drill.
- [ ] Record the verification output.
- [ ] Flip `ACCOUNT_OFFBOARDING_ENABLED = true` in a small follow-up PR.
- [ ] Decide whether `REAUTH_FOR_SENSITIVE_ACTIONS` should be flipped globally or kept separate from account deletion.
- [ ] Restore Settings entry and public deletion copy.
- [ ] Add changelog entry.
