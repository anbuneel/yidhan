# Progress

Append-only history, newest last. One entry per merged change.

**History only.** This file is never authority for current architecture or
behaviour — it records what happened, not what is true now. For current
architecture see `CLAUDE.md`; for the visual system `DESIGN.md`; for what is
deferred `docs/roadmap.md`. Entries are not rewritten; a later entry corrects an
earlier one.

`src/data/changelog.ts` is a *product surface* — the release notes rendered inside
the app for users. It is not documentation and is not this file's duplicate: it
speaks to users about features, this file records engineering history.

Entries before 2026-03-28 predate the working clone's visible git history and are
not reconstructed here; see `docs/archive/` for the plans of that era.

---

## 2026-03

- **2026-03-28** — Landing page redesigned as a unified single-canvas composition. (#183)
- **2026-03-29** — UI quality sweep: accessibility, responsive, performance, theming (18 items). (#184)

## 2026-04

- **2026-04-04** — UI quality sweep 2: 404 page, demo starter notes, Auth refactor. (#185)

## 2026-05

- **2026-05-16** — App updates made quiet; UI sweep unifying the logo, filter search and hover states. (#186)
- **2026-05-17** — Route transitions smoothed; landing header unified with `HeaderShell`; scrollbar gutter stabilised.
- **2026-05-18** — Calm hover sweep: pin/delete alignment, lifts removed, ambient feedback retained.
- **2026-05-23** — Post-login navigation quietened.
- **2026-05-25** — Re-auth guardrail switch added. (#187)
- **2026-05-31** — React Doctor score brought to 100.

## 2026-06

- **2026-06-02** — `CLAUDE.md` trimmed below the 40k character limit.
- **2026-06-08** — Landing page reimagined. (#191)
- **2026-06-21** — Launch security posture hardened: RLS policies reset, public
  table-read share policies removed, encrypted-only note rows enforced, share
  writes capped at 30 days. (#192)
- **2026-06-21** — Native dialog chrome reset on the auth modal.

## 2026-07

- **2026-07-14** — Server-owned account deletion workflow added, with a 14-day
  grace period and a service-role worker. (#194)

## 2026-08

- **2026-08-09** — Landing page and note masonry polished. (#195)

## 2026-09

- **2026-09-04** — App updates restored (service worker `registerType` returned to
  `autoUpdate`) and stuck sync queue entries unblocked. (#196)
- **2026-09-04** — Fonts self-hosted; logo mark made theme-aware. (#197)
- **2026-09-05** — Browser asked to persist the offline database via
  `navigator.storage.persist()`. (#199)
- **2026-09-07** — Editor keyboard navigation and link controls fixed — ledger items 1–4. (#200)
- **2026-09-07** — Saving and recovery: failed saves retain the draft with Retry
  and Copy; ten-second local checkpoints; "Saved here" distinguished from
  "Synced" — ledger items 5–7. (#201)
- **2026-09-07** — Tag sync reconciliation, readable conflict previews, and
  large-library cursor handling — ledger items 8–10. (#202)
- **2026-09-07** — Search caching, mobile spacing, and practice-privacy copy;
  manifest share target removed — ledger items 11–16, 21, 22. (#203)
- **2026-09-07** — Lossless Markdown export, account backup restore fidelity,
  sharing verification, and removal of legacy plaintext note APIs — ledger
  items 17–20. (#204)
- **2026-09-07** — Documentation and instruction layer overhauled: 169 files
  quarantined to `docs/archive/` behind a retrieval lane, six canonical docs
  installed (`CLAUDE.md`, `PRODUCT.md`, `DECISIONS.md`, `DESIGN.md`,
  `docs/progress.md`, `docs/roadmap.md`), plan lifecycle enforced by a pre-commit
  hook, and per-doc model-attribution rituals dropped.
- **2026-09-07** — Execution ledger split so each fact has one owner: shipped
  items folded into this file, the 128 deferred items moved to
  `docs/roadmap.md` keeping their numbers, and the review-coverage appendices
  frozen in `docs/archive/`. The ledger had listed items 5–22 in both its Next
  and Done tables, contradicting its own rule that an item sits in exactly one
  list. It now carries only committed work, alongside the ledger convention
  adopted as item 148.
