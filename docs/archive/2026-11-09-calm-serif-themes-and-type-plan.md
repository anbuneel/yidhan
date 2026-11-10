Status: COMPLETE
Last verified: 2026-11-10

Shipped: to `main` on 2026-11-10, in the redesign release PR. Built on `redesign` in PRs 266 (fonts), 268 (tokens and texture) and 269 (review fixes), beside the logo plan's PRs 265 and 267.

# Themes and type: calm page, one serif

A plan to put the owner's 2026-11-09 design choices into the app. The decision is in
`DECISIONS.md` (2026-11-09, "The design direction is a calm page and one serif"). It
replaces `2026-11-09-themes-and-type-plan.md` (Bright Spring: cream page, Fraunces and
Source Sans 3), written earlier the same day. Nothing here is implemented yet.

The owner reopened colour and type because the Bright Spring look still read as
generated: a cream page, a soft serif for headings, one warm accent. The brief for this
round: stay with "a calm space for your thoughts", no bold colour, no default-looking
fonts, and a personality of its own.

This plan runs beside `2026-11-09-logo-and-icons-plan.md`. The order of work across
both is in "Order of work" below, and is the same in both files.

Mock-ups (private to the owner):

- Screens in this direction: https://claude.ai/artifact/YZTb5FufQDTY1yzrnFHGbP
- Palette and typeface comparison: https://claude.ai/artifact/GPywuYofPcCK7zyo43aCbM

## What changed from the superseded plan

| Area | Superseded plan | This plan |
|---|---|---|
| Light page | Cream `#F2F0E6` | Near-white `#FAFAF6`, white sheets |
| Night page | `#0F1F18`, cards `#163026` | Softer `#151C18`, cards `#1B2620` |
| Titles | Fraunces | Newsreader |
| Body and UI | Source Sans 3 | Newsreader. No sans-serif anywhere |
| Monospace | JetBrains Mono, unchanged | Courier Prime, in three places only |
| Cyrillic and Greek | Source Sans 3 and JetBrains Mono | Literata as a fallback serif |
| Labels | Normal case | Italic. No capital-letter labels |
| Paper texture | Not addressed | Background only, untinted, never over text |
| Editor | Glow stays, fainter | A smooth sheet on the grained page; glow is open question 3 |
| Logo colours | Five fixed by the "yi" logo | Set by the logo plan |

Everything else in the superseded plan carries over and is restated below, so this file
stands alone.

## What is decided

The owner chose these on 2026-11-09:

- **Ethos first.** Calm, not bold. Green is the one working colour. Marigold `#F2A21B`
  appears only in the logo sun and the pin, and never carries text on the light page.
- **Newsreader for everything**: titles, note text, buttons, labels, forms. Hierarchy
  comes from size, weight and italic, not from a second typeface. This follows the
  owner's Inbax app, which uses no sans-serif.
- **Fraunces stays for the wordmark only**, as an SVG path. The logo plan owns it.
- **Courier Prime replaces JetBrains Mono.** It appears in inline code, code blocks and
  keys a person copies by hand. Toolbar labels, search text and search operators in
  help text are Newsreader.
- **Literata covers Cyrillic and Greek.** Newsreader and Courier Prime have neither.
  Literata loads only when a note needs those scripts. Monospace in those scripts uses
  the system font.
- **Counts and dates are italic**, like "Synced" and "Just now". No capital-letter
  labels anywhere. This agrees with the three reviews.
- **A faint, untinted grain on the page background only.** Cards, the editor sheet,
  modals and inputs are smooth. The current full-screen overlay goes.
- **The leaf corner (`2px 24px 4px 24px`) stays** on note cards and the editor sheet
  only.
- **The theme keeps following the device setting.** `src/hooks/useAppTheme.ts` and
  `public/boot.js` logic does not change.

## Proposed tokens

**These values are a proposal.** The owner approved the look in the mock-up, not each
hex value.

