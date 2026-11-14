import { list, put, get, del } from '@vercel/blob';
import { json, readBody } from './_builder.js';

// The shared library of saved layouts: everybody sees the same ones.
//   GET    /api/layouts                  -> { configured, layouts: [{ name, kind, ts, data }] }
//   POST   /api/layouts  {name,kind,ts,data}   saves (or updates) one layout
//   DELETE /api/layouts?kind=watch&name=…      removes one
// One private blob per layout (layouts/<kind>/<name>.json), so two people saving different layouts at the same time never overwrite each other.
// Needs a Vercel Blob store connected to the project (it adds BLOB_READ_WRITE_TOKEN). Without one, GET says configured:false and the site keeps layouts in the browser.
const KINDS = ['watch', 'field'];
const b64 = (s) => Buffer.from(String(s).trim().toLowerCase(), 'utf8').toString('base64url');
const pathOf = (kind, name) => `layouts/${kind}/${b64(name)}.json`;

export default async function handler(req, res) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    if (req.method === 'GET') return json(res, 200, { configured: false, layouts: [] });
    return json(res, 503, { ok: false, message: 'The shared library is not connected yet (no Blob store on this project).' });
  }
  try {
    if (req.method === 'GET') {
      const blobs = [];
      let cursor;
      do { const r = await list({ prefix: 'layouts/', cursor, limit: 1000 }); blobs.push(...r.blobs); cursor = r.hasMore ? r.cursor : undefined; } while (cursor);
      const layouts = (await Promise.all(blobs.map(async (b) => {
        try {
          const g = await get(b.pathname, { access: 'private' });
          return g ? JSON.parse(await new Response(g.stream).text()) : null;
        } catch { return null; }
      }))).filter((l) => l && l.name && KINDS.includes(l.kind) && l.data);
      return json(res, 200, { configured: true, layouts });
    }
    if (req.method === 'POST') {
      const l = await readBody(req, 4 * 1024 * 1024);
      if (!l.name || !KINDS.includes(l.kind) || !l.data) return json(res, 400, { ok: false, message: 'A layout needs a name, a kind (watch or field) and its data.' });
      const entry = { name: String(l.name).trim().slice(0, 80), kind: l.kind, ts: Number(l.ts) || Date.now(), data: l.data };
      await put(pathOf(entry.kind, entry.name), JSON.stringify(entry), { access: 'private', allowOverwrite: true, addRandomSuffix: false, contentType: 'application/json' });
      return json(res, 200, { ok: true });
    }
    if (req.method === 'DELETE') {
      const q = new URL(req.url, 'http://x').searchParams, kind = q.get('kind'), name = q.get('name');
      if (!name || !KINDS.includes(kind)) return json(res, 400, { ok: false, message: 'kind and name are needed.' });
      await del(pathOf(kind, name));
      return json(res, 200, { ok: true });
    }
    json(res, 405, { ok: false, message: 'GET, POST or DELETE only.' });
  } catch (e) {
    json(res, 500, { ok: false, message: String(e.message || e) });
  }
}
