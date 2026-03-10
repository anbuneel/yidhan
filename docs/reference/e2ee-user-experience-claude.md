# E2EE User Experience Reference

**Version:** 1.0
**Last Updated:** 2026-02-24
**Status:** Living Document
**Author:** Claude (Opus 4.6)

---

## Original Prompt

> Refresh my memory on the expected behavior of the E2EE enhancement as a user

---

## Overview

Yidhan's End-to-End Encryption (E2EE) protects note content with a user-chosen passphrase. Keys are derived locally and never sent to the server. This document describes the complete user-facing behavior.

---

## 1. First-Time Setup (New User)

1. **Sign up** via email/password or Google OAuth
2. **Passphrase Setup** screen appears fullscreen, blocking the library
   - Title: "Protect Your Notes"
   - User creates a passphrase (minimum 8 characters), confirms it
   - Must acknowledge: "I understand that if I forget this passphrase, my notes cannot be recovered. There are no recovery codes."
   - **Zero recovery** — intentional, prominently warned
3. Keys are derived locally via Argon2id (~1-2 seconds), never sent to server
4. Salt + key-check blob stored in Supabase `user_metadata` (not the key itself)
5. An encrypted welcome note is auto-created
6. User lands in the library — all notes encrypted from this point on

---

## 2. Returning User (Re-opening the App)

### Same tab, page refresh
- Keys survive in `sessionStorage` → automatic unlock, no passphrase prompt

### New tab or closed browser
- `sessionStorage` is gone → **"Unlock Your Notes"** screen appears
- User enters passphrase → keys re-derived → verified against stored key-check blob
- Wrong passphrase: "Incorrect passphrase. Please try again."
- Option to sign out if unable to remember

### "Remember this browser" (opt-in, since v3.4.0)
- Checkbox on the unlock screen: "Remember this browser"
- When enabled, persists a `SessionKeyBlob` in `localStorage` (survives browser restarts)
- Keys verified against `encryption_key_check` on restore to detect stale keys after passphrase change
- Activity-gated restore after auto-lock (keys stay out of memory during idle)
- Cleared on manual lock, sign-out, or user switch
- Default: off (opt-in for convenience vs. security tradeoff)

### Different device
- Keys are per-device (never synced) → must enter passphrase again

---

## 3. Vault Locking (Active Session)

### Manual Lock
- Location: Settings → Security → "Lock vault now"
- Keys zeroed out from memory + sessionStorage
- Immediately returns to unlock screen
- Toast: "Vault locked"

### Auto-Lock (Configurable)
- Location: Settings → Security → "Vault auto-lock after inactivity"
- Options: Off / 15 minutes / 60 minutes
- Default: Off
- Tracks: mouse, keyboard, touch, scroll activity
- When triggered: same as manual lock + toast "Vault locked after inactivity"

---

## 4. Two Independent Timeout Layers

| Layer | What it does | Configured where |
|-------|-------------|-----------------|
| **Vault auto-lock** | Locks encryption keys, keeps you logged in | Security → "Vault auto-lock after inactivity" |
| **Session timeout** | Signs you out of the entire app | Security → "Auto-lock after inactivity" (auth-level) |

Session timeout shows a zen-styled warning modal: "Your session is about to fade" with options to **Stay** or **Sign out now**.

### Session timeout options
- Without trusted device: Never / 5 min / 15 min / 30 min / 1 hr / 4 hr / 8 hr
- With trusted device enabled: extends to 14 days (expires after 90 days)

---

## 5. What Gets Encrypted

| Encrypted | NOT Encrypted |
|-----------|--------------|
| Note title + content (JSON blob, AES-256-GCM) | Tags (plaintext, for filtering/search) |
| | Timestamps, pinned status, metadata |

Each note is encrypted with AAD (Additional Authenticated Data) of `noteId:userId` to prevent note-swapping attacks.

---

## 6. Sharing: E2EE Share as Letter

