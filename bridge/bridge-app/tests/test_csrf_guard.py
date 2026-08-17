"""
GATEWAY CSRF GUARD (t1115) — the state-changing POST routes require the non-CORS-able X-DDCS-Local: 1 header, so a
drive-by cross-origin page cannot forge them (its preflight is refused — do_OPTIONS grants ONLY Content-Type), while a
SAME-ORIGIN Studio client (loopback OR LAN — the guard is HEADER-ONLY, not loopback-gated) still works. Adversarial: a
POST with no header is 403 and never reaches Ops; with the header it reaches Ops; the preflight never lists
X-DDCS-Local; GET reads stay open; the predicate inspects only the header (so LAN == loopback for the same header).

Run standalone:  python bridge/bridge-app/tests/test_csrf_guard.py
(No pytest infra in this repo; plain asserts + a PASS print. Also importable as test_* for a future runner.)
"""
import http.client
import os
import sys
import types

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_HERE, ".."))          # bridge-app (for `fairy`)
from fairy import server                                # noqa: E402


class _MockOps:
    # the Ops methods the guarded routes call — each returns a sentinel so "reached Ops" (past the guard) is observable.
    # cfg carries a Google client id so the token GET route reaches the (stubbed) oauth exchange rather than short-circuit.
    def __init__(self):
        self.cfg = types.SimpleNamespace(google_client_id="cid", google_client_secret="secret")

    def set_config(self, body):        return {"ok": True, "reached": "set_config"}
    def submit_job(self, n, nc, m, h=None):    return {"ok": True, "reached": "submit_job"}
    def delete_file(self, name):       return {"ok": True, "reached": "delete_file"}
    def write_sysfile(self, *a):       return {"ok": True, "reached": "write_sysfile"}
    def delete_sysfile(self, name):    return {"ok": True, "reached": "delete_sysfile"}
    def get_config(self):              return {"ok": True, "reached": "get_config"}
    def read_file(self, name):         return {"ok": True, "name": name, "content": "SECRET_GCODE_G1X5"}
    def read_sysfile(self, name):      return {"ok": True, "name": name, "content": "SECRET_MACRO_M99"}


def _start():
    cfg = types.SimpleNamespace(host="127.0.0.1", port=0, console_dir=None, studio_dir=None, shared_dir=None)
    httpd = server.start_server(cfg, _MockOps())
    return httpd, httpd.server_address[1]


def _req(port, method, path, headers=None, body=None):
    c = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
    c.request(method, path, body=body, headers=headers or {})
    r = c.getresponse()
    data = r.read().decode("utf-8")
    c.close()
    return r.status, dict(r.getheaders()), data


_JOBS_BODY = '{"name":"x","nc":"G0"}'
_HDR_JSON = {"Content-Type": "application/json"}
_HDR_LOCAL = {"Content-Type": "application/json", "X-DDCS-Local": "1"}
_STATE_ROUTES = [("/api/config", "{}"), ("/api/jobs", _JOBS_BODY), ("/api/files/delete", "{}"),
                 ("/api/sysfile", "{}"), ("/api/sysfiles/delete", "{}")]


def test_forged_post_without_header_is_403():
    """A forged cross-origin POST (no X-DDCS-Local) is refused 403 on EVERY state-changing route, before touching Ops."""
    httpd, port = _start()
    try:
        for path, body in _STATE_ROUTES:
            st, _, data = _req(port, "POST", path, _HDR_JSON, body)
            assert st == 403, "%s without X-DDCS-Local must be 403, got %d (%s)" % (path, st, data)
            assert "reached" not in data, "%s must NOT reach Ops when unguarded: %s" % (path, data)
    finally:
        httpd.shutdown()


def test_post_with_header_reaches_ops():
    """A same-origin Studio call (loopback OR LAN) carrying the header passes the guard and reaches Ops."""
    httpd, port = _start()
    try:
        for path, body in _STATE_ROUTES:
            st, _, data = _req(port, "POST", path, _HDR_LOCAL, body)
            assert st == 200 and "reached" in data, "%s WITH header must reach Ops, got %d (%s)" % (path, st, data)
    finally:
        httpd.shutdown()


def test_preflight_never_grants_the_local_header():
    """The OTHER half of the guard: the preflight must NOT allow X-DDCS-Local, so a cross-origin page can't set it."""
    httpd, port = _start()
    try:
        st, hdrs, _ = _req(port, "OPTIONS", "/api/config")
        allow = hdrs.get("Access-Control-Allow-Headers") or ""
        assert "x-ddcs-local" not in allow.lower(), "preflight must NOT grant X-DDCS-Local (would let cross-origin forge): %r" % allow
        assert "content-type" in allow.lower(), "preflight should still grant Content-Type: %r" % allow
    finally:
        httpd.shutdown()


