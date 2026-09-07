# Yidhan Theme Audit vs. Sumi-e Reference Imagery

**Version:** 1.1
**Last Updated:** 2026-05-31
**Status:** Complete (+ multi-model council verdict appended)
**Author:** Claude (Opus 4.8)
**Consulted:** Frontend Design Skill; multi-agent council (Claude + Codex + Gemini)

---

## Original Prompt

> Someone posted this on twitter and I want to correlate what we have done with wabi-sabi design/colors with Yidhan with those images and compare/contrast. This is the prompt they used to create those images: *A traditional Japanese ink wash painting of a [subject], created in expressive sumi-e style with flowing black ink lines and delicate [color1] and [color2] watercolor tints. The pigments softly bleed into textured rice paper, evoking a sense of serenity and timeless beauty.* The 4 images are [koi, samurai, cherry blossom, geisha]. Are our design themes still accurate and appropriate for Yidhan's philosophy? Would we adjust the design/color themes or add any more? Use the front end design skill and other skills as needed.

---

## The Reference Set (what the paintings actually are)

| # | Subject | Paper ground | Ink | Color tints | Mood |
|---|---------|--------------|-----|-------------|------|
| 1 | **Koi fish** | Warm kraft/tan (~`#D8C9A8`) | Sumi black, splatter | **Rust terracotta** (~`#C2693A`) + **slate blue-grey** (~`#5A6B78`) | Serene, earthy, warm |
| 2 | **Samurai** | Cold bright white cold-press | Charcoal black | **Vivid crimson/vermilion** (~`#C8102E`) blood-mist | Dramatic, violent, kinetic |
| 3 | **Cherry blossom** | Cool white + brown speckle | Sumi black branch | **Rose/magenta pink** (~`#D14B6A`) | Soft, delicate, spring |
| 4 | **Geisha + parasol** | Warm ivory (~`#EDE6D2`) | Sumi black (dominant) | **Single vermilion seal-red** (~`#C0392B`) | Refined, moody, restrained |

### The shared sumi-e formula (the DNA worth measuring against)
1. **Textured paper ground — never pure white.** Rice paper / washi / cold-press tooth is always visible.
2. **Sumi black as the structural backbone** — flowing, variable-weight, expressive lines.
3. **Wet-on-wet bleed / splatter / soft bloom** diffusing into the paper — the signature gesture.
4. **One or two restrained color tints only**, floated over the black-and-paper base. Never a full spectrum.
5. **Generous negative space (_ma_ 間)** — emptiness as a compositional element.
6. **The red seal (_hanko_)** — a single, deliberate punctuation of warm red (in 2 of 4).

---

## How Yidhan Scores Against the Formula

| Sumi-e principle | Yidhan today | Verdict |
|---|---|---|
| Textured paper ground, no pure white | Paper-noise overlay + warm `bgPrimary`; "never pure black/white" rule | ✅ **Strong match** |
| Sumi black ink backbone | Warm dark sepia text `#3E3B36` (not `#000`) | ✅ **Aligned** |
| Wet bleed / bloom | "Manuscript glow" radial gradient, aged-paper card gradient | 🟡 **Partial** — a glow, not a true ink-bleed |
| One/two restrained tints | **Single accent per theme** (terracotta / gold / brown) | ✅✅ **Core philosophical match** |
| Negative space / _ma_ | Whitespace restraint, "restraint over features" | ✅ **Strong match** |
| Red seal punctuation | No equivalent | ⚪ **Absent — opportunity** |

**The single-accent-over-warm-paper-and-ink model is, almost exactly, the sumi-e discipline.** Yidhan did not copy sumi-e, but it converged on the same restraint. The philosophy holds up against authoritative reference imagery.

