Status: PROPOSAL
Last verified: 2026-11-25

# Passkey unlock — design

Launch review track E, roadmap item 135. This is the design the owner asked to approve
before any code (work order, track E, settled 2026-11-25). Nothing here is built.

A passkey unlocks the vault without the passphrase. It does this by wrapping the same
master key `K` a third time, under a key the passkey's PRF extension produces. The
passphrase stays and always works. A passkey is never a way to sign in: the Supabase
session is still required, and passkey unlock only replaces typing the passphrase on
the unlock screen.

Built on `docs/plans/2026-09-07-key-migration-and-rotation-design.md` (the key design,
"§" references below point there unless marked otherwise), `src/lib/vaultKey.ts` and
`src/lib/recoveryKey.ts`.

## Summary of what this plan recommends

- Third wrap of `K`: one per passkey, under `KEK_pk = HKDF-SHA-256(PRF output)`,
  AES-256-GCM, AAD `vault-passkey:<userId>:<credentialId>:<passkeyWrapVersion>`.
- Stored in a new table, `vault_passkey_wraps`, one row per passkey, not in
  `user_metadata.vault`.
- Every passkey unlock ends in `openUnwrappedVault`, the same key-check gate as the
  passphrase and the recovery key.
- Run the PRF spike now, on a throwaway preview host. Hold enrollment for the final
  domain (launch plan item 157).
- Web only. The Capacitor Android app does not offer passkey unlock in v1.
- All passkey code sits behind one `import()` boundary, `src/services/passkeyVault.ts`.
- Keep "Remember this browser" for now. Revisit retiring it with data from the cohort.

---

## 1. The key design

### 1.1 What the passkey produces

The WebAuthn PRF extension asks the authenticator to evaluate a per-credential
pseudo-random function on an input we choose. It returns 32 bytes that only that
credential can produce for that input. The PRF explainer names this exact use: a site
doing end-to-end encryption that needs somewhere to keep key material
(github.com/w3c/webauthn, `explainers/prf-extension.md`, read 2026-11-25).

The browser hashes our input with a fixed prefix before it reaches the authenticator,
so a site cannot ask for the raw `hmac-secret` output another protocol might use. I
could not read the exact prefix rule in the spec (the PRF section of the Level 3 text
did not load; see §12). The design does not depend on the prefix: we only need the same
input to give the same output, and the spike checks that.

### 1.2 From PRF output to KEK: HKDF, not Argon2id

`KEK_pk = HKDF-SHA-256(ikm = prfOutput, salt = prfSalt, info = "yidhan-passkey-kek-v1")`,
32 bytes, imported as a non-extractable AES-256-GCM key.

Why HKDF:

- The PRF output is already 32 uniformly random bytes. Argon2id exists to slow down
  guessing a low-entropy passphrase; there is nothing to guess here. Running it would
  cost about a second and 64 MB per unlock for no security gain.
- HKDF separates domains. If the same credential's PRF output were ever used for a
  second purpose, the `info` string stops the two keys being equal.
- HKDF is in WebCrypto. No new dependency, so the lazy chunk stays small.

Why not use the PRF output directly as the AES key: it would work, but HKDF costs one
call and makes the derivation explicit and versioned (`-v1`).

### 1.3 The PRF input

Each wrap has its own `prfSalt`, 32 random bytes, generated at enrollment. It is the PRF
input (`eval.first`) and the HKDF salt. It is public. A fresh salt per wrap means
re-enrolling the same credential gives a different KEK, so an old wrap does not stay
useful.

### 1.4 The wrap

`passkeyWrap = AES-256-GCM(KEK_pk, K)`, fresh 12-byte IV, 64 bytes of `K` in, AAD:

```
vault-passkey:<userId>:<credentialId base64url>:<passkeyWrapVersion>
```

- `userId` stops a wrap from being copied into another account. Unwrapping under a
  different user id fails GCM authentication.
- `credentialId` stops a wrap from being moved onto another passkey's row. A wrap
  presented with the wrong credential id fails, even before the KEK question.
- `passkeyWrapVersion` is the schema version of this wrap format, `1`. It lets a later
  format refuse an older one.
- The prefix `vault-passkey:` differs from `vault:` (passphrase wrap) and
  `vault-recovery:` (recovery wrap), so no wrap can stand in for another.

The AAD does not include the vault's `wrapVersion`. A passphrase change bumps that, and
`K` does not change, so the passkey wrap stays valid (§2.4 below). A rotation changes
`K`, and the key-check catches every stale wrap (§2.5).

### 1.5 Where it is stored

**Recommendation: a new table, `vault_passkey_wraps`, one row per passkey.**

