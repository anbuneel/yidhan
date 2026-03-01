# Plan Review: Remember This Browser

**Review ID:** a7c3e91b
**Date:** 2026-02-28
**Models:** Claude Opus 4.6 (author) vs gpt-5.3-codex (reviewer)
**Status:** APPROVED (Round 4)
**Plan file:** `docs/active/remember-browser-plan-claude.md`
**Codex session:** `019ca6b2-511c-79b3-b091-17de975aadd2`

---

## Summary Metrics

- **Rounds:** 4
- **Total findings:** 10 (8 in Round 1, 1 in Round 2, 1 in Round 3)
- **Agreed:** 4 (revised into plan)
- **Partial:** 3 (revised with reduced scope)
- **Deferred:** 1 (filed for follow-up)
- **Rejected:** 2 (user confirmed)

---

## Round 1 — Initial Review

### Codex Feedback

1. **P0: Auto-lock behavior is internally inconsistent.** `sessionRestoreAttemptedRef` is one-attempt-per-user. After auto-lock, restore won't re-run. Plan needs explicit restore state machine.

2. **P0: Sign-out cleanup not fully wired.** Sign-out calls `signOut()` directly without `lockVault('sign-out')`. Paths in App.tsx and PassphraseUnlock.tsx aren't covered.

3. **P1: Restored local key blobs not authenticated against key-check.** Length/version checks insufficient. Stale/corrupt/injected keys could produce false "unlocked" state.

4. **P1: Cross-tab security behavior missing.** Manual lock in one tab doesn't affect others. No `storage`/`BroadcastChannel` invalidation.

5. **P2: Error handling under-specified for persistence failures.** No UX for localStorage quota/private mode failures. Toggle state could be inconsistent with actual persisted keys.

6. **P2: Architecture duplication risk.** Key naming duplicated between EncryptionContext and useVaultSettings. Suggests shared `vaultStorage` utility.

7. **P2: UX inconsistency in onboarding path.** PassphraseSetup deprioritized creates first-run inconsistency.

8. **P2: Test plan incomplete.** Mostly manual. Missing automated scenarios for restore precedence, corrupted blob purge, lock semantics, etc.

**Open Questions:**
1. Should auto-lock be true re-auth boundary or silent rehydrate?
2. Should persisted keys have TTL/expiry?

### Counter-Review

| # | Finding | Disposition | Rationale |
|---|---------|-------------|-----------|
| 1 | sessionRestoreAttemptedRef blocks re-restore | **agree** | Real issue. Added ref reset on auto-lock. |
| 2 | Sign-out cleanup not wired | **partial** | User-switch block in EncryptionContext already handles sign-out (currentUserId→null). Documented explicitly. |
| 3 | Restored keys not verified against key-check | **agree** | Added key-check verification to restoreLocal flow. Stale keys after passphrase change now detected and cleared. |
| 4 | Cross-tab lock propagation missing | **defer** | Same gap exists for current sessionStorage behavior. File as follow-up issue. |
| 5 | Error handling under-specified | **partial** | Added toast on localStorage write failure. Full rollback is over-engineered. |
| 6 | Architecture duplication | **reject** | 2 string constants don't warrant a shared module. Direct localStorage reads avoid circular context dependency. **User confirmed.** |
| 7 | PassphraseSetup deprioritized | **reject** | Setup screen is seen once per account lifetime. User can enable remember in Settings or on next unlock. **User confirmed.** |
| 8 | Test plan incomplete | **partial** | Added vitest automated test scenarios with localStorage mocks. Full E2E and cross-tab deferred. |

**Open Questions resolved:**
- Auto-lock = silent rehydrate (Option B, user decision)
- No TTL for v1

### Revisions Applied
- Added sessionRestoreAttemptedRef reset on auto-lock
- Added key-check verification to restoreLocal flow
- Added toast on localStorage write failure
- Added automated test scenarios section
- Added interaction matrix column for sessionRestoreAttemptedRef state

---

## Round 2 — Re-Review

### Codex Feedback

1. **Auto-lock restore race still exists.** Resetting `sessionRestoreAttemptedRef` in `lockVault` causes the restore useEffect to immediately re-run (keys→null is in the dep array), making auto-lock momentary (~0ms). Need an explicit activity gate.

2. **Sign-out cleanup fragile on failure.** If `signOut()` fails before auth state changes, localStorage keys persist.

### Counter-Review

| # | Finding | Disposition | Rationale |
|---|---------|-------------|-----------|
| 1 | Auto-lock instantly re-restores | **agree** | Replaced naive ref reset with autoLockedRef + activity-gated restore useEffect. Listens for visibilitychange/mousedown/keydown/touchstart before allowing restore. |
| 2 | Sign-out failure leaves keys | **reject** | If signOut() fails, user is still authenticated. Keys remaining is correct behavior. **User confirmed.** |

### Revisions Applied
- Added `autoLockedRef` mechanism
- Activity gate useEffect registers event listeners only when `autoLockedRef.current === true`
- On first activity: reset autoLockedRef, reset sessionRestoreAttemptedRef, allow restore effect to run
- Updated interaction matrix with new "User returns" row

---

## Round 3 — Re-Review

### Codex Feedback

1. **Ref changes don't trigger React re-renders.** The activity handler resets refs, but the restore useEffect won't re-run because its deps (`[currentUserId, isEncryptionSetup, keyState.keys]`) haven't changed. Needs direct restore call or state nonce.

### Counter-Review

| # | Finding | Disposition | Rationale |
|---|---------|-------------|-----------|
| 1 | Refs don't trigger re-renders | **agree** | Activity handler now calls restoreLocal() directly instead of relying on the useEffect. Reads from localStorage, verifies key-check, sets keyState directly. Simpler than a state nonce. |

### Revisions Applied
- Activity handler calls `restoreLocal()` → `verifyKeyCheck()` → `setKeyState()` directly
- Added explicit documentation of why direct call is needed (refs don't cause re-renders)
- Updated interaction matrix: "User returns" row shows direct restore, not effect-triggered

---

## Round 4 — Final Review

**VERDICT: APPROVED**

---

## Final Plan (v1.3)

See `docs/active/remember-browser-plan-claude.md` (to be updated with v1.3 content after review artifact is written).

---

## Deferred Items (cumulative)

1. **Cross-tab lock propagation** (P1, Round 1 Finding 4): Manual lock in one tab should invalidate other tabs via `BroadcastChannel` or `storage` event. Same gap exists for current sessionStorage behavior. File as follow-up issue.
2. **Key TTL/expiry**: Persisted keys are indefinite until manual lock/sign-out/toggle-off. TTL is a future enhancement.

## Rejected Items (user-confirmed)

1. **Shared vaultStorage utility** (Round 1 Finding 6): 2 string constants don't warrant a shared module. Direct localStorage reads avoid circular context dependency.
2. **PassphraseSetup checkbox as required** (Round 1 Finding 7): Setup screen is seen once per account lifetime.
3. **Sign-out failure key cleanup** (Round 2 Finding 2): If signOut() fails, user is still authenticated. Keys remaining is correct behavior.
