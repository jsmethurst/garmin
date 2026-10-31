/* The activity-screen layouts of the fēnix 6X Pro, exactly as in the Connect IQ SDK (device-reference/fenix6xpro/layout*.svg).
   Each entry lists the rectangles [x, y, width, height] a data field is given on the 280 x 280 round screen. */
(function (GW) {
  'use strict';
  GW.DF_LAYOUTS = [
    { id: '1field', name: '1 field', slots: [[0, 0, 280, 280]] },
    { id: '2fields', name: '2 fields', slots: [[0, 0, 280, 139], [0, 141, 280, 139]] },
    { id: '3fieldsa', name: '3 fields A', slots: [[0, 0, 280, 89], [0, 91, 280, 98], [0, 191, 280, 89]] },
    { id: '3fieldsb', name: '3 fields B', slots: [[0, 0, 280, 94], [0, 96, 280, 88], [0, 186, 280, 94]] },
    { id: '3fieldsc', name: '3 fields C', slots: [[0, 0, 280, 139], [0, 141, 139, 139], [141, 141, 139, 139]] },
    { id: '4fieldsa', name: '4 fields A', slots: [[0, 0, 280, 69], [0, 70, 280, 69], [0, 141, 280, 69], [0, 211, 280, 69]] },
    { id: '4fieldsb', name: '4 fields B', slots: [[0, 0, 280, 99], [0, 101, 139, 78], [141, 101, 139, 78], [0, 181, 280, 99]] },
    { id: '4fieldsc', name: '4 fields C', slots: [[0, 0, 139, 139], [141, 0, 139, 139], [0, 141, 139, 139], [141, 141, 139, 139]] },
    { id: '5fields', name: '5 fields', slots: [[0, 0, 280, 69], [0, 70, 280, 69], [0, 141, 139, 69], [141, 141, 139, 69], [0, 211, 280, 69]] },
    { id: '6fields', name: '6 fields', slots: [[0, 0, 280, 69], [0, 70, 139, 69], [141, 70, 139, 69], [0, 141, 139, 69], [141, 141, 139, 69], [0, 211, 280, 69]] },
    { id: '7fields', name: '7 fields', slots: [[0, 0, 280, 49], [0, 50, 139, 59], [141, 50, 139, 59], [0, 110, 280, 59], [0, 171, 139, 59], [141, 171, 139, 59], [0, 231, 280, 49]] },
    { id: '8fields', name: '8 fields', edges: { 0: 'B', 1: 'R', 3: 'R', 5: 'R', 7: 'T' }, slots: [[0, 0, 280, 49], [0, 51, 139, 59], [141, 51, 139, 59], [0, 112, 139, 59], [141, 112, 139, 59], [0, 173, 139, 59], [141, 173, 139, 59], [0, 234, 280, 49]] }
  ];
  // the rectangle a data-field design lives in: {x, y, w, h, full}
  GW.dfSlot = function (design) {
    var L = GW.DF_LAYOUTS[design.dfLayout] || GW.DF_LAYOUTS[0], r = L.slots[design.dfSlot] || L.slots[0];
    return { x: r[0], y: r[1], w: r[2], h: r[3], full: r[2] === 280 && r[3] === 280, layout: L };
  };
  // which slot an element of a data-field design belongs to (older designs without one follow the slot that was current)
  GW.elSlot = function (el, design) { return el.slot == null ? (design.dfSlot || 0) : el.slot; };
  // Garmin's own dividing lines of a layout, drawn by the cells that sit next to them: {bT,bB,bL,bR} for one slot
  GW.dfEdges = function (design, i) {
    var L = GW.DF_LAYOUTS[design.dfLayout] || GW.DF_LAYOUTS[0], e = (L.edges && L.edges[i]) || '';
    return { bT: e.indexOf('T') >= 0, bB: e.indexOf('B') >= 0, bL: e.indexOf('L') >= 0, bR: e.indexOf('R') >= 0 };
  };
  // give the cells of a design the layout's dividing lines (they stay ordinary per-cell settings the inspector can change)
  GW.applyEdges = function (design) {
    design.elements.forEach(function (el) {
      if (el.type !== 'dfcell') return;
      var E = GW.dfEdges(design, GW.elSlot(el, design));
      ['bT', 'bB', 'bL', 'bR'].forEach(function (k) { if (E[k]) el[k] = true; });
    });
  };
  GW.slotRect = function (design, i) {
    var L = GW.DF_LAYOUTS[design.dfLayout] || GW.DF_LAYOUTS[0], r = L.slots[i] || L.slots[0];
    return { x: r[0], y: r[1], w: r[2], h: r[3] };
  };
})(window.GW);
