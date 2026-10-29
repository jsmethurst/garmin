import { getBox, sh, json, CHECK } from './_builder.js';

// GET /api/status -> { ready, message }
export default async function handler(req, res) {
  try {
    let box;
    try { box = await getBox(); } catch { return json(res, 200, { ready: false, message: 'Builder not set up yet.' }); }
    const r = await sh(box, CHECK);
    json(res, 200, r.code === 0 ? { ready: true, message: 'Builder ready.' } : { ready: false, message: 'Builder needs setup (open /setup).' });
  } catch (e) {
    json(res, 200, { ready: false, message: 'Builder unavailable: ' + e.message });
  }
}
