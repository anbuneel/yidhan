# Multi-Agent Code Review: Launch Security Hardening

**Review ID:** b8a4c2e1
**Date:** 2026-06-21
**Status:** Converged with one pending advisory bot check
**Primary Driver:** Codex App
**PR:** https://github.com/anbuneel/yidhan/pull/192
**Branch:** `codex/security-launch-hardening`
**Latest Reviewed Head:** `4c04c177201e34c9508dbbbe15fdcc8aa19fee33`

---

## Scope

Review of launch security hardening for Yidhan, with emphasis on end-to-end encryption fail-closed behavior, sync/offline persistence safety, conflict resolution, SQL hardening, CSP/security headers, passphrase policy, Sentry scrubbing, and removal of the temporary legacy repair tool.

Gemini was explicitly skipped by user request. A native simplification-focused sub-agent was included.

---

## Reviewer Coverage

| Reviewer | Status | Notes |
|---|---|---|
| Codex primary review | Complete | Counter-reviewed every finding before fixing. |
| Native correctness sub-agent | Complete | Focused on behavioral regressions and sync correctness. |
| Native silent-failure/security sub-agent | Complete | Focused on fail-open/fail-silent behavior. |
| Native type/design sub-agent | Complete | Focused on type contracts, tests, and maintainability. |
| Native simplification sub-agent | Complete | Focused on duplicate checks, test-only helpers, and churn. |
| Claude GitHub bot | Complete for earlier rounds; pending after latest head | Posted two review comments. The latest comment was after `a47b045`; final check for `4c04c17` was still pending at artifact time. |
| Claude CLI | Timed out | Started read-only, produced no review text, stopped locally. |
| Gemini | Skipped | Explicit user instruction: skip Gemini. |

---

## Verification

Local verification after the latest fixes:

