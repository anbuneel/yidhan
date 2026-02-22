# Encryption Capability Analysis

**Version:** 3.2
**Last Updated:** 2026-02-21
**Status:** Decisions Made (Ready for Implementation Planning)
**Author:** Claude (Opus 4.5, revised by Opus 4.6)
**Reviewed by:** OpenAI Codex (gpt-5.3-codex), Round 1

---

## Original Prompt

> How can we implement encryption capability? How complex is it? Give me a recommendation. Think harder as this is an important feature of the app.

**Follow-up requirement:**
> Even I as the app developer shouldn't be able to see anyone's notes!

---

## Executive Summary

This document analyzes encryption options for Yidhan, comparing complexity, trade-offs, and alignment with the app's philosophy. This is an **analysis and decisions document**, not the implementation plan. Detailed test matrices, export/import behavior, and step-by-step implementation belong in a separate plan document in `docs/plans/`.

**Key Requirement:** Zero-knowledge architecture where even the app developer cannot access user notes.

**Recommendation:** **Full E2EE (Standard Notes-style)** — all notes encrypted by default with keys derived from a user-chosen encryption passphrase. This is the only approach that truly prevents developer access.

**Key decisions (v3.1):**
- One encryption passphrase for all users (email and OAuth alike), set during onboarding
- Argon2id via WASM for key derivation (GPU-resistant)
- AES-256-GCM with AAD (`note_id`, `user_id`) for note encryption (title + content encrypted together)
- HMAC-SHA-256 content hash (keyed, not raw) for conflict detection
- Additive database schema (`encrypted_payload` column) — plaintext columns preserved during migration
- Tag names remain unencrypted (deferred; UI will explicitly message this to users)
- Share as Letter disabled for v1 E2EE (re-enabled with per-share key envelope in a later phase)
- No key hierarchy for v1 (password changes deferred)
- No recovery codes for v1 ("your passphrase is your only key")
- Welcome note trigger must be replaced with client-side creation
- Key-check blob stored in user_metadata for passphrase verification

**Estimated effort:** ~12-16 weeks (revised upward from original 6-8 week estimate)

---

## Competitive Analysis: How Other Apps Handle Encryption

### Notion: NO E2EE

Notion does **not** offer end-to-end encryption:

- Encryption in transit (TLS)
- Encryption at rest (AES-256 on AWS servers)
- **No E2EE** - Notion employees CAN technically read your notes

