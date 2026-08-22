"""
THE GATEWAY'S CHIME HAS A MASTER TOGGLE PLUS A PER-SOUND OFF-LIST, BOTH LIVE FROM STUDIO (t2125, SOUND-PLAN.md).

BACKGROUND: chime.py used to be gated by its OWN "enable_chime" Setup toggle (config.json + a --no-chime
CLI flag) -- a second, independent switch that could silently disagree with whatever the browser's UI
said. SOUND-PLAN.md's ruling is "exactly ONE toggle anywhere in the product" for the MASTER switch: the
gateway's field is renamed sound_enabled and loses its CLI flag entirely, becoming a pure live-mirror of
whatever Studio's browser last pushed via POST /api/config -- never independently settable from the
gateway's own side. Amendment 3 added a SECOND live-mirrored field, sound_off: a per-sound off-list (e.g.
silencing just "job.arrived") that must reach the gateway too, or a silenced sound on the browser would
still play on the mill PC -- the same duplicate-source shape the master toggle already fixed.

chime.py ITSELF is unchanged: SOUND-PLAN.md's "zero samples" plan was corrected mid-build (section 5) --
the job sounds (arrived/delivered/failed) keep the existing learned WAVs, unthemed, exactly as before.
Only the toggles that gate them, and the browser's UI-action sounds, changed.

Run standalone:  python bridge/bridge-app/tests/test_sound_toggle_2125.py
"""
import json
import os
import shutil
import sys
import tempfile

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_HERE, ".."))
from fairy.config import Config   # noqa: E402
from fairy import ops as ops_module   # noqa: E402


def test_sound_enabled_defaults_true():
    c = Config()
    assert c.sound_enabled is True


def test_enable_chime_is_fully_retired():
    c = Config()
    assert not hasattr(c, "enable_chime"), "enable_chime must not survive as a second, independent toggle"
    assert "enable_chime" not in Config._PERSIST_KEYS
    assert "sound_enabled" in Config._PERSIST_KEYS
    assert Config._PERSIST_KEYS["sound_enabled"] == "sound_enabled"


def test_no_chime_cli_flag_is_gone():
    """A --no-chime flag would be a SECOND source of truth the browser toggle could silently disagree
    with -- SOUND-PLAN.md rules exactly one toggle anywhere in the product, so there must be no CLI
    override at all; the gateway's only path to sound_enabled is what Studio pushes."""
    from fairy import bridge
    import inspect
    src = inspect.getsource(bridge.main)
    assert "--no-chime" not in src
    assert "no_chime" not in src


def test_theme_field_does_not_exist():
    """chime.py plays unthemed samples (SOUND-PLAN.md section 5's correction) -- the gateway never
    needed a theme and a leftover field would just be dead config."""
    c = Config()
    assert not hasattr(c, "theme")
    assert "theme" not in Config._PERSIST_KEYS


def test_sound_off_defaults_to_an_empty_list():
    c = Config()
    assert c.sound_off == []


def test_sound_off_is_a_declared_persist_key():
    assert Config._PERSIST_KEYS.get("sound_off") == "sound_off"


def test_two_config_instances_do_not_share_the_same_off_list():
    """dataclass mutable-default hazard: sound_off MUST use field(default_factory=list), never a bare
    `= []` class-level default, or every Config() would share and mutate ONE list."""
    a, b = Config(), Config()
    a.sound_off.append('job.arrived')
    assert b.sound_off == [], "a second Config() must not see the first one's mutation"


def test_sound_allowed_respects_the_master_toggle():
    """t2129 (review) -- REAL BEHAVIOUR, not a source grep. The original version of this test grepped
    inspect.getsource(run_loop) for literal strings; empirically, inverting the guard's polarity AND
    deleting the master-mute clause each left it green, because the asserted text survived in a comment.
    _sound_allowed is the actual extracted decision function bridge.py's real hook calls -- mutate IT and
    these assertions break for real."""
    from fairy import bridge
    c = Config()
    c.sound_enabled = False
    assert bridge._sound_allowed(c, "received") is False, "master OFF must silence every job event"
    c.sound_enabled = True
    assert bridge._sound_allowed(c, "received") is True, "master ON, nothing silenced -> allowed"


def test_sound_allowed_respects_the_per_action_off_list():
    from fairy import bridge
    c = Config()
    c.sound_enabled = True
    c.sound_off = ["job.arrived"]
    assert bridge._sound_allowed(c, "received") is False, "job.arrived is silenced -- 'received' must not play"
    assert bridge._sound_allowed(c, "delivered") is True, "job.delivered was NOT silenced -- must be unaffected"
    assert bridge._sound_allowed(c, "failed") is True, "job.failed was NOT silenced -- must be unaffected"


