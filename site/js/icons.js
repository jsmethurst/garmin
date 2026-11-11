// Icon element: real Material Design Icons (Pictogrammers, Apache-2.0) drawn through the same bitmap-font pipeline as text,
// so they recolour, stay small and look the same in the preview and on the watch. One bitmap font per size (16, 20, 24 px)
// holds only the icons used at that size. Basic-plane characters only.
(function (GW) {
  'use strict';
  var T = GW.types, N = Math.round;
  GW.ICONS = GW.MDI;                       // name -> { label, cp }
  GW.ICON_SIZES = [16, 20, 24];            // the glyphs are designed on a 24 px grid
  // which icon matches which text source (used by the "Add matching icon" button; the pairs are those named in mdi_icons.json)
  GW.ICON_FOR = { steps: 'shoe-print', stepGoal: 'flag-checkered', calories: 'fire', floors: 'stairs', intMins: 'timer', distance: 'map-marker-distance',
    workoutDist: 'map-marker-distance', altitude: 'image-filter-hdr', battery: 'battery', batteryDays: 'battery', bodyBat: 'flash-circle', hr: 'heart',
    stress: 'emoticon-neutral-outline', resp: 'weather-windy', spo2: 'water-percent', notif: 'bell', temp: 'thermometer', weatherDesc: 'weather-partly-cloudy',
    sunrise: 'weather-sunset-up', sunset: 'weather-sunset-down', sunNext: 'weather-sunset-up', moonIllum: 'weather-night', moonName: 'weather-night',
    time: 'clock-outline', hour: 'clock-outline', minute: 'clock-outline', date: 'calendar', moveBar: 'run', nyTime: 'earth', nyZone: 'earth' };
  // designs made with the earlier drawn icons: nearest real icon
  GW.ICON_LEGACY = { battery: 'battery', bolt: 'flash', bodybat: 'flash-circle', heart: 'heart', steps: 'shoe-print', flame: 'fire', stairs: 'stairs', stopwatch: 'timer',
    pin: 'map-marker-distance', mountain: 'image-filter-hdr', sunrise: 'weather-sunset-up', sunset: 'weather-sunset-down', sunnext: 'weather-sunset-up', thermo: 'thermometer',
    cloud: 'weather-cloudy', bell: 'bell', wave: 'emoticon-neutral-outline', lungs: 'weather-windy', drop: 'water-percent', walker: 'run', clock: 'clock-outline',
    calendar: 'calendar', flag: 'flag-checkered', bluetooth: 'bluetooth', moon: 'weather-night' };

  function glyphOf(el) {   // the character, refusing anything outside the basic plane
    var ic = GW.MDI[el.kind]; if (!ic || ic.cp > 0xFFFF) return null;
    return String.fromCharCode(ic.cp);
  }
  // Where the glyph's pen goes so that the ink of the icon is centred on (x, y). Whole numbers: the same constants are written into the watch code.
  function place(el) {
    var ch = glyphOf(el); if (!ch) return null;
    var fid = GW.iconFont(el.size || 20), f = GW.customFont(fid), met = GW.fontMetrics(f), g = met.glyphs[ch];
    if (!g || g.blank) return null;
    var top = N(el.y - (met.asc + g.y0 + g.h / 2));       // top of the font's line box
    return { fid: fid, ch: ch, x: N(el.x - (g.x0 + g.w / 2)), top: top, yc: top + Math.ceil(met.lineHeight / 2), g: g, met: met };
  }
  GW.iconPlace = place;

  T.icon = {
    label: 'Icon', icon: '★',
    defaults: function () { return { type: 'icon', name: 'Icon', x: 140, y: 140, kind: 'heart', size: 20, color: '#ffffff' }; },
    pos: [['x', 'y']],
    draw: function (ctx, el) {
      var p = place(el); if (!p) return;
      GW.drawText(ctx, p.fid, p.ch, p.x, p.yc, 'L', GW.q(el.color));
    },
    box: function (el) { var s = el.size || 20; return { x: el.x - s / 2, y: el.y - s / 2, w: s, h: s }; },
    fields: function (el) {
      return [
        { t: 'iconpick' },
        { k: 'size', t: 'seg', label: 'Size (px)', opts: GW.ICON_SIZES.map(function (v) { return [v, String(v)]; }), num: true },
        { k: 'color', t: 'color', label: 'Colour' },
        { t: 'iconpreview' },
        { t: 'row', fields: [{ k: 'x', t: 'num', label: 'X (centre)', min: -50, max: 330 }, { k: 'y', t: 'num', label: 'Y (centre)', min: -50, max: 330 }] },
        { t: 'note', text: 'Icons: Material Design Icons by Pictogrammers (Apache 2.0). Icons of the same size share one small bitmap font that holds only the icons you use.' }
      ];
    },
    gen: function (el, cg) {
      var p = place(el); if (!p) return [];
      cg.fontChars(p.fid, p.ch);
      return [
        'dc.setColor(' + GW.mcColor(el.color) + ', Graphics.COLOR_TRANSPARENT);',
        'dc.drawText(' + p.x + ', ' + p.yc + ', ' + cg.font(p.fid) + ', "\\u' + p.ch.charCodeAt(0).toString(16).toUpperCase() + '", Graphics.TEXT_JUSTIFY_LEFT | Graphics.TEXT_JUSTIFY_VCENTER);'
      ];
    }
  };
})(window.GW);

