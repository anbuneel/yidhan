# Builds every SVG in images/brand/ from the outlined Fraunces glyphs and the sprout geometry.
# Inputs come from scripts/brand/wordmark.py (the wordmark) and scripts/brand/glyphs.py (the icon letters):
#   python3 scripts/brand/glyphs.py <fraunces-full.woff2> "yı" 560 24 images/brand/source/yi.json
#   python3 scripts/brand/glyphs.py <fraunces-full.woff2> "yı" 620 9  images/brand/source/yi16.json
# Usage: python3 scripts/brand/brand.py images/brand/source images/brand
import json, os, sys
SRC, OUT = sys.argv[1], sys.argv[2]
wm = json.load(open(os.path.join(SRC, 'wordmark.json')))
yi = json.load(open(os.path.join(SRC, 'yi.json')))
yi16 = json.load(open(os.path.join(SRC, 'yi16.json')))
os.makedirs(os.path.join(OUT, 'artwork'), exist_ok=True)
INK, WARM, SUN, LEAF, LEAF_DARK, EVER, TILE = '#13261D', '#F2F0E6', '#F2A21B', '#2F9461', '#3FAE73', '#10241B', '#163026'

def svg(vb, body, note):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}">\n  <!-- {note} -->\n  {body}\n</svg>\n'
def w(name, s):
    open(os.path.join(OUT, name), 'w').write(s)

# Wordmark: Fraunces wght 440, SOFT 100, opsz 72, outlined. Baseline at y=0.
# The sun sits on the optical centre of the i (35 units left of the stem centre, clear of the d).
ASC, DESC, PAD = 1476, 478, 120
DOT = (1292.5, -1222, 180)
vb = f'{-PAD} {-ASC - PAD} {wm["adv"] + 2 * PAD} {ASC + DESC + 2 * PAD}'
word = lambda ink: f'<path fill="{ink}" d="{wm["d"]}"/><circle fill="{SUN}" cx="{DOT[0]}" cy="{DOT[1]}" r="{DOT[2]}"/>'
w('wordmark.svg', svg(vb, word(INK), 'Yidhan wordmark: Fraunces (SIL OFL) outlined, with a marigold sun as the dot on the i.'))
w('wordmark-on-dark.svg', svg(vb, word(WARM), 'Yidhan wordmark for dark grounds.'))

# App icon: "yi" from the wordmark. Stem centre measured in the 560/24 cut at 1463 (bbox 1199..1710).
def yi_letters(j, dot, i_shift, target_h, cy=100, cx=100):
    gy, gi = j['glyphs']
    st = gi['box'][2] - gi['box'][0]
    sx = gi['box'][0] + (1463 - 1199) / (1710 - 1199) * st + i_shift - 35
    r = dot * 266 / 2
    sun = (sx, gi['box'][1] - 140 - r, r)
    x0, x1 = gy['box'][0], max(gi['box'][2] + i_shift, sun[0] + r)
    y0, y1 = sun[1] - r, gy['box'][3]
    s = target_h / (y1 - y0)
    tx, ty = cx - s * (x0 + x1) / 2, cy - s * (y0 + y1) / 2
    return (f'<g transform="translate({tx:.2f} {ty:.2f}) scale({s:.5f})"><path fill="{WARM}" d="{gy["d"]}"/>'
            f'<path fill="{WARM}" transform="translate({i_shift} 0)" d="{gi["d"]}"/>'
            f'<circle fill="{SUN}" cx="{sun[0]:.1f}" cy="{sun[1]:.1f}" r="{r:.1f}"/></g>')
tile = lambda rx=0: f'<rect width="200" height="200" rx="{rx}" fill="{TILE}"/>'
w('app-icon.svg', svg('0 0 200 200', tile() + yi_letters(yi, 1.5, 0, 142, cy=95),
  'App icon: "yi" on an evergreen tile, full bleed. Launchers apply their own mask.'))
w('android-foreground.svg', svg('0 0 200 200', yi_letters(yi, 1.5, 0, 100, cy=96),
  'Android adaptive icon foreground: letters inside the 72dp visible area. Background layer: ' + TILE + '.'))
# Favicon: a separate drawing for 16-48 px. Heavier small-size cut, wider y-i gap, bigger dot.
# One tile on every tab colour; a bare favicon disappears on dark tab bars.
w('favicon.svg', svg('0 0 200 200', tile(28) + yi_letters(yi16, 1.75, 110, 160, cy=99),
  'Favicon, drawn for 16-48 px. Use on light and dark tabs alike.'))

# Secondary artwork: the sprout under the sun, built on the Tamil letter i. Not the logo.
ARCH = 'M150 166 V100 A50 50 0 0 0 50 100 V126'
CURL = 'M112 156 V108 A20 20 0 0 0 92 88 A13 13 0 0 0 79 101 A12 12 0 0 0 91 113'
LEAF_L = 'M112 158 Q 96 162 82 154 Q 72 148 66 136 Q 82 132 96 140 Q 106 147 112 158 Z'
LEAF_R = 'M112 158 Q 122 146 132 141 Q 140 137 146 138 Q 142 150 134 156 Q 124 162 112 158 Z'
def sprout(sun, leaf):
    return (f'<g stroke-linecap="round" stroke-linejoin="round"><path fill="none" stroke="{sun}" stroke-width="12" d="{ARCH}"/>'
            f'<path fill="none" stroke="{leaf}" stroke-width="12" d="{CURL}"/><path fill="{leaf}" d="{LEAF_L}"/><path fill="{leaf}" d="{LEAF_R}"/></g>')
w('artwork/sprout.svg', svg('0 0 200 200', sprout(SUN, LEAF), 'Secondary artwork: sprout under the sun (Tamil letter i). Splash, empty states, About.'))
w('artwork/sprout-on-dark.svg', svg('0 0 200 200', sprout(SUN, LEAF_DARK), 'Secondary artwork for dark grounds.'))
w('artwork/sprout-mono.svg', svg('0 0 200 200', sprout('currentColor', 'currentColor'), 'Secondary artwork, one colour; takes currentColor.'))
w('artwork/seal.svg', svg('0 0 200 200', '<defs><clipPath id="disc"><circle cx="100" cy="100" r="88"/></clipPath></defs>'
  f'<g clip-path="url(#disc)"><rect width="200" height="200" fill="{SUN}"/><path d="M0 160 C60 146 140 146 200 160 V200 H0Z" fill="{LEAF}"/>'
  f'<g transform="translate(16 8) scale(.84)">{sprout("#FFF9EA", EVER)}</g></g>', 'Sunrise seal: avatar, sticker, share image.'))
print('ok')
