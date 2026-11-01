/* Best-effort importer for a compiled Garmin watch face (.prg).
   A .prg holds the face's program, not its layout, so this reads the program: it follows the stack machine's instructions for the
   face's drawing function, collects the drawing calls it makes (text, bitmaps, arcs) with their constant arguments, and turns
   them into Garmin Studio elements. Resources (the background picture) are decoded; custom bitmap fonts are replaced by the
   closest bundled typeface. Anything it cannot map is listed in the report instead of being guessed.
   The instruction set and file layout follow the open-source qduff/mcdec (Apache-2.0) and pzl/ciqdb projects. */
(function (root) {
  'use strict';
  var M = { ENTRY: 0x6060C0DE, DATA: 0xDA7ABABE, CODE: 0xC0DEBABE, SYMBOLS: 0x5717B015, RESOURCES: 0xF00D600D };

  // ---------------------------------------------------------------- file
  function readSections(u8) {
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), sec = {}, p = 0;
    while (p + 8 <= u8.length) {
      var m = dv.getUint32(p), l = dv.getInt32(p + 4);
      if (l < 0 || p + 8 + l > u8.length) break;
      (sec[m] = sec[m] || []).push({ off: p + 8, len: l });
      p += 8 + l;
    }
    return { u8: u8, dv: dv, sec: sec };
  }
  function symbols(prg) {
    var s = prg.sec[M.SYMBOLS]; if (!s) return {};
    var off = s[0].off, len = s[0].len, dv = prg.dv, n = dv.getUint16(off), byOff = {}, out = {}, i, p = 2 + n * 8;
    for (i = 0; i < n; i++) byOff[dv.getUint32(off + 2 + i * 8 + 4)] = dv.getUint32(off + 2 + i * 8);
    var td = new TextDecoder();
    while (p < len) {
      var pos = p; p += 1; var l = dv.getUint16(off + p); p += 2;
      var str = td.decode(prg.u8.subarray(off + p, off + p + l)); p += l + 1;
      if (byOff[pos] != null) out[byOff[pos]] = str;
    }
    return out;
  }
  function dataString(prg, addr) {
    var s = prg.sec[M.DATA]; if (!s) return null;
    var off = s[0].off, len = s[0].len; if (addr + 3 > len || prg.u8[off + addr] !== 1) return null;
    var l = prg.dv.getUint16(off + addr + 1);
    return new TextDecoder().decode(prg.u8.subarray(off + addr + 3, off + addr + 3 + l));
  }
  var OPS = ['NOP', 'INCSP', 'POPV', 'ADD', 'SUB', 'MUL', 'DIV', 'AND', 'OR', 'MOD', 'SHL', 'SHR', 'XOR', 'GETV', 'PUTV', 'INVOKEM', 'AGETV', 'APUTV', 'LGETV', 'LPUTV', 'NEWA', 'NEWC', 'RETURN', 'RET', 'NEWS', 'GOTO', 'EQ', 'LT', 'LTE', 'GT', 'GTE', 'NE', 'ISNULL', 'ISA', 'CANHAZPLZ', 'JSR', 'TS', 'IPUSH', 'FPUSH', 'SPUSH', 'BT', 'BF', 'FRPUSH', 'BPUSH', 'NPUSH', 'INV', 'DUP', 'NEWD', 'GETM', 'LPUSH', 'DPUSH', 'THROW', 'CPUSH', 'ARGC', 'NEWBA', 'IPUSHZ', 'IPUSH1', 'IPUSH2', 'IPUSH3', 'FPUSHZ', 'LPUSHZ', 'DPUSHZ', 'BTPUSH', 'BFPUSH', 'APUSH', 'BAPUSH', 'HPUSH', 'GETSELFV', 'GETSELF', 'GETMV', 'GETLOCALV', 'GETSV', 'INVOKEMZ', 'APUTVDUP', 'ARGCINCSP', 'ISNOTNULL'];
  function decodeCode(prg) {
    var s = prg.sec[M.CODE]; if (!s) return [];
    var off = s[0].off, len = s[0].len, dv = prg.dv, u8 = prg.u8, ops = [], p = 0;
    function u32() { var v = dv.getUint32(off + p); p += 4; return v; }
    function b() { return u8[off + p++]; }
    while (p < len) {
      var addr = p, code = b(), name = OPS[code];
      if (!name) throw new Error('unknown instruction ' + code + ' at ' + addr);
      var o = { addr: addr, op: name }, d;
      switch (name) {
        case 'IPUSH': o.v = dv.getInt32(off + p); p += 4; break;
        case 'FPUSH': o.v = dv.getFloat32(off + p); p += 4; break;
        case 'SPUSH': case 'GETSELFV': case 'GETSV': o.sym = u32(); break;
        case 'CPUSH': o.v = String.fromCharCode(u32() & 255); break;
        case 'LGETV': case 'LPUTV': case 'INVOKEM': case 'ARGC': case 'INCSP': case 'BPUSH': case 'DUP': o.n = b(); break;
        case 'BT': case 'BF': case 'GOTO': case 'JSR': d = dv.getInt16(off + p); p += 2; o.target = p + d; break;
        case 'NEWS': case 'HPUSH': case 'BAPUSH': case 'APUSH': o.data = u32(); break;
        case 'ARGCINCSP': o.n = b(); o.m = b(); break;
        case 'GETLOCALV': o.n = b(); o.sym = u32(); break;
        case 'IPUSH1': o.v = dv.getInt8(off + p); p += 1; break;
        case 'IPUSH2': o.v = dv.getInt16(off + p); p += 2; break;
        case 'IPUSH3': o.v = (dv.getInt8(off + p) << 16) | (u8[off + p + 1] << 8) | u8[off + p + 2]; p += 3; break;
        case 'GETMV': o.sym = u32(); o.sym2 = u32(); break;
        case 'DPUSH': o.v = dv.getFloat64(off + p); p += 8; break;
        case 'LPUSH': o.v = Number(dv.getBigUint64(off + p)); p += 8; break;
      }
      ops.push(o);
    }
    var idx = {}; ops.forEach(function (o, i) { idx[o.addr] = i; });
    ops.forEach(function (o) { if (o.target != null && idx[o.target] != null) ops[idx[o.target]].leader = true; });
    ops.idx = idx;
    return ops;
  }

  // ---------------------------------------------------------------- symbolic execution of one function
  function C(v) { return { t: 'c', v: v }; }
  function E(s, extra) { return Object.assign({ t: 'e', s: s }, extra || {}); }
  function show(v) {
    if (v == null) return 'null';
    if (v.t === 'c') return typeof v.v === 'string' ? JSON.stringify(v.v) : String(v.v);
    if (v.t === 's') return v.n;
    if (v.arr) return '[' + Object.keys(v.arr).sort(function (a, b) { return a - b; }).map(function (k) { return v.arr[k]; }).join(', ') + ']';
    if (v.dict) return '{' + Object.keys(v.d || {}).map(function (k) { return k + ': ' + v.d[k]; }).join(', ') + '}';
    return v.s;
  }
  function simulate(prg, ops, sym, a, b) {
    var calls = [], sets = [], visited = {}, work = [{ pc: a, stack: [], locals: {}, cond: [], recv: null }], steps = 0;
    function S(n) { return { t: 's', n: n }; }
    function bin(o, x, y) { return E('(' + show(x) + ' ' + o + ' ' + show(y) + ')'); }
    while (work.length && steps < 300000) {
      var st = work.pop(), pc = st.pc, stack = st.stack, locals = st.locals, cond = st.cond, recv = st.recv;
      for (;;) {
        if (pc >= b || pc < a || steps > 300000) break;
        var o = ops[pc]; steps++;
        if (o.leader) {
          var prev = visited[pc];
          if (prev) { Object.keys(locals).forEach(function (k) { if (prev[k] !== undefined && show(prev[k]) !== show(locals[k])) prev[k] = E('phi(' + show(prev[k]) + ', ' + show(locals[k]) + ')'); }); break; }
          visited[pc] = Object.assign({}, locals);
        }
        var x, y, k, v, s, ob;
        switch (o.op) {
          case 'ARGC': locals[0] = S('self'); if (o.n >= 2) locals[1] = S('dc'); for (var i = 2; i < o.n; i++) locals[i] = S('arg' + i); break;
          case 'ARGCINCSP': locals[0] = S('self'); for (var j = 1; j < o.n; j++) locals[j] = S(j === 1 ? 'dc' : 'arg' + j); break;
          case 'LGETV': stack.push(locals[o.n] || S('local' + o.n)); break;
          case 'LPUTV': locals[o.n] = stack.pop(); break;
          case 'IPUSH': case 'IPUSH1': case 'IPUSH2': case 'IPUSH3': case 'FPUSH': case 'DPUSH': case 'LPUSH': case 'CPUSH': stack.push(C(o.v)); break;
          case 'IPUSHZ': case 'FPUSHZ': case 'LPUSHZ': case 'DPUSHZ': stack.push(C(0)); break;
          case 'BPUSH': stack.push(C(!!o.n)); break;
          case 'BTPUSH': stack.push(C(true)); break;
          case 'BFPUSH': stack.push(C(false)); break;
          case 'NPUSH': stack.push(C(null)); break;
          case 'SPUSH': stack.push(S(sym[o.sym] || ('sym' + o.sym))); break;
          case 'NEWS': s = dataString(prg, o.data); stack.push(C(s == null ? 'data_' + o.data.toString(16) : s)); break;
          case 'APUSH': case 'BAPUSH': case 'HPUSH': stack.push(E('data_' + o.data.toString(16))); break;
          case 'FRPUSH': stack.push(recv || S('self')); break;
          case 'GETV': s = stack.pop(); ob = stack.pop(); recv = ob; stack.push(E(show(ob) + '.' + show(s), { m: true, ob: ob, name: show(s) })); break;
          case 'GETM': s = stack.pop(); stack.push(S(show(s))); break;
          case 'GETSELFV': stack.push(E('self.' + (sym[o.sym] || o.sym), { m: true, ob: S('self'), name: sym[o.sym] })); break;
          case 'GETSELF': stack.push(S('self')); break;
          case 'GETSV': stack.push(E(sym[o.sym] || String(o.sym))); break;
          case 'GETMV': stack.push(E((sym[o.sym] || o.sym) + '.' + (sym[o.sym2] || o.sym2))); break;
          case 'GETLOCALV': stack.push(E(show(locals[o.n]) + '.' + (sym[o.sym] || o.sym), { m: true, ob: locals[o.n], name: sym[o.sym] })); break;
          case 'PUTV': v = stack.pop(); s = stack.pop(); ob = stack.pop(); sets.push({ ob: show(ob), name: show(s), v: show(v), raw: v }); break;
          case 'ADD': y = stack.pop(); x = stack.pop(); stack.push(bin('+', x, y)); break;
          case 'SUB': y = stack.pop(); x = stack.pop(); stack.push(bin('-', x, y)); break;
          case 'MUL': y = stack.pop(); x = stack.pop(); stack.push(bin('*', x, y)); break;
          case 'DIV': y = stack.pop(); x = stack.pop(); stack.push(bin('/', x, y)); break;
          case 'MOD': y = stack.pop(); x = stack.pop(); stack.push(bin('%', x, y)); break;
          case 'AND': y = stack.pop(); x = stack.pop(); stack.push(bin('&', x, y)); break;
          case 'OR': y = stack.pop(); x = stack.pop(); stack.push(bin('|', x, y)); break;
          case 'XOR': y = stack.pop(); x = stack.pop(); stack.push(bin('^', x, y)); break;
          case 'SHL': y = stack.pop(); x = stack.pop(); stack.push(bin('<<', x, y)); break;
          case 'SHR': y = stack.pop(); x = stack.pop(); stack.push(bin('>>', x, y)); break;
          case 'EQ': y = stack.pop(); x = stack.pop(); stack.push(bin('==', x, y)); break;
          case 'NE': y = stack.pop(); x = stack.pop(); stack.push(bin('!=', x, y)); break;
          case 'LT': y = stack.pop(); x = stack.pop(); stack.push(bin('<', x, y)); break;
          case 'LTE': y = stack.pop(); x = stack.pop(); stack.push(bin('<=', x, y)); break;
          case 'GT': y = stack.pop(); x = stack.pop(); stack.push(bin('>', x, y)); break;
          case 'GTE': y = stack.pop(); x = stack.pop(); stack.push(bin('>=', x, y)); break;
          case 'INV': x = stack.pop(); stack.push(E('!' + show(x))); break;
          case 'ISNULL': x = stack.pop(); stack.push(E('(' + show(x) + ' == null)')); break;
          case 'ISNOTNULL': x = stack.pop(); stack.push(E('(' + show(x) + ' != null)')); break;
          case 'ISA': y = stack.pop(); x = stack.pop(); stack.push(E('(' + show(x) + ' isa ' + show(y) + ')')); break;
          case 'CANHAZPLZ': y = stack.pop(); x = stack.pop(); stack.push(E('(' + show(x) + ' has ' + show(y) + ')')); break;
          case 'POPV': stack.pop(); break;
          case 'DUP': stack.push(stack[stack.length - 1 - o.n]); break;
          case 'NEWA': stack.pop(); stack.push(E('[array]', { arr: {} })); break;
          case 'NEWD': stack.pop(); stack.push(E('{dict}', { dict: true, d: {} })); break;
          case 'NEWC': x = stack.pop(); stack.push(E('new ' + show(x))); break;
          case 'NEWBA': stack.pop(); stack.push(E('bytearray')); break;
          case 'APUTV': case 'APUTVDUP': v = stack.pop(); k = stack.pop(); var ar = stack[stack.length - 1];
            if (ar && ar.arr) ar.arr[show(k)] = show(v); if (ar && ar.dict) ar.d[show(k)] = show(v);
            if (o.op === 'APUTV') stack.pop(); break;
          case 'AGETV': k = stack.pop(); x = stack.pop(); stack.push(E(show(x) + '[' + show(k) + ']')); break;
          case 'INVOKEM': case 'INVOKEMZ': {
            var n = o.op === 'INVOKEMZ' ? 1 : o.n, args = [];
            for (var q = 0; q < n; q++) args.unshift(stack.pop());
            var m = stack.pop(), self = args.shift();
            var call = { name: m && m.name, recv: m && m.ob ? show(m.ob) : show(self), args: args.map(show), raw: args, cond: cond.slice(), pc: o.addr };
            calls.push(call);
            stack.push(E((m && m.name ? call.recv + '.' + m.name : show(m)) + '(' + call.args.join(', ') + ')', { call: call }));
            break;
          }
          case 'GOTO': pc = ops.idx[o.target]; continue;
          case 'BT': case 'BF': {
            var c = stack.pop(), tgt = ops.idx[o.target], tc = o.op === 'BT' ? show(c) : '!' + show(c), fc = o.op === 'BT' ? '!' + show(c) : show(c);
            work.push({ pc: tgt, stack: stack.slice(), locals: Object.assign({}, locals), cond: cond.concat([tc]), recv: recv });
            cond = cond.concat([fc]); break;
          }
          case 'JSR': work.push({ pc: ops.idx[o.target], stack: stack.slice(), locals: Object.assign({}, locals), cond: cond.slice(), recv: recv }); break;
          case 'RETURN': case 'RET': case 'THROW': pc = b; continue;
        }
        pc++;
      }
    }
    return { calls: calls, sets: sets };
  }
  function functionRanges(ops, withBodies) {
    var starts = []; ops.forEach(function (o, i) {
      if (o.op === 'ARGC' || o.op === 'ARGCINCSP') starts.push(i);
      else if (withBodies && i > 0 && ops[i - 1].op === 'RETURN' && !o.leader) starts.push(i);   // functions that take no arguments have no ARGC to mark their start
    });
    return starts.map(function (a, i) { return [a, i + 1 < starts.length ? starts[i + 1] : ops.length]; });
  }

  // ---------------------------------------------------------------- resources
  function resourceTables(prg) {
    var r = prg.sec[M.RESOURCES]; if (!r) return {};
    var off = r[0].off, dv = prg.dv, n = dv.getUint16(off), out = {}, i, j;
    for (i = 0; i < n; i++) {
      var type = dv.getUint32(off + 2 + i * 8), to = dv.getUint32(off + 2 + i * 8 + 4), cnt = dv.getUint16(off + to), list = [];
      for (j = 0; j < cnt; j++) list.push({ id: dv.getUint32(off + to + 2 + j * 8), off: dv.getUint32(off + to + 2 + j * 8 + 4) });
      out[type] = list;
    }
    out.base = off;
    return out;
  }
  // 8-bit bitmap: one byte per pixel, two bits each of alpha, red, green, blue (the watch's 64-colour palette)
  function decodeBitmap(prg, res, id) {
    var list = res[0x8000A3] || [], e = list.filter(function (x) { return x.id === id; })[0]; if (!e) return null;
    var p = res.base + e.off, dv = prg.dv, u8 = prg.u8;
    var len = dv.getUint32(p + 5), w = dv.getUint16(p + 9), h = dv.getUint16(p + 11), row = dv.getUint16(p + 9 + 8), bpp = u8[p + 9 + 10];
    if (bpp !== 8 || w * h > 600 * 600 || len < 13 + w * h) return { w: w, h: h, unsupported: true };
    var rgba = new Uint8ClampedArray(w * h * 4), q = p + 9 + 13;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var v = u8[q + y * row + x], o = (y * w + x) * 4;
      rgba[o] = ((v >> 4) & 3) * 85; rgba[o + 1] = ((v >> 2) & 3) * 85; rgba[o + 2] = (v & 3) * 85; rgba[o + 3] = 255;
    }
    return { w: w, h: h, rgba: rgba };
  }

  // ---------------------------------------------------------------- mapping to Garmin Studio
  function hex(n) { n = n >>> 0; return '#' + ('000000' + (n & 0xFFFFFF).toString(16)).slice(-6); }
  function num(s) { var n = Number(s); return isNaN(n) ? null : n; }
  function splitTop(s) {   // split "a, b, [c, d]" at top-level commas
    var out = [], d = 0, q = false, cur = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (q) { cur += ch; if (ch === '\\') { cur += s[++i]; } else if (ch === '"') q = false; continue; }
      if (ch === '"') { q = true; cur += ch; continue; }
      if (ch === '(' || ch === '[' || ch === '{') d++; if (ch === ')' || ch === ']' || ch === '}') d--;
      if (ch === ',' && d === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }
  var FONT_FAMILY = [[/eurostile/i, 'Orbitron'], [/raj/i, 'Rajdhani'], [/baijam|chakra|kanit/i, 'Chakra Petch'], [/bebas/i, 'Bebas Neue'], [/mono/i, 'Share Tech Mono'], [/serif|baskerville|times/i, 'Libre Baskerville'], [/dm.?sans|sans|roboto|helvet|arial/i, 'DM Sans']];
  function fontFromName(name) {
    var m = /(\d+)/.exec(name), px = m ? Math.max(8, parseInt(m[1], 10)) : 18, fam = 'Rajdhani';
    FONT_FAMILY.some(function (f) { if (f[0].test(name)) { fam = f[1]; return true; } });
    var bold = /demi|bold|black|heavy/i.test(name), light = /light|thin/i.test(name);
    var weights = { Orbitron: [500, 900], Rajdhani: [500, 700], 'Chakra Petch': [600], 'Bebas Neue': [400], 'Share Tech Mono': [400], 'Libre Baskerville': [700], 'DM Sans': [500, 700] }[fam] || [500];
    var weight = bold ? weights[weights.length - 1] : weights[0];
    if (light && weights[0] < weight) weight = weights[0];
    return { family: fam, weight: weight, px: px, glyphs: /alphanum/.test(name) ? 'full' : (/num/.test(name) ? 'digits' : 'full') };
  }
  var MONTHS = /\["Jan".*?"Dec"\]\[/, DAYS = /\["Sun".*?"Sat"\]\[/;
  function classify(item) {
    if (MONTHS.test(item)) return 'MMM';
    if (DAYS.test(item)) return 'ddd';
    if (/Gregorian\.info\(Toybox_Time\.now\(\), 0\)\.day/.test(item)) return 'DD';
    if (/getSunrise.*\)\.hour/.test(item)) return 'sunrise.h';
    if (/getSunrise.*\)\.min/.test(item)) return 'sunrise.m';
    if (/getSunset.*\)\.hour/.test(item)) return 'sunset.h';
    if (/getSunset.*\)\.min/.test(item)) return 'sunset.m';
    if (/getClockTime\(\)\.min/.test(item)) return 'minute';
    if (/getClockTime\(\)\.sec/.test(item)) return 'second';
    if (/getClockTime\(\)\.hour|^12\.format|^phi\(.*hour/.test(item)) return 'hour';
    return null;
  }
  // text expression -> {source, ...} or {text} or null
  function textSource(e) {
    var m;
    if (/^"/.test(e)) { var s = JSON.parse(e); return /^(AM|PM)$/.test(s) ? { source: 'ampm' } : { source: 'custom', text: s }; }
    if (/^Toybox_System\.getClockTime\(\)\.sec\.format\("%02d"\)$/.test(e)) return { source: 'second' };
    if (/^Toybox_System\.getClockTime\(\)\.min\.format\("%02d"\)$/.test(e)) return { source: 'minute' };
    if (/^Toybox_System\.getClockTime\(\)\.hour\.format\("%02d"\)$/.test(e)) return { source: 'hour', hmode: 'h24', lz: true };
    if (/getInfo\(\)\.steps\.toString/.test(e)) return { source: 'steps' };
    if (/floorsClimbed\.toString/.test(e)) return { source: 'floors' };
    if (/getSystemStats\(\)\.battery\.(format\("%d"\)|toNumber\(\)\.toString|toString)/.test(e)) return { source: 'battery' };
    if ((m = /getInfo\(\)\.distance\.toFloat\(\) \/ 100000\)\.format\("%\.(\d)f"\) \+ "([^"]*)"/.exec(e))) return { source: 'distance', suffix: m[2], unit: 'km' };
    if ((m = /temperature\.toFloat\(\) \* 9\) \/ 5\) \+ 32\)\.toNumber\(\)\.toString\(\)(?: \+ "([^"]*)")?/.exec(e))) return { source: 'temp', unit: 'F', suffix: m[1] || '' };
    if ((m = /temperature\.(?:toNumber\(\)\.)?toString\(\)(?: \+ "([^"]*)")?/.exec(e))) return { source: 'temp', unit: 'C', suffix: m[1] || '' };
    if ((m = /SensorHistory\.get(\w+)History\(/.exec(e))) {
      var map = { HeartRate: 'hr', BodyBattery: 'bodyBat', Stress: 'stress', OxygenSaturation: 'spo2', RespirationRate: 'resp' };
      if (map[m[1]]) return { source: map[m[1]] };
    }
    if ((m = /^Toybox_Lang\.format\("((?:[^"\\]|\\.)*)", (\[.*\])\)$/.exec(e))) {
      var tpl = JSON.parse('"' + m[1] + '"'), items = splitTop(m[2].slice(1, -1)).map(classify);
      // an unknown first item of a [hour, minute, second] list is the hour
      if (!items[0] && items[1] === 'minute') items[0] = 'hour';
      var used = []; tpl.replace(/\$(\d+)\$/g, function (_, n) { used.push(items[parseInt(n, 10) - 1]); });
      if (used.length === 3 && used.every(function (u) { return u === 'ddd' || u === 'MMM' || u === 'DD'; })) {
        var fmt = tpl.replace(/\$(\d+)\$/g, function (_, n) { return items[parseInt(n, 10) - 1]; });
        return { source: 'date', fmt: fmt };
      }
      if (used.length === 2 && used[0] === 'sunrise.h' && used[1] === 'sunrise.m') return { source: 'sunrise' };
      if (used.length === 2 && used[0] === 'sunset.h' && used[1] === 'sunset.m') return { source: 'sunset' };
      if (used.length === 1 && used[0]) {
        var parts = tpl.split(/\$\d+\$/), src = used[0] === 'hour' ? { source: 'hour', hmode: /12\.format/.test(m[2]) ? 'h12' : 'auto', lz: true } : (used[0] === 'minute' ? { source: 'minute' } : (used[0] === 'second' ? { source: 'second' } : null));
        if (src) { src.prefix = parts[0] || ''; src.suffix = parts[1] || ''; return src; }
      }
    }
    return null;
  }

  function importPrg(u8, opts) {
    opts = opts || {};
    var prg = readSections(u8), sym = symbols(prg), ops = decodeCode(prg), res = resourceTables(prg), report = { texts: 0, arcs: 0, notes: [], skipped: [] };
    if (!ops.length) throw new Error('This does not look like a compiled Garmin app.');
    var ranges = functionRanges(ops), best = null;
    ranges.forEach(function (r) {
      var n = 0; for (var i = r[0]; i < r[1]; i++) if (ops[i].op === 'SPUSH' && /^(drawText|drawBitmap|drawArc|fillRectangle|drawLine|drawCircle|fillCircle|fillPolygon)$/.test(sym[ops[i].sym] || '')) n++;
      if (!best || n > best.n) best = { r: r, n: n };
    });
    if (!best || !best.n) throw new Error('No drawing code was found in this file (it may use only built-in layouts).');
    // which resource each field of the view holds (set when the view loads its resources)
    var fieldRes = {}, bodies = functionRanges(ops, true);
    bodies.forEach(function (r) {
      var sim = simulate(prg, ops, sym, r[0], r[1]);
      sim.sets.forEach(function (s) { var m = /loadResource\(.*?\.(Drawables|Fonts)\.(\w+)\)/.exec(s.v); if (m) fieldRes[s.name] = { kind: m[1], name: m[2] }; });
    });
    var resId = {}; Object.keys(sym).forEach(function (k) { resId[sym[k]] = +k; });
    var arrays = {};   // fields set to constant arrays (colour tables)
    ranges.forEach(function (r) { /* collected below */ });
    var all = simulate(prg, ops, sym, best.r[0], best.r[1]);
    var calls = all.calls.slice().sort(function (a, b) { return a.pc - b.pc; });
    bodies.forEach(function (r) { simulate(prg, ops, sym, r[0], r[1]).sets.forEach(function (s) { if (/^\[/.test(s.v)) arrays[s.name] = splitTop(s.v.slice(1, -1)); }); });

    var design = { name: opts.name || 'Imported face', bg: '#000000', bgImage: null, fonts: [], elements: [], size: 0, kind: undefined };
    var assets = {}, fontIds = {}, size = 0, color = '#ffffff', pen = 1, first = true, arcs = [], recent = [];
    function fontOf(expr) {
      var m = /^self\.(\w+)$/.exec(expr), f = m && fieldRes[m[1]]; if (!f || f.kind !== 'Fonts') return null;
      if (!fontIds[f.name]) { var d = fontFromName(f.name); d.id = 'f_' + f.name.replace(/[^a-z0-9]/gi, ''); d.spacing = 0; design.fonts.push(d); fontIds[f.name] = d; }
      return fontIds[f.name];
    }
    function colorOf(arg) {
      var n = num(arg); if (n != null) return hex(n);
      var m = /^self\.(\w+)\[(\d+)\]$/.exec(arg); if (m && arrays['' + m[1]] && arrays[m[1]][m[2]] != null) { var v = num(arrays[m[1]][m[2]]); if (v != null) return hex(v); }
      return null;
    }
    calls.forEach(function (c) {
      var a = c.args, n = c.name;
      if (n === 'setColor') { var col = colorOf(a[0]); if (col) color = col; recent.push(a[0]); if (recent.length > 4) recent.shift(); if (first && num(a[1]) != null && num(a[1]) >= 0) design.bg = hex(num(a[1])); first = false; return; }
      if (n === 'setPenWidth') { pen = num(a[0]) || 1; return; }
      if (n === 'drawBitmap' && num(a[0]) != null && num(a[1]) != null) {
        var bm = /^self\.(\w+)$/.exec(a[2]), f = bm && fieldRes[bm[1]];
        if (f && f.kind === 'Drawables') {
          var img = decodeBitmap(prg, res, resId[f.name]);
          if (img && img.rgba) {
            if (img.w >= 200 && num(a[0]) === 0 && num(a[1]) === 0 && !design.bgImage) { assets.bg0 = { w: img.w, h: img.h, rgba: img.rgba }; design.bgImage = 'bg0'; size = size || img.w; }
            else { var id = 'img' + Object.keys(assets).length; assets[id] = { w: img.w, h: img.h, rgba: img.rgba }; design.elements.push({ type: 'image', name: f.name, x: num(a[0]) + img.w / 2, y: num(a[1]) + img.h / 2, w: img.w, h: img.h, asset: id }); }
          } else report.skipped.push('picture ' + f.name + ' (format not supported)');
        }
        return;
      }
      if (n === 'drawText' && num(a[0]) != null && num(a[1]) != null) {
        var ts = textSource(a[3]), fnt = fontOf(a[2]), j = num(a[4]) || 0;
        if (!ts) { report.skipped.push('text at (' + a[0] + ', ' + a[1] + '): ' + a[3].slice(0, 70)); return; }
        var y = num(a[1]); if (!(j & 4)) y += Math.round(((fnt && fnt.px) || 18) * 0.6);
        design.elements.push(Object.assign({ type: 'text', name: ts.source === 'custom' ? ts.text : ts.source, x: num(a[0]), y: y, font: fnt ? fnt.id : 'FONT_SMALL', color: color, justify: ['R', 'C', 'L'][j & 3] || 'C', prefix: '', suffix: '', upper: false }, ts));
        report.texts++; return;
      }
      if (n === 'drawArc' && a.length >= 6 && num(a[0]) != null && num(a[1]) != null && num(a[2]) != null) {
        arcs.push({ cx: num(a[0]), cy: num(a[1]), r: num(a[2]), dir: num(a[3]), s: a[4], e: a[5], pen: pen, color: color, recent: recent.slice(), cond: c.cond.join(' && '), pc: c.pc });
        size = size || num(a[0]) * 2; return;
      }
      if (/^(fillRectangle|drawLine|drawRectangle|fillCircle|drawCircle|fillPolygon)$/.test(n) && a.every(function (x) { return num(x) != null; })) {
        // plain shapes with constant arguments
        if (n === 'fillRectangle') design.elements.push({ type: 'shape', name: 'Box', kind: 'rect', x: num(a[0]), y: num(a[1]), w: num(a[2]), h: num(a[3]), fill: true, pen: 1, rad: 0, color: color });
        else if (n === 'drawLine') design.elements.push({ type: 'shape', name: 'Line', kind: 'line', x: num(a[0]), y: num(a[1]), x2: num(a[2]), y2: num(a[3]), pen: pen, color: color });
        else if (n === 'fillCircle' || n === 'drawCircle') design.elements.push({ type: 'shape', name: 'Circle', kind: 'circle', x: num(a[0]), y: num(a[1]), r: num(a[2]), fill: n === 'fillCircle', pen: pen, color: color });
        else if (n === 'drawRectangle') design.elements.push({ type: 'shape', name: 'Box', kind: 'rect', x: num(a[0]), y: num(a[1]), w: num(a[2]), h: num(a[3]), fill: false, pen: pen, color: color, rad: 0 });
        return;
      }
      if (/^(fillRectangle|fillPolygon|drawLine)$/.test(n)) report.skipped.push(n + '(' + a.join(', ').slice(0, 60) + ') (position depends on live data)');
    });

    // arcs: a gauge is a dim track arc plus a progress arc over it; a segment loop (move bar) becomes one arc per segment
    function sourceNear(cond) {
      var t = cond;
      if (/moveBarLevel/.test(t)) return 'moveBar';
      if (/getSystemStats\(\)\.battery/.test(t)) return 'battery';
      if (/\.steps/.test(t)) return 'steps';
      if (/floorsClimbed/.test(t)) return 'floors';
      if (/activeMinutes/.test(t)) return 'intMins';
      return 'steps';
    }
    function garminToCompass(g) { return ((90 - g) % 360 + 360) % 360; }
    var used = {};
    arcs.forEach(function (A, i) {
      if (used[i]) return;
      var sNum = num(A.s), eNum = num(A.e), cw = A.dir === 1;
      if (sNum != null && eNum != null) {                       // a constant arc: the track of a gauge
        var sweep = cw ? ((sNum - eNum) % 360 + 360) % 360 : ((eNum - sNum) % 360 + 360) % 360;
        var next = arcs.filter(function (B, j) { return j > i && !used[j] && B.cx === A.cx && B.cy === A.cy && B.r === A.r && B.dir === A.dir && num(B.s) === sNum && num(B.e) == null; })[0];
        var src = sourceNear((next ? next.cond : A.cond) + ' ' + A.cond);
        if (next) used[arcs.indexOf(next)] = 1;
        design.elements.push({ type: 'arc', name: src + ' arc', cx: A.cx, cy: A.cy, r: A.r, pen: A.pen, start: garminToCompass(sNum), sweep: Math.round(sweep), dir: cw ? 'cw' : 'ccw', source: src, min: null, max: null, color: next ? next.color : A.color, track: next ? A.color : 'auto', round: false });
        report.arcs++; return;
      }
      var loop = /^\(?\(?(-?[\d.]+) - \(0 \* ([\d.]+)\)\)(?:\.toNumber\(\))?\)?$/.exec(A.s);   // segments laid out by a loop counter
      var cnt = null, cm, cre = /\(0 < (\d+)\)/g; while ((cm = cre.exec(A.cond))) cnt = cm;   // the innermost loop's bound
      if (loop && cnt) {
        var from = parseFloat(loop[1]), step = parseFloat(loop[2]), segs = parseInt(cnt[1], 10), spanM = /- ([\d.]+)\)(?:\.toNumber\(\))?$/.exec(A.e), span = spanM ? parseFloat(spanM[1]) : step;
        var tblArg = A.recent.filter(function (r) { return /^self\.\w+\[\d+\]$/.test(r); })[0], tbl = tblArg && /^self\.(\w+)\[/.exec(tblArg)[1];
        var off = A.recent.filter(function (r) { return r !== tblArg && num(r) != null; }).map(function (r) { return hex(num(r)); })[0] || '#222222';
        for (var k = 0; k < segs; k++) {
          var gs = from - k * step, colr = (tbl && arrays[tbl] && num(arrays[tbl][k]) != null) ? hex(num(arrays[tbl][k])) : A.color;
          design.elements.push({ type: 'arc', name: 'segment ' + (k + 1), cx: A.cx, cy: A.cy, r: A.r, pen: A.pen, start: Math.round(garminToCompass(gs) * 10) / 10, sweep: Math.round(span), dir: cw ? 'cw' : 'ccw', source: sourceNear(A.cond), min: k, max: k + 1, color: colr, track: off, round: false });
        }
        report.arcs += segs; return;
      }
      report.skipped.push('arc at (' + A.cx + ', ' + A.cy + ') r' + A.r + ' (angles depend on live data)');
    });
    if (!size) size = 280;
    if (!design.elements.length) throw new Error('The drawing code was found but nothing in it could be turned into elements.');
    design.size = size;
    delete design.kind;
    if (/histCache|SensorHistory.*getHeartRateHistory\(\{period: 7/.test(JSON.stringify(calls.map(function (c) { return c.cond; })))) report.notes.push('The history chart (bars) is drawn from stored data and is not imported.');
    return { design: design, assets: assets, report: report };
  }
  var api = { importPrg: importPrg, _readSections: readSections, _symbols: symbols, _decodeCode: decodeCode, _simulate: simulate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else { root.GW = root.GW || {}; root.GW.prgImport = api; }
})(typeof window !== 'undefined' ? window : globalThis);
