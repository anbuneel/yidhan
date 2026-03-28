# Landing Page Backlog

**Last Updated:** 2026-03-28
**Status:** Living Document
**Phase:** Post-redesign (PR #183 merged)

---

## Source Documents

- [Implementation Spec (Codex)](../archive/plans/landing-page-redesign-implementation-spec-codex.md) — Authoritative checklist
- [Multi-Agent Ideation (Claude)](../archive/plans/landing-page-redesign-multi-agent-ideation-claude.md) — Brainstorm with Claude + Codex + Gemini
- [Award-Winning Redesign (Claude)](../archive/plans/landing-page-award-winning-redesign-claude.md) — Fresh analysis + combined checklist
- [Conversion Refresh (Codex)](../archive/plans/landing-page-conversion-refresh-codex.md) — Initial brief
- [Design Critique 2026-03-28](../reviews/impeccable-design-critique-2026-03-28-claude.md) — Post-redesign impeccable critique

---

## Completed (PR #183)

All P0 and P1 items from the implementation spec are shipped:

- [x] Single-canvas hero (kill split-screen)
- [x] Single header bar
- [x] Single dominant manuscript with 4-layer shadow
- [x] Manuscript matches real editor typography
- [x] CTA cluster restructure (button + proof + E2EE + demo link)
- [x] Proof rail (Open source / Offline-first / E2EE)
- [x] Stillness after entrance (only cursor breathes)
- [x] Mobile first-class composition
- [x] Remove Full Name from signup
- [x] Modal reassurance micro-copy (top + bottom)
- [x] Sheet-rising modal animation
- [x] Horizontal clip-path text reveal
- [x] Asymmetric entrance choreography
- [x] Light theme warm terracotta shadows
- [x] Both themes art-directed independently

---

## Actionable Gaps

Small items that can be done without major design decisions.

- [ ] **Proof rail links** — "Offline-first" and "E2EE" claims are plain text; spec says each should link to verifiable proof (encryption docs, technical spec)
- [ ] **Modal visual DNA** — Verify modal shadow/glow matches manuscript visual language (spec P1 #9, #11)

---

## Promote When Hero is Validated

Strongly endorsed by all counter-reviewers. Revisit once the current hero has been live and tested.

- [ ] **Below-the-fold "second act"** — Three scroll-revealed sections: "What it feels like" (manuscript excerpts), "What stays yours" (privacy), "Begin" (repeated CTA). Codex: "the page needs a second act so the redesign doesn't become one beautiful screen with no proof." Gemini: "the hero hooks, the second act converts."

---

## Design Critique Findings (2026-03-28)

From post-redesign impeccable critique. Cross-reference with implementation to confirm relevance.

- [ ] **P2: Trust badges visibility** — Proof rail may still be too subtle; consider amplifying. Recommended: `/bolder`
- [ ] **P3: Mobile landing coherence** — Verify mobile card preview feels connected to main content. Recommended: `/adapt`
- [ ] **P5: Copy hierarchy stepping** — Check if size/weight stepping below headline is sufficient. Recommended: `/clarify`

*Note: P1 (manuscript stealing CTA focus) and P4 (demo starter notes) are not landing page items.*

---

## Deferred — Revisit Individually

Nice-to-have signature details. Test in browser before committing.

- [ ] Paper fold shadow at corner (wabi-sabi craft detail — "almost subliminal")
- [ ] Breathing cursor with localized warm glow (120px, 20px blur)
- [ ] Aged bottom-edge gradient on manuscript (6-8% accent warmth)
- [ ] Paper noise texture on background (SVG `feTurbulence`, 0.06 opacity)
- [ ] Time-contextual manuscript content (morning/afternoon/evening/night)
- [ ] Theme toggle slow crossfade (appealing but not low-effort)

---

## Rejected (Do Not Revisit)

Decisions made during ideation — documented here to prevent re-litigating.

| Item | Reason |
|------|--------|
| Kintsugi accent line | Tried and removed in practice |
| Parallax | All 3 models backed away in counter-review |
| Manuscript-to-modal morph | Codex: "semantically confused" |
| Letterpress text effect | Readability risk |
| Embedded practice editor on landing | Already have `/demo` route |
| Manuscript partially cropped by viewport | Gemini: "can look like a layout error" |
| Kintsugi seam shimmer | "Risks feeling decorative" |
| Continuous drift/floating | Conflicts with stillness-after-entrance brand |
| Direct OAuth buttons in hero | Codex contradicted own proposal — clutters composition |
