"""
THE DESKTOP APP MUST REMEMBER (t1259) — unit-test the storage policy the launchers share.

Background, because this bug survived a fix and a release: pywebview defaults to PRIVATE MODE, which discards
localStorage + IndexedDB when the window closes. In Studio that storage is the workspace buffer, the save watermark
and the File System Access handles for all three granted folders — so the app forgot everything on every restart.
t1257 fixed `bridge/bridge-app/desktop.py`; the shipped exe is built from `fairy_gateway.py`, which still called a
bare `webview.start()`. One policy, two launchers, one of them fixed.

What CANNOT be tested here is pywebview actually persisting to disk in a real window — that is the user's retest.
What CAN be tested is everything that went wrong: the arguments, the path's shape, and that both launchers defer to
the one helper instead of carrying their own copy. That is most of the bug.

Run standalone:  python tests/test_webview_storage.py
(Plain asserts + a PASS print, matching tests/test_pull_geometry.py — also importable as test_* for a runner.)
"""
import os
import sys
import types

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "bridge", "bridge-app"))

from fairy.webview_storage import storage_path, start_persistent   # noqa: E402


def test_path_is_per_user_stable_and_not_beside_the_app():
    p = storage_path()
    assert os.path.isdir(p), "storage_path creates the directory (pywebview will not)"
    assert "DDCS-Studio" in p and p.rstrip("\\/").endswith("webview"), f"unexpected shape: {p}"
    assert p == storage_path(), "the same directory every launch, or each run is a fresh amnesiac"
    # NOT beside the executable or the source tree: a PyInstaller onefile unpacks to temp (discarded on exit) and an
    # install-location path would make an app UPDATE look like a fresh install too.
    assert not os.path.abspath(p).startswith(os.path.abspath(ROOT)), f"must live in user app-data, got {p}"


def test_a_modern_pywebview_gets_persistence_on():
    seen = {}
    start_persistent(types.SimpleNamespace(start=lambda **kw: seen.update(kw)))
    assert seen.get("private_mode") is False, "private mode is what throws the workspace away"
    assert seen.get("storage_path") == storage_path()


def test_an_old_pywebview_still_launches_and_says_it_will_forget():
    class Old:
        def __init__(self):
            self.calls = []

        def start(self, **kw):
            if "private_mode" in kw or "storage_path" in kw:
                raise TypeError("start() got an unexpected keyword argument 'private_mode'")
            self.calls.append(kw)

    old = Old()
    start_persistent(old)   # prints a warning to stderr — refusing to launch would be worse than forgetting
    assert old.calls == [{}], "it must still start"


def test_extra_kwargs_pass_through():
    seen = {}
    start_persistent(types.SimpleNamespace(start=lambda **kw: seen.update(kw)), debug=True)
    assert seen.get("debug") is True


def test_both_launchers_defer_to_the_helper():
    """The actual root cause was TWO COPIES of the policy. Neither launcher may decide storage on its own again."""
    for rel in [("fairy_gateway.py",), ("bridge", "bridge-app", "desktop.py")]:
        path = os.path.join(ROOT, *rel)
        src = open(path, encoding="utf-8").read()
        assert "start_persistent(webview)" in src, f"{path} does not go through the shared helper"
        # a bare start() is the bug: it is what shipped, twice
        bare = [ln for ln in src.splitlines() if "webview.start(" in ln and "start_persistent" not in ln]
        assert not bare, f"{path} still calls webview.start() directly: {bare}"


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"  ok  {name}")
    print("PASS — the desktop app's storage policy is shared, persistent and per-user.")
