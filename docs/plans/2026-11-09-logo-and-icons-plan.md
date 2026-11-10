Status: ACTIVE
Last verified: 2026-11-09

# Logo and icons: the leaf that is a page

A plan to draw the final logo and put it into the app. The decision is in
`DECISIONS.md` (2026-11-09, "The logo is a leaf that is a page"). It replaces the
Fraunces wordmark with the "yi" monogram icon, decided earlier the same day. The owner
found that one too plain to be a logo.

This plan runs beside `2026-11-09-calm-serif-themes-and-type-plan.md`. The order of
work across both is in "Order of work" below, and is the same in both files.

Sketches (private to the owner): https://claude.ai/artifact/6LWNF5mkPP5PBLC2LLzK8N.
The chosen sketch is number 40 in round five.

## What is decided

- **The mark.** A green leaf that is also a page: the app's leaf corner shape (small
  radius top-left and bottom-right, large radius top-right and bottom-left), with three
  text lines cut out of it, the last one short.
- **The sun.** A small marigold `#F2A21B` circle behind the leaf's top-left corner. A
  gap in the page colour separates the two.
- **The letter.** The Tamil letter இ sits inside the sun in dark green. Both children's
  names begin with it. It is meant to be found, not announced.
- **The wordmark.** Lowercase "yidhan" in Fraunces. The y is green and the rest is ink.
  The name is the y of Ishya joined to the "idhan" of Idhanth.
- **Same letter as Inbax.** The sketches reuse the இ outline from the owner's Inbax
  app, which was outlined from Noto Serif Tamil (SIL OFL).

## What the sketch does not settle

The sketch was drawn on a 120-unit grid for a web page. It is not final artwork.

1. **When the letter shows.** In the sketch the letter is about 7px tall in a 64px
   icon, and reads only from about 128px. Proposal: the letter appears at 128px and
   above (splash, About, the large app icon, the OG image). Below that the sun is
   plain. Set the exact size once the final drawing exists.
2. **The letter needs redrawing.** The Inbax outline is a text face. At icon sizes its
   thin strokes fill in. Draw a heavier cut for this use, and check it against a Tamil
   reader for correctness.
3. **The icon tile.** A favicon needs a tile, because a bare mark disappears on some tab
   bars (see the superseded logo decision). Draw both: a near-white tile with the green
   leaf, and a dark green tile with the light green leaf. Pick on the review board.
4. **The wordmark's i.** The shipped drawing puts a sun on the i. With the mark beside
   it there would be two suns. Proposal: a plain i in the lockup, and no sun on the i
   anywhere.
5. **Small sizes.** At 16px the three lines and the gap will not survive. Draw a
   separate 16 to 48px version: probably the leaf, the sun, and one or no lines.
6. **One colour.** A single-colour version for places that cannot take two.

## Work

### Part 1: final artwork (no app code)

1. Draw the mark as clean SVG in `images/brand/source/`: the full mark, the small-size
   version, the icon tile in both candidate colours, the wordmark with a green y, and
   the horizontal lockup.
2. Redraw the letter (item 2 above) and set the size rule (item 1).
3. Build a review board in `images/brand/review/` showing every size from 16px to
   1024px on light and dark backgrounds, in a browser tab, on an Android home screen
   mask, and beside other writing apps' icons.
4. Check the stores for marks that look alike: a page or note icon with a sun or dot.
   This is not a trademark clearance, and the plan does not claim one.
5. The owner approves the board. Nothing in Part 2 starts before that.

### Part 2: rollout (one PR)

1. Export the icon set to `images/brand/export/` and wherever the app serves icons
   from: favicons 16 to 48, 192 and 512, maskable 512, the Apple touch icon, the
   Android foreground.
2. `src/components/Logo.tsx`: replace the enso mark and the text wordmark with the new
   mark and an SVG wordmark. The wordmark is a path, so Fraunces never ships as a font
   file.
3. `index.html`: the icon links, the landing shell's logo, and `theme-color` if the
   tile colour changes it.
4. `vite.config.ts` (manifest icons and colours) and `capacitor.config.ts`.
5. `scripts/generate-splash-screens.ts` and `scripts/generate-og-image.ts`, then
   regenerate their output.
6. Remove what the enso needed: the watercolour mask script
   (`scripts/generate-logo-masks.ts`), its output, and the CSS that uses the masks.
   Find every use with `rg` before deleting.
7. Empty states. The mock-ups use the mark above "Your notes await". Decide per screen.
8. Find every other place the old mark or the "yi" monogram appears: `rg -i "enso"`,
   and the icon file names.

## Tests that should exist

Written first, per `CLAUDE.md`: the cases where a change should not fire.

- **Logo component.** It renders the mark and the wordmark as SVG, with an accessible
  name of "Yidhan". The mark alone is decorative when the wordmark is beside it.
- **The letter is not in small renders.** Below the size rule, the rendered SVG holds no
  letter path.
- **Colours come from tokens.** The leaf and the page-colour gap follow the theme, so
  the mark works on both pages. Marigold is the one fixed colour.
- **No leftovers.** "enso" appears nowhere in `src/`, `index.html` or `public/`, and no
  file references a deleted mask.
- **Manifest.** Every icon the manifest and `index.html` name exists at the stated
  size. The maskable icon keeps the mark inside the safe zone.
- **Shell mirror.** The logo in the `index.html` shell matches `Logo.tsx`, so the logo
  does not jump when React mounts.
- **Existing tests.** Any test that asserts the old logo markup or alt text.

Run only the changed test files while working. Run `npm run check` once before pushing,
then `e2e-sw/first-visit.spec.ts` alone, because the icons are precached.

## Docs to update when it ships

- `DESIGN.md`: the logo section.
- `src/data/changelog.ts`: one entry, in plain words for users.
- `docs/progress.md`: what shipped.
- `images/brand/`: move the "yi" monogram and sprout files out of the live folders, or
  delete them. See open question 3.

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

## Open questions

1. **The icon tile colour.** Near-white or dark green. Decided on the review board.
2. **The size at which the letter appears.** Proposed 128px.
3. **The old artwork.** The "yi" monogram, the sun-dot wordmark and the sprout drawing
   are in `images/brand/`. Keep them as history, or delete them? The sprout was kept as
   secondary artwork by the superseded decision; it has no role in this one yet.
4. **Who draws the final letter.** A redrawn இ should be checked by someone who reads
   Tamil.
