Status: PROPOSAL
Last verified: 2026-09-07

# Key migration and rotation

The design that items 24, 25, 26 and 103 implement. Item 23 is this document.

**On the status line.** Item 23 — writing and reviewing this design — is finished, and
`docs/progress.md` records it. The *design* is still a proposal, because the work it
describes has not been built. Those are two different things and the header tracks the
second, which is what a reader needs to know. It flips to ACTIVE when someone picks up
item 24, and it does not move to `docs/archive/` before then: archiving a document that
four open items depend on would bury the thing they are supposed to be built from.

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

**The KEK is derived, `K` is random.** `KEK = Argon2id(passphrase, kekSalt)` with the
same *cost* as today — `parallelism`, `iterations` and `memorySize` from
`ARGON2_PARAMS` — but **`hashLength: 32`, not 64**. `ARGON2_PARAMS.hashLength` is 64
because the existing derivation splits its output into an AES key and an HMAC key;
the KEK is a single AES-256-GCM key and 64 bytes cannot be imported as one. Taking
the cost constants wholesale would produce a KEK that fails `importKey` before it
wrapped a single account. Derive 32 bytes directly rather than deriving 64 and
truncating: a truncation is an undocumented convention that the next reader has to
guess at.

The salt is a *fresh* 16-byte `kekSalt`, not the existing `encryption_salt`. Reusing
the old salt would make the KEK bit-identical to the pre-migration key, so a stolen
pre-migration key would unwrap `K` forever.

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
5. Re-encrypt the **legacy** key-check under `K` with a KEK derived from the new
   passphrase and a fresh legacy salt, so the retired passphrase stops opening the
   vault through an old client (§3.3).
6. Write `{kekSalt', wrappedKey', wrapIv', keyCheck', keyCheckIv',
   keyCheckVersion+1, wrapVersion+1, encryption_salt', encryption_key_check'}` in
   **one conditional write**, applied only if the stored `wrapVersion` is still `n`
   (§4.1). A read-back is not a substitute; a losing writer must be rejected by the
   server, not discover its loss later.
7. On rejection: discard the typed passphrase, tell the user it was changed on
   another device, and ask them to unlock again. Until the write is *accepted*, the
   UI says "changing", never "changed".

Everything moves in that one write, and that is the point: the new wrap, the bumped
versions and the retired legacy credential cannot land separately. The old wrap is
invalidated by being overwritten, so there is no window where two wraps are valid.
Steps 6 and 7 together are the item's "done when" — *the new wrap is written and
confirmed by the server before the old wrap is invalidated* — read as: nothing local
is discarded until the server accepts.

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

The check is **the stored version against the server's version**, not merely whether
the stored key still decrypts. That distinction is the whole mechanism, and getting
it wrong is how an earlier draft of this document broke a repository invariant:

- **After a passphrase change (2.1):** `K` is unchanged, so a remembered key would
  still decrypt the new key-check — which is exactly why decryption cannot be the
  test. The device compares the `keyCheckVersion` it stored alongside the blob with
  the server's. The server's is higher, so the blob is stale: the device clears it
  and prompts for the passphrase, whether or not the bytes would still have worked.
- **After a rotation (2.3):** the version has advanced *and* `K` has changed, so the
  device fails both tests. Same outcome, and the version test is what makes it
  immediate rather than dependent on a decryption attempt.

- **After any change, on a device that cannot reach the server:** it verifies against
  its cached key-check and stays unlocked on local data. §4.3 covers what it does
  when it reconnects.

An earlier draft of this section argued the opposite — that a passphrase change should
leave remembered devices unlocked, because `K` had not changed and re-prompting would
"teach users that changing a passphrase costs them every device." That was wrong on
both counts, and it is recorded here rather than deleted because it is the mistake a
future reader is most likely to make again.

It contradicted the invariant in `CLAUDE.md` that every restore path verifies the
key-check *so that a stale key after a passphrase change is caught*. And it broke the
reason people change a passphrase: they believe the old one is compromised. A change
that silently leaves every remembered session unlocked is not a change they would
recognise as one. Item 25's "every other device requires re-unlock on next use" is a
requirement, not a description to be reinterpreted until the design satisfies it.

The stored `keyCheckVersion` is therefore not decoration. A remembered blob that does
not carry one is treated as stale.

### 2.3 Compromise rotation — new `K`, full re-encryption (item 103)

