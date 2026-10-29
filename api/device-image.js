import { getBox, json, DEVICE } from './_builder.js';

// GET /api/device-image          -> the fenix 6X Pro picture from Garmin's device files (PNG)
// GET /api/device-image?meta=1   -> { w, h, x, y, size }: where the display sits inside the picture
// Served from the builder sandbox so Garmin's artwork never lives in the repo.
export default async function handler(req, res) {
  try {
    const box = await getBox();
    const dir = `$HOME/.Garmin/ConnectIQ/Devices/${DEVICE}`;
    if (req.query && req.query.meta) {
      const py = "import json,struct;s=json.load(open('simulator.json'));d=open(s['image'],'rb').read(32);w,h=struct.unpack('>II',d[16:24]);l=s['display']['location'];print(json.dumps({'w':w,'h':h,'x':l['x'],'y':l['y'],'size':l['width']}))";
      const r = await box.runCommand({ cmd: 'bash', args: ['-lc', `cd ${dir} && python3 -c "${py}"`] });
      res.setHeader('cache-control', 'private, max-age=86400');
      return json(res, 200, JSON.parse(await r.stdout()));
    }
    const r = await box.runCommand({ cmd: 'bash', args: ['-lc', `cat ${dir}/${DEVICE}.png | base64 -w0`] });
    const buf = Buffer.from((await r.stdout()).trim(), 'base64');
    res.statusCode = 200;
    res.setHeader('content-type', 'image/png');
    res.setHeader('cache-control', 'private, max-age=86400');
    res.end(buf);
  } catch (e) {
    json(res, 404, { ok: false, message: 'Device image unavailable: ' + e.message });
  }
}
