import { getBox, sh, json, CHECK, SETUP } from './_builder.js';

// POST /api/setup  -> installs Garmin's SDK + the fenix 6X Pro device into the persistent sandbox.
// Needs env vars: GARMIN_USERNAME, GARMIN_PASSWORD, GARMIN_SDK_AGREEMENT=accept
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'POST only' });
  const { GARMIN_USERNAME, GARMIN_PASSWORD, GARMIN_SDK_AGREEMENT } = process.env;
  if (!GARMIN_USERNAME || !GARMIN_PASSWORD) {
    return json(res, 400, { ok: false, message: 'GARMIN_USERNAME and GARMIN_PASSWORD are not set in the Vercel project.' });
  }
  if (GARMIN_SDK_AGREEMENT !== 'accept') {
    return json(res, 400, { ok: false, message: 'Set GARMIN_SDK_AGREEMENT=accept in the Vercel project to accept Garmin’s SDK licence.' });
  }
  try {
    const box = await getBox({ create: true });
    const r = await sh(box, SETUP, { GARMIN_USERNAME, GARMIN_PASSWORD, GARMIN_SDK_AGREEMENT });
    const clean = (s) => String(s).split(GARMIN_PASSWORD).join('***');
    if (r.code !== 0) return json(res, 500, { ok: false, message: 'Setup failed.', log: clean(r.out + '\n' + r.err).slice(-4000) });
    const c = await sh(box, CHECK);
    await box.stop(); // snapshot so later builds restore instantly
    json(res, 200, { ok: c.code === 0, message: c.code === 0 ? 'Builder is ready.' : 'Setup finished but the device files are missing.', log: clean(r.out).slice(-2000) });
  } catch (e) {
    json(res, 500, { ok: false, message: 'Setup error: ' + e.message });
  }
}
