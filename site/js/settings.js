/* Watch settings: things the wearer can change on the phone (Garmin Connect app / Garmin Express) without a rebuild.
   A design lists its settings in design.settings:
     { id:'c1', kind:'color',  label:'Accent color', def:'#ff5500' }        one color shared by every element mapped to it
     { id:'s1', kind:'source', label:'Middle line',  choices:['steps','calories'], owner:<element id> }   which data an element shows
   Elements point at them:  el.set = { color:'c1', track:'c1' }  (field -> color setting),  el.srcSet = 's1'.   design.bgSet = 'c1' does the same for the background.
   On export a mapped color literal is swapped for a class variable the watch fills from Application.Properties (read once at start and
   whenever the settings change, never per frame), and a switchable element is generated once per choice and drawn according to the variable. */
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

  // ---------- the list ----------
  GW.settings = {
    all: function (d) { d = d || GW.design; return d.settings || (d.settings = []); },
    find: function (id, d) { var l = GW.settings.all(d); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; },
    colors: function (d) { return GW.settings.all(d).filter(function (s) { return s.kind === 'color'; }); },
    nextId: function (p) { var n = 1, d = GW.design; while (GW.settings.find(p + n, d)) n++; return p + n; },
    // how many places use a setting
    uses: function (id, d) {
      d = d || GW.design; var n = 0;
      d.elements.forEach(function (e) { if (e.srcSet === id) n++; if (e.set) Object.keys(e.set).forEach(function (k) { if (e.set[k] === id) n++; }); });
      if (d.bgSet === id) n++;
      return n;
    },
    addColor: function (label, def) {
      var s = { id: GW.settings.nextId('c'), kind: 'color', label: label || 'Color ' + (GW.settings.colors().length + 1), def: GW.q(def || '#ffffff') };
      GW.settings.all().push(s); return s;
    },
    // all the places that use a color setting take its default color (so the preview shows what the watch will show before anyone changes it)
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
      d = d || GW.design; GW.settings.unmapAll(id, d);
      d.settings = GW.settings.all(d).filter(function (s) { return s.id !== id; });
    },
    // settings nobody uses any more disappear by themselves
    prune: function (d) {
      d = d || GW.design;
      d.settings = GW.settings.all(d).filter(function (s) { return GW.settings.uses(s.id, d) > 0 || (s.kind === 'color' && s.keep); });
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
  // the generated lines of one element, with its mapped colors replaced by the setting variables
  function colored(el, lines, cg, d) {
    var map = el.set; if (!map || !lines || !lines.length) return lines;
    var pairs = [], seen = {};
    function add(lit, rep) { if (!seen[lit]) { seen[lit] = 1; pairs.push([lit, rep]); } }
    Object.keys(map).forEach(function (k) {
      var s = GW.settings.find(map[k], d), v = el[k];
      if (!s || s.kind !== 'color' || typeof v !== 'string' || v[0] !== '#') return;
      cg.setUse(s.id);
      add(GW.mcColor(v), '_s_' + s.id);
      if (el.type === 'arc' && k === 'color' && el.track === 'auto') { cg.setNeed('dim'); add(GW.mcColor(GW.dim(v)), 'dimCol(_s_' + s.id + ')'); }   // the gauge's empty track follows the color
    });
    // a literal that is not the element's own color but dims from it is handled above; the rest stays as designed
    return swap(lines, pairs);
  }
  GW.genWithSettings = function (el, t, cg, d) {
    var one = function (e) { return colored(e, t.gen(e, cg), cg, d); };
    var s = el.srcSet && GW.settings.find(el.srcSet, d);
    if (!s || s.kind !== 'source' || !s.choices || s.choices.length < 2) return one(el);
    s._def = Math.max(0, s.choices.indexOf(el.source));
    cg.setUse(s.id);
    var out = [];
    s.choices.forEach(function (c, i) {
      var clone = Object.assign({}, el, { source: c });
      if (el.type === 'arc') { clone.min = null; clone.max = null; }     // each reading brings its own natural range
      var ls = one(clone); if (!ls || !ls.length) return;
      out.push('if (_s_' + s.id + ' == ' + i + ') {'); ls.forEach(function (l) { out.push('    ' + l); }); out.push('}');
    });
    return out;
  };
  // the literal or variable that paints the background
  GW.bgExpr = function (d, cg) {
    var s = d.bgSet && GW.settings.find(d.bgSet, d);
    if (s && s.kind === 'color') { cg.setUse(s.id); return '_s_' + s.id; }
    return GW.mcColor(d.bg);
  };

  // everything the watch needs for the settings that are actually used: variables, loader, properties.xml, settings.xml and the texts
  GW.settingsOutput = function (d, used, needDim) {
    var list = GW.settings.all(d).filter(function (s) { return used[s.id]; });
    if (!list.length) return null;
    var members = [], load = [], props = [], sets = [], strings = {};
    list.forEach(function (s) {
      var id = s.id, isColor = s.kind === 'color';
      var def = isColor ? num(s.def || '#ffffff') : (s._def || 0);
      members.push('    var _s_' + id + ' = ' + def + ';');
      load.push('            v = Application.Properties.getValue("' + id + '");', '            if (v instanceof Number) {', '                _s_' + id + ' = v;', '            }');
      props.push('    <property id="' + id + '" type="number">' + def + '</property>');
      strings['S_' + id] = s.label || id;
      var entries = [];
      if (isColor) GW.PALETTE.forEach(function (h, i) { entries.push('            <listEntry value="' + num(h) + '">@Strings.Col_' + i + '</listEntry>'); });
      else s.choices.forEach(function (c, i) { strings['S_' + id + '_' + i] = (GW.sources[c] || { label: c }).label; entries.push('            <listEntry value="' + i + '">@Strings.S_' + id + '_' + i + '</listEntry>'); });
      sets.push('    <setting propertyKey="@Properties.' + id + '" title="@Strings.S_' + id + '">\n        <settingConfig type="list">\n' + entries.join('\n') + '\n        </settingConfig>\n    </setting>');
    });
    if (list.some(function (s) { return s.kind === 'color'; })) GW.PALETTE.forEach(function (h, i) { strings['Col_' + i] = NAMES[i]; });
    members.push('    function loadSettings() as Void {', '        try {', '            var v = null;', load.join('\n'), '        } catch (ex) {', '        }', '    }');
    if (needDim) members.push('    function dimCol(c as Number) as Number {\n        var r = (((c >> 16) & 255) >= 170) ? 85 : 0;\n        var g = (((c >> 8) & 255) >= 170) ? 85 : 0;\n        var b = ((c & 255) >= 170) ? 85 : 0;\n        return (r << 16) | (g << 8) | b;\n    }');
    return {
      members: members, strings: strings,
      files: {
        'resources/properties/properties.xml': '<properties>\n' + props.join('\n') + '\n</properties>\n',
        'resources/settings/settings.xml': '<settings>\n' + sets.join('\n') + '\n</settings>\n'
      }
    };
  };
})(window.GW);
