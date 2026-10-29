/* "Run field" element: a full-screen Connect IQ DATA FIELD for runs. Heart rate (zone colour), timer, distance,
   average / current-lap / last-lap pace, 1 km auto-laps and/or Lap button, optional live route trail.
   The preview is a port of the Monkey C in tools/runfield (exported through runfield-src.js). */
(function (GW) {
  'use strict';
  var T = GW.types, q = GW.q, S = GW.RUNFIELD_SRC, pad2 = GW.pad2;

  // ---- glyphs parsed from the exported FieldGlyphs.mc (single source of truth) ----
  var GLYPH = {}, GAP = 3, SPACE = 5;
  (function () { var re = /'(.)' => \[([^\]]*)\]/g, m; while ((m = re.exec(S.glyphs))) GLYPH[m[1]] = m[2].split(',').map(Number); })();

  var C = { BLACK: '#000000', WHITE: '#ffffff', CYAN: '#00ffff', LGREY: '#aaaaaa', TRAIL: '#0055aa', YELLOW: '#ffff00', GREEN: '#55ff55' };
  var ZB = ['#aaaaaa', '#00aaff', '#55ff55', '#ffaa00', '#ff0000'], ZD = ['#555555', '#000055', '#005500', '#555500', '#550000'];

  function width(s, u) {
    var tot = 0;
    for (var i = 0; i < s.length; i++) { var c = s[i]; if (c === ' ') { tot += SPACE; continue; } var g = GLYPH[c]; tot += (g ? g[0] : 8) + GAP; }
    return (tot - GAP) * u;
  }
  function pen(u) { return Math.max(2, Math.trunc(u * 1.5)); }

  // align 0 left / 1 centre / 2 right; y = top of the glyph box
  function text(ctx, s, x, y, u, color, align, halo) {
    var p0 = pen(u), ox = x;
    if (align === 1) ox = x - width(s, u) / 2; else if (align === 2) ox = x - width(s, u);
    for (var pass = halo ? 0 : 1; pass < 2; pass++) {
      var p = pass === 0 ? p0 + 4 : p0, col = q(pass === 0 ? C.BLACK : color), round = pass === 1 && p0 >= 4;
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = p; ctx.lineCap = 'butt';
      var gx0 = ox;
      for (var i = 0; i < s.length; i++) {
        var c = s[i]; if (c === ' ') { gx0 += SPACE * u; continue; }
        var g = GLYPH[c]; if (!g) { gx0 += (8 + GAP) * u; continue; }
        var have = false, psx = 0, psy = 0, r = (p + 1) / 2;
        for (var j = 1; j + 1 < g.length; j += 2) {
          if (g[j] === 99) { have = false; continue; }
          var sx = gx0 + g[j] * u, sy = y + g[j + 1] * u;
          if (have) {
            ctx.beginPath(); ctx.moveTo(psx, psy); ctx.lineTo(sx, sy); ctx.stroke();
            if (!round && psx === sx && psy === sy) { ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill(); }
          }
          if (round) { ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill(); }
          psx = sx; psy = sy; have = true;
        }
        gx0 += (g[0] + GAP) * u;
      }
    }
  }

  function pace(sec) { if (sec < 0 || sec > 3599) return '--:--'; var s = Math.trunc(sec); return Math.floor(s / 60) + ':' + pad2(s % 60); }
  function clock(sec) {
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
    return h > 0 ? h + ':' + pad2(m) + ':' + pad2(s) : pad2(m) + ':' + pad2(s);
  }
  function zoneOf(hr) { var z = 0, Z = [95, 114, 133, 152, 171, 190]; for (var i = 0; i < 5; i++) if (hr >= Z[i]) z = i + 1; return z; }

  // sample route (a loop near Istanbul) so the map preview has something to show
  var ROUTE = (function () {
    var pts = []; for (var i = 0; i <= 80; i++) { var t = i / 80 * Math.PI * 2; pts.push([41.040 + 0.0095 * (Math.sin(t) + 0.45 * Math.sin(2 * t)), 28.985 + 0.0155 * Math.cos(t) * (1 + 0.15 * Math.sin(t))]); }
    return pts;
  })();

  function drawMap(ctx, env) {
    var done = Math.max(2, Math.round(ROUTE.length * Math.min(1, env.sim.runKm / env.sim.runPlanKm))), pts = ROUTE.slice(0, done);
    var minLa = 1e9, maxLa = -1e9, minLo = 1e9, maxLo = -1e9;
    pts.forEach(function (p) { minLa = Math.min(minLa, p[0]); maxLa = Math.max(maxLa, p[0]); minLo = Math.min(minLo, p[1]); maxLo = Math.max(maxLo, p[1]); });
    var midLa = (minLa + maxLa) / 2, midLo = (minLo + maxLo) / 2, cl = Math.cos(GW.rad(midLa)), far = 1e-7;
    pts.forEach(function (p) { far = Math.max(far, Math.hypot((p[1] - midLo) * cl, p[0] - midLa)); });
    var sc = 108 / far;
    function X(p) { return 140 + (p[1] - midLo) * cl * sc; }
    function Y(p) { return 140 - (p[0] - midLa) * sc; }
    ctx.strokeStyle = q(C.TRAIL); ctx.lineWidth = 3; ctx.lineCap = 'butt'; ctx.beginPath();
    pts.forEach(function (p, i) { i ? ctx.lineTo(X(p), Y(p)) : ctx.moveTo(X(p), Y(p)); }); ctx.stroke();
    var h = pts[pts.length - 1], s0 = pts[0];
    [[s0, 4, C.GREEN]].forEach(function (d) { ctx.fillStyle = q(d[2]); ctx.beginPath(); ctx.arc(X(d[0]), Y(d[0]), d[1], 0, 7); ctx.fill(); });
    return { x: X(h), y: Y(h) };
  }

  function draw(ctx, el, env) {
    var s = env.sim, hr = s.runHr, zone = zoneOf(hr), halo = !!el.map;
    // heart-rate zone ring: the current zone is bright and thick, the others dim
    for (var i = 0; i < 5; i++) {
      var on = zone === i + 1, a0 = GW.rad(210 + i * 61 - 90), a1 = a0 + GW.rad(56);
      ctx.strokeStyle = q(on ? ZB[i] : ZD[i]); ctx.lineWidth = on ? 9 : 4; ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.arc(140, 140, 133, a0, a1); ctx.stroke();
    }
    var here = el.map ? drawMap(ctx, env) : null;

    var timerSec = s.runKm * s.runAvg, ts = clock(timerSec), tu = 2.4, tw = width(ts, tu);
    if (tw > 130) tu = tu * 130 / tw;
    text(ctx, ts, 140, 40, tu, C.WHITE, 1, halo);

    var zc = zone >= 1 ? ZB[zone - 1] : C.LGREY;
    text(ctx, zone >= 1 ? 'HR Z' + zone : 'HR', 84, 76, 1.0, zc, 1, halo);
    text(ctx, String(Math.round(hr)), 84, 90, 2.7, zc, 1, halo);
    text(ctx, 'KM', 196, 76, 1.0, C.LGREY, 1, halo);
    text(ctx, s.runKm.toFixed(2), 196, 90, 1.8, C.WHITE, 1, halo);

    text(ctx, 'LAP ' + s.lapNo + '  ' + s.lapKm.toFixed(2) + ' KM', 140, 130, 1.0, C.LGREY, 1, halo);
    text(ctx, pace(s.lapPace), 140, 143, 3.5, C.CYAN, 1, halo);

    text(ctx, 'AVG', 105, 196, 1.0, C.LGREY, 1, halo);
    text(ctx, pace(s.runAvg), 105, 208, 1.7, C.WHITE, 1, halo);
    text(ctx, 'LAST', 175, 196, 1.0, C.LGREY, 1, halo);
    text(ctx, pace(s.lastLap), 175, 208, 1.7, C.WHITE, 1, halo);
    if (here) { // you: drawn last, on top of the numbers
      ctx.fillStyle = q(C.BLACK); ctx.beginPath(); ctx.arc(here.x, here.y, 7, 0, 7); ctx.fill();
      ctx.fillStyle = q(C.YELLOW); ctx.beginPath(); ctx.arc(here.x, here.y, 5, 0, 7); ctx.fill();
    }
  }

  T.runfield = {
    label: 'Run field (data field)', icon: '⏱',
    defaults: function () { return { type: 'runfield', name: 'Run field', autoLap: true, lapM: 1000, map: false }; },
    pos: [],
    draw: draw,
    box: function () { return { x: 0, y: 0, w: 280, h: 280 }; },
    hit: function (el, x, y) { return Math.hypot(x - 140, y - 140) <= 140; },
    fields: function (el) {
      var f = [
        { t: 'note', text: 'A Connect IQ data field for runs. Add it to an activity data screen (one-field layout) and it fills the whole screen. Heart rate (zone colour), timer, distance, average pace, current-lap pace and last-lap pace.' },
        { k: 'autoLap', t: 'check', label: 'Auto lap by distance' }
      ];
      if (el.autoLap) f.push({ k: 'lapM', t: 'num', label: 'Auto lap every (metres)', min: 100, max: 10000, step: 100 });
      f.push({ k: 'map', t: 'check', label: 'Live route map behind the numbers' });
      f.push({ t: 'note', text: el.autoLap
        ? 'The Lap button always starts a new lap too. These laps are shown on the field; for real laps in Garmin Connect also switch on the run profile’s own Auto Lap.'
        : 'Race mode: it only laps when you press the Lap button (so you can lap at the course’s km flags). Make sure the activity’s own Auto Lap is off.' });
      if (el.map) f.push({ t: 'note', text: 'The map is your route so far, drawn as a trail and auto-zoomed with a dot for you (no street tiles: data fields can’t draw those).' });
      return f;
    },
    gen: function (el, cg) {
      ['Toybox.Activity', 'Toybox.UserProfile', 'Toybox.Math'].forEach(cg.imp);
      cg.perm('UserProfile'); if (el.map) cg.perm('Positioning');
      cg.member('    const FLD_AUTO = ' + (el.autoLap ? 'true' : 'false') + ';');
      cg.member('    const FLD_MAP = ' + (el.map ? 'true' : 'false') + ';');
      cg.member('    const FLD_LAP_M = ' + Math.max(100, Math.round(el.lapM || 1000)) + ';');
      cg.file('source/FieldGlyphs.mc', S.glyphs);
      cg.helper('fld');
      cg.hook('init', 'fldInit();'); cg.hook('compute', 'fldCompute(info);'); cg.hook('lap', 'fldLap();'); cg.hook('reset', 'fldReset();');
      return ['fldDraw(dc);'];
    }
  };
})(window.GW);
