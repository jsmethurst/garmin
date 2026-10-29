/* Data sources: each knows how to PREVIEW itself in the browser and how to READ the real value on the watch (Monkey C). */
(function (GW) {
  'use strict';
  var pad2 = GW.pad2;
  var DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // ---------- environment (what the preview "sees") ----------
  GW.env = function () {
    var s = GW.sim, now = new Date(), h, m, sec;
    if (s.live) { h = now.getHours(); m = now.getMinutes(); sec = now.getSeconds(); }
    else { h = Math.floor(s.minutes / 60); m = s.minutes % 60; sec = s.seconds; }
    return { sim: s, h: h, m: m, sec: sec, y: now.getFullYear(), mo: now.getMonth() + 1, day: now.getDate(), dow: now.getDay(), now: now };
  };

  function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
  function dayOfYear(y, mo, d) {
    var c = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    return c[mo - 1] + d + (mo > 2 && isLeap(y) ? 1 : 0);
  }
  GW.moonPhase = function (date) {
    var days = (date.getTime() / 1000 - 947182440) / 86400;
    var p = days / 29.530588853;
    return p - Math.floor(p);
  };
  function moonName(p) {
    if (p < 0.03 || p >= 0.97) return 'New moon';
    if (p < 0.22) return 'Waxing crescent';
    if (p < 0.28) return 'First quarter';
    if (p < 0.47) return 'Waxing gibbous';
    if (p < 0.53) return 'Full moon';
    if (p < 0.72) return 'Waning gibbous';
    if (p < 0.78) return 'Last quarter';
    return 'Waning crescent';
  }

  // ---------- time-of-day formatting ----------
  function hourStr(env, mode, lz) {
    var h = env.h;
    var use24 = mode === 'h24' ? true : (mode === 'h12' ? false : env.sim.is24);
    if (!use24) { h = h % 12; if (h === 0) h = 12; }
    return lz === false ? String(h) : pad2(h);
  }
  function minToStr(env, mins) {
    var h = Math.floor(mins / 60), m = mins % 60;
    if (!env.sim.is24) { h = h % 12; if (h === 0) h = 12; return h + ':' + pad2(m); }
    return pad2(h) + ':' + pad2(m);
  }

  // ---------- date tokens ----------
  GW.DATE_TOKEN_RE = /DDDD|ddd|DD|D|MMMM|MMM|MM|M|YYYY|YY/g;
  GW.dateParts = function (fmt) {
    var out = [], last = 0, m, re = new RegExp(GW.DATE_TOKEN_RE.source, 'g');
    while ((m = re.exec(fmt))) {
      if (m.index > last) out.push({ lit: fmt.slice(last, m.index) });
      out.push({ tok: m[0] });
      last = m.index + m[0].length;
    }
    if (last < fmt.length) out.push({ lit: fmt.slice(last) });
    return out;
  };
  function dateStr(env, fmt) {
    return GW.dateParts(fmt).map(function (p) {
      if (p.lit != null) return p.lit;
      switch (p.tok) {
        case 'DDDD': return DOW[env.dow];
        case 'ddd': return DOW[env.dow].slice(0, 3);
        case 'DD': return pad2(env.day);
        case 'D': return String(env.day);
        case 'MMMM': return MON[env.mo - 1];
        case 'MMM': return MON[env.mo - 1].slice(0, 3);
        case 'MM': return pad2(env.mo);
        case 'M': return String(env.mo);
        case 'YYYY': return String(env.y);
        case 'YY': return pad2(env.y % 100);
      }
    }).join('');
  }
  GW.DATE_PRESETS = [
    ['ddd DD MMM', 'Sat 06 Dec'], ['DDDD', 'Saturday'], ['ddd', 'Sat'], ['DD', '06'], ['MMM DD', 'Dec 06'],
    ['DD/MM', '06/12'], ['MM/DD', '12/06'], ['DD.MM.YYYY', '06.12.2025'], ['MMMM D', 'December 6']
  ];
  function mcLit(s) { return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'; }
  GW.mcLit = mcLit;

  // ---------- registry ----------
  var S = GW.sources = {};
  GW.sourceList = []; // ordered for menus
  function def(id, o) { o.id = id; S[id] = o; GW.sourceList.push(o); return o; }

  // --- Time ---
  def('time', {
    label: 'Time (HH:MM)', group: 'Time', kind: 'str', opts: ['hmode', 'lz', 'secs', 'sep'],
    str: function (el, env) {
      var sep = el.sep == null ? ':' : el.sep;
      return hourStr(env, el.hmode, el.lz) + sep + pad2(env.m) + (el.secs ? sep + pad2(env.sec) : '');
    },
    mcStr: function (el, cg) {
      cg.need('clk'); cg.helper('hourStr');
      var sep = mcLit(el.sep == null ? ':' : el.sep);
      return 'hourStr(' + ({ h24: 1, h12: 2 }[el.hmode] || 0) + ', ' + (el.lz === false ? 'false' : 'true') + ') + ' + sep +
        ' + _clk.min.format("%02d")' + (el.secs ? ' + ' + sep + ' + _clk.sec.format("%02d")' : '');
    }
  });
  def('hour', {
    label: 'Hour', group: 'Time', kind: 'str', opts: ['hmode', 'lz'],
    str: function (el, env) { return hourStr(env, el.hmode, el.lz); },
    mcStr: function (el, cg) { cg.need('clk'); cg.helper('hourStr'); return 'hourStr(' + ({ h24: 1, h12: 2 }[el.hmode] || 0) + ', ' + (el.lz === false ? 'false' : 'true') + ')'; }
  });
  def('minute', {
    label: 'Minute', group: 'Time', kind: 'num', range: [0, 60], opts: [],
    num: function (env) { return env.m + env.sec / 60; },
    str: function (el, env) { return pad2(env.m); },
    mcNum: function (el, cg) { cg.need('clk'); return '(_clk.min.toFloat() + _clk.sec.toFloat() / 60.0)'; },
    mcStr: function (el, cg) { cg.need('clk'); return '_clk.min.format("%02d")'; }
  });
  def('second', {
    label: 'Second', group: 'Time', kind: 'num', range: [0, 60], opts: [], live: true,
    num: function (env) { return env.sec; },
    str: function (el, env) { return pad2(env.sec); },
    mcNum: function (el, cg) { cg.need('clk'); return '_clk.sec'; },
    mcStr: function (el, cg) { cg.need('clk'); return '_clk.sec.format("%02d")'; }
  });
  def('ampm', {
    label: 'AM / PM', group: 'Time', kind: 'str', opts: [],
    str: function (el, env) { return env.h < 12 ? 'AM' : 'PM'; },
    mcStr: function (el, cg) { cg.need('clk'); return '((_clk.hour < 12) ? "AM" : "PM")'; }
  });
  def('date', {
    label: 'Date', group: 'Time', kind: 'str', opts: ['datefmt'],
    str: function (el, env) { return dateStr(env, el.fmt || 'ddd DD MMM'); },
    mcStr: function (el, cg) {
      var parts = GW.dateParts(el.fmt || 'ddd DD MMM'), out = [];
      parts.forEach(function (p) {
        if (p.lit != null) { out.push(mcLit(p.lit)); return; }
        switch (p.tok) {
          case 'DDDD': cg.need('dl'); out.push('_dl.day_of_week'); break;
          case 'ddd': cg.need('dm'); out.push('_dm.day_of_week'); break;
          case 'DD': cg.need('ds'); out.push('_ds.day.format("%02d")'); break;
          case 'D': cg.need('ds'); out.push('_ds.day.toString()'); break;
          case 'MMMM': cg.need('dl'); out.push('_dl.month'); break;
          case 'MMM': cg.need('dm'); out.push('_dm.month'); break;
          case 'MM': cg.need('ds'); out.push('_ds.month.format("%02d")'); break;
          case 'M': cg.need('ds'); out.push('_ds.month.toString()'); break;
          case 'YYYY': cg.need('ds'); out.push('_ds.year.toString()'); break;
          case 'YY': cg.need('ds'); out.push('(_ds.year % 100).format("%02d")'); break;
        }
      });
      return out.length ? out.join(' + ') : '""';
    }
  });

  // --- numeric helper ---
  // fn = Monkey C helper name returning Number|null; goalFn = helper returning the goal
  function numeric(id, label, group, o) {
    o.label = label; o.group = group; o.kind = 'num';
    o.opts = o.opts || [];
    o.str = o.str || function (el, env) { var v = o.num(env); return v == null ? '--' : String(Math.round(v)); };
    o.mcNum = o.mcNum || function (el, cg) { cg.helper(o.fn); (o.needs || []).forEach(cg.need); return o.fn + '()'; };
    o.mcStr = o.mcStr || function (el, cg) { cg.helper('ns'); return 'ns(' + o.mcNum(el, cg) + ')'; };
    if (o.goalFn) o.mcGoal = function (el, cg) { cg.helper(o.goalFn); (o.needs || []).forEach(cg.need); return o.goalFn + '()'; };
    return def(id, o);
  }

  // --- Activity ---
  numeric('steps', 'Steps', 'Activity', { fn: 'stepsNow', goalFn: 'stepGoalNow', needs: ['act'], range: [0, 10000],
    num: function (e) { return e.sim.steps; }, goal: function (e) { return e.sim.stepGoal; } });
  def('stepGoal', {
    label: 'Steps goal', group: 'Activity', kind: 'str', opts: [],
    str: function (el, env) { return String(env.sim.stepGoal); },
    mcStr: function (el, cg) { cg.helper('stepGoalNow'); cg.need('act'); return 'stepGoalNow().toString()'; }
  });
  numeric('calories', 'Calories', 'Activity', { fn: 'calNow', needs: ['act'], range: [0, 2500],
    num: function (e) { return e.sim.calories; } });
  numeric('floors', 'Floors climbed', 'Activity', { fn: 'floorsNow', goalFn: 'floorGoalNow', needs: ['act'], range: [0, 10],
    num: function (e) { return e.sim.floors; }, goal: function (e) { return e.sim.floorGoal; } });
  numeric('intMins', 'Intensity minutes (week)', 'Activity', { fn: 'intNow', goalFn: 'intGoalNow', needs: ['act'], range: [0, 150],
    num: function (e) { return e.sim.intMins; }, goal: function (e) { return e.sim.intGoal; } });
  numeric('distance', 'Distance today', 'Activity', {
    fn: 'distNow', needs: ['act'], range: [0, 10], opts: ['unit_dist'],
    num: function (e) { return e.sim.metric ? e.sim.distance : e.sim.distance * 0.621371; },
    str: function (el, env) {
      var m = el.unit === 'mi' ? false : (el.unit === 'km' ? true : env.sim.metric);
      return (m ? env.sim.distance : env.sim.distance * 0.621371).toFixed(1);
    },
    mcNum: function (el, cg) { cg.need('act'); cg.helper('distNow'); return 'distNow(' + ({ km: 1, mi: 2 }[el.unit] || 0) + ')'; },
    mcStr: function (el, cg) { cg.need('act'); cg.helper('distNow'); return 'distNow(' + ({ km: 1, mi: 2 }[el.unit] || 0) + ').format("%.1f")'; }
  });
  numeric('moveBar', 'Move bar level (0-5)', 'Activity', { fn: 'moveNow', needs: ['act'], range: [0, 5],
    num: function (e) { return e.sim.moveBar; } });

  // --- Body ---
  numeric('hr', 'Heart rate', 'Body', { fn: 'hrNow', range: [50, 180], perms: ['SensorHistory'], imports: ['Toybox.SensorHistory', 'Toybox.Activity'],
    num: function (e) { return e.sim.hr; } });
  numeric('bodyBat', 'Body Battery', 'Body', { fn: 'bodyBatNow', range: [0, 100], perms: ['SensorHistory'], imports: ['Toybox.SensorHistory'],
    num: function (e) { return e.sim.bodyBat; } });
  numeric('stress', 'Stress', 'Body', { fn: 'stressNow', range: [0, 100], perms: ['SensorHistory'], imports: ['Toybox.SensorHistory'],
    num: function (e) { return e.sim.stress; } });
  numeric('spo2', 'Pulse Ox (SpO2 %)', 'Body', { fn: 'spo2Now', range: [85, 100], perms: ['SensorHistory'], imports: ['Toybox.SensorHistory'],
    num: function (e) { return e.sim.spo2; } });
  numeric('resp', 'Respiration', 'Body', { fn: 'respNow', range: [6, 30], perms: ['SensorHistory'], imports: ['Toybox.SensorHistory'],
    num: function (e) { return e.sim.resp; } });

  // --- Device ---
  numeric('battery', 'Battery %', 'Device', { fn: 'batteryNow', needs: ['sys'], range: [0, 100],
    num: function (e) { return e.sim.battery; } });
  numeric('batteryDays', 'Battery (days left)', 'Device', {
    fn: 'batteryDaysNow', needs: ['sys'], range: [0, 14],
    num: function (e) { return e.sim.batteryDays; },
    str: function (el, env) { return env.sim.batteryDays.toFixed(1); },
    mcStr: function (el, cg) { cg.need('sys'); cg.helper('batteryDaysNow'); return 'batteryDaysNow().format("%.1f")'; }
  });
  numeric('notif', 'Notifications', 'Device', { fn: 'notifNow', range: [0, 10],
    num: function (e) { return e.sim.notif; } });

  // --- Environment ---
  numeric('temp', 'Temperature', 'Environment', {
    fn: 'tempNow', needs: ['wx'], range: [-10, 40], opts: ['unit_temp'], imports: ['Toybox.Weather'],
    num: function (e) { return e.sim.metric ? e.sim.temp : e.sim.temp * 9 / 5 + 32; },
    str: function (el, env) {
      var c = el.unit === 'F' ? false : (el.unit === 'C' ? true : env.sim.metric);
      return String(Math.round(c ? env.sim.temp : env.sim.temp * 9 / 5 + 32));
    },
    mcNum: function (el, cg) { cg.need('wx'); cg.helper('tempNow'); return 'tempNow(' + ({ C: 1, F: 2 }[el.unit] || 0) + ')'; },
    mcStr: function (el, cg) { cg.helper('ns'); cg.need('wx'); cg.helper('tempNow'); return 'ns(tempNow(' + ({ C: 1, F: 2 }[el.unit] || 0) + '))'; }
  });
  GW.WX_NAMES = ['Clear', 'Part cloudy', 'Cloudy', 'Rain', 'Snow', 'Storm', 'Fog', 'Sleet', '--'];
  def('weatherDesc', {
    label: 'Weather conditions', group: 'Environment', kind: 'str', opts: [], imports: ['Toybox.Weather'],
    str: function (el, env) { return GW.WX_NAMES[env.sim.wx]; },
    mcStr: function (el, cg) { cg.need('wx'); cg.helper('wxName'); return 'wxName()'; }
  });
  numeric('altitude', 'Altitude', 'Environment', {
    fn: 'altNow', range: [0, 3000], opts: ['unit_alt'], imports: ['Toybox.Activity'],
    num: function (e) { return e.sim.metric ? e.sim.altitude : e.sim.altitude * 3.28084; },
    str: function (el, env) {
      var m = el.unit === 'ft' ? false : (el.unit === 'm' ? true : env.sim.metric);
      return String(Math.round(m ? env.sim.altitude : env.sim.altitude * 3.28084));
    },
    mcNum: function (el, cg) { cg.helper('altNow'); return 'altNow(' + ({ m: 1, ft: 2 }[el.unit] || 0) + ')'; },
    mcStr: function (el, cg) { cg.helper('ns'); cg.helper('altNow'); return 'ns(altNow(' + ({ m: 1, ft: 2 }[el.unit] || 0) + '))'; }
  });
  def('sunrise', {
    label: 'Sunrise', group: 'Environment', kind: 'str', opts: [], imports: ['Toybox.Weather', 'Toybox.Time', 'Toybox.Time.Gregorian'],
    str: function (el, env) { return minToStr(env, env.sim.sunrise); },
    mcStr: function (el, cg) { cg.need('wx'); cg.helper('sunStr'); return 'sunStr(1)'; }
  });
  def('sunset', {
    label: 'Sunset', group: 'Environment', kind: 'str', opts: [], imports: ['Toybox.Weather', 'Toybox.Time', 'Toybox.Time.Gregorian'],
    str: function (el, env) { return minToStr(env, env.sim.sunset); },
    mcStr: function (el, cg) { cg.need('wx'); cg.helper('sunStr'); return 'sunStr(2)'; }
  });
  def('sunNext', {
    label: 'Next sunrise / sunset', group: 'Environment', kind: 'str', opts: [], imports: ['Toybox.Weather', 'Toybox.Time', 'Toybox.Time.Gregorian'],
    str: function (el, env) {
      var now = env.h * 60 + env.m;
      return minToStr(env, now < env.sim.sunrise ? env.sim.sunrise : (now < env.sim.sunset ? env.sim.sunset : env.sim.sunrise));
    },
    mcStr: function (el, cg) { cg.need('wx'); cg.helper('sunStr'); return 'sunStr(0)'; }
  });

  // --- Special (not in Garmin's own faces) ---
  numeric('dayPct', 'Day elapsed %', 'Special', {
    fn: 'dayPct', needs: ['clk'], range: [0, 100],
    num: function (e) { return (e.h * 3600 + e.m * 60 + e.sec) / 864; }
  });
  numeric('yearPct', 'Year elapsed %', 'Special', {
    fn: 'yearPct', needs: ['clk'], range: [0, 100], imports: ['Toybox.Time', 'Toybox.Time.Gregorian'],
    num: function (e) {
      var days = isLeap(e.y) ? 366 : 365;
      return (dayOfYear(e.y, e.mo, e.day) - 1 + (e.h * 3600 + e.m * 60 + e.sec) / 86400) / days * 100;
    }
  });
  numeric('dayOfYear', 'Day of year', 'Special', {
    fn: 'dayOfYearNow', range: [1, 366], imports: ['Toybox.Time', 'Toybox.Time.Gregorian'],
    num: function (e) { return dayOfYear(e.y, e.mo, e.day); }
  });
  numeric('moonIllum', 'Moon illumination %', 'Special', {
    fn: 'moonIllum', range: [0, 100], imports: ['Toybox.Time', 'Toybox.Math'],
    num: function (e) { return Math.round((1 - Math.cos(2 * Math.PI * GW.moonPhase(e.now))) * 50); }
  });
  def('moonName', {
    label: 'Moon phase name', group: 'Special', kind: 'str', opts: [], imports: ['Toybox.Time'],
    str: function (el, env) { return moonName(GW.moonPhase(env.now)); },
    mcStr: function (el, cg) { cg.helper('moonName'); return 'moonName()'; }
  });
  def('custom', {
    label: 'Custom text', group: 'Special', kind: 'str', opts: ['text'],
    str: function (el) { return el.text == null ? '' : el.text; },
    mcStr: function (el) { return mcLit(el.text == null ? '' : el.text); }
  });

  // Per-source imports/permissions are merged by codegen via these lists
  GW.sourceGroups = ['Time', 'Activity', 'Body', 'Device', 'Environment', 'Special'];

  // numeric value for preview (null when source has no number)
  GW.srcNum = function (id, env) { var s = S[id]; return s && s.num ? s.num(env) : null; };
  // default arc range (min,max) honouring "goal" sources
  GW.srcRange = function (id, env) {
    var s = S[id]; if (!s) return [0, 100];
    if (s.goal) return [0, s.goal(env)];
    return s.range || [0, 100];
  };
  GW.srcStr = function (el, env) {
    var s = S[el.source]; if (!s) return '?';
    return s.str(el, env);
  };
})(window.GW);
