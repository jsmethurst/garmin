/* Patches: small edits to layouts that already live in the shared library. Each one is applied once, on top of the layout as it looks now
   (so anything edited by hand in the editor stays), then recorded in the library so it is never applied twice.
   See GW.maintainLibrary in presets.js for the operations. Built-in layouts need the same change in presets.js for fresh libraries. */
(function (GW) {
  'use strict';
  GW.PATCHES = [
    { id: '2026-11-14-honeycomb-altitude-m', layout: 'Honeycomb', kind: 'watch', ops: [{ find: { source: 'altitude' }, set: { suffix: 'm' } }] }
  ];
})(window.GW);
