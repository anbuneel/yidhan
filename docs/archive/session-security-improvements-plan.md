# Session Security & Trusted Device Implementation Plan

**Version:** 1.3
**Last Updated:** 2026-01-31
**Status:** ✅ Complete (PR #83)
**Author:** Claude (Opus 4.5)

---

## Original Prompt

> "Why did we decide to signout a user after inactivity? If I am on a trusted machine, can't my session remain active so I can get back in without having to login every time? How do other popular apps handle this like Gmail?"
>
> Follow-up: "I think we need a combo of #2 and #3 plus - Optionally require re-auth for sensitive actions (export, account deletion, password change). Also add this: - Add an opt-in 'Trusted device / Keep me signed in' that extends the idle timeout to 7-14 days"

---

## Problem Statement

### Current Issues

1. **Aggressive Session Timeout**
   - Current 30-minute inactivity timeout logs users out frequently
   - Not aligned with user expectations from apps like Gmail, Notion, Apple Notes
   - Creates friction in a "calm, distraction-free" note-taking app

2. **No "Remember Me" Option**
   - Users on trusted personal devices must re-login after every timeout
   - No way to indicate "this is my personal device, keep me signed in"

3. **Security Gaps in Sensitive Actions**
   - Password change does NOT require current password verification
   - Account deletion ("Letting Go") has no re-authentication step
   - Full account backup export has no identity verification
   - Risk: Temporary access to unlocked browser -> full account compromise

### Proposed Solution

Implement a combination of:
1. **Configurable session timeout** with longer default (1 week)
2. **"Trusted device / Keep me signed in"** option (extends to 14 days)
3. **Re-authentication for sensitive actions** (password change, account deletion, full export)

---

## Industry Research

### How Other Apps Handle Session Management

| App | Session Timeout | "Remember Me" | Re-auth for Sensitive Actions |
|-----|-----------------|---------------|-------------------------------|
| **Gmail** | ~2 weeks (stays logged in) | Implicit (default) | Yes (password, 2FA changes) |
| **Notion** | Months (rarely logs out) | Implicit | Yes (workspace deletion) |
| **Apple Notes** | Never (device-based) | N/A | Device passcode |
| **Bear** | Never | N/A | N/A |
| **Standard Notes** | Configurable | Yes | Yes (account deletion) |
| **GitHub** | Long-lived | "Remember me" checkbox | Yes (sudo mode for sensitive ops) |
| **Banking Apps** | 5-15 minutes | Sometimes | Always |

### Key Insight

Personal note-taking apps (Bear, Apple Notes, Notion) trust the device's own security (screen lock, OS authentication) rather than implementing aggressive session timeouts. Security-sensitive operations use **step-up authentication** (re-verify identity) rather than constant re-authentication.

---

## Implementation Plan

### Phase 1: Re-Authentication Infrastructure

#### 1.1 Add `verifyPassword` to AuthContext

**File:** `src/contexts/AuthContext.tsx`

Add new function to verify current password without changing session:

```typescript
// Add to AuthContextType interface
verifyPassword: (password: string) => Promise<{ success: boolean; error?: string }>;
lastReauthAt: number | null;  // Timestamp of last successful re-auth

// Implementation
const verifyPassword = async (password: string) => {
  if (!user?.email) return { success: false, error: 'No user logged in' };

  // NOTE: signInWithPassword may fire onAuthStateChange and refresh tokens.
  // This is acceptable - it doesn't create a new session, just validates credentials.
  // If this causes issues, consider using Supabase's reauthenticate() if available.
  const { error } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  });

  if (error) {
    return { success: false, error: 'Incorrect password' };
  }

  // Track successful re-auth for "recently reauthed" window
  setLastReauthAt(Date.now());
  return { success: true };
};
```

**Important:** Track `lastReauthAt` timestamp to enable "recently reauthed" window (see Phase 1.3).

#### 1.2 Create ReAuthModal Component

**File:** `src/components/ReAuthModal.tsx` (NEW)

- Password input field with zen styling
- Loading state during verification
- Error message display ("That doesn't seem right. Try again?")
- For OAuth users: Show "Please sign in again with Google/GitHub" message
- Callbacks: `onSuccess`, `onCancel`

**Modal Copy (zen tone):**
- Title: "A Moment of Verification"
- Body: "Before we continue, please confirm it's you."

#### 1.3 "Recently Reauthed" Window

**Avoid double prompts:** If user re-authenticated in the last 10-15 minutes, skip the re-auth modal for subsequent sensitive actions.

```typescript
// In components that need re-auth
const REAUTH_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

const needsReauth = () => {
  if (!lastReauthAt) return true;
  return Date.now() - lastReauthAt > REAUTH_WINDOW_MS;
};
```

**Use case:** User exports full backup, then immediately clicks "Let go" -> second action skips re-auth prompt.

---

### Phase 2: Protect Sensitive Actions

#### 2.1 Password Change (SettingsModal)

**File:** `src/components/SettingsModal.tsx`

**Current behavior:** User enters new password + confirmation -> saved immediately

**New behavior:**
- Add "Current Password" field above new password fields
- Verify current password before allowing change
- Show inline error if current password is wrong

#### 2.2 Account Deletion (LettingGoModal)

**File:** `src/components/LettingGoModal.tsx`

**Current behavior:** Click "Let go" -> account enters 14-day fade

**New behavior:**
- Click "Let go" -> Check if recently reauthed, if not show ReAuthModal
- Only proceed with `initiateOffboarding()` after successful re-auth
- OAuth users: Type email address to confirm (like GitHub repo deletion)

#### 2.3 Full Backup Export

**File:** `src/components/LettingGoModal.tsx`

**Current behavior:** Click "Full Backup" -> downloads immediately

**New behavior:**
- Click "Full Backup" -> Check if recently reauthed, if not show ReAuthModal
- Only proceed with export after successful re-auth
- Rationale: Full backup contains all user data including share links

**Note:** Simple Markdown/JSON exports do NOT require re-auth (lower risk, less friction).

#### 2.4 Automated Tests

**File:** `src/components/__tests__/LettingGoModal.test.tsx` (NEW or extend existing)

Add tests for:
- Full backup requires re-auth when not recently verified
- Full backup skips re-auth when within 10-minute window
- "Let go" requires re-auth
- OAuth users see email confirmation instead of password prompt

---

### Phase 3: Configurable Session Timeout

#### 3.1 Create Session Settings Hook

**File:** `src/hooks/useSessionSettings.ts` (NEW)

```typescript
interface SessionSettings {
  timeoutMinutes: number | null;  // null = never (only when trusted device is on)
  isTrustedDevice: boolean;
}

// "Never" only available when trusted device is enabled
const TIMEOUT_OPTIONS = [
  { label: '30 minutes', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '24 hours', value: 1440 },
  { label: '1 week', value: 10080 },
  // { label: 'Never', value: null },  // Only shown when trusted device is ON
];

// localStorage keys - KEYED BY USER ID to prevent cross-account leakage
const getStorageKey = (userId: string, key: string) => `yidhan-${userId}-${key}`;

const STORAGE_KEYS = {
  timeout: 'session-timeout',       // -> yidhan-{userId}-session-timeout
  trustedDevice: 'trusted-device',  // -> yidhan-{userId}-trusted-device
  trustedAt: 'trusted-at',          // -> yidhan-{userId}-trusted-at (ISO timestamp)
};

// Trusted device auto-expires after 90 days
const TRUST_TTL_DAYS = 90;

const isTrustExpired = (trustedAt: string | null): boolean => {
  if (!trustedAt) return true;
  const trustedDate = new Date(trustedAt);
  const expiryDate = new Date(trustedDate.getTime() + TRUST_TTL_DAYS * 24 * 60 * 60 * 1000);
  return new Date() > expiryDate;
};
```

**Important:** Storage keys MUST be keyed by user ID to prevent one account's trusted device setting from applying to another account on the same browser.

#### 3.2 Update useSessionTimeout Hook

**File:** `src/hooks/useSessionTimeout.ts`

- Accept `timeoutMinutes` from props (instead of hardcoded 30)
- **Add null guard:** If `timeoutMinutes` is `null`, skip all timer setup (return early)
- If trusted device flag is set, use 14-day timeout (20160 minutes)

```typescript
// Add early return for "never" timeout
if (timeoutMinutes === null || !enabled) {
  // Clear any existing timers, don't set new ones
  clearAllTimers();
  return { resetTimeout: () => {}, minutesRemaining: null, isWarning: false };
}
```

#### 3.3 Update App.tsx Integration

**File:** `src/App.tsx`

- Read session settings from `useSessionSettings()`
- Pass dynamic timeout to `useSessionTimeout()`
- Calculate effective timeout:
  ```typescript
  const effectiveTimeout = trustedDevice
    ? 20160  // 14 days
    : userTimeoutSetting ?? 10080;  // Default: 1 week if not set
  ```

---

### Phase 4: Trusted Device Feature

#### 4.1 Add "Keep me signed in" to Auth Form

**File:** `src/components/Auth.tsx`

- Checkbox below password field: "Keep me signed in on this device"
- On successful login, save trusted device flag keyed by user ID
- Default: unchecked (user opts in)

#### 4.2 Add Security Section to Settings

**File:** `src/components/SettingsModal.tsx`

Add new "Security" tab or section:

**Session Timeout:**
- Dropdown: 30 min / 1 hour / 24 hours / 1 week / Never (if trusted)
- "Never" option only visible when trusted device is enabled
- Helper text: "How long before you're signed out when inactive"
- **Default: 1 week** (not "Never")

**Trusted Device:**
- Toggle: "This is a trusted device"
- Helper text: "Extends session to 14 days and unlocks 'Never' timeout option. Only use on personal devices."
- **Auto-expires after 90 days** - user must re-confirm trust
- When enabled, store `trustedAt` timestamp alongside the boolean flag

---

## Files Summary

### New Files (3)

| File | Purpose |
|------|---------|
| `src/components/ReAuthModal.tsx` | Re-authentication modal for sensitive actions |
| `src/hooks/useSessionSettings.ts` | Session timeout & trusted device settings |
| `src/components/__tests__/LettingGoModal.test.tsx` | Tests for re-auth gating |

### Modified Files (7)

| File | Changes |
|------|---------|
| `src/contexts/AuthContext.tsx` | Add `verifyPassword()`, `lastReauthAt` state |
| `src/components/SettingsModal.tsx` | Add Security section, current password field |
| `src/components/LettingGoModal.tsx` | Add re-auth before deletion & full export |
| `src/components/Auth.tsx` | Add "Keep me signed in" checkbox |
| `src/hooks/useSessionTimeout.ts` | Make timeout configurable, add null guard |
| `src/App.tsx` | Integrate dynamic session settings |
| `src/types.ts` | Add `SessionSettings` type (if needed) |

---

## Implementation Order

1. `AuthContext.tsx` - Add `verifyPassword()` function and `lastReauthAt` state
2. `ReAuthModal.tsx` - Create new component
3. `SettingsModal.tsx` - Add current password requirement for password change
4. `LettingGoModal.tsx` - Add re-auth before account deletion & full export
5. `LettingGoModal.test.tsx` - Add automated tests for re-auth gating
6. `useSessionSettings.ts` - Create new hook for settings (keyed by user ID)
7. `useSessionTimeout.ts` - Make timeout configurable, add null guard
8. `App.tsx` - Integrate dynamic timeout
9. `Auth.tsx` - Add "Keep me signed in" checkbox
10. `SettingsModal.tsx` - Add Security section with dropdown & toggle

---

## Verification & Testing

### Automated Tests

- [ ] Full backup requires re-auth when not recently verified
- [ ] Full backup skips re-auth when within 10-minute window
- [ ] "Let go" requires re-auth (respects recent re-auth window)
- [ ] OAuth users see email confirmation instead of password prompt

### Manual Testing Checklist

**Re-auth Flow:**
- [ ] Password change requires current password first
- [ ] "Let go" requires password before proceeding
- [ ] Full backup requires password
- [ ] OAuth user sees appropriate message (no password field)
- [ ] Wrong password shows error, allows retry
- [ ] Sequential sensitive actions within 10 min skip re-auth

**Session Timeout:**
- [ ] Setting timeout to 30 min -> warns at 25 min, logs out at 30
- [ ] Setting timeout to "Never" -> never shows warning modal
- [ ] "Never" option only visible when trusted device is ON
- [ ] User activity resets timer correctly
- [ ] Switching accounts clears other account's trusted device status

**Trusted Device:**
- [ ] Login with "Keep me signed in" checked -> persists flag for that user
- [ ] With trusted device, timeout extends to 14 days
- [ ] Can disable in Settings -> reverts to user-selected timeout
- [ ] Different user on same browser has separate trusted device setting
- [ ] Trusted device auto-expires after 90 days (test with mocked date)

**Settings UI:**
- [ ] Timeout dropdown works and persists across browser sessions
- [ ] Trusted device toggle works
- [ ] OAuth users don't see password change section

---

## Design Notes

### UX Considerations

- Use existing modal patterns (BottomSheet for mobile, centered for desktop)
- Match zen aesthetic with gentle language:
  - "Verify it's you" not "Re-authenticate"
  - "A moment of verification" not "Security check"
  - "Keep me signed in" not "Remember this device"
- **Default timeout: 1 week** (not "Never" - that requires explicit trusted device opt-in)
- Trusted device timeout: 14 days (matches Gmail-like behavior)

### Storage Keys (Per-User)

```
yidhan-{userId}-session-timeout    # number | null (minutes)
yidhan-{userId}-trusted-device     # boolean
yidhan-{userId}-trusted-at         # ISO timestamp (for 90-day TTL)
```

**Why per-user?** Prevents one account from granting long timeouts to another on shared browser.

**Trust TTL:** When checking `trusted-device`, also verify `trusted-at` is within 90 days. If expired, treat as untrusted and clear the flag.

### OAuth User Handling

OAuth users (Google/GitHub) don't have passwords, so:
- Hide password-related settings
- For re-auth: Require typing email address to confirm (like GitHub repo deletion)
- OAuth re-flow is overkill for this use case

### Technical Notes

1. **signInWithPassword session behavior:** May fire `onAuthStateChange` and refresh tokens. This is acceptable - it validates credentials without creating a new session. Monitor for issues.

2. **Null timeout guard:** `useSessionTimeout` must handle `timeoutMinutes: null` by skipping all timer setup, not calculating `NaN`.

3. **Recently reauthed window:** 10-minute window prevents UX friction when performing multiple sensitive actions in sequence.

4. **Trusted device 90-day TTL:** On each session load, check if `trustedAt` timestamp is older than 90 days. If expired, clear the `trustedDevice` flag and show a toast: "Your trusted device status has expired. Please re-enable in Settings if this is still your personal device."

---

## Resolved Questions

| Question | Decision |
|----------|----------|
| OAuth re-auth method | Type email to confirm (simpler than OAuth re-flow) |
| Export re-auth scope | Only Full Backup requires re-auth; All Notes export (JSON/Markdown) remains frictionless |
| Session timeout default | 1 week (not "Never" - that requires trusted device) |
| Trusted device expiry | **Yes, 90-day TTL** - auto-expires and requires re-confirmation |

---

## References

- Current implementation: `src/hooks/useSessionTimeout.ts`
- Auth context: `src/contexts/AuthContext.tsx`
- Settings modal: `src/components/SettingsModal.tsx`
- Offboarding modal: `src/components/LettingGoModal.tsx`
