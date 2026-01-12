# Zenote Landing Page Redesign: Unified Demo Strategy

**Version:** 1.0
**Last Updated:** 2026-01-12
**Status:** Living Document
**Author:** Claude (Opus 4.5)
**Consulted:** Frontend Design Skill

---

## Original Prompt

> I am not satisfied with the landing page and the visibility of the demo page. We also need to reconcile the "try it here" section and the demo section. I don't know if we need both.

**User Clarifications:**
- Primary concern: All of the above (conversion, confusion, discoverability)
- Landing page demo role: Remove it entirely, direct users to /demo instead

---

## Executive Summary

The current dual-demo approach (landing page "Try it here" + Practice Space at /demo) creates friction and confusion. This document proposes a unified strategy:

**Replace the interactive demo with a beautiful static showcase, then funnel all "try before signup" users to the full Practice Space.**

This approach:
- Eliminates redundancy and confusion
- Makes Practice Space feel like a destination, not an afterthought
- Creates visual desire without splitting attention
- Maintains the calm, non-pushy wabi-sabi aesthetic

---

## 1. New Landing Page Layout

### Desktop Layout (Split-Screen Refined)

```
+------------------------------------------------------------------------+
|  [Zenote]                                        [☀/☾] [Sign In]       |
+------------------------------------------------------------------------+
|                                    |                                    |
|                                    |     ┌─────────────────────────┐    |
|    A quiet space                   |     │ ╭                    ╮  │    |
|    for your notes.                 |     │   Morning reflections    │    |
|                                    |     │   ─────────────────────  │    |
|    The distraction-free            |     │                          │    |
|    note-taking app.                |     │   The quiet hours before │    |
|    No folders, no clutter.         |     │   dawn have become my    │    |
|    Just your thoughts,             |     │   favorite time to think │    |
|    beautifully organized.          |     │   clearly...             │    |
|                                    |     │                          │    |
|    ┌─────────────────────────┐     |     │   [Journal]    2 days    │    |
|    │    Start Writing        │     |     │ ╰                    ╯  │    |
|    └─────────────────────────┘     |     └─────────────────────────┘    |
|                                    |                                    |
|    or explore without signing up → |     ┌─────────────────────────┐    |
|                                    |     │ ╭                    ╮  │    |
|                                    |     │   Book notes: Atomic     │    |
|    ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─          |     │   Habits                 │    |
|                                    |     │   ─────────────────────  │    |
|    ✦ Open source                   |     │   Key insight: habits    │    |
|    ✦ Works offline                 |     │   are the compound       │    |
|    ✦ Your data stays yours         |     │   interest of self...    │    |
|                                    |     │                          │    |
|                                    |     │   [Reading]    1 week    │    |
|                                    |     │ ╰                    ╯  │    |
|                                    |     └─────────────────────────┘    |
|                                    |                                    |
+------------------------------------------------------------------------+
|    Changelog · Roadmap · GitHub                                         |
+------------------------------------------------------------------------+
```

### Key Changes from Current

| Element | Before | After |
|---------|--------|-------|
| Right panel | Demo editor + sample cards | **Static showcase only** (2 beautiful note cards) |
| Primary CTA | "Start Writing" | Same, with clearer secondary |
| Secondary CTA | Hidden "Practice" link in footer | **Prominent "or explore without signing up →"** |
| Trust signals | None | **Three trust badges below CTA** |
| Footer nav | Practice · Changelog · Roadmap · GitHub | Changelog · Roadmap · GitHub (Practice removed) |

---

### Mobile Layout