| Column | Type | Meaning |
|---|---|---|
| `id` | uuid, primary key | Row id |
| `user_id` | uuid, default `auth.uid()`, FK to `auth.users` on delete cascade | Owner |
| `credential_id` | text | base64url credential id. Unique per user |
| `prf_salt` | text | base64, 32 bytes |
| `wrapped_key` | text | base64, 80 bytes (64 + GCM tag) |
| `wrap_iv` | text | base64, 12 bytes |
| `wrap_version` | int | `1` |
| `label` | text, 1–40 chars | User-editable name, e.g. "Pixel phone" |
| `created_at` | timestamptz | Set on insert |

RLS: select, insert and delete only where `user_id = auth.uid()`. No update policy
except `label`. The migration is applied by hand like every other, with a row in
`verify_migration_state.sql`.

Why not `user_metadata.vault.passkeyWraps`, beside `recoveryWrap`:

- **Carry-over risk.** Every vault write today rebuilds the whole `vault` object: the
  migration, account setup, the recovery-key reset, a replaced recovery kit, and item
  25 when it ships. Each one would have to carry the passkey array over. One that
  forgets silently deletes every passkey. A separate table cannot be dropped by a
  vault write.
- **No lost updates.** `updateUser` has no compare-and-set (§4.1, item 136). Two
  devices enrolling at once would each write an array, and the second would drop the
  first one's passkey. Separate rows are separate inserts.
- **JWT size.** `user_metadata` travels in every JWT. Each wrap is about 250 bytes of
  base64 and text. Ten passkeys would add 2.5 KB to every request.

Item 136 (move the vault to a table) does not block this. The two tables can live side
by side, and item 136 can later decide whether to merge them.

Cap: 10 passkeys per account, enforced in the UI and by a check in the insert policy.

**Offline.** A platform authenticator works offline. To unlock offline, the client
keeps a copy of this user's wrap rows in `localStorage` under
`yidhan-<userId>-passkey-wraps`. They are ciphertext, as useless without the
authenticator as the passphrase wrap is without the passphrase. The cache is refreshed
on every online read and cleared on manual lock and sign-out. A stale cached row can
only fail closed, because the key-check gate runs after every unwrap.

### 1.6 Beside the other two wraps

| | Passphrase wrap | Recovery wrap | Passkey wraps |
|---|---|---|---|
| Key | Argon2id(passphrase, `kekSalt`) | `RK`, 32 random bytes | HKDF(PRF output, `prfSalt`) |
| AAD prefix | `vault:` | `vault-recovery:` | `vault-passkey:` |
| Count | exactly one | zero or one | zero to ten |
| Where | `user_metadata.vault` | `user_metadata.vault.recoveryWrap` | `vault_passkey_wraps` |
| Gate after unwrap | `openUnwrappedVault` | `openUnwrappedVault` | `openUnwrappedVault` |
| Legacy fallback on failure | yes (DECISIONS.md 2026-11-08) | no | **no** |

A passkey that does not open the vault never falls back to the legacy key path. That
fallback exists for a bad vault write under a known passphrase; a passkey has no
passphrase to try.

### 1.7 What the server can and cannot learn

The server can learn: how many passkeys an account has, their credential ids, labels and
creation dates, and the public `prfSalt`. The label may name a device. If the client
records which passkey was used, the server learns that too, so the client records
nothing on use.

The server cannot learn: the PRF output, `KEK_pk`, `K`, or any note content. A database
dump plus every wrap gives nothing without the physical authenticator (or the synced
passkey, §8.2) and a user-verification gesture on it.

The server never verifies a WebAuthn assertion. It does not need to: the security comes
from the PRF secret, not from the signature. So there is no server code, no challenge
store, and no public key stored. The challenge is 32 random bytes made on the client.

---

## 2. Flows

Every flow below fails closed: on any error the vault stays locked or unchanged, and the
passphrase still works.

### 2.1 Enroll

Needs: an unlocked vault, online, and the final domain (§4).

1. Settings → Security → "Add a passkey". The user re-types the passphrase. The client
   runs `unlockVault` on it and requires the result to match the `K` in memory.
   *Why:* an unlocked device left on a desk, or a remembered browser, must not let a
   stranger add their own passkey and keep access for good.
2. Copy `K` with `copyMasterKey` before the first `await`, as recovery does.
3. `navigator.credentials.create()` with `rp.id` = the RP ID (§4),
   `user.id` = the first 16 bytes of SHA-256(`yidhan-passkey-user:` + userId), stable
   for the account on every device and not the raw Supabase id,
   `user.name` = the account email so the user can tell passkeys apart,
   `residentKey: 'required'`, `userVerification: 'required'`,
   `excludeCredentials` = the existing credential ids, and
   `extensions.prf.eval.first = prfSalt`.