The expensive one. Used when `K` itself may be exposed: a stolen device, a leaked
`localStorage` blob, an XSS report.

1. **Take the rotation lock, server-side.** A compare-and-set write claiming
   `rotation = {owner, startedAt, fromWrapVersion: n}`, conditional on there being no
   live rotation and on `wrapVersion` still being `n`. If the claim fails, another
   rotation owns the vault and this one stops before touching a row.

   The lock cannot be `wrapVersion` itself. `wrapVersion` does not advance until step
   6, so two rotations starting at `n` would both keep reading `n` before every batch
   and both would pass a "has the version moved?" check while alternately rewriting
   rows under two different random keys. Checking after the fact is too late: by then
   the other rotation has already written. The claim has to happen before the first
   batch, and it has to be atomic.

2. **Raise the rotation gate for every device, not this one.** The gate is the
   `rotation` record written in step 1, and every client reads it: while it is live
   and not owned by this device, that client refuses to push and refuses to pull.

   `pauseSync()` in `src/services/syncEngine.ts` is module-local state in one tab's
   JavaScript process. It stops *this* device. It has no effect on a second device,
   which will happily pull an already-rotated row and fail to decrypt it — and because
   encrypted reads fail closed, that breaks the second device's library immediately —
   or push an edit made under `K_old` into a row the pass has already moved past,
   leaving old-key ciphertext behind after the rotation "finished". An earlier draft
   of this document said "sync is paused" and meant only the local flag. It is not
   sufficient and it was not a small gap.

3. **Generate `K_new` (64 random bytes) and a fresh `kekSalt`, then persist a
   recoverable copy of `K_new` before rewriting anything.** Write
   `rotation.pendingWrap = wrap(KEK_new, K_new)` — the same wrap format as
   `vault.wrappedKey`, alongside its own salt and IV — as part of the same record.

   This is the step whose absence would have been unrecoverable data loss. If
   `K_new` lives only in the rotating tab's memory and that tab dies after the first
   batch, the client restarts holding `K_old`, cannot decrypt the rows already
   rotated, and cannot regenerate a random key it never wrote down. Those notes would
   be gone permanently — and the cursor resume this document promises, and test
   103-T3, would both be impossible. `pendingWrap` is what makes the cursor mean
   anything.

