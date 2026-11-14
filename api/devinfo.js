import { getBox, sh, json } from './_builder.js';

// TEMPORARY, read-only: GET /api/devinfo?cmd=list|file&path=... shows what Garmin's device files hold (font sizes and so on).
export default async function handler(req, res) {
  try {
    const box = await getBox();
    const q = new URL(req.url, 'http://x').searchParams, d = q.get('device') || 'fenix6xpro', what = q.get('what') || 'list';
    const base = `$HOME/.Garmin/ConnectIQ/Devices/${d.replace(/[^a-z0-9]/gi, '')}`;
    let script;
    if (what === 'list') script = `cd ${base} && find . -maxdepth 3 | head -200 && du -sh .`;
    else if (what === 'json') script = `cd ${base} && python3 -c "import json,sys; j=json.load(open('${(q.get('file') || 'simulator.json').replace(/[^a-zA-Z0-9_.]/g, '')}')); print(json.dumps(j.get('${(q.get('key') || 'fonts').replace(/[^a-zA-Z0-9_]/g, '')}', j), indent=1)[:60000])"`;
    else if (what === 'find') script = `cd $HOME/.Garmin/ConnectIQ && find . -iname '*font*' | head -100`;
    else return json(res, 400, { ok: false, message: 'unknown what' });
    const r = await sh(box, script);
    json(res, 200, { code: r.code, out: r.out.slice(0, 80000), err: r.err.slice(0, 2000) });
  } catch (e) { json(res, 500, { ok: false, message: String(e.message || e) }); }
}