4. Read `getClientExtensionResults().prf`.
   - `enabled !== true` → this authenticator has no PRF. Stop. Say "This passkey can't
     unlock notes on this device. Your passphrase still works." Ask the browser to forget
     the new credential with `PublicKeyCredential.signalUnknownCredential` where it
     exists. Write nothing.
   - `enabled` but no `results.first` → some authenticators only evaluate at `get()`
     (MDN, WebAuthn extensions, modified 2026-09-17). Run one `get()` with
     `allowCredentials = [newId]` and the same `prfSalt`. This is a second prompt.
5. Check the UV flag in `authenticatorData`. Refuse if it is not set.
6. `KEK_pk = HKDF(...)`, wrap `K`.
7. Self-check before writing: unwrap the new wrap with `KEK_pk` and require
   `masterVerifiesVault`. A wrap that fails is never written.
8. Insert the row. Read it back by `credential_id`. On a failed insert, write nothing
   else, tell the user, and signal the credential as unknown.
9. Zero `K`, the PRF output and the KEK bytes.

Key-check: verified in step 1 (passphrase) and step 7 (the new wrap). Failure at any
step: no row written, vault stays unlocked as it was.

### 2.2 Unlock with a passkey

1. The unlock screen shows "Unlock with a passkey" above the passphrase field when the
   account has at least one wrap (from the server, or the cache when offline) and
   `window.PublicKeyCredential` exists. The passphrase field is always there.
2. Lazy-load `passkeyVault`.
3. `navigator.credentials.get()` with `rpId`, `allowCredentials` = every credential id,
   `userVerification: 'required'`, and `extensions.prf.evalByCredential` mapping each
   credential id to its `prfSalt`.
4. Find the wrap whose `credential_id` matches the returned credential. Check the UV flag.
5. Derive `KEK_pk`, unwrap, then `openUnwrappedVault` (key-check under `K`).
6. On success: `installKeys(userId, keys, 'unlock_passkey')`, exactly as the passphrase
   path. sessionStorage, and localStorage if "Remember this browser" is on, follow the
   existing rules.

Failure cases, all fail closed to the passphrase field:

| Case | What the user sees | What the client does |
|---|---|---|
| Cancelled or timed out | Nothing new; passphrase field focused | Nothing |
| No PRF result | "This passkey can't unlock your notes here. Use your passphrase." | Report a reliability issue |
| Credential not in the list | Same message | Signal unknown credential where supported |
| Unwrap fails or key-check fails | "That passkey no longer opens your notes. Use your passphrase." | Report; keep the row (it may be a stale cache); refresh the list online |
| UV flag not set | Same as no PRF | Report |

It never tries the legacy path and never unlocks on a partial result.

### 2.3 Remove a passkey

1. Settings → Security lists passkeys by label and date. "Remove" asks to confirm.
2. Needs the vault unlocked and online. Removing needs no passphrase: it can only reduce
   access.
3. Delete the row. Remove it from the cache.
4. Where `PublicKeyCredential.signalUnknownCredential` exists, call it so the password
   manager can drop the credential. Otherwise tell the user to delete it from their
   password manager too, and name where (iCloud Keychain, Google Password Manager).
5. Offline: refuse. A removal that only happens locally leaves the wrap on the server.

No key-check involved; nothing is unlocked.

### 2.4 Passphrase change (item 25; today only after a recovery-key unlock)

`K` does not change, so passkey wraps stay valid and are not rewritten. The vault write
touches only `user_metadata.vault`; the passkey table is not part of it, so there is
nothing to carry over.

Recommendation: the change screen lists the account's passkeys with "Also remove all
passkeys" unticked. A user who changes the passphrase because they think a device is
lost should be able to cut passkeys in the same step.

Remembered devices are still re-prompted by the `keyCheckVersion` bump (§2.2 of the key
design). A passkey unlock after that is a fresh unlock, not a restore, so it still works
and that is intended.

### 2.5 Key rotation (item 103, not built)

`K` changes, so every passkey wrap becomes useless. The rotating device cannot re-wrap
them: that would need a PRF evaluation on every authenticator.

Rule: in the step that promotes `pendingWrap` (§2.3 step 5 of the key design), delete
every `vault_passkey_wraps` row for the user. After rotation the user re-enrolls.

Order: delete the rows first, then promote. If the rotation crashes in between, the user
has lost their passkeys but not their notes, and `pendingWrap` still resumes. The other
order would leave rows that unwrap `K_old`. Those still fail closed, because `K_old`
fails the new key-check, but they keep `K_old` recoverable for anyone holding the
passkey. The order is a test for item 103 (PK-N20).

### 2.6 Recovery-key unlock

Unaffected. The recovery key unwraps `K` and holds the keys back until a new passphrase
is saved (DECISIONS.md 2026-11-08). Passkeys keep working throughout.

After the new passphrase is saved, the reset screen lists passkeys with the same "Also
remove all passkeys" option as §2.4. Someone using a recovery key may have lost the
device that held a passkey.

### 2.7 Sign-out

