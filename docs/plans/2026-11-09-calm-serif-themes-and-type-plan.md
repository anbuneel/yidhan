Status: PROPOSAL
Last verified: 2026-11-09

# Themes and type: calm page, one serif
A plan to put the owner's later 2026-11-09 design choices into the app. It replaces `2026-11-09-themes-and-type-plan.md` (Bright Spring: cream page, Fraunces and Source Sans 3), which was written earlier the same day. Nothing here is implemented yet.

The owner reopened colour and type because the Bright Spring look still read as generated: a cream page, a soft serif for headings, one warm accent. The brief for this round: stay with "a calm space for your thoughts", no bold colour, no default-looking fonts, and a personality of its own.

Mock-ups (private to the owner):

- Screens in this direction: [https://claude.ai/artifact/YZTb5FufQDTY1yzrnFHGbP](https://claude.ai/artifact/YZTb5FufQDTY1yzrnFHGbP)
  
- Palette and typeface comparison: [https://claude.ai/artifact/GPywuYofPcCK7zyo43aCbM](https://claude.ai/artifact/GPywuYofPcCK7zyo43aCbM)
  
- Logo sketches: [https://claude.ai/artifact/6LWNF5mkPP5PBLC2LLzK8N](https://claude.ai/artifact/6LWNF5mkPP5PBLC2LLzK8N)
  

**This still lands after the logo-and-icons rollout**, for the reason the earlier plan gave: that work also edits `index.html`, `Logo.tsx` and the logo part of `DESIGN.md`. `Logo.tsx` on `main` still draws the enso mark (checked 2026-11-09). The logo itself is open again; see open question 1.
## What changed from the superseded plan
| Area | Superseded plan | This plan |
|---|---|---|
| Light page | Cream `#F2F0E6` | Near-white `#FAFAF6`, white sheets |
| Night page | `#0F1F18`, cards `#163026` | Softer `#151C18`, cards `#1B2620` |
| Titles | Fraunces | Newsreader |
| Body and UI | Source Sans 3 | Newsreader. No sans-serif anywhere |
| Monospace | JetBrains Mono, unchanged | Courier Prime, in three places only |
| Labels | Normal case | See open question 3 |
| Paper texture | Not addressed | Background only, untinted, never over text |
| Editor | Glow stays, fainter | A smooth sheet on the grained page; glow is open question 6 |

Everything else in the superseded plan carries over and is restated below, so this file stands alone.
## What is decided
The owner chose these on 2026-11-09:

- **Ethos first.** Calm, not bold. Green is the one working colour. Marigold `#F2A21B` appears only in the logo sun and the pin, and never carries text on the light page.
  
- **Newsreader for everything**: titles, note text, buttons, labels, forms. Hierarchy comes from size, weight and italic, not from a second typeface. This follows the owner's Inbax app, which uses no sans-serif.
  
- **Fraunces stays for the wordmark only.**
  
- **Courier Prime replaces JetBrains Mono.** It appears in inline code, code blocks and keys a person copies by hand. Toolbar labels, search text and search operators in help text are Newsreader.
  
- **A faint, untinted grain on the page background only.** Cards, the editor sheet, modals and inputs are smooth. The current full-screen overlay goes.
  
- **The leaf corner (**`2px 24px 4px 24px`**) stays** on note cards and the editor sheet only.
  
- **The theme keeps following the device setting.** `src/hooks/useAppTheme.ts` and `public/boot.js` logic does not change.
  
## Proposed tokens
**These values are a proposal.** The owner approved the look in the mock-up, not each hex value.

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
| --- | --- | --- |
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

- **Day accent fails as text on a tinted surface (4.39).** Text in green uses the link colour, never the button colour. The button colour is for fills and marks.
  
- **The hairline is far below 3:1.** It is fine for dividers and card outlines. Input borders and focus rings need their own token at 3:1 or better. Not proposed yet.
  
- Night keeps the flipped CTA from `DECISIONS.md` (2026-03-22): a light green fill with dark text.
  
- Card colours are solid. Today `cardBg` is a 92% and 88% alpha colour. If the alpha stays, measure contrast on the blended result.
  
- Not proposed yet, to be set in the implementing PR: `bgSecondary`, `bgTertiary`, `accentHover`, `accentGlow`, `accentMuted`, the destructive pair, `success`, `error`, `errorLight`, the status colours, the input border, and the shadows.
  
- Marigold replaces `--color-brand-gold` (`#D4AF37`) in `src/index.css`.
  
## Type scale
From the mock-up. Sizes are desktop; phone sizes are set in the implementing PR.

| Use | Style |
| --- | --- |
| Note title | 46px, weight 500, tight leading |
| Chapter name, empty-state heading | 25px italic, weight 400 |
| Card title | 20.5px, weight 500 |
| Note text | 19px, weight 400, line height 1.7 |
| Buttons | 15.5px, weight 600 |
| Status, dates, placeholders | 14.5px italic |
| Counts and card dates | See open question 3 |
| Code blocks, inline code, keys | Courier Prime |

Two rules that come from testing the font:

- **Newsreader has no small capitals and no old-style figures** in the Google Fonts build (tested 2026-11-09 with `font-synthesis: none`). Do not use `font-variant-caps`; the browser fakes it.
  
- **Night theme sets note text slightly heavier** (about 430, against 400 in day), because thin strokes fade on a dark page. This needs a weight token per theme. The font is variable, so no extra file.
  
## Font work
Fonts stay self-hosted. The invariant in `CLAUDE.md` does not change: files in `src/assets/fonts/`, declared in `src/fonts.css`, precached, no runtime font caching, licences in `public/licenses/fonts/`.

1. Add Newsreader, roman and italic, as subsetted variable woff2 files (weight and optical-size axes), one per unicode-range subset, in the same layout as the current faces. Upstream subsets are latin, latin-ext and vietnamese.
  
2. Add Courier Prime: regular, italic and bold. Upstream subsets are latin and latin-ext. It is a static font, not variable.
  
3. Remove Cormorant Garamond and Source Sans 3: their files, `@font-face` blocks and licence files. Remove JetBrains Mono the same way, unless open question 2 keeps its Cyrillic and Greek files as a fallback.
  
4. Add `newsreader-OFL.txt` and `courier-prime-OFL.txt` to `public/licenses/fonts/` with the upstream copyright notices. Confirm both licences upstream before shipping; both are listed as SIL OFL.
  
5. Point `--font-display` and `--font-body` at Newsreader, and the mono token at Courier Prime. Consider one `--font-serif` token and keep the two old names as aliases, so components need no rename.
  
6. **The wordmark.** `Logo.tsx` sets the wordmark in `var(--font-display)`. With the display font now Newsreader, the wordmark would change face. Draw the wordmark as an SVG path (`images/brand/wordmark.svg` exists) so Fraunces never ships as a font file. The logo rollout may already do this.
  
7. Update the landing shell in `index.html`: the font preloads, the inline `@font-face` rules, and every `.boot-*` rule that names Cormorant Garamond or Source Sans 3.
  
8. Update `src/pages/PlaygroundPage.tsx`, which names Cormorant Garamond.
  
9. Check the first-visit budget. `scripts/bundle-budget.json` counts fonts as stored. Today the first screen loads two families. This plan loads one, but the mock-up's headline uses the italic, which is a second file. Measure the Newsreader latin roman and italic files. If they exceed the budget, either drop the italic from the first screen, trim the optical-size axis, or raise the budget with a `DECISIONS.md` entry. Do not raise it quietly.
  
## Script coverage gap
**This is the main cost of the choice.** The app ships Cyrillic and Greek today for body text and monospace (`src/assets/fonts/`). Newsreader and Courier Prime have neither (checked against the Google Fonts subsets, 2026-11-09). A note written in Russian, Ukrainian or Greek would fall back to a system serif.

Proposed fix, not yet tested: add a second serif that covers those scripts as a unicode-range fallback, so it loads only when a note needs it and costs nothing on the first visit. Literata covers Cyrillic and Greek and has a true italic. Keep the JetBrains Mono Cyrillic and Greek files as the monospace fallback, or accept a system monospace there. See open question 2.
## Texture
1. Remove the full-screen noise overlay near `src/index.css:404` and the `--noise-filter` sepia and grayscale tints.
  
2. Put the grain on the page background instead, under all content. No tint. The mock-up used about 7% in day and 5% in night of a fine black or white grain; tune on real screens.
  
3. Every surface that holds running text is opaque and smooth: note cards, the editor sheet, modals, menus, inputs.
  
4. Text that sits directly on the page (header, chapter names, the landing headline) has grain behind it. Check it stays crisp at the smallest size used there.
  
5. The landing shell in `index.html` needs the same background, or the page will change texture when React mounts.
  
6. Keep `noiseOpacity` in the theme type if it still drives the strength; drop `noiseFilter` if nothing uses it.
  
## Type bugs to fix
Carried over; all three were verified on `main` on 2026-11-09 for the superseded plan.

1. **Faux bold.** The Source Sans 3 `@font-face` covers 300 to 500, but `strong` and several rules use 600. Fixed by the font swap: declare Newsreader's full weight range.
  
2. **Faux italic.** No italic face exists today. Fixed by font step 1. This plan leans on the italic far more than the old one, so the italic file is required, not optional.
  
3. **Phone title smaller than body text.** The "Prevent iOS zoom" rule near `src/index.css:1702` sets `font-size: 16px !important` on every `textarea` under 640px. The title is a textarea. Fix: leave the title out of the rule, or use `max(16px, 1em)`. Inputs must still be at least 16px so iOS does not zoom.
  
## Fixes the three reviews agreed on
Carried over from the superseded plan. Items marked _changed_ differ here.

1. **Card outlines.** A faint neutral hairline, not gold.
  
2. **No glow under buttons.** Remove the coloured shadow under CTAs, including `.boot-cta`. Remove the tinted band behind Pinned.
  
3. **Editor glow.** _Changed._ The editor is now a smooth sheet on the grained page. Whether the glow stays is open question 6. If it stays, keep the ref-based scroll handler exactly as it is; only the gradient changes.
  
4. **Lighter shadows.** About half the current opacity. None in the night theme.
  
5. **Body weight 400, not 300.** `body`, `.note-card-preview`, and the `.boot-*` paragraphs.
  
6. **Labels.** _Changed._ The reviews agreed to drop uppercase, letter-spaced labels. The mock-up uses them for counts and card dates. See open question 3. The files are `NoteCard.tsx`, `TagBadge.tsx`, `FadedNoteCard.tsx`, `ConflictModal.tsx`, `KeyboardShortcutsModal.tsx` and `RoadmapPage.tsx`.
  
7. **Earthy tag dots.** New values in `TAG_COLORS` that stay visible on both pages. Keep the keys.
  
8. **Error colours.** Replace the stock values (`#DC2626`, `#FEE2E2`, `#EF4444`, `#4CAF50`) with colours from this palette. Light `error` as text must reach 4.5:1.
  
9. **Saved and synced.** The accent is green, so green alone cannot mean "saved". The mock-up shows the word in italic with a small dot. See open question 5.
  
10. **Leaf corner.** Keep `--radius-card` on note cards and the editor sheet. Everything else gets a plain radius.
  
## Where the values go
Carried over; re-check against what the logo rollout changed.

1. `src/themes/`: the active light and dark theme files, and `types.ts` for new tokens (note text, link, tinted surface, body weight, input border).
  
2. `npm run theme:generate` writes them into `src/index.css`. Do not hand-edit the generated block.
  
3. Places that copy colours by hand:
  
  - `index.html`: the `--b-*` variables (three blocks) and `meta name="theme-color"`.
    
  - `vite.config.ts` and `capacitor.config.ts`.
    
  - `src/components/ErrorBoundary.tsx` fallback colours.
    
  - `src/types.ts` `TAG_COLORS`.
    
  - `scripts/generate-splash-screens.ts` and `scripts/generate-og-image.ts`, then regenerate their output.
    
  - `e2e/accessibility.spec.ts` and `README.md` name the themes and fonts.
    
## The landing shell and boot script
`index.html` paints the first screen before the bundle arrives and mirrors `LandingPage.tsx`. Every colour, font, weight, radius, shadow and texture change has to be made in both, in the same PR. `public/boot.js` should need no edit; confirm `src/appGate.test.ts` still passes.
## Tests that should exist
Written first, per `CLAUDE.md`: the cases where a change should not fire.

- **Token contrast.** A unit test that computes the ratios from `src/themes/` for every required pair in both themes and fails under 4.5:1. It asserts marigold is not a text token in the light theme, and that accent-as-text uses the link token.
  
- **Generated CSS is current.** The theme block in `src/index.css` equals the generator's output.
  
- **Shell mirror.** `index.html` `--b-*` colours and font names match the active themes and `src/fonts.css`.
  
- **Fonts.** Over `src/fonts.css`: Newsreader has roman and italic and covers 400 to 700; Courier Prime has regular, italic and bold; every referenced file exists; every family has a licence file; "Cormorant" and "Source Sans" appear nowhere in `src/`, `index.html` or `public/`.
  
- **No faked small caps.** `font-variant-caps` and `font-variant: small-caps` appear nowhere in `src/`.
  
- **Monospace stays in its lane.** The mono token is used by code, code blocks and the recovery key. Not by the toolbar, the search box or status text.
  
- **Texture is behind, not over.** No fixed overlay sits above content. A note card, the editor sheet and a modal have an opaque background.
  
- **First visit.** Update `e2e-sw/first-visit.spec.ts`, which asserts that Cormorant Garamond loads, and re-run the budget check.
  
- **Phone title.** At 390px wide the editor title is larger than the body text. The other half: email, password and search inputs are still 16px or more.
  
- **Leaf corner.** Note cards and the editor sheet have it. A modal, a button, a pill and a tag do not.
  
- **Theme choice is unchanged.** A saved `light` or `dark` still wins, no saved value follows the device, and blocked storage still falls back as before.
  
- **Sync state without colour.** Saved, synced, pending, offline and blocked can be told apart by text or icon alone. "Synced" still appears only after a server-confirmed content hash.
  
- **Recovery key legibility.** The key is RFC 4648 base32 (`src/lib/recoveryKey.ts`): A to Z and 2 to 7. Courier Prime's zero and O look alike, which does not matter for the key. Check nothing else that can hold 0, O, 1 or l is shown in the mono face for copying by hand.
  
- **Existing tests.** `TagBadge.test.tsx` holds a hardcoded colour.
  

Run only the changed test files while working. Run `npm run check` once before pushing, then the affected Playwright specs alone.
## Docs to update
When the owner approves this plan:

- `DECISIONS.md`: a new entry for this direction, with what was rejected (the cream page, Fraunces and Source Sans 3 for text, bold palettes drawn from Tamil sources, Tamil-script typefaces, Literata and Vollkorn, Geist Serif, JetBrains Mono, the full-screen texture). Flip the Bright Spring entry's `Status` to `Superseded`.
  

When it ships:

- `DESIGN.md`: Tokens, Themes, Typography and Signature elements.
  
- `src/data/changelog.ts`: one entry, newest first, in plain words for users.
  
- `docs/progress.md`: what shipped.
  
- `README.md` and `docs/roadmap.md` still use the old framing.
  
- Code comments in `src/themes/` and `src/types.ts` that cite kintsugi or wabi-sabi, and the `kintsugi-glow` keyframes name.
  
## Suggested split
Three PRs, one lane each, in this order:

1. Fonts, the script fallback and the three type bugs.
  
2. Tokens, texture, the shell mirror and the contrast tests.
  
3. The review fixes: outlines, shadows, labels, tag dots, corners, sync state.
  
## Open questions
1. **The logo.** The owner prefers a leaf-as-page mark with a small sun behind it and the Tamil letter இ inside the sun. It is a sketch, not final artwork, and the colour of the letter is not chosen. The superseded plan fixed five colours because the shipped logo uses them (`#163026`, `#F2F0E6`, `#F2A21B`, `#13261D`, `#F8F7F1`). Does the logo get its own plan first, and do app icons keep the cream and evergreen?
  
2. **Cyrillic and Greek.** Accept a system fallback, or ship a fallback serif such as Literata by unicode-range? And for monospace: keep JetBrains Mono's Cyrillic and Greek files, or use a system monospace?
  
3. **Counts and card dates.** Small spaced capitals, as in the mock-up, or italic like the other status text? Three reviews asked to drop capitals. Italic everywhere is simpler and agrees with them. Capitals give one more level of hierarchy.
  
4. **Theme names.** "Kintsugi" and "Midnight" no longer fit. What are the two themes called, in the code and anywhere a user sees the name? Stored values stay `light` and `dark`.
  
5. **Saved and synced.** A word in italic with a dot, a tick, or a mix?
  
6. **Editor glow.** Keep it, fainter and neutral, or drop it now that the sheet and the grain carry the paper idea?
  
7. **Washi and Mori.** Delete the two unused themes, or keep them? The launch plan's item 109 names both. The night palette here is drawn from Mori.
  
8. **The plain radius.** What value do non-leaf elements get? The mock-up uses full pills for buttons and chips, and 8px for inputs.
  
9. **Grain strength.** The mock-up values are a first guess. Who signs off on a phone and on a low-density monitor?
  
10. **Tag colour keys.** Change the values and keep the keys, as before.
