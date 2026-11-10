"""Download and trim the self-hosted fonts in src/assets/fonts/.

Run by hand when a font changes, then commit the output:

    pip install fonttools brotli
    python scripts/build-fonts.py

It fetches the woff2 subsets Google Fonts serves (one file per unicode-range
subset), then pins the optical-size axis and narrows the weight axis to cut
the file size. Full Newsreader latin is 129 KB roman and 143 KB italic; the
first-visit budget (scripts/bundle-budget.json) has room for about a third of
that. The browser never fetches from Google: this script runs once, offline
from the app.

The unicode-range for each output file is printed so src/fonts.css can be
checked against it. Licences: public/licenses/fonts/.
"""

import io
import re
import sys
import urllib.request
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

OUT = Path(__file__).resolve().parent.parent / "src" / "assets" / "fonts"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"

# Text optical size. Newsreader's default is 18; titles lose their display
# cut, which was the price of fitting the budget.
OPSZ = 18
WEIGHTS = (400, 700)

FAMILIES = [
    # (file prefix, Google Fonts css2 query, subsets to keep or None for all, trim?)
    ("newsreader", "Newsreader:ital,opsz,wght@0,6..72,200..800;1,6..72,200..800", None, True),
    ("courier-prime", "Courier+Prime:ital,wght@0,400;0,700;1,400", None, False),
    # Literata is only the Cyrillic and Greek fallback for Newsreader.
    (
        "literata",
        "Literata:ital,opsz,wght@0,7..72,200..900;1,7..72,200..900",
        {"cyrillic", "cyrillic-ext", "greek", "greek-ext"},
        True,
    ),
]


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req) as res:
        return res.read()


def variant(prefix: str, style: str, weight: str) -> str:
    if prefix == "courier-prime":
        if style == "italic":
            return "italic"
        return {"400": "regular", "700": "bold"}[weight]
    return "roman" if style == "normal" else "italic"


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    for prefix, query, keep, trim in FAMILIES:
        css = fetch(f"https://fonts.googleapis.com/css2?family={query}&display=swap").decode()
        for m in re.finditer(r"/\* ([\w-]+) \*/\s*@font-face \{(.*?)\}", css, re.S):
            subset, body = m.group(1), m.group(2)
            if keep and subset not in keep:
                continue
            style = re.search(r"font-style: (\w+)", body).group(1)
            weight = re.search(r"font-weight: ([\d ]+);", body).group(1).strip()
            url = re.search(r"url\((.*?)\)", body).group(1)
            urange = re.search(r"unicode-range: (.*?);", body).group(1)
            font = TTFont(io.BytesIO(fetch(url)))
            if trim:
                font = instantiateVariableFont(font, {"opsz": OPSZ, "wght": WEIGHTS})
            font.flavor = "woff2"
            name = f"{prefix}-{variant(prefix, style, weight)}-{subset}.woff2"
            font.save(OUT / name)
            print(f"{name}  {(OUT / name).stat().st_size} B  {urange}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
