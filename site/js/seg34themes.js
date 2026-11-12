/* Colour schemes for the Segment34 faces: the 24 of the original (themes.xml, MIP) plus some more of the same kind.
   Each is [background, clock, clock ghost, outline, data, field ghost, field label, date, date dim, notifications, stress, body battery, moon] (TRANSP = unused). */
(function (GW) {
  'use strict';
  GW.SEG34_THEMES = [
    { id: 0, name: "Yellow on turquoise", c: ["#000000","#FFFF00","#005555","#TRANSP","#FFFFFF","#005555","#55AAAA","#FFFF00","#TRANSP","#00AAFF","#FFAA00","#00AAFF","#FFFFFF"] },
    { id: 8, name: "Yellow on blue", c: ["#000000","#FFFF00","#0055AA","#TRANSP","#FFFFFF","#0055AA","#0055AA","#FFFF00","#TRANSP","#55AAFF","#FFAA00","#55AAFF","#FFFFFF"] },
    { id: 1, name: "Hot pink", c: ["#000000","#FF55AA","#005555","#TRANSP","#FFFFFF","#005555","#AA55AA","#FFFFFF","#TRANSP","#FF55AA","#FF55AA","#00FFAA","#FFFFFF"] },
    { id: 10, name: "Blue", c: ["#000000","#0055AA","#000055","#TRANSP","#FFFFFF","#555555","#0055AA","#FFFFFF","#TRANSP","#55AAFF","#FFAA00","#55AAFF","#FFFFFF"] },
    { id: 2, name: "Blueish green", c: ["#000000","#00FFFF","#0055AA","#TRANSP","#FFFFFF","#0055AA","#55AAAA","#00FFFF","#TRANSP","#00AAFF","#FFAA00","#00AAFF","#FFFFFF"] },
    { id: 3, name: "Green", c: ["#000000","#00FF00","#005500","#TRANSP","#FFFFFF","#005500","#00AA55","#00FF00","#TRANSP","#00AAFF","#FFAA00","#00AAFF","#FFFFFF"] },
    { id: 19, name: "Green camo", c: ["#000000","#AAAA55","#005500","#TRANSP","#00FF00","#005500","#AAAA00","#AAAA55","#TRANSP","#00FF55","#AAAA55","#00FF00","#FFFFFF"] },
    { id: 18, name: "Green and orange", c: ["#000000","#FF5500","#005500","#TRANSP","#00FF00","#005500","#FF5500","#00FF00","#TRANSP","#55FF55","#FF5500","#00AAFF","#FFFFFF"] },
    { id: 11, name: "Orange", c: ["#000000","#FFAA00","#555555","#TRANSP","#FFFFFF","#555555","#FFAA00","#FFFFFF","#TRANSP","#55AAFF","#FFAA00","#55AAFF","#FFFFFF"] },
    { id: 23, name: "Amber", c: ["#000000","#FFAA00","#555555","#TRANSP","#FFAA55","#555555","#FFAA00","#FFAA55","#TRANSP","#55AAAA","#FFAA00","#55AAAA","#FFFFFF"] },
    { id: 5, name: "Peachy orange", c: ["#000000","#FF5500","#5500AA","#TRANSP","#FFFFFF","#5500AA","#FFAAAA","#FFAAAA","#TRANSP","#FFFFFF","#FF5555","#00AAFF","#FFFFFF"] },
    { id: 20, name: "Red", c: ["#000000","#FF0000","#555555","#TRANSP","#FFFFFF","#555555","#FF0000","#FFFFFF","#TRANSP","#55AAFF","#FF5555","#55AAFF","#FFFFFF"] },
    { id: 22, name: "Purple", c: ["#000000","#AA00FF","#555555","#TRANSP","#FFFFFF","#555555","#AA00FF","#FFFFFF","#TRANSP","#55AAFF","#FFAA00","#55AAFF","#FFFFFF"] },
    { id: 4, name: "White on turquoise", c: ["#000000","#FFFFFF","#005555","#TRANSP","#FFFFFF","#005555","#55AAAA","#FFFFFF","#TRANSP","#AAAAAA","#FFAA55","#55AAFF","#FFFFFF"] },
    { id: 6, name: "White on red", c: ["#000000","#FFFFFF","#AA0000","#TRANSP","#FFFFFF","#AA0000","#FF0000","#FFFFFF","#TRANSP","#FF0000","#AA0000","#00AAFF","#FFFFFF"] },
    { id: 7, name: "White on blue", c: ["#000000","#FFFFFF","#0055AA","#TRANSP","#FFFFFF","#0055AA","#0055AA","#FFFFFF","#TRANSP","#55AAFF","#FFAA00","#55AAFF","#FFFFFF"] },
    { id: 9, name: "White on orange", c: ["#000000","#FFFFFF","#AA5500","#TRANSP","#FFFFFF","#AA5500","#FF5500","#FFFFFF","#TRANSP","#00AAFF","#FFAA00","#00AAFF","#FFFFFF"] },
    { id: 12, name: "White on black", c: ["#000000","#FFFFFF","#555555","#TRANSP","#FFFFFF","#555555","#FFFFFF","#FFFFFF","#TRANSP","#55AAFF","#FFAA00","#55AAFF","#FFFFFF"] },
    { id: 13, name: "Black on white", c: ["#FFFFFF","#000000","#AAAAAA","#TRANSP","#000000","#AAAAAA","#000000","#000000","#TRANSP","#000000","#FFAA00","#55AAFF","#555555"] },
    { id: 14, name: "Red on white", c: ["#FFFFFF","#AA0000","#AAAAAA","#TRANSP","#000000","#AAAAAA","#AA0000","#000000","#TRANSP","#000000","#FFAA00","#55AAFF","#555555"] },
    { id: 15, name: "Blue on white", c: ["#FFFFFF","#0000AA","#AAAAAA","#TRANSP","#000000","#AAAAAA","#0000AA","#000000","#TRANSP","#000000","#FFAA00","#55AAFF","#555555"] },
    { id: 16, name: "Green on white", c: ["#FFFFFF","#00AA00","#AAAAAA","#TRANSP","#000000","#AAAAAA","#00AA00","#000000","#TRANSP","#000000","#FFAA00","#55AAFF","#555555"] },
    { id: 17, name: "Orange on white", c: ["#FFFFFF","#FF5500","#AAAAAA","#TRANSP","#000000","#AAAAAA","#555555","#000000","#TRANSP","#000000","#FF5500","#55AAFF","#555555"] },
    { id: 21, name: "Purple on white", c: ["#FFFFFF","#AA00FF","#AAAAAA","#TRANSP","#000000","#AAAAAA","#AA00FF","#000000","#TRANSP","#000000","#FF5500","#55AAFF","#555555"] },
    { id: 24, name: "Magenta", c: ["#000000","#FF55FF","#550055","#TRANSP","#FFFFFF","#550055","#AA55AA","#FF55FF","#TRANSP","#55FFFF","#FFAA00","#55FFFF","#FFFFFF"] },
    { id: 25, name: "Mint", c: ["#000000","#55FFAA","#005555","#TRANSP","#FFFFFF","#005555","#00AAAA","#55FFAA","#TRANSP","#55AAFF","#FFAA00","#00FFFF","#FFFFFF"] },
    { id: 26, name: "Sunset", c: ["#000000","#FF5500","#AA0055","#TRANSP","#FFFFFF","#AA0055","#FFAA00","#FFAA55","#TRANSP","#55AAFF","#FFAA00","#FF55AA","#FFFFFF"] },
    { id: 27, name: "Ice", c: ["#000000","#AAFFFF","#0055AA","#TRANSP","#FFFFFF","#0055AA","#55AAFF","#FFFFFF","#TRANSP","#55AAFF","#FFAA00","#AAFFFF","#FFFFFF"] },
    { id: 28, name: "Gold", c: ["#000000","#FFAA00","#555500","#TRANSP","#FFFFFF","#555500","#AA5500","#FFFF55","#TRANSP","#55AAFF","#FF5500","#FFFF55","#FFFFFF"] },
    { id: 29, name: "Lime", c: ["#000000","#AAFF00","#005500","#TRANSP","#FFFFFF","#005500","#55AA00","#AAFF00","#TRANSP","#55AAFF","#FFAA00","#00FFAA","#FFFFFF"] },
    { id: 30, name: "Cyberpunk", c: ["#000000","#00FFFF","#AA0055","#TRANSP","#FFFFFF","#AA0055","#FF55AA","#FF55FF","#TRANSP","#FF55FF","#FF55AA","#00FFFF","#FFFFFF"] },
    { id: 31, name: "Matrix", c: ["#000000","#00FF00","#005500","#TRANSP","#00FF00","#005500","#00AA00","#00FF00","#TRANSP","#55FF55","#55FF55","#00AA00","#00FF00"] },
    { id: 32, name: "Coral", c: ["#000000","#FF5555","#550000","#TRANSP","#FFFFFF","#550000","#FF5555","#FFAAAA","#TRANSP","#55AAFF","#FFAA00","#FFAAAA","#FFFFFF"] },
    { id: 33, name: "Steel grey", c: ["#000000","#AAAAAA","#555555","#TRANSP","#FFFFFF","#555555","#555555","#AAAAAA","#TRANSP","#AAAAAA","#AAAAAA","#FFFFFF","#FFFFFF"] },
    { id: 34, name: "Midnight", c: ["#000000","#5555FF","#000055","#TRANSP","#FFFFFF","#000055","#5555FF","#AAAAFF","#TRANSP","#55AAFF","#FFAA00","#55AAFF","#FFFFFF"] },
    { id: 35, name: "Pink on white", c: ["#FFFFFF","#FF0055","#AAAAAA","#TRANSP","#000000","#AAAAAA","#FF0055","#000000","#TRANSP","#000000","#FF5500","#55AAFF","#555555"] },
    { id: 36, name: "Teal on white", c: ["#FFFFFF","#00AAAA","#AAAAAA","#TRANSP","#000000","#AAAAAA","#00AAAA","#000000","#TRANSP","#000000","#FF5500","#55AAFF","#555555"] }
  ];
})(window.GW);
