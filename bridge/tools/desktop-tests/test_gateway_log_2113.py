"""
THE DESKTOP EXE'S LOG MUST ACTUALLY RECEIVE WHAT THE CONSOLE USED TO, AND STAY BOUNDED (t2113, BACKLOG #3).

BACKGROUND: build_fairy.ps1 has never passed --windowed, so PyInstaller defaults to a console build and a
black log window sits beside the app all session. Hiding it is NOT just adding --windowed: [poller]
delivery/stall lines, a failed serial probe, the startup line naming backend+dest are all load-bearing
diagnostics, and on a frozen windowed build a bare print() can RAISE when sys.stdout is None (the exact
class of hazard t2103 already found once, in a print() containing one non-ASCII character). fairy_gateway.py
already tees stdout/stderr to a log file for this reason (_Tee) — what was missing, and what this file
proves, is (a) the tee'd file never grows without bound and (b) the tee genuinely survives the SAME
console-encoding hazard t2103 hit, not just a config check.

⚠ NOTE ON THE EXISTING bridge/tools/desktop-tests/test_webview_storage.py: its own path math is currently
broken (ModuleNotFoundError: No module named 'fairy' when run standalone) — NOT touched here (out of this
turn's scope), but the breakage is real and worth fixing separately. This file's path math is verified to
actually resolve (see the two assert-isdir sanity checks below) rather than copied from that pattern.

Run standalone:  python bridge/tools/desktop-tests/test_gateway_log_2113.py
"""
import importlib
import os
import shutil
import sys
import tempfile

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(_HERE)))   # desktop-tests -> tools -> bridge -> repo root
assert os.path.isdir(os.path.join(_ROOT, "desktop")), f"path math is wrong: {_ROOT}"
assert os.path.isdir(os.path.join(_ROOT, "bridge", "bridge-app")), f"path math is wrong: {_ROOT}"
sys.path.insert(0, os.path.join(_ROOT, "desktop"))
sys.path.insert(0, os.path.join(_ROOT, "bridge", "bridge-app"))


def _fresh_gateway_module(home):
    """Import fairy_gateway with HOME pointed at a scratch dir, so LOG_PATH resolves under it instead of
    the real user's ~/.ddcs-bridge — LOG_PATH is computed at module-import time, so HOME must be set BEFORE
    the (possibly cached) import happens. Returns the freshly (re)imported module."""
    old_home, old_userprofile = os.environ.get("HOME"), os.environ.get("USERPROFILE")
    os.environ["HOME"] = home
    os.environ["USERPROFILE"] = home   # os.path.expanduser("~") on Windows reads USERPROFILE, not HOME
    try:
        sys.modules.pop("fairy_gateway", None)
        return importlib.import_module("fairy_gateway")
    finally:
        for k, v in (("HOME", old_home), ("USERPROFILE", old_userprofile)):
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v


# ── the actual property: real app output really lands in the file ──────────────────────────────────────────

def test_the_log_file_receives_the_startup_line_and_real_poller_output():
    """⭐ Drives the REAL self_test() (the same one the bridge-app pytest gate runs), which emits genuine
    [poller] delivered / [poller] DELIVERY FAILED lines exactly as they'd appear on a real bench run — not a
    simulated print(). Asserts the startup banner AND both of those real lines land in the log file."""
    tmp = tempfile.mkdtemp()
    try:
        fg = _fresh_gateway_module(tmp)
        old_out, old_err = sys.stdout, sys.stderr
        try:
            log_path = fg._setup_logging()
            assert log_path == fg.LOG_PATH
            from fairy.bridge import self_test
            try:
                self_test()   # exercises real poller/delivery code paths via print(); the HTTP smoke test
            except Exception:  # at the end may 403 (pre-existing, unrelated to t2113) -- irrelevant here,
                pass            # everything printed BEFORE that point has already reached the file.
        finally:
            sys.stdout, sys.stderr = old_out, old_err
        assert os.path.exists(log_path), "the log file must exist after a run"
        content = open(log_path, encoding="utf-8").read()
        assert "=== fairy gateway started" in content, "the startup banner must reach the file"
        assert "[poller] delivered" in content, "a real delivery line must reach the file"
        assert "[poller] DELIVERY FAILED" in content, "a real failure line must reach the file"
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_a_console_write_failure_never_blocks_the_file_or_raises():
    """⭐ THE t2103 hazard, reproduced directly: a 'console' stream that raises on write (exactly what a
    cp1252 console does on a non-ASCII character, and exactly what sys.stdout being None would do if a
    caller ever wrote straight to it) must not stop the SAME line from reaching the log file, and must not
    raise out of print() at all."""
    tmp = tempfile.mkdtemp()
    try:
        fg = _fresh_gateway_module(tmp)
        old_out, old_err = sys.stdout, sys.stderr
        try:
            fg._setup_logging()

            class _BoomConsole:
                def write(self, data):
                    raise UnicodeEncodeError("cp1252", data, 0, 1, "simulated console encoding failure")

                def flush(self):
                    pass

            rotating = sys.stdout.streams[-1]           # the _RotatingLogFile half of the tee we just made
            sys.stdout = fg._Tee(_BoomConsole(), rotating)
            print("[poller] a line with a hazardous character: ⚠ must not raise")   # must not raise
        finally:
            sys.stdout, sys.stderr = old_out, old_err
        content = open(fg.LOG_PATH, encoding="utf-8").read()
        assert "must not raise" in content, "the file must still receive the line despite the console failing"
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_log_open_failure_never_raises_either():
    """The file-open half of the same hazard: an unwritable log directory must degrade to 'no file logging
    this run', never crash boot before the window can even open."""
    tmp = tempfile.mkdtemp()
    try:
        fg = _fresh_gateway_module(tmp)
        bogus = os.path.join(tmp, "not_a_dir.txt")
        open(bogus, "w").close()
        blocked_path = os.path.join(bogus, "gateway.log")   # can't mkdir a directory THROUGH an existing file
        r = fg._RotatingLogFile(blocked_path)   # must not raise
        r.write("this must not raise either\n")   # must not raise even though _f is None
        assert r._f is None
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


