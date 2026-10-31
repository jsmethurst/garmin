/* Data fields: a "Data cell" element that shows one Activity value (timer, pace, heart rate, ...) in a Garmin system font.
   Several cells make up a full-screen Connect IQ data field. The Monkey C below (GW.DF_SRC) does the activity maths
   (laps, pace, zones, units) and is emitted once; every cell only draws. */
(function (GW) {
  'use strict';
  var T = GW.types, q = GW.q, pad2 = GW.pad2;
  var ZFILL = ['#aaaaaa', '#00aaff', '#55ff55', '#ffaa00', '#ff0000'];

  // ---------- sources: key -> [id used by the Monkey C, label, group] ----------
  GW.DF_SOURCES = [
    ['none', 0, 'Label only (no value)', 'Other'],
    ['timer', 1, 'Timer', 'Time'], ['elapsed', 2, 'Elapsed time', 'Time'], ['tod', 3, 'Time of day', 'Time'],
    ['dist', 4, 'Distance', 'Distance'], ['lapDist', 5, 'Lap distance', 'Distance'], ['ascent', 20, 'Total ascent', 'Distance'], ['alt', 19, 'Altitude', 'Distance'],
    ['pace', 6, 'Pace', 'Pace and speed'], ['avgPace', 7, 'Average pace', 'Pace and speed'], ['lapPace', 8, 'Lap pace', 'Pace and speed'], ['lastLap', 9, 'Last lap pace', 'Pace and speed'],
    ['speed', 17, 'Speed', 'Pace and speed'], ['avgSpeed', 18, 'Average speed', 'Pace and speed'],
    ['lapNo', 10, 'Lap number', 'Laps'],
    ['hr', 11, 'Heart rate', 'Heart rate'], ['zone', 12, 'Heart rate zone', 'Heart rate'], ['avgHr', 13, 'Average heart rate', 'Heart rate'], ['maxHr', 14, 'Max heart rate', 'Heart rate'],
    ['cad', 15, 'Cadence', 'Other'], ['power', 16, 'Power', 'Other'], ['cal', 21, 'Calories', 'Other'], ['batt', 22, 'Watch battery', 'Other']
  ];
  var BY = {}; GW.DF_SOURCES.forEach(function (s) { BY[s[0]] = s; });
  GW.DF_BY = BY;
  GW.DF_GROUPS = ['Time', 'Distance', 'Pace and speed', 'Laps', 'Heart rate', 'Other'];

  // ---------- preview values (mirrors dfStr in the Monkey C) ----------
  function pace(sec, ku) { if (!(sec > 0)) return '--:--'; var p = sec / ku; if (p > 3599) return '--:--'; var s = Math.round(p); return Math.floor(s / 60) + ':' + pad2(s % 60); }
  function clock(sec) {
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
    return h > 0 ? h + ':' + pad2(m) + ':' + pad2(s) : pad2(m) + ':' + pad2(s);
  }
  function zoneOf(hr) { var z = 0, Z = [95, 114, 133, 152, 171, 190]; for (var i = 0; i < 5; i++) if (hr >= Z[i]) z = i + 1; return z; }
  function unitK(d, s) { var u = d.dfUnits || 'watch'; if (u === 'watch') u = s.metric ? 'metric' : 'imperial'; return u === 'imperial' ? 0.621371 : 1; }
  function value(key, d, s, env) {
    var ku = unitK(d, s), timer = s.runKm * s.runAvg;
    switch (key) {
      case 'timer': return clock(timer);
      case 'elapsed': return clock(timer + 42);
      case 'tod': { var hh = env.h; if (!s.is24) { hh = hh % 12; if (hh === 0) hh = 12; } return hh + ':' + pad2(env.m); }
      case 'dist': return (s.runKm * ku).toFixed(2);
      case 'lapDist': return (s.lapKm * ku).toFixed(2);
      case 'pace': return pace(s.runPace, ku);
      case 'avgPace': return pace(s.runAvg, ku);
      case 'lapPace': return pace(s.lapPace, ku);
      case 'lastLap': return pace(s.lastLap, ku);
      case 'speed': return (3600 / s.runPace * ku).toFixed(1);
      case 'avgSpeed': return (3600 / s.runAvg * ku).toFixed(1);
      case 'lapNo': return String(s.lapNo);
      case 'hr': return String(Math.round(s.runHr));
      case 'zone': return String(zoneOf(s.runHr));
      case 'avgHr': return String(Math.round(s.runAvgHr));
      case 'maxHr': return String(Math.round(s.runMaxHr));
      case 'cad': return String(Math.round(s.runCad));
      case 'power': return String(Math.round(s.runPow));
      case 'alt': return String(Math.round(s.altitude * (ku < 1 ? 3.28084 : 1)));
      case 'ascent': return String(Math.round(s.runAscent * (ku < 1 ? 3.28084 : 1)));
      case 'cal': return String(Math.round(s.runCal));
      case 'batt': return String(Math.round(s.battery));
    }
    return '';
  }

  // ---------- the element ----------
  function theme(d) { var dark = d.dfTheme === 'dark'; return { dark: dark, bg: dark ? '#000000' : '#ffffff', fg: dark ? '#ffffff' : '#000000', lab: dark ? '#aaaaaa' : '#555555', line: dark ? '#555555' : '#aaaaaa' }; }
  GW.dfTheme = theme;
  function fh(id) { var f = GW.sysFont(id); return f ? f.box : 20; }

  // vertical layout shared by preview and generator: returns y centres of label and value
  function layout(el) {
    var hasV = el.src !== 'none', hasL = el.labelPos !== 'none' && el.label !== '';
    var lh = hasL ? fh(el.lfont) : 0, vh = hasV ? fh(el.vfont) : 0, gap = hasL && hasV ? GAP : 0, top = el.y + (el.h - lh - vh - gap) / 2;
    return { hasV: hasV, hasL: hasL, gap: gap, ly: top + (el.labelPos === 'below' ? vh + gap : 0) + lh / 2, vy: top + (el.labelPos === 'below' ? 0 : lh + gap) + vh / 2 };
  }
  // the preview's number fonts are drawn a little larger than Garmin's, so nudge them apart (preview only)
  function nudge(el, L) {
    var n = (GW.SYS_FONTS.filter(function (f) { return f[0] === el.vfont; })[0] || [])[2] === 'n';
    if (n && L.hasV) { L.vy += fh(el.vfont) * 0.09; if (L.hasL) L.ly += el.labelPos === 'below' ? 3 : -3; }
    return L;
  }
  var PAD = 6, GAP = 3;   // GAP: space between a cell's label and its value
  function ax(el) { return el.align === 'L' ? el.x + PAD : (el.align === 'R' ? el.x + el.w - PAD : el.x + el.w / 2); }

  // Rotated cell (the rotated export): the box, rules and zone fill become polygons / lines, and the text uses bitmap copies of the
  // system fonts (the same typeface the preview draws them in), because Garmin's own fonts cannot be turned.
  function bitmapOf(sysId) {
    var f = GW.sysFont(sysId); if (!f) return sysId;
    var id = 'bf_' + sysId.toLowerCase().replace('font_', '');
    GW.previewFonts[id] = { id: id, family: f.family, weight: f.weight, px: f.px, glyphs: /NUMBER/.test(sysId) ? 'digits' : 'full', spacing: 0 };
    return id;
  }
  function genRot(el, cg, L, id) {
    var N = Math.round, th = GW.rad(el.rot), c = Math.cos(th), sn = Math.sin(th), cx = el.x + el.w / 2, cy = el.y + el.h / 2, out = [];
    function P(px, py) { var dx = px - cx, dy = py - cy; return [cx + dx * c - dy * sn, cy + dx * sn + dy * c]; }
    function pt(p) { return 'dfx(' + N(p[0]) + '), dfy(' + N(p[1]) + ')'; }
    var box = [P(el.x, el.y), P(el.x + el.w, el.y), P(el.x + el.w, el.y + el.h), P(el.x, el.y + el.h)];
    function poly() { return 'dc.fillPolygon([' + box.map(function (p) { return '[' + pt(p) + ']'; }).join(', ') + ']);'; }
    out.push('var fg = ' + (el.color ? GW.mcColor(el.color) : '_dFg') + ';', 'var lab = ' + (el.lcolor ? GW.mcColor(el.lcolor) : '_dLab') + ';');
    if (L.hasV) out.push('var s = dfStr(' + id + ');');
    if (el.fill) out.push('dc.setColor(' + GW.mcColor(el.fill) + ', ' + GW.mcColor(el.fill) + ');', poly());
    if (el.zone && (el.src === 'hr' || el.src === 'zone')) {
      out.push('var z = dfZone();', 'if (z >= 1) {', '    dc.setColor(DF_ZFILL[z - 1], DF_ZFILL[z - 1]);', '    ' + poly(), '    fg = (z == 5) ? 0xFFFFFF : 0x000000;', '    lab = fg;', '}');
    }
    if (el.bT || el.bB || el.bL || el.bR) {
      out.push('dc.setPenWidth(1);', 'dc.setColor(' + (el.bcolor ? GW.mcColor(el.bcolor) : '_dLine') + ', Graphics.COLOR_TRANSPARENT);');
      [[el.bT, 0, 1], [el.bR, 1, 2], [el.bB, 3, 2], [el.bL, 0, 3]].forEach(function (b) { if (b[0]) out.push('dc.drawLine(' + pt(box[b[1]]) + ', ' + pt(box[b[2]]) + ');'); });
    }
    var just = { L: 0, C: 1, R: 2 }[el.align] == null ? 1 : { L: 0, C: 1, R: 2 }[el.align];
    function text(fontId, str, color, localY) {
      var bid = bitmapOf(fontId), met = GW.fontMetrics(GW.customFont(bid)), k = (met.asc - met.desc) / 2, rf = cg.rotFont(bid, el.rot);
      var p = P(ax(el), localY), ax2 = p[0] - k * sn, ay2 = p[1] + k * c;
      cg.helper('rotTxt');
      out.push('dc.setColor(' + color + ', Graphics.COLOR_TRANSPARENT);',
        'rotTxt(dc, ' + rf.ref + ', ' + rf.adv + ', ' + rf.m + ', ' + str + ', dfx(' + N(ax2) + ') + ' + (ax2 - N(ax2)).toFixed(1) + ', dfy(' + N(ay2) + ') + ' + (ay2 - N(ay2)).toFixed(1) + ', ' + just + ');');
    }
    if (L.hasL) text(el.lfont, JSON.stringify(el.label), 'lab', L.ly);
    if (L.hasV) text(el.vfont, 's', 'fg', L.vy);
    return out;
  }

  T.dfcell = {
    label: 'Data cell', icon: '▭',
    defaults: function () {
      return { type: 'dfcell', name: 'Timer', x: 40, y: 90, w: 200, h: 100, src: 'timer', label: 'TIMER', labelPos: 'above', lfont: 'FONT_XTINY', vfont: 'FONT_NUMBER_MEDIUM',
        align: 'C', color: null, lcolor: null, bcolor: null, fill: null, zone: false, bT: false, bB: false, bL: false, bR: false };
    },
    pos: [['x', 'y']],
    box: function (el) { return { x: el.x, y: el.y, w: el.w, h: el.h }; },
    hit: function (el, x, y) { return x >= el.x && x <= el.x + el.w && y >= el.y && y <= el.y + el.h; },
    draw: function (ctx, el, env) {
      if (el.rot) {   // rotated copy (export option): turn the whole cell about its own centre
        ctx.save(); ctx.translate(el.x + el.w / 2, el.y + el.h / 2); ctx.rotate(GW.rad(el.rot)); ctx.translate(-(el.x + el.w / 2), -(el.y + el.h / 2));
        T.dfcell.draw(ctx, Object.assign({}, el, { rot: 0 }), env); ctx.restore(); return;
      }
      var d = GW.design, th = theme(d), s = env.sim;
      var fg = el.color || th.fg, lab = el.lcolor || th.lab;
      if (el.fill) { ctx.fillStyle = q(el.fill); ctx.fillRect(el.x, el.y, el.w, el.h); }
      var key = el.src, z = key === 'hr' || key === 'zone' ? zoneOf(s.runHr) : 0;
      if (el.zone && z >= 1) { ctx.fillStyle = q(ZFILL[z - 1]); ctx.fillRect(el.x, el.y, el.w, el.h); fg = lab = z === 5 ? '#ffffff' : '#000000'; }
      ctx.strokeStyle = q(el.bcolor || th.line); ctx.lineWidth = 1; ctx.lineCap = 'butt';
      function ln(x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1 + 0.5, y1 + 0.5); ctx.lineTo(x2 + 0.5, y2 + 0.5); ctx.stroke(); }
      if (el.bT) ln(el.x, el.y, el.x + el.w, el.y);
      if (el.bB) ln(el.x, el.y + el.h, el.x + el.w, el.y + el.h);
      if (el.bL) ln(el.x, el.y, el.x, el.y + el.h);
      if (el.bR) ln(el.x + el.w, el.y, el.x + el.w, el.y + el.h);
      var L = nudge(el, layout(el)), x = ax(el), al = el.align === 'L' ? 'L' : (el.align === 'R' ? 'R' : 'C');
      if (L.hasL) GW.drawText(ctx, el.lfont, el.label, x, L.ly, al, q(lab));
      if (L.hasV) {
        var t = value(key, d, s, env);
        GW.drawText(ctx, t.indexOf('-') >= 0 ? 'FONT_MEDIUM' : el.vfont, t, x, L.vy, al, q(fg));
      }
    },
    fields: function (el) {
      var hr = el.src === 'hr' || el.src === 'zone';
      var f = [
        { k: 'src', t: 'dfsrc', label: 'Shows' },
        { k: 'label', t: 'text', label: 'Label' },
        { k: 'labelPos', t: 'seg', label: 'Label position', opts: [['above', 'Above'], ['below', 'Below'], ['none', 'Hidden']] },
        { t: 'h', label: 'Garmin fonts' },
        { k: 'vfont', t: 'sysfont', label: 'Value font' },
        { k: 'lfont', t: 'sysfont', label: 'Label font', only: 't' },
        { k: 'align', t: 'seg', label: 'Alignment', opts: [['L', 'Left'], ['C', 'Centre'], ['R', 'Right']] },
        { t: 'h', label: 'Colours' },
        { k: 'color', t: 'optcolor', label: 'Value colour', noneLabel: 'screen default' },
        { k: 'lcolor', t: 'optcolor', label: 'Label colour', noneLabel: 'screen default' },
        { k: 'fill', t: 'optcolor', label: 'Cell background', noneLabel: 'none' }
      ];
      if (hr) f.push({ k: 'zone', t: 'check', label: 'Fill the cell with the heart-rate zone colour' });
      f.push({ t: 'h', label: 'Divider lines' });
      f.push({ t: 'row', fields: [{ k: 'bT', t: 'check', label: 'Top' }, { k: 'bB', t: 'check', label: 'Bottom' }, { k: 'bL', t: 'check', label: 'Left' }, { k: 'bR', t: 'check', label: 'Right' }] });
      f.push({ k: 'bcolor', t: 'optcolor', label: 'Line colour', noneLabel: 'screen default' });
      f.push({ t: 'h', label: 'Position and size' });
      f.push({ t: 'row', fields: [{ k: 'x', t: 'num', label: 'X (left)', min: -50, max: 330 }, { k: 'y', t: 'num', label: 'Y (top)', min: -50, max: 330 }] });
      f.push({ t: 'row', fields: [{ k: 'w', t: 'num', label: 'Width', min: 10, max: 360 }, { k: 'h', t: 'num', label: 'Height', min: 10, max: 360 }] });
      return f;
    },
    gen: function (el, cg) {
      var d = cg.design;
      ['Toybox.Activity', 'Toybox.UserProfile'].forEach(cg.imp);
      cg.perm('UserProfile');
      cg.member('    const DF_THEME = ' + ({ light: 0, auto: 1, dark: 2 }[d.dfTheme] || 0) + ';');
      cg.member('    const DF_UNITS = ' + ({ watch: 0, metric: 1, imperial: 2 }[d.dfUnits] || 0) + ';');
      var sl = GW.dfSlot(d);
      cg.member('    const DF_W = ' + sl.w + ';'); cg.member('    const DF_H = ' + sl.h + ';');
      cg.helper('dfd');
      cg.hook('begin', 'dfBegin(dc);'); cg.hook('init', 'dfInit();'); cg.hook('compute', 'dfCompute(info);'); cg.hook('lap', 'dfLap();'); cg.hook('reset', 'dfReset();');
      var N = Math.round, L = layout(el), id = BY[el.src] ? BY[el.src][1] : 0, out = [];
      if (el.rot) return genRot(el, cg, L, id);
      var cx = N(el.x), cy = N(el.y), cw = N(el.w), ch = N(el.h);
      out.push('var x = dfx(' + cx + ');', 'var y = dfy(' + cy + ');', 'var w = dfs(' + cw + ');', 'var h = dfs(' + ch + ');');
      out.push('var fg = ' + (el.color ? GW.mcColor(el.color) : '_dFg') + ';', 'var lab = ' + (el.lcolor ? GW.mcColor(el.lcolor) : '_dLab') + ';');
      if (L.hasV) out.push('var s = dfStr(' + id + ');');
      if (el.fill) out.push('dc.setColor(' + GW.mcColor(el.fill) + ', ' + GW.mcColor(el.fill) + ');', 'dc.fillRectangle(x, y, w, h);');
      if (el.zone && (el.src === 'hr' || el.src === 'zone')) {
        out.push('var z = dfZone();', 'if (z >= 1) {', '    dc.setColor(DF_ZFILL[z - 1], DF_ZFILL[z - 1]);', '    dc.fillRectangle(x, y, w, h);',
          '    fg = (z == 5) ? 0xFFFFFF : 0x000000;', '    lab = fg;', '}');
      }
      if (el.bT || el.bB || el.bL || el.bR) {
        out.push('dc.setPenWidth(1);', 'dc.setColor(' + (el.bcolor ? GW.mcColor(el.bcolor) : '_dLine') + ', Graphics.COLOR_TRANSPARENT);');
        if (el.bT) out.push('dc.drawLine(x, y, x + w, y);');
        if (el.bB) out.push('dc.drawLine(x, y + h, x + w, y + h);');
        if (el.bL) out.push('dc.drawLine(x, y, x, y + h);');
        if (el.bR) out.push('dc.drawLine(x + w, y, x + w, y + h);');
      }
      var lf = cg.font(el.lfont), vf = cg.font(el.vfont);
      var just = el.align === 'L' ? 'Graphics.TEXT_JUSTIFY_LEFT' : (el.align === 'R' ? 'Graphics.TEXT_JUSTIFY_RIGHT' : 'Graphics.TEXT_JUSTIFY_CENTER');
      just += ' | Graphics.TEXT_JUSTIFY_VCENTER';
      var tx = el.align === 'L' ? 'x + dfs(' + PAD + ')' : (el.align === 'R' ? 'x + w - dfs(' + PAD + ')' : 'x + w / 2');
      var below = el.labelPos === 'below';
      out.push('var lh = ' + (L.hasL ? 'dc.getFontHeight(' + lf + ')' : '0') + ';', 'var vh = ' + (L.hasV ? 'dc.getFontHeight(' + vf + ')' : '0') + ';',
        'var g = ' + (L.gap ? 'dfs(' + L.gap + ')' : '0') + ';', 'var top = y + (h - lh - vh - g) / 2;');
      if (L.hasL) {
        out.push('dc.setColor(lab, Graphics.COLOR_TRANSPARENT);',
          'dc.drawText(' + tx + ', top + ' + (below ? 'vh + g + ' : '') + 'lh / 2, ' + lf + ', ' + JSON.stringify(el.label) + ', ' + just + ');');
      }
      if (L.hasV) {
        out.push('dc.setColor(fg, Graphics.COLOR_TRANSPARENT);',
          'dc.drawText(' + tx + ', top + ' + (below ? '' : 'lh + g + ') + 'vh / 2, dfF(s, ' + vf + '), s, ' + just + ');');
      }
      return out;
    }
  };

  // ---------- Monkey C: data + formatting shared by all cells ----------
  GW.DF_SRC = {
    members: [
      '    const DF_ZFILL = [0xAAAAAA, 0x00AAFF, 0x55FF55, 0xFFAA00, 0xFF0000];',
      '    private var _dTimer = 0;', '    private var _dElapsed = 0;', '    private var _dDist = 0.0;', '    private var _dPrevT = 0;', '    private var _dPrevD = 0.0;',
      '    private var _dLapT0 = 0;', '    private var _dLapD0 = 0.0;', '    private var _dLapNo = 1;', '    private var _dLast = -1.0;',
      '    private var _dHr = null;', '    private var _dAvgHr = null;', '    private var _dMaxHr = null;', '    private var _dCad = null;', '    private var _dPow = null;',
      '    private var _dSpd = null;', '    private var _dAvgSpd = null;', '    private var _dAlt = null;', '    private var _dAsc = null;', '    private var _dCal = null;',
      '    private var _dZones = null;', '    private var _dKu = 1.0;', '    private var _dK = 1.0;', '    private var _dOx = 0.0;', '    private var _dOy = 0.0;',
      '    private var _dFg = 0x000000;', '    private var _dLab = 0x555555;', '    private var _dLine = 0xAAAAAA;'
    ],
    code: [
      'function dfInit() as Void {',
      '        _dZones = [95, 114, 133, 152, 171, 190];',
      '        var z = UserProfile.getHeartRateZones(UserProfile.HR_ZONE_SPORT_RUNNING);',
      '        if (z != null && z.size() >= 6) { _dZones = z; }',
      '        var u = DF_UNITS;',
      '        if (u == 0) { u = (System.getDeviceSettings().distanceUnits == System.UNIT_STATUTE) ? 2 : 1; }',
      '        _dKu = (u == 2) ? 0.621371 : 1.0;',
      '    }',
      '',
      '    function dfReset() as Void {',
      '        _dTimer = 0;',
      '        _dElapsed = 0;',
      '        _dDist = 0.0;',
      '        _dPrevT = 0;',
      '        _dPrevD = 0.0;',
      '        _dLapT0 = 0;',
      '        _dLapD0 = 0.0;',
      '        _dLapNo = 1;',
      '        _dLast = -1.0;',
      '    }',
      '',
      '    // called every second with the activity data',
      '    function dfCompute(info as Activity.Info) as Void {',
      '        _dHr = info.currentHeartRate;',
      '        _dAvgHr = info.averageHeartRate;',
      '        _dMaxHr = info.maxHeartRate;',
      '        _dCad = info.currentCadence;',
      '        _dPow = info.currentPower;',
      '        _dSpd = info.currentSpeed;',
      '        _dAvgSpd = info.averageSpeed;',
      '        _dAlt = info.altitude;',
      '        _dAsc = info.totalAscent;',
      '        _dCal = info.calories;',
      '        _dElapsed = (info.elapsedTime != null) ? info.elapsedTime : 0;',
      '        var t = (info.timerTime != null) ? info.timerTime : 0;',
      '        var d = (info.elapsedDistance != null) ? info.elapsedDistance : 0.0;',
      '        _dTimer = t;',
      '        _dDist = d;',
      '        _dPrevT = t;',
      '        _dPrevD = d;',
      '    }',
      '',
      '    // Lap button (or the watch\'s own Auto Lap)',
      '    function dfLap() as Void {',
      '        dfEndLap(_dTimer, _dDist);',
      '    }',
      '',
      '    function dfEndLap(tEnd as Number, dEnd as Float) as Void {',
      '        var dist = dEnd - _dLapD0;',
      '        if (dist >= 20.0) {',
      '            _dLast = ((tEnd - _dLapT0) / 1000.0) / (dist / 1000.0);',
      '        }',
      '        _dLapT0 = tEnd;',
      '        _dLapD0 = dEnd;',
      '        _dLapNo += 1;',
      '    }',
      '',
      '    // seconds per km (negative when unknown) shown per km or per mile',
      '    private function dfPace(spk as Float) as String {',
      '        if (spk <= 0.0) { return "--:--"; }',
      '        var p = spk / _dKu;',
      '        if (p > 3599.0) { return "--:--"; }',
      '        var s = (p + 0.5).toNumber();',
      '        return (s / 60).format("%d") + ":" + (s % 60).format("%02d");',
      '    }',
      '',
      '    private function dfTime(ms as Number) as String {',
      '        var s = ms / 1000;',
      '        var h = s / 3600;',
      '        var m = (s % 3600) / 60;',
      '        var sec = s % 60;',
      '        if (h > 0) { return h.format("%d") + ":" + m.format("%02d") + ":" + sec.format("%02d"); }',
      '        return m.format("%02d") + ":" + sec.format("%02d");',
      '    }',
      '',
      '    private function dfSpk(mps) as Float {',
      '        if (mps == null || mps < 0.3) { return -1.0; }',
      '        return 1000.0 / mps;',
      '    }',
      '',
      '    private function dfInt(v) as String {',
      '        return (v == null) ? "--" : v.toNumber().format("%d");',
      '    }',
      '',
      '    // 0 = below zone 1, 1..5 = zones',
      '    function dfZone() as Number {',
      '        if (_dHr == null || _dZones == null) { return 0; }',
      '        var z = 0;',
      '        for (var i = 0; i < 5; i++) {',
      '            if (_dHr >= _dZones[i]) { z = i + 1; }',
      '        }',
      '        return z;',
      '    }',
      '',
      '    // the text of one data source',
      '    function dfStr(k as Number) as String {',
      '        if (k == 1) { return dfTime(_dTimer); }',
      '        if (k == 2) { return dfTime(_dElapsed); }',
      '        if (k == 3) {',
      '            var c = System.getClockTime();',
      '            var h = c.hour;',
      '            if (!System.getDeviceSettings().is24Hour) {',
      '                h = h % 12;',
      '                if (h == 0) { h = 12; }',
      '            }',
      '            return h.format("%d") + ":" + c.min.format("%02d");',
      '        }',
      '        if (k == 4) { return (_dDist / 1000.0 * _dKu).format("%.2f"); }',
      '        if (k == 5) { return ((_dDist - _dLapD0) / 1000.0 * _dKu).format("%.2f"); }',
      '        if (k == 6) { return dfPace(dfSpk(_dSpd)); }',
      '        if (k == 7) {',
      '            if (_dDist < 20.0) { return "--:--"; }',
      '            return dfPace((_dTimer / 1000.0) / (_dDist / 1000.0));',
      '        }',
      '        if (k == 8) {',
      '            var ld = _dDist - _dLapD0;',
      '            if (ld < 20.0) { return "--:--"; }',
      '            return dfPace(((_dTimer - _dLapT0) / 1000.0) / (ld / 1000.0));',
      '        }',
      '        if (k == 9) { return dfPace(_dLast); }',
      '        if (k == 10) { return _dLapNo.format("%d"); }',
      '        if (k == 11) { return dfInt(_dHr); }',
      '        if (k == 12) { return dfZone().format("%d"); }',
      '        if (k == 13) { return dfInt(_dAvgHr); }',
      '        if (k == 14) { return dfInt(_dMaxHr); }',
      '        if (k == 15) { return dfInt(_dCad); }',
      '        if (k == 16) { return dfInt(_dPow); }',
      '        if (k == 17) { return (_dSpd == null) ? "--" : (_dSpd * 3.6 * _dKu).format("%.1f"); }',
      '        if (k == 18) { return (_dAvgSpd == null) ? "--" : (_dAvgSpd * 3.6 * _dKu).format("%.1f"); }',
      '        if (k == 19) { return (_dAlt == null) ? "--" : (_dAlt * ((_dKu < 1.0) ? 3.28084 : 1.0)).toNumber().format("%d"); }',
      '        if (k == 20) { return (_dAsc == null) ? "--" : (_dAsc * ((_dKu < 1.0) ? 3.28084 : 1.0)).toNumber().format("%d"); }',
      '        if (k == 21) { return dfInt(_dCal); }',
      '        if (k == 22) { return (System.getSystemStats().battery + 0.5).toNumber().format("%d"); }',
      '        return "";',
      '    }',
      '',
      '    // screen setup: scale to the field, pick light or dark colours and clear',
      '    function dfBegin(dc as Dc) as Void {',
      '        var w = dc.getWidth();',
      '        var h = dc.getHeight();',
      '        var kx = w / DF_W.toFloat();',
      '        var ky = h / DF_H.toFloat();',
      '        _dK = (kx < ky) ? kx : ky;',
      '        _dOx = (w - DF_W * _dK) / 2.0;',
      '        _dOy = (h - DF_H * _dK) / 2.0;',
      '        var dark = (DF_THEME == 2) || (DF_THEME == 1 && getBackgroundColor() == Graphics.COLOR_BLACK);',
      '        _dFg = dark ? 0xFFFFFF : 0x000000;',
      '        _dLab = dark ? 0xAAAAAA : 0x555555;',
      '        _dLine = dark ? 0x555555 : 0xAAAAAA;',
      '        dc.setColor(_dFg, dark ? 0x000000 : 0xFFFFFF);',
      '        dc.clear();',
      '    }',
      '',
      '    private function dfx(x as Number) as Number { return (_dOx + x * _dK).toNumber(); }',
      '    private function dfy(y as Number) as Number { return (_dOy + y * _dK).toNumber(); }',
      '    private function dfs(v as Number) as Number { return (v * _dK).toNumber(); }',
      '',
      '    // the system number fonts have no "-", so placeholders use a text font',
      '    private function dfF(s as String, f) {',
      '        return (s.find("-") != null) ? Graphics.FONT_MEDIUM : f;',
      '    }'
    ].join('\n')
  };
})(window.GW);
