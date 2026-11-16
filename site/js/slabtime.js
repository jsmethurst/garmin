/* "Quadrant digits": the time as four big digits that fill the round screen like four quadrants. Towards the middle the digits are square and meet at the
   centre cross; towards the outside their edge follows the circle of the screen. The digits are not a font: each of the 40 shapes (10 digits x 4 places)
   is worked out here as a polygon in whole pixels, and the same polygons are drawn in the preview and on the watch, so the two agree exactly.

   How a shape is made: the digit is built from bars and stems; stems on the outside run along the circle (a ring piece); everything is cut by the screen circle,
   softened (blurred and cut again, which rounds every corner), and cut square on the sides that face the centre. The result is traced into outlines. */
(function (GW) {
  'use strict';
  var T = GW.types, q = GW.q;
  var RZ = 4;                       // raster pixels per watch pixel while a shape is worked out
  var P = 16;                       // how far bars run past the sides that get cut off afterwards (design units)
  var CUT = 0.479;                  // the level at which the softened shape is cut again

  var SEG = { 0: 'abcdef', 1: '', 2: 'abged', 3: 'abgcd', 4: '', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abfgcd' };

  function params(el) {
    var wt = el.weight || 0;
    return { sc: (el.size || 87) / 100, gap: el.gap == null ? 9 : el.gap, rd: el.rd == null ? 3.4 : el.rd, W: 124, H: 94, R: 129, T: 18 + wt, Tm: 16 + wt, V: 27 + wt };
  }
  function keyOf(el) { var p = params(el); return [GW.SIZE, p.sc, p.gap, p.rd, p.T, p.V, el.roundAll ? 1 : 0].join('|'); }

  // ---------- blur (three box passes ~ a Gaussian) ----------
  function boxes(sigma, n) {
    var w = Math.sqrt(12 * sigma * sigma / n + 1), wl = Math.floor(w); if (wl % 2 === 0) wl--;
    var wu = wl + 2, m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4)), out = [];
    for (var i = 0; i < n; i++) out.push(((i < m ? wl : wu) - 1) / 2);
    return out;
  }
  function boxBlur(src, dst, w, h, r, horizontal) {
    var len = horizontal ? w : h, lines = horizontal ? h : w, iarr = 1 / (r + r + 1);
    for (var l = 0; l < lines; l++) {
      var base = horizontal ? l * w : l, step = horizontal ? 1 : w, fv = src[base], lv = src[base + (len - 1) * step], val = (r + 1) * fv, i;
      for (i = 0; i < r; i++) val += src[base + Math.min(len - 1, i) * step];
      for (i = 0; i < len; i++) {
        var add = src[base + Math.min(len - 1, i + r) * step], sub = i - r - 1 >= 0 ? src[base + (i - r - 1) * step] : fv;
        val += add - sub; dst[base + i * step] = val * iarr;
      }
    }
  }
  function gauss(a, w, h, sigma) {
    var b = new Float32Array(a.length), bx = boxes(sigma, 3);
    for (var i = 0; i < 3; i++) { boxBlur(a, b, w, h, bx[i], true); boxBlur(b, a, w, h, bx[i], false); }
    return a;
  }

  // ---------- one digit shape ----------
  function render(n, pos, el) {
    var p = params(el), S = GW.SIZE, f = S / 280, kk = p.sc * f, half = S / 2;
    var right = pos & 1, bottom = pos >> 1, W = p.W, H = p.H;
    var hgPx = Math.max(2, Math.round(p.gap / 2 * kk)), hgd = hgPx / kk;            // half the gap between digits: a whole number of pixels
    var x0 = right ? 140 + hgd : 140 - hgd - W, y0 = bottom ? 140 + hgd : 140 - hgd - H;
    // the raster covers (in watch pixels):
    var fx0 = Math.floor(half + (x0 - 40 - 140) * kk), fx1 = Math.ceil(half + (x0 + W + 40 - 140) * kk);
    var fy0 = Math.floor(half + (y0 - P - 140) * kk), fy1 = Math.ceil(half + (y0 + H + P - 140) * kk);
    var w = (fx1 - fx0) * RZ, h = (fy1 - fy0) * RZ;
    var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    var c = cv.getContext('2d'), a = kk * RZ;
    c.setTransform(a, 0, 0, a, (half - fx0 - 140 * kk) * RZ, (half - fy0 - 140 * kk) * RZ);
    c.beginPath(); c.arc(140, 140, p.R, 0, Math.PI * 2); c.clip();
    c.fillStyle = c.strokeStyle = '#fff';
    var outer = right ? 'R' : 'L', T = p.T, Tm = p.Tm, V = p.V;
    function rect(x, y, ww, hh) {
      var ra = el.roundAll;   // every corner rounded: nothing runs past the sides that face the centre either
      var xa = x <= 0 ? (ra && right ? 0 : -P) : x, xb = x + ww >= W ? (ra && !right ? W : W + P) : x + ww, ya = y <= 0 ? (bottom && !ra ? -P : 0) : y, yb = y + hh >= H ? (bottom || ra ? H : H + P) : y + hh;
      c.fillRect(x0 + xa, y0 + ya, xb - xa, yb - ya);
    }
    function stem(side, ya, yb) {
      if (side !== outer) { rect(side === 'L' ? 0 : W - V, ya, V, yb - ya); return; }
      var ta = ya <= 0 ? (bottom && !el.roundAll ? -P : 0) : ya, tb = yb >= H ? (bottom || el.roundAll ? H : H + P) : yb;      // a ring piece along the circle
      c.save(); c.beginPath(); c.rect(x0 - P, y0 + ta, W + 2 * P, tb - ta); c.clip();
      c.lineWidth = V + 1; c.beginPath(); c.arc(140, 140, p.R - V / 2, 0, Math.PI * 2); c.stroke(); c.restore();
    }
    var segs = SEG[n], hf = H / 2, m1 = hf - Tm / 2, m2 = hf + Tm / 2;
    if (n === 4) {
      var by = H * 0.62 - Tm / 2; rect(0, by, W, Tm); stem('L', 0, by + Tm); stem('R', 0, H);
    } else if (n === 1) {
      rect(W * 0.55, 0, V, H);
      c.beginPath(); c.moveTo(x0 + W * 0.2, y0 + H * 0.36); c.lineTo(x0 + W * 0.55, y0); c.lineTo(x0 + W * 0.55, y0 + T + 4); c.lineTo(x0 + W * 0.2, y0 + H * 0.36 + T + 4); c.closePath(); c.fill();
    } else {
      if (segs.indexOf('a') >= 0) rect(0, 0, W, T);
      if (segs.indexOf('d') >= 0) rect(0, H - T, W, T);
      if (segs.indexOf('g') >= 0) rect(n === 3 ? W * 0.28 : 0, m1, n === 3 ? W - W * 0.28 : W, Tm);
      if (segs.indexOf('f') >= 0) stem('L', 0, m2);
      if (segs.indexOf('b') >= 0) stem('R', 0, m2);
      if (segs.indexOf('e') >= 0) stem('L', m1, H);
      if (segs.indexOf('c') >= 0) stem('R', m1, H);
    }
    // soften: blur, then cut again; then square off the sides that face the centre
    var img = c.getImageData(0, 0, w, h).data, al = new Float32Array(w * h), i;
    for (i = 0; i < al.length; i++) al[i] = img[i * 4 + 3] / 255;
    gauss(al, w, h, p.rd * a);
    var kx0 = Math.round(((right ? half + hgd * kk : fx0) - fx0) * RZ), kx1 = Math.round(((right ? fx1 : half - hgd * kk) - fx0) * RZ);
    var ky0 = Math.round((half + (y0 - 140) * kk - fy0) * RZ), ky1 = Math.round((half + (y0 + H - 140) * kk - fy0) * RZ);
    var mask = new Uint8Array(w * h);
    for (var y = Math.max(0, ky0); y < Math.min(h, ky1); y++) for (var x = Math.max(0, kx0); x < Math.min(w, kx1); x++) if (al[y * w + x] > CUT) mask[y * w + x] = 1;
    return { rects: rectsOf(mask, w, h, fx0, fy0), pos: pos, n: n };
  }

  // ---------- the cut shape as whole-pixel rectangles ----------
  // A watch pixel is on when at least half of its raster block is. Rows of the same runs are merged into rectangles, so a digit is a few dozen
  // fillRectangle calls: exact on the watch (no polygon filling, which can go wrong on shapes that touch themselves), and no holes to paint over.
  function rectsOf(mask, w, h, fx0, fy0) {
    var W = w / RZ, H = h / RZ, open = {}, out = [], x, y, bx, by;
    for (y = 0; y < H; y++) {
      var runs = [], start = -1;
      for (x = 0; x <= W; x++) {
        var on = false;
        if (x < W) { var c = 0; for (by = 0; by < RZ; by++) for (bx = 0; bx < RZ; bx++) c += mask[(y * RZ + by) * w + x * RZ + bx]; on = c * 2 >= RZ * RZ; }
        if (on && start < 0) start = x;
        if (!on && start >= 0) { runs.push([start, x]); start = -1; }
      }
      var next = {};
      runs.forEach(function (r) {
        var k = r[0] + ',' + r[1], o = open[k];
        if (o) { o.h++; next[k] = o; } else { o = { x: fx0 + r[0], y: fy0 + y, w: r[1] - r[0], h: 1 }; out.push(o); next[k] = o; }
      });
      open = next;
    }
    return out;
  }

  // ---------- trace the cut shape into outlines (whole watch pixels) ----------
  function loopsOf(mask, w, h) {
    var W1 = w + 1, out = {}, i;
    function add(a, b) { (out[a] || (out[a] = [])).push(b); }
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      var v = function (vx, vy) { return vy * W1 + vx; };
      if (y === 0 || !mask[(y - 1) * w + x]) add(v(x, y), v(x + 1, y));
      if (x === w - 1 || !mask[y * w + x + 1]) add(v(x + 1, y), v(x + 1, y + 1));
      if (y === h - 1 || !mask[(y + 1) * w + x]) add(v(x + 1, y + 1), v(x, y + 1));
      if (x === 0 || !mask[y * w + x - 1]) add(v(x, y + 1), v(x, y));
    }
    var loops = [], keys = Object.keys(out);
    keys.forEach(function (k0) {
      k0 = +k0;
      while (out[k0] && out[k0].length) {
        var loop = [], cur = k0;
        for (var guard = 0; guard < 2000000; guard++) {
          loop.push(cur);
          var l = out[cur]; if (!l || !l.length) break;
          var nx = l.pop(); cur = nx;
          if (cur === k0) break;
        }
        if (loop.length > 3) loops.push(loop.map(function (k) { return [k % W1, Math.floor(k / W1)]; }));
      }
    });
    return loops;
  }
  function trace(mask, w, h, fx0, fy0) {
    var loops = loopsOf(mask, w, h), res = [];
    loops.forEach(function (lp) {
      lp = dropCollinear(lp);
      var s = rdpClosed(lp, 0.9), pts = [];
      s.forEach(function (pt) {
        var X = Math.round(fx0 + pt[0] / RZ), Y = Math.round(fy0 + pt[1] / RZ), L = pts[pts.length - 1];
        if (!L || L[0] !== X || L[1] !== Y) pts.push([X, Y]);
      });
      if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
      pts = rdpClosed(pts, 0.25);
      var A = area(pts); if (pts.length < 3 || Math.abs(A) < 4) return;
      res.push({ hole: A < 0, pts: pts });                // outlines run clockwise on screen (positive area) for the outside, the other way for holes
    });
    return res;
  }
  function area(p) { var s = 0; for (var i = 0; i < p.length; i++) { var a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
  function dropCollinear(p) {
    var o = [], n = p.length;
    for (var i = 0; i < n; i++) {
      var a = p[(i + n - 1) % n], b = p[i], c = p[(i + 1) % n];
      if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) !== 0) o.push(b);
    }
    return o.length >= 3 ? o : p;
  }
  function rdp(p, i0, i1, tol, keep) {
    var a = p[i0], b = p[i1], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, mx = -1, mi = -1;
    for (var i = i0 + 1; i < i1; i++) { var d = Math.abs(dy * (p[i][0] - a[0]) - dx * (p[i][1] - a[1])) / L; if (d > mx) { mx = d; mi = i; } }
    if (mx > tol) { keep[mi] = 1; rdp(p, i0, mi, tol, keep); rdp(p, mi, i1, tol, keep); }
  }
  function rdpClosed(p, tol) {
    var n = p.length; if (n < 4) return p;
    var far = 0, fd = -1; for (var i = 1; i < n; i++) { var d = Math.hypot(p[i][0] - p[0][0], p[i][1] - p[0][1]); if (d > fd) { fd = d; far = i; } }
    var a = p.slice(0, far + 1), b = p.slice(far).concat([p[0]]), keepA = {}, keepB = {}, out = [];
    rdp(a, 0, a.length - 1, tol, keepA); rdp(b, 0, b.length - 1, tol, keepB);
    for (i = 0; i < a.length; i++) if (i === 0 || i === a.length - 1 || keepA[i]) out.push(a[i]);
    for (i = 1; i < b.length - 1; i++) if (keepB[i]) out.push(b[i]);
    return out;
  }

  GW._trace = { loopsOf: loopsOf, dropCollinear: dropCollinear, rdpClosed: rdpClosed, area: area };

  // shapes are cached per setting (a drawing of one digit takes a moment)
  var cache = {};
  GW.slabShape = function (n, pos, el) {
    var k = keyOf(el);
    if (!cache[k]) { var keys = Object.keys(cache); if (keys.length > 6) delete cache[keys[0]]; cache[k] = {}; }
    var id = pos * 10 + n; return cache[k][id] || (cache[k][id] = render(n, pos, el));
  };

  // the four digits of the time
  function digits(el, env) {
    var h = env.h, use24 = el.hmode === 'h24' ? true : (el.hmode === 'h12' ? false : env.sim.is24);
    if (!use24) { h = h % 12; if (h === 0) h = 12; }
    var m = env.m;
    return [h >= 10 || el.lz !== false ? Math.floor(h / 10) : -1, h % 10, Math.floor(m / 10), m % 10];
  }

  T.slabtime = {
    label: 'Quadrant digits', icon: '◐',
    defaults: function () { return { type: 'slabtime', name: 'Time', colorH: '#000000', colorM: '#00aaaa', hmode: 'auto', lz: true, size: 87, gap: 9, weight: 0, rd: 3.4 }; },
    pos: [],
    draw: function (ctx, el, env) {
      var d = digits(el, env);
      ctx.save();
      [0, 1, 2, 3].forEach(function (pos) {
        if (d[pos] < 0) return;
        ctx.fillStyle = q(pos < 2 ? el.colorH : el.colorM);
        GW.slabShape(d[pos], pos, el).rects.forEach(function (r) { ctx.fillRect(r.x, r.y, r.w, r.h); });
      });
      ctx.restore();
    },
    box: function () { var S = GW.SIZE; return { x: S * 0.06, y: S * 0.14, w: S * 0.88, h: S * 0.72 }; },
    hit: function (el, x, y) { var S = GW.SIZE; return Math.hypot(x - S / 2, y - S / 2) < S * 0.42; },
    fields: function () {
      return [
        { t: 'note', text: 'The four digits fill the screen like quadrants: square towards the middle, following the screen’s edge on the outside.' },
        { k: 'colorH', t: 'color', label: 'Hour digits' },
        { k: 'colorM', t: 'color', label: 'Minute digits' },
        { k: 'hmode', t: 'seg', label: 'Clock', opts: [['auto', 'Watch'], ['h24', '24h'], ['h12', '12h']] },
        { k: 'lz', t: 'check', label: 'Leading zero on hour' },
        { t: 'h', label: 'Shape' },
        { k: 'size', t: 'range', label: 'Size (%)', min: 60, max: 100 },
        { t: 'row', fields: [{ k: 'gap', t: 'num', label: 'Gap in the middle (px)', min: 2, max: 30 }, { k: 'weight', t: 'num', label: 'Weight', min: -6, max: 8 }] },
        { k: 'rd', t: 'range', label: 'Corner rounding', min: 1, max: 8 }
      ];
    },
    // Monkey C: the 40 shapes are stored as byte tables (outline kind, point count, then x and y of every point, relative to the shape's corner)
    gen: function (el, cg) {
      var id = String(el.id).replace(/[^A-Za-z0-9]/g, ''), rows = [], ox = [], oy = [], pos, n;
      for (pos = 0; pos < 4; pos++) for (n = 0; n < 10; n++) {
        var sh = GW.slabShape(n, pos, el), mx = 1e9, my = 1e9, bytes = [];
        sh.rects.forEach(function (r) { mx = Math.min(mx, r.x); my = Math.min(my, r.y); });
        if (mx === 1e9) { mx = 0; my = 0; }
        sh.rects.forEach(function (r) { bytes.push(r.x - mx, r.y - my, r.w, r.h); });
        bytes.forEach(function (b) { if (b < 0 || b > 255) throw new Error('A digit does not fit in a byte table'); });
        rows.push('"' + bytes.map(function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join('') + '"'); ox.push(mx); oy.push(my);   // hex text: a plain string, not a long list of numbers
      }
      cg.member('    const SLAB_' + id + ' = [');
      rows.forEach(function (r, i) { cg.member('        ' + r + (i < rows.length - 1 ? ',' : '')); });
      cg.member('    ];');
      cg.member('    const SLAB_' + id + '_X = [' + ox.join(', ') + '];'); cg.member('    const SLAB_' + id + '_Y = [' + oy.join(', ') + '];');
      cg.need('clk'); cg.helper('hourNum'); cg.helper('drawSlab');
      var mode = { h24: 1, h12: 2 }[el.hmode] || 0, fg = GW.mcColor(el.colorH), fm = GW.mcColor(el.colorM), L = [];
      L.push('var _sh = hourNum(' + mode + ');', 'var _sm = _clk.min;');
      var seq = [[0, '(_sh / 10)', fg], [1, '(_sh % 10)', fg], [2, '(_sm / 10)', fm], [3, '(_sm % 10)', fm]];
      seq.forEach(function (s) {
        var call = 'drawSlab(dc, SLAB_' + id + '[' + (s[0] * 10) + ' + ' + s[1] + '], SLAB_' + id + '_X[' + (s[0] * 10) + ' + ' + s[1] + '], SLAB_' + id + '_Y[' + (s[0] * 10) + ' + ' + s[1] + '], ' + s[2] + ');';
        L.push(s[0] === 0 && el.lz === false ? 'if (_sh >= 10) { ' + call + ' }' : call);
      });
      return L;
    }
  };

  // the watch side: every rectangle of the shape (four hex bytes each: x, y, width, height), in the digit's color
  if (GW.MC_HELPERS) GW.MC_HELPERS.drawSlab = {
    code: 'function drawSlab(dc, s, ox, oy, fg) {\n' +
      '        dc.setColor(fg, Graphics.COLOR_TRANSPARENT);\n' +
      '        var b = s.toUtf8Array();\n' +
      '        var n = b.size();\n' +
      '        for (var i = 0; i + 7 < n; i += 8) {\n' +
      '            dc.fillRectangle(ox + hexByte(b, i), oy + hexByte(b, i + 2), hexByte(b, i + 4), hexByte(b, i + 6));\n' +
      '        }\n' +
      '    }\n\n' +
      '    function hexByte(b, i) {\n' +
      '        var a = b[i];\n' +
      '        var c = b[i + 1];\n' +
      '        return ((a < 58) ? a - 48 : a - 87) * 16 + ((c < 58) ? c - 48 : c - 87);\n' +
      '    }'
  };
})(window.GW);
