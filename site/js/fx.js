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
  fx.mix = function (c1, c2, t, mode) {
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
  fx.arcBands = function (el) {
    var sw = Math.min(N(el.sweep), 359), n = Math.max(2, Math.min(sw, Math.min(48, N(el.gsteps || 24)))), d = [], b = [];
    for (var i = 0; i < n; i++) { d.push(N(sw * i / n)); b.push(Math.min(sw, N(sw * (i + 1) / n) + 1)); }
    return { n: n, d: d, b: b, c: fx.ramp(el.color, el.color2 || '#0000ff', el.grad, n) };
  };

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
    ctx.fillStyle = color; ctx.strokeStyle = color;
    if (g.k === 'circle') { ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2); ctx.fill(); }
    else if (g.k === 'tick') { ctx.lineWidth = 3; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(g.a[0], g.a[1]); ctx.lineTo(g.b[0], g.b[1]); ctx.stroke(); }
    else { ctx.beginPath(); g.pts.forEach(function (p, i) { i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }); ctx.closePath(); ctx.fill(); }
  };
  // Monkey C: the call that draws the marker at Garmin angle `ang` (an expression)
  fx.genMarker = function (el, cg, angExpr) {
    cg.helper('arcMark');
    var k = { circle: 1, tick: 2, tri: 3 }[el.mk] || 1, s = Math.max(1, N(el.mks || 5)), pos = el.mkp || 'on', pen = el.pen || 9, rr = el.r;
    if (pos === 'out') rr += pen / 2 + s + 1; else if (pos === 'in') rr -= pen / 2 + s + 1;
    return 'arcMark(dc, ' + k + ', ' + N(el.cx) + ', ' + N(el.cy) + ', ' + rr.toFixed(1) + ', ' + angExpr + ', ' + s + ', ' + (pos === 'out' ? -1 : 1) + ');';
  };
  fx.markerFields = function (el) {
    var f = [{ t: 'h', label: 'End marker' }, { k: 'mk', t: 'seg', label: 'Marker at the end of the fill', opts: fx.MARKERS }];
    if (el.mk && el.mk !== 'none') {
      f.push({ k: 'mkp', t: 'seg', label: 'Placed', opts: [['on', 'On the arc'], ['out', 'Outside'], ['in', 'Inside']] });
      f.push({ t: 'row', fields: [{ k: 'mks', t: 'num', label: 'Size', min: 1, max: 20 }] });
      f.push({ k: 'mkColor', t: 'optcolor', label: 'Marker color (none = the fill color)' });
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
      last = GW.newElement('shape', { name: 'Today marker ' + names[i], kind: 'tri', tdir: 'down', fill: true, w: 9, h: 7, x: x, y: y - 14, color: '#ffcc00', conds: [{ src: 'dow', op: '=', a: i + 1, b: 7 }] });
      d.elements.push(last);
    });
    GW.selId = last.id; GW.setTab('inspect'); GW.commit(true); GW.emit('select', last.id);
  };
  // "Show only when…" for the selected element
  fx.condsBox = function (el) {
    var h = ui().h, box = h('div', { class: 'f', style: 'margin-top:14px;padding-top:10px;border-top:1px solid var(--line2)' });
    box.appendChild(h('h4', { text: 'Show only when… (if / then)' }));
    var list = el.conds || [];
    if (!list.length) box.appendChild(h('p', { class: 'muted small', text: 'Always shown. Add a rule to show this layer only when something is true, such as one weekday, a low battery or a time of day.' }));
    list.forEach(function (c, i) {
      var row = h('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0' });
      var src = h('select', { class: 'sel', 'aria-label': 'Reading', style: 'max-width:100%' });
      var g1 = h('optgroup', { label: 'Time and date' }); fx.CLOCK.forEach(function (d) { g1.appendChild(opt(d[0], d[1])); }); src.appendChild(g1);
      var groups = {}; fx.numSources().forEach(function (s) { (groups[s.group] = groups[s.group] || []).push(s); });
      Object.keys(groups).forEach(function (g) { var og = h('optgroup', { label: g }); groups[g].forEach(function (s) { og.appendChild(opt(s.id, s.label)); }); src.appendChild(og); });
      src.value = c.src;
      src.addEventListener('change', function () { var d = clockDef(src.value); c.src = src.value; c.a = d ? d[2] : 0; c.b = d ? d[3] : 100; GW.commit(true); });
      var op = h('select', { class: 'sel', 'aria-label': 'Comparison' }, fx.OPS.map(function (o) { return opt(o[0], o[1]); })); op.value = c.op || '=';
      op.addEventListener('change', function () { c.op = op.value; GW.commit(true); });
      var del = h('button', { class: 'btn sm danger', type: 'button', title: 'Remove this rule', text: '✕' });
      del.addEventListener('click', function () { el.conds.splice(i, 1); if (!el.conds.length) delete el.conds; GW.commit(true); });
      row.appendChild(src); row.appendChild(op); row.appendChild(valueInput(c, 'a', function () { GW.commit(false); }));
      if (c.op === 'in' || c.op === 'out') { row.appendChild(h('span', { class: 'muted small', text: 'and' })); row.appendChild(valueInput(c, 'b', function () { GW.commit(false); })); }
      row.appendChild(del); box.appendChild(row);
    });
    if (!list.length) {
      var ex = h('button', { class: 'btn sm', type: 'button', style: 'margin-right:6px', text: 'Example: add a weekday strip' });
      var yin = h('input', { type: 'number', value: Math.round(GW.SIZE * 0.3), style: 'width:64px', 'aria-label': 'Row height (Y)' });
      ex.addEventListener('click', function () { fx.addWeekdayStrip(Number(yin.value) || 0); });
      box.appendChild(h('div', { style: 'margin:4px 0 8px;display:flex;flex-wrap:wrap;gap:6px;align-items:center' }, [ex, h('span', { class: 'muted small', text: 'at Y' }), yin, h('span', { class: 'muted small', text: 'M T W T F S S with a triangle over today' })]));
    }
    var add = h('button', { class: 'btn sm', type: 'button', text: list.length ? '+ Another rule (all must be true)' : '+ Add a rule' });
    add.addEventListener('click', function () { el.conds = (el.conds || []).concat([{ src: 'dow', op: '=', a: 1, b: 7 }]); GW.commit(true); });
    box.appendChild(add);
    if (list.some(function (c) { return c.src === 'dow'; })) {
      var cur = GW.sim.dow, day = h('select', { class: 'sel', 'aria-label': 'Pretend today is' }, [opt('-1', 'today (real)')].concat(DAYS.map(function (n, i) { return opt(String((i + 1) % 7), n); })));
      day.value = cur == null ? '-1' : String(cur);
      day.addEventListener('change', function () { GW.sim.dow = Number(day.value); GW.commit(false); });
      box.appendChild(ui().field('Preview: pretend today is', day));
    }
    box.appendChild(h('p', { class: 'muted small', text: 'For a different look in the other case (say a red battery when it is low), copy the layer and give the copy the opposite rule.' }));
    return box;
  };
})(window.GW);
