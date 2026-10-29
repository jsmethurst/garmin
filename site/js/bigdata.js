/* "Big Data face" element: the whole BigDataFace watchface (rotated layout, stroke font, dot-matrix world map).
   The preview below is a direct port of its Monkey C drawing code; the export uses the original code (bigdata-src.js,
   generated from the project's .mc files) with only the rotation angle changed. */
(function (GW) {
  'use strict';
  var T = GW.types, q = GW.q, S = GW.BDF_SRC, pad2 = GW.pad2;

  // ---- parse the original data modules so there is one source of truth ----
  var GAP = 3, SPACE = 5, GLYPH = {}, MARK = {}, BITS = [];
  (function () {
    var re = /'(.)' => \[([^\]]*)\]/g, m;
    while ((m = re.exec(S.glyphs))) GLYPH[m[1]] = m[2].split(',').map(Number);
    ['DOT', 'CEDILLA', 'BREVE'].forEach(function (n) {
      var mm = new RegExp('MARK_' + n + '\\s*=\\s*\\[([^\\]]*)\\]').exec(S.glyphs); MARK[n] = mm[1].split(',').map(Number);
    });
    S.mapdata.slice(S.mapdata.indexOf('BITS')).replace(/0x([0-9A-Fa-f]+)/g, function (_, h) { BITS.push(parseInt(h, 16)); });
  })();
  var COLS = 72, ROWS = 27;

  var C = { BLACK: '#000000', WHITE: '#ffffff', CYAN: '#00ffff', CYAN_D: '#005555', GREY: '#555555', LGREY: '#aaaaaa',
    RED: '#ff5555', GREEN: '#55ff55', AMBER: '#ffaa00', YELLOW: '#ffff00', MAPC: '#0055ff', OCEAN: '#000055' };
  var DAYS = ['PAZ', 'PZT', 'SAL', 'ÇAR', 'PER', 'CUM', 'CMT'], MONTHS = ['OCA', 'ŞUB', 'MAR', 'NİS', 'MAY', 'HAZ', 'TEM', 'AĞU', 'EYL', 'EKİ', 'KAS', 'ARA'];
  var BASE = { 'İ': 'I', 'Ç': 'C', 'Ş': 'S', 'Ğ': 'G' };
  function baseChar(c) { return BASE[c] || c; }

  // ---- data shown (same rules as refreshData() in the watch code) ----
  function nyc(now) { // { t: 'HH:MM', zone: 'EDT' | 'EST' } from New York's real daylight-saving rule
    try {
      var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false, timeZoneName: 'short' }).formatToParts(now), o = {};
      parts.forEach(function (p) { o[p.type] = p.value; });
      return { t: pad2(parseInt(o.hour, 10) % 24) + ':' + o.minute, zone: o.timeZoneName === 'EST' ? 'EST' : 'EDT' };
    } catch (e) { return { t: '--:--', zone: 'EDT' }; }
  }
  function mm(mins) { return pad2(Math.floor(mins / 60)) + ':' + pad2(mins % 60); }
  function data(env) {
    var s = env.sim, days = s.batteryDays;
    return {
      date: DAYS[env.dow] + ' ' + env.day + ' ' + MONTHS[env.mo - 1],
      temp: Math.round(s.temp) + '°C',
      hr: String(Math.round(s.hr)), steps: String(Math.round(s.steps)),
      bat: (days < 10 ? days.toFixed(1) : String(Math.round(days))) + 'G',
      batColor: days < 3 ? C.RED : (days < 7 ? C.AMBER : C.GREEN),
      km: s.lastKm.toFixed(1), pace: Math.floor(s.paceSec / 60) + ':' + pad2(s.paceSec % 60),
      ny: nyc(env.now), rise: mm(s.sunrise), set: mm(s.sunset)
    };
  }

  // ---- geometry: everything is laid out upright, then rotated about the screen centre ----
  function ctxOf(angle) {
    var a = GW.rad(angle), cs = Math.cos(a), sn = Math.sin(a), cx = 140, cy = 140;
    return { cs: cs, sn: sn, cx: cx, cy: cy,
      rx: function (vx, vy) { return cx + (vx - cx) * cs - (vy - cy) * sn; },
      ry: function (vx, vy) { return cy + (vx - cx) * sn + (vy - cy) * cs; } };
  }

  function strWidth(s, u) {
    var tot = 0;
    for (var i = 0; i < s.length; i++) { var c = s[i]; if (c === ' ') { tot += SPACE; continue; } var g = GLYPH[baseChar(c)]; tot += (g ? g[0] : 8) + GAP; }
    return (tot - GAP) * u;
  }

  function strokes(ctx, arr, start, bx, by, ux, uy, pen, round) {
    var have = false, psx = 0, psy = 0, r = (pen + 1) / 2;
    ctx.lineWidth = pen; ctx.lineCap = 'butt';
    for (var i = start; i + 1 < arr.length; i += 2) {
      var gx = arr[i]; if (gx === 99) { have = false; continue; }
      var gy = arr[i + 1], sx = bx + gx * ux - gy * uy, sy = by + gx * uy + gy * ux;
      if (have) {
        ctx.beginPath(); ctx.moveTo(psx, psy); ctx.lineTo(sx, sy); ctx.stroke();
        if (!round && psx === sx && psy === sy) { ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill(); }
      }
      if (round) { ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill(); }
      psx = sx; psy = sy; have = true;
    }
  }

  // x: virtual left/centre/right (align 0/1/2); y: virtual top of the glyph box
  function drawText(ctx, R, s, x, y, u, pen, color, align, halo) {
    var n = s.length, gl = [], tot = 0, i;
    for (i = 0; i < n; i++) {
      var c = s[i]; if (c === ' ') { tot += SPACE; continue; }
      var g = GLYPH[baseChar(c)]; gl[i] = g; tot += (g ? g[0] : 8) + GAP;
    }
    var ox = x;
    if (align === 1) ox = x - (tot - GAP) * u / 2; else if (align === 2) ox = x - (tot - GAP) * u;
    var ux = u * R.cs, uy = u * R.sn, dy = y - R.cy;
    for (var pass = halo ? 0 : 1; pass < 2; pass++) {
      var p = pass === 0 ? pen + 4 : pen, col = q(pass === 0 ? C.BLACK : color), round = pass === 1 && pen >= 4;
      ctx.strokeStyle = col; ctx.fillStyle = col;
      var gx0 = ox;
      for (i = 0; i < n; i++) {
        var ch = s[i]; if (ch === ' ') { gx0 += SPACE * u; continue; }
        var gg = gl[i]; if (!gg) { gx0 += (8 + GAP) * u; continue; }
        var dx = gx0 - R.cx, bx = R.cx + dx * R.cs - dy * R.sn, by = R.cy + dx * R.sn + dy * R.cs;
        strokes(ctx, gg, 1, bx, by, ux, uy, p, round);
        if (ch === 'İ') strokes(ctx, MARK.DOT, 0, bx, by, ux, uy, p, round);
        else if (ch === 'Ç' || ch === 'Ş') strokes(ctx, MARK.CEDILLA, 0, bx, by, ux, uy, p, round);
        else if (ch === 'Ğ') strokes(ctx, MARK.BREVE, 0, bx, by, ux, uy, p, round);
        gx0 += (gg[0] + GAP) * u;
      }
    }
  }

  // ---- dot-matrix world map, baked once per angle ----
  var pitch = 280 / 72, x0 = (280 - COLS * pitch) / 2, y0 = 280 * 0.40;
  var mapCache = {};
  function mapCanvas(angle) {
    if (mapCache[angle]) return mapCache[angle];
    var c = document.createElement('canvas'); c.width = c.height = 280;
    var x = c.getContext('2d'), R = ctxOf(angle), maxR2 = (140 - 2) * (140 - 2);
    x.fillStyle = C.BLACK; x.fillRect(0, 0, 280, 280);
    for (var r = 0; r < ROWS; r++) {
      var dy = y0 + r * pitch - R.cy;
      for (var k = 0; k < 3; k++) {
        var word = BITS[r * 3 + k];
        for (var i = 0; i < 24; i++) {
          var dx = x0 + (k * 24 + i) * pitch - R.cx;
          if (dx * dx + dy * dy > maxR2) continue;
          var sx = Math.trunc(R.cx + dx * R.cs - dy * R.sn), sy = Math.trunc(R.cy + dx * R.sn + dy * R.cs);
          if ((word >> i) & 1) { x.fillStyle = q(C.MAPC); x.fillRect(sx - 1, sy - 1, 2, 2); }
          else { x.fillStyle = q(C.OCEAN); x.fillRect(sx, sy, 1, 1); }
        }
      }
    }
    mapCache[angle] = c; return c;
  }

  function draw(ctx, el, env) {
    var angle = el.angle, R = ctxOf(angle), d = data(env), W = 280, H = 280;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(mapCanvas(angle), 0, 0, 280, 280);

    drawText(ctx, R, d.date, R.cx, H * 0.14, 1.25, 2, C.WHITE, 1, true);

    // time (shadow first)
    var u = 4.3, pen = Math.trunc(u * 1.7), hs = pad2(env.h), ms = pad2(env.m), gap = GAP * u;
    var hw = strWidth(hs, u), cw = strWidth(':', u), mw = strWidth(ms, u);
    var x = (W - (hw + cw + mw + 2 * gap)) / 2, y = H * 0.232, sh = 3;
    drawText(ctx, R, hs, x + sh, y + sh, u, pen, C.GREY, 0, false);
    drawText(ctx, R, ms, x + hw + cw + 2 * gap + sh, y + sh, u, pen, C.CYAN_D, 0, false);
    drawText(ctx, R, hs, x, y, u, pen, C.WHITE, 0, false);
    drawText(ctx, R, ':', x + hw + gap, y, u, pen, C.LGREY, 0, false);
    drawText(ctx, R, ms, x + hw + cw + 2 * gap, y, u, pen, C.CYAN, 0, false);

    // 2 x 3 grid of readouts
    var xs = [W * 0.2, W * 0.5, W * 0.8], y1 = H * 0.45, y2 = H * 0.614;
    function cell(cx, cy, label, value, col) {
      drawText(ctx, R, label, cx, cy, 1.15, 2, C.LGREY, 1, true);
      drawText(ctx, R, value, cx, cy + 12 * 1.15 + 5, 1.55, 3, col, 1, true);
    }
    cell(xs[0], y1, 'NABIZ', d.hr, C.RED); cell(xs[1], y1, 'ADIM', d.steps, C.WHITE); cell(xs[2], y1, 'PİL', d.bat, d.batColor);
    cell(xs[0], y2, 'SON KM', d.km, C.WHITE); cell(xs[1], y2, 'TEMPO', d.pace, C.WHITE); cell(xs[2], y2, d.ny.zone, d.ny.t, C.CYAN);

    // sunrise / temperature / sunset strip
    function sunGroup(gx, gy, text, up, col) {
      var m = gy + 6 * 1.05, t = 5;
      var pts = up ? [[gx, m + t], [gx + 2 * t, m + t], [gx + t, m - t]] : [[gx, m - t], [gx + 2 * t, m - t], [gx + t, m + t]];
      ctx.fillStyle = q(col); ctx.beginPath();
      pts.forEach(function (p, j) { var X = R.rx(p[0], p[1]), Y = R.ry(p[0], p[1]); j ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
      ctx.closePath(); ctx.fill();
      drawText(ctx, R, text, gx + 14, gy, 1.05, 2, C.WHITE, 0, true);
    }
    var sy = H * 0.793, gw = strWidth('00:00', 1.05) + 14, tw = strWidth(d.temp, 1.05);
    sunGroup(R.cx - gw - 14 - tw / 2, sy, d.rise, true, C.AMBER);
    drawText(ctx, R, d.temp, R.cx, sy, 1.05, 2, C.WHITE, 1, true);
    sunGroup(R.cx + 14 + tw / 2, sy, d.set, false, C.RED);

    // "you are here" marker on the map
    var lon = env.sim.lon, lat = env.sim.lat;
    var vx = x0 + (lon + 180) / 360 * COLS * pitch, vy = y0 + (75 - lat) / 5 * pitch;
    var mx = Math.trunc(R.rx(vx, vy)), my = Math.trunc(R.ry(vx, vy));
    [[10, C.BLACK], [8, C.YELLOW], [4, C.BLACK], [2, C.YELLOW]].forEach(function (c) {
      ctx.fillStyle = q(c[1]); ctx.beginPath(); ctx.arc(mx, my, c[0], 0, 7); ctx.fill();
    });
  }

  var CLOCK_POS = [[0, '12'], [30, '1'], [60, '2'], [90, '3'], [120, '4'], [150, '5']];
  T.bigdata = {
    label: 'Big Data face', icon: '▦',
    defaults: function () { return { type: 'bigdata', name: 'Big Data face', angle: 30 }; },
    pos: [],
    draw: draw,
    box: function () { return { x: 0, y: 0, w: 280, h: 280 }; },
    hit: function (el, x, y) { return Math.hypot(x - 140, y - 140) <= 140; },
    fields: function () {
      return [
        { t: 'note', text: 'A complete face: big time, six readouts, sunrise/sunset and a dot-matrix world map with your position (Istanbul until the watch has a fix). Turkish labels. It draws over everything below it, so keep it at the bottom of the layers.' },
        { k: 'angle', t: 'range', label: 'Tilt: which way the top of the face points', min: 0, max: 359 },
        { k: 'angle', t: 'seg', label: 'Quick pick (clock position)', opts: CLOCK_POS.map(function (p) { return [p[0], p[1]]; }), num: true },
        { t: 'note', text: '2 o’clock (60°) points at the red START button; 1 o’clock (30°) is the 5-minute position.' }
      ];
    },
    gen: function (el, cg) {
      ['Toybox.Activity', 'Toybox.ActivityMonitor', 'Toybox.Application', 'Toybox.Math', 'Toybox.Position', 'Toybox.Time', 'Toybox.Time.Gregorian',
        'Toybox.UserProfile', 'Toybox.Weather'].forEach(cg.imp);
      cg.perm('Positioning'); cg.perm('UserProfile'); cg.minApi('3.4.0');
      cg.file('source/Glyphs.mc', S.glyphs); cg.file('source/MapData.mc', S.mapdata);
      cg.helper('bdf');
      return ['bdDraw(dc, ' + Math.round(el.angle) + ');'];
    }
  };
})(window.GW);
