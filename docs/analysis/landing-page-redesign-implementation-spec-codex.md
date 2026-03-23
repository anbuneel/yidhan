# Landing Page Redesign Implementation Spec

**Version:** 1.0
**Last Updated:** 2026-03-22
**Status:** Draft
**Author:** Codex
**Consulted:** Frontend Design Skill

---

## Original Prompt

> Review the consolidated landing-page redesign doc and turn it into a clean implementation spec with one authoritative strategy section, one authoritative checklist, and a clearly fenced appendix stance.

---

## Purpose

This document is the implementation-ready source of truth for the next landing page redesign pass.

It replaces the mixed analysis in [landing-page-award-winning-redesign-claude.md](landing-page-award-winning-redesign-claude.md) as the document to execute from.

That earlier document remains useful as ideation history. It should not be treated as the final decision log because it contains competing strategies and superseded experiments.

---

## Authoritative Strategy

### Product Goal

The landing page should optimize for **direct signup**.

The Practice Space remains visible, but secondary. It is a pressure-release path for hesitant visitors, not the primary action.

### Visual Thesis

**A private manuscript surface emerging from a quiet field of paper, shadow, and warm light.**

The first screen should feel like entering a writing room, not scanning a SaaS layout.

### Content Plan

- Hero: brand, promise, direct-signup CTA, low-friction proof
- Support: one dominant visual proof of the writing experience
- Detail: one compact proof layer, not a full marketing narrative
- Final CTA: the auth modal feels like the hero completing itself

### Interaction Thesis

- One restrained entrance sequence
- One manuscript presence effect
- One modal transition that feels like a sheet coming forward

After the entrance finishes, the page returns to stillness. The cursor may breathe. Nothing else should drift, float, pulse, or wander.

### Strategic Decisions

1. **Kill the split-screen layout.**
   The current 45/55 split reads as two adjacent compositions. The redesign should become one unified canvas.

2. **Use one dominant manuscript surface, not multiple showcase cards.**
   The hero should have one visual anchor. Two sample cards plus a boxed writing vignette is too explanatory and too familiar.

3. **Keep signup primary.**
   The main CTA remains the strongest action on the page. Practice Space stays visible but visually subordinate.

4. **Reduce friction in the hero before the modal opens.**
   The CTA cluster should answer effort and trust objections immediately.

5. **Reduce friction inside the signup form.**
   Remove optional fields that do not unlock core value at account creation.

6. **Make the landing page manuscript match the real product.**
   The redesign may dramatize composition and lighting, but not invent a more beautiful editor than the app actually delivers.

7. **Design with Midnight as the first composition reference, but validate every milestone in Kintsugi.**
   Midnight currently carries the atmosphere better. It is the best place to art-direct the composition first.
   Kintsugi is not secondary in quality. Every milestone must be reviewed in both themes before completion.

8. **Do not depend on a long below-the-fold story in phase one.**
   The first viewport must stand on its own as a screenshot-worthy poster.
   A compact proof section may be added after the hero if needed, but the redesign should not rely on a multi-act scroll narrative to work.

---

## Implementation Checklist

### P0: Core Restructure

1. **Replace the split layout with a single-canvas hero.**
   Files:
   - [LandingPage.tsx](../../src/components/LandingPage.tsx)
   - [index.css](../../src/index.css)

   Requirements:
   - one header bar across the full viewport
   - no duplicated left/right headers
   - no hard center seam
   - no boxed right panel

2. **Replace the two showcase cards and boxed vignette with one dominant manuscript plane.**
   Files:
   - [LandingPage.tsx](../../src/components/LandingPage.tsx)
   - [index.css](../../src/index.css)

   Requirements:
   - one large manuscript object
   - strong negative space around it
   - one visible cursor or active writing line
   - no equal-weight secondary cards in the hero
   - no dashboard framing

3. **Match the manuscript to the real editor’s typography and tone.**
   Files:
   - [LandingPage.tsx](../../src/components/LandingPage.tsx)
   - [index.css](../../src/index.css)

   Requirements:
   - reuse the same editorial rhythm as the actual editor surface
   - keep line-height, spacing, and surface tone aligned with the product
   - do not create a fake concept-editor

4. **Rebuild the CTA cluster for direct signup.**
   File:
   - [LandingPage.tsx](../../src/components/LandingPage.tsx)

   Recommended structure:
   - primary button: `Start Writing`
   - proof line: `Google, GitHub, or email. No credit card.`
   - privacy line: `End-to-end encrypted from the start.`
   - secondary link: `Explore the Practice Space`

   Rules:
   - signup remains visually primary
   - the Practice Space link must be easier to see than the current dotted link
   - the Practice Space link must not become a co-equal button

5. **Convert the trust bullets into a compact proof rail.**
   File:
   - [LandingPage.tsx](../../src/components/LandingPage.tsx)

   Recommended copy:
   - `Open source · Offline-first · End-to-end encrypted`

   Rules:
   - small, editorial, and calm
   - no icons by default
   - each claim links to verifiable proof (GitHub repo, encryption spec, etc.)

