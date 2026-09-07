# Auth Comparison: Supabase vs Custom JWT

**Version:** 1.0
**Last Updated:** 2026-01-13
**Status:** Complete
**Author:** Claude (Opus 4.5)

---

## Original Prompt

> Why did we implement Supabase auth vs custom solution like what was done for Quinthesis?

---

## Overview

This analysis compares Yidhan's Supabase-managed authentication with Quinthesis's custom JWT implementation to explain the architectural decision.

## Comparison Table

| Aspect | Yidhan (Supabase) | Quinthesis (Custom) |
|--------|-------------------|---------------------|
| **Implementation** | Managed service | Custom FastAPI + PyJWT |
| **Code to maintain** | ~50 lines (AuthContext) | ~500+ lines (routes, middleware, token mgmt) |
| **OAuth setup** | Supabase dashboard config | Manual OAuth flows with PKCE/state |
| **Token storage** | Supabase handles it | localStorage + custom refresh logic |
| **Session management** | Automatic (Supabase SDK) | Manual (refresh token rotation) |
| **Password reset** | Built-in email flow | Would need to build |
| **Rate limiting** | Built-in | Manual implementation |
| **Multi-instance** | Works out of box | In-memory state = single instance limitation |

## Why Supabase for Yidhan?

### The Key Difference: Backend Architecture

- **Quinthesis** has a Python/FastAPI backend → custom auth makes sense because server-side logic is already being managed
- **Yidhan** is a frontend-only app → Supabase provides both database AND auth, eliminating the need for a custom backend entirely

### Reasons for Supabase in Yidhan

1. **No backend needed** - Yidhan is React + Supabase only. Custom auth would require spinning up a server.

2. **Speed to market** - Auth, database, real-time sync, and RLS all from one service. Built the MVP much faster.

3. **Security out of the box** - Password hashing, token rotation, session management all handled.

4. **Row Level Security** - Notes are secured at the database level with `user_id = auth.uid()` policies.

### When Custom Auth (like Quinthesis) Makes Sense

1. **You already have a backend** - Quinthesis needs FastAPI for AI orchestration anyway
2. **Complex auth requirements** - Custom token claims, API key management, specialized flows
3. **Cost control** - Supabase charges for MAUs at scale; custom is "free" compute
4. **Full control** - No vendor lock-in, can switch providers easily

## Quinthesis Custom Auth Architecture

### Technologies Used

**Backend (Python/FastAPI):**
- `PyJWT` - JWT token creation and verification
- `httpx` - Async HTTP client for OAuth provider communication
- `cryptography` (Fernet) - API key encryption

**Frontend (React):**
- Browser `localStorage` - Token persistence
- Custom `fetchWithAuth` wrapper with automatic token refresh

**Database:**
- PostgreSQL (Supabase) - User data persistence (note: uses Supabase for DB, but custom auth)

### Token Configuration

- **Algorithm:** HS256 (HMAC with SHA-256)
- **Access Token:** 60 minutes expiry
- **Refresh Token:** 7 days expiry

### OAuth Providers

1. **Google OAuth 2.0** - With PKCE (S256 method)
2. **GitHub OAuth 2.0** - With state parameter (CSRF protection)

### Security Features

- PKCE for Google (prevents authorization code interception)
- State tokens with 10-minute TTL
- Rate limiting: 30 requests/minute per IP
- Email-based account linking (prevents duplicate accounts)

## Yidhan Supabase Auth Architecture

### Technologies Used

- `@supabase/supabase-js` - Official Supabase client
- React Context (`AuthContext.tsx`) - State management

### Features Used

- Email/password authentication
- Google OAuth
- GitHub OAuth
- Password reset via email
- Session persistence (automatic)
- Real-time auth state changes

### Security Features

- Row Level Security (RLS) policies
- Automatic token refresh
- Secure session storage
- Built-in rate limiting

## Summary

| App | Backend | Auth Choice | Why |
|-----|---------|-------------|-----|
| **Yidhan** | None (frontend only) | Supabase | All-in-one: auth + DB + realtime |
| **Quinthesis** | FastAPI | Custom JWT | Already have server, need API key encryption, full control |

## Conclusion

The choice between managed auth (Supabase) and custom auth depends primarily on:

1. **Whether you already have a backend** - If yes, custom auth adds minimal complexity
2. **Time constraints** - Managed auth is significantly faster to implement
3. **Scale considerations** - Custom auth can be more cost-effective at high MAU counts
4. **Special requirements** - API key management, custom token claims, etc. favor custom solutions

For Yidhan, Supabase was the right choice because it eliminated the need for a backend entirely while providing auth, database, and real-time features in one package.
