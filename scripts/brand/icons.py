# Builds the round-three icon candidates (yi, y with sun above, y with sun between the arms).
# Usage: python3 scripts/brand/icons.py yi.json y.json images/logo-concepts-out
#   Writes <name>-icon.svg (full tile), <name>-adaptive.svg (Android safe zone), <name>-bare.svg (favicon).
# Builds the round-three icon candidates. Usage: icons.py yi.json y.json outdir
import json, sys, os
yi, y, OUT = json.load(open(sys.argv[1])), json.load(open(sys.argv[2])), sys.argv[3]
EVER, WARM, INK, SUN = '#10241B', '#F2F0E6', '#13261D', '#F2A21B'
def build(glyphs, sun, target_h, ink):
    xs = [g['box'][0] for g in glyphs] + [g['box'][2] for g in glyphs] + [sun[0] - sun[2], sun[0] + sun[2]]
    ys = [g['box'][1] for g in glyphs] + [g['box'][3] for g in glyphs] + [sun[1] - sun[2], sun[1] + sun[2]]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    s = target_h / (y1 - y0)
    tx, ty = 100 - s * (x0 + x1) / 2, 100 - s * (y0 + y1) / 2
    d = ' '.join(g['d'] for g in glyphs)
    return (f'<g transform="translate({tx:.2f} {ty:.2f}) scale({s:.5f})"><path fill="{ink}" d="{d}"/>'
            f'<circle fill="{SUN}" cx="{sun[0]}" cy="{sun[1]}" r="{sun[2]}"/></g>')
cands = {
  'yi':        (yi['glyphs'], (1463, -1328, 230)),
  'y-cradle':  (y['glyphs'],  (645, -700, 118)),
  'y-above':   (y['glyphs'],  (590, -1190, 205)),
}
for name, (gl, sun) in cands.items():
    tile = f'<rect width="200" height="200" fill="{EVER}"/>'
    open(os.path.join(OUT, f'{name}-icon.svg'), 'w').write(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">{tile}{build(gl, sun, 118, WARM)}</svg>\n')
    open(os.path.join(OUT, f'{name}-adaptive.svg'), 'w').write(   # Android safe zone: content inside r=61
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">{tile}{build(gl, sun, 92, WARM)}</svg>\n')
    open(os.path.join(OUT, f'{name}-bare.svg'), 'w').write(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">{build(gl, sun, 176, INK)}</svg>\n')
print('ok')
