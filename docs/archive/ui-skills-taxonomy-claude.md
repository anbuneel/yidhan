# UI/UX/Frontend Skills — Taxonomy & Usage Guide

**Version:** 1.0
**Last Updated:** 2026-03-28
**Status:** Living Document
**Author:** Claude (Opus 4.6)

---

## Original Prompt

> How did the impeccable skills not catch these items before? I have so many skills related to UI/UX/frontend and I am struggling to figure out what each one brings to the table!

---

## Skill Taxonomy

### Diagnostic (Audit existing code — "what's wrong?")

| Skill | What it checks | Scope |
|-------|---------------|-------|
| `redesign-existing-projects` | Anti-AI-generic checklist: typography, color, layout, interactivity, content, component patterns, iconography, code quality, strategic omissions | **Whole codebase** — walks everything against a checklist |
| `impeccable:audit` | Accessibility, performance, theming, responsive design — quality/compliance focus | **Whole codebase** — quality & a11y |
| `impeccable:critique` | Visual hierarchy, information architecture, emotional resonance, overall design quality | **Per-feature or page** — design effectiveness |

**Key difference:** `redesign-existing-projects` asks "does this look like generic AI output?" while `impeccable:audit` asks "does this meet quality standards?" They're complementary, not redundant. Run both for full coverage.

---

### Generative (Guide new builds — "how should I build this?")

| Skill | Angle | Best for |
|-------|-------|----------|
| `frontend-design` | Distinctive, production-grade, anti-generic | General-purpose UI building |
| `impeccable:frontend-design` | Same as above but under impeccable namespace | Same — likely interchangeable with `frontend-design` |
| `high-end-visual-design` | High-end agency standards: exact fonts, spacing, shadows, card structures, animations | When you want "expensive-feeling" output |
| `design-taste-frontend` | Senior UI/UX Engineer rules: metric-based, strict component architecture, CSS hardware acceleration | When you want engineering rigor in the design |

**Overlap alert:** These 4 produce similar output with slightly different opinions. You probably only need one generative design skill — whichever matches your taste for a given project.

---

### Surgical (Fix one aspect — "improve this specific thing")

| Skill | What it fixes | When to use |
|-------|--------------|-------------|
| `impeccable:animate` | Animations, micro-interactions, motion | After building a feature that feels static |
| `impeccable:polish` | Alignment, spacing, consistency, detail | Final pass before shipping — "good to great" |
| `impeccable:clarify` | UX copy, error messages, microcopy, labels | When interface text feels unclear |
| `impeccable:colorize` | Adds strategic color to monochromatic designs | When a feature looks too gray/flat |
| `impeccable:adapt` | Responsive, cross-device, cross-platform | After building desktop-first, need mobile |
| `impeccable:harden` | Error handling, i18n, text overflow, edge cases | Before shipping — robustness pass |
| `impeccable:delight` | Joy, personality, unexpected touches | When functional but boring |
| `impeccable:distill` | Strips unnecessary complexity | When a feature feels over-engineered visually |
| `impeccable:quieter` | Tones down visually aggressive designs | When something is too loud |
| `impeccable:bolder` | Amplifies safe/boring designs | When something is too timid |
| `impeccable:optimize` | Loading speed, rendering, animations, bundle size | Performance pass |
| `impeccable:onboard` | Onboarding flows, empty states, first-time UX | When designing first-run experiences |

---

### Structural (Extract/organize — "organize what exists")

| Skill | Purpose |
|-------|---------|
| `impeccable:extract` | Extract reusable components, design tokens, patterns into design system |
| `impeccable:normalize` | Match existing design system, ensure consistency across components |

---

### Aesthetic Presets (Opinionated visual direction)

| Skill | Style | Use when |
|-------|-------|----------|
| `minimalist-ui` | Clean editorial, warm monochrome, flat bento grids, muted pastels | Building something like Yidhan's aesthetic |
| `industrial-brutalist-ui` | Swiss typographic + military terminal, rigid grids, extreme contrast | Data-heavy dashboards, portfolios, editorial |
| `stitch-design-taste` | Google Stitch design system semantics | Building with Stitch framework |

---

### Setup (One-time)

| Skill | Purpose |
|-------|---------|
| `impeccable:teach-impeccable` | Gathers design context for your project, saves persistent design guidelines. Run once per project. |

---

## Recommended Workflow for Yidhan

```
1. BUILD new features    → impeccable:frontend-design (generative)
2. AFTER each feature    → impeccable:polish (surgical)
3. BEFORE a release      → impeccable:audit + redesign-existing-projects (diagnostic)
4. SITUATIONAL           → impeccable:animate, impeccable:clarify, etc. (surgical)
```

The surgical impeccable skills are like a toolbox — you don't use every wrench on every job. Pick the one that matches the specific gap you're seeing.

---

## Why the Redesign Skill Caught Things Others Didn't

Three reasons:

1. **Scope difference.** The impeccable suite is per-feature — it looks at recently modified code. The redesign skill walks the *entire* codebase against a checklist. It caught `NoteCard.tsx`'s inline JS hover pattern because it scanned everything, not just recent changes.

2. **Unique angle.** The redesign skill's secret weapon is its "anti-AI-generic" checklist — things like "are you using sun/moon for theme toggle?" or "do you have three equal card columns?" These are taste judgments about *originality*. No other skill checks for that.

3. **Code quality crossover.** Items like "three styling approaches in one codebase" or "inconsistent strokeWidth on SVGs" are code quality issues that design-focused skills don't typically flag. The redesign skill bridges design and code quality.

---

## Key Insight

The core issue is **naming, not function**. "frontend-design" vs "impeccable:frontend-design" vs "high-end-visual-design" vs "design-taste-frontend" — these sound interchangeable. If the skill names were instead "build-ui", "audit-ui", "fix-animation", "fix-copy", the workflow would be self-evident. Worth considering consolidation if you find yourself guessing which to invoke.
