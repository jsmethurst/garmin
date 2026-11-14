/* Watch settings: things the wearer can change on the phone (Garmin Connect / Connect IQ app / Garmin Express) without a rebuild.

   COLORS are roles: Background, Main color, Highlight color (and any you add). Elements point at a role (el.set = { color:'cmain' }, design.bgSet = 'cbg').
   design.colorMode decides how the wearer changes them:
     'none'   the roles are only a convenience in the designer, nothing is offered on the phone
     'theme'  ONE list on the phone, "Color theme" (Original, Ocean, Fire, ...); each theme gives every role a color   <- the friendly way
     'each'   one 64-color list per role
   design.settings holds: { id, kind:'color', label, def, keep }  roles;  { id:'ct', kind:'theme', label, themes:[{ name, colors:{ roleId:'#hex' } }] } (the first theme, "Original", is the roles' own colors);
   and DATA SLOTS { id, kind:'source', label, choices:[sourceIds], labels:{src:'STEPS'}, affix:{src:{prefix,suffix}} }.

   A data slot is a group of layers that change together. Layers say they belong with el.srcSet = slotId:
     a value (text showing a reading), a label (text with source 'custom'), an icon, a gauge (arc / segment gauge).
   When the wearer picks another reading the value, the label text, the icon and the gauge all follow.

   On export a role's color becomes a class variable filled from Application.Properties (read once at start and when the settings change, never per frame);
   an element of a data slot is generated once per choice and drawn according to the slot's variable. */
