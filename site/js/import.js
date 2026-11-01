/* Open a .prg or .iq that Garmin Studio built: the editable design is stored inside it as a text resource. */
(function (GW) {
  'use strict';
  var seven = null, runs = 0;
  function loadSevenZip() {   // .iq files are 7-Zip archives; a small WebAssembly copy of 7-Zip (bundled with the site) opens them
    if (seven) return seven;
    seven = import('../vendor/7z/7zz.es6.js').then(function (m) { return m.default({ locateFile: function (f) { return 'vendor/7z/' + f; } }); });
    return seven;
  }
  function latin1(u8) { var s = '', CH = 0x8000; for (var i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH)); return s; }
  function find(u8) {
    var s = latin1(u8), a = s.indexOf('GWD1_'); if (a < 0) return null;
    var b = s.indexOf('_GWD1', a + 5); if (b < 0) return null;
    return s.slice(a + 5, b);
  }
  function unpack(b64) {
    if (!b64) return Promise.reject(new Error('This build has no editable design in it (it was too big to include).'));
    var bin = atob(b64), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text().then(function (t) { return JSON.parse(t); }).catch(function (e) {
      console.error('could not read the design inside the file', e);
      var err = new Error('The design inside this file could not be read (' + (e && e.message || e) + ').'); err.final = true; throw err;
    });
  }
  function walk(z, dir, out) {
    z.FS.readdir(dir).forEach(function (n) {
      if (n === '.' || n === '..') return;
      var p = dir + '/' + n, st = z.FS.stat(p);
      if (z.FS.isDir(st.mode)) walk(z, p, out); else out.push(p);
    });
    return out;
  }
  function isPrg(u8) { return u8.length > 16 && u8[0] === 0xD0 && u8[1] === 0x00 && u8[2] === 0xD0 && (u8[3] === 0x00 || u8[3] === 0x0D); }
  // a compiled app from somewhere else: read its drawing code (see prgimport.js)
  function fromCompiled(u8, name) {
    var res = GW.prgImport.importPrg(u8, { name: name }), assets = {};
    Object.keys(res.assets).forEach(function (id) {
      var a = res.assets[id], c = document.createElement('canvas'); c.width = a.w; c.height = a.h;
      c.getContext('2d').putImageData(new ImageData(a.rgba, a.w, a.h), 0, 0); assets[id] = c.toDataURL('image/png');
    });
    var d = res.design;
    d.elements = d.elements.map(function (e) {
      var t = GW.types[e.type]; return Object.assign({ id: GW.uid('e'), hidden: false, locked: false }, t.defaults(), e);
    });
    return { v: 1, design: d, assets: assets, report: res.report, fromCompiled: true };
  }
  GW.importBuild = function (file) {
    var base = String(file.name || 'Imported face').replace(/\.[^.]+$/, '');
    return file.arrayBuffer().then(function (buf) {
      var u8 = new Uint8Array(buf), hit = find(u8);
      if (hit != null) return unpack(hit);
      if (isPrg(u8)) return fromCompiled(u8, base);
      return loadSevenZip().catch(function (e) {
        console.error('7-Zip reader failed to load', e);
        var err = new Error('The reader for .iq / .zip files could not load (' + (e && e.message || e) + '). Reload the page (Cmd/Ctrl+Shift+R) and try again.'); err.final = true; throw err;
      }).then(function (z) {
        var id = ++runs, name = 'in' + id + '.bin', dir = 'out' + id;   // a fresh folder per file: the 7-Zip copy keeps its files between runs
        z.FS.writeFile(name, u8);
        try { z.callMain(['x', name, '-o' + dir, '-y']); } catch (e) { /* an unreadable archive leaves nothing in the folder */ }
        var files = []; try { walk(z, '/' + dir, files); } catch (e) { }
        var datas = files.map(function (f) { return { f: f, d: z.FS.readFile(f) }; }), i;
        for (i = 0; i < datas.length; i++) { var h = find(datas[i].d); if (h != null) return unpack(h); }
        for (i = 0; i < datas.length; i++) if (/\.prg$/i.test(datas[i].f) && isPrg(datas[i].d)) return fromCompiled(datas[i].d, base);
        throw new Error('nothing to open');
      });
    }).catch(function (e) {
      if (e.final || /no editable design/.test(e.message)) throw e;
      if (/nothing to open/.test(e.message)) throw new Error('This file is not a Garmin app Garmin Studio can read.');
      console.error('import failed', e);
      throw new Error('Could not turn this file into a design: ' + e.message);
    });
  };
})(window.GW);
