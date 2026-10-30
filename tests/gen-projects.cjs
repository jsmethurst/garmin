/* Generate every preset's Connect IQ project WITHOUT a browser (for compile tests with Garmin's SDK).
   Usage: node tests/gen-projects.cjs <outDir>
   Bitmap fonts need a canvas, so for this test they are replaced by built-in fonts; everything else is the real output. */
const vm = require('vm'), fs = require('fs'), path = require('path');
const out = process.argv[2] || 'out';
const site = path.join(__dirname, '..', 'site', 'js');

const ctx2d = new Proxy({}, { get: (t, k) => k === 'measureText' ? () => ({ width: 8, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 8, actualBoundingBoxAscent: 10, actualBoundingBoxDescent: 0 }) : () => { } });
const stubCanvas = () => ({ getContext: () => ctx2d, style: {}, width: 0, height: 0 });
const sandbox = {
  console, Math, JSON, Date, Intl, Object, Array, String, Number, Promise, Error, RegExp, Uint8Array, Uint32Array, TextEncoder, Blob: class { },
  document: { createElement: stubCanvas, fonts: { load: () => Promise.resolve(), add() { } } },
  localStorage: { getItem: () => null, setItem() { } }, Image: class { }, FontFace: class { },
  setTimeout, clearTimeout, crypto: { getRandomValues: (a) => a },
};
sandbox.window = sandbox; sandbox.devicePixelRatio = 1;
vm.createContext(sandbox);
['core', 'sources', 'fonts', 'bigdata-src', 'runfield-src', 'elements', 'bigdata', 'runfield', 'datafield', 'render', 'codegen', 'presets'].forEach((f) => {
  vm.runInContext(fs.readFileSync(path.join(site, f + '.js'), 'utf8'), sandbox, { filename: f + '.js' });
});
const GW = sandbox.GW;

// 40x40 red PNG used as the launcher icon
const zlib = require('zlib');
function crc(b) { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xFFFFFFFF; for (const v of b) x = t[(x ^ v) & 255] ^ (x >>> 8); return (x ^ 0xFFFFFFFF) >>> 0; }
function chunk(type, data) { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); }
const raw = Buffer.concat(Array.from({ length: 40 }, () => Buffer.concat([Buffer.from([0]), Buffer.alloc(120, 0x99)])));
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(40, 0); ihdr.writeUInt32BE(40, 4); ihdr[8] = 8; ihdr[9] = 2;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);

fs.rmSync(out, { recursive: true, force: true });
let n = 0;
for (const p of GW.PRESETS) {
  if (p.id === 'blank' || p.id === 'blankfield') continue;
  const d = p.build();
  const custom = new Set(d.fonts.map((f) => f.id));
  d.fonts = []; d.elements.forEach((e) => { if (e.font && custom.has(e.font)) e.font = 'FONT_NUMBER_MEDIUM'; });
  GW.design = d;
  const src = GW.generateSource(d), dir = path.join(out, p.id);
  const w = (f, t) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), t); };
  w('manifest.xml', `<?xml version="1.0"?>\n<iq:manifest xmlns:iq="http://www.garmin.com/xml/connectiq" version="3">\n<iq:application entry="${src.name}App" id="732f1de14461d6a95adfb8d02a7458c0" launcherIcon="@Drawables.LauncherIcon" name="@Strings.AppName" type="${src.type}" minApiLevel="${src.minApi}">\n<iq:products><iq:product id="fenix6xpro"/></iq:products>\n<iq:permissions>${src.perms.map((x) => `<iq:uses-permission id="${x}"/>`).join('')}</iq:permissions>\n<iq:languages><iq:language>eng</iq:language></iq:languages>\n<iq:barrels/>\n</iq:application>\n</iq:manifest>\n`);
  w('monkey.jungle', 'project.manifest = manifest.xml\n');
  w(`source/${src.name}App.mc`, src.app); w(`source/${src.name}View.mc`, src.view);
  Object.keys(src.files).forEach((f) => w(f, src.files[f]));
  w('resources/strings/strings.xml', '<strings><string id="AppName">T</string></strings>\n');
  w('resources/drawables/drawables.xml', '<drawables><bitmap id="LauncherIcon" filename="launcher_icon.png"/></drawables>\n');
  fs.writeFileSync(path.join(dir, 'resources/drawables/launcher_icon.png'), png);
  n++;
}
console.log('generated', n, 'projects in', out);
