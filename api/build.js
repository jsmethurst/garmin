import { getBox, sh, json, readBody, checkFor, deviceOf, ROOT } from './_builder.js';

const MAX_FILES = 200, MAX_BYTES = 3 * 1024 * 1024;
const SAFE = /^[A-Za-z0-9_\-./]+$/;

// POST /api/build  { name, format?: 'prg' | 'iq', files: [{ path, data: <base64> }] }  ->  { ok, name, prg: <base64 file>, log }
// 'prg' = debug build to copy onto the watch; 'iq' = release package for the Connect IQ developer portal.
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'POST only' });
  try {
    const body = await readBody(req);
    const files = Array.isArray(body.files) ? body.files : [];
    const name = String(body.name || 'watchface').replace(/[^A-Za-z0-9_-]/g, '') || 'watchface';
    const device = deviceOf(body.device);
    const iq = body.format === 'iq', ext = iq ? 'iq' : 'prg';
    let total = 0;
    if (!files.length || files.length > MAX_FILES) return json(res, 400, { ok: false, message: 'Bad file list.' });
    const job = `${ROOT}/job-${Date.now().toString(36)}`;
    const out = [];
    for (const f of files) {
      const p = String(f.path || '');
      if (p.startsWith('.') || p.includes('/.')) continue; // dotfiles (.vscode, .gitignore) are not needed to compile
      if (!SAFE.test(p) || p.startsWith('/') || p.split('/').includes('..')) return json(res, 400, { ok: false, message: 'Rejected path: ' + p });
      const buf = Buffer.from(String(f.data || ''), 'base64'); total += buf.length;
      if (total > MAX_BYTES) return json(res, 413, { ok: false, message: 'Project too large.' });
      if (/\.(sh|bat)$/.test(p) || p === 'design.json' || p === 'README.md') continue; // not needed for compiling
      out.push({ path: `${job}/${p}`, content: buf });
    }
    const box = await getBox();
    const ok = await sh(box, checkFor(device));
    if (ok.code !== 0) return json(res, 503, { ok: false, message: 'The builder is not set up for this watch yet.' });
    await box.writeFiles(out);
    const flags = iq ? '-e -r' : `-d ${device}`;
    const r = await sh(box, `cd ${job} && mkdir -p bin && ${ROOT}/sdk/bin/monkeyc ${flags} -f monkey.jungle -o bin/${name}.${ext} -y ${ROOT}/key.der -w 2>&1; echo "exit=$?"; ` +
      `if [ -f bin/${name}.${ext} ]; then echo ---PRG---; base64 -w0 bin/${name}.${ext}; fi; ` +
      `if [ -f bin/${name}.prg ] && grep -aq 'GWD1_' bin/${name}.prg; then echo ---DESIGN-YES---; fi; cd ${ROOT} && rm -rf ${job}`);
    const text = r.out;
    const idx = text.indexOf('---PRG---');
    const hasDesign = text.includes('---DESIGN-YES---');   // the editable design is inside the .prg (so Garmin Studio can open it again)
    const log = (idx >= 0 ? text.slice(0, idx) : text).trim();
    if (idx < 0 || !/exit=0/.test(log)) return json(res, 422, { ok: false, message: 'The Garmin compiler reported errors.', log });
    json(res, 200, { ok: true, name: `${name}.${ext}`, prg: text.slice(idx + 9).replace(/---DESIGN-YES---/, '').trim(), hasDesign: iq ? null : hasDesign, log });
  } catch (e) {
    json(res, 500, { ok: false, message: 'Build error: ' + e.message });
  }
}
