# Draws the leaf-that-is-a-page logo as SVG into images/brand/source/.
# Needs: pip install fonttools brotli
# Usage (from the repo root): python scripts/brand/leaf.py
#
# Geometry follows the chosen sketch on a 120-unit grid (DECISIONS.md, 2026-11-09,
# "The logo is a leaf that is a page"). The sketch drew the leaf at x 50, y 46, 54 x 66
# with a 3.5 stroke in the page colour. Here the leaf is the visible shape (that rect
# inset by 1.75) and the gap is a mask, so every file has a transparent background.
#
# The letter outline is MONOGRAM_PATH from the Inbax app (outlined from Noto Serif
# Tamil, SIL OFL). Its source box is centred at 24,24 and is 6.8 units tall.
# The wordmark is Fraunces (SIL OFL), wght 440, SOFT 100, opsz 72, WONK 0, the same
# instance as source/wordmark.json. Glyph positions come from that file's boxes.
import json, math, os, re
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen

OUT = 'images/brand/source/'
FRAUNCES = 'images/brand/review/fonts/fraunces.woff2'

GREEN, LIGHT_GREEN = '#2E7D55', '#86C5A0'
MARIGOLD = '#F2A21B'
DARK_GREEN, INK = '#163026', '#14241C'
NEAR_WHITE, DARK_PAGE, DARK_INK = '#FAFAF6', '#151C18', '#E6E3DC'

LETTER = ('M22.38 27.40Q22.05 27.40 21.80 27.29Q21.54 27.19 21.40 26.99Q21.25 26.79 21.25 26.50Q21.25 26.19 21.40 25.94Q21.55 25.69 21.80 25.50Q22.06 25.32 22.39 25.19Q22.72 25.07 23.09 25.01Q23.45 24.94 23.82 24.94Q24.18 24.94 24.56 25.01Q24.94 25.07 25.29 25.20Q25.64 25.32 25.92 25.51Q26.20 25.70 26.36 25.96Q26.52 26.21 26.52 26.53Q26.52 26.82 26.36 27.01Q26.20 27.21 25.92 27.30Q25.65 27.40 25.30 27.40Q24.82 27.40 24.34 27.23Q23.86 27.07 23.42 26.77Q22.98 26.48 22.61 26.07Q22.24 25.67 21.96 25.19Q21.68 24.71 21.53 24.19Q21.37 23.66 21.37 23.12Q21.37 22.57 21.58 22.12Q21.78 21.66 22.13 21.32Q22.49 20.97 22.97 20.79Q23.44 20.60 23.99 20.60Q24.68 20.60 25.19 20.80Q25.71 21.00 26.05 21.39Q26.40 21.79 26.57 22.38Q26.75 22.97 26.75 23.76V25.09H26.40V23.76Q26.40 23.17 26.25 22.69Q26.11 22.21 25.81 21.87Q25.52 21.52 25.06 21.33Q24.61 21.14 23.99 21.14Q23.57 21.14 23.18 21.27Q22.78 21.39 22.47 21.65Q22.16 21.92 21.98 22.33Q21.80 22.75 21.80 23.33Q21.80 23.79 21.93 24.24Q22.07 24.69 22.31 25.11Q22.55 25.53 22.87 25.89Q23.20 26.25 23.57 26.51Q23.94 26.78 24.33 26.93Q24.72 27.07 25.11 27.07Q25.39 27.07 25.61 27.01Q25.84 26.95 25.97 26.81Q26.10 26.68 26.10 26.45Q26.10 26.19 25.96 26.00Q25.82 25.81 25.58 25.67Q25.34 25.53 25.04 25.44Q24.74 25.35 24.43 25.30Q24.11 25.26 23.82 25.26Q23.53 25.26 23.23 25.32Q22.93 25.37 22.65 25.47Q22.37 25.58 22.15 25.73Q21.92 25.88 21.79 26.07Q21.66 26.26 21.66 26.50Q21.66 26.78 21.89 26.93Q22.12 27.07 22.48 27.07Q23.00 27.07 23.41 26.91Q23.82 26.75 24.13 26.46Q24.43 26.17 24.64 25.78Q24.84 25.40 24.94 24.95Q25.04 24.50 25.04 24.02Q25.04 23.60 24.92 23.27Q24.80 22.94 24.53 22.75Q24.27 22.56 23.86 22.56Q23.63 22.56 23.42 22.64Q23.21 22.73 23.08 22.90Q22.96 23.07 22.96 23.31Q22.96 23.52 23.07 23.65Q23.18 23.78 23.38 23.78Q23.61 23.78 23.72 23.64Q23.83 23.50 23.83 23.29Q23.83 23.03 23.65 22.81Q23.47 22.58 23.19 22.51L23.55 22.48Q23.84 22.54 24.02 22.67Q24.20 22.80 24.29 22.98Q24.37 23.16 24.37 23.35Q24.37 23.58 24.26 23.75Q24.15 23.92 23.95 24.02Q23.76 24.11 23.50 24.11Q23.28 24.11 23.07 24.01Q22.86 23.91 22.73 23.73Q22.60 23.55 22.60 23.30Q22.60 22.94 22.79 22.71Q22.98 22.47 23.29 22.35Q23.61 22.23 23.96 22.23Q24.35 22.23 24.66 22.37Q24.97 22.50 25.18 22.75Q25.40 23.00 25.51 23.36Q25.62 23.72 25.62 24.16Q25.62 24.66 25.47 25.14Q25.31 25.61 25.02 26.02Q24.73 26.43 24.33 26.74Q23.93 27.05 23.44 27.22Q22.94 27.40 22.38 27.40Z')

