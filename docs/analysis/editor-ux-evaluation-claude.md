# Yidhan Editor UI/UX Evaluation

**Version:** 1.0
**Last Updated:** 2026-01-26
**Status:** Living Document
**Author:** Claude (Opus 4.5)
**Consulted:** Frontend Design Skill

---

## Original Prompt

> Use the frontend-design skill to do a full evaluation of the note editor UI/UX. What can be improved to make Yidhan the best in class writing tool?

---

## Executive Summary

Yidhan's editor has a **strong foundation** with its wabi-sabi aesthetic, but it's currently playing it safe. The dark theme with gold accents is beautiful, but the *writing experience itself* doesn't yet match the sophistication of the visual design. To become best-in-class, Yidhan needs to make the **act of writing feel as intentional as the visual design**.

### Current Strengths
- Beautiful dark theme with distinctive forest green + gold palette
- Cormorant Garamond display font adds character
- Functional slash commands
- Good auto-save with visual feedback
- Thoughtful features (resume position, WhisperBack)

### Key Opportunities
- **Typography could be more refined** in the editor body
- **Toolbar feels utilitarian** rather than designed
- **Writing area lacks "presence"** - feels like a text box
- **Mobile editor needs more love**
- **Transitions between states feel abrupt**

---

## Detailed Analysis

### 1. Typography (Rating: 7/10)

**Current State:**
- Title: Cormorant Garamond 2.25rem — Beautiful
- Body: Inter 1.2rem, font-weight 300, line-height 1.9 — Functional but generic
- Headings inside content: Cormorant Garamond — Good continuity

**Issues:**
- Inter is the "default AI font" — it's everywhere, making Yidhan feel less distinctive
- Line-height 1.9 is generous but the font-weight 300 makes text feel thin/weak
- No optical adjustments for different sizes

**Recommendations:**
| Element | Current | Proposed |
|---------|---------|----------|
| Body font | Inter 300 | **Literata** or **Source Serif 4** (400) — warmer, more readable |
| Body weight | 300 | 400 (regular) for better contrast |
| Line-height | 1.9 | 1.75 — slightly tighter for better rhythm |
| Paragraph spacing | 0.75em | 1em — more breathing room between thoughts |

### 2. Toolbar Design (Rating: 6/10)

**Current State:**
- Gray background bar with icon buttons
- Wraps on mobile
- Becomes sticky on scroll

**Issues:**
- Looks like a "default rich text toolbar" — no personality
- All buttons have equal visual weight
- No grouping hierarchy beyond dividers
- Mobile: wraps to 2 rows awkwardly

**Recommendations:**

**Option A: Contextual Toolbar (Recommended)**
- Hide toolbar by default
- Show floating toolbar when text is selected (like Medium/Notion)
- Only show block-level tools (headings, lists) in a subtle side gutter

**Option B: Refined Static Toolbar**
- Group buttons into "pods" with subtle background
- Add subtle hover animations (not just color change)
- Consider icon-only for common actions, expand on hover for rare ones
- Mobile: Show only essential 5-6 tools, put rest in overflow menu

```
Current:  [B][I][U][S][H] | [H1][H2][H3] | [•][1.][☑] | ["][</>][—] | [↩][↪]

Proposed: [Text ▾] [B I U] | [Structure ▾] | [Insert ▾] | ↩ ↪
           └─ expands to full options on click
```

### 3. Writing Canvas (Rating: 6.5/10)

**Current State:**
- 800px max-width, centered
- Adequate padding (px-4 sm:px-10)
- No visual distinction between writing area and background

**Issues:**
- The writing area doesn't feel like a "space" — it's just text on a background
- No sense of the "page" metaphor (even subtle)
- Cursor/caret styling is default browser

**Recommendations:**

1. **Subtle page presence** (not a white rectangle, but a hint):
   ```css
   .editor-canvas {
     background: linear-gradient(
       to bottom,
       transparent 0%,
       rgba(255,255,255,0.02) 100px,
       rgba(255,255,255,0.02) calc(100% - 100px),
       transparent 100%
     );
   }
   ```

2. **Custom cursor/caret** in accent color (gold):
   ```css
   .ProseMirror {
     caret-color: var(--color-accent);
   }
   ```

3. **First-line styling** for new paragraphs:
   ```css
   .ProseMirror p:first-of-type::first-letter {
     font-size: 1.1em;
     font-weight: 500;
   }
   ```

### 4. Focus & Flow States (Rating: 5/10)

**Current State:**
- No focus mode
- No typewriter mode
- Writing feels the same whether you're in "flow" or not