```
+--------------------------------+
|  [Zenote]           [☀] [→]    |
+--------------------------------+
|                                |
|    A quiet space               |
|    for your notes.             |
|                                |
|    The distraction-free        |
|    note-taking app.            |
|                                |
|    ┌──────────────────────┐    |
|    │    Start Writing     │    |
|    └──────────────────────┘    |
|                                |
|    or explore first →          |
|                                |
|    ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─       |
|                                |
|    ✦ Open source               |
|    ✦ Works offline             |
|    ✦ Your data stays yours     |
|                                |
+--------------------------------+
|                                |
|  ┌────────────────────────┐    |
|  │ ╭                  ╮   │    |
|  │   Morning reflections  │    |
|  │   ────────────────     │    |
|  │                        │    |
|  │   The quiet hours...   │    |
|  │                        │    |
|  │   [Journal]   2 days   │    |
|  │ ╰                  ╯   │    |
|  └────────────────────────┘    |
|                                |
+--------------------------------+
|  Changelog · Roadmap · GitHub  |
+--------------------------------+
```

**Mobile Priority Order:**
1. Hero + CTA (above fold)
2. Trust signals (builds confidence before scrolling)
3. Single showcase card (visual proof)
4. Footer

---

## 2. CTA Hierarchy & Copy Recommendations

### Primary CTA: "Start Writing"

Keep this. It's action-oriented and sets expectation.

**Enhancement:** Add micro-copy below:
```
┌─────────────────────────┐
│    Start Writing        │  ← Accent background, white text
└─────────────────────────┘
       Free forever
```

### Secondary CTA: Path to Practice Space

**Current problem:** "Practice" is buried in footer, unclear what it means.

**New approach:** Prominent text link directly below primary CTA.

**Copy options (ranked):**

| Option | Pros | Cons |
|--------|------|------|
| **"or explore without signing up →"** | Clear value prop, reduces signup anxiety | Slightly long |
| "or try it first →" | Short, action-oriented | Less specific |
| "or explore the writing space →" | Describes destination | Verbose |

**Recommendation:** `or explore without signing up →`

This copy:
- Addresses the #1 barrier (signup friction)
- Clearly differentiates from primary CTA
- Uses lowercase "or" for calm, non-pushy tone

### Visual Treatment

```css
.secondary-cta {
  font-family: var(--font-body);
  font-size: 0.95rem;
  color: var(--color-text-secondary);
  text-decoration: none;
  border-bottom: 1px dotted var(--color-text-tertiary);
  transition: all 0.2s ease;
}

.secondary-cta:hover {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent);
}

.secondary-cta::after {
  content: ' →';
  transition: transform 0.2s ease;
  display: inline-block;
}

.secondary-cta:hover::after {
  transform: translateX(4px);
}
```

---

## 3. Practice Space Visibility Strategy

### Remove from Footer Navigation

**Before:** `Practice · Changelog · Roadmap · GitHub`
**After:** `Changelog · Roadmap · GitHub`

The secondary CTA replaces the footer link with much better visibility.

### Rename the Route Label

When users arrive at `/demo`, the header shows:

```
[Zenote] [Practice badge]
```

**Keep "Practice" as the badge** - it's zen-aligned and describes the experience (practice writing).

But the **CTA copy** that leads there should be benefit-focused:
- Landing page: "explore without signing up"
- After signup prompt dismissal: "continue practicing"

### Practice Space Improvements (Optional Enhancement)

Add a subtle "Ready to save your work?" prompt in the Practice Space header after 2+ notes:

```
+------------------------------------------------------------------------+
|  [Zenote] [Practice]                               [Save my notes →]   |
+------------------------------------------------------------------------+
```

This creates a soft conversion path without the modal interruption.

---

## 4. Trust Signal Integration

### Placement

Below the CTA group, separated by a subtle divider:

```
┌─────────────────────────┐
│    Start Writing        │
└─────────────────────────┘
       Free forever

  or explore without signing up →

─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─

  ✦ Open source
  ✦ Works offline
  ✦ Your data stays yours
```

### Trust Signal Options (Pick 3)

| Signal | Copy | Impact |
|--------|------|--------|
| **Open source** | "✦ Open source" | High - differentiator, transparency |
| **Privacy** | "✦ Your data stays yours" | High - addresses note-taking anxiety |
| **Offline** | "✦ Works offline" | Medium - PWA feature highlight |
| **No tracking** | "✦ No tracking or ads" | Medium - privacy signal |
| **Export** | "✦ Export anytime" | Medium - no lock-in |
| **User count** | "✦ 500+ writers" | Low priority until real numbers |

