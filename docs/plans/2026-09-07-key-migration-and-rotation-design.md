Status: PROPOSAL
Last verified: 2026-09-07

# Key migration and rotation

The design that items 24, 25, 26 and 103 implement. Item 23 is this document.

Today the vault key **is** the passphrase. `deriveKeys()` runs Argon2id over the
passphrase and a stored salt, takes 64 bytes out, and splits them: the first 32
become the AES-256-GCM note key, the last 32 become the HMAC-SHA-256 content-hash
key. There is no indirection. Every consequence follows from that one fact:

- Changing the passphrase changes the key, so it means re-encrypting every note.
- There is no recovery. Forget the passphrase and the ciphertext is noise.
- A key compromise and a passphrase change are the same operation, so neither can
  be done cheaply and neither can be done at all without touching every row.

The fix is one level of indirection: a random master key `K` that outlives the
passphrase, wrapped by a key-encryption key derived from it. This document says
what `K` is, what gets wrapped, how the three key-change flows differ, and what
happens when a migration is interrupted, when two devices race, when a device has
been offline across a change, and when a backup predates the whole thing.

It does not schedule the work. The items own that.

---

## 1. The material

**`K` is 64 bytes, not 32.** The current scheme derives 64 bytes and splits them
into two keys with different algorithms — AES-GCM and HMAC. Both are load-bearing:
the AES key decrypts the note, the HMAC key computes the `content_hash` that the
sync engine compares to decide whether the server has acknowledged the current
content. Wrapping only the AES key would leave the HMAC key still derived from the
passphrase, which would silently break every save-confirmation path the moment the
passphrase changed — "Synced" would never appear again for that user, and nothing
would say why.

So the wrapped material is the concatenation `rawEncryptionKey || rawHashKey`, 64
bytes, generated once by `crypto.getRandomValues()` at migration time. `K` is
never derived from anything and never leaves the device unwrapped.

**The KEK is derived, `K` is random.** `KEK = Argon2id(passphrase, kekSalt)`, same
parameters as today (`ARGON2_PARAMS`), a *fresh* 16-byte `kekSalt` that is not the
existing `encryption_salt`. Reusing the old salt would make the KEK bit-identical
to the pre-migration key, so a stolen pre-migration key would unwrap `K` forever.

**The wrap is AES-256-GCM with AAD.** `wrap(KEK, K)` = AES-GCM over the 64 bytes
with a fresh 12-byte IV and AAD `vault:<userId>:<wrapVersion>`. Binding the user
id stops a wrap from being replayed into another account; binding the version stops
an old wrap from being presented as a current one after a rotation.

### 1.1 What is stored, and where

`user_metadata` gains a `vault` object. The pre-migration fields stay exactly where
they are until §3.1 removes them, because a client running old code must keep
working while the migration is in flight.

| Field | Meaning |
|---|---|
| `vault.version` | Wrap schema version. `1` for this design. |
| `vault.wrapVersion` | Monotonic counter, incremented by every key change. The concurrency and stale-device signal. |
| `vault.kekSalt` | base64, 16 bytes. Argon2id salt for the KEK. Distinct from `encryption_salt`. |
| `vault.wrappedKey` | base64. AES-GCM ciphertext of the 64 bytes of `K`. |
| `vault.wrapIv` | base64, 12 bytes. |
| `vault.keyCheck`, `vault.keyCheckIv` | Key-check blob, encrypted **under `K`**, not under the KEK. |
| `vault.keyCheckVersion` | Bumped on every key change (§2.2). |
| `vault.recoveryWrap` | Optional. `wrap(RK, K)` — item 26. Absent until a recovery kit is made. |
| `vault.migratedAt` | ISO timestamp. Present only when §3 finished. |

`user_metadata` is carried in the JWT, so everything here is public to anyone
holding the token. That is already true of `encryption_salt` (issue #170 D1, item
136) and nothing above makes it worse: a salt, a version counter, and a ciphertext
that is useless without the passphrase. Item 136 moves the whole object to a table;
this design does not depend on which of the two it lives in, only that it is
per-user, server-held, and readable before unlock.

### 1.2 What the key-check verifies

Today `verifyKeyCheck()` decrypts a sentinel under the key derived from the typed
passphrase. After the migration it decrypts the sentinel under `K` — that is, after
the unwrap has already succeeded. This is deliberate and it is the invariant that
`CLAUDE.md` already states as the security gate:

