/* Reference image, part 2: what each element type can read off a region of the picture.
   Every type may carry   fromRegion(region, P)  -> { props, note?, choices?, addFont?, assetDataUrl? } | null   and   suggest(region, P) -> 0..1.
   The Reference tool lists GW.types, so a type added later is offered without any change here (it is then placed centred and sized to fit).
   region: { x, y, w, h, color, key, members[], bg, centre, all[] }   (design pixels; members are the detected objects inside it)
   P: pixels of the region: P.fgPts() (design px), P.mask1 (fg at 1x), P.keyAt(x, y), P.hist(), P.canvas1 (crop at 1x), P.w1, P.h1, P.x0, P.y0 */
(function (GW) {
  'use strict';
  var T = GW.types, U = function () { return GW.refUtil; }, N = Math.round;
  function dist2(k, bg) { var dr = ((k >> 4) & 3) - ((bg >> 4) & 3), dg = ((k >> 2) & 3) - ((bg >> 2) & 3), db = (k & 3) - (bg & 3); return dr * dr + dg * dg + db * db; }
  function median(a) { if (!a.length) return 0; var s = a.slice().sort(function (p, q) { return p - q; }); return s[Math.floor(s.length / 2)]; }
  function pct(a, p) { if (!a.length) return 0; var s = a.slice().sort(function (x, y) { return x - y; }); return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))]; }
  function clockDeg(dx, dy) { return (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360; }   // 0 at 12 o'clock, clockwise
  function sample(pts, n) { if (pts.length <= n) return pts; var o = [], st = pts.length / n; for (var i = 0; i < n; i++) o.push(pts[Math.floor(i * st)]); return o; }
  // the colour with the most contrast against the background is the "lit" one, a second colour is the track / unlit one
  function litAndTrack(P, region) {
    var h = P.hist(), keys = Object.keys(h).map(Number).filter(function (k) { return k !== region.bg && h[k] >= 0.06 * Math.max.apply(null, Object.keys(h).map(function (q) { return h[q]; })); });
    if (!keys.length) return { lit: region.key, track: null };
    keys.sort(function (a, b) { return dist2(b, region.bg) - dist2(a, region.bg); });
    var lit = keys[0], others = keys.slice(1).filter(function (k) { return h[k] >= 0.15 * h[lit] || keys.length === 2; }).sort(function (a, b) { return h[b] - h[a]; });
    return { lit: lit, track: others.length ? others[0] : null, keys: keys };
  }
  function hex(k) { return U().hexOfKey(k); }
  function objs(region) { return region.members && region.members.length ? region.members : []; }
  function centreOf(o) { return { x: o.x + o.w / 2, y: o.y + o.h / 2 }; }
  function bboxOf(list) {
    var x0 = Math.min.apply(null, list.map(function (b) { return b.x; })), y0 = Math.min.apply(null, list.map(function (b) { return b.y; }));
    return { x: x0, y: y0, w: Math.max.apply(null, list.map(function (b) { return b.x + b.w; })) - x0, h: Math.max.apply(null, list.map(function (b) { return b.y + b.h; })) - y0 };
  }
  function pitchStats(list) {   // objects of a row: regular spacing?
    var s = list.slice().sort(function (a, b) { return a.x - b.x; }), p = [];
    for (var i = 1; i < s.length; i++) p.push(s[i].x - s[i - 1].x);
    var m = median(p), dev = p.length ? Math.max.apply(null, p.map(function (v) { return Math.abs(v - m); })) : 0;
    return { sorted: s, pitch: m, dev: dev, regular: p.length >= 2 && dev <= Math.max(1.5, 0.12 * m) };
  }
  function iconMatches(region, P) {
    var sizes = GW.ICON_SIZES || [16, 20, 24], out = [], m1 = P.mask1, w1 = P.w1, h1 = P.h1, i;
    var rb = { x0: w1, y0: h1, x1: -1, y1: -1 };
    for (var yy = 0; yy < h1; yy++) for (var xx = 0; xx < w1; xx++) if (m1[yy * w1 + xx]) { if (xx < rb.x0) rb.x0 = xx; if (xx > rb.x1) rb.x1 = xx; if (yy < rb.y0) rb.y0 = yy; if (yy > rb.y1) rb.y1 = yy; }
    if (rb.x1 < 0) return [];
    var rw = rb.x1 - rb.x0 + 1, rh = rb.y1 - rb.y0 + 1;
    Object.keys(GW.MDI).forEach(function (name) {
      var best = null;
      sizes.forEach(function (sz) {
        var el = { kind: name, size: sz, x: 20, y: 20, color: '#ffffff' }, c = document.createElement('canvas'); c.width = c.height = 40;
        var x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#000'; x.fillRect(0, 0, 40, 40);
        var pl = GW.iconPlace(el); if (!pl) return;
        GW.drawText(x, pl.fid, pl.ch, pl.x, pl.yc, 'L', '#ffffff');
        var d = x.getImageData(0, 0, 40, 40).data, g = new Uint8Array(1600), gx0 = 40, gy0 = 40, gx1 = -1, gy1 = -1;
        for (var j = 0; j < 1600; j++) if (d[j * 4] > 110) { g[j] = 1; var jx = j % 40, jy = (j / 40) | 0; if (jx < gx0) gx0 = jx; if (jx > gx1) gx1 = jx; if (jy < gy0) gy0 = jy; if (jy > gy1) gy1 = jy; }
        if (gx1 < 0) return;
        var gw = gx1 - gx0 + 1, gh = gy1 - gy0 + 1;
        if (Math.abs(gw - rw) > 3 || Math.abs(gh - rh) > 3) return;   // only icons about the size of the region compete
        for (var oy = -2; oy <= 2; oy++) for (var ox = -2; ox <= 2; ox++) {
          var inter = 0, uni = 0;
          for (var py = -2; py < Math.max(rh, gh) + 2; py++) for (var px = -2; px < Math.max(rw, gw) + 2; px++) {
            var a = 0, b = 0, rx = rb.x0 + px, ry = rb.y0 + py;
            if (px >= 0 && py >= 0 && rx >= 0 && ry >= 0 && rx < w1 && ry < h1) a = m1[ry * w1 + rx];
            var qx = gx0 + px + ox, qy = gy0 + py + oy; if (qx >= 0 && qy >= 0 && qx < 40 && qy < 40 && px >= 0 && py >= 0) b = g[qy * 40 + qx];
            if (a || b) uni++; if (a && b) inter++;
          }
          var iou = uni ? inter / uni : 0; if (!best || iou > best.iou) best = { name: name, size: sz, iou: iou };
        }
      });
      if (best) out.push(best);
    });
    out.sort(function (a, b) { return b.iou - a.iou; });
    return out;
  }
  GW.refIconMatches = iconMatches;
  function previewCanvas(name, size, color) {
    var c = document.createElement('canvas'); c.width = c.height = size + 8; var x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
    var pl = GW.iconPlace({ kind: name, size: size, x: (size + 8) / 2, y: (size + 8) / 2, color: color }); if (pl) GW.drawText(x, pl.fid, pl.ch, pl.x, pl.yc, 'L', GW.q(color));
    c.style.cssText = 'width:' + (size + 8) * 2 + 'px;height:' + (size + 8) * 2 + 'px;image-rendering:pixelated;border-radius:3px'; return c;
  }

  // ---------------------------------------------------------------- Text / data
  T.text.suggest = function (region) { var m = objs(region); return region.h <= 60 ? (m.length >= 2 ? 0.8 : 0.5) : 0.2; };
  T.text.fromRegion = function (region, P) {
    var S = GW.SIZE, f = (GW.design.fonts || []).filter(function (x) { return !x.upload; })[0], addFont = null;
    if (!f) { f = { id: 'f_ref_dmsans500', family: 'DM Sans', weight: 500, px: 22, glyphs: 'auto', spacing: 0 }; addFont = f; }
    var px = GW.pxForCap(f.family, f.weight, Math.max(3, N(region.h))), cp = Object.assign({}, f, { px: px }), met = GW.fontMetrics(cp), g = met.glyphs['0'] || met.glyphs['H'];
    var off = g ? met.asc + g.y0 + g.h / 2 - met.lineHeight / 2 : 0;
    var props = { source: 'custom', text: 'TEXT', font: f.id, color: GW.q(region.color), justify: 'C', x: N(region.x + region.w / 2), y: N(region.y + region.h / 2 - off), capH: N(region.h) };
    var notes = ['suggested size ' + px + ' px (' + f.family + ') for a cap height of ' + N(region.h) + ' px'];
    // a colon between digit groups looks like a time
    var m = objs(region).filter(function (o) { return o.h < 0.5 * region.h && o.w < 0.4 * region.h; });
    if (m.length >= 2 && region.members.length >= 5 && region.h >= 20) { props.source = 'time'; notes.push('looks like a time (a colon was found)'); }
    else {   // an icon just left of the text names the data: the other detected objects are searched, the icon set is matched against them
      var near = (region.all || []).filter(function (o) { return o.x + o.w <= region.x + 2 && region.x - (o.x + o.w) < 34 && Math.abs((o.y + o.h / 2) - (region.y + region.h / 2)) < Math.max(10, region.h) && o.w <= 30 && o.h <= 30; })
        .sort(function (a, b) { return (region.x - (a.x + a.w)) - (region.x - (b.x + b.w)); })[0];
      if (near && GW.refPixelsOf) {
        var np = GW.refPixelsOf({ x: near.x, y: near.y, w: near.w, h: near.h, color: near.color, key: near.key, members: [near], bg: region.bg });
        var best = iconMatches({ x: near.x, y: near.y, w: near.w, h: near.h, bg: region.bg }, np)[0];
        if (best && best.iou >= 0.5) {
          var src = Object.keys(GW.ICON_FOR).filter(function (k) { return GW.ICON_FOR[k] === best.name; })[0];
          if (src) { props.source = src; notes.push('source ' + src + ' from the icon on its left (' + best.name + ', overlap ' + best.iou.toFixed(2) + ')'); }
        }
      }
    }
    if (props.source !== 'custom') delete props.text;
    return { props: props, addFont: addFont, note: notes.join('; ') };
  };

  // ---------------------------------------------------------------- Arc gauge
  T.arc.suggest = function (region, P) {
    var pts = sample(P.fgPts(), 800); if (pts.length < 30 || region.w < 30 || region.h < 20) return 0.1;
    var f = U().kasa(pts); if (!f || !isFinite(f.r) || f.r > 400) return 0.1;
    var res = pts.map(function (p) { return Math.abs(Math.hypot(p[0] - f.x, p[1] - f.y) - f.r); }), band = pct(res, 0.9);
    return band < Math.max(3, 0.15 * f.r) && f.r > 18 ? 0.9 : 0.1;
  };
  T.arc.fromRegion = function (region, P) {
    var pts = sample(P.fgPts(), 3000); if (pts.length < 20) return null;
    var f = U().kasa(pts); if (!f || !isFinite(f.r)) return null;
    var d = pts.map(function (p) { return Math.hypot(p[0] - f.x, p[1] - f.y); }), r = median(d), pen = Math.max(1, N(pct(d, 0.97) - pct(d, 0.03) + 1));
    // the largest empty stretch of angle is the opening of the arc
    var bins = new Uint8Array(360); pts.forEach(function (p) { bins[Math.floor(clockDeg(p[0] - f.x, p[1] - f.y)) % 360] = 1; });
    var bestRun = 0, bestAt = 0, run = 0;
    for (var i = 0; i < 720; i++) { if (!bins[i % 360]) { run++; if (run > bestRun) { bestRun = run; bestAt = (i - run + 1 + 360) % 360; } } else run = 0; }
    bestRun = Math.min(bestRun, 359);
    var start = bestRun > 4 ? (bestAt + bestRun) % 360 : 0, sweep = bestRun > 4 ? 360 - bestRun : 360;
    var lt = litAndTrack(P, region), litAng = [];
    P.pointsOfKey(lt.lit).forEach(function (p) { litAng.push((clockDeg(p[0] - f.x, p[1] - f.y) - start + 360) % 360); });
    var dir = 'cw', litShare = 1;
    if (lt.track != null && litAng.length) {
      var mn = Math.min.apply(null, litAng), mx = Math.max.apply(null, litAng);
      if (mn > sweep * 0.05 && mx > sweep * 0.9) dir = 'ccw';   // the lit part runs from the far end: the gauge fills the other way round
      litShare = Math.max(0, Math.min(1, (mx - mn) / sweep));
    }
    if (dir === 'ccw') { var s2 = (start + sweep) % 360; start = s2; }
    return { props: { cx: N(f.x), cy: N(f.y), r: N(r), pen: pen, start: N(start), sweep: N(sweep), dir: dir, color: hex(lt.lit), track: lt.track != null ? hex(lt.track) : 'auto', round: false },
      note: 'circle fit: centre ' + N(f.x) + ', ' + N(f.y) + ', radius ' + N(r) + ', thickness ' + pen + ' px, sweep ' + N(sweep) + '°' + (lt.track != null ? '; lit part about ' + N(litShare * 100) + '% of the arc' : '') };
  };

  // ---------------------------------------------------------------- Analog hands
  T.hands.suggest = function (region, P) {
    return objs(region).some(function (o) {
      if (Math.max(o.w, o.h) < 25) return false;
      var pts = P.pointsInBox(o); if (pts.length < 20) return false;
      var mx = 0, my = 0; pts.forEach(function (p) { mx += p[0]; my += p[1]; }); mx /= pts.length; my /= pts.length;
      var sxx = 0, sxy = 0, syy = 0; pts.forEach(function (p) { var a = p[0] - mx, b = p[1] - my; sxx += a * a; sxy += a * b; syy += b * b; });
      var tr = sxx + syy, det = sxx * syy - sxy * sxy, d = Math.sqrt(Math.max(0, tr * tr / 4 - det)), l1 = tr / 2 + d, l2 = tr / 2 - d;
      return l2 > 0 && Math.sqrt(l1 / l2) > 6;
    }) ? 0.6 : 0.1;
  };
  T.hands.fromRegion = function (region, P) {
    var S = GW.SIZE, cx = S / 2, cy = S / 2;   // hands turn about the middle of the screen
    var cand = objs(region).map(function (o) {
      var pts = P.pointsInBox(o); if (pts.length < 6) return null;
      var mx = 0, my = 0; pts.forEach(function (p) { mx += p[0]; my += p[1]; }); mx /= pts.length; my /= pts.length;
      var sxx = 0, sxy = 0, syy = 0; pts.forEach(function (p) { var a = p[0] - mx, b = p[1] - my; sxx += a * a; sxy += a * b; syy += b * b; });
      var th = 0.5 * Math.atan2(2 * sxy, sxx - syy), ux = Math.cos(th), uy = Math.sin(th), tmin = 1e9, tmax = -1e9, smin = 1e9, smax = -1e9;
      pts.forEach(function (p) { var t = (p[0] - mx) * ux + (p[1] - my) * uy, s = -(p[0] - mx) * uy + (p[1] - my) * ux; if (t < tmin) tmin = t; if (t > tmax) tmax = t; if (s < smin) smin = s; if (s > smax) smax = s; });
      // the end farther from the screen centre is the tip
      var ex = mx + ux * tmax, ey = my + uy * tmax, fx = mx + ux * tmin, fy = my + uy * tmin, tipFar = Math.hypot(ex - cx, ey - cy) >= Math.hypot(fx - cx, fy - cy);
      var tip = tipFar ? [ex, ey] : [fx, fy];
      return { len: Math.hypot(tip[0] - cx, tip[1] - cy), thick: Math.max(1, (pts.length / 4) / Math.max(1, tmax - tmin)), color: o.key, elong: (tmax - tmin) / Math.max(1, smax - smin), ang: clockDeg(tip[0] - cx, tip[1] - cy) };
    }).filter(function (c) { return c && c.elong > 3; }).sort(function (a, b) { return b.len - a.len; });
    if (!cand.length) return null;
    var props = { cx: N(cx), cy: N(cy) }, rest = cand.slice(), second = null;
    if (rest.length >= 3) { rest.sort(function (a, b) { return a.thick - b.thick; }); second = rest.shift(); rest.sort(function (a, b) { return b.len - a.len; }); }
    var minute = rest[0], hour = rest[1];
    if (minute) { props.mLen = N(minute.len); props.mW = Math.max(1, N(minute.thick)); props.mColor = hex(minute.color); }
    if (hour) { props.hLen = N(hour.len); props.hW = Math.max(1, N(hour.thick)); props.hColor = hex(hour.color); }
    if (second) { props.sShow = true; props.sLen = N(second.len); props.sW = Math.max(1, N(second.thick)); props.sColor = hex(second.color); } else props.sShow = false;
    return { props: props, note: cand.length + ' elongated parts found; hands turn about the middle of the screen (' + N(cx) + ', ' + N(cy) + '); minute hand points at ' + (minute ? N(minute.ang) : '-') + '°' + (hour ? ', hour hand at ' + N(hour.ang) + '°' : '') };
  };

  // ---------------------------------------------------------------- Dial ticks
  T.ticks.suggest = function (region) { var m = objs(region); return m.length >= 12 && region.w > 100 && region.h > 100 ? 0.85 : 0.1; };
  T.ticks.fromRegion = function (region, P) {
    var S = GW.SIZE, c = region.centre || { x: S / 2, y: S / 2 }, pts = P.fgPts(); if (pts.length < 30) return null;
    var BINS = 720, rmin = new Float32Array(BINS).fill(1e9), rmax = new Float32Array(BINS).fill(-1), occ = new Uint8Array(BINS);
    var cntB = new Float32Array(BINS);
    pts.forEach(function (p) { var a = Math.floor(clockDeg(p[0] - c.x, p[1] - c.y) * 2) % BINS, r = Math.hypot(p[0] - c.x, p[1] - c.y); occ[a] = 1; cntB[a]++; if (r < rmin[a]) rmin[a] = r; if (r > rmax[a]) rmax[a] = r; });
    var runs = [], i = 0, start = occ[0] ? -1 : 0;
    // ticks are runs of occupied angle bins (wrapping round 0°)
    var first = 0; while (first < BINS && occ[first]) first++;
    if (first === BINS) return null;
    for (var k = 0; k < BINS; k++) {
      var b = (first + k) % BINS;
      if (occ[b]) { var last = runs[runs.length - 1]; if (last && last.end === k - 1) { last.end = k; last.cnt += cntB[b]; last.rmin = Math.min(last.rmin, rmin[b]); last.rmax = Math.max(last.rmax, rmax[b]); } else runs.push({ s: k, end: k, cnt: cntB[b], rmin: rmin[b], rmax: rmax[b], at: first }); }
    }
    runs.forEach(function (r) { r.ang = ((first + (r.s + r.end) / 2) % BINS) / 2; r.len = r.rmax - r.rmin + 1; r.width = (r.cnt / 4) / r.len; var ra = (((first + (r.s + r.end) / 2) % BINS) / 2) * Math.PI / 180, rm = (r.rmin + r.rmax) / 2; r.key = P.keyAt(c.x + rm * Math.sin(ra), c.y - rm * Math.cos(ra)); });
    if (runs.length < 6) return null;
    var angs = runs.map(function (r) { return r.ang; }).sort(function (a, b) { return a - b; }), gaps = [];
    for (var j = 1; j < angs.length; j++) gaps.push(angs[j] - angs[j - 1]);
    var spacing = median(gaps), count = Math.max(4, N(360 / spacing));
    var nice = [8, 12, 16, 20, 24, 30, 36, 40, 48, 60, 72, 90, 120, 180, 360].filter(function (n) { return Math.abs(n - count) <= Math.max(1, 0.06 * count); })[0]; if (nice) count = nice;
    var lens = runs.map(function (r) { return r.len; }), ls = Math.min.apply(null, lens), lmax = Math.max.apply(null, lens);
    var longRuns = lmax > ls * 1.3 + 1 ? runs.filter(function (r) { return r.len > (ls + lmax) / 2; }) : [];
    var rOuter = N(median(runs.map(function (r) { return r.rmax; })) + 0.5);
    var props = { cx: N(c.x), cy: N(c.y), r: rOuter, count: count, len: Math.max(1, N(median(runs.filter(function (r) { return longRuns.indexOf(r) < 0; }).map(function (r) { return r.len; })))), width: Math.max(1, N(median(runs.filter(function (r) { return longRuns.indexOf(r) < 0; }).map(function (r) { return r.width; })))), color: GW.q(region.color) };
    var shortRun = runs.filter(function (r) { return longRuns.indexOf(r) < 0 && r.key >= 0 && r.key !== region.bg; })[0]; if (shortRun) props.color = hex(shortRun.key);
    if (longRuns.length >= 2) {
      var la = longRuns.map(function (r) { return r.ang; }).sort(function (a, b) { return a - b; }), lg = []; for (var q = 1; q < la.length; q++) lg.push(la[q] - la[q - 1]);
      var every = Math.max(1, N(median(lg) / (360 / count)));
      props.major = every; props.majorLen = N(median(longRuns.map(function (r) { return r.len; }))); props.majorWidth = Math.max(1, N(median(longRuns.map(function (r) { return r.width; }))));
      if (longRuns[0].key >= 0 && longRuns[0].key !== region.bg) props.majorColor = hex(longRuns[0].key);
    } else { props.major = 0; }
    return { props: props, note: runs.length + ' ticks found, ' + count + ' per turn, ' + (longRuns.length ? longRuns.length + ' longer ones (every ' + props.major + ')' : 'all the same length') + '; centre taken as ' + N(c.x) + ', ' + N(c.y) };
  };

  // ---------------------------------------------------------------- Line / box / circle
  T.shape.suggest = function (region) { var m = objs(region); return m.length === 1 ? 0.45 : 0.2; };
  T.shape.fromRegion = function (region, P) {
    var w = region.w, h = region.h, pts = P.fgPts(), area = pts.length / 4;   // fg points are at 2x
    if (Math.min(w, h) <= 3.2 && Math.max(w, h) >= 5) {
      var horiz = w >= h, o = { kind: 'line', pen: Math.max(1, N(Math.min(w, h))), color: GW.q(region.color) };
      if (Math.abs(w - h) > 0.3 * Math.max(w, h) && (w < 6 || h < 6)) Object.assign(o, horiz ? { x: N(region.x), y: N(region.y + h / 2), x2: N(region.x + w), y2: N(region.y + h / 2) } : { x: N(region.x + w / 2), y: N(region.y), x2: N(region.x + w / 2), y2: N(region.y + h) });
      return { props: o, note: 'thin object: a line, ' + o.pen + ' px wide' };
    }
    // a diagonal line: elongated along one axis of the points
    var mx = 0, my = 0; pts.forEach(function (p) { mx += p[0]; my += p[1]; }); mx /= pts.length; my /= pts.length;
    var sxx = 0, sxy = 0, syy = 0; pts.forEach(function (p) { var a = p[0] - mx, b = p[1] - my; sxx += a * a; sxy += a * b; syy += b * b; });
    var tr = sxx + syy, det = sxx * syy - sxy * sxy, l1 = tr / 2 + Math.sqrt(Math.max(0, tr * tr / 4 - det)), l2 = tr / 2 - Math.sqrt(Math.max(0, tr * tr / 4 - det));
    if (l2 > 0 && Math.sqrt(l1 / l2) > 8) {
      var th = 0.5 * Math.atan2(2 * sxy, sxx - syy), ux = Math.cos(th), uy = Math.sin(th), tmin = 1e9, tmax = -1e9;
      pts.forEach(function (p) { var t = (p[0] - mx) * ux + (p[1] - my) * uy; if (t < tmin) tmin = t; if (t > tmax) tmax = t; });
      return { props: { kind: 'line', x: N(mx + ux * tmin), y: N(my + uy * tmin), x2: N(mx + ux * tmax), y2: N(my + uy * tmax), pen: Math.max(1, N(pts.length / 4 / (tmax - tmin))), color: GW.q(region.color) }, note: 'a slanted line between the two ends of the object' };
    }
    var fill = area / (w * h), asp = w / h;
    if (asp > 0.8 && asp < 1.25 && fill > 0.6 && fill < 0.9) return { props: { kind: 'circle', x: N(region.x + w / 2), y: N(region.y + h / 2), r: N(Math.max(w, h) / 2), fill: true, color: GW.q(region.color) }, note: 'round blob: a filled circle' };
    if (asp > 0.8 && asp < 1.25 && fill > 0.1 && fill <= 0.6) { var rr = Math.max(w, h) / 2; var pen0 = Math.max(1, N(area / (2 * Math.PI * rr))); return { props: { kind: 'circle', x: N(region.x + w / 2), y: N(region.y + h / 2), r: N(rr - pen0 / 2), fill: false, pen: pen0, color: GW.q(region.color) }, note: 'ring: a circle outline (radius to the middle of the line)' }; }
    var props = { kind: 'rect', x: N(region.x + w / 2), y: N(region.y + h / 2), w: N(w), h: N(h), color: GW.q(region.color), fill: fill > 0.7 };
    if (!props.fill) { props.pen = Math.max(1, N(area / (2 * (w + h)))); props.w = N(w - props.pen); props.h = N(h - props.pen); }
    // rounded corners: how far in from the corner does the top row start
    var rad = 0; for (var xx = 0; xx < Math.min(P.w1, 40); xx++) if (P.mask1[(P.padTop1) * P.w1 + P.padLeft1 + xx]) { rad = xx; break; }
    if (rad >= 2 && rad < Math.min(w, h) / 2) props.rad = rad;
    return { props: props, note: (props.fill ? 'filled box' : 'box outline, ' + props.pen + ' px') + (props.rad ? ', rounded corners (about ' + props.rad + ' px)' : '') };
  };

  // ---------------------------------------------------------------- Image (PNG)
  T.image.suggest = function () { return 0.3; };
  T.image.fromRegion = function (region, P) {
    var w = Math.max(1, N(region.w)), h = Math.max(1, N(region.h)), c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingQuality = 'high';
    var R = GW.ref; x.drawImage(R.src, (region.x - R.x) / R.s, (region.y - R.y) / R.s, region.w / R.s, region.h / R.s, 0, 0, w, h);
    var id = x.getImageData(0, 0, w, h), d = id.data, U0 = U();
    for (var i = 0; i < w * h; i++) if (region.bg != null && U0.keyOf(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) === region.bg) d[i * 4 + 3] = 0;   // the display background becomes transparent
    x.putImageData(id, 0, 0);
    var kb = Math.round(w * h / 1024 * 10) / 10;
    return { props: { x: N(region.x + region.w / 2), y: N(region.y + region.h / 2), w: w, h: h }, assetDataUrl: c.toDataURL('image/png'),
      note: 'picture ' + w + '×' + h + ' px, about ' + kb + ' KB of watch memory' + (w * h > 20000 ? ' (large: a shape, gauge or icon would cost far less)' : '') };
  };

  // ---------------------------------------------------------------- Bar chart
  T.barchart.suggest = function (region) {
    var m = objs(region).filter(function (o) { return o.h > 3; }); if (m.length < 5) return 0.1;
    var bottoms = m.map(function (o) { return o.y + o.h; }), md = median(bottoms), same = m.filter(function (o) { return Math.abs(o.y + o.h - md) <= 2; });
    var hs = same.map(function (o) { return o.h; });
    return same.length >= 5 && Math.max.apply(null, hs) - Math.min.apply(null, hs) > 3 ? 0.9 : 0.15;
  };
  T.barchart.fromRegion = function (region, P) {
    var m = objs(region).filter(function (o) { return o.h > 2; }); if (m.length < 3) return null;
    var md = median(m.map(function (o) { return o.y + o.h; })), bars = m.filter(function (o) { return Math.abs(o.y + o.h - md) <= 2; }).sort(function (a, b) { return a.x - b.x; });
    var bw = median(bars.map(function (o) { return o.w; })); bars = bars.filter(function (o) { return Math.abs(o.w - bw) <= Math.max(2, bw * 0.3); });
    if (bars.length < 3) return null;
    var gaps = []; for (var i = 1; i < bars.length; i++) gaps.push(bars[i].x - (bars[i - 1].x + bars[i - 1].w));
    var gap = Math.max(0, N(median(gaps))), n = bars.length, hmax = Math.max.apply(null, bars.map(function (o) { return o.h; }));
    var tracks = m.filter(function (o) { return bars.indexOf(o) < 0 && Math.abs(o.y + o.h - md) <= 2 && o.h >= hmax - 2; });
    var keys = bars.map(function (o) { return o.key; }), count = {}; keys.forEach(function (k) { count[k] = (count[k] || 0) + 1; });
    var domKey = Object.keys(count).sort(function (a, b) { return count[b] - count[a]; })[0], last = bars[bars.length - 1];
    var total = n * N(bw) + (n - 1) * gap, props = { x: N(bars[0].x + (bars[n - 1].x + bars[n - 1].w - bars[0].x) / 2), y: N(md - hmax / 2), w: total, h: N(hmax), gap: gap, bars: n === 7 ? 7 : 8, color: hex(+domKey), todayColor: hex(last.key) };
    if (tracks.length) props.unlit = hex(tracks[0].key);
    return { props: props, note: n + ' bars of ' + N(bw) + ' px with ' + gap + ' px gaps' + (n !== 7 && n !== 8 ? ' (Studio draws 7 or 8: check the count)' : '') + (tracks.length ? '; empty tracks found' : '') };
  };

  // ---------------------------------------------------------------- Move bar
  T.movebar.suggest = function (region) {
    var m = objs(region); if (m.length < 4 || m.length > 6) return 0.1;
    var ps = pitchStats(m), ws = m.map(function (o) { return o.w; });
    return ps.regular && Math.max.apply(null, ws) - Math.min.apply(null, ws) <= 2 ? 0.8 : 0.2;
  };
  T.movebar.fromRegion = function (region, P) {
    var m = objs(region).slice().sort(function (a, b) { return a.x - b.x; }); if (m.length < 3) return null;
    var bb = bboxOf(m), gaps = []; for (var i = 1; i < m.length; i++) gaps.push(m[i].x - (m[i - 1].x + m[i - 1].w));
    var keys = m.map(function (o) { return o.key; }).filter(function (k, i, a) { return a.indexOf(k) === i; }).sort(function (a, b) { return dist2(b, region.bg) - dist2(a, region.bg); });
    var hs = m.map(function (o) { return o.h; });
    return { props: { x: N(bb.x + bb.w / 2), y: N(bb.y + bb.h / 2), w: N(bb.w), h: N(Math.max.apply(null, hs)), gap: Math.max(0, N(median(gaps))), color: hex(keys[0]), off: keys.length > 1 ? hex(keys[keys.length - 1]) : '#555555', ramp: keys.length > 2 },
      note: m.length + ' segments found (the Move bar always has 5)' };
  };

  // ---------------------------------------------------------------- Moon phase, Binary clock, Weather icon, World map, Sun icon
  T.moon.suggest = function (region) { var a = region.w / region.h; return a > 0.8 && a < 1.25 && region.w >= 14 && region.w <= 80 ? 0.5 : 0.1; };
  T.moon.fromRegion = function (region, P) {
    var lt = litAndTrack(P, region), bb = P.bbox();   // the dark side counts too: it may lie outside the lit crescent's box
    return { props: { x: N(bb.x + bb.w / 2), y: N(bb.y + bb.h / 2), r: Math.max(4, N(Math.max(bb.w, bb.h) / 2)), lit: hex(lt.lit), dark: lt.track != null ? hex(lt.track) : '#555555' }, note: 'centre and size from the region; lit and dark colours from its two main colours' };
  };
  T.binary.suggest = function (region) { var m = objs(region); return m.length >= 8 && m.every(function (o) { return Math.abs(o.w - o.h) <= 2; }) ? 0.8 : 0.1; };
  T.binary.fromRegion = function (region, P) {
    var m = objs(region).filter(function (o) { return Math.abs(o.w - o.h) <= 3; }); if (m.length < 4) return null;
    var r = Math.max(2, N(median(m.map(function (o) { return o.w; })) / 2)), xs = m.map(function (o) { return o.x + o.w / 2; }).sort(function (a, b) { return a - b; }), cols = [];
    xs.forEach(function (x) { if (!cols.length || x - cols[cols.length - 1] > r) cols.push(x); });
    var pitch = cols.length > 1 ? median(cols.slice(1).map(function (x, i) { return x - cols[i]; })) : 2 * r + 4, bb = bboxOf(m), lt = litAndTrack(P, region);
    return { props: { x: N(bb.x + bb.w / 2), y: N(bb.y + bb.h / 2), r: r, gap: Math.max(1, N(pitch - 2 * r)), on: hex(lt.lit), off: lt.track != null ? hex(lt.track) : '#005500', secs: cols.length >= 6 }, note: m.length + ' dots in ' + cols.length + ' columns' };
  };
  T.wxicon.suggest = function (region) { return region.w >= 20 && region.w <= 80 && Math.abs(region.w - region.h) < 0.35 * region.w ? 0.35 : 0.1; };
  T.wxicon.fromRegion = function (region) { return { props: { x: N(region.x + region.w / 2), y: N(region.y + region.h / 2), size: Math.max(16, N(Math.max(region.w, region.h))) }, note: 'centre and size from the region; the weather picture itself follows the data' }; };
  T.worldmap.suggest = function (region) { return region.w > 60 && region.w / region.h > 1.8 && region.w / region.h < 3.5 ? 0.6 : 0.05; };
  T.worldmap.fromRegion = function (region, P) {
    var lt = litAndTrack(P, region);
    return { props: { x: N(region.x + region.w / 2), y: N(region.y + region.h / 2), w: N(region.w), h: N(region.h), land: hex(lt.lit) }, note: 'wide region: map size and land colour read off it' };
  };
  T.sunicon.suggest = function (region) { return region.w >= 10 && region.w <= 50 && Math.abs(region.w - region.h) < 0.6 * region.w ? 0.35 : 0.1; };
  T.sunicon.fromRegion = function (region) { return { props: { x: N(region.x + region.w / 2), y: N(region.y + region.h / 2), r: Math.max(3, N(Math.max(region.w, region.h) / 4)), color: GW.q(region.color) }, note: 'size from the region (the icon is 4 radii wide)' }; };

  // ---------------------------------------------------------------- Icon: the real icon set matched against the cropped glyph
  T.icon.suggest = function (region, P) { return region.w <= 30 && region.h <= 30 && region.w >= 8 && region.h >= 8 ? 0.7 : 0.1; };
  T.icon.fromRegion = function (region, P) {
    var ms = iconMatches(region, P).slice(0, 3); if (!ms.length) return null;
    var col = GW.q(region.color), cx = N(region.x + region.w / 2), cy = N(region.y + region.h / 2);
    function props(m) { return { kind: m.name, size: m.size, color: col, x: cx, y: cy }; }
    return { props: props(ms[0]), note: 'best match ' + ms[0].name + ' at ' + ms[0].size + ' px (overlap ' + ms[0].iou.toFixed(2) + ')',
      choices: ms.map(function (m) { return { label: GW.MDI[m.name].label + ' · ' + m.name + ' · ' + m.size + ' px · overlap ' + m.iou.toFixed(2), preview: previewCanvas(m.name, m.size, col), props: props(m) }; }) };
  };

  // ---------------------------------------------------------------- Segment gauge
  T.seggauge.suggest = function (region) {
    var m = objs(region); if (m.length === 6) return 0.5;
    if (m.length < 3) return 0.1; var ps = pitchStats(m), hs = m.map(function (o) { return o.h; });
    return ps.regular && Math.max.apply(null, hs) - Math.min.apply(null, hs) <= 2 ? 0.75 : 0.15;
  };
  T.seggauge.fromRegion = function (region, P) {
    var m = objs(region).slice(); if (m.length < 2) return null;
    var lt = litAndTrack(P, region), bb = bboxOf(m);
    var lit = m.filter(function (o) { return o.key === lt.lit; }).length;
    var cxs = m.map(function (o) { return o.x + o.w / 2; }), cys = m.map(function (o) { return o.y + o.h / 2; });
    var mcx = cxs.reduce(function (a, b) { return a + b; }, 0) / m.length, mcy = cys.reduce(function (a, b) { return a + b; }, 0) / m.length;
    if (m.length === 6) {   // six pieces around one point: the hexagon
      var rs = m.map(function (o) { return Math.hypot(o.x + o.w / 2 - mcx, o.y + o.h / 2 - mcy); });
      if (Math.max.apply(null, rs) - Math.min.apply(null, rs) < 0.35 * median(rs)) return { props: { shape: 'hex', x: N(bb.x + bb.w / 2), y: N(bb.y + bb.h / 2), r: N(Math.max(bb.w, bb.h) / 2), color: hex(lt.lit), unlit: lt.track != null ? hex(lt.track) : '#333333' }, note: 'six triangles: the hexagon shape; ' + lit + ' lit' };
    }
    var ps = pitchStats(m), first = ps.sorted[0], slant = 0, pts = P.pointsInBox(first);
    if (pts.length > 10) {   // a leaning bar: its top rows start left or right of its bottom rows
      var top = pts.filter(function (p) { return p[1] < first.y + 1.2; }), bot = pts.filter(function (p) { return p[1] > first.y + first.h - 1.2; });
      var minx = function (a) { return Math.min.apply(null, a.map(function (p) { return p[0]; })); };
      if (top.length && bot.length) slant = N((minx(top) - minx(bot)) * first.h / Math.max(1, first.h - 1.2));
    }
    var segW = N(median(m.map(function (o) { return o.w; }))) - Math.abs(slant);
    return { props: { shape: 'bar', n: m.length, w: N(bb.w - Math.abs(slant)), h: N(median(m.map(function (o) { return o.h; }))), gap: Math.max(0, N(ps.pitch - segW)), slant: slant, x: N(bb.x + bb.w / 2), y: N(bb.y + bb.h / 2), color: hex(lt.lit), unlit: lt.track != null ? hex(lt.track) : '#333333' },
      note: m.length + ' bars, ' + lit + ' lit' + (slant ? ', leaning ' + slant + ' px' : '') };
  };
})(window.GW);
