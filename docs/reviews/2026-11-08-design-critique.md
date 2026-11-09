# Design critique: typography, colour schemes, UI

Date: 2026-11-08
Method: Impeccable critique, two independent passes (design review; detector, browser
overlay and contrast maths)
Reviewed: branch `codex/fix-library-delete-contract` at 6cb5014, pages `/` and `/demo`,
both themes, 1440px and 375px
Score: 29/40 (Good)
Outcome: findings only, nothing fixed yet

The question was whether the type, colour and UI read as AI-generated, with a specific
doubt about the two colour schemes.

**Main moved after the review.** The accessibility pass (#259, item 160) already fixed
most of the Kintsugi contrast findings: textSecondary is `#55524C`, textTertiary
`#65625C`, accent `#BF5432`, and a new `accentText` `#8F3C21` carries links. Each
finding below says whether it still holds on main at 85452c5. Re-run the critique
against main before acting on the contrast numbers.

## Verdict

Not slop. The copy, the live editor as the hero, and the single-column editor are
authored for this product.

The visual layer is built from the first choices a model makes for "calm and premium":

- Cormorant Garamond Light with Source Sans 3 Light. The most common "elegant" pairing.
- `#D4AF37`, the textbook "metallic gold" hex, used in Midnight for the CTA, outline
  buttons, card borders, active pill, links and logo.
- Tailwind and Material defaults in the semantic colours: `#DC2626` and `#FEE2E2`
  (Kintsugi), `#EF4444` and `#4CAF50` (Midnight), tag `indigo: '#4A5568'` in
  `src/types.ts`, which is Tailwind gray-600.
- Uppercase tracked metadata with coloured dots, a stock dashboard-card pattern.
- Glow shadows, a radial editor glow and five backdrop blurs. Together, mild
  glassmorphism.
- The asymmetric card radius applied to every card the same way. It reads as a
  rendering quirk, not imperfection, and on cards of uneven height it looks accidental.

What is distinctive and should stay: the copy voice ("Not even us", "Faded Notes",
"Release"); the live editor hero with honest "not encrypted" labelling; the plain-text
trust strip with no icon grid; the enso mark; the calm editor column.

The detector found no gradient text, feature grids or stock patterns in `src/`.

## Heuristics

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of status | 3 | "Keep them" banner on mobile is unclear |
| 2 | Match with real world | 4 | Language is human and organic |
| 3 | User control | 3 | 17-button landing toolbar invites accidental formatting |
| 4 | Consistency | 2 | Two CTA colour logics; title weight 600 in editor, 300 in hero |
| 5 | Error prevention | 3 | Practice draft clearly labelled "not encrypted" |
| 6 | Recognition | 3 | Toolbar labels readable but about 10px |
| 7 | Flexibility | 3 | Shortcuts exist; toolbar shows everything at once |
| 8 | Minimalism | 2 | Gold everywhere, glows, uppercase meta, dense toolbar |
| 9 | Error recovery | 3 | Error colours are off-brand defaults |
| 10 | Help | 3 | "How the locking works" link is good |
| | **Total** | **29/40** | **Good** |

## The two colour schemes

**Midnight (dark, the default).** All token pairs pass AA. The search placeholder
`#7A7C72` is 4.49:1, just under. But:

- `#050A06` is 2.9% lightness. The green is invisible; it reads as black.
- `textSecondary #A3ABA3` and `textTertiary #8E9A8E` are cool green-grey next to warm
  cream text and gold.
- Gold carries every emphasis, so nothing stands out. The first impression is "premium
  wallet" before "calm notebook".

**Kintsugi (light).**

- `#EBE8E4` is warm grey, not paper. Cards are cream, so they look pasted on.
- Contrast at review time (old tokens):

| Element | Ratio | On main |
|---|---|---|
| accent `#C25634` as text | 3.07–4.20 | Fixed by `accentText` where adopted; check "Sign In", "Practice Space", active chip |
| textTertiary `#7D7974` | 2.96–4.04 | Fixed: `#65625C`, 4.98:1 |
| textSecondary on bgSecondary/Tertiary | 3.80–4.30 | Fixed: `#55524C` |
| error `#DC2626` | 3.95 | Still `#DC2626` |
| "Practice Space" label `#CC7B60` | 2.6 | Not verified |
| search placeholder `#928F8A` | 2.5 | Not verified |
| logo gold seed | 1.72 | Unchanged (decorative) |

**As a pair.** They do not read as one brand. Light is terracotta on grey; dark is
gold on black. The only shared element is the gold logo seed. The CTA hue differs. Tag colours are fixed hex, so
`forest #3D5A3D` and `plum #6B4C5A` vanish on Midnight.

## Priority issues

1. **[P1] The themes share no accent, and Midnight's gold reads as a luxury template.**
   Still holds on main. Fix:
   - One accent family in both. Terracotta is more ownable: lift it to about `#D98A68`
     on dark.
   - Gold only for the kintsugi seam and the logo seed.
   - Midnight backgrounds to about `#0E1511` / `#141D17` / `#1A2520`.
   - Midnight greys warmed to about `#B3AD9E` / `#948E80`.
   - Neutral card borders, about `rgba(234, 230, 216, 0.08)`.
   Mirror any change in the `index.html` boot shell.
2. **[P1] Mobile editor title is smaller than the body.** Still holds on main
   (`src/index.css`, "Prevent iOS zoom" rule). `textarea { font-size: 16px !important }`
   overrides the title's 2.25rem, so the title is 16px against 19.2px body. Fix: exclude
   the title textarea, or use `max(16px, 1em)`.
3. **[P1, mostly fixed on main] Kintsugi failed WCAG AA.** Item 160 fixed the text tiers
   and added `accentText`. Left: error `#DC2626` (use about `#A8402A`), and verify the
   "Practice Space" label, search placeholder and active "All Notes" chip.
4. **[P2] Detail-level defaults.** Still holds on main. Replace the Tailwind and Material
   semantic colours with earthy tokens (moss, persimmon). Make tag colours theme tokens.
   Drop uppercase micro-caps for sentence-case 13px.
5. **[P2] Thin type and a dense landing toolbar.** Still holds on main. `body` is
   `font-weight: 300`. The landing demo shows 17 toolbar controls with labels around
   10px, the most Notion-like thing on the page. Fix: body 400; titles 500, 300 only for
   the hero; about five controls in the demo, the rest behind "…".

## Persona red flags

- **First-timer:** black and gold reads as fintech; labels like "1.List", "Mark", "Code"
  feel like a power tool; "Keep them" is ambiguous.
- **Mobile:** 16px title; tag chips wrap with "Reading" orphaned; toolbar labels about
  10px; Undo and Redo nearly invisible.
- **Accessibility:** the Kintsugi contrast failures; Light-weight body under the noise
  overlay; 10.4px uppercase timestamps and tag chips (`TagBadge.tsx`, `NoteCard.tsx`).
- **Reflective writer who left Notion:** the formatting strip and red/yellow/green tag
  dots feel like what they left. They would like the copy and the editor column.

## Minor

- `kintsugi.ts` claims the destructive pair is 7.09:1. It is 5.26:1. Still passes.
- The dark landing page has a visible seam band just above the sample cards.
- Card shadows are heavy and read as floating SaaS cards. Halve the opacity.
- `IOSInstallGuide.tsx` uses a cold iOS-blue gradient.
- `ErrorBoundary.tsx` fallbacks `#1a1f1a` and `#f5f5f0` are not theme values.
- The dev-only `LogoTestPage` palette (`#f8f1e8`, `#8f4d2e`) is warmer than the shipping
  Kintsugi and worth a look.

## Detector false positives

- `cream-palette` on `#EBE8E4`: the documented Kintsugi background.
- `cramped-padding` on `.boot-manuscript`: it uses `clamp()` padding the scanner cannot
  resolve.
- `dark-glow` on the boot CTA: the documented gold CTA glow, not zero-offset.
- `dark-glow #c25634` on `<body>` in dark mode: no element carries it; probably the
  pulse keyframes.

## Open questions

- If gold left Midnight, what would be lost besides the word "Kintsugi"?
- The product promises paper and calm, but the default first screen is black and gold.
  Should light be the default?
- The brand serif appears only in titles. Would a serif body in the editor differentiate
  the product more than any colour change?