**Recommendations:**

1. **Subtle Focus Mode** (toggle in toolbar or keyboard shortcut):
   - Dim everything except current paragraph
   - Hide toolbar, header fades to minimal
   - Add subtle vignette to edges

2. **Typewriter Mode** (optional):
   - Keep current line vertically centered
   - Smooth scroll as you type

3. **Writing Session Indicator**:
   - Subtle word/character count that appears on hover
   - Optional "writing time" indicator

### 5. Mobile Experience (Rating: 6/10)

**Current State:**
- Functional but cramped
- Toolbar wraps to 2 lines
- Title "Untitled" appears twice (header + content)

**Issues:**
- Header takes too much space
- Toolbar is overwhelming
- No mobile-specific optimizations for thumb zones

**Recommendations:**

1. **Collapse header to minimal on scroll**:
   - Just "← Back" and save status
   - Title appears in content area anyway

2. **Bottom toolbar on mobile**:
   - Move formatting to bottom of screen (thumb-friendly)
   - iOS keyboard accessory view pattern

3. **Gesture shortcuts**:
   - Two-finger swipe left = back
   - Pull down from title = add tag

### 6. Micro-interactions & Polish (Rating: 5.5/10)

**Current State:**
- Save indicator exists (Saving... → Saved ✓)
- Basic transitions
- Card entrance animations exist

**Missing Delight:**
- No cursor trail or typing feedback
- No subtle sounds (optional)
- Placeholder text is static
- No "ink settling" animation when you stop typing

**Recommendations:**

1. **Animated placeholder**:
   ```
   "Start writing..." → fades to "What's on your mind?" → "Type / for commands"
   ```
   (Subtle rotation every 30 seconds if empty)

2. **"Ink settle" effect**:
   - When you pause typing, text subtly "settles" (0.5px shift, 100ms)
   - Already have the keyframe, just not using it in editor

3. **Save indicator refinement**:
   - Instead of text, use a subtle golden pulse around the edges
   - Or a tiny kintsugi crack that "heals" when saved

### 7. Slash Commands (Rating: 7.5/10)

**Current State:**
- Works well
- Good command list
- Clean dropdown styling

**Enhancements:**
1. Add **icons** to each command (visual scanning)
2. Add **keyboard hint** (e.g., "↵" after selected item)
3. Consider **inline preview** for some commands (e.g., show date format)
4. Add **/link** command to insert/paste URLs nicely

---

## Priority Recommendations

### Quick Wins (1-2 days each)

| Change | Impact | Effort |
|--------|--------|--------|
| Change caret color to gold | High | 5 min |
| Refine body typography (weight, line-height) | High | 30 min |
| Add icons to slash commands | Medium | 2 hrs |
| Improve mobile toolbar (overflow menu) | High | 4 hrs |
| Animated placeholder text | Medium | 2 hrs |

### Medium Investments (3-5 days)

| Change | Impact | Effort |
|--------|--------|--------|
| Floating selection toolbar | High | 3 days |
| Focus mode | High | 2 days |
| Bottom toolbar on mobile | High | 3 days |
| Subtle page presence effect | Medium | 1 day |

### Longer Term (1-2 weeks)

| Change | Impact | Effort |
|--------|--------|--------|
| Typewriter mode | Medium | 1 week |
| Custom font exploration (Literata?) | High | 1 week |
| Writing session stats | Low | 3 days |

---

## The "One Thing" To Remember

If Yidhan does **one thing** to become unforgettable, it should be this:

> **Make the cursor feel alive.**

A gold cursor that subtly pulses, leaves a faint trail, or responds to typing rhythm would make Yidhan feel unlike any other editor. It's the one element every writer stares at constantly — make it beautiful.

---

## Implementation Progress

### Quick Wins (Completed)
- [x] Gold caret color (`caret-color: var(--color-accent)`)
- [x] Typography refinements (font-weight 400, line-height 1.75, paragraph spacing 1em)
- [x] Slash command icons (13 SVG icons with accent color)
- [x] Animated placeholder text (rotates every 30s: "Start writing..." → "What's on your mind?" → "Type / for commands")

### Quick Wins (Remaining)
- [ ] Mobile toolbar overflow menu (~4 hrs)

### Categories
- [x] 1. Typography refinements *(partial - quick wins done)*
- [ ] 2. Toolbar redesign
- [ ] 3. Writing canvas enhancements
- [ ] 4. Focus & flow states
- [ ] 5. Mobile experience
- [x] 6. Micro-interactions & polish *(partial - animated placeholder done)*
- [x] 7. Slash command enhancements *(icons added)*
