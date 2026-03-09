# Editor Calm & Delight Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the editor feel calm and delightful by reducing chrome, improving typography, and adding atmospheric polish.

**Architecture:** 9 changes organized in dependency order — CSS-only quick wins first, then structural component changes, then JS-enhanced atmosphere. The vertical sidebar toolbar (#2) is the biggest change; everything else is low-to-medium effort.

**Tech Stack:** React 19, Tailwind CSS v4, CSS custom properties, Tiptap/ProseMirror

**Decisions doc:** `docs/analysis/editor-calm-delight-review-claude.md`

**Peer reviewed:** Codex CLI, 3 rounds — [plan-review-a3f7c21b.md](../reviews/plan-review-a3f7c21b.md)

---

## Task 1: Ghost-Writing Placeholder (CSS + JSX)

**Files:**
- Modify: `src/components/RichTextEditor.tsx:268-288`

**Step 1: Update placeholder styling**

Change the animated placeholder overlay from body font to display font with ghost-writing feel.

In `RichTextEditor.tsx`, find the `animated-placeholder` div (line ~270) and update its inline styles:

```tsx
<div
  className="animated-placeholder"
  aria-hidden="true"
  style={{
    position: 'absolute',
    top: 0,
    left: 0,
    pointerEvents: 'none',
    fontFamily: 'var(--font-display)',
    fontSize: '1.4rem',
    fontWeight: 400,
    fontStyle: 'italic',
    color: 'var(--color-text-tertiary)',
    opacity: 0.35,
    transition: 'opacity 0.8s ease-in-out',
  }}
>
  {PLACEHOLDER_MESSAGES[placeholderIndex]}
</div>
```

Changes from current:
- `fontFamily`: `var(--font-body)` → `var(--font-display)` (Cormorant Garamond)
- `fontSize`: `1.2rem` → `1.4rem` (slightly larger)
- Added `fontStyle: 'italic'` (ghost handwriting feel)
- `opacity`: `0.6` → `0.35` (more ghostly)
- `transition` duration: `0.5s` → `0.8s` (slower, calmer fade)

**Step 2: Verify**

Run: `npm run typecheck`
Visual: Open a new note, confirm placeholder shows in italic Cormorant Garamond, faded and larger.

**Step 3: Commit**

```bash
git add src/components/RichTextEditor.tsx
git commit -m "style: ghost-writing placeholder — Cormorant italic, larger, lower opacity"
```

---

## Task 2: Decorative Horizontal Rule (CSS)

**Files:**
- Modify: `src/index.css:631-635`

**Step 1: Replace plain HR with three centered dots**

Find the current HR styles in `index.css` (line ~631):

```css
/* Current */
.rich-text-editor .ProseMirror hr {
  border: none;
  border-top: 1px solid var(--glass-border);
  margin: 2rem 0;
}
```

Replace with:

```css
/* Decorative three-dot divider — matches editor footer motif */
.rich-text-editor .ProseMirror hr {
  border: none;
  margin: 2.5rem 0;
  height: auto;
  overflow: visible;
}

.rich-text-editor .ProseMirror hr::after {
  content: '· · ·';
  display: block;
  text-align: center;
  font-size: 1.25rem;
  letter-spacing: 0.5em;
  color: var(--color-text-tertiary);
  opacity: 0.5;
}
```

**Step 2: Verify**

Visual: Insert a divider via `/divider` slash command. Confirm three centered dots appear instead of a line. Check both light and dark themes.

**Step 3: Commit**

```bash
git add src/index.css
git commit -m "style: decorative horizontal rule — three dots matching footer motif"
```

---

## Task 3: Editorial Blockquote (CSS)

**Files:**
- Modify: `src/index.css:593-599`

**Step 1: Update blockquote styling**

Find the current blockquote styles (line ~593):

```css
/* Current */
.rich-text-editor .ProseMirror blockquote {
  border-left: 3px solid var(--color-accent);
  padding-left: 1.25rem;
  margin: 1.25rem 0;
  font-style: italic;
  color: var(--color-text-secondary);
}
```

Replace with:

```css
/* Editorial blockquote — magazine pull-quote feel */
.rich-text-editor .ProseMirror blockquote {
  border-left: 2px solid color-mix(in srgb, var(--color-accent) 40%, transparent);
  padding-left: 1.5rem;
  margin: 1.75rem 0;
  font-family: var(--font-display);
  font-size: 1.35rem;
  font-style: italic;
  line-height: 1.6;
  letter-spacing: -0.01em;
  color: var(--color-text-secondary);
}
```

Changes:
- `font-family`: Added `var(--font-display)` (Cormorant Garamond)
- `font-size`: Default → `1.35rem` (slightly larger than body 1.2rem)
- `border-left`: `3px solid accent` → `2px solid accent at 40%` (subtler)
- `padding-left`: `1.25rem` → `1.5rem`
- `margin`: `1.25rem` → `1.75rem` (more breathing room)
- Added `line-height: 1.6` and `letter-spacing: -0.01em`

**Step 2: Verify**

Visual: Insert a blockquote via `/quote`. Confirm it renders in Cormorant Garamond italic, slightly larger. Check both themes.

**Step 3: Commit**

```bash
git add src/index.css
git commit -m "style: editorial blockquote — Cormorant italic pull-quote feel"
```

---

## Task 4: Delete Dialog Brand Voice (JSX)

**Files:**
- Modify: `src/components/Editor.tsx:1308-1378`
- Modify: `src/components/Editor.test.tsx` (update hard-coded dialog strings)

**Step 1: Update dialog text and button labels**

Find the delete dialog title (line ~1316). Replace the dialog content:

Title: `"Delete this note?"` → `"Let this note fade?"`

Description (line ~1327): `"This action cannot be undone. The note will be permanently removed from your library."` → `"It will rest in Faded Notes for 30 days, then quietly disappear."`

Cancel button text: `"Cancel"` → `"Keep writing"`

Delete button text: `"Delete"` → `"Let it fade"`

Also update the `aria-labelledby` title id text if needed, and the dialog title `id="delete-dialog-title"`.

**Step 1b: Add `aria-describedby` to the dialog**

The dialog currently has `aria-labelledby="delete-dialog-title"` but no `aria-describedby`. Add an `id="delete-dialog-description"` to the description paragraph and wire it:

```tsx
<div
  role="alertdialog"
  aria-labelledby="delete-dialog-title"
  aria-describedby="delete-dialog-description"
>
```

**Step 2: Update test assertions in `Editor.test.tsx`**

The existing tests at lines 246–290 hard-code the old strings. Update:
- `'Delete this note?'` → `'Let this note fade?'`
- `'Cancel'` → `'Keep writing'`
- Any `getByText('Delete')` for the confirm button → `'Let it fade'`

**Step 3: Verify**

Run: `npm run typecheck`
Run: `npm run test:run` — ensure updated tests pass.
Visual: Click delete on a note, confirm new brand language appears.

**Step 4: Commit**

```bash
git add src/components/Editor.tsx src/components/Editor.test.tsx
git commit -m "style: delete dialog brand voice — 'Let this note fade?' + aria-describedby"
```

---

## Task 5: Collapse Metadata Stack (JSX + CSS)

**Files:**
- Modify: `src/components/Editor.tsx:1137-1191` (title zone restructure)
- Modify: `src/components/TagSelector.tsx` (add inline pill variant)
- Modify: `src/index.css` (add hover-reveal CSS)

This is the structural change that merges timestamps and tags from separate rows into a compact title zone.

**Step 1: Add CSS for hover-reveal timestamps**

Add to `src/index.css` after the `.editor-writing-area` styles (~line 1083):

```css
/* Title zone — hover-reveal timestamps */
.editor-title-zone .editor-timestamps {
  max-height: 0;
  opacity: 0;
  overflow: hidden;
  transition: max-height 300ms ease, opacity 300ms ease;
}

.editor-title-zone:hover .editor-timestamps,
.editor-title-zone:focus-within .editor-timestamps,
.editor-title-zone.timestamps-visible .editor-timestamps {
  max-height: 2rem;
  opacity: 1;
}
```

**Step 2: Add inline tag pills to TagSelector**

Add an `inline` variant to `TagSelector.tsx`. The inline variant shows selected tags as pills with a small `+ tag` button, and the dropdown opens on clicking any pill or the `+` button.

Add a new prop `variant?: 'dropdown' | 'inline'` (default `'dropdown'`). When `variant="inline"`, render:

**IMPORTANT:** Tag pills MUST use `<button>` elements (not `<span>`) for keyboard accessibility and screen reader support. The inline wrapper MUST keep `className="relative"` so the existing absolute-positioned dropdown anchors correctly. Add `onClick` with `e.stopPropagation()` on all interactive elements to prevent bubbling to the parent title-zone wrapper.

```tsx
{variant === 'inline' ? (
  <div className="relative flex items-center gap-1.5 flex-wrap" ref={containerRef}>
    {selectedTags.map((tag) => (
      <button
        key={tag.id}
        type="button"
        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium cursor-pointer transition-opacity duration-200 hover:opacity-80"
        style={{
          background: `${TAG_COLORS[tag.color]}15`,
          color: TAG_COLORS[tag.color],
          borderRadius: '4px',
          border: 'none',
        }}
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: TAG_COLORS[tag.color] }}
          aria-hidden="true"
        />
        {tag.name}
      </button>
    ))}
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
      aria-expanded={isOpen}
      aria-haspopup="listbox"
      aria-label="Add tag"
      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs transition-colors duration-200 rounded hover:bg-[var(--color-bg-tertiary)]"
      style={{
        fontFamily: 'var(--font-body)',
        color: 'var(--color-text-tertiary)',
      }}
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
      {selectedTags.length === 0 && <span>Add tag</span>}
    </button>

    {/* Reuse existing dropdown — anchored by the `relative` wrapper above */}
    {isOpen && (
      /* ...existing dropdown JSX, position absolute... */
    )}
  </div>
) : (
  /* ...existing dropdown trigger variant... */
)}
```

Keep the existing dropdown variant as the default — only the editor uses `inline`.

**Step 3: Restructure title zone in Editor.tsx**

Replace lines 1137–1191 with the new collapsed layout:

```tsx
{/* Title Zone — timestamps reveal on hover/tap */}
<div
  className={`editor-title-zone ${showTimestamps ? 'timestamps-visible' : ''}`}
  onClick={isMobile ? handleTimestampToggle : undefined}
>
  {/* Title */}
  <textarea
    ref={titleRef}
    value={title}
    onChange={handleTitleChange}
    onKeyDown={handleTitleKeyDown}
    onBlur={performSave}
    placeholder="Untitled"
    className="w-full font-semibold bg-transparent outline-none resize-none overflow-hidden leading-tight"
    style={{
      fontFamily: 'var(--font-display)',
      fontSize: '2.25rem',
      color: 'var(--color-text-primary)',
      letterSpacing: '-0.02em',
      caretColor: 'var(--color-accent)',
    }}
    rows={1}
  />

  {/* Timestamps — hidden until hover (desktop) or tap (mobile) */}
  <div
    className="editor-timestamps text-xs focus-mode-target"
    style={{
      fontFamily: 'var(--font-body)',
      color: 'var(--color-text-tertiary)',
    }}
  >
    Created {formatShortDate(note.createdAt)} · Edited {formatRelativeTime(note.updatedAt)}
  </div>

  {/* Inline tag pills — always visible */}
  <div className="mt-1 mb-2 focus-mode-target">
    <TagSelector
      tags={tags}
      selectedTagIds={note.tags.map((t) => t.id)}
      onToggleTag={(tagId) => onToggleTag(note.id, tagId)}
      onCreateTag={onCreateTag}
      variant="inline"
    />
  </div>
</div>
```

Add `showTimestamps` state and `handleTimestampToggle` in the component:

```tsx
const [showTimestamps, setShowTimestamps] = useState(false);

const handleTimestampToggle = useCallback(() => {
  if (isMobile) {
    setShowTimestamps(prev => !prev);
  }
}, [isMobile]);
```

**IMPORTANT:** Add `setShowTimestamps(false)` to the note-switch reset effect (Editor.tsx ~line 106–126, alongside `setIsFocusMode(false)`).

**Step 4: Verify**

Run: `npm run typecheck && npm run test:run`
Visual:
- Desktop: Hover over title zone, timestamps appear. Move away, they fade.
- Tags show as inline pills always.
- Mobile: Tap title zone toggles timestamps.

**Step 5: Commit**

```bash
git add src/components/Editor.tsx src/components/TagSelector.tsx src/index.css
git commit -m "feat: collapse metadata stack — hover-reveal timestamps, inline tag pills"
```

---

## Task 6: Vertical Left Sidebar Toolbar (Component + CSS)

**Files:**
- Create: `src/components/EditorSidebar.tsx` (new vertical toolbar component)
- Modify: `src/components/Editor.tsx` (add sidebar alongside existing toolbar)
- Modify: `src/index.css` (sidebar styles + frosted glass + scroll offsets)
- Modify: `src/components/EditorToolbar.tsx` (extract shared SVG icons)

This is the biggest change. The horizontal toolbar moves to a slim vertical strip in the left margin on wide screens. Mobile bottom toolbar is unchanged.

**IMPORTANT — Medium-width fallback:** On screens between 768px and 1099px, the sidebar is hidden (not enough margin space) but the mobile bottom bar doesn't render either (not `isMobile`). To prevent a formatting-UI dead zone, **keep the existing inline horizontal toolbar as a fallback** for this width range. The sidebar replaces it only at ≥1100px. Implementation: render both, use CSS `display: none` to toggle visibility based on viewport width.

**Step 0: Extract shared icon SVGs**

Before creating the sidebar, extract the SVG icon paths from `EditorToolbar.tsx` into a shared location (e.g., inline constants at the top of both files, or a small `editorIcons.ts` utility). This prevents duplicating 12+ SVG definitions. The `ToolbarButton` component itself is simple enough to redefine in the sidebar — it's just a styled `<button>` wrapper.

**Step 1: Create EditorSidebar component**

Create `src/components/EditorSidebar.tsx`:

The sidebar shows a vertical column of icon buttons for formatting. It sits in the left margin of the editor writing area, visible only on desktop (hidden below `lg` breakpoint or when screen is too narrow). Uses the same ToolbarButton pattern but vertically stacked.

**Button selection for sidebar** (reduced from 18 to essentials):
- Bold, Italic, Highlight (inline formatting)
- Divider
- H1, H2, H3 (headings)
- Divider
- Bullet list, Task list
- Divider
- Quote, Code block
- Divider (gap)
- Focus mode toggle (at bottom)

Less-used items (Underline, Strike, Numbered list, HR, Undo, Redo) remain accessible via keyboard shortcuts and slash commands.

The component receives `editor` and `onToggleFocusMode` props, same as EditorToolbar.

```tsx
import type { Editor } from '@tiptap/react';

interface EditorSidebarProps {
  editor: Editor | null;
  onToggleFocusMode?: () => void;
}

export function EditorSidebar({ editor, onToggleFocusMode }: EditorSidebarProps) {
  if (!editor) return null;

  return (
    <div className="editor-sidebar focus-mode-target">
      {/* Formatting buttons — vertical stack */}
      <div className="editor-sidebar-buttons">
        {/* Inline formatting */}
        <SidebarButton ... />
        {/* etc — use shared SVG icons */}
      </div>

      {/* Focus mode — separated at bottom */}
      {onToggleFocusMode && (
        <div className="editor-sidebar-bottom">
          <SidebarButton ... />
        </div>
      )}
    </div>
  );
}
```

Use `w-7 h-7` buttons (slightly smaller than toolbar's `w-8 h-8`) with the same hover/active styling pattern from `EditorToolbar.tsx` `ToolbarButton`.

**Step 2: Add sidebar CSS**

Add to `src/index.css` after the toolbar sticky styles:

```css
/* Vertical sidebar toolbar — slim, ghostly, left margin */
.editor-sidebar {
  position: fixed;
  left: max(calc((100vw - 900px) / 2 - 56px), 12px);
  top: 50%;
  transform: translateY(-50%);
  z-index: 15;
  display: none;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 4px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--color-bg-secondary) 60%, transparent);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  opacity: 0.4;
  transition: opacity 300ms ease;
}

/* Show only on wide screens where there's margin space */
@media (min-width: 1100px) {
  .editor-sidebar {
    display: flex;
  }
}

.editor-sidebar:hover,
.editor-sidebar:focus-within {
  opacity: 0.95;
}

.editor-sidebar-buttons {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.editor-sidebar-bottom {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--glass-border);
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Sidebar button */
.editor-sidebar button {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: all 200ms ease;
  color: var(--color-text-secondary);
}

.editor-sidebar button:hover {
  background: var(--color-bg-tertiary);
}

/* Sidebar divider */
.editor-sidebar-divider {
  width: 16px;
  height: 1px;
  margin: 4px 0;
  background: var(--glass-border);
  opacity: 0.5;
}
```

**Step 3: Update Editor.tsx layout**

**Do NOT remove the desktop inline toolbar.** Instead, wrap it with a CSS class that hides it at ≥1100px (when the sidebar is visible):

```tsx
{/* Inline toolbar — visible on medium desktop (768-1099px), hidden when sidebar shows */}
{!isMobile && (
  <div className="editor-toolbar-sticky editor-toolbar-medium-fallback focus-mode-target">
    <EditorToolbar editor={editor} onToggleFocusMode={handleToggleFocusMode} />
  </div>
)}

{/* Vertical sidebar — desktop only, visible at ≥1100px via CSS */}
{!isMobile && (
  <EditorSidebar editor={editor} onToggleFocusMode={handleToggleFocusMode} />
)}
```

Add CSS for the medium-width fallback:
```css
/* Hide inline toolbar when sidebar is visible */
@media (min-width: 1100px) {
  .editor-toolbar-medium-fallback {
    display: none;
  }
}
```

The mobile bottom toolbar remains unchanged (lines 1261–1264).

**Step 3b: Update desktop scroll offsets**

After removing the sticky toolbar at ≥1100px, update `index.css` scroll padding. Add a media query:

```css
/* Wide screens: sidebar replaces toolbar, only header is sticky */
@media (min-width: 1100px) {
  .editor-sticky-zone + main {
    scroll-padding-top: 72px; /* Header only, no toolbar */
  }
  textarea:focus,
  .ProseMirror:focus {
    scroll-margin-top: 72px;
  }
}
```

**Step 4: Verify**

Run: `npm run typecheck && npm run test:run`
Visual:
- Wide screen (>1100px): Sidebar visible in left margin, ghostly, brightens on hover/focus
- Medium screen (768-1100px): Inline toolbar visible, sidebar hidden
- Mobile: Bottom toolbar unchanged
- Focus mode: Sidebar fades out with other chrome

**Step 5: Commit**

```bash
git add src/components/EditorSidebar.tsx src/components/Editor.tsx src/components/EditorToolbar.tsx src/index.css
git commit -m "feat: vertical left sidebar toolbar — slim, ghostly, frosted glass"
```

---

## Task 7: Title-to-Body Spacing + Decorative Gradient Line (CSS + JSX)

**Files:**
- Modify: `src/components/Editor.tsx` (add gradient line element)
- Modify: `src/index.css` (gradient line styles)

This task depends on Tasks 5 and 6 being complete (metadata collapsed, toolbar moved to sidebar).

**Step 1: Add gradient line element in Editor.tsx**

After the title zone `</div>` and before `<RichTextEditor>`, add:

```tsx
{/* Decorative divider — gradient line between title zone and body */}
<div className="editor-title-divider focus-mode-target" aria-hidden="true" />

{/* Rich Text Content — generous top margin for breathing room */}
<div className="mt-8">
  <RichTextEditor
    content={content}
    onChange={handleContentChange}
    onBlur={performSave}
    noteId={note.id}
    autoFocus={hasContent}
    onEditorReady={setEditor}
  />
</div>
```

**Step 2: Add gradient line CSS**

Add to `src/index.css` after the title zone styles:

```css
/* Decorative gradient line — title zone to body transition */
.editor-title-divider {
  height: 1px;
  margin: 1rem 0 0;
  background: linear-gradient(
    to right,
    transparent 0%,
    color-mix(in srgb, var(--color-accent) 25%, transparent) 30%,
    color-mix(in srgb, var(--color-accent) 25%, transparent) 70%,
    transparent 100%
  );
  opacity: 0.6;
}

[data-theme="dark"] .editor-title-divider {
  opacity: 0.4;
}
```

**Step 3: Verify**

Visual: Open a note. Confirm a faint accent-colored gradient line appears between tags and body, with generous whitespace below it. Fades at both edges. Check both themes. Confirm it hides in focus mode.

**Step 4: Commit**

```bash
git add src/components/Editor.tsx src/index.css
git commit -m "style: title-to-body gradient divider with generous spacing"
```

---

## Task 8: Viewport-Following Manuscript Glow (JS + CSS)

**Files:**
- Modify: `src/components/Editor.tsx` (add scroll listener for glow position)
- Modify: `src/index.css:1062-1083` (change glow from `::after` to inline element)

**Step 1: Convert glow from CSS pseudo-element to a positioned div**

The current `::after` on `.editor-writing-area` is fixed at `50% 40%`. We need a div whose `top` position updates on scroll to follow the viewport center.

Remove the `::after` rules from `index.css` (lines 1062–1083):

```css
/* Remove these */
.editor-writing-area::after { ... }
[data-theme="dark"] .editor-writing-area::after { ... }
```

Add new CSS for the glow div:

```css
/* Viewport-following manuscript glow */
.editor-manuscript-glow {
  position: absolute;
  left: 0;
  right: 0;
  height: 600px;
  pointer-events: none;
  z-index: 1;
  transition: top 800ms ease-out;
  /* Light theme: warm terracotta glow */
  background: radial-gradient(
    ellipse 80% 50% at 50% 50%,
    rgba(194, 86, 52, 0.12) 0%,
    transparent 70%
  );
}

[data-theme="dark"] .editor-manuscript-glow {
  background: radial-gradient(
    ellipse 80% 50% at 50% 50%,
    rgba(212, 175, 55, 0.12) 0%,
    transparent 70%
  );
}
```

**Step 2: Add glow div and scroll tracking in Editor.tsx**

**IMPORTANT:** Use a ref (not React state) to update the glow position. `useState` would cause the entire Editor to re-render on every scroll frame, which is unnecessary for a purely visual effect.

Add a glow ref and update it on scroll via direct DOM mutation:

```tsx
const glowRef = useRef<HTMLDivElement>(null);

// Update glow position on scroll — direct DOM mutation, no re-renders
useEffect(() => {
  const scrollEl = scrollContainerRef.current;
  const glowEl = glowRef.current;
  if (!scrollEl || !glowEl) return;

  // Get the writing area element for coordinate-space correction.
  // The glow is positioned inside .editor-writing-area, which has an offset
  // from the scroll container top (sticky header, resume chip, banners sit above it).
  const writingArea = glowEl.closest('.editor-writing-area') as HTMLElement | null;

  let ticking = false;
  const handleScroll = () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const scrollTop = scrollEl.scrollTop;
        const areaOffset = writingArea?.offsetTop ?? 0;
        const areaHeight = writingArea?.scrollHeight ?? scrollEl.scrollHeight;
        // Compute viewport center relative to the writing area, not the scroll container
        const viewportCenter = scrollTop + scrollEl.clientHeight * 0.4 - areaOffset;
        // Clamp to prevent the glow from exceeding the writing area bounds
        const maxTop = areaHeight - 600;
        const top = Math.max(0, Math.min(viewportCenter - 300, maxTop));
        glowEl.style.top = `${top}px`;
        ticking = false;
      });
      ticking = true;
    }
  };

  scrollEl.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll(); // Initial position

  return () => scrollEl.removeEventListener('scroll', handleScroll);
}, []);
```

Add the glow div inside `.editor-writing-area`, as the first child:

```tsx
<div className="max-w-[900px] mx-auto px-4 sm:px-10 pt-2 pb-12 editor-writing-area">
  {/* Viewport-following manuscript glow — position updated via ref, not state */}
  <div
    ref={glowRef}
    className="editor-manuscript-glow"
    aria-hidden="true"
  />
  {/* ...rest of editor content */}
</div>
```

**Note:** This scroll listener should ideally be merged with the existing scroll handler in Editor.tsx (~line 187–234) that handles resume/save, rather than adding a second listener. During implementation, consider combining them into a single `handleScroll` callback.

**Step 3: Verify**

Visual: Open a long note, scroll down. Confirm the warm glow follows roughly where you're reading/writing. Check both themes. The transition should be smooth (800ms ease-out) and not janky.

Run: `npm run typecheck`

**Step 4: Commit**

```bash
git add src/components/Editor.tsx src/index.css
git commit -m "feat: viewport-following manuscript glow — illuminates where you write"
```

---

## Task 9: Final Verification & Cleanup

**Step 1: Run full check**

```bash
npm run check
```

This runs typecheck + lint + test + build. Fix any issues.

**Step 2: Visual QA checklist**

Test in both Kintsugi (light) and Midnight (dark) themes:

- [ ] Empty note: ghost-writing placeholder in italic Cormorant, faded
- [ ] Title zone: timestamps hidden by default, appear on hover (desktop) / tap (mobile)
- [ ] Tags: inline pills always visible, `+ tag` opens dropdown
- [ ] Sidebar toolbar: visible on wide screens (>1100px), ghostly, brightens on hover/focus
- [ ] Sidebar: frosted glass effect (backdrop-filter blur)
- [ ] Sidebar: hidden on medium/narrow screens, inline toolbar visible instead
- [ ] Mobile: bottom toolbar unchanged, no sidebar
- [ ] Gradient line: visible between title zone and body
- [ ] Body spacing: generous `mt-8` gap before content
- [ ] Horizontal rule: three dots `· · ·` centered
- [ ] Blockquote: Cormorant Garamond italic, slightly larger
- [ ] Delete dialog: "Let this note fade?" with brand language
- [ ] Manuscript glow: follows scroll position smoothly
- [ ] Focus mode: all chrome hides (sidebar, timestamps, tags, gradient line)
- [ ] Focus mode: glow still visible
- [ ] Keyboard shortcuts still work (Ctrl+B, Ctrl+I, etc.)
- [ ] Slash commands still work

**Step 3: Commit final cleanup if needed**

```bash
git add -A
git commit -m "fix: editor calm & delight — final cleanup and QA fixes"
```

---

## File Summary

| File | Action | Tasks |
|------|--------|-------|
| `src/components/RichTextEditor.tsx` | Modify | 1 (placeholder) |
| `src/index.css` | Modify | 2, 3, 5, 6 (sidebar + scroll offsets), 7, 8 |
| `src/components/Editor.tsx` | Modify | 4, 5, 7, 8 |
| `src/components/Editor.test.tsx` | Modify | 4 (update dialog string assertions) |
| `src/components/TagSelector.tsx` | Modify | 5 (inline variant with `<button>` pills) |
| `src/components/EditorSidebar.tsx` | Create | 6 (new component) |
| `src/components/EditorToolbar.tsx` | Modify | 6 (extract shared SVG icons) |

## Execution Notes

- Tasks 1–4 are independent and can be done in any order (or parallel)
- Task 5 (metadata collapse) should be done before Task 7 (spacing)
- Task 6 (sidebar) should be done before Task 7 (spacing)
- Task 8 (glow) should be done AFTER Tasks 5+6 are stable (touches same scroll lifecycle)
- Task 9 is always last

## Peer Review Changes

### Round 1 (9 findings → all addressed)
1. **Task 4:** Added `aria-describedby`, added `Editor.test.tsx` to file list for test string updates
2. **Task 5:** Changed tag pills from `<span>` to `<button>`, added `e.stopPropagation()`, kept `relative` on inline wrapper, added `showTimestamps` reset on note switch
3. **Task 6:** Keep inline toolbar as medium-width fallback (768–1099px), extract shared SVG icons from EditorToolbar.tsx, add `:focus-within` to sidebar, update desktop scroll offsets
4. **Task 8:** Use ref instead of React state for glow position (no re-renders), clamp glow position, recommend merging with existing scroll handler

### Round 2 (2 findings → all addressed)
1. **Task 8:** Fixed glow coordinate space — compute position relative to `.editor-writing-area` offset, not scroll container origin
2. **Task 5:** Added `aria-label="Add tag"` to the `+` button for icon-only state. Pre-existing `listbox` role mismatch deferred (out of scope).
