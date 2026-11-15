/* Curved text: a text layer can follow the edge of the round screen (text in the top half bends like the top of the screen, text in the bottom half like
   the bottom). Every letter is drawn as a small filled outline (the outline of the letter in the layer's font), turned by exactly the angle it needs and
   placed exactly on the circle, so the curve is smooth. No font file goes on the watch for such a layer, which also keeps the face's memory use low.
   The preview draws the same outlines with the same arithmetic. */
(function (GW) {
  'use strict';
  var T = GW.types, Z = 8, OFF = 64;          // Z: raster pixels per pixel while the outlines are made; OFF: shifts the stored quarter-pixel coordinates to be positive

  // ---------- the outline of one letter, as polygons in quarter pixels from the letter's pen origin on the baseline ----------
  var cache = {};
  function outline(f, ch) {
    var k = f.id + '|' + f.family + '|' + f.weight + '|' + f.px + '|' + (f.bold || 0) + '|' + ch;
    if (cache[k]) return cache[k];
    var met = GW.fontMetrics(f), g = met.glyphs[ch], res = [];
    if (g && !g.blank) {
      var pad = 3, w = Math.ceil((g.w + 2 * pad) * Z), h = Math.ceil((g.h + 2 * pad) * Z), cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      var c = cv.getContext('2d', { willReadFrequently: true });
      c.scale(Z, Z); c.translate(pad, pad);
      c.font = GW.fontCss(f); c.fillStyle = '#fff'; c.textBaseline = 'alphabetic'; c.textAlign = 'left';
      c.fillText(ch, -g.x0, -g.y0);
      if (f.bold) { c.lineWidth = f.bold; c.lineJoin = 'round'; c.strokeStyle = '#fff'; c.strokeText(ch, -g.x0, -g.y0); }
      var im = c.getImageData(0, 0, w, h).data, mask = new Uint8Array(w * h), i;
      for (i = 0; i < mask.length; i++) mask[i] = im[i * 4 + 3] >= 128 ? 1 : 0;
      var tr = GW._trace;
      tr.loopsOf(mask, w, h).forEach(function (lp) {
        lp = tr.dropCollinear(lp);
        var s = tr.rdpClosed(lp, 1.1), pts = [];
        s.forEach(function (p) {
          var u = (p[0] / Z - pad + g.x0 + (g.dx || 0)), v = (p[1] / Z - pad + g.y0), X = Math.round(u * 4) + OFF, Y = Math.round(v * 4) + OFF, L = pts[pts.length - 1];
          if (!L || L[0] !== X || L[1] !== Y) pts.push([X, Y]);
        });
        if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
        var A = tr.area(pts); if (pts.length < 3 || Math.abs(A) < 3) return;
        pts.forEach(function (p) { if (p[0] < 0 || p[0] > 255 || p[1] < 0 || p[1] > 255) throw new Error('A letter outline does not fit in a byte table'); });
        res.push({ hole: A < 0, pts: pts });
      });
    }
    return (cache[k] = res);
  }

  // ---------- where every letter goes ----------
  function place(el, str, f) {
    var met = GW.fontMetrics(f), c = GW.SIZE / 2, dx = el.x - c, dy = el.y - c, Rc = Math.max(10, Math.hypot(dx, dy)), top = el.y < c;
    var phic = Math.atan2(dx, -dy) * 180 / Math.PI;                       // clock degrees of the text centre (0 = 12 o'clock, 180 = 6 o'clock)
    if (!top && phic < 0) phic += 360;
    var dir = top ? 1 : -1, off = top ? 0 : 180, k = (met.asc - met.desc) / 2;
    var chars = str.split(''), adv = chars.map(function (ch) { var g = met.glyphs[ch]; return g ? g.adv : 8; });
    var tw = adv.reduce(function (a, b) { return a + b; }, 0), x = 0, out = [];
    chars.forEach(function (ch, i) {
      var a = adv[i], t = (x + a / 2 - tw / 2) / Rc, phi = phic + dir * t * 180 / Math.PI, q = (phi - off) * Math.PI / 180, p = phi * Math.PI / 180;
      var cx = c + Rc * Math.sin(p), cy = c - Rc * Math.cos(p);
      out.push({ ch: ch, cos: Math.cos(q), sin: Math.sin(q), ox: cx - (a / 2 * Math.cos(q) + k * Math.sin(q)), oy: cy - (a / 2 * Math.sin(q) - k * Math.cos(q)) });
      x += a;
    });
    return { glyphs: out, Rc: Rc, phic: phic, dir: dir, off: off, k: k };
  }

  var tdraw = T.text.draw, tgen = T.text.gen, tfields = T.text.fields;
  function curved(el) { var f = GW.customFont(GW.fontFor(el)); return !!(el.curve && !el.rot && f && !f.prebuilt); }
  T.text.draw = function (ctx, el, env) {
    if (!curved(el)) return tdraw.apply(this, arguments);
    var f = GW.customFont(GW.fontFor(el)), L = place(el, T.text.string(el, env), f);
    ctx.save(); ctx.fillStyle = GW.q(el.color); ctx.beginPath();
    L.glyphs.forEach(function (g) {
      outline(f, g.ch).forEach(function (pl) {
        pl.pts.forEach(function (p, i) {
          var u = (p[0] - OFF) / 4, v = (p[1] - OFF) / 4, X = Math.trunc(g.ox + u * g.cos - v * g.sin), Y = Math.trunc(g.oy + u * g.sin + v * g.cos);
          i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
        });
        ctx.closePath();
      });
    });
    ctx.fill('evenodd'); ctx.restore();
  };
  T.text.fields = function (el) {
    var f = tfields.call(this, el), i = -1;
    f.forEach(function (x, n) { if (x && x.k === 'justify') i = n; });
    if (i >= 0) f.splice(i, 0, { k: 'curve', t: 'check', label: 'Curve the text along the screen edge (the upper half bends like the top, the lower half like the bottom; any bitmap font)' });
    return f;
  };
  T.text.gen = function (el, cg) {
    if (!curved(el)) return tgen.apply(this, arguments);
    var src = GW.sources[el.source]; if (!src) return [];
    (src.imports || []).forEach(cg.imp); (src.perms || []).forEach(cg.perm);
    var parts = [];
    if (el.prefix) parts.push(GW.mcLit(el.prefix));
    parts.push(src.mcStr(el, cg));
    if (el.suffix) parts.push(GW.mcLit(el.suffix));
    var expr = parts.join(' + ');
    if (el.upper) expr = '(' + expr + ').toUpper()';
    if (el.lower && !(el.source === 'date' && el.tr)) expr = '(' + expr + ').toLower()';
    var f = GW.customFont(GW.fontFor(el)), met = GW.fontMetrics(f), tch = GW.textChars(el) || met.chars;
    var seen = {}, chars = tch.split('').filter(function (ch) { if (seen[ch] || ch === ' ' || !met.glyphs[ch]) return false; return (seen[ch] = 1); });
    var id = String(el.id).replace(/[^A-Za-z0-9]/g, ''), lit = function (ch) { return ch === "'" ? "'\\''" : (ch === '\\' ? "'\\\\'" : "'" + ch + "'"); };
    var gl = [], av = [];
    chars.forEach(function (ch) {
      var bytes = [];
      outline(f, ch).forEach(function (pl) {
        if (pl.pts.length > 255) throw new Error('A letter outline is too detailed for the table');
        bytes.push(pl.hole ? 1 : 0, pl.pts.length);
        pl.pts.forEach(function (p) { bytes.push(p[0]); }); pl.pts.forEach(function (p) { bytes.push(p[1]); });
      });
      if (bytes.length) gl.push(lit(ch) + ' => [' + bytes.join(',') + ']b');
    });
    ((tch + ' ').split('').filter(function (ch, i, a) { return a.indexOf(ch) === i; })).forEach(function (ch) { var g = met.glyphs[ch]; if (g) av.push(lit(ch) + ' => ' + g.adv); });
    var P = place(el, T.text.string(el, GW.env()), f);
    cg.helper('arcGly');
    cg.member('    const GL_' + id + ' = {\n        ' + gl.join(',\n        ') + '\n    };');
    cg.member('    const AV_' + id + ' = { ' + av.join(', ') + ' };');
    cg.member('    const AC_' + id + ' = [' + [Math.round(GW.SIZE / 2), Math.round(GW.SIZE / 2), P.Rc.toFixed(2), P.phic.toFixed(2), P.dir, P.off, P.k.toFixed(1)].join(', ') + '];');
    var bgx = GW.bgExpr ? GW.bgExpr(cg.design, cg) : GW.mcColor(cg.design.bg);
    return ['arcGly(dc, GL_' + id + ', AV_' + id + ', AC_' + id + ', ' + expr + ', ' + GW.mcColor(el.color) + ', ' + bgx + ');'];
  };
  if (GW.MC_HELPERS) GW.MC_HELPERS.arcGly = {
    imports: ['Toybox.Math'],
    code: 'function arcGly(dc, gl, adv, cfg, s, fg, bg) {\n' +
      '        var chars = s.toCharArray();\n' +
      '        var n = chars.size();\n' +
      '        var tw = 0;\n' +
      '        for (var i = 0; i < n; i++) {\n' +
      '            var w = adv[chars[i]];\n' +
      '            tw += (w != null) ? w : 8;\n' +
      '        }\n' +
      '        var x = 0;\n' +
      '        for (var j = 0; j < n; j++) {\n' +
      '            var ch = chars[j];\n' +
      '            var a = adv[ch];\n' +
      '            if (a == null) { a = 8; }\n' +
      '            var d = gl[ch];\n' +
      '            if (d != null) {\n' +
      '                var phi = cfg[3] + cfg[4] * ((x + a / 2.0 - tw / 2.0) / cfg[2]) * 57.29578;\n' +
      '                var q = Math.toRadians(phi - cfg[5]);\n' +
      '                var p = Math.toRadians(phi);\n' +
      '                var c = Math.cos(q);\n' +
      '                var sn = Math.sin(q);\n' +
      '                var ox = cfg[0] + cfg[2] * Math.sin(p) - (a / 2.0 * c + cfg[6] * sn);\n' +
      '                var oy = cfg[1] - cfg[2] * Math.cos(p) - (a / 2.0 * sn - cfg[6] * c);\n' +
      '                glyphPoly(dc, d, [ox, oy, c, sn], fg, bg);\n' +
      '            }\n' +
      '            x += a;\n' +
      '        }\n' +
      '    }\n\n' +
      '    function glyphPoly(dc, d, m, fg, bg) {\n' +
      '        var n = d.size();\n' +
      '        for (var pass = 0; pass < 2; pass++) {\n' +
      '            dc.setColor((pass == 0) ? fg : bg, Graphics.COLOR_TRANSPARENT);\n' +
      '            var i = 0;\n' +
      '            while (i < n) {\n' +
      '                var cnt = d[i + 1];\n' +
      '                if (d[i] == pass) {\n' +
      '                    var pts = new [cnt];\n' +
      '                    for (var k = 0; k < cnt; k++) {\n' +
      '                        var u = (d[i + 2 + k] - 64) / 4.0;\n' +
      '                        var v = (d[i + 2 + cnt + k] - 64) / 4.0;\n' +
      '                        pts[k] = [(m[0] + u * m[2] - v * m[3]).toNumber(), (m[1] + u * m[3] + v * m[2]).toNumber()];\n' +
      '                    }\n' +
      '                    dc.fillPolygon(pts);\n' +
      '                }\n' +
      '                i += 2 + cnt * 2;\n' +
      '            }\n' +
      '        }\n' +
      '    }'
  };
})(window.GW);
