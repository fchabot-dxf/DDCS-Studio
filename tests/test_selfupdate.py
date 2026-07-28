"""
THE SELF-REPLACING UPDATER (t1261) — unit-test the parts that can destroy an installation.

The dangerous half of a self-update is not the download, it is the SWAP: on Windows a running exe can be renamed but
not overwritten, so the update renames the running file out of the way and moves the new one into its exact path. Get
the order wrong and a failed update leaves the user with no application at all.

So these tests are about ORDER and FAILURE, against real temp files:
  - a corrupted byte fails the checksum and NOTHING is touched
  - the swap puts the new file at the exact target path and keeps the original as .old.exe
  - if the move fails after the rename, the ORIGINAL IS PUT BACK
  - the boot sweep removes .old.exe and leaves everything else alone

Run standalone:  python tests/test_selfupdate.py
(Plain asserts + a PASS print, matching tests/test_pull_geometry.py.)
"""
import hashlib
import json
import os
import shutil
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "bridge", "bridge-app"))

from fairy import selfupdate as su   # noqa: E402


def _tmp():
    d = tempfile.mkdtemp(prefix="ddcs-upd-test-")
    target = os.path.join(d, "DDCS-Studio.exe")
    with open(target, "wb") as f:
        f.write(b"ORIGINAL-APP")
    return d, target


def test_hash_helpers_read_both_checksum_formats():
    d, target = _tmp()
    try:
        want = hashlib.sha256(b"ORIGINAL-APP").hexdigest()
        assert su.sha256_file(target) == want
        assert su.parse_sha256(want) == want, "a bare digest"
        assert su.parse_sha256(f"{want}  DDCS-Studio.exe\n") == want, "the shasum format CI writes"
        assert su.parse_sha256("not a checksum at all") == "", "unrecognisable → empty, never a wrong digest"
    finally:
        shutil.rmtree(d, ignore_errors=True)


def test_a_corrupted_download_is_rejected_and_nothing_is_touched():
    """The whole point of the checksum: one flipped byte must stop the update BEFORE anything is renamed."""
    d, target = _tmp()
    try:
        good = b"NEW-APP-BYTES"
        digest = hashlib.sha256(good).hexdigest()
        corrupted = b"NEW-APP-BYTEZ"   # one byte different

        def fetch(url, timeout=30):
            if url == su.API_LATEST:
                return json.dumps({"tag_name": "v9.9.9", "assets": [
                    {"name": "DDCS-Studio.exe", "browser_download_url": "http://x/exe"},
                    {"name": "DDCS-Studio.exe.sha256", "browser_download_url": "http://x/sha"},
                ]}).encode()
            if url.endswith("/exe"):
                return corrupted
            return f"{digest}  DDCS-Studio.exe\n".encode()

        su.is_frozen = lambda: True          # pretend we are the exe
        su.exe_path = lambda: target
        r = su.perform_update(fetch=fetch, relaunch=False)

        assert r["ok"] is False
        assert "checksum" in r["error"], f"the refusal names the reason: {r['error']}"
        assert r.get("page"), "and offers the release page instead"
        assert open(target, "rb").read() == b"ORIGINAL-APP", "the running app is untouched"
        assert not os.path.exists(target + ".new.exe"), "the bad download is cleaned up"
        assert not os.path.exists(target + su.OLD_SUFFIX), "nothing was renamed"
    finally:
        shutil.rmtree(d, ignore_errors=True)


def test_a_verified_download_swaps_in_and_keeps_the_original_as_old():
    d, target = _tmp()
    try:
        good = b"NEW-APP-BYTES"
        digest = hashlib.sha256(good).hexdigest()

        def fetch(url, timeout=30):
            if url == su.API_LATEST:
                return json.dumps({"tag_name": "v9.9.9", "assets": [
                    {"name": "DDCS-Studio.exe", "browser_download_url": "http://x/exe"},
                    {"name": "DDCS-Studio.exe.sha256", "browser_download_url": "http://x/sha"},
                ]}).encode()
            return good if url.endswith("/exe") else f"{digest}\n".encode()

        su.is_frozen = lambda: True
        su.exe_path = lambda: target
        r = su.perform_update(fetch=fetch, relaunch=False)

        assert r["ok"] is True, r
        assert open(target, "rb").read() == good, "the new build is at the EXACT path the old one had"
        assert open(target + su.OLD_SUFFIX, "rb").read() == b"ORIGINAL-APP", "the previous build is kept, not deleted"
        assert not os.path.exists(target + ".new.exe"), "no staging file left behind"
    finally:
        shutil.rmtree(d, ignore_errors=True)