def test_get_reads_stay_open():
    """Reads are not state-changing → a GET needs NO header (scope the guard to the state-changing POSTs)."""
    httpd, port = _start()
    try:
        st, _, data = _req(port, "GET", "/api/config")
        assert st == 200 and "get_config" in data, "GET /api/config must stay open, got %d (%s)" % (st, data)
    finally:
        httpd.shutdown()


def test_guard_is_header_only_not_loopback():
    """The predicate inspects ONLY the header, never the peer IP → a LAN client (Settings LAN ACCESS) with the header
    takes the SAME code path a loopback client does. (Contrast /api/update/* which ALSO requires a loopback peer.)"""
    assert server._has_local_header({"X-DDCS-Local": "1"}) is True
    assert server._has_local_header({}) is False
    assert server._has_local_header({"X-DDCS-Local": "0"}) is False


def test_sensitive_get_token_is_guarded():
    """The Drive-CREDENTIAL leak (the serious one): GET /api/oauth/google/token must be 403 without the header and NOT
    leak the token; Studio's own GET (same-origin/LAN) with the header still returns it. status is guarded too. The
    oauth module is stubbed to a sentinel so the test proves the GUARD, not the OAuth exchange (no network/file)."""
    _orig = (server.oauth.access_token, server.oauth.connected)
    server.oauth.access_token = lambda cid, secret: "FAKE_DRIVE_TOKEN"
    server.oauth.connected = lambda: True
    httpd, port = _start()
    try:
        # forged cross-origin GET, no header → 403 AND the token does NOT leak
        st, _, data = _req(port, "GET", "/api/oauth/google/token")
        assert st == 403, "token GET without header must be 403, got %d (%s)" % (st, data)
        assert "FAKE_DRIVE_TOKEN" not in data, "the Drive token must NOT leak to an unguarded GET: %s" % data
        # Studio's own GET (same-origin/LAN) with the header → 200 + the token (its legit read still works)
        st, _, data = _req(port, "GET", "/api/oauth/google/token", {"X-DDCS-Local": "1"})
        assert st == 200 and "FAKE_DRIVE_TOKEN" in data, "Studio's GET with the header must return the token, got %d (%s)" % (st, data)
        # status is guarded the same way; an innocuous read stays open (proven by test_get_reads_stay_open)
        st, _, _ = _req(port, "GET", "/api/oauth/google/status")
        assert st == 403, "status GET without header must be 403, got %d" % st
        st, _, _ = _req(port, "GET", "/api/oauth/google/status", {"X-DDCS-Local": "1"})
        assert st == 200, "status GET with header must pass, got %d" % st
    finally:
        server.oauth.access_token, server.oauth.connected = _orig
        httpd.shutdown()


def test_file_reads_are_guarded():
    """The file-content disclosure: GET /api/file + /api/sysfile return the user's CNCDISK/SYSDISK contents, so they must
    be 403 without the header (content NOT leaked) and return the content WITH it (Studio's own read works loopback/LAN).
    A ?name= query must still match the guard (the path is query-stripped before the set check)."""
    httpd, port = _start()
    try:
        for path, secret in [("/api/file?name=a.nc", "SECRET_GCODE_G1X5"), ("/api/sysfile?name=T.nc", "SECRET_MACRO_M99")]:
            st, _, data = _req(port, "GET", path)                         # forged cross-origin read, no header
            assert st == 403, "%s without header must be 403, got %d (%s)" % (path, st, data)
            assert secret not in data, "the file content must NOT leak to an unguarded GET: %s" % data
            st, _, data = _req(port, "GET", path, {"X-DDCS-Local": "1"})  # Studio (same-origin/LAN) with the header
            assert st == 200 and secret in data, "%s WITH header must return the content, got %d (%s)" % (path, st, data)
    finally:
        httpd.shutdown()


def test_trusted_origin_preflight_grants_the_local_header():
    """MODE C works: the hosted page (a TRUSTED DDCS origin) pointed at a local/LAN gateway is cross-origin, so its
    custom X-DDCS-Local header needs a preflight — and a trusted origin's preflight IS granted X-DDCS-Local + gets its
    origin reflected (not *), so it CAN set the header and the guarded POSTs/GETs work for the hosted-then-local flow."""
    httpd, port = _start()
    try:
        origin = "https://ddcs-studio.pages.dev"
        st, hdrs, _ = _req(port, "OPTIONS", "/api/config", {"Origin": origin})
        allow_hdr = hdrs.get("Access-Control-Allow-Headers") or ""
        allow_origin = hdrs.get("Access-Control-Allow-Origin") or ""
        assert "x-ddcs-local" in allow_hdr.lower(), "a TRUSTED origin's preflight MUST grant X-DDCS-Local (mode c): %r" % allow_hdr
        assert allow_origin == origin, "a trusted origin must be REFLECTED (not *) so it can set the header, got %r" % allow_origin
    finally:
        httpd.shutdown()


