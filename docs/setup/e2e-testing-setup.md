# E2E Testing Setup

## Overview

Zenote uses Playwright for end-to-end testing. E2E tests require a dedicated test user account in Supabase.

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

Add these as repository secrets in GitHub:

1. Go to **Settings → Secrets and variables → Actions**
2. Add `E2E_TEST_EMAIL` secret
3. Add `E2E_TEST_PASSWORD` secret

Then update `.github/workflows/ci.yml` to pass them to the E2E test step:

```yaml
- name: Run E2E tests
  run: npm run e2e
  env:
    E2E_TEST_EMAIL: ${{ secrets.E2E_TEST_EMAIL }}
    E2E_TEST_PASSWORD: ${{ secrets.E2E_TEST_PASSWORD }}
```

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