Clears keys, sessionStorage, localStorage and the passkey wrap cache. Does not delete
any server row. Passkey unlock is offered again after the next sign-in.

### 2.8 Auto-lock and manual lock

- `auto-lock` with "Remember this browser": unchanged. The activity gate restores from
  localStorage with the key-check. The passkey path is not involved.
- `auto-lock` without it: the unlock screen offers the passkey.
- `manual`: clears everything, as today, including the wrap cache. Online, the unlock
  screen re-reads the list and offers the passkey. Offline after a manual lock there is
  no cached list, so only the passphrase is offered. That follows the existing rule that
  a manual lock clears local storage.

### 2.9 Account deletion re-auth

A passkey is **not** accepted as proof for deletion. The server never verifies the
assertion, so it proves nothing to the server. Email/password users still type the
password; OAuth users still get the email OTP (DECISIONS.md 2026-07-14).

On deletion the rows go with the `auth.users` cascade, and the deletion worker's audit
should list the table. The client signals the credentials as unknown where it can.

---

## 3. What passkey unlock replaces, and what it does not

It replaces typing the passphrase on the unlock screen, on a device whose browser and
authenticator support PRF.

It does not replace:

- **The passphrase.** Still required at account setup, still the fallback, still needed
  to enroll a passkey, still the only unlock on unsupported devices.
- **The recovery key.** A lost phone can take a device-bound passkey with it.
- **Sign-in.** Supabase auth is untouched.
- **Native biometric unlock (item 106).** That is the Android path.

### "Remember this browser"

The opt-in localStorage blob holds raw `K` bytes. Roadmap item 102 already names a
passkey-wrapped blob as one of the two ways to stop doing that. Passkey unlock makes the
blob less needed: a fingerprint or face prompt is almost as quick as no prompt, and no
key is left at rest.

Recommendation: **keep it for launch, do not retire it yet.**

- Coverage is unknown until the spike runs. Retiring the blob before passkeys cover the
  cohort's devices would force those users to type a long passphrase on every restart.
- When a passkey is enrolled on a device that has "Remember this browser" on, offer once
  to turn it off, with plain copy on why.
- Revisit retiring it after the cohort has used passkeys for a month: if most remembered
  browsers also have a working passkey, retire it in a separate decision, with item 102.

---

## 4. The relying-party ID problem

A passkey is bound to an RP ID, a registrable domain. A passkey made for
`yidhan.vercel.app` only works on that domain and its subdomains. When the app moves to
its custom domain (launch plan item 157), those passkeys stop working there.

### Options

**A. Wait for item 157, then enroll on the final domain.** Run the spike now on a
throwaway host. Ship the code behind a flag that is off until the domain is live.
Cost: passkey unlock reaches users later. Risk: none for user data.

**B. Enroll on `yidhan.vercel.app` now, re-enroll after the move.** Every early passkey
becomes an orphan in the user's password manager, labelled with the old domain. Users
must remove it and add a new one. The wraps for old credentials sit dead in the table
until removed. Confusing, and the cleanup cannot be automated: the browser on the new
domain cannot even see the old credentials.

**C. Keep `yidhan.vercel.app` as the RP ID forever, and use Related Origin Requests.**
The new domain calls WebAuthn with `rpId: 'yidhan.vercel.app'`. The browser fetches
`https://yidhan.vercel.app/.well-known/webauthn`, which lists the new origin. The spec
requires clients to allow at least five labels (WebAuthn Level 3, §5.11, Recommendation
of 2026-08-25). Support per passkeys.dev (updated 2026-09-21): Chrome and Edge 128+,
Safari on iOS 18+ and macOS 15+, Firefox 152+.
Costs: the app depends forever on keeping the `yidhan.vercel.app` project name and
serving that file from it; password managers show the old domain as the passkey's name;
older browsers in the support gap cannot use passkeys at all on the new domain; and the
Android WebView question gets harder.

**D. Pick the final domain as RP ID now.** Not possible: the RP ID must be the current
origin's domain or a suffix of it.

**Recommendation: A.** The spike does not need the final domain. The code can be
written and reviewed before item 157 lands. Enrollment switches on with the domain.
C stays in reserve if item 157 slips past the point where the owner wants passkeys live,
and the owner should choose it knowingly, because it is permanent.

---

## 5. Platform reality

### What I checked (2026-11-25)

Browser support for the `prf` extension, from MDN browser-compat-data
(`api/CredentialsContainer.json`, `publicKey_option.extensions.prf`, main branch, read
2026-11-25) unless noted:

| Browser | PRF from | Note |
|---|---|---|
| Chrome desktop | 116 | |
| Chrome Android | mirrors Chrome | BCD lists "mirror", not a separate version |
| Edge | mirrors Chrome | same |
| Safari macOS | 18 | Also WebKit blog, "WebKit features in Safari 18.0", 2024-09-16 |
| Safari iOS / iPadOS | mirrors Safari (18) | |
| Firefox desktop | 139 | 135–138 lacked it on macOS |
| Firefox Android | 149 | |
| Android WebView | not supported | BCD `false` |
| Samsung Internet | mirrors Chrome | no version given |