**Recommended trio:** Open source + Works offline + Your data stays yours

### Visual Treatment

```css
.trust-signals {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px dashed var(--glass-border);
}

.trust-signal {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-body);
  font-size: 0.85rem;
  color: var(--color-text-tertiary);
  font-weight: 400;
}

.trust-signal::before {
  content: '✦';
  color: var(--color-accent);
  font-size: 0.7rem;
}
```

---

## 5. Right Panel: Static Showcase

### Design Philosophy

The right panel becomes a **window into what Zenote looks like** - not an interactive demo, but a beautiful static preview that creates desire.

### Implementation

Two note cards with:
- Real-looking content (journaling, reading notes)
- Tag badges visible
- Timestamps showing temporal organization
- Wabi-sabi styling (asymmetric corners, warm colors)

**Important:** These are NOT clickable. They're purely visual.

### Subtle Animation (Optional)

Add a gentle "peek" animation on load:

```css
.showcase-card {
  animation: card-reveal 0.8s ease-out backwards;
}

.showcase-card:nth-child(1) { animation-delay: 0.2s; }
.showcase-card:nth-child(2) { animation-delay: 0.4s; }

@keyframes card-reveal {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### Remove Demo Badge

The current "Try it here" card has a `[Demo]` badge. Since we're removing interactivity, remove this badge. The cards are now purely illustrative.

---

## 6. Implementation Summary

### Files to Modify

| File | Changes |
|------|---------|
| `LandingPage.tsx` | Remove demo editor, add secondary CTA, add trust signals |
| `index.css` | Add trust signal styles, secondary CTA styles |

### Code Changes (LandingPage.tsx)

**Remove:**
- `demoContent` state
- `hasTyped` state
- `editorRef`
- `handleInput`, `handleFocus`, `handleBlur` functions
- `DEMO_STORAGE_KEY`
- The contentEditable demo card
- "Save this note" contextual CTA
- "Practice" from footer nav

**Add:**
- Secondary CTA link to `/demo`
- Trust signals section
- Simplified right panel (static cards only)

### Estimated Effort

| Task | Time |
|------|------|
| Remove demo editor code | 30 min |
| Add secondary CTA | 15 min |
| Add trust signals | 20 min |
| Simplify right panel | 20 min |
| Mobile layout adjustments | 30 min |
| Testing & polish | 30 min |
| **Total** | **~2.5 hours** |

---

## 7. Conversion Flow Comparison

### Before (Confusing)

```
Landing Page
     │
     ├─► [Start Writing] → Auth Modal → Library
     │
     ├─► [Try it here demo] → Type in demo → [Save this note] → Auth Modal
     │
     └─► [Practice link in footer] → /demo → Full experience → Soft prompt
```

**Problems:**
- Three paths, two demos
- "Practice" unclear
- Demo editor competes with signup CTA

### After (Clear)

```
Landing Page
     │
     ├─► [Start Writing] → Auth Modal → Library
     │        │
     │        └── "Free forever" micro-copy builds confidence
     │
     └─► [or explore without signing up →] → /demo → Full experience
                                                    │
                                                    └── Soft prompt after engagement
