# Code Review: fix/shared-note-formatting

**Review ID:** 65e758d4
**Date:** 2026-02-21
**PR:** #123
**Status:** Converged after 2 rounds

## Summary
| Metric | Count |
|--------|-------|
| Rounds | 2 |
| Total findings | 17 |
| Agreed & fixed | 9 |
| Partially fixed | 0 |
| Deferred | 2 |
| Rejected | 6 |

## Pre-Review (Claude native agents)

3 agents: code-reviewer, silent-failure-hunter, type-design-analyzer

| # | Agent | Finding | Severity | Disposition |
|---|-------|---------|----------|-------------|
| 1 | all 3 | `browser!` non-null assertion in E2E test | SHOULD FIX | agree (fixed) |
| 2 | code-reviewer | Redundant `outline: none` in CSS override | SHOULD FIX | agree (fixed) |
| 3 | silent-failure | `.catch()` discards error — no logging | SHOULD FIX | agree (fixed, user override) |
| 4 | silent-failure | DB errors return null causing misleading "faded" message | SHOULD FIX | agree (fixed, user override) |
| 5 | type-design | `.ProseMirror` class fragile coupling | SHOULD FIX | reject (user sided with Claude) |
| 6 | code-reviewer + type-design | Task list checkboxes interactive in read-only view | CONSIDER | agree (fixed) |
| 7 | type-design | `<mark>` sanitizer fix has no E2E coverage | CONSIDER | defer |
| 8 | silent-failure | `mark` inherits `style` attribute allowance | CONSIDER | reject (consistent) |
| 9 | silent-failure | Optional chaining fallback acceptable | CONSIDER | reject (no action) |

### User Decisions
- #3: User overrode defer to fix now (add error logging)
- #4: User overrode defer to fix now (throw on DB errors)
- #5: User sided with Claude (skip — .ProseMirror reuse is correct)

### Fixes Applied
- SharedNoteView: added error logging to .catch() handler
- notes.ts: fetchSharedNote throws on DB errors instead of returning null
- notes.test.ts: updated/added tests for throw behavior
- index.css: removed redundant outline:none, added checkbox pointer-events
- sharing.spec.ts: replaced browser! with guard clause

## Round 1

### Remote Agent Comments
- **Vercel bot**: Deployment preview created (not a code review)
- No code review agents responded in time for round 1

### Codex Review (gpt-5.3-codex)
Session: 019c82aa-35df-7841-aeb3-99acc38199a3. Verdict: REVISE.

| # | Finding | Severity | Disposition |
|---|---------|----------|-------------|
| 10 | Share token logged in console.error — credential leakage | MUST FIX | agree (fixed) |
| 11 | Task list checkboxes still keyboard/label-toggleable | SHOULD FIX | agree (fixed) |
| 12 | fetchSharedNote JSDoc missing throw semantics | CONSIDER | agree (fixed) |

### Fixes Applied
- Removed share token from console.error arguments
- Disabled task list label pointer-events and user-select
- Added throw documentation to fetchSharedNote JSDoc

## Round 2

### Remote Agent Comments
- **Claude bot**: 2 detailed reviews (initial + round 2 follow-up). Confirmed prior fixes. Flagged: changelog missing error UX entry, keyboard focus on checkboxes, caret-color nit.
- **Devin**: No issues found.
- **Codex GH connector**: 1 inline comment flagging label click bypass on task list checkboxes.
- **Codex CLI** (gpt-5.3-codex): 1 MUST FIX — checkboxes keyboard-focusable despite CSS fix.

| # | Finding | Severity | Agents | Disposition |
|---|---------|----------|--------|-------------|
| 13 | Task list checkboxes keyboard-focusable | MUST FIX | codex-cli + claude-bot + codex-gh | agree (fixed) |
| 14 | Changelog missing error UX fix entry | SHOULD FIX | claude-bot | agree (fixed) |
| 15 | caret-color: auto -> transparent | CONSIDER | claude-bot | agree (fixed) |
| 16 | mark multicolor data-color attrs stripped | CONSIDER | claude-bot | reject (self-resolved: multicolor=false) |
| 17 | E2E Tiptap input rule timing flakiness | CONSIDER | claude-bot | defer |

### Fixes Applied
- useEffect to disable checkboxes (disabled + tabIndex=-1) in SharedNoteView
- Added changelog entry for error UX improvement
- Changed caret-color to transparent

## Deferred Items
- #7: `<mark>` sanitizer fix has no E2E test coverage (unit tests sufficient)
- #17: E2E Tiptap input rule timing may be flaky (address if CI flakes)

## Rejected Items
- #5: `.ProseMirror` class fragile coupling (user confirmed: reuse is correct approach)
- #8: `mark` inherits `style` attribute (consistent with existing posture)
- #9: Optional chaining fallback (acceptable defensive code)
- #16: mark multicolor attributes (multicolor=false confirmed)