| Token | Day | Night |
|---|---|---|
| Page (`bgPrimary`) | `#FAFAF6` | `#151C18` |
| Card and sheet (`cardBg`) | `#FFFFFF` | `#1B2620` |
| Selected or tinted surface | `#EDF1EA` | `#1F2C25` |
| Text (titles, UI) | `#14241C` | `#E6E3DC` |
| Note text | `#22332A` | `#D3D2CA` |
| Muted text | `#5A665F` | `#9AA69F` |
| Accent (buttons, marks) | `#2E7D55` | `#86C5A0` |
| On-accent | `#FFFFFF` | `#13201A` |
| Link and accent-as-text | `#1F6A49` | `#9AD0B0` |
| Tag chip fill / text | `#E8EFE6` / `#1F583E` | `#22332A` / `#A9D6BB` |
| Hairline | `#E1E4DC` | `#2A362F` |
| Marigold | `#F2A21B` | `#F2A21B` |

Contrast, measured on 2026-11-09 with the WCAG formula:

| Pair | Day: page / card / tinted | Night: page / card / tinted |
|---|---|---|
| Text | 15.45 / 16.17 / 14.14 | 13.53 / 12.19 / 11.34 |
| Note text | 12.74 / 13.33 / 11.66 | 11.43 / 10.29 / 9.58 |
| Muted text | 5.73 / 6.00 / 5.25 | 6.88 / 6.19 / 5.76 |
| Link | 6.24 / 6.53 / 5.71 | 9.93 / 8.94 / 8.32 |
| Accent as text | 4.80 / 5.02 / **4.39** | 8.68 / 7.81 / 7.27 |
| On-accent on accent | 5.02 | 8.41 |
| Chip text on chip | 7.10 | 8.27 |
| Marigold | 2.02 / 2.11 / 1.84, never text | 8.22 / 7.41 / 6.89 |
| Hairline | 1.23 / 1.29 / 1.12 | 1.38 / 1.24 / 1.15 |

What the numbers mean:

- **Day accent fails as text on a tinted surface (4.39).** Text in green uses the link
  colour, never the button colour. The button colour is for fills and marks.
- **The hairline is far below 3:1.** It is fine for dividers and card outlines. Input
  borders and focus rings need their own token at 3:1 or better. Not proposed yet.
- Night keeps the flipped CTA from `DECISIONS.md` (2026-03-22): a light green fill with
  dark text.
- Card colours are solid. Today `cardBg` is a 92% and 88% alpha colour. If the alpha
  stays, measure contrast on the blended result.
- Not proposed yet, to be set in the implementing PR: `bgSecondary`, `bgTertiary`,
  `accentHover`, `accentGlow`, `accentMuted`, the destructive pair, `success`, `error`,
  `errorLight`, the status colours, the input border, and the shadows.
- Marigold replaces `--color-brand-gold` (`#D4AF37`) in `src/index.css`.
- The logo's greens should be these tokens. If the logo plan picks different greens,
  change them here too, so the mark and the buttons match.

## Type scale

From the mock-up. Sizes are desktop; phone sizes are set in the implementing PR.

| Use | Style |
|---|---|
| Note title | 46px, weight 500, tight leading |
| Chapter name, empty-state heading | 25px italic, weight 400 |
| Card title | 20.5px, weight 500 |
| Note text | 19px, weight 400, line height 1.7 |
| Buttons | 15.5px, weight 600 |
| Status, dates, counts, placeholders | 14.5px italic |
| Code blocks, inline code, keys | Courier Prime |

Two rules that come from testing the font:

- **Newsreader has no small capitals and no old-style figures** in the Google Fonts
  build (tested 2026-11-09 with `font-synthesis: none`). Do not use
  `font-variant-caps`; the browser fakes it.
- **Night theme sets note text slightly heavier** (about 430, against 400 in day),
  because thin strokes fade on a dark page. This needs a weight token per theme. The
  font is variable, so no extra file.

The mock-up still shows capital-letter labels for counts and card dates. The owner
chose italic after seeing it. Follow this table, not the mock-up, on that point.

## Font work

Fonts stay self-hosted. The invariant in `CLAUDE.md` does not change: files in
`src/assets/fonts/`, declared in `src/fonts.css`, precached, no runtime font caching,
licences in `public/licenses/fonts/`.

1. Add Newsreader, roman and italic, as subsetted variable woff2 files (weight and
   optical-size axes), one per unicode-range subset, in the same layout as the current
   faces. Upstream subsets are latin, latin-ext and vietnamese.
2. Add Courier Prime: regular, italic and bold. Upstream subsets are latin and
   latin-ext. It is a static font, not variable.
