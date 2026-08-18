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

HERE = os.path.dirname(os.path.abspath(__file__))
# t2075 — was `dirname(dirname(file))` + "bridge/bridge-app", which resolves to .../bridge/tools/bridge/bridge-app
# for this file's actual location (bridge/tools/desktop-tests/) — never existed, so this test could never import
# and has apparently never run since it landed here. Two levels up from desktop-tests IS bridge/; bridge-app sits
# directly inside it.
sys.path.insert(0, os.path.join(HERE, "..", "..", "bridge-app"))

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



def test_the_resolver_picks_the_versioned_exe_and_ignores_unrelated_assets():
    """t1263 — assets are version-named now, so the updater matches a PATTERN. It must not grab just any .exe."""
    assets = {
        "DDCS-Studio-v2026.07.27.1.exe": "http://x/app",
        "DDCS-Studio-v2026.07.27.1.exe.sha256": "http://x/app.sha",
        "SourceCode.zip": "http://x/src",
        "benchgateway.exe": "http://x/other-tool",          # an .exe that is NOT the app
        "release-notes.txt": "http://x/notes",
    }
    got = su.pick_assets(assets)
    assert got["exe_name"] == "DDCS-Studio-v2026.07.27.1.exe", got
    assert got["exe_url"] == "http://x/app"
    assert got["sha_url"] == "http://x/app.sha", "paired to ITS checksum, by exact name"


def test_the_resolver_pairs_a_checksum_to_its_own_binary_only():
    """A stray .sha256 must never be attached to a different exe — that would verify the wrong thing."""
    assets = {
        "DDCS-Studio-v1.exe": "http://x/v1",
        "DDCS-Studio-v2.exe": "http://x/v2",
        "DDCS-Studio-v2.exe.sha256": "http://x/v2.sha",
    }
    got = su.pick_assets(assets)
    assert got["exe_name"] == "DDCS-Studio-v2.exe", "the one that HAS a checksum wins"
    assert got["sha_url"] == "http://x/v2.sha"


def test_an_exe_with_no_checksum_is_reported_as_unverifiable_not_as_missing():
    got = su.pick_assets({"DDCS-Studio-v9.exe": "http://x/v9"})
    assert got["exe_url"] == "http://x/v9", "the download EXISTS…"
    assert got["sha_url"] == "", "…but cannot be verified, which is a different refusal"


def test_a_release_with_no_app_asset_at_all():
    got = su.pick_assets({"notes.txt": "http://x/n", "other.exe": "http://x/o"})
    assert got["exe_url"] == "" and got["sha_url"] == ""


def test_the_versioned_checksum_line_still_parses():
    """CI writes `<hex>  DDCS-Studio-<tag>.exe` now — the name changed, the hex is what we read."""
    digest = "a" * 64
    assert su.parse_sha256(f"{digest}  DDCS-Studio-v2026.07.27.1.exe" + chr(10)) == digest
    assert su.parse_sha256(f"{digest} *DDCS-Studio-v2026.07.27.1.exe" + chr(13) + chr(10)) == digest, "the binary-mode marker too"


def test_the_swap_keeps_the_users_filename_even_though_the_asset_is_versioned():
    """t1263 — shortcuts and pins point at the user's path; an update must not rename their file."""
    d, target = _tmp()
    try:
        renamed = os.path.join(d, "MyShopApp.exe")       # the user renamed it; the asset is DDCS-Studio-v….exe
        os.rename(target, renamed)
        good = b"NEW-APP-BYTES"
        digest = hashlib.sha256(good).hexdigest()

        def fetch(url, timeout=30):
            if url == su.API_LATEST:
                return json.dumps({"tag_name": "v9.9.9", "assets": [
                    {"name": "DDCS-Studio-v9.9.9.exe", "browser_download_url": "http://x/exe"},
                    {"name": "DDCS-Studio-v9.9.9.exe.sha256", "browser_download_url": "http://x/sha"},
                ]}).encode()
            return good if url.endswith("/exe") else (f"{digest}  DDCS-Studio-v9.9.9.exe" + chr(10)).encode()

        su.is_frozen = lambda: True
        su.exe_path = lambda: renamed
        r = su.perform_update(fetch=fetch, relaunch=False)

        assert r["ok"] is True, r
        assert open(renamed, "rb").read() == good, "the new build is at the USER'S path and name"
        assert not os.path.exists(os.path.join(d, "DDCS-Studio-v9.9.9.exe")), "no versioned duplicate appears"
        assert os.path.isfile(renamed + su.OLD_SUFFIX), "their previous build is beside it"
    finally:
        shutil.rmtree(d, ignore_errors=True)


