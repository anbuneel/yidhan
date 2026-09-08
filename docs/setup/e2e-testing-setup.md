# E2E Testing Setup

## Overview

Yidhan uses Playwright for end-to-end testing. E2E tests require a dedicated test user account in Supabase.

The suite runs in CI as the `e2e` job (`docs/setup/ci-workflow.md`), so it does not need to
be run by hand before pushing. Run one spec locally when you change the flow it covers.

## Prerequisites

1. A Supabase project with authentication enabled
2. A dedicated test user account (email/password)
3. Node.js and npm installed

## Configuration

### Local Development

Create a `.env.local` file (git-ignored) with your test credentials:

```bash
# E2E Testing credentials
E2E_TEST_EMAIL=your-test-email@example.com
E2E_TEST_PASSWORD=your-secure-password
E2E_TEST_PASSPHRASE=the-test-account-vault-passphrase
```

All three are required together. The account is end-to-end encrypted, so signing
in lands on the vault gate, not the library — see **Creating a Test User** below.
Set two of the three and the authenticated tests skip as if none were set.

`playwright.config.ts` loads `.env.local` into the runner's own `process.env`, so
this file is all you need — no exporting in the shell. (Vite also reads it, but only
for the dev server it starts as a child, which never reaches the Playwright process.
Without that explicit load the authenticated tests skip silently even when the file
is correct.) A real environment variable always wins over the file, so CI secrets are
never overridden by a stray local copy.

### CI/CD (GitHub Actions)

The `e2e` job in `.github/workflows/ci.yml` runs `npm run e2e` on every PR and every
push to `main`. **It is not gated on any secret** — without them it supplies placeholder
Supabase values, so the unauthenticated half of the suite runs and gates the merge on a
fork and on a first-time contributor's PR exactly as it does for the maintainer
(`DECISIONS.md`, 2026-09-08).

Secrets are added under **Settings → Secrets and variables → Actions**. They fall into
two tiers:

| Secret | Without it |
|---|---|
| `VITE_SUPABASE_URL` | The job falls back to `https://placeholder.invalid`. The app boots; the unauthenticated tests run and pass, because none of them makes a Supabase network call. |
| `VITE_SUPABASE_ANON_KEY` | Same — falls back to a placeholder key. |
| `E2E_TEST_EMAIL` | The tests using the `authenticatedPage` fixture skip. The unauthenticated ones still run. |
| `E2E_TEST_PASSWORD` | Same as above. |
| `E2E_TEST_PASSPHRASE` | Same as above. The vault gate stands between sign-in and the library, so a passphrase-less run could not reach a single authenticated assertion. |

So the job gates merges today with no secrets at all. Adding the two Supabase secrets
points it at a real project; adding all five runs the authenticated tests too.

Point the Supabase secrets at a project you are willing to have test data written to. The
suite creates and deletes notes and tags as the test user.

**The test account has to be provisioned by hand first.** See **Creating a Test User**.

## Running E2E Tests

```bash
# Run all E2E tests (headless)
npm run e2e

# Run with visible browser
npm run e2e:headed

# Open Playwright UI for interactive testing
npm run e2e:ui

# View test report
npm run e2e:report
```

## Test Behavior Without Credentials

If any of `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD` or `E2E_TEST_PASSPHRASE` is not set:

- Tests using `authenticatedPage` fixture will **skip** (not fail)
- Tests using `testWithCredentials` will **skip**
- Tests that don't require authentication will still run

This allows the test suite to run partially in environments without credentials configured.

## The Vault Step

Signing in does not reach the library. `src/components/accountGates.tsx` renders
`PassphraseUnlock` when the account's vault exists and `PassphraseSetup` when it does
not, so `loginUser()` in `e2e/fixtures.ts` waits for whichever of the three screens —
library, unlock, setup — arrives first.

- **Library:** nothing to do; the vault was already unlocked in this context.
- **Unlock:** fills the `Passphrase` field with `E2E_TEST_PASSPHRASE`, submits, and
  waits for the library. Argon2id at 64 MB and 3 iterations takes seconds, which is why
  `playwright.config.ts` allows 60s per test.
