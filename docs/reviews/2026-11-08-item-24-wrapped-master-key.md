# Review audit — item 24, the wrapped master key

Date: 2026-11-08
Reviewer: `/code-review` at high effort, one round, on the uncommitted diff
Outcome: 9 accepted and fixed before the first push, 1 rejected

Written because one of the ten findings was **rejected**. `CLAUDE.md` asks for an
audit only in that case. The nine accepted findings are summarised here only so the
rejection has context.

## Accepted — nine

| Finding | The fix |
|---|---|
| `setupPassphrase` left an old `vault` beside new legacy fields, so the old passphrase would still unwrap the old key | Setup writes `vault: null` in the same `updateUser` call |
| The "another device already migrated" check was described as a guarantee | Comment now says it is a read, not a compare-and-set; harmless because both writers wrap the same `K`; items 25 and 103 need item 136 |
| The self-check compared `K` through base64 strings and an unzeroed copy | Byte-wise comparison, no copies |
| A `getUser` error was logged as "session changed" | It now fails the migration and is reported |
| The migration's Argon2id ran right as the library first painted | Waits for `requestIdleCallback` first |
| `CLAUDE.md` still named `encryption_key_check` as the restore gate | Invariant names both key-checks and says which applies |
| Duplicate hex decode and key import | KEK uses `outputType: 'binary'`; `importAesKey` and `importHmacKey` are exported from `encryption.ts` and reused |
| Four `vaultRead.status === 'valid'` branches inside the legacy path | One `unlockWithLegacyKeys` helper |
| Hand-written zeroing in four places | One `zeroKeys` helper in `vaultKey.ts` |

## Rejected — one

**"The restore paths verify against the vault key-check only, with no legacy fallback,
so a broken vault still breaks every refresh."**

The scenario is real: if the vault reads as valid but its key-check does not verify
`K`, the passphrase unlock falls back to the legacy path, and every later refresh or
remembered-browser restore fails its key-check and asks for the passphrase again.

It is rejected because the fix weakens the gate the restore paths exist to enforce.
Design §1.2 and §2.2 make the server's *current* key-check the single test a restored
key must pass. On a migrated account that is `vault.keyCheck`. Accepting a restored key
that passes either check means a stale remembered key is let in whenever either of two
blobs still matches it. Item 25 re-encrypts the legacy key-check and item 103 replaces
`K`; each would then have to keep two restore gates in step, which is the kind of
divergence §3.3 warns about.

The cost of the rejection is a re-prompt, not a lockout: the passphrase unlock still
works through the legacy fallback (`DECISIONS.md`, 2026-11-08), no note becomes
unreadable, and each failed restore is reported. A vault in that state is corruption
that §3.2 says the migration cannot produce, and it should be found and fixed, not
absorbed by a wider gate.
