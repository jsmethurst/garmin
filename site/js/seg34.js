/* Presets: Segment34 MkII and Segment34 MAX, laid out for the fēnix 6X (280×280), pixel for pixel.
   Segment34 is a watch face by ludw (Ludvig Wadenstein): https://github.com/ludw/Segment34mkII (MIT License, Copyright (c) 2025 Ludvig Wadenstein)
   and https://github.com/ludw/Segment34MAX. The bitmap fonts (seg34data.js) are the author's own .fnt/.png files, exported unchanged; the positions are
   the ones his code computes for a 280 px round MIP screen (the numbers are worked out below in the same order as his drawWatchface). */
(function (GW) {
  'use strict';
  var R = Math.round;
  var DATA = GW.SEG34;
  function fontsOf(set, names) {
    return names.map(function (n) {
      var d = set.fonts[n], m = GW.parseFnt(d.fnt);
      return { id: 's34_' + n, family: 'Segment34 ' + n, weight: 400, px: m.lineHeight, glyphs: 'prebuilt', spacing: 0, aa: 'mip', prebuilt: { fnt: d.fnt, png: d.png, aa: d.aa, filter: d.filter || '' } };
    });
  }
  function widthOf(f, s) { var m = GW.parseFnt(f.prebuilt.fnt), w = 0; s.split('').forEach(function (c) { w += m.glyphs[c] ? m.glyphs[c].adv : 0; }); return w; }
  function dateSample(short) {   // MkII: THU, 12 NOV 2026   MAX: THU 12 NOV
    var d = new Date(), D = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'], M = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return short ? D[d.getDay()] + ' ' + d.getDate() + ' ' + M[d.getMonth()] : D[d.getDay()] + ', ' + d.getDate() + ' ' + M[d.getMonth()] + ' ' + d.getFullYear();
  }
  var T = function (name, o) { return GW.newElement('text', Object.assign({ name: name, source: 'custom', text: '', justify: 'L', vtop: true, color: '#ffffff' }, o)); };
  function lbl(name, f, x, y, text, color, just) { return T(name, { font: f.id, x: x, y: y, text: text, color: color, justify: just || 'L' }); }
  function src(name, f, x, y, source, color, just, o) { return T(name, Object.assign({ font: f.id, x: x, y: y, source: source, color: color, justify: just || 'L' }, o || {})); }
  function bar(name, x, y, source, color) {   // a bar that grows from the bottom with the value, 3 px wide and 80 px high at 100 %
    return GW.newElement('seggauge', { name: name, shape: 'bar', n: 1, orient: 'v', dir: 'ltr', slant: 0, gap: 0, x: x, y: y, w: 3, h: 80, source: source, color: color, unlit: '#000000' });
  }
  function gradient(cx, cy, w, h) { return GW.newElement('image', { name: 'Clock gradient', x: cx, y: cy, w: w, h: h, asset: 'seg34grad' }); }

  // ---------------------------------------------------------------- Segment34 MkII
  function mk2() {
    var F = fontsOf(DATA.mk2, ['segments80wide', 'storre', 'led_small_lines', 'led', 'smol', 'moon', 'icons']);
    var seg = F[0], tiny = F[1], small = F[2], large = F[3], label = F[4], moon = F[5], icons = F[6];
    var C = { clock: '#ffff00', clockBg: '#005555', dataVal: '#ffffff', fieldBg: '#005555', fieldLbl: '#55aaaa', date: '#ffff00', notif: '#00aaff', stress: '#ffaa00', body: '#00aaff', moon: '#ffffff' };   // colour theme 0
    var cX = 140, cY = 140, mY = 9, mX = 14, hmY = R(mY / 2), baseX = 140, baseY = cY - 13 - 4, hCH = 40, hCW = 120;
    var labelH = 8, labelM = 6, tinyH = 10, smallH = 13, largeH = 20;
    var yn1 = baseY - hCH - mY - smallH, yn2 = yn1 - mY - smallH, y1 = baseY + hCH + mY, y2 = y1 + smallH + mY, y3 = y2 + labelH + labelM + largeH;
    var els = [];
    // top: sunrise / sunset with their labels, the moon between them
    var topH = labelH + hmY;
    els.push(lbl('Sunrise label', label, cX - 20, mY, 'S RISE:', C.fieldLbl, 'R'), lbl('Sunset label', label, cX + 20, mY, 'S SET:', C.fieldLbl, 'L'));
    els.push(src('Sunrise', tiny, cX - 20, mY + topH, 'sunrise', C.dataVal, 'R'), src('Sunset', tiny, cX + 20, mY + topH, 'sunset', C.dataVal, 'L'));
    els.push(T('Moon', { font: moon.id, x: cX, y: mY + Math.floor((topH + tinyH) / 2), source: 'moonGlyph', color: C.moon, justify: 'C', vtop: false }));
    // two lines above the clock
    els.push(src('Weather line 1', small, cX, yn2, 'temp', C.dataVal, 'C'), src('Weather line 2', small, cX, yn1, 'weatherDesc', C.dataVal, 'C', { upper: true }));
    // the clock: ghost segments, the time, the gradient
    els.push(T('Clock ghost', { font: seg.id, x: baseX, y: baseY, text: '#####', color: C.clockBg, justify: 'C', vtop: false }));
    els.push(src('Clock', seg, baseX, baseY, 'time', C.clock, 'C', { vtop: false, hmode: 'auto', lz: true, sep: ':' }));
    els.push(gradient(baseX, baseY, 240, 80));
    // stress (left) and body battery (right) bars
    els.push(bar('Stress bar', cX - hCW - 3 - 3 + 1.5, baseY + hCH + 1 - 40, 'stress', C.stress), bar('Body battery bar', cX + hCW + 3 + 1.5, baseY + hCH + 1 - 40, 'bodyBat', C.body));
    // date, notifications, seconds
    var dateTxt = dateSample(), dateW = widthOf(small, dateTxt), secW = widthOf(small, '36'), dateRight = baseX - hCW + dateW, secLeft = baseX + hCW - secW;
    var nPos = secLeft - mX; if (secLeft - dateRight < 3 * mX) nPos = (dateRight + secLeft) / 2;
    els.push(src('Date', small, baseX - hCW, y1, 'date', C.date, 'L', { fmt: 'ddd, D MMM YYYY', upper: true }));
    els.push(src('Notifications', small, R(nPos), y1, 'notif', C.notif, 'C'));
    els.push(src('Seconds', small, baseX + hCW, y1, 'second', C.date, 'R'));
    // the three bottom fields
    var dw = Math.sqrt(cY * cY - (y3 - cY) * (y3 - cY)) * 2, left = R((280 - dw) / 2), dg = [4, 3, 4], tot = 11;
    var w1 = R(dg[0] * dw / tot), w2 = R(dg[1] * dw / tot), w3 = R(dg[2] * dw / tot);
    var xs = [left + R(w1 / 2), left + R(w1 + w2 / 2), left + R(w1 + w2 + w3 / 2)];
    var spec = [['RECOVERY HRS:', 'recovery'], ['HR:', 'hr'], ['WEEK ACT MIN:', 'intMins']], dy = y2 + labelH + labelM;
    spec.forEach(function (s, i) {
      var half = R(18 * dg[i] / 2), ghost = ''; for (var k = 0; k < dg[i]; k++) ghost += '#';
      els.push(lbl(s[0].replace(':', '') + ' label', label, xs[i] - half + 3, y2, s[0], C.fieldLbl, 'L'));
      els.push(T('Field ghost ' + (i + 1), { font: large.id, x: xs[i] - half + 3, y: dy, text: ghost, color: C.fieldBg, justify: 'L' }));
      els.push(src('Field ' + (i + 1), large, xs[i] + half - 1 + 3, dy, s[1], C.dataVal, 'R'));
    });
    // steps with the alarm and do-not-disturb icons either side, then the battery
    var fiveY = y3 + hmY + 5;
    els.push(T('Steps ghost', { font: large.id, x: cX - 45, y: fiveY, text: '#####', color: C.fieldBg, justify: 'L' }), src('Steps', large, cX + 45 - 1, fiveY, 'steps', C.dataVal, 'R'));
    els.push(T('Alarm icon', { font: icons.id, x: cX - 45 - mX / 2, y: fiveY + largeH / 2, text: 'A', color: C.dataVal, justify: 'R', vtop: false }));
    els.push(T('Do not disturb icon', { font: icons.id, x: cX + 45 + mX / 2 - 2, y: fiveY + largeH / 2, text: 'D', color: C.dataVal, justify: 'L', vtop: false }));
    els.push(T('Battery icon', { font: icons.id, x: cX, y: 280 - 18, text: 'B', color: '#555555', justify: 'C' }));
    els.push(src('Battery bar', label, cX - 11, 280 - 18 + 3, 'battBar20', C.dataVal, 'L'));
    var d = GW.blankDesign(); d.name = 'Segment34 MkII'; d.bg = '#000000'; d.fonts = F; d.elements = els; d.size = 280;
    return d;
  }

  // ---------------------------------------------------------------- Segment34 MAX
  function max() {
    var F = fontsOf(DATA.max, ['segments80wide', 'storre', 'led_inbetween', 'led_big', 'led_small_lines', 'moon', 'icons']);
    var seg = F[0], tiny = F[1], small = F[2], big = F[3], batt = F[4], icons = F[6];
    var C = { clock: '#ffaa00', clockBg: '#555555', dataVal: '#ffffff', fieldBg: '#555555', fieldLbl: '#ffaa00', date: '#ffffff', notif: '#55aaff', stress: '#ffaa00', body: '#55aaff' };   // colour theme 11
    var cX = 140, cY = 140, mY = 7, mX = R(280 / 15), hmY = R(mY / 2), baseX = 140, baseY = cY - 8, hCH = 40, hCW = 118;
    var labelH = 8, labelM = 5, smallH = 20, largeH = 27;
    var yn1 = baseY - hCH - mY - smallH, yn2 = yn1 - mY - smallH, yn3 = yn2 - mY - 20, y1 = baseY + hCH + mY, y2 = y1 + smallH + mY, y3 = y2 + labelH + labelM + largeH;
    var els = [];
    // top: the last two hours of stress as a histogram (sample values here; the face reads the sensor history)
    var hist = [18, 22, 30, 28, 35, 40, 33, 27, 22, 19, 25, 31, 45, 52, 48, 41, 36, 30, 27, 24, 20, 23, 29, 34], half = R(hist.length * 4 / 2);
    hist.forEach(function (v, i) {
      var h = R(v / (100 / 20));
      els.push(GW.newElement('shape', { name: 'Histogram ' + (i + 1), kind: 'rect', fill: true, x: cX - half + i * 4 + 1, y: yn3 + (20 - h) + h / 2, w: 2, h: h, color: v <= 25 ? C.body : C.stress }));
    });
    els.push(src('Weather line 1', small, cX, yn2, 'temp', C.dataVal, 'C'), src('Weather line 2', small, cX, yn1, 'weatherDesc', C.dataVal, 'C', { upper: true }));
    els.push(T('Clock ghost', { font: seg.id, x: baseX, y: baseY, text: '#####', color: C.clockBg, justify: 'C', vtop: false }));
    els.push(src('Clock', seg, baseX, baseY, 'time', C.clock, 'C', { vtop: false, hmode: 'auto', lz: true, sep: ':' }));
    els.push(gradient(baseX, baseY, 236, 80));
    els.push(bar('Stress bar', cX - hCW - 3 - 3 + 1.5, baseY + hCH + 1 - 40, 'stress', C.stress), bar('Body battery bar', cX + hCW + 3 + 1.5, baseY + hCH + 1 - 40, 'bodyBat', C.body));
    var dateTxt = dateSample(true), dateW = widthOf(small, dateTxt), secW = widthOf(small, '36'), dateRight = baseX - hCW + dateW, secLeft = baseX + hCW - secW;
    var nPos = secLeft - mX; if (secLeft - dateRight < 3 * mX) nPos = (dateRight + secLeft) / 2;
    els.push(src('Date', small, baseX - hCW, y1, 'date', C.date, 'L', { fmt: 'ddd D MMM', upper: true }));
    els.push(src('Notifications', small, R(nPos), y1, 'notif', C.notif, 'C'));
    els.push(src('Seconds', small, baseX + hCW, y1, 'second', C.date, 'R'));
    var dw = Math.sqrt(cY * cY - (y3 - cY) * (y3 - cY)) * 2, left = R((280 - dw) / 2), dg = [4, 3], tot = 7;
    var w1 = R(dg[0] * dw / tot), w2 = R(dg[1] * dw / tot);
    var xs = [left + R(w1 / 2), left + R(w1 + w2 / 2)], spec = [['RECOV HRS:', 'recovery'], ['HR:', 'hr']], dy = y2 + labelH + labelM;
    spec.forEach(function (s, i) {
      var ghost = ''; for (var k = 0; k < dg[i]; k++) ghost += '$';
      var bgw = widthOf(big, ghost), x0 = xs[i] - Math.floor(bgw / 2) + 3;
      els.push(lbl(s[0].replace(':', '') + ' label', tiny, x0, y2, s[0], C.fieldLbl, 'L'));
      els.push(T('Field ghost ' + (i + 1), { font: big.id, x: x0, y: dy, text: ghost, color: C.fieldBg, justify: 'L' }));
      els.push(src('Field ' + (i + 1), big, x0, dy, s[1], C.dataVal, 'L'));
    });
    var y4 = y3 + mY;
    els.push(T('Alarm icon', { font: icons.id, x: cX - 25 - R(mX / 2), y: y4 + 10, text: 'A', color: C.dataVal, justify: 'R', vtop: false }));
    els.push(T('Do not disturb icon', { font: icons.id, x: cX + 25 + R(mX / 2) - 2, y: y4 + 10, text: 'D', color: C.dataVal, justify: 'L', vtop: false }));
    els.push(T('Battery icon', { font: icons.id, x: cX, y: 280 - 25, text: 'C', color: '#555555', justify: 'C' }));
    els.push(src('Battery bar', batt, cX - 19, 280 - 25 + 4, 'battBar35', C.dataVal, 'L'));
    var d = GW.blankDesign(); d.name = 'Segment34 MAX'; d.bg = '#000000'; d.fonts = F; d.elements = els; d.size = 280;
    return d;
  }

  // ---------------------------------------------------------------- Segment34 MkII, Turkish
  // Exactly the MkII layout, fonts and value formats; only the data differs and the labels are Turkish (the small fonts carry Ğ İ Ş).
  // Top: sunrise / moon / sunset. Line 1: "17C, d12, PARÇALI" (temperature, wind arrow + km/h, condition). Line 2: date. Under the clock: New York time,
  // notifications, seconds. Fields: recovery, heart rate, km run this week. Steps with a label. Bars: body battery (left), watch battery (right).
  function mk2tr() {
    var B = DATA.mk2;
    function mk(n, d) { var m = GW.parseFnt(d.fnt); return { id: 's34_' + n, family: 'Segment34 ' + n, weight: 400, px: m.lineHeight, glyphs: 'prebuilt', spacing: 0, aa: 'mip', prebuilt: { fnt: d.fnt, png: d.png, aa: d.aa, filter: d.filter || '' } }; }
    var F = [mk('segments80wide', B.fonts.segments80wide), mk('storre', B.fonts.storre), mk('led_small_lines', B.tr.led_small_lines), mk('led', B.fonts.led), mk('smol', B.tr.smol), mk('moon', B.fonts.moon), mk('icons', B.fonts.icons)];
    var seg = F[0], tiny = F[1], small = F[2], large = F[3], label = F[4], moon = F[5], icons = F[6];
    var C = { clock: '#ffff00', clockBg: '#005555', dataVal: '#ffffff', fieldBg: '#005555', fieldLbl: '#55aaaa', date: '#ffff00', notif: '#00aaff', stress: '#ffaa00', body: '#00aaff', moon: '#ffffff' };
    var cX = 140, cY = 140, mY = 9, mX = 14, hmY = R(mY / 2), baseX = 140, baseY = cY - 13 - 4, hCH = 40, hCW = 120;
    var labelH = 8, labelM = 6, tinyH = 10, smallH = 13, largeH = 20;
    var yn1 = baseY - hCH - mY - smallH, yn2 = yn1 - mY - smallH, y1 = baseY + hCH + mY, y2 = y1 + smallH + mY, y3 = y2 + labelH + labelM + largeH;
    var els = [], topH = labelH + hmY;
    els.push(lbl('Sunrise label', label, cX - 20, mY, 'DOĞUŞ:', C.fieldLbl, 'R'), lbl('Sunset label', label, cX + 20, mY, 'BATIŞ:', C.fieldLbl, 'L'));
    els.push(src('Sunrise', tiny, cX - 20, mY + topH, 'sunrise', C.dataVal, 'R'), src('Sunset', tiny, cX + 20, mY + topH, 'sunset', C.dataVal, 'L'));
    els.push(T('Moon', { font: moon.id, x: cX, y: mY + Math.floor((topH + tinyH) / 2), source: 'moonGlyph', color: C.moon, justify: 'C', vtop: false }));
    els.push(src('Weather line', small, cX, yn2, 'wxLine', C.dataVal, 'C', { tr: true }), src('Date', small, cX, yn1, 'date', C.date, 'C', { fmt: 'ddd, D MMM YYYY', tr: true, upper: true }));
    els.push(T('Clock ghost', { font: seg.id, x: baseX, y: baseY, text: '#####', color: C.clockBg, justify: 'C', vtop: false }));
    els.push(src('Clock', seg, baseX, baseY, 'time', C.clock, 'C', { vtop: false, hmode: 'auto', lz: true, sep: ':' }));
    els.push(gradient(baseX, baseY, 240, 80));
    els.push(bar('Body battery bar', cX - hCW - 3 - 3 + 1.5, baseY + hCH + 1 - 40, 'bodyBat', C.body), bar('Watch battery bar', cX + hCW + 3 + 1.5, baseY + hCH + 1 - 40, 'battery', C.stress));
    var secW = widthOf(small, '36'), secLeft = baseX + hCW - secW, nyW = widthOf(small, 'NY 09:40'), dateRight = baseX - hCW + nyW, nPos = secLeft - mX;
    if (secLeft - dateRight < 3 * mX) nPos = (dateRight + secLeft) / 2;
    els.push(src('New York time', small, baseX - hCW, y1, 'nyTime', C.date, 'L', { prefix: 'NY ' }));
    els.push(src('Notifications', small, R(nPos), y1, 'notif', C.notif, 'C'));
    els.push(src('Seconds', small, baseX + hCW, y1, 'second', C.date, 'R'));
    var dw = Math.sqrt(cY * cY - (y3 - cY) * (y3 - cY)) * 2, left = R((280 - dw) / 2), dg = [4, 3, 4], tot = 11;
    var w1 = R(dg[0] * dw / tot), w2 = R(dg[1] * dw / tot), w3 = R(dg[2] * dw / tot);
    var xs = [left + R(w1 / 2), left + R(w1 + w2 / 2), left + R(w1 + w2 + w3 / 2)];
    var spec = [['TOPARLANMA:', 'recovery'], ['NABIZ:', 'hr'], ['HAFTA KM:', 'runKmWeek']], dy = y2 + labelH + labelM;
    spec.forEach(function (s, i) {
      var half = R(18 * dg[i] / 2), ghost = ''; for (var k = 0; k < dg[i]; k++) ghost += '#';
      els.push(lbl(s[0].replace(':', '') + ' label', label, xs[i] - half + 3, y2, s[0], C.fieldLbl, 'L'));
      els.push(T('Field ghost ' + (i + 1), { font: large.id, x: xs[i] - half + 3, y: dy, text: ghost, color: C.fieldBg, justify: 'L' }));
      els.push(src('Field ' + (i + 1), large, xs[i] + half - 1 + 3, dy, s[1], C.dataVal, 'R'));
    });
    var fiveY = y3 + hmY + 5;
    els.push(T('Steps ghost', { font: large.id, x: cX - 45, y: fiveY, text: '#####', color: C.fieldBg, justify: 'L' }), src('Steps', large, cX + 45 - 1, fiveY, 'steps', C.dataVal, 'R'));
    els.push(lbl('Steps label', label, cX - 45 - mX / 2, fiveY + (largeH - labelH) / 2, 'ADIM:', C.fieldLbl, 'R'));
    els.push(T('Battery icon', { font: icons.id, x: cX, y: 280 - 18, text: 'B', color: '#555555', justify: 'C' }));
    els.push(src('Battery bar', label, cX - 11, 280 - 18 + 3, 'battBar20', C.dataVal, 'L'));
    var d = GW.blankDesign(); d.name = 'Segment34 Türkçe'; d.bg = '#000000'; d.fonts = F; d.elements = els; d.size = 280;
    return d;
  }

  GW.PRESETS.push(
    { id: 'segment34', name: 'Segment34 MkII', device: 'fenix6xpro', note: 'By ludw, for the fēnix 6X (280×280), pixel for pixel. MIT licence.', build: mk2, assets: function () { return { seg34grad: DATA.mk2.gradient }; } },
    { id: 'segment34tr', name: 'Segment34 Türkçe', device: 'fenix6xpro', note: 'The MkII layout and text styles unchanged, with your data and Turkish labels.', build: mk2tr, assets: function () { return { seg34grad: DATA.mk2.gradient }; } },
    { id: 'segment34max', name: 'Segment34 MAX', device: 'fenix6xpro', note: 'By ludw: larger type, histogram on top. For the fēnix 6X (280×280), pixel for pixel.', build: max, assets: function () { return { seg34grad: DATA.max.gradient }; } }
  );
})(window.GW);
