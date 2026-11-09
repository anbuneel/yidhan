Status: PROPOSAL
Last verified: 2026-11-09

# Themes and type: Bright Spring

A plan to put the owner's 2026-11-09 design decisions into the app. The decisions are
in `DECISIONS.md` (2026-11-09, "The design direction is Bright Spring"). The reviews
behind them are `docs/reviews/2026-11-08-design-critique.md` and
`docs/reviews/2026-11-09-design-review.md`. Nothing here is implemented yet.

**This must land after the logo-and-icons rollout.** That work also edits `index.html`,
`Logo.tsx` and the logo part of `DESIGN.md`. Do not run the two in parallel. Start this
from `main` once the rollout has merged, and re-check every file list below against
what it changed.

## What is decided

- Direction: Bright Spring. The Japanese framing is dropped.
- Green is the brand colour in both themes. Light is a paper page. Marigold `#F2A21B`
  is the one small accent and never carries text on the light page.
- Night page `#0F1F18`, night cards `#163026`.
- Fraunces for titles and quotes. Source Sans 3 for body text and UI. Cormorant
  Garamond goes. Real italic files are added.
- The leaf corner (`2px 24px 4px 24px`) stays on note cards and the editor sheet only.
- The editor glow stays, fainter.
- The theme keeps following the device setting. `src/hooks/useAppTheme.ts` and
  `public/boot.js` already do this; their logic does not change.

## Proposed tokens

**These values are a proposal, not the owner's pick.** Five are fixed because they are
the logo's colours: `#163026`, `#F2F0E6`, `#F2A21B`, `#13261D`, `#F8F7F1`. The rest can
move.

| Token | Day | Night |
|---|---|---|
| Page (`bgPrimary`) | `#F2F0E6` | `#0F1F18` |
| Card (`cardBg`) | `#F8F7F1` | `#163026` |
| Text | `#13261D` | `#F2F0E6` |
| Secondary text | `#3D4D44` | `#B7C2B8` |
| Tertiary text | `#5A675F` | `#93A398` |
| Accent | `#2A6548` | `#9CCBA8` |
| On-accent | `#F2F0E6` | `#13261D` |
| Marigold | `#F2A21B` | `#F2A21B` |

Contrast, measured on 2026-11-09 with the WCAG formula:

| Pair | Day, on page / on card | Night, on page / on card |
|---|---|---|
| Text | 13.90 / 14.79 | 14.95 / 12.38 |
| Secondary text | 7.84 / 8.35 | 9.29 / 7.69 |
| Tertiary text | 5.19 / 5.53 | 6.45 / 5.34 |
| Accent as text | 6.02 / 6.41 | 9.37 / 7.76 |
| On-accent on accent | 6.02 | 8.71 |
| Marigold | 1.85 / 1.96 — never text | 8.10 / 6.71 |

Notes:

- Night keeps the flipped CTA from `DECISIONS.md` (2026-03-22): a light green fill with
  dark text.
- Card colours are proposed as solid. Today `cardBg` is a 92% and 88% alpha colour. If
  the alpha stays, measure contrast on the blended result.
- Not proposed yet, to be set in the implementing PR: `bgSecondary`, `bgTertiary`,
  `accentHover`, `accentGlow`, `accentMuted`, `accentText`, the CTA and destructive
  pairs, `success`, `error`, `errorLight`, the status colours, `glassBorder`, the
  shadows and the noise settings.
- Marigold replaces `--color-brand-gold` (`#D4AF37`) in `src/index.css`.

## Where the values go

1. `src/themes/`: the active light and dark theme files, and `types.ts` if a token is
   added. `index.ts` sets which two are active.
2. `npm run theme:generate` writes them into `src/index.css`. Do not hand-edit the
   generated block. `npm run theme:preview` shows the output without writing.
3. Places that copy colours by hand and need the same change:
   - `index.html`: the `--b-*` variables (three blocks: default, `prefers-color-scheme:
     light`, `data-theme="light"`) and `meta name="theme-color"`.
   - `vite.config.ts` (manifest `theme_color`, `background_color`) and
     `capacitor.config.ts` (`backgroundColor`). The logo rollout may already own these.
   - `src/components/ErrorBoundary.tsx` fallback colours.
   - `src/types.ts` `TAG_COLORS`.
   - `scripts/generate-splash-screens.ts` and `scripts/generate-og-image.ts`, then
     regenerate their output. The logo rollout may already own these.
   - `e2e/accessibility.spec.ts` names the themes.
   - `README.md` names the themes and fonts.

