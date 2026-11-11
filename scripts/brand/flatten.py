# Flattens the leaf logo into plain filled paths, for the app and the icon exports.
# Needs: pip install fonttools brotli skia-pathops
# Usage (from the repo root): python scripts/brand/flatten.py
#
# The drawings in images/brand/source/ (scripts/brand/leaf.py) use masks for the gap and
# the lines, and a stroke to thicken the letter. Masks need unique ids on a page, and a
# stroke changes with the renderer. So this script does the cut-outs once, as path
# boolean operations, and writes:
#   src/components/logoPaths.ts       paths for Logo.tsx and the index.html shell
#   images/brand/export/*.svg         flat SVGs the PNG exports are rendered from
#
# Geometry, colours and the letter come from leaf.py, so the two cannot drift.
import os, sys, re
sys.path.insert(0, os.path.dirname(__file__))
import leaf
import pathops
from fontTools.svgLib.path import parse_path
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

EXPORT = 'images/brand/export/'
NEWSREADER = 'src/assets/fonts/newsreader-roman-latin.woff2'
# The share image's tagline, outlined so the OG script needs no font (sharp's text
# renderer cannot read woff2). scripts/generate-og-image.ts places it.
TAGLINE = 'A quiet home for your personal notes'
TS_OUT = 'src/components/logoPaths.ts'
INDEX_HTML = 'index.html'
SPRITE_START, SPRITE_END = '<!-- logo sprite: scripts/brand/flatten.py -->', '<!-- /logo sprite -->'


def from_svg(d, transform=None):
    p = pathops.Path()
    pen = p.getPen()
    parse_path(d, TransformPen(pen, transform) if transform else pen)
    return p


def circle(cx, cy, r):
    return from_svg(f'M{cx - r} {cy}A{r} {r} 0 1 0 {cx + r} {cy}A{r} {r} 0 1 0 {cx - r} {cy}Z')


def stroked(path, width, cap, join=pathops.LineJoin.ROUND_JOIN):
    p = pathops.Path(path)
    p.stroke(width, cap, join, 4)
    p.convertConicsToQuads()
    return pathops.simplify(p)


def to_d(path, nd=2):
    pen = SVGPathPen(None)
    path.draw(pen)
    d = pen.getCommands()
    return re.sub(r'-?\d+\.\d+', lambda m: f'{float(m.group()):.{nd}f}'.rstrip('0').rstrip('.'), d)


def parts(g, letter=False):
    """Flat sun, leaf and letter paths for one drawing. Cut-outs are holes, so they
    show whatever is behind the mark: the page, on any theme."""
    leaf_p = from_svg(leaf.leaf_path(*g['leaf']))
    # The gap: the leaf grown by the gap width, cut from the sun.
    gap = pathops.op(leaf_p, stroked(leaf_p, g['gap'] * 2, pathops.LineCap.BUTT_CAP), pathops.PathOp.UNION)
    sun = pathops.op(circle(*g['sun']), gap, pathops.PathOp.DIFFERENCE)
    cap = pathops.LineCap.ROUND_CAP if g['line_cap'] == 'round' else pathops.LineCap.BUTT_CAP
    lines = pathops.Path()
    for a, y, b in g['lines']:
        lines = pathops.op(lines, stroked(from_svg(f'M{a} {y}H{b}'), g['line_w'], cap), pathops.PathOp.UNION)
    leaf_cut = pathops.op(leaf_p, lines, pathops.PathOp.DIFFERENCE)
    out = {'sun': sun, 'leaf': leaf_cut}
    if letter:
        lx, ly, lh = g['letter']
        k = lh / 6.8
        sw = leaf.LETTER_WEIGHTS[leaf.LETTER_DEFAULT]
        # Flatten the stroke into the outline, in the letter's own units, then place it.
        src = from_svg(leaf.LETTER)
        thick = pathops.op(src, stroked(src, sw, pathops.LineCap.BUTT_CAP), pathops.PathOp.UNION)
        placed = pathops.Path()
        thick.draw(TransformPen(placed.getPen(), (k, 0, 0, k, lx - 24 * k, ly - 24 * k)))
        # The letter sits in the sun's group in the source, so the gap clips it too.
        out['letter'] = pathops.op(placed, gap, pathops.PathOp.DIFFERENCE)
        # One colour: the letter is cut out of the sun.
        out['sunMono'] = pathops.op(sun, out['letter'], pathops.PathOp.DIFFERENCE)
    return out


