# Builds every SVG in images/brand/ from the mark geometry and the wordmark outlines.
# Usage: python3 scripts/brand/brand.py images/brand/review/wordmark-outlines.json images/brand
import json, sys, os
j = json.load(open(sys.argv[1])); OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
WD = j['d']; ADV = j['adv']
DOT = dict(cx=1327.5, cy=-1222, r=180)          # sun dot over the dotless i stem
ASC, DESC = 1476, 478                           # Fraunces ascender / y descender at this instance
INK, WARM, SUN, LEAF, LEAF_DARK, EVER = '#13261D', '#F2F0E6', '#F2A21B', '#2F9461', '#3FAE73', '#10241B'
ARCH = 'M150 166 V100 A50 50 0 0 0 50 100 V128'
CURL = 'M100 166 V106 A19 19 0 0 0 81 87 A13.5 13.5 0 0 0 67.5 100.5 A9 9 0 0 0 76.5 109.5 A5 5 0 0 0 81.5 104.5'
LEAVES = 'M100 154 A28 28 0 0 1 68 140 A28 28 0 0 1 100 154 M100 154 A28 28 0 0 0 132 140 A28 28 0 0 0 100 154'
def mark(sun, leaf):
    return (f'<g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="12">'
            f'<path stroke="{sun}" d="{ARCH}"/><path stroke="{leaf}" d="{CURL}"/>'
            f'<path stroke="{leaf}" fill="{leaf}" d="{LEAVES}"/></g>')
def word(ink):
    return f'<path fill="{ink}" d="{WD}"/><circle fill="{SUN}" cx="{DOT["cx"]}" cy="{DOT["cy"]}" r="{DOT["r"]}"/>'
def svg(vb, body, note):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}">\n  <!-- {note} -->\n  {body}\n</svg>\n'
def w(name, s): open(os.path.join(OUT, name), 'w').write(s)

# Mark: content spans x 44..156, y 44..172 of the 200 grid. Keep the 200 box as clear space.
w('mark.svg', svg('0 0 200 200', mark(SUN, LEAF), 'Yidhan mark for light grounds. 200 grid, 12-unit line, filled leaves.'))
w('mark-on-dark.svg', svg('0 0 200 200', mark(SUN, LEAF_DARK), 'Yidhan mark for dark grounds.'))
w('mark-mono.svg', svg('0 0 200 200', mark('currentColor', 'currentColor'), 'One-colour mark; takes currentColor.'))

# Wordmark: Fraunces, wght 440, SOFT 100, opsz 72, outlined. Baseline at y=0.
pad = 120
vbw = f'{-pad} {-ASC-pad} {ADV+2*pad} {ASC+DESC+2*pad}'
w('wordmark.svg', svg(vbw, word(INK), 'Wordmark: Fraunces (SIL OFL) outlined, sun dot on the i.'))
w('wordmark-on-dark.svg', svg(vbw, word(WARM), 'Wordmark for dark grounds.'))

# Horizontal lockup: mark content height = ascender to 100 below baseline.
top, bot = -ASC - 60, 200
s = (bot - top) / 128.0                 # font units per grid unit
mx = -156 * s - 560                     # mark right edge sits 560 units (0.28em) left of the text
my = top - 44 * s
lock = lambda sun, leaf, ink: f'<g transform="translate({mx:.1f} {my:.1f}) scale({s:.4f})">{mark(sun, leaf)}</g>{word(ink)}'
left = mx + 44 * s
vbl = f'{left - pad:.0f} {top - pad:.0f} {ADV - left + 2 * pad:.0f} {max(bot, DESC) - top + 2 * pad:.0f}'
w('lockup.svg', svg(vbl, lock(SUN, LEAF, INK), 'Horizontal lockup, light grounds.'))
w('lockup-on-dark.svg', svg(vbl, lock(SUN, LEAF_DARK, WARM), 'Horizontal lockup, dark grounds.'))

# Stacked lockup: mark centred over the wordmark.
ms = 2.2 * (ASC + DESC) / 200            # mark box about 2.6x the text height
mbx = ADV / 2 - 100 * ms; mby = (-ASC - 380) - 172 * ms
stack = lambda sun, leaf, ink: f'<g transform="translate({mbx:.1f} {mby:.1f}) scale({ms:.4f})">{mark(sun, leaf)}</g>{word(ink)}'
st_top = mby + 44 * ms
vbs = f'{-pad} {st_top - pad:.0f} {ADV + 2 * pad} {DESC - st_top + 2 * pad:.0f}'
w('lockup-stacked.svg', svg(vbs, stack(SUN, LEAF, INK), 'Stacked lockup, light grounds.'))
w('lockup-stacked-on-dark.svg', svg(vbs, stack(SUN, LEAF_DARK, WARM), 'Stacked lockup, dark grounds.'))

# App icon: evergreen tile with faint marigold glow. Mark sits inside the maskable 80% safe zone.
glow = ('<defs><radialGradient id="glow" cx="100" cy="30" r="150" gradientUnits="userSpaceOnUse">'
        '<stop offset="0" stop-color="#F2A21B" stop-opacity=".18"/><stop offset="1" stop-color="#F2A21B" stop-opacity="0"/></radialGradient></defs>')
tile = f'{glow}<rect width="200" height="200" fill="#163026"/><rect width="200" height="200" fill="url(#glow)"/>'
w('app-icon.svg', svg('0 0 200 200', f'{tile}<g transform="translate(26 22) scale(.74)">{mark(SUN, LEAF_DARK)}</g>', 'App icon, full bleed. Launchers apply their own mask.'))
# Android adaptive icon foreground: 108dp canvas, 66dp safe circle -> mark at 0.6 scale.
w('android-foreground.svg', svg('0 0 200 200', f'<g transform="translate(40 37) scale(.6)">{mark(SUN, LEAF_DARK)}</g>', 'Android adaptive icon foreground. Background layer: #163026.'))
# Favicon: bare mark, cropped tight so it uses every pixel.
w('favicon.svg', svg('34 41 132 132', mark(SUN, LEAF), 'Favicon: bare mark, tight crop.'))
# Seal for round places.
w('seal.svg', svg('0 0 200 200', '<defs><clipPath id="disc"><circle cx="100" cy="100" r="88"/></clipPath></defs>'
  f'<g clip-path="url(#disc)"><rect width="200" height="200" fill="#F2A21B"/><path d="M0 160 C60 146 140 146 200 160 V200 H0Z" fill="#2F9461"/>'
  f'<g transform="translate(16 8) scale(.84)">{mark("#FFF9EA", EVER)}</g></g>', 'Sunrise seal: avatar, sticker, share image.'))
print('ok')