- **Setup:** **fails the test** with a message telling you to create the vault by hand.

The fixture will not create a vault. Deriving a fresh key against whatever passphrase the
environment happens to hold would orphan every note the account already has, and a rerun
against a half-provisioned account would do it silently. Provisioning is a one-time manual
step, on purpose.

## Creating a Test User

1. Go to your Supabase project dashboard
2. Navigate to **Authentication → Users**
3. Click **Add user → Create new user**
4. Use a dedicated email (e.g., `e2e-test@your-domain.com`)
5. Set a strong password (min 8 characters)
6. Save credentials securely (password manager recommended)

Then create its vault, once, by hand:

7. Run the app (`npm run dev`) and sign in as the test user
8. The app shows **Protect Your Notes**. Enter a passphrase of at least 12 characters
   that also meets the strength policy, and confirm it
9. Use that exact passphrase as `E2E_TEST_PASSPHRASE`

Until step 9 is done the authenticated tests skip, and a run configured with a passphrase
but no vault fails with a message pointing back here.

### Security Best Practices

- Use a dedicated test account (never your personal account)
- Use a unique, strong password for the test account
- Never commit credentials to git
- Rotate credentials if accidentally exposed
- Consider using a throwaway email domain for test accounts
- Never re-enable the CI report upload for a credentialed run without redacting it
  first. A Playwright failure report renders the passphrase and password in plaintext —
  in the error-context attachment as well as the trace — so the `e2e` job withholds it
  when credentials are present (`DECISIONS.md`, 2026-09-08). A local run writes the same
  report to `playwright-report/`, so treat that directory as secret-bearing too; it is
  git-ignored, do not attach it to an issue.

## Troubleshooting

### Tests skipping unexpectedly

Check that your `.env.local` has the correct variable names:
```bash
E2E_TEST_EMAIL=...      # Not VITE_E2E_TEST_EMAIL
E2E_TEST_PASSWORD=...   # Not VITE_E2E_TEST_PASSWORD
E2E_TEST_PASSPHRASE=... # Not VITE_E2E_TEST_PASSPHRASE
```

All three must be set. Missing any one skips the authenticated tests.

`.env.local` is loaded by `playwright.config.ts`. If you have exported one of these
variables in your shell with an empty or stale value, that wins over the file — unset
it and re-run.

### "The E2E test account has no vault"

The account exists but has never had a vault created. Follow steps 7-9 of **Creating a
Test User**. The fixture will not do this for you.

### The unlock never completes

The passphrase in `E2E_TEST_PASSPHRASE` does not match the account's vault. A wrong
passphrase leaves the unlock form in place, so the fixture times out waiting for it to
go away. Five wrong attempts also lock the form for 60 seconds.

### Authentication failing

1. Verify the test user exists in Supabase
2. Check if email confirmation is required (disable for test accounts)
3. Ensure password meets minimum requirements (8+ characters)

### Tests timing out

The per-test timeout is 60s, set in `playwright.config.ts`, which covers the sign-in
round trip and the Argon2id vault unlock. Raise it there if a slow runner needs more:
```typescript
timeout: 60 * 1000,
```

## File Structure

```
e2e/
├── fixtures.ts         # Test helpers, auth utilities, E2E_CREDENTIALS_CONFIGURED flag
├── auth.spec.ts        # Authentication flow tests
├── notes.spec.ts       # Note CRUD tests
├── tags.spec.ts        # Tag management tests
├── sharing.spec.ts     # Share link tests
├── export-import.spec.ts # Export/import tests
└── settings.spec.ts    # Settings modal tests
```

## Security Incident (2025-12-28)

Hardcoded test credentials were previously committed to the repository and have been removed. If you were using the default test account:

1. **Rotate the password** immediately in Supabase
2. Consider the old credentials compromised
3. Check for any unauthorized access in Supabase logs

The fix was implemented in commit `bd8af31`.
