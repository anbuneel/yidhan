# Review audit — item 159, conditional note writes

Date: 2026-11-08
Reviewer: `/code-review` at high effort, one round, on the uncommitted diff
Outcome: 6 accepted and fixed before the first push, 3 rejected, 1 out of scope

Written because findings were rejected and one was left out of scope. `CLAUDE.md`
asks for an audit in that case. The accepted findings are listed only for context.

## Accepted — six

| Finding | The fix |
|---|---|
| With no conflict handler registered, a stale write threw a retry; the next attempt's pre-write check fell through and wrote over the newer row | A stale write found after a zero-row result raises the conflict whether or not a handler is registered. Test: no handler, the note is marked `conflict` and nothing is written again |
| The pre-write read discarded its `error`, so a failed read meant no conflict check and no version filter | The read goes through `fetchServerNoteForWrite`, which throws on error and fails closed on plaintext. Test: a failed read writes nothing |
| A newer row whose words were the base version's (another device only pinned or trashed) raised a false conflict | "Content unaffected" now means the newer row's hash is ours or the base version's. Test: a trash on the other device raises no conflict |
| The same-content rewrite sent `pinned`, `deleted_at` and `display_updated_at` from a staged conflict-resolution payload, undoing the other device's change | The rewrite drops any of those three fields the newer row changed. Test: the other device's trash survives |
| The rewrite path moved local `lastSyncedAt` forward before the rewrite succeeded | Removed; `markNoteSynced` sets it once the write lands |
| No changelog entry | Added as 3.19.38 |

## Rejected — three

**"A zero-row update over an unchanged version retries until the stale auto-block,
where before it went to the reinsert handling."** Before this change, the same case
reached `reinsertNoteFromLocalRecord`, found the row present and threw the same kind of
retry ("exists on the server but the write returned no row"). The outcome — pending,
then the stale auto-block — is unchanged. Only the message differs.

**"The pre-write check compares with `localNote.contentHash`, the post-write check with
the payload hash; fold both into one loop."** The pre-write check is left as it was on
purpose so this change cannot alter the paths where nothing raced. The post-write check
uses the payload hash because that is what this write would put on the server; using
the local hash would raise a false conflict when the user typed again while the entry
was in flight (that newer text has its own queued update).

**"The missing-row path reads the row twice: once in the loop and once inside the
reinsert."** The reinsert's own check is what stops a rebuild over a row that exists;
skipping it for one caller adds a parameter to save one read on a rare path.

## Out of scope — one

**"The conflict-resolution direct writes in `useSyncEngine.ts` still filter on id
alone."** True: a third device's write that lands while the conflict screen is open can
be replaced when the user chooses. The brief for item 159 limits the change to the
`processNoteOperation` switch. Both resolution paths also stage a queued `update`, which
now goes through the conditional write. The direct write itself is left for roadmap
item 35's write contract or a follow-up item.