# ── rotation: the file cannot grow without bound ────────────────────────────────────────────────────────────

def test_the_log_rotates_once_it_crosses_the_size_cap_and_no_data_is_lost():
    tmp = tempfile.mkdtemp()
    try:
        fg = _fresh_gateway_module(tmp)
        path = os.path.join(tmp, "rotate-test.log")
        r = fg._RotatingLogFile(path, max_bytes=1000, backups=2)
        line = "x" * 100 + "\n"
        for i in range(15):                      # 15 * 101 bytes > 1000 -> at least one rotation must occur
            r.write(f"{i:03d} {line}")
        assert os.path.exists(f"{path}.1"), "a rotation must have happened"
        live_size = os.path.getsize(path) if os.path.exists(path) else 0
        assert live_size < 1000, "the live file must be small again right after rotating, not still growing"
        # no silent data loss: the two most recent lines (written after the last rotation) must be
        # somewhere retrievable — either still in the live file or in the most recent backup.
        combined = ""
        for p in (path, f"{path}.1", f"{path}.2"):
            if os.path.exists(p):
                combined += open(p, encoding="utf-8").read()
        assert "014 " in combined, "the very last line written must not have been silently dropped"
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_rotation_caps_the_backup_count_oldest_dropped():
    tmp = tempfile.mkdtemp()
    try:
        fg = _fresh_gateway_module(tmp)
        path = os.path.join(tmp, "rotate-cap-test.log")
        r = fg._RotatingLogFile(path, max_bytes=200, backups=2)
        for i in range(80):                      # force many rotations
            r.write(f"{i:04d} {'y' * 50}\n")
        assert not os.path.exists(f"{path}.3"), "must never keep more than `backups` old files"
        assert os.path.exists(f"{path}.2"), "the configured number of backups must actually be kept"
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


# ── the path is declared once, not duplicated ───────────────────────────────────────────────────────────────

def test_gateway_log_path_matches_config_default_log_path():
    """fairy_gateway.py's LOG_PATH and Ops.open_log() (via Config.default_log_path) must compute the exact
    SAME path — otherwise Setup's 'view log' affordance could point at a file that was never written."""
    tmp = tempfile.mkdtemp()
    try:
        fg = _fresh_gateway_module(tmp)
        from fairy.config import Config
        old_home, old_userprofile = os.environ.get("HOME"), os.environ.get("USERPROFILE")
        os.environ["HOME"] = tmp
        os.environ["USERPROFILE"] = tmp
        try:
            assert fg.LOG_PATH == Config.default_log_path()
        finally:
            for k, v in (("HOME", old_home), ("USERPROFILE", old_userprofile)):
                if v is None:
                    os.environ.pop(k, None)
                else:
                    os.environ[k] = v
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    for name, fn in sorted((n, f) for n, f in globals().items()
                           if n.startswith("test_") and callable(f)):
        fn()
        print("  ok  ", name)
    print("PASS — the desktop exe's log file receives real app output, survives a console write failure "
          "and an unwritable log directory without raising, rotates before growing without bound, and "
          "shares ONE declared path with Ops.open_log.")
