# Cursor Positioning UX Research: Note-Taking Apps

**Date:** December 2025
**Context:** Investigating best practices for cursor/caret positioning when opening notes in Zenote

---

## Industry Patterns

### What Popular Apps Do

| App | Cursor Behavior | Rationale |
|-----|-----------------|-----------|
| **Notion** | Places cursor at the **end of last edited block** | Assumes continuation of previous work |
| **Obsidian** | Places cursor at **last edited position** (persisted) | Power users expect to resume exactly where they left off |
| **Apple Notes** | Places cursor at **end of content** | Simple, predictable behavior for casual users |
| **Google Docs** | Restores **exact last position** (persisted per-user) | Collaborative editing needs precise position memory |
| **Bear** | Places cursor at **end of content** | Matches Apple Notes; optimized for quick appending |
| **iA Writer** | Places cursor at **end of content** | Distraction-free writing assumes forward momentum |
| **Ulysses** | Places cursor at **end of content** | Writing-focused apps favor continuation |

---

## Best Practice Analysis

### For Distraction-Free Writing Apps (like Zenote)

**Recommended: Cursor at End of Content**

**Why this works for Zenote's use case:**

1. **Writing Flow**: Most users open notes to *add* content, not edit the middle. End position enables immediate continuation.

2. **Simplicity**: No need to persist cursor positions per-note (adds database complexity).

3. **Predictability**: Users always know where the cursor will be. Reduces cognitive load.

4. **Mobile Parity**: Touch interfaces make "last position" impractical anyway.

### When to Use Last-Edited Position

- **Long-form documents** (10+ pages)
- **Collaborative editing** (multiple cursors)
- **Power-user tools** (Obsidian, VS Code)

### When to Use Beginning Position

- **Reading-first apps** (RSS readers, documentation)
- **Form-like inputs** (settings, profiles)

---

## Recommendation for Zenote

**Current behavior (cursor at end) is correct** for these reasons:

1. Zenote is a **calm, quick-capture** note app — users typically append thoughts
2. Notes are generally **short-to-medium length** — scrolling to end isn't disorienting
3. Matches **Apple Notes / Bear / iA Writer** conventions that Zenote's target users expect
4. **Wabi-sabi philosophy** embraces simplicity over feature complexity

### Edge Case to Consider

For **very long notes**, you might consider:
- Scroll to end but briefly flash a "scroll to top" indicator
- Or: only auto-focus end for notes under ~500 words

---

## Summary

| Scenario | Best Cursor Position |
|----------|---------------------|
| New note (empty) | Title field |
| Existing note with content | End of content |
| Returning to tab after switching | **Preserve current position** |

---

## Bug Identified (December 2025)

**Issue:** When user switches browser tabs and returns, the cursor resets to end of content.

**Expected:** Cursor should stay where the user left it during the same editing session.

**Root Cause:** The `autoFocus` effect in `RichTextEditor.tsx` runs when the `editor` object reference changes, which can happen during real-time sync updates. This calls `editor.commands.focus('end')` unnecessarily.

**Fix:** Only run the autoFocus effect on initial mount, not on subsequent re-renders. Use a ref to track whether initial focus has already been applied.

---

## Related Files

- `src/components/Editor.tsx` - Main editor component
- `src/components/RichTextEditor.tsx` - Tiptap editor wrapper with autoFocus logic
