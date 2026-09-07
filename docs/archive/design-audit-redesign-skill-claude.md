# Yidhan Design Audit

**Version:** 1.0
**Last Updated:** 2026-03-28
**Status:** Living Document
**Author:** Claude (Opus 4.6)
**Consulted:** Redesign Existing Projects Skill

---

## Original Prompt

> /redesign-existing-projects — Full design audit of the Yidhan codebase against the redesign skill's checklist.

---

## What's Already Strong

Yidhan already exceeds the audit in several areas. This is *not* a generic AI project — the design has clear intentionality:

| Area | Status | Notes |
|------|--------|-------|
| Font pairing | **Excellent** | Cormorant Garamond + Source Sans 3 — distinctive, editorial |
| Color system | **Excellent** | Warm terracotta/gold, earthy tones, zero AI-gradient aesthetic |
| Wabi-sabi corners | **Signature** | `2px 24px 4px 24px` — nothing generic about this |
| Paper noise overlay | **Strong** | SVG noise on `body::before` with theme-aware filter |
| Card gradient | **Strong** | Subtle `color-mix` accent warmth at card bottom |
| Reduced motion | **Comprehensive** | All animations collapse, view transitions disabled |
| Semantic HTML | **Strong** | `<header>`, `<main>`, `<nav>`, `<footer>`, `<article>` |
| Meta tags | **Complete** | OG, Twitter Card, canonical, favicon, PWA manifest |
| Copy voice | **Distinctive** | "Faded Notes" not "Trash", no AI cliches, calm tone |
| Touch interactions | **Strong** | Press states, pull-to-refresh, gesture hints |
| Error messaging | **Direct** | Sanitized, no "Oops!" patterns |
| Accessibility | **Good foundation** | Focus rings, WCAG AA contrast verified, `aria-label` throughout |

---

## Findings — Organized by Impact

### 1. Typography (Low-hanging fruit)

**1a. Landing headline weight is too thin.**
`font-weight: 300` on the display headline with Cormorant Garamond. For a serif this ornate, 300 makes it feel anemic rather than calm. Weight 400 or even 500 would give the headline physical presence while keeping the quiet tone. The "calm" personality should come from spacing and restraint, not from making text disappear.

**1b. Missing `text-wrap: balance` on headlines.**
The `<h1>` "A quiet space for your thoughts." could orphan "thoughts." on its own line at certain breakpoints. Adding `text-wrap: balance` is one CSS property for a measurable improvement.

**1c. Proof rail is too small.**
`font-size: 0.65rem` on "Open source · Offline-first · End-to-end encrypted" — these are your core trust signals for first-time visitors. At 10.4px they're barely legible. Bumping to `0.75rem` or `0.8rem` would give them the prominence they deserve without breaking the calm hierarchy.

---

### 2. Color & Surfaces (Medium impact)

**2a. Dark theme shadows are pure black.**
Light theme correctly tints shadows with `rgba(120, 80, 60, ...)` (warm terracotta-brown). But dark theme uses `rgba(0, 0, 0, ...)` — untinted. Tinting these with the forest green (`rgba(5, 20, 10, ...)`) would make the dark theme feel as cohesive as the light one.

**2b. Manuscript shadow uses hardcoded values.**
The `manuscriptShadow` in `LandingPage.tsx` uses raw RGBA instead of theme tokens. If themes change, this shadow won't follow. Minor but worth noting.

---

### 3. Layout (Medium impact)

**3a. Mobile landing page loses its editorial character.**
Desktop: asymmetric 40/60 grid, left-aligned text. Beautiful.
Mobile: `text-align: center; align-items: center` — becomes a generic centered layout. Keeping left-alignment on mobile (like a magazine would) would preserve the editorial identity across breakpoints.

**3b. CTA cluster is tight.**
`gap: 0.6rem` between the "Start Writing" button and the trust lines below it. The button needs more breathing room to feel like a primary action, not just another item in a list. Even `1rem` would help.

---

### 4. Interactivity (Code quality + UX)

**4a. Inline JS hover management.**
`NoteCard.tsx` uses `onMouseEnter`/`onMouseLeave` handlers to set `transform` and `color` via `e.currentTarget.style`. This is a common React pattern but creates several problems:
- Fights with the CSS `transition-all duration-300` already on the element
- No `:hover` cascade for future CSS overrides
- More JS execution than a pure CSS `:hover` rule

