# Yidhan mark study

Date: 2026-09-13. A critique of the current logo and eight concept sketches.
The full study, with every sketch rendered in both themes at header, favicon
and app-icon size, is `2026-09-13-mark-study.html`. Open it in a browser. Each
sketch is also here as a standalone SVG. These are territories, not final
marks; a final mark needs hand drawing and optical correction in any of them.

## The mark today

A terracotta brush arc over a gold dot, split into two CSS masks so the arc
follows the theme accent. The master is a Gemini render in `images/`. The
3.6 MB "vector" file wraps that bitmap.

It is a pleasant placeholder. It is on mood and off idea.

- No idea. An arc over a dot reads as Wi-Fi, a rainbow, an eyebrow, a gauge.
- Borrowed vocabulary. The brush arc and the enso are the stock set of
  meditation apps.
- No construction. Raster only. Cannot be cut, embossed, animated or redrawn.
- Reads as generated. Cream, light serif, terracotta, one brush stroke.
- Breaks in Midnight. Arc and seed are both gold, so the figure collapses.
- Fails at 16 px. The arc is a smear and the seed is two pixels.
- The maskable PWA icon reuses the full-bleed crop, so Android's safe zone
  clips both ends of the arc.

It matches the ethos halfway. Warm, imperfect, quiet: yes. Private, yours,
offline: nothing says it. The name is Tamil and means Bright Spring; the mark
is a Japanese calligraphy trope.

Housekeeping found on the way: `public/icons/icon.svg` is an unreferenced,
different logo, and `public/vite.svg` is the Vite template icon.

## Codex explorations (branch `codex/yidhan-brand-explorations`)

Three ChatGPT image boards: The Inner Fold, The Spring Y, The Yidhan
Signature. Better direction than the current logo: flat, constructible, the Y
as monogram. But every board fails its own consistency rule; hero, mono and
icon are three different drawings. The wordmarks are heavy display serifs that
fight the app's light Cormorant. Two of three are botanical despite the brief.
Keep: the Y as the mark, and the terracotta tittle on the i from concept 3.

## Round one

- **The Source** (`the-source.svg`). A custom Y whose three strokes leave one
  gold point at the junction. The initial is the mark.
- **One Stroke, One Page** (`one-stroke-one-page.svg`). The card radius
  2 / 24 / 4 / 24 drawn as one open stroke, closed by gold. Kintsugi in a glyph.
- **The Stone** (`the-stone.svg`). A stone with a note card cut out in negative.
  The mark is what the server never sees.

## Round two

Drops the assumptions the first six shared: the mark is a symbol, it sits in
the header, it needs a shape.

- **Kolam** (`kolam.svg`). Four pulli, one unbroken line, drawn fresh each
  morning. Two lobes larger than the others so it never settles into a clover.
- **The Rubric** (`rubric.svg`). A hand-cut capitulum, always small, always in
  the margin, always red. Collides with Word's formatting-marks icon; test
  early.
- **The Pulli** (`pulli.svg`). One gold dot above the name, the Tamil dot of
  quiet. Favicon is the dot on the forest tile.

## Round three

- **The Confluence** (`confluence.svg`). One kolam line in the shape of a Y,
  one pulli where the streams meet. Each idea owns one element: shape is the
  name, line is the kolam, dot is the brightness, position is the spring.

## Round four

- **Yi** (`yi.svg`). Spring, brightness and the Y without the kolam. A
  serifed calligraphic Y, thick left arm and hairline right arm, with a gold
  sun floating in the cup; in the wordmark it is the tittle of the i and the
  i goes dotless. The mark spells the first syllable. The first draft used
  three round-capped strokes and read as a figure with raised arms; serifs
  are what a body never has, so the letter reading wins.
- **The sun.** Four treatments compared: rays (rejected: eight extra elements,
  collides with the arms, the solar-installer glyph), a hand-drawn disc
  (always), a soft glow on screen (the manuscript glow), and a lit Y where the
  arm faces nearest the sun take gold (splash, landing, print at size).

## Pick

Yi. It carries the name's letter, its meaning and its first syllable in three
strokes and a circle.

## Next steps

1. Pick a territory, not a sketch.
2. Draw it as vector from the start. Three rounds of optical correction at 16,
   30, 64 and 1024 px, in one colour first. Gold last.
3. Make the ink follow text colour, not the accent, so gold survives Midnight.
4. Cut every icon from one SVG, with a real maskable safe zone. Retire the two
   masks, the Gemini sources and the orphan icons in the same commit.
5. Record the decision in `DECISIONS.md` and add a changelog entry.
