# Outlines the Yidhan wordmark from Fraunces.
# Needs: pip install fonttools brotli uharfbuzz
# Font: the "full" variable file from the @fontsource-variable/fraunces npm package
#   (fraunces-latin-full-normal.woff2). Fraunces is SIL OFL.
# Usage: python3 scripts/brand/wordmark.py <fraunces-full.woff2> <out-prefix>
#   Writes <out-prefix>.ttf (static instance) and <out-prefix>.json (outlines + metrics).
import sys, uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen
src, out = sys.argv[1], sys.argv[2]
loc = {'wght':440,'SOFT':100,'opsz':72,'WONK':0}
f = TTFont(src)
axes = {a.axisTag for a in f['fvar'].axes}
inst = instantiateVariableFont(f, {k:v for k,v in loc.items() if k in axes})
inst.flavor = None
inst.save(out+'.ttf')
print('has dotless', 0x131 in inst.getBestCmap())
upm = inst['head'].unitsPerEm
blob = hb.Blob.from_file_path(out+'.ttf'); face = hb.Face(blob); font = hb.Font(face)
buf = hb.Buffer(); buf.add_str('yıdhan'); buf.guess_segment_properties()
hb.shape(font, buf, {'kern':True,'liga':True})
gs = inst.getGlyphSet(); order = inst.getGlyphOrder()
x = 0; parts = []; boxes = []
for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
    name = order[info.codepoint]
    pen = SVGPathPen(gs)
    gs[name].draw(TransformPen(pen, (1,0,0,-1,x+pos.x_offset, -pos.y_offset)))
    parts.append(pen.getCommands())
    bp = BoundsPen(gs); gs[name].draw(bp); b = bp.bounds
    boxes.append((name, b and (b[0]+x, b[1], b[2]+x, b[3])))
    x += pos.x_advance
os2 = inst['OS/2']
print('upm',upm,'advance',x,'xHeight',os2.sxHeight,'cap',os2.sCapHeight)
for n,b in boxes: print(n,b)
open(out+'.json','w').write(__import__('json').dumps({'upm':upm,'adv':x,'xh':os2.sxHeight,'d':' '.join(parts),'boxes':boxes}))
