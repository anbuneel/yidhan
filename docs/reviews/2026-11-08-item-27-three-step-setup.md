# Review audit — item 27, three-step passphrase setup

Date: 2026-11-08
Reviewer: `/code-review` at high effort, one round, on the uncommitted diff
Outcome: 6 accepted and fixed before the first push, 1 accepted in part, 1 rejected

Written because one finding was rejected and one was taken only in part. `CLAUDE.md`
asks for an audit in that case. The accepted findings are listed only for context.

## Accepted — six

| Finding | The fix |
|---|---|
| A write that landed but reported an error was recognised only inside the same recovery kit. Back stayed enabled after the failure, so the writer could start a second setup. The server would then refuse it as "set up on another device", while it actually holds the first passphrase and key | The setup records that a write was sent. Back is disabled from then on, and the setup refuses to make a second key. Retrying Save with the same key still works. Tests: component and fake server |
| A lock or sign-out while the write was in flight was undone: the wrapper persisted the session and restored the setup state after the lock. Leaving step 3 through a stale closure could install keys the lock had zeroed | A setup epoch, bumped by every lock and user change, is taken before the write and checked after it. A passed epoch zeroes the keys and holds nothing. `finishAccountSetup` checks the epoch too, and the screen checks that it is still mounted. Test: a lock during an in-flight write leaves no session copy, no keys and no step 3 |
| A remount after the write landed reset the screen to step 1, which then refused to continue | The context exposes `setupDone`. The screen starts at step 3 when it is set. Test: a remount comes back to step 3 |
| `K` was not zeroed if the second key import failed after `buildNewVault` returned | `buildNewVault` returns the imported keys itself and zeroes every copy on any failure |
| `buildNewVault` repeated `buildMigratedVault` almost line for line | Both call one `sealVault` helper: KEK salt, KEK, wrap, key-check, the vault literal and the reopen self-check. The migration keeps its legacy key-check check in front |
| `K` was imported into Web Crypto twice per setup | Fixed with the item above: imported once |

## Accepted in part — one

**"The recovery-kit commit is wrapped three times (service, context, screen), and the
committed keys are exposed twice."**

Taken in part. The context wrapper is where the lock epoch is checked. The screen's
wrapper exists only to disable Back while saving and after a write was sent:
`RecoveryKeyKit` does not report its saving state, and changing its props for this
would touch item 26's Settings and offer screens. The two exposures of the keys serve
different readers. `committedKeys()` is for the starter notes, and returns null once a
lock dropped them. `setupFlow.keys` is the context's own copy, installed at step 3. A
single source would make the screen read context state across an await, which is the
stale-closure problem the second accepted finding fixed.

## Rejected — one

**"The `|| (setup written)` term in `isEncryptionSetup` changes nothing observable: the
gate already shows the setup while `setupScreen` is true, and the restore effects skip
because of `sessionRestoreAttemptedRef`."**

It is load-bearing after step 3, not during it. `finishAccountSetup` clears
`setupScreen`. If the auth context has not yet handed over the new `user_metadata`,
`isEncryptionSetup` would read false and the gate would show step 1 again for an
account that is set up. `updateUser` normally fires `USER_UPDATED` before resolving,
so the window is short, but nothing guarantees it is closed by the time the writer
clicks. The term was kept and moved: it is now a marker set when the write lands and
cleared only on a user change, so it outlives step 3. Test: "still counts as set up
after step 3 when the auth context has not caught up".
