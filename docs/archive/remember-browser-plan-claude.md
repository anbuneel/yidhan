# Remember This Browser — Implementation Plan

**Version:** 1.3
**Last Updated:** 2026-02-28
**Status:** Approved (Peer Reviewed)
**Author:** Claude (Opus 4.6)
**Peer Review:** `docs/reviews/plan-review-a7c3e91b.md` (4 rounds, gpt-5.3-codex)

---

## Original Prompt

> Having to enter the passphrase is a big pain now after we implemented E2EE. Let's discuss on a tradeoff — less friction is preferable. Option 2 (Persistent Session Key in localStorage), with Option B behavior (auto-lock clears memory but preserves localStorage).

---

## Context

After implementing E2EE (v3.0.0, PR #124), users must re-enter their passphrase every time they close the browser tab. Keys currently live in `sessionStorage` which clears on tab close. This is too much friction for a "calm, distraction-free" note app.

This plan adds an opt-in **"Remember this browser"** feature that persists encryption keys in `localStorage`, surviving browser restarts while maintaining real security boundaries on lock/sign-out.

### Design Choice (Option B — Auto-Lock with Real Key Clearing)

- **Auto-lock:** Clears keys from JS memory (real security boundary) but keeps `localStorage` intact, so returning users auto-unlock without passphrase prompt
- **Manual lock / sign-out:** Clears everything including `localStorage`
- **Default:** Off — user must opt in via checkbox on unlock screen or toggle in Settings

### Security Tradeoffs

| Concern | Assessment |
|---------|------------|
| **XSS attack** | Attacker could read key blob from localStorage. Same exposure as sessionStorage during active session — window is just wider. |
| **Stolen laptop (browser closed)** | Only risk added by this feature. Mitigated by opt-in + "only use on personal devices" warning. |
| **Shared computer** | Toggle defaults to off. Sign-out clears everything. |
| **Malicious browser extension** | Same access as XSS — not solvable at our layer. |

**Bottom line:** Same tradeoff every password manager makes with "remember me." User opts in knowing the cost.

---

## Existing Infrastructure (Already Built)

- `useVaultSettings.ts` — has `rememberBrowser: boolean` in localStorage (not yet wired to UI or encryption logic)
- `EncryptionContext.tsx` — has `exportSessionKeys`/`importSessionKeys` for `SessionKeyBlob` serialization
- `SessionKeyBlob` type — `{ version: 1, encKey: string, hashKey: string, salt: string }` (base64)
- "Trusted device" toggle in SettingsModal — exact UI pattern to clone

---

## Files to Modify (in order)

### 1. `src/contexts/EncryptionContext.tsx` — Core logic

**Add localStorage helper functions** (after existing `sessionKey`/`persistSession`/`clearSession`/`restoreSession`):
- `persistedKey(userId)` — returns `yidhan-${userId}-vault-persisted-keys`
- `isRememberBrowserEnabled(userId)` — reads `yidhan-${userId}-vault-remember-browser` from localStorage directly (avoids circular context dependency with `useVaultSettings`)
- `persistLocal(userId, keys)` — writes `SessionKeyBlob` JSON to localStorage
- `clearLocal(userId)` — removes from localStorage
- `restoreLocal(userId)` — reads + imports from localStorage, returns `DerivedKeys | null`

**Update `EncryptionContextType` interface:**
- `lockVault: (reason?: 'auto-lock' | 'manual' | 'sign-out') => void` — add reason param
- `persistToLocal: () => void` — new, for Settings toggle-on while already unlocked

**Update `unlockWithPassphrase` and `setupPassphrase`:**
- After existing `persistSession()` call, add: `if (isRememberBrowserEnabled(userId)) persistLocal(userId, keys)`

**Update restore `useEffect`:**
- Try `restoreSession()` first (sessionStorage — fast path for refresh)
- If null AND `isRememberBrowserEnabled()` → try `restoreLocal()`
- If restored from localStorage, **verify keys against `encryption_key_check`** before accepting (prevents stale/injected keys after passphrase change)
- If key-check verification fails, clear the stale localStorage blob and fall through to passphrase prompt
- If restored and verified, re-populate sessionStorage via `persistSession()` for the current tab

**Update `lockVault`:**
- Accept `reason` param (default `'manual'`)
- Always clear sessionStorage (existing)
- Only clear localStorage if `reason !== 'auto-lock'` (auto-lock preserves localStorage)
- **When `reason === 'auto-lock'`, set `autoLockedRef.current = true`** (do NOT reset sessionRestoreAttemptedRef here — that would cause immediate re-restore)

**Add `autoLockedRef` + activity-gated restore:**
- New ref: `const autoLockedRef = useRef(false)`
- On `lockVault('auto-lock')`: set `autoLockedRef.current = true`
- On `lockVault('manual')` or user-switch: set `autoLockedRef.current = false`
- **New useEffect (activity gate):** When `autoLockedRef.current === true` AND `isRememberBrowserEnabled(currentUserId)`, register listeners for `visibilitychange` (tab becomes visible) and user interaction events (`mousedown`, `keydown`, `touchstart`). On first activity, the handler **directly calls the restore logic** (not via the restore useEffect — refs don't trigger React re-renders):
  1. Set `autoLockedRef.current = false`
  2. Call `restoreLocal(currentUserId)` directly
  3. If restored, verify against key-check (`verifyKeyCheck`)
  4. If valid: call `persistSession()` to repopulate sessionStorage, then `setKeyState({ keys: restored, userId: currentUserId })`
  5. If invalid or null: clear stale localStorage blob, do nothing (PassphraseUnlock remains shown)
  6. Clean up event listeners
- **Why direct call instead of effect re-trigger:** `useRef` mutations don't cause re-renders, so resetting `sessionRestoreAttemptedRef` in an event handler wouldn't trigger the restore useEffect (whose deps are `[currentUserId, isEncryptionSetup, keyState.keys]`). Calling restore directly from the handler is simpler and avoids introducing a state nonce.
- This ensures auto-lock is a **real** security boundary: keys stay out of memory until the user physically returns

**Update user-switch cleanup (prevUserId block):**
- Also call `clearLocal(prevUserId)` when user switches
- **Note:** This block already fires on sign-out (when `currentUserId` becomes `null`), providing defensive cleanup for the sign-out path without needing explicit `lockVault('sign-out')` calls at every sign-out callsite

**Add `persistToLocal` callback:**
- If keys in memory + userId set → call `persistLocal()`
- On localStorage write failure, show a toast: "Could not remember this browser — storage may be full"
- Used when user enables "Remember" toggle in Settings while already unlocked

### 2. `src/hooks/useVaultSettings.ts` — Clear keys on disable

**Update `setRememberBrowser`:**
- When setting to `false`, also call `localStorage.removeItem(`yidhan-${userId}-vault-persisted-keys`)`
- Ensures disabling the toggle immediately removes persisted keys

### 3. `src/App.tsx` — Wire lock reasons + persistToLocal

- **Auto-lock call** (line ~246): `lockVault()` → `lockVault('auto-lock')`
- **Manual lock prop** (line ~1889): `onLockVault={lockVault}` → `onLockVault={() => lockVault('manual')}`
- **Destructure `persistToLocal`** from `useEncryption()`
- **Pass `onPersistToLocal={persistToLocal}`** to SettingsModal

### 4. `src/components/SettingsModal.tsx` — UI toggle + status text

- **Add `onPersistToLocal?: () => void`** to props interface
- **Update vault status description** (line ~613) — conditional on `rememberBrowser`
- **Update auto-lock description** (line ~694) — conditional on `rememberBrowser`
- **Add "Remember this browser" toggle** after auto-lock section, matching "Trusted device" toggle pattern

### 5. `src/components/PassphraseUnlock.tsx` — Checkbox on unlock screen

- Import `useVaultSettings`, wire to `user?.id`
- Add "Remember this browser" checkbox between passphrase input and submit button

### 6. `src/components/PassphraseSetup.tsx` — Optional (lower priority)

- Same checkbox pattern as PassphraseUnlock, below acknowledgment checkbox

---

## Interaction Matrix

| Action | sessionStorage | localStorage keys | autoLockedRef | restoreRef |
|---|---|---|---|---|
| Unlock (remember=off) | Write | — | false | Set to userId |
| Unlock (remember=on) | Write | Write | false | Set to userId |
| Auto-lock (idle) | Clear | **Preserve** | **true** | Unchanged |
| User returns (activity after auto-lock) | Write (repopulated) | — | **false** | — (restore called directly, not via effect) |
| Manual lock button | Clear | **Clear** | false | Reset to null |
| Sign out / user switch | Clear | **Clear** | false | Reset (via user change) |
| Disable remember in Settings | — | **Clear** | — | — |
| Enable remember in Settings (while unlocked) | — | Write (via persistToLocal) | — | — |

---

## Verification Plan

### Automated Tests (vitest with localStorage mocks)

Add test file `src/contexts/__tests__/encryption-persistence.test.ts`:
- `persistLocal` writes valid SessionKeyBlob to localStorage
- `restoreLocal` returns keys from valid blob
- `restoreLocal` returns null and clears on corrupted blob
- `restoreLocal` returns null and clears when key-check verification fails (stale keys)
- `clearLocal` removes the key from localStorage
- `isRememberBrowserEnabled` reads boolean correctly
- `lockVault('auto-lock')` preserves localStorage, clears sessionStorage, sets autoLockedRef
- Auto-lock does NOT immediately restore (activity gate prevents instant re-unlock)
- Activity event after auto-lock calls restoreLocal() directly (not via useEffect — refs don't trigger re-renders)
- `lockVault('manual')` clears both localStorage and sessionStorage
- `setRememberBrowser(false)` clears persisted keys atomically

### Manual Testing

1. `npm run check` — full CI (typecheck + lint + test + build)
2. Scenarios:
   - **remember=off**: close tab → reopen → passphrase required (unchanged behavior)
   - **remember=on**: close tab → reopen → auto-unlock, no prompt
   - **auto-lock fires**: vault locks, keys cleared from memory. On return (mouse/key/touch/visibility), auto-unlocks silently from localStorage (verified against key-check). Keys are NOT in memory during idle.
   - **manual lock**: returns → passphrase required (localStorage cleared)
   - **sign out**: re-login → passphrase required
   - **disable in Settings**: close tab → reopen → passphrase required
   - **enable in Settings while unlocked**: close tab → reopen → auto-unlocks
   - **localStorage write failure**: toast shown, graceful degradation to session-only
   - **passphrase change with remember=on**: old localStorage keys detected as stale via key-check, cleared, passphrase required
3. Update CLAUDE.md E2EE section, changelog, README if needed

---

## Deferred Items

- **Cross-tab lock propagation** (P1): Manual lock in one tab should invalidate other tabs via `BroadcastChannel` or `storage` event. Same gap exists for current sessionStorage behavior. File as follow-up issue.
- **Key TTL/expiry**: Persisted keys are indefinite until manual lock/sign-out/toggle-off. TTL is a future enhancement.
