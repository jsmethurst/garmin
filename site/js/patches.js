/* Patches: small edits to layouts that already live in the shared library. Each one is applied once, on top of the layout as it looks now
   (so anything edited by hand in the editor stays), then recorded in the library so it is never applied twice.
   See GW.maintainLibrary in presets.js for the operations. Built-in layouts need the same change in presets.js for fresh libraries. */
(function (GW) {
  'use strict';
  GW.PATCHES = [
    { id: '2026-11-14-honeycomb-altitude-m', layout: 'Honeycomb', kind: 'watch', ops: [{ find: { source: 'altitude' }, set: { suffix: 'm' } }] }
    ,{ id: '2026-11-14-honeycomb-distance-km', layout: 'Honeycomb', kind: 'watch', ops: [{ find: { source: 'distance' }, set: { suffix: 'km' } }] }
    ,{ id: '2026-11-14-honeycomb-black-on-white', layout: 'Honeycomb', kind: 'watch', ops: [
      { design: { bg: '#ffffff' } },
      { find: { type: 'shape', kind: 'hex' }, set: { color: '#ffffff' } },          // the coloured cells become plain white
      { find: { type: 'hexgrid' }, set: { color: '#000000' } },
      { find: { type: 'text' }, set: { color: '#000000' } },
      { find: { type: 'icon' }, set: { color: '#000000' } },
      { find: { type: 'wxicon' }, set: { mono: '#000000' } },
      { find: { type: 'sunmark' }, set: { color: '#000000' } }
    ] }
    // "Honeycomb Colored": a copy of the Honeycomb exactly as it is in the library (so your font and position changes come along), coloured by what each cell measures:
    // activity amber, effort red, body rose, weather and sun blue, altitude teal, battery green; white lines, text and symbols on black
    ,{ id: '2026-11-14-honeycomb-colored', copyOf: 'Honeycomb', as: 'Honeycomb Colored', kind: 'watch', ops: [
      { design: { bg: '#000000' } },
      { find: { type: 'hexgrid' }, set: { color: '#ffffff' } },
      { find: { type: 'text' }, set: { color: '#ffffff' } },
      { find: { type: 'text', source: 'nyZoneTime' }, set: { color: '#aaddff' } },
      { find: { type: 'text', source: 'date' }, set: { color: '#aaddff' } },
      { find: { type: 'icon' }, set: { color: '#ffffff' } },
      { find: { type: 'wxicon' }, set: { mono: '#ffffff' } },
      { find: { type: 'sunmark' }, set: { color: '#ffffff' } },
      { honeycombFills: { centre: '#000055', groups: { steps: '#aa5500', distance: '#aa5500', floors: '#aa5500', calories: '#aa0000', intMins: '#aa0000', hr: '#aa0055', bodyBat: '#aa0055', resp: '#aa0055', temp: '#0055aa', sunNext: '#0055aa', altitude: '#00aaaa', batteryDays: '#00aa55' } } }
    ] }
  ];
})(window.GW);
