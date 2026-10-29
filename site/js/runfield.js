/* "Run field" element: a full-screen Connect IQ DATA FIELD for runs, styled like Garmin's native data screens
   (light background, system fonts, thin dividers, heart-rate cell filled with the zone colour).
   Timer, heart rate, distance, current-lap / average / last-lap pace; 1 km auto-laps and/or the Lap button.
   The preview is a port of the Monkey C in tools/runfield (exported through runfield-src.js). */
(function (GW) {
  'use strict';
  var T = GW.types, q = GW.q, S = GW.RUNFIELD_SRC, pad2 = GW.pad2;
  var ZFILL = ['#aaaaaa', '#00aaff', '#55ff55', '#ffaa00', '#ff0000'];

  function pace(sec) { if (sec < 0 || sec > 3599) return '--:--'; var s = Math.round(sec); return Math.floor(s / 60) + ':' + pad2(s % 60); }
  function clock(sec) {
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
    return h > 0 ? h + ':' + pad2(m) + ':' + pad2(s) : pad2(m) + ':' + pad2(s);
  }
  function zoneOf(hr) { var z = 0, Z = [95, 114, 133, 152, 171, 190]; for (var i = 0; i < 5; i++) if (hr >= Z[i]) z = i + 1; return z; }

  function draw(ctx, el, env) {
    var s = env.sim, hr = s.runHr, zone = zoneOf(hr);
    var dark = el.theme === 'dark';   // "Match watch" previews as light
    var bg = dark ? '#000000' : '#ffffff', fg = dark ? '#ffffff' : '#000000', lab = dark ? '#aaaaaa' : '#555555', line = dark ? '#555555' : '#aaaaaa';
    ctx.fillStyle = q(bg); ctx.fillRect(0, 0, 280, 280);

    var hrFg = fg, hrLab = lab;
    if (zone >= 1) {
      ctx.fillStyle = q(ZFILL[zone - 1]); ctx.fillRect(20, 77, 118, 60);
      hrFg = zone === 5 ? '#ffffff' : '#000000'; hrLab = hrFg;
    }
    ctx.strokeStyle = q(line); ctx.lineWidth = 1; ctx.lineCap = 'butt';
    [[16, 76, 264, 76], [8, 138, 272, 138], [14, 206, 266, 206], [140, 76, 140, 138], [140, 206, 140, 252]].forEach(function (l) {
      ctx.beginPath(); ctx.moveTo(l[0] + 0.5, l[1] + 0.5); ctx.lineTo(l[2] + 0.5, l[3] + 0.5); ctx.stroke();
    });
    function label(t, x, y, c) { GW.drawText(ctx, 'FONT_XTINY', t, x, y, 'C', q(c)); }
    function num(t, x, y, font, c) { GW.drawText(ctx, t.indexOf('-') >= 0 ? 'FONT_MEDIUM' : font, t, x, y, 'C', q(c)); }

    label('TIMER', 140, 21, lab);
    num(clock(s.runKm * s.runAvg), 140, 51, 'FONT_NUMBER_MEDIUM', fg);
    label(zone >= 1 ? 'HR  ZONE ' + zone : 'HEART RATE', 80, 88, hrLab);
    num(String(Math.round(hr)), 80, 116, 'FONT_NUMBER_MILD', hrFg);
    label('DISTANCE KM', 200, 88, lab);
    num(s.runKm.toFixed(2), 200, 116, 'FONT_NUMBER_MILD', fg);
    label('LAP ' + s.lapNo + '   ' + s.lapKm.toFixed(2) + ' KM', 140, 148, lab);
    num(pace(s.lapPace), 140, 180, 'FONT_NUMBER_HOT', fg);
    label('AVG PACE', 98, 217, lab);
    num(pace(s.runAvg), 98, 237, 'FONT_NUMBER_MILD', fg);
    label('LAST LAP', 182, 217, lab);
    num(pace(s.lastLap), 182, 237, 'FONT_NUMBER_MILD', fg);
  }

  T.runfield = {
    label: 'Run field (data field)', icon: '⏱',
    defaults: function () { return { type: 'runfield', name: 'Run field', autoLap: true, lapM: 1000, theme: 'light' }; },
    pos: [],
    draw: draw,
    box: function () { return { x: 0, y: 0, w: 280, h: 280 }; },
    hit: function (el, x, y) { return Math.hypot(x - 140, y - 140) <= 140; },
    fields: function (el) {
      var f = [
        { t: 'note', text: 'A Connect IQ data field for runs, styled like Garmin’s own data screens. Add it to an activity data screen (one-field layout) and it fills the screen: timer, heart rate (zone colour), distance, current-lap pace, average pace and last-lap pace.' },
        { k: 'theme', t: 'seg', label: 'Screen colours', opts: [['light', 'Light'], ['auto', 'Match watch'], ['dark', 'Dark']] },
        { k: 'autoLap', t: 'check', label: 'Auto lap by distance' }
      ];
      if (el.autoLap) f.push({ k: 'lapM', t: 'num', label: 'Auto lap every (metres)', min: 100, max: 10000, step: 100 });
      f.push({ t: 'note', text: el.autoLap
        ? 'The Lap button always starts a new lap too. These laps are shown on the field; for real laps in Garmin Connect also switch on the activity’s own Auto Lap.'
        : 'Race mode: it only laps when you press the Lap button (so you can lap at the course’s km flags). Make sure the activity’s own Auto Lap is off.' });
      return f;
    },
    gen: function (el, cg) {
      ['Toybox.Activity', 'Toybox.UserProfile'].forEach(cg.imp);
      cg.perm('UserProfile');
      cg.member('    const FLD_AUTO = ' + (el.autoLap ? 'true' : 'false') + ';');
      cg.member('    const FLD_THEME = ' + ({ light: 0, auto: 1, dark: 2 }[el.theme] || 0) + ';');
      cg.member('    const FLD_LAP_M = ' + Math.max(100, Math.round(el.lapM || 1000)) + ';');
      cg.helper('fld');
      cg.hook('init', 'fldInit();'); cg.hook('compute', 'fldCompute(info);'); cg.hook('lap', 'fldLap();'); cg.hook('reset', 'fldReset();');
      return ['fldDraw(dc);'];
    }
  };
})(window.GW);