| Gate | Result |
|---|---|
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm run test:run` | Passed: 47 files, 933 passed, 7 skipped |
| `npm run build` | Passed with existing bundle/dynamic-import warnings |
| `npm run docs:sync-agents:check` | Passed before second small test-only follow-up |
| `git diff --check` | Passed; Windows line-ending warnings only |

GitHub/Vercel checks at artifact time:

| Check | Result |
|---|---|
| `fast-checks` | Passed |
| `full-tests` | Passed |
| Vercel | Passed |
| Vercel Preview Comments | Passed |
| `claude-review` | Pending |

Production database verification provided by the user:

```text
launch_security_verification_passed
```

---

## All Identified Issues

| # | Source | Issue | Severity | Disposition | Outcome |
|---|---|---|---|---|---|
| 1 | Native correctness | Realtime subscription was not re-established after vault unlock because the main effect did not depend on encryption keys. | MUST FIX | Agree | Fixed in `a47b045`: main notes effect includes `keys`; removed separate unlock-only refetch path. |
| 2 | Native silent-failure/security | Startup hydration could cache unsafe plaintext or partially encrypted server rows into IndexedDB. | MUST FIX | Agree | Fixed in `a47b045`: server-to-local cache paths assert launch encrypted DB notes. |
| 3 | Native silent-failure/security | Runtime encryption checks only looked for encrypted fields and did not require plaintext columns to be empty. | MUST FIX | Agree | Fixed in `a47b045`: added shared launch invariant requiring empty `title`/`content` and required encryption fields. |
| 4 | Native silent-failure/security | Decryption failures could silently hide bad notes by returning partial lists. | MUST FIX | Agree | Fixed in `a47b045`: encrypted/faded fetch now fails closed if any note cannot decrypt. |
| 5 | Native silent-failure/security | Conflict resolution `both` path could create a local copy before validating encrypted server/local state. | MUST FIX | Agree | Fixed in `a47b045`: conflict choices validate encrypted server/local notes and require keys before copy. |
| 6 | Native type/design | Sync create/update processing still accepted plaintext queue payloads. | MUST FIX | Agree | Fixed in `a47b045`: sync queue payloads must pass `requireEncryptedQueuePayload`. |
| 7 | Native type/design | Local sync update could compare plaintext title/content for conflict decisions. | MUST FIX | Agree | Fixed in `a47b045`: conflict comparison uses encrypted content hash only. |
| 8 | Native silent-failure/security | Weak long passphrases with a single character class could pass the new policy. | SHOULD FIX | Agree | Fixed in `a47b045`: policy requires mixed classes beyond length/strength score and adds tests. |
| 9 | Native type/design | Sentry scrubber needed test coverage for recursive sensitive fields, cycles, and share fragments. | SHOULD FIX | Agree | Fixed in `a47b045`: added `sentryScrubber` tests. |
| 10 | Native type/design | Types/docs were stale relative to launch E2EE invariants. | SHOULD FIX | Agree | Fixed in `a47b045`: updated `src/types.ts`, `docs/technical-spec.md`, `CLAUDE.md`, `AGENTS.md`, changelog. |
| 11 | Native simplification | Encryption field checks were duplicated across sync/offline/conflict code. | SHOULD FIX | Agree | Fixed in `a47b045`: centralized in `src/utils/noteEncryptionInvariant.ts`. |
| 12 | Native simplification | Accidental `package-lock.json` transitive churn obscured the real dependency change. | SHOULD FIX | Agree | Fixed in `a47b045`: lockfile diff narrowed to moving `@capacitor/cli` to devDependencies. |
| 13 | Native simplification | Plaintext offline write helpers are dead in production but still exported for tests. | CONSIDER | Defer | Left guarded: helpers throw outside test mode. Full deletion would require a larger offline test rewrite. |
| 14 | Native simplification | Duplicate SQL cleanup functions are maintenance overhead. | CONSIDER | Defer | Left as-is for launch. Both are service-role restricted; can consolidate later. |
| 15 | Native simplification | Security assessment doc had trailing whitespace. | SHOULD FIX | Agree | Resolved; `git diff --check` passes. |
| 16 | Claude bot round 1 | Generic `Error` classes conflate security/tamper failures with transient failures. | CONSIDER | Defer | Not launch-blocking; current behavior fails closed and reports. Typed errors would improve observability later. |
| 17 | Claude bot round 1 | Four-field encryption check was independently reimplemented in several places. | SHOULD FIX | Agree | Fixed in `a47b045` with shared invariant helper. |
| 18 | Claude bot round 1 | `note_tags` has no UPDATE RLS policy. | CONSIDER | Reject for current app behavior | App uses insert/delete for tag associations; denying update is acceptable and safer. |
| 19 | Claude bot round 1 | Duplicate faded-note cleanup functions are near-identical. | CONSIDER | Defer | Same as #14. Non-blocking. |
| 20 | Claude bot round 1 | Passphrase scoring lets length substitute for diversity. | SHOULD FIX | Agree | Fixed in `a47b045`. |
| 21 | Claude bot round 1 | CSP includes `wasm-unsafe-eval` app-wide. | CONSIDER | Defer | Accepted launch tradeoff for Argon2id WASM. No `unsafe-inline` or general `unsafe-eval` was added. |
| 22 | Claude bot round 1 | Production SQL verification evidence needed, not just docs. | MUST FIX | Agree | User ran verification and got `launch_security_verification_passed`. |
| 23 | Claude bot round 1 | Missing partial-corruption coverage for offline server note caching. | SHOULD FIX | Partial | Covered by shared invariant tests in `4c04c17`; offline path indirectly uses the same helper. |
| 24 | Claude bot round 1 | Missing conflict-resolution fail-closed tests. | SHOULD FIX | Agree | Fixed in `a47b045` via updated `useSyncEngine` tests. |
| 25 | Claude bot round 1 | No automated seeded DB test for SQL preflight/verification. | CONSIDER | Defer | Manual Supabase verification completed. Automated SQL regression harness can be future work. |
| 26 | Claude bot round 2 | `requireEncryptedQueuePayload` used a non-null assertion after validation. | CONSIDER | Agree | Fixed in `4c04c17`: removed `!` and stores normalized version. |
| 27 | Claude bot round 2 | Add direct tests for `noteEncryptionInvariant.ts`. | SHOULD FIX | Agree | Fixed in `4c04c17`: added focused invariant tests. |
| 28 | Claude bot round 2 | Confirm share-token regex matches generator length/charset. | CONSIDER | Agree/verified | Existing `shareEncryption.test.ts` verifies 22-char base64url tokens matching the SQL regex. |
| 29 | Claude bot round 2 | Confirm sanitized input handling does not break legitimate task-list output. | CONSIDER | Agree/verified | Existing sanitize tests cover checkbox preservation/disable and non-checkbox stripping. |
| 30 | Claude bot round 2 | Unrelated docs/prototypes appear in PR. | CONSIDER | Acknowledge | They are from earlier commits already in this PR; not introduced by the final hardening fix batch. |

---

## Remaining Non-Blocking Items

1. Typed security error classes for encrypted note failures would improve telemetry and UI routing, but current behavior already fails closed.
2. Plaintext offline helper deletion would reduce test-only code, but keeping guarded helpers avoided a large test rewrite during launch hardening.
3. Duplicate cleanup SQL functions can be consolidated later.
4. A seeded database CI harness for SQL RLS/RPC behavior would strengthen regression coverage.
5. Final GitHub `claude-review` check on `4c04c17` was still pending at artifact time; earlier Claude bot feedback was incorporated or counter-reviewed.

---

## Conclusion

The launch-critical E2EE issues identified by the review were fixed and verified locally. The app now enforces a single launch note invariant across offline caching, sync queue processing, conflict resolution, and server hydration: persisted notes must have encrypted fields and empty plaintext `title`/`content` columns. Production SQL verification was reported as passed by the user.

The remaining items are maintainability or future-regression improvements, not launch blockers.