3. Add Literata, roman and italic, for the Cyrillic and Greek subsets only. Declare it
   under its own family name with those unicode-ranges, and put it after Newsreader in
   the serif stack. The browser then fetches it only when a page holds those letters.
   Confirm upstream that Literata covers cyrillic, cyrillic-ext, greek and greek-ext.
4. Remove Cormorant Garamond, Source Sans 3 and JetBrains Mono: their files,
   `@font-face` blocks and licence files.
5. Add `newsreader-OFL.txt`, `courier-prime-OFL.txt` and `literata-OFL.txt` to
   `public/licenses/fonts/` with the upstream copyright notices. Confirm each licence
   upstream before shipping; all three are listed as SIL OFL.
6. Point `--font-display` and `--font-body` at the serif stack, and the mono token at
   Courier Prime. Consider one `--font-serif` token and keep the two old names as
   aliases, so components need no rename.
7. **The wordmark.** `Logo.tsx` sets the wordmark in `var(--font-display)`. Once that
   is Newsreader, the wordmark changes face until the logo rollout replaces it with an
   SVG path. That is acceptable on the `redesign` branch. It must not reach `main` in
   that state.
8. Update the landing shell in `index.html`: the font preloads, the inline `@font-face`
   rules, and every `.boot-*` rule that names Cormorant Garamond or Source Sans 3.
9. Update `src/pages/PlaygroundPage.tsx`, which names Cormorant Garamond.
10. Check the first-visit budget. `scripts/bundle-budget.json` counts fonts as stored.
    Today the first screen loads two families. This plan loads one, but the mock-up's
    headline uses the italic, which is a second file. Measure the Newsreader latin
    roman and italic files. If they exceed the budget, either drop the italic from the
    first screen, trim the optical-size axis, or raise the budget with a `DECISIONS.md`
    entry. Do not raise it quietly. Literata must not load on the first visit.

## Texture

1. Remove the full-screen noise overlay near `src/index.css:404` and the
   `--noise-filter` sepia and grayscale tints.
2. Put the grain on the page background instead, under all content. No tint. The
   mock-up used about 7% in day and 5% in night of a fine black or white grain; tune on
   real screens.
3. Every surface that holds running text is opaque and smooth: note cards, the editor
   sheet, modals, menus, inputs.
4. Text that sits directly on the page (header, chapter names, the landing headline)
   has grain behind it. Check it stays crisp at the smallest size used there.
5. The landing shell in `index.html` needs the same background, or the page will change
   texture when React mounts.
6. Keep `noiseOpacity` in the theme type if it still drives the strength; drop
   `noiseFilter` if nothing uses it.

## Type bugs to fix

Carried over; all three were verified on `main` on 2026-11-09 for the superseded plan.

1. **Faux bold.** The Source Sans 3 `@font-face` covers 300 to 500, but `strong` and
   several rules use 600. Fixed by the font swap: declare Newsreader's full weight
   range.
2. **Faux italic.** No italic face exists today. Fixed by font step 1. This plan leans
   on the italic far more than the old one, so the italic file is required, not
   optional.
3. **Phone title smaller than body text.** The "Prevent iOS zoom" rule near
   `src/index.css:1702` sets `font-size: 16px !important` on every `textarea` under
   640px. The title is a textarea. Fix: leave the title out of the rule, or use
   `max(16px, 1em)`. Inputs must still be at least 16px so iOS does not zoom.

## Fixes the three reviews agreed on

Carried over from the superseded plan. Items marked *changed* differ here.

1. **Card outlines.** A faint neutral hairline, not gold.
2. **No glow under buttons.** Remove the coloured shadow under CTAs, including
   `.boot-cta`. Remove the tinted band behind Pinned.
3. **Editor glow.** *Changed.* The editor is now a smooth sheet on the grained page.
   Whether the glow stays is open question 3. If it stays, keep the ref-based scroll
   handler exactly as it is; only the gradient changes.
4. **Lighter shadows.** About half the current opacity. None in the night theme.
5. **Body weight 400, not 300.** `body`, `.note-card-preview`, and the `.boot-*`
   paragraphs.
