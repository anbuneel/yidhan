# Design system

The visual system as rules. Screen-by-screen layout lives in `docs/ui-layout.md`;
any inventory of what a component currently renders is derivable from the component
itself and is deliberately not here.

## Aesthetic direction

Japanese-inspired minimalism with warmth — Muji interiors, Kinfolk spreads. Natural
materials, generous whitespace, subtle texture.

**Anti-references, and this matters more than the references:** Notion, Obsidian,
Bear, iA Writer, Apple Notes. Yidhan should not look or feel like any of them. No
sidebar-heavy layouts, no feature density, no tech-forward aesthetics.

## Principles

1. **Restraint over features.** Every element must earn its place. When in doubt,
   leave it out.
2. **Warmth over precision.** Organic, imperfect forms over geometric rigidity.
   Wabi-sabi: beauty in imperfection.
3. **Calm over engagement.** The interface should lower the heart rate, not raise
   it.
4. **Craft over convention.** Sweat the details others skip.
5. **Honesty over decoration.** Empty states are honest, not hidden. Surfaces feel
   like real materials.

## Tokens

All colour, type and radius values are CSS custom properties in `src/index.css`.
Use `--color-*`, `--font-display` / `--font-body`. **Never hardcode a colour** —
the theme system is the only source of colour truth.

Signature radius: `--radius-card: 2px 24px 4px 24px` (asymmetric wabi-sabi
corners). Small elements use `2px 12px 4px 12px`.

## Themes

Config in `src/themes/`. Active: **Kintsugi** (light, terracotta) and **Midnight**
(dark, gold — the default). Washi and Mori are also available. Regenerate CSS with
`npm run theme:generate`; preview without writing via `npm run theme:preview`.

Colour philosophy: earthy and natural, drawn from Japanese craft. Never neon, never
cold blue. Dark themes use deep forest green rather than pure black.

## Button and accent taxonomy

Three semantic categories. **Never mix them** — this is the rule most often broken
by well-meaning edits.

| Category | Tokens | Use for |
|---|---|---|
| **CTA** | `--color-cta-bg` / `--color-cta-text` | Positive primary actions (Save, Submit, Create, Stay) |
| **Destructive** | `--color-destructive` / `--color-destructive-text` | Irreversible danger (Delete, Let go) |
| **On-accent** | `--color-accent` / `--color-on-accent` | Toggle and active indicators (toolbar bold/italic/H1) |

Primary buttons must use the CTA tokens — **not** `--color-accent` with `#fff`.

**Dark themes deliberately flip CTA polarity:** bright gold background with dark
text, not darkened gold with white text. Darkening gold far enough to carry white
text at AA produces dull olive — the "gold luminance trap". Reasoning and measured
ratios are in `DECISIONS.md` (2026-03-22).

`onAccent` is per-theme: white in light themes, dark background in dark themes.

## Typography

Cormorant Garamond (display), Source Sans 3 (body), JetBrains Mono (code).
**Self-hosted, never loaded from Google Fonts** — see `DECISIONS.md` (2026-09-04)
for why, and `CLAUDE.md` for the invariants that keep it that way.

Declared weight ranges are deliberately narrow (Cormorant `300 600`, Source Sans
`300 500`, JetBrains Mono `400`) to match what was previously loaded. Widen them in
`src/fonts.css` if a true bold is wanted.

## Signature elements

Paper noise texture overlay; asymmetric corners; manuscript glow on the editor
(viewport-following radial gradient); aged-paper gradient on cards (3% accent
warmth at the bottom); spring-physics animations.

The enso logo mark is two CSS-masked layers filled with theme colours, so the arc
takes `--color-accent` and the seed stays `--color-brand-gold`. Regenerate masks
with `npm run logo:masks`.

## Modals

All modals use the shared `.modal-backdrop` class in `src/index.css`.

**One exception:** `BottomSheet.tsx`'s mobile path uses inline styles instead,
because react-spring's animated `opacity` conflicts with `backdrop-filter`
compositing on the CSS class. Do not "fix" this by moving it onto the class.

## Styling approach

Three approaches coexist; use the right one:

- **Tailwind classes** (default) — layout, spacing, responsive breakpoints.
- **Inline `style`** — only for dynamic values driven by state/props, or a one-off
  CSS variable reference not worth a class.
- **CSS-in-JSX `<style>`** — complex selectors, keyframes, or media queries
  Tailwind cannot express.

Avoid creating inline style objects for *static* values that could be a Tailwind
class or a class in `index.css`. Inline SVGs use `strokeWidth={1.5}` consistently.

## Accessibility baseline

WCAG AA across all themes, verified on every CTA and accent combination.
`prefers-reduced-motion` collapses animations to 0.01ms globally. Focus-visible
rings on every interactive element. iOS safe-area insets honoured. 16px minimum
font on mobile inputs, to prevent iOS zoom.

## Voice

Calm, intentional, warm. Yidhan never shouts and never sells. Language is organic:
"Faded Notes" not "Trash", "Release" not "Delete", "Letting Go" not "Delete
Account". The app recedes; the thoughts do not.
