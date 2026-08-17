"""
JOB-HISTORY STORAGE: a stable per-user location, and the reinstall actually survives it (t2022).

Proves three things about `Config.from_env()` + `local_folder.migrate_legacy_root`, all against REAL temp
directories on disk (no mocks for the filesystem itself) — only `os.path.expanduser` is patched, so these
tests never touch the real developer's actual ~/.ddcs-bridge:

1. The resolved local_root is HOME-anchored, not cwd-relative — launching from two different folders
   ("installA" then "installB", simulating a reinstall to a new location) resolves to the SAME path.
2. A REINSTALL actually survives: a history record written while "installed" at A is still readable after
   A is deleted entirely and the process is "reinstalled" at a fresh B — not reasoned about, executed.
3. The old cwd-relative `./_bridge_data` (the landmine this turn fixes) is migrated forward exactly once,
   idempotently — a second run never overwrites what the first run (or a fresh write) already placed there.

Run standalone:  python bridge/bridge-app/tests/test_storage_migration_t2022.py
(No pytest infra in this repo; plain asserts + a PASS print.)
"""
import json
import os
import shutil
import sys
import tempfile

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_HERE, ".."))          # bridge-app (for `fairy`)
from fairy.config import Config                                    # noqa: E402
from fairy.backend.local_folder import LocalFolderBackend, migrate_legacy_root   # noqa: E402


class _HomeSwap:
    """Redirects os.path.expanduser('~') to a throwaway temp dir for the life of the `with` block, so these
    tests never read or write the real developer's ~/.ddcs-bridge. Restores the real function on exit even
    if the test raises."""
    def __enter__(self):
        self.temp_home = tempfile.mkdtemp()
        self._orig = os.path.expanduser
        fake_home = self.temp_home

        def _fake(path):
            return fake_home if path == "~" else self._orig(path)
        os.path.expanduser = _fake
        return self.temp_home

    def __exit__(self, *exc):
        os.path.expanduser = self._orig
        shutil.rmtree(self.temp_home, ignore_errors=True)


class _CwdSwap:
    """Changes the REAL process cwd for the life of the block (simulating 'launched from this install
    folder') and restores it after, even on failure."""
    def __init__(self, path):
        self.path = path

    def __enter__(self):
        self._orig = os.getcwd()
        os.chdir(self.path)

    def __exit__(self, *exc):
        os.chdir(self._orig)


def test_stable_location_is_home_based_not_cwd_relative():
    """The SAME local_root resolves regardless of which folder the process was launched from — the fix's
    whole premise (today it is `./_bridge_data`, i.e. cwd-relative, which is exactly the landmine)."""
    with _HomeSwap() as home:
        install_a = tempfile.mkdtemp()
        install_b = tempfile.mkdtemp()
        try:
            with _CwdSwap(install_a):
                cfg_a = Config.from_env()
            with _CwdSwap(install_b):
                cfg_b = Config.from_env()

            expected = os.path.join(home, ".ddcs-bridge", "data")
            assert cfg_a.local_root == expected, cfg_a.local_root
            assert cfg_b.local_root == expected, cfg_b.local_root
            assert not cfg_a.local_root.startswith(install_a), "must not be cwd-relative to install A"
            assert not cfg_b.local_root.startswith(install_b), "must not be cwd-relative to install B"
        finally:
            shutil.rmtree(install_a, ignore_errors=True)
            shutil.rmtree(install_b, ignore_errors=True)


def test_user_can_find_and_back_it_up():
    """Not just durable — DISCOVERABLE: directly under the user's own home folder (matching config.json /
    fairy.log / install_id's existing convention), not buried inside AppData or a hidden temp path."""
    with _HomeSwap() as home:
        path = Config.default_local_root()
        assert os.path.dirname(path) == os.path.join(home, ".ddcs-bridge"), path
        assert os.path.dirname(os.path.dirname(path)) == home, path


