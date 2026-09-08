# CI Workflow

## Overview

Yidhan uses GitHub Actions for continuous integration. `fast-checks` gates everything;
`full-tests`, `service-worker` and `e2e` run after it, in parallel.

## Workflow Behavior

| Change Type | fast-checks | full-tests | service-worker | e2e |
|-------------|-------------|------------|----------------|-----|
| Docs only (`docs/**`, `*.md`) | ~1min | Skipped | ~1min | ~3min |
| Config only (`.yml`, `.json`, etc.) | ~1min | Skipped | ~1min | ~3min |
| Source code (`src/**`) | ~1min | ~1min | ~1min | ~3min |
| Pull Request (any files) | ~1min | ~1min | ~1min | ~3min |

Only `full-tests` is conditional. `service-worker` and `e2e` run on everything on purpose:
each is the only thing that exercises its path in a real browser, and a job that skips on
the change that breaks it guards nothing.

## Workflow Structure

```
┌─────────────────┐
│   Push to main  │
│   or Open PR    │
│  (no filtering) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  fast-checks    │
│                 │
│  • docs sync    │
│  • typecheck    │
│  • lint         │
│  • lint:exports │
│  • build        │
└────────┬────────┘
         │
         ├──────────────────────┬──────────────────────┐
         ▼                      ▼                      ▼
    ┌────────────┐      ┌─────────────────┐   ┌─────────────────┐
    │ PR or src/ │      │ service-worker  │   │      e2e        │
    │ changed?   │      │                 │   │                 │
    └────┬───────┘      │ • e2e:sw        │   │ • npm run e2e   │
         │ yes          │   (2 tests,     │   │   always runs   │
         ▼              │   real build)   │   │   + auth tests  │
┌─────────────────┐     └─────────────────┘   │   with secrets  │
│  full-tests     │                           └─────────────────┘
│                 │
│  • vitest       │
│    + coverage   │
└─────────────────┘
```

## Jobs

### fast-checks

Runs on every qualifying push/PR. Quick validation that catches most issues.

- **Docs sync check** - Verifies `AGENTS.md` is in sync with `CLAUDE.md` (`npm run docs:sync-agents:check`)
- **Type check** - `npm run typecheck`, which is `tsc -b`. It must stay `tsc -b`: the root
  `tsconfig.json` holds `"files": []` and only project references, so `tsc --noEmit` against
  it compiles zero files and always passes. The real coverage is `tsconfig.app.json`.
- **Lint** - ESLint plus the removed-plaintext-API guard
- **Unused exports** - `npm run lint:exports`
- **Build** - Production build verification

### full-tests

Runs after fast-checks pass, only when needed:

- **All PRs** - Ensures PR code is tested before merge
- **Push with src/ changes** - Catches issues from direct pushes to main

Runs `npm run test:coverage`, so the coverage thresholds in `vite.config.ts` are enforced
here and not in `npm run check`.

### service-worker

Runs `npm run e2e:sw` against a real production build. Unit tests cannot run a service
worker, and the main browser suite runs against the dev server, which produces none — so
the update path is untestable anywhere else. `registerType: 'prompt'` stranded clients on
an old build for months before this job existed.

### e2e

The full browser suite — `npm run e2e`, 97 tests across 10 specs, run on Desktop Chrome
and Pixel 5 for 194 runs. It runs on every PR and every push to `main`, and a red spec
fails the build.

**It is not gated on any secret.** `src/lib/supabase.ts` throws without a URL and anon
key, so the app cannot boot without them, but the unauthenticated half of the suite makes
no Supabase network call — so the job supplies `https://placeholder.invalid` and a
placeholder key when the secrets are absent. Measured on the commit that introduced this:
66 passed, 128 skipped, 0 failed against those placeholders — 33 of the 97 tests per
project need no credentials. A fork and a
first-time contributor's PR therefore get the same gating suite as the maintainer
(`DECISIONS.md`, 2026-09-08).

Real secrets, when set, override the placeholders. The tests using the `authenticatedPage`
fixture additionally need `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD` and `E2E_TEST_PASSPHRASE`;
without all three they skip cleanly. The passphrase is what carries the fixture past the
vault gate — every account is end-to-end encrypted, so sign-in alone reaches
`PassphraseUnlock`, not the library.