ARGS = {'M': 2, 'L': 2, 'H': 1, 'V': 1, 'Q': 4, 'T': 2, 'C': 6, 'S': 4, 'Z': 0}


def compact(d, nd=0):
    """Rewrite an absolute path as relative commands, rounded to nd decimals. Rounds the
    absolute points first, so errors do not add up along the path. Shorter numbers, so
    the strings that ship in the JS entry and index.html are smaller."""
    toks = re.findall(r'[MLHVQTCSZmlhvqtcsz]|-?\d*\.?\d+', d)
    q = lambda v: round(v, nd)

    def num(v):
        t = f'{round(v, nd):.{nd}f}'
        if '.' in t:
            t = t.rstrip('0').rstrip('.')
        if t in ('-0', ''):
            t = '0'
        if t.startswith('0.'):
            t = t[1:]
        elif t.startswith('-0.'):
            t = '-' + t[2:]
        return t

    def join(nums):
        s, prev = '', ''
        for v in nums:
            t = num(v)
            # A separator is needed unless the sign, or a second dot, ends the number before.
            if s and not (t[0] == '-' or (t[0] == '.' and '.' in prev)):
                s += ' '
            s += t
            prev = t
        return s

    out, i, cmd = [], 0, None
    cx = cy = sx = sy = 0
    while i < len(toks):
        t = toks[i]
        if t.isalpha():
            cmd = t.upper()
            i += 1
            if cmd == 'Z':
                out.append('z')
                cx, cy = sx, sy
                continue
        elif cmd == 'M':
            cmd = 'L'  # implicit lineto after a moveto
        n = ARGS[cmd]
        vals = [float(v) for v in toks[i:i + n]]
        i += n
        if cmd == 'H':
            x = q(vals[0]); nums = [x - cx]; cx = x
        elif cmd == 'V':
            y = q(vals[0]); nums = [y - cy]; cy = y
        else:
            pts = [(q(vals[k]), q(vals[k + 1])) for k in range(0, n, 2)]
            nums = []
            for (x, y) in pts:
                nums += [x - cx, y - cy]
            cx, cy = pts[-1]
            if cmd == 'M':
                sx, sy = cx, cy
        out.append(cmd.lower() + join(nums))
    return ''.join(out)


def box_vb(box, pad=0):
    x0, y0, x1, y1 = box
    return f'{x0 - pad:g} {y0 - pad:g} {x1 - x0 + 2 * pad:g} {y1 - y0 + 2 * pad:g}'


def svg(vb, body, comment):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="Yidhan">\n'
            f'  <!-- {comment} Flattened by scripts/brand/flatten.py. -->\n'
            f'  <title>Yidhan</title>\n  {body}\n</svg>\n')


def mark_body(p, leaf_fill, letter_fill=leaf.DARK_GREEN, letter=True, mono=None):
    if mono:
        sun = p['sunMono'] if (letter and 'sunMono' in p) else p['sun']
        return f'<path fill="{mono}" d="{to_d(sun)} {to_d(p["leaf"])}"/>'
    s = f'<path fill="{leaf.MARIGOLD}" d="{to_d(p["sun"])}"/>'
    if letter and 'letter' in p:
        s += f'<path fill="{letter_fill}" d="{to_d(p["letter"])}"/>'
    return s + f'<path fill="{leaf_fill}" d="{to_d(p["leaf"])}"/>'