### Painting-by-painting
- **Koi ≈ Kintsugi.** The koi's rust terracotta (`~#C2693A`) is within a hair of Kintsugi's accent (`#C25634`), over a warm-paper ground. The koi could be Kintsugi's mascot. The one element Kintsugi lacks is the koi's **slate blue-grey wash**.
- **Geisha ≈ a theme we don't have yet.** Near-monochrome sumi ink + a single seal-red accent. This is the *purest distillation* of "calm over engagement" — and Yidhan has no ink-monochrome theme.
- **Cherry blossom ≈ the missing register.** Rose/pink is entirely absent from Yidhan's chrome. Notable because **"Yidhan" means "Bright Spring"** — yet the palette is autumnal (terracotta, gold, brown). The name evokes _sakura_; the colors evoke _October_.
- **Samurai = the anti-reference, correctly.** Vivid crimson drama is the opposite of "lower the user's heart rate." It is right that Yidhan has nothing like it. (It does hint that our error/destructive red could be more _ink-vermilion_ and less _generic web red_.)

---

## Focus Question: how close is our background to textured rice paper?

**Honest answer: close on _fine grain_, not yet on _handmade washi_.** We read as premium matte paper tooth; the paintings read as visibly fibrous rice paper.

### What we actually render
- A **flat solid** `bgPrimary` (`#EBE8E4` Kintsugi / `#F6F1E7` Washi) — one uniform hue, no macro variation.
- **One** SVG noise layer over it (`body::before`): `feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3"`, tiled, at `--noise-opacity: 0.11` (light) / `0.05` (dark), warm-tinted by `--noise-filter: sepia(65%) saturate(140%) brightness(0.93)`.

So the texture is a **single high-frequency grain** with a warm tint. That is genuinely good — but it is one ingredient of four.

### What real washi (和紙) has that we don't

| Washi characteristic | In the paintings | In Yidhan today |
|---|---|---|
| **Fine fiber grain** (high-freq tooth) | ✅ | ✅ `baseFrequency 0.8` captures this |
| **Warm hue** | ✅ | ✅ sepia filter tints the grain |
| **Low-freq cloudiness** (uneven pulp thickness — soft light/dark blotches across the sheet) | ✅ strongly | ❌ background is macro-flat |
| **Chiri 塵 — bark flecks / speckle** (the brown specks, most visible in the cherry-blossom paper) | ✅ | ❌ none |
| **Tonal/hue drift** across the sheet | ✅ | ❌ single flat hue |
| **Texture as a _character_** (felt, not measured) | ✅ loud | 🟡 0.11 opacity — a whisper |

The gap is **macro variation**. A single high-frequency `feTurbulence` is, by definition, uniform at the scale of the whole page — it has no clouds, no flecks, no drift. Real washi's signature is exactly that low-frequency irregularity: you can see where the pulp pooled. Our paper is _evenly_ textured, which ironically reads as _machine-made_ — the opposite of wabi-sabi's prized imperfection.

### How to close the gap (cheap, CSS-only, no new assets)
1. **Layer a second, low-frequency turbulence** for cloudiness — e.g. `baseFrequency ~0.012`, `numOctaves 2`, very low opacity, blended over the existing grain. Layered fractal noise (one fine + one coarse) is the standard washi recipe.
2. **Add a sparse chiri fleck layer** — a handful of slightly darker warm specks (a third noise at very low `baseFrequency` with high contrast, or a tiny tiled fleck pattern). This is precisely the brown speckle in painting #3.
3. **Let the tooth be felt** — nudge light-theme `--noise-opacity` from `0.11` toward `~0.14–0.16` so the paper is a character, not a measurement. (Dark themes should stay subtle.)
4. **Optional: a faint radial hue drift** on `bgPrimary` (a barely-there `radial-gradient` from a hair warmer center to cooler edges) to fake the across-the-sheet tonal variation.

None of this needs image assets — it's all in the existing `body::before` + a `body::after`/extra layer. It would move the ground from "nice grain" to "unmistakably handmade paper," which is the single highest-leverage upgrade to make Yidhan _feel_ like the reference imagery.

> **Net:** the background is a solid B on the rice-paper axis — the hue and fine grain are right, but it's missing the low-frequency cloudiness and chiri flecks that make washi read as _handmade_. This is the most impactful and lowest-risk texture upgrade available, and it pairs naturally with the "warm the default light ground" recommendation below.

---

