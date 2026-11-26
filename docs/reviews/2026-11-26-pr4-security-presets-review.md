# PR 4 security presets: multi-agent review

Review id a3f7c912, 2026-11-26. PR: https://github.com/anbuneel/yidhan/pull/293.
Branch `claude/security-presets-e579b5`, reviewed against `main` at `b2785a4`.
Status: converged after 3 rounds.

This file exists because three findings were rejected. Everything fixed is in the PR
thread and commits `a49ac26` and `48c7e5a`.

## Reviewers

| Reviewer | Independence | Rounds |
|---|---|---|
| Primary (Claude Code) | primary-native | 1, 2, 3 |
| `code-reviewer` lens | native | 1, 2, 3 |
| `silent-failure-hunter` lens | native | 1, 2, 3 |
| `type-design-analyzer` lens | native | 1, 2, 3 |
| Codex CLI 0.166.0 | independent | 1, 2, 3 |
| GitHub bots (Codex connector, Claude) | independent | 1: no findings |

## Fixed

Round 1 (`a49ac26`):

- A preset reported success when the auto-lock write failed. After a reload the
  looser stored value came back. Raised by Codex, silent-failure and type-design.
  `setAutoLockMinutes` now returns whether it was stored, and a preset reports
  `partial`.
- Shared device said "Nothing stays after you close the tab". The sign-in session
  stays in the browser and the sign-out timer only runs while the app is open. Raised
  by Codex. Now: "Sign out before you leave the device."
- The same-tab sync event was spread into state without checks. Raised by
  type-design. Now only known keys with valid values are used.
- Smaller: a failed Never-record cleanup hid a stored timeout; unreadable storage
  skipped the new-account default; the 90-day limit was written twice; "nothing was
  changed" was not always true; two unused exports (knip).

Round 2 (`48c7e5a`):

- The partial-save message said the choice "applies now", but a timeout that could
  not be stored did not apply. Raised by all four reviewers. A finite timeout now
  applies in memory on a failed write, as auto-lock does. Never still changes nothing.

Round 3: all reviewers approved with no new findings.

## Needs your call (rejected)

1. **Type preset timeouts as a literal union of `TIMEOUT_OPTIONS`** (type-design,
   CONSIDER). Reviewer: an edited table could hold a value the hook rejects, after
   other writes landed. Primary: a test already checks every preset value is an
   option, and the table is three rows. The type plumbing costs more than it saves.
2. **Make `SessionSettings` a discriminated union** (type-design, CONSIDER).
   Reviewer: `{ timeoutMinutes, neverSince }` allows invalid pairs, and needs one cast.
   Primary: the loader is the only producer and guarantees the pairing, and the tests
   cover it. The reviewer accepted this in round 2.
3. **Unreadable storage counts as nothing stored** (type-design, CONSIDER, round 2).
   Reviewer: a getItem failure that is only transient could let the new-account
   default clear a stored Remember choice. Primary: the default runs only on a new
   account's setup screen, before any key exists to remember. The reviewer accepted
   this in round 3.

## Deferred

None. The PR 1 follow-up #289 (Never is not re-checked in a tab left open past 90
days) is still open and unchanged by this PR.