def test_a_release_with_no_published_checksum_refuses_rather_than_installing_blind():
    d, target = _tmp()
    try:
        def fetch(url, timeout=30):
            return json.dumps({"tag_name": "v9.9.9", "assets": [
                {"name": "DDCS-Studio.exe", "browser_download_url": "http://x/exe"}]}).encode()

        su.is_frozen = lambda: True
        su.exe_path = lambda: target
        r = su.perform_update(fetch=fetch, relaunch=False)
        assert r["ok"] is False and "checksum" in r["error"]
        assert open(target, "rb").read() == b"ORIGINAL-APP"
    finally:
        shutil.rmtree(d, ignore_errors=True)


def test_a_failed_move_puts_the_original_back():
    """The disaster case. If the new file cannot take the target path AFTER the rename, we must not be left with no app."""
    d, target = _tmp()
    try:
        new_file = target + ".new.exe"
        with open(new_file, "wb") as f:
            f.write(b"NEW-APP-BYTES")

        real_move = shutil.move
        shutil.move = lambda *a, **k: (_ for _ in ()).throw(OSError("simulated failure"))
        try:
            r = su.swap_in(new_file, target)
        finally:
            shutil.move = real_move

        assert r["ok"] is False
        assert "intact" in r["error"], f"the message says the original survived: {r['error']}"
        assert os.path.isfile(target), "THE APP STILL EXISTS at its own path"
        assert open(target, "rb").read() == b"ORIGINAL-APP", "and it is the original bytes"
        assert not os.path.exists(target + su.OLD_SUFFIX), "the .old was rolled back, not orphaned"
    finally:
        shutil.rmtree(d, ignore_errors=True)


def test_swap_refuses_when_the_new_file_is_missing():
    d, target = _tmp()
    try:
        r = su.swap_in(os.path.join(d, "nope.exe"), target)
        assert r["ok"] is False
        assert os.path.isfile(target), "and it did not rename anything first"
    finally:
        shutil.rmtree(d, ignore_errors=True)


def test_the_boot_sweep_removes_old_builds_and_nothing_else():
    d, target = _tmp()
    try:
        for name in ["DDCS-Studio.exe.old.exe", "benchgateway.exe.old.exe"]:
            open(os.path.join(d, name), "wb").write(b"x")
        keep = ["DDCS-Studio.exe", "config.json", "notes.old.txt"]
        open(os.path.join(d, "config.json"), "wb").write(b"{}")
        open(os.path.join(d, "notes.old.txt"), "wb").write(b"x")

        removed = su.sweep_old(d)
        assert sorted(removed) == ["DDCS-Studio.exe.old.exe", "benchgateway.exe.old.exe"], removed
        for k in keep:
            assert os.path.exists(os.path.join(d, k)), f"{k} must survive the sweep"
    finally:
        shutil.rmtree(d, ignore_errors=True)


def test_the_web_app_can_never_self_update():
    su.is_frozen = lambda: False
    r = su.perform_update(fetch=lambda *a, **k: b"{}", relaunch=False)
    assert r["ok"] is False and "desktop app" in r["error"]


def test_the_page_cannot_choose_what_gets_installed():
    """A structural guarantee, not a behaviour: perform_update takes no url, so a hostile page has nothing to aim."""
    import inspect
    params = set(inspect.signature(su.perform_update).parameters)
    assert params == {"fetch", "relaunch"}, f"no url/asset parameter may exist here, got {params}"
    src = inspect.getsource(su.perform_update)
    assert "latest_release(" in src, "the release is resolved from the hard-coded repo instead"


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"  ok  {name}")
    print("PASS — the updater verifies before it touches anything, and a failure leaves the app intact.")
