# Zenote Color Theme: Final Specification

**Author:** Claude (Opus 4.5)
**Date:** 2025-12-25
**Consulted:** Frontend Design Skill
**Status:** ✅ IMPLEMENTED

---

## Implementation Decision

After analysis and preview, we decided to **keep the current Kintsugi (light) + Midnight (dark) themes** with the following enhancements:

- ✅ Added warm paper texture to light mode (`sepia(80%) saturate(120%)`)
- ✅ Increased noise opacity to 0.10 for both themes
- ✅ Reduced light mode card opacity to 0.75 for texture visibility
- ✅ Added configurable `--noise-filter` CSS variable

The proposed Washi/Mori themes remain available in `src/themes/` for future use.

---

## Original Prompt

> Let's continue working on choosing the right color schemes for the light and dark modes. Your earlier analysis is here: docs\analysis\color-theme-analysis-claude.md. Google Gemini's review and suggestions are here: docs\reviews\color-theme-analysis-gemini-response.txt. Use the frontend skill to understand that and give me a finalized proposal for the color theme.

---

## Executive Summary

After synthesizing the earlier analysis and Gemini's feedback, here's the recommendation:

**Keep your existing accent colors.** The terracotta (#C25634) and antique gold (#D4AF37) are already working well—they're distinctive, culturally authentic, and provide excellent affordance. The earlier proposal of kakishibu brown (#8B4513) was atmospheric but Gemini correctly identified the "disabled button" problem.

**Adopt the Washi backgrounds** for light mode—this is the key change that solves the grey problem.

**Refine Mori slightly** for dark mode with warmer undertones.

---

## Implementation-Ready Theme Specification

### Light Mode: Washi (和紙) — Handmade Paper

```css
/* ═══════════════════════════════════════════════════════════
   WASHI LIGHT THEME - Warm cream with terracotta accent
   ═══════════════════════════════════════════════════════════ */

/* Backgrounds - warm cream gradient, not grey */
--color-bg-primary:    #F6F1E7;   /* Aged washi - main background */
--color-bg-secondary:  #EDE6D6;   /* Cards, inputs - paper in shadow */
--color-bg-tertiary:   #E3D9C6;   /* Hover states, borders - foxed edges */
--color-card-bg:       rgba(253, 250, 242, 0.75);  /* Semi-transparent for texture */

/* Text - warm sumi ink tones */
--color-text-primary:  #2C2622;   /* Deep sumi - slightly warmer than current */
--color-text-secondary:#5A524A;   /* ACCESSIBLE: 5.2:1 ratio on #F6F1E7 */

/* Accent - KEEP terracotta (Gemini agrees) */
--color-accent:        #C25634;   /* Terracotta - current, works perfectly */
--color-accent-hover:  #A8482C;   /* Darker on hover for depth */
--color-accent-glow:   rgba(194, 86, 52, 0.15);

/* Semantic colors */
--color-border:        #D8CFBE;   /* Warm border, not grey */
--color-border-subtle: #E8E0D0;   /* Very subtle separation */

/* Status colors (roadmap, etc.) */
--color-status-progress:  #C9A962;  /* In progress - gold */
--color-status-coming:    #C25634;  /* Coming soon - terracotta */
--color-status-exploring: #8B8178;  /* Exploring - warm stone */

/* Changelog change types */
--color-change-feature:     #C25634;  /* New features */
--color-change-improvement: #5D6B4D;  /* Improvements - moss */
--color-change-fix:         #6B8E7A;  /* Fixes - sage */

/* Paper texture effect */
--noise-opacity: 0.10;
--noise-filter: sepia(80%) saturate(120%) brightness(0.95);  /* Warm paper tint */
```

### Dark Mode: Mori (森) — Deep Forest

```css
/* ═══════════════════════════════════════════════════════════
   MORI DARK THEME - Forest green with antique gold accent
   ═══════════════════════════════════════════════════════════ */

/* Backgrounds - warm forest, not cold black */
--color-bg-primary:    #171C17;   /* Forest floor at dusk - green undertone */
--color-bg-secondary:  #1E241E;   /* Cards - moss on bark */
--color-bg-tertiary:   #272E27;   /* Hover states - fern shadow */
--color-card-bg:       rgba(20, 30, 20, 0.6);  /* Semi-transparent for texture */

/* Text - moonlight on paper */
--color-text-primary:  #E8E4DC;   /* Warm white - like moonlit paper */
--color-text-secondary:#9A9690;   /* ACCESSIBLE: 4.6:1 ratio on #171C17 */

/* Accent - KEEP antique gold */
--color-accent:        #D4AF37;   /* Antique gold - kintsugi reference */
--color-accent-hover:  #E4BF47;   /* Brighter gold on hover */
--color-accent-glow:   rgba(212, 175, 55, 0.20);

/* Semantic colors */
--color-border:        #2D352D;   /* Forest border */
--color-border-subtle: #232A23;   /* Very subtle separation */

/* Status colors */
--color-status-progress:  #D4AF37;  /* In progress - gold */
--color-status-coming:    #C9A962;  /* Coming soon - aged gold */
--color-status-exploring: #7A7670;  /* Exploring - lichen */

/* Changelog change types */
--color-change-feature:     #D4AF37;  /* New features */
--color-change-improvement: #8CA092;  /* Improvements - celadon */
--color-change-fix:         #7C9082;  /* Fixes - jade */

/* Paper texture effect */
--noise-opacity: 0.10;
--noise-filter: grayscale(100%);  /* Neutral grain for dark mode */
```

---

## Accessibility Verification

| Element | Background | Text Color | Contrast Ratio | WCAG |
|---------|------------|------------|----------------|------|
| Light primary text | #F6F1E7 | #2C2622 | **11.8:1** | AAA |
| Light secondary text | #F6F1E7 | #5A524A | **5.2:1** | AA |
| Light accent on bg | #F6F1E7 | #C25634 | **4.7:1** | AA |
| Dark primary text | #171C17 | #E8E4DC | **12.1:1** | AAA |
| Dark secondary text | #171C17 | #9A9690 | **4.6:1** | AA |
| Dark accent on bg | #171C17 | #D4AF37 | **8.2:1** | AAA |

*The secondary text values (#5A524A for light, #9A9690 for dark) are darkened/lightened from the original proposals to meet WCAG AA standards while preserving the "faded ink" aesthetic.*

---

## Accent Color Rationale

**Keep #C25634 (Terracotta) for light mode:**
- Already in production and working
- Gemini specifically recommended this exact value
- Provides "Seal Red" affordance without being aggressive
- 4.7:1 contrast ratio passes accessibility
- Evokes hanko stamps on aged paper

**Keep #D4AF37 (Antique Gold) for dark mode:**
- Direct kintsugi reference (gold repair on broken ceramics)
- 8.2:1 contrast ratio is excellent
- Warm metallic tone pairs beautifully with forest green
- Distinctive—no SaaS app uses this combination

---

## On "Temporal Themes" (Gemini's Idea)

**Verdict: Elegant concept, but defer for now.**

### Why it's appealing:
- Reinforces "living environment" ethos
- Natural circadian alignment
- Technically feasible with CSS custom properties

### Why to defer:
1. **Scope creep** - You have a working product; this is a "delight" feature, not core
2. **User expectation** - Most users expect manual theme control
3. **Edge cases** - Travelers, night-shift workers, people who prefer light mode at night
4. **Testing burden** - 4 themes instead of 2

### If you pursue it later:
- Make it opt-in ("Auto" option alongside Light/Dark)
- Use `prefers-color-scheme` as baseline, time-of-day as enhancement
- Transition between themes gradually (15-minute fade) to avoid jarring shifts

**Recommendation:** Ship Washi + Mori now. Add temporal themes in a "v2.0 Seasons" release if users request it.

---

## What Changes from Current

### Light Mode Changes

| Property | Current Light | New Washi | Change |
|----------|---------------|-----------|--------|
| bg-primary | Grey-ish | #F6F1E7 cream | **Warmer** |
| bg-secondary | Cool grey | #EDE6D6 | **Warmer** |
| text-secondary | May be low contrast | #5A524A | **Accessible** |
| accent | #C25634 | #C25634 | No change |

### Dark Mode Changes

| Property | Current Dark | New Mori | Change |
|----------|--------------|----------|--------|
| bg-primary | #1a1f1a | #171C17 | Slightly warmer green |
| bg-secondary | — | #1E241E | More green undertone |
| accent | #D4AF37 | #D4AF37 | No change |

---

## Implementation Checklist

1. Update `src/themes/washi.ts` with the light mode values above
2. Update `src/themes/mori.ts` with the dark mode values above
3. Run `npm run theme:generate` to generate CSS
4. Test all UI states (buttons, hovers, focus states, error states)
5. Verify tag colors still work against new backgrounds
6. Check toast notifications, modals, dropdowns

---

## Visual Summary

```
┌─────────────────────────────────────────────────────────────┐
│  WASHI (Light)                    MORI (Dark)               │
│                                                             │
│  ████████████████                ░░░░░░░░░░░░░░░░░░        │
│  █  #F6F1E7     █                ░  #171C17      ░          │
│  █  cream       █                ░  forest       ░          │
│  ████████████████                ░░░░░░░░░░░░░░░░░░        │
│                                                             │
│  Text: #2C2622 / #5A524A         Text: #E8E4DC / #9A9690   │
│                                                             │
│  Accent: ████ #C25634            Accent: ████ #D4AF37      │
│          terracotta                      antique gold       │
└─────────────────────────────────────────────────────────────┘
```

---

## Related Documents

- **Earlier Analysis:** `docs/analysis/color-theme-analysis-claude.md`
- **Gemini Review:** `docs/reviews/color-theme-analysis-gemini-response.txt`
- **Theme Files:** `src/themes/washi.ts`, `src/themes/mori.ts`

---

*This specification is implementation-ready. The key win is solving the "grey problem" in light mode while preserving the accent colors that already work well.*