def test_evil_origin_preflight_does_not_grant_the_local_header():
    """The drive-by is STILL blocked: a preflight from a NON-allowlisted (evil) origin is NOT granted X-DDCS-Local and
    is NOT origin-reflected (stays *), so an attacker page still cannot set the header → the guarded routes hold. The
    allowlist only lets a KNOWN origin through; it does not weaken the header guard for anyone else."""
    httpd, port = _start()
    try:
        st, hdrs, _ = _req(port, "OPTIONS", "/api/config", {"Origin": "https://evil.example"})
        allow_hdr = hdrs.get("Access-Control-Allow-Headers") or ""
        allow_origin = hdrs.get("Access-Control-Allow-Origin") or ""
        assert "x-ddcs-local" not in allow_hdr.lower(), "an EVIL origin's preflight must NOT grant X-DDCS-Local: %r" % allow_hdr
        assert "content-type" in allow_hdr.lower(), "the evil-origin preflight should still grant Content-Type: %r" % allow_hdr
        assert allow_origin == "*", "a non-trusted origin must NOT be reflected (stays *), got %r" % allow_origin
    finally:
        httpd.shutdown()


def test_open_external_is_guarded_and_scheme_limited():
    """POST /api/open-external opens a link in the user's REAL browser host-side (the fix for the embedded-webview
    double-download, t2066). It is a state-changing POST, so the CSRF guard applies (403 without the header); WITH the
    header it opens only http(s) and REFUSES any other scheme (no file:// or custom-protocol launch from a page).
    webbrowser.open is stubbed, so the test proves the GUARD + the scheme gate and never launches a browser."""
    import webbrowser
    _orig = webbrowser.open
    opened = []
    webbrowser.open = lambda u, *a, **k: (opened.append(u) or True)
    httpd, port = _start()
    try:
        # forged cross-origin POST, no header → 403, and nothing is opened
        st, _, data = _req(port, "POST", "/api/open-external", _HDR_JSON, '{"url":"https://example.com"}')
        assert st == 403, "open-external without header must be 403, got %d (%s)" % (st, data)
        assert opened == [], "must not open anything when unguarded: %r" % opened
        # same-origin POST with the header + an http(s) url → 200 ok, opened exactly once
        st, _, data = _req(port, "POST", "/api/open-external", _HDR_LOCAL, '{"url":"https://example.com/x.exe"}')
        assert st == 200 and '"ok": true' in data, "http(s) open must be 200 ok, got %d (%s)" % (st, data)
        assert opened == ["https://example.com/x.exe"], "the http(s) url must be opened once: %r" % opened
        # a dangerous scheme is refused BEFORE any open (no file:// / protocol-handler launch from a page)
        st, _, data = _req(port, "POST", "/api/open-external", _HDR_LOCAL, '{"url":"file:///C:/Windows/System32/calc.exe"}')
        assert st == 400, "a non-http(s) scheme must be refused 400, got %d (%s)" % (st, data)
        assert opened == ["https://example.com/x.exe"], "the file:// url must NOT be opened: %r" % opened
    finally:
        webbrowser.open = _orig
        httpd.shutdown()


if __name__ == "__main__":
    test_forged_post_without_header_is_403()
    test_post_with_header_reaches_ops()
    test_preflight_never_grants_the_local_header()
    test_get_reads_stay_open()
    test_guard_is_header_only_not_loopback()
    test_sensitive_get_token_is_guarded()
    test_file_reads_are_guarded()
    test_trusted_origin_preflight_grants_the_local_header()
    test_evil_origin_preflight_does_not_grant_the_local_header()
    test_open_external_is_guarded_and_scheme_limited()
    print("PASS — gateway CSRF guard: forged POST 403 (5 routes, never reaches Ops), header POST reaches Ops, "
          "preflight withholds X-DDCS-Local from untrusted/no-origin, innocuous GET open, guard is header-only (LAN == "
          "loopback); the sensitive GETs (Drive token + status) are 403 without the header (token NOT leaked) / return "
          "with it; the file reads (/api/file + /api/sysfile) are 403 without the header (content NOT leaked) / return "
          "with it; and the ORIGIN ALLOWLIST grants X-DDCS-Local to a TRUSTED origin's preflight (mode c works) but NOT "
          "to an evil origin's (drive-by still blocked)")
