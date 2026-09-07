# Outbound data

Every request Yidhan makes, and every field it can carry. Item 40.

The point of this document is that "we encrypt your notes" is only true if nothing
carries them out through a side door. So this is an inventory, not a summary: if a
request type is not listed here, it should not exist, and if a field is not listed
against a request, sending it is a regression.

Verified against the code on 2026-09-07. The scrubber behaviour described here is
covered by `src/utils/sentryScrubber.test.ts`; if you change a field list, change the
test in the same commit.

---

## Where requests go

Exactly three destinations, and nothing else:

| Destination | Configured by | Reached from |
|---|---|---|
| The Supabase project (Postgres, Auth, Realtime) | `VITE_SUPABASE_URL` | `src/lib/supabase.ts` |
| Sentry | `VITE_SENTRY_DSN` — optional; empty disables it entirely | `src/main.tsx` |
| The origin the app is served from | — | Static assets and the service worker precache |

Fonts are **self-hosted**: `font-src 'self'` in `vercel.json`, subsets in
`src/assets/fonts/`, no Google Fonts request at any point. There is no analytics
provider, no ad network, no CDN for application data, and no third-party embed.

---

## 1 · Supabase — notes

| Request | Fields it carries | Plaintext? |
|---|---|---|
| `notes` INSERT | `id`, `title` (always `''`), `content` (always `''`), `pinned`, `encrypted_payload`, `encryption_iv`, `encryption_version`, `content_hash`, `created_at`, `display_updated_at`, `deleted_at` | Only the metadata: pin state and timestamps |
| `notes` UPDATE | The same encrypted fields, plus `display_updated_at` | As above |
| `notes` UPDATE (soft delete / restore) | `deleted_at` | Timestamp only |
| `notes` UPDATE (pin) | `pinned` | Boolean only |
| `notes` DELETE | `id` | — |
| `notes` SELECT (pull) | — outbound: a cursor timestamp | — |
| `notes` SELECT `id` (reconcile) | — | — |

`title` and `content` are sent as empty strings and the database *requires* them to be
empty (`chk_notes_e2ee_only`, `launch_security_hardening.sql`). The words live only in
`encrypted_payload`, which is AES-256-GCM ciphertext with AAD `noteId:userId`.

**What the server can see about a note it cannot read:** that it exists, who owns it,
when it was created, when it was last changed, whether it is pinned, whether it is
faded, and roughly how long it is. Nothing else.

## 2 · Supabase — tags and membership

| Request | Fields | Plaintext? |
|---|---|---|
| `tags` INSERT | `id`, `name`, `color`, `created_at` | **Yes — tag names are plaintext** |
| `tags` UPDATE | `name`, `color`, `updated_at` | **Yes** |
| `tags` DELETE | `id` | — |
| `tags` SELECT | — outbound: a cursor timestamp | — |
| `note_tags` INSERT / DELETE | `note_id`, `tag_id` | Which note carries which label |
| `note_tags` SELECT | — | — |

**Tag names are not encrypted.** This is a documented, deliberate trade
(`DECISIONS.md`), not an oversight: encrypted tag names cannot be filtered or
autocompleted offline without downloading every tag and decrypting it on every
keystroke. Item 101 encrypts them with AAD `tagId:userId`; until it ships, a tag called
"Therapy" is a plaintext fact about the reader on the server. The `/security` page says
so in as many words.

## 3 · Supabase — shares

| Request | Fields | Plaintext? |
|---|---|---|
| `note_shares` INSERT / UPDATE | `note_id`, `encrypted_payload`, `encryption_iv`, `encryption_version`, `expires_at` | No |
| `note_shares` SELECT `id` | — | — |
| `fetch_shared_note` RPC | `share_token_param` | The token is a capability credential |

The share's decryption key is a fresh random AES-256-GCM key that lives **only in the
URL fragment** (`#k=…`). A fragment is never sent in an HTTP request, so the server
holds ciphertext and no key. `expires_at` is capped at 30 days in the database.

## 4 · Supabase — authentication

| Request | Fields |
|---|---|
| `auth.signUp` | Email, password |
| `auth.signInWithPassword` | Email, password |
| `auth.signInWithOAuth` | Provider name; the redirect happens at the provider |
| `auth.resetPasswordForEmail` | Email |
| `auth.signOut`, `auth.getSession`, `auth.getUser` | The session token |
| `auth.updateUser` | `user_metadata`: `encryption_salt`, `encryption_key_check`, `encryption_key_check_iv`, `encryption_key_check_version`, `encryption_version`, `full_name` |

