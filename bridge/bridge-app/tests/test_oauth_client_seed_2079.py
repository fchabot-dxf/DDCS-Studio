"""
THE BUNDLED OAUTH CLIENT MUST BE THE *DESKTOP* ONE (t2079).

WHY THIS EXISTS. The exe signs in through the LOOPBACK flow — Google redirects to
http://127.0.0.1:<serve-port>/oauth/google/callback. A Google **"Web application"** client accepts only
redirect URIs registered against it one at a time; a **"Desktop app" (installed)** client accepts any
loopback port by construction. `config.from_env()` seeds its credentials from the bundled
`fairy/google_oauth.json`, and it used to read `oauth_data.get("web") or oauth_data.get("installed")` —
web FIRST. With a credentials file carrying both, every machine therefore seeded the WRONG client and every
sign-in died on `Error 400: redirect_uri_mismatch`. Hit live on ASUS + CNC-FAIRY, 2026-08-19.

This is a ONE-LINE ordering bug with a whole-product blast radius (nobody can sign in), and nothing would
have caught it: the seeding path has no other test, and the failure only appears against real Google.

Run standalone:  python bridge/bridge-app/tests/test_oauth_client_seed_2079.py
"""
import json
import os
import sys
import tempfile

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_HERE, ".."))
import fairy.config as cfgmod                    # noqa: E402
from fairy.config import Config                  # noqa: E402

_BUNDLE = os.path.join(os.path.dirname(cfgmod.__file__), "google_oauth.json")


def _seed(creds):
    """Write a bundled credentials file, load a config as a FRESH machine would, then clean up.
    Refuses to run if a real credentials file is present — never clobber a developer's own."""
    if os.path.exists(_BUNDLE):
        return None    # a real bundle is here; skip rather than destroy it
    json.dump(creds, open(_BUNDLE, "w", encoding="utf-8"))
    try:
        tmp = tempfile.mkdtemp()
        return Config.from_env(config_path=os.path.join(tmp, "fresh.json"))
    finally:
        os.remove(_BUNDLE)


def test_installed_wins_when_the_file_carries_both():
    """THE REGRESSION. A credentials file with both blocks must seed the DESKTOP client."""
    c = _seed({"web": {"client_id": "WEB", "client_secret": "w"},
               "installed": {"client_id": "DESKTOP", "client_secret": "d"}})
    if c is None:
        print("  skip  (a real google_oauth.json is present)")
        return
    assert c.google_client_id == "DESKTOP", f"seeded the WEB client -> every sign-in dies on redirect_uri_mismatch: {c.google_client_id}"
    assert c.google_client_secret == "d", c.google_client_secret


def test_web_still_works_as_a_fallback():
    """An older single-client file must still start the app rather than leaving Google sign-in dead."""
    c = _seed({"web": {"client_id": "WEB-ONLY", "client_secret": "w"}})
    if c is None:
        return
    assert c.google_client_id == "WEB-ONLY", c.google_client_id


def test_no_bundle_leaves_google_disabled_rather_than_guessing():
    """No credentials file = desktop Google sign-in is simply off. It must not invent an id."""
    if os.path.exists(_BUNDLE):
        return
    tmp = tempfile.mkdtemp()
    c = Config.from_env(config_path=os.path.join(tmp, "fresh.json"))
    assert c.google_client_id == "", c.google_client_id


# ── t2079b — the correction: an EXISTING install must migrate, not just a fresh one ──────────────────────────
# t2079 fixed the seed order, which fixed FRESH installs. It did nothing for a machine that already had the
# wrong client PERSISTED from an earlier run -- and a persisted value is never re-seeded, so updating the app
# changed nothing there. Hit live on ASUS minutes after t2079 shipped: same redirect_uri_mismatch, new build.

_MISSEEDED = "895572525139-mapt84pm4lfudmjfq553k6pm4m2o0e77.apps.googleusercontent.com"


def _with_persisted(persisted, creds={"installed": {"client_id": "DESKTOP", "client_secret": "d"}}):
    if os.path.exists(_BUNDLE):
        return None, None
    json.dump(creds, open(_BUNDLE, "w", encoding="utf-8"))
    try:
        cfgp = os.path.join(tempfile.mkdtemp(), "config.json")
        json.dump(persisted, open(cfgp, "w", encoding="utf-8"))
        return Config.from_env(config_path=cfgp), cfgp
    finally:
        os.remove(_BUNDLE)


def test_an_existing_install_on_the_misseeded_web_client_is_migrated():
    """THE LIVE REGRESSION. No provenance marker (it predates the marker) -- recognised by the exact WEB
    client id that used to be auto-seeded, which nobody would ever type into the gateway by hand."""
    c, cfgp = _with_persisted({"google_client_id": _MISSEEDED, "google_client_secret": "old"})
    if c is None:
        return
    assert c.google_client_id == "DESKTOP", f"still on the web client -> sign-in stays broken: {c.google_client_id}"
    assert json.load(open(cfgp, encoding="utf-8"))["google_client_id"] == "DESKTOP", "migration must PERSIST"


def test_a_client_the_user_set_themselves_is_never_touched():
    """The distinction the first attempt could not make: without it this is a clobber, not a migration."""
    c, _ = _with_persisted({"google_client_id": "MY-OWN", "google_client_secret": "mine"})
    if c is None:
        return
    assert c.google_client_id == "MY-OWN", c.google_client_id


def test_a_marked_bundled_value_follows_the_bundle_when_it_changes():
    """Provenance for everything seeded from here on, so no future client swap needs a hardcoded id."""
    c, _ = _with_persisted({"google_client_id": "OLD-BUNDLED", "google_client_secret": "x",
                            "google_client_source": "bundled"})
    if c is None:
        return
    assert c.google_client_id == "DESKTOP", c.google_client_id


if __name__ == "__main__":
    for name, fn in sorted((n, f) for n, f in globals().items() if n.startswith("test_") and callable(f)):
        fn()
        print("  ok  ", name)
    print("PASS -- the bundled credentials seed the DESKTOP (installed) client, which is the only kind whose "
          "loopback redirect the exe's own sign-in flow can use; web remains a fallback for an older file.")
