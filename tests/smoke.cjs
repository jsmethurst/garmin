/* Smoke test: every preset must export a sane Connect IQ project.
   Run: npm install && npx playwright install chromium && npm test */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..', 'site');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };

const server = http.createServer((req, res) => {
  const f = path.join(root, req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

// balanced brackets outside of string literals
function balanced(src) {
  const st = []; const pairs = { ')': '(', ']': '[', '}': '{' };
  let inStr = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inStr) { if (c === '\\') i++; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; }
    else if ('([{'.includes(c)) st.push(c);
    else if (')]}'.includes(c)) { if (st.pop() !== pairs[c]) return false; }
  }
  return st.length === 0 && !inStr;
}

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = 'http://localhost:' + server.address().port + '/';
  const browser = await chromium.launch(); const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text())); // /api/* does not exist on the static test server
  await page.goto(url); await page.waitForSelector('html.ready');
  const ids = await page.evaluate(() => GW.PRESETS.map(p => p.id));
  const helpers = await page.evaluate(() => Object.keys(GW.MC_HELPERS));
  let failed = 0;
  const fail = (id, msg) => { failed++; console.error('FAIL ' + id + ': ' + msg); };

  for (const id of ids) {
    const res = await page.evaluate(id => new Promise(r => GW.applyPreset(id, () => GW.fontsReady().then(async () => {
      const b = await GW.buildProject(GW.design);
      r({ files: b.files.map(f => ({ path: f.path, text: typeof f.data === 'string' ? f.data : null, size: f.data.length })) });
    }))), id);
    const get = re => res.files.find(f => re.test(f.path));
    const view = get(/View\.mc$/), app = get(/App\.mc$/), man = get(/manifest\.xml$/);
    if (!view || !app || !man || !get(/monkey\.jungle$/) || !get(/launcher_icon\.png$/)) { fail(id, 'missing core files'); continue; }
    for (const f of res.files.filter(f => /\.(mc|xml|fnt)$/.test(f.path))) {
      // the embedded design (base64) can contain any letters, "NaN" included, by chance: only the rest of the file is checked
      if (/undefined|NaN|\[object|Infinity/.test(f.text.replace(/GWD1_[A-Za-z0-9+\/=_-]*_GWD1/g, ''))) fail(id, f.path + ' contains undefined/NaN');
    }
    for (const f of [view, app]) if (!balanced(f.text)) fail(id, f.path + ' has unbalanced brackets');
    // Monkey C allows at most 9 arguments in a call or a declaration (the compiler rejects more)
    for (const ln of view.text.split('\n')) {
      const code = ln.replace(/"(\\.|[^"\\])*"/g, '""');
      for (const m of code.matchAll(/\b([A-Za-z_]\w*)\(/g)) {
        let depth = 1, n = 0, any = false;
        for (let i = m.index + m[0].length; i < code.length && depth > 0; i++) {
          const c = code[i];
          if ('([{'.includes(c)) depth++; else if (')]}'.includes(c)) depth--; else if (c === ',' && depth === 1) n++;
          if (depth > 0 && !/\s/.test(c)) any = true;
        }
        if (any && n + 1 > 9) fail(id, 'too many arguments (' + (n + 1) + ') in ' + m[1] + '(...) : ' + ln.trim().slice(0, 80));
      }
    }
    for (const m of view.text.matchAll(/function (drawEl\d+)\(/g)) if (!view.text.includes('        ' + m[1] + '(dc);')) fail(id, m[1] + ' never called');
    for (const h of helpers) {
      const used = new RegExp('[^.\\w]' + h + '\\(').test(view.text.replace(new RegExp('function ' + h + '\\('), ''));
      if (used && !new RegExp('function ' + h + '\\(').test(view.text)) fail(id, 'helper ' + h + ' used but not defined');
    }
    for (const f of res.files.filter(f => /\.xml$/.test(f.path))) {
      const ok = await page.evaluate(t => !new DOMParser().parseFromString(t, 'application/xml').querySelector('parsererror'), f.text);
      if (!ok) fail(id, f.path + ' is not well-formed XML');
    }
    // every font/bitmap referenced by resources must exist
    for (const m of (get(/fonts\.xml$/) || { text: '' }).text.matchAll(/filename="([^"]+)"/g))
      if (!res.files.some(f => f.path === 'resources/fonts/' + m[1])) fail(id, 'font file missing: ' + m[1]);
    console.log('ok   ' + id + ' (' + res.files.length + ' files)');
  }
  if (errors.length) { failed++; console.error('Browser errors:', errors); }
  await browser.close(); server.close();
  if (failed) { console.error(failed + ' problem(s)'); process.exit(1); }
  console.log('All presets export cleanly.');
})();
