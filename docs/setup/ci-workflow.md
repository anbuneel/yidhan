# CI Workflow

## Overview

Yidhan uses GitHub Actions for continuous integration with an optimized two-tier approach that balances speed and thoroughness.

## Workflow Behavior

| Change Type | Fast Checks | Full Tests | Total Time |
|-------------|-------------|------------|------------|
| Docs only (`docs/**`, `*.md`, `LICENSE`) | Skipped | Skipped | 0s |
| Config only (`.yml`, `.json`, etc.) | ~30s | Skipped | ~30s |
| Source code (`src/**`) | ~30s | ~2min | ~2.5min |
| Pull Request (any files) | ~30s | ~2min | ~2.5min |

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
│  (~30 seconds)  │
│                 │
│  • typecheck    │
│  • lint         │
│  • build        │
└────────┬────────┘
         │
         ▼
    ┌────────────┐
    │ PR or src/ ├──► no ──► Done (fast checks only)
    │ changed?   │
    └────┬───────┘
         │ yes
         ▼
┌─────────────────┐
│  full-tests     │
│  (~2 minutes)   │
│                 │
│  • vitest       │
└─────────────────┘
```

## Jobs

### fast-checks

Runs on every qualifying push/PR. Quick validation that catches most issues.

- **Type check** - TypeScript compilation without emit
- **Lint** - ESLint static analysis
- **Docs sync check** - Verifies `AGENTS.md` is in sync with `CLAUDE.md` (`npm run docs:sync-agents:check`)
- **Build** - Production build verification

### full-tests

Runs after fast-checks pass, only when needed:

- **All PRs** - Ensures PR code is tested before merge
- **Push with src/ changes** - Catches issues from direct pushes to main

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
npm run typecheck && npm run lint && npm run build

# Full check (includes tests)
npm run check
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

- **2025-12-28**: Optimized CI with path filtering and split workflows (commit `5f11ae6`)
- **Previous**: Single job running all checks on every push
