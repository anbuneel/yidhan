# Sticky Editor Toolbar - Implementation Plan

## Problem Statement

When editing long notes in Zenote, the formatting toolbar scrolls out of view, forcing users to scroll back up to change formatting. The title also disappears, losing context of which note is being edited.

### Root Cause

The current toolbar has `position: sticky` but it's nested inside `.rich-text-editor`, which is not a scrolling container. Sticky positioning only works relative to the **nearest scrolling ancestor**. Since the toolbar's parent scrolls with the page (rather than being the scroll container itself), the sticky behavior never activates.

**Current broken structure:**
```
<div className="min-h-screen flex flex-col">        ← Page container
  <div className="sticky top-0 z-10">               ← Header (works - direct child)
    <HeaderShell />
  </div>
  <main className="flex-1">                         ← Main content
    <div className="max-w-[800px] mx-auto">
      <textarea />                                  ← Title
      <div>timestamps</div>
      <div><TagSelector /></div>
      <RichTextEditor>
        <div className="rich-text-editor">          ← Toolbar's parent (NOT a scroll container)
          <div className="sticky top-16 z-10">      ← Toolbar (BROKEN - parent scrolls away)
            ...toolbar buttons...
          </div>
          <EditorContent />
        </div>
      </RichTextEditor>
    </div>
  </main>
</div>
```

---

## Solution: Restructure Component Hierarchy

Move the toolbar outside `RichTextEditor` to be a direct child of the page container, alongside the header. This allows proper sticky positioning relative to the viewport.

**Fixed structure:**
```
<div className="min-h-screen flex flex-col">        ← Page container
  <div className="sticky top-0 z-20">               ← Sticky zone (header + toolbar)
    <HeaderShell />                                 ← Header
    <div className="editor-toolbar-wrapper">        ← Toolbar wrapper
      <EditorToolbar editor={editor} />             ← Toolbar (NOW WORKS)
    </div>
  </div>
  <main className="flex-1">                         ← Main content (scrolls)
    <div className="max-w-[800px] mx-auto">
      <textarea />                                  ← Title
      <div>timestamps</div>
      <div><TagSelector /></div>
      <RichTextEditor>                              ← Content only, no toolbar
        <EditorContent />
      </RichTextEditor>
    </div>
  </main>
</div>
```

---

## Visual Design