6. **Stillness after entrance.**
   Files:
   - [LandingPage.tsx](../../src/components/LandingPage.tsx)
   - [index.css](../../src/index.css)

   Requirements:
   - after entrance animations complete (~3s), only the cursor breathes
   - no continuous loops, floating cards, drifting elements, or parallax
   - `prefers-reduced-motion` must collapse all entrance animations to instant display

7. **Make mobile a first-class composition, not a collapsed desktop layout.**
   Files:
   - [LandingPage.tsx](../../src/components/LandingPage.tsx)
   - [index.css](../../src/index.css)

   Requirements:
   - mobile must include the manuscript hero moment, not just text and a button
   - no “desktop hero minus right panel” behavior
   - CTA and manuscript must both fit within a coherent vertical story

### P1: Signup and Modal Refinement

8. **Remove `Full Name` from first-step signup.**
   Files:
   - [Auth.tsx](../../src/components/Auth.tsx)
   - [AuthContext.tsx](../../src/contexts/AuthContext.tsx)

   Rules:
   - keep OAuth first
   - keep name editable later in Settings
   - preserve existing email fallback for avatar initials

9. **Reduce modal friction and strengthen reassurance.**
   File:
   - [Auth.tsx](../../src/components/Auth.tsx)

   Requirements:
   - one calm reassurance line near the top
   - one trust line near the action
   - modal should feel more intimate than the current form

   Recommended micro-copy:
   - top reassurance: `Your private writing space`
   - bottom reassurance: `Your notes stay encrypted and yours.`

10. **Use a sheet-rising modal motion, not a snap-in.**
    File:
    - [index.css](../../src/index.css)

    Recommended motion:
    - `translateY(40px) scale(0.98)` to rest
    - fast, restrained ease-out
    - fully disabled under `prefers-reduced-motion`

### P2: Theme and Signature Detail

11. **Deepen Kintsugi through surroundings, not extra chrome.**
    Files:
    - [index.css](../../src/index.css)
    - [LandingPage.tsx](../../src/components/LandingPage.tsx)

    Requirements:
    - stronger separation between background and manuscript
    - warmer shadow pocket around the manuscript
    - the manuscript itself must match the real editor's surface and text styling (per P0 #3) — depth comes from the surroundings, not from tweaking the manuscript's internal hierarchy

12. **Keep at most two signature details in phase one.**
    Shortlist:
    - horizontal text reveal on the manuscript (clip-path, GPU-composited)
    - asymmetric entrance choreography ("heavy objects fall slower" — different `translateY` per element weight)

    ~~kintsugi accent line~~ — tried previously and removed. Do not revisit.

    Optional third detail only if the page feels too plain after the above two land. Candidates: cursor glow, paper fold shadow — test in browser.

13. **Review both themes before sign-off.**
    Acceptance criteria:
    - Midnight feels atmospheric and premium
    - Kintsugi feels intentional and tactile, not washed out
    - neither theme looks like a port of the other

### Deferred

14. **Do not include these in the first implementation pass.**
    Deferred ideas:
    - modal visual DNA alignment (revisit if modal feels disconnected after hero lands)
    - kintsugi accent line (tried and removed — do not revisit)
    - parallax
    - continuous drift
    - manuscript-to-modal morph
    - full editorial scroll journey
    - co-equal demo CTA
    - time-contextual manuscript copy
    - theme-toggle showpiece transition
    - decorative seam shimmer
    - letterpress effects
    - cursor-local glow
    - paper fold shadow
    - aged bottom-edge gradient
    - paper noise texture

---

## Acceptance Test

The redesign is successful when all of the following are true:

1. The first screen reads as one composition, not two panels.
2. The hero has one unmistakable visual anchor.
3. The primary action is obvious within two seconds.
4. The signup path feels easy before the modal opens.
5. The modal feels like a continuation of the landing page, not a separate utility layer.
6. The mobile layout preserves the same emotional idea as desktop.
7. Midnight and Kintsugi both feel intentionally art-directed.
8. The page still feels premium after removing nonessential decorative effects.

---

## Appendix: How To Treat The Earlier Analysis

Use [landing-page-award-winning-redesign-claude.md](landing-page-award-winning-redesign-claude.md) as:

- ideation history
- rationale archive
- source of deferred experiments

Do not use it as:

- the final strategy document
- the final priority list
- the literal implementation checklist

Specifically superseded from that doc:

- the zero-user framing that makes the demo path effectively co-primary
- the raw recommendation for one single CTA with no secondary hero path
- the raw recommendation for continuous drift and parallax-like movement
- the assumption that the theme toggle transition is cheap polish
- the broader P2 ornament set as a first-pass requirement

---

## Recommended Execution Order

1. Rebuild the hero canvas and manuscript composition.
2. Rewrite the CTA cluster and proof rail.
3. Simplify the signup form and redesign modal hierarchy.
4. Tune Kintsugi depth after the Midnight composition is stable.
5. Add at most two signature details.
6. Reassess whether a compact below-the-fold proof section is still needed.