## Key Finding: the cool tones already exist — just not in the chrome

Yidhan's **tag palette** already contains the full sumi-e secondary range:

```
terracotta #C25634   gold #D4AF37   forest #3D5A3D   stone  #8B8178
indigo     #4A5568   clay #A67B5B   sage   #87A878   plum   #6B4C5A
```

- `indigo #4A5568` **is** the koi's slate blue-grey wash.
- `plum #6B4C5A` is in the cherry-blossom/dusty-rose family.
- `stone`, `sage`, `clay` are textbook muted ink-wash neutrals.

So the system **already holds the complete sumi-e palette**. The limitation is that the warm/cool tension lives only in tags — the theme _chrome_ is mono-warm. The vocabulary is there; it just isn't spoken in the main UI.

---

## Recommendation: themes are accurate — refine, don't correct

### A. Keep the core, validate the warm-paper direction (low effort, high confidence)
Kintsugi's `bgPrimary #EBE8E4` is a cool-leaning warm-grey — earlier review already flagged it as "greyish," which is why **Washi** (`#F6F1E7`, true cream) exists. The sumi-e papers are all **warmer and creamier** than Kintsugi. The references **validate making Washi the default light theme** (or warming Kintsugi's background toward cream). This is the single most defensible change.

### B. Add **"Sumi" (墨)** — ink-monochrome light theme *(recommended new theme)*
Inspired by the geisha. Near-grayscale warm paper + sumi black + **one vermilion seal-red accent** (`~#B23A2E`). The most restrained theme possible — "wabi-sabi distilled." It also finally gives Yidhan a _hanko_-style red-accent moment. Lowest risk because it adds almost no color.

### C. Add **"Sakura" (桜)** — spring theme to honor the name *(optional, needs care)*
Warm cream + sumi branch-black + **muted dusty rose/plum** accent (`~#C2557A`, leaning on the existing `plum`). Fills the missing pink register and makes the "Bright Spring" name literal for the first time. **Risk:** pink can read cute/feminine/un-calm — it must be a desaturated, dusty rose, never bubblegum, or it breaks the brand's unisex calm.

### D. Shift destructive/error red toward seal-vermilion *(micro-refinement)*
`error #DC2626` is the one un-sumi color in the system — a generic web red. Nudging destructive surfaces toward an ink-vermilion (`~#C0392B`/`#B23A2E`) would read as _hanko_ rather than _alert_, consistent with all four paintings' red.

### E. Let the blue-grey breathe *(optional polish)*
Surface a hint of `indigo`/`stone` as an _incidental_ cool tone (illustration ink, empty-state strokes, a "cool" tag default) to relieve the all-warm monotony — exactly the warm-subject/cool-wash tension the koi uses.

---

## Bottom Line

**Yes — the themes remain accurate and appropriate.** The warm-paper + sumi-ink + single-restrained-accent + generous-emptiness model maps directly onto authentic sumi-e/wabi-sabi practice; Kintsugi is essentially the koi painting. Nothing here calls for a correction.

The opportunities are refinements:
1. **Warm the default light ground** (adopt/lean into Washi) — the references back this strongly.
2. **Add an ink-monochrome "Sumi" theme** with a seal-red accent — the purest expression of the philosophy and a genuinely new register.
3. **Optionally add a "Sakura" spring theme** to honor the "Bright Spring" name and supply the one color family the brand lacks — handled as dusty rose, not pink.
4. **Make reds read as seal-vermilion, not web-red.**
5. **Surface the cool blue-grey** that already lives in the tag palette.

---

## Multi-Model Council Verdict (Claude + Codex + Gemini)

The six proposals above were pressure-tested by a three-model council (ideation + counter-review). All endorsed the philosophy and the direction. The council added two findings the original audit missed, plus hard contrast data. Full report: `.review/report-a7f3c9d2.md` (transient) — durable summary below.