# Heavier cut of the letter: the outline plus a stroke of this width, in the letter's
# source units (the outline is 6.8 tall). 0 is the Inbax text weight.
LETTER_WEIGHTS = {'text': 0, 'medium': 0.22, 'heavy': 0.4}
LETTER_DEFAULT = 'medium'


def leaf_path(x, y, w, h, tl, tr, br, bl):
    f = lambda v: f'{v:g}'
    return (f'M{f(x+tl)} {f(y)}H{f(x+w-tr)}A{f(tr)} {f(tr)} 0 0 1 {f(x+w)} {f(y+tr)}'
            f'V{f(y+h-br)}A{f(br)} {f(br)} 0 0 1 {f(x+w-br)} {f(y+h)}'
            f'H{f(x+bl)}A{f(bl)} {f(bl)} 0 0 1 {f(x)} {f(y+h-bl)}'
            f'V{f(y+tl)}A{f(tl)} {f(tl)} 0 0 1 {f(x+tl)} {f(y)}Z')


# ---- The full mark, 120 grid -------------------------------------------------------
FULL = dict(
    sun=(41, 37, 19),
    leaf=(51.75, 47.75, 50.5, 62.5, 3.25, 25.25, 3.25, 25.25),
    gap=3.5,
    lines=[(63, 73, 91), (63, 85, 91), (63, 97, 78)], line_w=4.5, line_cap='round',
    letter=(39.5, 35.3, 17),   # centre x, centre y, height
)
# Mark bounds: sun left/top to leaf right/bottom.
FULL_BOX = (22, 18, 102.25, 110.25)

# ---- The small mark, 16 grid, pixel-snapped ----------------------------------------
# Leaf 8 x 9 at (6, 5); sun r 3 at (4.5, 4.5); a 1px gap; one 1px line, or none.
SMALL = dict(
    sun=(4.5, 4.5, 3),
    leaf=(6, 5, 8, 9, 1, 4, 1, 4),
    gap=1,
    lines=[(8, 10.5, 12)], line_w=1, line_cap='butt',
    letter=None,
)
SMALL_BOX = (1.5, 1.5, 14, 14)