def tile_body(p, g, box, grid, bg, leaf_fill, scale, letter, rx=0, center=True):
    x0, y0, x1, y1 = box
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    tx, ty = (grid / 2 - cx * scale, grid / 2 - cy * scale) if center else (0, 0)
    rect = f'<rect width="{grid}" height="{grid}"' + (f' rx="{rx:g}"' if rx else '') + f' fill="{bg}"/>'
    inner = mark_body(p, leaf_fill, letter=letter)
    if scale == 1 and tx == 0 and ty == 0:
        return rect + inner
    return rect + f'<g transform="translate({tx:.4f} {ty:.4f}) scale({scale:g})">' + inner + '</g>'


def text_path(text, font_path, wght):
    """Outline a line of text from a variable font. Returns (d, advance) in font units,
    baseline at y 0, y down."""
    from fontTools.ttLib import TTFont
    from fontTools.varLib.instancer import instantiateVariableFont
    f = instantiateVariableFont(TTFont(font_path), {'wght': wght})
    gs, cmap, hmtx = f.getGlyphSet(), f.getBestCmap(), f['hmtx']
    pen = SVGPathPen(gs)
    x = 0
    for ch in text:
        name = cmap[ord(ch)]
        gs[name].draw(TransformPen(pen, (1, 0, 0, -1, x, 0)))
        x += hmtx[name][0]
    return pen.getCommands(), x, f['head'].unitsPerEm