def test_reinstall_to_a_new_folder_actually_survives_it():
    """THE PROOF, not the reasoning: write a real history record while 'installed' at A, delete A entirely
    (a full reinstall wipes the old folder), 'reinstall' at a fresh B, and read it back."""
    with _HomeSwap():
        install_a = tempfile.mkdtemp()
        install_b = tempfile.mkdtemp()
        try:
            with _CwdSwap(install_a):
                cfg_a = Config.from_env()
                backend_a = LocalFolderBackend(cfg_a.local_root)
                backend_a.append_history({"jobId": "J-SURVIVES", "final_state": "done", "duration_s": 77,
                                           "recorded_at": "2026-08-16T00:00:00"})
            shutil.rmtree(install_a, ignore_errors=True)   # the reinstall: the OLD folder is gone

            with _CwdSwap(install_b):
                cfg_b = Config.from_env()
                backend_b = LocalFolderBackend(cfg_b.local_root)
                hist = backend_b.list_history()

            assert any(r["jobId"] == "J-SURVIVES" for r in hist), hist
        finally:
            shutil.rmtree(install_b, ignore_errors=True)


def test_legacy_bridge_data_migrates_forward_once_idempotently():
    """The old cwd-relative `./_bridge_data` (whatever a PRE-t2022 build left beside the install folder)
    is ported into the new stable root automatically on the next startup, exactly once — a second startup
    (or a fresh write already at the new location) is never clobbered by the stale legacy copy."""
    with _HomeSwap():
        install_a = tempfile.mkdtemp()
        try:
            with _CwdSwap(install_a):
                legacy_hist_dir = os.path.join(install_a, "_bridge_data", "history")
                os.makedirs(legacy_hist_dir, exist_ok=True)
                legacy_record = {"jobId": "J-LEGACY", "final_state": "done", "duration_s": 42,
                                  "recorded_at": "2026-08-01T00:00:00"}
                with open(os.path.join(legacy_hist_dir, "J-LEGACY.json"), "w", encoding="utf-8") as f:
                    json.dump(legacy_record, f)

                cfg = Config.from_env()   # migration fires here, inside from_env, automatically
                backend = LocalFolderBackend(cfg.local_root)
                hist = backend.list_history()
                assert any(r["jobId"] == "J-LEGACY" and r["duration_s"] == 42 for r in hist), hist

                # mutate the LEGACY file (simulating it still sitting there stale) and re-run startup —
                # the already-migrated destination copy must NOT be overwritten by the stale legacy one.
                with open(os.path.join(legacy_hist_dir, "J-LEGACY.json"), "w", encoding="utf-8") as f:
                    json.dump({**legacy_record, "duration_s": 999}, f)
                Config.from_env()
                hist2 = LocalFolderBackend(cfg.local_root).list_history()
                rec = next(r for r in hist2 if r["jobId"] == "J-LEGACY")
                assert rec["duration_s"] == 42, "a second startup must not re-copy/overwrite from a stale legacy file"
        finally:
            shutil.rmtree(install_a, ignore_errors=True)


def test_migrate_legacy_root_is_a_noop_with_nothing_to_migrate():
    """No legacy folder at all (a brand-new install, or one that never used the old default) -> 0 moved,
    no error, no directory created that wasn't asked for."""
    with _HomeSwap():
        install_a = tempfile.mkdtemp()
        new_root = tempfile.mkdtemp()
        try:
            with _CwdSwap(install_a):
                moved = migrate_legacy_root(new_root)
            assert moved == 0, moved
        finally:
            shutil.rmtree(install_a, ignore_errors=True)
            shutil.rmtree(new_root, ignore_errors=True)


if __name__ == "__main__":
    for name, fn in sorted((n, f) for n, f in globals().items() if n.startswith("test_") and callable(f)):
        fn()
        print("  ok  ", name)
    print("PASS -- local_root is home-anchored (not cwd-relative) regardless of which folder launched it; a "
          "full reinstall to a NEW folder (the old one deleted) still reads back a history record written "
          "under the old one; the pre-t2022 cwd-relative ./_bridge_data migrates forward exactly once and a "
          "stale legacy file never overwrites an already-migrated record on a later startup; and a launch "
          "with nothing to migrate is a clean no-op")
