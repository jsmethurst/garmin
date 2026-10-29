/* UI: panels, inspector, layers, fonts, colour picker, modals. */
(function (GW) {
  'use strict';
  var T = GW.types, clamp = GW.clamp;
  var $ = function (id) { return document.getElementById(id); };

  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else if (k === 'value') e.value = v;
      else e.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  GW.h = h;

  var toastT;
  GW.toast = function (msg) {
    var t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('show'); }, 2600);
  };

  // ---------------------------------------------------------------- colour picker
  var sortedPalette = (function () {
    function hsl(hex) {
      var r = parseInt(hex.substr(1, 2), 16) / 255, g = parseInt(hex.substr(3, 2), 16) / 255, b = parseInt(hex.substr(5, 2), 16) / 255;
      var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn, hh = 0, s = 0;
      if (d) {
        s = d / (1 - Math.abs(2 * l - 1));
        hh = mx === r ? ((g - b) / d + 6) % 6 : (mx === g ? (b - r) / d + 2 : (r - g) / d + 4);
      }
      return { h: hh * 60, s: s, l: l };
    }
    var gray = [], col = [];
    GW.PALETTE.forEach(function (p) { var c = hsl(p); (c.s === 0 ? gray : col).push({ p: p, c: c }); });
    gray.sort(function (a, b) { return a.c.l - b.c.l; });
    col.sort(function (a, b) { var ha = Math.round(a.c.h / 20), hb = Math.round(b.c.h / 20); return ha - hb || a.c.l - b.c.l; });
    return gray.concat(col).map(function (x) { return x.p; });
  })();

  var popCb = null;
  GW.closeColor = function () { $('colorPop').hidden = true; popCb = null; };
  GW.pickColor = function (anchor, cur, cb, opts) {
    opts = opts || {};
    var pop = $('colorPop'); pop.innerHTML = ''; popCb = cb;
    var q = cur ? GW.q(cur) : null;
    var grid = h('div', { class: 'grid' });
    sortedPalette.forEach(function (p) {
      grid.appendChild(h('button', { class: p === q ? 'on' : '', style: 'background:' + p, title: p, 'aria-label': p, onclick: function () { cb(p); GW.closeColor(); } }));
    });
    var hex = h('input', { type: 'text', value: q || '', maxlength: 7, 'aria-label': 'Hex colour', placeholder: '#rrggbb' });
    hex.addEventListener('change', function () {
      var v = hex.value.trim(); if (v[0] !== '#') v = '#' + v;
      if (/^#[0-9a-fA-F]{6}$/.test(v)) { cb(GW.q(v)); GW.closeColor(); }
    });
    pop.appendChild(grid);
    pop.appendChild(h('div', { class: 'hex' }, [hex].concat(opts.none ? [h('button', { class: 'btn sm', text: 'None', onclick: function () { cb(null); GW.closeColor(); } })] : [])));
    pop.appendChild(h('p', { text: 'Only these 64 colours exist on the fēnix 6X display; any hex is snapped to the nearest.' }));
    pop.hidden = false;
    var r = anchor.getBoundingClientRect(), w = 252, ph = pop.offsetHeight;
    pop.style.left = clamp(r.left, 8, window.innerWidth - w - 8) + 'px';
    var top = r.bottom + 6; if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 6);
    pop.style.top = top + 'px';
  };
  document.addEventListener('pointerdown', function (e) {
    var pop = $('colorPop');
    if (!pop.hidden && !pop.contains(e.target) && !(e.target.closest && e.target.closest('.swatch'))) GW.closeColor();
  });

  // ---------------------------------------------------------------- tabs
  var tab = 'inspect';
  GW.setTab = function (t) {
    tab = t;
    Array.prototype.forEach.call(document.querySelectorAll('#tabs button'), function (b) { b.classList.toggle('on', b.dataset.tab === t); });
    GW.renderPanel();
  };
  GW.renderPanel = function () {
    var p = $('panel'); p.innerHTML = '';
    if (tab === 'inspect') renderInspector(p);
    else if (tab === 'face') renderFace(p);
    else if (tab === 'fonts') renderFonts(p);
    else renderSim(p);
  };

  // ---------------------------------------------------------------- fields
  function fireChange(structural) { GW.commit(!!structural); }

  function fSource(el, f) {
    var sel = h('select', { 'data-k': f.k });
    var kinds = f.kinds;
    GW.sourceGroups.forEach(function (g) {
      var list = GW.sourceList.filter(function (s) { return s.group === g && (!kinds || kinds.indexOf(s.kind) >= 0); });
      if (!list.length) return;
      var og = h('optgroup', { label: g });
      list.forEach(function (s) { og.appendChild(h('option', { value: s.id, text: s.label })); });
      sel.appendChild(og);
    });
    sel.value = el[f.k];
    sel.addEventListener('change', function () {
      var old = GW.sources[el[f.k]], neu = GW.sources[sel.value];
      if (!el.name || (old && el.name === old.label)) el.name = neu.label;
      el[f.k] = sel.value;
      if (el.type === 'arc') { el.min = null; el.max = null; }
      fireChange(true);
    });
    return field(f.label, sel);
  }
  function field(label, control) { return h('div', { class: 'f' }, [label ? h('label', { text: label }) : null, control]); }

  function fFont(el, f) {
    var sel = h('select', { 'data-k': f.k });
    var g1 = h('optgroup', { label: 'Garmin built-in (preview is approximate)' });
    GW.SYS_FONTS.forEach(function (s) { g1.appendChild(h('option', { value: s[0], text: s[0].replace('FONT_', '').replace(/_/g, ' ').toLowerCase() + ' · ~' + Math.round(s[1] * GW.SIZE / 260) + 'px' })); });
    sel.appendChild(g1);
    if (GW.design.fonts.length) {
      var g2 = h('optgroup', { label: 'Your bitmap fonts' });
      GW.design.fonts.forEach(function (c) { g2.appendChild(h('option', { value: c.id, text: c.family + ' ' + c.px + 'px' })); });
      sel.appendChild(g2);
    }
    sel.appendChild(h('option', { value: '__new', text: '＋ New bitmap font…' }));
    sel.value = el[f.k];
    sel.addEventListener('change', function () {
      if (sel.value === '__new') { sel.value = el[f.k]; GW.setTab('fonts'); return; }
      el[f.k] = sel.value; fireChange(false); GW.touch(false);
    });
    return field(f.label, sel);
  }

  function fColor(el, f) {
    var b = h('button', { class: 'swatch', type: 'button', 'data-ck': f.k }, [h('i', { style: 'background:' + GW.q(el[f.k]) }), h('span', { text: GW.q(el[f.k]) })]);
    b.addEventListener('click', function () {
      GW.pickColor(b, el[f.k], function (c) { el[f.k] = c; fireChange(true); });
    });
    return field(f.label, b);
  }
  function fOptColor(el, f) {
    var v = el[f.k], b = h('button', { class: 'swatch', type: 'button' }, [h('i', { style: 'background:' + (v ? GW.q(v) : 'transparent') }), h('span', { text: v ? GW.q(v) : 'none' })]);
    b.addEventListener('click', function () { GW.pickColor(b, v || '#ffffff', function (c) { el[f.k] = c; fireChange(true); }, { none: true }); });
    return field(f.label, b);
  }
  function fTrack(el, f) {
    var mode = el.track === 'auto' ? 'auto' : (el.track === 'none' ? 'none' : 'custom');
    var seg = segCtl([['auto', 'Auto'], ['none', 'None'], ['custom', 'Colour']], mode, function (v) {
      el.track = v === 'custom' ? GW.dim(el.color, 0.35) : v; fireChange(true);
    });
    var kids = [seg];
    if (mode === 'custom') {
      var b = h('button', { class: 'swatch', type: 'button', style: 'margin-top:6px' }, [h('i', { style: 'background:' + GW.q(el.track) }), h('span', { text: GW.q(el.track) })]);
      b.addEventListener('click', function () { GW.pickColor(b, el.track, function (c) { el.track = c; fireChange(true); }); });
      kids.push(b);
    }
    return h('div', { class: 'f' }, [h('label', { text: f.label })].concat(kids));
  }
  function segCtl(opts, cur, onPick) {
    var d = h('div', { class: 'seg', role: 'group' });
    opts.forEach(function (o) {
      d.appendChild(h('button', { type: 'button', class: String(o[0]) === String(cur) ? 'on' : '', text: o[1], onclick: function () { onPick(o[0]); } }));
    });
    return d;
  }
  function fSeg(el, f) {
    var s = segCtl(f.opts, el[f.k], function (v) { el[f.k] = f.num ? Number(v) : v; fireChange(true); });
    return field(f.label, s);
  }
  function fSelect(el, f) {
    var sel = h('select', { 'data-k': f.k }, f.opts.map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
    sel.value = el[f.k];
    sel.addEventListener('change', function () { el[f.k] = sel.value; fireChange(true); });
    return field(f.label, sel);
  }
  function fCheck(el, f) {
    var c = h('input', { type: 'checkbox', 'data-k': f.k }); c.checked = !!el[f.k];
    c.addEventListener('change', function () { el[f.k] = c.checked; fireChange(true); });
    return h('label', { class: 'chk' }, [c, f.label]);
  }
  function fText(el, f) {
    var i = h('input', { type: 'text', 'data-k': f.k, value: el[f.k] == null ? '' : el[f.k], spellcheck: 'false' });
    i.addEventListener('input', function () { el[f.k] = i.value; GW.touch(false); });
    i.addEventListener('change', function () { fireChange(false); });
    return field(f.label, i);
  }
  function fNum(el, f) {
    var i = h('input', { type: 'number', 'data-k': f.k, min: f.min, max: f.max, step: f.step || 1, value: el[f.k] });
    i.addEventListener('input', function () { var v = parseFloat(i.value); if (!isNaN(v)) { el[f.k] = v; GW.touch(false); } });
    i.addEventListener('change', function () { fireChange(false); });
    return field(f.label, i);
  }
  function fNumOpt(el, f) {
    var i = h('input', { type: 'number', 'data-k': f.k, placeholder: f.ph || 'auto', value: el[f.k] == null ? '' : el[f.k] });
    i.addEventListener('input', function () { var v = parseFloat(i.value); el[f.k] = isNaN(v) ? null : v; GW.touch(false); });
    i.addEventListener('change', function () { fireChange(false); });
    return field(f.label, i);
  }
  function fRange(el, f) {
    var r = h('input', { type: 'range', min: f.min, max: f.max, step: f.step || 1, value: el[f.k], 'data-k': f.k, 'aria-label': f.label });
    var n = h('input', { type: 'number', min: f.min, max: f.max, step: f.step || 1, value: el[f.k], 'data-k': f.k });
    function set(v) { el[f.k] = v; r.value = v; n.value = v; GW.touch(false); }
    r.addEventListener('input', function () { set(parseFloat(r.value)); });
    n.addEventListener('input', function () { var v = parseFloat(n.value); if (!isNaN(v)) set(v); });
    r.addEventListener('change', function () { fireChange(false); }); n.addEventListener('change', function () { fireChange(false); });
    return field(f.label, h('div', { class: 'rng' }, [r, n]));
  }
  function fDateFmt(el) {
    var cur = el.fmt || 'ddd DD MMM', isPreset = GW.DATE_PRESETS.some(function (p) { return p[0] === cur; });
    var sel = h('select', {}, GW.DATE_PRESETS.map(function (p) { return h('option', { value: p[0], text: p[1] }); }).concat([h('option', { value: '__c', text: 'Custom…' })]));
    sel.value = isPreset ? cur : '__c';
    var wrap = h('div', { class: 'f' }, [h('label', { text: 'Date format' }), sel]);
    function custom() {
      var i = h('input', { type: 'text', value: cur, spellcheck: 'false', placeholder: 'ddd DD MMM' });
      i.addEventListener('input', function () { el.fmt = i.value; GW.touch(false); }); i.addEventListener('change', function () { fireChange(false); });
      wrap.appendChild(i);
      wrap.appendChild(h('div', { class: 'note', html: 'Tokens: <b>DDDD</b> weekday · <b>ddd</b> Mon · <b>DD</b> 06 · <b>D</b> 6 · <b>MMMM</b> December · <b>MMM</b> Dec · <b>MM</b> 12 · <b>M</b> 12 · <b>YYYY</b> · <b>YY</b>. Names follow the watch language.' }));
    }
    if (!isPreset) custom();
    sel.addEventListener('change', function () {
      if (sel.value === '__c') { if (!wrap.querySelector('input')) custom(); } else { el.fmt = sel.value; fireChange(true); }
    });
    return wrap;
  }

  function loadImageFile(file, cb) {
    var fr = new FileReader();
    fr.onload = function () { GW.addAsset(fr.result, cb); };
    fr.readAsDataURL(file);
  }
  function fImagePick(el) {
    var file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml', hidden: true });
    file.addEventListener('change', function () {
      if (!file.files[0]) return;
      loadImageFile(file.files[0], function (id, a) {
        el.asset = id; el.name = file.files[0].name.replace(/\.[^.]+$/, '').slice(0, 24) || 'Image';
        var k = Math.min(1, 120 / Math.max(a.w, a.h)); el.w = Math.max(1, Math.round(a.w * k)); el.h = Math.max(1, Math.round(a.h * k));
        fireChange(true);
      });
    });
    var dz = h('div', { class: 'dropzone', onclick: function () { file.click(); }, text: el.asset ? 'Replace image…' : 'Choose a PNG / JPG / SVG…' });
    return h('div', { class: 'f' }, [h('label', { text: 'Image' }), dz, file]);
  }

  function renderField(el, f) {
    switch (f.t) {
      case 'h': return h('h4', { text: f.label });
      case 'note': return h('div', { class: 'note', text: f.text });
      case 'row': return h('div', { class: 'row' }, f.fields.map(function (x) { return renderField(el, x); }));
      case 'source': return fSource(el, f);
      case 'font': return fFont(el, f);
      case 'color': return fColor(el, f);
      case 'optcolor': return fOptColor(el, f);
      case 'track': return fTrack(el, f);
      case 'seg': return fSeg(el, f);
      case 'select': return fSelect(el, f);
      case 'check': return fCheck(el, f);
      case 'text': return fText(el, f);
      case 'num': return fNum(el, f);
      case 'numopt': return fNumOpt(el, f);
      case 'range': return fRange(el, f);
      case 'datefmt': return fDateFmt(el);
      case 'imagepick': return fImagePick(el);
    }
    return null;
  }

  function renderInspector(p) {
    var el = GW.selected();
    if (!el) {
      p.appendChild(h('div', { class: 'empty' }, [h('b', { text: 'Nothing selected' }), 'Click something on the watch, pick a layer, or add an element on the left.']));
      return;
    }
    var t = T[el.type];
    var nm = h('input', { type: 'text', value: el.name || t.label, maxlength: 40, 'aria-label': 'Layer name' });
    nm.addEventListener('input', function () { el.name = nm.value; GW.touch(false); });
    nm.addEventListener('change', function () { GW.commit(false); });
    p.appendChild(h('div', { class: 'title' }, [
      h('span', { class: 'ic', text: t.icon, style: 'color:var(--accent);font-size:18px' }), nm,
      h('button', { class: 'btn', title: 'Duplicate (Ctrl+D)', text: '⧉', onclick: function () { GW.duplicateSelected(); } }),
      h('button', { class: 'btn danger', title: 'Delete (Del)', text: '🗑', onclick: function () { GW.deleteSelected(); } })
    ]));
    var info = null;
    if (el.type === 'text' && el.source === 'second') info = 'Seconds only refresh while the wrist is raised.';
    if (info) p.appendChild(h('div', { class: 'note', text: info }));
    if (el.type === 'text' && GW.customFont(el.font)) {
      var cf = GW.customFont(el.font), chars = GW.GLYPH_SETS[cf.glyphs].chars, s = GW.sources[el.source];
      if (s && s.id !== 'custom' && cf.glyphs === 'nums' && ['time', 'date', 'battery', 'steps'].indexOf(el.source) >= 0 && (el.source === 'time' || el.source === 'date' || el.prefix || el.suffix)) {
        p.appendChild(h('div', { class: 'note warn', text: 'This font only has digits 0-9, so “:” and letters will not draw. Pick a bigger glyph set in the Fonts tab.' }));
      } else if (el.source === 'custom' || el.prefix || el.suffix) {
        var miss = ((el.prefix || '') + (el.source === 'custom' ? (el.text || '') : '') + (el.suffix || '')).split('').filter(function (c) { return chars.indexOf(el.upper ? c.toUpperCase() : c) < 0; });
        if (miss.length) p.appendChild(h('div', { class: 'note warn', text: 'Missing glyphs in this bitmap font: ' + miss.join(' ') }));
      }
    }
    t.fields(el).forEach(function (f) { var n = renderField(el, f); if (n) p.appendChild(n); });
    p.appendChild(h('div', { class: 'row' }, [
      h('button', { class: 'btn sm', text: '↑ Bring forward', onclick: function () { GW.moveLayer(el.id, 1); } }),
      h('button', { class: 'btn sm', text: '↓ Send back', onclick: function () { GW.moveLayer(el.id, -1); } })
    ]));
  }

  // refresh numeric/text inputs after canvas drags without rebuilding the panel
  GW.refreshInspectorValues = function () {
    var el = GW.selected(); if (!el || tab !== 'inspect') return;
    Array.prototype.forEach.call($('panel').querySelectorAll('[data-k]'), function (i) {
      var k = i.getAttribute('data-k');
      if ((i.tagName === 'INPUT') && (i.type === 'number' || i.type === 'range') && el[k] != null && document.activeElement !== i) i.value = el[k];
    });
  };

  // ---------------------------------------------------------------- layers
  var svg = function (d) { return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; };
  var ICON = {
    eye: svg('<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>'),
    eyeOff: svg('<path d="M17.9 17.9A10.9 10.9 0 0112 19C5 19 1 12 1 12a18.5 18.5 0 015.1-5.9M9.9 5.1A10.7 10.7 0 0112 5c7 0 11 7 11 7a18.5 18.5 0 01-2.2 3.2M1 1l22 22"/>'),
    lock: svg('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>'),
    unlock: svg('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 017.5-2"/>')
  };
  var dragId = null;
  GW.renderLayers = function () {
    var ul = $('layers'); ul.innerHTML = '';
    var els = GW.design.elements;
    $('layersEmpty').hidden = els.length > 0;
    for (var i = els.length - 1; i >= 0; i--) (function (el) {
      var t = T[el.type];
      var li = h('li', { class: 'layer' + (el.id === GW.selId ? ' sel' : '') + (el.hidden ? ' off' : ''), draggable: 'true', 'data-id': el.id, tabindex: 0, role: 'button', 'aria-label': el.name }, [
        h('span', { class: 'ic', text: t.icon }), h('span', { class: 'nm', text: el.name || t.label }),
        h('button', { class: el.locked ? 'on' : '', 'aria-label': el.locked ? 'Unlock layer' : 'Lock layer', title: el.locked ? 'Unlock' : 'Lock: clicks on the watch pass through it', html: el.locked ? ICON.lock : ICON.unlock, onclick: function (e) { e.stopPropagation(); el.locked = !el.locked; GW.commit(true); } }),
        h('button', { 'aria-label': el.hidden ? 'Show layer' : 'Hide layer', title: el.hidden ? 'Show' : 'Hide (also leaves it out of the export)', html: el.hidden ? ICON.eyeOff : ICON.eye, onclick: function (e) { e.stopPropagation(); el.hidden = !el.hidden; GW.commit(true); } })
      ]);
      li.addEventListener('click', function () { GW.select(el.id); });
      li.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); GW.select(el.id); } });
      li.addEventListener('dragstart', function (e) { dragId = el.id; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', el.id); } catch (x) { } });
      li.addEventListener('dragover', function (e) { e.preventDefault(); li.classList.add('drop'); });
      li.addEventListener('dragleave', function () { li.classList.remove('drop'); });
      li.addEventListener('drop', function (e) {
        e.preventDefault(); li.classList.remove('drop');
        if (!dragId || dragId === el.id) return;
        var arr = GW.design.elements, from = arr.findIndex(function (x) { return x.id === dragId; }), to = arr.findIndex(function (x) { return x.id === el.id; });
        var m = arr.splice(from, 1)[0];
        arr.splice(arr.findIndex(function (x) { return x.id === el.id; }) + 1, 0, m); // lands directly above the row it was dropped on
        void to; dragId = null; GW.commit(true);
      });
      ul.appendChild(li);
    })(els[i]);
  };
  GW.moveLayer = function (id, dir) {
    var a = GW.design.elements, i = a.findIndex(function (x) { return x.id === id; }), j = i + dir;
    if (i < 0 || j < 0 || j >= a.length) return;
    var t = a[i]; a[i] = a[j]; a[j] = t; GW.commit(true);
  };

  // ---------------------------------------------------------------- add
  var QUICK = [
    { l: 'Time', s: 'time', f: 'FONT_NUMBER_HOT', y: 130 },
    { l: 'Date', s: 'date', f: 'FONT_SMALL', y: 70, c: '#aaaaaa', up: true },
    { l: 'Steps', s: 'steps', f: 'FONT_MEDIUM', y: 190, c: '#00ffff' },
    { l: 'Heart rate', s: 'hr', f: 'FONT_MEDIUM', y: 190, c: '#ff5555' },
    { l: 'Battery', s: 'battery', f: 'FONT_MEDIUM', y: 190, c: '#55ff55', suffix: '%' },
    { l: 'Temperature', s: 'temp', f: 'FONT_MEDIUM', y: 190, c: '#ffff55', suffix: '°' },
    { l: 'Body Battery', s: 'bodyBat', f: 'FONT_MEDIUM', y: 190, c: '#ffaa00' },
    { l: 'Moon phase', s: 'moonName', f: 'FONT_XTINY', y: 190, c: '#aaaaff', up: true },
    { l: 'Weather text', s: 'weatherDesc', f: 'FONT_SMALL', y: 200, c: '#aaaaaa' },
    { l: 'Free text', s: 'custom', f: 'FONT_MEDIUM', y: 60, c: '#ffffff' }
  ];
  GW.addElement = function (type, over) {
    var el = GW.newElement(type, over);
    GW.design.elements.push(el); GW.selId = el.id;
    GW.setTab('inspect'); GW.commit(true); GW.emit('select', el.id);
    return el;
  };
  GW.loadImageFile = loadImageFile;
  GW.renderAdd = function () {
    var chips = $('quickChips'); chips.innerHTML = '';
    QUICK.forEach(function (q) {
      chips.appendChild(h('button', { class: 'chip', text: q.l, onclick: function () {
        var o = { name: q.l, source: q.s, font: q.f, y: q.y, color: q.c || '#ffffff', upper: !!q.up, suffix: q.suffix || '' };
        if (q.s === 'custom') o.text = 'Hello';
        GW.addElement('text', o);
      } }));
    });
    var g = $('addGrid'); g.innerHTML = '';
    ['text', 'arc', 'hands', 'ticks', 'shape', 'image', 'barchart', 'movebar', 'moon', 'binary', 'wxicon', 'worldmap', 'bigdata'].forEach(function (k) {
      g.appendChild(h('button', { class: 'addbtn', onclick: function () { GW.addElement(k, { name: T[k].label }); } }, [h('i', { text: T[k].icon }), T[k].label]));
    });
  };

  GW.deleteSelected = function () {
    var el = GW.selected(); if (!el) return;
    var a = GW.design.elements, i = a.indexOf(el); a.splice(i, 1);
    GW.selId = a.length ? a[Math.min(i, a.length - 1)].id : null;
    GW.commit(true); GW.emit('select', GW.selId);
  };
  GW.duplicateSelected = function () {
    var el = GW.selected(); if (!el) return;
    var c = GW.clone(el); c.id = GW.uid('e'); c.name = (el.name || '') + ' copy';
    GW.posPairs(c).forEach(function (p) { c[p[0]] += 8; c[p[1]] += 8; });
    var a = GW.design.elements; a.splice(a.indexOf(el) + 1, 0, c);
    GW.selId = c.id; GW.commit(true); GW.emit('select', c.id);
  };

  // ---------------------------------------------------------------- face tab
  function getSaves() { try { return JSON.parse(localStorage.getItem('gw.saves') || '[]'); } catch (e) { return []; } }
  function putSaves(a) { try { localStorage.setItem('gw.saves', JSON.stringify(a)); return true; } catch (e) { GW.toast('Browser storage is full: delete a snapshot or use Save to download.'); return false; } }
  function renderFace(p) {
    var d = GW.design;
    var bg = h('button', { class: 'swatch', type: 'button' }, [h('i', { style: 'background:' + GW.q(d.bg) }), h('span', { text: GW.q(d.bg) })]);
    bg.addEventListener('click', function () { GW.pickColor(bg, d.bg, function (c) { d.bg = c; GW.commit(true); }); });
    p.appendChild(field('Background colour', bg));
    var file = h('input', { type: 'file', accept: 'image/*', hidden: true });
    file.addEventListener('change', function () {
      if (!file.files[0]) return;
      loadImageFile(file.files[0], function (id) { d.bgImage = id; GW.commit(true); });
    });
    p.appendChild(h('div', { class: 'f' }, [h('label', { text: 'Background image (optional)' }),
      h('div', { class: 'dropzone', onclick: function () { file.click(); }, text: d.bgImage ? 'Replace image…' : 'Choose a 280×280 image…' }), file,
      d.bgImage ? h('button', { class: 'btn sm', text: 'Remove background image', onclick: function () { d.bgImage = null; GW.commit(true); } }) : null]));
    p.appendChild(h('div', { class: 'note warn', text: 'Full-screen images are the quickest way to run out of watch memory. Shapes and gauges cost almost nothing.' }));
    p.appendChild(h('h4', { text: 'Target' }));
    p.appendChild(h('div', { class: 'note', text: GW.DEVICE.name + ' · ' + GW.SIZE + '×' + GW.SIZE + ' round MIP · 64 colours · device id ' + GW.DEVICE.id }));
    if (GW.rotatable(d)) {
      p.appendChild(h('h4', { text: 'Rotate whole face' }));
      var ang = GW.faceAngle(d);
      function setAngle(v) { d.elements.forEach(function (e) { if (e.type === 'bigdata') e.angle = v; }); }
      var rr = h('input', { type: 'range', min: 0, max: 359, step: 1, value: ang, 'aria-label': 'Rotation' });
      var nn = h('input', { type: 'number', min: 0, max: 359, step: 1, value: ang });
      function live(v) { setAngle(v); rr.value = v; nn.value = v; GW.touch(false); }
      rr.addEventListener('input', function () { live(parseFloat(rr.value)); });
      nn.addEventListener('input', function () { var v = parseFloat(nn.value); if (!isNaN(v)) live(((Math.round(v) % 360) + 360) % 360); });
      rr.addEventListener('change', function () { GW.commit(true); }); nn.addEventListener('change', function () { GW.commit(true); });
      p.appendChild(field('Which way the top of the face points', h('div', { class: 'rng' }, [rr, nn])));
      p.appendChild(segCtl([[0, '0°'], [30, '1 o’clock'], [60, '2 (red)'], [90, '3']], ang, function (v) { setAngle(v); GW.commit(true); }));
      p.appendChild(h('div', { class: 'note', text: 'To export several rotations at once (for example 0° and 30°), pick them in the export dialog.' }));
    }
    p.appendChild(h('h4', { text: 'Saved in this browser' }));
    var nameIn = h('input', { type: 'text', value: d.name, maxlength: 40, 'aria-label': 'Snapshot name' });
    p.appendChild(h('div', { class: 'row' }, [nameIn, h('button', { class: 'btn', style: 'flex:none', text: 'Save snapshot', onclick: function () {
      var a = getSaves().filter(function (x) { return x.name !== nameIn.value; });
      a.unshift({ name: nameIn.value || 'Untitled', ts: Date.now(), data: GW.serialize() });
      if (putSaves(a)) { GW.toast('Snapshot saved'); GW.renderPanel(); }
    } })]));
    getSaves().forEach(function (sv, i) {
      p.appendChild(h('div', { class: 'layer', style: 'cursor:default' }, [
        h('span', { class: 'nm', text: sv.name + ' · ' + new Date(sv.ts).toLocaleDateString() }),
        h('button', { class: 'btn sm', text: 'Load', onclick: function () {
          GW.loadFrom(JSON.parse(JSON.stringify(sv.data)), function () { GW.fontsReady().then(function () { GW.touch(true); GW.toast('Loaded ' + sv.name); }); });
        } }),
        h('button', { 'aria-label': 'Delete snapshot', title: 'Delete', text: '×', onclick: function () { var a = getSaves(); a.splice(i, 1); putSaves(a); GW.renderPanel(); } })
      ]));
    });
    p.appendChild(h('p', { class: 'muted small', text: 'Snapshots live only in this browser. Use Save (top bar) to download a .json file you can keep or share.' }));
    p.appendChild(h('h4', { text: 'Start over' }));
    p.appendChild(h('div', { class: 'row' }, [
      h('button', { class: 'btn', text: 'Presets…', onclick: function () { GW.openPresets(); } }),
      h('button', { class: 'btn danger', text: 'Clear all', onclick: function () {
        GW.design.elements = []; GW.selId = null; GW.commit(true); GW.emit('select', null); GW.toast('Cleared. Ctrl+Z to undo.');
      } })
    ]));
  }

  // ---------------------------------------------------------------- fonts tab
  var newFont = { family: 'Orbitron', weight: 900, px: 48, glyphs: 'digits', spacing: 0, upload: null };
  function fontUsage(id) { return GW.design.elements.filter(function (e) { return e.type === 'text' && e.font === id; }).length; }
  function atlasInfo(f) {
    try { var r = GW.rasterizeFont(f); return r.size + '×' + r.size + ' atlas'; } catch (e) { return ''; }
  }
  function sample(canvas, f) {
    var d = window.devicePixelRatio || 1, w = 300, hh = 64;
    GW.previewFonts[f.id || '__preview'] = f; if (!f.id) f = Object.assign({ id: '__preview' }, f);
    canvas.width = w * d; canvas.height = hh * d;
    var x = canvas.getContext('2d'); x.scale(d, d);
    x.fillStyle = '#000'; x.fillRect(0, 0, w, hh);
    var txt = f.glyphs === 'nums' ? '0123456789' : (f.glyphs === 'digits' ? '10:09 28.5°' : 'Sat 10:09 ABC');
    var sc = Math.min(1, (hh - 6) / Math.max(1, GW.fontMetrics(f).lineHeight), (w - 10) / Math.max(1, textW(f, txt)));
    x.save(); x.translate(6, 0); x.scale(sc, sc);
    GW.drawText(x, f.id || '__preview', txt, 0, hh / 2 / sc, 'L', '#00e5ff');
    x.restore();
  }
  function textW(f, t) { var m = GW.fontMetrics(f), w = 0; for (var i = 0; i < t.length; i++) { var g = m.glyphs[t[i]]; w += g ? g.adv : 0; } return w; }

  function famOptions(sel) {
    GW.FONT_FAMILIES.forEach(function (f) { sel.appendChild(h('option', { value: f.family, text: f.family })); });
    GW.design.fonts.filter(function (f) { return f.upload; }).forEach(function (f) { sel.appendChild(h('option', { value: f.family, text: '(uploaded) ' + f.label })); });
  }

  function renderFonts(p) {
    p.appendChild(h('div', { class: 'note', text: 'The watch only has a handful of built-in fonts. Bitmap fonts are drawn from any typeface at the size you choose and are bundled into your project automatically at export. Each one costs watch memory, so keep sizes and glyph sets small.' }));
    GW.design.fonts.forEach(function (f) {
      var cv = h('canvas');
      var used = fontUsage(f.id);
      var sizeIn = h('input', { type: 'number', min: 8, max: 160, value: f.px }), gl = h('select', {}, Object.keys(GW.GLYPH_SETS).map(function (k) { return h('option', { value: k, text: GW.GLYPH_SETS[k].label }); }));
      gl.value = f.glyphs;
      var wsel = h('select', {});
      var fam = GW.FONT_FAMILIES.filter(function (x) { return x.family === f.family; })[0];
      (fam ? fam.weights : [f.weight]).forEach(function (w) { wsel.appendChild(h('option', { value: w, text: String(w) })); });
      wsel.value = f.weight;
      var sp = h('input', { type: 'number', min: -10, max: 20, value: f.spacing || 0 });
      function apply() { f.px = clamp(parseInt(sizeIn.value) || 24, 6, 200); f.glyphs = gl.value; f.weight = Number(wsel.value); f.spacing = parseInt(sp.value) || 0; GW.touch(false); sample(cv, f); GW.history.commit(); GW.renderPanel(); }
      [sizeIn, gl, wsel, sp].forEach(function (i) { i.addEventListener('change', apply); });
      p.appendChild(h('div', { class: 'fontcard' }, [
        h('div', { class: 'meta' }, [h('b', { text: f.family }), h('span', { text: used + ' use' + (used === 1 ? '' : 's') })]), cv,
        h('div', { class: 'row' }, [field('Size px', sizeIn), field('Weight', wsel), field('Spacing', sp)]),
        field('Characters', gl),
        h('div', { class: 'meta' }, [h('span', { text: atlasInfo(f) + ' · line ' + GW.fontMetrics(f).lineHeight + 'px' }),
          h('button', { class: 'btn sm danger', text: 'Delete', onclick: function () {
            GW.design.elements.forEach(function (e) { if (e.font === f.id) e.font = 'FONT_NUMBER_MEDIUM'; });
            GW.design.fonts = GW.design.fonts.filter(function (x) { return x !== f; }); GW.commit(true);
          } })])
      ]));
      requestAnimationFrame(function () { sample(cv, f); });
    });

    p.appendChild(h('h4', { text: 'New bitmap font' }));
    var fam = h('select', {}); famOptions(fam); fam.value = newFont.family;
    var wsel = h('select', {});
    function fillW() {
      wsel.innerHTML = '';
      var f = GW.FONT_FAMILIES.filter(function (x) { return x.family === fam.value; })[0];
      (f ? f.weights : [400]).forEach(function (w) { wsel.appendChild(h('option', { value: w, text: String(w) })); });
      wsel.value = f && f.weights.indexOf(newFont.weight) >= 0 ? newFont.weight : (f ? f.weights[f.weights.length - 1] : 400);
      newFont.weight = Number(wsel.value);
    }
    fillW();
    var px = h('input', { type: 'number', min: 8, max: 160, value: newFont.px });
    var gl = h('select', {}, Object.keys(GW.GLYPH_SETS).map(function (k) { return h('option', { value: k, text: GW.GLYPH_SETS[k].label }); })); gl.value = newFont.glyphs;
    fam.addEventListener('change', function () { newFont.family = fam.value; fillW(); prev(); });
    wsel.addEventListener('change', function () { newFont.weight = Number(wsel.value); prev(); });
    px.addEventListener('input', function () { newFont.px = clamp(parseInt(px.value) || 24, 6, 200); prev(); });
    gl.addEventListener('change', function () { newFont.glyphs = gl.value; prev(); });
    var cv = h('canvas');
    function prev() { sample(cv, Object.assign({ id: '__preview' }, newFont)); }
    var up = h('input', { type: 'file', accept: '.ttf,.otf,.woff,.woff2', hidden: true });
    up.addEventListener('change', function () {
      var file = up.files[0]; if (!file) return;
      var fr = new FileReader();
      fr.onload = function () {
        var id = GW.uid('u'), family = 'upl_' + id;
        GW.registerUploadedFont(family, fr.result).then(function () {
          GW.assets[id] = { dataUrl: fr.result, font: true };
          var f = { id: 'f_' + id, family: family, label: file.name.replace(/\.[^.]+$/, ''), weight: 400, px: newFont.px, glyphs: newFont.glyphs, spacing: 0, upload: true, asset: id };
          GW.design.fonts.push(f);
          GW.commit(true); GW.toast('Font loaded: ' + f.label);
        }).catch(function () { GW.toast('Could not read that font file.'); });
      };
      fr.readAsDataURL(file);
    });
    p.appendChild(h('div', { class: 'fontcard' }, [cv,
      field('Typeface', fam),
      h('div', { class: 'row' }, [field('Weight', wsel), field('Size px', px)]),
      field('Characters', gl),
      h('div', { class: 'row' }, [
        h('button', { class: 'btn', text: '＋ Add font', onclick: function () {
          var id = 'f_' + newFont.family.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) + newFont.px + '_' + GW.uid('').slice(0, 3);
          GW.design.fonts.push({ id: id, family: newFont.family, weight: newFont.weight, px: newFont.px, glyphs: newFont.glyphs, spacing: 0 });
          var sel = GW.selected(); if (sel && sel.type === 'text') sel.font = id;
          GW.commit(true); GW.toast('Font added' + (sel && sel.type === 'text' ? ' and applied to the selected text' : ''));
        } }),
        h('button', { class: 'btn', text: 'Use my own TTF/OTF…', onclick: function () { up.click(); } })]), up]));
    requestAnimationFrame(prev);
  }

  // ---------------------------------------------------------------- sim tab
  var SIMVARS = [
    ['steps', 'Steps', 0, 30000, 50], ['stepGoal', 'Step goal', 2000, 30000, 500], ['calories', 'Calories', 0, 4000, 10], ['floors', 'Floors', 0, 40, 1],
    ['intMins', 'Intensity min (week)', 0, 400, 5], ['distance', 'Distance (km)', 0, 40, 0.1], ['hr', 'Heart rate', 35, 200, 1], ['bodyBat', 'Body Battery', 0, 100, 1],
    ['stress', 'Stress', 0, 100, 1], ['spo2', 'SpO2 %', 80, 100, 1], ['resp', 'Respiration', 4, 40, 1], ['battery', 'Battery %', 0, 100, 1], ['batteryDays', 'Battery days', 0, 14, 0.1],
    ['notif', 'Notifications', 0, 20, 1], ['temp', 'Temperature °C', -20, 45, 1], ['altitude', 'Altitude m', -50, 4000, 10], ['moveBar', 'Move bar', 0, 5, 1],
    ['lastKm', 'Last activity km', 0, 50, 0.1], ['paceSec', 'Pace (sec per km)', 180, 600, 5]
  ];
  function numSim(label, k, mn, mx) {
    var i = h('input', { type: 'number', min: mn, max: mx, step: 0.1, value: GW.sim[k] });
    i.addEventListener('input', function () { var v = parseFloat(i.value); if (!isNaN(v)) { GW.sim[k] = v; GW.touch(false); } });
    return field(label, i);
  }
  function renderSim(p) {
    var s = GW.sim;
    p.appendChild(h('div', { class: 'note', text: 'Test data only changes the preview. The real watch shows real values.' }));
    var live = h('input', { type: 'checkbox' }); live.checked = s.live;
    live.addEventListener('change', function () { s.live = live.checked; $('optLive').checked = s.live; GW.touch(false); GW.renderPanel(); });
    p.appendChild(h('label', { class: 'chk' }, [live, 'Use the live clock']));
    if (!s.live) {
      var tm = h('input', { type: 'range', min: 0, max: 1439, step: 1, value: s.minutes }), tv = h('span', { class: 'mono', text: '' });
      function lab() { tv.textContent = GW.pad2(Math.floor(s.minutes / 60)) + ':' + GW.pad2(s.minutes % 60) + ':' + GW.pad2(s.seconds); }
      tm.addEventListener('input', function () { s.minutes = parseInt(tm.value); lab(); GW.touch(false); });
      var sc = h('input', { type: 'range', min: 0, max: 59, step: 1, value: s.seconds });
      sc.addEventListener('input', function () { s.seconds = parseInt(sc.value); lab(); GW.touch(false); });
      lab();
      p.appendChild(field('Time of day', h('div', { class: 'rng' }, [tm, tv]))); p.appendChild(field('Seconds', sc));
    }
    var u = h('div', { class: 'row' }, [
      field('Units', segCtl([[1, 'Metric'], [0, 'Imperial']], s.metric ? 1 : 0, function (v) { s.metric = !!Number(v); GW.touch(false); GW.renderPanel(); })),
      field('Clock', segCtl([[1, '24h'], [0, '12h']], s.is24 ? 1 : 0, function (v) { s.is24 = !!Number(v); GW.touch(false); GW.renderPanel(); }))
    ]);
    p.appendChild(u);
    p.appendChild(field('Weather (for icon + text)', (function () {
      var sel = h('select', {}, GW.WX_NAMES.slice(0, 8).map(function (n, i) { return h('option', { value: i, text: n }); }));
      sel.value = s.wx; sel.addEventListener('change', function () { s.wx = parseInt(sel.value); GW.touch(false); }); return sel;
    })()));
    p.appendChild(h('div', { class: 'row' }, [numSim('Latitude', 'lat', -90, 90), numSim('Longitude', 'lon', -180, 180)]));
    p.appendChild(h('h4', { text: 'Sensor values' }));
    SIMVARS.forEach(function (v) {
      var r = h('input', { type: 'range', min: v[2], max: v[3], step: v[4], value: s[v[0]] }), n = h('span', { class: 'mono', text: String(s[v[0]]) });
      r.value = s[v[0]];
      r.addEventListener('input', function () { s[v[0]] = parseFloat(r.value); n.textContent = String(s[v[0]]); GW.touch(false); });
      p.appendChild(h('div', { class: 'f' }, [h('label', { text: v[1] }), h('div', { class: 'rng' }, [r, n])]));
    });
  }

  // ---------------------------------------------------------------- modals
  function closeModal() { $('modalRoot').innerHTML = ''; document.removeEventListener('keydown', escClose); }
  function escClose(e) { if (e.key === 'Escape') closeModal(); }
  function modal(title, bodyNode, wide) {
    closeModal();
    var m = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, [
      h('header', {}, [h('h2', { text: title }), h('button', { class: 'x', 'aria-label': 'Close', text: '×', onclick: closeModal })]),
      h('div', { class: 'body' }, [bodyNode])
    ]);
    var bg = h('div', { class: 'modal-bg' }, [m]);
    bg.addEventListener('pointerdown', function (e) { if (e.target === bg) closeModal(); });
    $('modalRoot').appendChild(bg);
    document.addEventListener('keydown', escClose);
    return m;
  }
  GW.closeModal = closeModal;

  GW.openPresets = function () {
    var grid = h('div', { class: 'presets' });
    GW.PRESETS.forEach(function (p) {
      var thumb;
      if (p.id === 'blank') { var c = document.createElement('canvas'); c.width = c.height = 120; c.getContext('2d').fillStyle = '#000'; c.getContext('2d').fillRect(0, 0, 120, 120); c.style.width = c.style.height = '120px'; thumb = c; }
      else thumb = GW.thumb(p.build(), 140);
      var card = h('button', { class: 'pcard', onclick: function () {
        GW.applyPreset(p.id, function () { GW.fontsReady().then(function () { GW.touch(true); closeModal(); GW.toast(p.name + ' loaded. Ctrl+Z undoes it.'); GW.history.commit(); }); });
      } }, [thumb, h('b', { text: p.name }), h('span', { text: p.blurb })]);
      grid.appendChild(card);
    });
    modal('Start from a preset', h('div', {}, [h('p', { class: 'muted', text: 'Everything is editable afterwards. Presets replace your current design (Ctrl+Z brings it back).' }), grid]));
  };

  // ---- one-click cloud build (only on the Vercel deployment) ----
  function b64(data) {
    if (typeof data === 'string') data = new TextEncoder().encode(data);
    var s = '', CH = 0x8000;
    for (var i = 0; i < data.length; i += CH) s += String.fromCharCode.apply(null, data.subarray(i, i + CH));
    return btoa(s);
  }
  function api(path, opts) {
    return fetch(path, opts).then(function (r) {
      return r.text().then(function (t) { var j = null; try { j = JSON.parse(t); } catch (e) { } return { status: r.status, json: j }; });
    });
  }
  function builderBox(results) {
    var box = h('div', { class: 'card', style: 'margin:14px 0;border-color:#17556b;background:#0c1c26' });
    var msg = h('div', { class: 'muted small', text: 'Checking the cloud builder…' });
    var logBox = h('div', { class: 'code', style: 'display:none;margin-top:10px;max-height:200px' });
    var many = results.length > 1;
    var btn = h('button', { class: 'btn primary', style: 'font-size:15px;padding:11px 20px', text: many ? '⚙ Build all ' + results.length + ' versions (.prg)' : '⚙ Build my watchface (.prg)', disabled: true });
    var setup = h('button', { class: 'btn', text: 'Set up the builder (one time, ~2 min)', style: 'display:none;margin-left:8px' });
    function say(t, log) { msg.textContent = t; if (log != null) { logBox.style.display = log ? '' : 'none'; logBox.textContent = log; } }
    function buildOne(res) {
      return api('/api/build', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        name: res.name, files: res.files.map(function (f) { return { path: f.path, data: b64(f.data) }; }) }) }).then(function (r) { return r.json || {}; });
    }
    btn.addEventListener('click', function () {
      btn.disabled = true; var done = [], log = '';
      (function next(i) {
        if (i >= results.length) {
          btn.disabled = false;
          say('Built ' + done.join(', ') + '. Copy ' + (done.length > 1 ? 'them' : 'it') + ' into GARMIN/APPS on the watch.', log.replace(/exit=0/g, '').trim());
          return;
        }
        say('Compiling ' + (i + 1) + ' of ' + results.length + ' with Garmin’s compiler…', '');
        buildOne(results[i]).then(function (j) {
          if (!j.ok) { btn.disabled = false; say((j.message || 'Build failed.') + (many ? ' (' + results[i].name + ')' : ''), j.log || ''); return; }
          var bin = atob(j.prg), u = new Uint8Array(bin.length); for (var k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k);
          GW.download(new Blob([u], { type: 'application/octet-stream' }), j.name);
          done.push(j.name + ' (' + Math.round(u.length / 1024) + ' KB)'); log += (j.log || '') + '\n';
          setTimeout(function () { next(i + 1); }, 400); // let the browser start each download
        }).catch(function (e) { btn.disabled = false; say('Build failed: ' + e.message); });
      })(0);
    });
    setup.addEventListener('click', function () {
      setup.disabled = true; say('Setting up Garmin’s toolchain in the cloud… this takes a couple of minutes, keep this window open.', '');
      api('/api/setup', { method: 'POST' }).then(function (r) {
        var j = r.json || {}; setup.disabled = false;
        if (j.ok) { setup.style.display = 'none'; btn.disabled = false; say('Builder ready. Press the build button.', ''); }
        else say(j.message || 'Setup failed.', j.log || '');
      }).catch(function (e) { setup.disabled = false; say('Setup failed: ' + e.message); });
    });
    box.appendChild(h('div', { style: 'display:flex;align-items:center;flex-wrap:wrap;gap:6px' }, [btn, setup]));
    box.appendChild(msg); box.appendChild(logBox);
    api('/api/status').then(function (r) {
      if (!r.json) { box.style.display = 'none'; return; } // static hosting: no backend
      if (r.json.ready) { btn.disabled = false; say('Cloud builder ready: one click gives you the finished .prg' + (many ? ' files.' : '.')); }
      else { setup.style.display = ''; say(r.json.message); }
    }).catch(function () { box.style.display = 'none'; });
    return box;
  }

  // Chips to pick which rotations (tilts) to export, e.g. 0° and 30° side by side.
  function tiltPicker(onChange) {
    var tl = GW.tiltList(GW.design) || [], wrap = h('div', { class: 'card', style: 'margin:0 0 14px' });
    var PRESETS = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
    function set(list) { GW.design.tilts = list.length ? list : [GW.faceAngle(GW.design)]; GW.history.commit(); onChange(); }
    wrap.appendChild(h('h4', { style: 'margin:0 0 6px', class: 'muted small', text: 'ROTATION VERSIONS TO EXPORT' }));
    var chips = h('div', { class: 'chips' });
    var shown = PRESETS.concat(tl.filter(function (a) { return PRESETS.indexOf(a) < 0; })).sort(function (a, b) { return a - b; });
    shown.forEach(function (a) {
      var on = tl.indexOf(a) >= 0;
      chips.appendChild(h('button', { class: 'chip' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', text: a + '°', onclick: function () {
        set(on ? tl.filter(function (x) { return x !== a; }) : tl.concat([a]));
      } }));
    });
    var custom = h('input', { type: 'number', min: 0, max: 359, placeholder: 'other °', style: 'width:84px;background:var(--panel2);border:1px solid var(--line);border-radius:999px;padding:4px 10px;color:inherit' });
    custom.addEventListener('change', function () { var v = parseInt(custom.value, 10); if (!isNaN(v)) set(tl.concat([((v % 360) + 360) % 360])); });
    chips.appendChild(custom);
    wrap.appendChild(chips);
    wrap.appendChild(h('div', { class: 'muted small', style: 'margin-top:6px', text: tl.length > 1 ? 'Each rotation becomes its own watchface (named with its angle), so you can keep several on the watch.' : '0° = upright, 30° = points at 1 o’clock, 60° = 2 o’clock (the red button). Pick more than one to export several at once.' }));
    return wrap;
  }

  GW.openExport = function () {
    var body = h('div', {}, [h('p', { class: 'muted', text: 'Building your project…' })]);
    modal('Get it on your watch', body);
    function render() {
      GW.buildVariants(GW.design).then(function (results) {
        var first = results[0], many = results.length > 1;
        if (!many) GW.design.appId = first.appId; GW.history.commit();
        var zipName = (many ? GW.slug(GW.design.name) + '-versions' : first.name) + '-fenix6x.zip';
        var all = []; results.forEach(function (r) { r.files.forEach(function (f) { all.push({ path: r.name + '/' + f.path, data: f.data, exec: f.exec }); }); });
        var blob = GW.zip(all), nFiles = all.length;
        body.innerHTML = '';
        if (GW.rotatable(GW.design)) body.appendChild(tiltPicker(function () { body.innerHTML = ''; body.appendChild(h('p', { class: 'muted', text: 'Building your project…' })); render(); }));

        var cur = null, codeBox = h('div', { class: 'code', text: '' }), tabs = h('div', { class: 'codetabs' }), vsel = null;
        function textFilesOf(r) { return r.files.filter(function (f) { return typeof f.data === 'string' && !/design\.json$|\.fnt$|\.gitignore$|launch\.json$/.test(f.path); }); }
        function show(f) {
          cur = f; codeBox.textContent = f.data;
          Array.prototype.forEach.call(tabs.children, function (b) { b.classList.toggle('primary', b.dataset.p === f.path); });
        }
        function loadTabs(r) {
          tabs.innerHTML = ''; var tf = textFilesOf(r);
          tf.forEach(function (f) { tabs.appendChild(h('button', { class: 'btn sm', 'data-p': f.path, text: f.path.split('/').pop(), onclick: function () { show(f); } })); });
          show(tf.filter(function (f) { return /View\.mc$/.test(f.path); })[0] || tf[0]);
        }

        var warns = {}; results.forEach(function (r) { r.warnings.forEach(function (w) { warns[w] = 1; }); });
        body.appendChild(h('div', { class: 'row', style: 'align-items:center;margin-bottom:14px;gap:14px;flex-wrap:wrap' }, [
          h('button', { class: 'btn primary', style: 'font-size:15px;padding:11px 20px', text: '⬇ Download ' + (many ? results.length + ' projects' : 'project') + ' (' + zipName + ')', onclick: function () { GW.download(blob, zipName); GW.toast('Downloaded ' + zipName); } }),
          h('span', { class: 'muted small', text: nFiles + ' files · ' + Math.round(blob.size / 1024) + ' KB · for ' + GW.DEVICE.name })
        ]));
        body.appendChild(h('div', { class: 'warns' }, Object.keys(warns).map(function (w) { return h('div', { class: 'note warn', text: '⚠ ' + w }); })));
        body.appendChild(builderBox(results));
        body.appendChild(h('h4', { style: 'margin:18px 0 8px', class: 'muted small', text: 'OR BUILD IT YOURSELF' }));
        body.appendChild(h('ol', { class: 'steps' }, [
          h('li', {}, [h('div', {}, [h('h5', { text: 'Unzip the download' }), h('p', { html: 'It is a complete Garmin Connect IQ project' + (many ? ' per version' : '') + ' with a step-by-step <span class="kbd">README.md</span> inside.' })])]),
          h('li', {}, [h('div', {}, [h('h5', { text: 'One-time setup' }), h('p', { html: 'Install the <a href="https://developer.garmin.com/connect-iq/sdk/" target="_blank" rel="noopener">Connect IQ SDK</a> (via its SDK Manager, also download the <b>fēnix 6X Pro</b> device) and <a href="https://marketplace.visualstudio.com/items?itemName=garmin.monkeyc" target="_blank" rel="noopener">VS Code with Garmin’s Monkey C extension</a>.' })])]),
          h('li', {}, [h('div', {}, [h('h5', { text: 'Build' }), h('p', { html: 'Open the folder in VS Code → <span class="kbd">Ctrl/Cmd+Shift+P</span> → <b>Monkey C: Build for Device</b> → <b>fenix6xpro</b>. Press <span class="kbd">F5</span> to try it in Garmin’s simulator first. Prefer a terminal? Run <span class="kbd">./build.sh</span> (or <span class="kbd">build.bat</span>).' })])]),
          h('li', {}, [h('div', {}, [h('h5', { text: 'Copy to the watch' }), h('p', { html: 'Connect the watch by USB and copy the <span class="kbd">.prg</span> ' + (many ? 'files' : 'file') + ' into <span class="kbd">GARMIN/APPS</span>. Unplug, then on the watch: hold UP → Watch Face → pick it.' })])])
        ]));
        body.appendChild(h('h4', { style: 'margin:20px 0 8px', class: 'muted small', text: 'GENERATED CODE' }));
        if (many) {
          vsel = h('select', { style: 'margin-bottom:8px;background:var(--panel2);border:1px solid var(--line);border-radius:7px;padding:5px 8px;color:inherit' },
            results.map(function (r, i) { return h('option', { value: i, text: r.name + ' (' + r.tilt + '°)' }); }));
          vsel.addEventListener('change', function () { loadTabs(results[parseInt(vsel.value, 10)]); });
          body.appendChild(vsel);
        }
        loadTabs(first);
        body.appendChild(tabs); body.appendChild(codeBox);
        body.appendChild(h('div', { class: 'row', style: 'margin-top:10px' }, [
          h('button', { class: 'btn sm', text: 'Copy this file', onclick: function () { navigator.clipboard.writeText(cur.data).then(function () { GW.toast('Copied ' + cur.path); }); } }),
          h('button', { class: 'btn sm', text: 'Save design.json (to edit later)', onclick: function () { GW.saveFile(); } })
        ]));
      }).catch(function (e) {
        console.error(e); body.innerHTML = ''; body.appendChild(h('div', { class: 'note warn', text: 'Export failed: ' + e.message }));
      });
    }
    render();
  };

  GW.saveFile = function () {
    var blob = new Blob([JSON.stringify(GW.serialize())], { type: 'application/json' });
    GW.download(blob, GW.slug(GW.design.name) + '.watchface.json');
  };
})(window.GW);
