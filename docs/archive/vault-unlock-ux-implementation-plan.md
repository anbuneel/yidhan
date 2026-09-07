# Vault Unlock UX Implementation Plan

**Version:** 1.1
**Last Updated:** 2026-02-23
**Status:** Draft
**Author:** Codex (GPT-5)

---

## Original Prompt

> turn this into a short implementation plan with exact file changes next

---

## Scope

Recommended rollout:

1. Phase 1: Unlock once per session (survives refresh in same browser session) + Lock vault now + Vault auto-lock after inactivity
2. Phase 2: Remember this browser (localStorage convenience mode, explicit warning)

Keep auth "trusted device" and vault unlock convenience as separate features/settings.

Security note:
- Phase 1 adds a small tradeoff if session unlock state is persisted in `sessionStorage` (still better than long-lived persistence).
- Phase 2 is explicit convenience mode and should be labeled as such.

---

## Phase 1 Plan (Implement First)

### 1. Add vault-specific local settings (separate from auth trusted device)

**New file**
- `src/hooks/useVaultSettings.ts`

**Purpose**
- Store per-user local settings for vault UX only
- `vault.autoLockMinutes` (`0 | 15 | 60`)
- `vault.rememberBrowser` (`boolean`) (can remain unused in UI until Phase 2 if desired)

**Storage keys (per-user)**
- `yidhan-${userId}-vault-auto-lock-minutes`
- `yidhan-${userId}-vault-remember-browser`

### 2. Add session unlock persistence (sessionStorage, not passphrase)

**Edits**
- `src/contexts/EncryptionContext.tsx`
- `src/lib/encryption.ts`

**Changes**
- Persist vault unlock state across page refresh within the same browser session using `sessionStorage`.
- Do not store the passphrase.
- On successful `setupPassphrase()` / `unlockWithPassphrase()`:
  - export a session-persistable key representation (or wrapped key material)
  - write session unlock blob to `sessionStorage` (namespaced by `userId`)
- On provider mount / user load:
  - check for session unlock blob for current user
  - attempt restore into in-memory keys
  - clear blob if restore fails
- On `lockVault()`, user switch, or sign-out:
  - clear in-memory keys
  - clear session unlock blob

**Implementation note**
- Current derived keys in `src/lib/encryption.ts` are non-extractable `CryptoKey`s, so Phase 1 likely requires explicit export/import helpers (or an alternate persisted session key format) in the encryption library.

### 3. Wire vault auto-lock timer in app shell (do not replace sign-out timeout)

**Edits**
- `src/App.tsx`
- `src/hooks/useIdleTimer.ts` (new)

**Changes**
- Keep existing `useSessionSettings` + `useSessionTimeout` flow for account sign-out unchanged.
- Add `useVaultSettings(user?.id ?? null)`.
- Add a dedicated `useIdleTimer(...)` hook for vault locking only (avoid changing `useSessionTimeout` and risking session-warning regressions).
- Vault idle timer `onIdle` calls `lockVault()` (from `useEncryption`) and shows a short toast (for example: "Vault locked after inactivity").
- Vault idle timer `enabled` should require:
  - authenticated user
  - encryption is set up
  - vault currently unlocked
- Pass vault settings and vault actions into `SettingsModal`.

### 4. Add vault controls to Security tab

**Edit**
- `src/components/SettingsModal.tsx`

**Changes**
- Extend props to include vault-related inputs/actions:
  - `vaultSettings`
  - `isVaultUnlocked`
  - `onLockVault`
- Add a new "Encryption Vault" section in the Security tab.
- Show vault status:
  - `Vault is locked`
  - `Vault is unlocked`
- Add `Lock vault now` button (enabled only when unlocked).
- Add `Vault auto-lock after inactivity` select:
  - `Off`
  - `15 minutes`
  - `60 minutes`
- Keep existing auth/session controls ("trusted device", account timeout) visually and semantically separate.

### 5. Pass new props from app to settings modal

**Edit**
- `src/App.tsx`

**Changes**
- Update `SettingsModal` invocation to pass:
  - `vaultSettings={vaultSettings}`
  - `isVaultUnlocked={isUnlocked}`
  - `onLockVault={lockVault}`

---

## Phase 2 Plan (Remember This Browser)

### 1. Add remembered-unlock storage helper

**New file**
- `src/services/vaultUnlockStorage.ts`

**Purpose**
- Read/write/remove remembered unlock blob in localStorage
- Namespace by `userId`
- Versioned payload format

