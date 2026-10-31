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
    else if (tab === 'face') (GW.modeOf() === 'field' ? renderFieldSettings : renderFace)(p);
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

  function slugId(fam, w) { return 'f_' + fam.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) + w + '_' + GW.uid('').slice(0, 3); }
  // One menu holds every typeface: Garmin's built-ins, each bundled typeface and weight, and any font file you uploaded.
  // Picking one that is not in the design yet adds it. The size is its own field.
  function fFont(el, f) {
    var sel = h('select', { 'data-k': f.k });
    var g1 = h('optgroup', { label: 'Garmin built-in (fixed sizes)' });
    GW.SYS_FONTS.forEach(function (s) { g1.appendChild(h('option', { value: s[0], text: s[0].replace('FONT_', '').replace(/_/g, ' ').toLowerCase() + ' · ~' + Math.round(s[1] * GW.SIZE / 260) + 'px' })); });
    sel.appendChild(g1);
    function inDesign(fam, w) { return GW.design.fonts.filter(function (c) { return c.family === fam && Number(c.weight) === Number(w); })[0]; }
    var g2 = h('optgroup', { label: 'Typefaces' });
    GW.FONT_FAMILIES.slice().sort(function (a, b) { return a.family < b.family ? -1 : 1; }).forEach(function (fam) {
      fam.weights.forEach(function (w) {
        var have = inDesign(fam.family, w);
        g2.appendChild(h('option', { value: have ? have.id : '__fam|' + fam.family + '|' + w, text: fam.family + ' ' + w }));
      });
    });
    GW.design.fonts.filter(function (c) { return c.upload; }).forEach(function (c) { g2.appendChild(h('option', { value: c.id, text: c.label || c.family })); });
    sel.appendChild(g2);
    sel.appendChild(h('option', { value: '__up', text: '＋ Upload a font file…' }));
    var up = h('input', { type: 'file', accept: '.ttf,.otf,.woff,.woff2', hidden: true });
    var cur = GW.customFont(el[f.k]);
    function restore() { var rep = cur && !cur.upload ? inDesign(cur.family, cur.weight) : cur; sel.value = rep ? rep.id : el[f.k]; }
    restore();
    up.addEventListener('change', function () {
      var file = up.files[0]; if (!file) return;
      var fr = new FileReader();
      fr.onload = function () {
        var id = GW.uid('u'), family = 'upl_' + id;
        GW.registerUploadedFont(family, fr.result).then(function () {
          GW.assets[id] = { dataUrl: fr.result, font: true };
          var nf = { id: 'f_' + id, family: family, label: file.name.replace(/\.[^.]+$/, ''), weight: 400, px: el.fontSize || (cur && cur.px) || 22, glyphs: cur && cur.glyphs ? cur.glyphs : 'basic', spacing: 0, upload: true, asset: id };
          GW.design.fonts.push(nf); el[f.k] = nf.id; el.fontSize = null; fireChange(true); GW.toast('Font loaded: ' + nf.label);
        }).catch(function () { GW.toast('Could not read that font file.'); });
      };
      fr.readAsDataURL(file);
    });
    sel.addEventListener('change', function () {
      if (sel.value === '__up') { restore(); up.click(); return; }
      if (sel.value.indexOf('__fam|') === 0) {
        var parts = sel.value.split('|'), base = cur || { px: 22, glyphs: 'basic' };
        var nfont = { id: slugId(parts[1], parts[2]), family: parts[1], weight: Number(parts[2]), px: el.fontSize || base.px, glyphs: base.glyphs === 'nums' || base.glyphs === 'digits' ? base.glyphs : 'basic', spacing: 0 };
        GW.design.fonts.push(nfont); el[f.k] = nfont.id; el.fontSize = null;
        fireChange(true); GW.touch(false); GW.fontsReady().then(function () { GW.touch(true); }); return;
      }
      var oldPx = el.fontSize || (cur && cur.px), nf = GW.customFont(sel.value);
      el[f.k] = sel.value;
      if (nf && oldPx && nf.px !== oldPx) el.fontSize = oldPx;   // switching typeface keeps the size you had
      fireChange(true); GW.touch(false);
    });
    return h('div', { class: 'f' }, [h('label', { text: f.label }), sel, up]);
  }
  // character set and letter spacing belong to the typeface entry, so they are edited from the text that uses it
  function fGlyphs(el) {
    var base = GW.customFont(el.font); if (!base) return null;
    var gl = h('select', {}, Object.keys(GW.GLYPH_SETS).map(function (k) { return h('option', { value: k, text: GW.GLYPH_SETS[k].label }); }));
    gl.value = base.glyphs;
    gl.addEventListener('change', function () { base.glyphs = gl.value; fireChange(true); });
    return field('Characters', gl);
  }
  // fattens a light typeface (such as Xanh Mono, which only has one thin weight) by outlining each glyph
  function fThicken(el) {
    var base = GW.customFont(el.font); if (!base) return null;
    var i = h('input', { type: 'number', min: 0, max: 8, step: 1, value: base.bold || 0 });
    i.addEventListener('input', function () { var v = parseInt(i.value); if (!isNaN(v)) { base.bold = Math.max(0, v); GW.touch(false); } });
    i.addEventListener('change', function () { fireChange(true); });
    return field('Thicken (px)', i);
  }
  function fSpacing(el) {
    var base = GW.customFont(el.font); if (!base) return null;
    var i = h('input', { type: 'number', min: -10, max: 20, step: 1, value: base.spacing || 0 });
    i.addEventListener('input', function () { var v = parseInt(i.value); if (!isNaN(v)) { base.spacing = v; GW.touch(false); } });
    i.addEventListener('change', function () { fireChange(false); });
    return field('Letter spacing', i);
  }

  function fColor(el, f) {
    var b = h('button', { class: 'swatch', type: 'button', 'data-ck': f.k }, [h('i', { style: 'background:' + GW.q(el[f.k]) }), h('span', { text: GW.q(el[f.k]) })]);
    b.addEventListener('click', function () {
      GW.pickColor(b, el[f.k], function (c) { el[f.k] = c; fireChange(true); });
    });
    return field(f.label, b);
  }
  function fOptColor(el, f) {
    var v = el[f.k], b = h('button', { class: 'swatch', type: 'button' }, [h('i', { style: 'background:' + (v ? GW.q(v) : 'transparent') }), h('span', { text: v ? GW.q(v) : (f.noneLabel || 'none') })]);
    b.addEventListener('click', function () { GW.pickColor(b, v || '#ffffff', function (c) { el[f.k] = c; fireChange(true); }, { none: true }); });
    return field(f.label, b);
  }
  function fDfSrc(el, f) {
    var sel = h('select', { 'data-k': f.k });
    GW.DF_GROUPS.forEach(function (g) {
      var og = h('optgroup', { label: g });
      GW.DF_SOURCES.forEach(function (s) { if (s[3] === g) og.appendChild(h('option', { value: s[0], text: s[2] })); });
      sel.appendChild(og);
    });
    sel.value = el[f.k];
    sel.addEventListener('change', function () {
      var old = GW.DF_BY[el[f.k]], neu = GW.DF_BY[sel.value];
      if (!el.name || (old && (el.name === old[2] || el.name === el.label))) el.name = neu[2];
      if (!el.label || (old && el.label.toLowerCase() === old[2].toLowerCase())) el.label = neu[1] ? neu[2].toUpperCase() : '';
      el[f.k] = sel.value; fireChange(true);
    });
    return field(f.label, sel);
  }
  // Garmin's built-in fonts: the same list a Connect IQ developer picks from
  function fSysFont(el, f) {
    var sel = h('select', { 'data-k': f.k });
    GW.SYS_FONTS.forEach(function (s) {
      if (f.only && s[2] !== f.only) return;
      sel.appendChild(h('option', { value: s[0], text: s[0].replace('FONT_', '').replace(/_/g, ' ').toLowerCase() + (s[2] === 'n' ? ' (digits only)' : '') + ' · ~' + Math.round(s[1] * GW.SIZE / 260) + 'px' }));
    });
    sel.value = el[f.k];
    sel.addEventListener('change', function () { el[f.k] = sel.value; fireChange(false); GW.touch(false); });
    return field(f.label, sel);
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
      case 'note': return null;
      case 'row': return h('div', { class: 'row' }, f.fields.map(function (x) { return renderField(el, x); }));
      case 'source': return fSource(el, f);
      case 'font': return fFont(el, f);
      case 'dfsrc': return fDfSrc(el, f);
      case 'sysfont': return fSysFont(el, f);
      case 'glyphs': return fGlyphs(el);
      case 'spacing': return fSpacing(el);
      case 'thicken': return fThicken(el);
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
      p.appendChild(h('div', { class: 'empty' }, [h('b', { text: 'Nothing selected' })]));
      return;
    }
    var t = T[el.type];
    var nm = h('input', { type: 'text', value: el.name || t.label, maxlength: 40, 'aria-label': 'Layer name' });
    nm.addEventListener('input', function () { el.name = nm.value; GW.touch(false); });
    nm.addEventListener('change', function () { GW.commit(false); });
    p.appendChild(h('div', { class: 'title' }, [
      h('span', { class: 'ic', text: t.icon, style: 'color:var(--muted);font-size:18px' }), nm,
      h('button', { class: 'btn', title: 'Duplicate (Ctrl+D)', text: '⧉', onclick: function () { GW.duplicateSelected(); } }),
      h('button', { class: 'btn danger', title: 'Delete (Del)', text: '🗑', onclick: function () { GW.deleteSelected(); } })
    ]));
    if (el.type === 'text' && GW.customFont(el.font)) {
      // any character the chosen bitmap font does not contain simply does not draw on the watch
      var cf = GW.customFont(el.font), chars = GW.GLYPH_SETS[cf.glyphs].chars, shown = '';
      try { shown = T.text.string(el, GW.env()); } catch (e) { }
      var miss = shown.split('').filter(function (c, i, a) { return chars.indexOf(c) < 0 && a.indexOf(c) === i; });
      if (miss.length) p.appendChild(h('div', { class: 'note warn', text: 'Missing from this font’s character set: ' + miss.join(' ') + '. Pick a bigger set under Characters (“Full” or the Turkish one).' }));
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
    for (var i = els.length - 1; i >= 0; i--) (function (el) {
      var t = T[el.type] || { icon: '?', label: el.type };
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
  var DFQUICK = [
    ['Timer', 'timer', 'FONT_NUMBER_MEDIUM'], ['Distance', 'dist', 'FONT_NUMBER_MEDIUM'], ['Pace', 'pace', 'FONT_NUMBER_MEDIUM'], ['Average pace', 'avgPace', 'FONT_NUMBER_MEDIUM'],
    ['Lap pace', 'lapPace', 'FONT_NUMBER_MEDIUM'], ['Last lap', 'lastLap', 'FONT_NUMBER_MEDIUM'], ['Heart rate', 'hr', 'FONT_NUMBER_MEDIUM'], ['Cadence', 'cad', 'FONT_NUMBER_MEDIUM'],
    ['Power', 'power', 'FONT_NUMBER_MEDIUM'], ['Time of day', 'tod', 'FONT_NUMBER_MEDIUM']
  ];
  GW.renderAdd = function () {
    var chips = $('quickChips'); chips.innerHTML = '';
    if (GW.modeOf() === 'field') {
      DFQUICK.forEach(function (q) {
        chips.appendChild(h('button', { class: 'chip', text: q[0], onclick: function () {
          var n = GW.design.elements.length;
          GW.addElement('dfcell', { name: q[0], src: q[1], label: q[0].toUpperCase(), vfont: q[2], zone: q[1] === 'hr', y: 40 + (n % 4) * 30 });
        } }));
      });
      var gf = $('addGrid'); gf.innerHTML = '';
      ['dfcell', 'shape'].forEach(function (k) {
        gf.appendChild(h('button', { class: 'addbtn', onclick: function () { GW.addElement(k, k === 'shape' ? { name: 'Divider', kind: 'line', x: 20, y: 140, x2: 260, y2: 140, color: '#aaaaaa', pen: 1 } : { name: 'Data cell', src: 'timer' }); } }, [h('i', { text: T[k].icon }), k === 'shape' ? 'Line / box' : 'Data cell']));
      });
      return;
    }
    QUICK.forEach(function (q) {
      chips.appendChild(h('button', { class: 'chip', text: q.l, onclick: function () {
        var o = { name: q.l, source: q.s, font: q.f, y: q.y, color: q.c || '#ffffff', upper: !!q.up, suffix: q.suffix || '' };
        if (q.s === 'custom') o.text = 'Hello';
        GW.addElement('text', o);
      } }));
    });
    var g = $('addGrid'); g.innerHTML = '';
    ['text', 'arc', 'hands', 'ticks', 'shape', 'image', 'barchart', 'movebar', 'moon', 'binary', 'wxicon', 'worldmap', 'sunicon'].forEach(function (k) {
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

  // ---------------------------------------------------------------- data field settings
  function renderFieldSettings(p) {
    var d = GW.design;
    p.appendChild(field('Screen colours', segCtl([['light', 'Light'], ['auto', 'Match watch'], ['dark', 'Dark']], d.dfTheme || 'light', function (v) { d.dfTheme = v; GW.commit(true); })));
    p.appendChild(field('Units', segCtl([['watch', 'Match watch'], ['metric', 'Metric'], ['imperial', 'Imperial']], d.dfUnits || 'watch', function (v) { d.dfUnits = v; GW.commit(true); })));
    p.appendChild(h('h4', { text: 'Laps' }));
    var c = h('input', { type: 'checkbox' }); c.checked = !!d.dfAutoLap;
    c.addEventListener('change', function () { d.dfAutoLap = c.checked; GW.commit(true); });
    p.appendChild(h('label', { class: 'chk' }, [c, 'Auto lap by distance']));
    if (d.dfAutoLap) p.appendChild(fNum(d, { k: 'dfLapM', label: 'Auto lap every (metres)', min: 100, max: 10000, step: 100 }));
    if (d.dfLapM == null) d.dfLapM = 1000;
  }

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
    p.appendChild(h('h4', { text: 'Start over' }));
    p.appendChild(h('div', { class: 'row' }, [
      h('button', { class: 'btn', text: 'Presets…', onclick: function () { GW.openPresets(); } }),
      h('button', { class: 'btn danger', text: 'Clear all', onclick: function () {
        GW.design.elements = []; GW.selId = null; GW.commit(true); GW.emit('select', null); GW.toast('Cleared. Ctrl+Z to undo.');
      } })
    ]));
  }

  // ---------------------------------------------------------------- fonts tab
  // ---------------------------------------------------------------- sim tab
  var SIMVARS = [
    ['steps', 'Steps', 0, 30000, 50], ['stepGoal', 'Step goal', 2000, 30000, 500], ['calories', 'Calories', 0, 4000, 10], ['floors', 'Floors', 0, 40, 1],
    ['intMins', 'Intensity min (week)', 0, 400, 5], ['distance', 'Distance (km)', 0, 40, 0.1], ['hr', 'Heart rate', 35, 200, 1], ['bodyBat', 'Body Battery', 0, 100, 1],
    ['stress', 'Stress', 0, 100, 1], ['spo2', 'SpO2 %', 80, 100, 1], ['resp', 'Respiration', 4, 40, 1], ['battery', 'Battery %', 0, 100, 1], ['batteryDays', 'Battery days', 0, 14, 0.1],
    ['notif', 'Notifications', 0, 20, 1], ['temp', 'Temperature °C', -20, 45, 1], ['altitude', 'Altitude m', -50, 4000, 10], ['moveBar', 'Move bar', 0, 5, 1],
    ['lastKm', 'Last activity km', 0, 50, 0.1], ['paceSec', 'Pace (sec per km)', 180, 600, 5],
    ['runHr', 'RUN: heart rate', 60, 200, 1], ['runKm', 'RUN: distance (km)', 0, 42, 0.01], ['runAvg', 'RUN: average pace (s/km)', 180, 600, 1],
    ['runPace', 'RUN: current pace (s/km)', 180, 600, 1], ['runAvgHr', 'RUN: average heart rate', 60, 200, 1], ['runMaxHr', 'RUN: max heart rate', 60, 220, 1],
    ['runCad', 'RUN: cadence', 100, 220, 1], ['runPow', 'RUN: power (W)', 0, 600, 5], ['runAscent', 'RUN: total ascent (m)', 0, 2000, 5], ['runCal', 'RUN: calories', 0, 3000, 10],
    ['lapKm', 'RUN: lap distance (km)', 0, 1, 0.01], ['lapPace', 'RUN: lap pace (s/km)', 180, 600, 1], ['lastLap', 'RUN: last lap pace (s/km)', 180, 600, 1]
  ];
  function numSim(label, k, mn, mx) {
    var i = h('input', { type: 'number', min: mn, max: mx, step: 0.1, value: GW.sim[k] });
    i.addEventListener('input', function () { var v = parseFloat(i.value); if (!isNaN(v)) { GW.sim[k] = v; GW.touch(false); } });
    return field(label, i);
  }
  function renderSim(p) {
    var s = GW.sim;
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
    var fld = GW.modeOf() === 'field';
    GW.PRESETS.forEach(function (p) {
      if ((p.kind === 'datafield') !== fld) return;
      var thumb;
      if (p.id === 'blank' || p.id === 'blankfield') { var c = document.createElement('canvas'); c.width = c.height = 120; c.getContext('2d').fillStyle = p.id === 'blank' ? '#000' : '#fff'; c.getContext('2d').fillRect(0, 0, 120, 120); c.style.width = c.style.height = '120px'; thumb = c; }
      else thumb = GW.thumb(p.build(), 140);
      var card = h('button', { class: 'pcard', onclick: function () {
        GW.applyPreset(p.id, function () { GW.fontsReady().then(function () { GW.touch(true); closeModal(); GW.toast(p.name + ' loaded. Ctrl+Z undoes it.'); GW.history.commit(); }); });
      } }, [thumb, h('b', { text: p.name })]);
      grid.appendChild(card);
    });
    modal(fld ? 'Layouts' : 'Presets', grid);
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
    var box = h('div', { class: 'card', style: 'margin:14px 0;background:var(--panel2)' });
    var msg = h('div', { class: 'muted small', text: 'Checking the cloud builder…' });
    var logBox = h('div', { class: 'code', style: 'display:none;margin-top:10px;max-height:200px' });
    var many = results.length > 1;
    var btn = h('button', { class: 'btn primary', style: 'font-size:15px;padding:11px 20px', text: many ? 'Build all ' + results.length + ' versions (.prg)' : (GW.modeOf() === 'field' ? 'Build my data field (.prg)' : 'Build my watchface (.prg)'), disabled: true });
    var iqBtn = h('button', { class: 'btn', style: 'padding:11px 16px', title: 'A release package for the Connect IQ developer portal (apps.garmin.com/developer)', text: many ? '📦 Download .iq files (for the store)' : '📦 Download .iq (for the store)', disabled: true });
    var setup = h('button', { class: 'btn', text: 'Set up the builder (one time, ~2 min)', style: 'display:none;margin-left:8px' });
    function say(t, log) { msg.textContent = t; if (log != null) { logBox.style.display = log ? '' : 'none'; logBox.textContent = log; } }
    function buildOne(res, format) {
      return api('/api/build', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        name: res.name, format: format, files: res.files.map(function (f) { return { path: f.path, data: b64(f.data) }; }) }) }).then(function (r) { return r.json || {}; });
    }
    function run(format) {
      btn.disabled = true; iqBtn.disabled = true; var done = [], log = '', what = format === 'iq' ? '.iq' : '.prg';
      (function next(i) {
        function finish() { btn.disabled = false; iqBtn.disabled = false; }
        if (i >= results.length) {
          finish();
          say(format === 'iq'
            ? 'Built ' + done.join(', ') + '. Upload ' + (done.length > 1 ? 'each one' : 'it') + ' at apps.garmin.com/developer → Upload an App.'
            : 'Built ' + done.join(', ') + '. Copy ' + (done.length > 1 ? 'them' : 'it') + ' into GARMIN/APPS on the watch.', log.replace(/exit=0/g, '').trim());
          return;
        }
        say('Compiling ' + (i + 1) + ' of ' + results.length + ' (' + what + ') with Garmin’s compiler…', '');
        buildOne(results[i], format).then(function (j) {
          if (!j.ok) { finish(); say((j.message || 'Build failed.') + (many ? ' (' + results[i].name + ')' : ''), j.log || ''); return; }
          var bin = atob(j.prg), u = new Uint8Array(bin.length); for (var k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k);
          GW.download(new Blob([u], { type: 'application/octet-stream' }), j.name);
          done.push(j.name + ' (' + Math.round(u.length / 1024) + ' KB)'); log += (j.log || '') + '\n';
          setTimeout(function () { next(i + 1); }, 400); // let the browser start each download
        }).catch(function (e) { finish(); say('Build failed: ' + e.message); });
      })(0);
    }
    btn.addEventListener('click', function () { run('prg'); });
    iqBtn.addEventListener('click', function () { run('iq'); });
    setup.addEventListener('click', function () {
      setup.disabled = true; say('Setting up Garmin’s toolchain in the cloud… this takes a couple of minutes, keep this window open.', '');
      api('/api/setup', { method: 'POST' }).then(function (r) {
        var j = r.json || {}; setup.disabled = false;
        if (j.ok) { setup.style.display = 'none'; btn.disabled = false; iqBtn.disabled = false; say('Builder ready. Press the build button.', ''); }
        else say(j.message || 'Setup failed.', j.log || '');
      }).catch(function (e) { setup.disabled = false; say('Setup failed: ' + e.message); });
    });
    box.appendChild(h('div', { style: 'display:flex;align-items:center;flex-wrap:wrap;gap:8px' }, [btn, iqBtn, setup]));
    box.appendChild(msg); box.appendChild(logBox);
    api('/api/status').then(function (r) {
      if (!r.json) { box.style.display = 'none'; return; } // static hosting: no backend
      if (r.json.ready) { btn.disabled = false; iqBtn.disabled = false; say('Cloud builder ready: one click gives you the finished .prg for your watch, or an .iq for the Connect IQ developer portal.'); }
      else { setup.style.display = ''; say(r.json.message); }
    }).catch(function () { box.style.display = 'none'; });
    return box;
  }

  // The only place rotation shows up: upright, turned 30 degrees to the right, or both as separate watch faces.
  function rotationPicker(onChange) {
    var wrap = h('div', { class: 'f', style: 'margin:0 0 14px' });
    wrap.appendChild(h('label', { text: 'Rotation' }));
    wrap.appendChild(segCtl([['none', 'Upright'], ['r30', 'Rotated 30° to the right'], ['both', 'Both']], GW.rotChoice(GW.design), function (v) { GW.design.rotate = v; GW.history.commit(); onChange(); }));
    return wrap;
  }

  GW.openExport = function () {
    var body = h('div', {}, [h('p', { class: 'muted', text: 'Building your project…' })]);
    modal('Get it on your watch', body);
    if (GW.rotChoice(GW.design) === 'none') delete GW.design.rotate;
    function render() {
      GW.buildVariants(GW.design).then(function (results) {
        var first = results[0], many = results.length > 1;
        GW.history.commit();
        var zipName = (many ? GW.slug(GW.design.name) + '-versions' : first.name) + '-fenix6x.zip';
        var all = []; results.forEach(function (r) { r.files.forEach(function (f) { all.push({ path: r.name + '/' + f.path, data: f.data, exec: f.exec }); }); });
        var blob = GW.zip(all), nFiles = all.length;
        body.innerHTML = '';
        if (GW.rotatable(GW.design)) body.appendChild(rotationPicker(function () { body.innerHTML = ''; body.appendChild(h('p', { class: 'muted', text: 'Building your project…' })); render(); }));

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
          h('li', {}, [h('div', {}, [h('h5', { text: 'Copy to the watch' }), h('p', { html: 'Connect the watch by USB and copy the <span class="kbd">.prg</span> ' + (many ? 'files' : 'file') + ' into <span class="kbd">GARMIN/APPS</span>. Unplug, then on the watch: ' + (first.src.type === 'datafield' ? 'hold UP → Activities &amp; Apps → Run → settings → Data Screens → Add New → <b>1 field</b> → tap it → Connect IQ → pick it.' : 'hold UP → Watch Face → pick it.') })])])
        ]));
        body.appendChild(h('h4', { style: 'margin:20px 0 8px', class: 'muted small', text: 'GENERATED CODE' }));
        if (many) {
          vsel = h('select', { style: 'margin-bottom:8px;background:var(--panel);border:1px solid var(--line2);border-radius:4px;padding:5px 8px;color:inherit' },
            results.map(function (r, i) { return h('option', { value: i, text: r.name }); }));
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
        console.error(e); body.innerHTML = '';
        // never leave the dialog stuck on a rotation that cannot be built: fall back to upright
        if (GW.rotChoice(GW.design) !== 'none') { GW.design.rotate = 'none'; GW.history.commit(); body.appendChild(h('div', { class: 'note warn', text: 'The rotated version could not be built (' + e.message + '). Showing the upright one.' })); render(); return; }
        body.appendChild(h('div', { class: 'note warn', text: 'Export failed: ' + e.message }));
      });
    }
    render();
  };

  GW.saveFile = function () {
    var blob = new Blob([JSON.stringify(GW.serialize())], { type: 'application/json' });
    GW.download(blob, GW.slug(GW.design.name) + '.watchface.json');
  };
})(window.GW);
