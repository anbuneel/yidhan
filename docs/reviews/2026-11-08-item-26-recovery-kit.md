# Review audit — item 26, the recovery kit

Date: 2026-11-08
Reviewer: `/code-review` at high effort, one round, on the uncommitted diff
Outcome: 7 accepted and fixed before the first push, 2 accepted in part, 1 rejected

Written because one finding was rejected and two were taken only in part. `CLAUDE.md`
asks for an audit in that case. The accepted findings are listed only for context.

## Accepted — seven

| Finding | The fix |
|---|---|
| A lock or sign-out during the new-passphrase save zeroed the shared copy of `K` mid-rewrap; the self-check compared zeroes with zeroes and a vault wrapping zero bytes could be written, locking the account out of both credentials | `setPassphrase` works on its own copy taken before the first await, and checks that the recovery is still open before writing. Test: a lock during the save leaves the server unchanged |
| The same for the kit: an unmount during `commit` zeroed RK and `K` and a zero wrap could replace the stored one | `commit` works on copies and refuses to write once discarded. Test: a kit put away while saving writes nothing |
| `commit` silently replaced a recovery key made on another device when this tab's metadata was stale | `prepareRecoveryKit` refuses with `exists` unless the caller asks to replace (Settings does); `commit` refuses with `changed` if the stored wrap moved after the key was shown |
| A failed migration still showed a key that could never be saved | `prepareRecoveryKit` refuses with `not-ready` before any key is generated |
| "Use your recovery key" was hidden when this tab's cached metadata had no wrap, though the form reads the server's vault | The option is always shown; the form says plainly when the account has none |
| A retry after a landed-but-unconfirmed reset ran Argon2id twice | The reset reads the server first and builds on its own earlier write, then derives once |
| Duplicated types and button style | Types are imported from `services/recoveryKit.ts` with `import type`; the unlock screen uses `vaultQuietButtonStyle` |

## Accepted in part — two

**"Replacing the recovery key, or setting a new passphrase, does not revoke the old one
against someone holding an earlier copy of `user_metadata.vault`."**

True, and it is the design's position, not an oversight: §2.1 invalidates an old wrap
by overwriting it, and §2.4 says a compromised recovery key is a rotation (§2.3, item
103), because `K` does not change. The Settings copy that said the old key "stops
working" was changed to "the new key replaces your current one". The reset screen's
"your old passphrase stops working" was kept: it describes what the app and the
server do, and claiming more, or warning about server-side snapshots on a screen the
writer reaches after forgetting their passphrase, would be alarm without an action
they can take. Item 103 is where that action lives.

**"`K` is copied after `await loadRecoveryKit()`, so a lock during the import shows a
key built from zeroed bytes."**

The comment was wrong and is fixed. The copy was not moved into the context: it would
cost entry-chunk bytes for a case that now fails closed on its own. `prepareRecoveryKit`
verifies the copied bytes against the server's vault key-check before generating a
key, so zeroed bytes are refused and no key is ever shown. A lock also unmounts the
screen that asked, and the kit discards a late result.

## Rejected — one

**"The migration's check-then-write can now wipe another device's recovery wrap, or
undo a passphrase reset, because it writes a bare `{ vault }`."**

The race is real: two `updateUser` calls without a compare-and-set. It is rejected as
a fix for this pull request because there is no fix without one. The migration already
reads the server immediately before its write, with no Argon2id in between, so the
window is one round trip on a device that is migrating — that is, the first passphrase
unlock of an account on a new client — while a second device is at the same moment
saving a recovery key or a new passphrase on the same, already-migrated-elsewhere
account. Item 24 accepted this window when both writers wrapped the same `K` with the
same passphrase. Item 26 makes the loser's outcome worse, which is why the pull request
and `DECISIONS.md` (2026-11-08) name item 136 as the dependency for every vault write,
not only items 25 and 103. Narrowing the window further with a second read would still
not close it, and would read as a guarantee it is not.
