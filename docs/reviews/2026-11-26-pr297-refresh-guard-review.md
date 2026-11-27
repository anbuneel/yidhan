# PR #297 review: new note closing with "That note is no longer here"

Multi-agent code review, id `7c3e19a4`, 2026-11-26. Converged after 2 rounds. Base `main` at `d78f1ef`.

## Reviewers

| Reviewer | Independence | Round 1 | Round 2 |
|---|---|---|---|
| primary (Claude Code) | primary-native | ran | ran |
| lens: code-reviewer | native | REVISE, 3 findings | APPROVED |
| lens: silent-failure-hunter | native | REVISE, 4 findings | APPROVED |
| lens: type-design-analyzer | native | REVISE, 6 findings | APPROVED |
| Codex CLI | independent | failed: usage limit | not run |
| GitHub: chatgpt-codex-connector | independent | no findings on `4ce1fce` | — |
| GitHub: claude[bot] | independent | no findings on `4ce1fce` | — |

Cross-family coverage comes from the Codex GitHub connector only. The Codex CLI channel hit its usage limit.

## Round 1 (fixed in `26149ee`)

| # | Finding | Sources | Severity | Disposition |
|---|---|---|---|---|
| 1 | A refresh in flight across a lock retried with the old keys and put decrypted notes back into state | all 3 lenses | MUST_FIX | agree, fixed |
| 2 | Retries spun every 150ms while typing or while a write hung | code-reviewer, silent-failure | SHOULD_FIX | agree, fixed: wait for writes (5s), back off up to 5s, report stalls |
| 3 | Reads continued after unmount | code-reviewer | CONSIDER | agree, fixed |
| 4 | A deferred refresh also skipped the tags reload | silent-failure | CONSIDER | agree, fixed |
| 5 | The `trackLocalWrite` ordering contract was unwritten and unenforced | type-design | SHOULD_FIX | partial: documented; `applyOptimistic` API deferred to #298 |
| 6 | Refresh button, conflict resolve, locked-note retry and import replace the whole list unguarded | type-design | SHOULD_FIX | defer → #298 |
| 7 | The initial load can overwrite a newer refresh | silent-failure | CONSIDER | defer → #298 |
| 8 | No-op updates bump the list version | type-design | CONSIDER | reject |
| 9 | Derived `loading` compares keys by identity | type-design | CONSIDER | reject |

## Round 2 (fixed in `a5cc962`)

| # | Finding | Sources | Disposition |
|---|---|---|---|
| 10 | A timer closure from before a lock claimed a refresh id and cancelled the current refresh | code-reviewer | agree, fixed |
| 11 | The deferral count survived a user switch or lock | all 3 lenses | agree, fixed |
| 12 | A synchronous throw in `write()` skipped the version bump | silent-failure | agree, fixed |
| 13 | The stall was reported only at the fifth deferral | silent-failure | agree, fixed: every fifth |
| 14 | Deferral and `scheduleSyncRefresh` share one timer | type-design, code-reviewer | reject |
| 15 | A tracked write that never settles stops note refreshes for the session | silent-failure | defer: known limit |

## Rejected and deferred, with both sides

**8. No-op updates bump the version.** Reviewer: realtime self-echoes that return `prev` force extra full-library reads. Primary: a bump can only happen where `setNotes` is called. Comparing `next !== prev` inside the updater would move the bump to when React runs the updater, which can be later. A refresh check made in that gap would miss a real change. The cost is extra reads, which the backoff now bounds. Round 2: the reviewer accepted the rejection.

**9. Keys identity.** Reviewer: a new `DerivedKeys` object for the same vault flips `loading` until a refetch finishes. Primary: the fetch effect depends on the same identity and refetches anyway, so `loading` matches what is happening. Round 2: the reviewer accepted.

**14. Shared refresh timer.** Reviewer: a coalesced 150ms refresh can cut a backoff short, and a deferral can push a queued refresh back by up to 5s. Primary: either way a guarded refresh still runs. The backoff exists to stop a refresh from re-triggering itself, and it still does. Both reviewers rated it no correctness impact.

**15. Hung write.** Reviewer: if a tracked write never settles, every refresh waits 5s and defers, so remote changes stop showing. Primary: dropping the write from the set after the timeout would let a read taken before the write commits replace the list. That is the stale-copy bug this PR fixes. A hung IndexedDB write already blocks saving. The stall is reported every five deferrals. Revisit if telemetry shows it.

**6, 7, 5 (API part).** Deferred to #298. They are user-triggered or blocked by the app loader. No path through them drops a note the user just created on the sync-refresh timing this PR fixes.

## Verification

- `src/hooks/useNotesSync.test.tsx`: 18 tests. Each fix commit adds tests that fail on the previous head.
- `npm run check` passed after each round.
- E2E, `e2e/notes.spec.ts`, chromium, `--repeat-each=5`, after round 1: 94 passed, 1 failed, 5 skipped. The failure is "searches notes by content": the card has its title but no content. `createNote` in `e2e/fixtures.ts` accepts the title's "Saved" status before the content's 800ms debounce fires, then leaves the editor. That is case 2 of #288, not this PR. Round 2 changed only lock, unlock and timer handling, which the spec does not exercise, so E2E was not re-run.
