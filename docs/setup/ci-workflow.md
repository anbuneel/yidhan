# CI Workflow

## Overview

Yidhan uses GitHub Actions for continuous integration. `fast-checks` gates everything;
`full-tests`, `service-worker` and `e2e` run after it, in parallel.

## Workflow Behavior

| Change Type | fast-checks | full-tests | service-worker | e2e |
|-------------|-------------|------------|----------------|-----|
| Docs only (`docs/**`, `*.md`, `LICENSE`) | Skipped | Skipped | Skipped | Skipped |
| Config only (`.yml`, `.json`, etc.) | ~1min | Skipped | ~1min | secrets-gated |
| Source code (`src/**`) | ~1min | ~1min | ~1min | secrets-gated |
| Pull Request (any files) | ~1min | ~1min | ~1min | secrets-gated |

## Workflow Structure

```
┌─────────────────┐
│   Push to main  │
│   or Open PR    │
└────────┬────────┘
         │
         ▼
    ┌────────────┐
    │ paths-ignore?──────► docs/**, *.md, LICENSE
    └────┬───────┘         (CI skipped entirely)
         │ no
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
    └────┬───────┘      │ • e2e:sw        │   │ secrets set?    │
         │ yes          │   (2 tests,     │   │  no ──► notice  │
         ▼              │   real build)   │   │  yes ─► 86 tests│
┌─────────────────┐     └─────────────────┘   └─────────────────┘
│  full-tests     │
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

The full browser suite: 86 tests across 10 specs, on Desktop Chrome and Pixel 5.

The heavy steps are gated on `VITE_SUPABASE_URL` being present. `src/lib/supabase.ts`
throws without it, so an unconfigured repository would go red rather than skip. With no
secrets the job prints a notice and passes in a few seconds.

See `docs/setup/e2e-testing-setup.md` for the secrets it needs.

## Path Filtering

CI is completely skipped for documentation-only changes:

```yaml
paths-ignore:
  - 'docs/**'
  - '*.md'
  - 'LICENSE'
```

This means commits that only touch these paths won't trigger any CI jobs.

## Configuration

The workflow is defined in `.github/workflows/ci.yml`.

### Key Configuration

```yaml
on:
  push:
    branches: [main]
    paths-ignore:
      - 'docs/**'
      - '*.md'
      - 'LICENSE'
  pull_request:
    branches: [main]
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

Check if your changes only touched paths in `paths-ignore`. This is intentional for docs-only changes.

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

- **2026-09-07**: Added the `e2e` job, secrets-gated. Fixed the Type check step, which ran
  `npx tsc --noEmit` against a `"files": []` root config and therefore checked nothing. (#224)
- **2026-09-04**: Added the `service-worker` job.
- **2025-12-28**: Optimized CI with path filtering and split workflows (commit `5f11ae6`)
- **Previous**: Single job running all checks on every push