The same pattern appears on Pin and Delete buttons. These should be CSS `:hover` rules (even with dynamic values, CSS custom properties can handle it).

**4b. Delete animation uses fragile `setTimeout`.**
`setTimeout(() => onDelete(note.id), 300)` assumes the animation duration won't change. Using `onAnimationEnd` or `onTransitionEnd` would be more resilient.

**4c. Search placeholder is generic.**
"Search..." could be "Search your thoughts..." or "Find a note..." to match the voice.

---

### 5. Strategic Omissions (Accessibility + polish)

**5a. No 404 page.**
Confirmed — no `NotFound` or `404` component exists. Invalid routes render nothing. This is a real gap for a production app preparing for launch.

**5b. No "skip to content" link.**
Essential for keyboard/screen-reader users. A hidden `<a>` that becomes visible on focus, jumping past the header to `<main>`. Quick win for accessibility.

**5c. No scroll affordance on mobile landing.**
On smaller mobile screens, the manuscript panel may be below the fold. There's no visual cue (subtle bounce, down-arrow, gradient fade) that content continues below.

---

### 6. Code Quality (Maintainability)

**6a. Three styling approaches in one codebase.**
Yidhan uses:
1. **Tailwind** (`className="flex items-center gap-3"`)
2. **Inline styles** (`style={{ background: 'var(--color-bg-secondary)' }}`)
3. **CSS-in-JSX** (`<style>{...}</style>` blocks in LandingPage)

All three in the same components. This makes future design changes harder to trace. The LandingPage alone has ~350 lines of CSS in a `<style>` tag.

**6b. Inconsistent icon stroke widths.**
Inline SVGs use `strokeWidth={1.5}` in some places and `strokeWidth={2}` in others (e.g., the "+" icon on New Note is 2, while delete/pin are 1.5). Should be standardized.

**6c. `!important` on mobile headline.**
`.landing-headline { font-size: clamp(2rem, 8vw, 3rem) !important; }` — suggests a specificity conflict. Worth investigating the root cause.

---

### 7. Polish Opportunities (Optional — elevate further)

These aren't problems — they're opportunities that would elevate the already-strong design:

**7a. Static manuscript after text reveal.**
The landing page text-reveal animation is beautiful, but after it plays (1.3s), the manuscript becomes static. A subtle ongoing ambient effect — gentle glow breathing, barely-perceptible paper texture drift — would keep the surface feeling alive without being distracting.

**7b. Theme toggle is the standard sun/moon.**
Fits the minimal aesthetic, but given how distinctive the rest of the design is, a more thematic metaphor (candle/window, dusk/dawn) would complete the story.

**7c. Entrance stagger is very fast.**
Delays of 0.08s, 0.16s, 0.24s are almost imperceptible. Stretching to 0.12s, 0.25s, 0.4s would let each element "arrive" with more ceremony.

---

## Summary Scorecard

| Category | Score | Verdict |
|----------|-------|---------|
| Typography | 8/10 | Strong pairing, thin headline holds it back |
| Color & Surfaces | 9/10 | Excellent cohesion, dark shadows need tinting |
| Layout | 8/10 | Asymmetric desktop is great, mobile falls to generic center |
| Interactivity | 7/10 | States exist but JS hover pattern is fragile |
| Content & Copy | 9.5/10 | Outstanding voice — one of the strongest areas |
| Component Patterns | 9/10 | Distinctive cards, masonry, wabi-sabi — not generic |
| Accessibility | 7/10 | Good foundation, missing skip-link and 404 |
| Code Quality | 6/10 | Three styling approaches + inline JS hover |

**Overall: 8/10 — Well above the "generic AI project" baseline.** The design has genuine personality. The gaps are mostly in code hygiene and a few accessibility omissions, not in aesthetic direction.

---

## Key Insight

The biggest takeaway is that Yidhan's design problems are *maintenance* problems, not *taste* problems. The aesthetic direction is strong and intentional. The issues are in how the styling is organized (three approaches), how interactivity is implemented (JS vs CSS), and what's missing at the edges (404, skip-link). These compound as the app grows — they don't hurt users today, but they slow down every future design change.
