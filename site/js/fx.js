/* Effects shared by several element types: color gradients (rainbow arcs, gradient text), outlined / transparent text, end markers for arcs
   and the map, and "show only when" rules. Everything here draws in the preview and writes the Monkey C for the watch from the same numbers. */
(function (GW) {
  'use strict';
  var fx = GW.fx = {};
  var N = function (v) { return Math.round(v); };
  var rad = function (d) { return d * Math.PI / 180; };

  // ---------------------------------------------------------------- colors
  function rgb(c) { c = GW.q(c); return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function hex(r, g, b) { return '#' + [r, g, b].map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
  function toHsv(c) {
    var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
    if (d > 0) { if (mx === r) h = 60 * (((g - b) / d + 6) % 6); else if (mx === g) h = 60 * ((b - r) / d + 2); else h = 60 * ((r - g) / d + 4); }
    return [h, mx ? d / mx : 0, mx];
  }
  function fromHsv(h, s, v) {
    var c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c, r = 0, g = 0, b = 0, k = Math.floor(h / 60) % 6;
    if (k === 0) { r = c; g = x; } else if (k === 1) { r = x; g = c; } else if (k === 2) { g = c; b = x; } else if (k === 3) { g = x; b = c; } else if (k === 4) { r = x; b = c; } else { r = c; b = x; }
    return hex((r + m) * 255, (g + m) * 255, (b + m) * 255);
  }
  // t = 0..1 between two colors. "rainbow" walks the hue wheel the short way through the spectrum (red to blue passes yellow, green and cyan); "blend" mixes the colors straight.
  fx.mix = function (c1, c2, t, mode, raw) {
    var a = rgb(c1), b = rgb(c2);
    if (mode === 'rainbow') {
      var ha = toHsv(a), hb = toHsv(b);
      return fromHsv(ha[0] + (hb[0] - ha[0]) * t, ha[1] + (hb[1] - ha[1]) * t, ha[2] + (hb[2] - ha[2]) * t);
    }
    return hex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
  };
  // n colors, the first exactly c1 and the last exactly c2
  fx.ramp = function (c1, c2, mode, n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(GW.q(fx.mix(c1, c2, n > 1 ? i / (n - 1) : 0, mode)));
    return out;
  };
  fx.PRESETS = [
    ['Rainbow (red → blue)', 'rainbow', '#ff0000', '#0000ff'],
    ['Full rainbow (red → violet)', 'rainbow', '#ff0000', '#aa00ff'],
    ['Heat (green → red)', 'rainbow', '#00ff00', '#ff0000'],
    ['Sunset', 'blend', '#ffaa00', '#ff0055'],
    ['Ocean', 'blend', '#00ffaa', '#0055ff']
  ];

  // ---------------------------------------------------------------- gradient arcs
  // The gradient is fixed along the sweep (the color at an angle never changes); the fill reveals it. Whole-degree bands, each drawn 1° long so there is no seam.
  fx.isGrad = function (el) { return !!el.grad && el.grad !== 'none'; };
  // The watch shows 64 colors (four levels per channel), so a plain ramp comes out as a handful of flat bands. To look smooth the ramp is DITHERED:
  // each 1-degree slice gets the exact blend color, then every channel is rounded up or down to a palette level by a repeating threshold, so the two
  // nearest palette colors alternate in the right proportion and the eye blends them. The numbers are worked out here, so the preview and the watch agree.
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  fx.dither = function (rgbv, i) {
    var out = [0, 0, 0];
    for (var ch = 0; ch < 3; ch++) {
      var th = (BAYER[((i % 16) + 16) % 16] + 0.5) / 16, lv = Math.min(3, Math.max(0, Math.floor(rgbv[ch] / 85 + th)));
      out[ch] = lv * 85;
    }
    return hex(out[0], out[1], out[2]);
  };
  fx.exactMix = function (c1, c2, t, mode) { return rgb(fx.mix(c1, c2, t, mode)); };   // note: mix() returns hex, which is not yet snapped to the palette
  fx.coarse = function (el) { return !!el.gcoarse; };
  fx.arcBands = function (el) {
    var sw = Math.min(N(el.sweep), 359), c2 = el.color2 || '#0000ff';
    if (!fx.coarse(el)) {       // smooth: one slice per degree, dithered, then neighbours of the same color are joined into one run
      var cols = [];
      for (var k = 0; k < sw; k++) cols.push(fx.dither(rgbOf(fx.mixRaw(el.color, c2, sw > 1 ? k / (sw - 1) : 0, el.grad)), k));
      var d = [], b = [], c = [];
      for (var i = 0; i < sw; i++) {
        if (c.length && c[c.length - 1] === cols[i]) { b[b.length - 1] = Math.min(sw, i + 2); continue; }
        d.push(i); b.push(Math.min(sw, i + 2)); c.push(cols[i]);   // each run is drawn one degree long past its end so no seam shows; the next run paints over that degree
      }
      return { n: d.length, d: d, b: b, c: c };
    }
    var n = Math.max(2, Math.min(sw, Math.min(48, N(el.gsteps || 24)))), d2 = [], b2 = [];
    for (var j = 0; j < n; j++) { d2.push(N(sw * j / n)); b2.push(Math.min(sw, N(sw * (j + 1) / n) + 1)); }
    return { n: n, d: d2, b: b2, c: fx.ramp(el.color, c2, el.grad, n) };
  };
  // `count` equal slices of a ramp, dithered, with neighbours of one color joined: [{ d: first slice, e: one past the last, c: color }]
  fx.ditherRuns = function (c1, c2, mode, count) {
    var runs = [];
    for (var k = 0; k < count; k++) {
      var col = fx.dither(rgbOf(fx.mix(c1, c2, count > 1 ? k / (count - 1) : 0, mode)), k), last = runs[runs.length - 1];
      if (last && last.c === col) last.e = k + 1; else runs.push({ d: k, e: k + 1, c: col });
    }
    return runs;
  };
  // A smooth (one-piece) bar with a gradient: dithered bands across the bar, in lighting order from the end it fills from.
  // For the preview: rectangles {x,y,w,h,c}. For the watch (asOffsets): {a,z,c} = start and end distance along the bar.
  fx.smoothBarBands = function (el, bb, asOffsets) {
    var vert = el.orient === 'v', rev = el.dir === 'rtl', along = vert ? bb.h : bb.w, cnt = Math.max(4, Math.min(60, N(along / 3))), out = [];
    fx.ditherRuns(el.color, el.color2 || '#0000ff', el.grad, cnt).forEach(function (r) {
      var a = N(along * r.d / cnt), z = N(along * r.e / cnt);
      if (asOffsets) { out.push({ a: a, z: z, c: r.c }); return; }
      if (!vert) out.push({ x: rev ? bb.x + bb.w - z : bb.x + a, y: bb.y, w: z - a, h: bb.h, c: r.c });
      else out.push({ x: bb.x, y: rev ? bb.y + a : bb.y + bb.h - z, w: bb.w, h: z - a, c: r.c });
    });
    return out;
  };
  // the exact (unsnapped) color along a ramp, as [r,g,b]
  function rgbOf(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  fx.mixRaw = function (c1, c2, t, mode) { return fx.mix(c1, c2, t, mode, true); };

  // ---------------------------------------------------------------- arc / map markers
  // kinds: circle (a dot), tick (a short line across the arc), tri (a triangle). pos: on the arc, outside it or inside it.
  fx.MARKERS = [['none', 'None'], ['circle', 'Circle'], ['tick', 'Tick'], ['tri', 'Triangle']];
  fx.markerGeom = function (el, clockDeg) {
    var s = Math.max(1, N(el.mks || 5)), pos = el.mkp || 'on', pen = el.pen || 9, rr = el.r;
    if (pos === 'out') rr += pen / 2 + s + 1; else if (pos === 'in') rr -= pen / 2 + s + 1;
    var th = rad(clockDeg), ux = Math.sin(th), uy = -Math.cos(th), cx = el.cx, cy = el.cy, d = pos === 'out' ? -1 : 1;
    if (el.mk === 'circle') return { k: 'circle', x: cx + rr * ux, y: cy + rr * uy, r: s };
    if (el.mk === 'tick') return { k: 'tick', a: [cx + (rr - s) * ux, cy + (rr - s) * uy], b: [cx + (rr + s) * ux, cy + (rr + s) * uy] };
    var bx = cx + (rr - d * s) * ux, by = cy + (rr - d * s) * uy, w = s * 0.9;
    return { k: 'tri', pts: [[cx + (rr + d * s) * ux, cy + (rr + d * s) * uy], [bx - uy * w, by + ux * w], [bx + uy * w, by - ux * w]] };
  };
  fx.drawMarker = function (ctx, el, clockDeg, color) {
    if (!el.mk || el.mk === 'none') return;
    var g = fx.markerGeom(el, clockDeg);
    var out = el.mkOut ? GW.q(el.mkOut) : null;   // a thin outline: the same shape one pixel bigger, drawn first
    ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
    function shape(col, grow) {
      ctx.fillStyle = col; ctx.strokeStyle = col;
      if (g.k === 'circle') { ctx.beginPath(); ctx.arc(g.x, g.y, g.r + grow, 0, Math.PI * 2); ctx.fill(); }
      else if (g.k === 'tick') { ctx.lineWidth = 3 + 2 * grow; ctx.beginPath(); ctx.moveTo(g.a[0], g.a[1]); ctx.lineTo(g.b[0], g.b[1]); ctx.stroke(); }
      else {
        ctx.beginPath(); g.pts.forEach(function (p, i) { i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }); ctx.closePath(); ctx.fill();
        if (grow) { ctx.lineWidth = 3; ctx.stroke(); }
      }
    }
    if (out) shape(out, 1);
    shape(color, 0);
  };
  // Monkey C: the call that draws the marker at Garmin angle `ang` (an expression)
  fx.genMarker = function (el, cg, angExpr, colExpr) {
    cg.helper('arcMark');
    var k = { circle: 1, tick: 2, tri: 3 }[el.mk] || 1, s = Math.max(1, N(el.mks || 5)), pos = el.mkp || 'on', pen = el.pen || 9, rr = el.r;
    if (pos === 'out') rr += pen / 2 + s + 1; else if (pos === 'in') rr -= pen / 2 + s + 1;
    if (k === 3 && pos === 'out') k = 4;   // 4 = triangle pointing inward (the direction rides in k so the helper stays within Monkey C's 9-argument limit)
    return 'arcMark(dc, ' + k + ', ' + N(el.cx) + ', ' + N(el.cy) + ', ' + rr.toFixed(1) + ', ' + angExpr + ', ' + s + ', ' + colExpr + ', ' + (el.mkOut ? GW.mcColor(el.mkOut) : '-1') + ');';
  };
  fx.markerFields = function (el) {
    var f = [{ t: 'h', label: 'End marker' }, { k: 'mk', t: 'seg', label: 'Marker at the end of the fill', opts: fx.MARKERS }];
    if (el.mk && el.mk !== 'none') {
      f.push({ k: 'mkp', t: 'seg', label: 'Placed', opts: [['on', 'On the arc'], ['out', 'Outside'], ['in', 'Inside']] });
      f.push({ t: 'row', fields: [{ k: 'mks', t: 'num', label: 'Size', min: 1, max: 20 }] });
      f.push({ k: 'mkColor', t: 'optcolor', label: 'Marker color (none = the fill color)' });
      f.push({ k: 'mkOut', t: 'optcolor', label: 'Thin outline (none = no outline)' });
    }
    return f;
  };

  // ---------------------------------------------------------------- text: outline, transparent fill, gradient fill
  fx.textStyled = function (el) { return el.tfill === 'gradient' || el.tfill === 'none' || (!!el.tol && el.tolw !== 0); };
  var TEXT_BANDS = 8;
  function bgOf() { var d = GW.design; return d.kind === 'datafield' && GW.dfTheme ? GW.dfTheme(d).bg : d.bg; }
  fx.textFields = function (el) {
    var f = [{ t: 'h', label: 'Fill and outline' }, { k: 'tfill', t: 'seg', label: 'Fill', opts: [['solid', 'Solid'], ['gradient', 'Gradient'], ['none', 'Transparent']] }];
    if (el.tfill === 'gradient') {
      f.push({ t: 'fxpresets', ks: { on: 'tgm', c1: 'tg1', c2: 'tg2' } });
      f.push({ k: 'tgm', t: 'seg', label: 'Colors', opts: [['rainbow', 'Rainbow'], ['blend', 'Blend']] });
      f.push({ t: 'row', fields: [{ k: 'tg1', t: 'fxcolor', label: 'From' }, { k: 'tg2', t: 'fxcolor', label: 'To' }] });
      f.push({ k: 'tgd', t: 'seg', label: 'Direction', opts: [['v', 'Top to bottom'], ['h', 'Left to right']] });
    }
    f.push({ k: 'tol', t: 'optcolor', label: 'Outline color (none = no outline)' });
    if (el.tol) f.push({ k: 'tolw', t: 'seg', num: true, label: 'Outline width', opts: [[1, '1 px'], [2, '2 px'], [3, '3 px']] });
    if (el.tfill === 'none') f.push({ t: 'fxhint', text: 'Transparent text is filled with the face’s background color, so it looks see-through over a plain background. Give it an outline or it will not show.' });
    return f;
  };
  fx.drawText = function (ctx, el, env, str, T) {
    var font = GW.fontFor(el), j = el.justify, w = el.tolw || 1;
    if (el.tol) GW.haloOffsets(w).forEach(function (d) { GW.drawText(ctx, font, str, el.x + d[0], el.y + d[1], j, GW.q(el.tol), el.vtop); });
    if (el.tfill === 'none') { GW.drawText(ctx, font, str, el.x, el.y, j, GW.q(bgOf()), el.vtop); return; }
    if (el.tfill !== 'gradient') { GW.drawText(ctx, font, str, el.x, el.y, j, GW.q(el.color), el.vtop); return; }
    var b = T.text.box(el, env, ctx), cols = fx.ramp(el.tg1 || '#ff0000', el.tg2 || '#0000ff', el.tgm || 'rainbow', TEXT_BANDS), n = TEXT_BANDS, horiz = el.tgd === 'h';
    for (var i = 0; i < n; i++) {
      var a0 = horiz ? b.x + b.w * i / n : b.y + b.h * i / n, a1 = horiz ? b.x + b.w * (i + 1) / n : b.y + b.h * (i + 1) / n;
      var lo = Math.floor(a0) - (i === 0 ? 4 : 0), len = Math.ceil(a1) - Math.floor(a0) + 1 + (i === 0 ? 4 : 0) + (i === n - 1 ? 4 : 0);
      ctx.save(); ctx.beginPath();
      if (horiz) ctx.rect(lo, b.y - 4, len, b.h + 8); else ctx.rect(b.x - 4, lo, b.w + 8, len);
      ctx.clip(); GW.drawText(ctx, font, str, el.x, el.y, j, GW.q(cols[i]), el.vtop); ctx.restore();
    }
  };
  // Monkey C lines for a styled text (the string expression and the font are already worked out by the caller)
  fx.genText = function (el, cg, expr, fontExpr, just, out) {
    var x = N(el.x), y = N(el.y), id = String(el.id).replace(/[^A-Za-z0-9]/g, '');
    out.push('var tx = ' + expr + ';');
    if (el.tol) {
      var hw = el.tolw || 1;
      cg.member('    const HALO_' + hw + ' = [' + GW.haloOffsets(hw).map(function (d) { return '[' + d[0] + ', ' + d[1] + ']'; }).join(', ') + '];');
      out.push('dc.setColor(' + GW.mcColor(el.tol) + ', Graphics.COLOR_TRANSPARENT);', 'for (var oi = 0; oi < HALO_' + hw + '.size(); oi++) {',
        '    dc.drawText(' + x + ' + HALO_' + hw + '[oi][0], ' + y + ' + HALO_' + hw + '[oi][1], ' + fontExpr + ', tx, ' + just + ');', '}');
    }
    if (el.tfill === 'none') {
      out.push('dc.setColor(' + (GW.bgExpr ? GW.bgExpr(cg.design, cg) : GW.mcColor(cg.design.bg)) + ', Graphics.COLOR_TRANSPARENT);', 'dc.drawText(' + x + ', ' + y + ', ' + fontExpr + ', tx, ' + just + ');');
      return out;
    }
    if (el.tfill !== 'gradient') {
      out.push('dc.setColor(' + GW.mcColor(el.color) + ', Graphics.COLOR_TRANSPARENT);', 'dc.drawText(' + x + ', ' + y + ', ' + fontExpr + ', tx, ' + just + ');');
      return out;
    }
    var n = TEXT_BANDS, horiz = el.tgd === 'h', cols = fx.ramp(el.tg1 || '#ff0000', el.tg2 || '#0000ff', el.tgm || 'rainbow', n);
    cg.member('    const TXG_' + id + ' = [' + cols.map(GW.mcColor).join(', ') + '];');
    out.push('var td = dc.getTextDimensions(tx, ' + fontExpr + ');', 'var tw = td[0];', 'var th = td[1];',
      'var tl = ' + (el.justify === 'L' ? x : (el.justify === 'R' ? x + ' - tw' : x + ' - tw / 2')) + ';',
      'var tt = ' + (el.vtop ? y : y + ' - th / 2') + ';');
    out.push('for (var i = 0; i < ' + n + '; i++) {');
    if (horiz) {
      out.push('    var a0 = tl + tw * i / ' + n + ';', '    var a1 = tl + tw * (i + 1) / ' + n + ';',
        '    dc.setClip(a0 - ((i == 0) ? 4 : 0), tt - 4, a1 - a0 + 1 + ((i == 0) ? 4 : 0) + ((i == ' + (n - 1) + ') ? 4 : 0), th + 8);');
    } else {
      out.push('    var a0 = tt + th * i / ' + n + ';', '    var a1 = tt + th * (i + 1) / ' + n + ';',
        '    dc.setClip(tl - 4, a0 - ((i == 0) ? 4 : 0), tw + 8, a1 - a0 + 1 + ((i == 0) ? 4 : 0) + ((i == ' + (n - 1) + ') ? 4 : 0));');
    }
    out.push('    dc.setColor(TXG_' + id + '[i], Graphics.COLOR_TRANSPARENT);', '    dc.drawText(' + x + ', ' + y + ', ' + fontExpr + ', tx, ' + just + ');', '}',
      'dc.setClip(0, 0, dc.getWidth(), dc.getHeight());');
    return out;
  };

  // ---------------------------------------------------------------- "show only when" rules
  var DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  fx.OPS = [['=', 'is'], ['!=', 'is not'], ['<', 'is below'], ['<=', 'is at most'], ['>', 'is above'], ['>=', 'is at least'], ['in', 'is between'], ['out', 'is not between']];
  fx.CLOCK = [
    ['dow', 'Day of week', 1, 7, DAYS], ['hour', 'Hour (0–23)', 0, 23], ['minute', 'Minute (0–59)', 0, 59],
    ['dom', 'Day of the month', 1, 31], ['month', 'Month', 1, 12, MONTHS]
  ];
  function clockDef(id) { for (var i = 0; i < fx.CLOCK.length; i++) if (fx.CLOCK[i][0] === id) return fx.CLOCK[i]; return null; }
  fx.numSources = function () { return GW.sourceList.filter(function (s) { return s.kind === 'num' && s.mcNum && s.num && s.id !== 'minute' && s.id !== 'second'; }); };
  fx.condVal = function (c, env) {
    switch (c.src) {
      case 'dow': return ((env.dow + 6) % 7) + 1;
      case 'hour': return env.h;
      case 'minute': return env.m;
      case 'dom': return env.day;
      case 'month': return env.mo;
    }
    var s = GW.sources[c.src]; if (!s || !s.num) return null;
    var v = s.num(env); return v == null ? null : v;
  };
  function test(c, v) {
    if (v == null) return false;
    var a = Number(c.a), b = Number(c.b);
    switch (c.op) {
      case '=': return v === a; case '!=': return v !== a; case '<': return v < a; case '<=': return v <= a; case '>': return v > a; case '>=': return v >= a;
      case 'in': return v >= Math.min(a, b) && v <= Math.max(a, b);
      case 'out': return v < Math.min(a, b) || v > Math.max(a, b);
    }
    return true;
  }
  fx.conds = function (el) { return (el.conds || []).filter(function (c) { return c && c.src; }); };
  fx.condsOk = function (el, env) { return fx.conds(el).every(function (c) { return test(c, fx.condVal(c, env)); }); };
  fx.hasConds = function (el) { return fx.conds(el).length > 0; };
  // the Monkey C lines that stop the element's drawing when a rule is not met
  fx.condGuard = function (el, cg) {
    var out = [];
    fx.conds(el).forEach(function (c, i) {
      var e, cd = clockDef(c.src), v = 'cv' + i;
      if (cd) {
        if (c.src === 'hour' || c.src === 'minute') { cg.need('clk'); e = c.src === 'hour' ? '_clk.hour' : '_clk.min'; }
        else {
          cg.imp('Toybox.Time'); cg.imp('Toybox.Time.Gregorian');
          var inf = 'Gregorian.info(Time.now(), Time.FORMAT_SHORT)';
          e = c.src === 'dow' ? '((' + inf + '.day_of_week + 5) % 7 + 1)' : (c.src === 'dom' ? inf + '.day' : inf + '.month');
        }
      } else {
        var s = GW.sources[c.src]; if (!s || !s.mcNum) return;
        (s.imports || []).forEach(cg.imp); (s.perms || []).forEach(cg.perm);
        e = s.mcNum({ unit: 'auto', source: c.src }, cg);
      }
      var a = String(Number(c.a) || 0), b = String(Number(c.b) || 0), t;
      if (c.op === 'in') t = '(' + v + ' >= ' + a + ' && ' + v + ' <= ' + b + ')';
      else if (c.op === 'out') t = '(' + v + ' < ' + a + ' || ' + v + ' > ' + b + ')';
      else t = '(' + v + ' ' + (c.op === '=' ? '==' : c.op) + ' ' + a + ')';
      out.push('var ' + v + ' = ' + e + ';', 'if (' + v + ' == null || !' + t + ') {', '    return;', '}');
    });
    return out;
  };
  fx.describe = function (el) {
    return fx.conds(el).map(function (c) {
      var cd = clockDef(c.src), s = GW.sources[c.src], nm = cd ? cd[1] : (s ? s.label : c.src), op = (fx.OPS.filter(function (o) { return o[0] === c.op; })[0] || [0, c.op])[1];
      function val(x) { return cd && cd[4] ? cd[4][x - cd[2]] || x : x; }
      return nm + ' ' + op + ' ' + val(c.a) + (c.op === 'in' || c.op === 'out' ? ' and ' + val(c.b) : '');
    });
  };

  // ---------------------------------------------------------------- inspector pieces (built with the UI's own helpers, which exist by the time these run)
  function ui() { return GW.ui; }
  function colorBtn(el, f) {
    var h = ui().h, v = el[f.k] || (f.def || '#ffffff');
    var b = h('button', { class: 'swatch', type: 'button' }, [h('i', { style: 'background:' + GW.q(v) }), h('span', { text: GW.q(v) })]);
    b.addEventListener('click', function () { GW.pickColor(b, v, function (c) { el[f.k] = c; GW.commit(true); }); });
    return ui().field(f.label, b);
  }
  fx.field = function (el, f) {
    var h = ui().h;
    if (f.t === 'fxcolor') return colorBtn(el, { k: f.k, label: f.label, def: f.k === 'tg1' ? '#ff0000' : (f.k === 'tg2' ? '#0000ff' : '#ffffff') });
    if (f.t === 'fxhint') return h('p', { class: 'muted small', text: f.text });
    if (f.t === 'fxpresets') {
      var box = h('div', { class: 'f' }, [h('label', { text: 'Color ready-mades' })]), row = h('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;margin-top:4px' });
      fx.PRESETS.forEach(function (p) {
        var bar = fx.ramp(p[2], p[3], p[1], 6).join(',');
        var b = h('button', { class: 'btn sm', type: 'button', title: p[0] }, [h('span', { style: 'display:inline-block;width:26px;height:10px;border-radius:5px;margin-right:6px;vertical-align:-1px;background:linear-gradient(90deg,' + bar + ')' }), p[0]]);
        b.addEventListener('click', function () { el[f.ks.on] = p[1]; el[f.ks.c1] = p[2]; el[f.ks.c2] = p[3]; GW.commit(true); });
        row.appendChild(b);
      });
      box.appendChild(row); return box;
    }
    return null;
  };
  function opt(v, t) { return ui().h('option', { value: v, text: t }); }
  function valueInput(c, key, onchange) {
    var h = ui().h, cd = clockDef(c.src), inp;
    if (cd && cd[4]) {
      inp = h('select', { 'aria-label': 'Value' }, cd[4].map(function (n, i) { return opt(String(cd[2] + i), n); }));
      inp.value = String(c[key] == null ? cd[2] : c[key]);
    } else {
      inp = h('input', { type: 'number', step: 'any', style: 'width:76px', 'aria-label': 'Value' }); inp.value = c[key] == null ? '' : c[key];
      if (cd) { inp.min = cd[2]; inp.max = cd[3]; }
    }
    inp.addEventListener('change', function () { c[key] = inp.value === '' ? 0 : Number(inp.value); onchange(); });
    return inp;
  }
  // M T W T F S S with a triangle over today: seven letters and seven triangles, each triangle shown only on its own weekday
  fx.addWeekdayStrip = function (y) {
    var d = GW.design, letters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'], names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], cx = GW.SIZE / 2; y = y == null ? Math.round(GW.SIZE * 0.3) : y; var step = Math.round(GW.SIZE * 0.092), last;
    letters.forEach(function (c, i) {
      var x = Math.round(cx + (i - 3) * step);
      d.elements.push(GW.newElement('text', { name: 'Day ' + names[i], source: 'custom', text: c, font: 'FONT_XTINY', x: x, y: y, justify: 'C', color: '#ffffff' }));
      last = GW.newElement('shape', { name: 'Today marker ' + names[i], kind: 'tri', tdir: 'down', fill: true, w: 9, h: 7, x: x, y: y - 14, color: '#ffcc00', ex: { show: 'if {dow} == ' + (i + 1) + ' then true else false' } });
      d.elements.push(last);
    });
    GW.selId = last.id; GW.setTab('inspect'); GW.commit(true); GW.emit('select', last.id);
  };
})(window.GW);
