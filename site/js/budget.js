/* Watch budget: a live estimate of the watch memory the face's fonts and pictures take (the same estimate the export dialog shows),
   with the things worth knowing about before exporting. It is an estimate, not a measurement. */
(function (GW) {
  'use strict';
  var h = GW.h;

  // the watch's limit for this kind of app (Garmin device files: watch face 112 KB on the fēnix 6 / 6 Pro, 128 KB on the 6X Pro; data field 32 KB on the plain 6)
  function limitKB(isField) { return isField ? (GW.DEVICE.id === 'fenix6' ? 32 : 128) : (GW.DEVICE.id === 'fenix6' ? 112 : 128); }

  function fontRow(f, src) {
    var met = GW.fontMetrics(f), chars, seen = {}, n = 0, ink = 0;
    if ((f.glyphs === 'auto' || f.glyphs === 'icons') && src.fontChars && src.fontChars[f.id]) chars = GW.bmpOnly(src.fontChars[f.id]).chars;
    else chars = met.chars;
    for (var i = 0; i < chars.length; i++) {
      var ch = chars[i], g = met.glyphs[ch];
      if (seen[ch] || !g) continue; seen[ch] = 1;
      if (!g.blank) { n++; ink += g.w * g.h; }
    }
    var label = f.family === 'MDI Icons' ? 'Icons ' + f.px + ' px' : f.family + ' ' + f.px + ' px';
    return { label: label + ', ' + n + (n === 1 ? ' glyph' : ' glyphs'), bytes: 197 + n * 58 + 0.084 * ink };
  }

  // The parts of the memory the fonts-and-pictures count leaves out: the program itself, and the letter-shape tables of curved text.
  // Calibrated on a fēnix 6 Pro: a face with 15 KB of generated source and no curved text used 18 KB in all. Curved text before the shared string table
  // cost about 17 KB per label; the figures for the string table are a first guess until measured the same way.
  var CODE_BASE = 2 * 1024, CODE_PER_CHAR = 1.0, TABLE_PER_CHAR = 1.5, CURVE_PER_LABEL = 1500;
  GW.budgetExtras = function (src) {
    var rows = [], view = (src && src.view) || '';
    if (view) {
      var tabChars = 0, re = /const GL_\w+ = \[[\s\S]*?\n    \];/g, m, labels = (view.match(/var GK_\w+ = /g) || []).length;
      while ((m = re.exec(view))) tabChars += m[0].length;
      var code = CODE_BASE + (view.length - tabChars) * CODE_PER_CHAR;
      rows.push({ label: 'Program code and runtime (about ' + Math.round((view.length - tabChars) / 1024) + ' KB of source)', bytes: code });
      if (labels) rows.push({ label: 'Curved text: ' + labels + (labels === 1 ? ' label' : ' labels') + ' (shared letter shapes and each label\'s saved copy)', bytes: tabChars * TABLE_PER_CHAR + labels * CURVE_PER_LABEL });
    }
    return rows;
  };

  // -> { total (KB), lim (KB), pct, rows: [{label, kb}], notes: [text] }
  GW.budget = function (design) {
    design = design || GW.design;
    var src, live = GW.design;
    if ((design.size || 280) !== GW.DEVICE.size) { design = GW.convertSize(GW.clone(design), GW.DEVICE.size); }
    GW.design = design;
    try { src = GW.generateSource(design); } finally { GW.design = live; }
    var rows = [], total = 0, isField = src.type === 'datafield';
    GW.design = design;
    try {
      (src.fonts || []).forEach(function (f) { var r = fontRow(f, src); total += r.bytes; rows.push({ label: r.label, kb: r.bytes / 1024 }); });
    } finally { GW.design = live; }
    (src.images || []).forEach(function (m) { var b = m.w * m.h; total += b; rows.push({ label: 'Picture ' + m.id + ' ' + m.w + '×' + m.h, kb: b / 1024 }); });
    if (src.bg) { var bb = GW.DEVICE.size * GW.DEVICE.size; total += bb; rows.push({ label: 'Background picture', kb: bb / 1024 }); }
    GW.budgetExtras(src).forEach(function (r) { total += r.bytes; rows.push({ label: r.label, kb: r.bytes / 1024 }); });
    rows.sort(function (a, b) { return b.kb - a.kb; });
    var lim = limitKB(isField), kb = total / 1024, els = design.elements || [];
    var notes = [];
    var arcs = els.filter(function (e) { return e.type === 'arc' || e.type === 'seggauge'; }).length;
    var secs = els.some(function (e) { return (e.type === 'hands' && e.sShow) || (e.type === 'text' && (e.source === 'second' || (e.source === 'time' && e.secs))); });
    if (secs) notes.push('Seconds are shown: the watch redraws every second while the wrist is raised, which uses more battery than a face that updates once a minute.');
    if (arcs > 6) notes.push(arcs + ' arc gauges are redrawn at every update; with Smooth edges on, each costs a little more time. Fewer or thinner arcs draw faster.');
    if (src.fonts && src.fonts.length > 3) notes.push(src.fonts.length + ' bitmap fonts: each size is its own font in memory. Reuse sizes where you can.');
    (src.warnings || []).forEach(function (w) {
      if (/^(Watch faces get|The plain f)/.test(w)) return;   // the limit itself is shown above
      if (notes.indexOf(w) < 0 && !/^(Second hand only|Seconds text freezes)/.test(w)) notes.push(w);
    });
    return { total: kb, lim: lim, pct: kb / lim * 100, rows: rows, notes: notes, field: isField };
  };

  function level(p) { return p > 80 ? 'bad' : p > 60 ? 'warn' : 'ok'; }

  // the card on the Face tab
  GW.budgetBox = function () {
    var box = h('div', { class: 'f budget' }), body = h('div', {});
    box.appendChild(h('label', { text: 'Watch budget' }));
    box.appendChild(body);
    function fill() {
      var b; try { b = GW.budget(); } catch (e) { body.innerHTML = ''; body.appendChild(h('p', { class: 'muted small', text: 'Could not work out the estimate (' + e.message + ').' })); return; }
      body.innerHTML = '';
      body.appendChild(h('div', { class: 'bud-bar ' + level(b.pct), role: 'img', 'aria-label': 'Memory used: ' + Math.round(b.pct) + ' percent' }, [h('i', { style: 'width:' + Math.min(100, b.pct) + '%' })]));
      body.appendChild(h('div', { class: 'note' + (b.pct > 80 ? ' warn' : ''), text: (b.pct > 80 ? '⚠ ' : '') + 'Fonts + pictures ≈ ' + b.total.toFixed(1) + ' KB of about ' + b.lim + ' KB on ' + GW.DEVICE.name + ' (' + Math.round(b.pct) + '%).' + (b.pct > 80 ? ' Close to the limit: the watch may show the "IQ!" screen. Remove a font size, a picture or some icons.' : (b.pct > 60 ? ' Getting full: leave room for the program itself.' : '')) }));
      if (b.rows.length) body.appendChild(h('div', { class: 'muted small', style: 'white-space:pre-line;margin-top:6px', text: b.rows.slice(0, 6).map(function (r) { return r.label + ': ≈ ' + r.kb.toFixed(1) + ' KB'; }).join('\n') + (b.rows.length > 6 ? '\n… and ' + (b.rows.length - 6) + ' more' : '') }));
      if (b.notes.length) body.appendChild(h('ul', { class: 'bud-notes muted small' }, b.notes.map(function (n) { return h('li', { text: n }); })));
      body.appendChild(h('p', { class: 'muted small', text: 'An estimate, not a measurement: it counts fonts, icons, pictures, curved-text letter shapes and a rough size for the program. Live data takes memory too. Put “Watch memory free / used” text on a test face to see the real numbers.' }));
    }
    fill();
    return box;
  };

  // the chip under the preview
  var chip = null, timer = 0;
  function update() {
    chip = chip || document.getElementById('budget'); if (!chip) return;
    try {
      var b = GW.budget();
      chip.className = 'chip ' + level(b.pct); chip.textContent = 'Memory ' + Math.round(b.pct) + '%';
      chip.title = 'Fonts + pictures ≈ ' + b.total.toFixed(0) + ' KB of about ' + b.lim + ' KB on ' + GW.DEVICE.name + '. Click for details.';
    } catch (e) { chip.className = 'chip'; chip.textContent = 'Memory –'; }
  }
  function later() { clearTimeout(timer); timer = setTimeout(update, 600); }
  GW.on('change', later); GW.on('structure', later);
  document.addEventListener('DOMContentLoaded', function () {
    var c = document.getElementById('budget'); if (c) c.addEventListener('click', function () { GW.setTab('face'); });
    later();
  });
})(window.GW);
