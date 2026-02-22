# Plan Review: Encryption Capability Analysis (v3.0 → v3.2)

**Review ID:** 7b3ebedb
**Date:** 2026-02-21
**Model:** gpt-5.3-codex
**Status:** Approved after 3 round(s)
**Plan file:** `docs/analysis/encryption-capability-analysis-claude.md`

## Summary

| Metric | Count |
|--------|-------|
| Rounds | 3 |
| Total findings | 16 |
| Agreed & applied | 12 |
| Partially applied | 3 |
| Deferred | 2 |
| Rejected | 0 |

---

## Round 1

### Codex Review

13 findings raised against v3.0 of the encryption analysis doc. VERDICT: REVISE.

1. **Critical data-loss risk in migration flow** — Migration deletes plaintext after re-upload without per-note verification, checkpoints, or rollback semantics.
2. **Welcome-note DB trigger inserts plaintext on signup** — Conflicts with E2EE.
3. **Old clients can write plaintext after E2EE rollout** — No version-gating mechanism.
4. **Overwriting title/content columns is brittle** — Removes rollback path.
5. **Share design is inconsistent and under-specified** — Passphrase vs URL-fragment key not reconciled.
6. **Raw SHA-256 leaks equality** — Enables dictionary attacks on low-entropy content.
7. **Missing AAD for AES-GCM** — Allows ciphertext swapping within account.
8. **Salt/key-state in user_metadata is fragile** — No key-check mechanism.
9. **Offline DB + sync queue contain plaintext** — Migration mechanics not addressed.
10. **Export/import/offboarding unresolved** — Left as open questions.
11. **Tag plaintext can violate user expectations** — No UI messaging.
12. **Test plan is too generic** — No concrete test matrix for crypto.
13. **Alternative rollout to reduce risk** — Phases should be more granular.

### Claude Counter-Review

| # | Codex Finding | Disposition | Rationale |
|---|--------------|-------------|-----------|
| 1 | Migration lacks checkpoints/verification | agree | Real data loss risk. Needs per-note verification and additive schema. |
| 2 | Welcome note trigger writes plaintext | agree | Great catch. Must replace with client-side creation after passphrase setup. |
| 3 | Old clients can write plaintext | partial | Valid but scoped to SPA reality — no app store lag, only stale tabs. |
| 4 | Column overwrite is brittle | agree | Additive schema with dual-read is much safer. |
| 5 | Share design is inconsistent | agree | Disable sharing for v1 E2EE entirely. |
| 6 | Raw SHA-256 leaks equality | agree | HMAC-SHA-256 with derived hash key is a meaningful improvement. |
| 7 | Missing AAD for AES-GCM | agree | Standard best practice, easy to add. |
| 8 | Salt storage is fragile | partial | Key-check blob is important; dedicated table deferred to later. |
| 9 | Dexie migration not addressed | agree | Must specify queue drain, schema v4, conflict format changes. |
| 10 | Export/import must be decided now | defer | This is an analysis doc, not the implementation plan. Open questions are appropriate here. |
| 11 | Tag plaintext needs UI messaging | agree | Users must be explicitly informed tags aren't encrypted. |
| 12 | Test plan needs concrete matrix | defer | Test matrix belongs in implementation plan, not analysis doc. |
| 13 | Phases should be more granular | partial | Restructured to clarify what ships when; sharing explicitly disabled in v1. |

### User Decisions

- Finding 10: User sided with Claude — defer to implementation plan. "This is still analysis."
- Finding 12: User sided with Claude — defer to implementation plan. "Ditto."

### Revisions Applied

- Rewrote migration strategy with per-note verification, checkpoints, rollback via additive schema
- Added welcome note trigger replacement section
- Added stale-tab risk note scoped to SPA context
- Changed to additive database schema (new `encrypted_payload` column)
- Disabled sharing for v1 E2EE
- Upgraded SHA-256 to HMAC-SHA-256 with derived hash key
- Added AAD binding (`note_id` + `user_id`) for AES-GCM
- Added key-check blob mechanism via user_metadata
- Added Dexie offline DB migration section
- Added UI messaging for unencrypted tag names
- Restructured implementation phases

---

## Round 2

### Codex Review

3 findings raised against v3.1. VERDICT: REVISE.

1. **High: Plaintext-write protection uses "can" instead of "must"** — Stale-tab rejection should be a hard RLS requirement, not optional.
2. **Medium: Key derivation text vs code inconsistency** — Text says "different context/salt" but code splits a single 64-byte output.
3. **Medium: Phase sequencing ambiguity** — Sharing disable in Phase 3 but should be before encryption goes live.

### Claude Counter-Review

| # | Codex Finding | Disposition | Rationale |
|---|--------------|-------------|-----------|
| 1 | Plaintext rejection must be mandatory | agree | Correct — "can" changed to "must" with explicit RLS requirement. |
| 2 | Key derivation text/code mismatch | agree | Code approach (split output) is correct and simpler. Fixed text to match. |
| 3 | Sharing disable too late in phases | agree | Moved to Phase 1, before any encryption logic ships. |

### Revisions Applied

- Changed stale-tab plaintext rejection from "can" to "must" — mandatory RLS policy
- Fixed key derivation description to match code: single 64-byte Argon2id output split into two 32-byte keys
- Moved sharing disable from Phase 3 to Phase 1
- Renamed Phase 3 to "Client-Side Search + Share Link Cleanup"

---

## Round 3

### Codex Review

0 findings. All 3 Round 2 items verified as properly addressed. VERDICT: APPROVED.

Codex confirmation:
> 1. Stale-tab protection is now mandatory and explicit: post-migration RLS must reject non-null plaintext writes.
> 2. Key-derivation text now matches code: single 64-byte Argon2id output split into two 32-byte keys.
> 3. Sharing disable is moved to Phase 1 and explicitly required before encryption ships.

---

## Deferred Items

| # | Finding | Rationale |
|---|---------|-----------|
| 10 | Export/import/offboarding behavior must be decided | This is an analysis doc. Detailed behavior belongs in the implementation plan (`docs/plans/`). |
| 12 | Concrete test matrix for crypto operations | Test matrix belongs in the implementation plan. The analysis doc's effort estimate calls it out as a line item. |

## Rejected Items (user-confirmed)

None.
