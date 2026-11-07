// Icon element: small recolourable icons drawn from Monkey C primitives (no bitmaps, no resources, no memory beyond a few constants).
// Every icon is designed on a 16x16 grid and scaled by an integer size, snapped to whole pixels. Preview and export both come from iconPrims().
(function (GW) {
  'use strict';
  var T = GW.types, q = GW.q, N = Math.round;

  // Primitive kinds (grid coordinates 0..16):  r = rectangle {x,y,w,h}   p = polygon {pts}   c = circle {x,y,r}   l = line {x,y,x2,y2,w}
  // c: 'm' main colour, 'a' accent colour.  when: 'chg' only while charging, 'bt1' / 'bt0' phone connected / not connected.
  // lv: the rectangle's width follows a level ('bat' = battery %).
  var BATT = [{ t: 'r', x: 0, y: 4, w: 13, h: 1 }, { t: 'r', x: 0, y: 11, w: 13, h: 1 }, { t: 'r', x: 0, y: 4, w: 1, h: 8 }, { t: 'r', x: 12, y: 4, w: 1, h: 8 }, { t: 'r', x: 13, y: 6, w: 2, h: 4 }];
  var BOLT_IN = [[8, 5], [4, 8], [7, 8], [6, 11], [10, 7], [7, 7]];
  function L(x, y, x2, y2, w, c, when) { return { t: 'l', x: x, y: y, x2: x2, y2: y2, w: w || 1, c: c, when: when }; }
  var ICONS = {
    battery: { label: 'Battery', acc: true, accDef: '#ffff00', prims: BATT.concat([{ t: 'r', x: 2, y: 6, w: 9, h: 4, lv: 'bat' }, { t: 'p', pts: BOLT_IN, c: 'a', when: 'chg' }]) },
    bolt: { label: 'Charging bolt', prims: [{ t: 'p', pts: [[9, 1], [3, 9], [7, 9], [6, 15], [13, 6], [9, 6]], when: 'chg' }] },
    bodybat: { label: 'Body Battery', acc: true, accDef: '#ffff00', prims: BATT.concat([{ t: 'r', x: 2, y: 6, w: 9, h: 4, lv: 'bb' }, { t: 'p', pts: BOLT_IN, c: 'a' }]) },
    heart: { label: 'Heart rate', prims: [{ t: 'c', x: 5, y: 6, r: 3.5 }, { t: 'c', x: 11, y: 6, r: 3.5 }, { t: 'p', pts: [[2, 7], [14, 7], [8, 14.5]] }] },
    steps: { label: 'Steps (shoe)', prims: [{ t: 'p', pts: [[2, 2], [6, 2], [6, 7], [12, 9], [14, 11], [14, 13], [2, 13]] }] },
    flame: { label: 'Calories (flame)', acc: true, accDef: '#ffff00', prims: [{ t: 'p', pts: [[8, 1], [11, 5], [13, 9], [12, 13], [8, 15], [4, 13], [3, 9], [5, 6], [6, 9], [7, 5]] }, { t: 'p', pts: [[8, 9], [10, 12], [8, 14], [6, 12]], c: 'a' }] },
    stairs: { label: 'Floors (stairs)', prims: [{ t: 'p', pts: [[1, 14], [1, 11], [5, 11], [5, 7], [9, 7], [9, 3], [15, 3], [15, 14]] }] },
    stopwatch: { label: 'Intensity minutes (stopwatch)', acc: true, accDef: '#ffff00', prims: [{ t: 'r', x: 6, y: 0, w: 4, h: 2 }, { t: 'c', x: 8, y: 9, r: 6 }, L(8, 9, 8, 5, 2, 'a'), L(8, 9, 11, 9, 2, 'a')] },
    pin: { label: 'Distance (map pin)', acc: true, accDef: '#ffff00', prims: [{ t: 'c', x: 8, y: 6, r: 5 }, { t: 'p', pts: [[3.5, 8], [12.5, 8], [8, 15.5]] }, { t: 'c', x: 8, y: 6, r: 2, c: 'a' }] },
    mountain: { label: 'Altitude (mountain)', acc: true, accDef: '#aaddff', prims: [{ t: 'p', pts: [[0, 14], [6, 3], [9, 9], [11, 6], [16, 14]] }, { t: 'p', pts: [[6, 3], [4, 6], [6, 5], [8, 6.5]], c: 'a' }] },
    sunrise: { label: 'Sunrise', acc: true, accDef: '#ffff00', prims: [{ t: 'p', pts: [[4, 12], [4.5, 10], [6, 8.5], [8, 8], [10, 8.5], [11.5, 10], [12, 12]] }, { t: 'r', x: 1, y: 12, w: 14, h: 1 }, L(2, 8, 3.5, 9, 1), L(14, 8, 12.5, 9, 1), { t: 'p', pts: [[8, 1], [5, 5], [11, 5]], c: 'a' }] },
    sunset: { label: 'Sunset', acc: true, accDef: '#ffff00', prims: [{ t: 'p', pts: [[4, 10], [4.5, 8], [6, 6.5], [8, 6], [10, 6.5], [11.5, 8], [12, 10]] }, { t: 'r', x: 1, y: 10, w: 14, h: 1 }, L(2, 6, 3.5, 7, 1), L(14, 6, 12.5, 7, 1), { t: 'p', pts: [[8, 15], [5, 11.5], [11, 11.5]], c: 'a' }] },
    sunnext: { label: 'Next sun event', acc: true, accDef: '#ffff00', prims: [{ t: 'p', pts: [[4, 10], [4.5, 8], [6, 6.5], [8, 6], [10, 6.5], [11.5, 8], [12, 10]] }, { t: 'r', x: 1, y: 10, w: 14, h: 1 }, { t: 'p', pts: [[8, 0.5], [5.5, 3.5], [10.5, 3.5]], c: 'a' }, { t: 'p', pts: [[8, 15.5], [5.5, 12.5], [10.5, 12.5]], c: 'a' }] },
    thermo: { label: 'Temperature', acc: true, accDef: '#ff5500', prims: [{ t: 'r', x: 6, y: 1, w: 4, h: 9 }, { t: 'c', x: 8, y: 12, r: 3.5 }, { t: 'r', x: 7, y: 5, w: 2, h: 7, c: 'a' }] },
    cloud: { label: 'Weather (cloud)', prims: [{ t: 'c', x: 5, y: 10, r: 3 }, { t: 'c', x: 8.5, y: 7, r: 4 }, { t: 'c', x: 12, y: 10, r: 3 }, { t: 'r', x: 5, y: 10, w: 7, h: 3 }] },
    bell: { label: 'Notifications (bell)', prims: [{ t: 'p', pts: [[8, 1], [11, 4], [11, 9], [14, 12], [2, 12], [5, 9], [5, 4]] }, { t: 'c', x: 8, y: 14, r: 1.5 }] },
    wave: { label: 'Stress (wave)', prims: [L(1, 8, 3.5, 3, 2), L(3.5, 3, 6.5, 13, 2), L(6.5, 13, 9.5, 3, 2), L(9.5, 3, 12.5, 13, 2), L(12.5, 13, 15, 8, 2)] },
    lungs: { label: 'Respiration (lungs)', prims: [{ t: 'r', x: 7.5, y: 1, w: 1, h: 6 }, { t: 'p', pts: [[6, 5], [6, 14], [1.5, 14], [1.5, 9], [4, 5]] }, { t: 'p', pts: [[10, 5], [10, 14], [14.5, 14], [14.5, 9], [12, 5]] }] },
    drop: { label: 'SpO2 (drop)', prims: [{ t: 'c', x: 8, y: 10, r: 4.5 }, { t: 'p', pts: [[8, 1], [3.7, 8.5], [12.3, 8.5]] }] },
    walker: { label: 'Move bar (walking)', prims: [{ t: 'c', x: 9, y: 2.5, r: 1.8 }, L(9, 4.5, 8, 9, 2), L(9, 5.5, 12, 8, 1), L(9, 5.5, 6, 8, 1), L(8, 9, 5, 15, 2), L(8, 9, 11, 15, 2)] },
    clock: { label: 'Clock', acc: true, accDef: '#000000', prims: [{ t: 'c', x: 8, y: 8, r: 7 }, L(8, 8, 8, 3.5, 2, 'a'), L(8, 8, 11.5, 8, 2, 'a')] },
    calendar: { label: 'Calendar', acc: true, accDef: '#000000', prims: [{ t: 'r', x: 1, y: 3, w: 14, h: 12 }, { t: 'r', x: 4, y: 1, w: 2, h: 3 }, { t: 'r', x: 10, y: 1, w: 2, h: 3 }, { t: 'r', x: 3, y: 7, w: 3, h: 2, c: 'a' }, { t: 'r', x: 7, y: 7, w: 3, h: 2, c: 'a' }, { t: 'r', x: 11, y: 7, w: 2, h: 2, c: 'a' }, { t: 'r', x: 3, y: 11, w: 3, h: 2, c: 'a' }, { t: 'r', x: 7, y: 11, w: 3, h: 2, c: 'a' }] },
    flag: { label: 'Steps goal (flag)', acc: true, accDef: '#ff5500', prims: [{ t: 'r', x: 2, y: 1, w: 2, h: 14 }, { t: 'p', pts: [[4, 2], [14, 5.5], [4, 9]], c: 'a' }] },
    bluetooth: { label: 'Bluetooth (connected / not)', acc: true, accDef: '#555555', prims: [
      L(4, 4.5, 11.5, 11, 2, 'm', 'bt1'), L(11.5, 11, 8, 14.5, 2, 'm', 'bt1'), L(8, 14.5, 8, 1.5, 2, 'm', 'bt1'), L(8, 1.5, 11.5, 5, 2, 'm', 'bt1'), L(11.5, 5, 4, 11.5, 2, 'm', 'bt1'),
      L(4, 4.5, 11.5, 11, 2, 'a', 'bt0'), L(11.5, 11, 8, 14.5, 2, 'a', 'bt0'), L(8, 14.5, 8, 1.5, 2, 'a', 'bt0'), L(8, 1.5, 11.5, 5, 2, 'a', 'bt0'), L(11.5, 5, 4, 11.5, 2, 'a', 'bt0')] },
    moon: { label: 'Moon', prims: [{ t: 'p', pts: [[10, 1], [7, 2], [4.5, 4.5], [3.5, 8], [4.5, 11.5], [7, 14], [10, 15], [13, 14.5], [10.5, 13], [8.5, 10.5], [8, 8], [8.5, 5.5], [10.5, 3], [13, 1.5]] }] }
  };
  GW.ICONS = ICONS;
  GW.ICON_SIZES = [12, 14, 16, 20, 24];
  // which icon matches which text source (used by the "Add matching icon" button)
  GW.ICON_FOR = { battery: 'battery', batteryDays: 'battery', hr: 'heart', bodyBat: 'bodybat', steps: 'steps', stepGoal: 'flag', calories: 'flame', floors: 'stairs',
    intMins: 'stopwatch', distance: 'pin', workoutDist: 'pin', altitude: 'mountain', sunrise: 'sunrise', sunset: 'sunset', sunNext: 'sunnext', temp: 'thermo', weatherDesc: 'cloud',
    notif: 'bell', stress: 'wave', resp: 'lungs', spo2: 'drop', moveBar: 'walker', time: 'clock', date: 'calendar', moonIllum: 'moon', moonName: 'moon' };

  // Scaled primitives, absolute screen coordinates. Rectangle edges are rounded as edges (not as sizes) so neighbours stay flush.
  function iconPrims(el) {
    var ic = ICONS[el.kind] || ICONS.battery, s = el.size || 16, k = s / 16, ox = N(el.x - s / 2), oy = N(el.y - s / 2);
    function X(v) { return ox + N(v * k); } function Y(v) { return oy + N(v * k); }
    return ic.prims.map(function (p) {
      var o = { t: p.t, c: p.c === 'a' ? (el.accent || ic.accDef || el.color) : el.color, when: p.when, lv: p.lv };
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
    defaults: function () { return { type: 'icon', name: 'Icon', x: 140, y: 140, kind: 'battery', size: 16, color: '#ffffff', accent: null }; },
    pos: [['x', 'y']],
    draw: function (ctx, el, env) {
      var sim = env.sim, ic = ICONS[el.kind]; if (!ic) return;
      iconPrims(el).forEach(function (p) {
        if (!shown(p, sim)) return;
        var col = q(p.c); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineCap = 'butt';
        if (p.t === 'r') { var w = p.w; if (p.lv) w = Math.floor(p.w * Math.max(0, Math.min(100, p.lv === 'bb' ? sim.bodyBat : sim.battery)) / 100); if (w > 0) ctx.fillRect(p.x, p.y, w, p.h); }
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
      if (ic.acc) f.push({ k: 'accent', t: 'optcolor', label: 'Accent colour (optional)' });
      f.push({ t: 'row', fields: [{ k: 'x', t: 'num', label: 'X (centre)', min: -50, max: 330 }, { k: 'y', t: 'num', label: 'Y (centre)', min: -50, max: 330 }] });
      f.push({ t: 'note', text: 'Drawn from shapes on the watch: no image memory. Preview the charge and battery level in the Test data tab.' });
      return f;
    },
    gen: function (el, cg) {
      var ic = ICONS[el.kind]; if (!ic) return [];
      var prims = iconPrims(el), L = [], needChg = false, needLv = false;
      var needBt = false, lvk = null;
      prims.forEach(function (p) { if (p.when === 'chg') needChg = true; if (p.when === 'bt1' || p.when === 'bt0') needBt = true; if (p.lv) { needLv = true; lvk = p.lv; } });
      if (needChg || needLv) cg.need('sys');
      if (needLv) cg.helper(lvk === 'bb' ? 'bodyBatNow' : 'batteryNow');
      L.push('if (dc has :setAntiAlias) {', '    dc.setAntiAlias(true);', '}');
      if (needChg) L.push('var chg = (_sys has :charging) ? _sys.charging : false;');
      if (needBt) L.push('var bt = System.getDeviceSettings().phoneConnected;');
      if (needLv && lvk === 'bb') L.push('var lv = bodyBatNow();', 'if (lv == null) {', '    lv = 0;', '}');
      else if (needLv) L.push('var lv = batteryNow();');
      var cur = null, curCol = null;
      function closeBlock() { if (cur) { L.push('}'); cur = null; } }
      prims.forEach(function (p, i) {
        var cond = p.when === 'chg' ? 'chg' : (p.when === 'bt1' ? 'bt' : (p.when === 'bt0' ? '!bt' : null));
        if (cond !== cur) { closeBlock(); curCol = null; if (cond) { L.push('if (' + cond + ') {'); cur = cond; } }
        var ind = cur ? '    ' : '', B = [];
        if (p.c !== curCol) { B.push('dc.setColor(' + GW.mcColor(p.c) + ', Graphics.COLOR_TRANSPARENT);'); curCol = p.c; }
        if (p.t === 'r') B.push(p.lv ? 'dc.fillRectangle(' + p.x + ', ' + p.y + ', (' + p.w + ' * lv) / 100, ' + p.h + ');' : 'dc.fillRectangle(' + p.x + ', ' + p.y + ', ' + p.w + ', ' + p.h + ');');
        else if (p.t === 'c') B.push('dc.fillCircle(' + p.x + ', ' + p.y + ', ' + p.r + ');');
        else if (p.t === 'l') B.push('dc.setPenWidth(' + p.w + ');', 'dc.drawLine(' + p.x + ', ' + p.y + ', ' + p.x2 + ', ' + p.y2 + ');', 'dc.setPenWidth(1);');
        else {
          // the point list is a class constant, so nothing is allocated while drawing
          var nm = ('IC_' + el.kind + '_' + i + '_' + p.pts[0][0] + '_' + p.pts[0][1] + '_' + el.size).replace(/-/g, 'n');
          cg.member('    const ' + nm + ' = [' + p.pts.map(function (a) { return '[' + a[0] + ', ' + a[1] + ']'; }).join(', ') + '];');
          B.push('dc.fillPolygon(' + nm + ');');
        }
        B.forEach(function (l) { L.push(ind + l); });
      });
      closeBlock();
      L.push('if (dc has :setAntiAlias) {', '    dc.setAntiAlias(false);', '}');
      return L;
    }
  };

  // charging bolt / battery preview: the Test data tab sets sim.charging
  GW.sim.charging = false;
  GW.sim.btOn = true;
})(window.GW);
