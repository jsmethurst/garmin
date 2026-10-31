/* Preset designs. None of these are Garmin's own faces - they lean on the extra elements (moon, binary, progress rings, bitmap fonts). */
(function (GW) {
  'use strict';
  var E = GW.newElement, rad = GW.rad;

  function txt(x, y, source, font, color, o) { return E('text', Object.assign({ name: (GW.sources[source] || {}).label || 'Text', x: x, y: y, source: source, font: font, color: color }, o || {})); }
  function label(x, y, text, font, color, o) { return txt(x, y, 'custom', font, color, Object.assign({ name: 'Label ' + text, text: text }, o || {})); }
  function ring(src, r, pen, start, sweep, color, o) {
    return E('arc', Object.assign({ name: ((GW.sources[src] || {}).label || 'Arc'), cx: 140, cy: 140, r: r, pen: pen, start: start, sweep: sweep, source: src, color: color }, o || {}));
  }
  function rect(x, y, w, h, color, o) { return E('shape', Object.assign({ name: 'Box', kind: 'rect', x: x, y: y, w: w, h: h, fill: true, color: color }, o || {})); }
  function line(x, y, x2, y2, color, pen, name) { return E('shape', { name: name || 'Line', kind: 'line', x: x, y: y, x2: x2, y2: y2, color: color, pen: pen || 1 }); }
  function dot(x, y, r, color) { return E('shape', { name: 'Star', kind: 'circle', x: x, y: y, r: r, fill: true, color: color }); }
  function font(id, family, weight, px, glyphs, spacing, bold) { var f = { id: id, family: family, weight: weight, px: px, glyphs: glyphs, spacing: spacing || 0 }; if (bold) f.bold = bold; return f; }
  function D(name, bg, fonts, els) { var d = GW.blankDesign(); d.name = name; d.bg = bg; d.fonts = fonts; d.elements = els; return d; }
  function onCircle(deg, r) { return [140 + r * Math.sin(rad(deg)), 140 - r * Math.cos(rad(deg))]; }

  function fieldDesign(name, o) { var d = D(name, '#ffffff', [], [E('runfield', o)]); d.kind = 'datafield'; return d; }
  function cell(x, y, w, h, src, label, vfont, o) { return E('dfcell', Object.assign({ name: label, x: x, y: y, w: w, h: h, src: src, label: label, vfont: vfont }, o || {})); }
  function cellDesign(name, els) { var d = D(name, '#ffffff', [], els); d.kind = 'datafield'; d.dfTheme = 'light'; d.dfUnits = 'watch'; d.dfAutoLap = false; d.dfLapM = 1000; return d; }

  // the one Bosphorus face (exported from the editor)
  var BOSPHORUS = {"name":"Bosphorus","bg":"#ffffff","bgImage":null,"fonts":[{"id":"fTime","family":"Libre Baskerville","weight":700,"px":84,"glyphs":"digits","spacing":-3,"tabular":true},{"id":"fDate","family":"DM Sans","weight":500,"px":22,"glyphs":"basic","spacing":0},{"id":"fLab","family":"DM Sans","weight":500,"px":13,"glyphs":"basic","spacing":0},{"id":"fVal","family":"DM Sans","weight":500,"px":22,"glyphs":"basic","spacing":0},{"id":"fSun","family":"DM Sans","weight":500,"px":20,"glyphs":"basic","spacing":0},{"id":"f_spectral700_e57","family":"Spectral","weight":700,"px":84,"glyphs":"digits","spacing":0,"bold":0,"tabular":false}],"elements":[{"id":"eysp853","hidden":false,"locked":false,"type":"arc","name":"Steps ring","cx":140,"cy":140,"r":135,"pen":3,"start":0,"sweep":360,"dir":"cw","source":"steps","min":null,"max":null,"color":"#ff5500","track":"#aaaaaa","round":false},{"id":"e2sblwl","hidden":false,"locked":false,"type":"text","name":"Date","x":140,"y":37,"source":"date","font":"fDate","color":"#ff5500","justify":"C","prefix":"","suffix":"","upper":false,"hmode":"auto","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"HELLO","tr":true},{"id":"e5tshgp","hidden":false,"locked":false,"type":"sunicon","name":"Sunrise icon","x":63,"y":63,"r":6,"kind":"rise","color":"#ff5500","rot":0},{"id":"ecb7tb6","hidden":false,"locked":false,"type":"text","name":"Sunrise","x":81,"y":63,"source":"sunrise","font":"fSun","color":"#000000","justify":"L","prefix":"","suffix":"","upper":false,"hmode":"auto","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"HELLO"},{"id":"e34m122","hidden":false,"locked":false,"type":"sunicon","name":"Sunset icon","x":157,"y":63,"r":6,"kind":"set","color":"#ff5500","rot":0},{"id":"eho5mx2","hidden":false,"locked":false,"type":"text","name":"Sunset","x":175,"y":63,"source":"sunset","font":"fSun","color":"#000000","justify":"L","prefix":"","suffix":"","upper":false,"hmode":"auto","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"HELLO"},{"id":"e5q3tp6","hidden":false,"locked":false,"type":"text","name":"New York time","x":140,"y":89,"source":"nyTime","font":"fSun","color":"#000000","justify":"C","prefix":"","suffix":"","upper":false,"hmode":"auto","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"HELLO"},{"id":"epfcr8w","hidden":false,"locked":false,"type":"text","name":"Zone","x":110,"y":89,"source":"nyZone","font":"fLab","color":"#555555","justify":"R","prefix":"","suffix":"","upper":false,"hmode":"auto","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"HELLO","fontSize":0},{"id":"eezwwuv","hidden":false,"locked":false,"type":"text","name":"Time","x":140,"y":140,"source":"time","font":"f_spectral700_e57","color":"#000000","justify":"C","prefix":"","suffix":"","upper":false,"hmode":"h24","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"HELLO","fontSize":101},{"id":"eg8ysys","hidden":false,"locked":false,"type":"text","name":"ADIM","x":72,"y":192,"source":"custom","font":"fLab","color":"#555555","justify":"C","prefix":"","suffix":"","upper":false,"hmode":"auto","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"ADIM"},{"id":"es9rs41","hidden":false,"locked":false,"type":"text","name":"ADIM","x":72,"y":209,"source":"steps","font":"fVal","color":"#000000","justify":"C","prefix":"","suffix":"","upper":false,"hmode":"auto","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"HELLO"},{"id":"er5h6mz","hidden":false,"locked":false,"type":"text","name":"NABIZ","x":140,"y":192,"source":"custom","font":"fLab","color":"#555555","justify":"C","prefix":"","suffix":"","upper":false,"hmode":"auto","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"NABIZ"},{"id":"expaney","hidden":false,"locked":false,"type":"text","name":"NABIZ","x":140,"y":209,"source":"hr","font":"fVal","color":"#000000","justify":"C","prefix":"","suffix":"","upper":false,"hmode":"auto","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"HELLO"},{"id":"e5d8iap","hidden":false,"locked":false,"type":"text","name":"PİL","x":210,"y":192,"source":"custom","font":"fLab","color":"#555555","justify":"C","prefix":"","suffix":"","upper":false,"hmode":"auto","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"PİL"},{"id":"em6n0to","hidden":false,"locked":false,"type":"text","name":"PİL","x":210,"y":209,"source":"batteryDays","font":"fVal","color":"#000000","justify":"C","prefix":"","suffix":"G","upper":false,"hmode":"auto","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"HELLO"},{"id":"eiemdne","hidden":false,"locked":false,"type":"text","name":"SON KM","x":107,"y":230,"source":"custom","font":"fLab","color":"#555555","justify":"C","prefix":"","suffix":"","upper":false,"hmode":"auto","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"SON KM"},{"id":"e1pbe4a","hidden":false,"locked":false,"type":"text","name":"SON KM","x":107,"y":247,"source":"lastKm","font":"fVal","color":"#000000","justify":"C","prefix":"","suffix":"","upper":false,"hmode":"auto","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"HELLO"},{"id":"ev8ejnd","hidden":false,"locked":false,"type":"text","name":"TEMPO","x":173,"y":230,"source":"custom","font":"fLab","color":"#555555","justify":"C","prefix":"","suffix":"","upper":false,"hmode":"auto","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"TEMPO"},{"id":"e3luig8","hidden":false,"locked":false,"type":"text","name":"TEMPO","x":173,"y":247,"source":"lastPace","font":"fVal","color":"#000000","justify":"C","prefix":"","suffix":"","upper":false,"hmode":"auto","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"HELLO"}]};

  GW.PRESETS = [
    { id: 'orbit', name: 'Orbit', blurb: 'Four nested rings: steps, battery, how much of the day and the year is gone.',
      build: function () {
        return D('Orbit', '#000000', [], [
          ring('steps', 134, 7, 0, 330, '#00ffff'),
          ring('battery', 124, 7, 0, 330, '#55ff55'),
          ring('dayPct', 114, 7, 0, 330, '#ff55ff'),
          ring('yearPct', 104, 7, 0, 330, '#ffaa00'),
          txt(140, 86, 'steps', 'FONT_TINY', '#00ffff', { suffix: ' steps', upper: true }),
          txt(140, 130, 'time', 'FONT_NUMBER_HOT', '#ffffff'),
          txt(140, 170, 'date', 'FONT_SMALL', '#aaaaaa', { upper: true }),
          txt(140, 196, 'battery', 'FONT_TINY', '#55ff55', { suffix: '%' })
        ]);
      } },
    { id: 'terminal', name: 'Terminal', blurb: 'Green-on-black shell prompt with a monospaced bitmap font.',
      build: function () {
        var F = 'f_term16', B = 'f_term52', c1 = '#00ff55', c2 = '#00aa55';
        return D('Terminal', '#000000', [font(B, 'Share Tech Mono', 400, 52, 'digits'), font(F, 'Share Tech Mono', 400, 17, 'full')], [
          label(46, 52, 'fenix@6x:~$ now', F, c2, { justify: 'L' }),
          txt(46, 92, 'time', B, c1, { justify: 'L', secs: false }),
          txt(46, 136, 'date', F, c1, { justify: 'L', prefix: 'date  ', fmt: 'ddd DD MMM' }),
          txt(46, 158, 'battery', F, c1, { justify: 'L', prefix: 'bat   ', suffix: '%' }),
          txt(46, 180, 'steps', F, c1, { justify: 'L', prefix: 'steps ' }),
          txt(46, 202, 'hr', F, c1, { justify: 'L', prefix: 'hr    ', suffix: ' bpm' }),
          txt(46, 224, 'temp', F, c1, { justify: 'L', prefix: 'temp  ', suffix: '°' }),
          label(46, 246, '_', F, c2, { justify: 'L' })
        ]);
      } },
    { id: 'pilot', name: 'Pilot', blurb: 'Classic analog: sword hands, big numerals, a date window at 3.',
      build: function () {
        var N = 'f_pil38';
        return D('Pilot', '#000000', [font(N, 'Bebas Neue', 400, 40, 'nums')], [
          E('shape', { name: 'Dial', kind: 'circle', x: 140, y: 140, r: 140, fill: true, color: '#000055', locked: true }),
          E('ticks', { r: 137, len: 8, major: 5, majorLen: 18, majorWidth: 4, color: '#aaaaaa', majorColor: '#ffffff' }),
          label(140, 44, '12', N, '#ffffff'), label(140, 236, '6', N, '#ffffff'), label(44, 140, '9', N, '#ffffff'),
          E('shape', { name: 'Date window', kind: 'rect', x: 228, y: 140, w: 50, h: 30, fill: false, pen: 2, color: '#ffffff' }),
          txt(228, 140, 'date', 'FONT_SMALL', '#ffffff', { fmt: 'DD' }),
          txt(140, 92, 'date', 'FONT_XTINY', '#aaaaff', { fmt: 'DDDD', upper: true }),
          txt(140, 192, 'battery', 'FONT_XTINY', '#aaaaff', { prefix: 'BAT ', suffix: '%' }),
          E('hands', { style: 'sword', hLen: 66, hW: 12, mLen: 102, mW: 10, sColor: '#ff5500', hubColor: '#ff5500' })
        ]);
      } },
    { id: 'synthwave', name: 'Synthwave', blurb: 'Striped sunset over a neon grid. Pure shapes, tiny memory cost.',
      build: function () {
        var T = 'f_syn48', els = [
          E('shape', { name: 'Sun', kind: 'circle', x: 140, y: 104, r: 66, fill: true, color: '#ff5500' }),
          rect(140, 118, 150, 2, '#000000', { name: 'Sun slit' }), rect(140, 130, 150, 3, '#000000', { name: 'Sun slit' }),
          rect(140, 143, 150, 4, '#000000', { name: 'Sun slit' }), rect(140, 157, 150, 5, '#000000', { name: 'Sun slit' }),
          rect(140, 225, 300, 118, '#550055', { name: 'Ground', locked: true }),
          line(0, 167, 280, 167, '#ff55ff', 2, 'Horizon')
        ];
        [178, 192, 210, 234, 266].forEach(function (y) { els.push(line(0, y, 280, y, '#aa00aa', 1, 'Grid row')); });
        for (var k = -4; k <= 4; k++) els.push(line(140, 167, 140 + k * 62, 290, '#aa00aa', 1, 'Grid col'));
        els.push(txt(140, 82, 'time', T, '#ffffff'));
        els.push(txt(140, 28, 'date', 'FONT_SMALL', '#00ffff', { upper: true }));
        els.push(rect(140, 250, 124, 24, '#000000', { name: 'Plate' }));
        els.push(txt(140, 250, 'steps', 'FONT_TINY', '#ffff55', { suffix: ' STEPS', upper: true }));
        return D('Synthwave', '#000000', [font(T, 'Orbitron', 900, 50, 'digits')], els);
      } },
    { id: 'moonlight', name: 'Moonlight', blurb: 'Real moon phase drawn on the watch, with an illumination ring.',
      build: function () {
        var stars = [[40, 90, 1], [70, 40, 1], [210, 50, 1], [240, 100, 1], [30, 160, 1], [250, 170, 1], [100, 24, 1], [182, 24, 1], [60, 215, 1], [222, 218, 1], [225, 78, 2], [52, 128, 2], [90, 66, 1], [196, 62, 1]];
        var els = stars.map(function (s) { return dot(s[0], s[1], s[2], '#ffffff'); });
        els.push(ring('moonIllum', 62, 3, 0, 359, '#aaaaff', { cy: 94, round: false, track: '#0000aa' }));
        els.push(E('moon', { x: 140, y: 94, r: 50, lit: '#ffffaa', dark: '#0000aa', rim: '#aaaaff' }));
        els.push(txt(140, 164, 'moonName', 'FONT_XTINY', '#aaaaff', { upper: true }));
        els.push(txt(140, 206, 'time', 'FONT_NUMBER_HOT', '#ffffff'));
        els.push(txt(140, 249, 'date', 'FONT_TINY', '#aaaaaa', { upper: true }));
        return D('Moonlight', '#000055', [], els);
      } },
    { id: 'binary', name: 'Binary', blurb: 'Read the time in dots. Digits underneath for when you give up.',
      build: function () {
        var M = 'f_bin26';
        return D('Binary', '#000000', [font(M, 'Share Tech Mono', 400, 28, 'digits')], [
          ring('battery', 134, 4, 0, 359, '#00ff55', { round: false, track: '#005500' }),
          label(140, 38, 'BINARY', 'FONT_XTINY', '#55aa55'),
          E('binary', { x: 140, y: 112, r: 10, gap: 7, on: '#00ff55', off: '#005500' }),
          txt(140, 192, 'time', M, '#00aa55'),
          txt(140, 220, 'date', 'FONT_XTINY', '#55aa55', { upper: true })
        ]);
      } },
    { id: 'tactical', name: 'Tactical', blurb: 'Four bezel gauges with readouts: steps, battery, body battery, heart rate.',
      build: function () {
        var g = [['steps', 20, '#00ffff'], ['battery', 110, '#55ff55'], ['bodyBat', 200, '#ffaa00'], ['hr', 290, '#ff5555']], els = [];
        g.forEach(function (a) {
          els.push(ring(a[0], 132, 8, a[1], 70, a[2], a[0] === 'hr' ? { min: 50, max: 180 } : {}));
          var p = onCircle(a[1] + 35, 100);
          els.push(txt(Math.round(p[0]), Math.round(p[1]), a[0], 'FONT_TINY', a[2], {}));
        });
        els.push(txt(140, 94, 'date', 'FONT_TINY', '#aaaaaa', { upper: true }));
        els.push(txt(140, 136, 'time', 'FONT_NUMBER_HOT', '#ffffff'));
        els.push(E('wxicon', { x: 112, y: 186, size: 30 }));
        els.push(txt(134, 186, 'temp', 'FONT_MEDIUM', '#ffff55', { suffix: '°', justify: 'L' }));
        els.push(E('movebar', { x: 140, y: 234, w: 84, h: 6, gap: 3 }));
        return D('Tactical', '#000000', [], els);
      } },
    { id: 'minimal', name: 'Minimal', blurb: 'Two huge numerals and a single thin minute ring.',
      build: function () {
        var B = 'f_min104';
        return D('Minimal', '#000000', [font(B, 'Bebas Neue', 400, 112, 'nums')], [
          ring('minute', 136, 3, 0, 359, '#ff5500', { round: false, track: '#555555' }),
          txt(140, 96, 'hour', B, '#ffffff', { lz: false }),
          txt(140, 186, 'minute', B, '#ff5500'),
          txt(140, 258, 'date', 'FONT_XTINY', '#aaaaaa', { upper: true, fmt: 'ddd DD' }),
          txt(140, 24, 'battery', 'FONT_XTINY', '#555555', { suffix: '%' })
        ]);
      } },
    { id: 'pixel', name: 'Pixel LCD', blurb: 'Handheld-console nostalgia in a pixel font.',
      build: function () {
        var P = 'f_px32', S = 'f_px16';
        return D('Pixel LCD', '#aaaa55', [font(P, 'Press Start 2P', 400, 32, 'digits'), font(S, 'Press Start 2P', 400, 16, 'basic')], [
          E('shape', { name: 'Frame', kind: 'rect', x: 140, y: 140, w: 222, h: 150, rad: 10, fill: false, pen: 4, color: '#005500' }),
          txt(140, 94, 'date', S, '#005500', { upper: true, fmt: 'ddd DD MMM' }),
          txt(140, 140, 'time', P, '#005500'),
          txt(140, 188, 'battery', S, '#005500', { prefix: 'BAT ', suffix: '%' })
        ]);
      } },
    { id: 'bigdata', name: 'Bosphorus',
      build: function () { return GW.clone(BOSPHORUS); } },
    { id: 'run', name: 'Run screen', kind: 'datafield', blurb: 'Data field for runs in Garmin\u2019s own style: timer, HR zone colour, distance, lap / average / last-lap pace. Auto-laps every km.',
      build: function () { return fieldDesign('Run Screen', { name: 'Run screen', autoLap: true }); } },
    { id: 'race', name: 'Race screen', kind: 'datafield', blurb: 'Same screen, but it only laps when you press Lap: for km flags on a race course.',
      build: function () { return fieldDesign('Race Screen', { name: 'Race screen', autoLap: false }); } },
    { id: 'f1', name: 'One field', kind: 'datafield', blurb: 'One huge number.',
      build: function () { return cellDesign('One Field', [cell(20, 40, 240, 200, 'pace', 'PACE', 'FONT_NUMBER_THAI_HOT')]); } },
    { id: 'f2', name: 'Two fields', kind: 'datafield', blurb: 'Timer on top, distance below.',
      build: function () { return cellDesign('Two Fields', [cell(20, 26, 240, 112, 'timer', 'TIMER', 'FONT_NUMBER_HOT', { bB: true }), cell(20, 142, 240, 112, 'dist', 'DISTANCE', 'FONT_NUMBER_HOT')]); } },
    { id: 'f3', name: 'Three fields', kind: 'datafield', blurb: 'Timer, then heart rate (zone colour) and pace side by side.',
      build: function () { return cellDesign('Three Fields', [cell(20, 24, 240, 100, 'timer', 'TIMER', 'FONT_NUMBER_HOT', { bB: true }), cell(30, 128, 108, 110, 'hr', 'HEART RATE', 'FONT_NUMBER_MEDIUM', { zone: true, bR: true }), cell(142, 128, 108, 110, 'pace', 'PACE', 'FONT_NUMBER_MEDIUM')]); } },
    { id: 'f4', name: 'Four fields', kind: 'datafield', blurb: 'A 2 \u00d7 2 grid: timer, distance, heart rate and pace.',
      build: function () { return cellDesign('Four Fields', [cell(44, 28, 94, 100, 'timer', 'TIMER', 'FONT_NUMBER_MILD', { bR: true, bB: true }), cell(142, 28, 94, 100, 'dist', 'DISTANCE', 'FONT_NUMBER_MILD', { bB: true }), cell(44, 132, 94, 100, 'hr', 'HEART RATE', 'FONT_NUMBER_MILD', { zone: true, bR: true }), cell(142, 132, 94, 100, 'pace', 'PACE', 'FONT_NUMBER_MILD')]); } },
    { id: 'blankfield', name: 'Blank field', kind: 'datafield', blurb: 'Start from an empty screen and add your own cells.',
      build: function () { return cellDesign('My Data Field', []); } },
    { id: 'blank', name: 'Blank', blurb: 'Start from nothing.', build: function () { return D('My Watchface', '#000000', [], []); } }
  ];

  GW.applyPreset = function (id, done) {
    var p = GW.PRESETS.filter(function (x) { return x.id === id; })[0]; if (!p) return;
    var d = p.build();
    GW.loadFrom({ design: d, assets: {} }, done);
  };
})(window.GW);
