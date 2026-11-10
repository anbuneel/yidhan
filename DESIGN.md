# Design system

The visual system as rules. Screen-by-screen layout lives in `docs/ui-layout.md`;
any inventory of what a component currently renders is derivable from the component
itself and is deliberately not here.

## Aesthetic direction

A calm page and one serif (`DECISIONS.md`, 2026-11-09). A near-white page in daylight,
a deep green-black one at night, solid sheets on top, and one green. Marigold is the
logo's sun. Hierarchy comes from size, weight
and italic, not from colour or a second typeface.

Earlier framings are retired: the Japanese one (kintsugi, wabi-sabi, the enso) and
Bright Spring. Do not cite them as direction.

**Anti-references, and this matters more than the references:** Notion, Obsidian,
Bear, iA Writer, Apple Notes. Yidhan should not look or feel like any of them. No
sidebar-heavy layouts, no feature density, no tech-forward aesthetics.

## Principles

1. **Restraint over features.** Every element must earn its place. When in doubt,
   leave it out.
2. **Quiet over bold.** No bold colour. Green is the one working colour.
3. **Calm over engagement.** The interface should lower the heart rate, not raise
   it.
4. **Craft over convention.** Sweat the details others skip.
5. **Honesty over decoration.** Empty states are honest, not hidden. Surfaces feel
   like real materials.

## Tokens

All colour, type and radius values are CSS custom properties in `src/index.css`.
Colours come from `src/themes/`. `npm run theme:generate` writes them into the
generated block, and `src/themes/themeCss.test.ts` fails if the block is stale. Do not
hand-edit it. **Never hardcode a colour**: the theme system is the only source of
colour truth.

Rules the contrast numbers force (`src/themes/contrast.test.ts` checks them):

- **Green as text uses `--color-accent-text`.** `--color-accent` is for fills and
  marks. In light it falls to 4.39:1 on the tinted surface.
- **Marigold (`--color-brand-marigold`, `#F2A21B`) is never text on the light page**
  (2.02:1).
- **`--color-glass-border` is a hairline**, for dividers and card outlines only. Input
  borders use `--color-input-border`, at 3:1 or better.
- **Note text has its own colour and weight**: `--color-text-note` and `--note-weight`
  (400 in light, 430 in dark, because light strokes fade on a dark page).

The logo greens are `--color-brand-leaf` (the theme accent) and
`--color-brand-leaf-deep` (`#163026`, the icon tile and the letter).

### Radius

| Token | Value | Use |
|---|---|---|
| `--radius-card` | `2px 24px 4px 24px` | The leaf corner. Note cards and the editor sheet only, including the landing's sample sheet |
| `--radius-pill` | `9999px` | Buttons and chips |
| `--radius-input` | `8px` | Inputs |
| `--radius-plain` | `12px` | Modals, menus, toolbars, popovers, panels |

Nothing else takes the leaf corner. A modal, a button, a pill or a tag never does.

## Themes

Two themes in `src/themes/`: **Light** (`light.ts`) and **Dark** (`dark.ts`). Stored
values are `light` and `dark`. A first visit follows the device setting; dark is the
fallback when the device states none. Preview generated CSS without writing via
`npm run theme:preview`.

| Token | Light | Dark |
|---|---|---|
| Page (`bgPrimary`) | `#FAFAF6` | `#151C18` |
| Card and sheet (`cardBg`) | `#FFFFFF` | `#1B2620` |
| Tinted surface (`bgTertiary`) | `#EDF1EA` | `#1F2C25` |
| Text | `#14241C` | `#E6E3DC` |
| Note text | `#22332A` | `#D3D2CA` |
| Accent | `#2E7D55` | `#86C5A0` |
| Accent as text | `#1F6A49` | `#9AD0B0` |
| Hairline | `#E1E4DC` | `#2A362F` |

Cards and sheets are solid, so contrast is measured on them directly. The dark theme
has no shadows. Light shadows are soft and in the text's green-black.

## Button and accent taxonomy

Four semantic categories. **Never mix them** — this is the rule most often broken
by well-meaning edits.

| Category | Tokens | Use for |
|---|---|---|
| **CTA** | `--color-cta-bg` / `--color-cta-text` | Positive primary actions (Save, Submit, Create, Stay) |
| **Destructive** | `--color-destructive` / `--color-destructive-text` | Irreversible danger (Delete, Let go) |
| **On-accent** | `--color-accent` / `--color-on-accent` | Toggle and active indicators (toolbar bold/italic/H1) |
| **Accent as text** | `--color-accent-text` | Links and selected labels; the only accent allowed as running text |

Primary buttons must use the CTA tokens — **not** `--color-accent` with `#fff`. No
coloured glow under buttons.

**The dark theme flips CTA polarity:** a light green fill with dark text, not a dark
green with white text. The reasoning, first made for gold, is in `DECISIONS.md`
(2026-03-22).