4. Re-encrypt every note: read the row, decrypt under `K_old`, re-encrypt under
   `K_new` with a fresh IV, recompute `content_hash` under the new HMAC half, write.
   Advance `cursor` in the same record. Batched, ordered by `id`, resumable at any
   point — on resume, unwrap `K_new` from `pendingWrap` and continue from `cursor`.
   Shares (item 122's `note_shares` rows) carry per-share keys and are unaffected; the
   `expires_at` cap means they age out on their own.

5. **Only when the cursor reaches the end:** promote `pendingWrap` to
   `vault.wrappedKey`, write the new key-check, and set `wrapVersion = n + 1`.

6. Clear the `rotation` record. Sync resumes on every device on its next read of it.

Step 5 landing last is the whole design. While the pass runs, the server still
advertises `K_old`'s wrap, so any device that unlocks mid-rotation gets `K_old` and
reads the not-yet-rotated rows correctly — and cannot write, because the gate in step
2 is server-side. Flipping the wrap first would strand every already-rotated row on
every other device.

Note what `pendingWrap` costs: for the duration of the pass, both `K_old` and `K_new`
are recoverable from the server by anyone holding the passphrase. That is the correct
trade — the alternative is a window in which a crash destroys notes — but it means a
rotation is not complete as a security event until step 6, and copy should not claim
otherwise while it is running.

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
- **Old client after a passphrase change (2.1):** this is the case that forces 2.1 to
  do more than re-wrap, and an earlier draft of this document got it wrong.

  The legacy fields describe the *old* passphrase. An old client ignores the `vault`
  object entirely, derives `K` from `encryption_salt` with the old passphrase, and
  unlocks every note. **The old passphrase therefore remains a working credential
  after the user has changed it** — not through a subtle race, but by design, for as
  long as the compatibility window lasts. The earlier draft called this "not wrong,
  only behind." It is wrong: a revoked credential that still opens the vault is a
  revocation that did not happen, and test 25-T2 asserts the opposite of what would
  actually be true.

  So **2.1 must invalidate the legacy path in the same write that re-wraps.** At §2.1
  step 5, computed into the single conditional write of step 6, the legacy
  `encryption_key_check` is re-encrypted
  under `K` using a KEK derived from the **new** passphrase and its own fresh legacy
  salt — so an old client's derivation from the old passphrase no longer verifies, and
  the old client re-prompts rather than unlocking. The legacy fields stay present (an
  old client must still be able to unlock with the *current* passphrase); what changes
  is that they stop describing the retired one.

  This is why the compatibility window has to be short, and why the release that
  removes the legacy fields should be scheduled rather than left open-ended: every
  extra field that has to be kept in step with a passphrase change is another place
  the two can silently diverge.

Item 24 needs the deployment guard (item 36) shipped first. A client that is *ahead*
of its database is the failure the guard catches; a client that is *behind* its
account's vault version is the row above, and the guard's `schema_version` read is
where a future "your app is too old for this vault" message belongs.

---

## 4. The hard cases

### 4.1 Two devices change concurrently

Both devices read `wrapVersion = n`. Both compute a new wrap. Both write.

`updateUser` has no compare-and-set, so the second write wins the storage and the
first device believes it succeeded. That is the bug this section exists to prevent.

**Resolution: the write itself must be conditional. A read-back is not enough.**

An earlier draft of this section proposed exactly that — write, then re-read and check
your own bytes came back — and it does not work. The ordinary interleaving defeats it:

```
A: write wrapVersion n+1, wrap_A     A: read back → n+1, wrap_A ✓ "success"
                                     B: write wrapVersion n+1, wrap_B
                                     B: read back → n+1, wrap_B ✓ "success"
```

Both devices report success. Only B's passphrase is live. A learns it lost at its next
unlock, which may be days later, and in the meantime has told its user the passphrase
was changed. That is precisely the outcome item 25 forbids: a change reported as
complete when it is not.

So the vault object needs a conditional write — a compare-and-set on `wrapVersion`, or
an operation token that a second writer at the same version cannot overwrite. Only one
writer at version `n` may produce version `n + 1`; the other is rejected by the server,
and *being rejected* is what makes it re-prompt, immediately and correctly.

`supabase.auth.updateUser` offers no such condition, which means **this design depends
on item 136** — moving the vault object out of `user_metadata` and into a table, where
`UPDATE ... WHERE wrap_version = n` is a database guarantee rather than a convention.
Item 136 is currently listed as an independent follow-up; it is not. Item 25 cannot be
implemented safely before it, and the roadmap should say so.

Until then the honest position is that concurrent passphrase changes are not safe, and
the feature waits — not that a read-back approximates the guarantee. No data is lost
either way, because both wraps wrap the *same* `K`; what is lost is the user's
knowledge of which passphrase is live, and that is not a small thing to be wrong about.

For 2.3 the same conclusion applies harder, and §2.3 step 1 states it: a rotation
claims a server-side lock before its first batch. Two concurrent rotations produce two
different `K`s and a half-and-half library, which *is* data loss, and no after-the-fact
version check can prevent it — `wrapVersion` does not move until the pass finishes, so
both rotations would see an unchanged version right up until the damage was done.

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
| 24-T8 | The KEK is one 32-byte key, not the 64 the legacy derivation produces | The KEK derivation asks Argon2id for 32 bytes rather than reusing `ARGON2_PARAMS.hashLength`; the result imports as AES-256-GCM, and a 64-byte derivation passed to the same `importKey` call throws. §1 |

### Item 25 — passphrase change

| # | Test | Asserts |
|---|---|---|
| 25-T1 | Re-wrap changes the wrap, not `K` | After the change, unwrapping with the new passphrase yields byte-identical `K`; no note row changed. §2.1 |
| 25-T2 | The old passphrase stops working | Unwrapping with the old passphrase fails. §2.1 |
| 25-T3 | Nothing is discarded before the server confirms | With the `updateUser` write failing, the old passphrase still unlocks and the UI reported no success. §2.1 |
| 25-T4 | `wrapVersion` and `keyCheckVersion` both advance | Exactly one increment each, in a single write. §2.1 |
| 25-T5 | Two devices changing concurrently — the loser is rejected by the server | Two-device integration test against a conditional write: both devices read `wrapVersion = n`, both attempt `n → n+1`; the second write is **rejected**, not applied. A never reports success, discards the typed passphrase and re-prompts; B's passphrase is the live one; `K` is unchanged for both. A read-back-only implementation fails this test, because both writes land. §4.1 |
| 25-T6 | An offline change is reported as pending, never complete | With the network down, the flow does not queue, does not claim success, and the old passphrase still unlocks. §2.1 |
| 25-T7 | A remembered device is re-prompted after a passphrase change | The stored blob still *decrypts* the new key-check — `K` did not change — and the device re-prompts anyway, because the `keyCheckVersion` it stored is behind the server's. A remembered blob carrying no version is treated as stale and also re-prompts. This is the test that fails if the version comparison is replaced by a decryption attempt. §2.2 |
| 25-T8 | The retired passphrase stops working on an old client too | After the change, a client that ignores the `vault` object and derives from `encryption_salt` fails to verify the legacy key-check with the **old** passphrase, and succeeds with the **new** one. Without §2.1 step 5 this test fails: the old passphrase still unlocks. §3.3 |

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
| 103-T3 | An interrupted rotation resumes from the cursor with a `K_new` it never held in memory | The rotating client is destroyed mid-pass and restarted holding only `K_old`. It unwraps `K_new` from `rotation.pendingWrap`, rotates the remaining rows and no others, and every row — rotated before and after the interruption — opens under `K_new`. With `pendingWrap` absent, the already-rotated rows are unrecoverable, which is the failure this test exists to catch. §2.3 |
| 103-T4 | The gate stops a *second* device, not only the rotating one | Two-device integration test: while the `rotation` record is live and owned by device A, device B refuses to push and refuses to pull — B's library is not emptied by a fail-closed read of an already-rotated row, and an edit B made under `K_old` is not pushed into a row the pass has moved past. A local `pauseSync()` flag alone fails this test. On device A, no queue drain, pull or realtime upsert applies between step 1 and step 6. §2.3 |
| 103-T5 | A remembered device is forced to re-unlock | The stored `K_old` fails the new key-check; the blob is cleared and the passphrase is required. §2.2 |
| 103-T6 | An offline device's queued writes survive | Integration test: a device queues writes under `K_old`, a rotation happens, the device reconnects — the queued payloads are decrypted under `K_old` and re-encrypted under `K_new`, and no queued note is lost. §4.2 |
| 103-T7 | A concurrent rotation aborts instead of interleaving | A second rotation attempts its compare-and-set claim while device A's `rotation` record is live — with `wrapVersion` still at `n`, because it does not move until the pass ends — and the claim is rejected before a single row is written. An implementation that gates on `wrapVersion` instead of on the claim fails this test. §2.3 + §4.1 |
| 103-T9 | `pendingWrap` is durable before the first row is rewritten | Ordering test: the write that persists `rotation.pendingWrap` is observed on the server before any note row's `encrypted_payload` changes. Reversing the two fails the test, and would be the data loss 103-T3 recovers from. §2.3 |
| 103-T8 | A pre-migration backup restores into a rotated account | Item 38's restore path re-encrypts under the current `K`; every note opens. §4.3 |

---

## 6. What this design refuses

- **Wrapping only the AES key.** §1. It would break `content_hash` silently, and a
  silent break in the save-confirmation path is worse than no change at all.
- **Deriving the KEK from the existing `encryption_salt`.** §1. It would make the KEK
  equal to the pre-migration key and keep a stolen key useful forever.
- **Flipping the wrap before the re-encryption pass finishes.** §2.3. It strands
  every already-rotated row on every other device.
- **Leaving remembered devices unlocked through a passphrase change.** §2.2. `K` is
  unchanged, so the stored bytes still work — which is exactly why "does it still
  decrypt?" cannot be the test. A change the user made because the old passphrase was
  compromised must cost every remembered session, or it is not a change.
- **Using `wrapVersion` as the rotation lock.** §2.3. It does not advance until the
  pass finishes, so two rotations both read an unmoved version and both proceed. The
  claim has to be a compare-and-set taken before the first batch.
- **Holding `K_new` only in the rotating tab's memory.** §2.3. A tab that dies after
  the first batch takes the only copy of the key with it, and the rows already
  rewritten are gone for good.
- **Approximating a conditional write with a read-back.** §4.1. Both writers read back
  their own bytes and both report success; only one passphrase is live.
- **Clearing `K_old` on a version mismatch before draining the queue.** §4.2. It
  destroys unsynced words, which is the one thing this product must never do.
- **Putting a wrapped `K` in a backup.** §4.3. It would make backups stop opening
  after a rotation.
- **Removing the key-check because GCM already authenticates.** §1.2. The restore
  paths never run an unwrap; the key-check is the only gate they have.
