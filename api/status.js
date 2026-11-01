import { getBox, sh, json, checkFor } from './_builder.js';

// GET /api/status?device=fenix6 -> { ready, message }
export default async function handler(req, res) {
  try {
    let box;
    try { box = await getBox(); } catch { return json(res, 200, { ready: false, message: 'Builder not set up yet.' }); }
    const device = new URL(req.url, 'http://x').searchParams.get('device');
    const r = await sh(box, checkFor(device));
    json(res, 200, r.code === 0 ? { ready: true, message: 'Builder ready.' } : { ready: false, message: 'Builder needs setup (open /setup).' });
  } catch (e) {
    json(res, 200, { ready: false, message: 'Builder unavailable: ' + e.message });
  }
}
