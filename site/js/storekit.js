/* Store kit: what the Connect IQ store asks for besides the .iq file, made from the face: screenshots (one per scene and per color theme),
   a cover picture, a 500 px icon and a description with the facts of the face. The picture sizes come from what developers report on the
   Garmin forums (Garmin's own page does not list them): 500 x 500 px, a screenshot under 150 KB, cover and icon under 300 KB. */
(function (GW) {
  'use strict';
  var h = GW.ui.h, S = GW.settings;

  function pngBytes(canvas, type, q) {
    return new Promise(function (res, rej) {
      canvas.toBlob(function (b) {
        if (!b) return rej(new Error('Image encode failed'));
        var fr = new FileReader(); fr.onload = function () { res(new Uint8Array(fr.result)); }; fr.readAsArrayBuffer(b);
      }, type || 'image/png', q);
    });
  }
  // a screenshot under the size limit: the same picture, a little smaller each try (a PNG of a busy face can pass 150 KB at 500 px)
  function fit(item, limit) {
    var sizes = [500, 470, 440, 410, 380, 350];
    return (function next(i) {
      var cv = face(item, sizes[i]);
      return pngBytes(cv).then(function (b) { return (b.length <= limit || i === sizes.length - 1) ? { canvas: cv, bytes: b, px: sizes[i] } : next(i + 1); });
    })(0);
  }

  // ---------- scenes: the same face at different times of day and in each color theme ----------
  var SCENES = [
    { id: 'day', label: 'Mid-morning', h: 10, m: 9, sec: 36, sim: {} },
    { id: 'morning', label: 'Early morning', h: 6, m: 32, sec: 12, sim: { steps: 1240, calories: 310, floors: 1, battery: 96, batteryDays: 9.1, hr: 58, bodyBat: 92, stress: 14, intMins: 0, distance: 0.9, notif: 0 } },
    { id: 'evening', label: 'Evening', h: 19, m: 42, sec: 5, sim: { steps: 11850, calories: 2140, floors: 14, battery: 41, batteryDays: 3.2, hr: 72, bodyBat: 38, stress: 33, intMins: 160, distance: 9.4, notif: 5 } }
  ];

  function plan(max) {
    var out = [{ scene: SCENES[0], theme: null, name: 'Original colors' }];
    var th = S.theme(GW.design);
    if (th && th.themes.length) th.themes.forEach(function (t) { out.push({ scene: SCENES[0], theme: t, name: t.name || 'Theme' }); });
    var i = 1;
    while (out.length < Math.min(max, 5) && i < SCENES.length) out.push({ scene: SCENES[i++], theme: null, name: SCENES[i - 1].label });
    return out.slice(0, max);
  }

  function envFor(scene) {
    var e = GW.fixedEnv(); e.h = scene.h; e.m = scene.m; e.sec = scene.sec;
    e.sim = Object.assign({}, e.sim, scene.sim, { minutes: scene.h * 60 + scene.m, seconds: scene.sec });
    return e;
  }

  function designFor(item) {
    var d = GW.clone(GW.design);
    if (item.theme) S.colors(d).forEach(function (r) { S.applyDefault(r, d, S.themeColor(item.theme, r)); });
    return d;
  }

  // the face as the watch draws it, in a round picture of px × px (transparent outside the round screen)
  function face(item, px) {
    var N = GW.SIZE, d = designFor(item), live = GW.design, c = document.createElement('canvas');
    c.width = c.height = N; var x = c.getContext('2d', { willReadFrequently: true });
    GW.design = d;
    try { GW.renderExact(x, d, envFor(item.scene), false); } finally { GW.design = live; }
    var o = document.createElement('canvas'); o.width = o.height = px; var ox = o.getContext('2d'), ring = Math.max(3, Math.round(px / 70));
    ox.imageSmoothingEnabled = true; ox.imageSmoothingQuality = 'high';
    ox.save(); ox.beginPath(); ox.arc(px / 2, px / 2, px / 2 - ring / 2, 0, Math.PI * 2); ox.clip(); ox.drawImage(c, ring, ring, px - 2 * ring, px - 2 * ring); ox.restore();
    ox.lineWidth = ring; ox.strokeStyle = '#25282d'; ox.beginPath(); ox.arc(px / 2, px / 2, px / 2 - ring / 2, 0, Math.PI * 2); ox.stroke();
    return o;
  }

  function cover(items, title) {
    var W = 1440, H = 720, c = document.createElement('canvas'); c.width = W; c.height = H; var x = c.getContext('2d');
    var g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0d1013'); g.addColorStop(1, '#222a33'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    var main = face(items[0], 560); x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = 40; x.shadowOffsetY = 14;
    if (items[2]) x.drawImage(face(items[2], 280), 1120, 400);
    if (items[1]) x.drawImage(face(items[1], 280), 1120, 40);
    x.drawImage(main, 590, 80); x.shadowBlur = 0; x.shadowOffsetY = 0;
    x.fillStyle = '#fff'; x.textBaseline = 'alphabetic';
    var size = 84, name = String(title || 'Watch face');
    x.font = '700 ' + size + 'px "DM Sans", "Helvetica Neue", Arial, sans-serif';
    while (x.measureText(name).width > 480 && size > 36) { size -= 4; x.font = '700 ' + size + 'px "DM Sans", "Helvetica Neue", Arial, sans-serif'; }
    x.fillText(name, 80, 330);
    x.fillStyle = '#9aa4b0'; x.font = '400 32px "DM Sans", "Helvetica Neue", Arial, sans-serif';
    x.fillText('Watch face for the ' + GW.DEVICE.name, 80, 386);
    return c;
  }

  function icon(item) {
    var c = document.createElement('canvas'); c.width = c.height = 500; var x = c.getContext('2d');
    x.fillStyle = '#14171b'; x.beginPath(); x.roundRect ? x.roundRect(0, 0, 500, 500, 90) : x.rect(0, 0, 500, 500); x.fill();
    x.drawImage(face(item, 430), 35, 35);
    return c;
  }

  // ---------- the description, from what the face really contains ----------
  function describe(results) {
    var d = GW.design, els = d.elements || [], seen = {}, shows = [];
    function add(t) { if (t && !seen[t]) { seen[t] = 1; shows.push(t); } }
    els.forEach(function (e) {
      if (e.hidden) return;
      if ((e.type === 'text' || e.type === 'arc' || e.type === 'seggauge') && e.source && e.source !== 'custom' && GW.sources[e.source]) add(GW.sources[e.source].label.replace(/\s*\(.*$/, ''));
      else if (e.type === 'hands') add('Analog hands');
      else if (e.type === 'moon') add('Moon phase');
      else if (e.type === 'worldmap') add('World map');
      else if (e.type === 'wxicon') add('Weather');
      else if (e.type === 'barchart') add('Last 7 days chart');
      else if (e.type === 'binary') add('Binary clock');
      else if (e.type === 'movebar') add('Move bar');
      else if (e.type === 'sunmark' || e.type === 'sunicon') add('Sunrise and sunset');
    });
    var lines = [], name = d.name || 'Watch face';
    lines.push(name + ' is a watch face for the ' + GW.DEVICE.name + '.', '');
    if (shows.length) lines.push('What it shows:', shows.slice(0, 16).map(function (s) { return '• ' + s; }).join('\n'), '');
    var roles = S.colors(d), th = S.theme(d), slots = S.slots(d).filter(function (s) { return s.choices && s.choices.length > 1; });
    var cust = [];
    if (th && th.themes.length) cust.push('• Color themes: ' + ['Original'].concat(th.themes.map(function (t) { return t.name; })).join(', '));
    else if (roles.length) cust.push('• Colors: ' + roles.map(function (r) { return (r.label || r.id).toLowerCase(); }).join(', '));
    slots.forEach(function (s) { cust.push('• ' + (s.label || 'Data') + ' can show: ' + s.choices.map(function (c) { return GW.sources[c] ? GW.sources[c].label.replace(/\s*\(.*$/, '') : c; }).join(', ')); });
    if (cust.length) lines.push('Customize it in the Garmin Connect IQ or Garmin Connect app (Settings):', cust.join('\n'), '');
    var src = results && results[0] && results[0].src, perms = src && src.perms ? Object.keys(src.perms) : [];
    var need = [];
    if (/Positioning/.test(perms.join())) need.push('location (for sunrise and sunset)');
    if (/UserProfile/.test(perms.join())) need.push('your profile (for your goals and heart-rate zones)');
    if (/Complication/.test(perms.join())) need.push('Garmin data fields (for running distance)');
    if (need.length) lines.push('It reads: ' + need.join(', ') + '.', '');
    lines.push('Works on: ' + GW.DEVICE.name + '. Needs Connect IQ 3.2 or newer.');
    return lines.join('\n');
  }

  // ---------- the dialog ----------
  function kb(n) { return Math.round(n / 1024) + ' KB'; }
  GW.openStoreKit = function (results) {
    var body = h('div', {}, [h('p', { class: 'muted', text: 'Making pictures…' })]);
    GW.ui.modal('Store listing kit', body, true);
    var items = plan(5), files = [], desc = describe(results), nm = GW.slug(GW.design.name) || 'watchface';
    var jobs = items.map(function (it, i) { return fit(it, 148 * 1024).then(function (r) { return { path: 'screenshot-' + (i + 1) + '.png', bytes: r.bytes, canvas: r.canvas, label: it.name + (r.px < 500 ? ' (' + r.px + ' px, to stay under 150 KB)' : ''), limit: 150 * 1024 }; }); });
    var cvr = cover(items, GW.design.name), ic = icon(items[0]);
    jobs.push(pngBytes(cvr, 'image/jpeg', 0.85).then(function (b) { return { path: 'cover-1440x720.jpg', bytes: b, canvas: cvr, label: 'Cover picture', limit: 300 * 1024, wide: true, type: 'image/jpeg' }; }));
    jobs.push(pngBytes(ic).then(function (b) { return { path: 'icon-500.png', bytes: b, canvas: ic, label: 'Icon', limit: 300 * 1024 }; }));
    Promise.all(jobs).then(function (list) {
      body.innerHTML = '';
      body.appendChild(h('p', { class: 'muted small', text: 'Made from your face the way the watch draws it. Upload them at apps.garmin.com/developer when you add the .iq: screenshots under "Screen images", the cover under "Cover image".' }));
      var grid = h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin:10px 0' });
      list.forEach(function (f) {
        var url = URL.createObjectURL(new Blob([f.bytes], { type: f.type || 'image/png' })), big = f.bytes.length > f.limit;
        grid.appendChild(h('div', { style: 'text-align:center;' + (f.wide ? 'grid-column:span 2' : '') }, [
          h('img', { src: url, alt: f.label, style: 'max-width:100%;border-radius:8px;background:#e9e7e1' }),
          h('div', { class: 'muted small', text: f.label }),
          h('div', { class: 'small' + (big ? ' warn' : ''), style: big ? 'color:#b3261e' : 'color:var(--muted)', text: f.path + ' · ' + kb(f.bytes.length) + (big ? ' (over ' + kb(f.limit) + ': shrink it before uploading)' : '') })
        ]));
      });
      body.appendChild(grid);
      var ta = h('textarea', { rows: 14, style: 'width:100%;font:13px/1.4 ui-monospace,monospace', 'aria-label': 'Store description' }); ta.value = desc;
      body.appendChild(h('h4', { style: 'margin:14px 0 6px', text: 'Description (edit it, then paste it into the store page)' }));
      body.appendChild(ta);
      body.appendChild(h('div', { class: 'row', style: 'gap:10px;margin:10px 0;flex-wrap:wrap' }, [
        h('button', { class: 'btn primary', text: '⬇ Download all (' + nm + '-store.zip)', onclick: function () {
          var z = list.map(function (f) { return { path: nm + '-store/' + f.path, data: f.bytes }; });
          z.push({ path: nm + '-store/description.txt', data: ta.value });
          GW.download(GW.zip(z), nm + '-store.zip');
        } }),
        h('button', { class: 'btn', text: 'Copy description', onclick: function () { ta.select(); try { document.execCommand('copy'); GW.toast('Description copied'); } catch (e) { } } })
      ]));
      body.appendChild(h('p', { class: 'muted small', text: 'Picture sizes are what developers report on the Garmin forums (500 × 500 px, a screenshot under 150 KB, cover and icon under 300 KB); Garmin\'s own page does not list them, so check the upload form. Faces with several color themes get one screenshot per theme (up to five).' }));
    }).catch(function (e) { body.innerHTML = ''; body.appendChild(h('p', { class: 'note warn', text: 'Could not make the pictures: ' + e.message })); });
  };

  GW.storeBox = function (results) {
    return h('div', { class: 'card', style: 'margin:14px 0;background:var(--panel2)' }, [
      h('div', { class: 'row', style: 'align-items:center;gap:12px;flex-wrap:wrap' }, [
        h('button', { class: 'btn', style: 'padding:11px 16px', text: '🖼 Store listing kit…', onclick: function () { GW.openStoreKit(results); } }),
        h('span', { class: 'muted small', text: 'Screenshots, cover picture, icon and a description for the Connect IQ store, made from this face.' })
      ])
    ]);
  };
})(window.GW);
