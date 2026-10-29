/* Element types. Each: defaults, fields (inspector), draw (preview), box/hit, pos (draggable keys), gen (Monkey C). */
(function (GW) {
  'use strict';
  var T = GW.types = {};
  var q = GW.q, rad = GW.rad, clamp = GW.clamp;
  var N = function (v) { return Math.round(v); };

  function dashRect(ctx, b, col) {
    ctx.save(); ctx.strokeStyle = col || '#ffd400'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.strokeRect(b.x - 0.5, b.y - 0.5, b.w + 1, b.h + 1); ctx.restore();
  }
  GW.dashRect = dashRect;

  // Garmin arc angle (0 = 3 o'clock, counter-clockwise) from clock angle (0 = 12 o'clock, clockwise)
  function G(clockDeg) { return (((90 - clockDeg) % 360) + 360) % 360; }
  GW.garminAngle = function (c) { return N(G(c)); };

  // Use a data source in codegen: imports + permissions
  function useSource(src, cg) {
    (src.imports || []).forEach(cg.imp);
    (src.perms || []).forEach(cg.perm);
  }

  function ptsToMc(pts) { return '[' + pts.map(function (p) { return '[' + N(p[0]) + ', ' + N(p[1]) + ']'; }).join(', ') + ']'; }

  // ================= TEXT =================
  T.text = {
    label: 'Text / data', icon: 'T',
    defaults: function () {
      return { type: 'text', name: 'Text', x: 140, y: 140, source: 'time', font: 'FONT_NUMBER_HOT', color: '#ffffff', justify: 'C',
        prefix: '', suffix: '', upper: false, hmode: 'auto', lz: true, secs: false, sep: ':', fmt: 'ddd DD MMM', unit: 'auto', text: 'HELLO' };
    },
    pos: [['x', 'y']],
    string: function (el, env) {
      var s = (el.prefix || '') + GW.srcStr(el, env) + (el.suffix || '');
      return el.upper ? s.toUpperCase() : s;
    },
    draw: function (ctx, el, env) { GW.drawText(ctx, el.font, T.text.string(el, env), el.x, el.y, el.justify, q(el.color)); },
    box: function (el, env, ctx) { return GW.layoutText(ctx, el.font, T.text.string(el, env), el.x, el.y, el.justify); },
    fields: function (el) {
      var src = GW.sources[el.source] || {}, o = src.opts || [], f = [];
      f.push({ k: 'source', t: 'source', label: 'Shows' });
      if (o.indexOf('text') >= 0) f.push({ k: 'text', t: 'text', label: 'Text' });
      if (o.indexOf('hmode') >= 0) f.push({ k: 'hmode', t: 'seg', label: 'Clock', opts: [['auto', 'Watch'], ['h24', '24h'], ['h12', '12h']] });
      if (o.indexOf('lz') >= 0) f.push({ k: 'lz', t: 'check', label: 'Leading zero on hour' });
      if (o.indexOf('secs') >= 0) f.push({ k: 'secs', t: 'check', label: 'Show seconds' });
      if (o.indexOf('sep') >= 0) f.push({ k: 'sep', t: 'seg', label: 'Separator', opts: [[':', ':'], ['.', '.'], [' ', 'space'], ['', 'none']] });
      if (o.indexOf('datefmt') >= 0) f.push({ t: 'datefmt' });
      if (o.indexOf('unit_temp') >= 0) f.push({ k: 'unit', t: 'seg', label: 'Unit', opts: [['auto', 'Watch'], ['C', '°C'], ['F', '°F']] });
      if (o.indexOf('unit_dist') >= 0) f.push({ k: 'unit', t: 'seg', label: 'Unit', opts: [['auto', 'Watch'], ['km', 'km'], ['mi', 'mi']] });
      if (o.indexOf('unit_alt') >= 0) f.push({ k: 'unit', t: 'seg', label: 'Unit', opts: [['auto', 'Watch'], ['m', 'm'], ['ft', 'ft']] });
      f.push({ t: 'h', label: 'Style' });
      f.push({ k: 'font', t: 'font', label: 'Font' });
      f.push({ k: 'color', t: 'color', label: 'Colour' });
      f.push({ k: 'justify', t: 'seg', label: 'Align on X', opts: [['L', 'Left'], ['C', 'Centre'], ['R', 'Right']] });
      f.push({ t: 'row', fields: [{ k: 'prefix', t: 'text', label: 'Before' }, { k: 'suffix', t: 'text', label: 'After' }] });
      f.push({ k: 'upper', t: 'check', label: 'UPPERCASE' });
      f.push({ t: 'h', label: 'Position (text centre line)' });
      f.push({ t: 'row', fields: [{ k: 'x', t: 'num', label: 'X', min: -50, max: 330 }, { k: 'y', t: 'num', label: 'Y', min: -50, max: 330 }] });
      return f;
    },
    gen: function (el, cg) {
      var src = GW.sources[el.source]; if (!src) return [];
      useSource(src, cg);
      var parts = [];
      if (el.prefix) parts.push(GW.mcLit(el.prefix));
      parts.push(src.mcStr(el, cg));
      if (el.suffix) parts.push(GW.mcLit(el.suffix));
      var expr = parts.join(' + ');
      if (el.upper) expr = '(' + expr + ').toUpper()';
      var j = { L: 'LEFT', C: 'CENTER', R: 'RIGHT' }[el.justify] || 'CENTER';
      return [
        'dc.setColor(' + GW.mcColor(el.color) + ', Graphics.COLOR_TRANSPARENT);',
        'dc.drawText(' + N(el.x) + ', ' + N(el.y) + ', ' + cg.font(el.font) + ', ' + expr + ', Graphics.TEXT_JUSTIFY_' + j + ' | Graphics.TEXT_JUSTIFY_VCENTER);'
      ];
    }
  };

  // ================= ARC GAUGE =================
  function arcProgress(el, env) {
    var s = GW.sources[el.source]; if (!s || !s.num) return 0;
    var v = s.num(env); if (v == null) return 0;
    var r = GW.srcRange(el.source, env);
    var mn = el.min != null ? el.min : r[0], mx = el.max != null ? el.max : r[1];
    return mx > mn ? clamp((v - mn) / (mx - mn), 0, 1) : 0;
  }
  function arcPoint(cx, cy, r, clockDeg) { var a = rad(clockDeg - 90); return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }
  GW.arcProgress = arcProgress;

  T.arc = {
    label: 'Arc gauge', icon: '◠',
    defaults: function () {
      return { type: 'arc', name: 'Arc', cx: 140, cy: 140, r: 128, pen: 9, start: 225, sweep: 270, dir: 'cw', source: 'steps',
        min: null, max: null, color: '#00ffff', track: 'auto', round: true };
    },
    pos: [['cx', 'cy']],
    draw: function (ctx, el, env) {
      var p = arcProgress(el, env), cw = el.dir !== 'ccw', sgn = cw ? 1 : -1;
      var a0 = rad(el.start - 90), hw = el.pen / 2;
      var col = q(el.color), trk = el.track === 'none' ? null : (el.track === 'auto' ? GW.dim(el.color) : q(el.track));
      ctx.lineCap = 'butt';
      function arcTo(deg, color) {
        ctx.strokeStyle = color; ctx.lineWidth = el.pen;
        ctx.beginPath(); ctx.arc(el.cx, el.cy, el.r, a0, a0 + sgn * rad(deg), !cw); ctx.stroke();
      }
      var fill = Math.floor(el.sweep * p);
      if (trk) arcTo(Math.min(el.sweep, 359), trk);
      if (fill > 0) arcTo(fill, col);
      function cap(deg, color) {
        var pt = arcPoint(el.cx, el.cy, el.r, el.start + sgn * deg);
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(pt[0], pt[1], hw, 0, Math.PI * 2); ctx.fill();
      }
      if (el.round && el.sweep < 359) {
        if (trk) cap(el.sweep, trk);
        if (fill > 0) cap(0, col); else if (trk) cap(0, trk);
        if (fill > 0) cap(fill, col);
      }
    },
    box: function (el) { var r = el.r + el.pen / 2; return { x: el.cx - r, y: el.cy - r, w: r * 2, h: r * 2 }; },
    hit: function (el, x, y) {
      var dx = x - el.cx, dy = y - el.cy, d = Math.sqrt(dx * dx + dy * dy);
      if (Math.abs(d - el.r) > el.pen / 2 + 6) return false;
      var a = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360; // clock angle
      var off = el.dir === 'ccw' ? ((el.start - a) + 720) % 360 : ((a - el.start) + 720) % 360;
      return off <= el.sweep + 6 || off >= 354;
    },
    fields: function (el) {
      var s = GW.sources[el.source] || {};
      return [
        { k: 'source', t: 'source', label: 'Measures', kinds: ['num'] },
        { t: 'row', fields: [{ k: 'min', t: 'numopt', label: 'Empty at', ph: s.goal || s.mcGoal ? '0' : String((s.range || [0])[0]) },
          { k: 'max', t: 'numopt', label: 'Full at', ph: s.mcGoal ? 'daily goal' : String((s.range || [0, 100])[1]) }] },
        { t: 'h', label: 'Look' },
        { k: 'color', t: 'color', label: 'Fill colour' },
        { k: 'track', t: 'track', label: 'Track' },
        { k: 'round', t: 'check', label: 'Rounded ends' },
        { t: 'row', fields: [{ k: 'pen', t: 'num', label: 'Thickness', min: 1, max: 40 }, { k: 'r', t: 'num', label: 'Radius', min: 5, max: 200 }] },
        { t: 'h', label: 'Sweep (clock degrees: 0 = 12 o’clock)' },
        { k: 'start', t: 'range', label: 'Start', min: 0, max: 359 },
        { k: 'sweep', t: 'range', label: 'Length', min: 10, max: 360 },
        { k: 'dir', t: 'seg', label: 'Direction', opts: [['cw', 'Clockwise'], ['ccw', 'Counter-clockwise']] },
        { t: 'h', label: 'Centre' },
        { t: 'row', fields: [{ k: 'cx', t: 'num', label: 'X', min: -50, max: 330 }, { k: 'cy', t: 'num', label: 'Y', min: -50, max: 330 }] }
      ];
    },
    gen: function (el, cg) {
      var s = GW.sources[el.source]; if (!s || !s.mcNum) return [];
      useSource(s, cg); cg.helper('prog'); cg.helper('ang');
      var cw = el.dir !== 'ccw', sw = Math.min(N(el.sweep), 359);
      var sg = GW.garminAngle(el.start), dirC = cw ? 'Graphics.ARC_CLOCKWISE' : 'Graphics.ARC_COUNTER_CLOCKWISE';
      var endT = GW.garminAngle(el.start + (cw ? 1 : -1) * sw);
      var r = s.range || [0, 100];
      var mn = el.min != null ? el.min : (s.mcGoal ? 0 : r[0]);
      var mx = el.max != null ? String(el.max) : (s.mcGoal ? s.mcGoal(el, cg) : String(r[1]));
      var track = el.track === 'none' ? null : GW.mcColor(el.track === 'auto' ? GW.dim(el.color) : el.track);
      var fc = GW.mcColor(el.color), cx = N(el.cx), cy = N(el.cy), R = N(el.r), hw = Math.max(1, N(el.pen / 2));
      var L = [];
      L.push('var p = prog(' + s.mcNum(el, cg) + ', ' + mn + ', ' + mx + ');');
      L.push('var f = (' + sw + '.0 * p).toNumber();');
      L.push('dc.setPenWidth(' + N(el.pen) + ');');
      if (track) {
        L.push('dc.setColor(' + track + ', Graphics.COLOR_TRANSPARENT);');
        L.push('dc.drawArc(' + cx + ', ' + cy + ', ' + R + ', ' + dirC + ', ' + sg + ', ' + endT + ');');
      }
      L.push('if (f > 0) {');
      L.push('    dc.setColor(' + fc + ', Graphics.COLOR_TRANSPARENT);');
      L.push('    dc.drawArc(' + cx + ', ' + cy + ', ' + R + ', ' + dirC + ', ' + sg + ', ang(' + sg + (cw ? ' - ' : ' + ') + 'f));');
      L.push('}');
      if (el.round && sw < 359) {
        cg.helper('cap');
        if (track) {
          L.push('dc.setColor(' + track + ', Graphics.COLOR_TRANSPARENT);');
          L.push('cap(dc, ' + cx + ', ' + cy + ', ' + R + ', ' + endT + ', ' + hw + ');');
        }
        L.push('dc.setColor(' + (track ? '(f > 0) ? ' + fc + ' : ' + track : fc) + ', Graphics.COLOR_TRANSPARENT);');
        L.push('cap(dc, ' + cx + ', ' + cy + ', ' + R + ', ' + sg + ', ' + hw + ');');
        L.push('if (f > 0) {');
        L.push('    dc.setColor(' + fc + ', Graphics.COLOR_TRANSPARENT);');
        L.push('    cap(dc, ' + cx + ', ' + cy + ', ' + R + ', ang(' + sg + (cw ? ' - ' : ' + ') + 'f), ' + hw + ');');
        L.push('}');
      }
      L.push('dc.setPenWidth(1);');
      return L;
    }
  };

  // ================= TICKS (dial markers) =================
  T.ticks = {
    label: 'Dial ticks', icon: '┼',
    defaults: function () {
      return { type: 'ticks', name: 'Ticks', cx: 140, cy: 140, r: 138, len: 7, count: 60, major: 5, majorLen: 15, width: 1, majorWidth: 3, color: '#aaaaaa', majorColor: '#ffffff' };
    },
    pos: [['cx', 'cy']],
    draw: function (ctx, el) {
      ctx.lineCap = 'butt';
      for (var i = 0; i < el.count; i++) {
        var maj = el.major > 0 && i % el.major === 0, a = rad(i * 360 / el.count - 90);
        var len = maj ? el.majorLen : el.len, c = Math.cos(a), s = Math.sin(a);
        ctx.strokeStyle = q(maj ? el.majorColor : el.color); ctx.lineWidth = maj ? el.majorWidth : el.width;
        ctx.beginPath(); ctx.moveTo(el.cx + el.r * c, el.cy + el.r * s); ctx.lineTo(el.cx + (el.r - len) * c, el.cy + (el.r - len) * s); ctx.stroke();
      }
    },
    box: function (el) { return { x: el.cx - el.r, y: el.cy - el.r, w: el.r * 2, h: el.r * 2 }; },
    hit: function (el, x, y) {
      var d = Math.hypot(x - el.cx, y - el.cy);
      return d <= el.r + 4 && d >= el.r - Math.max(el.len, el.majorLen) - 4;
    },
    fields: function () {
      return [
        { k: 'count', t: 'seg', label: 'Marks', opts: [[12, '12'], [24, '24'], [48, '48'], [60, '60'], [120, '120']], num: true },
        { k: 'major', t: 'num', label: 'Big mark every', min: 0, max: 60 },
        { t: 'h', label: 'Small marks' },
        { k: 'color', t: 'color', label: 'Colour' },
        { t: 'row', fields: [{ k: 'len', t: 'num', label: 'Length', min: 1, max: 40 }, { k: 'width', t: 'num', label: 'Width', min: 1, max: 8 }] },
        { t: 'h', label: 'Big marks' },
        { k: 'majorColor', t: 'color', label: 'Colour' },
        { t: 'row', fields: [{ k: 'majorLen', t: 'num', label: 'Length', min: 1, max: 40 }, { k: 'majorWidth', t: 'num', label: 'Width', min: 1, max: 8 }] },
        { t: 'h', label: 'Placement' },
        { k: 'r', t: 'range', label: 'Outer radius', min: 20, max: 200 },
        { t: 'row', fields: [{ k: 'cx', t: 'num', label: 'X', min: -50, max: 330 }, { k: 'cy', t: 'num', label: 'Y', min: -50, max: 330 }] }
      ];
    },
    gen: function (el, cg) {
      var n = N(el.count), L = [];
      L.push('for (var i = 0; i < ' + n + '; i++) {');
      L.push('    var a = i * ' + (360 / n) + ' * Math.PI / 180.0;');
      L.push('    var s = Math.sin(a);');
      L.push('    var c = Math.cos(a);');
      var cx = N(el.cx), cy = N(el.cy), r = N(el.r);
      function seg(len) {
        return '    dc.drawLine(' + cx + ' + ((' + r + ') * s).toNumber(), ' + cy + ' - ((' + r + ') * c).toNumber(), ' +
          cx + ' + ((' + (r - len) + ') * s).toNumber(), ' + cy + ' - ((' + (r - len) + ') * c).toNumber());';
      }
      if (el.major > 0) {
        L.push('    if (i % ' + N(el.major) + ' == 0) {');
        L.push('        dc.setPenWidth(' + N(el.majorWidth) + ');');
        L.push('        dc.setColor(' + GW.mcColor(el.majorColor) + ', Graphics.COLOR_TRANSPARENT);');
        L.push('    ' + seg(N(el.majorLen)));
        L.push('    } else {');
        L.push('        dc.setPenWidth(' + N(el.width) + ');');
        L.push('        dc.setColor(' + GW.mcColor(el.color) + ', Graphics.COLOR_TRANSPARENT);');
        L.push('    ' + seg(N(el.len)));
        L.push('    }');
      } else {
        L.push('    dc.setPenWidth(' + N(el.width) + ');');
        L.push('    dc.setColor(' + GW.mcColor(el.color) + ', Graphics.COLOR_TRANSPARENT);');
        L.push(seg(N(el.len)));
      }
      L.push('}');
      L.push('dc.setPenWidth(1);');
      return L;
    }
  };

  // ================= ANALOG HANDS =================
  function handPoly(style, w, len, tail) {
    var h = w / 2;
    if (style === 'bar') return [[-h, -tail], [h, -tail], [h, len], [-h, len]];
    if (style === 'sword') return [[-h, -tail], [h, -tail], [h, len * 0.62], [0, len], [-h, len * 0.62]];
    return [[-h, -tail], [h, -tail], [Math.max(0.5, h / 3), len], [-Math.max(0.5, h / 3), len]]; // taper
  }
  function rotPts(pts, cx, cy, ang) {
    var s = Math.sin(ang), c = Math.cos(ang);
    return pts.map(function (p) { return [cx + p[0] * c + p[1] * s, cy + p[0] * s - p[1] * c]; });
  }
  T.hands = {
    label: 'Analog hands', icon: '◔',
    defaults: function () {
      return { type: 'hands', name: 'Hands', cx: 140, cy: 140, style: 'taper', hLen: 70, hW: 10, hColor: '#ffffff', mLen: 108, mW: 8, mColor: '#ffffff',
        sShow: true, sLen: 122, sW: 2, sColor: '#ff5500', sTail: 26, hub: 6, hubColor: '#ff5500' };
    },
    pos: [['cx', 'cy']],
    draw: function (ctx, el, env) {
      var hA = ((env.h % 12) * 60 + env.m) * Math.PI / 360, mA = env.m * Math.PI / 30, sA = env.sec * Math.PI / 30;
      function poly(pts, col) {
        ctx.fillStyle = col; ctx.beginPath();
        pts.forEach(function (p, i) { i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
        ctx.closePath(); ctx.fill();
      }
      poly(rotPts(handPoly(el.style, el.hW, el.hLen, el.hLen * 0.12), el.cx, el.cy, hA), q(el.hColor));
      poly(rotPts(handPoly(el.style, el.mW, el.mLen, el.mLen * 0.1), el.cx, el.cy, mA), q(el.mColor));
      if (el.sShow) {
        ctx.strokeStyle = q(el.sColor); ctx.lineWidth = el.sW; ctx.lineCap = 'butt';
        ctx.beginPath();
        ctx.moveTo(el.cx - el.sTail * Math.sin(sA), el.cy + el.sTail * Math.cos(sA));
        ctx.lineTo(el.cx + el.sLen * Math.sin(sA), el.cy - el.sLen * Math.cos(sA)); ctx.stroke();
      }
      if (el.hub > 0) { ctx.fillStyle = q(el.hubColor); ctx.beginPath(); ctx.arc(el.cx, el.cy, el.hub, 0, Math.PI * 2); ctx.fill(); }
    },
    box: function (el) { var r = Math.max(el.mLen, el.sShow ? el.sLen : 0, 12); return { x: el.cx - r, y: el.cy - r, w: r * 2, h: r * 2 }; },
    hit: function (el, x, y) {
      // only the hands themselves (and the hub) count, so clicks pass through to things underneath
      var env = GW.env(), hA = ((env.h % 12) * 60 + env.m) * Math.PI / 360, mA = env.m * Math.PI / 30, sA = env.sec * Math.PI / 30;
      function near(a, len, tail, w) {
        var dx = Math.sin(a), dy = -Math.cos(a), px = x - el.cx, py = y - el.cy;
        var t = px * dx + py * dy, d = Math.abs(-px * dy + py * dx); // along / perpendicular distance
        return t >= -tail - 3 && t <= len + 3 && d <= w / 2 + 5;
      }
      if (el.hub > 0 && Math.hypot(x - el.cx, y - el.cy) <= el.hub + 4) return true;
      return near(hA, el.hLen, el.hLen * 0.12, el.hW) || near(mA, el.mLen, el.mLen * 0.1, el.mW) || (el.sShow && near(sA, el.sLen, el.sTail, el.sW));
    },
    fields: function (el) {
      return [
        { k: 'style', t: 'seg', label: 'Hand style', opts: [['bar', 'Bar'], ['taper', 'Taper'], ['sword', 'Sword']] },
        { t: 'h', label: 'Hour hand' },
        { k: 'hColor', t: 'color', label: 'Colour' },
        { t: 'row', fields: [{ k: 'hLen', t: 'num', label: 'Length', min: 10, max: 140 }, { k: 'hW', t: 'num', label: 'Width', min: 2, max: 30 }] },
        { t: 'h', label: 'Minute hand' },
        { k: 'mColor', t: 'color', label: 'Colour' },
        { t: 'row', fields: [{ k: 'mLen', t: 'num', label: 'Length', min: 10, max: 140 }, { k: 'mW', t: 'num', label: 'Width', min: 2, max: 30 }] },
        { t: 'h', label: 'Second hand (only while awake)' },
        { k: 'sShow', t: 'check', label: 'Show second hand' },
        el.sShow ? { k: 'sColor', t: 'color', label: 'Colour' } : null,
        el.sShow ? { t: 'row', fields: [{ k: 'sLen', t: 'num', label: 'Length', min: 10, max: 140 }, { k: 'sTail', t: 'num', label: 'Tail', min: 0, max: 60 }, { k: 'sW', t: 'num', label: 'Width', min: 1, max: 8 }] } : null,
        { t: 'h', label: 'Centre cap' },
        { k: 'hubColor', t: 'color', label: 'Colour' },
        { k: 'hub', t: 'num', label: 'Radius (0 = none)', min: 0, max: 20 },
        { t: 'h', label: 'Pivot' },
        { t: 'row', fields: [{ k: 'cx', t: 'num', label: 'X', min: 0, max: 280 }, { k: 'cy', t: 'num', label: 'Y', min: 0, max: 280 }] }
      ].filter(Boolean);
    },
    gen: function (el, cg) {
      cg.need('clk'); cg.helper('drawHand');
      var cx = N(el.cx), cy = N(el.cy), L = [];
      L.push('var hA = ((_clk.hour % 12) * 60 + _clk.min) * Math.PI / 360.0;');
      L.push('var mA = _clk.min * Math.PI / 30.0;');
      L.push('dc.setColor(' + GW.mcColor(el.hColor) + ', Graphics.COLOR_TRANSPARENT);');
      L.push('drawHand(dc, ' + cx + ', ' + cy + ', hA, ' + ptsToMc(handPoly(el.style, el.hW, el.hLen, el.hLen * 0.12)) + ');');
      L.push('dc.setColor(' + GW.mcColor(el.mColor) + ', Graphics.COLOR_TRANSPARENT);');
      L.push('drawHand(dc, ' + cx + ', ' + cy + ', mA, ' + ptsToMc(handPoly(el.style, el.mW, el.mLen, el.mLen * 0.1)) + ');');
      if (el.sShow) {
        L.push('if (!_sleep) {');
        L.push('    var sA = _clk.sec * Math.PI / 30.0;');
        L.push('    dc.setColor(' + GW.mcColor(el.sColor) + ', Graphics.COLOR_TRANSPARENT);');
        L.push('    dc.setPenWidth(' + N(el.sW) + ');');
        L.push('    dc.drawLine(' + cx + ' - (' + N(el.sTail) + ' * Math.sin(sA)).toNumber(), ' + cy + ' + (' + N(el.sTail) + ' * Math.cos(sA)).toNumber(), ' +
          cx + ' + (' + N(el.sLen) + ' * Math.sin(sA)).toNumber(), ' + cy + ' - (' + N(el.sLen) + ' * Math.cos(sA)).toNumber());');
        L.push('    dc.setPenWidth(1);');
        L.push('}');
      }
      if (el.hub > 0) {
        L.push('dc.setColor(' + GW.mcColor(el.hubColor) + ', Graphics.COLOR_TRANSPARENT);');
        L.push('dc.fillCircle(' + cx + ', ' + cy + ', ' + N(el.hub) + ');');
      }
      return L;
    }
  };

  // ================= SHAPE =================
  T.shape = {
    label: 'Line / box / circle', icon: '▭',
    defaults: function () {
      return { type: 'shape', name: 'Shape', kind: 'rect', x: 140, y: 140, x2: 200, y2: 140, w: 80, h: 40, r: 30, fill: true, pen: 2, rad: 0, color: '#ffffff' };
    },
    pos: function (el) { return el.kind === 'line' ? [['x', 'y'], ['x2', 'y2']] : [['x', 'y']]; },
    draw: function (ctx, el) {
      var col = q(el.color);
      ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = el.pen; ctx.lineCap = 'butt';
      if (el.kind === 'line') { ctx.beginPath(); ctx.moveTo(el.x, el.y); ctx.lineTo(el.x2, el.y2); ctx.stroke(); }
      else if (el.kind === 'circle') { ctx.beginPath(); ctx.arc(el.x, el.y, el.r, 0, Math.PI * 2); el.fill ? ctx.fill() : ctx.stroke(); }
      else {
        var x = el.x - el.w / 2, y = el.y - el.h / 2;
        ctx.beginPath();
        if (el.rad > 0 && ctx.roundRect) ctx.roundRect(x, y, el.w, el.h, el.rad); else ctx.rect(x, y, el.w, el.h);
        el.fill ? ctx.fill() : ctx.stroke();
      }
    },
    box: function (el) {
      if (el.kind === 'line') return { x: Math.min(el.x, el.x2), y: Math.min(el.y, el.y2), w: Math.abs(el.x2 - el.x), h: Math.abs(el.y2 - el.y) };
      if (el.kind === 'circle') return { x: el.x - el.r, y: el.y - el.r, w: el.r * 2, h: el.r * 2 };
      return { x: el.x - el.w / 2, y: el.y - el.h / 2, w: el.w, h: el.h };
    },
    hit: function (el, x, y) {
      if (el.kind === 'line') {
        var ax = el.x, ay = el.y, bx = el.x2, by = el.y2, dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
        var t = clamp(((x - ax) * dx + (y - ay) * dy) / l2, 0, 1);
        return Math.hypot(x - (ax + t * dx), y - (ay + t * dy)) <= Math.max(5, el.pen / 2 + 3);
      }
      if (el.kind === 'circle') {
        var d = Math.hypot(x - el.x, y - el.y);
        return el.fill ? d <= el.r + 2 : Math.abs(d - el.r) <= el.pen / 2 + 5;
      }
      var b = T.shape.box(el);
      if (el.fill) return x >= b.x - 2 && x <= b.x + b.w + 2 && y >= b.y - 2 && y <= b.y + b.h + 2;
      var o = el.pen / 2 + 4;
      return x >= b.x - o && x <= b.x + b.w + o && y >= b.y - o && y <= b.y + b.h + o && !(x > b.x + o && x < b.x + b.w - o && y > b.y + o && y < b.y + b.h - o);
    },
    fields: function (el) {
      var f = [{ k: 'kind', t: 'seg', label: 'Shape', opts: [['rect', 'Box'], ['circle', 'Circle'], ['line', 'Line']] }, { k: 'color', t: 'color', label: 'Colour' }];
      if (el.kind !== 'line') f.push({ k: 'fill', t: 'check', label: 'Filled' });
      if (el.kind === 'line' || !el.fill) f.push({ k: 'pen', t: 'num', label: 'Line width', min: 1, max: 30 });
      if (el.kind === 'rect') {
        f.push({ t: 'row', fields: [{ k: 'w', t: 'num', label: 'Width', min: 1, max: 400 }, { k: 'h', t: 'num', label: 'Height', min: 1, max: 400 }] });
        f.push({ k: 'rad', t: 'num', label: 'Corner radius', min: 0, max: 100 });
      }
      if (el.kind === 'circle') f.push({ k: 'r', t: 'range', label: 'Radius', min: 1, max: 200 });
      f.push({ t: 'h', label: el.kind === 'line' ? 'Start point' : 'Centre' });
      f.push({ t: 'row', fields: [{ k: 'x', t: 'num', label: 'X', min: -50, max: 330 }, { k: 'y', t: 'num', label: 'Y', min: -50, max: 330 }] });
      if (el.kind === 'line') {
        f.push({ t: 'h', label: 'End point' });
        f.push({ t: 'row', fields: [{ k: 'x2', t: 'num', label: 'X', min: -50, max: 330 }, { k: 'y2', t: 'num', label: 'Y', min: -50, max: 330 }] });
      }
      return f;
    },
    gen: function (el, cg) {
      var c = GW.mcColor(el.color), L = ['dc.setColor(' + c + ', Graphics.COLOR_TRANSPARENT);'];
      if (el.kind === 'line') {
        L.push('dc.setPenWidth(' + N(el.pen) + ');');
        L.push('dc.drawLine(' + N(el.x) + ', ' + N(el.y) + ', ' + N(el.x2) + ', ' + N(el.y2) + ');');
        L.push('dc.setPenWidth(1);');
      } else if (el.kind === 'circle') {
        if (el.fill) L.push('dc.fillCircle(' + N(el.x) + ', ' + N(el.y) + ', ' + N(el.r) + ');');
        else { L.push('dc.setPenWidth(' + N(el.pen) + ');'); L.push('dc.drawCircle(' + N(el.x) + ', ' + N(el.y) + ', ' + N(el.r) + ');'); L.push('dc.setPenWidth(1);'); }
      } else {
        var x = N(el.x - el.w / 2), y = N(el.y - el.h / 2), w = N(el.w), h = N(el.h), rr = N(el.rad);
        if (el.fill) L.push(rr > 0 ? 'dc.fillRoundedRectangle(' + x + ', ' + y + ', ' + w + ', ' + h + ', ' + rr + ');' : 'dc.fillRectangle(' + x + ', ' + y + ', ' + w + ', ' + h + ');');
        else {
          L.push('dc.setPenWidth(' + N(el.pen) + ');');
          L.push(rr > 0 ? 'dc.drawRoundedRectangle(' + x + ', ' + y + ', ' + w + ', ' + h + ', ' + rr + ');' : 'dc.drawRectangle(' + x + ', ' + y + ', ' + w + ', ' + h + ');');
          L.push('dc.setPenWidth(1);');
        }
      }
      return L;
    }
  };

  // ================= IMAGE =================
  T.image = {
    label: 'Image (PNG)', icon: '▣',
    defaults: function () { return { type: 'image', name: 'Image', x: 140, y: 140, w: 60, h: 60, asset: null }; },
    pos: [['x', 'y']],
    draw: function (ctx, el) {
      var a = GW.assets[el.asset];
      if (a) { ctx.imageSmoothingEnabled = true; ctx.drawImage(a.img, el.x - el.w / 2, el.y - el.h / 2, el.w, el.h); }
      else { ctx.strokeStyle = '#888'; ctx.setLineDash([4, 3]); ctx.strokeRect(el.x - el.w / 2, el.y - el.h / 2, el.w, el.h); ctx.setLineDash([]); }
    },
    box: function (el) { return { x: el.x - el.w / 2, y: el.y - el.h / 2, w: el.w, h: el.h }; },
    fields: function (el) {
      return [
        { t: 'imagepick' },
        { t: 'row', fields: [{ k: 'w', t: 'num', label: 'Width', min: 1, max: 400 }, { k: 'h', t: 'num', label: 'Height', min: 1, max: 400 }] },
        { t: 'row', fields: [{ k: 'x', t: 'num', label: 'X (centre)', min: -50, max: 330 }, { k: 'y', t: 'num', label: 'Y (centre)', min: -50, max: 330 }] },
        { t: 'note', text: 'The image is resized to exactly this size when you export. Keep icons small: every pixel costs watch memory.' }
      ];
    },
    gen: function (el, cg) {
      if (!el.asset) return [];
      var v = cg.image(el.asset, N(el.w), N(el.h));
      return ['dc.drawBitmap(' + N(el.x - el.w / 2) + ', ' + N(el.y - el.h / 2) + ', ' + v + ');'];
    }
  };

  // ================= BAR CHART =================
  var BC = {
    steps: { label: 'Steps', kind: 0, today: function (e) { return e.sim.steps; }, scale: function (e) { return e.sim.stepGoal; } },
    calories: { label: 'Calories', kind: 1, today: function (e) { return e.sim.calories; }, scale: function (e) { return e.sim.calGoal; } },
    intMins: { label: 'Intensity minutes', kind: 2, today: function (e) { return Math.round(e.sim.intMins / 4); }, scale: function () { return 45; } },
    floors: { label: 'Floors', kind: 3, today: function (e) { return e.sim.floors; }, scale: function (e) { return e.sim.floorGoal; } }
  };
  var BC_PREV = [0.62, 0.95, 0.41, 1.1, 0.78, 0.33, 0.88];
  function bcValues(el, env) {
    var b = BC[el.source] || BC.steps, v = BC_PREV.map(function (f) { return Math.round(f * b.scale(env)); });
    v.push(b.today(env)); return v;
  }
  T.barchart = {
    label: 'Bar chart (8 days)', icon: '▥',
    defaults: function () { return { type: 'barchart', name: 'Bar chart', x: 140, y: 200, w: 120, h: 34, source: 'steps', gap: 2, color: '#00aaff', todayColor: '#ffff00', goal: false, goalColor: '#ff5555' }; },
    pos: [['x', 'y']],
    draw: function (ctx, el, env) {
      var vals = bcValues(el, env), b = BC[el.source] || BC.steps;
      var goal = el.goal && el.source === 'steps' ? env.sim.stepGoal : 0, mx = Math.max(1, goal);
      vals.forEach(function (v) { mx = Math.max(mx, v); });
      var bw = Math.max(1, Math.floor((el.w - 7 * el.gap) / 8)), left = el.x - el.w / 2, bottom = el.y + el.h / 2;
      vals.forEach(function (v, i) {
        var bh = Math.floor(v / mx * el.h); if (bh < 1 && v > 0) bh = 1;
        ctx.fillStyle = q(i === 7 ? el.todayColor : el.color);
        ctx.fillRect(left + i * (bw + el.gap), bottom - bh, bw, bh);
      });
      if (goal) { var gy = bottom - Math.floor(goal / mx * el.h); ctx.fillStyle = q(el.goalColor); ctx.fillRect(left, gy, el.w, 1); }
    },
    box: function (el) { return { x: el.x - el.w / 2, y: el.y - el.h / 2, w: el.w, h: el.h }; },
    fields: function (el) {
      return [
        { k: 'source', t: 'select', label: 'Chart of', opts: Object.keys(BC).map(function (k) { return [k, BC[k].label]; }) },
        { k: 'color', t: 'color', label: 'Bar colour' },
        { k: 'todayColor', t: 'color', label: 'Today colour' },
        el.source === 'steps' ? { k: 'goal', t: 'check', label: 'Show step-goal line' } : null,
        el.goal && el.source === 'steps' ? { k: 'goalColor', t: 'color', label: 'Goal line colour' } : null,
        { t: 'row', fields: [{ k: 'w', t: 'num', label: 'Width', min: 16, max: 280 }, { k: 'h', t: 'num', label: 'Height', min: 6, max: 140 }, { k: 'gap', t: 'num', label: 'Gap', min: 0, max: 8 }] },
        { t: 'row', fields: [{ k: 'x', t: 'num', label: 'X (centre)', min: -50, max: 330 }, { k: 'y', t: 'num', label: 'Y (centre)', min: -50, max: 330 }] }
      ].filter(Boolean);
    },
    gen: function (el, cg) {
      cg.need('act'); cg.helper('histVals');
      var b = BC[el.source] || BC.steps, gap = N(el.gap), bw = Math.max(1, Math.floor((el.w - 7 * gap) / 8));
      var left = N(el.x - el.w / 2), bottom = N(el.y + el.h / 2), H = N(el.h);
      var goal = el.goal && el.source === 'steps';
      var L = ['var v = histVals(' + b.kind + ');', 'var mx = 1;'];
      if (goal) { cg.helper('stepGoalNow'); L.push('var g = stepGoalNow();', 'if (g > mx) { mx = g; }'); }
      L.push('for (var i = 0; i < 8; i++) { if (v[i] > mx) { mx = v[i]; } }');
      L.push('for (var i = 0; i < 8; i++) {');
      L.push('    var bh = (v[i].toFloat() / mx.toFloat() * ' + H + '.0).toNumber();');
      L.push('    if (bh < 1 && v[i] > 0) { bh = 1; }');
      L.push('    dc.setColor((i == 7) ? ' + GW.mcColor(el.todayColor) + ' : ' + GW.mcColor(el.color) + ', Graphics.COLOR_TRANSPARENT);');
      L.push('    dc.fillRectangle(' + left + ' + i * ' + (bw + gap) + ', ' + bottom + ' - bh, ' + bw + ', bh);');
      L.push('}');
      if (goal) {
        L.push('dc.setColor(' + GW.mcColor(el.goalColor) + ', Graphics.COLOR_TRANSPARENT);');
        L.push('dc.fillRectangle(' + left + ', ' + bottom + ' - (g.toFloat() / mx.toFloat() * ' + H + '.0).toNumber(), ' + N(el.w) + ', 1);');
      }
      return L;
    }
  };

  // ================= MOVE BAR =================
  var MB_RAMP = ['#0055aa', '#00aa55', '#aaaa00', '#ff5500', '#ff0000'];
  T.movebar = {
    label: 'Move bar', icon: '▰',
    defaults: function () { return { type: 'movebar', name: 'Move bar', x: 140, y: 236, w: 100, h: 8, gap: 3, ramp: true, color: '#ff5500', off: '#555555' }; },
    pos: [['x', 'y']],
    draw: function (ctx, el, env) {
      var lvl = env.sim.moveBar, sw = Math.max(1, Math.floor((el.w - 4 * el.gap) / 5)), left = el.x - el.w / 2, top = el.y - el.h / 2;
      for (var i = 0; i < 5; i++) {
        ctx.fillStyle = q(i < lvl ? (el.ramp ? MB_RAMP[i] : el.color) : el.off);
        ctx.fillRect(left + i * (sw + el.gap), top, sw, el.h);
      }
    },
    box: function (el) { return { x: el.x - el.w / 2, y: el.y - el.h / 2, w: el.w, h: el.h }; },
    fields: function (el) {
      return [
        { k: 'ramp', t: 'check', label: 'Garmin-style colour ramp' },
        !el.ramp ? { k: 'color', t: 'color', label: 'Lit colour' } : null,
        { k: 'off', t: 'color', label: 'Unlit colour' },
        { t: 'row', fields: [{ k: 'w', t: 'num', label: 'Width', min: 20, max: 280 }, { k: 'h', t: 'num', label: 'Height', min: 2, max: 40 }, { k: 'gap', t: 'num', label: 'Gap', min: 0, max: 10 }] },
        { t: 'row', fields: [{ k: 'x', t: 'num', label: 'X (centre)', min: -50, max: 330 }, { k: 'y', t: 'num', label: 'Y (centre)', min: -50, max: 330 }] }
      ].filter(Boolean);
    },
    gen: function (el, cg) {
      cg.need('act'); cg.helper('moveNow');
      var sw = Math.max(1, Math.floor((el.w - 4 * el.gap) / 5)), left = N(el.x - el.w / 2), top = N(el.y - el.h / 2);
      var L = ['var lvl = moveNow();'];
      if (el.ramp) L.push('var cols = [' + MB_RAMP.map(GW.mcColor).join(', ') + '];');
      L.push('for (var i = 0; i < 5; i++) {');
      L.push('    dc.setColor((i < lvl) ? ' + (el.ramp ? 'cols[i]' : GW.mcColor(el.color)) + ' : ' + GW.mcColor(el.off) + ', Graphics.COLOR_TRANSPARENT);');
      L.push('    dc.fillRectangle(' + left + ' + i * ' + (sw + N(el.gap)) + ', ' + top + ', ' + sw + ', ' + N(el.h) + ');');
      L.push('}');
      return L;
    }
  };

  // ================= MOON PHASE =================
  var moonCanvas = null;
  function moonLines(r, p, flip) {
    var out = [], c = Math.cos(2 * Math.PI * p);
    for (var dy = -r; dy <= r; dy++) {
      var hw = Math.floor(Math.sqrt(r * r - dy * dy)), xt = Math.trunc(hw * c), x0, x1;
      if (p < 0.5) { x0 = xt; x1 = hw; } else { x0 = -hw; x1 = -xt; }
      if (flip) { var t = x0; x0 = -x1; x1 = -t; }
      if (x1 >= x0) out.push([dy, x0, x1]);
    }
    return out;
  }
  T.moon = {
    label: 'Moon phase', icon: '☾',
    defaults: function () { return { type: 'moon', name: 'Moon', x: 140, y: 140, r: 28, lit: '#ffffaa', dark: '#555555', rim: null, flip: false }; },
    pos: [['x', 'y']],
    draw: function (ctx, el, env) {
      var p = GW.moonPhase(env.now), r = Math.round(el.r), d = r * 2 + 1;
      ctx.fillStyle = q(el.dark); ctx.beginPath(); ctx.arc(el.x, el.y, r, 0, Math.PI * 2); ctx.fill();
      // lit part is 1px scanlines, exactly like on the watch: build it at 1:1 and blit it without smoothing (avoids seams when scaled)
      var oc = moonCanvas || (moonCanvas = document.createElement('canvas'));
      oc.width = oc.height = d; var ox = oc.getContext('2d');
      ox.fillStyle = q(el.lit);
      moonLines(r, p, el.flip).forEach(function (l) { ox.fillRect(r + l[1], r + l[0], l[2] - l[1] + 1, 1); });
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(oc, Math.round(el.x) - r, Math.round(el.y) - r);
      if (el.rim) { ctx.strokeStyle = q(el.rim); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(el.x, el.y, el.r, 0, Math.PI * 2); ctx.stroke(); }
    },
    box: function (el) { return { x: el.x - el.r, y: el.y - el.r, w: el.r * 2, h: el.r * 2 }; },
    hit: function (el, x, y) { return Math.hypot(x - el.x, y - el.y) <= el.r + 3; },
    fields: function (el) {
      return [
        { k: 'lit', t: 'color', label: 'Lit side' },
        { k: 'dark', t: 'color', label: 'Dark side' },
        { k: 'rim', t: 'optcolor', label: 'Outline' },
        { k: 'flip', t: 'check', label: 'Southern hemisphere (mirror)' },
        { k: 'r', t: 'range', label: 'Radius', min: 6, max: 120 },
        { t: 'row', fields: [{ k: 'x', t: 'num', label: 'X', min: -50, max: 330 }, { k: 'y', t: 'num', label: 'Y', min: -50, max: 330 }] },
        { t: 'note', text: 'Computed on the watch from the date: no data connection needed.' }
      ];
    },
    gen: function (el, cg) {
      cg.imp('Toybox.Time'); cg.helper('moonPhase');
      var R = N(el.r), cx = N(el.x), cy = N(el.y), L = [];
      L.push('var p = moonPhase();');
      L.push('var c = Math.cos(2.0 * Math.PI * p);');
      L.push('dc.setColor(' + GW.mcColor(el.dark) + ', Graphics.COLOR_TRANSPARENT);');
      L.push('dc.fillCircle(' + cx + ', ' + cy + ', ' + R + ');');
      L.push('dc.setColor(' + GW.mcColor(el.lit) + ', Graphics.COLOR_TRANSPARENT);');
      L.push('for (var dy = -' + R + '; dy <= ' + R + '; dy++) {');
      L.push('    var hw = Math.sqrt(' + (R * R) + ' - dy * dy).toNumber();');
      L.push('    var xt = (hw * c).toNumber();');
      L.push('    var x0 = (p < 0.5) ? xt : -hw;');
      L.push('    var x1 = (p < 0.5) ? hw : -xt;');
      if (el.flip) L.push('    var t = x0; x0 = -x1; x1 = -t;');
      L.push('    if (x1 >= x0) { dc.drawLine(' + cx + ' + x0, ' + cy + ' + dy, ' + cx + ' + x1, ' + cy + ' + dy); }');
      L.push('}');
      if (el.rim) {
        L.push('dc.setColor(' + GW.mcColor(el.rim) + ', Graphics.COLOR_TRANSPARENT);');
        L.push('dc.drawCircle(' + cx + ', ' + cy + ', ' + R + ');');
      }
      return L;
    }
  };

  // ================= BINARY CLOCK =================
  function binaryDots(el) {
    var cols = [[2, 1], [8, 4, 2, 1], [4, 2, 1], [8, 4, 2, 1], [4, 2, 1], [8, 4, 2, 1]], n = el.secs ? 6 : 4;
    var pitch = el.r * 2 + el.gap, gg = Math.round(pitch * 0.5), dots = [], xs = [];
    for (var c = 0; c < n; c++) xs.push(c * pitch + (c >= 2 ? gg : 0) + (c >= 4 ? gg : 0));
    var total = xs[n - 1], x0 = el.x - total / 2;
    for (c = 0; c < n; c++) cols[c].forEach(function (bit) {
      var row = Math.log2(bit);
      dots.push({ x: N(x0 + xs[c]), y: N(el.y + 1.5 * pitch - row * pitch), col: c, bit: bit });
    });
    return dots;
  }
  T.binary = {
    label: 'Binary clock', icon: '⁞',
    defaults: function () { return { type: 'binary', name: 'Binary clock', x: 140, y: 140, r: 9, gap: 6, on: '#00ff55', off: '#005500', secs: false, hmode: 'auto' }; },
    pos: [['x', 'y']],
    draw: function (ctx, el, env) {
      var use24 = el.hmode === 'h24' ? true : (el.hmode === 'h12' ? false : env.sim.is24), h = env.h;
      if (!use24) { h = h % 12; if (h === 0) h = 12; }
      var d = [Math.floor(h / 10), h % 10, Math.floor(env.m / 10), env.m % 10, Math.floor(env.sec / 10), env.sec % 10];
      binaryDots(el).forEach(function (p) {
        ctx.fillStyle = q((d[p.col] & p.bit) ? el.on : el.off);
        ctx.beginPath(); ctx.arc(p.x, p.y, el.r, 0, Math.PI * 2); ctx.fill();
      });
    },
    box: function (el) {
      var ds = binaryDots(el), x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      ds.forEach(function (p) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); });
      return { x: x0 - el.r, y: y0 - el.r, w: x1 - x0 + el.r * 2, h: y1 - y0 + el.r * 2 };
    },
    fields: function () {
      return [
        { k: 'on', t: 'color', label: 'Lit dot' },
        { k: 'off', t: 'color', label: 'Unlit dot' },
        { k: 'hmode', t: 'seg', label: 'Clock', opts: [['auto', 'Watch'], ['h24', '24h'], ['h12', '12h']] },
        { k: 'secs', t: 'check', label: 'Show seconds (awake only)' },
        { t: 'row', fields: [{ k: 'r', t: 'num', label: 'Dot radius', min: 2, max: 20 }, { k: 'gap', t: 'num', label: 'Spacing', min: 1, max: 20 }] },
        { t: 'row', fields: [{ k: 'x', t: 'num', label: 'X (centre)', min: -50, max: 330 }, { k: 'y', t: 'num', label: 'Y (centre)', min: -50, max: 330 }] },
        { t: 'note', text: 'Columns read left to right: hour tens, hour ones, minute tens, minute ones. Dot values 8-4-2-1 from the top.' }
      ];
    },
    gen: function (el, cg) {
      cg.need('clk'); cg.helper('hourNum');
      var dots = binaryDots(el), L = [];
      var mode = { h24: 1, h12: 2 }[el.hmode] || 0;
      L.push('var _h = hourNum(' + mode + ');');
      var d = '[_h / 10, _h % 10, _clk.min / 10, _clk.min % 10' + (el.secs ? ', (_sleep ? 0 : _clk.sec / 10), (_sleep ? 0 : _clk.sec % 10)' : '') + ']';
      L.push('var d = ' + d + ';');
      L.push('var dots = [' + dots.map(function (p) { return '[' + p.x + ', ' + p.y + ', ' + p.col + ', ' + p.bit + ']'; }).join(', ') + '];');
      L.push('for (var i = 0; i < dots.size(); i++) {');
      L.push('    var q = dots[i];');
      L.push('    dc.setColor(((d[q[2]] & q[3]) != 0) ? ' + GW.mcColor(el.on) + ' : ' + GW.mcColor(el.off) + ', Graphics.COLOR_TRANSPARENT);');
      L.push('    dc.fillCircle(q[0], q[1], ' + N(el.r) + ');');
      L.push('}');
      return L;
    }
  };

  // ================= WEATHER ICON (vector, no bitmaps) =================
  // Primitives in a 40x40 box centred on 0,0. Shared by preview and Monkey C generation.
  function cloud(dx, dy, col) {
    return [{ t: 'c', x: dx - 9, y: dy + 3, r: 7, c: col }, { t: 'c', x: dx, y: dy - 3, r: 10, c: col }, { t: 'c', x: dx + 9, y: dy + 3, r: 7, c: col }, { t: 'r', x: dx - 9, y: dy + 3, w: 18, h: 7, c: col }];
  }
  function sunRays(cx, cy, r0, r1, col) {
    var out = [];
    for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4; out.push({ t: 'l', x: cx + r0 * Math.cos(a), y: cy + r0 * Math.sin(a), x2: cx + r1 * Math.cos(a), y2: cy + r1 * Math.sin(a), p: 2, c: col }); }
    return out;
  }
  var Y = '#ffff00', W = '#ffffff', GR = '#aaaaaa', DK = '#555555', BL = '#00aaff';
  var WX_PRIMS = [
    [{ t: 'c', x: 0, y: 0, r: 9, c: Y }].concat(sunRays(0, 0, 13, 18, Y)),                                   // 0 clear
    [{ t: 'c', x: -8, y: -8, r: 7, c: Y }].concat(sunRays(-8, -8, 10, 14, Y), cloud(3, 5, W)),               // 1 part cloudy
    cloud(-6, -6, GR).concat(cloud(3, 3, W)),                                                                // 2 cloudy
    cloud(0, -6, GR).concat([-8, 0, 8].map(function (x) { return { t: 'l', x: x, y: 8, x2: x - 3, y2: 16, p: 2, c: BL }; })), // 3 rain
    cloud(0, -6, GR).concat([[-8, 12], [0, 16], [8, 12]].map(function (p) { return { t: 'c', x: p[0], y: p[1], r: 2, c: W }; })), // 4 snow
    cloud(0, -7, DK).concat([{ t: 'p', pts: [[3, 4], [-5, 14], [0, 14], [-4, 22], [7, 10], [1, 10]], c: Y }]), // 5 storm
    [-9, -3, 3, 9].map(function (y, i) { return { t: 'l', x: -14 + (i % 2) * 3, y: y, x2: 14 - ((i + 1) % 2) * 3, y2: y, p: 3, c: GR }; }),     // 6 fog
    cloud(0, -6, GR).concat([{ t: 'l', x: -6, y: 8, x2: -9, y2: 15, p: 2, c: BL }, { t: 'l', x: 6, y: 8, x2: 3, y2: 15, p: 2, c: BL }, { t: 'c', x: 0, y: 14, r: 2, c: W }]), // 7 sleet
    cloud(0, 0, DK)                                                                                          // 8 unknown
  ];
  function wxPrims(group, el) {
    var k = el.size / 40, mono = el.mono;
    return WX_PRIMS[group].map(function (p) {
      var o = { t: p.t, c: mono || p.c, p: p.p };
      function sc(v) { return N(v * k); }
      if (p.t === 'c') { o.x = sc(p.x); o.y = sc(p.y); o.r = Math.max(1, sc(p.r)); }
      else if (p.t === 'r') { o.x = sc(p.x); o.y = sc(p.y); o.w = Math.max(1, sc(p.w)); o.h = Math.max(1, sc(p.h)); }
      else if (p.t === 'l') { o.x = sc(p.x); o.y = sc(p.y); o.x2 = sc(p.x2); o.y2 = sc(p.y2); o.p = Math.max(1, sc(p.p)); }
      else { o.pts = p.pts.map(function (q) { return [sc(q[0]), sc(q[1])]; }); }
      return o;
    });
  }
  T.wxicon = {
    label: 'Weather icon', icon: '☀',
    defaults: function () { return { type: 'wxicon', name: 'Weather icon', x: 140, y: 140, size: 44, mono: null }; },
    pos: [['x', 'y']],
    draw: function (ctx, el, env) {
      wxPrims(env.sim.wx, el).forEach(function (p) {
        var col = q(p.c); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineCap = 'butt';
        if (p.t === 'c') { ctx.beginPath(); ctx.arc(el.x + p.x, el.y + p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
        else if (p.t === 'r') ctx.fillRect(el.x + p.x, el.y + p.y, p.w, p.h);
        else if (p.t === 'l') { ctx.lineWidth = p.p; ctx.beginPath(); ctx.moveTo(el.x + p.x, el.y + p.y); ctx.lineTo(el.x + p.x2, el.y + p.y2); ctx.stroke(); }
        else { ctx.beginPath(); p.pts.forEach(function (pt, i) { i ? ctx.lineTo(el.x + pt[0], el.y + pt[1]) : ctx.moveTo(el.x + pt[0], el.y + pt[1]); }); ctx.closePath(); ctx.fill(); }
      });
    },
    box: function (el) { return { x: el.x - el.size / 2, y: el.y - el.size / 2, w: el.size, h: el.size }; },
    fields: function () {
      return [
        { k: 'size', t: 'range', label: 'Size', min: 16, max: 120 },
        { k: 'mono', t: 'optcolor', label: 'Single colour (optional)' },
        { t: 'row', fields: [{ k: 'x', t: 'num', label: 'X (centre)', min: -50, max: 330 }, { k: 'y', t: 'num', label: 'Y (centre)', min: -50, max: 330 }] },
        { t: 'note', text: 'Drawn from shapes on the watch, so it costs no image memory. Change the preview weather in the Test data tab.' }
      ];
    },
    gen: function (el, cg) {
      cg.helper('wxGroup'); cg.imp('Toybox.Weather');
      var L = ['var g = wxGroup();'], cx = N(el.x), cy = N(el.y);
      for (var g = 0; g < WX_PRIMS.length; g++) {
        L.push((g ? '} else if' : 'if') + ' (g == ' + g + ') {');
        wxPrims(g, el).forEach(function (p) {
          L.push('    dc.setColor(' + GW.mcColor(p.c) + ', Graphics.COLOR_TRANSPARENT);');
          if (p.t === 'c') L.push('    dc.fillCircle(' + (cx + p.x) + ', ' + (cy + p.y) + ', ' + p.r + ');');
          else if (p.t === 'r') L.push('    dc.fillRectangle(' + (cx + p.x) + ', ' + (cy + p.y) + ', ' + p.w + ', ' + p.h + ');');
          else if (p.t === 'l') { L.push('    dc.setPenWidth(' + p.p + ');'); L.push('    dc.drawLine(' + (cx + p.x) + ', ' + (cy + p.y) + ', ' + (cx + p.x2) + ', ' + (cy + p.y2) + ');'); L.push('    dc.setPenWidth(1);'); }
          else L.push('    dc.fillPolygon(' + ptsToMc(p.pts.map(function (q) { return [cx + q[0], cy + q[1]]; })) + ');');
        });
      }
      L.push('}');
      return L;
    }
  };

  // ================= WORLD MAP + "you are here" =================
  T.worldmap = {
    label: 'World map + location', icon: '◍',
    defaults: function () { return { type: 'worldmap', name: 'World map', x: 140, y: 140, w: 120, h: 60, asset: null, marker: '#ff0000', msize: 4 }; },
    pos: [['x', 'y']],
    draw: function (ctx, el, env) {
      var a = GW.assets[el.asset];
      if (a) ctx.drawImage(a.img, el.x - el.w / 2, el.y - el.h / 2, el.w, el.h);
      else { ctx.strokeStyle = '#888'; ctx.setLineDash([4, 3]); ctx.strokeRect(el.x - el.w / 2, el.y - el.h / 2, el.w, el.h); ctx.setLineDash([]); }
      var mx = el.x - el.w / 2 + (env.sim.lon + 180) / 360 * el.w, my = el.y - el.h / 2 + (90 - env.sim.lat) / 180 * el.h;
      ctx.fillStyle = q(el.marker); ctx.strokeStyle = q(el.marker); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(mx, my, el.msize, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(mx, my, el.msize + 3, 0, Math.PI * 2); ctx.stroke();
    },
    box: function (el) { return { x: el.x - el.w / 2, y: el.y - el.h / 2, w: el.w, h: el.h }; },
    fields: function () {
      return [
        { t: 'imagepick' },
        { t: 'note', text: 'Use a flat world map (equirectangular, whole world 360° × 180°; most free “plate carrée” maps work). Your location comes from the last weather sync or GPS fix.' },
        { k: 'marker', t: 'color', label: 'Marker colour' },
        { k: 'msize', t: 'num', label: 'Marker size', min: 1, max: 12 },
        { t: 'row', fields: [{ k: 'w', t: 'num', label: 'Width', min: 20, max: 280 }, { k: 'h', t: 'num', label: 'Height', min: 10, max: 280 }] },
        { t: 'row', fields: [{ k: 'x', t: 'num', label: 'X (centre)', min: -50, max: 330 }, { k: 'y', t: 'num', label: 'Y (centre)', min: -50, max: 330 }] }
      ];
    },
    gen: function (el, cg) {
      cg.helper('locNow');
      var L = [], x0 = N(el.x - el.w / 2), y0 = N(el.y - el.h / 2), m = N(el.msize);
      if (el.asset) L.push('dc.drawBitmap(' + x0 + ', ' + y0 + ', ' + cg.image(el.asset, N(el.w), N(el.h)) + ');');
      L.push('var loc = locNow();');
      L.push('if (loc != null) {');
      L.push('    var mx = ' + x0 + ' + ((loc[1] + 180.0) / 360.0 * ' + N(el.w) + '.0).toNumber();');
      L.push('    var my = ' + y0 + ' + ((90.0 - loc[0]) / 180.0 * ' + N(el.h) + '.0).toNumber();');
      L.push('    dc.setColor(' + GW.mcColor(el.marker) + ', Graphics.COLOR_TRANSPARENT);');
      L.push('    dc.fillCircle(mx, my, ' + m + ');');
      L.push('    dc.setPenWidth(2);');
      L.push('    dc.drawCircle(mx, my, ' + (m + 3) + ');');
      L.push('    dc.setPenWidth(1);');
      L.push('}');
      return L;
    }
  };

  // ---------- generic helpers used by the UI ----------
  GW.posPairs = function (el) { var p = T[el.type].pos; return typeof p === 'function' ? p(el) : p; };
  GW.elBox = function (el, ctx) { return T[el.type].box(el, GW.env(), ctx); };
  GW.hitEl = function (el, x, y, ctx) {
    var t = T[el.type];
    if (t.hit) return t.hit(el, x, y);
    var b = t.box(el, GW.env(), ctx), m = 4;
    return x >= b.x - m && x <= b.x + b.w + m && y >= b.y - m && y <= b.y + b.h + m;
  };
  GW.newElement = function (type, over) {
    var el = Object.assign({ id: GW.uid('e'), hidden: false, locked: false }, T[type].defaults(), over || {});
    return el;
  };
})(window.GW);
