"""server.py — the gateway's LOCAL HTTP server (CONFIGS §3 offline/local configs).

Exposes the Ops surface (ops.py) as a small JSON API, serves Studio at `/` (COMBINED-APP-PLAN Step 1
— the one-app face; the legacy fairy console moves to `/fairy/` until Step 5 retires it), and mounts
the monorepo `shared/` core at `/shared/` (no-build sharing via serve config).
This is how the gateway *serves the console* at localhost (offline) or on the LAN (local-network):
download the gateway, run it, open the browser → the whole local system.

Stdlib only (http.server) — no extra dependency, works fully offline. Binds 127.0.0.1 by default
(offline/one-box); set host=0.0.0.0 for the local-network config. CORS is permissive so the console
can also be opened from a separate dev origin during development.

API (all JSON):
  GET  /api/descriptor                 -> gateway descriptor (machine id/name, controller_connected, ...)
  GET  /api/profile                    -> controller profile in the shared shape (Studio consumes this)
  GET  /api/queue                      -> [ status/queue items ]
  GET  /api/status?id=<jobId>          -> one status object (404 if none)
  GET  /api/files                      -> CNCDISK listing (cncdisk/index shape)
  GET  /api/file?name=<file>           -> { ok, name, content }  (read a CNCDISK file)
  POST /api/jobs        {name, nc, map?}-> { jobId, name, tracked }   (queue a job)
  POST /api/files/delete{name}         -> { ok, ... }                 (safe delete on CNCDISK)
"""
import json
import mimetypes
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from . import oauth   # desktop (loopback) Google OAuth — see oauth.py

# ES modules must be served with a JS MIME type or the browser refuses them. On Windows mimetypes
# reads the registry, where .js sometimes maps to text/plain — pin .js/.mjs so the console and the
# /shared/ modules always load as modules.
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/javascript", ".mjs")

_PLACEHOLDER = (
    b"<!doctype html><meta charset=utf-8><title>DDCS Bridge gateway</title>"
    b"<body style='font:14px system-ui;margin:3em;max-width:40em'>"
    b"<h2>DDCS Bridge \xe2\x80\x94 gateway running</h2>"
    b"<p>The console isn't bundled yet. The operations API is live under "
    b"<code>/api/</code> (e.g. <a href='/api/descriptor'>/api/descriptor</a>, "
    b"<a href='/api/queue'>/api/queue</a>, <a href='/api/files'>/api/files</a>).</p>"
)