(function (GW) {
  'use strict';

  // ---------- names for the 64 colors (what the wearer sees in the phone app) ----------
  var HUES = ['Red', 'Orange', 'Yellow', 'Lime', 'Green', 'Mint', 'Cyan', 'Sky', 'Blue', 'Violet', 'Magenta', 'Pink'];
  function colorName(hex) {
    var q = GW.q(hex), v = [1, 3, 5].map(function (i) { return parseInt(q.substr(i, 2), 16) / 85; });   // 0..3 per channel
    var r = v[0], g = v[1], b = v[2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx === mn) return ['Black', 'Dark gray', 'Light gray', 'White'][mx];
    var rr = r / 3, gg = g / 3, bb = b / 3, M = mx / 3, m = mn / 3, d = M - m, H;
    if (M === rr) H = ((gg - bb) / d + 6) % 6; else if (M === gg) H = (bb - rr) / d + 2; else H = (rr - gg) / d + 4;
    var name = HUES[Math.round(H * 2) % 12];
    var tone = mx <= 1 ? 'Dark ' : (mn >= 2 ? 'Light ' : (mn >= 1 && mx === 3 ? 'Pale ' : ''));
    return tone ? tone + name.toLowerCase() : name;
  }
  // unique, readable names for the whole palette (a repeated name gets its hex code)
  var NAMES = (function () {
    var seen = {}, out = [];
    GW.PALETTE.forEach(function (h) { var n = colorName(h); seen[n] = (seen[n] || 0) + 1; });
    var used = {};
    GW.PALETTE.forEach(function (h) {
      var n = colorName(h); if (seen[n] > 1) { used[n] = (used[n] || 0) + 1; if (used[n] > 1) n += ' ' + h.toUpperCase(); }
      out.push(n);
    });
    return out;
  })();
  GW.COLOR_NAMES = NAMES;
  function num(hex) { return parseInt(GW.q(hex).slice(1), 16); }

  // ---------- ready-made color themes: [name, background, main, highlight] ----------
  GW.THEME_LIBRARY = [
    ['Midnight', '#000000', '#ffffff', '#55aaff'], ['Fire', '#000000', '#ff5500', '#ffaa00'], ['Forest', '#000000', '#55ff55', '#aaff00'],
    ['Ice', '#000055', '#aaffff', '#ffffff'], ['Royal', '#000055', '#55aaff', '#ffff00'], ['Rose', '#000000', '#ff55aa', '#ffaaff'],
    ['Mono', '#000000', '#aaaaaa', '#ffffff'], ['Daylight', '#ffffff', '#000000', '#ff0000'], ['Sunset', '#550000', '#ffaa55', '#ff5555'],
    ['Matrix', '#000000', '#00ff00', '#55ff55'], ['Amber', '#000000', '#ffaa00', '#ffff55'], ['Violet', '#000000', '#aa55ff', '#ff55ff']
  ];
  // short labels for the text that names a reading ("STEPS", "HR"); anything else is the reading's name in capitals, cut short
  var SHORT = { steps: 'STEPS', stepGoal: 'GOAL', calories: 'CAL', floors: 'FLOORS', intMins: 'MIN', distance: 'DIST', workoutDist: 'DIST', altitude: 'ALT', battery: 'BATT', batteryDays: 'DAYS',
    bodyBat: 'BODY', hr: 'HR', stress: 'STRESS', resp: 'RESP', spo2: 'SPO2', notif: 'MSG', temp: 'TEMP', weatherDesc: 'WEATHER', sunrise: 'RISE', sunset: 'SET', date: 'DATE', time: 'TIME' };
  var AFFIX = { battery: '%', spo2: '%', temp: '°', bodyBat: '%', hr: 'BPM', batteryDays: 'd', moonIllum: '%', calories: 'kcal', distance: 'km', altitude: 'm' };
  var UNITLIKE = /^\s*(bpm|%|°[cf]?|km|mi|m|ft|min|h|d|kcal|cal|steps|days|brpm|mph|km\/h)\s*$/i;   // a fixed text like this is a unit, not a name
  GW.sourceShort = function (c) { var s = GW.sources[c]; return SHORT[c] || (s ? s.label.toUpperCase().slice(0, 8) : String(c).toUpperCase()); };

  // ---------- the list ----------
  var scratchCtx = null;
  function box(el) { if (!scratchCtx) scratchCtx = document.createElement('canvas').getContext('2d'); return GW.elBox(el, scratchCtx); }
  var S = GW.settings = {
    all: function (d) {
      d = d || GW.design; var l = d.settings || (d.settings = []);
      l.forEach(function (s) { if (s.kind === 'source') { s.choices = s.choices || []; s.labels = s.labels || {}; s.affix = s.affix || {}; } });
    if (!d.ctextFix) {          // an earlier version gave every theme a computed Main text color; Main text keeps its own color unless a theme sets it by hand
      d.ctextFix = 1;
      l.forEach(function (t) { if (t.kind === 'theme') t.themes.forEach(function (x) {
        var b = GW.q((x.colors && x.colors.cbg) || d.bg), lum = [1, 3, 5].reduce(function (a, i) { return a + parseInt(b.substr(i, 2), 16); }, 0), auto = lum > 380 ? '#000000' : '#ffffff';
        if (x.colors && x.colors.ctext && GW.q(x.colors.ctext) === auto) delete x.colors.ctext;
      }); });
    }
    l.forEach(function (s) { if (s.kind === 'source' && s.choices && S.hasUnit(s, d)) S.members(s.id, d).forEach(function (e) { if (S.roleOf(e) === 'value' && e.suffix) e.suffix = ''; }); });   // a separate unit layer carries the unit, so the value gets none   // slots saved by earlier versions have no label / unit tables
      return l;
    },
    find: function (id, d) { var l = S.all(d); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; },
    colors: function (d) { return S.all(d).filter(function (s) { return s.kind === 'color'; }); },
    slots: function (d) { return S.all(d).filter(function (s) { return s.kind === 'source'; }); },
    theme: function (d) { return S.all(d).filter(function (s) { return s.kind === 'theme'; })[0] || null; },
    mode: function (d) { d = d || GW.design; return d.colorMode || 'each'; },
    nextId: function (p, d) { var n = 1; d = d || GW.design; while (S.find(p + n, d)) n++; return p + n; },
    // how many places use a setting
    uses: function (id, d) {
      d = d || GW.design; var n = 0;
      d.elements.forEach(function (e) { if (e.srcSet === id) n++; if (e.set) Object.keys(e.set).forEach(function (k) { if (e.set[k] === id) n++; }); });
      if (d.bgSet === id) n++;
      return n;
    },
    // the three standard roles are created on first use
    ROLE: { bg: ['cbg', 'Background'], main: ['cmain', 'Main color'], hi: ['chi', 'Highlight color'], text: ['ctext', 'Main text'] },
    ensureRole: function (key, def, d) {
      d = d || GW.design; var r = S.ROLE[key], s = S.find(r[0], d);
      if (!s) { s = { id: r[0], kind: 'color', label: r[1], def: GW.q(def || '#ffffff'), keep: true }; S.all(d).push(s); }
      if (!d.colorMode) d.colorMode = 'theme';
      return s;
    },
    addColor: function (label, def, d) {
      d = d || GW.design;
      var s = { id: S.nextId('c', d), kind: 'color', label: label || 'Color ' + (S.colors(d).length + 1), def: GW.q(def || '#ffffff') };
      S.all(d).push(s); if (!d.colorMode) d.colorMode = 'theme'; return s;
    },
    // every place that uses a color role takes its starting color (so the preview shows what the watch shows before anyone changes a setting)
    applyDefault: function (s, d) {
      d = d || GW.design;
      d.elements.forEach(function (e) { if (e.set) Object.keys(e.set).forEach(function (k) { if (e.set[k] === s.id) e[k] = s.def; }); });
      if (d.bgSet === s.id) d.bg = s.def;
    },
    unmapAll: function (id, d) {
      d = d || GW.design;
      d.elements.forEach(function (e) {
        if (e.srcSet === id) delete e.srcSet;
        if (e.set) { Object.keys(e.set).forEach(function (k) { if (e.set[k] === id) delete e.set[k]; }); if (!Object.keys(e.set).length) delete e.set; }
      });
      if (d.bgSet === id) delete d.bgSet;
    },
    remove: function (id, d) {
      d = d || GW.design; S.unmapAll(id, d);
      d.settings = S.all(d).filter(function (s) { return s.id !== id; });
      var th = S.theme(d); if (th) th.themes.forEach(function (t) { delete t.colors[id]; });
    },
    // settings nobody uses any more disappear by themselves (the standard roles stay while you keep them)
    prune: function (d) {
      d = d || GW.design;
      d.settings = S.all(d).filter(function (s) {
        if (s.kind === 'color') return S.uses(s.id, d) > 0 || s.keep;
        if (s.kind === 'source') return S.uses(s.id, d) > 0;
        return true;
      });
      if (!S.colors(d).length) d.settings = d.settings.filter(function (s) { return s.kind !== 'theme'; });
    },

    // ----- themes -----
    ensureTheme: function (d) {
      d = d || GW.design; var t = S.theme(d);
      if (!t) { t = { id: 'ct', kind: 'theme', label: 'Color theme', themes: [] }; S.all(d).push(t); }
      return t;
    },
    // a theme from the library: background, main, highlight go to the matching roles; other roles keep their starting color
    addLibraryTheme: function (lib, d) {
      d = d || GW.design; var t = S.ensureTheme(d), c = {};
      var bg = S.find('cbg', d), mn = S.find('cmain', d), hi = S.find('chi', d);
      if (bg) c.cbg = GW.q(lib[1]); if (mn) c.cmain = GW.q(lib[2]); if (hi) c.chi = GW.q(lib[3]);
      t.themes.push({ name: lib[0], colors: c }); return t;
    },
    addBlankTheme: function (d) {
      d = d || GW.design; var t = S.ensureTheme(d), c = {};
      S.colors(d).forEach(function (r) { c[r.id] = r.def; });
      t.themes.push({ name: 'Theme ' + (t.themes.length + 1), colors: c }); return t;
    },
    themeColor: function (th, role) { return GW.q((th.colors && th.colors[role.id]) || role.def); },

    // "Main text": the color of the face's ordinary text; every text layer that uses it follows the role
    addTextRole: function (d) {
      d = d || GW.design; var ex = S.find('ctext', d); if (ex) return ex;
      var hist = {}; d.elements.forEach(function (e) { if (e.type === 'text' && typeof e.color === 'string' && e.color[0] === '#' && !(e.set && e.set.color)) { var v = GW.q(e.color); hist[v] = (hist[v] || 0) + 1; } });
      var top = Object.keys(hist).sort(function (a, b) { return hist[b] - hist[a]; })[0] || '#ffffff';
      var r = S.ensureRole('text', top, d); r.def = top;
      d.elements.forEach(function (e) { if (e.type === 'text' && typeof e.color === 'string' && GW.q(e.color) === top && !(e.set && e.set.color)) { e.set = e.set || {}; e.set.color = 'ctext'; } });
      return r;
    },

    // ----- choosing the main and highlight colors from what the face already uses -----
    COLOR_KEYS: ['color', 'hColor', 'mColor', 'majorColor', 'todayColor', 'lit', 'on'],
    detect: function (d) {
      d = d || GW.design;
      var bg = GW.q(d.bg), hist = {};
      d.elements.forEach(function (e) {
        S.COLOR_KEYS.forEach(function (k) {
          var v = e[k]; if (typeof v !== 'string' || v[0] !== '#') return; v = GW.q(v); if (v === bg) return;
          hist[v] = (hist[v] || 0) + 1;
        });
      });
      function sat(c) { var v = [1, 3, 5].map(function (i) { return parseInt(c.substr(i, 2), 16); }); return Math.max.apply(null, v) - Math.min.apply(null, v); }
      function dist(a, b) { var s = 0; [1, 3, 5].forEach(function (i) { s += Math.abs(parseInt(a.substr(i, 2), 16) - parseInt(b.substr(i, 2), 16)); }); return s; }
      var cols = Object.keys(hist).sort(function (a, b) { return hist[b] * (sat(b) ? 1 : 0.7) - hist[a] * (sat(a) ? 1 : 0.7); });
      var main = cols[0], hi = cols.filter(function (c) { return c !== main && dist(c, main) >= 170; })[0] || cols[1];
      S.ensureRole('bg', d.bg, d); d.bgSet = 'cbg';
      var out = { main: null, hi: null };
      if (main) { var r = S.ensureRole('main', main, d); r.def = main; out.main = main; }
      if (hi) { var r2 = S.ensureRole('hi', hi, d); r2.def = hi; out.hi = hi; }
      var bgR = S.find('cbg', d); bgR.def = bg;
      d.elements.forEach(function (e) {
        S.COLOR_KEYS.forEach(function (k) {
          var v = e[k]; if (typeof v !== 'string' || v[0] !== '#') return; v = GW.q(v);
          var id = (out.main && v === out.main) ? 'cmain' : ((out.hi && v === out.hi) ? 'chi' : null);
          if (id) { e.set = e.set || {}; e.set[k] = id; }
        });
      });
      return out;
    },

    // ----- data slots -----
    members: function (id, d) { d = d || GW.design; return d.elements.filter(function (e) { return e.srcSet === id; }); },
    roleOf: function (e) {          // what a layer does in a data slot
      if (e.type === 'icon') return 'icon';
      if (e.type === 'text') return e.source === 'custom' ? ((e.srcRole || (UNITLIKE.test(e.text || '') ? 'unit' : 'label')) === 'unit' ? 'unit' : 'label') : 'value';
      if (e.type === 'arc' || e.type === 'seggauge') return 'gauge';
      return null;
    },
    // the reading the slot shows now: the value (or gauge) layer's source
    startChoice: function (s, d) {
      var m = S.members(s.id, d).filter(function (e) { return S.roleOf(e) === 'value' || S.roleOf(e) === 'gauge'; })[0];
      return (m && m.source) || s.choices[0];
    },
    newSlot: function (label, d) {
      d = d || GW.design; var s = { id: S.nextId('s', d), kind: 'source', label: label || 'Data ' + (S.slots(d).length + 1), choices: [], labels: {}, affix: {} };
      S.all(d).push(s); return s;
    },
    // add a layer to a slot; icons and labels sitting next to a value come along (returns the names added)
    addMember: function (s, el, d) {
      d = d || GW.design; var added = [];
      function put(e) {
        if (!e || e.srcSet === s.id || !S.roleOf(e)) return;
        e.srcSet = s.id; added.push(e.name || e.type);
        if (e.type === 'text' && e.source === 'custom' && !e.srcRole) e.srcRole = S.roleOf(e) === 'unit' || S.members(s.id, d).some(function (o) { return o !== e && S.roleOf(o) === 'label'; }) ? 'unit' : 'label';   // a second fixed text next to a name is the unit
        var r = S.roleOf(e);
        if (r === 'value' || r === 'gauge') {
          if (s.choices.indexOf(e.source) < 0) s.choices.unshift(e.source);
          if (r === 'value' && !s.affix[e.source]) s.affix[e.source] = { prefix: e.prefix || '', suffix: e.suffix || '' };
        }
      }
      put(el);
      if (S.roleOf(el) === 'value' || S.roleOf(el) === 'gauge') {
        var b; try { b = box(el); } catch (x) { b = null; }
        if (b) {
          var best = { icon: null, label: null }, lim = { icon: 9, label: 16 };          // only the single nearest icon and label, close by
          d.elements.forEach(function (o) {
            if (o === el || o.srcSet || o.hidden) return;
            var r = S.roleOf(o); if (r !== 'icon' && r !== 'label') return;
            var ob; try { ob = box(o); } catch (x) { return; }
            var gx = Math.max(0, Math.max(ob.x - (b.x + b.w), b.x - (ob.x + ob.w))), gy = Math.max(0, Math.max(ob.y - (b.y + b.h), b.y - (ob.y + ob.h))), g = gx + gy;
            if (gx <= lim[r] && gy <= lim[r] && (!best[r] || g < best[r].g)) best[r] = { e: o, g: g };
          });
          if (!best.icon) {                                                       // none right beside it: the nearest icon on the same line
            var cy = b.y + b.h / 2;
            d.elements.forEach(function (o) {
              if (o === el || o.srcSet || o.hidden || S.roleOf(o) !== 'icon') return;
              var ob; try { ob = box(o); } catch (x) { return; }
              var gx = Math.max(0, Math.max(ob.x - (b.x + b.w), b.x - (ob.x + ob.w)));
              if (gx <= 34 && Math.abs(ob.y + ob.h / 2 - cy) <= Math.max(10, b.h) && (!best.icon || gx < best.icon.g)) best.icon = { e: o, g: gx };
            });
          }
          if (best.icon) put(best.icon.e); if (best.label) put(best.label.e);
        }
      }
      return added;
    },
    removeMember: function (s, el) { delete el.srcSet; },
    // the text that names a reading, and what goes before / after its value: for the reading shown now they are the layers' own text
    labelOf: function (s, c, d) { var st = S.startChoice(s, d); if (c === st) { var m = S.members(s.id, d).filter(function (e) { return S.roleOf(e) === 'label'; })[0]; return m ? m.text || '' : ''; } return s.labels[c] != null ? s.labels[c] : GW.sourceShort(c); },
    setLabel: function (s, c, txt, d) { s.labels[c] = txt; if (c === S.startChoice(s, d)) S.members(s.id, d).forEach(function (e) { if (S.roleOf(e) === 'label') e.text = txt; }); },
    suffixOf: function (s, c, d) { if (c === S.startChoice(s, d)) { var ms = S.members(s.id, d), m = ms.filter(function (e) { return S.roleOf(e) === 'value'; })[0], u = ms.filter(function (e) { return S.roleOf(e) === 'unit'; })[0]; return u ? u.text || '' : (m ? m.suffix || '' : ''); } return (s.affix[c] || {}).suffix || ''; },
    setSuffix: function (s, c, txt, d) { s.affix[c] = Object.assign({}, s.affix[c], { suffix: txt }); if (c === S.startChoice(s, d)) S.members(s.id, d).forEach(function (e) { if (S.roleOf(e) === 'value') e.suffix = txt; else if (S.roleOf(e) === 'unit') e.text = txt; }); },
    addChoice: function (s, c) {
      if (s.choices.indexOf(c) >= 0) return;
      s.choices.push(c); if (!s.affix[c]) s.affix[c] = { prefix: '', suffix: AFFIX[c] || '' };
    },
    removeChoice: function (s, c) { s.choices = s.choices.filter(function (x) { return x !== c; }); },
    // a copy of one layer as it looks when the wearer has chosen reading c
    hasUnit: function (s, d) { return S.members(s.id, d).some(function (e) { return S.roleOf(e) === 'unit'; }); },   // a separate unit layer: the value itself carries no unit
    variant: function (el, s, c, start, d) {
      var r = S.roleOf(el), v = Object.assign({}, el), a = c === start ? { prefix: el.prefix || '', suffix: el.suffix || '' } : ((s.affix && s.affix[c]) || { prefix: '', suffix: '' });
      if (r === 'value') { v.source = c; v.prefix = a.prefix || ''; v.suffix = S.hasUnit(s, d) ? '' : (a.suffix || ''); }
      else if (r === 'gauge') { v.source = c; if (el.type === 'arc') { v.min = null; v.max = null; } }
      else if (r === 'icon') { var ic = GW.ICON_FOR && GW.ICON_FOR[c]; if (ic && GW.ICONS && GW.ICONS[ic]) v.kind = ic; }
      else if (r === 'unit') { v.text = c === start ? el.text : (((s.affix && s.affix[c]) || {}).suffix || AFFIX[c] || ''); }
      else if (r === 'label') { v.text = c === start ? el.text : ((s.labels && s.labels[c] != null) ? s.labels[c] : GW.sourceShort(c)); }
      return v;
    },
    // make the layers show reading c (also what the preview shows)
    applyChoice: function (s, c, d) {
      d = d || GW.design; var start = S.startChoice(s, d), ms = S.members(s.id, d);
      ms.forEach(function (e) { if (e.type === 'text' && e.source === 'custom' && !e.srcRole) e.srcRole = S.roleOf(e); });   // fix what was guessed
      var hu = S.hasUnit(s, d);
      ms.forEach(function (e) {                                  // remember what the current reading looked like
        var r = S.roleOf(e);
        if (r === 'value' && !hu) s.affix[start] = { prefix: e.prefix || '', suffix: e.suffix || '' };
        if (r === 'value' && hu) s.affix[start] = { prefix: e.prefix || '', suffix: (s.affix[start] || {}).suffix || '' };
        if (r === 'label') s.labels[start] = e.text || '';
        if (r === 'unit') s.affix[start] = Object.assign({}, s.affix[start], { suffix: e.text || '' });
      });
      ms.forEach(function (e) { var v = S.variant(e, s, c, start, d); ['source', 'prefix', 'suffix', 'kind', 'text', 'min', 'max'].forEach(function (k) { if (k in v) e[k] = v[k]; }); });
    }
  };

  // ---------- code generation ----------
  var RE_ESC = /[.*+?^${}()|[\]\\]/g;
  function swap(lines, pairs) {
    if (!pairs.length) return lines;
    return lines.map(function (l) {
      pairs.forEach(function (p) { l = l.replace(new RegExp(p[0].replace(RE_ESC, '\\$&') + '(?![0-9A-Fa-f])', 'g'), p[1]); });
      return l;
    });
  }
  // the generated lines of one element, with its role colors replaced by the setting variables
  function colored(el, lines, cg, d) {
    var map = el.set; if (!map || !lines || !lines.length || S.mode(d) === 'none') return lines;
    var pairs = [], seen = {};
    function add(lit, rep) { if (!seen[lit]) { seen[lit] = 1; pairs.push([lit, rep]); } }
    Object.keys(map).forEach(function (k) {
      var s = S.find(map[k], d), v = el[k];
      if (!s || s.kind !== 'color' || typeof v !== 'string' || v[0] !== '#') return;
      cg.setUse(s.id);
      add(GW.mcColor(v), '_s_' + s.id);
      if (el.type === 'arc' && k === 'color' && el.track === 'auto') { cg.setNeed('dim'); add(GW.mcColor(GW.dim(v)), 'dimCol(_s_' + s.id + ')'); }   // the gauge's empty track follows the color
    });
    return swap(lines, pairs);
  }
  GW.genWithSettings = function (el, t, cg, d) {
    var one = function (e) { return colored(e, t.gen(e, cg), cg, d); };
    var s = el.srcSet && S.find(el.srcSet, d);
    if (!s || s.kind !== 'source' || !s.choices || s.choices.length < 2 || !S.roleOf(el)) return one(el);
    var start = S.startChoice(s, d);
    s._def = Math.max(0, s.choices.indexOf(start));
    cg.setUse(s.id);
    var out = [];
    s.choices.forEach(function (c, i) {
      var ls = one(S.variant(el, s, c, start, d)); if (!ls || !ls.length) return;
      out.push('if (_s_' + s.id + ' == ' + i + ') {'); ls.forEach(function (l) { out.push('    ' + l); }); out.push('}');
    });
    return out;
  };
  // the literal or variable that paints the background
  GW.bgExpr = function (d, cg) {
    var s = d.bgSet && S.find(d.bgSet, d);
    if (s && s.kind === 'color' && S.mode(d) !== 'none') { cg.setUse(s.id); return '_s_' + s.id; }
    return GW.mcColor(d.bg);
  };

  // everything the watch needs for the settings that are actually used: variables, loader, properties.xml, settings.xml and the texts
  GW.settingsOutput = function (d, used, needDim) {
    var mode = S.mode(d), th = S.theme(d);
    var all = S.all(d), roles = all.filter(function (s) { return s.kind === 'color' && used[s.id]; });
    var slots = all.filter(function (s) { return s.kind === 'source' && used[s.id]; });
    var useTheme = mode === 'theme' && th && th.themes.length && roles.length;
    if (!roles.length && !slots.length) return null;
    var members = [], load = [], props = [], sets = [], strings = {};
    function entryList(id, labels) { return labels.map(function (l, i) { return '            <listEntry value="' + i + '">@Strings.' + l + '</listEntry>'; }).join('\n'); }
    roles.forEach(function (s) {
      members.push('    var _s_' + s.id + ' = ' + num(s.def || '#ffffff') + ';');
      if (mode !== 'each') return;                                // a theme drives it, or it is fixed
      load.push('            v = Application.Properties.getValue("' + s.id + '");', '            if (v instanceof Number) {', '                _s_' + s.id + ' = v;', '            }');
      props.push('    <property id="' + s.id + '" type="number">' + num(s.def || '#ffffff') + '</property>');
      strings['S_' + s.id] = s.label || s.id;
      var entries = GW.PALETTE.map(function (h, i) { return '            <listEntry value="' + num(h) + '">@Strings.Col_' + i + '</listEntry>'; });
      sets.push('    <setting propertyKey="@Properties.' + s.id + '" title="@Strings.S_' + s.id + '">\n        <settingConfig type="list">\n' + entries.join('\n') + '\n        </settingConfig>\n    </setting>');
    });
    if (roles.length && mode === 'each') GW.PALETTE.forEach(function (h, i) { strings['Col_' + i] = NAMES[i]; });
    if (useTheme) {
      var names = ['T_ct_0'], ts = [{ name: th.original || 'Original', colors: null }].concat(th.themes);
      strings.S_ct = th.label || 'Color theme'; strings.T_ct_0 = th.original || 'Original';
      var br = [];
      ts.forEach(function (t, i) {
        if (i) { names.push('T_ct_' + i); strings['T_ct_' + i] = t.name || ('Theme ' + i); }
        var body = roles.map(function (r) { return '                _s_' + r.id + ' = ' + num(t.colors ? ((t.colors[r.id]) || r.def) : r.def) + ';'; });
        br.push('            ' + (i ? 'else ' : '') + 'if (t == ' + i + ') {\n' + body.join('\n') + '\n            }');
      });
      load.push('            var t = Application.Properties.getValue("ct");', '            if (t instanceof Number) {', br.join('\n'), '            }');
      props.push('    <property id="ct" type="number">0</property>');
      sets.push('    <setting propertyKey="@Properties.ct" title="@Strings.S_ct">\n        <settingConfig type="list">\n' + entryList('ct', names) + '\n        </settingConfig>\n    </setting>');
    }
    slots.forEach(function (s) {
      var def = s._def || 0;
      members.push('    var _s_' + s.id + ' = ' + def + ';');
      load.push('            v = Application.Properties.getValue("' + s.id + '");', '            if (v instanceof Number) {', '                _s_' + s.id + ' = v;', '            }');
      props.push('    <property id="' + s.id + '" type="number">' + def + '</property>');
      strings['S_' + s.id] = s.label || s.id;
      var labs = s.choices.map(function (c, i) { strings['S_' + s.id + '_' + i] = (GW.sources[c] || { label: c }).label; return 'S_' + s.id + '_' + i; });
      sets.push('    <setting propertyKey="@Properties.' + s.id + '" title="@Strings.S_' + s.id + '">\n        <settingConfig type="list">\n' + entryList(s.id, labs) + '\n        </settingConfig>\n    </setting>');
    });
    members.push('    function loadSettings() as Void {', '        try {', '            var v = null;', load.join('\n'), '        } catch (ex) {', '        }', '    }');
    if (needDim) members.push('    function dimCol(c as Number) as Number {\n        var r = (((c >> 16) & 255) >= 170) ? 85 : 0;\n        var g = (((c >> 8) & 255) >= 170) ? 85 : 0;\n        var b = ((c & 255) >= 170) ? 85 : 0;\n        return (r << 16) | (g << 8) | b;\n    }');
    var files = {};
    if (props.length) {
      files['resources/properties/properties.xml'] = '<properties>\n' + props.join('\n') + '\n</properties>\n';
      files['resources/settings/settings.xml'] = '<settings>\n' + sets.join('\n') + '\n</settings>\n';
    }
    return { members: members, strings: strings, files: files };
  };
})(window.GW);