6. **Normal-case labels.** Drop the uppercase, letter-spaced style on timestamps, counts
   and tag chips. Timestamps and counts become italic. It is in `NoteCard.tsx`,
   `TagBadge.tsx`, `FadedNoteCard.tsx`, `ConflictModal.tsx`,
   `KeyboardShortcutsModal.tsx` and `RoadmapPage.tsx`.
7. **Earthy tag dots.** New values in `TAG_COLORS` that stay visible on both pages. Keep
   the keys; if tags store the key, renaming would need a data migration.
8. **Error colours.** Replace the stock values (`#DC2626`, `#FEE2E2`, `#EF4444`,
   `#4CAF50`) with colours from this palette. Light `error` as text must reach 4.5:1.
9. **Saved and synced.** The accent is green, so green alone cannot mean "saved". The
   mock-up shows the word in italic with a small dot. See open question 2.
10. **Leaf corner.** Keep `--radius-card` on note cards and the editor sheet. Everything
    else gets a plain radius.

## Where the values go

Carried over; re-check against what the logo rollout changed.

1. `src/themes/`: the active light and dark theme files, and `types.ts` for new tokens
   (note text, link, tinted surface, body weight, input border).
2. `npm run theme:generate` writes them into `src/index.css`. Do not hand-edit the
   generated block.
3. Places that copy colours by hand:
   - `index.html`: the `--b-*` variables (three blocks) and `meta name="theme-color"`.
   - `vite.config.ts` and `capacitor.config.ts`.
   - `src/components/ErrorBoundary.tsx` fallback colours.
   - `src/types.ts` `TAG_COLORS`.
   - `scripts/generate-splash-screens.ts` and `scripts/generate-og-image.ts`, then
     regenerate their output.
   - `e2e/accessibility.spec.ts` and `README.md` name the themes and fonts.

## The landing shell and boot script

`index.html` paints the first screen before the bundle arrives and mirrors
`LandingPage.tsx`. Every colour, font, weight, radius, shadow and texture change has to
be made in both, in the same PR. `public/boot.js` should need no edit; confirm
`src/appGate.test.ts` still passes.

## Tests that should exist

Written first, per `CLAUDE.md`: the cases where a change should not fire.

- **Token contrast.** A unit test that computes the ratios from `src/themes/` for every
  required pair in both themes and fails under 4.5:1. It asserts marigold is not a text
  token in the light theme, and that accent-as-text uses the link token.
- **Generated CSS is current.** The theme block in `src/index.css` equals the
  generator's output.
- **Shell mirror.** `index.html` `--b-*` colours and font names match the active themes
  and `src/fonts.css`.
- **Fonts.** Over `src/fonts.css`: Newsreader has roman and italic and covers 400 to
  700; Courier Prime has regular, italic and bold; Literata is declared only for
  Cyrillic and Greek ranges; every referenced file exists; every family has a licence
  file; "Cormorant", "Source Sans" and "JetBrains" appear nowhere in `src/`,
  `index.html` or `public/`.
- **The fallback loads only when needed.** A Latin-only note fetches no Literata file. A
  note with a Cyrillic word does, and renders in Literata, not a system font.
- **No faked small caps.** `font-variant-caps` and `font-variant: small-caps` appear
  nowhere in `src/`.
- **Monospace stays in its lane.** The mono token is used by code, code blocks and the
  recovery key. Not by the toolbar, the search box or status text.
- **Texture is behind, not over.** No fixed overlay sits above content. A note card, the
  editor sheet and a modal have an opaque background.
- **First visit.** Update `e2e-sw/first-visit.spec.ts`, which asserts that Cormorant
  Garamond loads, and re-run the budget check.
- **Phone title.** At 390px wide the editor title is larger than the body text. The
  other half: email, password and search inputs are still 16px or more.
- **Leaf corner.** Note cards and the editor sheet have it. A modal, a button, a pill
  and a tag do not.
- **Theme choice is unchanged.** A saved `light` or `dark` still wins, no saved value
  follows the device, and blocked storage still falls back as before.
- **Sync state without colour.** Saved, synced, pending, offline and blocked can be told
  apart by text or icon alone. "Synced" still appears only after a server-confirmed
  content hash.
- **Recovery key legibility.** The key is RFC 4648 base32 (`src/lib/recoveryKey.ts`):
  A to Z and 2 to 7. Courier Prime's zero and O look alike, which does not matter for
  the key. Check nothing else that can hold 0, O, 1 or l is shown in the mono face for
  copying by hand.
