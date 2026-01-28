## 2026-01-28 - Missing ARIA Labels on Icon-Only Buttons
**Learning:** The `ToolbarButton` component accepted a `title` prop for tooltips but failed to use it for the `aria-label` attribute, leaving icon-only buttons inaccessible to screen readers. This pattern of using `title` without `aria-label` was consistent across all editor toolbar buttons.
**Action:** When creating or auditing icon-only buttons, always ensure the `title` prop is also passed as `aria-label` (or explicitly provide an `aria-label`).
