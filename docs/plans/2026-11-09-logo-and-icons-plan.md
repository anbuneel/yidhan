Status: ACTIVE
Last verified: 2026-11-10

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

## What the review board settled

Part 1 is done: the drawings and the review board are in PR 265 into `redesign`
(`images/brand/source/`, `images/brand/review/leaf-board.html`, drawn by
`scripts/brand/leaf.py`). The owner approved the board on 2026-11-09 with these
answers:

1. **When the letter shows.** The bare mark shows it from 128px. The icon tile shows it
   from 192px, because the mark is smaller on a tile and the letter reads as a knot
   below about 20px. Below those sizes the sun is plain. So the splash, About, the
   large app icon and the OG image carry the letter; the header and favicons do not.
2. **Letter weight.** The "medium" cut (`mark-letter-medium.svg`): the Inbax outline
   with a slightly thicker stroke. It is a stroked outline, not a redrawing. Flatten
   the stroke into the path before export.
3. **The icon tile.** Dark green, for the app icon and the favicon. The near-white tile
   disappears on white tab bars and launchers. The cost: on the tile the leaf is the
   light green, not the green of the app's buttons.
4. **The wordmark's i.** A plain i everywhere. No sun on the i.
5. **Small sizes.** From 16 to 48px, the separate small drawing with one line
   (`mark-small.svg`, `tile-dark-small.svg`).
6. **One colour.** One fill, with the gap, the lines and the letter cut out
   (`mark-mono*.svg`).

On 2026-11-09 the owner, who reads Tamil, checked the thickened letter and approved it.
The owner dropped the store search for look-alike marks. The old artwork (the "yi"
monogram, the sun-dot wordmark, the sprout) moves to `images/brand/archive/` in the
rollout PR.

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

Progress: steps 1 and 2 are merged into `redesign` (PRs 265 and 266). Step 3 is PR 267.
In it the owner reversed board answer 4: the wordmark's i carries the marigold sun, and
the header logo is larger (`DECISIONS.md`, in PR 267). The fonts step
left about 1 KB of headroom in the landing and precache budgets; the rollout may need
to raise them, with a `DECISIONS.md` entry.

## Open questions

1. **The old artwork.** The "yi" monogram, the sun-dot wordmark and the sprout drawing
   are in `images/brand/`. Keep them as history, or delete them? The sprout was kept as
   secondary artwork by the superseded decision; it has no role in this one yet.
2. **Who checks the letter.** The thickened இ should be checked by someone who reads
   Tamil before the rollout exports it.