def mark_body(g, uid, leaf_fill, sun_fill=MARIGOLD, letter=None, letter_fill=DARK_GREEN,
              lines=True, mono=None):
    """SVG for the mark. letter: None or a LETTER_WEIGHTS key. mono: one colour for all
    parts, with the letter knocked out of the sun."""
    leaf = leaf_path(*g['leaf'])
    cx, cy, r = g['sun']
    if mono:
        leaf_fill = sun_fill = mono
    s = []
    lt = ''
    if letter is not None:
        lx, ly, lh = g['letter']
        k = lh / 6.8
        sw = LETTER_WEIGHTS[letter]
        stroke = (f' stroke="{{c}}" stroke-width="{sw:g}" stroke-linejoin="round"' if sw else '')
        lt = (f'<g transform="translate({lx:g} {ly:g}) scale({k:.4f}) translate(-24 -24)">'
              f'<path d="{LETTER}" fill="{{c}}"{stroke}/></g>')
    # Sun mask: everything except the leaf grown by the gap (and the letter, in mono).
    s.append(f'<mask id="{uid}-sun" maskUnits="userSpaceOnUse" x="-10" y="-10" width="140" height="140">'
             f'<rect x="-10" y="-10" width="140" height="140" fill="#fff"/>'
             f'<path d="{leaf}" fill="#000" stroke="#000" stroke-width="{g["gap"]*2:g}" stroke-linejoin="round"/>'
             + (lt.replace('{c}', '#000') if (mono and lt) else '') + '</mask>')
    if lines and g['lines']:
        ls = ''.join(f'<path d="M{a:g} {y:g}H{b:g}"/>' for a, y, b in g['lines'])
        s.append(f'<mask id="{uid}-leaf" maskUnits="userSpaceOnUse" x="-10" y="-10" width="140" height="140">'
                 f'<rect x="-10" y="-10" width="140" height="140" fill="#fff"/>'
                 f'<g stroke="#000" stroke-width="{g["line_w"]:g}" stroke-linecap="{g["line_cap"]}">{ls}</g></mask>')
    defs = '<defs>' + ''.join(s) + '</defs>'
    body = (f'<g mask="url(#{uid}-sun)"><circle cx="{cx:g}" cy="{cy:g}" r="{r:g}" fill="{sun_fill}"/>'
            + (lt.replace('{c}', letter_fill) if (lt and not mono) else '') + '</g>'
            f'<path d="{leaf}" fill="{leaf_fill}"' + (f' mask="url(#{uid}-leaf)"' if lines and g['lines'] else '') + '/>')
    return defs + body


def svg(viewbox, inner, title, comment=''):
    c = f'\n  <!-- {comment} -->' if comment else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}" role="img" aria-label="{title}">{c}\n'
            f'  <title>{title}</title>\n  {inner}\n</svg>\n')


def box_viewbox(box, pad=0, square=True):
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    if square:
        sz = max(w, h) + 2 * pad
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        return f'{cx - sz/2:g} {cy - sz/2:g} {sz:g} {sz:g}'
    return f'{x0 - pad:g} {y0 - pad:g} {w + 2*pad:g} {h + 2*pad:g}'


def tile(g, box, grid, uid, bg, leaf_fill, scale, letter=None, lines=True, rx=0, center=True):
    """A square tile of size `grid` with the mark centred on its bounding box."""
    x0, y0, x1, y1 = box
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    tx, ty = (grid / 2 - cx * scale, grid / 2 - cy * scale) if center else (0, 0)
    rect = f'<rect width="{grid}" height="{grid}"' + (f' rx="{rx:g}"' if rx else '') + f' fill="{bg}"/>'
    # Letter colour: dark green on both tiles.
    inner = mark_body(g, uid, leaf_fill, letter=letter, lines=lines)
    if scale == 1 and tx == 0 and ty == 0:
        return rect + inner
    return rect + f'<g transform="translate({tx:g} {ty:g}) scale({scale:g})">' + inner + '</g>'


def max_radius(g, box):
    """Farthest point of the mark from its box centre (for the maskable safe zone)."""
    x0, y0, x1, y1 = box
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    sx, sy, r = g['sun']
    best = math.hypot(sx - cx, sy - cy) + r
    x, y, w, h, tl, tr, br, bl = g['leaf']
    for (ax, ay, rr) in [(x+tl, y+tl, tl), (x+w-tr, y+tr, tr), (x+w-br, y+h-br, br), (x+bl, y+h-bl, bl)]:
        best = max(best, math.hypot(ax - cx, ay - cy) + rr)
    return best


