# Landing Page — "The Page Becomes the Manuscript"

**Version:** 1.0
**Last Updated:** 2026-05-17
**Status:** Draft (awaiting user decision)
**Author:** Claude (Opus 4.7)
**Consulted:** Frontend Design Skill

---

## Original Prompt

> I am still not satisfied with the landing page even after the redesign. review it - use the frontend design skill to review and propose an improvement

Follow-up after comparison with two user-proposed alternatives:

> let's do the synthesis

Followed by: build the synthesis in `PlaygroundPage.tsx` so it can be viewed live before committing to a PR.

---

## TL;DR

The recurring failure across three landing redesigns (PR #66, #134, #183) was treating the layout as a *two-column SaaS hero* (text-left, product-visual-right). That template fights the brand — Yidhan is an editorial/literary product, and editorial brands don't lead with product screenshots.

**Synthesis direction:** kill the manuscript card, make the whole canvas the manuscript page. Marketing copy *is* the prose the visitor reads. The CTA dissolves the page into the editor in place — the cursor stays put, the writing surface arrives around the prose the visitor was already reading.

Prototype lives at `/playground` (dev-only). Not yet ported to `LandingPage.tsx`.

---

## Diagnosis — What was failing

From a viewport screenshot of the live landing (`/`) at 1440×900 and 390×844:

1. **Manuscript card eats the page.** It's the largest, brightest, most legible object on screen. The eye reads its prose instead of the hero copy. Critique P1 (2026-03-28) flagged this and proposed "blur the cards" — a bandaid. The card *is* doing what a product screenshot does on every SaaS landing.
2. **Headline reads like a caption to the screenshot.** "A quiet space for your thoughts" at ~36–44px sits in a corner, dwarfed by 1.2rem body text inside the manuscript card. The brand promise is smaller than its own demo.
3. **Composition is the most templated layout in tech.** Headline-left + product-visual-right is what Notion, Bear, Obsidian, iA Writer, Apple Notes, and every Lovable/v0 output does. Wabi-sabi corners on the card don't save it — the *shape of the page* is the cliché.
4. **Trust signals are uppercase whispers.** "OPEN SOURCE · OFFLINE-FIRST · END-TO-END ENCRYPTED" at 0.65rem with 0.12em tracking reads as legal footer, not as the answer to "why should I trust this app with my thoughts?"
5. **Atmosphere does nothing visible.** Three layered effects (radial gradient + manuscript glow + entrance) and the page still feels like a Webflow template.

**Root cause:** Redesigning *within* the wrong template. The fix is a different idea, not another iteration.

---

## The three directions compared

Two ideas were proposed alongside Claude's. Honest scoring:

|  | **Idea 1** — Pure minimal | **Idea 2** — Centered manuscript-as-page | **Claude proposal** — Page w/ marginalia |
|---|---|---|---|
| Headline does all the work | Yes — no body copy | No — body prose | No — body prose |
| Layout | Centered, austere | Centered editorial | Asymmetric (text + right marginalia) |
| CTA | Text link + arrow | Paper-chip button | Filled button |
| Trust signals | 1-line tiny caps footer | Demoted to standard footer | Marginalia in right margin |
| Distinctiveness (not SaaS-y) | 9/10 | 7/10 | 8/10 |
| Brand fit (literary/calm) | 8/10 | 9/10 | 8/10 |
| Tells visitor what the product is | 5/10 | 7/10 | 8/10 |
| Conversion-ready | 6/10 | 8/10 | 7/10 |
| Risk of "looks unfinished" | High | Low | Low |
| Signature moment | **10/10** — cursor-preserved transition | 6/10 | 7/10 |

### Unique strengths

- **Idea 1's cursor-preserved transition into the editor is the single best detail across all three.** The page dissolves, the cursor stays put, the writing surface arrives into the spot the visitor was already looking at. Screenshot-worthy.
- **Idea 2 nails "the page IS the product."** No card, no frame, body type at exact editor parity (Source Sans 3, 1.2rem, line-height 1.75). Continuity is the message.
- **Claude's marginalia turns trust signals into reading material instead of footer noise.** Marginalia is one of the strongest reading conventions in print.

### Unique failures

- **Idea 1: too minimal.** Empty pages can read as "didn't finish the design." A first-time visitor doesn't yet know this is a note-taking app vs. a poetry generator. High bounce risk.
- **Idea 2: recycles the manuscript demo text as the marketing body.** "The light through the kitchen window…" is good *sample* text but doesn't pitch the product — a visitor finishes the prose still unsure what Yidhan does differently.
- **Claude's marginalia is fragile on mobile** (collapses awkwardly) and reintroduces a faint "two zones" feeling — the very pattern we're trying to escape.

---

## The synthesis (built)

> Idea 2's centered editorial composition + Idea 1's cursor-preserved transition + freshly written marketing prose (not the recycled manuscript demo content) + a quiet two-line marginalia treatment under the body, not in the right column.

### Concrete decisions

1. **Composition** — centered single column, max-width 640px, vertically centered.
2. **Title** — Cormorant Garamond, weight 300, `clamp(2.6rem, 6.2vw, 5.25rem)`, line-broken poetically across 2 lines (`A quiet space / for your thoughts.`), letter-spacing −0.025em.
3. **Body** — three short paragraphs at exact editor parity (Source Sans 3, 1.2rem, line-height 1.75, color text-primary). Mid-sentence trail-off + breathing cursor at the end.
4. **CTA** — soft paper-chip (6% accent tint background, 28% accent border, asymmetric wabi-sabi corners). Hover fills to full CTA color. Active scales to 0.97.
5. **Secondary action** — single quiet dotted-underline link: "or visit the practice space".
6. **Trust signals** — one italic line under the CTA: *open source · works offline · end-to-end encrypted*. 0.85rem, text-tertiary. Compromise from marginalia: keeps centered axis, survives mobile.
7. **Signature moment** — on click of "Begin writing": title + CTA + trust line fade out, "Untitled" editor title field slides in above the prose, prose becomes contentEditable with caret at end. The prose stays exactly in screen position — the editor arrives around what the visitor was already reading.
8. **Header** — minimal: Logo top-left, theme toggle + "Sign in" textlink top-right (no button frame).
9. **Footer** — old-book running foot: "No. I · Spring 2026" left, nav right.
10. **Atmosphere** — single warm radial wash at top-center (5–7% accent into bg-primary, sunlight on a page) + paper noise SVG turbulence at 0.045 opacity (multiply in light, soft-light in dark).

### Marketing prose (current draft)

> Yidhan is for the half-formed sentence that becomes a paragraph at midnight. No folders. No tags. No app to learn. Just a soft surface and room to think.
>
> Everything you write is yours alone — encrypted before it leaves your hands, kept on every device.
>
> It begins the moment you ▎

### Visual mock (desktop, 1440×900)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  ◇ Yidhan                                                  ☾    Sign in    │
│                                                                            │
│                                                                            │
│                                                                            │
│                     A quiet space                                          │
│                     for your thoughts.                                     │
│                                                                            │
│                                                                            │
│                     Yidhan is for the half-formed sentence that            │
│                     becomes a paragraph at midnight. No folders.           │
│                     No tags. No app to learn. Just a soft surface          │
│                     and room to think.                                     │
│                                                                            │
│                     Everything you write is yours alone — encrypted        │
│                     before it leaves your hands, kept on every device.     │
│                                                                            │
│                     It begins the moment you ▎                             │
│                                                                            │
│                                                                            │
│                     ┌──────────────────┐                                   │
│                     │  Begin writing   │   ·   or visit the practice space │
│                     └──────────────────┘       ···········                 │
│                                                                            │
│                     open source · works offline · end-to-end encrypted     │
│                                                                            │
│                                                                            │
│  No. I · Spring 2026                Changelog · Roadmap · GitHub · Privacy │
└────────────────────────────────────────────────────────────────────────────┘
```

### Signature moment (after clicking "Begin writing")

```
┌────────────────────────────────────────────────────────────────────────────┐
│  ◇ Yidhan                                                  ☾    Sign in    │
│                                                                            │
│                                                                            │
│                     Untitled                                               │   ← Cormorant
│                     (placeholder, italic)                                  │     title field
│                                                                            │     fades in
│                                                                            │
│                     Yidhan is for the half-formed sentence that            │   ← prose stays
│                     becomes a paragraph at midnight. No folders.           │     EXACTLY in
│                     No tags. No app to learn. Just a soft surface          │     screen position
│                     and room to think.                                     │
│                                                                            │
│                     Everything you write is yours alone — encrypted        │
│                     before it leaves your hands, kept on every device.     │
│                                                                            │
│                     It begins the moment you |                             │   ← visitor's caret
│                                                                            │     blinks here
│                                                                            │
│                                                                            │
│                                                                            │
│  (footer dimmed)                                                           │
└────────────────────────────────────────────────────────────────────────────┘
```

The visitor's eye does not move. The page they were *reading* becomes the page they're *writing on*.

---

## What was built vs. what's left

### Built in `src/pages/PlaygroundPage.tsx` (dev-only, `/playground`)

- Full visual composition (light + dark themes)
- Mobile responsive (single column, full-width chip, stacked footer)
- Entrance choreography (staggered fade-up: title 80ms → prose 220ms → actions 380ms → trust 480ms)
- Breathing cursor (2.5s ease-in-out, opacity 1 → 0.25 → 1)
- "Begin writing" transition: title/CTA/trust fade, "Untitled" title slot slides in, prose becomes editable, native caret placed at end of last paragraph, footer dims to 35%
- `↺ replay` button in bottom-right to re-trigger the transition during review
- `prefers-reduced-motion` honored (entrance + cursor + transitions all collapse)
- Paper noise via SVG `feTurbulence` (multiply blend in light, soft-light in dark)
- Warm radial wash at top-center (5% accent in light, 7% in dark)

### Not built (intentionally, awaiting decision)

- Wiring the chip to the auth modal (currently triggers the local visual transition only)
- Wiring to the real Tiptap editor (the contentEditable prose is a prototype surface, not the production editor)
- Sign-in textlink is non-functional
- Port to `LandingPage.tsx`
- Removal of the old `LandingPage.tsx`'s atmospheric gradient + manuscript card system
- A real "No. I · Spring 2026" rotation strategy (or removal)

---

## Open questions for the user (deferred a day)

1. **Does the synthesis land?** Worth porting to production, or does it need another move first?
2. **The transition behavior** — keep as visual demo, or wire it to actually launch the auth modal (with the cursor preserved across the modal open) so it's testable end-to-end?
3. **Prose voice** — keep the current draft, rewrite, or generate three voice variants to pick from?
4. **Transition timing** — currently 720ms. Could go slower (1000ms feels more like "the page settles") or snappier. Worth scrubbing with the replay button.
5. **Footer "No. I · Spring 2026"** — editorial flourish or pretentious? Easy to remove.
6. **Title break** — hard `<br>` after "A quiet space" stacks it poetically. Remove for a single balanced block if preferred.

---

## How to review

```
npm run dev
# Open http://localhost:5173/         ← current live landing
# Open http://localhost:5173/playground ← synthesis prototype
```

Compare side by side. Toggle theme. Click "Begin writing" to see the signature moment. Use `↺ replay` to re-trigger.

---

## Related Documents

- [Landing Page Backlog](../active/landing-page-backlog.md) — Living tracker, gaps and rejected ideas
- [Impeccable Design Critique 2026-03-28](../reviews/impeccable-design-critique-2026-03-28-claude.md) — Post-PR-#183 critique whose P1 (manuscript steals CTA focus) this proposal eliminates structurally
- [Landing Page Award-Winning Redesign](../archive/plans/landing-page-award-winning-redesign-claude.md) — Prior plan whose checklist this proposal supersedes
- [Implementation Spec — Landing Page Redesign (PR #183)](../archive/plans/landing-page-redesign-implementation-spec-codex.md) — Spec for the previous, two-column redesign
