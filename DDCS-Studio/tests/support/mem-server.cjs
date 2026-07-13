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
const ROOT = path.resolve(__dirname, '..', '..', 'web');
const store = new Map();
(function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full);
    else store.set('/' + path.relative(ROOT, full).split(path.sep).join('/'), fs.readFileSync(full));
  }
})(ROOT);

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/' || urlPath.endsWith('/')) urlPath += 'index.html';
  const body = store.get(urlPath);
  if (!body) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('404 ' + urlPath); return; }
  res.writeHead(200, { 'Content-Type': mimeFor(urlPath), 'Content-Length': body.length, 'Cache-Control': 'no-cache' });
  res.end(req.method === 'HEAD' ? undefined : body);
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
