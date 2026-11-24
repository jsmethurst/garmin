#!/usr/bin/env python3
"""Adds icons that are newer than the 4.9.95 library (from @mdi/svg 7.4.47, Apache-2.0) to site/fonts/mdi-icons.woff2 and site/js/mdiall.js.

  python3 tools/add-mdi-extras.py     # run it again after tools/gen-mdi.py, which rebuilds both files from 4.9.95 only

Each extra gets a private-use code point (U+E001 ...), so it can never clash with a library icon. Needs: pip install fonttools brotli.
"""
import io, json, os, re, tarfile, urllib.request
from fontTools.ttLib import TTFont
from fontTools.svgLib.path import parse_path
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.cu2quPen import Cu2QuPen

SVG_VER = '7.4.47'
EXTRAS = [('stairs-up', 0xE001, 'floors climbed stairs arrow')]   # (name, code point, search words)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(ROOT, 'site/fonts/mdi-icons.woff2'); LIST = os.path.join(ROOT, 'site/js/mdiall.js')

url = 'https://registry.npmjs.org/@mdi/svg/-/svg-%s.tgz' % SVG_VER
with urllib.request.urlopen(url, timeout=120) as r:
    tar = tarfile.open(fileobj=io.BytesIO(r.read()), mode='r:gz')

font = TTFont(FONT); gs = font.getGlyphSet(); order = font.getGlyphOrder(); cmap = font['cmap'].getBestCmap()
upm = font['head'].unitsPerEm; k = upm / 24.0          # the glyphs are drawn on a 24 grid; the library puts the ink's left edge at x = 0 and the grid's y = 21 on the baseline
rows = open(LIST, encoding='utf-8').read().split('\n')
for name, cp, words in EXTRAS:
    svg = tar.extractfile('package/svg/%s.svg' % name).read().decode()
    d = re.search(r' d="([^"]+)"', svg).group(1)
    tmp = BoundsPen(None); parse_path(d, tmp); x0 = tmp.bounds[0]
    gname = 'uni%04X' % cp
    pen = TTGlyphPen(None)
    parse_path(d, TransformPen(Cu2QuPen(pen, 1.0, reverse_direction=True), (k, 0, 0, -k, -x0 * k, 21 * k)))   # (y flips, so the contour direction flips back)
    if gname not in font['glyf'].glyphs:
        order.append(gname); font.setGlyphOrder(order)
    font['glyf'][gname] = pen.glyph(); font['hmtx'][gname] = (upm, 0)
    for t in font['cmap'].tables:
        if t.isUnicode() and (t.format in (4, 12)): t.cmap[cp] = gname
    row = '["%s",%d,[],"%s"],' % (name, cp, words)
    if not any(r.startswith('["%s",' % name) for r in rows):
        i = next(n for n, r in enumerate(rows) if r.startswith('["') and r[2:r.index('"', 2)] > name)
        rows.insert(i, row)
font.flavor = 'woff2'; font.save(FONT)
open(LIST, 'w', encoding='utf-8').write('\n'.join(rows))
print('added', [e[0] for e in EXTRAS])
