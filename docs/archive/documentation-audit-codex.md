# Documentation Audit

**Version:** 1.0
**Last Updated:** 2026-03-09
**Status:** Complete
**Author:** Codex (GPT-5)

---

## Original Prompt

> Do a comprehensive documentation audit of all the docs in this repo and ensure alignment with the code? Suggest any improvements in organizing the docs - I am using this as a paper trail as this app is agentically coded using codex and claude

---

## Scope

This audit covered:

- top-level canonical docs
- reference docs
- setup docs
- roadmap and product docs
- the overall `docs/` directory structure

Historical paper-trail artifacts were reviewed for classification and hygiene, but not fully rewritten.

## High-Signal Findings

### 1. Canonical docs had meaningful drift from the code

Examples found before this audit:

- `docs/technical-spec.md` still described the product as `Zenote` and omitted current offline-first + E2EE architecture details
- `docs/prd.md` still treated E2EE as planned in places even though it is implemented
- `docs/reference/e2ee-user-experience-claude.md` incorrectly stated that sharing was disabled under E2EE
- `docs/setup/ci-workflow.md` used the old product name and missed the current docs-sync check
- `README.md` contained an incomplete baseline schema that no longer represented the live app

### 2. The index mixed source-of-truth docs with paper trail artifacts

Before this audit, `docs/Index.md` treated strategic reviews, historical reviews, active plans, and current product docs as peers. That makes agent work harder and increases the chance of stale context being mistaken for current truth.

### 3. Historical link rot exists

Broken internal links found included:

- `docs/Index.md -> active/onboarding-ux-followup.md`
- `docs/Index.md -> archive/planning/CLAUDE-full-2025-12-28.md`
- `docs/roadmap.md -> ../../../.claude/plans/calm-honking-mist.md`

### 4. Metadata standards are not uniformly enforced

Many older AI-authored files do not include the later standard metadata fields such as version, last updated, status, author, and original prompt. This is acceptable as history, but it should be treated as legacy rather than current standard.

### 5. CI does not protect documentation quality

Docs-only pushes are skipped by CI today. That is efficient, but it means paper-trail quality is not automatically checked.

## Changes Made

The following current-state docs were refreshed to match the codebase more closely:

- `README.md`
- `docs/Index.md`
- `docs/technical-spec.md`
- `docs/prd.md`
- `docs/roadmap.md`
- `docs/reference/e2ee-user-experience-claude.md`
- `docs/reference/user-guide-notes.md`
- `docs/setup/ci-workflow.md`

## Recommended Documentation Shape

For an agentically-coded repo, the cleanest structure is:

### Current state

Files that should match the code today:

- `README.md`
- `docs/prd.md`
- `docs/technical-spec.md`
- `docs/roadmap.md`
- `docs/reference/*`
- selected `docs/setup/*`

### Active execution

Files that are actionable but not yet canonical:

- `docs/plans/*`
- selected `docs/active/*`

### Paper trail

Historical reasoning and review artifacts:

- `docs/analysis/*`
- `docs/reviews/*`
- `docs/conversations/*`
- `docs/archive/*`

## Recommended Next Improvements

1. Add a docs validation script for internal links and required metadata.
2. Introduce a simple document status taxonomy such as `canonical`, `active-plan`, `historical`, and `superseded`.
3. Add a single bootstrap Supabase schema or reproducible setup path for new environments.
4. Normalize older high-value docs that are still frequently referenced, especially setup docs that still use the old `Zenote` branding.
5. Consider moving long-lived strategy and review artifacts under a clearer `paper-trail/` parent if the repo keeps growing.

## Bottom Line

The repository already has strong documentation volume and a valuable agent paper trail. The main problem was not lack of docs; it was classification drift. The highest-leverage fix is to keep a small, explicit set of current-state docs authoritative and let everything else be historical context.
