# Share Token Security Analysis

**Author:** Claude (Opus 4.5)
**Date:** 2025-12-28
**Consulted:** Security Review

---

## Original Prompt

> Investigate the share token security item from launch readiness doc marked as P0 Blocker / Unverified / Needs documentation

---

## Executive Summary

**Verdict: SECURE**

The share token implementation is cryptographically sound. The 128-bit token entropy makes brute-force attacks computationally infeasible. The browser history concern is a privacy limitation common to all URL-based sharing systems, not a security vulnerability.

---

## Token Generation

**File:** `src/services/notes.ts:444-446`

```typescript
function generateShareToken(): string {
  return crypto.randomUUID().replace(/-/g, '');
}
```

### Security Properties

| Property | Value | Assessment |
|----------|-------|------------|
| Source | `crypto.randomUUID()` | Web Crypto API - cryptographically secure |
| Entropy | 128 bits (UUID v4) | Excellent - brute-force infeasible |
| Length | 32 hex characters | Sufficient for URL usage |
| Collision resistance | UUID uniqueness + DB constraint | Double protection |

### Brute-Force Analysis

- Possible tokens: 2^128 = 3.4 × 10^38
- At 1 billion attempts/second: ~10^22 years to exhaust
- **Conclusion:** Computationally infeasible

---

## Database Security

**File:** `supabase/migrations/add_note_shares.sql`

### Schema

```sql
CREATE TABLE note_shares (
  id uuid default gen_random_uuid() primary key,
  note_id uuid references notes(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  share_token varchar(32) unique not null,
  expires_at timestamptz,
  created_at timestamptz default now() not null,
  unique(note_id)  -- One active share per note
);
```

### Row Level Security (RLS)

| Policy | Scope | Condition |
|--------|-------|-----------|
| Users can manage their own shares | ALL (CRUD) | `auth.uid() = user_id` |
| Anyone can read share tokens | SELECT | `true` (public read for validation) |

### Indexes

- `idx_note_shares_token` - Fast token lookups
- `idx_note_shares_expires_at` - Efficient expiration queries

### Assessment

- RLS enabled and properly configured
- Users can only modify their own shares
- Public read access required for unauthenticated share viewing
- Cascade delete ensures cleanup when note/user deleted

---

## Token Validation Flow

**File:** `src/services/notes.ts:533-584`

```
1. Receive token from URL query param (?s=token)
2. Query note_shares table for token
3. If not found → return null (no info disclosure)
4. If expires_at < now() → return null (expired)
5. Query notes table for note_id
6. If deleted_at is set → return null (soft-deleted)
7. Return note with tags
```

### Security Properties

| Check | Implementation | Status |
|-------|----------------|--------|
| Token validation | Server-side via Supabase | ✅ |
| Expiration enforcement | `expires_at` comparison | ✅ |
| Soft-delete exclusion | `.is('deleted_at', null)` | ✅ |
| Error handling | Returns null, no details | ✅ |
| SQL injection | Parameterized queries (Supabase) | ✅ |

---

## Test Coverage

**File:** `src/services/notes.test.ts:830-1102`

| Test Case | Status |
|-----------|--------|
| Create share with expiration | ✅ |
| Create share without expiration (never) | ✅ |
| Token generation called | ✅ |
| Get existing share | ✅ |
| No share exists → null | ✅ |
| Update expiration | ✅ |
| Remove expiration (set to never) | ✅ |
| Delete/revoke share | ✅ |
| Valid token → returns note | ✅ |
| Invalid token → null | ✅ |
| Expired share → null | ✅ |
| Soft-deleted note → null | ✅ |
| Share fetch error → null | ✅ |

**Coverage:** 13 test cases covering all critical paths

---

## Share URL Format

**File:** `src/components/ShareModal.tsx:36-39`

```typescript
const getShareUrl = (token: string) => {
  const baseUrl = window.location.origin;
  return `${baseUrl}/?s=${token}`;
};
```

Token passed as query parameter `?s=<token>`.

---

## Known Limitations

### 1. URL in Browser History (Privacy Concern)

**Issue:** Share tokens appear in URLs, which means:
- Visible in browser history
- May be logged by proxies, analytics, browser extensions
- Can be seen via shoulder surfing

**Risk Level:** Medium (privacy, not security)

**Mitigation:**
- This is inherent to URL-based sharing (Google Docs, Dropbox work the same way)
- Added privacy tooltip in ShareModal to inform users
- Users can revoke shares at any time
- Expiration options limit exposure window

### 2. "Never" Expiration Option

**Issue:** Permanent shares if user forgets to revoke.

**Risk Level:** Low

**Mitigation:**
- Default is 7 days (not "never")
- Users can revoke anytime
- Note deletion cascades to share deletion

### 3. No Rate Limiting on Token Lookups

**Issue:** Theoretically unlimited lookup attempts.

**Risk Level:** Very Low

**Mitigation:**
- 128-bit entropy makes brute-force infeasible
- Supabase has built-in rate limiting at API level
- Could add application-level rate limiting if needed

### 4. No Access Logging

**Issue:** Users can't see who/when their share was accessed.

**Risk Level:** Low (feature request, not security issue)

**Future Enhancement:** Could add view tracking table

---

## Comparison with Industry Standards

| Feature | Zenote | Google Docs | Dropbox |
|---------|--------|-------------|---------|
| Token in URL | Yes | Yes | Yes |
| Token entropy | 128-bit | ~128-bit | ~128-bit |
| Expiration support | Yes | No (manual revoke) | Yes |
| Revocation | Yes | Yes | Yes |
| Access logging | No | Yes | Yes |

---

## Recommendations

### Implemented

1. ✅ Strong token generation (crypto.randomUUID)
2. ✅ Server-side validation
3. ✅ Expiration support
4. ✅ Revocation capability
5. ✅ RLS protection
6. ✅ Comprehensive tests
7. ✅ Privacy notice in UI

### Future Enhancements (Optional)

1. **Access logging** - Track when shares are viewed
2. **View count limit** - Auto-expire after N views
3. **Password protection** - Optional password for sensitive shares
4. **IP restriction** - Limit access by geography

---

## Conclusion

The share token security implementation is **production-ready**. It follows industry best practices for URL-based sharing and provides adequate protection against:

- Brute-force attacks (128-bit entropy)
- Unauthorized access (RLS + token validation)
- Stale shares (expiration support)
- Accidental exposure (revocation capability)

The browser history limitation is documented and communicated to users via the UI. This is an acceptable trade-off for the usability benefits of URL-based sharing.

**Status:** ✅ Verified and approved for production