```

**Benefits:**
- Two clear paths (commit vs. explore)
- Single demo experience (Practice Space)
- Trust signals reduce signup anxiety
- Clear value prop for exploration path

---

## 8. Copy Recommendations Summary

| Element | Current | Recommended |
|---------|---------|-------------|
| Headline | "A quiet space for your mind" | "A quiet space for your notes." (clearer category) |
| Primary CTA | "Start Writing" | Keep (add "Free forever" below) |
| Secondary CTA | None (hidden Practice link) | "or explore without signing up →" |
| Trust signals | None | "✦ Open source · ✦ Works offline · ✦ Your data stays yours" |
| Footer nav | Practice · Changelog · Roadmap · GitHub | Changelog · Roadmap · GitHub |
| Practice Space badge | "Practice" | Keep "Practice" |

---

## 9. Alternative Consideration: Hero-Centered Layout

If you want to explore a more dramatic redesign, consider a **centered hero** layout:

```
+------------------------------------------------------------------------+
|  [Zenote]                                        [☀/☾] [Sign In]       |
+------------------------------------------------------------------------+
|                                                                        |
|                                                                        |
|                       A quiet space                                    |
|                       for your notes.                                  |
|                                                                        |
|                  The distraction-free note-taking app.                 |
|                                                                        |
|                  ┌─────────────────────────┐                           |
|                  │    Start Writing        │                           |
|                  └─────────────────────────┘                           |
|                         Free forever                                   |
|                                                                        |
|                  or explore without signing up →                       |
|                                                                        |
|                  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─                            |
|                                                                        |
|                  ✦ Open source · ✦ Works offline · ✦ Yours forever     |
|                                                                        |
|    ┌────────────────┐                      ┌────────────────┐          |
|    │ Morning        │                      │ Book notes     │          |
|    │ reflections    │                      │                │          |
|    │                │                      │ Key insight... │          |
|    │ The quiet...   │                      │                │          |
|    │ [Journal]      │                      │ [Reading]      │          |
|    └────────────────┘                      └────────────────┘          |
|                                                                        |
+------------------------------------------------------------------------+
```

This approach:
- Centers attention on the value proposition
- Cards become "proof" below the fold
- More dramatic, editorial feel
- Works better if you want to add a background texture/gradient

**Trade-off:** Less visual interest above the fold on desktop.

---

## 10. Recommendation

Proceed with the **split-screen refinement** (Option 1) because:
1. Maintains existing layout structure (less risky)
2. Shows visual proof above the fold
3. Preserves wabi-sabi asymmetry
4. Faster to implement

The centered layout is a valid future exploration if conversion metrics don't improve.

---

## 11. Auth Modal: OAuth-First Layout (Implemented)

As part of the landing page unification, the auth modal was updated to prioritize OAuth buttons.

### Before
```
┌─────────────────────────────────────┐
│           Welcome back              │
│                                     │
│  Email                              │
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  └─────────────────────────────┘    │
│                                     │
│  Password                           │
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │         Sign In             │    │
│  └─────────────────────────────┘    │
│                                     │
│  ──────────── or ────────────       │
│                                     │
│  ┌─────────────┐ ┌─────────────┐    │
│  │   Google    │ │   GitHub    │    │
│  └─────────────┘ └─────────────┘    │
└─────────────────────────────────────┘
```

### After (OAuth-First)
```
┌─────────────────────────────────────┐
│           Welcome back              │
│                                     │
│  ┌─────────────┐ ┌─────────────┐    │
│  │   Google    │ │   GitHub    │    │
│  └─────────────┘ └─────────────┘    │
│                                     │
│  ──── or continue with email ────   │
│                                     │
│  Email                              │
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  └─────────────────────────────┘    │
│                                     │
│  Password                           │
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │         Sign In             │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### Rationale

| Aspect | Before | After |
|--------|--------|-------|
| Primary action | Email form | OAuth buttons |
| Divider text | "or" | "or continue with email" |
| Conversion path | Slower (email confirmation) | Faster (2 clicks) |

**Benefits:**
- OAuth is faster: 2 clicks vs. typing + email confirmation
- Reduces password fatigue
- Most users already have Google/GitHub accounts
- Clearer visual hierarchy

**Applies to:** Login and Signup modes only (not forgot password or reset password)

---

## Related Documents

- [Landing Page Design Review](../reviews/landing-page-design-review-claude.md) - Previous comprehensive review
- [Demo Writing Page Design](frontend-skill-demo-writing-page-claude.md) - Practice Space design
- [Onboarding UX Review](onboarding-ux-review-claude.md) - Onboarding analysis
- [Competitive Design Evaluation](../active/competitive-design-evaluation-claude.md) - Competitor comparison
- [UI Layout](../ui-layout.md) - ASCII diagrams of all components

---

*Document generated as part of Zenote landing page unification initiative.*