## Font work

Fonts stay self-hosted. The invariant in `CLAUDE.md` does not change: files in
`src/assets/fonts/`, declared in `src/fonts.css`, precached, no runtime font caching,
licences in `public/licenses/fonts/`.

1. Add Fraunces, roman and italic, as subsetted variable woff2 files, one per
   unicode-range subset, in the same layout as the current faces.
2. Add Source Sans 3 italic, same subsets as the roman.
3. Make Source Sans 3 cover weight 600. The declared range is `300 500` today. Check
   that the shipped variable files hold 600; if they do, this is a descriptor change.
4. Remove Cormorant Garamond: its five files, its `@font-face` blocks and
   `public/licenses/fonts/cormorant-garamond-OFL.txt`.
5. Add `public/licenses/fonts/fraunces-OFL.txt` with the upstream copyright notice.
   Check that `source-sans-3-OFL.txt` covers the italic files.
6. Point `--font-display` at Fraunces. Use it for titles, headings and block quotes.
   Body text and UI stay on `--font-body`.
7. Update the landing shell in `index.html`: the two font preloads, the inline
   `@font-face` rules, and every `.boot-*` rule that names Cormorant Garamond.
8. Update `src/pages/PlaygroundPage.tsx`, which names Cormorant Garamond.
9. Check the first-visit budget. `scripts/bundle-budget.json` counts fonts as stored,
   and the landing page preloads the display face. If the Fraunces latin file is larger
   than the Cormorant one, either trim axes or raise the budget with a `DECISIONS.md`
   entry. Do not raise it quietly.

JetBrains Mono does not change.

## Type bugs to fix

All three were verified on `main` on 2026-11-09.

1. **Faux bold.** The Source Sans 3 `@font-face` covers 300 to 500, but `strong` and
   several rules in `src/index.css` use 600. The browser synthesizes it. Fixed by font
   step 3.
2. **Faux italic.** No italic face exists, so every italic is synthesized. Fixed by font
   steps 1 and 2.
3. **Phone title smaller than body text.** The "Prevent iOS zoom" rule near
   `src/index.css:1702` sets `font-size: 16px !important` on every `textarea` under
   640px. The title is a textarea, so it drops to 16px against 19.2px body text. Fix:
   leave the title out of the rule, or use `max(16px, 1em)`. Inputs must still be at
   least 16px so iOS does not zoom.

## Fixes all three reviews agreed on

1. **Card outlines.** A faint neutral outline, not gold. Today `glassBorder` in the dark
   theme is gold at 25%.
2. **No glow under buttons.** Remove the coloured shadow under CTAs, including
   `.boot-cta` in `index.html`. Remove the tinted band behind Pinned. Only the editor
   glow stays.
3. **Editor glow, fainter.** `.editor-manuscript-glow` in `src/index.css`. Keep the
   ref-based scroll handler as it is; only the gradient changes.
4. **Lighter shadows.** About half the current opacity.
5. **Body weight 400, not 300.** `body` and `.note-card-preview` in `src/index.css`, and
   the `.boot-*` paragraphs in `index.html`. 300 stays only for large headings, if it
   is used at all.
6. **Normal-case labels.** Drop the uppercase, letter-spaced style on timestamps and tag
   chips. It is in `NoteCard.tsx`, `TagBadge.tsx`, `FadedNoteCard.tsx`,
   `ConflictModal.tsx`, `KeyboardShortcutsModal.tsx` and `RoadmapPage.tsx`.
7. **Earthy tag dots.** New values in `TAG_COLORS` that do not read as traffic lights
   and stay visible on both pages. Keep the keys; see open question 8.
8. **Error colours.** Replace the stock values (`#DC2626`, `#FEE2E2`, `#EF4444`,
   `#4CAF50`) with colours from this palette. Light `error` as text must reach 4.5:1; it
   is 3.95:1 today.
9. **Saved and synced.** The accent is now green, so green alone cannot mean "saved".
   See open question 4.
10. **Leaf corner.** Keep `--radius-card` on note cards and the editor sheet. Give
    everything else a plain radius: modals, buttons, pills, tags, inputs, and the
    `.boot-cta` in `index.html`.

## The landing shell and boot script

`index.html` paints the first screen before the bundle arrives, and its copy and CSS
mirror `LandingPage.tsx`. Every colour, font, weight, radius and shadow change above
has to be made in both, in the same PR. `public/boot.js` picks the theme the same way
`useAppTheme` does. That logic does not change, so `boot.js` should need no edit;
confirm that `src/appGate.test.ts` still passes.

