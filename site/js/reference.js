/* Reference image: lay a photo or screenshot of a watch face under the design, calibrate it to the screen, find the objects in it
   and turn them into elements. The picture lives in this browser tab only: it is never saved with a design and never exported. */
(function (GW) {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var N = Math.round;
  var R = GW.ref = {
    src: null, name: '', show: true, opacity: 0.5, x: 0, y: 0, s: 1, x0: 0, y0: 0, s0: 1,      // x, y: top left of the picture in design pixels; s: design px per picture px
    calib: null, boxes: [], showBoxes: true, tool: null, hover: null, dropper: null, measure: null, bg: null
  };
  function redraw() { if (GW.stage) GW.stage.schedule(); }
  function toHex(r, g, b) { return '#' + [r, g, b].map(function (v) { return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
  var LV = [0, 85, 170, 255];
  function keyOf(r, g, b) { return (N(r / 85) << 4) | (N(g / 85) << 2) | N(b / 85); }
  function hexOfKey(k) { return toHex(LV[(k >> 4) & 3], LV[(k >> 2) & 3], LV[k & 3]); }   // the 64-colour palette: 2 bits per channel

  // ---------------------------------------------------------------- picture
  GW.refLoad = function (file) {
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      var k = Math.min(1, 3000 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
      c.width = Math.max(1, N(img.naturalWidth * k)); c.height = Math.max(1, N(img.naturalHeight * k));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      R.src = c; R.name = file.name || 'reference'; R.calib = null; R.boxes = []; R.all = []; R.bg = null; R.dropper = null; R.measure = null;
      var S = GW.SIZE; R.s = S / Math.min(c.width, c.height); R.x = (S - c.width * R.s) / 2; R.y = (S - c.height * R.s) / 2;   // first guess: the middle of the picture fills the display
      R.s0 = R.s; R.x0 = R.x; R.y0 = R.y;
      GW.renderPanel(); redraw();
    };
    img.onerror = function () { GW.toast('That file could not be read as a picture.'); };
    img.src = url;
  };
  GW.refDraw = function (ctx) {   // called by the renderer after the background and before the elements
    if (!R.src || !R.show) return;
    ctx.save(); ctx.globalAlpha = R.opacity; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(R.src, R.x, R.y, R.src.width * R.s, R.src.height * R.s);
    ctx.restore();
  };

  // ---------------------------------------------------------------- circle fit
  function kasa(P) {   // algebraic circle fit: minimises sum (x^2 + y^2 + D x + E y + F)^2
    var n = P.length, sx = 0, sy = 0, i;
    for (i = 0; i < n; i++) { sx += P[i][0]; sy += P[i][1]; }
    var mx = sx / n, my = sy / n, suu = 0, suv = 0, svv = 0, suuu = 0, svvv = 0, suvv = 0, svuu = 0;
    for (i = 0; i < n; i++) {
      var u = P[i][0] - mx, v = P[i][1] - my;
      suu += u * u; suv += u * v; svv += v * v; suuu += u * u * u; svvv += v * v * v; suvv += u * v * v; svuu += v * u * u;
    }
    var det = suu * svv - suv * suv; if (Math.abs(det) < 1e-9) return null;
    var b1 = 0.5 * (suuu + suvv), b2 = 0.5 * (svvv + svuu);
    var uc = (b1 * svv - b2 * suv) / det, vc = (suu * b2 - suv * b1) / det;
    return { x: uc + mx, y: vc + my, r: Math.sqrt(uc * uc + vc * vc + (suu + svv) / n) };
  }
  // Finds the circle that passes through the clicked point, among the edges of the picture (the edge of a display, of a bezel or of a bright ring).
  // Edge pixels vote for centres along their own gradient direction (Hough), the click picks the radius, then Kasa fits the pixels on that circle.
  function fitCircleAt(cnv, clickX, clickY) {
    var k = Math.min(1, 800 / Math.max(cnv.width, cnv.height)), W = Math.max(16, N(cnv.width * k)), H = Math.max(16, N(cnv.height * k));
    var wc = document.createElement('canvas'); wc.width = W; wc.height = H;
    var wx = wc.getContext('2d', { willReadFrequently: true }); wx.drawImage(cnv, 0, 0, W, H);
    var d = wx.getImageData(0, 0, W, H).data, L = new Float32Array(W * H), Sa = new Float32Array(W * H), i, x, y;
    for (i = 0; i < W * H; i++) {
      var r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      L[i] = 0.299 * r + 0.587 * g + 0.114 * b; Sa[i] = mx ? (mx - mn) : 0;   // brightness and colourfulness: both make edges
    }
    var gxA = new Float32Array(W * H), gyA = new Float32Array(W * H), mag = new Float32Array(W * H);
    for (y = 1; y < H - 1; y++) for (x = 1; x < W - 1; x++) {
      i = y * W + x;
      var a = [L, Sa], best = 0, bx = 0, by = 0;
      for (var c = 0; c < 2; c++) {
        var F = a[c];
        var gx = (F[i - W + 1] + 2 * F[i + 1] + F[i + W + 1]) - (F[i - W - 1] + 2 * F[i - 1] + F[i + W - 1]);
        var gy = (F[i + W - 1] + 2 * F[i + W] + F[i + W + 1]) - (F[i - W - 1] + 2 * F[i - W] + F[i - W + 1]);
        var m = Math.sqrt(gx * gx + gy * gy);
        if (m > best) { best = m; bx = gx; by = gy; }
      }
      mag[i] = best; gxA[i] = bx; gyA[i] = by;
    }
    var sorted = Array.prototype.slice.call(mag).sort(function (p, q) { return p - q; }), thr = Math.max(30, sorted[Math.floor(sorted.length * 0.92)]);
    // the clicked edge itself: the strongest edge pixel within a few pixels of the click gives the direction the circle's centre lies in
    var cxk = clickX * k, cyk = clickY * k, E = null, rad0 = Math.max(6, 0.012 * Math.max(W, H));
    for (y = Math.max(1, Math.floor(cyk - rad0)); y <= Math.min(H - 2, Math.ceil(cyk + rad0)); y++) for (x = Math.max(1, Math.floor(cxk - rad0)); x <= Math.min(W - 2, Math.ceil(cxk + rad0)); x++) {
      i = y * W + x; if (Math.hypot(x - cxk, y - cyk) <= rad0 && (!E || mag[i] > E.m)) E = { x: x, y: y, m: mag[i], nx: gxA[i] / (mag[i] || 1), ny: gyA[i] / (mag[i] || 1) };
    }
    if (!E || E.m < 8) return null;
    var thr2 = Math.max(12, Math.min(thr, E.m * 0.5));   // a faint edge (a black display against a dark bezel) lowers the bar for the edge pixels that count
    var pts = [];
    for (i = 0; i < W * H; i++) if (mag[i] >= thr2) pts.push({ x: i % W, y: (i / W) | 0, nx: gxA[i] / mag[i], ny: gyA[i] / mag[i] });
    if (pts.length > 20000) { var step = pts.length / 20000, sub = []; for (i = 0; i < 20000; i++) sub.push(pts[Math.floor(i * step)]); pts = sub; }
    if (pts.length < 60) return null;
    var minR = 0.08 * Math.min(W, H), maxR = 0.95 * Math.max(W, H), bestFit = null;
    function onCircle(cx, cy, rad, tol) {
      var out = [];
      pts.forEach(function (p) {
        var dx = p.x - cx, dy = p.y - cy, dd = Math.hypot(dx, dy);
        if (Math.abs(dd - rad) <= tol && Math.abs((dx * p.nx + dy * p.ny) / (dd || 1)) > 0.75) out.push([p.x, p.y]);
      });
      return out;
    }
    function octants(list, cx, cy) { var m = 0; list.forEach(function (p) { m |= 1 << (Math.floor((Math.atan2(p[1] - cy, p[0] - cx) + Math.PI) / (Math.PI / 4)) & 7); }); var c = 0; for (var o = 0; o < 8; o++) if (m & (1 << o)) c++; return c; }
    // centre = E + t * n (t either sign): for every radius count the edge pixels that lie on the circle and face its centre.
    // The direction of one edge pixel is noisy, so this first pass is loose and every good candidate is then tightened step by step.
    var cands = [];
    for (var sg = -1; sg <= 1; sg += 2) for (var t = minR; t <= maxR; t += 1.5) {
      var ccx = E.x + sg * t * E.nx, ccy = E.y + sg * t * E.ny, tol0 = Math.max(3, t * 0.03), cnt0 = 0, octm = 0;
      for (var pi2 = 0; pi2 < pts.length; pi2++) {
        var pp = pts[pi2], ddx = pp.x - ccx, ddy = pp.y - ccy, d0 = Math.sqrt(ddx * ddx + ddy * ddy);
        if (Math.abs(d0 - t) <= tol0 && Math.abs((ddx * pp.nx + ddy * pp.ny) / (d0 || 1)) > 0.7) { cnt0++; octm |= 1 << (Math.floor((Math.atan2(ddy, ddx) + Math.PI) / (Math.PI / 4)) & 7); }
      }
      var oc = 0; for (var o = 0; o < 8; o++) if (octm & (1 << o)) oc++;
      if (oc >= 4) cands.push({ x: ccx, y: ccy, r: t, score: cnt0 * (oc / 8) * (oc / 8) });
    }
    cands.sort(function (p, q) { return q.score - p.score; });
    var tried = [];
    for (var ci = 0; ci < cands.length && tried.length < 12; ci++) {
      var cd = cands[ci]; if (tried.some(function (q) { return Math.hypot(q.x - cd.x, q.y - cd.y) < 8 && Math.abs(q.r - cd.r) < 8; })) continue;
      tried.push(cd);
      var fit = { x: cd.x, y: cd.y, r: cd.r }, list = [];
      [0.04, 0.025, 0.015, 0.01, 0.01].forEach(function (fr) {   // coarse to fine: refit on the pixels near the current circle
        if (!fit) return;
        var l2 = onCircle(fit.x, fit.y, fit.r, Math.max(1.5, fit.r * fr));
        if (l2.length < 25) { fit = null; return; }
        var f2 = kasa(l2); if (!f2 || !isFinite(f2.r)) { fit = null; return; }
        fit = f2; list = l2;
      });
      if (!fit) continue;
      if (Math.abs(Math.hypot(cxk - fit.x, cyk - fit.y) - fit.r) > Math.max(6, fit.r * 0.035)) continue;   // the circle has to pass through the click
      var oct = octants(list, fit.x, fit.y), res = list.map(function (p) { return Math.hypot(p[0] - fit.x, p[1] - fit.y) - fit.r; });
      var rms = Math.sqrt(res.reduce(function (s0, v) { return s0 + v * v; }, 0) / res.length), ce = Math.abs(Math.hypot(cxk - fit.x, cyk - fit.y) - fit.r), sig = Math.max(3, fit.r * 0.015);
      var score = list.length * (oct / 8) * (oct / 8) * Math.exp(-0.5 * (ce / sig) * (ce / sig));   // a circle closer to the click wins over a stronger one further away
      if (!bestFit || score > bestFit.score) bestFit = { score: score, x: fit.x, y: fit.y, r: fit.r, rms: rms, n: list.length, oct: oct };
    }
    if (!bestFit) return null;
    // the other edge of a ring (if the click was on a ring of some thickness): nearest strong radius close to the fitted one
    var hist = {}, tolH = Math.max(1.5, bestFit.r * 0.012);
    pts.forEach(function (p) {
      var dx = p.x - bestFit.x, dy = p.y - bestFit.y, dd = Math.hypot(dx, dy);
      if (Math.abs(dd - bestFit.r) > tolH * 1.5 && Math.abs(dd - bestFit.r) < bestFit.r * 0.18 && Math.abs((dx * p.nx + dy * p.ny) / (dd || 1)) > 0.75) { var key = Math.round(dd); hist[key] = (hist[key] || 0) + 1; }
    });
    var r2 = null, bc = 0;
    Object.keys(hist).forEach(function (kk) { var cnt = hist[kk] + (hist[+kk - 1] || 0) + (hist[+kk + 1] || 0); if (cnt > bc) { bc = cnt; r2 = +kk; } });
    return { x: bestFit.x / k, y: bestFit.y / k, r: bestFit.r / k, rms: bestFit.rms / k, n: bestFit.n, coverage: bestFit.oct, r2: bc >= 0.4 * bestFit.n ? r2 / k : null };
  }
  GW.refFitCircle = fitCircleAt;

  function openCalibration() {
    if (!R.src) { GW.toast('Choose a picture first.'); return; }
    var ui = GW.ui, h = ui.h, W = R.src.width, H = R.src.height, kd = Math.min(1, 620 / Math.max(W, H));
    var cv = h('canvas', { width: N(W * kd), height: N(H * kd) }), cx = cv.getContext('2d');
    cv.style.cssText = 'max-width:100%;cursor:crosshair;display:block;background:#222;border-radius:4px';
    var fit = null, manual = false, mpts = [], mode = 'outer', insetR = GW.SIZE / 2 - 8, info = h('div', { class: 'muted small', text: 'Click the ring, the edge of the display or the bezel edge that you want to line up with the screen.' });
    function paint() {
      cx.clearRect(0, 0, cv.width, cv.height); cx.drawImage(R.src, 0, 0, cv.width, cv.height);
      cx.fillStyle = '#30d158'; mpts.forEach(function (q) { cx.beginPath(); cx.arc(q[0] * kd, q[1] * kd, 3, 0, 7); cx.fill(); });
      if (!fit) return;
      cx.strokeStyle = '#ff2d55'; cx.lineWidth = 2; cx.beginPath(); cx.arc(fit.x * kd, fit.y * kd, fit.r * kd, 0, Math.PI * 2); cx.stroke();
      cx.beginPath(); cx.moveTo(fit.x * kd - 8, fit.y * kd); cx.lineTo(fit.x * kd + 8, fit.y * kd); cx.moveTo(fit.x * kd, fit.y * kd - 8); cx.lineTo(fit.x * kd, fit.y * kd + 8); cx.stroke();
      if (fit.r2) { cx.strokeStyle = '#ffd60a'; cx.setLineDash([5, 4]); cx.beginPath(); cx.arc(fit.x * kd, fit.y * kd, fit.r2 * kd, 0, Math.PI * 2); cx.stroke(); cx.setLineDash([]); }
    }
    function report() {
      if (!fit) return;
      info.textContent = 'Circle: centre (' + fit.x.toFixed(1) + ', ' + fit.y.toFixed(1) + ') px, radius ' + fit.r.toFixed(1) + ' px, fit error ' + fit.rms.toFixed(2) + ' px (' + fit.n + ' edge pixels, ' + fit.coverage + '/8 of the way round).' +
        (fit.r2 ? ' Second edge of a ring at radius ' + fit.r2.toFixed(1) + ' px (dashed yellow), thickness ' + Math.abs(fit.r2 - fit.r).toFixed(1) + ' px.' : '');
    }
    function snapEdge(px, py) {   // the strongest edge pixel within a few pixels of a manual click
      var r0 = 5, x0 = Math.max(1, Math.floor(px) - r0), y0 = Math.max(1, Math.floor(py) - r0), w = Math.min(W - 1 - x0, 2 * r0 + 1), h2 = Math.min(H - 1 - y0, 2 * r0 + 1);
      if (w < 3 || h2 < 3) return [px, py];
      var d = R.src.getContext('2d').getImageData(x0 - 1, y0 - 1, w + 2, h2 + 2).data, ww = w + 2, best = -1, bp = [px, py];
      function L(i, j) { var o = (j * ww + i) * 4; return 0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2]; }
      for (var j = 1; j <= h2; j++) for (var i = 1; i <= w; i++) {
        var gx = L(i + 1, j) - L(i - 1, j), gy = L(i, j + 1) - L(i, j - 1), m = gx * gx + gy * gy;
        if (m > best) { best = m; bp = [x0 + i - 1 + 0.5, y0 + j - 1 + 0.5]; }
      }
      return bp;
    }
    cv.addEventListener('click', function (e) {
      var b = cv.getBoundingClientRect(), px = (e.clientX - b.left) / b.width * W, py = (e.clientY - b.top) / b.height * H;
      if (manual || e.shiftKey) {   // fit through the points clicked by hand (three or more)
        mpts.push(snapEdge(px, py));
        if (mpts.length >= 3) {
          var f = kasa(mpts);
          if (f && isFinite(f.r)) {
            var res = mpts.map(function (q) { return Math.hypot(q[0] - f.x, q[1] - f.y) - f.r; });
            fit = { x: f.x, y: f.y, r: f.r, rms: Math.sqrt(res.reduce(function (s0, v) { return s0 + v * v; }, 0) / res.length), n: mpts.length, coverage: 0, r2: null };
          }
        }
        paint(); info.textContent = mpts.length < 3 ? mpts.length + ' point(s) placed. Click at least 3 points around the edge.' : ('By hand through ' + mpts.length + ' points: centre (' + fit.x.toFixed(1) + ', ' + fit.y.toFixed(1) + ') px, radius ' + fit.r.toFixed(1) + ' px, error ' + fit.rms.toFixed(2) + ' px. More points spread round the circle make it better.');
        return;
      }
      mpts = [];
      info.textContent = 'Fitting…';
      setTimeout(function () {
        fit = fitCircleAt(R.src, px, py);
        if (!fit) info.textContent = 'No circle found through that point. Click right on the edge you mean, where it is clearly visible.';
        paint(); report();
      }, 20);
    });
    var mtog = h('input', { type: 'checkbox' }); mtog.addEventListener('change', function () { manual = mtog.checked; mpts = []; fit = manual ? null : fit; paint(); info.textContent = manual ? 'Click points on the edge, all the way round (3 or more).' : 'Click the edge to fit it automatically.'; });
    var radios = h('div', { class: 'f' }, [h('label', { class: 'chk' }, [mtog, 'Place the points myself (also: hold Shift while clicking) if the automatic circle is wrong']), h('label', { text: 'What is this circle?' })]);
    [['outer', 'Display edge, outer (the very edge of the glass)'], ['centre', 'Display edge, centre-line of a ring (the ring sits on the edge)'], ['inner', 'Inner content (a circle inside the display)']].forEach(function (o) {
      var rb = h('input', { type: 'radio', name: 'refmode', value: o[0] }); rb.checked = o[0] === mode;
      rb.addEventListener('change', function () { mode = o[0]; });
      radios.appendChild(h('label', { class: 'chk' }, [rb, o[1]]));
    });
    var ins = h('input', { type: 'number', min: 10, max: GW.SIZE / 2, step: 1, value: insetR });
    ins.addEventListener('input', function () { var v = parseFloat(ins.value); if (!isNaN(v)) insetR = v; });
    var apply = h('button', { class: 'btn primary', text: 'Line the picture up', onclick: function () {
      if (!fit) { GW.toast('Click the circle in the picture first.'); return; }
      var rad = fit.r, target = GW.SIZE / 2;
      if (mode === 'centre' && fit.r2) { rad = Math.max(fit.r, fit.r2); }          // the outer edge of the ring is the display edge
      else if (mode === 'inner') { target = insetR; }
      var s = target / rad, S = GW.SIZE;
      R.s = s; R.x = S / 2 - fit.x * s; R.y = S / 2 - fit.y * s; R.s0 = R.s; R.x0 = R.x; R.y0 = R.y;
      R.calib = { cx: fit.x, cy: fit.y, r: fit.r, rms: fit.rms, mode: mode };
      R.boxes = []; R.bg = null;
      ui.closeModal(); GW.renderPanel(); redraw();
      GW.toast('Picture lined up. Nudge it in the Reference tab if it is a pixel or two off.');
    } });
    var body = h('div', {}, [cv, info, radios, h('div', { class: 'f' }, [h('label', { text: 'For "inner content": radius of that circle in screen pixels' }), ins]), h('div', { class: 'row' }, [apply])]);
    ui.modal('Find circle', body, true);
    paint();
  }

  // ---------------------------------------------------------------- finding the objects (inside the display circle only)
  var DET = 2;   // work at twice the screen resolution
  // Antialiasing and photo blur turn the edge of every glyph into extra, paler colour classes around it. Boxes of different classes that lie
  // on top of each other are one object: it takes the box and colour of the class that stands out most from the background.
  function mergeFringe(list, bg) {
    var n = list.length, par = list.map(function (_, i) { return i; });
    function find(a) { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; }
    for (var i = 0; i < n; i++) for (var j = i + 1; j < n; j++) {
      var a = list[i], b = list[j], ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox <= 0 || oy <= 0) continue;
      var ra = (a.w * a.h) / (b.w * b.h);   // a fringe is about as big as the glyph it surrounds; a big arc that merely contains a text is not its fringe
      if (ox * oy >= 0.6 * Math.min(a.w * a.h, b.w * b.h) && a.key !== b.key && ra < 2.2 && ra > 1 / 2.2) par[find(j)] = find(i);
    }
    function dist(k) { var dr = ((k >> 4) & 3) - ((bg >> 4) & 3), dg = ((k >> 2) & 3) - ((bg >> 2) & 3), db = (k & 3) - (bg & 3); return dr * dr + dg * dg + db * db; }
    var groups = {};
    list.forEach(function (o, i) { (groups[find(i)] = groups[find(i)] || []).push(o); });
    return Object.keys(groups).map(function (g) {
      var m = groups[g], maxN = Math.max.apply(null, m.map(function (o) { return o.n; })), core = m.filter(function (o) { return o.n >= 0.1 * maxN; });
      core.sort(function (a, b) { return dist(b.key) - dist(a.key) || b.n - a.n; });
      return core[0];
    });
  }
  // A paler tone (between the background and a darker/brighter colour) that lies inside a box of that stronger colour is just the antialiasing of it.
  function dropFringe(list, bg) {
    function between(k, c) { for (var sh = 4; sh >= 0; sh -= 2) { var a = (bg >> sh) & 3, b = (c >> sh) & 3, v = (k >> sh) & 3; if (v < Math.min(a, b) || v > Math.max(a, b)) return false; } return true; }
    var big = list.slice().sort(function (a, b) { return b.w * b.h - a.w * a.h; });
    return list.filter(function (o) {
      return !big.some(function (c) {
        if (c === o || c.key === o.key || o.key === bg || !between(o.key, c.key)) return false;
        var ox = Math.min(o.x + o.w, c.x + c.w) - Math.max(o.x, c.x), oy = Math.min(o.y + o.h, c.y + c.h) - Math.max(o.y, c.y), inter = ox > 0 && oy > 0 ? ox * oy : 0;
        var iou = inter / (o.w * o.h + c.w * c.h - inter);
        var inside = c.w * c.h > o.w * o.h && o.x >= c.x - 1 && o.y >= c.y - 1 && o.x + o.w <= c.x + c.w + 1 && o.y + o.h <= c.y + c.h + 1;
        return inside || iou >= 0.5;
      });
    });
  }
  function detect() {
    if (!R.src) { GW.toast('Choose a picture first.'); return; }
    var S = GW.SIZE, D = S * DET, c = document.createElement('canvas'); c.width = c.height = D;
    var x = c.getContext('2d', { willReadFrequently: true });
    x.beginPath(); x.arc(D / 2, D / 2, D / 2 - 1, 0, Math.PI * 2); x.clip();
    x.imageSmoothingQuality = 'high'; x.drawImage(R.src, R.x * DET, R.y * DET, R.src.width * R.s * DET, R.src.height * R.s * DET);
    var data = x.getImageData(0, 0, D, D).data, key = new Int16Array(D * D).fill(-1), i, hist = new Uint32Array(64);
    for (i = 0; i < D * D; i++) if (data[i * 4 + 3] > 200) { var kk = keyOf(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]); key[i] = kk; hist[kk]++; }
    // 3x3 majority filter: speckle from the photo's own noise and antialiasing goes away, solid text keeps its colour
    var k2 = new Int16Array(D * D).fill(-1), cnt = new Uint8Array(64), px, py, dx, dy;
    for (py = 1; py < D - 1; py++) for (px = 1; px < D - 1; px++) {
      i = py * D + px; if (key[i] < 0) continue;
      var seen = [], bestK = key[i], bestC = 0;
      for (dy = -1; dy <= 1; dy++) for (dx = -1; dx <= 1; dx++) { var kv = key[i + dy * D + dx]; if (kv < 0) continue; if (!cnt[kv]) seen.push(kv); cnt[kv]++; }
      seen.forEach(function (kv) { if (cnt[kv] > bestC || (cnt[kv] === bestC && kv === key[i])) { bestC = cnt[kv]; bestK = kv; } cnt[kv] = 0; });
      k2[i] = bestK;
    }
    var bg = 0, bc = -1; for (i = 0; i < 64; i++) if (hist[i] > bc) { bc = hist[i]; bg = i; }
    R.bg = bg;
    // classes: white, gray (the two mid grays), every other colour; the background colour is not an object
    var classes = {}; for (i = 0; i < D * D; i++) { var kc = k2[i]; if (kc < 0 || kc === bg) continue; (classes[kc] = classes[kc] || []).push(i); }
    var out = [];
    Object.keys(classes).forEach(function (ck) {
      var list = classes[ck]; if (list.length < 6) return;
      var m = new Uint8Array(D * D), dil = new Uint8Array(D * D); list.forEach(function (j) { m[j] = 1; });
      // light dilation (2 px sideways, 1 px up and down): the glyphs of one text join into a block
      var tmp = new Uint8Array(D * D);
      list.forEach(function (j) { var jx = j % D, jy = (j / D) | 0; for (var ddx = -2; ddx <= 2; ddx++) { var xx = jx + ddx; if (xx >= 0 && xx < D) tmp[jy * D + xx] = 1; } });
      for (var j2 = 0; j2 < D * D; j2++) if (tmp[j2]) { var jx2 = j2 % D, jy2 = (j2 / D) | 0; for (var ddy = -1; ddy <= 1; ddy++) { var yy = jy2 + ddy; if (yy >= 0 && yy < D) dil[yy * D + jx2] = 1; } }
      // connected components (4-neighbour, union-find over the dilated mask)
      var lab = new Int32Array(D * D), par = [0], nl = 0;
      function find(a) { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; }
      for (var yy2 = 0; yy2 < D; yy2++) for (var xx2 = 0; xx2 < D; xx2++) {
        var q = yy2 * D + xx2; if (!dil[q]) continue;
        var left = xx2 > 0 ? lab[q - 1] : 0, up = yy2 > 0 ? lab[q - D] : 0;
        if (!left && !up) { nl++; par[nl] = nl; lab[q] = nl; }
        else if (left && up) { lab[q] = left; var ra = find(left), rb = find(up); if (ra !== rb) par[rb] = ra; }
        else lab[q] = left || up;
      }
      var comps = {};
      list.forEach(function (j) { var l = find(lab[j]); if (!l) return; var jx = j % D, jy = (j / D) | 0, cc = comps[l]; if (!cc) cc = comps[l] = { x0: jx, y0: jy, x1: jx, y1: jy, n: 0 }; if (jx < cc.x0) cc.x0 = jx; if (jx > cc.x1) cc.x1 = jx; if (jy < cc.y0) cc.y0 = jy; if (jy > cc.y1) cc.y1 = jy; cc.n++; });
      Object.keys(comps).forEach(function (l) {
        var cc = comps[l]; if (cc.n < 6) return;
        var bx = cc.x0 / DET, by = cc.y0 / DET, bw = (cc.x1 - cc.x0 + 1) / DET, bh = (cc.y1 - cc.y0 + 1) / DET;
        if (bw > S * 0.96 && bh > S * 0.96) return;   // the whole display (a background gradient or the bezel)
        out.push({ x: bx, y: by, w: bw, h: bh, key: +ck, color: hexOfKey(+ck), n: cc.n / (DET * DET), ring: bw > S * 0.45 && bh > S * 0.45 });
      });
    });
    out = dropFringe(mergeFringe(out, bg), bg);
    out.sort(function (a, b) { return a.y - b.y || a.x - b.x; });
    out.forEach(function (b, n) { b.id = n + 1; });
    // text rows: small boxes of one colour that share a baseline and sit close together
    var small = out.filter(function (b) { return b.h <= 120 && !b.ring; }), rowId = 0, used = {};
    small.sort(function (a, b) { return a.x - b.x; });
    small.forEach(function (a) {
      if (used[a.id]) return;
      var row = [a]; used[a.id] = 1; var grew = true;
      while (grew) {
        grew = false;
        small.forEach(function (b) {
          if (used[b.id] || b.key !== a.key) return;
          var last = row[row.length - 1], bottomOk = Math.abs((b.y + b.h) - (last.y + last.h)) <= Math.max(2, 0.18 * Math.max(b.h, last.h)) || Math.abs((b.y + b.h) - (a.y + a.h)) <= Math.max(2, 0.18 * Math.max(b.h, a.h));
          var vov = Math.min(b.y + b.h, last.y + last.h) - Math.max(b.y, last.y);   // a colon or a dot does not sit on the baseline but lies within the height of the digits
          if (!bottomOk && vov >= 0.6 * Math.min(b.h, last.h)) bottomOk = true;
          var gap = b.x - (last.x + last.w);
          if (bottomOk && gap >= -2 && gap <= 1.4 * Math.max(b.h, last.h)) { row.push(b); used[b.id] = 1; grew = true; }
        });
      }
      rowId++; row.forEach(function (b) { b.row = rowId; });
      row.rowId = rowId;
    });
    // one clickable box per row (the members stay in the list for the analysis packet)
    var rows = {}; out.forEach(function (b) { if (b.row) (rows[b.row] = rows[b.row] || []).push(b); });
    var clickable = [];
    out.forEach(function (b) { if (!b.row || rows[b.row].length === 1) clickable.push({ x: b.x, y: b.y, w: b.w, h: b.h, key: b.key, color: b.color, members: [b], ring: b.ring, row: b.row }); });
    Object.keys(rows).forEach(function (rid) {
      var m = rows[rid]; if (m.length < 2) return;
      var x0 = Math.min.apply(null, m.map(function (b) { return b.x; })), y0 = Math.min.apply(null, m.map(function (b) { return b.y; })), x1 = Math.max.apply(null, m.map(function (b) { return b.x + b.w; })), y1 = Math.max.apply(null, m.map(function (b) { return b.y + b.h; }));
      clickable.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, key: m[0].key, color: m[0].color, members: m, row: +rid, isRow: true });
    });
    clickable = dropFringe(clickable, bg);
    R.all = out; R.boxes = clickable;
    R.boxes.forEach(function (b, n) { b.cid = n + 1; });
    GW.renderPanel(); redraw();
    GW.toast(R.boxes.length + ' objects found (' + Object.keys(rows).filter(function (r) { return rows[r].length > 1; }).length + ' text rows). Click one on the preview.');
  }
  GW.refDetect = detect;

  // ---------------------------------------------------------------- overlays and pointer tools
  GW.refOverlay = function (ctx, k) {
    if (R.showBoxes && R.boxes.length) {
      R.boxes.forEach(function (b) {
        var hov = R.hover === b;
        ctx.save(); ctx.lineWidth = (hov ? 2 : 1) / k; ctx.setLineDash(b.isRow ? [] : [3 / k, 2 / k]);
        ctx.strokeStyle = hov ? '#ff2d55' : (b.isRow ? '#ff9f0a' : (b.ring ? '#bf5af2' : '#0a84ff'));
        ctx.strokeRect(b.x - 0.5, b.y - 0.5, b.w + 1, b.h + 1); ctx.restore();
      });
    }
    if (R.measure && R.measure.a && R.measure.b) {
      var a = R.measure.a, b2 = R.measure.b;
      ctx.save(); ctx.strokeStyle = '#ffd60a'; ctx.fillStyle = '#ffd60a'; ctx.lineWidth = 1 / k;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b2.x, b2.y); ctx.stroke();
      ctx.beginPath(); ctx.arc(a.x, a.y, 2 / k, 0, 7); ctx.arc(b2.x, b2.y, 2 / k, 0, 7); ctx.fill();
      ctx.font = (11 / k) + 'px sans-serif'; ctx.fillText(Math.abs(b2.x - a.x).toFixed(0) + '×' + Math.abs(b2.y - a.y).toFixed(0) + '  ' + Math.hypot(b2.x - a.x, b2.y - a.y).toFixed(1) + ' px', Math.min(a.x, b2.x) + 4 / k, Math.min(a.y, b2.y) - 4 / k);
      ctx.restore();
    }
  };
  function boxAt(p) {
    var best = null, ba = 1e12;
    R.boxes.forEach(function (b) {
      if (p.x >= b.x - 2 && p.x <= b.x + b.w + 2 && p.y >= b.y - 2 && p.y <= b.y + b.h + 2) { var ar = b.w * b.h; if (ar < ba) { ba = ar; best = b; } }
    });
    return best;
  }
  function sampleAt(p) {   // palette colour of the picture at a design point
    if (!R.src) return null;
    var ix = (p.x - R.x) / R.s, iy = (p.y - R.y) / R.s; if (ix < 0 || iy < 0 || ix >= R.src.width || iy >= R.src.height) return null;
    var x0 = Math.max(0, Math.floor(ix) - 1), y0 = Math.max(0, Math.floor(iy) - 1), w = Math.min(3, R.src.width - x0), h = Math.min(3, R.src.height - y0);
    var d = R.src.getContext('2d').getImageData(x0, y0, w, h).data, r = 0, g = 0, b = 0, n = w * h;
    for (var i = 0; i < n; i++) { r += d[i * 4]; g += d[i * 4 + 1]; b += d[i * 4 + 2]; }
    var raw = toHex(N(r / n), N(g / n), N(b / n));
    return { raw: raw, hex: hexOfKey(keyOf(r / n, g / n, b / n)) };
  }
  var tip = null, menu = null;
  function hideTip() { if (tip) { tip.remove(); tip = null; } }
  function closeMenu() { if (menu) { menu.remove(); menu = null; document.removeEventListener('pointerdown', menuAway, true); } }
  function menuAway(e) { if (menu && !menu.contains(e.target)) closeMenu(); }
  GW.refPointer = function (type, p, e, el) {
    if (!R.src && !R.boxes.length) return false;
    if (R.tool === 'dropper') {
      if (type !== 'down') return true;
      var s = sampleAt(p); if (!s) { GW.toast('No picture under that point.'); return true; }
      R.dropper = s; GW.renderPanel(); GW.toast('Colour ' + s.hex + (s.raw !== s.hex ? ' (picture ' + s.raw + ')' : ''));
      try { navigator.clipboard.writeText(s.hex); } catch (x) { }
      return true;
    }
    if (R.tool === 'measure') {
      if (type === 'down') { R.measure = { a: { x: p.x, y: p.y }, b: { x: p.x, y: p.y }, on: true }; try { e.target.setPointerCapture(e.pointerId); } catch (x) { } redraw(); }
      else if (type === 'move' && R.measure && R.measure.on) { R.measure.b = { x: p.x, y: p.y }; redraw(); }
      else if (type === 'up' && R.measure) { R.measure.on = false; GW.renderPanel(); }
      return true;
    }
    if (!R.showBoxes || !R.boxes.length) return false;
    if (type === 'move') {
      var b = boxAt(p);
      if (b !== R.hover) { R.hover = b; redraw(); }
      hideTip();
      if (b && (!el || e.altKey)) {
        tip = document.createElement('div'); tip.className = 'reftip';
        tip.textContent = 'x ' + N(b.x) + '  y ' + N(b.y) + '  w ' + N(b.w) + '  h ' + N(b.h) + '  ' + b.color + (b.isRow ? '  · text row of ' + b.members.length : '');
        tip.style.left = (e.clientX + 12) + 'px'; tip.style.top = (e.clientY + 12) + 'px'; document.body.appendChild(tip);
      }
      return false;
    }
    if (type === 'down' && (!el || e.altKey)) {   // Alt + click reaches a box that lies under an element
      var bx = boxAt(p); if (!bx) return false;
      openMenu(bx, e); return true;
    }
    return false;
  };

  // ---------------------------------------------------------------- click to place
  function suggestFont(capH) {
    var f = (GW.design.fonts || []).filter(function (x) { return !x.upload; })[0];
    if (!f) {
      f = { id: 'f_ref_dmsans500', family: 'DM Sans', weight: 500, px: 22, glyphs: 'auto', spacing: 0 };
      GW.design.fonts.push(f);
    }
    var px = GW.pxForCap(f.family, f.weight, Math.max(3, N(capH)));
    return { font: f, px: px };
  }
  function placeText(b) {
    var sf = suggestFont(b.h), f = sf.font, cp = Object.assign({}, f, { px: sf.px }), met = GW.fontMetrics(cp), g = met.glyphs['0'] || met.glyphs['H'];
    var off = g ? met.asc + g.y0 + g.h / 2 - met.lineHeight / 2 : 0;   // text y is the middle of the line box, the ink sits a little off that
    var el = GW.addElement('text', { name: 'Text (from reference)', source: 'custom', text: 'TEXT', font: f.id, color: GW.q(b.color), justify: 'C', x: N(b.x + b.w / 2), y: N(b.y + b.h / 2 - off), capH: N(b.h) });
    GW.toast('Text placed. Suggested size ' + sf.px + ' px for a cap height of ' + N(b.h) + ' px (' + f.family + ').');
    return el;
  }
  function placeImage(b) {
    var w = Math.max(1, N(b.w)), h = Math.max(1, N(b.h)), c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingQuality = 'high';
    x.drawImage(R.src, (b.x - R.x) / R.s, (b.y - R.y) / R.s, b.w / R.s, b.h / R.s, 0, 0, w, h);
    var id = x.getImageData(0, 0, w, h), d = id.data;
    for (var i = 0; i < w * h; i++) if (R.bg != null && keyOf(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) === R.bg) d[i * 4 + 3] = 0;   // the display background becomes transparent
    x.putImageData(id, 0, 0);
    GW.addAsset(c.toDataURL('image/png'), function (aid) {
      GW.addElement('image', { name: 'Image (from reference)', asset: aid, w: w, h: h, x: N(b.x + b.w / 2), y: N(b.y + b.h / 2) });
      GW.toast('Image placed at its exact size (' + w + '×' + h + ' px).');
    });
  }
  function placeShape(b) {
    var thin = Math.min(b.w, b.h) <= 3, o = { name: 'Shape (from reference)', color: GW.q(b.color) };
    if (thin) {
      var horiz = b.w >= b.h, pen = Math.max(1, N(Math.min(b.w, b.h)));
      Object.assign(o, horiz ? { kind: 'line', x: N(b.x), y: N(b.y + b.h / 2), x2: N(b.x + b.w), y2: N(b.y + b.h / 2), pen: pen } : { kind: 'line', x: N(b.x + b.w / 2), y: N(b.y), x2: N(b.x + b.w / 2), y2: N(b.y + b.h), pen: pen });
    } else Object.assign(o, { kind: 'rect', fill: true, x: N(b.x + b.w / 2), y: N(b.y + b.h / 2), w: Math.max(1, N(b.w)), h: Math.max(1, N(b.h)) });
    GW.addElement('shape', o);
  }
  function openMenu(b, e) {
    closeMenu(); hideTip();
    menu = document.createElement('div'); menu.className = 'refmenu';
    var head = document.createElement('div'); head.className = 'muted small'; head.textContent = (b.isRow ? 'Text row' : 'Object') + ' · ' + N(b.w) + '×' + N(b.h) + ' at ' + N(b.x) + ', ' + N(b.y) + ' · ' + b.color;
    menu.appendChild(head);
    [['Place text here', placeText], ['Place image here', placeImage], ['Place shape here', placeShape]].forEach(function (a) {
      var btn = document.createElement('button'); btn.className = 'btn sm'; btn.textContent = a[0];
      btn.addEventListener('click', function () { closeMenu(); a[1](b); });
      menu.appendChild(btn);
    });
    menu.style.left = Math.min(window.innerWidth - 190, e.clientX + 8) + 'px'; menu.style.top = Math.min(window.innerHeight - 150, e.clientY + 8) + 'px';
    document.body.appendChild(menu);
    setTimeout(function () { document.addEventListener('pointerdown', menuAway, true); }, 0);
  }

  // ---------------------------------------------------------------- analysis packet
  function packet() {
    var S = GW.SIZE, L = [];
    L.push('# Garmin Studio: watch face analysis packet', '');
    L.push('Task: look at the attached screenshot/photo of a watch face and rebuild it as a Garmin Studio design. Return ONE JSON object (no prose around it) that the Studio can open: {"design": {"name": "...", "bg": "#000000", "fonts": [...], "elements": [...]}}.', '');
    L.push('## Device', GW.DEVICE.name + ' (' + GW.DEVICE.id + '), screen ' + S + '×' + S + ' px, round. Coordinates are screen pixels, origin top-left, x to the right, y down. Text and image elements are positioned by their CENTRE.');
    L.push('Colours: only the 64-colour palette (each channel one of 00, 55, AA, FF), e.g. #00AAFF. Anything else is snapped to it.', '');
    var objs = (R.boxes || []).slice().sort(function (a, b) { return b.w * b.h - a.w * a.h; }).slice(0, 120).sort(function (a, b) { return a.y - b.y || a.x - b.x; });
    L.push('## Objects found in the picture (inside the display circle, in screen pixels; the largest ' + objs.length + ' of ' + (R.boxes || []).length + ', top to bottom)');
    L.push('x | y | w | h | colour | kind');
    objs.forEach(function (b) { L.push([N(b.x), N(b.y), N(b.w), N(b.h), b.color, b.ring ? 'large ring or arc' : (b.isRow ? 'text row (' + b.members.length + ' glyph groups on one baseline)' : 'box')].join(' | ')); });
    L.push('Colours are the nearest of the 64 palette colours to the picture, so thin text can look paler than it is. The boxes are the ink of the objects, not the text line box: a text element is centred on the middle of its ink for digits and capitals.');
    if (R.calib) L.push('', 'The picture was lined up by fitting a circle (fit error ' + R.calib.rms.toFixed(2) + ' px, treated as: ' + R.calib.mode + ').');
    L.push('', '## Element types (the defaults show every field; omit fields you do not need)');
    Object.keys(GW.types).forEach(function (t) {
      if (t === 'dfcell') return;
      try { var def = GW.types[t].defaults(); delete def.type; L.push('- ' + t + ' (' + GW.types[t].label + '): ' + JSON.stringify(def)); } catch (x) { }
    });
    L.push('', 'Every element also needs "type", and may have "name". Typeface entries go in design.fonts: {"id":"fMain","family":"DM Sans","weight":500,"px":22,"glyphs":"auto","spacing":0}; a text element refers to it with "font":"fMain" and may override the size with "fontSize" (px) or "capH" (cap height in px). Available families: ' + GW.FONT_FAMILIES.map(function (f) { return f.family + ' ' + f.weights.join('/'); }).join(', ') + '. System fonts instead of a typeface entry: FONT_XTINY, FONT_TINY, FONT_SMALL, FONT_MEDIUM, FONT_LARGE, FONT_NUMBER_MILD, FONT_NUMBER_MEDIUM, FONT_NUMBER_HOT, FONT_NUMBER_THAI_HOT.');
    L.push('Text element "source" values (data it can show; anything else uses source "custom" with "text"):');
    GW.sourceGroups.forEach(function (g) { L.push('  ' + g + ': ' + GW.sourceList.filter(function (s) { return s.group === g; }).map(function (s) { return s.id + ' (' + s.label + ')'; }).join(', ')); });
    L.push('Arcs and segment gauges take "source" of any numeric one (kind num). Icons: {"type":"icon","kind":"<name>","size":16|20|24,"color":"#ffffff","x":..,"y":..} with names: ' + Object.keys(GW.MDI).join(', ') + '.');
    L.push('', '## Memory rules (the watch crashes to the "IQ!" screen when it runs out)');
    L.push('- fēnix 6 / 6 Pro watch face: about 112 KB for the whole app; fēnix 6X Pro about 128 KB.');
    L.push('- Every bitmap font size is a separate font in memory (a font atlas of its glyphs). Use as FEW font sizes as possible: ideally one size per typeface family, and few families. Sizes 1 px apart are merged automatically.');
    L.push('- Pictures cost about one byte per pixel; avoid full-screen images and prefer shapes, arcs, gauges and icons.');
    L.push('- Use the "Auto" character set for fonts (only the characters the design shows are exported).');
    L.push('', 'Reply with the JSON only.');
    return L.join('\n');
  }
  GW.refPacket = packet;

  // ---------------------------------------------------------------- panel
  GW.renderRefPanel = function (p) {
    var ui = GW.ui, h = ui.h, field = ui.field;
    var file = h('input', { type: 'file', accept: 'image/png,image/jpeg', hidden: true });
    file.addEventListener('change', function () { if (file.files[0]) GW.refLoad(file.files[0]); file.value = ''; });
    p.appendChild(h('div', { class: 'row' }, [h('button', { class: 'btn', text: R.src ? 'Replace picture…' : 'Choose a picture…', onclick: function () { file.click(); } }), file,
      R.src ? h('button', { class: 'btn danger', text: 'Remove', onclick: function () { R.src = null; R.boxes = []; R.all = []; R.calib = null; R.tool = null; GW.renderPanel(); redraw(); } }) : null]));
    p.appendChild(h('p', { class: 'muted small', text: 'A photo or screenshot of a watch face to trace. It stays in this browser tab and is never saved or exported.' }));
    if (!R.src) return;
    p.appendChild(h('div', { class: 'muted small mono', text: R.name + ' · ' + R.src.width + '×' + R.src.height + ' px' }));
    var show = h('input', { type: 'checkbox' }); show.checked = R.show; show.addEventListener('change', function () { R.show = show.checked; redraw(); });
    var op = h('input', { type: 'range', min: 5, max: 100, step: 1, value: Math.round(R.opacity * 100) });
    op.addEventListener('input', function () { R.opacity = op.value / 100; redraw(); });
    p.appendChild(h('label', { class: 'chk' }, [show, 'Show the picture (under all elements)']));
    p.appendChild(field('Opacity', op));
    p.appendChild(h('h4', { text: '1 · Line it up' }));
    p.appendChild(h('div', { class: 'row' }, [h('button', { class: 'btn primary', text: 'Find circle…', onclick: openCalibration })]));
    if (R.calib) p.appendChild(h('p', { class: 'muted small', text: 'Circle: centre ' + R.calib.cx.toFixed(1) + ', ' + R.calib.cy.toFixed(1) + ' px, radius ' + R.calib.r.toFixed(1) + ' px, fit error ' + R.calib.rms.toFixed(2) + ' px. Treated as: ' + ({ outer: 'display edge, outer', centre: 'display edge, centre-line', inner: 'inner content' }[R.calib.mode]) + '.' }));
    function num(label, get, set, step) {
      var i = h('input', { type: 'number', step: step, value: +get().toFixed(2) });
      i.addEventListener('input', function () { var v = parseFloat(i.value); if (!isNaN(v)) { set(v); redraw(); } });
      return field(label, i);
    }
    p.appendChild(h('div', { class: 'row' }, [
      num('Scale %', function () { return R.s / R.s0 * 100; }, function (v) { var s2 = Math.max(0.01, v / 100) * R.s0, S = GW.SIZE; R.x = S / 2 - (S / 2 - R.x) * (s2 / R.s); R.y = S / 2 - (S / 2 - R.y) * (s2 / R.s); R.s = s2; }, 0.1),
      num('Move X', function () { return R.x - R.x0; }, function (v) { R.x = R.x0 + v; }, 0.5),
      num('Move Y', function () { return R.y - R.y0; }, function (v) { R.y = R.y0 + v; }, 0.5)
    ]));
    p.appendChild(h('h4', { text: '2 · Find the objects' }));
    var sb = h('input', { type: 'checkbox' }); sb.checked = R.showBoxes; sb.addEventListener('change', function () { R.showBoxes = sb.checked; redraw(); });
    p.appendChild(h('div', { class: 'row' }, [h('button', { class: 'btn primary', text: 'Find objects', onclick: detect }), h('label', { class: 'chk' }, [sb, 'Show boxes'])]));
    p.appendChild(h('p', { class: 'muted small', text: R.boxes.length ? R.boxes.length + ' objects. Hover for size and colour, click one on the preview (Alt+click if an element is in the way) to place text, an image or a shape there. Blue = one object, orange = a row of text, purple = a large ring.' : 'Only the inside of the display circle is searched. Line the picture up first.' }));
    p.appendChild(h('h4', { text: '3 · Measure' }));
    function toolBtn(id, label) { return h('button', { class: 'btn' + (R.tool === id ? ' primary' : ''), text: label, onclick: function () { R.tool = R.tool === id ? null : id; if (R.tool !== 'measure') R.measure = null; GW.renderPanel(); redraw(); } }); }
    p.appendChild(h('div', { class: 'row' }, [toolBtn('dropper', 'Eyedropper'), toolBtn('measure', 'Measure')]));
    if (R.tool === 'dropper') p.appendChild(h('p', { class: 'muted small', text: 'Click a point on the preview: the colour is snapped to the 64-colour palette and copied.' }));
    if (R.tool === 'measure') p.appendChild(h('p', { class: 'muted small', text: 'Drag on the preview from one point to another.' + (R.measure ? ' Last: ' + Math.abs(R.measure.b.x - R.measure.a.x).toFixed(0) + ' × ' + Math.abs(R.measure.b.y - R.measure.a.y).toFixed(0) + ' px, length ' + Math.hypot(R.measure.b.x - R.measure.a.x, R.measure.b.y - R.measure.a.y).toFixed(1) + ' px.' : '') }));
    if (R.dropper) {
      var sel = GW.selected(), canUse = sel && 'color' in sel;
      p.appendChild(h('div', { class: 'row', style: 'align-items:center' }, [
        h('span', { style: 'display:inline-block;width:22px;height:22px;border-radius:4px;border:1px solid var(--line2);background:' + R.dropper.hex }),
        h('span', { class: 'mono', text: R.dropper.hex + (R.dropper.raw !== R.dropper.hex ? '  (picture ' + R.dropper.raw + ')' : '') }),
        canUse ? h('button', { class: 'btn sm', text: 'Use for selected', onclick: function () { sel.color = R.dropper.hex; GW.commit(false); } }) : null
      ]));
    }
    p.appendChild(h('h4', { text: '4 · Hand it to Claude' }));
    p.appendChild(h('div', { class: 'row' }, [h('button', { class: 'btn', text: 'Copy analysis packet', onclick: function () {
      var t = packet();
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { GW.toast('Packet copied. Paste it into a Claude chat together with the picture.'); }, function () { GW.toast('Could not copy automatically.'); });
    } })]));
    p.appendChild(h('p', { class: 'muted small', text: 'Paste the packet and the screenshot into a Claude chat. Paste the JSON it returns below, then Open.' }));
    var ta = h('textarea', { rows: 5, placeholder: 'Paste the returned JSON here', style: 'width:100%;font-family:monospace;font-size:11px' });
    p.appendChild(ta);
    p.appendChild(h('div', { class: 'row' }, [h('button', { class: 'btn', text: 'Open', onclick: function () {
      var obj; try { obj = JSON.parse(ta.value.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '')); } catch (x) { GW.toast('That is not valid JSON.'); return; }
      if (!obj || !(obj.design || obj.elements)) { GW.toast('No design found in that JSON.'); return; }
      GW.loadFrom(obj, function () { GW.fontsReady().then(function () { GW.touch(true); GW.toast('Design opened.'); }); });
    } })]));
  };
})(window.GW);
