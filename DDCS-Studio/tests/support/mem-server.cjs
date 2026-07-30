#!/usr/bin/env node
/*
 * t832 — in-memory static server for the Playwright suite (STRUCTURAL SUITE DIET, server-first).
 *
 * The suite's dominant cost is the per-test BOOT: each of ~1216 boots pulls ~100s of the 346 web/*.js ESM modules. The
 * shipped dev server (`http-server`, single process, per-request fs reads) SERIALIZES that storm — at workers=4 each boot
 * ran ~2x slower under contention, cancelling the parallelism (t830 measure). This replacement PRELOADS all of web/ into a
 * Map ONCE at start (no per-request fs) and serves it with correct mime types, so each of the boot-storm requests is a
 * microsecond Map lookup + a buffer write. The suite still tests THE RAW MODULES that ship (no bundle) — only the transport
 * changes. Runs standalone: `node tests/support/mem-server.cjs [port]` (default 3211; port 0 = an OS-assigned free port,
 * printed as `listening <port>` for a per-worker fixture to read).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.webp': 'image/webp', '.wasm': 'application/wasm', '.map': 'application/json; charset=utf-8',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8', '.nc': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
};
const mimeFor = (p) => MIME[path.extname(p).toLowerCase()] || 'application/octet-stream';

// Preload web/ into a Map keyed by URL path ("/index.html", "/wizards/cornerWizard.js"). ONE fs walk, at start.
// Store {buf, mtime}: mtime → the Last-Modified header, which the app's dev BUILD STAMP (app.js: window.__ddcsBuild)
// HEAD-fetches to prove "what am I running". http-server sends it; dropping it made the transport UNFAITHFUL and failed
// homing-io-ui-cleanup amendment-3 deterministically (t834). A faithful transport preserves every header the app reads.
const ROOT = path.resolve(__dirname, '..', '..', 'web');
const store = new Map();
(function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full);
    else store.set('/' + path.relative(ROOT, full).split(path.sep).join('/'), { buf: fs.readFileSync(full), mtime: fs.statSync(full).mtime });
  }
})(ROOT);

// t1385 — TEST-ONLY MODULES, served under `/_test/` and NOWHERE ELSE IN THE APP.
//
// The drill switch needs a FROZEN literal reference: once `drillStack` re-points through `holecycle` and the literal
// `drill`/`bore` emitters retire, a bridge that still built its "literal side" from the registry would be comparing the
// new path against ITSELF — the vacuity trap. The reference has to be an independent copy of the arithmetic being
// replaced, and it must NOT ship, because nothing in the product may reach a frozen duplicate of a retired kernel.
//
// `web/` is the only thing the app can import, so a reference under `tests/` was previously unreachable from inside
// page.evaluate. This mounts `tests/support/served/` at `/_test/` instead: importable by a spec, invisible to the app
// (no product module resolves that prefix), and obvious at the import site that it is test scaffolding.
const TEST_ROOT = path.resolve(__dirname, 'served');
if (fs.existsSync(TEST_ROOT)) (function walkTest(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkTest(full);
    else store.set('/_test/' + path.relative(TEST_ROOT, full).split(path.sep).join('/'), { buf: fs.readFileSync(full), mtime: fs.statSync(full).mtime });
  }
})(TEST_ROOT);

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/' || urlPath.endsWith('/')) urlPath += 'index.html';
  const entry = store.get(urlPath);
  if (!entry) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('404 ' + urlPath); return; }
  res.writeHead(200, {
    'Content-Type': mimeFor(urlPath), 'Content-Length': entry.buf.length,
    'Last-Modified': entry.mtime.toUTCString(), 'Cache-Control': 'no-cache',
  });
  res.end(req.method === 'HEAD' ? undefined : entry.buf);
});

const port = parseInt(process.argv[2], 10) || 3211;
server.listen(port, () => {
  const actual = server.address().port;
  process.stderr.write(`[mem-server] ${store.size} files preloaded from web/ → listening ${actual}\n`);
  process.stdout.write(`listening ${actual}\n`);   // machine-readable for a per-worker fixture (port 0 → real port)
});
process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));

module.exports = { server, store, mimeFor };
