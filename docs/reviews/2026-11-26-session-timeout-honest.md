# Review audit: honest session timeout (PR #290)

Multi-agent review, 2026-11-26, three rounds, converged. Reviewers: Codex CLI and the
code-reviewer, silent-failure and type-design lenses. Every finding except those below
was fixed on the branch; the PR thread lists them.

## Disputed

**Change passphrase row shows for accounts with no recovery key** (code-reviewer,
CONSIDER). For those accounts the steps fail at the unlock screen. Kept as is. The copy
is fixed by the plan (I2) and already says "You'll need your recovery key". The recovery
key row sits just above it in the same section. Left to the maintainer on the PR.

## Deferred

- Trust that expires while a tab stays open is not re-checked (silent-failure,
  SHOULD_FIX). Predates the PR. #289.
- A `TimeoutChoice` type that encodes "Never needs trust" (type-design, CONSIDER).
  PR 4 (security presets) reworks this hook.
- A component test for the new Settings copy (code-reviewer, CONSIDER).
