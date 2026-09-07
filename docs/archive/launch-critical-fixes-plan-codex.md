# Launch-Critical Fixes Plan

**Version:** 1.0
**Last Updated:** 2026-03-10
**Status:** Ready for Implementation
**Author:** Codex (GPT-5)
**Date/Timestamp:** 2026-03-10

---

## Original Prompt

> come up with a detailed implementation /fix plan for these issues:
> - Tackle the open issues that hit correctness/security/core UX:
>   - #121 editor save/flush/remote-update race conditions
>   - #154 broken Ctrl/Cmd+K search shortcut
>   - #126 sanitizer still allows style/class
>   - #133 session restore can mark vault unlocked before key-check verification

---

## Summary

Implement these four issues as one tightly scoped launch-hardening branch, in this order:

1. `#126` sanitizer hardening
2. `#133` vault restore verification parity
3. `#154` search shortcut replacement
4. `#121` editor save/remote race fixes

This plan intentionally excludes sync-engine redesign, search UI redesign, HTML class allowlist work, and broader vault/session architecture changes. It is meant to be safe to implement as a focused correctness/security pass.

## Verified Findings

- `RichTextEditor.tsx` currently enables Tiptap `TextAlign`, so a pure "strip all style attributes" approach would silently remove valid aligned content.
- `Highlight` is configured, but it uses semantic markup and does not require retaining arbitrary inline styles.
- `KeyboardShortcutsModal.tsx` still lists the old search shortcut.
- `DemoPage.tsx` still implements the old search shortcut and search hint.
- Existing E2E notes coverage includes comments around the old `Ctrl+K` behavior and should be checked when the shortcut changes.

## Implementation Changes

### 1. Sanitizer hardening (`#126`)

- Keep the allowed HTML tag set unchanged.
- Remove `class` from `sanitizeHtml()` `ALLOWED_ATTR`.
- Replace broad `style` allowance with a strict post-sanitize style filter:
  - preserve only `text-align`
  - allow only `left`, `right`, `center`, `justify`
  - drop any other CSS property or mixed declaration
- Restrict surviving `text-align` styles to note-content block elements only:
  - `p`, `h1`, `h2`, `h3`, `blockquote`
- Keep only structural/safe attributes otherwise:
  - `href`, `target`, `rel`
  - `data-type`, `data-checked`
  - `type`, `checked`, `disabled`
- Document in the PR that previously pasted/imported formatting based on arbitrary classes or non-`text-align` inline styles will no longer render.

### 2. Session restore verification parity (`#133`)

- Extract a shared restore-verification helper inside `EncryptionContext`.
- The helper must:
  - accept restored keys, key-check metadata, a source label, and a cleanup callback
  - call `verifyKeyCheck` before any unlock state is set
  - report reliability telemetry on invalid or unverifiable restores
  - fail closed by clearing the relevant storage and returning `null`
- Route all restore paths through that helper:
  - initial `sessionStorage` restore
  - initial `localStorage` restore
  - activity-gated remembered-browser restore
- Preserve current semantics outside verification:
  - remembered-browser restore may still repopulate `sessionStorage`
  - manual unlock flow remains unchanged
  - no SessionKeyBlob HMAC/integrity redesign in this PR

### 3. Search shortcut replacement (`#154`)

- Replace `Ctrl/Cmd+K` everywhere with:
  - macOS: `⌘⇧K`
  - Windows/Linux: `Ctrl+Shift+K`
- Remove the global shortcut listener from `Header`.
- Add `searchFocusToken: number` to `Header`:
  - when the token changes, the search input focuses after render
  - Escape-to-clear remains local to the search input/header path
- Add an app-level global shortcut handler in `App`:
  - ignore when there is no authenticated user
  - ignore when focus is in `input`, `textarea`, `select`, or `contentEditable`
  - in library view: increment `searchFocusToken`
  - in non-editor authenticated views: switch to library, clear `selectedNoteId`, then increment `searchFocusToken`
- Add `onRequestSearch: () => void` to `Editor`:
  - `Editor` handles `Ctrl/Cmd+Shift+K` while mounted
  - handler cancels pending debounce, awaits any in-flight save, runs the serialized `performSave()`, then calls `onRequestSearch()`
  - if save fails, remain in editor and do not navigate
