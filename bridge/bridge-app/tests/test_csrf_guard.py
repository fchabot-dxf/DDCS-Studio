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
    # the Ops methods the guarded routes call — each returns a sentinel so "reached Ops" (past the guard) is observable
    def set_config(self, body):        return {"ok": True, "reached": "set_config"}
    def submit_job(self, n, nc, m):    return {"ok": True, "reached": "submit_job"}
    def delete_file(self, name):       return {"ok": True, "reached": "delete_file"}
    def write_sysfile(self, *a):       return {"ok": True, "reached": "write_sysfile"}
    def delete_sysfile(self, name):    return {"ok": True, "reached": "delete_sysfile"}
    def get_config(self):              return {"ok": True, "reached": "get_config"}


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


if __name__ == "__main__":
    test_forged_post_without_header_is_403()
    test_post_with_header_reaches_ops()
    test_preflight_never_grants_the_local_header()
    test_get_reads_stay_open()
    test_guard_is_header_only_not_loopback()
    print("PASS — gateway CSRF guard: forged POST 403 (5 routes, never reaches Ops), header POST reaches Ops, "
          "preflight withholds X-DDCS-Local, GET open, guard is header-only (LAN == loopback for the header)")