### Desktop (scrolled state)
```
┌──────────────────────────────────────────────────────────────────────┐
│ [Zenote / Note Title]                       [Saving...] [🗑] │ [☀] [JD] │  ← Header
├──────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ B  I  U  S  ✦ │ H1 H2 H3 │ • # ☐ │ " <> — │ ↺ ↻              │  │  ← Sticky toolbar
│  └────────────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ...note content continues here...                                   │
│                                                                      │
│  The toolbar stays visible as you scroll through long content.       │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Mobile (scrolled state)
```
┌────────────────────────────────┐
│ [Zenote]       [💾] [🗑] [☀] [JD] │  ← Header row 1
│ Note Title (truncated)        │  ← Header row 2
├────────────────────────────────┤
│ [B][I][U][S] │ [H1][H2][H3]   │  ← Toolbar row 1
│ [•][#][☐] │ ["][<>][—][↺][↻] │  ← Toolbar row 2
├────────────────────────────────┤
│ ...content...                  │
└────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Extract Toolbar into Separate Component

Create a new `EditorToolbar.tsx` component that accepts the Tiptap `editor` instance as a prop.

**New file: `src/components/EditorToolbar.tsx`**

```tsx
import type { Editor } from '@tiptap/react';

interface EditorToolbarProps {
  editor: Editor | null;
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  if (!editor) return null;

  return (
    <div className="editor-toolbar ...">
      {/* Move all toolbar buttons here from RichTextEditor.tsx */}
    </div>
  );
}
```

**Changes:**
- Move `ToolbarButton` component to new file
- Move `ToolbarDivider` component to new file
- Move all toolbar JSX from `RichTextEditor.tsx`
- Accept `editor` as prop instead of using internal ref

### Step 2: Expose Editor Instance from RichTextEditor

Modify `RichTextEditor.tsx` to expose the editor instance to parent components.

**Option A: Callback ref pattern**
```tsx
interface RichTextEditorProps {
  // ... existing props
  onEditorReady?: (editor: Editor) => void;
}

export function RichTextEditor({ onEditorReady, ...props }: RichTextEditorProps) {
  const editor = useEditor({...});

  useEffect(() => {
    if (editor) {
      onEditorReady?.(editor);
    }
  }, [editor, onEditorReady]);

  // Remove toolbar rendering, keep only EditorContent
  return (
    <div className="rich-text-editor">
      <EditorContent editor={editor} />
    </div>
  );
}
```

**Option B: useImperativeHandle pattern** (more React-idiomatic)
```tsx
export interface RichTextEditorRef {
  editor: Editor | null;
}

export const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(
  (props, ref) => {
    const editor = useEditor({...});

    useImperativeHandle(ref, () => ({
      editor,
    }), [editor]);

    return <EditorContent editor={editor} />;
  }
);
```

**Recommendation:** Use Option A (callback) for simplicity.

### Step 3: Update Editor.tsx Layout

Restructure the Editor component to render the toolbar in the sticky zone.

```tsx
export function Editor({ ... }: EditorProps) {
  const [editor, setEditor] = useState<Editor | null>(null);

  // ... existing state and handlers

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg-primary)' }}>

      {/* Sticky Zone: Header + Toolbar */}
      <div className="sticky top-0 z-20" style={{ background: 'var(--color-bg-primary)' }}>
        <HeaderShell
          theme={theme}
          onThemeToggle={onThemeToggle}
          leftContent={leftContent}
          center={centerContent}
          rightActions={rightActions}
          onSettingsClick={onSettingsClick}
        />

        {/* Toolbar - now in sticky zone */}
        <div className="max-w-[800px] mx-auto px-10">
          <EditorToolbar editor={editor} />
        </div>
      </div>

      {/* Scrollable Content */}
      <main className="flex-1">
        <div className="max-w-[800px] mx-auto px-10 pb-40">
          {/* Title */}
          <textarea ... />

          {/* Timestamps */}
          <div ... />

          {/* Tag Selector */}
          <TagSelector ... />

          {/* Rich Text Content (no toolbar) */}
          <RichTextEditor
            content={content}
            onChange={handleContentChange}
            onBlur={performSave}
            noteId={note.id}
            autoFocus={hasContent}
            onEditorReady={setEditor}
          />

          {/* Organic Footer */}
          <footer ... />
        </div>
      </main>

      <WhisperBack onClick={handleLogoClick} />
    </div>
  );
}
```

### Step 4: Add Visual Polish

Add styling to make the sticky toolbar feel polished and integrated.

**CSS additions in `index.css`:**

```css
/* Sticky editor zone */
.editor-sticky-zone {
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--color-bg-primary);
}

/* Toolbar wrapper */
.editor-toolbar-wrapper {
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--glass-border);
}

/* Toolbar with subtle shadow when content scrolls behind */
.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 8px;
  border-radius: 8px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--glass-border);
  flex-wrap: wrap;
}

/* Optional: Add shadow on scroll (requires JS) */
.editor-sticky-zone.is-scrolled {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

[data-theme="dark"] .editor-sticky-zone.is-scrolled {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
```

### Step 5: Mobile Optimizations

Ensure the toolbar works well on mobile devices.

**Considerations:**
- Toolbar buttons should be at least 44x44px touch targets
- Toolbar should wrap to multiple rows on narrow screens
- Consider hiding less-used buttons behind a "more" menu on mobile

```css
/* Mobile toolbar adjustments */
@media (max-width: 640px) {
  .editor-toolbar {
    padding: 8px;
    gap: 4px;
  }

  .editor-toolbar button {
    min-width: 36px;
    min-height: 36px;
  }
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/EditorToolbar.tsx` | **NEW** - Extracted toolbar component |
| `src/components/RichTextEditor.tsx` | Remove toolbar, add `onEditorReady` callback |
| `src/components/Editor.tsx` | Restructure layout, render toolbar in sticky zone |
| `src/index.css` | Add sticky zone styles, mobile adjustments |

---

## Testing Checklist

- [ ] Toolbar stays visible when scrolling long notes
- [ ] All formatting buttons work correctly
- [ ] Keyboard shortcuts still work (Ctrl+B, Ctrl+I, etc.)
- [ ] Toolbar appearance matches design system (wabi-sabi aesthetic)
- [ ] Works on desktop (Chrome, Firefox, Safari, Edge)
- [ ] Works on mobile (iOS Safari, Android Chrome)
- [ ] No layout shift when toolbar becomes sticky
- [ ] Undo/redo buttons reflect correct editor state
- [ ] Focus returns to editor after clicking toolbar buttons

---

## Optional Enhancements

### Enhancement A: Scroll Shadow
Add a subtle shadow to the sticky zone when content is scrolled behind it, providing visual feedback that content continues above.

```tsx
const [isScrolled, setIsScrolled] = useState(false);

useEffect(() => {
  const handleScroll = () => {
    setIsScrolled(window.scrollY > 100);
  };
  window.addEventListener('scroll', handleScroll, { passive: true });
  return () => window.removeEventListener('scroll', handleScroll);
}, []);

<div className={`editor-sticky-zone ${isScrolled ? 'is-scrolled' : ''}`}>
```

### Enhancement B: Compact Title in Toolbar
When scrolled past the title, show a compact version in the toolbar area.

```
┌──────────────────────────────────────────────────────────────┐
│ [Zenote / Note Title]                    [Saving...] [🗑] [☀]│
├──────────────────────────────────────────────────────────────┤
│ My Long Note Title...  │ B I U S │ H1 H2 │ • # │ " — │ ↺ ↻ │
└──────────────────────────────────────────────────────────────┘
        ↑
   Compact title (fades in when original scrolls out)
```

### Enhancement C: Floating Toolbar (Alternative)
Instead of sticky, use a floating toolbar that appears near the cursor/selection for quick formatting. More complex but very user-friendly.

---

## Timeline Estimate

This is a focused refactoring task:

1. **Extract toolbar component** - Straightforward code extraction
2. **Wire up editor instance** - Add callback prop pattern
3. **Restructure Editor.tsx** - Move toolbar to sticky zone
4. **CSS polish** - Add visual refinements
5. **Testing** - Cross-browser and mobile verification

---

## Approval Requested

Please review this plan and confirm:

1. **Approach:** Is the component restructuring approach acceptable?
2. **Scope:** Should we include any of the optional enhancements (A, B, or C)?
3. **Mobile:** Any specific mobile considerations to prioritize?

Once approved, implementation can begin.
