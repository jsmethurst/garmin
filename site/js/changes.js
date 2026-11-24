/* The Changes tab: every update to Garmin Studio, newest first.
   When you change the Studio, add one entry at the TOP of the list: the next number, the date and time (local, +03:00), and a sentence or two on what changed. */
(function (GW) {
  'use strict';
  GW.CHANGES = [
    { n: 15, t: '2026-11-24 10:40', title: 'Changes tab', text: 'New Changes tab listing every update with its number, date and time, and what changed.' },
    { n: 14, t: '2026-11-24 10:06', title: 'See-through layers', text: 'Any layer on a watch face can be made see-through with a pattern: scanlines, vertical lines, diagonal hatch or a checkerboard. Pick how much is hidden (¼, ½ or ¾) and the pattern size (1–3 px). It paints the background colour back over part of the layer, so it works best on a plain background.' },
    { n: 13, t: '2026-11-23 15:15', title: 'Wearer switch for gradient text', text: 'The wearer can turn the text gradient on or off in Garmin Connect (Settings tab, “Switches the wearer can flip”). Off draws the text in its plain colour. The Fenix7 Red (options) layout gets the switch on its minute digits.' },
    { n: 12, t: '2026-11-23 15:08', title: 'Text gradients follow the colour scheme', text: 'Gradient text now takes its two end colours from the colour options, so it changes with the segments when the wearer picks another colour version.' },
    { n: 11, t: '2026-11-23 15:02', title: 'Fix: “+ Add a color”', text: 'Settings → Colors → “+ Add a color” did nothing, because the clean-up of unused settings removed the new colour at once. A colour added by hand is now kept.' },
    { n: 10, t: '2026-11-23 14:56', title: '3D sunken: shadow on the left', text: 'The sunken look now puts its lesser shadow down the left edge of each segment instead of along the underside.' },
    { n: 9, t: '2026-11-23 14:52', title: '3D sunken segments', text: 'Segment gauges have a second 3D look, “3D sunken”: a shadow along the top and a lighter one on one side, with no highlight. “3D raised” is kept.' },
    { n: 8, t: '2026-11-23 14:41', title: 'Segment looks and gradient colour options', text: 'Segment gauges can be Flat or 3D. Gradient start and end colours follow the colour scheme, with the blend worked out on the watch.' },
    { n: 7, t: '2026-11-23 14:17', title: 'Fenix7 Red (options) in the shared library', text: 'A copy of Fenix7 Red with colour themes and alternative data for its slots was added to the shared library for everyone.' },
    { n: 6, t: '2026-11-23 13:59', title: 'Sunrise / sunset symbol follows its reading', text: 'In data slots the sun symbol switches between rise and set to match the time it is showing.' },
    { n: 5, t: '2026-11-23 13:14', title: 'Formulas, dithered gradients, gradient segments', text: 'Any field can take an if / then / else formula. Arc gradients are dithered for a smooth blend on the 64-colour screen, and segment gauges can use a gradient across their segments.' },
    { n: 4, t: '2026-11-20 21:52', title: 'Fix: arc markers broke the export', text: 'The code for arc markers passed more than the 9 arguments Monkey C allows, so the build failed. The direction is now merged into the marker kind.' },
    { n: 3, t: '2026-11-20 19:01', title: 'Colour panels preset', text: 'New “Colour panels” preset for 260 and 280 screens, with every split on the centre line and a taller time panel.' },
    { n: 2, t: '2026-11-20 18:28', title: 'Arc marker outline', text: 'Circle, tick and triangle markers at the end of arcs can have a thin outline.' },
    { n: 1, t: '2026-11-20 18:19', title: 'Lighter icons, more sizes', text: 'Icons gained Light and Extra light stroke weights and sizes from 12 to 32 px, so small icons stay sharp.' }
  ];
})(window.GW);
