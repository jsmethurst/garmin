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

// The store's token is normally BLOB_READ_WRITE_TOKEN, but connecting a store with a name prefix gives <PREFIX>_READ_WRITE_TOKEN: accept either.
const tokenKey = () => (process.env.BLOB_READ_WRITE_TOKEN ? 'BLOB_READ_WRITE_TOKEN' : Object.keys(process.env).find((k) => /_READ_WRITE_TOKEN$/.test(k) && process.env[k]));

export default async function handler(req, res) {
  const key = tokenKey();
  if (!key) {
    const seen = Object.keys(process.env).filter((k) => /BLOB/i.test(k));   // names only, never values: helps to see what the project has
    const reason = 'No Blob store token in this deployment' + (seen.length ? ' (found: ' + seen.join(', ') + ')' : ' (no BLOB variables at all: connect the store to the project and redeploy)');
    if (req.method === 'GET') return json(res, 200, { configured: false, reason, layouts: [] });
    return json(res, 503, { ok: false, message: reason });
  }
  const token = process.env[key];
  try {
    if (req.method === 'GET') {
      const blobs = [];
      let cursor;
      do { const r = await list({ token, prefix: 'layouts/', cursor, limit: 1000 }); blobs.push(...r.blobs); cursor = r.hasMore ? r.cursor : undefined; } while (cursor);
      const layouts = (await Promise.all(blobs.map(async (b) => {
        try {
          const g = await get(b.pathname, { token, access: 'private' });
          return g ? JSON.parse(await new Response(g.stream).text()) : null;
        } catch { return null; }
      }))).filter((l) => l && l.name && KINDS.includes(l.kind) && l.data);
      return json(res, 200, { configured: true, layouts });
    }
    if (req.method === 'POST') {
      const l = await readBody(req, 4 * 1024 * 1024);
      if (!l.name || !KINDS.includes(l.kind) || !l.data) return json(res, 400, { ok: false, message: 'A layout needs a name, a kind (watch or field) and its data.' });
      const entry = { name: String(l.name).trim().slice(0, 80), kind: l.kind, ts: Number(l.ts) || Date.now(), data: l.data };
      await put(pathOf(entry.kind, entry.name), JSON.stringify(entry), { token, access: 'private', allowOverwrite: true, addRandomSuffix: false, contentType: 'application/json' });
      return json(res, 200, { ok: true });
    }
    if (req.method === 'DELETE') {
      const q = new URL(req.url, 'http://x').searchParams, kind = q.get('kind'), name = q.get('name');
      if (!name || !KINDS.includes(kind)) return json(res, 400, { ok: false, message: 'kind and name are needed.' });
      await del(pathOf(kind, name), { token });
      return json(res, 200, { ok: true });
    }
    json(res, 405, { ok: false, message: 'GET, POST or DELETE only.' });
  } catch (e) {
    // GET reports the problem as "not connected" with the reason, so the page can show it
    if (req.method === 'GET') return json(res, 200, { configured: false, reason: String(e.message || e), layouts: [] });
    json(res, 500, { ok: false, message: String(e.message || e) });
  }
}
