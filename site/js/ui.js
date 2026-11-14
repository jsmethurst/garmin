/* UI: panels, inspector, layers, fonts, color picker, modals. */
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

  // ---------------------------------------------------------------- color picker
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
    var hex = h('input', { type: 'text', value: q || '', maxlength: 7, 'aria-label': 'Hex color', placeholder: '#rrggbb' });
    hex.addEventListener('change', function () {
      var v = hex.value.trim(); if (v[0] !== '#') v = '#' + v;
      if (/^#[0-9a-fA-F]{6}$/.test(v)) { cb(GW.q(v)); GW.closeColor(); }
    });
    pop.appendChild(grid);
    pop.appendChild(h('div', { class: 'hex' }, [hex].concat(opts.none ? [h('button', { class: 'btn sm', text: 'None', onclick: function () { cb(null); GW.closeColor(); } })] : [])));
    pop.appendChild(h('p', { text: 'Only these 64 colors exist on the fēnix 6X display; any hex is snapped to the nearest.' }));
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
    else if (tab === 'settings') renderSettingsTab(p);
    else if (tab === 'ref') GW.renderRefPanel(p);
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
    var fs = field(f.label, sel);
    return GW.modeOf() === 'watch' && ['text', 'arc', 'seggauge'].indexOf(el.type) >= 0 ? h('div', {}, [fs, slotButton(el)]) : fs;
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
        g2.appendChild(h('option', { value: have ? have.id : '__fam|' + fam.family + '|' + w, text: fam.family + ' ' + w + (fam.note ? ' (' + fam.note + ')' : '') }));
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
        GW.registerUploadedFont(family, fr.result, 400).then(function () {
          GW.assets[id] = { dataUrl: fr.result, font: true };
          var nf = { id: 'f_' + id, family: family, label: file.name.replace(/\.[^.]+$/, ''), weight: 400, px: el.fontSize || (cur && cur.px) || 22, glyphs: cur && cur.glyphs ? cur.glyphs : 'auto', spacing: 0, upload: true, asset: id };
          GW.design.fonts.push(nf); el[f.k] = nf.id; el.fontSize = null; fireChange(true); GW.toast('Font loaded: ' + nf.label);
        }).catch(function () { GW.toast('Could not read that font file.'); });
      };
      fr.readAsDataURL(file);
    });
    sel.addEventListener('change', function () {
      if (sel.value === '__up') { restore(); up.click(); return; }
      if (sel.value.indexOf('__fam|') === 0) {
        var parts = sel.value.split('|'), base = cur || { px: 22, glyphs: 'auto' };
        var nfont = { id: slugId(parts[1], parts[2]), family: parts[1], weight: Number(parts[2]), px: el.fontSize || base.px, glyphs: base.glyphs === 'nums' || base.glyphs === 'digits' ? base.glyphs : 'auto', spacing: 0 };
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
  // fattens a light typeface by outlining each glyph
  function fThicken(el) {
    var base = GW.customFont(el.font); if (!base) return null;
    var i = h('input', { type: 'number', min: 0, max: 8, step: 1, value: base.bold || 0 });
    i.addEventListener('input', function () { var v = parseInt(i.value); if (!isNaN(v)) { base.bold = Math.max(0, v); GW.touch(false); } });
    i.addEventListener('change', function () { fireChange(true); });
    return field('Thicken (px)', i);
  }
  function fTabular(el) {
    var base = GW.customFont(el.font); if (!base) return null;
    var c = h('input', { type: 'checkbox' }); c.checked = !!base.tabular;
    c.addEventListener('change', function () { base.tabular = c.checked; fireChange(true); });
    return h('label', { class: 'chk' }, [c, 'Even digit widths (the time never changes width)']);
  }
  function fUniform(el) {
    var base = GW.customFont(el.font); if (!base) return null;
    var c = h('input', { type: 'checkbox' }); c.checked = !!base.uniform;
    c.addEventListener('change', function () { base.uniform = c.checked; fireChange(true); });
    return h('label', { class: 'chk', title: 'Every glyph gets the same gap after it, so the spacing looks even (digits keep their own widths unless "even digit widths" is on)' }, [c, 'Uniform spacing between letters']);
  }
  // how the edges of the letters are blended: smooth, or snapped to the few steps the watch's 64-colour screen can show
  function fAa(el) {
    var base = GW.customFont(el.font); if (!base) return null;
    var s = h('select', {}, [h('option', { value: '', text: 'Smooth' }), h('option', { value: 'mip', text: 'Device-style (4 steps)' })]);
    s.value = base.aa || '';
    s.addEventListener('change', function () { base.aa = s.value || null; fireChange(true); });
    return field('Edges', s);
  }
  // the weight of an uploaded font FILE (a Light is 300): the browser then matches the face exactly instead of making one up
  function fWeight(el) {
    var base = GW.customFont(el.font); if (!base || !base.upload) return null;
    var s = h('select', {}, [100, 200, 300, 400, 500, 600, 700, 800, 900].map(function (w) { return h('option', { value: w, text: w + (w === 400 ? ' (Regular)' : (w === 300 ? ' (Light)' : (w === 200 ? ' (ExtraLight)' : (w === 700 ? ' (Bold)' : '')))) }); }));
    s.value = String(base.weight || 400);
    s.addEventListener('change', function () {
      base.weight = parseInt(s.value, 10);
      var a = GW.assets[base.asset];
      if (a && a.dataUrl) GW.registerUploadedFont(base.family, a.dataUrl, base.weight).then(function () { GW.touch(true); });
      fireChange(true);
    });
    return field('Weight of the uploaded file', s);
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

  // ---------------------------------------------------------------- watch settings (the wearer changes these on the phone)
  function settingOpt(v, t, sel) { var o = h('option', { value: v, text: t }); if (sel) o.selected = true; return o; }
  // Under a color: Fixed, or one of the face's color roles (Main, Highlight, ...). Picking Main or Highlight for the first time creates it.
  function withSetting(el, f, node) {
    if (!node || GW.modeOf() !== 'watch') return node;
    var cur = el.set && el.set[f.k], s = cur && GW.settings.find(cur);
    if (s) {   // a role: the swatch edits the role's color, which is what every user of the role shows (and what the watch starts with)
      var sw = h('button', { class: 'swatch', type: 'button' }, [h('i', { style: 'background:' + GW.q(s.def) }), h('span', { text: GW.q(s.def) })]);
      sw.addEventListener('click', function () { GW.pickColor(sw, s.def, function (c) { s.def = GW.q(c); GW.settings.applyDefault(s); fireChange(true); }); });
      node = field((f.label || 'Color') + ': “' + s.label + '” (shared)', sw);
    }
    var sel = h('select', { class: 'sel', title: 'Link this color to the face’s color scheme', 'aria-label': 'Color role for ' + (f.label || 'color') });
    sel.appendChild(settingOpt('', 'Fixed color', !s));
    var std = GW.settings.ROLE, have = {};
    ['main', 'hi'].forEach(function (k) { have[std[k][0]] = 1; sel.appendChild(settingOpt(std[k][0], '◐ ' + std[k][1], s && s.id === std[k][0])); });
    GW.settings.colors().forEach(function (c) { if (!have[c.id] && c.id !== 'cbg') sel.appendChild(settingOpt(c.id, '◐ ' + c.label, s && s.id === c.id)); });
    sel.appendChild(settingOpt('__new', '◐ New color role…'));
    sel.addEventListener('change', function () {
      var v = sel.value, was = el.set && el.set[f.k];
      if (v === '__new') { var ns = GW.settings.addColor(((el.name || '') + ' ' + (f.label || 'color')).trim().slice(0, 28), el[f.k]); v = ns.id; }
      else if (v === 'cmain' || v === 'chi') { var ex = GW.settings.find(v); if (!ex) GW.settings.ensureRole(v === 'cmain' ? 'main' : 'hi', el[f.k]); }
      if (v) { el.set = el.set || {}; el.set[f.k] = v; var st = GW.settings.find(v); if (st) el[f.k] = st.def; }
      else if (el.set) { delete el.set[f.k]; if (!Object.keys(el.set).length) delete el.set; }
      if (was && was !== v) { var ws = GW.settings.find(was); if (ws && !GW.settings.uses(was) && !ws.keep) GW.settings.remove(was); }
      fireChange(true);
    });
    var kids = [node, h('div', { class: 'f' }, [sel])];
    if (s) kids.push(h('p', { class: 'muted small', text: 'Everything linked to “' + s.label + '” shows one color. Set how the wearer changes it on the Settings tab. “Fixed color” makes this element independent again.' }));
    return h('div', {}, kids);
  }
  // Under a reading: put this layer into a data slot (its icon and label come along)
  function slotButton(el) {
    var s = el.srcSet && GW.settings.find(el.srcSet);
    if (s && s.kind !== 'source') s = null;
    if (!GW.settings.roleOf(el)) return null;
    if (s) return h('div', { class: 'f' }, [h('p', { class: 'muted small', text: '⚙ Part of the data slot “' + s.label + '”: the wearer can switch it between ' + s.choices.length + ' readings.' }),
      h('button', { class: 'btn sm', text: 'Edit on the Settings tab', onclick: function () { GW.setTab('settings'); } })]);
    return h('div', { class: 'f' }, [h('button', { class: 'btn sm', title: 'Let the wearer choose which reading this shows. A nearby icon and label switch with it.', text: '⚙ Let the wearer choose what this shows…', onclick: function () {
      var sl = GW.settings.newSlot(el.name || 'Data'), added = GW.settings.addMember(sl, el);
      GW.toast(added.length > 1 ? 'Data slot created with: ' + added.join(', ') : 'Data slot created.');
      GW.commit(true); GW.setTab('settings');
    } })]);
  }

  var FLEX = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:4px 0';
  // ---------------------------------------------------------------- Settings tab
  function sw3(hex, title, onPick) {
    var b = h('button', { class: 'swatch', type: 'button', title: title, style: 'width:auto;flex:0 0 auto' }, [h('i', { style: 'background:' + GW.q(hex) }), h('span', { text: GW.q(hex) })]);
    b.addEventListener('click', function () { GW.pickColor(b, hex, onPick); });
    return b;
  }
  function renderSettingsTab(p) {
    var d = GW.design;
    if (GW.modeOf() !== 'watch') { p.appendChild(h('p', { class: 'muted small', text: 'Settings the wearer can change are available for watch faces.' })); return; }
    GW.settings.prune(d);
    p.appendChild(h('p', { class: 'muted small', text: 'What the person wearing the face can change in the Garmin phone app, without rebuilding it. Preview shows the starting look.' }));

    // ----- colors -----
    p.appendChild(h('h4', { text: 'Colors' }));
    var roles = GW.settings.colors(), mode = GW.settings.mode(d);
    if (!roles.length) {
      p.appendChild(h('p', { class: 'muted small', text: 'Give the face a color scheme: a Background, a Main color and a Highlight color. Everything with that color follows it, and the wearer can swap the whole scheme in one tap.' }));
      p.appendChild(h('button', { class: 'btn primary', text: '✨ Set up colors from this face', onclick: function () {
        var r = GW.settings.detect(d); GW.toast(r.main ? 'Main color and Highlight color found from what the face uses.' : 'Background added; link other colors from the Inspector.'); GW.commit(true); GW.renderPanel();
      } }));
    } else {
      p.appendChild(field('The wearer can change colors', segCtl([['none', 'Not at all'], ['theme', 'Pick a color theme'], ['each', 'Pick each color']], mode, function (v) { d.colorMode = v; if (v === 'theme') GW.settings.ensureTheme(d); GW.commit(false); GW.renderPanel(); })));
      roles.forEach(function (r) {
        var nm = h('input', { type: 'text', value: r.label, maxlength: 24, 'aria-label': 'Color name', style: 'flex:1;min-width:110px' });
        nm.addEventListener('input', function () { r.label = nm.value; });
        nm.addEventListener('change', function () { GW.commit(false); });
        var row = [nm, sw3(r.def, 'Starting color', function (c) { r.def = GW.q(c); GW.settings.applyDefault(r); GW.commit(true); GW.renderPanel(); }),
          h('span', { class: 'muted small', text: GW.settings.uses(r.id) + ' use' + (GW.settings.uses(r.id) === 1 ? '' : 's') })];
        if (r.id === 'cbg') { /* the background role stays */ } else row.push(h('button', { class: 'btn sm danger', text: '×', title: 'Remove this color role', onclick: function () { r.keep = false; GW.settings.remove(r.id); GW.commit(true); GW.renderPanel(); } }));
        p.appendChild(h('div', { style: FLEX }, row));
      });
      p.appendChild(h('div', { class: 'row' }, [
        h('button', { class: 'btn sm', text: '✨ Re-detect from the face', title: 'Find the main and highlight colors again from what the face uses', onclick: function () { GW.settings.detect(d); GW.commit(true); GW.renderPanel(); } }),
        h('button', { class: 'btn sm', text: '+ Add a color', onclick: function () { GW.settings.addColor(null, '#ffffff'); GW.commit(false); GW.renderPanel(); } })
      ]));
      if (mode === 'theme') {
        var th = GW.settings.ensureTheme(d);
        p.appendChild(h('h4', { text: 'Color themes the wearer can pick' }));
        var head = h('div', { style: FLEX }, [h('span', { class: 'muted small', style: 'width:96px', text: 'Original' })]);
        roles.forEach(function (r) { head.appendChild(h('span', { class: 'swatch', title: r.label + ' (starting color)', style: 'width:36px;flex:0 0 auto' }, [h('i', { style: 'background:' + GW.q(r.def) })])); });
        head.appendChild(h('span', { class: 'muted small', text: 'as designed' }));
        p.appendChild(head);
        th.themes.forEach(function (t, i) {
          var nm = h('input', { type: 'text', value: t.name, maxlength: 20, style: 'width:96px;flex:0 0 auto', 'aria-label': 'Theme name' });
          nm.addEventListener('input', function () { t.name = nm.value; }); nm.addEventListener('change', function () { GW.commit(false); });
          var row = [nm];
          roles.forEach(function (r) {
            var cur = GW.settings.themeColor(t, r), b = h('button', { class: 'swatch', type: 'button', title: r.label, style: 'width:36px;flex:0 0 auto' }, [h('i', { style: 'background:' + cur })]);
            b.addEventListener('click', function () { GW.pickColor(b, cur, function (c) { t.colors[r.id] = GW.q(c); GW.commit(false); GW.renderPanel(); }); });
            row.push(b);
          });
          row.push(h('button', { class: 'btn sm', text: 'Preview', title: 'Show this theme on the face (sets the starting colors)', onclick: function () {
            roles.forEach(function (r) { r.def = GW.settings.themeColor(t, r); GW.settings.applyDefault(r); }); GW.commit(true); GW.renderPanel(); } }));
          row.push(h('button', { class: 'btn sm danger', text: '×', onclick: function () { th.themes.splice(i, 1); GW.commit(false); GW.renderPanel(); } }));
          p.appendChild(h('div', { style: FLEX }, row));
        });
        var lib = h('select', { class: 'sel', 'aria-label': 'Add a ready-made theme' });
        lib.appendChild(settingOpt('', '+ Add a ready-made theme…'));
        GW.THEME_LIBRARY.forEach(function (t, i) { lib.appendChild(settingOpt(String(i), t[0])); });
        lib.appendChild(settingOpt('blank', '+ Blank (copy of the starting colors)'));
        lib.addEventListener('change', function () { if (!lib.value) return; if (lib.value === 'blank') GW.settings.addBlankTheme(d); else GW.settings.addLibraryTheme(GW.THEME_LIBRARY[+lib.value], d); GW.commit(false); GW.renderPanel(); });
        p.appendChild(h('div', { class: 'f' }, [lib]));
        if (!th.themes.length) p.appendChild(h('p', { class: 'muted small', text: 'Add at least one theme, otherwise the wearer has nothing to choose.' }));
      }
    }

    // ----- data slots -----
    p.appendChild(h('h4', { text: 'Data the wearer can choose' }));
    var slots = GW.settings.slots(d);
    if (!slots.length) p.appendChild(h('p', { class: 'muted small', text: 'Select a reading on the face and press “Let the wearer choose what this shows…” in the Inspector. Its icon and label next to it switch with it.' }));
    slots.forEach(function (s) { renderSlot(p, s, d); });
    p.appendChild(h('button', { class: 'btn sm', text: '+ New data slot', onclick: function () { GW.settings.newSlot(null, d); GW.commit(true); GW.renderPanel(); } }));
  }
  function renderSlot(p, s, d) {
    var box = h('div', { class: 'f', style: 'border:1px solid var(--line2);border-radius:8px;padding:8px;margin:8px 0' });
    var nm = h('input', { type: 'text', value: s.label, maxlength: 30, 'aria-label': 'Name in the phone app', style: 'flex:1' });
    nm.addEventListener('input', function () { s.label = nm.value; }); nm.addEventListener('change', function () { GW.commit(false); });
    box.appendChild(h('div', { style: FLEX }, [nm,
      h('button', { class: 'btn sm danger', text: 'Delete', title: 'Remove this data slot (the layers stay as they are)', onclick: function () { GW.settings.remove(s.id); GW.commit(true); GW.renderPanel(); } })]));
    // layers that switch together
    box.appendChild(h('div', { class: 'muted small', style: 'margin-top:6px', text: 'Layers that switch together' }));
    var ms = GW.settings.members(s.id, d);
    if (!ms.length) box.appendChild(h('p', { class: 'muted small', text: 'None yet: add the reading, its icon and its label below.' }));
    var ROLE = { value: 'value', label: 'label', icon: 'icon', gauge: 'gauge' };
    ms.forEach(function (e) {
      box.appendChild(h('div', { style: FLEX }, [
        h('span', { class: 'muted small', style: 'min-width:44px', text: ROLE[GW.settings.roleOf(e)] }), h('span', { text: e.name || e.type, style: 'flex:1' }),
        h('button', { class: 'btn sm', text: '×', title: 'Take this layer out of the slot', onclick: function () { GW.settings.removeMember(s, e); GW.commit(true); GW.renderPanel(); } })]));
    });
    var addSel = h('select', { class: 'sel', 'aria-label': 'Add a layer to this slot' });
    addSel.appendChild(settingOpt('', '+ Add a layer…'));
    d.elements.forEach(function (e) { if (!e.srcSet && GW.settings.roleOf(e)) addSel.appendChild(settingOpt(e.id, (e.name || e.type) + ' (' + GW.settings.roleOf(e) + ')')); });
    addSel.addEventListener('change', function () {
      var e = GW.findEl(addSel.value); if (!e) return;
      var added = GW.settings.addMember(s, e); if (added.length > 1) GW.toast('Added: ' + added.join(', '));
      GW.commit(true); GW.renderPanel();
    });
    box.appendChild(addSel);
    // readings
    box.appendChild(h('div', { class: 'muted small', style: 'margin-top:8px', text: 'Readings the wearer can pick (' + s.choices.length + ')' }));
    if (s.choices.length < 2) box.appendChild(h('p', { class: 'muted small', text: 'Pick at least two.' }));
    var start = s.choices.length ? GW.settings.startChoice(s, d) : null, hasLab = ms.some(function (e) { return GW.settings.roleOf(e) === 'label'; }), hasVal = ms.some(function (e) { return GW.settings.roleOf(e) === 'value'; });
    s.choices.forEach(function (c) {
      var row = [h('span', { style: 'flex:1;min-width:80px', text: (GW.sources[c] || { label: c }).label + (c === start ? ' ●' : '') })];
      if (hasLab) {
        var li = h('input', { type: 'text', value: GW.settings.labelOf(s, c, d), maxlength: 12, style: 'width:64px', title: 'Label text for this reading', 'aria-label': 'Label for ' + c });
        li.addEventListener('change', function () { GW.settings.setLabel(s, c, li.value, d); GW.commit(true); });
        row.push(li);
      }
      if (hasVal) {
        var si = h('input', { type: 'text', value: GW.settings.suffixOf(s, c, d), maxlength: 6, style: 'width:44px', title: 'Text after the value (a unit)', placeholder: 'unit', 'aria-label': 'Unit for ' + c });
        si.addEventListener('change', function () { GW.settings.setSuffix(s, c, si.value, d); GW.commit(true); });
        row.push(si);
      }
      row.push(h('button', { class: 'btn sm', text: c === start ? 'Showing' : 'Show', disabled: c === start, title: 'Show this reading on the face (it becomes the starting reading)', onclick: function () { GW.settings.applyChoice(s, c, d); GW.commit(true); GW.renderPanel(); } }));
      row.push(h('button', { class: 'btn sm', text: '×', disabled: c === start, title: c === start ? 'The reading shown now cannot be removed' : 'Remove', onclick: function () { GW.settings.removeChoice(s, c); GW.commit(true); GW.renderPanel(); } }));
      box.appendChild(h('div', { style: FLEX }, row));
    });
    var pool = h('select', { class: 'sel', 'aria-label': 'Add a reading' });
    pool.appendChild(settingOpt('', '+ Add a reading…'));
    GW.sourceGroups.forEach(function (g) {
      var og = h('optgroup', { label: g }), n = 0;
      GW.sourceList.filter(function (x) { return x.group === g && s.choices.indexOf(x.id) < 0 && x.id !== 'custom'; }).forEach(function (x) { og.appendChild(h('option', { value: x.id, text: x.label })); n++; });
      if (n) pool.appendChild(og);
    });
    pool.addEventListener('change', function () { if (!pool.value) return; GW.settings.addChoice(s, pool.value); GW.commit(true); GW.renderPanel(); });
    box.appendChild(pool);
    p.appendChild(box);
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
    var seg = segCtl([['auto', 'Auto'], ['none', 'None'], ['custom', 'Color']], mode, function (v) {
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
      case 'iconpick': {
        var grid = h('div', { class: 'mdigrid' });
        Object.keys(GW.MDI).forEach(function (k) {
          var b = h('button', { type: 'button', title: GW.MDI[k].label + ' (' + k + ')', text: String.fromCharCode(GW.MDI[k].cp), class: k === el.kind ? 'on' : '' });
          b.addEventListener('click', function () { el.kind = k; if (/^(Icon|.* icon)$/.test(el.name || '')) el.name = GW.MDI[k].label + ' icon'; fireChange(true); });
          grid.appendChild(b);
        });
        return h('div', { class: 'f' }, [h('label', { text: 'Icon: ' + ((GW.MDI[el.kind] || {}).label || '') }), grid]);
      }
      case 'iconpreview': {   // the very glyph image that goes into the watch font, at its real size and enlarged without smoothing
        var s0 = el.size || 20, cv = h('canvas', { width: s0 * 2 + 8, height: s0 }), cx = cv.getContext('2d');
        GW.fontsReady().then(function () {
          cx.fillStyle = '#000'; cx.fillRect(0, 0, cv.width, cv.height);
          var pl = GW.iconPlace(Object.assign({}, el, { x: s0 / 2 + 2, y: s0 / 2 })); if (!pl) return;
          GW.drawText(cx, pl.fid, pl.ch, pl.x, pl.yc, 'L', GW.q(el.color));
        });
        cv.style.cssText = 'width:' + (s0 * 2 + 8) * 4 + 'px;height:' + s0 * 4 + 'px;image-rendering:pixelated;background:#000;border:1px solid var(--line2);border-radius:4px;display:block';
        return h('div', { class: 'f' }, [h('label', { text: 'Crispness at ' + s0 + ' px (enlarged 4×)' }), cv]);
      }
      case 'fontsizes': {
        var ns = GW.fontSizesUsed(el); if (!ns) return null;
        return h('p', { class: 'muted small', text: ns + (ns === 1 ? ' size' : ' sizes') + ' of this typeface in the design. Every size is a separate font in watch memory; reuse sizes where you can (sizes 1 px apart are merged automatically).' });
      }
      case 'spacing': return fSpacing(el);
      case 'thicken': return fThicken(el);
      case 'tabular': return fTabular(el);
      case 'uniform': return fUniform(el);
      case 'aa': return fAa(el);
      case 'weight': return fWeight(el);
      case 'color': return withSetting(el, f, fColor(el, f));
      case 'optcolor': return withSetting(el, f, fOptColor(el, f));
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
    if (el.type === 'text' && GW.ICON_FOR && GW.ICONS[GW.ICON_FOR[el.source]]) {
      p.appendChild(h('button', { class: 'btn sm', text: 'Add matching icon', onclick: function () {
        var b = GW.elBox(el), sz = 16;
        GW.ICON_SIZES.forEach(function (v) { if (v <= b.h + 4) sz = v; });
        var gap = 4, cy = Math.round(b.y + b.h / 2), cx = Math.round(b.x - gap - sz / 2);
        GW.addElement('icon', { name: GW.ICONS[GW.ICON_FOR[el.source]].label + ' icon', kind: GW.ICON_FOR[el.source], size: sz, x: cx, y: cy, color: el.color });
      } }));
    }
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
    if (GW.design.kind === 'datafield') el.slot = GW.design.dfSlot || 0;   // a cell belongs to the field it was added to
    GW.design.elements.push(el); GW.selId = el.id;
    GW.setTab('inspect'); GW.commit(true); GW.emit('select', el.id);
    return el;
  };
  GW.loadImageFile = loadImageFile;
  GW.ui = { h: h, field: field, modal: modal, closeModal: closeModal, segCtl: segCtl };
  // quick add: every data source, grouped (same groups as the "Shows" menu)
  function dfQuickList() {
    return GW.DF_GROUPS.map(function (g) {
      return [g, GW.DF_SOURCES.filter(function (x) { return x[3] === g && x[0] !== 'none'; })];
    }).filter(function (x) { return x[1].length; });
  }
  GW.renderAdd = function () {
    var chips = $('quickChips'); chips.innerHTML = '';
    if (GW.modeOf() === 'field') {
      dfQuickList().forEach(function (grp) {
        chips.appendChild(h('div', { class: 'muted small', style: 'width:100%;margin:8px 0 2px', text: grp[0] }));
        grp[1].forEach(function (s) {
          chips.appendChild(h('button', { class: 'chip', text: s[2], onclick: function () {
            // the new cell snaps into the chosen slot and fills it, so a heart-rate color covers the whole field
            var sl = GW.dfSlot(GW.design), ft = fitFonts(sl.w, sl.h);
            GW.addElement('dfcell', { name: s[2], src: s[0], label: s[2].toUpperCase(), vfont: ft.v, lfont: ft.l, dx: ft.dx, dy: ft.dy, bT: ft.e.bT, bB: ft.e.bB, bL: ft.e.bL, bR: ft.e.bR, zone: s[0] === 'hr', x: 0, y: 0, w: sl.w, h: sl.h });
          } }));
        });
      });
      var gf = $('addGrid'); gf.innerHTML = '';
      ['dfcell', 'shape'].forEach(function (k) {
        gf.appendChild(h('button', { class: 'addbtn', onclick: function () { GW.addElement(k, k === 'shape' ? { name: 'Divider', kind: 'line', x: Math.round(GW.SIZE * 20 / 280), y: GW.SIZE / 2, x2: Math.round(GW.SIZE * 260 / 280), y2: GW.SIZE / 2, color: '#aaaaaa', pen: 1 } : (function () { var sl = GW.dfSlot(GW.design), ft = fitFonts(sl.w, sl.h); return { name: 'Data cell', src: 'timer', vfont: ft.v, lfont: ft.l, dx: ft.dx, dy: ft.dy, bT: ft.e.bT, bB: ft.e.bB, bL: ft.e.bL, bR: ft.e.bR, x: 0, y: 0, w: sl.w, h: sl.h }; })()); } }, [h('i', { text: T[k].icon }), k === 'shape' ? 'Line / box' : 'Data cell']));
      });
      return;
    }
    QUICK.forEach(function (q) {
      chips.appendChild(h('button', { class: 'chip', text: q.l, onclick: function () {
        var o = { name: q.l, source: q.s, font: q.f, y: Math.round(q.y * GW.SIZE / 280), color: q.c || '#ffffff', upper: !!q.up, suffix: q.suffix || '' };
        if (q.s === 'custom') o.text = 'Hello';
        GW.addElement('text', o);
      } }));
    });
    var g = $('addGrid'); g.innerHTML = '';
    ['text', 'arc', 'hands', 'ticks', 'shape', 'hexgrid', 'image', 'barchart', 'movebar', 'moon', 'binary', 'wxicon', 'worldmap', 'sunicon', 'sunmark', 'icon', 'seggauge'].forEach(function (k) {
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

  // Which activity-screen layout and which slot of it this field is designed for (sizes are the SDK's own for the fēnix 6X Pro)
  function slotPicker(d) {
    var lay = GW.DF_LAYOUTS, li = lay[d.dfLayout] ? d.dfLayout : 0, L = lay[li], si = L.slots[d.dfSlot] ? d.dfSlot : 0;
    var sel = h('select', {}, lay.map(function (l, i) { return h('option', { value: i, text: l.name }); }));
    sel.value = li;
    sel.addEventListener('change', function () { d.dfLayout = parseInt(sel.value, 10); d.dfSlot = 0; GW.applyEdges(d); GW.commit(true); });
    var used = {}; d.elements.forEach(function (e) { if (e.type === 'dfcell') used[GW.elSlot(e, d)] = 1; });
    var svg = '<svg viewBox="0 0 ' + GW.SIZE + ' ' + GW.SIZE + '" width="150" height="150" style="display:block;margin:6px 0 0"><defs><clipPath id="sc"><circle cx="' + GW.SIZE / 2 + '" cy="' + GW.SIZE / 2 + '" r="' + (GW.SIZE / 2 - 1) + '"/></clipPath></defs><g clip-path="url(#sc)">' +
      L.slots.map(function (r, i) { return '<rect data-i="' + i + '" x="' + r[0] + '" y="' + r[1] + '" width="' + r[2] + '" height="' + r[3] + '" fill="' + (i === si ? '#c2410c' : (used[i] ? '#e7c9b0' : '#f7f6f2')) + '" stroke="#6b6860" stroke-width="2" style="cursor:pointer"/>'; }).join('') +
      '</g><circle cx="' + GW.SIZE / 2 + '" cy="' + GW.SIZE / 2 + '" r="' + (GW.SIZE / 2 - 1) + '" fill="none" stroke="#1d1d1b" stroke-width="3"/></svg>';
    var box = h('div', { html: svg });
    Array.prototype.forEach.call(box.querySelectorAll('rect'), function (r) { r.addEventListener('click', function () { d.dfSlot = parseInt(r.getAttribute('data-i'), 10); GW.commit(true); }); });
    var sl = L.slots[si];
    return h('div', { class: 'f' }, [sel, box, h('div', { class: 'muted small', text: 'Field ' + (si + 1) + ' of ' + L.slots.length + ' · ' + sl[2] + ' × ' + sl[3] + ' px' })]);
  }
  // the "Screen layout" card in the left column (data fields only)
  GW.renderSlotCard = function () {
    var card = $('slotCard'); if (!card) return;
    card.innerHTML = '';
    if (GW.modeOf() !== 'field') return;
    var d = GW.design;
    card.appendChild(h('h3', { text: 'Screen layout' }));
    card.appendChild(slotPicker(d));
    GW.renderFieldSettings();
  };
  // the "Field settings" card in the right column: rotation, screen colors, units
  GW.renderFieldSettings = function () {
    var card = $('fieldSettings'); if (!card) return;
    card.innerHTML = '';
    if (GW.modeOf() !== 'field') return;
    var d = GW.design;
    card.appendChild(h('h3', { text: 'Screen settings' }));
    var rest = h('div', { style: 'display:flex;flex-direction:column;gap:10px' });
    if (GW.DF_LAYOUTS[d.dfLayout] && GW.DF_LAYOUTS[d.dfLayout].slots.length > 1)
      rest.appendChild(field('Fields', segCtl([['sep', 'Separate (Garmin layout)'], ['free', 'Free (one full-screen field)']], GW.dfFree(d) ? 'free' : 'sep', function (v) { d.dfFree = v === 'free'; GW.commit(true); })));
    rest.appendChild(rotationField(d));
    rest.appendChild(field('Screen colors', segCtl([['light', 'Light'], ['auto', 'Match watch'], ['dark', 'Dark']], d.dfTheme || 'light', function (v) { d.dfTheme = v; GW.commit(true); })));
    rest.appendChild(field('Units', segCtl([['watch', 'Match watch'], ['metric', 'Metric'], ['imperial', 'Imperial']], d.dfUnits || 'watch', function (v) { d.dfUnits = v; GW.commit(true); })));
    card.appendChild(rest);
  };
  // Fonts and sideways shift for a data cell that fills a slot: the biggest number font that still fits the part of the slot
  // that is visible on the round screen, with the text centred on that visible part.
  function fitFonts(w, h) {
    var ft = fitFonts0(w, h), sl = GW.dfSlot(GW.design);
    // 8 fields: the side-by-side cells sit against the curve of the bezel, so nudge their text inwards
    if (sl.layout.id === '8fields' && sl.w < GW.SIZE) { ft = Object.assign({}, ft, { dx: sl.x === 0 ? 7 : -7, dy: 2 }); }
    return Object.assign({}, ft, { e: GW.dfEdges(GW.design, GW.design.dfSlot || 0) });   // the layout's dividing lines for this field
  }
  function fitFonts0(w, h) {
    var sl = GW.dfSlot(GW.design), R = GW.SIZE * 0.45, nums = GW.SYS_FONTS.filter(function (f) { return f[2] === 'n'; }).map(function (f) { return f[0]; });
    var labs = h >= 100 ? ['FONT_TINY', 'FONT_XTINY'] : ['FONT_XTINY'];
    function visible(y) {   // visible x-range of the slot on row y (design coordinates are slot-relative)
      var dy = sl.y + y - GW.SIZE / 2, half = Math.sqrt(Math.max(0, R * R - dy * dy));
      return [Math.max(sl.x, GW.SIZE / 2 - half) - sl.x, Math.min(sl.x + w, GW.SIZE / 2 + half) - sl.x];
    }
    var best = null, smallest = null;
    labs.forEach(function (lab) {
      nums.forEach(function (n) {
        var el = { x: 0, y: 0, w: w, h: h, src: 'timer', label: 'HEART RATE', labelPos: 'above', lfont: lab, vfont: n };
        var L = GW.dfRows(el), a = visible(L.ly), b = visible(L.vy), lo = Math.max(a[0], b[0]), hi = Math.min(a[1], b[1]);
        var vh = GW.sysFont(n).box, lh = GW.sysFont(lab).box;
        var fits = lh + 3 + vh + 10 <= h && vh * 0.55 * 4 <= hi - lo - 8 && lh * 0.6 * 10 <= hi - lo - 8;
        var cand = { v: n, l: lab, vh: vh, dx: Math.round((lo + hi) / 2 - w / 2) };
        if (fits && (!best || vh > best.vh)) best = cand;
        if (!smallest) smallest = cand;
      });
    });
    return best || smallest;
  }

  // ---------------------------------------------------------------- data field settings

  // ---------------------------------------------------------------- face tab
  function renderFace(p) {
    var d = GW.design;
    var bg = h('button', { class: 'swatch', type: 'button' }, [h('i', { style: 'background:' + GW.q(d.bg) }), h('span', { text: GW.q(d.bg) })]);
    bg.addEventListener('click', function () { GW.pickColor(bg, d.bg, function (c) { d.bg = c; GW.commit(true); }); });
    if (d.s34 && GW.SEG34_THEMES) {   // Segment34 faces: the original's colour schemes and some more
      var sel = h('select', { class: 'sel' });
      GW.SEG34_THEMES.forEach(function (t) { var o = h('option', { value: String(t.id), text: t.name }); if (t.id === d.s34.theme) o.selected = true; sel.appendChild(o); });
      sel.addEventListener('change', function () { GW.s34Apply(d, +sel.value); GW.commit(true); GW.renderPanel(); });
      p.appendChild(field('Colour scheme', sel));
      if (d.s34.set === 'mk2') p.appendChild(field('Clock style', segCtl([['34', '34 segments'], ['17', '17 segments (blockier)']], String(d.s34.clock || 34), function (v) { GW.s34Clock(d, +v); GW.commit(true); GW.fontsReady && GW.fontsReady(); })));
    }
    p.appendChild(field('Background color', bg));
    p.appendChild(rotationField(d));
    // where sunrise / sunset and the world map put you until the watch has a position of its own
    p.appendChild(h('h4', { text: 'Default location' }));
    var dl = h('input', { type: 'checkbox' }); dl.checked = d.defLocOn !== false;
    dl.addEventListener('change', function () { d.defLocOn = dl.checked; GW.commit(true); });
    p.appendChild(h('div', { class: 'f' }, [h('label', { class: 'chk' }, [dl, 'Use a default location until the watch has one']),
      h('p', { class: 'muted small', text: 'Sunrise, sunset and the world map use the phone\'s weather location or a GPS fix when there is one.' })]));
    if (d.defLocOn !== false) {
      var la = h('input', { type: 'number', step: '0.01', min: -90, max: 90, value: typeof d.defLat === 'number' ? d.defLat : 41.01 });
      var lo = h('input', { type: 'number', step: '0.01', min: -180, max: 180, value: typeof d.defLon === 'number' ? d.defLon : 28.98 });
      la.addEventListener('change', function () { d.defLat = parseFloat(la.value); GW.commit(false); });
      lo.addEventListener('change', function () { d.defLon = parseFloat(lo.value); GW.commit(false); });
      p.appendChild(h('div', { class: 'row' }, [field('Latitude', la), field('Longitude', lo)]));
    }
    var dbg = h('input', { type: 'checkbox' }); dbg.checked = !!d.debug;
    dbg.addEventListener('change', function () { d.debug = dbg.checked; GW.commit(false); });
    var bt = h('input', { type: 'checkbox' }); bt.checked = !!d.buildTag;
    bt.addEventListener('change', function () { d.buildTag = bt.checked; GW.commit(false); });
    p.appendChild(h('h4', { text: 'Debug' }));
    p.appendChild(h('div', { class: 'f' }, [h('label', { class: 'chk' }, [bt, 'Show build code on the face (tiny grey number, bottom)']),
      h('p', { class: 'muted small', text: 'Shows the build date (yymmddhhmm) on the watch so you can tell which version is installed.' })]));
    p.appendChild(h('div', { class: 'f' }, [h('label', { class: 'chk' }, [dbg, 'Debug export: print the bar-chart values to the simulator console']),
      h('p', { class: 'muted small', text: 'Adds System.println lines (the eight values, and any reading that failed). Leave it off for the version you install.' })]));
    var file = h('input', { type: 'file', accept: 'image/*', hidden: true });
    file.addEventListener('change', function () {
      if (!file.files[0]) return;
      loadImageFile(file.files[0], function (id) { d.bgImage = id; GW.commit(true); });
    });
    p.appendChild(h('div', { class: 'f' }, [h('label', { text: 'Background image (optional)' }),
      h('div', { class: 'dropzone', onclick: function () { file.click(); }, text: d.bgImage ? 'Replace image…' : 'Choose a ' + GW.SIZE + '×' + GW.SIZE + ' image…' }), file,
      d.bgImage ? h('button', { class: 'btn sm', text: 'Remove background image', onclick: function () { d.bgImage = null; GW.commit(true); } }) : null]));
    p.appendChild(h('h4', { text: 'Start over' }));
    p.appendChild(h('div', { class: 'row' }, [
      h('button', { class: 'btn', text: 'Layouts…', onclick: function () { GW.openPresets(); } }),
      h('button', { class: 'btn danger', text: 'Clear all', onclick: function () {
        GW.design.elements = []; GW.selId = null; GW.commit(true); GW.emit('select', null); GW.toast('Cleared. Ctrl+Z to undo.');
      } })
    ]));
  }

  // ---------------------------------------------------------------- fonts tab
  // ---------------------------------------------------------------- sim tab
  var SIMVARS = [
    ['steps', 'Steps', 0, 30000, 50], ['stepGoal', 'Step goal', 2000, 30000, 500], ['calories', 'Calories', 0, 4000, 10], ['calGoal', 'Calorie goal', 500, 5000, 50], ['floors', 'Floors', 0, 40, 1],
    ['intMins', 'Intensity min (week)', 0, 400, 5], ['distance', 'Distance (km)', 0, 40, 0.1], ['hr', 'Heart rate', 35, 200, 1], ['bodyBat', 'Body Battery', 0, 100, 1],
    ['stress', 'Stress', 0, 100, 1], ['spo2', 'SpO2 %', 80, 100, 1], ['resp', 'Respiration', 4, 40, 1], ['battery', 'Battery %', 0, 100, 1], ['batteryDays', 'Battery days', 0, 14, 0.1],
    ['notif', 'Notifications', 0, 20, 1], ['temp', 'Temperature °C', -20, 45, 1], ['altitude', 'Altitude m', -50, 4000, 10], ['moveBar', 'Move bar', 0, 5, 1],
    
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

  // what a compiled .prg could and could not be turned into
  function importReport(name, r) {
    var li = [];
    li.push(h('li', { text: r.texts + ' text elements, ' + r.arcs + ' arcs' + (GW.design.bgImage ? ', and the background picture' : '') + ' were recreated.' }));
    li.push(h('li', { text: 'The typefaces are the closest bundled ones: the file\'s own bitmap fonts cannot be copied, so sizes and look will differ a little.' }));
    r.notes.forEach(function (n) { li.push(h('li', { text: n })); });
    r.skipped.forEach(function (s) { li.push(h('li', { class: 'muted', text: 'Not imported: ' + s })); });
    modal('Opened ' + name, h('div', {}, [
      h('p', { text: 'This file was not made here, so it holds only the compiled drawing program. I read that program and rebuilt what I could from it. Treat it as a starting point and compare it with the real face.' }),
      h('ul', { style: 'line-height:1.5' }, li)]));
  }
  GW.openPresets = function () {
    GW.layouts.refresh(function (changed) { if (changed && $('modalRoot') && $('modalRoot').querySelector('.presets')) GW.openPresets(); });   // someone may have saved since this page opened
    var grid = h('div', { class: 'presets' });
    var kind = GW.modeOf(), fld = kind === 'field', hidden = GW.layouts.hidden(kind);
    function load(fn) { fn(function () { GW.fontsReady().then(function () { GW.touch(true); closeModal(); GW.history.commit(); }); }); }
    // every layout, built-in or saved, can be removed from the list (after a confirmation)
    function card(thumb, name, saved, onload, onremove, removeMsg) {
      var kids = [thumb, h('b', { text: name })];
      if (saved) kids.push(h('span', { class: 'muted small', text: GW.layouts.shared() ? 'shared' : 'saved' }));
      var c = h('button', { class: 'pcard', onclick: function () { load(onload); GW.toast(name + ' loaded. Ctrl+Z undoes it.'); } }, kids);
      return h('div', { class: 'pwrap' }, [c, h('button', { class: 'pdel', title: 'Delete this layout', 'aria-label': 'Delete ' + name, text: '×', onclick: function () {
        if (window.confirm(removeMsg)) { onremove(); GW.openPresets(); }
      } })]);
    }
    function blankThumb(color) { var c = document.createElement('canvas'); c.width = c.height = 120; var x = c.getContext('2d'); x.fillStyle = color; x.fillRect(0, 0, 120, 120); c.style.width = c.style.height = '120px'; return c; }
    var shown = {};
    if (GW.layouts.shared()) {
      // the library is the only list: built-in layouts are in it like any other, and everyone edits the same copy
      var order = {}; GW.PRESETS.forEach(function (p, k) { order[p.name.toLowerCase()] = k; });
      GW.layouts.all().filter(function (l) { return l.kind === kind; }).sort(function (a, b) {
        var oa = order[a.name.toLowerCase()], ob = order[b.name.toLowerCase()];
        return (oa == null ? 1e6 - a.ts / 1e9 : oa) - (ob == null ? 1e6 - b.ts / 1e9 : ob);
      }).forEach(function (l) {
        var blank = /^blank/i.test(l.name) && !(l.data.design.elements || []).length;
        grid.appendChild(card(blank ? blankThumb(fld ? '#fff' : '#000') : GW.thumb(l.data.design, 140), l.name, false, function (done) { GW.openLayout(l, done); },
          function () { GW.layouts.remove(l.name, kind); }, 'Delete “' + l.name + '” for everyone? Nobody will have it afterwards.'));
      });
    } else {
      GW.PRESETS.forEach(function (p) {
        if ((p.kind === 'datafield') !== fld) return;
        var key = p.name.toLowerCase(), saved = GW.layouts.find(p.name, kind);
        if (saved) shown[key] = 1;
        if (!saved && hidden.indexOf(key) >= 0) return;
        var thumb = p.id === 'blank' || p.id === 'blankfield' ? blankThumb(p.id === 'blank' ? '#000' : '#fff') : GW.thumb(saved ? saved.data.design : Object.assign(p.build(), { size: 280 }), 140);
        grid.appendChild(card(thumb, p.name, !!saved, function (done) { GW.applyPreset(p.id, done); }, function () {
          if (saved) GW.layouts.remove(p.name, kind); else GW.layouts.hide(p.name, kind);
          if (saved) GW.layouts.hide(p.name, kind);
        }, 'Delete the layout “' + p.name + '”?' + (saved ? (GW.layouts.shared() ? ' The shared version goes too, for everyone.' : ' Your saved version goes too.') : '')));
      });
      GW.layouts.all().forEach(function (l) {
        if (l.kind !== kind || shown[l.name.toLowerCase()]) return;
        grid.appendChild(card(GW.thumb(l.data.design, 140), l.name, true, function (done) { GW.loadFrom(GW.clone(l.data), done); },
          function () { GW.layouts.remove(l.name, kind); }, (GW.layouts.shared() ? 'Delete the shared layout “' + l.name + '”? It disappears for everyone.' : 'Delete your saved layout “' + l.name + '”?')));
      });
    }
    var kids = [grid];
    if (GW.layouts.shared()) {
      var missing = GW.PRESETS.filter(function (p) { return ((p.kind === 'datafield') === fld) && !GW.layouts.find(p.name, kind); });
      if (missing.length) kids.push(h('p', {}, [h('button', { class: 'btn sm', text: 'Put back the original layouts that are missing (' + missing.length + ')', onclick: function () { GW.restoreBuiltins(); GW.openPresets(); } })]));
    } else if (hidden.length) kids.push(h('p', {}, [h('button', { class: 'btn sm', text: 'Restore the layouts I deleted', onclick: function () { GW.layouts.restoreHidden(kind); GW.openPresets(); } })]));
    // open a .prg / .iq that Garmin Studio built (the editable design is stored inside it)
    var pick = h('input', { type: 'file', accept: '.prg,.iq,.zip', hidden: true });
    pick.addEventListener('change', function () {
      var f = pick.files[0]; if (!f) return; pick.value = '';
      GW.toast('Opening ' + f.name + '…');
      GW.importBuild(f).then(function (obj) {
        GW.loadFrom(obj, function () { GW.fontsReady().then(function () {
          GW.touch(true); closeModal(); GW.history.commit(); GW.toast('Opened ' + f.name);
          if (obj.report) importReport(f.name, obj.report);
        }); });
      }).catch(function (e) { GW.toast(e.message); });
    });
    kids.push(h('div', { style: 'margin-top:16px;padding-top:12px;border-top:1px solid var(--line2)' }, [
      h('button', { class: 'btn', text: '⬆ Open a .prg, .iq or project .zip…', onclick: function () { pick.click(); } }), pick,
      h('p', { class: 'muted small', text: 'Works with watch faces and data fields built here, so you can edit them again. Files from other people, or built before this feature, have no design inside.' })]));
    modal('Layouts', h('div', {}, kids));
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
        name: res.name, format: format, device: GW.DEVICE.id, files: res.files.map(function (f) { return { path: f.path, data: b64(f.data) }; }) }) }).then(function (r) { return r.json || {}; });
    }
    function run(format) {
      btn.disabled = true; iqBtn.disabled = true; var noDesign = false, done = [], log = '', what = format === 'iq' ? '.iq' : '.prg';
      (function next(i) {
        function finish() { btn.disabled = false; iqBtn.disabled = false; }
        if (i >= results.length) {
          finish();
          say(format === 'iq'
            ? 'Built ' + done.join(', ') + '. Upload ' + (done.length > 1 ? 'each one' : 'it') + ' at apps.garmin.com/developer → Upload an App.'
            : 'Built ' + done.join(', ') + '. Copy ' + (done.length > 1 ? 'them' : 'it') + ' into GARMIN/APPS on the watch.' + (noDesign ? ' Note: this file does not contain the editable design, so Garmin Studio cannot open it again. Reload the page (Cmd/Ctrl+Shift+R) and build again.' : ''), log.replace(/exit=0/g, '').trim());
          return;
        }
        say('Compiling ' + (i + 1) + ' of ' + results.length + ' (' + what + ') with Garmin’s compiler…', '');
        buildOne(results[i], format).then(function (j) {
          if (!j.ok) { finish(); say((j.message || 'Build failed.') + (many ? ' (' + results[i].name + ')' : ''), j.log || ''); return; }
          var bin = atob(j.prg), u = new Uint8Array(bin.length); for (var k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k);
          var dlName = fileBase(many ? results[i] : null) + (/\.[a-z0-9]+$/i.exec(j.name) || ['.prg'])[0];
          GW.download(new Blob([u], { type: 'application/octet-stream' }), dlName); j.name = dlName;
          done.push(j.name + ' (' + Math.round(u.length / 1024) + ' KB)'); log += (j.log || '') + '\n';
          if (j.hasDesign === false) noDesign = true;
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
    api('/api/status?device=' + encodeURIComponent(GW.DEVICE.id)).then(function (r) {
      if (!r.json) { box.style.display = 'none'; return; } // static hosting: no backend
      if (r.json.ready) { btn.disabled = false; iqBtn.disabled = false; say('Cloud builder ready: one click gives you the finished .prg for your watch, or an .iq for the Connect IQ developer portal.'); }
      else { setup.style.display = ''; say(r.json.message); }
    }).catch(function () { box.style.display = 'none'; });
    return box;
  }

  // Rotation is a setting of the design (Face / Field tab): upright, turned 30 degrees to the right, or both as separate faces.
  function rotationField(d) {
    return field('Rotation', segCtl([['none', 'Upright'], ['r30', 'Rotated 30° right']], GW.rotChoice(d), function (v) { d.rotate = v; GW.commit(false); GW.renderPanel(); GW.renderFieldSettings(); }));
  }

  // download file names follow the name of the layout (several versions get their label added)
  function fileBase(r) {
    var b = String(GW.design.name || '').replace(/[\\\/:*?"<>|]+/g, '').trim() || 'Layout';
    return r && r.label ? b + ' - ' + r.label.replace(/\s*\(.*\)/, '').replace(/[^\w\u00b0 ]+/g, '') : b;
  }
  // Rough watch-memory estimate for the fonts and pictures (what the exported files will occupy). It is an estimate, not a measurement.
  function memBox(results) {
    var field_ = results[0].src.type === 'datafield', lim = field_ ? (GW.DEVICE.id === 'fenix6' ? 32 : 128) : (GW.DEVICE.id === 'fenix6' ? 112 : 128);
    var box = h('div', { class: 'f', style: 'margin:0 0 14px' }, [h('label', { text: 'Memory estimate' })]);
    results.forEach(function (r) {
      var rows = [], total = 0;
      r.mem.fonts.forEach(function (f) { var b = 197 + f.glyphs * 58 + 0.084 * f.ink; total += b; rows.push(f.family + ' ' + f.px + ' px, ' + f.glyphs + ' glyphs' + (f.w ? ' (atlas ' + f.w + '×' + f.h + ')' : ' (prebuilt)') + ': ≈ ' + (b / 1024).toFixed(1) + ' KB'); });
      r.mem.images.forEach(function (m) { var b = m.w * m.h; total += b; rows.push('Picture ' + m.id + ' ' + m.w + '×' + m.h + ': ' + (b / 1024).toFixed(1) + ' KB'); });
      var pct = total / 1024 / lim * 100;
      if (results.length > 1) box.appendChild(h('div', { class: 'muted small', text: r.label }));
      box.appendChild(h('div', { class: 'muted small', style: 'white-space:pre-line', text: (rows.length ? rows.join('\n') : 'No fonts or pictures.') }));
      box.appendChild(h('div', { class: 'note' + (pct > 80 ? ' warn' : ''), text: (pct > 80 ? '⚠ ' : '') + 'Fonts + pictures ≈ ' + (total / 1024).toFixed(1) + ' KB of about ' + lim + ' KB available on ' + GW.DEVICE.name + ' (' + Math.round(pct) + '%).' + (pct > 80 ? ' Close to the limit: the watch may show the "IQ!" screen. Use fewer font sizes or characters.' : '') }));
    });
    box.appendChild(h('p', { class: 'muted small', text: 'This is an estimate, not a measurement: fonts are sized from the number of glyphs and their pixels (fitted to what the compiler produced for the fēnix 6; the atlas size itself does not change it), pictures at one byte per pixel. The program and live data are not counted.' }));
    return box;
  }

  GW.openExport = function () {
    var body = h('div', {}, [h('p', { class: 'muted', text: 'Building your project…' })]);
    modal('Get it on your watch', body);
    if (GW.rotChoice(GW.design) === 'none') delete GW.design.rotate;
    function render() {
      GW.buildVariants(GW.design).then(function (results) {
        var first = results[0], many = results.length > 1;
        GW.history.commit();
        var zipName = fileBase(null) + '.zip';
        var all = []; results.forEach(function (r) { r.files.forEach(function (f) { all.push({ path: r.name + '/' + f.path, data: f.data, exec: f.exec }); }); });
        var blob = GW.zip(all), nFiles = all.length;
        body.innerHTML = '';
        // The manifest app ID decides what the Connect IQ portal does with the upload: keep it to publish a new version of that app,
        // change it to publish a whole new app.
        var idBox = h('div', { class: 'f', style: 'margin:0 0 14px' }, [h('label', { text: 'App ID (manifest)' })]);
        results.forEach(function (r) {
          var inp = h('input', { type: 'text', value: r.appId, maxlength: 32, spellcheck: 'false', class: 'mono', 'aria-label': 'App ID' });
          function setId(v) {
            r.setId(v);
            GW.history.commit(); body.innerHTML = ''; body.appendChild(h('p', { class: 'muted', text: 'Building your project…' })); render();
          }
          inp.addEventListener('change', function () {
            var v = inp.value.trim().toLowerCase();
            if (!/^[0-9a-f]{32}$/.test(v)) { GW.toast('An app ID is 32 characters, 0-9 and a-f.'); inp.value = r.appId; return; }
            if (v !== r.appId) setId(v);
          });
          idBox.appendChild(h('div', { class: 'row', style: 'align-items:center;gap:8px;margin-top:4px' }, [
            results.length > 1 || r.tilt ? h('span', { class: 'muted small', style: 'flex:none', text: r.label }) : null,
            inp, h('button', { class: 'btn sm', style: 'flex:none', text: 'Generate new', onclick: function () { setId(GW.newAppId()); } })
          ]));
        });
        body.appendChild(idBox);

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
        body.appendChild(memBox(results));
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

  GW.saveLayout = function () {
    var r = GW.layouts.save(function (err) { if (!err && GW.layouts.shared()) GW.toast('Saved to the shared library ✓ everyone can see it now'); });
    if (!r.ok) { GW.toast('The browser is out of storage. Use Download to keep a file instead.'); return; }
    if (r.shared) { GW.toast('Saving “' + r.name + '” to the shared library…'); return; }
    GW.toast((r.updated ? 'Updated “' + r.name + '”' : 'Saved “' + r.name + '” as a new layout') + ' (this browser only: the shared library is not connected' + (GW.layouts.why() ? ' - ' + GW.layouts.why() : ' yet') + ')');
  };

  GW.saveFile = function () {
    var blob = new Blob([JSON.stringify(GW.serialize())], { type: 'application/json' });
    GW.download(blob, GW.slug(GW.design.name) + '.watchface.json');
  };
})(window.GW);
