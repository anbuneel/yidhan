# Outlines a string from a static Fraunces instance, for the round-three icons.
# Needs: pip install fonttools brotli uharfbuzz
# Usage: python3 scripts/brand/glyphs.py <fraunces-full.woff2> <text> <wght> <opsz> <out.json>
#   Round three used: "yı" 560 24 and "y" 560 24.
# Outline a string from a Fraunces instance. Usage: glyphs.py font.woff2 text wght opsz out.json
import sys, json, uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen
src, text, wght, opsz, out = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4]), sys.argv[5]
f = TTFont(src); inst = instantiateVariableFont(f, {'wght': wght, 'SOFT': 100, 'opsz': opsz, 'WONK': 0}); inst.flavor = None
tmp = out + '.ttf'; inst.save(tmp)
font = hb.Font(hb.Face(hb.Blob.from_file_path(tmp)))
buf = hb.Buffer(); buf.add_str(text); buf.guess_segment_properties(); hb.shape(font, buf, {'kern': True})
gs = inst.getGlyphSet(); order = inst.getGlyphOrder(); x = 0; glyphs = []
for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
    n = order[info.codepoint]; pen = SVGPathPen(gs); gs[n].draw(TransformPen(pen, (1, 0, 0, -1, x, 0)))
    bp = BoundsPen(gs); gs[n].draw(bp); b = bp.bounds
    glyphs.append({'name': n, 'd': pen.getCommands(), 'box': [b[0] + x, -b[3], b[2] + x, -b[1]]}); x += pos.x_advance
json.dump({'adv': x, 'xh': inst['OS/2'].sxHeight, 'glyphs': glyphs}, open(out, 'w'))
print(text, [(g['name'], [round(v) for v in g['box']]) for g in glyphs])
