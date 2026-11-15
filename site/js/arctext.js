/* Curved text: a text layer can follow the edge of the round screen (the text of the top half bends like the top of the screen, the text of the
   bottom half like the bottom). It needs a bitmap font, because every letter is turned: the watch holds copies of the font turned in steps of 10 degrees
   and puts each letter on the circle, using the copy closest to the angle it needs. The preview uses the very same copies, so the two agree. */
(function (GW) {
  'use strict';
  var T = GW.types, STEP = 10;

  // where every letter goes: its position on the circle and the turned copy it uses
  function layout(el, str, fid, rot0, n) {
    var f = GW.customFont(fid), met = GW.fontMetrics(f), c = GW.SIZE / 2;
    var dx = el.x - c, dy = el.y - c, Rc = Math.max(10, Math.hypot(dx, dy)), top = el.y < c;
    var phic = Math.atan2(dx, -dy) * 180 / Math.PI;                       // clock degrees of the text centre (0 = 12 o'clock, 180 = 6 o'clock)
    if (!top && phic < 0) phic += 360;
    var dir = top ? 1 : -1, off = top ? 0 : 180, k = (met.asc - met.desc) / 2;
    var chars = str.split(''), adv = chars.map(function (ch) { var g = met.glyphs[ch]; return g ? g.adv : 8; });
    var tw = adv.reduce(function (a, b) { return a + b; }, 0), x = 0, out = [];
    chars.forEach(function (ch, i) {
      var a = adv[i], t = (x + a / 2 - tw / 2) / Rc, phi = phic + dir * t * 180 / Math.PI, rot = phi - off;
      var j = Math.max(0, Math.min(n - 1, Math.trunc((rot - rot0) / STEP + 0.5))), q = rot0 + j * STEP, qr = q * Math.PI / 180;
      var cxp = c + Rc * Math.sin(phi * Math.PI / 180), cyp = c - Rc * Math.cos(phi * Math.PI / 180);
      out.push({ ch: ch, q: q, px: cxp - (a / 2 * Math.cos(qr) + k * Math.sin(qr)), py: cyp - (a / 2 * Math.sin(qr) - k * Math.cos(qr)), blank: ch === ' ' });
      x += a;
    });
    return { glyphs: out, Rc: Rc, phic: phic, dir: dir, off: off, k: k, tw: tw };
  }
  // the turned copies the watch needs: enough angles for the longest text the layer can show (the current one, with some room)
  function range(el, fid) {
    var str = T.text.string(el, GW.env()), probe = layout(el, str, fid, -90, 19), half = probe.tw * 1.3 / 2 / probe.Rc * 180 / Math.PI;
    var m = Math.min(60, Math.ceil(half / STEP) * STEP);
    return { rot0: -m, n: 2 * m / STEP + 1 };
  }
  GW.arcRange = range;

  var tdraw = T.text.draw, tgen = T.text.gen, tfields = T.text.fields;
  function curved(el) { return el.curve && !el.rot && GW.customFont(GW.fontFor(el)) && !GW.customFont(GW.fontFor(el)).prebuilt; }
  T.text.draw = function (ctx, el, env) {
    if (!curved(el)) return tdraw.apply(this, arguments);
    var fid = GW.fontFor(el), f = GW.customFont(fid), r = range(el, fid), L = layout(el, T.text.string(el, env), fid, r.rot0, r.n), col = GW.q(el.color);
    L.glyphs.forEach(function (g) { if (!g.blank) GW.drawGlyphRot(ctx, f, g.ch, g.q, Math.trunc(g.px - 0) , Math.trunc(g.py - 0), col); });
  };
  T.text.fields = function (el) {
    var f = tfields.call(this, el), i = -1;
    f.forEach(function (x, n) { if (x && x.k === 'justify') i = n; });
    if (i >= 0) f.splice(i, 0, { k: 'curve', t: 'check', label: 'Curve the text along the screen edge (bitmap fonts; the upper half bends like the top, the lower half like the bottom)' });
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
    var fid = GW.fontFor(el), f = GW.customFont(fid), r = range(el, fid), tch = GW.textChars(el);
    var id = String(el.id).replace(/[^A-Za-z0-9]/g, ''), fonts = [], ms = [], adv = null;
    for (var j = 0; j < r.n; j++) {
      var deg = r.rot0 + j * STEP, rid = fid + '_r' + (deg < 0 ? 'n' + Math.round(-deg) : Math.round(deg));
      cg.fontChars(rid, tch);
      var rf = cg.rotFont(fid, deg); fonts.push(rf.ref); ms.push(rf.m); adv = rf.adv;
    }
    var probe = layout(el, T.text.string(el, GW.env()), fid, r.rot0, r.n);
    cg.helper('arcTxt');
    cg.member('    const AC_' + id + ' = [' + [Math.round(GW.SIZE / 2), Math.round(GW.SIZE / 2), probe.Rc.toFixed(2), probe.phic.toFixed(2), probe.dir, probe.off, r.rot0, STEP, probe.k.toFixed(1)].join(', ') + '];');
    return ['var af = [' + fonts.join(', ') + '];', 'var am = [' + ms.join(', ') + '];',   // the turned copies, in order of angle, and where each one's glyphs sit
      'dc.setColor(' + GW.mcColor(el.color) + ', Graphics.COLOR_TRANSPARENT);', 'arcTxt(dc, af, ' + adv + ', AC_' + id + ', ' + expr + ', am);'];
  };
  if (GW.MC_HELPERS) GW.MC_HELPERS.arcTxt = {
    imports: ['Toybox.Math'],
    code: 'function arcTxt(dc, fonts, adv, cfg, s, ms) {\n' +
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
      '            if (ch != \' \') {\n' +
      '                var t = (x + a / 2.0 - tw / 2.0) / cfg[2];\n' +
      '                var phi = cfg[3] + cfg[4] * t * 57.29578;\n' +
      '                var idx = ((phi - cfg[5] - cfg[6]) / cfg[7] + 0.5).toNumber();\n' +
      '                if (idx < 0) { idx = 0; }\n' +
      '                if (idx > fonts.size() - 1) { idx = fonts.size() - 1; }\n' +
      '                var m = ms[idx];\n' +
      '                var q = Math.toRadians(m[0]);\n' +
      '                var p = Math.toRadians(phi);\n' +
      '                var px = cfg[0] + cfg[2] * Math.sin(p) - (a / 2.0 * Math.cos(q) + cfg[8] * Math.sin(q));\n' +
      '                var py = cfg[1] - cfg[2] * Math.cos(p) - (a / 2.0 * Math.sin(q) - cfg[8] * Math.cos(q));\n' +
      '                dc.drawText((px - m[2]).toNumber(), (py - m[1]).toNumber(), fonts[idx], ch.toString(), Graphics.TEXT_JUSTIFY_LEFT);\n' +
      '            }\n' +
      '            x += a;\n' +
      '        }\n' +
      '    }'
  };
})(window.GW);
