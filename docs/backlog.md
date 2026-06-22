# Backlog

Exploratory enhancements and deferred ideas — not committed work. Items graduate to GitHub issues when ready for implementation.

**Sections:** [Landing Page](#landing-page) · [Design & Polish](#design--polish) · [Editor](#editor) · [Mobile & Native](#mobile--native) · [Features](#features) · [Security & Trust](#security--trust) · [Infrastructure](#infrastructure)

---

## Landing Page

| Item | Priority | Source |
|------|----------|--------|
| [Landing Page Backlog](active/landing-page-backlog.md) | Mixed | 4 analysis docs + design critique |

Key open items: proof rail links, below-the-fold second act, 6 deferred signature details.

---

## Design & Polish

| Item | Priority | Source |
|------|----------|--------|
| Trust badges visibility — proof rail may be too subtle | P2 | [Design critique 03-28](reviews/impeccable-design-critique-2026-03-28-claude.md) |
| Demo Practice Space — needs 3-4 starter notes (not just 1 welcome card) | P4 | [Design critique 03-28](reviews/impeccable-design-critique-2026-03-28-claude.md) |
| Earlier design critique open items | Various | [Design critique tracker](active/design-critique-tracker.md) |

---

## Editor

| Item | Priority | Source |
|------|----------|--------|
| Editor calm & delight — 9 changes (sidebar toolbar, metadata, writing surface) | P2 | [Editor calm & delight plan](plans/2026-03-09-editor-calm-delight.md) |

---

## Mobile & Native

| Item | Priority | Source |
|------|----------|--------|
| iOS Capacitor setup (requires macOS) | P3 | [Mobile iOS overhaul plan](plans/mobile-ios-overhaul-plan.md) |
| iOS PWA experience checklist | P3 | [iOS PWA checklist](active/ios-pwa-experience-checklist-codex.md) |

---

## Features

| Item | Priority | Source |
|------|----------|--------|
| Quiet Tasks — surface buried tasks/intentions | P3 | [Quiet Tasks plan](plans/quiet-tasks-implementation-plan.md) |
| Quiet Intelligence — reflective AI features | Deferred | [Quiet Intelligence analysis](analysis/quiet-intelligence-features-claude.md) |
| Subscription & feature gating (Bloom tier) | Deferred | [Subscription architecture](analysis/subscription-architecture-claude.md) |

---

## Security & Trust

| Item | Priority | Source |
|------|----------|--------|
| Restore self-serve offboarding in a tiny follow-up only after the server-owned account deletion workflow passes production verification and a throwaway-account deletion drill. The implementation PR must keep `ACCOUNT_OFFBOARDING_ENABLED = false`, keep deletion copy silent, and leave re-enablement as a separate verified step. | P1 | [Account deletion workflow plan](plans/account-deletion-workflow-plan.md) |
| Treat applied Supabase migrations as append-only. Future security/RLS tightening should use forward migrations instead of rewriting historical migration SQL, so restore paths and audit history stay truthful. | P2 | Claude review on PR #193 |

---

## Infrastructure

| Item | Priority | Source |
|------|----------|--------|
| Reliability hardening items 4-5 (note-tag convergence, search/sync scale) | Post-launch | [Reliability plan](active/reliability-hardening-plan-codex.md) |
| Remove vestigial `_userId` parameters from `createNote`, `createNotesBatch`, `createTag`, and `createNoteShare`, then update call sites so the service API no longer suggests client-owned authorization. | P2 | Claude review on PR #193 |

---

## How This Relates to Other Docs

- **GitHub Issues** — Committed bugs and features with assignees and milestones
- **[Roadmap](roadmap.md)** — Product-level feature roadmap (phases 1-4)
- **[Index](Index.md)** — Full documentation index
- **This doc** — Exploratory ideas that haven't graduated to issues yet

Items move: `backlog.md` -> GitHub issue -> implementation plan -> PR -> archive
