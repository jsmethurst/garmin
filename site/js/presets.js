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

  function cell(x, y, w, h, src, label, vfont, o) { return E('dfcell', Object.assign({ name: label, x: x, y: y, w: w, h: h, src: src, label: label, vfont: vfont }, o || {})); }
  function cellDesign(name, els) { var d = D(name, '#ffffff', [], els); d.kind = 'datafield'; d.dfTheme = 'light'; d.dfUnits = 'watch'; return d; }

  // the one Bosphorus face (exported from the editor)
  // flat world map used by the Bosphorus face and the World map element (Natural Earth outlines, public domain)
  GW.WORLD_MAP_URL = 'data:image/png;base64,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';
  var BOSPHORUS = {"name":"Bosphorus","bg":"#ffffff","bgImage":null,"fonts":[{"id":"fTime","family":"Libre Baskerville","weight":700,"px":84,"glyphs":"digits","spacing":-3,"tabular":true},{"id":"fDate","family":"DM Sans","weight":500,"px":22,"glyphs":"basic","spacing":0},{"id":"fLab","family":"DM Sans","weight":500,"px":13,"glyphs":"basic","spacing":0,"bold":0},{"id":"fVal","family":"DM Sans","weight":500,"px":22,"glyphs":"basic","spacing":0},{"id":"fSun","family":"DM Sans","weight":500,"px":20,"glyphs":"basic","spacing":0},{"id":"f_spectral700_e57","family":"Spectral","weight":700,"px":84,"glyphs":"digits","spacing":0,"bold":1,"tabular":false}],"elements":[{"id":"eysp853","hidden":false,"locked":false,"type":"arc","name":"Steps ring","cx":140,"cy":140,"r":135,"pen":4,"start":0,"sweep":360,"dir":"cw","source":"steps","min":null,"max":null,"color":"#0055aa","track":"#aaaaaa","round":false},{"id":"e2sblwl","hidden":false,"locked":false,"type":"text","name":"Date","x":140,"y":37,"source":"date","font":"fDate","color":"#000000","justify":"C","prefix":"","suffix":"","upper":false,"hmode":"auto","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"HELLO","tr":true},{"id":"e5tshgp","hidden":false,"locked":false,"type":"sunicon","name":"Sunrise icon","x":63,"y":63,"r":6,"kind":"rise","color":"#ff5500","rot":0},{"id":"ecb7tb6","hidden":false,"locked":false,"type":"text","name":"Sunrise","x":81,"y":63,"source":"sunrise","font":"fSun","color":"#000000","justify":"L","prefix":"","suffix":"","upper":false,"hmode":"auto","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"HELLO"},{"id":"e34m122","hidden":false,"locked":false,"type":"sunicon","name":"Sunset icon","x":157,"y":63,"r":6,"kind":"set","color":"#ff5500","rot":0},{"id":"eho5mx2","hidden":false,"locked":false,"type":"text","name":"Sunset","x":175,"y":63,"source":"sunset","font":"fSun","color":"#000000","justify":"L","prefix":"","suffix":"","upper":false,"hmode":"auto","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"HELLO"},{"id":"e5q3tp6","hidden":false,"locked":false,"type":"text","name":"New York time","x":153,"y":89,"source":"nyTime","font":"fSun","color":"#000000","justify":"C","prefix":"","suffix":"","upper":false,"hmode":"auto","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"HELLO"},{"id":"epfcr8w","hidden":false,"locked":false,"type":"text","name":"Zone","x":122,"y":89,"source":"nyZone","font":"fLab","color":"#ff5500","justify":"R","prefix":"","suffix":"","upper":false,"hmode":"auto","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"HELLO","fontSize":0},{"id":"eezwwuv","hidden":false,"locked":false,"type":"text","name":"Time","x":139,"y":140,"source":"time","font":"f_spectral700_e57","color":"#000000","justify":"C","prefix":"","suffix":"","upper":false,"hmode":"h24","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"HELLO","fontSize":101},{"id":"eg8ysys","hidden":false,"locked":false,"type":"text","name":"ADIM","x":72,"y":191,"source":"custom","font":"fLab","color":"#ff5500","justify":"C","prefix":"","suffix":"","upper":false,"hmode":"auto","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"ADIM"},{"id":"es9rs41","hidden":false,"locked":false,"type":"text","name":"ADIM","x":72,"y":209,"source":"steps","font":"fVal","color":"#000000","justify":"C","prefix":"","suffix":"","upper":false,"hmode":"auto","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"HELLO"},{"id":"er5h6mz","hidden":false,"locked":false,"type":"text","name":"NABIZ","x":140,"y":191,"source":"custom","font":"fLab","color":"#ff5500","justify":"C","prefix":"","suffix":"","upper":false,"hmode":"auto","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"NABIZ","fontSize":13},{"id":"expaney","hidden":false,"locked":false,"type":"text","name":"NABIZ","x":140,"y":209,"source":"hr","font":"fVal","color":"#000000","justify":"C","prefix":"","suffix":"","upper":false,"hmode":"auto","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"HELLO"},{"id":"e5d8iap","hidden":false,"locked":false,"type":"text","name":"PİL","x":210,"y":191,"source":"custom","font":"fLab","color":"#ff5500","justify":"C","prefix":"","suffix":"","upper":false,"hmode":"auto","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"PİL"},{"id":"em6n0to","hidden":false,"locked":false,"type":"text","name":"PİL","x":210,"y":209,"source":"batteryDays","font":"fVal","color":"#000000","justify":"C","prefix":"","suffix":"G","upper":false,"hmode":"auto","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"HELLO"},{"id":"ewmap01","hidden":false,"locked":false,"type":"worldmap","name":"World map","x":140,"y":246,"w":88,"h":34,"asset":"worldmap","marker":"#ff5500","msize":2,"ring":false,"latN":80,"latS":-58}],"appId":"f1edb5edd3cfe31de4f5fa841bc26ac9"};

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
      build: function () { return GW.clone(BOSPHORUS); }, assets: function () { return { worldmap: GW.WORLD_MAP_URL }; } },
    { id: 'run', name: 'Run screen', kind: 'datafield',
      build: function () {
        // laid out like Garmin's own data screen: heart rate on top, four cells in a grid (clockwise from the top left: elapsed time,
        // distance, last lap pace, average pace), current lap pace on the bottom, with thin red rules between the rows
        var RED = '#aa0000';
        var d = cellDesign('Run Screen', [
          cell(20, 8, 240, 60, 'hr', 'HEART RATE', 'FONT_NUMBER_MILD', { lfont: 'FONT_TINY', zone: true, bB: true, bcolor: RED }),
          cell(10, 68, 130, 68, 'elapsed', 'ELAPSED TIME', 'FONT_NUMBER_MILD', { lfont: 'FONT_TINY', bB: true, bR: true, bcolor: RED }),
          cell(140, 68, 130, 68, 'dist', 'DISTANCE', 'FONT_NUMBER_MILD', { lfont: 'FONT_TINY', bB: true, bcolor: RED }),
          cell(10, 136, 130, 68, 'avgPace', 'AVERAGE PACE', 'FONT_NUMBER_MILD', { lfont: 'FONT_TINY', bB: true, bR: true, bcolor: RED }),
          cell(140, 136, 130, 68, 'lastLap', 'LAST LAP PACE', 'FONT_NUMBER_MILD', { lfont: 'FONT_TINY', bB: true, bcolor: RED }),
          cell(40, 204, 200, 62, 'lapPace', 'LAP PACE', 'FONT_NUMBER_MILD', { lfont: 'FONT_TINY' })
        ]);
        return d;
      } },
    { id: 'blankfield', name: 'Blank field', kind: 'datafield', blurb: 'Start from an empty screen and add your own cells.',
      build: function () { return cellDesign('My Data Field', []); } },
    { id: 'blank', name: 'Blank', blurb: 'Start from nothing.', build: function () { return D('My Watchface', '#000000', [], []); } }
  ];

  GW.applyPreset = function (id, done) {
    var p = GW.PRESETS.filter(function (x) { return x.id === id; })[0]; if (!p) return;
    var saved = GW.layouts && GW.layouts.find(p.name, p.kind === 'datafield' ? 'field' : 'watch');   // a saved layout with this name replaces the built-in
    GW.loadFrom(saved ? GW.clone(saved.data) : { design: p.build(), assets: p.assets ? p.assets() : {} }, done);
  };

})(window.GW);