Related Origin Requests: see §4 option C.

### What I could not check

Browser support is not authenticator support. PRF needs the browser, the OS and the
credential manager that holds the passkey. These I could not confirm from a primary
source:

- **Google Password Manager** (Android and desktop Chrome): Google's supported-environments
  page does not mention PRF or `hmac-secret`.
- **Windows Hello**: Microsoft Learn's passkeys page (updated 2026-11-17) does not mention
  PRF or `hmac-secret`.
- **iCloud Keychain**: the WebKit post names Safari 18 support but no authenticator
  caveats.
- **Security keys** (`hmac-secret`), **1Password**, **Bitwarden**: not checked.
- **Chrome Platform Status** pages for PRF and Related Origin Requests: they render with
  JavaScript and could not be read.
- **Feature detection**: `getClientCapabilities()` (MDN, modified 2026-10-27) defines
  `extension:<id>` keys, but MDN does not list `extension:prf`. Whether browsers report
  it is unknown.

The spike (§7) answers all of these on real devices. Until then, this plan claims no
authenticator support.

### What a user without support sees

- No `PublicKeyCredential`: no passkey button anywhere. Nothing else changes.
- Browser has WebAuthn but the authenticator lacks PRF: enrollment stops at §2.1 step 4
  with a plain message, and nothing is saved.
- An account with passkeys, opened on a device that cannot use any of them: the passkey
  button shows; it fails to the passphrase with the message in §2.2. If the spike shows
  a reliable capability signal, the button hides instead.

### Inside the Capacitor Android app

The app loads its bundle from `https://localhost` (`capacitor.config.ts`,
`androidScheme: 'https'`).

- WebAuthn in a WebView is off by default. It needs androidx.webkit 1.12.0+ and
  `WebSettingsCompat.setWebAuthenticationSupport(..., WEB_AUTHENTICATION_SUPPORT_FOR_APP)`,
  and the app must be linked to the website by Digital Asset Links
  (developer.android.com, "Credential Manager in WebView" and the `WebSettingsCompat`
  reference, no dates shown, read 2026-11-25).
- BCD says Android WebView does not support PRF.
- Nothing I read says whether a WebView page on `https://localhost` can use the website's
  RP ID.

Recommendation: **the Android app does not offer passkey unlock in v1.** It hides the
button (detect Capacitor native). The native path is item 106: the key in the Android
Keystore behind a biometric prompt, which needs no RP ID at all. The spike still runs the
WebView case once, so we know rather than guess.

---

## 6. The bundle rule

App-shell JS budget: 327 KB gzip, 326.6 KB used after track C. `scripts/bundle-budget.json`
is not edited.

The budget counts the entry closure plus the static import closure of the `AppShell`
chunk (`scripts/check-bundle-budget.mjs`). A chunk reached only through `import()` is not
counted.

**The import boundary is `src/services/passkeyVault.ts`.** It is reached only by:

```ts
// src/contexts/EncryptionContext.tsx, beside loadVaultUnlock and loadRecoveryKit
function loadPasskeyVault() {
  return import('../services/passkeyVault');
}
```

Behind that boundary, and never statically imported from the app shell:

- `src/lib/passkeyKey.ts`: HKDF, wrap, unwrap, AAD. Pure, like `recoveryKey.ts`.
- `src/services/passkeyVault.ts`: the `create()`/`get()` calls, the table reads and
  writes, the cache.
- The UI: `PasskeyUnlockButton.tsx`, loaded with `lazyWithRetry` from
  `PassphraseUnlock.tsx` the way `RecoveryKeyUnlockForm` is; `PasskeySettings.tsx`, loaded
  with `lazyWithRetry` from `SettingsModal.tsx`.

What stays in the app shell: the `loadPasskeyVault` function, two `lazyWithRetry`
declarations and two context methods that call into the chunk. That is a few hundred
bytes. It fits the 0.4 KB headroom, but only just, so:

- Each milestone PR reports the app-shell measurement before and after.
- The check script gains an assertion, like the existing `hash-wasm` one, that no
  `passkey*` module is in the app shell's static closure. That edits
  `check-bundle-budget.mjs`, not the budget file.
- If a milestone still goes over, the fix is to move more behind the boundary (for
  example, have `PassphraseUnlock` call a single lazy `PasskeyEntry` that owns both the
  button and its state), never to raise the limit.

The new chunk is precached, so the precache total grows by its size. Its limit is
1108 KB; I did not find the current measurement. M2 measures it.

---

## 7. The spike