# ---- Wordmark ---------------------------------------------------------------------
def wordmark_paths(dotted_i=True):
    """dotted_i=False keeps the dotless i, for a wordmark that puts the sun on it."""
    wm = json.load(open(OUT + 'wordmark.json'))
    f = TTFont(FRAUNCES)
    inst = instantiateVariableFont(f, {'wght': 440, 'SOFT': 100, 'opsz': 72, 'WONK': 0})
    gs = inst.getGlyphSet()
    parts = []
    for name, box in wm['boxes']:
        bp = BoundsPen(gs); gs[name].draw(bp)
        origin = box[0] - bp.bounds[0]
        draw = 'i' if (name == 'dotlessi' and dotted_i) else name
        pen = SVGPathPen(gs)
        gs[draw].draw(TransformPen(pen, (1, 0, 0, -1, origin, 0)))
        bp2 = BoundsPen(gs); gs[draw].draw(bp2); b = bp2.bounds
        parts.append((draw, pen.getCommands(), (b[0] + origin, -b[3], b[2] + origin, -b[1])))
    return parts


def rnd(d, n=1):
    return re.sub(r'-?\d+\.\d+', lambda m: f'{float(m.group()):.{n}f}'.rstrip('0').rstrip('.'), d)


def wordmark_body(parts, y_fill, rest_fill):
    y = ''.join(rnd(d) for n, d, _ in parts if n == 'y')
    rest = ' '.join(rnd(d) for n, d, _ in parts if n != 'y')
    return f'<path fill="{y_fill}" d="{y}"/><path fill="{rest_fill}" d="{rest}"/>'


