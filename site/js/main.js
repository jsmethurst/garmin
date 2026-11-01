/* Canvas, interaction, keyboard, boot. */
(function (GW) {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var cv = $('cv'), ctx = cv.getContext('2d');
  var opts = { snap: true, grid: false };
  var hoverId = null, drag = null, guides = { xs: [], ys: [] };

  // ---------- watch model ----------
  (function () {
    var sel = $('deviceSel'); if (!sel) return;
    GW.DEVICES.forEach(function (d) { var o = document.createElement('option'); o.value = d.id; o.textContent = d.name + ' · ' + d.size + '×' + d.size; sel.appendChild(o); });
    sel.value = GW.DEVICE.id;
    sel.addEventListener('change', function () { GW.setDevice(sel.value); });
  })();

  // ---------- drawing ----------
  var drawQ = false;
  function schedule() { if (drawQ) return; drawQ = true; requestAnimationFrame(draw); }
  function fit() {
    var d = window.devicePixelRatio || 1, px = Math.max(100, Math.round(cv.clientWidth * d));
    if (cv.width !== px) { cv.width = cv.height = px; }
  }
  function draw() {
    drawQ = false; fit();
    cv.style.transform = GW.design.rotate === 'r30' ? 'rotate(30deg)' : '';   // rotation is a setting of the whole screen: the preview turns with it
    var k = cv.width / GW.SIZE, env = GW.env();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.scale(k, k);
    GW.renderDesign(ctx, GW.design, env);
    overlay(env, k);
  }
  function overlay(env, k) {
    ctx.save();
    if (opts.grid) {
      ctx.lineWidth = 1 / k;
      for (var i = 0; i <= GW.SIZE; i += 20) {
        ctx.strokeStyle = i === 140 ? 'rgba(232,89,12,.6)' : 'rgba(128,128,128,.3)';
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, GW.SIZE); ctx.moveTo(0, i); ctx.lineTo(GW.SIZE, i); ctx.stroke();
      }
    }
    if (guides.xs.length || guides.ys.length) {
      var go = guides.off || { x: 0, y: 0, w: GW.SIZE, h: GW.SIZE };
      ctx.save(); ctx.translate(go.x, go.y);
      ctx.strokeStyle = 'rgba(232,89,12,.9)'; ctx.lineWidth = 1 / k; ctx.setLineDash([4 / k, 3 / k]);
      ctx.beginPath();
      guides.xs.forEach(function (x) { ctx.moveTo(x, 0); ctx.lineTo(x, go.h); });
      guides.ys.forEach(function (y) { ctx.moveTo(0, y); ctx.lineTo(go.w, y); });
      ctx.stroke(); ctx.restore();
    }
    function outline(el, col, w, dash) {
      var b = safeBox(el); if (!b) return;
      var o = offsetOf(el);
      ctx.save(); ctx.translate(o.x, o.y);
      ctx.strokeStyle = col; ctx.lineWidth = w / k; ctx.setLineDash(dash ? [4 / k, 3 / k] : []);
      ctx.strokeRect(b.x - 1 / k, b.y - 1 / k, b.w + 2 / k, b.h + 2 / k);
      ctx.restore();
    }
    var hov = hoverId && hoverId !== GW.selId ? GW.findEl(hoverId) : null;
    if (hov && !hov.hidden) outline(hov, 'rgba(232,89,12,.55)', 1, false);
    var sel = GW.selected();
    if (sel && !sel.hidden) {
      outline(sel, '#e8590c', 1.5, true);
      gripsOf(sel).forEach(function (g) {
        var s = 4 / k; ctx.save(); ctx.setLineDash([]); ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#e8590c'; ctx.lineWidth = 1.5 / k;
        ctx.fillRect(g[0] - s, g[1] - s, 2 * s, 2 * s); ctx.strokeRect(g[0] - s, g[1] - s, 2 * s, 2 * s); ctx.restore();
      });
      var p = GW.posPairs(sel)[0];
      if (p) {
        var x = sel[p[0]], y = sel[p[1]], s = 4 / k, so2 = offsetOf(sel);
        ctx.save(); ctx.translate(so2.x, so2.y);
        ctx.setLineDash([]); ctx.strokeStyle = '#e8590c'; ctx.lineWidth = 1.5 / k;
        ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.moveTo(x, y - s); ctx.lineTo(x, y + s); ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();
  }
  // corner grips (elements with `grips`): drag one to resize with the proportions kept
  function gripsOf(el) {
    var t = GW.types[el.type]; if (!t || !t.grips || el.locked || el.hidden) return [];
    var b = safeBox(el); if (!b) return [];
    var o = offsetOf(el);
    return [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]].map(function (c) { return [c[0] + o.x, c[1] + o.y]; });
  }
  function gripAt(p) {
    var el = GW.selected(); if (!el) return null;
    var g = gripsOf(el), tol = 9 * GW.SIZE / (cv.clientWidth || GW.SIZE);
    for (var i = 0; i < g.length; i++) if (Math.abs(p.x - g[i][0]) <= tol && Math.abs(p.y - g[i][1]) <= tol) return { el: el, i: i, g: g };
    return null;
  }
  function safeBox(el) { try { return GW.elBox(el, ctx); } catch (e) { return null; } }

  // ---------- picking / dragging ----------
  // In a data-field screen layout every element belongs to a slot and its coordinates start at that slot's top left.
  function offsetOf(el) {
    if (GW.design.kind !== 'datafield') return { x: 0, y: 0, w: GW.SIZE, h: GW.SIZE };
    return GW.slotRect(GW.design, GW.elSlot(el, GW.design));
  }
  function toDesign(e) {   // screen coordinates, 0..280
    var r = cv.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    if (GW.design.rotate === 'r30') { var a = -30 * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), nx = dx * c - dy * s; dy = dx * s + dy * c; dx = nx; }
    var side = cv.clientWidth || r.width;
    return { x: (dx / side + 0.5) * GW.SIZE, y: (dy / side + 0.5) * GW.SIZE };
  }
  function pick(x, y) {
    var els = GW.design.elements;
    for (var i = els.length - 1; i >= 0; i--) {
      var el = els[i]; if (el.hidden || el.locked) continue;
      var o = offsetOf(el);
      try { if (GW.hitEl(el, x - o.x, y - o.y, ctx)) return el; } catch (e) { }
    }
    return null;
  }
  // Snap the moving element's edges and centre to the screen centre and to the edges / centres of the other elements.
  function snapMove(el, b, dx, dy) {
    var so = offsetOf(el), T = 4, tx = [so.w / 2, 0, so.w], ty = [so.h / 2, 0, so.h];
    GW.design.elements.forEach(function (o) {
      if (o === el || o.hidden || offsetOf(o).x !== so.x || offsetOf(o).y !== so.y) return;
      var ob = safeBox(o); if (!ob || (ob.w >= 270 && ob.h >= 270)) return;   // skip full-screen elements (rings, hands)
      tx.push(ob.x, ob.x + ob.w / 2, ob.x + ob.w); ty.push(ob.y, ob.y + ob.h / 2, ob.y + ob.h);
    });
    function best(own, targets) {
      var res = null;
      own.forEach(function (c) { targets.forEach(function (t) { var d = t - c; if (Math.abs(d) <= T && (!res || Math.abs(d) < Math.abs(res.d))) res = { d: d, t: t }; }); });
      return res;
    }
    var nx = b.x + dx, ny = b.y + dy;
    var sx = best([nx, nx + b.w / 2, nx + b.w], tx), sy = best([ny, ny + b.h / 2, ny + b.h], ty);
    return { dx: dx + (sx ? sx.d : 0), dy: dy + (sy ? sy.d : 0), xs: sx ? [sx.t] : [], ys: sy ? [sy.t] : [] };
  }
  cv.addEventListener('pointerdown', function (e) {
    var p = toDesign(e), el = pick(p.x, p.y);
    GW.closeColor();
    var gr = gripAt(p);
    if (gr) {   // start resizing from a corner grip: the opposite corner stays where it is
      var oc = gr.g[(gr.i + 2) % 4], bx = safeBox(gr.el);
      drag = { resize: true, id: gr.el.id, i: gr.i, ax: oc[0], ay: oc[1], asp: bx.w / bx.h, off: offsetOf(gr.el), moved: false };
      cv.setPointerCapture(e.pointerId); return;
    }
    if (!el) {
      // clicking an empty slot of a screen layout makes it the current slot (new cells go there)
      if (GW.design.kind === 'datafield') {
        var L = GW.DF_LAYOUTS[GW.design.dfLayout] || GW.DF_LAYOUTS[0];
        for (var si = 0; si < L.slots.length; si++) {
          var r = L.slots[si];
          if (p.x >= r[0] && p.x < r[0] + r[2] && p.y >= r[1] && p.y < r[1] + r[3] && Math.hypot(p.x - 140, p.y - 140) <= 140) {
            if (si !== (GW.design.dfSlot || 0)) { GW.design.dfSlot = si; GW.select(null); GW.commit(true); return; }
            break;
          }
        }
      }
      GW.select(null); return;
    }
    if (GW.selId !== el.id) GW.select(el.id);
    var pairs = GW.posPairs(el);
    if (!pairs.length) return; // whole-face elements are selected but not dragged
    drag = { id: el.id, sx: p.x, sy: p.y, moved: false, box: safeBox(el), orig: pairs.map(function (pr) { return [pr[0], pr[1], el[pr[0]], el[pr[1]]]; }) };
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', function (e) {
    var p = toDesign(e);
    var co = GW.design.kind === 'datafield' ? GW.slotRect(GW.design, GW.design.dfSlot || 0) : { x: 0, y: 0 };
    $('coords').textContent = 'x ' + Math.round(p.x - co.x) + ' · y ' + Math.round(p.y - co.y);
    if (drag && drag.resize) {
      var rl = GW.findEl(drag.id); if (!rl) return;
      var sxs = (drag.i === 1 || drag.i === 2) ? 1 : -1, sys = drag.i >= 2 ? 1 : -1;
      var wd = Math.max((p.x - drag.ax) * sxs, (p.y - drag.ay) * sys * drag.asp);
      wd = Math.max(16, Math.min(280, wd)); drag.moved = true;
      rl.w = Math.round(wd); rl.h = Math.max(6, Math.round(wd / drag.asp));
      rl.x = Math.round(drag.ax - drag.off.x + sxs * rl.w / 2); rl.y = Math.round(drag.ay - drag.off.y + sys * rl.h / 2);
      GW.emit('drag'); return;
    }
    if (drag) {
      var el = GW.findEl(drag.id); if (!el) return;
      var dx = p.x - drag.sx, dy = p.y - drag.sy;
      if (!drag.moved && Math.hypot(dx, dy) < 1.5) return;
      drag.moved = true;
      guides.xs = []; guides.ys = [];
      if (opts.snap && !e.shiftKey && drag.box) {
        var sn = snapMove(el, drag.box, dx, dy); dx = sn.dx; dy = sn.dy; guides.xs = sn.xs; guides.ys = sn.ys; guides.off = offsetOf(el);
      }
      drag.orig.forEach(function (o) { el[o[0]] = Math.round(o[2] + dx); el[o[1]] = Math.round(o[3] + dy); });
      GW.emit('drag');
    } else {
      var h = pick(p.x, p.y), id = h ? h.id : null, gg = gripAt(p);
      if (gg) { cv.style.cursor = (gg.i % 2 === 0) ? 'nwse-resize' : 'nesw-resize'; return; }
      if (id !== hoverId) { hoverId = id; schedule(); }
      cv.style.cursor = id ? 'move' : 'crosshair';
    }
  });
  function endDrag() {
    if (!drag) return;
    var moved = drag.moved; drag = null; guides.xs = []; guides.ys = [];
    if (moved) GW.history.commit();
    schedule();
  }
  cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
  cv.addEventListener('pointerleave', function () { if (hoverId) { hoverId = null; schedule(); } $('coords').textContent = 'x – · y –'; });

  // drop an image file onto the stage
  var stage = document.querySelector('.stage');
  stage.addEventListener('dragover', function (e) { if (e.dataTransfer && Array.prototype.some.call(e.dataTransfer.types || [], function (t) { return t === 'Files'; })) e.preventDefault(); });
  stage.addEventListener('drop', function (e) {
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f || !/^image\//.test(f.type)) return;
    e.preventDefault();
    var fr = new FileReader();
    fr.onload = function () {
      GW.addAsset(fr.result, function (id, a) {
        var k = Math.min(1, 120 / Math.max(a.w, a.h));
        GW.addElement('image', { name: f.name.replace(/\.[^.]+$/, '').slice(0, 24) || 'Image', asset: id, w: Math.max(1, Math.round(a.w * k)), h: Math.max(1, Math.round(a.h * k)) });
      });
    };
    fr.readAsDataURL(f);
  });

  // ---------- keyboard ----------
  var nudgeT = null;
  document.addEventListener('keydown', function (e) {
    var t = e.target, typing = t && (t.tagName === 'INPUT' && t.type !== 'checkbox' && t.type !== 'range' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
    var mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && k === 'z' && !typing) { e.preventDefault(); e.shiftKey ? GW.history.redo() : GW.history.undo(); return; }
    if (mod && k === 'y' && !typing) { e.preventDefault(); GW.history.redo(); return; }
    if (typing || document.querySelector('.modal')) return;
    if (mod && k === 'd') { e.preventDefault(); GW.duplicateSelected(); return; }
    if (mod && k === 's') { e.preventDefault(); GW.saveLayout(); return; }
    var el = GW.selected();
    if (!el) return;
    if (k === 'delete' || k === 'backspace') { e.preventDefault(); GW.deleteSelected(); return; }
    if (k === 'escape') { GW.select(null); return; }
    var step = e.shiftKey ? 5 : 1, dx = 0, dy = 0;
    if (k === 'arrowleft') dx = -step; else if (k === 'arrowright') dx = step; else if (k === 'arrowup') dy = -step; else if (k === 'arrowdown') dy = step; else return;
    if (t && t.tagName === 'INPUT') return; // let range sliders use arrows
    e.preventDefault();
    if (e.altKey && el.type === 'dfcell') { el.dx = (el.dx || 0) + dx; el.dy = (el.dy || 0) + dy; }   // Alt + arrows nudge what is inside a field, not the field
    else GW.posPairs(el).forEach(function (p) { el[p[0]] += dx; el[p[1]] += dy; });
    GW.emit('drag');
    clearTimeout(nudgeT); nudgeT = setTimeout(function () { GW.history.commit(); }, 450);
  });

  // ---------- wiring ----------
  var uiQ = false;
  function scheduleLayers() { if (uiQ) return; uiQ = true; requestAnimationFrame(function () { uiQ = false; GW.renderLayers(); }); }
  GW.on('change', function () { schedule(); scheduleLayers(); });
  GW.on('drag', function () { schedule(); GW.refreshInspectorValues(); });
  // Watch faces and data fields are two sections of the same app; the design's kind decides which one is showing.
  function syncMode() {
    var m = GW.modeOf(), field = m === 'field';
    if (document.body.dataset.mode === m) return;
    document.body.dataset.mode = m;
    Array.prototype.forEach.call(document.querySelectorAll('#modes button'), function (b) { b.classList.toggle('on', b.dataset.mode === m); });
    document.querySelector('#tabs [data-tab=face]').textContent = field ? 'Field' : 'Face';
    $('designName').placeholder = field ? 'Name your data field' : 'Name your watchface';
    $('designName').setAttribute('aria-label', field ? 'Data field name' : 'Watchface name');
        document.title = (field ? 'Data Fields' : 'Watch Faces') + ' · Garmin Studio';
    if (field && document.querySelector('#tabs button.on').dataset.tab === 'face') GW.setTab('inspect');
    GW.renderAdd();
  }
  GW.setMode = function (m) {
    if (GW.modeOf() === m) return;
    GW.saveNow();
    try { localStorage.setItem('gw.mode', m); } catch (e) { }
    var saved = GW.loadSaved(m);
    var done = function () { GW.fontsReady().then(function () { GW.touch(true); GW.emit('history'); }); };
    if (saved && saved.design && saved.design.elements && GW.modeOf(saved.design) === m) GW.loadFrom(saved, done);
    else GW.applyPreset(m === 'field' ? 'run' : 'orbit', done);
  };
  Array.prototype.forEach.call(document.querySelectorAll('#modes button'), function (b) { b.addEventListener('click', function () { GW.setMode(b.dataset.mode); }); });
  GW.on('structure', function () {
    syncMode();
    GW.renderLayers(); GW.renderPanel(); schedule(); GW.renderSlotCard();
    $('designName').value = GW.design.name;
  });
  GW.on('select', function (id) {
    GW.renderSlotCard();
    GW.renderLayers();
    if (id && document.querySelector('#tabs button.on').dataset.tab !== 'inspect') GW.setTab('inspect'); else GW.renderPanel();
    schedule();
  });
  GW.on('history', function () { $('btnUndo').disabled = !GW.history.canUndo(); $('btnRedo').disabled = !GW.history.canRedo(); });

  $('designName').addEventListener('input', function () { GW.design.name = this.value; GW.touch(false); });
  $('designName').addEventListener('change', function () { GW.history.commit(); });
  $('btnPresets').addEventListener('click', GW.openPresets);
  $('btnUndo').addEventListener('click', function () { GW.history.undo(); });
  $('btnRedo').addEventListener('click', function () { GW.history.redo(); });
  $('btnExport').addEventListener('click', GW.openExport);
  $('btnSave').addEventListener('click', GW.saveLayout);
  $('btnDownload').addEventListener('click', GW.saveFile);
  $('btnOpen').addEventListener('click', function () { $('fileOpen').click(); });
  $('fileOpen').addEventListener('change', function () {
    var f = this.files[0]; if (!f) return;
    var fr = new FileReader();
    fr.onload = function () {
      try { var obj = JSON.parse(fr.result); GW.loadFrom(obj, function () { GW.fontsReady().then(function () { GW.touch(true); GW.toast('Loaded ' + f.name); }); }); }
      catch (e) { GW.toast('That file is not a Garmin Studio design.'); }
    };
    fr.readAsText(f); this.value = '';
  });
  $('optSnap').addEventListener('change', function () { opts.snap = this.checked; });
  $('optGrid').addEventListener('change', function () { opts.grid = this.checked; schedule(); });
  $('optLive').addEventListener('change', function () { GW.sim.live = this.checked; schedule(); if (document.querySelector('#tabs button.on').dataset.tab === 'sim') GW.renderPanel(); });
  document.getElementById('tabs').addEventListener('click', function (e) { var b = e.target.closest('button[data-tab]'); if (b) GW.setTab(b.dataset.tab); });
  if (window.ResizeObserver) new ResizeObserver(schedule).observe(cv); else window.addEventListener('resize', schedule);
  setInterval(function () { if (GW.sim.live && !document.hidden) schedule(); }, 1000);
  window.addEventListener('beforeunload', function () { GW.saveNow(); });

  // Garmin's picture has an opaque white backdrop: make the white that touches the image edge transparent.
  function cutOutBackground(img) {
    var W = img.naturalWidth, H = img.naturalHeight, c = document.createElement('canvas');
    c.width = W; c.height = H;
    var x = c.getContext('2d'); x.drawImage(img, 0, 0);
    var id = x.getImageData(0, 0, W, H), d = id.data, seen = new Uint8Array(W * H), stack = [];
    function white(i) { return d[i * 4 + 3] < 8 || (d[i * 4] > 232 && d[i * 4 + 1] > 232 && d[i * 4 + 2] > 232); }
    function push(px, py) { var i = py * W + px; if (!seen[i] && white(i)) { seen[i] = 1; stack.push(i); } }
    for (var a = 0; a < W; a++) { push(a, 0); push(a, H - 1); }
    for (var b = 0; b < H; b++) { push(0, b); push(W - 1, b); }
    while (stack.length) {
      var i = stack.pop(), px = i % W, py = (i - px) / W;
      if (px > 0) push(px - 1, py); if (px < W - 1) push(px + 1, py); if (py > 0) push(px, py - 1); if (py < H - 1) push(px, py + 1);
    }
    for (var k = 0; k < W * H; k++) {
      if (seen[k]) { d[k * 4 + 3] = 0; continue; }
      // soften the light fringe next to the cut-out so there is no white halo
      var px2 = k % W, py2 = (k - px2) / W;
      var edge = (px2 > 0 && seen[k - 1]) || (px2 < W - 1 && seen[k + 1]) || (py2 > 0 && seen[k - W]) || (py2 < H - 1 && seen[k + W]);
      if (edge && d[k * 4] > 170 && d[k * 4 + 1] > 170 && d[k * 4 + 2] > 170) d[k * 4 + 3] = 90;
    }
    x.putImageData(id, 0, 0);
    return c;
  }

  // ---------- real device picture (private: served from the builder, only exists on the Vercel deployment) ----------
  function useDevicePicture() {
    var w0 = document.querySelector('.watch');
    // no private picture available (static hosting): fall back to the drawn frame
    function fallback() {
      if (!w0.querySelector('.frame')) w0.insertBefore(document.getElementById('fallbackFrame').content.cloneNode(true), w0.firstChild);
      w0.classList.remove('loading');
    }
    fetch('/api/device-image?meta=1').then(function (r) { return r.ok ? r.json() : null; }).then(function (m) {
      if (!m || !m.w) return fallback();
      var src = new Image();
      src.onerror = fallback;
      src.onload = function () {
        var img = cutOutBackground(src);
        var w = document.querySelector('.watch'), g = w.querySelector('.glass');
        img.className = 'devimg'; img.alt = ''; w.insertBefore(img, g);
        w.classList.add('dev'); w.classList.remove('loading');
        w.style.setProperty('--ar', m.w + ' / ' + m.h);
        w.style.setProperty('--rat', m.w / m.h);
        g.style.left = ((m.x + m.size / 2) / m.w * 100) + '%';
        g.style.top = ((m.y + m.size / 2) / m.h * 100) + '%';
        g.style.width = (m.size / m.w * 100) + '%';
        schedule();
      };
      src.src = '/api/device-image';
    }).catch(fallback);
  }

  // when this version was pushed (written by tools/stamp.sh), shown in your own time zone
  (function () {
    var el = $('stamp'), t = window.GW_BUILT && new Date(window.GW_BUILT);
    if (!el || !t || isNaN(t)) return;
    var now = new Date(), hm = GW.pad2(t.getHours()) + ':' + GW.pad2(t.getMinutes());
    el.textContent = 'updated ' + (t.toDateString() === now.toDateString() ? '' : t.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ') + hm;
  })();

  // ---------- boot ----------
  useDevicePicture();
  GW.renderAdd();
  GW.fontsReady().then(function () {
    var mode = 'watch';
    try { if (localStorage.getItem('gw.mode') === 'field') mode = 'field'; } catch (e) { }
    var saved = GW.loadSaved(mode);
    function done() {
      GW.fontsReady().then(function () { GW.touch(true); GW.emit('history'); document.documentElement.classList.add('ready'); });
    }
    if (saved && saved.design && saved.design.elements && GW.modeOf(saved.design) === mode) GW.loadFrom(saved, done);
    else GW.applyPreset(mode === 'field' ? 'run' : 'orbit', done);
  });
  GW.stage = { schedule: schedule, opts: opts };
})(window.GW);