Throwaway. Not merged. Its only output is a results table added to this plan.

**What:** one static page, `prf-spike.html`, on a throwaway branch deployed as a Vercel
preview. The preview host is the RP ID, so every credential made is disposable and
nothing touches `yidhan.vercel.app`. No Supabase, no app code.

The page has three buttons and logs results to the screen as JSON the tester copies:

1. **Create**: `create()` with `prf.eval.first` = a fixed test salt. Logs `prf.enabled`,
   whether `results.first` came back, the UV flag, the AAGUID, authenticator attachment,
   and the error name if any.
2. **Get**: `get()` with `evalByCredential` for that credential. Logs the PRF output's
   SHA-256 (never the output itself), UV flag, time taken.
3. **Capabilities**: `PublicKeyCredential.getClientCapabilities()` output, including
   whether `extension:prf` and `relatedOrigins` appear.

**Measures, per device:**

- Does PRF work at all? At `create()` or only at `get()`?
- Is the output the same across two `get()` calls? (It must be.)
- For a synced passkey: is the output the same on a second device signed into the same
  password manager? (It must be, or synced passkeys need per-device wraps.)
- Is UV always set?
- Is there a capability signal for PRF?

**Devices** (owner's or cohort's; mark the ones not available):

| Device | Credential manager |
|---|---|
| Windows 11, Chrome | Windows Hello; Google Password Manager |
| Windows 11, Edge | Windows Hello |
| Windows 11, Firefox | Windows Hello |
| macOS, Safari | iCloud Keychain |
| macOS, Chrome | Google Password Manager; iCloud Keychain |
| iPhone, Safari | iCloud Keychain |
| Android, Chrome | Google Password Manager |
| Android, Firefox | Google Password Manager |
| Android, Capacitor debug build with WebView auth enabled | — |
| A FIDO2 security key, if one is at hand | the key |
| 1Password or Bitwarden, if the owner uses one | the extension |
| Second device on the same iCloud / Google account | for the sync check |

**Results that change the design:**

- Synced output differs across devices → a wrap per (credential, device) is impossible;
  synced passkeys would have to be refused. Redesign §1.
- Google Password Manager on Android has no PRF → most Android web users fall back. The
  feature may not be worth weeks before item 106. Ask the owner.
- Windows Hello has no PRF → Windows users only get passkeys from a password manager.
  Note it in copy.
- No device returns PRF at `create()` → enrollment always takes two prompts. Simplify
  §2.1 to always run the `get()`.
- A reliable `extension:prf` capability → hide the button instead of failing (§5).
- Capacitor WebView works with PRF → revisit §5's "not in v1".
- Fewer than half of the cohort's devices work → defer item 135 and say so in the
  roadmap.

---

## 8. Threats and failure cases

### 8.1 Lost device