> Every restore path — including refresh-time sessionStorage — must verify
> `encryption_key_check` before unlocking.

A successful GCM unwrap already proves the passphrase, because GCM authenticates.
The key-check is kept anyway, under `K`, because it is what the *restore* paths use:
a key restored from `sessionStorage` or `localStorage` never goes through an unwrap,
so the key-check is the only thing standing between a stale remembered key and a
silent unlock with the wrong key. Removing it after the migration would delete the
mechanism that §2.2 relies on.

---

## 2. The three flows

They are not variations on one operation. They differ in what changes, what has to
be re-encrypted, and what happens to other devices. Naming them apart is the point
of this document: every later key change names the flow it belongs to.

### 2.1 Passphrase change — re-wrap only (item 25)

`K` does not change. Notes are not touched.

1. Unwrap `K` with the current passphrase. (The user is unlocked, so `K` is already
   in memory; the unwrap is not repeated.)
2. Derive `KEK'` from the new passphrase with a **fresh** `kekSalt'`.
3. Compute `wrap(KEK', K)` with a fresh IV and AAD carrying `wrapVersion + 1`.
4. Compute a new key-check under `K` with a new IV, `keyCheckVersion + 1`.
5. Write `{kekSalt', wrappedKey', wrapIv', keyCheck', keyCheckIv',
   keyCheckVersion+1, wrapVersion+1}` in **one** `updateUser` call.
6. Re-read the user and confirm `wrapVersion` advanced before treating the change
   as done. Until that read returns, the UI says "changing", never "changed".

The old wrap is invalidated by being overwritten — there is no window where both
wraps are valid, because it is a single write. Step 6 is the rule the item's "done
when" states: *the new wrap is written and confirmed by the server before the old
wrap is invalidated*. Read as: nothing local is discarded until the server confirms.

Offline, this flow does not run. It is not queued as a note write is queued. The UI
reports it as pending and refuses to claim success, because a wrap written only
locally is a wrap that a second device will overwrite without knowing.

### 2.2 Remembered-device invalidation — key-check version bump

This is not a separate user action. It is the mechanism that makes 2.1 and 2.3
propagate, and it is why the key-check survives the migration.

Every device holding a remembered key holds raw `K` bytes in `localStorage`, plus,
implicitly, the `keyCheckVersion` that was current when it stored them. On every
restore path the device verifies the stored key against the *server's current*
key-check. After 2.1 or 2.3 the server's `keyCheckVersion` has advanced:

- **After a passphrase change (2.1):** `K` is unchanged, so the remembered key still
  decrypts the new key-check. The verification passes. The device stays unlocked.
  This is correct — the passphrase changed, the key did not, and forcing a re-prompt
  would teach users that changing a passphrase costs them every device.
- **After a rotation (2.3):** `K` changed, so the remembered key fails the new
  key-check. The device clears its remembered blob and prompts for the passphrase.
  This is the invalidation.
- **After any change, on a device that cannot reach the server:** it verifies against
  its cached key-check and stays unlocked on local data. §4.3 covers what it does
  when it reconnects.

The distinction matters for copy: a passphrase change must not promise that other
devices are locked out, because they are not. Only 2.3 does that. Item 25's "every
other device requires re-unlock on next use" is satisfied for the *passphrase* — a
device that locks and re-prompts needs the new passphrase — not for a device that is
currently unlocked with a remembered key.

### 2.3 Compromise rotation — new `K`, full re-encryption (item 103)

The expensive one. Used when `K` itself may be exposed: a stolen device, a leaked
`localStorage` blob, an XSS report.

1. **Pause sync.** No queue drains, no realtime upserts apply, no pulls run. A note
   written under `K_old` after the re-encryption pass has read it would survive the
   rotation as unreadable ciphertext.
2. Generate `K_new` (64 random bytes) and a fresh `kekSalt`.
3. Write a `rotation` record — server-side, alongside the vault object — holding
   `{fromWrapVersion, toWrapVersion, startedAt, cursor}`. This is the resume point.
