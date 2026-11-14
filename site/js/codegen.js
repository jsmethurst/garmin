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
        '            out[i] = [(cx + u * c + v * s).toNumber(), (cy + u * s - v * c).toNumber()];\n        }\n        dc.fillPolygon(out);\n        return out;\n    }'
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
    workoutDist: {
      imports: ['Toybox.Activity'],
      code: 'function workoutDist(mode) {\n        var ai = Activity.getActivityInfo();\n        if (ai == null || ai.elapsedDistance == null) { return "--"; }\n' +
        '        var km = ai.elapsedDistance.toFloat() / 1000.0;\n        var mi = (mode == 2) || (mode == 0 && System.getDeviceSettings().distanceUnits == System.UNIT_STATUTE);\n' +
        '        if (mi) { km = km * 0.621371; }\n        return km.format("%.2f");\n    }'
    },
    batteryNow: { needs: ['sys'], code: 'function batteryNow() {\n        return (_sys.battery + 0.5).toNumber();\n    }' },
    batteryDaysNow: { needs: ['sys'], code: 'function batteryDaysNow() {\n        return (_sys has :batteryInDays) ? _sys.batteryInDays : 0.0;\n    }' },
    notifNow: { code: 'function notifNow() {\n        var n = System.getDeviceSettings().notificationCount;\n        return (n != null) ? n : 0;\n    }' },
    hrNow: {
      imports: ['Toybox.SensorHistory'],
      code: 'function hrNow() {\n' +
        '        if ((Toybox has :SensorHistory) && (SensorHistory has :getHeartRateHistory)) {\n' +
        '            var it = SensorHistory.getHeartRateHistory({:period => 1, :order => SensorHistory.ORDER_NEWEST_FIRST});\n' +
        '            if (it != null) {\n                var s = it.next();\n                if (s != null && s.data != null) { return s.data.toNumber(); }\n            }\n        }\n        return null;\n    }'
    },
    bodyBatNow: { imports: ['Toybox.SensorHistory'], code: sensor('bodyBatNow', 'getBodyBatteryHistory') },
    stressNow: { imports: ['Toybox.SensorHistory'], code: sensor('stressNow', 'getStressHistory') },
    spo2Now: { imports: ['Toybox.SensorHistory'], code: sensor('spo2Now', 'getOxygenSaturationHistory') },
    respNow: { imports: ['Toybox.SensorHistory'], code: sensor('respNow', 'getRespirationRateHistory') },
    tempLowNow: {
      needs: ['wx'],
      code: 'function tempLowNow(mode) {\n        if (_wx == null || _wx.lowTemperature == null) { return null; }\n        var t = _wx.lowTemperature.toFloat();\n' +
        '        var f = (mode == 2) || (mode == 0 && System.getDeviceSettings().temperatureUnits == System.UNIT_STATUTE);\n' +
        '        if (f) { t = t * 9.0 / 5.0 + 32.0; }\n        return Math.round(t).toNumber();\n    }',
      imports: ['Toybox.Math']
    },
    tempHighNow: {
      needs: ['wx'],
      code: 'function tempHighNow(mode) {\n        if (_wx == null || _wx.highTemperature == null) { return null; }\n        var t = _wx.highTemperature.toFloat();\n' +
        '        var f = (mode == 2) || (mode == 0 && System.getDeviceSettings().temperatureUnits == System.UNIT_STATUTE);\n' +
        '        if (f) { t = t * 9.0 / 5.0 + 32.0; }\n        return Math.round(t).toNumber();\n    }',
      imports: ['Toybox.Math']
    },
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
      members: ['    const WX_NAMES = ["Clear", "Part cloudy", "Cloudy", "Rain", "Snow", "Storm", "Fog", "Sleet", "--"];'],
      code: 'function wxName() {\n        return WX_NAMES[wxGroup()];\n    }'
    },
    wxNameTr: {
      deps: ['wxGroup'],
      members: ['    const WX_NAMES_TR = ["AÇIK", "PARÇALI BULUTLU", "BULUTLU", "YAĞMURLU", "KARLI", "FIRTINALI", "SİSLİ", "KARLI YAĞMUR", "--"];'],
      code: 'function wxNameTr() {\n        return WX_NAMES_TR[wxGroup()];\n    }'
    },
    // Segment34's weather line: joinFour(temperature, wind, condition): "17C, d12, PARÇALI". The wind is an arrow (a letter of the font: a..h by bearing) and km/h.
    tempCond: {
      deps: ['wxGroup'], needs: ['wx'],
      members: ['    const WXL_TR = ["açık", "parçalı", "bulutlu", "yağmur", "kar", "fırtına", "sis", "karlı yağ", "--"];'],
      code: 'function tempCond() {\n        var s = "";\n        if (_wx == null) { return s; }\n        if (_wx.temperature != null) { s = _wx.temperature.format("%d") + "°C"; }\n        if (_wx.condition != null) {\n            var c = WXL_TR[wxGroup()];\n            s = (s.length() > 0) ? s + ", " + c : c;\n        }\n        return s;\n    }'
    },
    wxLine: {
      deps: ['wxGroup'], needs: ['wx'], imports: ['Toybox.Math'],
      members: ['    const WXC_EN = ["CLEAR", "CLOUDY", "CLOUDY", "RAIN", "SNOW", "STORM", "FOG", "WINTRY", "--"];', '    const WXC_TR = ["AÇIK", "PARÇALI", "BULUTLU", "YAĞMUR", "KAR", "FIRTINA", "SİS", "KARLI YAĞ", "--"];'],
      code: 'function wxLine(tr) {\n        var s = "";\n        if (_wx == null) { return s; }\n        if (_wx.temperature != null) { s = _wx.temperature.format("%d") + "C"; }\n        var w = "";\n        if (_wx.windSpeed != null) {\n            if (_wx.windBearing != null) { w = ((Math.round((_wx.windBearing.toFloat() + 180) / 45.0).toNumber() % 8) + 97).toChar().toString(); }\n            w += Math.round(_wx.windSpeed * 3.6).format("%01d");\n        }\n        if (w.length() > 0) { s = (s.length() > 0) ? s + ", " + w : w; }\n        var c = _wx.condition != null ? (tr ? WXC_TR[wxGroup()] : WXC_EN[wxGroup()]) : "";\n        if (c.length() > 0) { s = (s.length() > 0) ? s + ", " + c : c; }\n        return s;\n    }'
    },
    runKmWeek: {
      deps: ['runKm7'], imports: ['Toybox.Complications'], perms: ['ComplicationSubscriber'],
      code: 'function runKmWeek() {\n        if (Toybox has :Complications) {\n            try {\n                var c = Complications.getComplication(new Complications.Id(Complications.COMPLICATION_TYPE_WEEKLY_RUN_DISTANCE));\n                if (c != null && c.value != null) { return c.value / 1000.0; }\n            } catch (e) { }\n        }\n        return runKm7();\n    }'
    },
    runKm7: {
      imports: ['Toybox.UserProfile', 'Toybox.Activity', 'Toybox.Time'], perms: ['UserProfile'],
      members: ['    var _runT = 0;', '    var _runV = 0.0;'],
      code: 'function runKm7() {\n        var now = Time.now().value();\n        if (_runT == 0 || now - _runT >= 300) {\n            _runT = now;\n            var d = 0.0;\n            if (UserProfile has :getUserActivityHistory) {\n                var since = now - 604800;\n                var it = UserProfile.getUserActivityHistory();\n                var a = it.next();\n                while (a != null) {\n                    if (a.startTime != null && a.startTime.value() >= since && a.distance != null && a.type == Activity.SPORT_RUNNING) { d += a.distance; }\n                    a = it.next();\n                }\n            }\n            _runV = d / 1000.0;\n        }\n        return _runV;\n    }'
    },
    // The watch's position, in this order: the activity fix (0,0 means "no fix"), the weather location from the phone, then the last
    // position seen. The Position.Location is handed on as it is (never rebuilt from degrees). Position.getInfo() is never called: it
    // interrupts sleep tracking. Until the watch has any position the face's default location is used, if one is set.
    locObj: {
      needs: ['wx'], imports: ['Toybox.Activity', 'Toybox.Position'], perms: ['Positioning'],
      members: ['    var _cachedLoc = null;', '    var _defLoc = null;'],
      code: 'function locObj() {\n        var loc = null;\n        var ai = Activity.getActivityInfo();\n' +
        '        if (ai != null && ai.currentLocation != null) {\n            var dg = ai.currentLocation.toDegrees();\n            if (dg[0] != 0.0 || dg[1] != 0.0) { loc = ai.currentLocation; }\n        }\n' +
        '        if (loc == null && _wx != null && _wx.observationLocationPosition != null) { loc = _wx.observationLocationPosition; }\n' +
        '        if (loc != null) { _cachedLoc = loc; }\n' +
        '        if (_cachedLoc != null) { return _cachedLoc; }\n' +
        '        if (DEF_LOC_ON) {\n            if (_defLoc == null) { _defLoc = new Position.Location({ :latitude => DEF_LAT, :longitude => DEF_LON, :format => :degrees }); }\n            return _defLoc;\n        }\n        return null;\n    }'
    },
    locNow: {
      deps: ['locObj'],
      code: 'function locNow() {\n        var l = locObj();\n        return (l == null) ? null : l.toDegrees();\n    }'
    },
    // Text with a thin outline that shows only over a hand: the screen can only clip to rectangles, so each hand is cut into strips two pixels high
    // and the text is drawn a pixel to each side through the part of every strip that lies inside the hand.
    hugText: {
      imports: ['Toybox.Graphics'],
      code: 'function hugText(dc, s, font, x, y, fl, col, offs) {\n        var d = dc.getTextDimensions(s, font);\n        var w = d[0];\n        var h = d[1];\n' +
        '        var jx = fl & 3;\n        var left = x - ((jx == 1) ? w / 2 : ((jx == 0) ? w : 0));\n        var top = ((fl & 4) == 0) ? y : y - h / 2;\n' +
        '        var polys = [_hpH, _hpM];\n        dc.setColor(col, Graphics.COLOR_TRANSPARENT);\n' +
        '        for (var yy = (top - 2).toNumber(); yy < top + h + 2; yy += 2) {\n            var yc = yy + 1;\n' +
        '            for (var k = 0; k < 2; k++) {\n                var p = polys[k];\n                if (p == null) { continue; }\n                var lo = 9999.0;\n                var hi = -9999.0;\n' +
        '                for (var i = 0; i < p.size(); i++) {\n                    var a = p[i];\n                    var b = p[(i + 1) % p.size()];\n' +
        '                    if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) {\n                        var xx = a[0] + (yc - a[1]).toFloat() * (b[0] - a[0]) / (b[1] - a[1]);\n                        if (xx < lo) { lo = xx; }\n                        if (xx > hi) { hi = xx; }\n                    }\n                }\n' +
        '                var xa = (lo > left - 2) ? lo.toNumber() : (left - 2).toNumber();\n                var xb = (hi < left + w + 2) ? hi.toNumber() : (left + w + 2).toNumber();\n' +
        '                if (hi >= lo && xb > xa) {\n                    dc.setClip(xa, yy, xb - xa + 1, 2);\n                    for (var m = 0; m < offs.size(); m++) {\n                        dc.drawText(x + offs[m][0], y + offs[m][1], font, s, fl);\n                    }\n                }\n            }\n        }\n' +
        '        dc.setClip(0, 0, dc.getWidth(), dc.getHeight());\n    }'
    },
    sunMark: {
      deps: ['locObj'], needs: ['wx'], imports: ['Toybox.Weather', 'Toybox.Time', 'Toybox.Time.Gregorian'],
      members: ['    var _mkMin = -1;', '    var _mk = null;'],
      code: 'function sunMark() {\n        var min = System.getClockTime().min;\n        if (_mkMin == min) { return _mk; }\n        _mkMin = min;\n        _mk = null;\n' +
        '        var loc = locObj();\n        if (loc == null) { return null; }\n        var now = Time.now();\n        var rise = Weather.getSunrise(loc, now);\n        var sset = Weather.getSunset(loc, now);\n' +
        '        var m = null;\n        var isSet = false;\n' +
        '        if (rise != null && now.lessThan(rise)) {\n            m = rise;\n        } else if (sset != null && now.lessThan(sset)) {\n            m = sset;\n            isSet = true;\n        } else {\n            m = Weather.getSunrise(loc, now.add(new Time.Duration(86400)));\n        }\n' +
        '        if (m == null) { return null; }\n        var t = Gregorian.info(m, Time.FORMAT_SHORT);\n        _mk = [t.hour * 60 + t.min, isSet];\n        return _mk;\n    }'
    },
    drawSun: {
      imports: ['Toybox.Math'],
      code: 'function drawSun(dc, x, y, r, isSet) {\n        var hy = r * 0.7;\n        var cy = isSet ? hy + r * 0.45 : hy - r * 0.2;\n        var pts = [];\n' +
        '        for (var d = 180; d <= 360; d += 15) {\n            var a = d * Math.PI / 180.0;\n            var py = cy + r * Math.sin(a);\n            if (py <= hy) {\n                pts.add([(x + r * Math.cos(a)).toNumber(), (y + py).toNumber()]);\n            }\n        }\n' +
        '        if (pts.size() > 2) { dc.fillPolygon(pts); }\n        var pen = (r / 4 > 2) ? (r / 4) : 2;\n        dc.setPenWidth(pen);\n' +
        '        var degs = isSet ? [-135, -90, -45] : [-150, -120, -90, -60, -30];\n' +
        '        for (var i = 0; i < degs.size(); i++) {\n            var b = degs[i] * Math.PI / 180.0;\n            var y2 = cy + r * 1.85 * Math.sin(b);\n            if (y2 < hy - 2) {\n                dc.drawLine((x + r * 1.35 * Math.cos(b)).toNumber(), (y + cy + r * 1.35 * Math.sin(b)).toNumber(), (x + r * 1.85 * Math.cos(b)).toNumber(), (y + y2).toNumber());\n            }\n        }\n' +
        '        dc.drawLine((x - r * 2).toNumber(), (y + hy).toNumber(), (x + r * 2).toNumber(), (y + hy).toNumber());\n        dc.setPenWidth(1);\n    }'
    },
    sunStr: {
      deps: ['locObj'], needs: ['wx'],
      code: 'function sunStr(mode) {\n        var loc = locObj();\n        if (loc == null) { return "--:--"; }\n        var now = Time.now();\n        var m = null;\n' +
        '        if (mode == 1) {\n            m = Weather.getSunrise(loc, now);\n        } else if (mode == 2) {\n            m = Weather.getSunset(loc, now);\n        } else {\n' +
        '            var rise = Weather.getSunrise(loc, now);\n            var sset = Weather.getSunset(loc, now);\n' +
        '            if (rise != null && now.lessThan(rise)) {\n                m = rise;\n            } else if (sset != null && now.lessThan(sset)) {\n                m = sset;\n            } else {\n' +
        '                m = Weather.getSunrise(loc, now.add(new Time.Duration(86400)));\n            }\n        }\n' +
        '        if (m == null) { return "--:--"; }\n        var t = Gregorian.info(m, Time.FORMAT_SHORT);\n        var h = t.hour;\n' +
        '        if (!System.getDeviceSettings().is24Hour) {\n            h = h % 12;\n            if (h == 0) { h = 12; }\n        }\n        return h.format("%02d") + ":" + t.min.format("%02d");\n    }',
      imports: ['Toybox.Weather', 'Toybox.Time', 'Toybox.Time.Gregorian']
    },
    dayPct: { needs: ['clk'], code: 'function dayPct() {\n        return (_clk.hour * 3600 + _clk.min * 60 + _clk.sec) / 864.0;\n    }' },
    dayOfYearNow: {
      imports: ['Toybox.Time', 'Toybox.Time.Gregorian'],
      members: ['    const DOY_CUM = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];'],
      code: 'function dayOfYearNow() {\n        var i = Gregorian.info(Time.now(), Time.FORMAT_SHORT);\n        var d = DOY_CUM[i.month - 1] + i.day;\n' +
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
    utcStr: {
      imports: ['Toybox.Time', 'Toybox.Time.Gregorian'],
      code: 'function utcStr() {\n        var i = Gregorian.utcInfo(Time.now(), Time.FORMAT_SHORT);\n        return i.hour.format("%02d") + ":" + i.min.format("%02d");\n    }'
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
    moonGlyph: { deps: ['moonPhase'], code: 'function moonGlyph() {\n        var d = moonPhase() * 29.53;\n        if (d < 3.0) { return "0"; }\n        if (d < 6.0) { return "1"; }\n        if (d < 10.0) { return "2"; }\n        if (d < 14.0) { return "3"; }\n        if (d < 18.0) { return "4"; }\n        if (d < 22.0) { return "5"; }\n        if (d < 26.0) { return "6"; }\n        if (d < 29.0) { return "7"; }\n        return "0";\n    }' },
    recoveryNow: { needs: ['act'], code: 'function recoveryNow() {\n        if ((_act has :timeToRecovery) && _act.timeToRecovery != null) { return _act.timeToRecovery; }\n        return null;\n    }' },
    battBar: { needs: ['sys'], code: 'function battBar(n) {\n        var k = ((_sys.battery / 100.0) * n + 0.5).toNumber();\n        var s = "";\n        for (var i = 0; i < n; i++) { s += (i < k) ? "|" : "{"; }\n        return s;\n    }' },
    moonName: {
      deps: ['moonPhase'],
      code: 'function moonName() {\n        var p = moonPhase();\n        if (p < 0.03 || p >= 0.97) { return "New moon"; }\n        if (p < 0.22) { return "Waxing crescent"; }\n        if (p < 0.28) { return "First quarter"; }\n        if (p < 0.47) { return "Waxing gibbous"; }\n' +
        '        if (p < 0.53) { return "Full moon"; }\n        if (p < 0.72) { return "Waning gibbous"; }\n        if (p < 0.78) { return "Last quarter"; }\n        return "Waning crescent";\n    }'
    },
    histVals: {
      needs: ['act'], imports: ['Toybox.ActivityMonitor', 'Toybox.Time'],
      members: ['    var _histCache = null;', '    var _histDay = -1;'],
      hide: ['_histCache = null;', '_histDay = -1;'],
      code: 'function histVals(kind) {\n        var vals = new [8];\n        for (var i = 0; i < 8; i++) { vals[i] = 0; }\n' +
        '        vals[7] = histToday(kind);\n' +
        '        var c = System.getClockTime();\n        var t0 = Time.now().value() - (c.hour * 3600 + c.min * 60 + c.sec);\n' +
        '        // the stored days are fetched once per calendar day, and never while the watch sleeps\n' +
        '        if (!_isSleeping && (_histCache == null || _histDay != t0)) {\n            try {\n                _histCache = ActivityMonitor.getHistory();\n                _histDay = t0;\n            } catch (ex) {\n                _histCache = null;\n            }\n        }\n' +
        '        if (_histCache != null) {\n            var h = _histCache as Array;\n            for (var d = 0; d < h.size(); d++) {\n                var s = null;\n                try {\n                    s = h[d].startOfDay;\n                } catch (ex) {\n                    s = null;\n                }\n' +
        '                // each entry goes to its own calendar day (1 = yesterday ... 7), so today being included or a day missing cannot shift the bars\n' +
        '                var back = (s != null) ? ((t0 - s.value() + 43200) / 86400) : (d + 1);\n' +
        '                if (back >= 1 && back <= 7) { vals[7 - back] = histDay(h[d], kind); }\n            }\n        }\n' +
        '        DBG: System.println("hist kind=" + kind + " values=" + vals + " entries=" + ((_histCache != null) ? (_histCache as Array).size() : -1));\n' +
        '        return vals;\n    }\n\n' +
        '    // the watch throws "symbol not found" (instead of returning null) for a reading it does not have, so each one is read on its own\n' +
        '    function histToday(kind) {\n        var v = 0;\n        try {\n            if (kind == 0) { v = _act.steps; }\n            else if (kind == 1) { v = _act.calories; }\n            else if (kind == 2) { v = _act.activeMinutesDay.total; }\n            else if (kind == 4) { v = _act.activeMinutesWeek.total; }\n            else { v = _act.floorsClimbed; }\n        } catch (ex) {\n            DBG: System.println("hist today kind=" + kind + " failed: " + ex.getErrorMessage());\n            v = 0;\n        }\n        return (v == null) ? 0 : v;\n    }\n\n' +
        '    function histDay(e, kind) {\n        var v = 0;\n        try {\n            if (kind == 0) { v = e.steps; }\n            else if (kind == 1) { v = e.calories; }\n            else if (kind == 2 || kind == 4) { v = e.activeMinutes.total; }\n            else { v = e.floorsClimbed; }\n        } catch (ex) {\n            DBG: System.println("hist day kind=" + kind + " failed: " + ex.getErrorMessage());\n            v = 0;\n        }\n        return (v == null) ? 0 : v;\n    }'
    }
  };
  // Battery: slow-changing values are worked out once, not on every redraw. The sun times and the New York time are recalculated
  // when the minute changes, heart rate at most every 5 seconds.
  H.sunStr.code = H.sunStr.code.replace('function sunStr(mode) {', 'function sunCalc(mode) {') +
    '\n\n    function sunStr(mode) {\n        var min = System.getClockTime().min;\n        if (_sunMin != min) {\n            _sunMin = min;\n            _sunS = [sunCalc(0), sunCalc(1), sunCalc(2)];\n        }\n        return _sunS[mode];\n    }';
  H.sunStr.members = ['    var _sunMin = -1;', '    var _sunS = ["--:--", "--:--", "--:--"];'];
  H.nyStr.code = H.nyStr.code.replace('function nyStr(mode) {', 'function nyCalc(mode) {') +
    '\n\n    function nyStr(mode) {\n        var min = System.getClockTime().min;\n        if (_nyMin != min) {\n            _nyMin = min;\n            _nyS = [nyCalc(0), nyCalc(1)];\n        }\n        return _nyS[mode];\n    }';
  H.nyStr.members = ['    var _nyMin = -1;', '    var _nyS = ["--:--", "EST"];'];
  H.hrNow.code = H.hrNow.code.replace('function hrNow() {', 'function hrRead() {') +
    '\n\n    function hrNow() {\n        var t = Time.now().value();\n        if (_hrT == 0 || t - _hrT >= 5 || t < _hrT) {\n            _hrT = t;\n            _hrV = hrRead();\n        }\n        return _hrV;\n    }';
  H.hrNow.members = ['    var _hrT = 0;', '    var _hrV = null;'];
  H.hrNow.imports = H.hrNow.imports.concat(['Toybox.Time']);
  if (GW.DF_SRC) H.dfd = { code: GW.DF_SRC.code, members: GW.DF_SRC.members }; // data-cell maths for the data field builder
  GW.MC_HELPERS = H;

  var NEED_INIT = {
    clk: '_clk = System.getClockTime();',
    act: '_act = ActivityMonitor.getInfo();',
    sys: '_sys = System.getSystemStats();',
    // the phone's weather is read at most every 5 minutes and never while the watch sleeps (it cost memory and crashed the face overnight)
    wx: ['if (!_isSleeping && (Toybox has :Weather) && (_wxT == 0 || Time.now().value() - _wxT >= 300)) {', '    _wxT = Time.now().value();', '    _wx = Weather.getCurrentConditions();', '}'],
    ds: '_ds = Gregorian.info(_now, Time.FORMAT_SHORT);',
    dm: '_dm = Gregorian.info(_now, Time.FORMAT_MEDIUM);',
    dl: '_dl = Gregorian.info(_now, Time.FORMAT_LONG);'
  };
  var NEED_ORDER = ['clk', 'act', 'sys', 'wx', 'ds', 'dm', 'dl'];

  GW.fontResId = function (f) { return f.id; };

  // ---------- main generator ----------
  GW.generateSource = function (design) {
    var st = { needs: {}, helpers: [], hseen: {}, imports: {}, perms: {}, fonts: [], fseen: {}, fchars: {}, images: [], iseen: {}, files: {}, minApi: '3.2.0', hooks: { begin: [], init: [], compute: [], lap: [], reset: [] }, extraMembers: [] };
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
        (h.perms || []).forEach(cg.perm);
        st.helpers.push(n);
      },
      // the characters the elements using a bitmap font can show (null = unknown: export the whole set)
      fontChars: function (id, chars) {
        if (GW.isSysFont(id)) return;
        var cur = st.fchars[id];
        if (cur === null) return;
        if (chars == null) { st.fchars[id] = null; return; }
        st.fchars[id] = (cur || '') + chars;
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
        var f = GW.customFont(id), rid = id + '_r' + (deg < 0 ? 'n' + Math.round(-deg) : Math.round(deg)), info = GW.rotFontInfo(f, deg), met = GW.fontMetrics(f);
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
      // one element failing (a missing reading, an API the watch lacks) must not take the whole face down with the "IQ!" screen
      calls.push('        try {\n            ' + n + '(dc);\n        } catch (ex) {\n        }');
    });
    if (st.needs.wx) cg.imp('Toybox.Time');
    var bg = null;
    if (design.bgImage && GW.assets[design.bgImage]) bg = { id: 'bgImage', asset: design.bgImage, w: GW.DEVICE.size, h: GW.DEVICE.size, full: true };

    // helper bodies may need further flags: already handled via cg.helper
    var name = GW.slug(design.name);
    var perms = Object.keys(st.perms);
    var isField = design.kind === 'datafield';
    var imports = ['Toybox.Application', 'Toybox.Graphics', 'Toybox.Lang', 'Toybox.System', 'Toybox.WatchUi'];
    if (isField) imports.push('Toybox.Activity');
    Object.keys(st.imports).sort().forEach(function (i) { if (imports.indexOf(i) < 0) imports.push(i); });

    // lines starting with "DBG: " in a helper are only emitted in a debug export (design.debug)
    function helperCode(n) {
      return H[n].code.split('\n').filter(function (l) { return design.debug || !/^\s*DBG: /.test(l); }).map(function (l) { return l.replace(/^(\s*)DBG: /, '$1'); }).join('\n');
    }
    var needFlags = NEED_ORDER.filter(function (f) { return st.needs[f]; });
    var members = [];
    if (st.needs.clk) members.push('    var _clk;');
    if (st.needs.act) members.push('    var _act;');
    if (st.needs.sys) members.push('    var _sys;');
    if (st.needs.wx) { members.push('    var _wx;'); members.push('    var _wxT = 0;'); }
    ['ds', 'dm', 'dl'].forEach(function (f) { if (st.needs[f]) members.push('    var _' + f + ';'); });
    members.push('    var _isSleeping = false;');
    st.extraMembers.forEach(function (m) { members.push(m); });
    st.helpers.forEach(function (n) { (H[n].members || []).forEach(function (m) { members.push(m); }); });
    if (st.hseen.locObj) members.push('    const DEF_LOC_ON = ' + (design.defLocOn === false ? 'false' : 'true') + ';', '    const DEF_LAT = ' + (typeof design.defLat === 'number' ? design.defLat : 41.01) + ';', '    const DEF_LON = ' + (typeof design.defLon === 'number' ? design.defLon : 28.98) + ';');
    st.fonts.forEach(function (f) { members.push('    var _' + f.id + ';'); });
    st.images.forEach(function (m) { members.push('    var _' + m.id + ';'); });
    if (bg) members.push('    var _bg;');

    var layout = [], release = [];
    st.fonts.forEach(function (f) { layout.push('        _' + f.id + ' = WatchUi.loadResource(Rez.Fonts.' + f.id + ');'); release.push('        _' + f.id + ' = null;'); });
    st.images.forEach(function (m) { layout.push('        _' + m.id + ' = WatchUi.loadResource(Rez.Drawables.' + m.id + ');'); release.push('        _' + m.id + ' = null;'); });
    if (bg) { layout.push('        _bg = WatchUi.loadResource(Rez.Drawables.bgImage);'); release.push('        _bg = null;'); }
    st.helpers.forEach(function (n) { (H[n].hide || []).forEach(function (l) { release.push('        ' + l); }); });

    var init = [];
    var dateNeeded = st.needs.ds || st.needs.dm || st.needs.dl;
    if (dateNeeded) init.push('        var _now = Time.now();');
    needFlags.forEach(function (f) { [].concat(NEED_INIT[f]).forEach(function (l) { init.push('        ' + l); }); });
    // A face that shows no seconds only needs fresh activity / weather / date values when the minute changes.
    var live = els.some(function (e) {
      return (e.type === 'hands' && e.sShow) || (e.type === 'arc' && e.source === 'second') ||
        (e.type === 'text' && (e.source === 'second' || (e.source === 'time' && e.secs)));
    });
    if (!isField && !live && init.length) {
      init = ['        var _c = System.getClockTime();', '        if (_c.min != _cmin) {', '            _cmin = _c.min;'].concat(init.map(function (l) { return '    ' + l; })).concat(['        }']);
      members.push('    var _cmin = -1;');
    }
    if (init.length) init = ['        try {'].concat(init.map(function (l) { return '    ' + l; })).concat(['        } catch (ex) {', '        }']);   // a failing data read leaves the old values instead of crashing

    var view =
      '// ' + design.name + ' - generated by Garmin Studio (' + GW.DEVICE.name + ', ' + GW.DEVICE.size + 'x' + GW.DEVICE.size + ')\n' +
      imports.map(function (i) { return 'import ' + i + ';'; }).join('\n') + '\n\n' +
      'class ' + name + 'View extends WatchUi.' + (isField ? 'DataField' : 'WatchFace') + ' {\n\n' +
      members.join('\n') + '\n\n' +
      '    function initialize() {\n        ' + (isField ? 'DataField' : 'WatchFace') + '.initialize();\n' + st.hooks.init.map(function (l) { return '        ' + l + '\n'; }).join('') + '    }\n\n' +
      (isField
        ? '    function onLayout(dc as Dc) as Void {\n' + (layout.length ? layout.join('\n') + '\n' : '') + '    }\n\n'
        // a watch face loads its fonts and pictures when it is shown and lets them go when it is hidden, never inside onUpdate
        : '    function onLayout(dc as Dc) as Void {\n    }\n\n' +
          (layout.length ? '    function onShow() as Void {\n' + layout.join('\n') + '\n    }\n\n' : '') +
          (release.length ? '    function onHide() as Void {\n' + release.join('\n') + '\n    }\n\n' : '')) +
      '    function onUpdate(dc as Dc) as Void {\n' +
      (st.hooks.begin.length ? st.hooks.begin.map(function (l) { return '        ' + l + '\n'; }).join('')
        : '        dc.setColor(Graphics.COLOR_WHITE, ' + GW.mcColor(design.bg) + ');\n        dc.clear();\n') +
      (bg ? '        if (_bg != null) {\n            dc.drawBitmap(0, 0, _bg);\n        }\n' : '') +
      (init.length ? init.join('\n') + '\n' : '') +
      calls.join('\n') + '\n' +
      (design.buildTag && !isField ? '        dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);\n        dc.drawText(' + Math.round(GW.SIZE / 2) + ', ' + (GW.SIZE - 22) + ', Graphics.FONT_XTINY, "' + (window.GW_BUILT || 'dev').replace(/[-:TZ]/g, '').slice(2, 12) + '", Graphics.TEXT_JUSTIFY_CENTER);\n' : '') +
      '    }\n\n' +
      (isField
        ? '    // called every second with the activity data\n    function compute(info as Activity.Info) as Void {\n' + st.hooks.compute.map(function (l) { return '        ' + l + '\n'; }).join('') + '    }\n\n' +
          '    function onTimerLap() as Void {\n' + st.hooks.lap.map(function (l) { return '        ' + l + '\n'; }).join('') + '    }\n\n' +
          '    function onTimerReset() as Void {\n' + st.hooks.reset.map(function (l) { return '        ' + l + '\n'; }).join('') + '    }\n'
        : '    function onEnterSleep() as Void {\n        _isSleeping = true;\n        WatchUi.requestUpdate();\n    }\n\n' +
          '    function onExitSleep() as Void {\n        _isSleeping = false;\n        WatchUi.requestUpdate();\n    }\n') +
      (methods.length ? '\n    // ---- elements ----\n\n' + methods.join('\n\n') + '\n' : '') +
      (st.helpers.length ? '\n    // ---- data helpers ----\n\n' + st.helpers.map(function (n) { return '    ' + helperCode(n); }).join('\n\n') + '\n' : '') +
      '}\n';

    var app =
      'import Toybox.Application;\nimport Toybox.Lang;\nimport Toybox.System;\nimport Toybox.WatchUi;\n\n' +
      'class ' + name + 'App extends Application.AppBase {\n\n' +
      '    function initialize() {\n        AppBase.initialize();\n    }\n\n' +
      '    function onStart(state as Dictionary?) as Void {\n        // the editable design travels inside the app (a text resource) so Garmin Studio can open this file again; this keeps it from being dropped\n' +
      '        if (System.getClockTime().sec == 99) {\n            System.println(WatchUi.loadResource(Rez.Strings.GwDesign));\n        }\n    }\n\n' +
      '    function getInitialView() as [Views] or [Views, InputDelegates] {\n        return [ new ' + name + 'View() ];\n    }\n}\n';

    // ---------- warnings ----------
    var imgPx = 0;
    st.images.forEach(function (m) { imgPx += m.w * m.h; });
    if (bg) { imgPx += GW.DEVICE.size * GW.DEVICE.size; warnings.push('Full-screen background image: uses a lot of watch memory (~' + Math.round(GW.DEVICE.size * GW.DEVICE.size / 1024) + ' KB). If the watchface fails to load, remove it or use shapes instead.'); }
    if (imgPx > 30000 && !bg) warnings.push('Images total ' + Math.round(imgPx / 1000) + 'k pixels: large for a watchface. Keep it small if the face fails to load.');
    if (st.fonts.length > 3) warnings.push(st.fonts.length + ' custom bitmap fonts: each one is held in watch memory. Consider fewer sizes/glyph sets.');
    if (els.some(function (e) { return e.type === 'hands' && e.sShow; })) warnings.push('Second hand only moves while the wrist is raised (high-power mode); it is hidden in low-power mode.');
    if (els.some(function (e) { return (e.type === 'text' && (e.source === 'second' || (e.source === 'time' && e.secs))); })) warnings.push('Seconds text freezes in low-power mode (the watch redraws once a minute).');
    if (els.some(function (e) { return e.type === 'text' && ['weatherDesc', 'temp'].indexOf(e.source) >= 0; })) warnings.push('Weather text and temperature only show data once the watch has synced weather from your phone (they read "--" until then). Sunrise and sunset fall back to Istanbul.');
    if (els.some(function (e) { var c = e.type === 'text' ? GW.textChars(e) : null; return c && GW.bmpOnly(c).refused > 0; })) warnings.push('A text uses a character above U+FFFF (an emoji, for example). Those are not supported and are left out of the exported font.');
    if (!els.length) warnings.push('The design is empty.');

    return { name: name, type: isField ? 'datafield' : 'watchface', app: app, view: view, perms: perms, fonts: st.fonts, images: st.images, bg: bg, warnings: warnings, files: st.files, minApi: st.minApi, fontChars: st.fchars };
  };
})(window.GW);