class _Handler(BaseHTTPRequestHandler):
    server_version = "ddcs-bridge-gateway"

    # -- helpers --------------------------------------------------------------
    def _send_json(self, obj, code=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self):
        n = int(self.headers.get("Content-Length", 0) or 0)
        if not n:
            return {}
        try:
            return json.loads(self.rfile.read(n).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return {}

    def _send_html(self, html, code=200):
        body = html.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):  # keep the gateway log clean
        pass

    @property
    def ops(self):
        return self.server.ops

    # -- routing --------------------------------------------------------------
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        u = urlparse(self.path)
        path, q = u.path, parse_qs(u.query)
        if path == "/api/descriptor":
            return self._send_json(self.ops.descriptor())
        if path == "/api/profile":
            return self._send_json(self.ops.profile())
        if path == "/api/vars":
            raw = (q.get("ns") or [""])[0]
            nums = [x for x in raw.split(",") if x.strip()]
            return self._send_json(self.ops.read_vars(nums))
        if path == "/api/config":
            return self._send_json(self.ops.get_config())
        if path == "/api/queue":
            return self._send_json(self.ops.list_queue())
        if path == "/api/history":
            try:
                limit = int((q.get("limit") or ["100"])[0])
            except ValueError:
                limit = 100
            return self._send_json(self.ops.list_history(limit))
        if path == "/api/status":
            st = self.ops.get_status((q.get("id") or [""])[0])
            return self._send_json(st, 200) if st else self._send_json({"error": "no such job"}, 404)
        if path == "/api/files":
            return self._send_json(self.ops.list_files())
        if path == "/api/file":
            return self._send_json(self.ops.read_file((q.get("name") or [""])[0]))
        if path == "/api/sysfile":
            return self._send_json(self.ops.read_sysfile((q.get("name") or [""])[0]))
        if path == "/api/scan":
            return self._send_json({"controllers": self.ops.scan_controllers()})
        if path == "/api/lan-qr":
            try:                              # QR of the LAN URL (pure-python SVG, offline) for the Settings LAN ACCESS panel
                import io
                import qrcode
                import qrcode.image.svg
                url = "http://%s:%d/" % (self.ops._lan_ip(), self.server.server_address[1])
                buf = io.BytesIO()
                qrcode.make(url, image_factory=qrcode.image.svg.SvgPathImage).save(buf)
                svg = buf.getvalue()
                self.send_response(200)
                self.send_header("Content-Type", "image/svg+xml")
                self.send_header("Content-Length", str(len(svg)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(svg)
            except Exception as e:
                self._send_json({"error": "qr unavailable: %s" % e}, 500)
            return
        # --- desktop Google OAuth (loopback flow; oauth.py). The exe's webview can't run Google's popup,
        #     so the gateway opens the SYSTEM browser and catches the redirect here, exchanging server-side.
        if path == "/oauth/google/start":
            cid = self.ops.cfg.google_client_id
            if not cid:
                return self._send_json({"ok": False, "error": "no Google Desktop client id (Setup > Network)"}, 400)
            redirect = "http://127.0.0.1:%d/oauth/google/callback" % self.server.server_address[1]
            try:
                return self._send_json({"ok": True, "url": oauth.start(cid, redirect)})
            except Exception as e:
                return self._send_json({"ok": False, "error": str(e)}, 500)
        if path == "/oauth/google/callback":
            ok = oauth.callback(self.ops.cfg.google_client_id, self.ops.cfg.google_client_secret, (q.get("state") or [""])[0], (q.get("code") or [""])[0])
            note = ("Signed in to Google Drive — close this tab and return to DDCS Studio." if ok
                    else "Sign-in failed — close this tab and try again from DDCS Studio.")
            return self._send_html("<!doctype html><meta charset=utf-8><title>DDCS Studio</title>"
                                   "<body style='font:16px system-ui;padding:3em;text-align:center'><h2>%s</h2></body>" % note)
        if path == "/api/oauth/google/token":
            cid = self.ops.cfg.google_client_id
            return self._send_json({"access_token": oauth.access_token(cid, self.ops.cfg.google_client_secret) if cid else "", "connected": oauth.connected()})
        if path == "/api/oauth/google/status":
            return self._send_json({"connected": oauth.connected(), "configured": bool(self.ops.cfg.google_client_id)})
        if path.startswith("/shared/"):
            # the monorepo shared/ core (client.js, instrument/, …) — single source, served as-is (no build)
            return self._serve_file(self.server.shared_dir, path[len("/shared/"):])
        if self.server.studio_dir and (path == "/fairy" or path.startswith("/fairy/")):
            # legacy fairy console, kept reachable while Studio owns / (retired at COMBINED-APP-PLAN Step 5)
            return self._serve_file(self.server.console_dir, path[len("/fairy/"):] or "index.html")
        return self._serve_static(path)

    def do_POST(self):
        if self.path == "/api/jobs":
            b = self._read_body()
            if not b.get("name") or "nc" not in b:
                return self._send_json({"error": "name and nc required"}, 400)
            return self._send_json(self.ops.submit_job(b["name"], b["nc"], b.get("map")))
        if self.path == "/api/files/delete":
            b = self._read_body()
            return self._send_json(self.ops.delete_file(b.get("name", "")))
        if self.path == "/api/config":
            return self._send_json(self.ops.set_config(self._read_body()))
        if self.path == "/api/sysfile":
            b = self._read_body()
            return self._send_json(self.ops.write_sysfile(b.get("name", ""), b.get("content", ""), b.get("mode", "write")))
        if self.path == "/api/sysfiles/delete":
            b = self._read_body()
            return self._send_json(self.ops.delete_sysfile(b.get("name", "")))
        return self._send_json({"error": "not found"}, 404)

    # -- static console -------------------------------------------------------
    def _serve_static(self, path):
        root = self.server.studio_dir or self.server.console_dir
        if not root:
            return self._send_bytes(_PLACEHOLDER, "text/html")
        return self._serve_file(root, path.lstrip("/") or "index.html")

    def _serve_file(self, root, rel):
        """Serve rel under root as a static file (path-traversal guarded). 404 if root unset/missing."""
        if not root:
            return self._send_json({"error": "not found"}, 404)
        full = os.path.normpath(os.path.join(root, rel))
        if not full.startswith(os.path.normpath(root)) or not os.path.isfile(full):
            return self._send_json({"error": "not found"}, 404)
        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        with open(full, "rb") as f:
            self._send_bytes(f.read(), ctype)

    def _send_bytes(self, body, ctype):
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        # t1243 — NO-CACHE ON EVERY STATIC BYTE. Studio ships raw ES modules; with no Cache-Control at all a browser
        # applies HEURISTIC freshness (a fraction of the file's age) and re-serves a module it already has, so a fixed
        # bug reappears on a normal reload and the code no longer explains the screen. Revalidate always.
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)


def start_server(config, ops):
    """Start the local HTTP server in a daemon thread. Returns the server (call .shutdown() to stop)."""
    httpd = ThreadingHTTPServer((config.host, config.port), _Handler)
    httpd.ops = ops
    httpd.console_dir = config.console_dir
    httpd.studio_dir = config.studio_dir
    httpd.shared_dir = config.shared_dir
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd
