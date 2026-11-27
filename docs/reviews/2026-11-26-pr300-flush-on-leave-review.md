# PR #300 review: Save the note you leave (#288)

Date: 2026-11-26. Review id `a7c3e91f`. Primary driver: Claude Code. Options: effort
balanced, decisions deferred, no required reviewer.

## Reviewers

| Reviewer | Independence | Round 1 | Round 2 | Round 3 |
|---|---|---|---|---|
| primary-native | primary | ran | ran | ran |
| lens: code-reviewer | native | ran | ran | ran |
| lens: silent-failure-hunter | native | ran | ran | ran |
| lens: type-design-analyzer | native | ran | ran | ran |
| Codex CLI 0.166.0 | independent | ran | ran | ran |
| GitHub: chatgpt-codex-connector, claude[bot] | independent | polled | polled | polled |
| Claude CLI | same family | skipped | skipped | skipped |

## Round 1 findings and dispositions

| # | Source | Finding | Severity | Disposition |
|---|---|---|---|---|
| 1 | silent-failure, code-reviewer, type-design, claude[bot] | Auto-lock waits on saves with no time limit | MUST_FIX | agree: bounded at 3s, locks either way |
| 2 | Codex CLI, gh Codex, type-design | Late failure from an earlier vault session or user can be held after the store reopens | MUST_FIX | agree: session number per close; saves and holds from an older session are refused |
| 3 | Codex CLI | Words queued behind a slow save are lost when the note is reopened and typed on | MUST_FIX | agree: reopened Editor starts from the pending draft; an incoming copy equal to the screen is adopted |
| 4 | Codex CLI, gh Codex | Lock now does not wait for saves of Editors already gone | MUST_FIX | agree: every save is tracked; Lock now drains them, bounded |
| 5 | Codex CLI | Retry reads an optimistic copy and may report "already saved" | MUST_FIX | agree: Retry waits for the note's in-flight write; one retry per entry |
| 6 | Codex CLI | Copy and Retry release a newer entry than they handled | MUST_FIX | agree: entries carry a revision; release names it |
| 7 | Codex CLI | DemoPage renders the Editor without a key | SHOULD_FIX | agree: keyed |
| 8 | type-design, code-reviewer | Retry's save-over bypasses the per-note queue and ignores an open Editor's draft | SHOULD_FIX | agree: runs in the queue; an open draft forces keep-as-copy |
| 9 | type-design | Two retries of one entry can both keep a copy | SHOULD_FIX | agree: shared in-progress retry per entry; buttons disabled while busy |
| 10 | silent-failure | Lock now held back, then entries cleared, never locks | SHOULD_FIX | agree: the lock goes ahead once Retry or Copy deals with the last entry |
| 11 | silent-failure, code-reviewer | Released note left by browser Back drops its words | SHOULD_FIX | agree: held unless the writer chose Let go |
| 12 | silent-failure | A failed Retry looks like a dead button | SHOULD_FIX | agree: "Still not saved" detail |
| 13 | silent-failure | Auto-lock and sign-out drop held words with no notice | SHOULD_FIX | partial: a toast says how many notes' words were dropped; the plan's trade (drop on lock) stands |
| 14 | type-design | Flusher drops the save result | CONSIDER | agree: flushers return a boolean; Lock now refuses on a failed flush |
| 15 | type-design, silent-failure | Blank check treats image- or divider-only drafts as empty | CONSIDER | agree: blank means empty paragraphs only |
| 16 | code-reviewer | Wait loop can spin if a save settles before it is registered | CONSIDER | agree: the save promise is registered before the write starts; the loop stops on a repeat |
| 17 | code-reviewer | Old Editor's leave save lands after the reopened Editor took stale text | CONSIDER | agree: same fix as 3 |
| 18 | claude[bot] | No `DECISIONS.md` entry | process | agree: added |
| 19 | silent-failure | Held entries never show a safe error message | CONSIDER | defer |
| 20 | silent-failure | A save waits forever behind a hung earlier save of the same note | CONSIDER | defer |
| 21 | silent-failure | Notice not shown on signed-in entry screens (changelog, legal) | CONSIDER | defer |
| 22 | code-reviewer, claude[bot] | Plan should be ACTIVE, not PROPOSAL | CONSIDER | reject |
| 23 | CI (reported by the parent session) | Mixed static and dynamic import of `exportImport` fails the build | build | agree: static imports; the notice loads on demand instead |

Fix commit: `72ceb13`.

## Round 2 (verification of 72ceb13)

Every round-1 fix was confirmed by the reviewer that raised it. New findings:

| # | Source | Finding | Disposition |
|---|---|---|---|
| 24 | Codex, type-design, silent-failure, code-reviewer | Waiting drafts survive a lock | agree: drafts carry the session; every close clears them |
| 25 | Codex, code-reviewer | `run()` takes its slot a microtask late | agree: check and take in one step |
| 26 | Codex, silent-failure | A held-back Lock now completes without saving first | agree: goes through Lock now |
| 27 | Codex, silent-failure, code-reviewer | The lazy notice can reload the page while words are held | agree: fetched on unlock, plain `lazy`, a boundary that never reloads |
| 28 | Codex | Keep's follow-up write bypasses the queue | agree: queued and tracked |
| 29 | type-design | Retry's save-over does not re-check the session after waiting | agree: re-checks session and stored text in its slot |
| 30 | type-design, silent-failure | "Still being saved" notice can stay up; Copy waits on a hung Retry | agree: "Try again"; Copy independent; Retry wait capped at 5s |
| 31 | silent-failure | Sign-out and failed auto-lock saves drop words quietly; toast before lock | agree: one toast when words are dropped; toast after the lock |

Fix commit: `d2c1838`.

## Round 3 (verification of d2c1838)

All round-2 fixes confirmed. New findings:

| # | Source | Finding | Disposition |
|---|---|---|---|
| 32 | Codex | An older save failing late overwrites a released note's newer held words, or brings them back after Let go | agree: a released note is held only by the leave path |
| 33 | Codex, silent-failure, code-reviewer | The boundary fallback offers no Copy and no way to lock | agree: plain Copy of every held note and Lock anyway, with no lazy code |
| 34 | type-design | `open()` starts no new session | agree: it does now |
| 35 | type-design | A repeat idle tick toasts before the lock | agree: it waits for the lock in progress |
| 36 | code-reviewer | The deferred lock can fire while the writer types in a note | agree: dropped when an Editor is open |
| 37 | silent-failure | Retry's 5s cap covers only the first wait | defer: Copy and the lock stay bounded |

Fix commit: see the PR history after `d2c1838`. The per-note queue also left the app
shell (running saves are counted in the held-save store) to stay inside the 330 KB budget.

## Needs your call

### Rejected

**22. Plan status.** Reviewers: the plan ships with code, so it should read ACTIVE.
Primary: the brief for this work asked for `Status: PROPOSAL` so the maintainer reviews
the design in the PR. Flipping it to ACTIVE would also need another ACTIVE plan closed
(the cap is one). The maintainer flips it to COMPLETE and archives it when merging.

### Deferred

**19. Safe error text on held entries.** Reviewer: pass through messages known to be
safe, such as the locked-note refusal. Primary: worth doing, but it needs a typed error
for the locked-note refusal in `useNoteActions`; small follow-up.

**20. A save waits forever behind a hung earlier save.** Reviewer: put a time limit on
the wait and show "Not saved". Primary: the same unbounded wait existed before within one
Editor; a hung IndexedDB write is a wider problem than this PR. Locks are bounded now.

**37. Retry's time limit.** Reviewer: put the whole retry under the 5s cap. Primary: a
slow save that later succeeds would be reported as failed. Copy and the lock path are
already bounded, so the words can always be taken out.

**21. Notice on entry screens.** Reviewer: render it for every signed-in, unlocked view.
Primary: held entries stay in the store and show again in the library; only an
auto-lock while on a legal page would drop them unseen, and that drops them with a toast.

## What this still loses

- Words still failing to save at an auto-lock or sign-out: dropped so decrypted text
  does not outlive the vault. A toast says so.
- Anything not synced at sign-out: `clearOfflineData` deletes it. Existing behaviour.
- Words typed between the auto-lock flush and the lock (at most 3s).