`encryption_key_check` is a short ciphertext of a fixed sentinel. It proves a
passphrase without carrying anything the reader wrote. The **passphrase itself, the
derived keys and the raw key bytes are never sent anywhere** — not to Supabase, not to
Sentry, not in a URL.

Note that `user_metadata` rides in the JWT, so the salt is visible to anything holding
the token. Item 136 moves it out.

## 5 · Supabase — account deletion

| Request | Fields |
|---|---|
| `request_account_deletion` RPC | An optional confirmation token |
| `cancel_account_deletion` RPC | — |

## 6 · Supabase — realtime

Two channels: `notes-<userId>` and `note-tags-<userId>`. Outbound they carry a
subscription filter and the session token. Inbound rows are the same shapes as §1–§2 —
encrypted payloads and plaintext tag names.

## 7 · Sentry

Only when `VITE_SENTRY_DSN` is set. An empty value disables the SDK entirely, and no
request is made.

`beforeSend` in `src/main.tsx` scrubs, in this order:

| Part of the event | What happens |
|---|---|
| `event.extra` | `scrubSensitiveData` — every key matching the sensitive pattern becomes `[REDACTED]` |
| `event.contexts` | Same |
| `event.request.url` | `scrubShareSecrets` — the fragment is dropped, `/s/<token>` becomes `/s/[REDACTED]` |
| `event.exception.values[].value` | `scrubShareSecrets` |
| Stack frame `filename` and `abs_path` | `scrubShareSecrets` |
| `event.breadcrumbs[].message` | `scrubShareSecrets` |
| `event.breadcrumbs[].data` | `scrubSensitiveData` |

The redacted key pattern is `passphrase|password|token|secret|key|salt|title|content|
encrypted_payload|encryptedPayload|encryptionKey|hmacKey|noteTitle|noteContent`,
case-insensitive, matched against the **key** at every depth.

Two entries are worth explaining:

- `salt` is redacted even though an Argon2id salt is *not* a secret — it is public by
  design and already rides in the JWT. It is a stable per-user identifier, and an error
  report has no use for one. Writing this audit is what noticed it was going out.
- A tag **name** is deliberately not redacted. Tag names are plaintext on the server
  until item 101, and redacting them in telemetry would imply a protection the database
  does not provide.

Session replay is masked (`maskAllText`, `maskAllInputs`) and blocks
`.rich-text-editor`, `.ProseMirror`, `[data-sensitive]` and `.note-card`. On a `/s/`
route the replay integration is **not loaded at all** and both sample rates are 0,
because a shared letter is decrypted in the page and a replay would film it.

**What Sentry can still receive:** the shape of an error, a stack trace, the route
name, the browser and OS, and a user id when one is set. Not note text, not a
passphrase, not a share key.

`reportReliabilityIssue` (`src/utils/reliabilityTelemetry.ts`) is the only place the
app deliberately sends context, and it sends categories and operation names — `sync`,
`vault`, `insert`, `update` — plus a user id. It never takes a note as an argument.

## 8 · The demo and capture paths

| Path | Where it goes |
|---|---|
| Practice Space notes (`yidhan-demo-state`) | `localStorage`. **Never sent anywhere** until the reader signs up, at which point `migrateDemoToAccount` encrypts each note and creates it through the ordinary path. |
| The landing-page draft (`yidhan-demo-content`) | `localStorage`, then the same. |
| Share target (`useShareTarget`) | Held locally and encrypted before any request. The manifest `share_target` entry was **removed** until item 47 lands, so this path is currently reachable only through an existing stored value. |

A practice draft is *not encrypted* — it is plaintext in `localStorage` — and the
Practice Space says so on its own starter note. It is also not on any server.

## 9 · Error strings

Two rules, both already followed and both worth stating so they are not lost:

- **Auth errors are mapped to friendly text** before display, so the app never echoes a
  provider message that distinguishes "no such account" from "wrong password".
- **Postgres error text goes to the console, never to a toast.** The sync indicator
  shows `describeSyncFailure(code)`, a fixed sentence per code. Raw error text can carry
  column values, which for `notes` would be ciphertext but for `tags` would be a tag
  name.

---

## What this does not cover

- **Attachments** (items 32, 33) do not exist yet. When they do, they get rows here.
- **The service worker precache** fetches only same-origin build assets.
- **Vercel** sees request metadata for every page load — IP, user agent, path — as any
  host does. `vercel.json` sets no-store on `/s/*` so a shared letter is not held in a
  shared cache.

## Changing this list

Adding a request type, a field, or a destination means updating this file **and**
`src/utils/sentryScrubber.test.ts` in the same commit, and re-reading the `/security`
page to check it is still true.
