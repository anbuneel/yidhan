# PR #302 review: guard every whole-list note reload

Multi-agent code review, id `4e91b2c7`, 2026-11-27. Base `main` at `092e802`. Closes #298.

## Reviewers

| Reviewer | Independence | Rounds run | Result |
|---|---|---|---|
| primary (Claude Code) | primary-native | 1–5 | counter-reviewed every finding |
| lens: code-reviewer | native | 1–4 | APPROVED from round 2 |
| lens: silent-failure-hunter | native | 1–4 | APPROVED from round 1 |
| lens: type-design-analyzer | native | 1–5 | REVISE in round 1, APPROVED from round 2 |
| Codex CLI | independent | 1 | failed: usage limit (resets 2026-11-28) |
| GitHub: chatgpt-codex-connector | independent | — | failed: usage limit |
| GitHub: claude[bot] | independent | on `33d591a` | one CONSIDER (same as 7 below) |

No cross-family reviewer ran. Both Codex channels hit their usage limit.

## Findings

| # | Round | Finding | Sources | Severity | Disposition |
|---|---|---|---|---|---|
| 1 | 1 | `stale` mixed "superseded" with "locked", so Refresh went silent when a sync refresh took over | all 3 lenses | SHOULD_FIX | agree, fixed in `6750f56`: `superseded` and `ended` |
| 2 | 1 | A failed or superseded tags read turned an applied reload into a thrown or `stale` one | all 3 lenses | SHOULD_FIX | agree, fixed in `6750f56` |
| 3 | 1 | After the work succeeded, a failed re-read said "Failed to resolve conflict" or "check the file format" | silent-failure, type-design | SHOULD_FIX | agree, fixed in `6750f56` |
| 4 | 1 | No tests for what callers do when the reload does not apply | code-reviewer | SHOULD_FIX | agree, fixed in `6750f56` |
| 5 | 1 | A failed first read after a refresh applied was only logged | silent-failure | CONSIDER | fixed in `6750f56`, then reverted to a console line in `1209d95` for the shell budget; the reviewer accepted |
| 6 | 1 | Locked-note retry ignores the result | silent-failure, type-design | CONSIDER | partial: comment |
| 7 | 1 | "Notes refreshed" shows when the reload deferred | silent-failure, claude[bot] | CONSIDER | reject |
| 8 | 1 | Conflict resolve on a deferred reload leaves the closing to App, with its notice | code-reviewer | CONSIDER | partial: comment; behaviour kept |
| 9 | 1 | `UpdateNotes` cannot force write-then-set | type-design | SHOULD_FIX | reject; reviewer accepted in round 2 |
| 10 | 1 | An updater that ignores `prev` still type-checks | type-design | CONSIDER | reject; reviewer accepted |
| 11 | 1 | The tags reload is unguarded against tag writes | type-design | CONSIDER | defer → #304; reviewer accepted |
| 12 | 1 | No changelog entry | code-reviewer | CONSIDER | already written, committed in `6750f56` |
| 13 | 2 | Markdown import showed the re-read error, then a success toast | all 3 lenses | CONSIDER | agree, fixed in `1209d95` |
| 14 | 3 | A stale lazy import chunk was reported as a bad file | all 3 lenses | SHOULD_FIX | agree, fixed in `fd581bc`; no automatic reload (see below) |
| 15 | 4 | The could-not-load message covered the whole import, not only the `import()` | type-design | CONSIDER | agree, fixed in `33b98d0` |

Round 2 also moved the import body into a lazy chunk (`src/utils/importFile.ts`). The guard added 194 bytes gzip to the app shell, which was at its 330 KB target. `DECISIONS.md` (2026-11-26) says the next shell growth needs code removed. The shell now measures 329.3 KB.

## Rejected and deferred, with both sides

**7. "Notes refreshed" on a deferred reload.** Reviewer: the list was not replaced yet, so the toast overstates. Primary: the sync did run, and a deferral applies within 5s (`MAX_REFRESH_BACKOFF_MS`). A deferral means the reader is changing notes right then. A second message for that would be noise.

**9. `UpdateNotes` cannot force write-then-set.** Reviewer: a caller can still `setNotes(optimistic); await write()` untracked. Suggested a `commitAfterWrite(write, update)` primitive and dropping the bare setter. Primary: reverts after a failed write, post-save reconciliation (`applySavedNote`), tag-rename propagation and realtime all need a setter that is not tied to a write. So a bare setter would stay, and misuse would stay possible through it. #298 asked for `applyOptimistic` only if it made misuse impossible without growing the save path. It does that for the two writers that change the list first (update, pin). Every other writer writes first, which the version check covers. The rule is in the doc on `setNotes`. Round 2: the reviewer accepted.

**10. An updater that ignores `prev`.** TypeScript cannot express it. Round 2: the reviewer accepted.

**11. Tags reload unguarded.** Deferred to #304. It existed before this PR in the #297 sync refresh and the old Refresh button. A tag that is undone on screen comes back on the next refresh, and IndexedDB holds it.

**14, no automatic reload.** Two reviewers suggested `reloadForUpdatedApp()`, as `main.tsx` does for chunk errors. Primary: held saves (`src/stores/heldSaves.ts`) are memory only. A reload from an import click could drop words that have not been saved. The message asks the reader to reload when ready. Round 4: both reviewers accepted.

## Verification

- New tests in `src/hooks/wholeListReloads.test.tsx` drive each caller (Refresh, conflict resolve, locked-note retry, import) through the real `useNotesSync`. Created, edited and deleted notes survive each reload, and no reload puts notes back after a lock. 17 of those 18 fail against `main`'s unguarded reload, and the one that passes is the control. The round 1 caller tests and `src/hooks/useImport.test.tsx` fail on the commit before their fix.
- `npm run check` passed after every fix commit. The app-shell budget was checked with the CI Sentry placeholder DSN.
- E2E, `e2e/notes.spec.ts`, chromium on system Chrome, `--repeat-each=3`, on `1209d95`: 57 passed, 3 skipped, 0 failed. `fd581bc` and `33b98d0` only change import error handling, which the spec does not cover.
