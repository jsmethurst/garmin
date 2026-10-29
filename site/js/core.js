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

  // ---------- 64-colour palette (fenix 6 MIP: 2 bits per channel) ----------
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
  // dim version of a colour (for gauge tracks) kept on the 64-colour grid
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
    intMins: 95, intGoal: 150, distance: 6.2, notif: 3, temp: 17, wx: 1, lat: 41.01, lon: 28.98, lastKm: 8.4, paceSec: 342,
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
  GW.select = function (id) { GW.selId = id; GW.emit('select', id); };

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
  var KEY = 'gw.design.v1';
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
  GW.save = function () {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem(KEY, JSON.stringify(GW.serialize())); } catch (e) { /* quota / private mode */ }
    }, 250);
  };
  GW.loadFrom = function (obj, done) {
    var d = obj.design || obj;
    var assets = obj.assets || {};
    var ids = Object.keys(assets), n = ids.length;
    var fontOf = {};
    (d.fonts || []).forEach(function (f) { if (f.asset) fontOf[f.asset] = f; });
    GW.assets = {};
    function fin() {
      GW.design = Object.assign(GW.blankDesign(), d);
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
  GW.loadSaved = function () {
    try { var s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  };
})(window.GW);