def main():
    os.makedirs(OUT, exist_ok=True)
    w = lambda name, text: open(OUT + name, 'w', encoding='utf-8', newline='\n').write(text)
    vb_full = box_viewbox(FULL_BOX, pad=4)
    vb_small = '0 0 16 16'  # keep the 16 grid so the drawing stays pixel-snapped

    # Full mark.
    w('mark.svg', svg(vb_full, mark_body(FULL, 'm', GREEN, letter=LETTER_DEFAULT), 'Yidhan',
      'Full mark, 128px and up: leaf, sun, and இ in the sun. Letter cut: medium.'))
    w('mark-plain.svg', svg(vb_full, mark_body(FULL, 'mp', GREEN), 'Yidhan',
      'Full mark without the letter, for 49px to 127px.'))
    w('mark-on-dark.svg', svg(vb_full, mark_body(FULL, 'md', LIGHT_GREEN, letter=LETTER_DEFAULT), 'Yidhan',
      'Full mark for dark pages: light green leaf.'))
    w('mark-plain-on-dark.svg', svg(vb_full, mark_body(FULL, 'mpd', LIGHT_GREEN), 'Yidhan',
      'Full mark without the letter, for dark pages.'))
    for k in LETTER_WEIGHTS:
        w(f'mark-letter-{k}.svg', svg(vb_full, mark_body(FULL, f'ml{k}', GREEN, letter=k), 'Yidhan',
          f'Letter study: the {k} cut of இ.'))
    w('mark-letter-ink.svg', svg(vb_full, mark_body(FULL, 'mli', GREEN, letter=LETTER_DEFAULT, letter_fill=INK), 'Yidhan',
      'Letter study: இ in ink #14241C instead of dark green #163026.'))

    # Small mark, 16 to 48px.
    w('mark-small.svg', svg(vb_small, mark_body(SMALL, 's', GREEN), 'Yidhan',
      'Small mark for 16 to 48px. 16-unit grid, pixel-snapped. One line.'))
    w('mark-small-no-line.svg', svg(vb_small, mark_body(SMALL, 'sn', GREEN, lines=False), 'Yidhan',
      'Small mark for 16 to 48px, with no line.'))
    w('mark-small-on-dark.svg', svg(vb_small, mark_body(SMALL, 'sd', LIGHT_GREEN), 'Yidhan',
      'Small mark for dark pages.'))

    # One colour.
    for name, col, g, vb, letter in [('mark-mono.svg', INK, FULL, vb_full, LETTER_DEFAULT),
                                     ('mark-mono-plain.svg', INK, FULL, vb_full, None),
                                     ('mark-mono-small.svg', INK, SMALL, vb_small, None)]:
        w(name, svg(vb, mark_body(g, name[:-4], GREEN, letter=letter, mono=col), 'Yidhan',
          'One colour. Recolour the single fill. The gap and the lines are cut out; the letter, '
          'when present, is cut out of the sun.'))

    # Icon tiles. Large: 120 grid, full bleed, mark scale 0.74 (inside the maskable safe zone).
    scale = 0.74
    r = max_radius(FULL, FULL_BOX) * scale
    print(f'large tile: mark reaches {r:.1f} of 120 from centre; maskable safe zone is 48')
    for tone, bg, leaf in [('light', NEAR_WHITE, GREEN), ('dark', DARK_GREEN, LIGHT_GREEN)]:
        w(f'tile-{tone}.svg', svg('0 0 120 120', tile(FULL, FULL_BOX, 120, f't{tone}', bg, leaf, scale, letter=LETTER_DEFAULT),
          'Yidhan', f'App icon tile, {tone}, 128px and up. Full bleed: the platform rounds or masks it. '
          f'The mark stays inside the maskable safe zone.'))
        w(f'tile-{tone}-plain.svg', svg('0 0 120 120', tile(FULL, FULL_BOX, 120, f'tp{tone}', bg, leaf, scale),
          'Yidhan', f'App icon tile, {tone}, 49px to 127px. No letter.'))
        # Small: the 16-grid drawing on a rounded tile, as the favicon.
        w(f'tile-{tone}-small.svg', svg('0 0 16 16', tile(SMALL, SMALL_BOX, 16, f'ts{tone}', bg, leaf, 1, rx=3.5, center=False),
          'Yidhan', f'Favicon tile, {tone}, 16 to 48px. Rounded, because a browser tab does not mask it.'))
        w(f'tile-{tone}-small-no-line.svg', svg('0 0 16 16', tile(SMALL, SMALL_BOX, 16, f'tsn{tone}', bg, leaf, 1, lines=False, rx=3.5, center=False),
          'Yidhan', f'Favicon tile, {tone}, with no line.'))

    # Wordmark with a green y and a plain i.
    parts = wordmark_paths()
    x0 = min(b[0] for _, _, b in parts); x1 = max(b[2] for _, _, b in parts)
    y0 = min(b[1] for _, _, b in parts); y1 = max(b[3] for _, _, b in parts)
    pad = 60
    vb_wm = f'{x0-pad:.0f} {y0-pad:.0f} {x1-x0+2*pad:.0f} {y1-y0+2*pad:.0f}'
    w('wordmark-green-y.svg', svg(vb_wm, wordmark_body(parts, GREEN, INK), 'Yidhan',
      'Wordmark: Fraunces (SIL OFL) wght 440 SOFT 100 opsz 72, outlined. Green y, plain i, ink for the rest.'))
    w('wordmark-green-y-on-dark.svg', svg(vb_wm, wordmark_body(parts, LIGHT_GREEN, DARK_INK), 'Yidhan',
      'Wordmark for dark pages.'))

    # Lockup: the mark runs from the ascender to the descender; the leaf's base sits
    # on the descender line and the sun's top on the ascender line.
    asc, desc = 1476, 478  # top of d and h, bottom of y, in font units
    mx0, my0, mx1, my1 = FULL_BOX
    k = (my1 - my0) / (asc + desc)   # mark units per font unit
    gap = 0.3 * (mx1 - mx0)          # mark-to-word gap, in mark units
    wx = mx1 + gap - x0 * k
    base = my0 + asc * k             # baseline, in mark units
    word = f'<g transform="translate({wx:.2f} {base:.2f}) scale({k:.5f})">' + '{w}</g>'
    total_w = (mx1 + gap + (x1 - x0) * k) - mx0
    bottom = max(my1, base + y1 * k)
    vb_lock = f'{mx0-4:g} {my0-4:g} {total_w+8:.2f} {bottom-my0+8:.2f}'
    for name, leaf, yc, rc in [('lockup.svg', GREEN, GREEN, INK), ('lockup-on-dark.svg', LIGHT_GREEN, LIGHT_GREEN, DARK_INK)]:
        w(name, svg(vb_lock, mark_body(FULL, name[:-4], leaf) + word.format(w=wordmark_body(parts, yc, rc)), 'Yidhan',
          'Horizontal lockup: plain mark (no letter) and the wordmark. The mark runs from the '
          'ascender to the descender. No sun on the i.'))
    print('wrote', len([f for f in os.listdir(OUT) if f.endswith('.svg')]), 'svg files')


if __name__ == '__main__':
    main()