# ── t2075 — RELAUNCH, PROVEN AND VERIFIED ─────────────────────────────────────────────────────────────────────────
# The live bug: subprocess.Popen([target]) with no env= hands a PyInstaller onefile child the PARENT's own
# _PYI_*/_MEIPASS2 bootloader vars; the child concludes it is already unpacked and dies near-instantly, and
# Popen() never raises — so perform_update() reported relaunched:True with nothing actually alive. These tests
# spawn REAL subprocesses (the current Python interpreter running a tiny inline script) to prove _relaunch's own
# crash-detection and env-scrub are correct. HONESTLY SCOPED: this proves the MECHANISM works against a process
# that behaves the way the diagnosed PyInstaller bug behaves (exits immediately vs. survives) — it does NOT and
# CANNOT prove the actual frozen DDCS-Studio.exe relaunches cleanly; only a real built exe can confirm that.
def test_relaunch_reports_success_once_the_child_survives_the_confirm_window():
    d, target = _tmp()
    try:
        # a script that behaves like a HEALTHY app: it does not exit within the confirm window
        script = os.path.join(d, "survives.py")
        open(script, "w", encoding="utf-8").write("import time\ntime.sleep(5)\n")
        r = su._relaunch([sys.executable, script], confirm_s=0.5)
        assert r == {"relaunched": True}, r
    finally:
        shutil.rmtree(d, ignore_errors=True)


def test_relaunch_names_the_reason_when_the_child_dies_in_the_proven_crash_window():
    d, target = _tmp()
    try:
        # a script that behaves EXACTLY like the diagnosed PyInstaller bootloader crash: exits near-instantly
        script = os.path.join(d, "crashes.py")
        open(script, "w", encoding="utf-8").write("import sys\nsys.exit(3)\n")
        r = su._relaunch([sys.executable, script], confirm_s=2.0)
        assert r["relaunched"] is False, r
        assert "3" in r["error"], f"the exit code is named, not swallowed: {r['error']}"
    finally:
        shutil.rmtree(d, ignore_errors=True)


def test_relaunch_names_the_reason_when_popen_itself_fails():
    r = su._relaunch([os.path.join(tempfile.mkdtemp(prefix="ddcs-upd-test-"), "does-not-exist.exe")])
    assert r["relaunched"] is False, r
    assert r.get("error"), "a Popen failure (missing file, no permission, ...) must still be a NAMED reason"


def test_clean_env_strips_the_pyinstaller_bootloader_vars_and_nothing_else():
    """The proven poison: _MEIPASS2 (the parent's onefile extraction dir) and any _PYI* bootloader var. Everything
    else in the environment must survive untouched — this must not become a general environment wipe."""
    real_environ = dict(os.environ)
    try:
        os.environ["_MEIPASS2"] = r"C:\Users\x\AppData\Local\Temp\_MEI123456"
        os.environ["_PYI_APPLICATION_HOME_DIR"] = r"C:\Users\x\AppData\Local\Temp\_MEI123456"
        os.environ["DDCS_UNRELATED_VAR"] = "kept"
        cleaned = su._clean_env()
        assert "_MEIPASS2" not in cleaned, cleaned.get("_MEIPASS2")
        assert "_PYI_APPLICATION_HOME_DIR" not in cleaned
        assert cleaned.get("DDCS_UNRELATED_VAR") == "kept", "only the PyInstaller bootloader vars are stripped"
        assert cleaned.get("PATH") == os.environ.get("PATH"), "an ordinary var must pass through unchanged"
    finally:
        os.environ.clear()
        os.environ.update(real_environ)


def test_relaunch_actually_launches_the_child_without_the_poisoned_vars():
    """Not just that _clean_env() strips them in isolation — that the CHILD PROCESS Popen actually starts with
    them gone. A child that can still see _MEIPASS2 would hit the exact bug this fix exists to close."""
    d, target = _tmp()
    real_environ = dict(os.environ)
    try:
        os.environ["_MEIPASS2"] = r"C:\poisoned"
        marker = os.path.join(d, "meipass2_seen.txt")
        script = os.path.join(d, "check_env.py")
        open(script, "w", encoding="utf-8").write(
            "import os\n"
            f"open({marker!r}, 'w').write(os.environ.get('_MEIPASS2', 'ABSENT'))\n"
        )
        r = su._relaunch([sys.executable, script], confirm_s=0.5)
        # the child exits almost instantly (it does nothing else) -- that alone is not a failure signal for
        # this test, which only cares whether the child's OWN environment was clean; poll briefly for the marker
        for _ in range(20):
            if os.path.exists(marker):
                break
            time.sleep(0.1)
        assert os.path.exists(marker), "the child never ran"
        assert open(marker, encoding="utf-8").read() == "ABSENT", "the child must not see the parent's _MEIPASS2"
    finally:
        os.environ.clear()
        os.environ.update(real_environ)
        shutil.rmtree(d, ignore_errors=True)


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"  ok  {name}")
    print("PASS — the updater verifies before it touches anything, and a failure leaves the app intact.")
