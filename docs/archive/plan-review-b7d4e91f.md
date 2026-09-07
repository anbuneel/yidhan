# Plan Review: E2EE Secure Sharing

**Review ID:** `b7d4e91f`
**Date:** 2026-03-02
**Plan:** `docs/plans/e2ee-sharing-implementation-plan.md`
**Design Doc:** `docs/analysis/e2ee-sharing-design-claude.md`
**Reviewer:** Codex (gpt-5.3-codex)
**Author:** Claude (Opus 4.6)
**Status:** APPROVED (Round 2)

---

## Summary Metrics

| Metric | Value |
|--------|-------|
| Rounds | 2 |
| Total findings | 7 |
| Agreed | 4 |
| Partial | 2 |
| Rejected (user-confirmed) | 1 |
| Deferred | 0 |

---

## Round 1

### Codex Feedback

1. **Critical (Correctness/Security): Token spec is internally inconsistent and will break routing.**
   Plan says `generateShareToken()` is "22-char base64url from 17 random bytes" (line 99), and route parsing expects exactly 22 chars (line 168). 17 bytes base64url-encodes to 23 chars (unpadded), not 22. This mismatch will cause token parse failures unless corrected (use 16 bytes for 22 chars, or update parser/tests).

2. **High (Correctness/Completeness): Revoke/re-create flow is underspecified and likely broken under current constraints.**
   You keep `UNIQUE(note_id)` and state "re-sharing updates the existing row" (line 54), switch revoke to soft-delete `revoked_at` (line 150), and filter revoked/expired out of reads (line 149). But create is described as insert (line 148). Without explicit upsert/reset of `revoked_at`, re-create after revoke/expiry will collide on unique `note_id`.

3. **High (Security/Behavioral regression): RPC does not account for soft-deleted notes.**
   `fetch_shared_note` filters only by token/revoked/expiry (lines 72-74), and app fetch path is fully moved to RPC (line 152). This can allow links to remain readable even after note soft-delete unless you explicitly join/check note state or revoke shares on delete.

4. **Medium (Security): Sentry replay hardening is incomplete for decrypted shared pages.**
   Phase 6 only strips URL fragments and blocks `.shared-note-content` (lines 238-240). Shared title/tags and other DOM text can still be captured in replay unless replay is disabled on `/s/*` or broader selectors are blocked.

5. **Medium (Correctness/Feasibility): Editor-to-share snapshot path is incomplete for unsaved edits.**
   Plan changes `createNoteShare` to require note payload (line 148) and only edits `Editor.tsx` to flip `sharingEnabled` (line 229). There is no explicit step to ensure ShareModal receives current in-editor draft (or forces save before share), so shares may snapshot stale content.

6. **Medium (Security hardening gap): Missing CSP and rate-limit implementation details.**
   Security headers listed are cache/referrer/nosniff only (lines 256-259); no CSP is specified for `/s/*`. Also no concrete edge rate-limiting mechanism appears in the plan, despite public anonymous token lookup surface.

7. **Medium (Testing): Test plan is not adequate for the scope of contract changes.**
   Phase 8 adds only `shareEncryption.test.ts` (lines 40, 277) and emphasizes crypto tests (line 304). But service API/behavior changes in Phase 2 and route format change in Phase 3 (lines 148-152, 163) require explicit updates/additions for service tests, shared-view UI tests, and E2E sharing flows.

**VERDICT: REVISE**

### Counter-Review

| # | Codex Finding | Disposition | Rationale |
|---|--------------|-------------|-----------|
| 1 | Token: 17 bytes → 23 chars, not 22 | **agree** | Correct math. Fix: use 16 bytes (128 bits, 22 chars). |
| 2 | Revoke/re-create: insert collides with UNIQUE | **agree** | Valid. Fix: explicit upsert with revoked_at = null reset. |
| 3 | RPC doesn't check soft-deleted notes | **agree** | Real security gap. Fix: JOIN notes + deleted_at IS NULL. |
| 4 | Sentry replay captures title/tags | **partial** | Valid, but fix differently: disable replay entirely on /s/* routes. |
| 5 | ShareModal may snapshot stale content | **reject** | Editor auto-saves on every keystroke. Note prop is latest React state. User confirmed. |
| 6 | Missing CSP and rate-limit details | **partial** | CSP added. Rate limiting deferred — 128-bit entropy makes brute-force infeasible. |
| 7 | Test plan needs service/E2E tests | **agree** | Added service test file and E2E sharing.spec.ts updates. |

### User Decision (Finding #5)

User agreed with Claude's rejection: "Auto-save handles this — no explicit save-before-share needed."

### Revisions Applied

1. Token spec: 17 bytes → **16 bytes** (128 bits, 22 chars). Updated plan line 103 and regex comments.
2. createNoteShare: added explicit upsert pseudocode (plan lines 161-185). Checks for existing row, updates if found, inserts if not.
3. RPC: added `JOIN notes n ON n.id = ns.note_id` and `AND n.deleted_at IS NULL` (plan lines 75-78).
4. Sentry: changed from `.shared-note-content` block to disabling replay entirely on `/s/*` routes (plan lines 272-274).
5. No change (rejected, user confirmed).
6. Added CSP header to vercel.json (plan line 294). Rate limiting deferred with rationale (plan line 308).
7. Added `src/services/__tests__/shareService.test.ts` (plan lines 328-334), updated `e2e/sharing.spec.ts` scope (plan lines 336-342), added soft-delete and re-create verification steps (plan lines 364-365).

---

## Round 2

### Codex Feedback

No blocking findings in v1.1. All prior issues addressed:

1. Token spec is now internally consistent (`16 bytes → 22 chars`) and regex matches (plan:103, plan:197, plan:209).
2. Revoke/re-create path is now explicitly upserted with `revoked_at = null` reset (plan:152, plan:161, plan:178).
3. RPC now guards soft-deleted notes via join + `n.deleted_at IS NULL` (plan:78, plan:79).
4. Sentry replay hardening improved by disabling replay on `/s/*` routes (plan:272).
5. CSP header now included for `/s/*` (plan:294).
6. Test scope now includes crypto + service + E2E updates, including soft-delete and re-create flows (plan:323, plan:333, plan:364, plan:365).

**VERDICT: APPROVED**

---

## Final Plan

See `docs/plans/e2ee-sharing-implementation-plan.md` (to be updated to v1.1 post-review).

---

## Deferred Items

| Item | Rationale |
|------|-----------|
| Edge rate limiting on `/s/*` RPC endpoint | Vercel lacks built-in rate limiting without middleware. 128-bit token entropy makes brute-force infeasible. Revisit with Vercel Firewall or Supabase pg_net. |

---

## Rejected Items (User-Confirmed)

| # | Finding | Rationale |
|---|---------|-----------|
| 5 | ShareModal may snapshot stale content | Editor auto-saves on every keystroke via debounced handleSave. The `note` prop passed to ShareModal reflects current React state from App.tsx. No stale content risk in current architecture. User confirmed rejection. |