**"Share as Letter" works with E2EE enabled** (since v3.5.0). Each share link generates a unique per-note AES-256-GCM key embedded in the URL fragment (`#k=<base64url>`). The server stores only ciphertext via the `fetch_shared_note` RPC — it never sees the plaintext.

- Share links have a configurable TTL (1, 7, or 30 days)
- Revoking a share soft-deletes it (`revoked_at` timestamp)
- The recipient decrypts client-side using the key from the URL fragment
- URL format: `/s/<token>/<slug>#k=<key>`

---

## 7. E2EE Migration (Existing Users)

For users who had plaintext notes before E2EE was added:

1. Settings → Security → **"Encrypt existing notes"**
2. Navigate to `/migrate` page
3. **Must export a JSON backup first** (safety net, required)
4. Confirm backup via checkbox
5. Progress bar: "X / Y notes (Z%)"
6. Summary screen shows encrypted / already-encrypted / failed counts
7. Return to library

Tags remain plaintext after migration.

---

## 8. Cross-Device Mental Model

| Concept | Behavior |
|---------|----------|
| **Login password** | Proves who you are (server knows) |
| **Passphrase** | Unlocks your notes (server never knows) |
| **Each device/tab** | Independent vault session |
| **Page refresh** | Stays unlocked (sessionStorage persists) |
| **Close tab** | Vault locks (sessionStorage cleared) |
| **Forget passphrase** | Notes are gone forever (no recovery) |

---

## 9. Key Storage Locations

| Where | What | Lifetime |
|-------|------|----------|
| React state (memory) | Encryption + HMAC keys | Until component unmounts or lock |
| sessionStorage | Exported session keys | Survives refresh, cleared on tab close |
| Supabase user_metadata | Salt, key-check blob, IV | Permanent (not secret) |

Keys are securely zeroed out (overwritten with 0s) when the vault locks.

---

## 10. Edge Cases & Security Details

### Password reset vs. passphrase
- Resetting the **login password** (via Supabase auth recovery) does NOT help with a forgotten E2EE passphrase
- These are separate credentials with separate purposes

### Cross-tab behavior
- Each browser tab has independent sessionStorage
- Opening Yidhan in a second tab requires entering the passphrase again

### Sync during locked vault
- Incoming realtime updates stored encrypted in IndexedDB
- On unlock: full refetch with decryption happens

### Conflict detection
- Uses HMAC-SHA-256 content hashes (not plaintext comparison)
- Encrypted payloads compared without decrypting
- Conflicts shown via "Two Paths" modal

### Sentry privacy
- Breadcrumb scrubber strips `encrypted_payload`, `encryption_iv`, `encryption_version`, `content_hash` before sending to Sentry
- Encrypted note content never reaches error tracking

---

## 11. Settings Organization

### Security Tab Layout

**Encryption Vault** (visible when E2EE is set up)
- Status indicator: Locked / Unlocked
- "Lock vault now" button
- Auto-lock dropdown: Off / 15 min / 60 min

**Session Timeout** (auth-level)
- Auto-lock dropdown with time options
- Trusted device toggle (extends to 14 days)

**E2EE Migration** (visible if plaintext notes exist)
- "Encrypt existing notes" button → navigates to `/migrate`

---

## 12. Key UX Principles

1. **Zero Recovery** — No backup codes, no admin reset. Forgotten passphrase = permanent loss.
2. **Per-Device Keys** — Keys never leave the device. Each device is an independent vault.
3. **Session Persistence** — Keys survive refresh but not tab close. Simple mental model.
4. **Two Independent Timeouts** — Vault lock (keeps you logged in) vs. session timeout (logs you out).
5. **Non-Intrusive** — Unlock happens once per session. Automatic if sessionStorage exists.
6. **Zen Language** — "Session is about to fade" not "expire". Matches Yidhan's calm aesthetic.

---

*This document describes the user-facing E2EE behavior as of v3.1.0 (February 2026).*
