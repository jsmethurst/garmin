/* Canvas, interaction, keyboard, boot. */
(function (GW) {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var cv = $('cv'), ctx = cv.getContext('2d');
  var opts = { snap: true, grid: false };
  var hoverId = null, drag = null, guides = { x: false, y: false };

  // ---------- drawing ----------
  var drawQ = false;
  function schedule() { if (drawQ) return; drawQ = true; requestAnimationFrame(draw); }
  function fit() {
    var d = window.devicePixelRatio || 1, px = Math.max(100, Math.round(cv.clientWidth * d));
    if (cv.width !== px) { cv.width = cv.height = px; }
  }
  function draw() {
    drawQ = false; fit();
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
        ctx.strokeStyle = i === 140 ? 'rgba(0,229,255,.55)' : 'rgba(255,255,255,.12)';
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, GW.SIZE); ctx.moveTo(0, i); ctx.lineTo(GW.SIZE, i); ctx.stroke();
      }
    }
    if (guides.x || guides.y) {
      ctx.strokeStyle = 'rgba(0,229,255,.9)'; ctx.lineWidth = 1 / k; ctx.setLineDash([4 / k, 3 / k]);
      ctx.beginPath(); if (guides.x) { ctx.moveTo(140, 0); ctx.lineTo(140, GW.SIZE); } if (guides.y) { ctx.moveTo(0, 140); ctx.lineTo(GW.SIZE, 140); } ctx.stroke();
    }
    function outline(el, col, w, dash) {
      var b = safeBox(el); if (!b) return;
      ctx.strokeStyle = col; ctx.lineWidth = w / k; ctx.setLineDash(dash ? [4 / k, 3 / k] : []);
      ctx.strokeRect(b.x - 1 / k, b.y - 1 / k, b.w + 2 / k, b.h + 2 / k);
    }
    var hov = hoverId && hoverId !== GW.selId ? GW.findEl(hoverId) : null;
    if (hov && !hov.hidden) outline(hov, 'rgba(0,229,255,.6)', 1, false);
    var sel = GW.selected();
    if (sel && !sel.hidden) {
      outline(sel, '#ffd400', 1.5, true);
      var p = GW.posPairs(sel)[0], x = sel[p[0]], y = sel[p[1]], s = 4 / k;
      ctx.setLineDash([]); ctx.strokeStyle = '#ffd400'; ctx.lineWidth = 1.5 / k;
      ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.moveTo(x, y - s); ctx.lineTo(x, y + s); ctx.stroke();
    }
    ctx.restore();
  }
  function safeBox(el) { try { return GW.elBox(el, ctx); } catch (e) { return null; } }

  // ---------- picking / dragging ----------
  function toDesign(e) {
    var r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * GW.SIZE, y: (e.clientY - r.top) / r.height * GW.SIZE };
  }
  function pick(x, y) {
    var els = GW.design.elements;
    for (var i = els.length - 1; i >= 0; i--) {
      var el = els[i]; if (el.hidden || el.locked) continue;
      try { if (GW.hitEl(el, x, y, ctx)) return el; } catch (e) { }
    }
    return null;
  }
  cv.addEventListener('pointerdown', function (e) {
    var p = toDesign(e), el = pick(p.x, p.y);
    GW.closeColor();
    if (!el) { GW.select(null); return; }
    if (GW.selId !== el.id) GW.select(el.id);
    var pairs = GW.posPairs(el);
    drag = { id: el.id, sx: p.x, sy: p.y, moved: false, orig: pairs.map(function (pr) { return [pr[0], pr[1], el[pr[0]], el[pr[1]]]; }) };
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', function (e) {
    var p = toDesign(e);
    $('coords').textContent = 'x ' + Math.round(p.x) + ' · y ' + Math.round(p.y);
    if (drag) {
      var el = GW.findEl(drag.id); if (!el) return;
      var dx = p.x - drag.sx, dy = p.y - drag.sy;
      if (!drag.moved && Math.hypot(dx, dy) < 1.5) return;
      drag.moved = true;
      var first = drag.orig[0], nx = first[2] + dx, ny = first[3] + dy;
      guides.x = guides.y = false;
      if (opts.snap && !e.shiftKey) {
        if (Math.abs(nx - 140) < 4) { dx += 140 - nx; guides.x = true; }
        if (Math.abs(ny - 140) < 4) { dy += 140 - ny; guides.y = true; }
      }
      drag.orig.forEach(function (o) { el[o[0]] = Math.round(o[2] + dx); el[o[1]] = Math.round(o[3] + dy); });
      GW.emit('drag');
    } else {
      var h = pick(p.x, p.y), id = h ? h.id : null;
      if (id !== hoverId) { hoverId = id; cv.style.cursor = id ? 'move' : 'crosshair'; schedule(); }
    }
  });
  function endDrag() {
    if (!drag) return;
    var moved = drag.moved; drag = null; guides.x = guides.y = false;
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
    if (mod && k === 's') { e.preventDefault(); GW.saveFile(); return; }
    var el = GW.selected();
    if (!el) return;
    if (k === 'delete' || k === 'backspace') { e.preventDefault(); GW.deleteSelected(); return; }
    if (k === 'escape') { GW.select(null); return; }
    var step = e.shiftKey ? 5 : 1, dx = 0, dy = 0;
    if (k === 'arrowleft') dx = -step; else if (k === 'arrowright') dx = step; else if (k === 'arrowup') dy = -step; else if (k === 'arrowdown') dy = step; else return;
    if (t && t.tagName === 'INPUT') return; // let range sliders use arrows
    e.preventDefault();
    GW.posPairs(el).forEach(function (p) { el[p[0]] += dx; el[p[1]] += dy; });
    GW.emit('drag');
    clearTimeout(nudgeT); nudgeT = setTimeout(function () { GW.history.commit(); }, 450);
  });

  // ---------- wiring ----------
  var uiQ = false;
  function scheduleLayers() { if (uiQ) return; uiQ = true; requestAnimationFrame(function () { uiQ = false; GW.renderLayers(); }); }
  GW.on('change', function () { schedule(); scheduleLayers(); });
  GW.on('drag', function () { schedule(); GW.refreshInspectorValues(); });
  GW.on('structure', function () {
    GW.renderLayers(); GW.renderPanel(); schedule();
    $('designName').value = GW.design.name;
  });
  GW.on('select', function (id) {
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
  $('btnSave').addEventListener('click', GW.saveFile);
  $('btnOpen').addEventListener('click', function () { $('fileOpen').click(); });
  $('fileOpen').addEventListener('change', function () {
    var f = this.files[0]; if (!f) return;
    var fr = new FileReader();
    fr.onload = function () {
      try { var obj = JSON.parse(fr.result); GW.loadFrom(obj, function () { GW.fontsReady().then(function () { GW.touch(true); GW.toast('Loaded ' + f.name); }); }); }
      catch (e) { GW.toast('That file is not a Watchface Studio design.'); }
    };
    fr.readAsText(f); this.value = '';
  });
  $('optSnap').addEventListener('change', function () { opts.snap = this.checked; });
  $('optGrid').addEventListener('change', function () { opts.grid = this.checked; schedule(); });
  $('optLive').addEventListener('change', function () { GW.sim.live = this.checked; schedule(); if (document.querySelector('#tabs button.on').dataset.tab === 'sim') GW.renderPanel(); });
  document.getElementById('tabs').addEventListener('click', function (e) { var b = e.target.closest('button[data-tab]'); if (b) GW.setTab(b.dataset.tab); });
  if (window.ResizeObserver) new ResizeObserver(schedule).observe(cv); else window.addEventListener('resize', schedule);
  setInterval(function () { if (GW.sim.live && !document.hidden) schedule(); }, 1000);
  window.addEventListener('beforeunload', function () { try { localStorage.setItem('gw.design.v1', JSON.stringify(GW.serialize())); } catch (e) { } });

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
    fetch('/api/device-image?meta=1').then(function (r) { return r.ok ? r.json() : null; }).then(function (m) {
      if (!m || !m.w) return;
      var src = new Image();
      src.onload = function () {
        var img = cutOutBackground(src);
        var w = document.querySelector('.watch'), g = w.querySelector('.glass');
        img.className = 'devimg'; img.alt = ''; w.insertBefore(img, g);
        w.classList.add('dev');
        w.style.setProperty('--ar', m.w + ' / ' + m.h);
        w.style.setProperty('--rat', m.w / m.h);
        g.style.left = ((m.x + m.size / 2) / m.w * 100) + '%';
        g.style.top = ((m.y + m.size / 2) / m.h * 100) + '%';
        g.style.width = (m.size / m.w * 100) + '%';
        schedule();
      };
      src.src = '/api/device-image';
    }).catch(function () { });
  }

  // ---------- boot ----------
  useDevicePicture();
  GW.renderAdd();
  GW.fontsReady().then(function () {
    var saved = GW.loadSaved();
    function done() {
      GW.fontsReady().then(function () { GW.touch(true); GW.emit('history'); document.documentElement.classList.add('ready'); });
    }
    if (saved && saved.design && saved.design.elements) GW.loadFrom(saved, done);
    else GW.applyPreset('orbit', done);
  });
  GW.stage = { schedule: schedule, opts: opts };
})(window.GW);
