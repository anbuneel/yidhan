# Codebase Bloat Audit (Quick Summary)

**Version:** 1.0
**Last Updated:** 2026-01-27
**Status:** Complete
**Author:** Codex (GPT-5)

---

## Original Prompt

> summmarize this to a doc.include my prompt and right context. add your name

---

## Context

You expressed concern about maintainability and future feature velocity (not documentation size). I produced a quick bloat audit focused on code hotspots and refactor opportunities.

---

## Summary Snapshot (Code Only)

- `src` total: 32,409 lines across 115 files.
- Largest surface areas:
  - `src/components`: 15,392 lines
  - `src/App.tsx`: 1,782 lines
- Largest files (high churn risk):
  - `src/App.tsx`
  - `src/components/Editor.tsx`
  - `src/components/Auth.tsx`
  - `src/services/offlineNotes.ts`
  - `src/services/syncEngine.ts`
  - `src/services/notes.ts`

---

## Maintainability Risks (Observed Hotspots)

- `src/App.tsx` centralizes routing, data flows, auth state, migration, imports, share targets, PWA flows, and modal orchestration. This concentrates risk and increases merge conflicts.
- `src/components/Editor.tsx` and `src/components/Auth.tsx` mix UI, side effects, and workflow logic, making changes brittle.
- `src/services/notes.ts` and `src/services/offlineNotes.ts` duplicate domain logic, causing divergence risk.
- `src/pages/DemoPage.tsx` mirrors main app flows, doubling maintenance for fixes.

---

## Quick, Low-Risk Refactor Targets

1) Split `src/App.tsx` into domain hooks:
   - `useNotesState`, `useTagsState`, `useImportExport`, `useShareTargetFlow`, `useDemoMigration`
2) Extract `Auth` UI into subcomponents and keep flow logic in a small hook.
3) Introduce a `notesRepository` interface to unify online/offline logic.
4) Reuse a shared library/editor shell in `DemoPage` to reduce duplication.

---

## Recommended Next Step

Start with a small, incremental split of `src/App.tsx` into 1–2 hooks. This reduces risk while improving feature velocity without a large rewrite.