4. Re-encrypt every note: read the row, decrypt under `K_old`, re-encrypt under
   `K_new` with a fresh IV, recompute `content_hash` under the new HMAC half, write.
   Advance `cursor`. Batched, ordered by `id`, resumable at any point. Shares
   (item 122's `note_shares` rows) carry per-share keys and are unaffected; the
   `expires_at` cap means they age out on their own.
5. Only when the cursor reaches the end: write the new wrap, key-check, and
   `wrapVersion + 1`.
6. Resume sync.

Step 5 last is the whole design. While the pass runs, the server still advertises
`K_old`'s wrap, so any device that unlocks mid-rotation gets `K_old` and reads the
not-yet-rotated rows correctly — and cannot write, because sync is paused. Flipping
the wrap first would strand every already-rotated row on every other device.

"After rotation no ciphertext on the server decrypts under the old key" is checked
by re-reading every row and asserting `decrypt(K_old, row)` throws.

### 2.4 Recovery kit (item 26)

A second wrap of the same `K`. `RK` is 256 random bits shown once as grouped base32;
`vault.recoveryWrap = wrap(RK, K)`. Unlocking with `RK` unwraps `K` directly and
then runs 2.1 to set a new passphrase. The recovery path never re-encrypts, because
`K` did not change.

If the recovery key is itself compromised, that is 2.3, not 2.1 — `RK` unwraps `K`,
so exposing `RK` exposes `K`.

---

## 3. Migration (item 24)

Existing users have `encryption_salt` and a key-check, no `vault` object. The
migration runs on the next successful unlock, when the derived key is in memory.

**`K` is the key they already have.** The migration does not generate a new `K`; it
adopts the existing derived 64 bytes as `K` and wraps them under a KEK derived from
the *same* passphrase with a *new* salt. That is what makes it free: no note is
re-encrypted, because nothing about the note key changed.

The consequence is honest and worth stating: immediately after migration, `K` is
still passphrase-derived material. Anyone who held the pre-migration key still holds
`K`. The migration buys the *ability* to change a passphrase cheaply and to rotate
at all; it does not itself rotate. A user who needs the old key dead runs 2.3.

### 3.1 Order of writes

1. Unlock succeeds by the old path. The 64 bytes are in memory.
2. Generate `kekSalt`, derive `KEK`, compute `wrap(KEK, K)`, compute a key-check
   under `K`.
3. `updateUser` writing the whole `vault` object **including `migratedAt`**, in one
   call, leaving `encryption_salt` and the legacy key-check fields untouched.
4. Re-read the user. If `vault.migratedAt` is present, the migration is done.
5. The legacy fields are removed by a **later** release, not this one — long enough
   after that no client still reads them.

Step 3 being a single write is what makes step 4 a sufficient completeness test, and
what makes §3.2 trivial.

### 3.2 Interruption

There is no partial state to resume, by construction. The migration is one atomic
metadata write preceded by pure computation. Killing the app at any point leaves
either "no `vault` object" (migration never happened; it retries on the next unlock)
or "complete `vault` object" (done). Nothing in between is reachable.

The one case that needs a decision: `updateUser` returns an error but the write
actually landed. The next unlock reads a complete `vault` object and skips the
migration. Correct with no special handling.

A rotation (2.3) *does* have a resumable middle, and that is what `rotation.cursor`
in §2.3 is for. Migration and rotation differ here precisely because migration
touches no note rows.

### 3.3 Reading during and after

A client reads `vault.wrappedKey` first; if absent, it falls back to the legacy
derived path and then migrates. So:

- **New client, unmigrated account:** legacy unlock, then migrate.
- **New client, migrated account:** unwrap.
- **Old client, migrated account:** ignores the `vault` object, uses
  `encryption_salt` and the legacy key-check, derives the same 64 bytes, works. This
  is why step 5 waits.
- **Old client after a passphrase change (2.1):** the legacy fields still describe
  the *old* passphrase, so the old client unlocks with the old passphrase and gets
  `K` — which is still correct, because 2.1 does not change `K`. It will not accept
  the new passphrase. Acceptable and bounded: the release that removes the legacy
  fields ends it, and until then the old client is not wrong, only behind.

That last row is the reason item 24 needs the deployment guard (item 36) shipped
first. A client that is *ahead* of its database is the failure the guard catches; a
client that is *behind* its account's vault version is this row, and the guard's
`schema_version` read is where a future "your app is too old for this vault" message
belongs.

---

## 4. The hard cases

### 4.1 Two devices change concurrently

Both devices read `wrapVersion = n`. Both compute a new wrap. Both write.

`updateUser` has no compare-and-set, so the second write wins the storage and the
first device believes it succeeded. That is the bug this section exists to prevent.

**Resolution: the writer verifies, and the loser re-prompts.** After writing, a
device re-reads the vault object and checks that `wrapVersion === n + 1` **and** that
`wrappedKey` is byte-identical to what it wrote. If either differs, another device
won; the local change is abandoned, the passphrase the user typed is discarded, and
the UI says the passphrase was changed on another device and asks them to unlock
again. Never "changed" — the user must know which passphrase is live.

If both devices somehow read back their own write (a genuine last-writer-wins tie),
the one whose bytes are not in the final read loses on its *next* read, at the
latest on the next unlock, when its wrap fails to unwrap. It re-prompts. The vault
is never corrupted, because both wraps wrap the *same* `K` — only one passphrase
survives, and no data is lost either way.

For 2.3 this is stricter: a rotation checks `wrapVersion` before every batch write
and aborts if it moved. Two concurrent rotations would produce two different `K`s and
a half-and-half library, which is data loss. Aborting on a version move is what stops
it. Real compare-and-set belongs with item 136's move to a table, where a
`WHERE wrap_version = n` update makes this a database guarantee instead of a
convention; until then the read-back is what we have and the test asserts it.

### 4.2 A device that has been offline across a change

It holds `K` (remembered) and a cached `wrapVersion`. It reconnects.

- Server `wrapVersion` unchanged → nothing happened. Continue.
- Server `wrapVersion` advanced, remembered `K` still passes the current key-check →
  a passphrase change (2.1) happened. `K` is unchanged. Continue unlocked, update the
  cached version. Any note written while offline is still encrypted under the right
  key and syncs normally.
- Server `wrapVersion` advanced, remembered `K` fails the current key-check → a
  rotation (2.3) happened. `K` is dead.

The third case is the one that can lose words, and the rule is: **decrypt the queue
before discarding the key.** The device still holds `K_old` and its queued writes are
ciphertext under `K_old`. It must, in this order: pause sync, decrypt every queued
payload under `K_old` into memory, prompt for the passphrase, unwrap `K_new`,
re-encrypt the queue under `K_new`, then clear `K_old` and resume. A device that
clears `K_old` on the version mismatch and *then* prompts has destroyed every
unsynced note it was holding. The test for this is not optional.

### 4.3 A backup restored from before the migration

Item 38's `.yidhan` export is v2 JSON under a backup key derived from a
user-supplied backup passphrase — it is not encrypted under `K` at all. That is the
property that makes this case easy: a backup's readability does not depend on the
vault's key generation.

Restoring a pre-migration backup into a migrated account decrypts under the backup
key, then re-encrypts each note under whatever `K` the account currently has, through
the ordinary create path. Nothing in the backup references `K`, `wrapVersion`, or the
key-check, and nothing should be added that does. A backup that carried a wrapped `K`
would be a backup that stops opening after a rotation.

Backups carry a `formatVersion`. A restore into an account whose vault version is
*older* than the backup's is refused with a message, not attempted — that is the
guard from item 36 doing its job on a different axis.

---

## 5. Test list

Every test names the item that owns it. Each item's "done when" is satisfied by the
tests listed against it and nothing else.

### Item 24 — wrapped master key

| # | Test | Asserts |
|---|---|---|
| 24-T1 | Migration wraps and unwraps the full 64 bytes | The AES half and the HMAC half both survive the wrap round-trip; a note encrypted before the migration decrypts after it, and its `content_hash` is unchanged. §1 |
| 24-T2 | Migration re-encrypts nothing | Every note row's `encrypted_payload` and `encryption_iv` are byte-identical before and after. §3 |
| 24-T3 | Interrupted migration completes on the next unlock | With `updateUser` made to throw, the account is left unmigrated and usable; a second unlock migrates it. §3.2 |
| 24-T4 | A landed write reported as an error is not repeated | `updateUser` writes then throws; the next unlock reads a complete vault object and skips the migration. §3.2 |
| 24-T5 | The key-check still verifies `K` after migration | `verifyKeyCheck` against `vault.keyCheck` passes with unwrapped `K` and fails with 64 other bytes. §1.2 |
| 24-T6 | The KEK salt is not the legacy salt | `vault.kekSalt !== encryption_salt`, and the KEK derived from the legacy salt does not unwrap. §1 |
| 24-T7 | A migrated account still opens on the legacy path | With the vault object present, the legacy fields still derive a key that decrypts existing notes. §3.3 |

### Item 25 — passphrase change

| # | Test | Asserts |
|---|---|---|
| 25-T1 | Re-wrap changes the wrap, not `K` | After the change, unwrapping with the new passphrase yields byte-identical `K`; no note row changed. §2.1 |
| 25-T2 | The old passphrase stops working | Unwrapping with the old passphrase fails. §2.1 |
| 25-T3 | Nothing is discarded before the server confirms | With the `updateUser` write failing, the old passphrase still unlocks and the UI reported no success. §2.1 |
| 25-T4 | `wrapVersion` and `keyCheckVersion` both advance | Exactly one increment each, in a single write. §2.1 |
| 25-T5 | Two devices changing concurrently — one wins | Two-device integration test: device B's write lands last; device A's read-back mismatches, A abandons its change and re-prompts; B's passphrase is the live one; `K` is unchanged for both. §4.1 |
| 25-T6 | An offline change is reported as pending, never complete | With the network down, the flow does not queue, does not claim success, and the old passphrase still unlocks. §2.1 |
| 25-T7 | A remembered device stays unlocked after a passphrase change | `K` unchanged → the remembered blob passes the new key-check → no re-prompt. §2.2 |

### Item 26 — recovery kit

| # | Test | Asserts |
|---|---|---|
| 26-T1 | `RK` unwraps the same `K` | `unwrap(RK, recoveryWrap)` is byte-identical to `unwrap(KEK, wrappedKey)`. §2.4 |
| 26-T2 | Full recovery path, end to end | E2E: generate the kit, forget the passphrase, enter the recovery key, read notes, set a new passphrase, and confirm the old wrap no longer unwraps. §2.4 + §2.1 |
| 26-T3 | The kit is shown once and requires confirmation | The key is not retrievable after the confirmation step. §2.4 |
| 26-T4 | Recovery re-encrypts nothing | Note rows are byte-identical across the whole path. §2.4 |

### Item 103 — compromise rotation

| # | Test | Asserts |
|---|---|---|
| 103-T1 | No ciphertext survives under the old key | After rotation, every row fails to decrypt under `K_old` and succeeds under `K_new`. §2.3 |
| 103-T2 | The wrap flips last | With the re-encryption pass made to fail midway, the server still advertises `K_old`'s wrap and every not-yet-rotated row is readable. §2.3 |
| 103-T3 | An interrupted rotation resumes from the cursor | Restarting after a mid-pass failure rotates the remaining rows and no others. §2.3 |
| 103-T4 | Sync is paused for the whole pass | No queue drain, pull, or realtime upsert applies between step 1 and step 6. §2.3 |
| 103-T5 | A remembered device is forced to re-unlock | The stored `K_old` fails the new key-check; the blob is cleared and the passphrase is required. §2.2 |
| 103-T6 | An offline device's queued writes survive | Integration test: a device queues writes under `K_old`, a rotation happens, the device reconnects — the queued payloads are decrypted under `K_old` and re-encrypted under `K_new`, and no queued note is lost. §4.2 |
| 103-T7 | A concurrent rotation aborts instead of interleaving | A second rotation started against a moved `wrapVersion` aborts before writing any row. §4.1 |
| 103-T8 | A pre-migration backup restores into a rotated account | Item 38's restore path re-encrypts under the current `K`; every note opens. §4.3 |

---

## 6. What this design refuses

- **Wrapping only the AES key.** §1. It would break `content_hash` silently, and a
  silent break in the save-confirmation path is worse than no change at all.
- **Deriving the KEK from the existing `encryption_salt`.** §1. It would make the KEK
  equal to the pre-migration key and keep a stolen key useful forever.
- **Flipping the wrap before the re-encryption pass finishes.** §2.3. It strands
  every already-rotated row on every other device.
- **Treating a passphrase change as a device lockout.** §2.2. It is not one, and copy
  that says otherwise is a false security promise.
- **Clearing `K_old` on a version mismatch before draining the queue.** §4.2. It
  destroys unsynced words, which is the one thing this product must never do.
- **Putting a wrapped `K` in a backup.** §4.3. It would make backups stop opening
  after a rotation.
- **Removing the key-check because GCM already authenticates.** §1.2. The restore
  paths never run an unwrap; the key-check is the only gate they have.