**Source:** [Notion Security Practices](https://www.notion.com/help/security-and-privacy)

**Implication:** Notion prioritizes features (search, collaboration, sharing) over zero-knowledge privacy.

---

### Bear: Optional Per-Note E2EE (Partial)

Bear takes a hybrid approach:

- Uses **iCloud CloudKit** for sync (Apple's encryption)
- **Optional E2EE** for individual notes (Bear Pro feature)
- Uses [Themis library](https://www.cossacklabs.com/case-studies/bear/) with AES-GCM-256
- Password stored in **Apple SecureEnclave** for biometric unlock
- [Bear 2.4 (May 2025)](https://blog.bear.app/2025/05/bear-2-4-update-better-encryption-smarter-todo-and-more/) added encrypted attachments

**Limitation:** Only encrypted notes are truly private. Unencrypted notes sync through iCloud where Apple could theoretically access them.

**Source:** [Bear Encryption Blog](https://blog.bear.app/2023/10/encryption-bear-and-your-private-data/)

---

### Standard Notes: Full E2EE by Design (Gold Standard)

Standard Notes is the benchmark for zero-knowledge note apps:

- **ALL notes encrypted** before leaving your device
- Server is treated as an untrusted entity
- Open-source, audited encryption specification
- Even if their servers are hacked, attackers get only encrypted gibberish
- **You own the keys** - Standard Notes literally cannot read your notes

**Architecture principle:** The server is "dumb storage" - it only stores and retrieves encrypted blobs.

**Source:** [Standard Notes Encryption Whitepaper](https://standardnotes.com/help/security/encryption)

---

### Comparison Matrix

| Feature | Notion | Bear | Standard Notes | **Yidhan (Goal)** |
|---------|--------|------|----------------|-------------------|
| Developer can read notes | Yes | Unencrypted only | Never | Never |
| E2EE available | No | Per-note (opt-in) | All notes (default) | All notes |
| Search works | Server-side | Full | Client-side only | Client-side only |
| Sharing works | Full | Full | Limited | Disabled in v1 E2EE; redesigned later |
| Zero-knowledge | No | Partial | Yes | Yes |
| Open-source crypto | N/A | Themis | Custom spec | Argon2id WASM + Web Crypto API |
| Password lost = data lost | N/A | Encrypted only | Yes | Yes |

---

## Current State

Supabase already provides **encryption at rest** (AWS encrypts the underlying storage). This protects against physical disk theft but not against someone with database access (including the app developer).

---

## Three Approaches Evaluated

### 1. Server-Side Column Encryption (Low Complexity)

```
User -> Supabase -> pgcrypto encrypts -> PostgreSQL
```

**How it works:**
- Use PostgreSQL's `pgcrypto` extension
- Encrypt `content` column with server-managed key
- Transparent to the app code

| Aspect | Assessment |
|--------|------------|
| **Pros** | Simple, no client changes, search still works |
| **Cons** | Supabase/admin can still read notes; not true privacy |
| **Effort** | ~1 week |
| **Breaks** | Nothing |

**Verdict:** Does not meet zero-knowledge requirement.

---

### 2. Optional E2EE for "Private Notes" (Medium Complexity)

```
User -> Web Crypto API -> Encrypted blob -> Supabase
        (client-side)     (unreadable)
```

**How it works:**
- User sets an "encryption password" in Settings (separate from login)
- Toggle notes as "Private" — these get encrypted before sync
- Regular notes work exactly as before
- Private notes excluded from search, can't be shared

| Aspect | Assessment |
|--------|------------|
| **Pros** | Opt-in, doesn't break existing features, true E2EE for sensitive notes |
| **Cons** | Two passwords to remember, private notes not searchable, password forgotten = notes lost |
| **Effort** | ~3-4 weeks |
| **Breaks** | Search for private notes only, sharing for private notes only |

**Verdict:** Does not meet full zero-knowledge requirement (unencrypted notes are still visible to developer).

---

### 3. Full E2EE (High Complexity) — CHOSEN

```
+-------------------------------------------------------------+
|  USER'S DEVICE                                               |
|  +--------------+    +---------------+    +----------------+ |
|  | User types   | -> | Derive key    | -> | Encrypt with   | |
|  | "My secret"  |    | via Argon2id  |    | AES-256-GCM    | |
|  +--------------+    +---------------+    +----------------+ |
|                                                  |           |
|                                    "X8f2kL9..." (ciphertext) |
+------------------------------------------+-------------------+
                                           |
                                           v
+------------------------------------------+-------------------+
|  SERVER (Supabase) - "Dumb Storage"                          |
|  +--------------------------------------------------------+  |
|  |  encrypted_payload: "X8f2kL9mNpQrStUvWxYz..."          |  |
|  |  content_hash: "hmac-a3f2b8..." (HMAC-SHA-256, keyed)  |  |
|  |  (Developer sees only gibberish - CANNOT decrypt)       |  |
|  +--------------------------------------------------------+  |
+--------------------------------------------------------------+
```

**How it works:**
- Encryption passphrase required for all users during onboarding (email and OAuth alike)
- All note titles + content encrypted with AES-256-GCM (with AAD binding) before leaving device
- Key derived via Argon2id (WASM) from passphrase + user-specific salt
- HMAC-SHA-256 hash (keyed) of plaintext stored alongside ciphertext for conflict detection
- Server stores only encrypted blobs — treated as untrusted
- Decryption happens only on user's device

| Aspect | Assessment |
|--------|------------|
| **Pros** | Maximum privacy, zero-knowledge, developer cannot access notes |
| **Cons** | Breaks server-side search, sharing disabled for v1, passphrase lost = all data lost |
| **Effort** | ~12-16 weeks |
| **Breaks** | Server-side search, "Share as Letter" (disabled for v1), real-time preview |

---

## Recommendation: Option 3 (Full E2EE)

Given the requirement that **even the developer cannot see notes**, only Option 3 satisfies this constraint.

### Why Full E2EE is Required

| Approach | Developer Can See Notes? |
|----------|--------------------------|
| Server-side encryption | Yes (keys on server) |
| Optional per-note E2EE | Unencrypted notes only |
| **Full E2EE** | **Never** |

### Trade-offs Accepted

For true zero-knowledge, these features **must change**:

| Feature | Current | With Full E2EE |
|---------|---------|----------------|
| **Search** | Server-side, instant | Client-side only, loads all notes |
| **Share as Letter** | Generate link, anyone can view | Disabled for v1; redesigned with per-share key envelope later |
| **Password recovery** | Email reset | Impossible — forgot passphrase = lost data |
| **Note previews** | Server can render | Must decrypt on client first |
| **Multi-device** | Automatic sync | Need to enter passphrase on each device |
| **Conflict detection** | Plaintext content comparison | HMAC-SHA-256 hash comparison (zero-knowledge safe) |
| **Welcome note** | Server-side DB trigger | Client-side creation after passphrase setup |

### Alignment with Yidhan Philosophy

| Principle | How Full E2EE Aligns |
|-----------|----------------------|
| **Wabi-sabi** | Accepts imperfection — no passphrase recovery is an honest limitation |
| **Calm technology** | No anxiety about data breaches — your notes are truly private |
| **Honest presence** | Clear warning: "Your passphrase is your key. We cannot recover it." |
| **Organic** | Natural evolution — privacy as a core value, not an afterthought |

---

## Decisions Made (v3.0, revised v3.1)

Decisions from the February 2026 review, with rationale and deferral paths.

### Decision 1: One passphrase for everyone (email + OAuth)

**Choice:** All users set an encryption passphrase during onboarding, regardless of auth method.

**Rationale:** Yidhan's auth flow is OAuth-first (Google/GitHub buttons appear before email form). OAuth gives a token, not a password — so a separate encryption passphrase is required. Rather than creating special cases for OAuth vs email users, everyone goes through the same flow. This keeps the architecture simple (one code path) and reinforces the privacy message: "take a moment to secure your thoughts."

**UX impact:** OAuth users see a passphrase setup screen after their first OAuth login. This is one-time friction, not recurring. It aligns with the calm philosophy — a deliberate pause before writing begins.

**Alternatives rejected:**
- Auto-generated device-bound key (seamless but creates device-recovery complexity)
- Defer E2EE for OAuth users (breaks zero-knowledge promise)

---

### Decision 2: Defer key hierarchy (no password change support in v1)

**Choice:** Derive the encryption key directly from the passphrase. No intermediate key hierarchy.

**Rationale:** A proper key hierarchy (passphrase -> master key -> wrapped item keys per note) allows password changes without re-encrypting all content. But it adds significant implementation complexity. For v1, we skip this and **do not offer a "change encryption passphrase" option.** The passphrase is permanent.

**Future path:** When key hierarchy is added later, password changes become a feature. The database schema should leave room for a `wrapped_key` column per note so migration is straightforward.

**Risk:** If a user's passphrase is compromised, they cannot rotate it without a full re-encryption migration. Acceptable for v1 given low user count.

---

### Decision 3: Argon2id via WASM for key derivation

**Choice:** Use Argon2id (loaded as a ~50-100KB WASM module, lazy-loaded) instead of PBKDF2.

**Rationale:** PBKDF2-SHA256 with 100k iterations (the v2.0 doc's approach) is vulnerable to GPU-based brute force. OWASP recommends at least 600k iterations for PBKDF2, and prefers Argon2id entirely. Argon2id is "memory-hard" — it forces attackers to use large amounts of RAM per guess, making GPU/ASIC attacks dramatically more expensive. Web Crypto API doesn't support Argon2 natively, so a WASM library is needed.

**Bundle impact:** ~50-100KB WASM, lazy-loaded only during passphrase setup and unlock. Does not affect initial page load.

**Alternatives rejected:**
- PBKDF2 600k iterations via Web Crypto (zero bundle cost, but no GPU resistance)
- Themis library (adds dependency, ~50KB, but less widely used than Argon2id)

---

### Decision 4: HMAC-SHA-256 content hash for conflict detection

**Choice:** Store an `HMAC-SHA-256(title + content)` hash alongside the ciphertext, using a separate hash key derived from the passphrase. The sync engine compares hashes instead of plaintext content.

**Rationale:** The current sync engine (`syncEngine.ts`) compares `serverNote.title === localNote.title && serverNote.content === localNote.content` to distinguish real conflicts from timestamp drift. With E2EE, the server holds ciphertext — and two encryptions of the same plaintext produce different ciphertext (different random IVs), so ciphertext comparison is meaningless.

**Why HMAC, not raw SHA-256:** Raw `SHA-256(plaintext)` leaks equality across users and enables dictionary attacks on low-entropy content (e.g., short notes like "todo" or empty notes). HMAC-SHA-256 with a key derived from the user's passphrase means: (a) identical content from different users produces different hashes, (b) an attacker cannot precompute hashes without the passphrase, (c) the hash still serves its conflict-detection purpose within a single user's notes.

**Hash key derivation:** Derive a single 64-byte Argon2id output and split it: first 32 bytes for the encryption key, last 32 bytes for the HMAC hash key. Argon2id's output is uniformly random, so splitting is cryptographically sound and simpler than running two separate derivations with different salts.

**Sync engine change:**

```typescript
// Before (plaintext comparison)
const contentIdentical =
  serverNote.title === localNote.title &&
  serverNote.content === localNote.content;

// After (HMAC hash comparison)
const contentIdentical =
  serverNote.content_hash === localNote.content_hash;
```

The HMAC hash is computed client-side from the plaintext *before* encryption, then sent alongside the ciphertext to the server.

---

### Decision 5: Encrypt titles + content together, tags stay plaintext

**Choice:** Bundle note title and content into a single encrypted payload. Tag names remain unencrypted.

**Rationale:** For true zero-knowledge, titles must be encrypted — a title like "Therapy session notes" leaks significant information even without the content. Bundling title + content in one encrypted blob is simpler than encrypting them separately (one IV, one encrypt/decrypt operation per note).

Tag names are lower-sensitivity metadata (e.g., "work", "personal"). Encrypting them would break server-side tag deduplication, require all tag filtering to move client-side, and significantly complicate the tag sync logic. Deferred to a future phase.

**UX messaging for unencrypted tags:** The UI must explicitly communicate that tag names are not encrypted. During passphrase setup or in settings, include a note: "Your note titles and content are encrypted. Tag names are not encrypted in this version." This prevents users from assuming tags like "medical" or "therapy" are private when they aren't.

**Encrypted payload structure:**

```json
{
  "title": "My note title",
  "content": "<p>HTML content from Tiptap...</p>"
}
```

This JSON is stringified, then encrypted as a single blob.

---

### Decision 6: No recovery codes in v1

**Choice:** "Your passphrase is your only key." No recovery mechanism.

**Rationale:** Every recovery mechanism is a potential attack surface and UX confusion point. Keeping the security model dead simple makes it easier to explain, easier to implement, and harder to get wrong. The messaging is honest: "We cannot recover your notes if you forget your passphrase."

**Future path:** Recovery codes (12-word BIP-39 style seed phrases) can be added later if users request them. This would not compromise zero-knowledge — the server never sees the recovery code.

**Risk:** Users who forget their passphrase lose all data. Mitigated by clear warnings during setup and a confirmation checkbox.

---

### Decision 7: Sharing disabled for v1 E2EE

**Choice:** "Share as Letter" is disabled when E2EE is active. Re-enabled in a later phase with a per-share key envelope design.

**Rationale:** The v2.0 doc's sharing design was internally inconsistent — it described the recipient needing the user's passphrase in one place and a URL-fragment key in another, without defining a per-share key lifecycle or revocation model. Rather than ship a half-designed sharing system, disable it cleanly for v1.

**Future path:** Implement per-share random key envelope: generate a one-time key per share, encrypt the note snapshot with that key, embed the key in the URL fragment. The account passphrase is never exposed. Revocation = delete the share record (server-side). This is a self-contained feature that can be designed and shipped independently.

**Migration note:** Existing share links created before E2EE rollout will stop working if the note's plaintext is scrubbed. The migration process must expire all active shares before encrypting notes.

---

### Decision 8: Additive database schema (not column overwrite)

**Choice:** Add new columns (`encrypted_payload`, `encryption_iv`, `encryption_version`, `content_hash`) rather than overwriting existing `title`/`content` columns with ciphertext.

**Rationale:** Overwriting plaintext columns with ciphertext (the v3.0 approach) is brittle — it breaks existing queries, views, and RLS policies that expect plaintext, and removes the rollback path. An additive schema allows dual-read during migration (read from `encrypted_payload` if present, fall back to `title`/`content`), keeps rollback safe, and makes the transition gradual.

**Migration sequence:**
1. Deploy additive schema (new columns, old columns untouched)
2. Client writes to both old and new columns (dual-write)
3. Per-user migration encrypts existing notes into `encrypted_payload`
4. After verified migration, plaintext columns are nulled out per-note
5. After all users migrated, a cleanup migration drops plaintext columns

---

### Decision 9: Key-check blob for passphrase verification

**Choice:** Store a "key-check" blob in `user_metadata` alongside the salt. This allows verifying the passphrase is correct without storing the key.

**Rationale:** When a user enters their passphrase to unlock, the app needs to verify it's correct before attempting to decrypt notes (otherwise, decryption failures on every note are confusing). The standard approach: during setup, encrypt a known sentinel value (e.g., the string `"yidhan-key-check"`) with the derived key. Store the ciphertext. On unlock, derive the key and attempt to decrypt the sentinel. If it succeeds, the passphrase is correct.

**Storage (v1, in user_metadata):**

```json
{
  "encryption_salt": "base64...",
  "encryption_key_check": "base64...",
  "encryption_key_check_iv": "base64...",
  "encryption_version": 1
}
```

**Future path:** Move to a dedicated `user_encryption_state` table with immutable salt, KDF params, key-check blob, and strict RLS update rules. This provides better auditability and prevents accidental mutation. Deferred because `user_metadata` is sufficient for v1.

---

## Server-Side Changes Required

### Welcome Note Trigger

**Current state:** The database trigger at `supabase/migrations/create_welcome_note_trigger.sql` inserts a plaintext welcome note (`title: "Welcome to Yidhan!"`, `content: "<h2>Your calm space..."`) when a new user signs up. This is a server-side operation.

**Problem:** With E2EE, the server cannot create encrypted content because it doesn't have the encryption key. A plaintext welcome note would also violate zero-knowledge.

**Required change:** Remove or disable the DB trigger. Create the welcome note client-side after the user completes passphrase setup. The welcome note is encrypted like any other note.

### Stale Client Risk

**Context:** Yidhan is a Vercel-deployed SPA — there are no app store versions or native builds that lag behind. Users always get the latest build on next page load.

**Risk:** A user may have a stale browser tab open with the pre-E2EE version. If they save a note from that tab after E2EE is enabled for their account, it could write plaintext to the `title`/`content` columns.

**Mitigation:** The additive schema (Decision 8) helps — old clients write to `title`/`content` as before, while new clients write to `encrypted_payload`. The migration process handles the transition. **After a user's migration is complete, an RLS policy must reject any writes with non-null `title`/`content` columns for that user.** This is a hard requirement, not optional — it closes the stale-tab attack vector permanently.

### Shared Note Public Access Policy

**Current state:** `supabase/migrations/add_shared_note_public_access.sql` allows unauthenticated users to read notes with valid share tokens. This reads plaintext `title`/`content`.

**Required change:** With sharing disabled for v1 E2EE, this policy can remain but is effectively unused for encrypted notes. When sharing is re-enabled (per-share key envelope), this policy will serve encrypted payloads that the client decrypts using the key from the URL fragment. No policy change needed now, but the implementation plan should note it.

---

## Offline DB (Dexie) Migration

**Current state:** The IndexedDB schema (`src/lib/offlineDb.ts`) stores `title: string` and `content: string` as plaintext in `LocalNote`. The sync queue (`SyncQueueEntry`) stores plaintext payloads.

**Required changes for E2EE:**

1. **Dexie schema migration (v4):** Add `encrypted_payload`, `encryption_iv`, `content_hash` fields to `LocalNote`. Keep `title`/`content` for backward compatibility during migration.

2. **Queue drain strategy:** Before enabling E2EE for a user, drain all pending sync queue entries. Plaintext operations must complete before switching to encrypted mode. If entries fail to sync, warn the user and block E2EE activation until the queue is clear.

3. **LocalNote format change:** After E2EE is enabled, new notes are stored in IndexedDB with `encrypted_payload` populated and `title`/`content` set to empty strings. Decryption happens on read (when rendering the note card or opening the editor).

4. **Conflict record format:** Conflict records store `localVersion` and `serverVersion` as `unknown`. With E2EE, these will contain encrypted payloads. The conflict resolution UI (`ConflictModal.tsx`) must decrypt both versions client-side before presenting the "Two Paths" choice.

---

## Proposed UX for Full E2EE

### First-Time Setup (After Signup or First OAuth Login)

```
+-------------------------------------------------------------+
|                                                              |
|               Secure Your Thoughts                           |
|                                                              |
|  Your notes will be encrypted with a passphrase only you     |
|  know. Not even Yidhan can read them.                        |
|                                                              |
|  +--------------------------------------------------------+  |
|  |  Encryption Passphrase: [................]              |  |
|  +--------------------------------------------------------+  |
|  +--------------------------------------------------------+  |
|  |  Confirm Passphrase:    [................]              |  |
|  +--------------------------------------------------------+  |
|                                                              |
|  This passphrase cannot be recovered. If you forget it,      |
|  your notes are permanently lost.                            |
|                                                              |
|  Note: Your tag names are not encrypted in this version.     |
|                                                              |
|  [ ] I understand and accept this responsibility             |
|                                                              |
|                   [ Begin Writing ]                           |
|                                                              |
+-------------------------------------------------------------+
```

### Unlock Flow (Returning User)

```
+-------------------------------------------------------------+
|                                                              |
|               Unlock Your Notes                              |
|                                                              |
|  Enter your encryption passphrase to access your notes.      |
|                                                              |
|  +--------------------------------------------------------+  |
|  |  Encryption Passphrase: [................]              |  |
|  +--------------------------------------------------------+  |
|                                                              |
|  [ ] Remember on this device (use biometrics)                |
|                                                              |
|                       [ Unlock ]                             |
|                                                              |
+-------------------------------------------------------------+
```

### Search (Client-Side Only)

```
+-------------------------------------------------------------+
|  Search notes...                                    [Cmd+K]  |
|  ---------------------------------------------------------- |
|  Searching locally (your notes never leave your device)      |
+-------------------------------------------------------------+
```

---

## Technical Implementation

### Argon2id Key Derivation (via WASM)

```typescript
import { argon2id } from 'hash-wasm'; // ~50KB WASM, lazy-loaded

interface DerivedKeys {
  encryptionKey: CryptoKey;  // For AES-GCM encryption
  hashKey: CryptoKey;        // For HMAC-SHA-256 content hashing
  salt: Uint8Array;
}

// Derive encryption key + hash key from passphrase using Argon2id
async function deriveKeys(
  passphrase: string,
  salt?: Uint8Array
): Promise<DerivedKeys> {
  const keySalt = salt ?? crypto.getRandomValues(new Uint8Array(16));

  // Derive 64 bytes: first 32 for encryption, last 32 for HMAC
  const rawKey = await argon2id({
    password: passphrase,
    salt: keySalt,
    parallelism: 1,
    iterations: 3,
    memorySize: 65536, // 64MB
    hashLength: 64,    // 512 bits (split into two 256-bit keys)
    outputType: 'binary',
  });

  const encKeyBytes = rawKey.slice(0, 32);
  const hashKeyBytes = rawKey.slice(32, 64);

  const encryptionKey = await crypto.subtle.importKey(
    'raw', encKeyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
  );

  const hashKey = await crypto.subtle.importKey(
    'raw', hashKeyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );

  return { encryptionKey, hashKey, salt: keySalt };
}
```

### AES-256-GCM Encryption/Decryption (with AAD)

```typescript
interface EncryptedPayload {
  ciphertext: string; // base64
  iv: string;         // base64
}

// Encrypt title + content as a single payload with AAD binding
async function encryptNote(
  noteId: string,
  userId: string,
  title: string,
  content: string,
  encryptionKey: CryptoKey,
  hashKey: CryptoKey
): Promise<{ encrypted: EncryptedPayload; contentHash: string }> {
  const payload = JSON.stringify({ title, content });
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // AAD binds ciphertext to this specific note and user,
  // preventing ciphertext swapping/replay within account scope
  const aad = new TextEncoder().encode(`${noteId}:${userId}`);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad },
    encryptionKey,
    new TextEncoder().encode(payload)
  );

  // Compute HMAC-SHA-256 hash for conflict detection (keyed, not raw)
  const hmacBuffer = await crypto.subtle.sign(
    'HMAC',
    hashKey,
    new TextEncoder().encode(payload)
  );
  const contentHash = arrayToBase64(hmacBuffer);

  return {
    encrypted: {
      ciphertext: arrayToBase64(ciphertext),
      iv: arrayToBase64(iv),
    },
    contentHash,
  };
}

// Decrypt note payload back to title + content
async function decryptNote(
  noteId: string,
  userId: string,
  encrypted: EncryptedPayload,
  encryptionKey: CryptoKey
): Promise<{ title: string; content: string }> {
  const aad = new TextEncoder().encode(`${noteId}:${userId}`);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToArray(encrypted.iv), additionalData: aad },
    encryptionKey,
    base64ToArray(encrypted.ciphertext)
  );

  return JSON.parse(new TextDecoder().decode(decrypted));
}
```

### Database Changes (Additive Schema)

```sql
-- Phase 1: Add encryption columns (plaintext columns untouched)
ALTER TABLE notes ADD COLUMN encrypted_payload text;   -- base64 ciphertext
ALTER TABLE notes ADD COLUMN encryption_iv text;        -- base64 IV
ALTER TABLE notes ADD COLUMN encryption_version integer; -- schema version (1 = Argon2id + AES-GCM)
ALTER TABLE notes ADD COLUMN content_hash text;          -- HMAC-SHA-256 for conflict detection

-- Index for conflict detection
CREATE INDEX idx_notes_content_hash ON notes (content_hash);

-- Phase 2 (after all users migrated): Drop plaintext columns
-- ALTER TABLE notes DROP COLUMN title;
-- ALTER TABLE notes DROP COLUMN content;
-- (Only run after verified migration of all users)

-- User encryption state stored in user_metadata:
-- {
--   "encryption_salt": "base64...",
--   "encryption_key_check": "base64...",
--   "encryption_key_check_iv": "base64...",
--   "encryption_version": 1
-- }
```

### Key-Check Blob (Passphrase Verification)

```typescript
const KEY_CHECK_SENTINEL = 'yidhan-key-check-v1';

// During passphrase setup: create key-check blob
async function createKeyCheck(encryptionKey: CryptoKey): Promise<{
  keyCheck: string;
  keyCheckIv: string;
}> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    encryptionKey,
    new TextEncoder().encode(KEY_CHECK_SENTINEL)
  );
  return {
    keyCheck: arrayToBase64(ciphertext),
    keyCheckIv: arrayToBase64(iv),
  };
}

// During unlock: verify passphrase by decrypting key-check blob
async function verifyPassphrase(
  encryptionKey: CryptoKey,
  keyCheck: string,
  keyCheckIv: string
): Promise<boolean> {
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToArray(keyCheckIv) },
      encryptionKey,
      base64ToArray(keyCheck)
    );
    return new TextDecoder().decode(decrypted) === KEY_CHECK_SENTINEL;
  } catch {
    return false; // Wrong passphrase — decryption fails
  }
}
```

### New Files to Create

```
src/
+-- utils/
|   +-- encryption.ts        # Argon2id key derivation + AES-GCM encrypt/decrypt + HMAC + key-check
+-- hooks/
|   +-- useEncryption.ts     # React hook for encryption state (keys in memory, unlock flow)
+-- components/
|   +-- PassphraseSetup.tsx  # Onboarding modal for setting encryption passphrase
|   +-- PassphraseUnlock.tsx # Unlock modal for returning users
```

---

## Key Design Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| **Passphrase model** | One passphrase for all users (email + OAuth) | Simplest architecture, one code path, reinforces privacy brand |
| **Key derivation** | Argon2id via WASM | GPU-resistant, modern standard, ~50KB lazy-loaded |
| **What to encrypt** | Title + content bundled as JSON blob | True zero-knowledge for content; single encrypt/decrypt op |
| **AES-GCM AAD** | Bind ciphertext to `note_id` + `user_id` | Prevents ciphertext swapping/replay within account |
| **Conflict detection** | HMAC-SHA-256 with derived hash key | Keyed hash prevents dictionary attacks; safe for conflict detection |
| **Schema strategy** | Additive (new columns, keep plaintext during migration) | Safe rollback path, dual-read during transition |
| **Tag encryption** | Deferred (with explicit UI messaging) | Complexity cost too high for v1; users informed tags are not encrypted |
| **Sharing** | Disabled for v1 E2EE | Sharing design was under-specified; disable cleanly, redesign later |
| **Key hierarchy** | Deferred | Direct derivation for v1; no password change support yet |
| **Recovery codes** | Deferred | Keep security model simple and honest for v1 |
| **Passphrase storage** | Memory only (re-enter after page refresh) | More secure; consider biometric unlock on Capacitor later |
| **Key-check blob** | Encrypted sentinel in user_metadata | Verify passphrase correctness without storing key |
| **Welcome note** | Client-side creation after passphrase setup | Server trigger writes plaintext; must be replaced |
| **Passphrase hint** | Optional (user's choice) | Low-risk UX convenience |

---

## Implementation Phases (Revised)

The rollout is structured so each phase is independently shippable and testable. Sharing is disabled in Phase 1 (before any encryption logic ships) to ensure no interim state where encrypted notes coexist with active share links.

### Phase 1: Core Encryption + Additive Schema (3-4 weeks)

| Task | Estimate |
|------|----------|
| Argon2id WASM integration + dual-key derivation (encryption + HMAC) | 3-4 days |
| AES-GCM encrypt/decrypt with AAD + HMAC-SHA-256 hashing | 3-4 days |
| Key-check blob creation and verification | 1-2 days |
| Database additive schema migration | 1-2 days |
| Disable welcome note DB trigger | 0.5 days |
| Disable "Share as Letter" UI (must ship before encryption goes live) | 1-2 days |
| PassphraseSetup + PassphraseUnlock components | 4-5 days |
| Integration with AuthContext (OAuth + email flows) | 3-4 days |

### Phase 2: Sync Engine Rework + Offline DB (4-5 weeks)

| Task | Estimate |
|------|----------|
| Dexie schema v4 migration (add encrypted fields) | 2-3 days |
| Queue drain/freeze logic before E2EE activation | 2-3 days |
| Encrypt before sync queue push, decrypt after pull | 5-7 days |
| Replace plaintext conflict detection with HMAC hash comparison | 3-4 days |
| Conflict modal: decrypt both versions client-side | 2-3 days |
| Realtime subscription handling with encrypted payloads | 2-3 days |
| Client-side welcome note creation | 1 day |

### Phase 3: Client-Side Search + Share Link Cleanup (2-3 weeks)

| Task | Estimate |
|------|----------|
| Client-side search implementation (decrypt + search in memory) | 5-7 days |
| Expire existing share links during migration | 1-2 days |

### Phase 4: Existing User Migration (3-4 weeks)

| Task | Estimate |
|------|----------|
| Migration UI ("A New Layer of Privacy" modal) | 2-3 days |
| Per-note migration with verification + checkpoints | 4-5 days |
| Stale-tab protection (reject plaintext writes post-migration) | 2-3 days |
| Security testing, edge cases, cross-device testing | 5-7 days |
| Documentation and user communication | 2-3 days |

**Total: ~12-16 weeks**

---

## Migration Strategy for Existing Users (Revised)

### Migration UI

```
+-------------------------------------------------------------+
|                  A New Layer of Privacy                       |
|                                                              |
|  Yidhan now encrypts all your notes. To continue, set an     |
|  encryption passphrase that only you will know.              |
|                                                              |
|  Your existing notes will be encrypted with this             |
|  passphrase. This is a one-time process.                     |
|                                                              |
|  [ Set Up Encryption ]  or  [ Export & Delete Account ]      |
|                                                              |
+-------------------------------------------------------------+
```

### Migration Process (Per-Note Verification)

```
For each note (in batches of 10-20):
  1. Read plaintext title + content from server
  2. Encrypt with AES-GCM + AAD, compute HMAC hash
  3. Write encrypted_payload, encryption_iv, content_hash, encryption_version=1
  4. Verify: read back encrypted_payload, decrypt, confirm matches original
  5. If verified: set migrated_at timestamp, null out title/content columns
  6. If verification fails: log error, skip note, continue with next batch
  7. Update progress bar in migration UI

After all notes verified:
  - Expire all active share links (sharing disabled for v1)
  - Mark user as fully migrated in user_metadata
  - Enable stale-tab protection (reject plaintext writes)
```

**Checkpoint/resume:** If the migration is interrupted (tab crash, network failure), it resumes from the last `migrated_at` checkpoint. Notes already migrated are not re-processed. The migration is idempotent.

**Rollback:** If migration fails catastrophically, plaintext is preserved in original columns (additive schema ensures old data is untouched until explicitly nulled after verification).

---

## Security Considerations

### Strengths
- AES-256-GCM is industry standard symmetric encryption
- AAD binding (`note_id` + `user_id`) prevents ciphertext swapping within account
- Argon2id is the current OWASP recommendation for password-based key derivation
- Argon2id's memory-hardness makes GPU/ASIC brute force dramatically more expensive
- HMAC-SHA-256 (keyed) prevents dictionary attacks on content hashes
- Keys never leave the client
- Key-check blob verifies passphrase without storing key material
- Additive schema preserves rollback path during migration

### Limitations
- Browser environment (Web Crypto + WASM) is less secure than native
- Key cached in memory could be extracted via browser devtools
- No protection against keyloggers or compromised devices
- Passphrase strength depends on user
- No passphrase change support in v1 (key hierarchy deferred)
- No recovery mechanism in v1 (passphrase lost = data lost)
- Tag names remain unencrypted (deferred; users explicitly informed)

### Mitigations
- Auto-lock after inactivity (leverages existing session timeout infrastructure)
- Clear keys from memory on logout
- Warn users about passphrase strength during setup
- Biometric unlock on native (Capacitor) apps as a future enhancement
- Clear, honest messaging: "Your passphrase is your only key"
- UI disclosure: "Tag names are not encrypted in this version"

---

## Deferred Features (Future Phases)

| Feature | Why Deferred | When to Revisit |
|---------|-------------|-----------------|
| **Key hierarchy** | Complexity; no password change needed yet | When users request passphrase changes |
| **Tag encryption** | Breaks server-side dedup and filtering | After client-side tag management is solid |
| **Recovery codes** | Keep v1 security model simple | If users report data loss from forgotten passphrases |
| **Share as Letter (encrypted)** | Per-share key envelope design needed | After v1 E2EE is stable; self-contained feature |
| **Biometric unlock** | Capacitor-specific, needs SecureEnclave | When native app usage grows |
| **Hardware key support** | WebAuthn/FIDO2 doesn't provide key material for encryption | When passkey ecosystem matures |
| **Multiple passphrases** | Unnecessary complexity for personal notes | Likely never |
| **Dedicated encryption state table** | `user_metadata` is sufficient for v1 | When auditability / immutability is needed |

---

## Alternatives Considered

### Notion Approach (No E2EE)
Server-side encryption only. Does not meet zero-knowledge requirement.

### Bear Approach (Optional Per-Note E2EE)
Hybrid approach where users choose which notes to encrypt. Simpler (~3-4 weeks) but doesn't provide full zero-knowledge since unencrypted notes are still visible to developer.

### Standard Notes Approach (Full E2EE) — CHOSEN
Full E2EE with all notes encrypted by default. Meets zero-knowledge requirement. This is the model Yidhan follows.

### Signal Protocol
Designed for messaging with forward secrecy. Overkill for single-user notes and adds unnecessary complexity.

### age Encryption
Modern, simple encryption tool. However, no native browser implementation — would require WASM bundle (~200KB+).

### Themis Library (Bear's Choice)
Mature, audited library used by Bear. Could be an alternative to Web Crypto API but adds ~50KB dependency and is less widely known than Argon2id.

### PBKDF2 (v2.0 Recommendation)
Built into Web Crypto API (zero bundle cost) but vulnerable to GPU-based brute force. Replaced by Argon2id in v3.0 for stronger security guarantees.

---

## Open Questions

*These are intentionally left for the implementation plan (`docs/plans/`), not this analysis doc.*

1. Should encrypted notes be exported decrypted (requires passphrase) or as encrypted blobs?
2. What happens to notes during account offboarding ("Letting Go") — decrypt and export, or delete encrypted?
3. How should the "memory only" key storage interact with the existing session timeout feature?
4. Should the demo mode (/demo) be affected by encryption? (Likely no — demo uses localStorage, no auth)
5. What Argon2id WASM library to use? (`hash-wasm` ~50KB vs `argon2-browser` ~100KB)
6. Concrete test matrix for encryption: tamper detection, replay, wrong passphrase, interrupted migration, multi-tab, cross-device conflict scenarios. *(Deferred to implementation plan per review)*

---

## Next Steps

When ready to implement:

1. Create detailed implementation plan in `docs/plans/`
2. Prototype Argon2id WASM integration (validate bundle size and performance)
3. Design the passphrase setup/unlock UI (align with Yidhan's wabi-sabi aesthetic)
4. Plan the sync engine rework (largest engineering effort)
5. Design the existing user migration flow (must be idempotent and resumable)
6. Define test matrix for crypto operations
7. Implement in phases (crypto utilities -> onboarding UI -> sync engine -> search -> migration)

---

## References

### Technical References
- [Web Crypto API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [Argon2 (OWASP Password Storage Cheat Sheet)](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#argon2id)
- [Standard Notes Encryption Whitepaper](https://standardnotes.com/help/security/encryption)
- [Standard Notes Security Updates](https://standardnotes.com/help/security)
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [hash-wasm (Argon2id WASM)](https://github.com/nicolo-ribaudo/nicolo-nicolo/nicolo)

### Competitive Analysis Sources
- [Notion Security Practices](https://www.notion.com/help/security-and-privacy)
- [Notion Privacy Practices](https://www.notion.com/help/privacy)
- [Bear Encryption Blog Post](https://blog.bear.app/2023/10/encryption-bear-and-your-private-data/)
- [Bear 2.4 Update (May 2025)](https://blog.bear.app/2025/05/bear-2-4-update-better-encryption-smarter-todo-and-more/)
- [Bear Encryption Roadmap 2025](https://community.bear.app/t/bear-s-encryption-roadmap-for-2025/15401)
- [Cossack Labs: E2EE in Bear](https://www.cossacklabs.com/case-studies/bear/)
- [Themis Library Implementation](https://www.cossacklabs.com/blog/end-to-end-encryption-in-bear-app/)

### Additional Reading
- [Zero-Knowledge Encryption Guide (Hivenet)](https://www.hivenet.com/post/zero-knowledge-encryption-the-ultimate-guide-to-unbreakable-data-security)
- [Bitwarden: E2EE and Zero Knowledge](https://bitwarden.com/blog/end-to-end-encryption-and-zero-knowledge/)

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12 | Initial analysis with three approaches |
| 2.0 | 2026-01-10 | Added competitive analysis (Notion, Bear, Standard Notes). Revised recommendation from Option 2 to Option 3 after zero-knowledge requirement. Added UX mockups and effort breakdown. |
| 3.0 | 2026-02-21 | Fresh review and decisions. Fixed internal contradictions (Option 2 artifacts in Option 3 sections). Replaced PBKDF2 with Argon2id. Added SHA-256 content hash for conflict detection. Clarified passphrase model for OAuth users. Added deferred features table. Revised effort estimate from 6-8 weeks to 12-16 weeks. Updated naming from Zenote to Yidhan. |
| 3.1 | 2026-02-21 | Codex (gpt-5.3-codex) peer review round 1. SHA-256 upgraded to HMAC-SHA-256 (keyed). Added AAD binding for AES-GCM. Changed to additive schema strategy. Disabled sharing for v1. Added welcome note trigger replacement. Added key-check blob. Added Dexie migration section. Added per-note verified migration with checkpoints. Added stale-tab risk mitigation. Added UI messaging for unencrypted tags. |
| 3.2 | 2026-02-21 | Codex round 2 (3 findings). Made plaintext-write rejection a hard RLS requirement post-migration. Fixed key derivation text to match code (split single output, not separate salts). Moved sharing disable to Phase 1 (before encryption goes live). |

---

*This analysis is ready for implementation planning. Next step: create a detailed implementation plan in `docs/plans/`.*