- **Existing tests.** `TagBadge.test.tsx` holds a hardcoded colour.

Run only the changed test files while working. Run `npm run check` once before pushing,
then the affected Playwright specs alone.

## Docs to update when it ships

- `DESIGN.md`: Tokens, Themes, Typography and Signature elements.
- `src/data/changelog.ts`: one entry, newest first, in plain words for users.
- `docs/progress.md`: what shipped.
- `README.md` and `docs/roadmap.md` still use the old framing.
- Code comments in `src/themes/` and `src/types.ts` that cite kintsugi or wabi-sabi, and
  the `kintsugi-glow` keyframes name.

## Order of work

`main` deploys to production. Merging these one by one would put a half-finished
redesign in front of users: new fonts on old colours, or a new logo on the old page.

So every PR below targets a `redesign` branch (owner's decision, 2026-11-09). One final
PR takes `redesign` to `main`. Rebase `redesign` on `main` after each launch-plan
merge, because both touch `index.html`.

| Step | Plan | Work | Needs |
|---|---|---|---|
| 1 | Logo | Part 1: final artwork and review board | Nothing. Runs beside step 2 |
| 2 | Themes | PR 1: fonts, script fallback, type bugs | Nothing |
| 3 | Logo | Part 2: rollout | Step 1 approved; step 2 merged |
| 4 | Themes | PR 2: tokens, texture, shell mirror | Step 3 merged |
| 5 | Themes | PR 3: review fixes | Step 4 merged |
| 6 | Both | `redesign` to `main`, docs, changelog | All of the above; the full e2e suite |

One lane per session: each step is its own session.

Progress:

- Step 1 is merged into `redesign` (PR 265).
- Step 2 is merged into `redesign` (PR 266, 2026-11-09). The text files pin
  Newsreader's optical size at 18, weights 400 to 700. The owner chose a display cut
  for big titles: one static file, optical size 72, weight 500, latin roman, family
  `Newsreader Display`, token `--font-title`. It sets the note title and the landing
  headline. The landing and precache budgets rose for it (`DECISIONS.md`, 2026-11-09).
  Both have about 1 KB of headroom left.
- Left from step 2 for later steps: the sample note title in the landing preview still
  uses the text cut; `scripts/generate-og-image.ts` still names Source Sans 3; the
  mono-lane test does not cover the search box or status text.

- Step 3 is merged into `redesign` (PR 267).
- Step 4 is merged into `redesign` (PR 268, 2026-11-09). The themes are `light.ts` and
  `dark.ts`; Washi and Mori are gone. The owner approved the grain at 7% in light and
  5% in dark from screenshots. The landing JS is at exactly 90 of 90 KB.

Settled by the owner on 2026-11-09, before step 4:

- Open question 1: the themes are named "Light" and "Dark" (`light`, `dark`).
- Open question 4: Washi and Mori are deleted.
- Open question 6: the owner approves the grain strength from screenshots.

Settled by the owner on 2026-11-10, before step 5:

- Open question 2: "Saved" and "Synced" are the word in italic with a small tick.
- Open question 3: the editor glow stays, fainter and neutral.
- Open question 5: full pills for buttons and chips, 8px for inputs, as in the mock-up.
- On a phone the editor sheet stays edge to edge.

## Open questions

1. **Theme names.** "Kintsugi" and "Midnight" no longer fit. What are the two themes
   called, in the code and anywhere a user sees the name? Stored values stay `light`
   and `dark`. Needed for step 4.
2. **Saved and synced.** A word in italic with a dot, a tick, or a mix? Needed for
   step 5.
3. **Editor glow.** Keep it, fainter and neutral, or drop it now that the sheet and the
   grain carry the paper idea? Needed for step 5.
4. **Washi and Mori.** Delete the two unused themes, or keep them? The launch plan's
   item 109 names both. The night palette here is drawn from Mori. Needed for step 4.
5. **The plain radius.** What value do non-leaf elements get? The mock-up uses full
   pills for buttons and chips, and 8px for inputs. Needed for step 5.
6. **Grain strength.** The mock-up values are a first guess. Who signs off on a phone
   and on a low-density monitor? Needed for step 4.