- Update all stale user-facing references:
  - `Header` shortcut chip
  - `KeyboardShortcutsModal.tsx`
  - `DemoPage.tsx` shortcut handling and hinting
- Check and update stale test/spec references, including E2E notes around the old shortcut behavior.

### 4. Editor save/flush/remote-update races (`#121`)

- Replace fragmented save refs with atomic snapshot refs:
  - `committedSnapshotRef`
  - `inFlightSnapshotRef`
  - `dismissedRemoteRef` upgraded to the same shape
- Snapshot shape:
  - `title`
  - `content`
  - `tagSignature` derived from a stable ordered join of tag ids
- Introduce a save-serialization primitive in `Editor`:
  - one ref tracks the active save promise
  - all save entry points reuse the same function
  - when a save is already in flight, the caller must wait, then re-check dirtiness before starting another save
- Explicit debounce behavior:
  - if the 800ms auto-save fires while a save is in flight, it waits for that save to finish
  - after waiting, it re-checks dirtiness against the committed snapshot
  - if nothing remains dirty, it exits without a redundant second save
- `performSave()` rules:
  - build a draft snapshot from current editor state plus current note tag ids
  - no-op if draft matches committed snapshot
  - when save starts, store the draft in `inFlightSnapshotRef`
  - call `onUpdate()` with the current draft
  - only after success, promote draft to `committedSnapshotRef`
  - on failure, clear `inFlightSnapshotRef`, keep committed snapshot unchanged, and preserve existing error UI
- Remote update detection rules:
  - compare incoming props against both committed and in-flight snapshots
  - suppress banner for self-echo matches against either snapshot
  - do not show the banner for tag-only changes
  - only show the banner when incoming title/content differs from both snapshots and the local editor draft is dirty
- Scroll save race fix:
  - capture `note.id` and `scrollTop` into locals first
  - guard using the captured note id against `activeNoteIdRef.current`
  - only then write `pendingScrollSaveRef`

## Public Interface Changes

- `Header` gains `searchFocusToken: number`
- `Editor` gains `onRequestSearch: () => void`
- No database, schema, or generated-type changes

## Test Plan

### Automated

- `sanitize.test.ts`
  - strips `class`
  - strips unsafe inline styles
  - preserves safe `text-align` on allowed block tags
  - strips non-allowlisted style values/properties
  - preserves task-list/link structural attributes
- `EncryptionContext.test.tsx`
  - valid `sessionStorage` restore only unlocks after `verifyKeyCheck()` passes
  - invalid `sessionStorage` restore clears session storage and stays locked
  - missing key-check metadata on session restore fails closed and reports telemetry
  - remembered-browser restore still passes through the shared verifier
- Search shortcut coverage
  - app-level library-view test: `Ctrl/Cmd+Shift+K` triggers focus via `searchFocusToken`
  - header test: token change focuses search input and hint shows the new shortcut
  - editor test: shortcut awaits save, then calls `onRequestSearch()`
  - editor test: failed save blocks navigation/search handoff
  - demo shortcut test or focused component coverage for updated demo search behavior
  - keyboard shortcuts modal coverage for the new shortcut listing
- `Editor.test.tsx`
  - no duplicate save when debounce and visibility/pagehide converge on the same draft
  - debounce firing during in-flight save waits, re-checks dirtiness, and avoids redundant save
  - self-echo during in-flight save does not show the remote banner
  - tag-only prop changes do not show the remote banner
  - rapid note switch does not persist scroll position for the wrong note id

### Manual Acceptance

- In authenticated library view, `Ctrl/Cmd+Shift+K` focuses search.
- In authenticated editor view, `Ctrl/Cmd+Shift+K` saves, returns to library, and focuses search.
- In demo mode, the new shortcut focuses demo search.
- Keyboard shortcuts modal shows the new shortcut consistently.
- Existing aligned content still renders with text alignment.
- Arbitrary classes and non-`text-align` inline styles no longer render.
- Refresh with stale/corrupt session keys never shows the vault as unlocked before verification.

## Assumptions

- `Ctrl/Cmd+Shift+K` is the locked replacement shortcut.
- Preserving only safe `text-align` styling is the chosen compromise for `#126`.
- E2E coverage should be updated where the old shortcut is referenced, but the main acceptance burden remains in unit/component tests because browser shortcut behavior varies by environment.
- This plan intentionally excludes broader sync issues such as `#51`, `#54`, and `#55`.
