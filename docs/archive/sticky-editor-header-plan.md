# Sticky Editor Header Plan

Goal
Keep the note title and formatting toolbar visible while editing long notes so formatting changes do not require scrolling back to the top.

Recommendation
Implement a sticky editor header inside the editor scroll container (title + toolbar together). This keeps the UX calm, avoids overlapping the global app header, and preserves context in long notes.

Proposed UX Behavior
- The title row and formatting toolbar stick to the top of the editor content area while the note body scrolls.
- The sticky area has a subtle separator (border or shadow) only when content scrolls underneath.
- On mobile, keep the toolbar sticky; keep the title in the existing header row to avoid cramped stacking.

Implementation Steps
1. Confirm the editor scroll container in `Editor.tsx` and `RichTextEditor.tsx` and identify where the sticky header should live.
2. Wrap the title and toolbar in a sticky container inside the editor panel.
3. Apply sticky styles using existing CSS variables and the wabi-sabi radius conventions.
4. Add a subtle separator state for when scroll is not at the top.
5. Validate keyboard shortcuts and focus behavior remain unchanged.
6. Verify layout on desktop and mobile, including long titles and toolbar overflow.

Files Likely Affected
- `src/components/Editor.tsx`
- `src/components/RichTextEditor.tsx`
- `src/index.css`

Acceptance Criteria
- Title and toolbar remain visible during long note edits on desktop.
- No overlap with the global header, toasts, or WhisperBack.
- Mobile layout remains readable and uncluttered.
- No regressions in focus, shortcuts, or saving indicator.

Open Questions
- Do we want the breadcrumb to remain in the global header only, or also appear inside the editor sticky area?
- Should the sticky toolbar include all buttons or a compact subset on small screens?