**Remembered credential blob (separate from settings)**
- `userId`
- `version` (blob schema version, define v1 now)
- `wrappedKeyset`
- `wrapIv`
- `deviceKey` (stored in localStorage for convenience mode; this is by design, not a security boundary)
- `encryptionVersion` (from `src/lib/encryption.ts`, stored separately from blob schema version)

**Model note (important)**
- This Phase 2 design is convenience mode, not strong device-bound security.
- Storing both `deviceKey` and wrapped material in `localStorage` means browser-storage access can unlock the vault.
- UX warning copy must state this clearly.

### 2. Add crypto helpers for wrap/unwrap (no passphrase storage)

**Edit**
- `src/lib/encryption.ts`

**Changes**
- Add helpers to persist/recover derived key material for local convenience mode.
- Do not store the passphrase.
- Likely requires explicit export/import helpers for persisted key material (current keys are non-extractable).

### 3. Extend encryption context for auto-unlock and remember/forget actions

**Edit**
- `src/contexts/EncryptionContext.tsx`

**Changes**
- Add methods/state:
  - `tryUnlockRemembered()` (best-effort on startup/user load)
  - `rememberCurrentVaultUnlock()`
  - `forgetRememberedVaultUnlock()`
  - `isRememberedBrowserAvailable`
- Enforce user-switch safety (`userId` namespacing).
- On remembered-unlock failure, clear invalid blob and fall back to passphrase.

### 4. Add UI toggle + warning + forget action

**Edit**
- `src/components/SettingsModal.tsx`

**Changes**
- Add `Remember this browser` toggle in the "Encryption Vault" section.
- Add warning text:
  - `Anyone with access to this browser profile can unlock your notes.`
- Add `Forget this browser` action when enabled/available.
- Add enable/forget confirmation UI (modal or inline confirm).

### 5. Hook remember-browser into unlock flow

**Edit**
- `src/components/PassphraseUnlock.tsx`

**Changes**
- Add checkbox: `Remember this browser`.
- On successful passphrase unlock, persist remembered unlock if checkbox is enabled.

### 6. Invalidate remembered unlock on security-sensitive changes

**Edits**
- `src/contexts/EncryptionContext.tsx`
- `src/components/SettingsModal.tsx` (where relevant security flows complete)

**Rules**
- Clear remembered unlock on:
  - sign out
  - user switch
  - manual "Forget this browser"
  - passphrase change / key-material reset flows (when implemented)
- Clear invalid/failed remembered blobs automatically.

---

## Tests (Minimal, High Value)

### Phase 1

**Hook/unit**
- `src/hooks/useIdleTimer.test.ts`
  - idle timeout fires after inactivity
  - activity resets timer
  - disabled mode does not trigger

**Hook/unit**
- `src/hooks/useVaultSettings.test.ts`
  - per-user namespacing
  - defaults
  - load/save behavior

**Integration/UI**
- `src/components/SettingsModal.test.tsx` or `src/contexts/EncryptionContext.test.tsx`
  - manual `Lock vault now` locks vault and returns to passphrase gate
  - vault auto-lock timeout triggers `lockVault()`
  - session refresh restore path restores unlocked vault from `sessionStorage`
  - `lockVault()` clears session unlock blob
  - sign-out still clears keys (regression)

**Crypto/unit**
- `src/lib/encryption.test.ts`
  - session key export/import helpers round-trip
  - restore failure path is detectable/handled

### Phase 2

**Service/unit**
- `src/services/vaultUnlockStorage.test.ts`
  - namespacing by `userId`
  - version handling
  - clear/remove behavior

**Context/integration**
- `src/contexts/EncryptionContext.test.tsx`
  - remembered unlock success path
  - remembered unlock failure clears blob and falls back to passphrase
  - user switch cannot reuse another user's remembered blob

---

## Exact File Changes Summary

### Phase 1

**New**
- `src/hooks/useVaultSettings.ts`
- `src/hooks/useIdleTimer.ts`

**Edit**
- `src/App.tsx`
- `src/components/SettingsModal.tsx`
- `src/contexts/EncryptionContext.tsx`
- `src/lib/encryption.ts`

### Phase 2

**New**
- `src/services/vaultUnlockStorage.ts`

**Edit**
- `src/App.tsx` (if startup orchestration is not fully contained in context)
- `src/components/PassphraseUnlock.tsx`
- `src/components/SettingsModal.tsx`
- `src/contexts/EncryptionContext.tsx`
- `src/lib/encryption.ts`
- `src/hooks/useVaultSettings.ts`

---

## Recommended Execution Order

1. Implement Phase 1 only (session unlock persistence + manual lock + vault auto-lock + settings UI)
2. Ship and validate UX/behavior
3. Implement Phase 2 (`Remember this browser`) as explicit convenience mode