def test_sound_hook_calls_chime_play_only_when_allowed():
    """The real wiring, not just the predicate: _make_sound_hook is the SAME function run_loop calls to
    build poller.on_sound, exercised here with a fake chime module so no real audio plays."""
    from fairy import bridge

    class _FakeChime:
        def __init__(self):
            self.calls = []

        def play(self, studio_dir, event):
            self.calls.append(event)

    c = Config()
    c.sound_enabled = True
    c.sound_off = ["job.arrived"]
    fake_chime = _FakeChime()
    hook = bridge._make_sound_hook(c, fake_chime)

    hook("received")     # job.arrived -- silenced
    hook("delivered")    # job.delivered -- not silenced
    hook("failed")       # job.failed -- not silenced
    assert fake_chime.calls == ["delivered", "failed"], fake_chime.calls

    c.sound_enabled = False
    fake_chime.calls.clear()
    hook("delivered")
    assert fake_chime.calls == [], "master OFF must block every event even when nothing is per-action-silenced"


class _OpsShim:
    """Exercises get_config/set_config as real bound methods against a real Config(), without booting a
    whole Ops (which needs a live backend/transfer/beacons) -- only what those two methods actually reach
    on self beyond .cfg is stubbed; _config_file/_lan_ip are the real Ops implementations."""
    def __init__(self, cfg):
        self.cfg = cfg

    _config_file = ops_module.Ops._config_file
    _lan_ip = staticmethod(ops_module.Ops._lan_ip)
    get_config = ops_module.Ops.get_config

    def controller_reachable(self):
        return False


def test_get_config_reports_sound_enabled_not_the_old_field():
    out = ops_module.Ops.get_config(_OpsShim(Config()))
    assert out["sound_enabled"] is True
    assert out["sound_off"] == []
    assert "enable_chime" not in out
    assert "theme" not in out


def test_set_config_updates_sound_enabled_live_no_restart_needed():
    tmp = tempfile.mkdtemp()
    try:
        c = Config(config_path=os.path.join(tmp, "config.json"))   # scratch path -- never touches the real user's config
        assert c.sound_enabled is True
        ops_module.Ops.set_config(_OpsShim(c), {"sound_enabled": False})
        assert c.sound_enabled is False
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_set_config_updates_sound_off_live_and_persists_a_real_list():
    tmp = tempfile.mkdtemp()
    try:
        c = Config(config_path=os.path.join(tmp, "config.json"))
        assert c.sound_off == []
        ops_module.Ops.set_config(_OpsShim(c), {"sound_off": ["job.arrived", "job.failed"]})
        assert c.sound_off == ["job.arrived", "job.failed"]
        # persisted to disk -- a restart must not silently forget the per-sound off-list
        with open(c.config_path, encoding="utf-8") as f:
            saved = json.load(f)
        assert saved.get("sound_off") == ["job.arrived", "job.failed"]
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_set_config_ignores_a_malformed_sound_off_rather_than_crashing():
    """A single bad POST body must not corrupt or crash the gateway's config -- fail closed (ignore),
    never fail open (accept garbage) or raise."""
    tmp = tempfile.mkdtemp()
    try:
        c = Config(config_path=os.path.join(tmp, "config.json"))
        ops_module.Ops.set_config(_OpsShim(c), {"sound_off": "not-a-list"})
        assert c.sound_off == [], "a non-list value must be ignored, not coerced or crashed on"
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_a_malformed_sound_off_never_reaches_disk_either():
    """t2129 (review) -- THE REAL BUG: the in-memory guard above was already correct, but the disk-persist
    step used to write `updates` VERBATIM regardless of it, so a malformed value the in-memory check
    correctly rejected still landed in config.json. On the next restart, from_env() reads it straight back
    with no re-validation -- e.g. sound_off as an int would silently break every _on_sound check forever
    (a TypeError swallowed by poller.py's own try/except: no job sound ever again, nothing in the logs).
    This is the test the original (in-memory-only) assertion above could not have caught."""
    tmp = tempfile.mkdtemp()
    try:
        c = Config(config_path=os.path.join(tmp, "config.json"))
        ops_module.Ops.set_config(_OpsShim(c), {"sound_off": 5})
        assert os.path.exists(c.config_path), "sanity: a config file must have been written"
        with open(c.config_path, encoding="utf-8") as f:
            saved = json.load(f)
        assert "sound_off" not in saved or saved["sound_off"] is None, \
            f"a malformed sound_off must never reach disk: {saved.get('sound_off')!r}"
        # and the round-trip a restart would do must not resurrect it either
        c2 = Config.from_env(config_path=c.config_path)
        assert c2.sound_off == [], "a restart reading the persisted file must not inherit corrupted state"
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    for name, fn in sorted((n, f) for n, f in globals().items()
                           if n.startswith("test_") and callable(f)):
        fn()
        print("  ok  ", name)
    print("PASS -- the gateway's sound toggle is a single live mirror of Studio's own toggle: no CLI "
          "flag, no leftover enable_chime/theme fields, and set_config/get_config round-trip cleanly.")
