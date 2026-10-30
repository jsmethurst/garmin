/* Code generation: design -> Connect IQ project (Monkey C source + manifest + resources). */
(function (GW) {
  'use strict';

  // ---------- Monkey C helper methods (emitted only when used) ----------
  function sensor(name, getter) {
    return 'function ' + name + '() {\n' +
      '        if ((Toybox has :SensorHistory) && (SensorHistory has :' + getter + ')) {\n' +
      '            var it = SensorHistory.' + getter + '({:period => 1, :order => SensorHistory.ORDER_NEWEST_FIRST});\n' +
      '            if (it != null) {\n' +
      '                var s = it.next();\n' +
      '                if (s != null && s.data != null) { return s.data.toNumber(); }\n' +
      '            }\n' +
      '        }\n' +
      '        return null;\n' +
      '    }';
  }
  var H = {
    ns: { code: 'function ns(v) {\n        return (v == null) ? "--" : v.toString();\n    }' },
    ang: { code: 'function ang(a) {\n        a = a % 360;\n        if (a < 0) { a += 360; }\n        return a;\n    }' },
    prog: { code: 'function prog(v, mn, mx) {\n        if (v == null || mx <= mn) { return 0.0f; }\n        var p = (v.toFloat() - mn.toFloat()) / (mx.toFloat() - mn.toFloat());\n        if (p < 0.0f) { p = 0.0f; }\n        if (p > 1.0f) { p = 1.0f; }\n        return p;\n    }' },
    cap: { code: 'function cap(dc, cx, cy, r, deg, hw) {\n        var a = deg * Math.PI / 180.0;\n        dc.fillCircle(cx + (r * Math.cos(a)).toNumber(), cy - (r * Math.sin(a)).toNumber(), hw);\n    }', imports: ['Toybox.Math'] },
    drawHand: {
      imports: ['Toybox.Math'],
      code: 'function drawHand(dc, cx, cy, a, pts) {\n        var s = Math.sin(a);\n        var c = Math.cos(a);\n        var out = new [pts.size()];\n' +
        '        for (var i = 0; i < pts.size(); i++) {\n            var u = pts[i][0];\n            var v = pts[i][1];\n' +
        '            out[i] = [(cx + u * c + v * s).toNumber(), (cy + u * s - v * c).toNumber()];\n        }\n        dc.fillPolygon(out);\n    }'
    },
    hourNum: { needs: ['clk'], code: 'function hourNum(mode) {\n        var h = _clk.hour;\n        var use24 = (mode == 1) ? true : ((mode == 2) ? false : System.getDeviceSettings().is24Hour);\n        if (!use24) {\n            h = h % 12;\n            if (h == 0) { h = 12; }\n        }\n        return h;\n    }' },
    hourStr: { deps: ['hourNum'], code: 'function hourStr(mode, lz) {\n        var h = hourNum(mode);\n        return lz ? h.format("%02d") : h.toString();\n    }' },
    stepsNow: { needs: ['act'], code: 'function stepsNow() {\n        return (_act.steps != null) ? _act.steps : 0;\n    }' },
    stepGoalNow: { needs: ['act'], code: 'function stepGoalNow() {\n        return (_act.stepGoal != null) ? _act.stepGoal : 10000;\n    }' },
    calNow: { needs: ['act'], code: 'function calNow() {\n        return (_act.calories != null) ? _act.calories : 0;\n    }' },
    floorsNow: { needs: ['act'], code: 'function floorsNow() {\n        return ((_act has :floorsClimbed) && _act.floorsClimbed != null) ? _act.floorsClimbed : 0;\n    }' },
    floorGoalNow: { needs: ['act'], code: 'function floorGoalNow() {\n        return ((_act has :floorsClimbedGoal) && _act.floorsClimbedGoal != null) ? _act.floorsClimbedGoal : 10;\n    }' },
    intNow: { needs: ['act'], code: 'function intNow() {\n        return (_act.activeMinutesWeek != null) ? _act.activeMinutesWeek.total : 0;\n    }' },
    intGoalNow: { needs: ['act'], code: 'function intGoalNow() {\n        return (_act.activeMinutesWeekGoal != null) ? _act.activeMinutesWeekGoal : 150;\n    }' },
    moveNow: { needs: ['act'], code: 'function moveNow() {\n        return ((_act has :moveBarLevel) && _act.moveBarLevel != null) ? _act.moveBarLevel : 0;\n    }' },
    distNow: {
      needs: ['act'],
      code: 'function distNow(mode) {\n        if (_act.distance == null) { return 0.0; }\n        var km = _act.distance.toFloat() / 100000.0;\n' +
        '        var mi = (mode == 2) || (mode == 0 && System.getDeviceSettings().distanceUnits == System.UNIT_STATUTE);\n        return mi ? km * 0.621371 : km;\n    }'
    },
    batteryNow: { needs: ['sys'], code: 'function batteryNow() {\n        return (_sys.battery + 0.5).toNumber();\n    }' },
    batteryDaysNow: { needs: ['sys'], code: 'function batteryDaysNow() {\n        return (_sys has :batteryInDays) ? _sys.batteryInDays : 0.0;\n    }' },
    notifNow: { code: 'function notifNow() {\n        var n = System.getDeviceSettings().notificationCount;\n        return (n != null) ? n : 0;\n    }' },
    hrNow: {
      imports: ['Toybox.Activity', 'Toybox.SensorHistory'],
      code: 'function hrNow() {\n        var ai = Activity.getActivityInfo();\n        if (ai != null && ai.currentHeartRate != null) { return ai.currentHeartRate; }\n' +
        '        if ((Toybox has :SensorHistory) && (SensorHistory has :getHeartRateHistory)) {\n' +
        '            var it = SensorHistory.getHeartRateHistory({:period => 1, :order => SensorHistory.ORDER_NEWEST_FIRST});\n' +
        '            if (it != null) {\n                var s = it.next();\n                if (s != null && s.data != null) { return s.data.toNumber(); }\n            }\n        }\n        return null;\n    }'
    },
    bodyBatNow: { imports: ['Toybox.SensorHistory'], code: sensor('bodyBatNow', 'getBodyBatteryHistory') },
    stressNow: { imports: ['Toybox.SensorHistory'], code: sensor('stressNow', 'getStressHistory') },
    spo2Now: { imports: ['Toybox.SensorHistory'], code: sensor('spo2Now', 'getOxygenSaturationHistory') },
    respNow: { imports: ['Toybox.SensorHistory'], code: sensor('respNow', 'getRespirationRateHistory') },
    tempNow: {
      needs: ['wx'],
      code: 'function tempNow(mode) {\n        if (_wx == null || _wx.temperature == null) { return null; }\n        var t = _wx.temperature.toFloat();\n' +
        '        var f = (mode == 2) || (mode == 0 && System.getDeviceSettings().temperatureUnits == System.UNIT_STATUTE);\n' +
        '        if (f) { t = t * 9.0 / 5.0 + 32.0; }\n        return Math.round(t).toNumber();\n    }',
      imports: ['Toybox.Math']
    },
    altNow: {
      imports: ['Toybox.Activity'],
      code: 'function altNow(mode) {\n        var ai = Activity.getActivityInfo();\n        if (ai == null || ai.altitude == null) { return null; }\n        var a = ai.altitude.toFloat();\n' +
        '        var ft = (mode == 2) || (mode == 0 && System.getDeviceSettings().elevationUnits == System.UNIT_STATUTE);\n' +
        '        if (ft) { a = a * 3.28084; }\n        return Math.round(a).toNumber();\n    }',
    },
    wxGroup: {
      needs: ['wx'],
      code: 'function wxGroup() {\n        if (_wx == null || _wx.condition == null) { return 8; }\n        var c = _wx.condition;\n' +
        '        if (c == Weather.CONDITION_CLEAR || c == Weather.CONDITION_MOSTLY_CLEAR || c == Weather.CONDITION_PARTLY_CLEAR || c == Weather.CONDITION_FAIR) { return 0; }\n' +
        '        if (c == Weather.CONDITION_PARTLY_CLOUDY || c == Weather.CONDITION_THIN_CLOUDS) { return 1; }\n' +
        '        if (c == Weather.CONDITION_MOSTLY_CLOUDY || c == Weather.CONDITION_CLOUDY) { return 2; }\n' +
        '        if (c == Weather.CONDITION_RAIN || c == Weather.CONDITION_LIGHT_RAIN || c == Weather.CONDITION_HEAVY_RAIN || c == Weather.CONDITION_DRIZZLE || c == Weather.CONDITION_SHOWERS || c == Weather.CONDITION_LIGHT_SHOWERS || c == Weather.CONDITION_HEAVY_SHOWERS || c == Weather.CONDITION_SCATTERED_SHOWERS || c == Weather.CONDITION_CHANCE_OF_SHOWERS || c == Weather.CONDITION_FREEZING_RAIN) { return 3; }\n' +
        '        if (c == Weather.CONDITION_SNOW || c == Weather.CONDITION_LIGHT_SNOW || c == Weather.CONDITION_HEAVY_SNOW || c == Weather.CONDITION_FLURRIES || c == Weather.CONDITION_CHANCE_OF_SNOW) { return 4; }\n' +
        '        if (c == Weather.CONDITION_THUNDERSTORMS || c == Weather.CONDITION_SCATTERED_THUNDERSTORMS || c == Weather.CONDITION_CHANCE_OF_THUNDERSTORMS) { return 5; }\n' +
        '        if (c == Weather.CONDITION_WINDY || c == Weather.CONDITION_FOG || c == Weather.CONDITION_HAZY || c == Weather.CONDITION_HAZE || c == Weather.CONDITION_MIST) { return 6; }\n' +
        '        if (c == Weather.CONDITION_WINTRY_MIX || c == Weather.CONDITION_RAIN_SNOW || c == Weather.CONDITION_SLEET || c == Weather.CONDITION_ICE) { return 7; }\n' +
        '        return 8;\n    }'
    },
    wxName: {
      deps: ['wxGroup'],
      code: 'function wxName() {\n        var names = ["Clear", "Part cloudy", "Cloudy", "Rain", "Snow", "Storm", "Fog", "Sleet", "--"];\n        return names[wxGroup()];\n    }'
    },
    locNow: {
      needs: ['wx'], imports: ['Toybox.Activity'],
      members: ['    var _lat;', '    var _lon;'],
      code: 'function locNow() {\n        var loc = null;\n        var ai = Activity.getActivityInfo();\n        if (ai != null && ai.currentLocation != null) { loc = ai.currentLocation.toDegrees(); }\n' +
        '        if ((loc == null || (loc[0].toFloat() == 0.0 && loc[1].toFloat() == 0.0)) && _wx != null && _wx.observationLocationPosition != null) {\n            loc = _wx.observationLocationPosition.toDegrees();\n        }\n' +
        '        if (loc != null && (loc[0].toFloat() != 0.0 || loc[1].toFloat() != 0.0)) {\n            _lat = loc[0].toFloat();\n            _lon = loc[1].toFloat();\n        }\n' +
        '        return (_lat != null) ? [_lat, _lon] : null;\n    }'
    },
    sunStr: {
      needs: ['wx'],
      code: 'function sunStr(mode) {\n        if (_wx == null || _wx.observationLocationPosition == null) { return "--:--"; }\n        var loc = _wx.observationLocationPosition;\n        var now = Time.now();\n        var m = null;\n' +
        '        if (mode == 1) {\n            m = Weather.getSunrise(loc, now);\n        } else if (mode == 2) {\n            m = Weather.getSunset(loc, now);\n        } else {\n' +
        '            var rise = Weather.getSunrise(loc, now);\n            var sset = Weather.getSunset(loc, now);\n' +
        '            if (rise != null && now.lessThan(rise)) {\n                m = rise;\n            } else if (sset != null && now.lessThan(sset)) {\n                m = sset;\n            } else {\n' +
        '                m = Weather.getSunrise(loc, now.add(new Time.Duration(86400)));\n            }\n        }\n' +
        '        if (m == null) { return "--:--"; }\n        var t = Gregorian.info(m, Time.FORMAT_SHORT);\n        var h = t.hour;\n' +
        '        if (!System.getDeviceSettings().is24Hour) {\n            h = h % 12;\n            if (h == 0) { h = 12; }\n        }\n        return h.format("%02d") + ":" + t.min.format("%02d");\n    }'
    },
    dayPct: { needs: ['clk'], code: 'function dayPct() {\n        return (_clk.hour * 3600 + _clk.min * 60 + _clk.sec) / 864.0;\n    }' },
    dayOfYearNow: {
      imports: ['Toybox.Time', 'Toybox.Time.Gregorian'],
      code: 'function dayOfYearNow() {\n        var i = Gregorian.info(Time.now(), Time.FORMAT_SHORT);\n        var cum = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];\n        var d = cum[i.month - 1] + i.day;\n' +
        '        if (i.month > 2 && ((i.year % 4 == 0 && i.year % 100 != 0) || i.year % 400 == 0)) { d += 1; }\n        return d;\n    }'
    },
    yearPct: {
      deps: ['dayOfYearNow'], needs: ['clk'], imports: ['Toybox.Time', 'Toybox.Time.Gregorian'],
      code: 'function yearPct() {\n        var y = Gregorian.info(Time.now(), Time.FORMAT_SHORT).year;\n        var days = ((y % 4 == 0 && y % 100 != 0) || y % 400 == 0) ? 366.0 : 365.0;\n' +
        '        var frac = (_clk.hour * 3600 + _clk.min * 60 + _clk.sec) / 86400.0;\n        return ((dayOfYearNow() - 1).toFloat() + frac) / days * 100.0;\n    }'
    },
    moonPhase: {
      imports: ['Toybox.Time'],
      code: 'function moonPhase() {\n        var days = (Time.now().value() - 947182440).toFloat() / 86400.0;\n        var p = days / 29.530588853;\n        return p - p.toNumber().toFloat();\n    }'
    },
    lastAct: {
      imports: ['Toybox.UserProfile', 'Toybox.Time'],
      members: ['    var _laT = 0;', '    var _laKm = "--";', '    var _laPace = "--";'],
      code: 'function lastRefresh() {\n        var now = Time.now().value();\n        if (_laT != 0 && now - _laT < 60) { return; }\n        _laT = now;\n        _laKm = "--";\n        _laPace = "--";\n' +
        '        if (!(UserProfile has :getUserActivityHistory)) { return; }\n        var it = UserProfile.getUserActivityHistory();\n        var a = (it != null) ? it.next() : null;\n' +
        '        if (a == null || a.distance == null || a.distance <= 0) { return; }\n        _laKm = (a.distance / 1000.0).format("%.1f");\n' +
        '        if (a.duration != null && a.distance >= 100) {\n            var s = (a.duration.value() / (a.distance / 1000.0)).toNumber();\n            _laPace = (s / 60).format("%d") + ":" + (s % 60).format("%02d");\n        }\n    }\n\n' +
        '    function lastKmStr() {\n        lastRefresh();\n        return _laKm;\n    }\n\n    function lastPaceStr() {\n        lastRefresh();\n        return _laPace;\n    }'
    },
    nyStr: {
      imports: ['Toybox.Time', 'Toybox.Time.Gregorian'],
      code: 'function nyStr(mode) {\n        var now = Time.now();\n        var year = Gregorian.utcInfo(now, Time.FORMAT_SHORT).year;\n' +
        '        var start = nthSun(year, 3, 2, 7);    // 2nd Sunday in March, 02:00 EST = 07:00 UTC\n        var end = nthSun(year, 11, 1, 6);     // 1st Sunday in November, 02:00 EDT = 06:00 UTC\n' +
        '        var off = (now.compare(start) >= 0 && now.compare(end) < 0) ? -4 : -5;\n        if (mode == 1) { return (off == -4) ? "EDT" : "EST"; }\n' +
        '        var i = Gregorian.utcInfo(now.add(new Time.Duration(off * 3600)), Time.FORMAT_SHORT);\n        return i.hour.format("%02d") + ":" + i.min.format("%02d");\n    }\n\n' +
        '    function nthSun(year, month, n, hourUtc) {\n        var first = Gregorian.moment({ :year => year, :month => month, :day => 1, :hour => 0 });\n' +
        '        var dow = Gregorian.utcInfo(first, Time.FORMAT_SHORT).day_of_week;   // 1 = Sunday\n        var day = 1 + ((8 - dow) % 7) + (n - 1) * 7;\n        return Gregorian.moment({ :year => year, :month => month, :day => day, :hour => hourUtc });\n    }'
    },
    rotTxt: {
      imports: ['Toybox.Math'],
      code: 'function rotTxt(dc, font, adv, m, s, x, y, just) {\n        var a = Math.toRadians(m[0]);\n        var c = Math.cos(a);\n        var sn = Math.sin(a);\n        var chars = s.toCharArray();\n        var tw = 0;\n' +
        '        for (var i = 0; i < chars.size(); i++) {\n            var w = adv[chars[i]];\n            tw += (w != null) ? w : 8;\n        }\n' +
        '        var off = (just == 1) ? -tw / 2.0 : ((just == 2) ? -tw.toFloat() : 0.0);\n        var px = x + off * c;\n        var py = y + off * sn;\n' +
        '        for (var j = 0; j < chars.size(); j++) {\n            var ch = chars[j];\n            if (ch != \' \') {\n                dc.drawText((px - m[2]).toNumber(), (py - m[1]).toNumber(), font, ch.toString(), Graphics.TEXT_JUSTIFY_LEFT);\n            }\n' +
        '            var w2 = adv[ch];\n            if (w2 == null) { w2 = 8; }\n            px += w2 * c;\n            py += w2 * sn;\n        }\n    }'
    },
    moonIllum: { deps: ['moonPhase'], imports: ['Toybox.Math'], code: 'function moonIllum() {\n        return ((1.0 - Math.cos(2.0 * Math.PI * moonPhase())) * 50.0 + 0.5).toNumber();\n    }' },
    moonName: {
      deps: ['moonPhase'],
      code: 'function moonName() {\n        var p = moonPhase();\n        if (p < 0.03 || p >= 0.97) { return "New moon"; }\n        if (p < 0.22) { return "Waxing crescent"; }\n        if (p < 0.28) { return "First quarter"; }\n        if (p < 0.47) { return "Waxing gibbous"; }\n' +
        '        if (p < 0.53) { return "Full moon"; }\n        if (p < 0.72) { return "Waning gibbous"; }\n        if (p < 0.78) { return "Last quarter"; }\n        return "Waning crescent";\n    }'
    },
    histVals: {
      needs: ['act'], imports: ['Toybox.ActivityMonitor'],
      code: 'function histVals(kind) {\n        var vals = new [8];\n        for (var i = 0; i < 8; i++) { vals[i] = 0; }\n' +
        '        if (kind == 0) { vals[7] = (_act.steps != null) ? _act.steps : 0; }\n' +
        '        else if (kind == 1) { vals[7] = (_act.calories != null) ? _act.calories : 0; }\n' +
        '        else if (kind == 2) { vals[7] = (_act.activeMinutesDay != null) ? _act.activeMinutesDay.total : 0; }\n' +
        '        else { vals[7] = ((_act has :floorsClimbed) && _act.floorsClimbed != null) ? _act.floorsClimbed : 0; }\n' +
        '        var h = ActivityMonitor.getHistory();\n        if (h != null) {\n            for (var d = 0; d < 7 && d < h.size(); d++) {\n                var e = h[d];\n                var v = 0;\n' +
        '                if (kind == 0) { if (e.steps != null) { v = e.steps; } }\n' +
        '                else if (kind == 1) { if (e.calories != null) { v = e.calories; } }\n' +
        '                else if (kind == 2) { if (e.activeMinutes != null && e.activeMinutes.total != null) { v = e.activeMinutes.total; } }\n' +
        '                else { if (e.floorsClimbed != null) { v = e.floorsClimbed; } }\n' +
        '                vals[6 - d] = v;\n            }\n        }\n        return vals;\n    }'
    }
  };
  if (GW.RUNFIELD_SRC) H.fld = { code: GW.RUNFIELD_SRC.code, members: GW.RUNFIELD_SRC.members }; // run data field methods
  if (GW.DF_SRC) H.dfd = { code: GW.DF_SRC.code, members: GW.DF_SRC.members }; // data-cell maths for the data field builder
  GW.MC_HELPERS = H;

  var NEED_INIT = {
    clk: '_clk = System.getClockTime();',
    act: '_act = ActivityMonitor.getInfo();',
    sys: '_sys = System.getSystemStats();',
    wx: '_wx = (Toybox has :Weather) ? Weather.getCurrentConditions() : null;',
    ds: '_ds = Gregorian.info(_now, Time.FORMAT_SHORT);',
    dm: '_dm = Gregorian.info(_now, Time.FORMAT_MEDIUM);',
    dl: '_dl = Gregorian.info(_now, Time.FORMAT_LONG);'
  };
  var NEED_ORDER = ['clk', 'act', 'sys', 'wx', 'ds', 'dm', 'dl'];

  GW.fontResId = function (f) { return f.id; };

  // ---------- main generator ----------
  GW.generateSource = function (design) {
    var st = { needs: {}, helpers: [], hseen: {}, imports: {}, perms: {}, fonts: [], fseen: {}, images: [], iseen: {}, files: {}, minApi: '3.2.0', hooks: { begin: [], init: [], compute: [], lap: [], reset: [] }, extraMembers: [] };
    var warnings = [];
    var cg = {
      design: design,
      need: function (f) { st.needs[f] = 1; if (f === 'ds' || f === 'dm' || f === 'dl') { cg.imp('Toybox.Time'); cg.imp('Toybox.Time.Gregorian'); } if (f === 'wx') cg.imp('Toybox.Weather'); if (f === 'act') cg.imp('Toybox.ActivityMonitor'); },
      imp: function (s) { st.imports[s] = 1; },
      perm: function (s) { st.perms[s] = 1; },
      hook: function (name, line) { if (st.hooks[name].indexOf(line) < 0) st.hooks[name].push(line); },   // data-field callbacks
      member: function (line) { if (st.extraMembers.indexOf(line) < 0) st.extraMembers.push(line); },
      file: function (path, text) { st.files[path] = text; },                 // extra source files (e.g. data modules)
      minApi: function (v) {                                                  // raise manifest minApiLevel if needed
        var a = v.split('.').map(Number), b = st.minApi.split('.').map(Number);
        for (var i = 0; i < 3; i++) { if (a[i] !== b[i]) { if (a[i] > b[i]) st.minApi = v; break; } }
      },
      helper: function (n) {
        if (st.hseen[n]) return;
        var h = H[n]; if (!h) throw new Error('Unknown helper ' + n);
        st.hseen[n] = 1;
        (h.deps || []).forEach(cg.helper); (h.needs || []).forEach(cg.need); (h.imports || []).forEach(cg.imp);
        st.helpers.push(n);
      },
      font: function (id) {
        if (GW.isSysFont(id)) return 'Graphics.' + id;
        var f = GW.customFont(id);
        if (!f) return 'Graphics.FONT_SMALL';
        if (!st.fseen[id]) { st.fseen[id] = 1; st.fonts.push(f); }
        return '_' + id;
      },
      // a copy of a bitmap font whose glyph images are rotated (for the rotated export); returns the names to pass to rotTxt
      rotFont: function (id, deg) {
        var f = GW.customFont(id), rid = id + '_r' + Math.round(deg), info = GW.rotFontInfo(f, deg), met = GW.fontMetrics(f);
        if (!st.fseen[rid]) {
          st.fseen[rid] = 1; st.fonts.push(Object.assign({}, f, { id: rid, rot: deg }));
          var ents = met.chars.split('').map(function (ch) {
            var lit = ch === "'" ? "'\\''" : (ch === '\\' ? "'\\\\'" : "'" + ch + "'");
            return lit + ' => ' + met.glyphs[ch].adv;
          });
          cg.member('    const RA_' + rid + ' = { ' + ents.join(', ') + ' };');
          cg.member('    const RM_' + rid + ' = [' + Math.round(deg) + ', ' + info.base + ', ' + info.lm + '];');
        }
        return { ref: '_' + rid, adv: 'RA_' + rid, m: 'RM_' + rid };
      },
      image: function (assetId, w, h) {
        var k = assetId + ':' + w + 'x' + h;
        if (!st.iseen[k]) { st.iseen[k] = { id: 'img' + st.images.length, asset: assetId, w: w, h: h }; st.images.push(st.iseen[k]); }
        return '_' + st.iseen[k].id;
      }
    };

    var els = design.elements.filter(function (e) { return !e.hidden; });
    var methods = [], calls = [];
    els.forEach(function (e, i) {
      var t = GW.types[e.type]; if (!t) return;
      var lines = t.gen(e, cg);
      if (!lines || !lines.length) return;
      var n = 'drawEl' + i;
      methods.push('    // ' + (e.name || e.type).replace(/[\r\n]/g, ' ') + '\n    function ' + n + '(dc as Dc) as Void {\n' +
        lines.map(function (l) { return '        ' + l; }).join('\n') + '\n    }');
      calls.push('        ' + n + '(dc);');
    });
    var bg = null;
    if (design.bgImage && GW.assets[design.bgImage]) bg = { id: 'bgImage', asset: design.bgImage, w: GW.SIZE, h: GW.SIZE, full: true };

    // helper bodies may need further flags: already handled via cg.helper
    var name = GW.slug(design.name);
    var perms = Object.keys(st.perms);
    var isField = design.kind === 'datafield';
    var imports = ['Toybox.Application', 'Toybox.Graphics', 'Toybox.Lang', 'Toybox.System', 'Toybox.WatchUi'];
    if (isField) imports.push('Toybox.Activity');
    Object.keys(st.imports).sort().forEach(function (i) { if (imports.indexOf(i) < 0) imports.push(i); });

    var needFlags = NEED_ORDER.filter(function (f) { return st.needs[f]; });
    var members = [];
    if (st.needs.clk) members.push('    var _clk;');
    if (st.needs.act) members.push('    var _act;');
    if (st.needs.sys) members.push('    var _sys;');
    if (st.needs.wx) members.push('    var _wx;');
    ['ds', 'dm', 'dl'].forEach(function (f) { if (st.needs[f]) members.push('    var _' + f + ';'); });
    members.push('    var _sleep = false;');
    st.extraMembers.forEach(function (m) { members.push(m); });
    st.helpers.forEach(function (n) { (H[n].members || []).forEach(function (m) { members.push(m); }); });
    st.fonts.forEach(function (f) { members.push('    var _' + f.id + ';'); });
    st.images.forEach(function (m) { members.push('    var _' + m.id + ';'); });
    if (bg) members.push('    var _bg;');

    var layout = [];
    st.fonts.forEach(function (f) { layout.push('        _' + f.id + ' = WatchUi.loadResource(Rez.Fonts.' + f.id + ');'); });
    st.images.forEach(function (m) { layout.push('        _' + m.id + ' = WatchUi.loadResource(Rez.Drawables.' + m.id + ');'); });
    if (bg) layout.push('        _bg = WatchUi.loadResource(Rez.Drawables.bgImage);');

    var init = [];
    var dateNeeded = st.needs.ds || st.needs.dm || st.needs.dl;
    if (dateNeeded) init.push('        var _now = Time.now();');
    needFlags.forEach(function (f) { init.push('        ' + NEED_INIT[f]); });

    var view =
      '// ' + design.name + ' - generated by Garmin Studio (' + GW.DEVICE.name + ', ' + GW.SIZE + 'x' + GW.SIZE + ')\n' +
      imports.map(function (i) { return 'import ' + i + ';'; }).join('\n') + '\n\n' +
      'class ' + name + 'View extends WatchUi.' + (isField ? 'DataField' : 'WatchFace') + ' {\n\n' +
      members.join('\n') + '\n\n' +
      '    function initialize() {\n        ' + (isField ? 'DataField' : 'WatchFace') + '.initialize();\n' + st.hooks.init.map(function (l) { return '        ' + l + '\n'; }).join('') + '    }\n\n' +
      '    function onLayout(dc as Dc) as Void {\n' + (layout.length ? layout.join('\n') + '\n' : '') + '    }\n\n' +
      '    function onUpdate(dc as Dc) as Void {\n' +
      (st.hooks.begin.length ? st.hooks.begin.map(function (l) { return '        ' + l + '\n'; }).join('')
        : '        dc.setColor(Graphics.COLOR_WHITE, ' + GW.mcColor(design.bg) + ');\n        dc.clear();\n') +
      (bg ? '        dc.drawBitmap(0, 0, _bg);\n' : '') +
      (init.length ? init.join('\n') + '\n' : '') +
      calls.join('\n') + '\n    }\n\n' +
      (isField
        ? '    // called every second with the activity data\n    function compute(info as Activity.Info) as Void {\n' + st.hooks.compute.map(function (l) { return '        ' + l + '\n'; }).join('') + '    }\n\n' +
          '    function onTimerLap() as Void {\n' + st.hooks.lap.map(function (l) { return '        ' + l + '\n'; }).join('') + '    }\n\n' +
          '    function onTimerReset() as Void {\n' + st.hooks.reset.map(function (l) { return '        ' + l + '\n'; }).join('') + '    }\n'
        : '    function onEnterSleep() as Void {\n        _sleep = true;\n        WatchUi.requestUpdate();\n    }\n\n' +
          '    function onExitSleep() as Void {\n        _sleep = false;\n        WatchUi.requestUpdate();\n    }\n') +
      (methods.length ? '\n    // ---- elements ----\n\n' + methods.join('\n\n') + '\n' : '') +
      (st.helpers.length ? '\n    // ---- data helpers ----\n\n' + st.helpers.map(function (n) { return '    ' + H[n].code; }).join('\n\n') + '\n' : '') +
      '}\n';

    var app =
      'import Toybox.Application;\nimport Toybox.Lang;\nimport Toybox.WatchUi;\n\n' +
      'class ' + name + 'App extends Application.AppBase {\n\n' +
      '    function initialize() {\n        AppBase.initialize();\n    }\n\n' +
      '    function getInitialView() as [Views] or [Views, InputDelegates] {\n        return [ new ' + name + 'View() ];\n    }\n}\n';

    // ---------- warnings ----------
    var imgPx = 0;
    st.images.forEach(function (m) { imgPx += m.w * m.h; });
    if (bg) { imgPx += GW.SIZE * GW.SIZE; warnings.push('Full-screen background image: uses a lot of watch memory (~' + Math.round(GW.SIZE * GW.SIZE / 1024) + ' KB). If the watchface fails to load, remove it or use shapes instead.'); }
    if (imgPx > 30000 && !bg) warnings.push('Images total ' + Math.round(imgPx / 1000) + 'k pixels: large for a watchface. Keep it small if the face fails to load.');
    if (st.fonts.length > 3) warnings.push(st.fonts.length + ' custom bitmap fonts: each one is held in watch memory. Consider fewer sizes/glyph sets.');
    if (els.some(function (e) { return e.type === 'hands' && e.sShow; })) warnings.push('Second hand only moves while the wrist is raised (high-power mode); it is hidden in low-power mode.');
    if (els.some(function (e) { return (e.type === 'text' && (e.source === 'second' || (e.source === 'time' && e.secs))); })) warnings.push('Seconds text freezes in low-power mode (the watch redraws once a minute).');
    if (els.some(function (e) { return e.type === 'text' && ['weatherDesc', 'temp', 'sunrise', 'sunset', 'sunNext'].indexOf(e.source) >= 0; })) warnings.push('Weather and sun times only show data once the watch has synced weather from your phone (they read "--" until then).');
    if (!els.length) warnings.push('The design is empty.');

    return { name: name, type: isField ? 'datafield' : 'watchface', app: app, view: view, perms: perms, fonts: st.fonts, images: st.images, bg: bg, warnings: warnings, files: st.files, minApi: st.minApi };
  };
})(window.GW);