## Contrast checks

- Every text pair at 4.5:1 or better, on the page, on cards, and on every tinted
  surface: `bgSecondary`, `bgTertiary`, and anything filled with `accentGlow`.
- Borders of inputs and focus rings at 3:1 or better.
- Marigold is never text and never the only signal on the light page.
- Tag dots visible on both pages.
- Recompute the ratio comments in the theme files. The critique found one that was
  wrong (7.09 claimed, 5.26 measured).
- Run `e2e/accessibility.spec.ts`. It runs axe in both themes.

## Tests that should exist

Written first, per `CLAUDE.md`: the cases where a change should not fire.

- **Token contrast.** A unit test that computes the ratios from `src/themes/` for every
  required pair in both active themes and fails under 4.5:1. It also asserts marigold
  is not used as a text token in the light theme.
- **Generated CSS is current.** A check that the theme block in `src/index.css` equals
  the generator's output, so a theme file cannot drift from the CSS.
- **Shell mirror.** A test that reads `index.html` and checks its `--b-*` colours and
  font names against the active themes and `src/fonts.css`.
- **Fonts.** A test over `src/fonts.css`: Source Sans 3 covers 600 and has an italic
  face, Fraunces has roman and italic, every referenced file exists, every family has
  a licence file, and "Cormorant" appears nowhere in `src/`, `index.html` or
  `public/`.
- **First visit.** Update `e2e-sw/first-visit.spec.ts`, which asserts that Cormorant
  Garamond loads, and re-run the budget check.
- **Phone title.** A Playwright case at 390px wide: the editor title is larger than the
  body text. The other half: email, password and search inputs are still 16px or more.
- **Leaf corner.** Note cards and the editor sheet have it. A modal, a button, a pill
  and a tag do not.
- **Theme choice is unchanged.** A saved `light` or `dark` still wins, no saved value
  follows the device, and blocked storage still falls back as before. Stored values
  stay `light` and `dark` whatever the themes are renamed to.
- **Sync state without colour.** The editor's saved and synced states, and each state
  of `SyncIndicator` (pending, offline, blocked), can be told apart by text or icon
  alone. "Synced" still appears only after a server-confirmed content hash.
- **Existing tests.** `TagBadge.test.tsx` holds a hardcoded colour and will need the new
  value.

Run only the changed test files while working. Run `npm run check` once before pushing,
then the affected Playwright specs alone.

## Docs to update when it ships

- `DESIGN.md`: the Tokens, Themes, Button and accent taxonomy, Typography and Signature
  elements sections, and remove the "Tokens are mid-change" note.
- `src/data/changelog.ts`: one entry, newest first, in plain words for users.
- `docs/progress.md`: what shipped.
- `README.md` and `docs/roadmap.md` still use the old framing (one roadmap row cites
  "wabi-sabi philosophy").
- Code comments in `src/themes/` and `src/types.ts` that cite kintsugi or wabi-sabi, and
  the `kintsugi-glow` keyframes name.

## Suggested split

Three PRs, one lane each, in this order:

1. Fonts and the three type bugs.
2. Tokens, the shell mirror and the contrast tests.
3. The review fixes: outlines, glows, shadows, labels, tag dots, corners, sync state.

## Open questions

1. **Theme names.** "Kintsugi" and "Midnight" no longer fit. What are the two themes
   called, in the code and anywhere a user sees the name?
2. **Washi and Mori.** Delete the two unused themes, or keep them? The launch plan's
   after-launch list (item 109, reading settings) names both, so deleting them changes
   that item.
3. **Glow colour.** Green, marigold, or a neutral paper light? And how faint?
4. **Saved and synced.** How is it shown without relying on green: a word, a tick, a
   neutral colour, or a mix?
5. **Fraunces axes and weights.** The logo uses the SOFT axis. Shipping SOFT, WONK and
   the full optical-size range costs bytes on the first visit. Which axes ship, and
   what weight do titles use?
6. **Cyrillic titles.** Cormorant Garamond ships Cyrillic subsets. Fraunces appears to
   cover Latin and Vietnamese only; confirm. If so, Cyrillic titles fall back to
   Georgia. Is that acceptable?
7. **The plain radius.** What value do non-leaf elements get?
8. **Tag colour keys.** The keys are named `terracotta`, `gold` and so on. If tags store
   the key, renaming needs a data migration. Proposal: change the values and keep the
   keys.
