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
```

### CI/CD (GitHub Actions)

The `e2e` job already exists in `.github/workflows/ci.yml` and already passes all four
secrets. Nothing in the workflow needs editing — only the secrets need adding, under
**Settings → Secrets and variables → Actions**.

Two tiers, because they fail differently:

| Secret | Without it |
|---|---|
| `VITE_SUPABASE_URL` | **The job does nothing.** `src/lib/supabase.ts` throws without it, so the app never boots and every test would fail. The job's heavy steps are gated on this secret being present: it prints a notice and passes in a few seconds. |
| `VITE_SUPABASE_ANON_KEY` | Same — set it alongside the URL. |
| `E2E_TEST_EMAIL` | The 60 tests using the `authenticatedPage` fixture skip. The other 26 still run. |
| `E2E_TEST_PASSWORD` | Same as above. |

So adding just the two Supabase secrets turns the job on and gets 26 tests; adding all four
gets all 86.

Point the Supabase secrets at a project you are willing to have test data written to. The
suite creates and deletes notes and tags as the test user.

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

If `E2E_TEST_EMAIL` or `E2E_TEST_PASSWORD` are not set:

- Tests using `authenticatedPage` fixture will **skip** (not fail)
- Tests using `testWithCredentials` will **skip**
- Tests that don't require authentication will still run

This allows the test suite to run partially in environments without credentials configured.

## Creating a Test User

1. Go to your Supabase project dashboard
2. Navigate to **Authentication → Users**
3. Click **Add user → Create new user**
4. Use a dedicated email (e.g., `e2e-test@your-domain.com`)
5. Set a strong password (min 8 characters)
6. Save credentials securely (password manager recommended)

### Security Best Practices

- Use a dedicated test account (never your personal account)
- Use a unique, strong password for the test account
- Never commit credentials to git
- Rotate credentials if accidentally exposed
- Consider using a throwaway email domain for test accounts

## Troubleshooting

### Tests skipping unexpectedly

Check that your `.env.local` has the correct variable names:
```bash
E2E_TEST_EMAIL=...    # Not VITE_E2E_TEST_EMAIL
E2E_TEST_PASSWORD=... # Not VITE_E2E_TEST_PASSWORD
```

### Authentication failing

1. Verify the test user exists in Supabase
2. Check if email confirmation is required (disable for test accounts)
3. Ensure password meets minimum requirements (8+ characters)

### Tests timing out

Increase the timeout in `playwright.config.ts`:
```typescript
timeout: 30000, // 30 seconds per test
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