### Two gating findings the audit overlooked
1. **Themes are not runtime-selectable yet (Codex).** `Theme` in `src/types.ts` is only `'light' | 'dark'`; `App.tsx` writes that straight to `data-theme`; `index.css` emits only `:root` + `[data-theme="dark"]`. Adding **Sumi/Sakura as user-selectable themes requires a runtime-model refactor** (expand the union, emit `[data-theme="sumi"]`, de-hardcode terracotta/gold in `SettingsModal.tsx` labels + `index.css`/`LandingPage.tsx` glows). This does NOT block warming the ground, the red shift, or the texture upgrade — those improve the current themes.
2. **The texture overlay sits above content (all 3).** `body::before` is `z-index: 100`. Raising its opacity or adding layers there would texture **text, buttons, icons, modals** — not just paper. Cloud + chiri layers must go on a **lower/background layer**.

### Sharpest design-system move surfaced
**Add a dedicated `--color-seal` token, separate from `--color-accent` (Codex).** Otherwise the Sumi vermilion becomes a generic accent that lands on every focus ring, link, glow, and badge — a "red UI wash." This single token also operationalises the red-seal (_hanko_) metaphor: the seal becomes a rare, deliberate punctuation (brand mark, one active state) rather than a color system.

### Resolved: the Sakura ground question (2–1 for warm)
Keep the **warm cream paper** (a cool ground would break Yidhan's analog-paper identity and reintroduce the grey-ground problem). Prevent the "cute/feminine" read via **dominant sumi-black structure + a dark, desaturated plum-rose accent**, not by cooling the ground.

### Contrast data to respect
- **Sumi accent / seal:** `#B23A2E` ≈ 5.94:1 on white, ≈ 5.18:1 on warm paper `#F3EFE7`. ✅ (`#B22222` reads more generic.)
- **Sakura accent:** AVOID `#C2557A` (CTA ≈ 4.31:1, fails AA), `#AB7A7E`/`#9E7E7E` (≈ 3.6:1). USE `#A8455E` / `#A84665` / `#93465D` / plum `#6B4C5A`.
- **Warmed ground:** tertiary text `#7D7974` ≈ 3.84:1 on `#F6F1E7` — keep tertiary for metadata only, never body.
- **Error:** `#DC2626` actually passes (≈ 4.83:1) — the issue is *voice*, not contrast; but `errorLight #FEE2E2` + `#DC2626` text ≈ 3.95:1 needs re-test when the hue shifts. Dark themes: use vermilion-coral `#D4715E`/`#E07A5F`, never dark seal-red surfaces.

### Additional council findings (beyond the 6 proposals)
- **Real bug:** `kintsugi.ts noiseOpacity '0.18'` vs generated `index.css '0.11'` — source-of-truth drift. Add a "generated CSS is current" CI check.
- **Typography (confirmed, not hypothetical):** Cormorant headings are `font-weight: 600` (`index.css:577`); Sumi should pull display weights to ~300–400 so hairline strokes read as brushwork.
- **Surgical ink-bleed borders (Gemini):** variable-weight/porous borders only on the NoteEditor sheet ("narrative focus") — global porous borders are perf-costly gilding on Capacitor.
- **Animation as deepening tone, not lifting (Claude):** hover should deepen the card's paper shadow (ink absorbing), not levitate 4px. (Cards already deepen shadow — verify glows/scale/wave entrances feel calm enough for Sumi.)
- **`inkWashCool` blue-grey:** illustrations/dividers/decorative shadows only — NOT true focus rings (those need a reliable dedicated focus token), and never a second accent.
- **Dark themes are a different tradition:** Midnight/Mori are ink-on-dark-lacquer, not sumi-e — don't force light-ground brush logic onto them.
- **Broader contrast tests + `ma`/masonry density** were both flagged as worth a dedicated pass.

### Recommended execution order
**Track 1 — ship now (improves current themes, no refactor):** P6 texture (lower-layer) + P1 warm ground, then P4 error→seal-vermilion (+ fix `noiseOpacity` drift + add contrast tests).
**Track 2 — design-system foundation (before any new theme):** theme-architecture refactor + introduce `--color-seal`.
**Track 3 — new themes:** P2 Sumi → P5 `inkWashCool` → P3 Sakura.
