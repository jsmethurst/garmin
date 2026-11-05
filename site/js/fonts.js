/* Fonts: Garmin system fonts (approximate preview) + custom bitmap fonts rasterised from bundled / uploaded TTF.
   Preview and export share the exact same glyph metrics, so what you see is what the .fnt contains. */
(function (GW) {
  'use strict';
  var K = GW.SIZE / 260; // system-font boxes were measured on a 260px fenix 6; scaled to the screen of the selected watch

  // [constant, box height @260, kind]   kind: 't' text face, 'n' number face
  GW.SYS_FONTS = [
    ['FONT_XTINY', 12, 't'], ['FONT_TINY', 15, 't'], ['FONT_SMALL', 18, 't'], ['FONT_MEDIUM', 21, 't'], ['FONT_LARGE', 23, 't'],
    ['FONT_NUMBER_MILD', 30, 'n'], ['FONT_NUMBER_MEDIUM', 36, 'n'], ['FONT_NUMBER_HOT', 49, 'n'], ['FONT_NUMBER_THAI_HOT', 57, 'n']
  ];
  var SYS = {};
  GW.rebuildSysFonts = function () {
    K = GW.SIZE / 260;
    GW.SYS_FONTS.forEach(function (f) {
      SYS[f[0]] = { box: f[1] * K, px: Math.round(f[1] * K * (f[2] === 'n' ? 1.47 : 1.25)), weight: f[2] === 'n' ? 700 : 500, family: 'Rajdhani' };
    });
  };
  GW.rebuildSysFonts();
  GW.sysFont = function (id) { return SYS[id]; };
  GW.isSysFont = function (id) { return !!SYS[id]; };

  // Bundled families (self-hosted woff2 in /fonts)
  GW.FONT_FAMILIES = [
    { family: 'Rajdhani', weights: [300, 400, 500, 600, 700] },
    { family: 'Orbitron', weights: [400, 500, 700, 900] },
    { family: 'Michroma', weights: [400], note: 'Eurostile-style' },
    { family: 'Aldrich', weights: [400], note: 'Eurostile-style' },
    { family: 'Exo 2', weights: [300, 400] },
    { family: 'Share Tech Mono', weights: [400] },
    { family: 'Bebas Neue', weights: [400] },
    { family: 'Oxanium', weights: [300, 400, 500, 600] },
    { family: 'Chakra Petch', weights: [300, 400, 500, 600] },
    { family: 'Press Start 2P', weights: [400] },
    { family: 'Libre Baskerville', weights: [700] },
    { family: 'Spectral', weights: [700] },
    { family: 'Source Serif 4', weights: [700] },
    { family: 'DM Sans', weights: [300, 400, 500, 600, 700] }
  ];
  GW.GLYPH_SETS = {
    nums: { label: 'Digits 0-9 only (smallest)', chars: '0123456789' },
    digits: { label: 'Digits + : . - + % ° /', chars: ' 0123456789:.-+%°/' },
    basic: { label: 'Digits + A-Z + Turkish capitals', chars: ' 0123456789:.-+%°/ABCDEFGHIJKLMNOPQRSTUVWXYZÇĞİŞÖÜ' },
    full: { label: 'Full ASCII + ° + Turkish letters', chars: (function () { var s = ''; for (var i = 32; i < 127; i++) s += String.fromCharCode(i); return s + '°ÇĞİŞÖÜçğıöşü'; })() }
  };

  Object.defineProperty(GW.GLYPH_SETS, 'tr', { value: GW.GLYPH_SETS.basic, enumerable: false }); // older designs used this id for the Turkish set

  // ---------- ensure web fonts are loaded before drawing ----------
  GW.fontsReady = function () {
    var jobs = [];
    GW.FONT_FAMILIES.forEach(function (f) {
      f.weights.forEach(function (w) { jobs.push(document.fonts.load(w + ' 20px "' + f.family + '"')); jobs.push(document.fonts.load(w + ' 20px "' + f.family + '"', 'İŞĞÜ')); });
    });
    return Promise.all(jobs).catch(function () { });
  };
  // `weight` is the weight the font FILE has (400 for a Regular, 300 for a Light ...); registering it explicitly means the browser matches the
  // face exactly instead of inventing a bolder or lighter one.
  GW.registerUploadedFont = function (family, dataUrl, weight) {
    var face = new FontFace(family, 'url(' + dataUrl + ')', { weight: String(weight || 400) });
    return face.load().then(function (f) { document.fonts.add(f); return f; });
  };

  GW.previewFonts = {}; // derived size variants of bitmap fonts
  GW.customFont = function (id) {
    var fs = GW.design.fonts;
    for (var i = 0; i < fs.length; i++) if (fs[i].id === id) return fs[i];
    return GW.previewFonts[id] || null;
  };
  // A text element can keep its typeface but use its own size: this derives (and registers) that variant and returns its id.
  GW.fontFor = function (el) {
    var f = GW.customFont(el.font), px = Math.round(el.fontSize || 0), cap = Math.round(el.capH || 0);
    if (f && cap > 0) px = GW.pxForCap(f.family, f.weight, cap);   // sized by cap height: the 'H' is exactly `cap` pixels tall
    if (!f || !px || px === f.px) return el.font;
    var id = f.id.replace(/_s\d+$/, '') + '_s' + px;
    GW.previewFonts[id] = Object.assign({}, f, { id: id, px: px });
    return id;
  };
  // The CSS size at which this typeface's capital 'H' is `cap` whole pixels tall, so horizontal stems land on pixel rows.
  var capCache = {};
  GW.pxForCap = function (family, weight, cap) {
    var k = family + '|' + weight + '|' + cap; if (capCache[k]) return capCache[k];
    var c = document.createElement('canvas').getContext('2d');
    function asc(px) { c.font = (weight || 400) + ' ' + px + 'px "' + family + '"'; return c.measureText('H').actualBoundingBoxAscent; }
    var ratio = asc(200) / 200 || 0.7, est = cap / ratio, best = Math.max(4, Math.round(est)), bd = 1e9;
    for (var px = Math.max(4, Math.floor(est) - 3); px <= Math.ceil(est) + 3; px++) {
      var a = asc(px), d = Math.abs(a - cap) + (Math.round(a) === cap ? 0 : 0.5);   // prefer a size whose measured height rounds to exactly `cap`
      if (d < bd - 1e-6) { bd = d; best = px; }
    }
    return (capCache[k] = best);
  };
  GW.fontCss = function (f) { return (f.weight || 400) + ' ' + f.px + 'px "' + f.family + '"'; };

  // ---------- glyph metrics (shared by preview + export) ----------
  var scratch = document.createElement('canvas').getContext('2d');
  var cache = {};
  function key(f) { return [f.family, f.weight, f.px, f.glyphs, f.spacing || 0, f.bold || 0, f.tabular ? 1 : 0, f.uniform ? 1 : 0].join('|'); }

  GW.fontMetrics = function (f) {
    var k = key(f);
    if (cache[k] && cache[k].ready) return cache[k];
    scratch.font = GW.fontCss(f);
    scratch.textBaseline = 'alphabetic'; scratch.textAlign = 'left';
    var chars = (GW.GLYPH_SETS[f.glyphs] || GW.GLYPH_SETS.digits).chars;
    var asc = 0, desc = 0, glyphs = {}, ok = true, hb = Math.ceil((f.bold || 0) / 2);   // f.bold: outline width that fattens a typeface without a bold cut
    for (var i = 0; i < chars.length; i++) {
      var ch = chars[i], m = scratch.measureText(ch);
      var x0 = Math.floor(-m.actualBoundingBoxLeft), x1 = Math.ceil(m.actualBoundingBoxRight);
      var y0 = Math.floor(-m.actualBoundingBoxAscent), y1 = Math.ceil(m.actualBoundingBoxDescent);
      var blank0 = ch === ' ' || (x1 <= x0 && y1 <= y0);
      if (!blank0) { x0 -= hb; x1 += hb; y0 -= hb; y1 += hb; }
      var blank = ch === ' ' || (x1 <= x0 && y1 <= y0);
      if (!blank) { asc = Math.max(asc, -y0); desc = Math.max(desc, y1); }
      glyphs[ch] = { code: ch.charCodeAt(0), x0: x0, y0: y0, w: blank ? 0 : Math.max(1, x1 - x0), h: blank ? 0 : Math.max(1, y1 - y0),
        adv: Math.max(1, Math.round(m.width + (f.spacing || 0))), blank: blank };
    }
    if (f.uniform) {   // uniform spacing: the ink of every glyph starts at the pen and the gap after it is the same, so "11" and "1." are spaced alike
      var gap = Math.max(1, Math.round(f.px * 0.1)) + (f.spacing || 0);
      Object.keys(glyphs).forEach(function (ch) { var g = glyphs[ch]; if (g.blank) return; g.dx = -g.x0; g.adv = Math.max(1, g.w + gap); });
    }
    if (f.tabular) {   // even digit widths: every digit gets the widest digit's cell, with its glyph centred in it (so the time never changes width)
      var W = 0, dg = '0123456789'.split('');
      dg.forEach(function (d) { if (glyphs[d]) W = Math.max(W, glyphs[d].adv); });
      dg.forEach(function (d) { var g = glyphs[d]; if (g) { g.dx = (g.dx || 0) + Math.round((W - g.adv) / 2); g.adv = W; } });
    }
    if (asc + desc === 0) { asc = Math.round(f.px * 0.75); desc = Math.round(f.px * 0.2); ok = false; }
    var res = { asc: asc, desc: desc, lineHeight: asc + desc, glyphs: glyphs, chars: chars, ready: ok };
    cache[k] = res;
    return res;
  };
  GW.fontCapHeight = function (f) {
    scratch.font = GW.fontCss(f);
    var m = scratch.measureText('H');
    return Math.round(m.actualBoundingBoxAscent);
  };

  // ---------- drawing text (preview) ----------
  // Returns the box {x,y,w,h} of the text; y is vertical CENTRE anchor, like TEXT_JUSTIFY_VCENTER on the watch.
  GW.layoutText = function (ctx, fontId, text, x, y, justify) {
    var w, h, sys = SYS[fontId], cf = !sys && GW.customFont(fontId);
    if (cf) {
      var met = GW.fontMetrics(cf);
      w = 0;
      for (var i = 0; i < text.length; i++) { var g = met.glyphs[text[i]]; w += g ? g.adv : Math.round(cf.px * 0.5); }
      h = met.lineHeight;
    } else {
      var s = sys || SYS.FONT_SMALL;
      ctx.save(); ctx.font = s.weight + ' ' + s.px + 'px "' + s.family + '"'; w = ctx.measureText(text).width; ctx.restore();
      h = s.box;
    }
    // the watch places text on whole pixels (halves are dropped), so the preview does too
    var left = justify === 'L' ? x : (justify === 'R' ? x - w : x - Math.floor(w / 2));
    return { x: left, y: Math.floor(y - h / 2), w: w, h: h };
  };

  // One glyph on its own cleared canvas, white on transparent, drawn at an integer pen origin. The atlas that is exported and the
  // "device-style edges" preview both use these, so what the preview shows is what the .png contains.
  var glyphCache = {};
  function quantize(c, levels) {   // the 64-colour screen has only a few steps of edge blending: snap the alpha to `levels` steps
    var x = c.getContext('2d'), im = x.getImageData(0, 0, c.width, c.height), d = im.data;
    for (var i = 3; i < d.length; i += 4) d[i] = Math.round(Math.round(d[i] / 255 * (levels - 1)) / (levels - 1) * 255);
    x.putImageData(im, 0, 0);
  }
  GW.glyphCanvas = function (f, ch, rot) {
    var met = GW.fontMetrics(f), g = met.glyphs[ch]; if (!g || g.blank) return null;
    var rinfo = rot ? GW.rotFontInfo(f, rot) : null, bb = rinfo ? rinfo.glyphs[ch] : null;
    var k = key(f) + '|' + ch + '|' + (f.aa || '') + '|' + (rot || 0); if (glyphCache[k]) return glyphCache[k];
    var c = document.createElement('canvas'); c.width = rinfo ? bb.w : g.w; c.height = rinfo ? bb.h : g.h;
    var x = c.getContext('2d');
    x.font = GW.fontCss(f); x.fillStyle = '#ffffff'; x.textBaseline = 'alphabetic'; x.textAlign = 'left';
    if (f.bold) { x.lineWidth = f.bold; x.lineJoin = 'round'; x.strokeStyle = '#ffffff'; }
    if (rinfo) { x.translate(-bb.bx, -bb.by); x.rotate(rot * Math.PI / 180); x.fillText(ch, g.dx || 0, 0); if (f.bold) x.strokeText(ch, g.dx || 0, 0); }
    else { x.fillText(ch, -g.x0, -g.y0); if (f.bold) x.strokeText(ch, -g.x0, -g.y0); }
    if (f.aa === 'mip') quantize(c, 4);
    return (glyphCache[k] = c);
  };
  var tintCache = {};
  function tinted(f, ch, color) {
    var k = key(f) + '|' + ch + '|' + color; if (tintCache[k]) return tintCache[k];
    var src = GW.glyphCanvas(f, ch), c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    var x = c.getContext('2d'); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    var ks = Object.keys(tintCache); if (ks.length > 400) delete tintCache[ks[0]];
    return (tintCache[k] = c);
  }
  GW.drawText = function (ctx, fontId, text, x, y, justify, color) {
    var b = GW.layoutText(ctx, fontId, text, x, y, justify), sys = SYS[fontId], cf = !sys && GW.customFont(fontId);
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    if (cf) {
      var met = GW.fontMetrics(cf);
      var cx = Math.round(b.x), base = Math.round(b.y) + met.asc;   // whole-pixel pen position and baseline, like the watch
      if (cf.aa === 'mip') {   // device-style edges: draw the very glyph images that go into the exported font
        ctx.save(); ctx.imageSmoothingEnabled = false;
        for (var j = 0; j < text.length; j++) {
          var gg = met.glyphs[text[j]];
          if (!gg) { cx += Math.round(cf.px * 0.5); continue; }
          if (!gg.blank) ctx.drawImage(tinted(cf, text[j], color), cx + (gg.dx || 0) + gg.x0, base + gg.y0);
          cx += gg.adv;
        }
        ctx.restore(); return b;
      }
      ctx.font = GW.fontCss(cf); ctx.textBaseline = 'alphabetic';
      for (var i = 0; i < text.length; i++) {
        var g = met.glyphs[text[i]];
        if (!g) { cx += Math.round(cf.px * 0.5); continue; }
        if (!g.blank) { var gx = cx + (g.dx || 0); ctx.fillText(text[i], gx, base); if (cf.bold) { ctx.lineWidth = cf.bold; ctx.lineJoin = 'round'; ctx.strokeStyle = color; ctx.strokeText(text[i], gx, base); } }
        cx += g.adv;
      }
    } else {
      var s = sys || SYS.FONT_SMALL;
      ctx.font = s.weight + ' ' + s.px + 'px "' + s.family + '"'; ctx.textBaseline = 'middle';
      ctx.fillText(text, b.x, y);
    }
    return b;
  };

  // Glyph images of a font turned clockwise by `deg` (used for the rotated export). Offsets are measured from the pen origin on the baseline;
  // `base` / `lm` shift that origin so no offset is negative.
  GW.rotFontInfo = function (f, deg) {
    var met = GW.fontMetrics(f), a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), minX = 0, minY = 0, maxY = 0, glyphs = {};
    met.chars.split('').forEach(function (ch) {
      var g = met.glyphs[ch];
      if (g.blank) { glyphs[ch] = { blank: true, w: 0, h: 0, bx: 0, by: 0 }; return; }
      var gx0 = g.x0 + (g.dx || 0), pts = [[gx0, g.y0], [gx0 + g.w, g.y0], [gx0 + g.w, g.y0 + g.h], [gx0, g.y0 + g.h]].map(function (p) { return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]; });
      var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
      var bx = Math.floor(Math.min.apply(null, xs)) - 1, by = Math.floor(Math.min.apply(null, ys)) - 1;
      var bx2 = Math.ceil(Math.max.apply(null, xs)) + 1, by2 = Math.ceil(Math.max.apply(null, ys)) + 1;
      glyphs[ch] = { bx: bx, by: by, w: bx2 - bx, h: by2 - by };
      minX = Math.min(minX, bx); minY = Math.min(minY, by); maxY = Math.max(maxY, by2);
    });
    return { glyphs: glyphs, base: -minY, lm: -minX, lineHeight: -minY + maxY };
  };

  // ---------- export: rasterise to BMFont (.fnt text + .png atlas) ----------
  GW.rasterizeFont = function (f) {
    var met = GW.fontMetrics(f), chars = met.chars, size = 128, placed, atlas, rot = f.rot ? GW.rotFontInfo(f, f.rot) : null;
    function box(ch) { var g = met.glyphs[ch]; return rot ? rot.glyphs[ch] : g; }
    function pack(sz) {
      var out = [], px = 1, py = 1, rowH = 0;
      for (var i = 0; i < chars.length; i++) {
        var g = met.glyphs[chars[i]], bb = box(chars[i]);
        if (g.blank) { out.push({ g: g, ch: chars[i], x: 0, y: 0, bb: bb }); continue; }
        if (px + bb.w + 1 > sz) { px = 1; py += rowH + 1; rowH = 0; }
        if (py + bb.h + 1 > sz) return null;
        out.push({ g: g, ch: chars[i], x: px, y: py, bb: bb });
        px += bb.w + 1; rowH = Math.max(rowH, bb.h);
      }
      return out;
    }
    while (!(placed = pack(size)) && size < 4096) size *= 2;
    if (!placed) throw new Error('font ' + f.family + ' ' + f.px + 'px is too large to export');
    atlas = document.createElement('canvas'); atlas.width = atlas.height = size;
    var c = atlas.getContext('2d');
    placed.forEach(function (p) {
      if (p.g.blank) return;
      var gc = GW.glyphCanvas(f, p.ch, f.rot || 0);   // each glyph is drawn on its own cleared canvas and copied in at a whole pixel
      if (gc) c.drawImage(gc, p.x, p.y);
    });
    var name = f.id, base = rot ? rot.base : met.asc, lineH = rot ? rot.lineHeight : met.lineHeight;
    var lines = [];
    lines.push('info face="' + f.family + '" size=' + f.px + ' bold=0 italic=0 charset="" unicode=1 stretchH=100 smooth=1 aa=1 padding=0,0,0,0 spacing=1,1');
    lines.push('common lineHeight=' + lineH + ' base=' + base + ' scaleW=' + size + ' scaleH=' + size + ' pages=1 packed=0');
    lines.push('page id=0 file="' + name + '.png"');
    lines.push('chars count=' + placed.length);
    placed.forEach(function (p) {
      var g = p.g, w = rot ? p.bb.w : g.w, h = rot ? p.bb.h : g.h;
      var xo = rot ? (g.blank ? 0 : p.bb.bx + rot.lm) : g.x0 + (g.dx || 0), yo = g.blank ? 0 : (rot ? rot.base + p.bb.by : met.asc + g.y0);
      lines.push('char id=' + g.code + ' x=' + p.x + ' y=' + p.y + ' width=' + w + ' height=' + h +
        ' xoffset=' + xo + ' yoffset=' + yo + ' xadvance=' + (rot ? Math.max(g.adv, xo + w + 1) : g.adv) + ' page=0 chnl=15');   // a turned glyph is wider than its advance, and the watch cuts each glyph off at its advance
    });
    return { name: name, fnt: lines.join('\n') + '\n', canvas: atlas, size: size };
  };
})(window.GW);
