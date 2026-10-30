/* Fonts: Garmin system fonts (approximate preview) + custom bitmap fonts rasterised from bundled / uploaded TTF.
   Preview and export share the exact same glyph metrics, so what you see is what the .fnt contains. */
(function (GW) {
  'use strict';
  var K = GW.SIZE / 260; // system-font boxes were measured on a 260px fenix 6; scale to 280px

  // [constant, box height @260, kind]   kind: 't' text face, 'n' number face
  GW.SYS_FONTS = [
    ['FONT_XTINY', 12, 't'], ['FONT_TINY', 15, 't'], ['FONT_SMALL', 18, 't'], ['FONT_MEDIUM', 21, 't'], ['FONT_LARGE', 23, 't'],
    ['FONT_NUMBER_MILD', 30, 'n'], ['FONT_NUMBER_MEDIUM', 36, 'n'], ['FONT_NUMBER_HOT', 49, 'n'], ['FONT_NUMBER_THAI_HOT', 57, 'n']
  ];
  var SYS = {};
  GW.SYS_FONTS.forEach(function (f) {
    SYS[f[0]] = { box: f[1] * K, px: Math.round(f[1] * K * (f[2] === 'n' ? 1.47 : 1.25)), weight: f[2] === 'n' ? 700 : 500, family: 'Rajdhani' };
  });
  GW.sysFont = function (id) { return SYS[id]; };
  GW.isSysFont = function (id) { return !!SYS[id]; };

  // Bundled families (self-hosted woff2 in /fonts)
  GW.FONT_FAMILIES = [
    { family: 'Rajdhani', weights: [500, 700] },
    { family: 'Orbitron', weights: [500, 900] },
    { family: 'Share Tech Mono', weights: [400] },
    { family: 'Bebas Neue', weights: [400] },
    { family: 'Oxanium', weights: [600] },
    { family: 'Chakra Petch', weights: [600] },
    { family: 'Press Start 2P', weights: [400] },
    { family: 'DM Serif Display', weights: [400] },
    { family: 'DM Sans', weights: [500, 700] }
  ];
  GW.GLYPH_SETS = {
    nums: { label: 'Digits 0-9 only (smallest)', chars: '0123456789' },
    digits: { label: 'Digits + : . - + % ° /', chars: ' 0123456789:.-+%°/' },
    tr: { label: 'Digits + A-Z + Turkish capitals', chars: ' 0123456789:.-+%°/ABCDEFGHIJKLMNOPQRSTUVWXYZÇĞİŞÖÜ' },
    basic: { label: 'Digits + A-Z', chars: ' 0123456789:.-+%°/ABCDEFGHIJKLMNOPQRSTUVWXYZ' },
    full: { label: 'Full ASCII + °', chars: (function () { var s = ''; for (var i = 32; i < 127; i++) s += String.fromCharCode(i); return s + '°'; })() }
  };

  // ---------- ensure web fonts are loaded before drawing ----------
  GW.fontsReady = function () {
    var jobs = [];
    GW.FONT_FAMILIES.forEach(function (f) {
      f.weights.forEach(function (w) { jobs.push(document.fonts.load(w + ' 20px "' + f.family + '"')); jobs.push(document.fonts.load(w + ' 20px "' + f.family + '"', 'İŞĞÜ')); });
    });
    return Promise.all(jobs).catch(function () { });
  };
  GW.registerUploadedFont = function (family, dataUrl) {
    var face = new FontFace(family, 'url(' + dataUrl + ')');
    return face.load().then(function (f) { document.fonts.add(f); return f; });
  };

  GW.previewFonts = {}; // transient fonts shown in the Fonts tab before they are added
  GW.customFont = function (id) {
    var fs = GW.design.fonts;
    for (var i = 0; i < fs.length; i++) if (fs[i].id === id) return fs[i];
    return GW.previewFonts[id] || null;
  };
  GW.fontCss = function (f) { return (f.weight || 400) + ' ' + f.px + 'px "' + f.family + '"'; };

  // ---------- glyph metrics (shared by preview + export) ----------
  var scratch = document.createElement('canvas').getContext('2d');
  var cache = {};
  function key(f) { return [f.family, f.weight, f.px, f.glyphs, f.spacing || 0].join('|'); }

  GW.fontMetrics = function (f) {
    var k = key(f);
    if (cache[k] && cache[k].ready) return cache[k];
    scratch.font = GW.fontCss(f);
    scratch.textBaseline = 'alphabetic'; scratch.textAlign = 'left';
    var chars = (GW.GLYPH_SETS[f.glyphs] || GW.GLYPH_SETS.digits).chars;
    var asc = 0, desc = 0, glyphs = {}, ok = true;
    for (var i = 0; i < chars.length; i++) {
      var ch = chars[i], m = scratch.measureText(ch);
      var x0 = Math.floor(-m.actualBoundingBoxLeft), x1 = Math.ceil(m.actualBoundingBoxRight);
      var y0 = Math.floor(-m.actualBoundingBoxAscent), y1 = Math.ceil(m.actualBoundingBoxDescent);
      var blank = ch === ' ' || (x1 <= x0 && y1 <= y0);
      if (!blank) { asc = Math.max(asc, -y0); desc = Math.max(desc, y1); }
      glyphs[ch] = { code: ch.charCodeAt(0), x0: x0, y0: y0, w: blank ? 0 : Math.max(1, x1 - x0), h: blank ? 0 : Math.max(1, y1 - y0),
        adv: Math.max(1, Math.round(m.width + (f.spacing || 0))), blank: blank };
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
    var left = justify === 'L' ? x : (justify === 'R' ? x - w : x - w / 2);
    return { x: left, y: y - h / 2, w: w, h: h };
  };
  GW.drawText = function (ctx, fontId, text, x, y, justify, color) {
    var b = GW.layoutText(ctx, fontId, text, x, y, justify), sys = SYS[fontId], cf = !sys && GW.customFont(fontId);
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    if (cf) {
      var met = GW.fontMetrics(cf);
      ctx.font = GW.fontCss(cf); ctx.textBaseline = 'alphabetic';
      var cx = b.x, base = b.y + met.asc;
      for (var i = 0; i < text.length; i++) {
        var g = met.glyphs[text[i]];
        if (!g) { cx += Math.round(cf.px * 0.5); continue; }
        if (!g.blank) ctx.fillText(text[i], cx, base);
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
      var pts = [[g.x0, g.y0], [g.x0 + g.w, g.y0], [g.x0 + g.w, g.y0 + g.h], [g.x0, g.y0 + g.h]].map(function (p) { return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]; });
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
    c.font = GW.fontCss(f); c.fillStyle = '#ffffff'; c.textBaseline = 'alphabetic'; c.textAlign = 'left';
    placed.forEach(function (p) {
      if (p.g.blank) return;
      if (rot) { c.save(); c.translate(p.x - p.bb.bx, p.y - p.bb.by); c.rotate(f.rot * Math.PI / 180); c.fillText(p.ch, 0, 0); c.restore(); }
      else c.fillText(p.ch, p.x - p.g.x0, p.y - p.g.y0);
    });
    var name = f.id, base = rot ? rot.base : met.asc, lineH = rot ? rot.lineHeight : met.lineHeight;
    var lines = [];
    lines.push('info face="' + f.family + '" size=' + f.px + ' bold=0 italic=0 charset="" unicode=1 stretchH=100 smooth=1 aa=1 padding=0,0,0,0 spacing=1,1');
    lines.push('common lineHeight=' + lineH + ' base=' + base + ' scaleW=' + size + ' scaleH=' + size + ' pages=1 packed=0');
    lines.push('page id=0 file="' + name + '.png"');
    lines.push('chars count=' + placed.length);
    placed.forEach(function (p) {
      var g = p.g, w = rot ? p.bb.w : g.w, h = rot ? p.bb.h : g.h;
      var xo = rot ? (g.blank ? 0 : p.bb.bx + rot.lm) : g.x0, yo = g.blank ? 0 : (rot ? rot.base + p.bb.by : met.asc + g.y0);
      lines.push('char id=' + g.code + ' x=' + p.x + ' y=' + p.y + ' width=' + w + ' height=' + h +
        ' xoffset=' + xo + ' yoffset=' + yo + ' xadvance=' + g.adv + ' page=0 chnl=15');
    });
    return { name: name, fnt: lines.join('\n') + '\n', canvas: atlas, size: size };
  };
})(window.GW);