// ================= SEGMENT GAUGE: separate segments (bar, slanted bar or hexagon) that light up with a value =================
(function (GW) {
  'use strict';
  var T = GW.types, q = GW.q, N = Math.round, clamp = GW.clamp;
  function hexTris(el) {   // flat-top by default; triangle 0 is the top one, then clockwise
    var R = el.r, g = Math.max(0, el.gap || 0), rot = el.rot || 0, out = [], v = [];
    for (var k = 0; k < 6; k++) { var a = (-120 + 60 * k + rot) * Math.PI / 180; v.push([el.x + R * Math.cos(a), el.y + R * Math.sin(a)]); }
    var s = (g / 2) / Math.sin(Math.PI / 3);
    for (var i = 0; i < 6; i++) {
      var B = v[i], C = v[(i + 1) % 6], A = [el.x, el.y];
      if (g > 0) {
        var m = [(B[0] + C[0]) / 2 - A[0], (B[1] + C[1]) / 2 - A[1]], ml = Math.sqrt(m[0] * m[0] + m[1] * m[1]);
        var bc = [C[0] - B[0], C[1] - B[1]], bl = Math.sqrt(bc[0] * bc[0] + bc[1] * bc[1]);
        A = [el.x + m[0] / ml * g, el.y + m[1] / ml * g];
        var B2 = [B[0] + bc[0] / bl * s, B[1] + bc[1] / bl * s], C2 = [C[0] - bc[0] / bl * s, C[1] - bc[1] / bl * s]; B = B2; C = C2;
      }
      out.push([[N(A[0]), N(A[1])], [N(B[0]), N(B[1])], [N(C[0]), N(C[1])]]);
    }
    return out;
  }
  // Bar segments, in lighting order. Horizontal: segments side by side across w, each h tall, slant = how far the top edge is shifted right.
  // Vertical: segments stacked across h, each w wide, slant = how far the right edge is shifted up. Edges are rounded as edges.
  function barSegs(el) {
    var n = clamp(N(el.n || 1), 1, 20), g = Math.max(0, el.gap || 0), sl = el.slant || 0, vert = el.orient === 'v', rev = el.dir === 'rtl';
    var along = vert ? el.h : el.w, thick = vert ? el.w : el.h, sw = (along - g * (n - 1)) / n, out = [], ext = Math.abs(sl);
    var x0 = vert ? el.x - thick / 2 : el.x - (along + sl) / 2;
    var y0 = vert ? el.y - along / 2 - (Math.max(-sl, 0) - Math.max(sl, 0)) / 2 : el.y - thick / 2;
    for (var i = 0; i < n; i++) {
      var pos = vert ? (rev ? i : n - 1 - i) : (rev ? n - 1 - i : i), a0 = pos * (sw + g), a1 = a0 + sw, pts;
      if (!vert) {
        var xl = N(x0 + a0), xr = N(x0 + a1), yt = N(y0), yb = N(y0 + thick), s2 = N(sl);
        pts = [[xl, yb], [xr, yb], [xr + s2, yt], [xl + s2, yt]];
      } else {
        var yt2 = N(y0 + a0), yb2 = N(y0 + a1), xl2 = N(x0), xr2 = N(x0 + thick), s3 = N(sl);
        pts = [[xl2, yb2], [xl2, yt2], [xr2, yt2 - s3], [xr2, yb2 - s3]];
      }
      out.push(pts);
    }
    return out;
  }
  function segGeom(el) { return el.shape === 'hex' ? hexTris(el) : barSegs(el); }
  GW.segGeom = segGeom;
  function bounds(polys) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    polys.forEach(function (pl) { pl.forEach(function (p) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }); });
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  function progress(el, env) {
    var s = GW.sources[el.source]; if (!s || !s.num) return 0;
    var v = s.num(env); if (v == null) return 0;
    var r = GW.srcRange(el.source, env), mn = el.min != null ? el.min : r[0], mx = el.max != null ? el.max : r[1];
    if (el.source === 'calories' && el.max == null) mx = env.sim.calGoal;   // the watch reads the calorie goal when it has one
    return mx > mn ? clamp((v - mn) / (mx - mn), 0, 1) : 0;
  }
  function segN(el) { return el.shape === 'hex' ? 6 : clamp(N(el.n || 1), 1, 20); }
  // N = 1 bar: filled in proportion to the value (the lit part is the same polygon, clipped)
  function clipRect(el, bb, p) {
    var vert = el.orient === 'v', rev = el.dir === 'rtl';
    if (!vert) { var w = N(bb.w * p); return { x: rev ? bb.x + bb.w - w : bb.x, y: bb.y, w: w, h: bb.h }; }
    var h = N(bb.h * p); return { x: bb.x, y: rev ? bb.y : bb.y + bb.h - h, w: bb.w, h: h };
  }
  function path(ctx, t) { ctx.beginPath(); t.forEach(function (p, j) { j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }); ctx.closePath(); }
  T.seggauge = {
    label: 'Segment gauge', icon: '▰',
    defaults: function () { return { type: 'seggauge', name: 'Segment gauge', shape: 'bar', x: 140, y: 140, source: 'steps', min: null, max: null,
      color: '#00ffaa', unlit: '#333333', partial: false, calFallback: 2200,
      n: 7, w: 120, h: 16, gap: 3, slant: 6, orient: 'h', dir: 'ltr', r: 60, rot: 0, outline: '#000000', owidth: 0 }; },
    pos: [['x', 'y']],
    draw: function (ctx, el, env) {
      var p = progress(el, env), n = segN(el), polys = segGeom(el);
      if (el.shape !== 'hex' && n === 1) {
        path(ctx, polys[0]); ctx.fillStyle = q(el.unlit); ctx.fill();
        var c = clipRect(el, bounds(polys), p);
        if (c.w > 0 && c.h > 0) { ctx.save(); ctx.beginPath(); ctx.rect(c.x, c.y, c.w, c.h); ctx.clip(); path(ctx, polys[0]); ctx.fillStyle = q(el.color); ctx.fill(); ctx.restore(); }
        return;
      }
      var v = p * n;
      polys.forEach(function (t, i) { path(ctx, t); ctx.fillStyle = q((el.partial ? v > i : v >= i + 1) ? el.color : el.unlit); ctx.fill(); });
      if (el.shape === 'hex' && el.owidth > 0) {
        ctx.strokeStyle = q(el.outline); ctx.lineWidth = el.owidth; ctx.lineCap = 'butt';
        polys.forEach(function (t) { path(ctx, t); ctx.stroke(); });
      }
    },
    box: function (el) { if (el.shape === 'hex') return { x: el.x - el.r, y: el.y - el.r, w: el.r * 2, h: el.r * 2 }; return bounds(segGeom(el)); },
    fields: function (el) {
      var s = GW.sources[el.source] || {}, hex = el.shape === 'hex';
      var f = [
        { k: 'shape', t: 'select', label: 'Shape', opts: [['bar', 'Bar / slanted bar'], ['hex', 'Hexagon']] },
        { k: 'source', t: 'source', label: 'Measures', kinds: ['num'] },
        { t: 'row', fields: [{ k: 'min', t: 'numopt', label: 'Empty at', ph: '0' }, { k: 'max', t: 'numopt', label: 'Full at', ph: el.source === 'calories' ? 'calorie goal' : (s.mcGoal ? 'daily goal' : String((s.range || [0, 100])[1])) }] }
      ];
      if (el.source === 'calories') f.push({ k: 'calFallback', t: 'num', label: 'Goal if the watch has none', min: 100, max: 10000 });
      f.push({ t: 'h', label: 'Look' });
      f.push({ t: 'row', fields: [{ k: 'color', t: 'color', label: 'Lit' }, { k: 'unlit', t: 'color', label: 'Unlit' }] });
      if (hex) {
        f.push({ k: 'partial', t: 'check', label: 'Light a triangle as soon as its share starts' });
        f.push({ t: 'row', fields: [{ k: 'outline', t: 'color', label: 'Outline' }, { k: 'owidth', t: 'num', label: 'Outline width (0 = none)', min: 0, max: 6 }] });
        f.push({ t: 'row', fields: [{ k: 'r', t: 'num', label: 'Radius', min: 10, max: 200 }, { k: 'gap', t: 'num', label: 'Gap (px)', min: 0, max: 12 }] });
        f.push({ k: 'rot', t: 'range', label: 'Rotation', min: 0, max: 59 });
      } else {
        f.push({ k: 'n', t: 'range', label: 'Segments (1 = smooth bar)', min: 1, max: 20 });
        if ((el.n || 1) > 1) f.push({ k: 'partial', t: 'check', label: 'Light a segment as soon as its share starts' });
        f.push({ t: 'row', fields: [{ k: 'w', t: 'num', label: 'Width', min: 4, max: 280 }, { k: 'h', t: 'num', label: 'Height', min: 2, max: 280 }] });
        f.push({ t: 'row', fields: [{ k: 'gap', t: 'num', label: 'Gap (px)', min: 0, max: 20 }, { k: 'slant', t: 'num', label: 'Slant (px, − leans left)', min: -40, max: 40 }] });
        f.push({ k: 'orient', t: 'seg', label: 'Orientation', opts: [['h', 'Horizontal'], ['v', 'Vertical']] });
        f.push({ k: 'dir', t: 'seg', label: 'Fills', opts: el.orient === 'v' ? [['ltr', 'Bottom up'], ['rtl', 'Top down']] : [['ltr', 'Left to right'], ['rtl', 'Right to left']] });
      }
      f.push({ t: 'row', fields: [{ k: 'x', t: 'num', label: 'X (centre)', min: -50, max: 330 }, { k: 'y', t: 'num', label: 'Y (centre)', min: -50, max: 330 }] });
      return f;
    },
    gen: function (el, cg) {
      var s = GW.sources[el.source]; if (!s || !s.mcNum) return [];
      (s.imports || []).forEach(cg.imp); (s.perms || []).forEach(cg.perm);
      cg.helper('prog');
      var r = s.range || [0, 100], mn = el.min != null ? el.min : (s.mcGoal ? 0 : r[0]), mx;
      if (el.max != null) mx = String(el.max);
      else if (el.source === 'calories') { cg.need('act'); mx = '((_act has :calorieGoal && _act.calorieGoal != null) ? _act.calorieGoal : ' + N(el.calFallback || 2200) + ')'; }
      else mx = s.mcGoal ? s.mcGoal(el, cg) : String(r[1]);
      var id = String(el.id).replace(/[^A-Za-z0-9]/g, ''), polys = segGeom(el), n = segN(el), L = [];
      var lit = GW.mcColor(el.color), unlit = GW.mcColor(el.unlit);
      function pc(t, i) {   // the point list is a class constant built once, so nothing is allocated while drawing
        var nm = 'SG_' + id + '_' + i;
        cg.member('    const ' + nm + ' = [' + t.map(function (p) { return '[' + p[0] + ', ' + p[1] + ']'; }).join(', ') + '];');
        return nm;
      }
      L.push('var p = prog(' + s.mcNum(el, cg) + ', ' + mn + ', ' + mx + ');');
      if (el.shape !== 'hex' && n === 1) {
        var nm0 = pc(polys[0], 0), bb = bounds(polys), vert = el.orient === 'v', rev = el.dir === 'rtl';
        L.push('dc.setColor(' + unlit + ', Graphics.COLOR_TRANSPARENT);', 'dc.fillPolygon(' + nm0 + ');');
        if (!vert) {
          L.push('var w = (' + bb.w + '.0f * p).toNumber();', 'if (w > 0) {', '    dc.setClip(' + (rev ? (bb.x + bb.w) + ' - w' : bb.x) + ', ' + bb.y + ', w, ' + bb.h + ');');
        } else {
          L.push('var h = (' + bb.h + '.0f * p).toNumber();', 'if (h > 0) {', '    dc.setClip(' + bb.x + ', ' + (rev ? bb.y : (bb.y + bb.h) + ' - h') + ', ' + bb.w + ', h);');
        }
        L.push('    dc.setColor(' + lit + ', Graphics.COLOR_TRANSPARENT);', '    dc.fillPolygon(' + nm0 + ');', '    dc.setClip(0, 0, dc.getWidth(), dc.getHeight());', '}');
        return L;
      }
      L.push('var n = p * ' + n + '.0f;');
      polys.forEach(function (t, i) {
        L.push('dc.setColor((n ' + (el.partial ? '> ' + i + '.0f' : '>= ' + (i + 1) + '.0f') + ') ? ' + lit + ' : ' + unlit + ', Graphics.COLOR_TRANSPARENT);');
        L.push('dc.fillPolygon(' + pc(t, i) + ');');
      });
      if (el.shape === 'hex' && el.owidth > 0) {
        L.push('dc.setColor(' + GW.mcColor(el.outline) + ', Graphics.COLOR_TRANSPARENT);', 'dc.setPenWidth(' + N(el.owidth) + ');');
        polys.forEach(function (t) { for (var k = 0; k < 3; k++) { var a = t[k], b = t[(k + 1) % 3]; L.push('dc.drawLine(' + a[0] + ', ' + a[1] + ', ' + b[0] + ', ' + b[1] + ');'); } });
        L.push('dc.setPenWidth(1);');
      }
      return L;
    }
  };
})(window.GW);