A device-bound passkey goes with the device. The passphrase and recovery key still work.
The finder needs the device's screen lock or biometric to use the passkey, and a signed-in
Supabase session (or the user's account password) to fetch the wrap. Removing the passkey
from Settings on another device deletes its wrap: after that the passkey opens nothing,
even if the finder gets past the screen lock. Offline, a device with a cached wrap stays a
risk until it next goes online; manual lock or sign-out clears the cache.

### 8.2 Synced passkeys and the zero-knowledge claim

iCloud Keychain and Google Password Manager sync passkeys, and the PRF secret syncs with
them (the spike confirms). So `K` is reachable by anyone who controls the user's Apple or
Google account **and** can pass that provider's device checks.

Both providers say they end-to-end encrypt passkeys. I did not verify that from their
documentation for this plan. Either way, Yidhan's servers still learn nothing. The claim
"only you can read your notes" becomes "only you, and anyone who takes over your Apple or
Google account and its device unlock". That is a real change.

Copy at enrollment must say it plainly: "This passkey may sync through your Apple or Google
account. Anyone who can unlock that account can unlock your notes." The privacy page and
`docs/reference/` get the same sentence. No setting to refuse synced passkeys: the
`credProps`/backup flags can tell us whether a credential is backed up, and the spike
should log `BE`/`BS` flags so the owner can decide (open question 4).

### 8.3 A stale wrap after a passphrase change on another device

`K` is unchanged by a passphrase change, so the wrap is not stale. It still opens the
vault, and that is correct. After a rotation it is stale: it unwraps `K_old`, which fails
the key-check, and the unlock fails closed to the passphrase (§2.5).

### 8.4 A credential deleted on the authenticator but still listed

The user deletes the passkey in their password manager; the row stays. `get()` finds no
matching credential, the browser shows its own "no passkey" sheet, and the user cancels to
the passphrase. Settings still lists it; the user removes it. Where
`signalAllAcceptedCredentials` exists, the client can keep the password manager in step, but
it cannot learn the reverse. No automatic cleanup: a credential missing on this device may
exist on another.

### 8.5 Downgrade to passphrase

An attacker who can make passkey unlock fail only pushes the user to the passphrase, which
is the existing security level. Passkeys add a way in; they never remove one. The risk is
that passkey users forget their passphrase. Mitigation: once every 30 days of passkey-only
unlocks, the unlock screen asks for the passphrase instead (open question 5).

### 8.6 Phishing

A passkey cannot be used on another origin: the browser binds `rpId` to the page's domain.
A phishing site gets no PRF output for Yidhan's RP ID. This is stronger than the
passphrase, which a phishing page can capture.

Not covered: script running on Yidhan's own origin (XSS). It can call `get()`; the user
sees a normal prompt and approves it; the script gets the PRF output and `K`. That is the
same reach as XSS reading `K` from memory after an ordinary unlock (item 102), so passkeys
do not make it worse, but they do not fix it either. CSP stays as it is.

### 8.7 Enrolment by someone else

Covered by §2.1 step 1: enrolling needs the passphrase typed again.

### 8.8 Wrap tampering on the server

A changed `wrapped_key`, `wrap_iv`, `prf_salt` or `credential_id` fails GCM or the
key-check. A row copied from another account fails the `userId` in the AAD. A row whose
`credential_id` was swapped fails the credential id in the AAD.

---

## 9. Tests

Should-not-fire cases first, per the repo rule. Each names its milestone.

### Should not fire

| # | Test | Milestone |
|---|---|---|
| PK-N1 | A wrap from user A does not unwrap for user B (AAD). | M2 |
| PK-N2 | A wrap moved to another credential id does not unwrap. | M2 |
| PK-N3 | A passphrase-wrap or recovery-wrap ciphertext fed to the passkey unwrap fails, and the reverse. | M2 |
| PK-N4 | A wrap of `K_old` fails `openUnwrappedVault` against a rotated vault, and nothing unlocks. | M2 |
| PK-N5 | A passkey unlock that fails never calls the legacy key path. | M4 |
| PK-N6 | Enrollment writes no row when `prf.enabled` is false, when results are missing after the fallback `get()`, when UV is not set, or when the self-check fails. | M3 |
| PK-N7 | Enrollment refuses without the passphrase re-typed, and refuses a wrong one, even on an unlocked or remembered device. | M3 |
| PK-N8 | A cancelled `get()` leaves the vault locked and the passphrase field focused. | M4 |
| PK-N9 | A lock (manual, auto, sign-out) during an in-flight passkey unlock installs nothing. Same race guard as `recoveryAttemptRef`. | M4 |
| PK-N10 | A user change during an in-flight passkey unlock installs nothing for either user. | M4 |
| PK-N11 | No passkey button in the Capacitor native app, without `PublicKeyCredential`, or on an account with no wraps. | M4 |
| PK-N12 | The passkey button does not appear on the recovery-key reset screen or during account setup. | M4 |
| PK-N13 | A vault write (migration, recovery reset, recovery-kit replace) does not touch `vault_passkey_wraps`. | M1, M5 |
| PK-N14 | A passkey assertion is not accepted by the deletion re-auth. | M5 |
| PK-N15 | Removing a passkey offline is refused and the row survives. | M3 |
| PK-N16 | Manual lock and sign-out clear the wrap cache; auto-lock does not. | M4 |
| PK-N17 | No `passkey*` module appears in the app shell's static closure (bundle check). | M2 |
| PK-N18 | RLS: user B cannot select, insert or delete user A's rows; there is no update policy on wrap columns. | M1 |
| PK-N19 | The PRF output, KEK and `K` never reach Sentry breadcrumbs or `console`. | M4 |
| PK-N20 | After rotation, no passkey row remains (deletion lands before the wrap is promoted). | item 103 |

### Should fire

| # | Test | Milestone |
|---|---|---|
| PK-F1 | Wrap and unwrap round-trip all 64 bytes of `K`; a note encrypted before enrollment decrypts after a passkey unlock, and its `content_hash` matches. | M2 |
| PK-F2 | HKDF gives the same KEK for the same PRF output and salt, and different KEKs for different salts. | M2 |
| PK-F3 | Enrollment with PRF at `create()` writes one row; with PRF only at `get()` it runs one extra `get()` and writes one row. | M3 |
| PK-F4 | Passkey unlock installs keys through `installKeys` and follows the remember-browser rule. | M4 |
| PK-F5 | Offline unlock works from the cached wrap. | M4 |
| PK-F6 | After a passphrase change, the passkey still unlocks; the remembered blob is still re-prompted. | M5 |
| PK-F7 | E2E in Chrome with a CDP virtual authenticator that supports PRF: enroll, lock, unlock with the passkey, read a note. Whether Playwright's CDP session exposes a PRF option on the virtual authenticator is unverified; M3 checks it first. | M5 |
| PK-F8 | Safari: manual run of the same path on macOS and iOS, recorded in the PR. Playwright's WebKit has no virtual authenticator. | M5 |

WebAuthn calls are mocked in unit tests through a mock in `src/test/` (one module, like
the sync engine mocks), not per file.

---

## 10. Milestones

Each is one PR and one session. Every one touches encryption or auth, so every one except
M0 gets the multi-agent review (repo rule: changes touching encryption, sync or auth).

| # | PR | Needs | Review |
|---|---|---|---|
| M0 | Spike: throwaway preview page, results table added to this plan (docs-only PR) | nothing | none; the owner reads the results |
| M1 | `vault_passkey_wraps` migration, RLS, insert cap, `verify_migration_state.sql` row, deletion worker listing. Applied by hand. | M0 results, owner approval | multi-agent |
| M2 | `src/lib/passkeyKey.ts` (HKDF, wrap, unwrap, AAD) + tests PK-N1–N4, F1–F2; `passkeyVault.ts` skeleton behind `import()`; bundle assertion PK-N17; precache measured | M1 | multi-agent |
| M3 | Enrollment and removal in Settings, behind a flag off by default; PK-N6, N7, N15, F3 | M2 | multi-agent |
| M4 | Unlock path on the unlock screen and the wrap cache; PK-N5, N8–N12, N16, N19, F4, F5 | M3 | multi-agent |
| M5 | Lifecycle: "also remove passkeys" on passphrase change and recovery reset, remember-browser offer, copy on synced passkeys, privacy page, `docs/reference/`, changelog; E2E PK-F7, manual F8 | M4 | multi-agent |
| M6 | Switch the flag on | item 157 live, M5 merged, real-device pass on the spike's device list | single review |

M1–M5 can merge before item 157 because the flag keeps enrollment off. M6 waits for the
domain.

M4 touches `EncryptionContext.tsx` and the unlock screen. It must not run beside another
session editing those files.

---

## 11. Open questions for the owner

1. **Where are wraps stored?** A new `vault_passkey_wraps` table, or inside
   `user_metadata.vault` beside `recoveryWrap`?
   *Recommendation:* the table (§1.5). It cannot be lost by a vault write and has no
   lost-update race. Cost: one hand-applied migration.

2. **RP ID: wait for the custom domain, or keep `yidhan.vercel.app` forever with Related
   Origin Requests?**
   *Recommendation:* wait (§4, option A). Build M1–M5 now behind a flag.

3. **Retire "Remember this browser"?**
   *Recommendation:* not at launch. Offer to turn it off when a passkey is added. Decide
   on retiring after a month of cohort use (§3).

4. **Allow synced passkeys?** They put the Apple or Google account inside the trust
   boundary (§8.2). Refusing them would refuse most passkeys people have.
   *Recommendation:* allow them, with the plain warning at enrollment and on the privacy
   page. Revisit if the cohort asks for device-bound only.

5. **Ask for the passphrase every 30 days for passkey-only users?** Stops people forgetting
   it (§8.5), costs a prompt.
   *Recommendation:* yes, 30 days, with copy that says why.

6. **Require the passphrase to enroll?** (§2.1 step 1.)
   *Recommendation:* yes. Without it, an unlocked device is enough to add a permanent way in.

7. **Android app in v1?**
   *Recommendation:* no. Use item 106 for native. Revisit if the spike shows WebView PRF
   working.

8. **Is the feature worth weeks if Google Password Manager on Android has no PRF?**
   *Recommendation:* decide after M0. If Android web users are a large share of the
   cohort and get nothing, put item 106 first.

---

## 12. What I could not verify

- **The PRF section of the WebAuthn spec.** Both the W3C Recommendation and the editor's
  draft were too long to load past §7. I did not confirm the input hashing prefix, the
  rules for `eval` and `evalByCredential` at `create()`, or the output length from the
  spec. MDN (modified 2026-09-17) confirms PRF at `create()` and `get()`, the `enabled`
  output, and that fewer authenticators evaluate at `create()`. The 32-byte output is
  from the PRF explainer. To check: read §10.1.4 of https://w3c.github.io/webauthn/ in a
  browser, or the spec source on GitHub.
- **Authenticator support** for Google Password Manager, Windows Hello, iCloud Keychain,
  security keys and third-party managers. The spike answers this.
- **Chrome Platform Status** milestones. Pages need JavaScript. BCD gives Chrome 116.
- **Android WebView on `https://localhost`** with an RP ID. Not documented in what I read.
  The spike's Capacitor row answers it.
- **Whether Playwright can create a PRF-capable virtual authenticator.** M3 checks it
  before writing PK-F7.
- **Apple's and Google's end-to-end encryption claims for synced passkeys.** Not read for
  this plan. Check their security documentation before writing the §8.2 copy.
- **The current precache size.** M2 measures it.
