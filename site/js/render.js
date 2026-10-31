/* Rendering: design -> canvas (preview, thumbnails, launcher icon). Always draws in 280x280 design space. */
(function (GW) {
  'use strict';

  GW.renderDesign = function (ctx, design, env) {
    var S = GW.SIZE;
    (design.fonts || []).forEach(function (f) { GW.previewFonts[f.id] = f; }); // lets thumbnails of other designs resolve their fonts
    ctx.save();
    if (design.kind === 'datafield' && (GW.DF_LAYOUTS[design.dfLayout] || GW.DF_LAYOUTS[0]).slots.length > 1) {
      // a screen layout with several fields: each slot shows its own cells; empty slots stay dim
      var L = GW.DF_LAYOUTS[design.dfLayout] || GW.DF_LAYOUTS[0];
      ctx.fillStyle = GW.q(GW.dfTheme(design).bg); ctx.fillRect(0, 0, S, S);   // the gaps between fields show the screen's own color, as on the watch
      L.slots.forEach(function (r, i) {
        var els = design.elements.filter(function (e) { return !e.hidden && GW.elSlot(e, design) === i; });
        if (!els.length) { if (design.dfFree) return; ctx.fillStyle = '#d8d8d8'; ctx.fillRect(r[0], r[1], r[2], r[3]); return; }   // fields with nothing in them stay dim
        ctx.save(); ctx.translate(r[0], r[1]);
        if (!design.dfFree) { ctx.beginPath(); ctx.rect(0, 0, r[2], r[3]); ctx.clip(); }   // separate fields are cut off at their own edges on the watch
        ctx.fillStyle = GW.q(GW.dfTheme(design).bg); ctx.fillRect(0, 0, r[2], r[3]);
        els.forEach(function (el) {
          var t = GW.types[el.type]; if (!t) return;
          ctx.save();
          try { t.draw(ctx, el, env); } catch (e) { if (window.console) console.error('draw failed', el.type, e); }
          ctx.restore();
        });
        ctx.restore();
      });
      ctx.restore();
      return;
    }
    var slot = design.kind === 'datafield' ? GW.dfSlot(design) : null, inSlot = slot && !slot.full;
    if (inSlot) {   // a field that does not fill the screen: show the other slots of the layout dimly, and draw inside its own slot
      ctx.fillStyle = '#d8d8d8'; ctx.fillRect(0, 0, S, S);
      ctx.save(); ctx.translate(slot.x, slot.y); ctx.beginPath(); ctx.rect(0, 0, slot.w, slot.h); ctx.clip();
    }
    ctx.fillStyle = GW.q(design.kind === 'datafield' ? GW.dfTheme(design).bg : design.bg); ctx.fillRect(0, 0, inSlot ? slot.w : S, inSlot ? slot.h : S);
    if (design.bgImage && GW.assets[design.bgImage]) ctx.drawImage(GW.assets[design.bgImage].img, 0, 0, S, S);
    design.elements.forEach(function (el) {
      if (el.hidden) return;
      var t = GW.types[el.type]; if (!t) return;
      ctx.save();
      try { t.draw(ctx, el, env); } catch (e) { if (window.console) console.error('draw failed', el.type, e); }
      ctx.restore();
    });
    if (inSlot) {
      ctx.restore();
    }
    ctx.restore();
  };

  // Round thumbnail on a fresh canvas. `env` defaults to a calm fixed 10:09:36 so presets look their best.
  GW.thumb = function (design, px, env) {
    var c = document.createElement('canvas'), d = window.devicePixelRatio || 1;
    c.width = c.height = Math.round(px * d);
    var ctx = c.getContext('2d');
    ctx.scale(c.width / GW.SIZE, c.width / GW.SIZE);
    ctx.beginPath(); ctx.arc(GW.SIZE / 2, GW.SIZE / 2, GW.SIZE / 2, 0, Math.PI * 2); ctx.clip();
    GW.renderDesign(ctx, design, env || GW.fixedEnv());
    c.style.width = c.style.height = px + 'px';
    return c;
  };

  GW.fixedEnv = function () {
    var e = GW.env(), s = Object.assign({}, GW.sim, { live: false });
    e.sim = s; e.h = 10; e.m = 9; e.sec = 36;
    return e;
  };
})(window.GW);