The test account has to be provisioned by hand once, including creating its vault. The
fixture unlocks a vault; it will not create one. See `docs/setup/e2e-testing-setup.md`.

**The failure report is not uploaded from a credentialed run.** A Playwright report
embeds typed values in plaintext — the error-context attachment renders the password
field's value in its accessibility tree, and the trace carries it too — so a failing
authenticated test would publish the account password and the vault passphrase to anyone
who can read the run's artifacts. The upload is gated on the credentials being absent;
a credentialed failure prints a notice instead (`DECISIONS.md`, 2026-09-08). Do not
re-open that gate without a redaction step.

## Path Filtering

There is none, deliberately. It was removed on 2026-09-07.

The push trigger used to carry `paths-ignore: ['docs/**', '*.md', 'LICENSE']`, which
conflicted with branch protection. `main` requires the `fast-checks` status, and a
workflow that never triggers never reports one — so on a docs-only push the check sat in
**"expected"** forever rather than failing. The push could then only land by bypassing
the rule, which `enforce_admins: false` silently permitted for the repository owner and
denied to everyone else, with no way for them to satisfy it. That contradicted the
"small doc touch-ups may go direct to main" rule in `CLAUDE.md`.

Filtering by path and requiring a status check on the same branch cannot both hold. The
required check won: a minute of CI on a docs commit is the price of the protection rule
meaning something. Do not reintroduce `paths-ignore` on the push trigger without also
removing `fast-checks` from the required checks on `main`.

## Configuration

The workflow is defined in `.github/workflows/ci.yml`.

### Key Configuration

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

Branch protection on `main` (classic, not a ruleset):

```json
"required_status_checks": { "contexts": ["fast-checks"], "strict": true },
"enforce_admins": false
```

### Conditional Test Execution

```yaml
full-tests:
  needs: fast-checks
  if: |
    github.event_name == 'pull_request' ||
    (github.event_name == 'push' && contains(join(github.event.commits.*.modified, ','), 'src/')) ||
    (github.event_name == 'push' && contains(join(github.event.commits.*.added, ','), 'src/'))
```

## Local Equivalent

Run the same checks locally before pushing:

```bash
# Fast checks only
npm run typecheck && npm run lint && npm run lint:exports && npm run build

# Full check (includes tests)
npm run check

# Coverage thresholds — enforced by full-tests, not by npm run check
npm run test:coverage
```

## Monitoring

View CI status at: https://github.com/anbuneel/yidhan/actions

## Troubleshooting

### CI not running on push

It should now run on every push to `main`. If it does not, check the trigger has not had
`paths-ignore` reintroduced — see Path Filtering above for why that breaks the required
status check.

### A required check is stuck on "expected"

The workflow never triggered, so no status was ever reported. "Expected" is not a failure;
it is GitHub waiting for a report that is not coming. Find out why the workflow did not
run rather than bypassing the rule.

### Tests not running on push

Tests only run on push if `src/` files were modified. Check git diff:
```bash
git diff HEAD~1 --name-only | grep "^src/"
```

### Forcing full tests

If you need to force full tests on a non-src change, you can:
1. Create a PR instead of pushing directly
2. Touch a file in `src/` (not recommended)

## History

- **2026-09-07**: Removed `paths-ignore` from the push trigger — it conflicted with the
  `fast-checks` required status check on `main` (see Path Filtering).
- **2026-09-08**: Ungated the `e2e` job — it now runs `npm run e2e` on every PR using
  placeholder Supabase values when the secrets are absent, so it gates merges on forks
  too. Added `E2E_TEST_PASSPHRASE` so the fixture can unlock the test account's vault.
  (item 37, #223)
- **2026-09-07**: Added the `e2e` job, secrets-gated. Fixed the Type check step, which ran
  `npx tsc --noEmit` against a `"files": []` root config and therefore checked nothing. (#224)
- **2026-09-04**: Added the `service-worker` job.
- **2025-12-28**: Optimized CI with path filtering and split workflows (commit `5f11ae6`)
- **Previous**: Single job running all checks on every push