def main():
    os.makedirs(EXPORT, exist_ok=True)
    full = parts(leaf.FULL, letter=True)
    small = parts(leaf.SMALL)
    small_plain = parts({**leaf.SMALL, 'lines': []})  # 16px: two lines blur there
    w = lambda name, text: open(EXPORT + name, 'w', encoding='utf-8', newline='\n').write(text)
    vb_full = leaf.box_viewbox(leaf.FULL_BOX, pad=4)

    # Bare marks.
    w('mark.svg', svg(vb_full, mark_body(full, leaf.GREEN), 'Full mark with the letter, 128px and up.'))
    w('mark-plain.svg', svg(vb_full, mark_body(full, leaf.GREEN, letter=False), 'Full mark, 49 to 127px.'))
    w('mark-on-dark.svg', svg(vb_full, mark_body(full, leaf.LIGHT_GREEN), 'Full mark with the letter, dark pages.'))
    w('mark-plain-on-dark.svg', svg(vb_full, mark_body(full, leaf.LIGHT_GREEN, letter=False), 'Full mark, dark pages, 49 to 127px.'))
    w('mark-small.svg', svg('0 0 16 16', mark_body(small, leaf.GREEN), 'Small mark, 17 to 48px. Two lines.'))
    w('mark-small-no-line.svg', svg('0 0 16 16', mark_body(small_plain, leaf.GREEN), 'Small mark, 16px. No line.'))
    w('mark-mono.svg', svg(vb_full, mark_body(full, None, mono=leaf.INK), 'One colour, letter cut out.'))
    w('mark-mono-plain.svg', svg(vb_full, mark_body(full, None, letter=False, mono=leaf.INK), 'One colour.'))
    w('mark-mono-small.svg', svg('0 0 16 16', mark_body(small, None, mono=leaf.INK), 'One colour, 16 to 48px.'))

    # Dark tiles: app icon (full bleed, the platform rounds it) and favicon (rounded).
    scale = 0.74
    for name, letter in [('tile-dark.svg', True), ('tile-dark-plain.svg', False)]:
        w(name, svg('0 0 120 120', tile_body(full, leaf.FULL, leaf.FULL_BOX, 120, leaf.DARK_GREEN, leaf.LIGHT_GREEN,
                                             scale, letter), 'App icon tile, dark. Mark inside the maskable safe zone.'))
    w('tile-dark-small.svg', svg('0 0 16 16', tile_body(small, leaf.SMALL, leaf.SMALL_BOX, 16, leaf.DARK_GREEN,
                                                        leaf.LIGHT_GREEN, 1, False, rx=3.5, center=False),
                                 'Favicon tile, dark, 17 to 48px.'))
    w('tile-dark-small-no-line.svg', svg('0 0 16 16', tile_body(small_plain, leaf.SMALL, leaf.SMALL_BOX, 16, leaf.DARK_GREEN,
                                                                leaf.LIGHT_GREEN, 1, False, rx=3.5, center=False),
                                         'Favicon tile, dark, 16px. No line.'))
    # Android adaptive foreground: 108 grid, transparent; the launcher masks the
    # centre 72 and draws the tile colour behind it. Mark kept inside the 66 safe circle.
    for name, letter in [('android-foreground.svg', True), ('android-foreground-plain.svg', False)]:
        w(name, svg('0 0 108 108', tile_body(full, leaf.FULL, leaf.FULL_BOX, 108, 'none', leaf.LIGHT_GREEN,
                                             0.5, letter).replace('<rect width="108" height="108" fill="none"/>', ''),
                    'Android adaptive icon foreground. Background colour is the dark tile.'))

    # Wordmark: green y, ink for the rest. Tight box, ascender to descender, so the
    # header can set it to the same height as the mark.
    wparts = leaf.wordmark_paths(dotted_i=False)
    x0 = min(b[0] for _, _, b in wparts); x1 = max(b[2] for _, _, b in wparts)
    asc, desc = 1476, 478
    # Whole font units: 2000 to the em, so a unit is under 0.02px at header size.
    whole = lambda d: re.sub(r'-?\d+\.\d+', lambda m: str(round(float(m.group()))), d).replace('-0 ', '0 ')
    y_d = ''.join(whole(d) for n, d, _ in wparts if n == 'y')
    rest_d = ' '.join(whole(d) for n, d, _ in wparts if n != 'y')
    vb_wm = f'{x0:.0f} {-asc} {x1 - x0:.0f} {asc + desc}'
    # The sun over the i, in place of its dot (owner, 2026-11-09, reversing board answer 4).
    # Position and size from the earlier sun-dot wordmark (archive/yi/wordmark.svg).
    i_sun = circle(1292.5, -1222, 180)
    i_sun_d = whole(to_d(i_sun, 1))

    # Lockup for the OG image: plain mark (OG is large, but the lockup never carries the letter).
    k = (leaf.FULL_BOX[3] - leaf.FULL_BOX[1]) / (asc + desc)
    gap = 0.3 * (leaf.FULL_BOX[2] - leaf.FULL_BOX[0])
    wx = leaf.FULL_BOX[2] + gap - x0 * k
    base = leaf.FULL_BOX[1] + asc * k
    total_w = leaf.FULL_BOX[2] - leaf.FULL_BOX[0] + gap + (x1 - x0) * k
    vb_lock = f'{leaf.FULL_BOX[0]:g} {leaf.FULL_BOX[1]:g} {total_w:.2f} {leaf.FULL_BOX[3] - leaf.FULL_BOX[1]:g}'
    word = (f'<g transform="translate({wx:.2f} {base:.2f}) scale({k:.5f})">'
            f'<path fill="{leaf.GREEN}" d="{y_d}"/><path fill="{leaf.INK}" d="{rest_d}"/>'
            f'<path fill="{leaf.MARIGOLD}" d="{i_sun_d}"/></g>')
    w('lockup.svg', svg(vb_lock, mark_body(full, leaf.GREEN, letter=False) + word, 'Horizontal lockup, no letter.'))
    w('lockup-letter.svg', svg(vb_lock, mark_body(full, leaf.GREEN) + word,
                               'Horizontal lockup with the letter, for large uses such as the OG image.'))
    w('wordmark.svg', svg(vb_wm, f'<path fill="{leaf.GREEN}" d="{y_d}"/><path fill="{leaf.INK}" d="{rest_d}"/>'
                          f'<path fill="{leaf.MARIGOLD}" d="{i_sun_d}"/>',
                          'Wordmark, Fraunces outlined. Green y, marigold sun on the i.'))

    d, adv, upm = text_path(TAGLINE, NEWSREADER, 400)
    w('og-tagline.svg', svg(f'0 {-upm} {adv} {upm * 1.3:g}', f'<path d="{whole(d)}"/>',
                            f'Tagline "{TAGLINE}" in Newsreader 400, outlined. Units: {upm} to the em.'))

    ts = f"""// Generated by scripts/brand/flatten.py from scripts/brand/leaf.py. Do not edit by hand.
// The leaf logo as plain filled paths: the gap and the lines are holes, so the page shows
// through them on any theme. The header drawings (SMALL_MARK, WORDMARK) ship only in the
// index.html sprite; this file is the reference the tests check the sprite against.
// FULL_MARK ships through LogoMark.tsx, outside the landing's entry.

/** Small drawing, 17 to 48px: two lines, no letter. A square box, the drawing centred. */
export const SMALL_MARK = {{
  viewBox: '{leaf.box_viewbox(leaf.SMALL_BOX)}',
  sun: '{compact(to_d(small['sun']), 2)}',
  leaf: '{compact(to_d(small['leaf']), 2)}',
}} as const;

/** Full drawing, 49px and up. The letter shows only from 128px (owner, 2026-11-09). */
export const FULL_MARK = {{
  viewBox: '{leaf.box_viewbox(leaf.FULL_BOX)}',
  sun: '{compact(to_d(full['sun']), 1)}',
  leaf: '{compact(to_d(full['leaf']), 1)}',
  letter: '{compact(to_d(full['letter']), 1)}',
}} as const;

/** Wordmark, Fraunces outlined: "y" green, the rest ink, a marigold sun on the i.
 * Ascender to descender. */
export const WORDMARK = {{
  viewBox: '{vb_wm}',
  y: '{compact(y_d)}',
  rest: '{compact(rest_d)}',
  sun: '{compact(i_sun_d)}',
}} as const;

/** The one fixed colour in the logo. Everything else follows theme tokens. */
export const MARIGOLD = '{leaf.MARIGOLD}';
"""
    open(TS_OUT, 'w', encoding='utf-8', newline='\n').write(ts)

    # The sprite in index.html: the header drawings, once, outside #root. The landing
    # shell and Logo.tsx both draw them with <use>, so the header logo costs no JS and
    # the two cannot differ. Colours come from classes in index.html's <style>.
    m = lambda d: f'<path fill="{leaf.MARIGOLD}" d="{d}"/>'
    sprite = (f'{SPRITE_START}<svg class="logo-sprite" aria-hidden="true" focusable="false"><defs>'
              f'<g id="yidhan-mark-small">{m(compact(to_d(small["sun"]), 2))}'
              f'<path class="logo-leaf" d="{compact(to_d(small["leaf"]), 2)}"/></g>'
              f'<g id="yidhan-wordmark"><path class="logo-leaf" d="{compact(y_d)}"/>'
              f'<path class="logo-ink" d="{compact(rest_d)}"/>{m(compact(i_sun_d))}</g>'
              f'</defs></svg>{SPRITE_END}')
    html = open(INDEX_HTML, encoding='utf-8', newline='').read()
    a, b = html.index(SPRITE_START), html.index(SPRITE_END) + len(SPRITE_END)
    open(INDEX_HTML, 'w', encoding='utf-8', newline='').write(html[:a] + sprite + html[b:])
    print('wrote', TS_OUT, 'and', len([f for f in os.listdir(EXPORT) if f.endswith('.svg')]), 'svg files in', EXPORT)


if __name__ == '__main__':
    main()
