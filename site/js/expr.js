/* Formulas: a very small "if … then … else …" language that can sit behind any field of any layer.

     if {battery} < 20 then #ff0000 else if {battery} < 50 then #ffaa00 else #00ff00
     if {dow} == 'Sat' or {dow} == 'Sun' then 'WEEKEND' else 'weekday'
     if {hour} >= 22 or {hour} < 6 then false          (in the "Show this layer" formula: hide the layer at night)

   A formula is kept next to the field it changes: el.ex = { color: 'if …', text: '…', show: '…' }. The field keeps its own ordinary value, which is
   what is used whenever no branch matches (a formula without a final "else" falls back to it).
   Only the CONDITIONS look at live readings; the values after "then" / "else" are fixed numbers, texts, colors or true / false.
   That is what lets the watch code be written out: every outcome is generated once and the watch picks one with a plain if / else.
   The preview and the watch use the same parsed formula, so they agree. */
(function (GW) {
  'use strict';
  var ex = GW.ex = { open: {} };

  // ---------------------------------------------------------------- variables ({name})
  var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], DAYS_L = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], MONTHS_L = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  // clock variables: id, label, first value, last value, names (a text such as 'Sat' on the other side of a comparison becomes its number)
  var CLOCK = [
    ['hour', 'Hour of the day (0–23)', 0, 23], ['minute', 'Minute (0–59)', 0, 59], ['second', 'Second (0–59)', 0, 59],
    ['dow', 'Day of the week (1 = Mon … 7 = Sun; you can write \'Sat\')', 1, 7, DAYS, DAYS_L], ['day', 'Day of the month (1–31)', 1, 31],
    ['month', 'Month (1–12; you can write \'Jun\')', 1, 12, MONTHS, MONTHS_L], ['year', 'Year', 2000, 2100]
  ];
  function clockDef(id) { for (var i = 0; i < CLOCK.length; i++) if (CLOCK[i][0] === id) return CLOCK[i]; return null; }
  // the readings you can ask about: every numeric data source, plus every text one (weather words, AM/PM, …)
  function srcDef(id) {
    var s = GW.sources[id]; if (!s || id === 'custom') return null;
    if (s.kind === 'num' && s.num && s.mcNum) return { id: id, kind: 'num', label: s.label, group: s.group };
    if (s.kind === 'str' && s.str && s.mcStr) return { id: id, kind: 'str', label: s.label, group: s.group };
    return null;
  }
  ex.varInfo = function (name) {
    var c = clockDef(name);
    if (c) return { id: name, kind: 'num', label: c[1], group: 'Clock', clock: c };
    return srcDef(name);
  };
  ex.varList = function () {
    var out = CLOCK.map(function (c) { return { id: c[0], kind: 'num', label: c[1], group: 'Clock' }; });
    GW.sourceList.forEach(function (s) { var d = srcDef(s.id); if (d && !clockDef(s.id)) out.push(d); });
    return out;
  };
  // today's value of a variable in the preview ("environment"); a missing reading counts as 0 (or empty text)
  function lookup(name, env) {
    var c = clockDef(name);
    if (c) {
      switch (name) {
        case 'hour': return env.h; case 'minute': return env.m; case 'second': return env.sec;
        case 'dow': return ((env.dow + 6) % 7) + 1; case 'day': return env.day; case 'month': return env.mo; case 'year': return env.y;
      }
    }
    var s = GW.sources[name]; if (!s) return 0;
    if (s.kind === 'num') { var v = s.num(env); return v == null ? 0 : Number(v); }
    var t = s.str({ source: name, unit: 'auto' }, env); return t == null ? '' : String(t);
  }
  ex.lookup = lookup;

  // ---------------------------------------------------------------- parsing
  var KEYWORDS = { 'if': 1, 'then': 1, 'else': 1, 'elif': 1, 'end': 1, 'and': 1, 'or': 1, 'not': 1, 'true': 1, 'false': 1 };
  function fail(msg, pos) { var e = new Error(msg); e.pos = pos; e.isEx = true; throw e; }
  function lex(src) {
    var out = [], i = 0, n = src.length, m;
    while (i < n) {
      var ch = src[i];
      if (/\s/.test(ch)) { i++; continue; }
      if (ch === '{') {
        var j = src.indexOf('}', i); if (j < 0) fail('Missing a closing } after “{”', i);
        out.push({ t: 'var', v: src.slice(i + 1, j).trim(), p: i }); i = j + 1; continue;
      }
      if (ch === '\'' || ch === '"') {
        var k = i + 1, s = '';
        while (k < n && src[k] !== ch) { if (src[k] === '\\' && k + 1 < n) k++; s += src[k]; k++; }
        if (k >= n) fail('This text is missing its closing quote', i);
        out.push({ t: 'str', v: s, p: i }); i = k + 1; continue;
      }
      if (ch === '#') {
        m = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-zA-Z])/.exec(src.slice(i));
        if (!m) fail('A color is written #rrggbb, for example #ff0000', i);
        var hx = m[1].length === 3 ? m[1].split('').map(function (c) { return c + c; }).join('') : m[1];
        out.push({ t: 'color', v: '#' + hx.toLowerCase(), p: i }); i += m[0].length; continue;
      }
      m = /^\d+(\.\d+)?/.exec(src.slice(i));
      if (m) { out.push({ t: 'num', v: parseFloat(m[0]), p: i }); i += m[0].length; continue; }
      m = /^[A-Za-z_][A-Za-z_0-9]*/.exec(src.slice(i));
      if (m) { out.push({ t: 'word', v: m[0], p: i }); i += m[0].length; continue; }
      m = /^(==|!=|<>|<=|>=|=|<|>|\+|-|\*|\/|%|\(|\))/.exec(src.slice(i));
      if (m) { out.push({ t: 'op', v: m[1] === '=' ? '==' : (m[1] === '<>' ? '!=' : m[1]), p: i }); i += m[1].length; continue; }
      fail('I do not understand “' + ch + '”', i);
    }
    out.push({ t: 'eof', p: n });
    return out;
  }
  function parse(src) {
    var tk = lex(src), pos = 0;
    function cur() { return tk[pos]; }
    function isW(w) { return cur().t === 'word' && cur().v.toLowerCase() === w; }
    function isOp(o) { return cur().t === 'op' && cur().v === o; }
    function eatW(w) { if (isW(w)) { pos++; return true; } return false; }
    function need(w, why) { if (!eatW(w)) fail('Expected “' + w + '”' + (why ? ' ' + why : '') + ', found ' + describe(cur()), cur().p); }
    function describe(t) { return t.t === 'eof' ? 'the end' : '“' + (t.t === 'var' ? '{' + t.v + '}' : (t.t === 'str' ? '\'' + t.v + '\'' : t.v)) + '”'; }

    // a value after then / else: a fixed number, text, color or true / false (simple arithmetic on numbers is worked out in advance)
    function valueExpr() {
      var a = addExpr(true);
      if (a.t === 'var') fail('The value after then / else has to be fixed: a number, a text in quotes, a #color or true / false. Readings like {' + a.name + '} belong in the condition.', a.p);
      if (a.t === 'word') return { t: 'str', v: a.v, p: a.p };   // a bare word such as L, C, R or bold is taken as text
      return fold(a);
    }
    function fold(n) {
      if (n.t === 'bin') {
        var l = fold(n.l), r = fold(n.r);
        if (l.t === 'num' && r.t === 'num') {
          var v = n.o === '+' ? l.v + r.v : (n.o === '-' ? l.v - r.v : (n.o === '*' ? l.v * r.v : (n.o === '/' ? (r.v ? l.v / r.v : 0) : (r.v ? l.v % r.v : 0))));
          return { t: 'num', v: v, p: n.p };
        }
        if (l.t === 'str' && r.t === 'str' && n.o === '+') return { t: 'str', v: l.v + r.v, p: n.p };
        fail('Only numbers can be calculated with here', n.p);
      }
      if (n.t === 'neg') { var x = fold(n.e); if (x.t !== 'num') fail('Only numbers can be negated', n.p); return { t: 'num', v: -x.v, p: n.p }; }
      return n;
    }
    function orExpr() { var a = andExpr(); while (isW('or')) { var p = cur().p; pos++; a = { t: 'or', l: a, r: andExpr(), p: p }; } return a; }
    function andExpr() { var a = notExpr(); while (isW('and')) { var p = cur().p; pos++; a = { t: 'and', l: a, r: notExpr(), p: p }; } return a; }
    function notExpr() { if (isW('not')) { var p = cur().p; pos++; return { t: 'not', e: notExpr(), p: p }; } return cmpExpr(); }
    function cmpExpr() {
      var a = addExpr(false);
      if (cur().t === 'op' && /^(==|!=|<=|>=|<|>)$/.test(cur().v)) { var o = cur().v, p = cur().p; pos++; return { t: 'cmp', o: o, l: a, r: addExpr(false), p: p }; }
      return a;
    }
    function addExpr(loose) {
      var a = mulExpr(loose);
      while (isOp('+') || isOp('-')) { var o = cur().v, p = cur().p; pos++; a = { t: 'bin', o: o, l: a, r: mulExpr(loose), p: p }; }
      return a;
    }
    function mulExpr(loose) {
      var a = unary(loose);
      while (isOp('*') || isOp('/') || isOp('%')) { var o = cur().v, p = cur().p; pos++; a = { t: 'bin', o: o, l: a, r: unary(loose), p: p }; }
      return a;
    }
    function unary(loose) {
      if (isOp('-')) { var p = cur().p; pos++; return { t: 'neg', e: unary(loose), p: p }; }
      return primary(loose);
    }
    function primary(loose) {
      var t = cur(), p = t.p;
      if (t.t === 'num') { pos++; return { t: 'num', v: t.v, p: p }; }
      if (t.t === 'str') { pos++; return { t: 'str', v: t.v, p: p }; }
      if (t.t === 'color') { pos++; return { t: 'str', v: t.v, p: p, color: true }; }
      if (t.t === 'var') {
        pos++; var info = ex.varInfo(t.v);
        if (!info) fail('There is no reading called {' + t.v + '}. Open “Help” to see the names you can use.', p);
        return { t: 'var', name: t.v, kind: info.kind, p: p };
      }
      if (t.t === 'op' && t.v === '(') {
        pos++; var e = orExpr(); if (!isOp(')')) fail('Missing a closing )', cur().p); pos++; return { t: 'group', e: e, p: p };
      }
      if (t.t === 'word') {
        var w = t.v.toLowerCase();
        if (w === 'true' || w === 'false') { pos++; return { t: 'bool', v: w === 'true', p: p }; }
        if (KEYWORDS[w]) fail('Unexpected “' + t.v + '”', p);
        if (loose) { pos++; return { t: 'word', v: t.v, p: p }; }
        fail('Words have to be in quotes here, like \'' + t.v + '\'. Readings go in braces, like {' + t.v + '}.', p);
      }
      fail('Expected a value, found ' + describe(t), p);
    }

    function formula() {
      var arms = [], other;
      if (isW('if')) {
        pos++;
        for (;;) {
          var c = orExpr(); need('then');
          arms.push({ c: c, v: valueExpr() });
          if (isW('else') && tk[pos + 1].t === 'word' && tk[pos + 1].v.toLowerCase() === 'if') { pos += 2; continue; }
          if (isW('elif')) { pos++; continue; }
          break;
        }
        if (eatW('else')) other = valueExpr();
        eatW('end');
      } else {
        other = valueExpr();   // no “if”: the field always has this value
      }
      if (cur().t !== 'eof') fail('Unexpected ' + describe(cur()) + ' after the end of the formula', cur().p);
      return { arms: arms, other: other };
    }
    return formula();
  }

  // types: 'num' | 'str' | 'bool'; a comparison of a clock variable with a text such as 'Sat' becomes numeric
  function typeOf(n) {
    switch (n.t) {
      case 'num': return 'num'; case 'str': return 'str'; case 'bool': return 'bool';
      case 'var': return n.kind; case 'group': return typeOf(n.e); case 'neg': return 'num'; case 'bin': return 'num';
      case 'cmp': case 'and': case 'or': case 'not': return 'bool';
    }
    return 'num';
  }
  function resolveNames(n) {   // checks types, turns 'Sat' into 6 next to {dow}
    switch (n.t) {
      case 'group': n.e = resolveNames(n.e); return n;
      case 'not': n.e = resolveNames(n.e); if (typeOf(n.e) !== 'bool') fail('“not” goes in front of a comparison, like not ({steps} > 5000)', n.p); return n;
      case 'and': case 'or':
        n.l = resolveNames(n.l); n.r = resolveNames(n.r);
        if (typeOf(n.l) !== 'bool' || typeOf(n.r) !== 'bool') fail('“' + n.t + '” joins two comparisons, like {steps} > 5000 ' + n.t + ' {battery} > 50', n.p);
        return n;
      case 'neg': n.e = resolveNames(n.e); return n;
      case 'bin': n.l = resolveNames(n.l); n.r = resolveNames(n.r); if (typeOf(n.l) !== 'num' || typeOf(n.r) !== 'num') fail('Only numbers can be calculated with', n.p); return n;
      case 'cmp': {
        n.l = resolveNames(n.l); n.r = resolveNames(n.r);
        [['l', 'r'], ['r', 'l']].forEach(function (pr) {
          var a = n[pr[0]], b = n[pr[1]];
          if (a.t === 'var' && b.t === 'str') {
            var c = clockDef(a.name);
            if (c && c[4]) {
              var s = b.v.toLowerCase(), idx = c[4].map(function (x) { return x.toLowerCase(); }).indexOf(s);
              if (idx < 0) idx = c[5].map(function (x) { return x.toLowerCase(); }).indexOf(s);
              if (idx < 0) fail('“' + b.v + '” is not a name I know for {' + a.name + '}. Try ' + c[4].slice(0, 3).map(function (x) { return '\'' + x + '\''; }).join(', ') + '…', b.p);
              n[pr[1]] = { t: 'num', v: c[2] + idx, p: b.p };
            }
          }
        });
        var tl = typeOf(n.l), tr = typeOf(n.r);
        if (tl !== tr) fail('A ' + (tl === 'num' ? 'number' : 'text') + ' cannot be compared with a ' + (tr === 'num' ? 'number' : 'text') + (tl === 'str' || tr === 'str' ? ' (texts are written in quotes, numbers are not)' : ''), n.p);
        if (tl !== 'num' && n.o !== '==' && n.o !== '!=') fail('Texts can only be compared with == and !=', n.p);
        return n;
      }
    }
    return n;
  }
  var cache = {};
  // { ok, arms:[{c, v}], other, vars:[names] } or { ok:false, error, pos }
  ex.compile = function (src) {
    src = String(src == null ? '' : src);
    if (cache[src]) return cache[src];
    var out;
    try {
      var f = parse(src);
      f.arms.forEach(function (a) { a.c = resolveNames(a.c); if (typeOf(a.c) !== 'bool') fail('After “if” goes a comparison, like {steps} > 5000', a.c.p); });
      var vars = {};
      f.arms.forEach(function (a) { (function walk(n) { if (!n) return; if (n.t === 'var') vars[n.name] = 1; ['l', 'r', 'e'].forEach(function (k) { if (n[k]) walk(n[k]); }); })(a.c); });
      out = { ok: true, arms: f.arms, other: f.other, vars: Object.keys(vars) };
    } catch (e) {
      if (!e.isEx) throw e;
      out = { ok: false, error: e.message, pos: e.pos };
    }
    cache[src] = out; return out;
  };

  // ---------------------------------------------------------------- evaluating in the preview
  function ev(n, env) {
    switch (n.t) {
      case 'num': case 'str': case 'bool': return n.v;
      case 'var': return lookup(n.name, env);
      case 'group': return ev(n.e, env);
      case 'neg': return -ev(n.e, env);
      case 'not': return !ev(n.e, env);
      case 'and': return ev(n.l, env) && ev(n.r, env);
      case 'or': return ev(n.l, env) || ev(n.r, env);
      case 'bin': { var a = ev(n.l, env), b = ev(n.r, env); return n.o === '+' ? a + b : (n.o === '-' ? a - b : (n.o === '*' ? a * b : (n.o === '/' ? (b ? a / b : 0) : (b ? a % b : 0)))); }
      case 'cmp': {
        var x = ev(n.l, env), y = ev(n.r, env);
        switch (n.o) { case '==': return x === y; case '!=': return x !== y; case '<': return x < y; case '<=': return x <= y; case '>': return x > y; default: return x >= y; }
      }
    }
    return false;
  }
  // the value a formula gives now: { hit: true, v } or { hit: false } (nothing matched and there is no else: the field keeps its own value)
  ex.pick = function (src, env) {
    var c = ex.compile(src); if (!c.ok) return { hit: false };
    for (var i = 0; i < c.arms.length; i++) if (ev(c.arms[i].c, env)) return { hit: true, v: c.arms[i].v.v };
    return c.other ? { hit: true, v: c.other.v } : { hit: false };
  };
  ex.keys = function (el) { return el && el.ex ? Object.keys(el.ex).filter(function (k) { return k !== 'show' && typeof el.ex[k] === 'string' && el.ex[k].trim(); }) : []; };
  ex.hasShow = function (el) { return !!(el && el.ex && typeof el.ex.show === 'string' && el.ex.show.trim()); };
  ex.hasAny = function (el) { return !!el && (ex.keys(el).length > 0 || ex.hasShow(el)); };
  // the layer as the preview should draw it right now
  ex.resolve = function (el, env) {
    var ks = ex.keys(el); if (!ks.length) return el;
    var c = Object.assign({}, el);
    ks.forEach(function (k) { var r = ex.pick(el.ex[k], env); if (r.hit) c[k] = r.v; });
    return c;
  };
  ex.hidden = function (el, env) {
    if (!ex.hasShow(el)) return false;
    var r = ex.pick(el.ex.show, env); return r.hit ? !r.v : false;
  };

  // ---------------------------------------------------------------- the watch code
  function mcStrLit(s) { return GW.mcLit ? GW.mcLit(s) : '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'; }
  function vn(name) { return 'xv_' + name; }
  // lines that read every reading a set of formulas asks about (a missing number counts as 0)
  ex.varLines = function (names, cg) {
    var out = [];
    names.forEach(function (name) {
      var c = clockDef(name), e;
      if (c) {
        if (name === 'hour' || name === 'minute' || name === 'second') { cg.need('clk'); e = name === 'hour' ? '_clk.hour' : (name === 'minute' ? '_clk.min' : '_clk.sec'); }
        else {
          cg.imp('Toybox.Time'); cg.imp('Toybox.Time.Gregorian');
          var inf = 'Gregorian.info(Time.now(), Time.FORMAT_SHORT)';
          e = name === 'dow' ? '((' + inf + '.day_of_week + 5) % 7 + 1)' : (name === 'day' ? inf + '.day' : (name === 'month' ? inf + '.month' : inf + '.year'));
        }
        out.push('var ' + vn(name) + ' = ' + e + ';');
        return;
      }
      var s = GW.sources[name]; if (!s) return;
      (s.imports || []).forEach(cg.imp); (s.perms || []).forEach(cg.perm);
      if (s.kind === 'num') out.push('var ' + vn(name) + ' = ' + s.mcNum({ unit: 'auto', source: name }, cg) + ';', 'if (' + vn(name) + ' == null) {', '    ' + vn(name) + ' = 0;', '}');
      else out.push('var ' + vn(name) + ' = ' + s.mcStr({ source: name, unit: 'auto' }, cg) + ';');
    });
    return out;
  };
  function mcExpr(n) {
    switch (n.t) {
      case 'num': return (n.v < 0 ? '(' + n.v + ')' : String(n.v));
      case 'str': return mcStrLit(n.v);
      case 'bool': return n.v ? 'true' : 'false';
      case 'var': return vn(n.name);
      case 'group': return '(' + mcExpr(n.e) + ')';
      case 'neg': return '(-' + mcExpr(n.e) + ')';
      case 'not': return '!' + mcExpr(n.e);
      case 'and': return mcExpr(n.l) + ' && ' + mcExpr(n.r);
      case 'or': return mcExpr(n.l) + ' || ' + mcExpr(n.r);
      case 'bin':
        if (n.o === '/') return '(' + mcExpr(n.l) + '.toFloat() / ' + mcExpr(n.r) + '.toFloat())';
        if (n.o === '%') return '(' + mcExpr(n.l) + '.toNumber() % ' + mcExpr(n.r) + '.toNumber())';
        return '(' + mcExpr(n.l) + ' ' + n.o + ' ' + mcExpr(n.r) + ')';
      case 'cmp': return mcExpr(n.l) + ' ' + n.o + ' ' + mcExpr(n.r);
    }
    return 'false';
  }
  ex.mcCond = mcExpr;

  // "Show this layer": lines that end the drawing early when the formula says the layer is hidden now
  ex.guard = function (el, cg) {
    if (!ex.hasShow(el)) return [];
    var c = ex.compile(el.ex.show); if (!c.ok) return [];
    var out = ['var shown = true;'];
    c.arms.forEach(function (a, i) { out.push((i ? '} else if (' : 'if (') + mcExpr(a.c) + ') {', '    shown = ' + (a.v.v ? 'true' : 'false') + ';'); });
    if (c.arms.length) { if (c.other) out.push('} else {', '    shown = ' + (c.other.v ? 'true' : 'false') + ';'); out.push('}'); }
    else if (c.other) out.push('shown = ' + (c.other.v ? 'true' : 'false') + ';');
    out.push('if (!shown) {', '    return;', '}');
    return out;
  };

  // the lines that read every reading the layer's formulas ask about; they go once at the top of the layer's drawing method
  ex.prelude = function (el, cg) {
    var names = {};
    Object.keys(el.ex || {}).forEach(function (k) { var c = ex.compile(el.ex[k]); if (c.ok) c.vars.forEach(function (v) { names[v] = 1; }); });
    return ex.varLines(Object.keys(names), cg);
  };
  // The layer's lines with its formulas: each outcome is generated once (a copy of the layer with that value) inside plain if / else blocks.
  // genOne(layer) makes the ordinary lines for one copy.
  var MAX_VARIANTS = 24;
  ex.gen = function (el, cg, genOne) {
    var ks = ex.keys(el).filter(function (k) { return ex.compile(el.ex[k]).ok; });
    if (!ks.length) return genOne(el);
    var comp = ks.map(function (k) { return ex.compile(el.ex[k]); }), total = 1;
    comp.forEach(function (c) { total *= (c.arms.length + 1); });
    if (total > MAX_VARIANTS) { cg.note && cg.note('Layer “' + (el.name || el.type) + '” has too many formula combinations (' + total + '); its formulas were left out.'); return genOne(el); }
    var counter = 0;
    function copy(e, key, val) {
      var v = Object.assign({}, e); v[key] = val;
      if (v.set && v.set[key]) { v.set = Object.assign({}, v.set); delete v.set[key]; }   // a formula's color replaces the theme color for that outcome
      return v;
    }
    function rec(i, e) {
      if (i === ks.length) { counter++; return genOne(Object.assign({}, e, { id: String(el.id) + 'x' + counter })) || []; }
      var c = comp[i], key = ks[i], lines = [];
      if (!c.arms.length) return rec(i + 1, c.other ? copy(e, key, c.other.v) : e);
      c.arms.forEach(function (a, ai) {
        lines.push((ai ? '} else if (' : 'if (') + mcExpr(a.c) + ') {');
        rec(i + 1, copy(e, key, a.v.v)).forEach(function (l) { lines.push('    ' + l); });
      });
      lines.push('} else {');
      rec(i + 1, c.other ? copy(e, key, c.other.v) : e).forEach(function (l) { lines.push('    ' + l); });
      lines.push('}');
      return lines;
    }
    return rec(0, el);
  };

  // ---------------------------------------------------------------- older "show only when" rules become a formula
  ex.migrate = function (design) {
    (design.elements || []).forEach(function (e) {
      if (!e.conds || !e.conds.length) { delete e.conds; return; }
      var parts = [];
      e.conds.forEach(function (c) {
        if (!c || !c.src) return;
        var v = '{' + c.src + '}', a = Number(c.a) || 0, b = Number(c.b) || 0;
        if (c.op === 'in') parts.push('(' + v + ' >= ' + a + ' and ' + v + ' <= ' + b + ')');
        else if (c.op === 'out') parts.push('(' + v + ' < ' + a + ' or ' + v + ' > ' + b + ')');
        else parts.push(v + ' ' + (c.op === '=' ? '==' : c.op) + ' ' + a);
      });
      delete e.conds;
      if (!parts.length) return;
      e.ex = e.ex || {};
      if (!e.ex.show) e.ex.show = 'if ' + parts.join(' and ') + ' then true else false';
    });
  };

  // ---------------------------------------------------------------- help text
  ex.EXAMPLES = [
    ['Red when the battery is low', 'color', 'if {battery} < 20 then #ff0000 else if {battery} < 50 then #ffaa00 else #00ff00'],
    ['Say WEEKEND on Saturday and Sunday', 'text', 'if {dow} == \'Sat\' or {dow} == \'Sun\' then \'WEEKEND\' else \'weekday\''],
    ['Hide this layer at night', 'show', 'if {hour} >= 22 or {hour} < 6 then false'],
    ['Only on Fridays', 'show', 'if {dow} == \'Fri\' then true else false'],
    ['Goal reached: green', 'color', 'if {steps} >= 10000 then #00ff00'],
    ['Big font at midday', 'num', 'if {hour} >= 12 and {hour} < 14 then 64 else 48'],
    ['Rainy: show the umbrella text', 'text', 'if {weatherDesc} == \'Rain\' then \'☂\' else \'\'']
  ];

  // ---------------------------------------------------------------- the editor in the inspector
  function ui() { return GW.ui; }
  var WANT = { color: 1, optcolor: 1, fxcolor: 1, track: 1, seg: 1, select: 1, check: 1, text: 1, num: 1, numopt: 1, range: 1, datefmt: 1, source: 1, font: 1, sysfont: 1 };
  ex.wants = function (el, f) { return !!(f && f.k && WANT[f.t] && GW.modeOf() === 'watch' && el.type !== 'dfcell' && f.k !== 'name'); };
  function kindOfField(f) {
    if (f.k === 'show' || f.t === 'check') return 'bool';
    if (f.t === 'color' || f.t === 'optcolor' || f.t === 'fxcolor') return 'color';
    if (f.t === 'num' || f.t === 'numopt' || f.t === 'range') return 'num';
    return 'any';
  }
  // does the value a formula gives suit the field?
  function checkValues(c, f) {
    var k = kindOfField(f), all = c.arms.map(function (a) { return a.v; }).concat(c.other ? [c.other] : []);
    for (var i = 0; i < all.length; i++) {
      var v = all[i];
      if (k === 'bool' && v.t !== 'bool') return 'This field takes true or false';
      if (k === 'color' && !(v.t === 'str' && /^#[0-9a-f]{6}$/.test(v.v))) return f.t === 'track' ? null : 'This field takes a color such as #ff0000';
      if (k === 'num' && v.t !== 'num') return 'This field takes a number';
      if (k === 'any' && v.t === 'bool') return 'This field takes a text or a number, not true / false';
    }
    return null;
  }
  function insertAt(ta, txt) {
    var a = ta.selectionStart == null ? ta.value.length : ta.selectionStart, b = ta.selectionEnd == null ? a : ta.selectionEnd;
    ta.value = ta.value.slice(0, a) + txt + ta.value.slice(b); ta.selectionStart = ta.selectionEnd = a + txt.length; ta.focus();
    ta.dispatchEvent(new Event('input'));
  }
  function helpPanel(ta, f) {
    var h = ui().h, box = h('div', { class: 'exhelp' });
    box.appendChild(h('p', { html: '<b>How it works.</b> Write what you want in one line. It is read from the top: the first <code>if</code> that is true gives its value; <code>else</code> is what is used when none is. Without a final <code>else</code> the field keeps the value it has above.' }));
    box.appendChild(h('pre', { text: 'if {battery} < 20 then #ff0000\nelse if {battery} < 50 then #ffaa00\nelse #00ff00' }));
    var rows = [
      ['{name}', 'A live reading, in braces: {steps}, {battery}, {hr}, {hour}, {dow}…  A missing reading counts as 0.'],
      ['5000  \'text\'  #ff0000  true', 'Values: numbers, text in quotes, colors, true / false. After then / else the value is fixed.'],
      ['==  !=  <  <=  >  >=', 'Compare. Texts only with == and !=.'],
      ['and   or   not   ( )', 'Join comparisons: {hour} >= 9 and {hour} < 17'],
      ['{dow} == \'Sat\'', 'Days and months can be written as names (Mon … Sun, Jan … Dec) or as numbers (Mon = 1).'],
      ['+  -  *  /  %', 'Arithmetic in conditions: {steps} / 100 > 50']
    ];
    var tb = h('table', { class: 'exgrid' });
    rows.forEach(function (r) { tb.appendChild(h('tr', {}, [h('td', {}, [h('code', { text: r[0] })]), h('td', { text: r[1] })])); });
    box.appendChild(tb);
    box.appendChild(h('p', { html: '<b>Readings you can use</b> (click to insert):' }));
    var groups = {};
    ex.varList().forEach(function (v) { (groups[v.group] = groups[v.group] || []).push(v); });
    Object.keys(groups).forEach(function (g) {
      var row = h('div', { class: 'exvars' }, [h('span', { class: 'muted small', text: g + ': ' })]);
      groups[g].forEach(function (v) {
        var b = h('button', { class: 'btn sm', type: 'button', title: v.label + (v.kind === 'str' ? ' (text)' : ''), text: '{' + v.id + '}' });
        b.addEventListener('click', function () { insertAt(ta, '{' + v.id + '}'); });
        row.appendChild(b);
      });
      box.appendChild(row);
    });
    box.appendChild(h('p', { html: '<b>Examples</b> (click to use):' }));
    var want = kindOfField(f);
    ex.EXAMPLES.forEach(function (e) {
      if (e[1] !== { bool: 'show', color: 'color', num: 'num', any: 'text' }[want]) return;
      var b = h('button', { class: 'btn sm', type: 'button', style: 'display:block;text-align:left;margin:3px 0', title: e[2] }, [h('b', { text: e[0] }), h('br'), h('code', { text: e[2] })]);
      b.addEventListener('click', function () { ta.value = e[2]; ta.dispatchEvent(new Event('input')); ta.dispatchEvent(new Event('change')); });
      box.appendChild(b);
    });
    return box;
  }
  ex.editor = function (el, key, f) {
    var h = ui().h, ta = h('textarea', { class: 'exta', rows: 3, spellcheck: 'false', 'aria-label': 'Formula', placeholder: 'if {battery} < 20 then #ff0000 else #00ff00' });
    ta.value = (el.ex && el.ex[key]) || '';
    var status = h('div', { class: 'exstat' }), help = helpPanel(ta, f), helpOn = false;
    help.hidden = true;
    function refresh() {
      var src = ta.value.trim(); status.className = 'exstat'; status.textContent = '';
      if (!src) { status.textContent = 'Empty: the field keeps its own value.'; return; }
      var c = ex.compile(src);
      if (!c.ok) { status.className = 'exstat bad'; status.textContent = '✕ ' + c.error + (c.pos != null ? '  (at character ' + (c.pos + 1) + ')' : ''); return; }
      var why = checkValues(c, f); if (why) { status.className = 'exstat bad'; status.textContent = '✕ ' + why; return; }
      var r = ex.pick(src, GW.env());
      status.className = 'exstat ok';
      status.textContent = '✓ Right now: ' + (r.hit ? (typeof r.v === 'string' && r.v === '' ? '(empty text)' : String(r.v)) : 'no branch matches, so the field keeps its own value');
    }
    ta.addEventListener('input', function () {
      var v = ta.value;
      if (v.trim()) { el.ex = el.ex || {}; el.ex[key] = v; } else if (el.ex) { delete el.ex[key]; if (!Object.keys(el.ex).length) delete el.ex; }
      refresh(); GW.touch(false);
    });
    ta.addEventListener('change', function () { GW.commit(true); });
    var hb = h('button', { class: 'btn sm', type: 'button', text: 'Help & examples' });
    hb.addEventListener('click', function () { helpOn = !helpOn; help.hidden = !helpOn; hb.textContent = helpOn ? 'Hide help' : 'Help & examples'; });
    var rm = h('button', { class: 'btn sm danger', type: 'button', text: 'Remove formula' });
    rm.addEventListener('click', function () { if (el.ex) { delete el.ex[key]; if (!Object.keys(el.ex).length) delete el.ex; } delete ex.open[el.id + ':' + key]; GW.commit(true); });
    refresh();
    return h('div', { class: 'exed' }, [ta, status, h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin:4px 0' }, [hb, rm]), help]);
  };
  // adds the ƒ button and (when open) the formula editor to a field of the inspector
  ex.wrap = function (el, f, node) {
    if (!node) return node;
    var h = ui().h, key = f.k, id = el.id + ':' + key, has = !!(el.ex && typeof el.ex[key] === 'string' && el.ex[key].trim());
    if (has && ex.open[id] == null) ex.open[id] = true;
    var btn = h('button', { class: 'exbtn' + (has ? ' on' : ''), type: 'button', title: has ? 'This field follows a formula (click to hide or show it)' : 'Make this field change with a condition: if … then … else …', text: 'ƒ' });
    var host = node.classList && node.classList.contains('f') ? node : (node.querySelector && node.querySelector('.f')) || node;
    var lab = host.querySelector && (host.querySelector(':scope > label') || host.querySelector('label'));
    if (lab) lab.appendChild(btn); else host.insertBefore(btn, host.firstChild);
    var edBox = null;
    function sync() {
      if (ex.open[id]) { if (!edBox) { edBox = ex.editor(el, key, f); host.appendChild(edBox); } } else if (edBox) { edBox.remove(); edBox = null; }
    }
    btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); ex.open[id] = !ex.open[id]; sync(); });
    sync();
    return node;
  };
  // "Show this layer" at the bottom of the inspector (replaces the old rules list)
  ex.showBox = function (el) {
    var h = ui().h, box = h('div', { class: 'f', style: 'margin-top:14px;padding-top:10px;border-top:1px solid var(--line2)' });
    var has = ex.hasShow(el);
    box.appendChild(h('label', { text: 'Show this layer' }));
    box.appendChild(h('p', { class: 'muted small', text: has ? 'Shown only according to the formula below.' : 'Always shown. Add a formula to show it only sometimes: one weekday, a low battery, a time of day…' }));
    var f = { k: 'show', t: 'check', label: 'Show this layer' };
    var wrap = h('div', { class: 'f' }, [h('label', { text: 'Formula for showing' })]);
    ex.wrap(el, f, wrap); box.appendChild(wrap);
    if (!has) {
      var b = h('button', { class: 'btn sm', type: 'button', text: 'Example: weekday strip (S M T W T F S with a marker on today)' });
      var yin = h('input', { type: 'number', value: Math.round(GW.SIZE * 0.3), style: 'width:64px', 'aria-label': 'Row height (Y)' });
      b.addEventListener('click', function () { GW.fx.addWeekdayStrip(Number(yin.value) || 0); });
      box.appendChild(h('div', { style: 'margin:6px 0;display:flex;flex-wrap:wrap;gap:6px;align-items:center' }, [b, h('span', { class: 'muted small', text: 'at Y' }), yin]));
    }
    var uses = Object.keys(el.ex || {}).some(function (k) { return /\{dow\}/.test(el.ex[k] || ''); });
    if (uses) {
      var cur = GW.sim.dow, day = h('select', { class: 'sel', 'aria-label': 'Pretend today is' }, [['-1', 'today (real)']].concat(DAYS_L.map(function (n, i) { return [String((i + 1) % 7), n]; })).map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
      day.value = cur == null ? '-1' : String(cur);
      day.addEventListener('change', function () { GW.sim.dow = Number(day.value); GW.commit(false); });
      box.appendChild(ui().field('Preview: pretend today is', day));
    }
    return box;
  };
})(window.GW);
