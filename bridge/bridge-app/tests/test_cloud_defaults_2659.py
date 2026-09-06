"""
CLOUD REACHABILITY OUT OF THE BOX — items 2 and 3 (t2659, BACKLOG #81).

Item 2: when config.json never wrote a `backend` key at all AND a Drive token already exists (the user
signed in), default to `drive` — signing in already said what they want. A user who explicitly persisted
`backend: "local"` (Setup's own save always writes it, useDrive unchecked) must NEVER be silently switched.

Item 3: cloud_state_line(config) — "publishing to Drive as <name>" / "local-only" — so the console/log
always says the state, closing the "silently off" symptom the whole entry is about.

Run standalone:  python bridge/bridge-app/tests/test_cloud_defaults_2659.py
"""
import json
import os
import sys
import tempfile

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_HERE, ".."))
from fairy.config import Config          # noqa: E402
from fairy import oauth                  # noqa: E402
from fairy.bridge import cloud_state_line  # noqa: E402


def _cfg_path(persisted=None):
    d = tempfile.mkdtemp(prefix="fairy_clouddefault_test_")
    p = os.path.join(d, "config.json")
    if persisted is not None:
        with open(p, "w", encoding="utf-8") as f:
            json.dump(persisted, f)
    return p


def _with_oauth_connected(value, fn):
    orig = oauth.connected
    oauth.connected = lambda: value
    try:
        return fn()
    finally:
        oauth.connected = orig


def test_no_backend_key_at_all_plus_a_signed_in_token_defaults_to_drive():
    path = _cfg_path({"machine_name": "Ultimate Bee"})   # config.json exists, but never wrote "backend" — first-run-ish
    cfg = _with_oauth_connected(True, lambda: Config.from_env(config_path=path))
    assert cfg.backend == "drive", cfg.backend


def test_no_backend_key_but_never_signed_in_stays_local():
    path = _cfg_path({"machine_name": "Ultimate Bee"})
    cfg = _with_oauth_connected(False, lambda: Config.from_env(config_path=path))
    assert cfg.backend == "local", cfg.backend


def test_an_explicit_persisted_local_choice_is_never_overridden_even_when_signed_in():
    """The one case this must NEVER touch: Setup's own save always writes `backend` explicitly (useDrive
    unchecked -> "local"), so its presence — any value — means a real choice was made, not silence."""
    path = _cfg_path({"machine_name": "Ultimate Bee", "backend": "local"})
    cfg = _with_oauth_connected(True, lambda: Config.from_env(config_path=path))
    assert cfg.backend == "local", "an explicit persisted 'local' must survive a signed-in token"


def test_an_explicit_cli_override_still_wins_over_the_new_default():
    path = _cfg_path({"machine_name": "Ultimate Bee"})
    cfg = _with_oauth_connected(True, lambda: Config.from_env(config_path=path, backend="local"))
    assert cfg.backend == "local", "an explicit CLI --backend must win over the signed-in auto-default too"


def test_cloud_state_line_says_drive_and_the_name():
    cfg = Config(backend="drive", machine_name="Rig B")
    assert cloud_state_line(cfg) == 'publishing to Drive as "Rig B"', cloud_state_line(cfg)


def test_cloud_state_line_says_drive_with_no_name_yet():
    cfg = Config(backend="drive", machine_name="")
    assert "no machine name set yet" in cloud_state_line(cfg), cloud_state_line(cfg)


def test_cloud_state_line_says_local_only():
    cfg = Config(backend="local")
    assert cloud_state_line(cfg) == "local-only (not publishing to the cloud)", cloud_state_line(cfg)


if __name__ == "__main__":
    for name, fn in sorted((n, f) for n, f in globals().items()
                           if n.startswith("test_") and callable(f)):
        fn()
        print("  ok  ", name)
    print("PASS")
