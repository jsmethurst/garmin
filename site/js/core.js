/* Core: namespace, palette, state, history, events. Classic script (no modules) so the app also works from file://. */
window.GW = window.GW || {};
(function (GW) {
  'use strict';

  GW.SIZE = 280; // fenix 6X Pro: 280x280 round MIP display
  GW.DEVICE = { id: 'fenix6xpro', name: 'fēnix 6X Pro', size: 280 };

  // ---------- helpers ----------
  GW.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  GW.uid = function (p) { return (p || 'e') + Math.random().toString(36).slice(2, 8); };
  GW.clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  GW.rad = function (d) { return d * Math.PI / 180; };
  GW.pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
  GW.slug = function (s, fallback) {
    var r = String(s || '').replace(/[^A-Za-z0-9]+/g, ' ').trim();
    if (!r) return fallback || 'Watchface';
    r = r.split(' ').map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join('');
    if (/^[0-9]/.test(r)) r = 'Face' + r;
    return r;
  };

  // ---------- 64-color palette (fenix 6 MIP: 2 bits per channel) ----------
  var LV = [0x00, 0x55, 0xAA, 0xFF];
  GW.LEVELS = LV;
  function hex2(n) { return (n < 16 ? '0' : '') + n.toString(16); }
  GW.q = function (hex) {
    if (!hex || hex[0] !== '#' || hex.length < 7) return '#000000';
    var r = parseInt(hex.substr(1, 2), 16), g = parseInt(hex.substr(3, 2), 16), b = parseInt(hex.substr(5, 2), 16);
    function s(v) { return hex2(Math.round(v / 85) * 85); }
    return '#' + s(r) + s(g) + s(b);
  };
  GW.PALETTE = [];
  for (var r = 0; r < 4; r++) for (var g = 0; g < 4; g++) for (var b = 0; b < 4; b++)
    GW.PALETTE.push('#' + hex2(LV[r]) + hex2(LV[g]) + hex2(LV[b]));
  // Monkey C hex literal
  GW.mcColor = function (hex) { return '0x' + GW.q(hex).slice(1).toUpperCase(); };
  // dim version of a color (for gauge tracks) kept on the 64-color grid
  GW.dim = function (hex, k) {
    k = k == null ? 0.25 : k;
    var q = GW.q(hex);
    function ch(i) { return Math.round(parseInt(q.substr(i, 2), 16) * k / 85) * 85; }
    return '#' + hex2(ch(1)) + hex2(ch(3)) + hex2(ch(5));
  };

  // ---------- events ----------
  var handlers = {};
  GW.on = function (ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); };
  GW.emit = function (ev, a, b) { (handlers[ev] || []).forEach(function (fn) { fn(a, b); }); };

  // ---------- state ----------
  GW.blankDesign = function () {
    return { name: 'My Watchface', bg: '#000000', bgImage: null, fonts: [], elements: [] };
  };
  GW.design = GW.blankDesign();
  GW.assets = {};        // assetId -> { dataUrl, img (HTMLImageElement) }
  GW.selId = null;
  GW.sim = {
    live: true, minutes: 10 * 60 + 9, seconds: 36,
    steps: 7340, stepGoal: 10000, calories: 1180, calGoal: 2200, floors: 7, floorGoal: 10,
    battery: 78, batteryDays: 6.4, hr: 64, bodyBat: 71, stress: 28, spo2: 97, resp: 14,
    intMins: 95, intGoal: 150, distance: 6.2, notif: 3, temp: 17, wx: 1, lat: 41.01, lon: 28.98,
    runHr: 162, runKm: 7.37, runAvg: 318, runPlanKm: 10, lapNo: 8, lapKm: 0.41, lapPace: 305, lastLap: 312,
    runPace: 308, runCad: 172, runPow: 248, runAvgHr: 158, runMaxHr: 176, runAscent: 84, runCal: 512,
    altitude: 312, moveBar: 2, sunrise: 6 * 60 + 52, sunset: 18 * 60 + 14,
    metric: true, is24: true
  };

  GW.getAsset = function (id) { return GW.assets[id]; };
  GW.addAsset = function (dataUrl, cb) {
    var id = GW.uid('a');
    var img = new Image();
    img.onload = function () { GW.assets[id] = { dataUrl: dataUrl, img: img, w: img.naturalWidth, h: img.naturalHeight }; cb && cb(id, GW.assets[id]); };
    img.src = dataUrl;
    return id;
  };

  GW.findEl = function (id) {
    var els = GW.design.elements;
    for (var i = 0; i < els.length; i++) if (els[i].id === id) return els[i];
    return null;
  };
  GW.selected = function () { return GW.selId ? GW.findEl(GW.selId) : null; };
  GW.select = function (id) {
    GW.selId = id;
    var el = id && GW.findEl(id);
    if (el && GW.design.kind === 'datafield' && el.slot != null) GW.design.dfSlot = el.slot;   // working on a field's content makes its slot the current one
    GW.emit('select', id);
  };

  // ---------- history (undo / redo) ----------
  var stack = [], idx = -1, LIMIT = 80;
  function snapshot() { return JSON.stringify(GW.design); }
  GW.history = {
    reset: function () { stack = [snapshot()]; idx = 0; GW.emit('history'); },
    commit: function () {
      var s = snapshot();
      if (s === stack[idx]) return;
      stack = stack.slice(0, idx + 1); stack.push(s);
      if (stack.length > LIMIT) stack.shift();
      idx = stack.length - 1;
      GW.emit('history'); GW.save();
    },
    undo: function () { if (idx > 0) { idx--; GW.design = JSON.parse(stack[idx]); afterRestore(); } },
    redo: function () { if (idx < stack.length - 1) { idx++; GW.design = JSON.parse(stack[idx]); afterRestore(); } },
    canUndo: function () { return idx > 0; },
    canRedo: function () { return idx < stack.length - 1; }
  };
  function afterRestore() {
    if (GW.selId && !GW.findEl(GW.selId)) GW.selId = null;
    GW.emit('history'); GW.emit('structure'); GW.emit('select', GW.selId); GW.save();
  }

  // Call after any mutation of the design. structural=true re-renders panels.
  GW.touch = function (structural) { GW.emit(structural ? 'structure' : 'change'); };
  GW.commit = function (structural) { GW.touch(structural); GW.history.commit(); };

  // ---------- persistence ----------
  var KEYS = { watch: 'gw.design.v1', field: 'gw.design.field.v1' };
  GW.modeOf = function (d) { return (d || GW.design).kind === 'datafield' ? 'field' : 'watch'; };
  var saveTimer = null;
  GW.serialize = function () {
    var used = {}, a = {};
    function mark(id) { if (id && GW.assets[id]) used[id] = 1; }
    GW.design.elements.forEach(function (e) { mark(e.asset); });
    mark(GW.design.bgImage);
    GW.design.fonts.forEach(function (f) { mark(f.asset); });
    Object.keys(used).forEach(function (id) { a[id] = GW.assets[id].dataUrl; });
    return { v: 1, design: GW.design, assets: a };
  };
  GW.saveNow = function () {
    try { localStorage.setItem(KEYS[GW.modeOf()], JSON.stringify(GW.serialize())); } catch (e) { /* quota / private mode */ }
  };
  GW.save = function () {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(GW.saveNow, 250);
  };
  GW.loadFrom = function (obj, done) {
    var d = obj.design || obj;
    if (d.rotate === 'both') d.rotate = 'r30';   // the old "both" option is gone
    var assets = obj.assets || {};
    var ids = Object.keys(assets), n = ids.length;
    var fontOf = {};
    (d.fonts || []).forEach(function (f) { if (f.asset) fontOf[f.asset] = f; });
    GW.assets = {};
    function fin() {
      GW.design = Object.assign(GW.blankDesign(), d);
      if (GW.design.kind === 'datafield') GW.design.elements.forEach(function (e) { if (e.slot == null) e.slot = GW.design.dfSlot || 0; });
      if (GW.design.kind === 'datafield' && !GW.design.dfEdgesApplied) { GW.applyEdges(GW.design); GW.design.dfEdgesApplied = true; }   // older designs: put the layout's dividing lines on the cells once
      (GW.design.elements || []).forEach(function (e) {   // the "last activity" data points are gone: keep the element as plain text
        if (e.type === 'text' && (e.source === 'lastKm' || e.source === 'lastPace')) { e.source = 'custom'; e.text = '--'; }
      });
      GW.design.elements = (GW.design.elements || []).filter(function (e) { return GW.types[e.type]; }); // drop element types that no longer exist
      GW.design.fonts = GW.design.fonts || [];
      GW.selId = null;
      GW.history.reset();
      GW.emit('structure'); GW.emit('select', null);
      done && done();
    }
    if (!n) return fin();
    ids.forEach(function (id) {
      if (fontOf[id]) {
        GW.registerUploadedFont(fontOf[id].family, assets[id]).then(function () { GW.assets[id] = { dataUrl: assets[id], font: true }; if (--n === 0) fin(); },
          function () { if (--n === 0) fin(); });
        return;
      }
      var img = new Image();
      img.onload = function () { GW.assets[id] = { dataUrl: assets[id], img: img, w: img.naturalWidth, h: img.naturalHeight }; if (--n === 0) fin(); };
      img.onerror = function () { if (--n === 0) fin(); };
      img.src = assets[id];
    });
  };
  // ---------- saved layouts (the library behind the Save button) ----------
  // Saving under a name that already exists, a built-in preset's name included, updates that layout; a new name adds one.
  var LKEY = 'gw.layouts.v1';
  function lkey(n) { return String(n || '').trim().toLowerCase(); }
  GW.layouts = {
    all: function () { try { return JSON.parse(localStorage.getItem(LKEY) || '[]'); } catch (e) { return []; } },
    find: function (name, kind) { return GW.layouts.all().filter(function (l) { return l.kind === kind && lkey(l.name) === lkey(name); })[0] || null; },
    save: function () {
      var d = GW.design, kind = GW.modeOf(), name = String(d.name || '').trim() || 'Untitled', list = GW.layouts.all(), updated = false;
      var entry = { name: name, kind: kind, ts: Date.now(), data: GW.serialize() };
      for (var i = 0; i < list.length; i++) if (list[i].kind === kind && lkey(list[i].name) === lkey(name)) { list[i] = entry; updated = true; break; }
      if (!updated) list.push(entry);
      try { localStorage.setItem(LKEY, JSON.stringify(list)); } catch (e) { return { ok: false, name: name }; }
      return { ok: true, updated: updated, name: name };
    },
    // built-in layouts you removed from the list (kept in the browser; "restore" brings them back)
    hidden: function (kind) { try { return (JSON.parse(localStorage.getItem('gw.hidden.v1') || '[]')).filter(function (h) { return h.kind === kind; }).map(function (h) { return lkey(h.name); }); } catch (e) { return []; } },
    hide: function (name, kind) {
      var all; try { all = JSON.parse(localStorage.getItem('gw.hidden.v1') || '[]'); } catch (e) { all = []; }
      all.push({ name: name, kind: kind }); try { localStorage.setItem('gw.hidden.v1', JSON.stringify(all)); } catch (e) { }
    },
    restoreHidden: function (kind) {
      var all; try { all = JSON.parse(localStorage.getItem('gw.hidden.v1') || '[]'); } catch (e) { all = []; }
      try { localStorage.setItem('gw.hidden.v1', JSON.stringify(all.filter(function (h) { return h.kind !== kind; }))); } catch (e) { }
    },
    remove: function (name, kind) {
      var list = GW.layouts.all().filter(function (l) { return !(l.kind === kind && lkey(l.name) === lkey(name)); });
      try { localStorage.setItem(LKEY, JSON.stringify(list)); } catch (e) { }
    }
  };
  GW.loadSaved = function (mode) {
    try { var s = localStorage.getItem(KEYS[mode || 'watch']); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  };
})(window.GW);
