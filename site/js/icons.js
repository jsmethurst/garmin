// Icon element: small recolourable icons drawn from Monkey C primitives (no bitmaps, no resources, no memory beyond a few constants).
// Every icon is designed on a 16x16 grid and scaled by an integer size, snapped to whole pixels. Preview and export both come from iconPrims().
(function (GW) {
  'use strict';
  var T = GW.types, q = GW.q, N = Math.round;

  // Primitive kinds (grid coordinates 0..16):  r = rectangle {x,y,w,h}   p = polygon {pts}   c = circle {x,y,r}   l = line {x,y,x2,y2,w}
  // c: 'm' main colour, 'a' accent colour.  when: 'chg' only while charging, 'bt1' / 'bt0' phone connected / not connected.
  // lv: the rectangle's width follows a level ('bat' = battery %).
  var ICONS = {
    battery: { label: 'Battery', acc: true, lv: 'bat', prims: [
      { t: 'r', x: 0, y: 4, w: 13, h: 1 }, { t: 'r', x: 0, y: 11, w: 13, h: 1 }, { t: 'r', x: 0, y: 4, w: 1, h: 8 }, { t: 'r', x: 12, y: 4, w: 1, h: 8 },
      { t: 'r', x: 13, y: 6, w: 2, h: 4 },
      { t: 'r', x: 2, y: 6, w: 9, h: 4, lv: 'bat' },
      { t: 'p', pts: [[8, 5], [4, 8], [7, 8], [6, 11], [10, 7], [7, 7]], c: 'a', when: 'chg' }
    ] },
    bolt: { label: 'Charging bolt', charging: true, prims: [
      { t: 'p', pts: [[9, 1], [3, 9], [7, 9], [6, 15], [13, 6], [9, 6]], when: 'chg' }
    ] },
    heart: { label: 'Heart', prims: [
      { t: 'c', x: 5, y: 6, r: 3.5 }, { t: 'c', x: 11, y: 6, r: 3.5 }, { t: 'p', pts: [[2, 7], [14, 7], [8, 14.5]] }
    ] }
  };
  GW.ICONS = ICONS;
  GW.ICON_SIZES = [12, 14, 16, 20, 24];
  // which icon matches which text source (used by the "Add matching icon" button)
  GW.ICON_FOR = { battery: 'battery', batteryDays: 'battery', hr: 'heart' };

  // Scaled primitives, absolute screen coordinates. Rectangle edges are rounded as edges (not as sizes) so neighbours stay flush.
  function iconPrims(el) {
    var ic = ICONS[el.kind] || ICONS.battery, s = el.size || 16, k = s / 16, ox = N(el.x - s / 2), oy = N(el.y - s / 2);
    function X(v) { return ox + N(v * k); } function Y(v) { return oy + N(v * k); }
    return ic.prims.map(function (p) {
      var o = { t: p.t, c: p.c === 'a' ? (el.accent || el.color) : el.color, when: p.when, lv: p.lv };
      if (p.t === 'r') { o.x = X(p.x); o.y = Y(p.y); o.w = Math.max(1, X(p.x + p.w) - o.x); o.h = Math.max(1, Y(p.y + p.h) - o.y); }
      else if (p.t === 'c') { o.x = X(p.x); o.y = Y(p.y); o.r = Math.max(1, N(p.r * k)); }
      else if (p.t === 'l') { o.x = X(p.x); o.y = Y(p.y); o.x2 = X(p.x2); o.y2 = Y(p.y2); o.w = Math.max(1, N((p.w || 1) * k)); }
      else o.pts = p.pts.map(function (a) { return [X(a[0]), Y(a[1])]; });
      return o;
    });
  }
  GW.iconPrims = iconPrims;

  function shown(p, sim) {
    if (!p.when) return true;
    if (p.when === 'chg') return !!sim.charging;
    if (p.when === 'bt1') return sim.btOn !== false;
    if (p.when === 'bt0') return sim.btOn === false;
    return true;
  }

  T.icon = {
    label: 'Icon', icon: '◆',
    defaults: function () { return { type: 'icon', name: 'Icon', x: 140, y: 140, kind: 'battery', size: 16, color: '#ffffff', accent: '#ffff00' }; },
    pos: [['x', 'y']],
    draw: function (ctx, el, env) {
      var sim = env.sim, ic = ICONS[el.kind]; if (!ic) return;
      iconPrims(el).forEach(function (p) {
        if (!shown(p, sim)) return;
        var col = q(p.c); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineCap = 'butt';
        if (p.t === 'r') { var w = p.w; if (p.lv === 'bat') w = Math.floor(p.w * Math.max(0, Math.min(100, sim.battery)) / 100); if (w > 0) ctx.fillRect(p.x, p.y, w, p.h); }
        else if (p.t === 'c') { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
        else if (p.t === 'l') { ctx.lineWidth = p.w; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x2, p.y2); ctx.stroke(); }
        else { ctx.beginPath(); p.pts.forEach(function (a, i) { i ? ctx.lineTo(a[0], a[1]) : ctx.moveTo(a[0], a[1]); }); ctx.closePath(); ctx.fill(); }
      });
    },
    box: function (el) { var s = el.size || 16; return { x: el.x - s / 2, y: el.y - s / 2, w: s, h: s }; },
    fields: function (el) {
      var ic = ICONS[el.kind] || {}, f = [
        { k: 'kind', t: 'select', label: 'Icon', opts: Object.keys(ICONS).map(function (k) { return [k, ICONS[k].label]; }) },
        { k: 'size', t: 'seg', label: 'Size', opts: GW.ICON_SIZES.map(function (v) { return [v, String(v)]; }), num: true },
        { k: 'color', t: 'color', label: 'Colour' }
      ];
      if (ic.acc) f.push({ k: 'accent', t: 'color', label: 'Accent colour' });
      f.push({ t: 'row', fields: [{ k: 'x', t: 'num', label: 'X (centre)', min: -50, max: 330 }, { k: 'y', t: 'num', label: 'Y (centre)', min: -50, max: 330 }] });
      f.push({ t: 'note', text: 'Drawn from shapes on the watch: no image memory. Preview the charge and battery level in the Test data tab.' });
      return f;
    },
    gen: function (el, cg) {
      var ic = ICONS[el.kind]; if (!ic) return [];
      var prims = iconPrims(el), L = [], needChg = false, needLv = false;
      prims.forEach(function (p) { if (p.when === 'chg') needChg = true; if (p.lv === 'bat') needLv = true; });
      if (needChg || needLv) cg.need('sys');
      if (needLv) cg.helper('batteryNow');
      L.push('if (dc has :setAntiAlias) {', '    dc.setAntiAlias(true);', '}');
      if (needChg) L.push('var chg = (_sys has :charging) ? _sys.charging : false;');
      if (needLv) L.push('var lv = batteryNow();');
      prims.forEach(function (p, i) {
        var B = [];
        B.push('dc.setColor(' + GW.mcColor(p.c) + ', Graphics.COLOR_TRANSPARENT);');
        if (p.t === 'r') B.push(p.lv === 'bat' ? 'dc.fillRectangle(' + p.x + ', ' + p.y + ', (' + p.w + ' * lv) / 100, ' + p.h + ');' : 'dc.fillRectangle(' + p.x + ', ' + p.y + ', ' + p.w + ', ' + p.h + ');');
        else if (p.t === 'c') B.push('dc.fillCircle(' + p.x + ', ' + p.y + ', ' + p.r + ');');
        else if (p.t === 'l') B.push('dc.setPenWidth(' + p.w + ');', 'dc.drawLine(' + p.x + ', ' + p.y + ', ' + p.x2 + ', ' + p.y2 + ');', 'dc.setPenWidth(1);');
        else {
          // the point list is a class constant, so nothing is allocated while drawing
          var nm = ('IC_' + el.kind + '_' + i + '_' + p.pts[0][0] + '_' + p.pts[0][1] + '_' + el.size).replace(/-/g, 'n');
          cg.member('    const ' + nm + ' = [' + p.pts.map(function (a) { return '[' + a[0] + ', ' + a[1] + ']'; }).join(', ') + '];');
          B.push('dc.fillPolygon(' + nm + ');');
        }
        var cond = p.when === 'chg' ? 'chg' : null;
        if (p.when === 'bt1' || p.when === 'bt0') { cg.need('sys'); }
        if (cond) { L.push('if (' + cond + ') {'); B.forEach(function (l) { L.push('    ' + l); }); L.push('}'); }
        else B.forEach(function (l) { L.push(l); });
      });
      L.push('if (dc has :setAntiAlias) {', '    dc.setAntiAlias(false);', '}');
      return L;
    }
  };

  // charging bolt / battery preview: the Test data tab sets sim.charging
  GW.sim.charging = false;
})(window.GW);