`onAccent` is per-theme: white in light, the dark page colour in dark.

## Typography

**Newsreader for everything**: titles, note text, buttons, labels, forms. There is no
sans-serif anywhere. `--font-serif` is the stack; `--font-display` and `--font-body`
are aliases of it.

| Family | Token | Where |
|---|---|---|
| Newsreader, roman and italic, 400 to 700, optical size pinned at 18 | `--font-serif` | Every word not listed below |
| Newsreader Display, optical size 72, weight 500, latin roman | `--font-title` | Big titles: the note title and the landing headline |
| Courier Prime, regular, italic, bold | `--font-mono` | Inline code, code blocks and the recovery key only. Not the toolbar, the search box or status text |
| Literata, roman and italic | in `--font-serif`, after Newsreader | Cyrillic and Greek only. Declared with those unicode ranges, so a Latin page never fetches it |

Rules:

- **Counts and dates are italic**, like "Synced" and "Just now".
- **No capital-letter labels.** No uppercase, no letter-spaced labels.
- **No `font-variant-caps` or `small-caps`.** Newsreader has no small capitals, so the
  browser fakes them.
- **Body weight is 400.** Note text in dark is 430 (`--note-weight`).

**Self-hosted, never loaded from Google Fonts**: files in `src/assets/fonts/`,
declared in `src/fonts.css`, licences in `public/licenses/fonts/`. See `DECISIONS.md`
(2026-09-04) for why, and `CLAUDE.md` for the invariants. `src/fonts.test.ts` checks
the declarations. The display cut exists because of the first-visit budget
(`DECISIONS.md`, 2026-11-09).

## Texture

A faint, untinted grain sits on the page background only: 7% black in light, 5% white
in dark (`grainColor`, `noiseOpacity`). Page-level containers paint
`var(--page-background)`. A new full-page container must too, or it covers the grain
with a smooth band. Nothing sits over content. Cards, the editor sheet, modals, menus
and inputs are opaque and smooth.

The editor keeps a faint, neutral glow that follows the viewport: a 4% shade of the
text colour, no accent. A ref-based scroll handler positions it (`CLAUDE.md`). Note
cards carry a 3% accent tint at the bottom.

## Save and sync states

Colour cannot carry the meaning, because the accent is green. Each state is a word in
italic plus its own small line icon (`src/components/SyncStateIcon.tsx`), in the
neutral text colour: saving, not saved, saved, synced, copied, pending, offline,
blocked. Only the blocked icon takes a colour, `--color-destructive`. "Synced" still
needs a server-confirmed content hash (`CLAUDE.md`).

## Logo

A green leaf that is also a page, in the leaf-corner shape, with text lines cut out of
it. A small marigold sun sits behind its top-left corner, with a gap in the page colour
between them. Inside the sun is the Tamil letter இ in deep green. Beside the mark is
the lowercase "yidhan" wordmark as an SVG path, with a green y and a marigold sun as
the dot of the i. Fraunces never ships as a font. Decisions: `DECISIONS.md`,
2026-11-09.

- **Size rule** (`src/components/logoSizeRule.ts`): the bare mark shows the letter from
  128px, the icon tile from 192px. Below that the sun is plain.
- **Small sizes, 16 to 48px**, use a separate drawing with one text line
  (`mark-small.svg`, `tile-dark-small.svg`). The header logo (30px on a phone, 36px
  from 640px) uses it.
- **The icon tile is dark green** (`#163026`), for the app icon and the favicon. The
  leaf on it is the light green.
- **Colours follow the theme.** The leaf and the y take `--color-brand-leaf`, the rest
  of the word `--color-text-primary`. Marigold is the one fixed colour. The gap and
  the lines are holes, so the page shows through.
- **Where it lives.** The header drawings are an SVG sprite in `index.html` outside
  `#root`. The landing shell and `Logo.tsx` both draw it with `<use>`. Larger marks are
  `LogoMark.tsx`. Sources are in `images/brand/source/`, exports in
  `images/brand/export/`, retired artwork in `images/brand/archive/`.
- **Regenerate**: `python scripts/brand/flatten.py` (needs `skia-pathops`), then
  `npm run icons:generate`, `npm run splash:generate` and `npm run og:generate`.

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

WCAG AA across both themes, checked by `src/themes/contrast.test.ts`.
`prefers-reduced-motion` collapses animations to 0.01ms globally. Focus-visible
rings on every interactive element. iOS safe-area insets honoured. 16px minimum
font on mobile inputs, to prevent iOS zoom; the editor title is left out of that rule
so it stays larger than the body text.

## Voice

Calm, intentional, warm. Yidhan never shouts and never sells. Language is organic:
"Faded Notes" not "Trash", "Release" not "Delete", "Letting Go" not "Delete
Account". The app recedes; the thoughts do not.
