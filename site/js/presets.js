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
  var BOSPHORUS = {"name":"Bosphorus","bg":"#ffffff","bgImage":null,"fonts":[{"id":"fTime","family":"Libre Baskerville","weight":700,"px":84,"glyphs":"digits","spacing":-3,"tabular":true},{"id":"fDate","family":"DM Sans","weight":500,"px":22,"glyphs":"basic","spacing":0},{"id":"fLab","family":"DM Sans","weight":500,"px":13,"glyphs":"basic","spacing":0,"bold":0},{"id":"fVal","family":"DM Sans","weight":500,"px":22,"glyphs":"basic","spacing":0},{"id":"fSun","family":"DM Sans","weight":500,"px":20,"glyphs":"basic","spacing":0},{"id":"f_spectral700_e57","family":"Spectral","weight":700,"px":84,"glyphs":"digits","spacing":0,"bold":1,"tabular":false}],"elements":[{"id":"eysp853","hidden":false,"locked":false,"type":"arc","name":"Steps ring","cx":140,"cy":140,"r":135,"pen":4,"start":0,"sweep":360,"dir":"cw","source":"steps","min":null,"max":null,"color":"#0055aa","track":"#aaaaaa","round":false},{"id":"e2sblwl","hidden":false,"locked":false,"type":"text","name":"Date","x":140,"y":37,"source":"date","font":"fDate","color":"#000000","justify":"C","prefix":"","suffix":"","upper":false,"hmode":"auto","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"HELLO","tr":true},{"id":"e5tshgp","hidden":false,"locked":false,"type":"sunicon","name":"Sunrise icon","x":63,"y":63,"r":6,"kind":"rise","color":"#ff5500","rot":0},{"id":"ecb7tb6","hidden":false,"locked":false,"type":"text","name":"Sunrise","x":81,"y":63,"source":"sunrise","font":"fSun","color":"#000000","justify":"L","prefix":"","suffix":"","upper":false,"hmode":"auto","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"HELLO"},{"id":"e34m122","hidden":false,"locked":false,"type":"sunicon","name":"Sunset icon","x":157,"y":63,"r":6,"kind":"set","color":"#ff5500","rot":0},{"id":"eho5mx2","hidden":false,"locked":false,"type":"text","name":"Sunset","x":175,"y":63,"source":"sunset","font":"fSun","color":"#000000","justify":"L","prefix":"","suffix":"","upper":false,"hmode":"auto","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"HELLO"},{"id":"e5q3tp6","hidden":false,"locked":false,"type":"text","name":"New York time","x":153,"y":89,"source":"nyTime","font":"fSun","color":"#000000","justify":"C","prefix":"","suffix":"","upper":false,"hmode":"auto","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"HELLO"},{"id":"epfcr8w","hidden":false,"locked":false,"type":"text","name":"Zone","x":122,"y":89,"source":"nyZone","font":"fLab","color":"#ff5500","justify":"R","prefix":"","suffix":"","upper":false,"hmode":"auto","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"HELLO","fontSize":0},{"id":"eezwwuv","hidden":false,"locked":false,"type":"text","name":"Time","x":139,"y":140,"source":"time","font":"f_spectral700_e57","color":"#000000","justify":"C","prefix":"","suffix":"","upper":false,"hmode":"h24","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"HELLO","fontSize":101},{"id":"eg8ysys","hidden":false,"locked":false,"type":"text","name":"ADIM","x":72,"y":191,"source":"custom","font":"fLab","color":"#ff5500","justify":"C","prefix":"","suffix":"","upper":false,"hmode":"auto","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"ADIM"},{"id":"es9rs41","hidden":false,"locked":false,"type":"text","name":"ADIM","x":72,"y":209,"source":"steps","font":"fVal","color":"#000000","justify":"C","prefix":"","suffix":"","upper":false,"hmode":"auto","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"HELLO"},{"id":"er5h6mz","hidden":false,"locked":false,"type":"text","name":"NABIZ","x":140,"y":191,"source":"custom","font":"fLab","color":"#ff5500","justify":"C","prefix":"","suffix":"","upper":false,"hmode":"auto","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"NABIZ","fontSize":13},{"id":"expaney","hidden":false,"locked":false,"type":"text","name":"NABIZ","x":140,"y":209,"source":"hr","font":"fVal","color":"#000000","justify":"C","prefix":"","suffix":"","upper":false,"hmode":"auto","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"HELLO"},{"id":"e5d8iap","hidden":false,"locked":false,"type":"text","name":"PİL","x":210,"y":191,"source":"custom","font":"fLab","color":"#ff5500","justify":"C","prefix":"","suffix":"","upper":false,"hmode":"auto","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"PİL"},{"id":"em6n0to","hidden":false,"locked":false,"type":"text","name":"PİL","x":210,"y":209,"source":"batteryDays","font":"fVal","color":"#000000","justify":"C","prefix":"","suffix":"G","upper":false,"hmode":"auto","lz":true,"secs":false,"sep":":","fmt":"ddd DD MMM","unit":"auto","text":"HELLO"},{"id":"ewmap01","hidden":false,"locked":false,"type":"worldmap","name":"World map","x":140,"y":248,"w":104,"h":40,"asset":null,"land":"#3a3a3a","marker":"#ff5500","msize":2,"ring":false,"latN":80,"latS":-58}],"appId":"f1edb5edd3cfe31de4f5fa841bc26ac9"};

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
    { id: 'terminaltr', name: 'Terminal Türkçe', blurb: 'Green-on-black shell prompt in Turkish: time, date, New York, next sunrise or sunset, battery days, pulse, weather, steps.',
      build: function () {
        var F = 'f_term17', B = 'f_term52', c1 = '#00ff55', c2 = '#00aa55';
        var els = [label(48, 38, 'fenix@6x:~$ şimdi_', F, c2, { justify: 'L' }), txt(48, 80, 'time', B, c1, { justify: 'L', secs: false })];
        // two columns, so every value lines up whatever the letters of its label are: labels at x = 48, values at x = 112
        [[['label', 'tarih'], ['date', '', '', { fmt: 'ddd DD MMM YYYY', tr: true, lower: true }]],
         [['nyZone', '', '', { lower: true }], ['nyTime']],
         [['sunNextName', '', '', { tr: true }], ['sunNext']],
         [['label', 'pil'], ['batteryDays', '', ' gün']],
         [['label', 'nabız'], ['hr', '', ' bpm']],
         [['label', 'hava'], ['tempCond']],
         [['label', 'adım'], ['steps']]
        ].forEach(function (r, i) {
          var y = 120 + i * 18, a = r[0], b = r[1];
          els.push(a[0] === 'label' ? label(48, y, a[1], F, c1, { justify: 'L' }) : txt(48, y, a[0], F, c1, Object.assign({ justify: 'L' }, a[3] || {})));
          els.push(txt(112, y, b[0], F, c1, Object.assign({ justify: 'L', suffix: b[2] || '' }, b[3] || {})));
        });
        return D('Terminal Türkçe', '#000000', [font(B, 'Share Tech Mono', 400, 52, 'digits'), font(F, 'Share Tech Mono', 400, 17, 'full')], els);
      } },
    { id: 'activitydial', name: 'Activity Dial', blurb: 'Black analog dial with white batons and hands, a red second hand, a date plate, a temperature gauge, a steps ring and three activity rings.',
      build: function () {
        var X = 'FONT_XTINY', w = '#ffffff';
        function disc(x, y, r, c, n) { return E('shape', { name: n || 'Plate', kind: 'circle', x: x, y: y, r: r, fill: true, color: c }); }
        var els = [
          E('ticks', { name: 'Bezel ticks', r: 139, len: 4, count: 120, major: 0, width: 1, color: '#777777' }),
          E('ticks', { name: 'Hour batons', r: 128, len: 17, count: 12, major: 1, majorLen: 17, width: 5, majorWidth: 5, color: w, majorColor: w }),
          disc(140, 12, 18, '#000000', 'Hide 12 baton'), disc(140, 268, 18, '#000000', 'Hide 6 baton'),
          // date plate at the top
          disc(140, 52, 33, '#000000'), E('shape', { name: 'Date plate outline', kind: 'circle', x: 140, y: 52, r: 33, fill: false, pen: 1, color: '#555555' }),
          txt(140, 38, 'date', X, '#ff5555', { fmt: 'ddd', upper: true }), txt(140, 58, 'date', 'FONT_MEDIUM', w, { fmt: 'DD' }),
          // temperature gauge at the left
          E('arc', { name: 'Temperature gauge', cx: 72, cy: 140, r: 31, pen: 5, start: 225, sweep: 270, dir: 'cw', source: 'temp', min: -10, max: 40, color: '#ffaa00', track: '#333333', round: true }),
          txt(72, 138, 'temp', 'FONT_MEDIUM', w, {}), txt(58, 160, 'tempLow', X, '#ffff00', {}), txt(88, 160, 'tempHigh', X, '#ff5555', {}),
          // steps ring at the right
          E('arc', { name: 'Steps ring', cx: 208, cy: 140, r: 31, pen: 6, start: 0, sweep: 360, dir: 'cw', source: 'steps', color: '#00aaff', track: '#003355', round: true }),
          E('icon', { name: 'Walk icon', x: 208, y: 140, kind: 'walk', size: 26, color: w }),
          // activity rings at the bottom
          E('arc', { name: 'Move ring', cx: 140, cy: 206, r: 31, pen: 8, start: 0, sweep: 360, dir: 'cw', source: 'calories', color: '#ff0055', track: '#550022', round: true }),
          E('arc', { name: 'Exercise ring', cx: 140, cy: 206, r: 22, pen: 8, start: 0, sweep: 360, dir: 'cw', source: 'intMins', color: '#aaff00', track: '#335500', round: true }),
          E('arc', { name: 'Stand ring', cx: 140, cy: 206, r: 13, pen: 8, start: 0, sweep: 360, dir: 'cw', source: 'floors', color: '#00ffff', track: '#005555', round: true }),
          E('hands', { name: 'Hands', style: 'capsule', hLen: 76, hW: 13, mLen: 114, mW: 13, hColor: w, mColor: w, capGap: 0.3, capT: 2, capStem: 3, capFill: '#000000', sShow: true, sLen: 118, sTail: 26, sW: 2, sColor: '#ff0000', hub: 5, hubColor: '#ff0000' })];
        return D('Activity Dial', '#000000', [], els);
      } },
    // ---- three very busy faces: as many data points as fit ----
    { id: 'missioncontrol', name: 'Mission Control', blurb: 'Two rings, date, sun times, two clocks, weather, moon, a big time and nine more numbers.',
      build: function () {
        var X = 'FONT_XTINY', S = 'FONT_SMALL', w = '#ffffff', g = '#aaaaaa';
        var els = [ring('steps', 136, 4, 0, 360, '#00ffff'), ring('battery', 130, 4, 0, 360, '#55ff55'),
          txt(140, 40, 'date', X, w, { fmt: 'ddd DD MMM YYYY', upper: true }),
          E('sunicon', { name: 'Sunrise icon', x: 86, y: 59, r: 5, kind: 'rise', color: '#ffaa00' }), txt(96, 58, 'sunrise', X, w, { justify: 'L' }),
          E('sunicon', { name: 'Sunset icon', x: 172, y: 59, r: 5, kind: 'set', color: '#ff5500' }), txt(182, 58, 'sunset', X, w, { justify: 'L' }),
          txt(98, 76, 'nyTime', X, w, { justify: 'L', prefix: 'NY ' }), txt(168, 76, 'utcTime', X, w, { justify: 'L', prefix: 'UTC ' }),
          E('wxicon', { name: 'Weather icon', x: 78, y: 99, size: 28 }), txt(96, 93, 'temp', S, w, { justify: 'L', suffix: '°C' }), txt(96, 109, 'weatherDesc', X, g, { justify: 'L', upper: true }),
          E('moon', { name: 'Moon', x: 212, y: 98, r: 13, lit: '#ffffaa', dark: '#444444' }),
          txt(134, 148, 'time', 'FONT_NUMBER_MEDIUM', w, { secs: false }), txt(194, 154, 'second', S, '#ffaa00', { justify: 'L' })];
        [[182, [['heart', 'hr', '#ff5555', ''], ['shoe-print', 'steps', '#00ffff', ''], ['fire', 'calories', '#ff8800', '']]],
         [202, [['stairs', 'floors', '#ffff55', ''], ['timer', 'intMins', '#55ff55', ' min'], ['map-marker-distance', 'distance', '#55aaff', ' km']]],
         [222, [['battery', 'batteryDays', '#55ff55', ' d'], ['brain', 'stress', '#ffaa00', ''], ['water-percent', 'spo2', '#55aaff', '%']]]].forEach(function (row) {
          [76, 140, 204].forEach(function (cx, i) { var c = row[1][i]; els.push(E('icon', { name: 'Icon ' + c[1], x: cx - 24, y: row[0], kind: c[0], size: 14, color: c[2] }), txt(cx - 14, row[0], c[1], X, w, { justify: 'L', suffix: c[3] })); });
        });
        els.push(E('barchart', { name: 'Steps, 8 days', x: 140, y: 246, w: 96, h: 14, source: 'steps', gap: 2, color: '#00aaff', todayColor: '#ffff00', unlit: '#222222', bars: 8, span: 'prev' }));
        return D('Mission Control', '#000000', [], els);
      } },
    { id: 'cockpit', name: 'Cockpit', blurb: 'Analog hands over a busy dial: three sub-dials, date, two clocks, sun times, weather, moon and a steps chart.',
      build: function () {
        var X = 'FONT_XTINY', w = '#ffffff', g = '#aaaaaa';
        function sub(cx, cy, src, col, name) { return [E('arc', { name: name + ' dial', cx: cx, cy: cy, r: 27, pen: 4, start: 0, sweep: 360, dir: 'cw', source: src, color: col, track: '#333333' }), txt(cx, cy - 2, src, X, w, { justify: 'C' }), txt(cx, cy + 10, 'custom', X, g, { justify: 'C', text: name })]; }
        var els = [E('shape', { name: 'Dial', kind: 'circle', x: 140, y: 140, r: 140, fill: true, color: '#000022', locked: true }),
          E('ticks', { name: 'Minute ticks', r: 136, len: 5, count: 60, major: 5, majorLen: 11, width: 1, majorWidth: 3, color: '#777777', majorColor: '#ffffff' }),
          txt(140, 36, 'date', X, '#ffaa00', { fmt: 'ddd DD MMM', upper: true }),
          E('sunicon', { name: 'Sunrise icon', x: 96, y: 56, r: 5, kind: 'rise', color: '#ffaa00' }), txt(105, 55, 'sunrise', X, w, { justify: 'L' }),
          E('sunicon', { name: 'Sunset icon', x: 160, y: 56, r: 5, kind: 'set', color: '#ff5500' }), txt(169, 55, 'sunset', X, w, { justify: 'L' }),
          txt(118, 74, 'nyTime', X, g, { justify: 'R', prefix: 'NY ' }), txt(162, 74, 'utcTime', X, g, { justify: 'L', prefix: 'UTC ' })]
          .concat(sub(80, 140, 'steps', '#00ffff', 'STEPS'), sub(200, 140, 'battery', '#55ff55', 'BATT'), sub(140, 198, 'bodyBat', '#55aaff', 'BODY'));
        els.push(E('wxicon', { name: 'Weather icon', x: 118, y: 106, size: 22 }), txt(132, 106, 'temp', X, w, { justify: 'L', suffix: '°' }),
          E('moon', { name: 'Moon', x: 168, y: 106, r: 9, lit: '#ffffaa', dark: '#444444' }),
          E('icon', { name: 'Icon hr', x: 96, y: 236, kind: 'heart', size: 13, color: '#ff5555' }), txt(106, 236, 'hr', X, w, { justify: 'L' }),
          E('icon', { name: 'Icon cal', x: 146, y: 236, kind: 'fire', size: 13, color: '#ff8800' }), txt(156, 236, 'calories', X, w, { justify: 'L' }),
          E('barchart', { name: 'Steps, 8 days', x: 140, y: 262, w: 60, h: 10, source: 'steps', gap: 2, color: '#0077aa', todayColor: '#ffff00', unlit: null, bars: 8, span: 'prev' }),
          E('hands', { name: 'Hands', style: 'sword', hLen: 56, hW: 9, mLen: 92, mW: 7, hColor: '#ffffff', mColor: '#ffffff', oColor: '#000022', oW: 1, sShow: true, sLen: 112, sTail: 20, sW: 1, sColor: '#ff5500', hub: 5, hubColor: '#ff5500' }));
        return D('Cockpit', '#000022', [], els);
      } },
    { id: 'datawall', name: 'Data Wall', blurb: 'No rings, no clutter budget: time, date and twelve numbers each with its own gauge, plus weather and sun times.',
      build: function () {
        var X = 'FONT_XTINY', T = 'FONT_TINY', w = '#ffffff', g = '#999999';
        var els = [txt(140, 28, 'date', X, '#ffaa00', { fmt: 'ddd DD MMM', upper: true }),
          txt(128, 58, 'time', 'FONT_NUMBER_MEDIUM', w, { secs: false }), txt(190, 64, 'second', T, '#ffaa00', { justify: 'L' })];
        var cells = [['HR', 'hr', '#ff5555'], ['STEPS', 'steps', '#00ffff'], ['CAL', 'calories', '#ff8800'],
          ['FLOORS', 'floors', '#ffff55'], ['INT MIN', 'intMins', '#55ff55'], ['DIST KM', 'distance', '#55aaff'],
          ['BATT %', 'battery', '#55ff55'], ['BODY', 'bodyBat', '#55aaff'], ['STRESS', 'stress', '#ffaa00'],
          ['SPO2', 'spo2', '#aa55ff'], ['RESP', 'resp', '#55ffaa'], ['ALT M', 'altitude', '#aaaaaa']];
        cells.forEach(function (c, i) {
          var cx = [72, 140, 208][i % 3], cy = 100 + Math.floor(i / 3) * 38;
          els.push(txt(cx, cy - 11, 'custom', X, g, { justify: 'C', text: c[0] }), txt(cx, cy + 3, c[1], T, w, { justify: 'C' }),
            E('seggauge', { name: c[0] + ' gauge', shape: 'bar', n: 5, w: 46, h: 3, gap: 2, slant: 0, orient: 'h', dir: 'ltr', x: cx, y: cy + 13, source: c[1], color: c[2], unlit: '#3a3a3a' }));
        });
        els.push(E('wxicon', { name: 'Weather icon', x: 62, y: 246, size: 22 }), txt(78, 246, 'temp', T, w, { justify: 'L', suffix: '°' }),
          E('sunicon', { name: 'Sunrise icon', x: 132, y: 240, r: 4, kind: 'rise', color: '#ffaa00' }), txt(141, 239, 'sunrise', X, w, { justify: 'L' }),
          E('sunicon', { name: 'Sunset icon', x: 132, y: 255, r: 4, kind: 'set', color: '#ff5500' }), txt(141, 254, 'sunset', X, w, { justify: 'L' }),
          E('moon', { name: 'Moon', x: 214, y: 246, r: 10, lit: '#ffffaa', dark: '#444444' }));
        return D('Data Wall', '#000000', [], els);
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
    { id: 'bosphorusanalog', name: 'Bosphorus Analog', blurb: 'Bosphorus with an analog dial: leaf hands under the text, a sun that marks the next sunrise or sunset on the dial, date and New York time.',
      build: function () {
        var b = GW.clone(BOSPHORUS), by = {}; b.elements.forEach(function (e) { by[e.id] = e; });
        var els = [by.eysp853];
        els.push(E('ticks', { name: 'Minute ticks', r: 126, len: 5, count: 60, major: 0, width: 1, color: '#aaaaaa' }));
        els.push(E('ticks', { name: 'Hour batons', r: 126, len: 12, count: 12, major: 3, majorLen: 17, width: 3, majorWidth: 4, color: '#000000', majorColor: '#000000' }));
        els.push(rect(140, 22, 6, 20, '#ff5500', { name: '12 marker' }));
        els.push(E('shape', { name: 'Date window', kind: 'rect', x: 208, y: 141, w: 60, h: 62, fill: false, pen: 1, color: '#aaaaaa' }));
        // the hands go under all the text, so the text stays readable when a hand passes over it
        els.push(E('hands', { name: 'Hands', style: 'sword', hLen: 74, hW: 11, mLen: 106, mW: 8, hColor: '#000000', mColor: '#000000', oW: 0,
          only: 'hm', sShow: false, hub: 0 }));
        function t(name, x, y, src, font, color, o) { return E('text', Object.assign({ name: name, x: x, y: y, source: src, font: font, color: color, justify: 'C' }, o || {})); }
        els.push(t('Weekday', 208, 121, 'date', 'fLab', '#ff5500', { fmt: 'ddd', tr: true, upper: true }), t('Day', 208, 141, 'date', 'fVal', '#000000', { fmt: 'DD' }), t('Month', 208, 162, 'date', 'fLab', '#000000', { fmt: 'MMM', tr: true, upper: true }));
        els.push(t('Zone', 140, 67, 'nyZone', 'fLab', '#ff5500'), t('New York time', 140, 89, 'nyTime', 'fVal', '#000000'));
        var P = { er5h6mz: [72, 129], expaney: [72, 151], e5d8iap: [140, 189], em6n0to: [140, 211] };   // NABIZ at 9 o'clock, PİL at 6
        Object.keys(P).forEach(function (id) { by[id].x = P[id][0]; by[id].y = P[id][1]; els.push(by[id]); });
        els.forEach(function (e) { if (e.type === 'text') { e.halo = '#aaaaaa'; e.haloW = 2; } });   // a thin light-grey outline round the text, only where a hand lies under it
        els.push(E('sunmark', { name: 'Next sunrise / sunset', rr: 116, r: 9, color: '#ff5500', halo: '' }));   // last, so it draws over everything
        // the second hand and cap go on top of everything, the sun marker included
        els.push(E('hands', { name: 'Second hand', style: 'sword', only: 'top', hLen: 74, mLen: 106, sShow: true, sLen: 118, sTail: 24, sW: 2, sColor: '#ff5500', hub: 5, hubColor: '#ff5500' }));
        b.elements = els; b.name = 'Bosphorus Analog';
        b.fonts = b.fonts.filter(function (f) { return f.id === 'fLab' || f.id === 'fVal'; });
        b.fonts.forEach(function (f) { f.aa = 'mip'; if (f.id === 'fLab') f.px = 16; if (f.id === 'fVal') f.px = 27; });   // device-style edges (the screen blends edges in only 4 steps), and the pixel sizes whose letter stems land best on the pixel grid
        return b;
      } },
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

  // The presets are drawn on the 280 px screen; opening one on another watch converts it (see GW.convertSize).
  GW.applyPreset = function (id, done) {
    var p = GW.PRESETS.filter(function (x) { return x.id === id; })[0]; if (!p) return;
    if (p.device && GW.DEVICE.id !== p.device) {   // laid out pixel for pixel for one watch: switch to it first, or it would be scaled
      GW.setDevice(p.device); var ds = document.getElementById('deviceSel'); if (ds) ds.value = GW.DEVICE.id;
    }
    var saved = GW.layouts && GW.layouts.find(p.name, p.kind === 'datafield' ? 'field' : 'watch');   // a saved layout with this name replaces the built-in
    GW.loadFrom(saved ? GW.clone(saved.data) : { design: Object.assign(p.build(), { size: 280 }), assets: p.assets ? p.assets() : {} }, done);
  };

})(window.GW);
