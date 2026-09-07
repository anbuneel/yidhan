"""Prepare the build-only preview font. Requires fonttools[woff] (regeneration only)."""

from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "src/assets/fonts/source-sans-3-latin.woff2"
OUTPUT = ROOT / "scripts/assets/fonts/yidhan-preview.ttf"

# Pin the tagline's light weight. A unique family prevents an installed Source
# Sans version from taking precedence in Pango/Fontconfig. The modified font's
# family avoids the upstream reserved name, while retaining copyright/license.
font = instantiateVariableFont(TTFont(SOURCE), {"wght": 300}, inplace=True)
font.flavor = None
names = {
    1: "Yidhan Preview", 2: "Regular", 3: "Yidhan Preview 1.0",
    4: "Yidhan Preview", 6: "YidhanPreview", 16: "Yidhan Preview", 17: "Regular",
}
for record in font["name"].names:
    if record.nameID in names:
        record.string = names[record.nameID].encode(record.getEncoding())
license_text = (ROOT / "public/licenses/fonts/source-sans-3-OFL.txt").read_text(encoding="utf-8")
font["name"].setName(license_text, 13, 3, 1, 0x409)
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
font.save(OUTPUT)
print(f"Prepared {OUTPUT.relative_to(ROOT)} from {SOURCE.relative_to(ROOT)} at weight 300")
