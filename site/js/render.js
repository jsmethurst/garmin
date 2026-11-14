/* Rendering: design -> canvas (preview, thumbnails, launcher icon). Always draws in 280x280 design space. */
(function (GW) {
  'use strict';

  GW.renderDesign = function (ctx, design, env, withRef) {
    var S = GW.SIZE;
    (design.fonts || []).forEach(function (f) { GW.previewFonts[f.id] = f; }); // lets thumbnails of other designs resolve their fonts
    ctx.save();
    if (design.kind === 'datafield' && (GW.DF_LAYOUTS[design.dfLayout] || GW.DF_LAYOUTS[0]).slots.length > 1) {
      // a screen layout with several fields: each slot shows its own cells; empty slots stay dim
      var L = GW.DF_LAYOUTS[design.dfLayout] || GW.DF_LAYOUTS[0];
      ctx.fillStyle = GW.q(GW.dfTheme(design).bg); ctx.fillRect(0, 0, S, S);   // the gaps between fields show the screen's own color, as on the watch
      L.slots.forEach(function (r, i) {
        var els = design.elements.filter(function (e) { return !e.hidden && GW.elSlot(e, design) === i; });
        if (!els.length) { if (GW.dfFree(design)) return; ctx.fillStyle = '#d8d8d8'; ctx.fillRect(r[0], r[1], r[2], r[3]); return; }   // fields with nothing in them stay dim
        ctx.save(); ctx.translate(r[0], r[1]);
        if (!GW.dfFree(design)) { ctx.beginPath(); ctx.rect(0, 0, r[2], r[3]); ctx.clip(); }   // separate fields are cut off at their own edges on the watch
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
    if (withRef && !inSlot && GW.refDraw) GW.refDraw(ctx);   // the reference picture sits under every element
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

  // ---------- the preview as the watch really shows it ----------
  // The watch draws on a grid of whole pixels, with no smoothing, in 64 colours (0, 85, 170 or 255 for red, green and blue). So: draw at 1:1,
  // make every shape edge hard (a pixel is either on or off), let letters keep only a few steps of edge blending (the screen can show 4),
  // snap every colour to the 64 the screen has, cut the circle with hard edges, and let the caller enlarge it with no smoothing.
  var scratch = null, scratchCtx = null;
  var SOFT = { text: 1, icon: 1, image: 1, worldmap: 1, dfcell: 1 };   // keep the edge steps (letters, pictures); everything else gets hard edges
  GW.renderExact = function (ctx, design, env, withRef) {
    var S = GW.SIZE;
    if (design.kind === 'datafield') { GW.renderDesign(ctx, design, env, withRef); return; }   // data fields are drawn in boxes: no difference worth the cost
    (design.fonts || []).forEach(function (f) { GW.previewFonts[f.id] = f; });
    if (!scratch || scratch.width !== S) { scratch = document.createElement('canvas'); scratch.width = scratch.height = S; scratchCtx = scratch.getContext('2d', { willReadFrequently: true }); }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = GW.q(design.bg); ctx.fillRect(0, 0, S, S);
    if (design.bgImage && GW.assets[design.bgImage]) ctx.drawImage(GW.assets[design.bgImage].img, 0, 0, S, S);
    if (withRef && GW.refDraw) GW.refDraw(ctx);
    design.elements.forEach(function (el) {
      if (el.hidden) return;
      var t = GW.types[el.type]; if (!t) return;
      scratchCtx.setTransform(1, 0, 0, 1, 0, 0); scratchCtx.clearRect(0, 0, S, S); scratchCtx.save(); scratchCtx.imageSmoothingEnabled = false;
      try { t.draw(scratchCtx, el, env); } catch (e) { if (window.console) console.error('draw failed', el.type, e); }
      scratchCtx.restore();
      var im = scratchCtx.getImageData(0, 0, S, S), d = im.data, soft = SOFT[el.type];
      for (var i = 3; i < d.length; i += 4) {
        var a = d[i]; if (!a) continue;
        d[i] = soft ? Math.round(Math.round(a / 255 * 3) / 3 * 255) : (a >= 128 ? 255 : 0);
      }
      scratchCtx.putImageData(im, 0, 0);
      ctx.drawImage(scratch, 0, 0);
    });
    var out = ctx.getImageData(0, 0, S, S), o = out.data, r2 = S * S / 4, c0 = S / 2;
    for (var y = 0; y < S; y++) for (var x = 0; x < S; x++) {
      var p = (y * S + x) * 4;
      if ((x + .5 - c0) * (x + .5 - c0) + (y + .5 - c0) * (y + .5 - c0) > r2) { o[p + 3] = 0; continue; }   // outside the round screen
      o[p] = Math.round(o[p] / 85) * 85; o[p + 1] = Math.round(o[p + 1] / 85) * 85; o[p + 2] = Math.round(o[p + 2] / 85) * 85; o[p + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);
    ctx.restore();
  };

  // Round thumbnail on a fresh canvas. `env` defaults to a calm fixed 10:09:36 so presets look their best.
  GW.thumb = function (design, px, env) {
    var c = document.createElement('canvas'), d = window.devicePixelRatio || 1;
    if ((design.size || 280) !== GW.SIZE) design = GW.convertSize(GW.clone(design), GW.SIZE);   // layouts made on another watch
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
