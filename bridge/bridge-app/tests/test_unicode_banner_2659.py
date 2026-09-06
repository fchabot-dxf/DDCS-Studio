"""
UNICODE BANNER — the gateway must survive its own startup print on a non-UTF-8 console (t2659, BACKLOG #81).

The symptom, reproduced live three times (dispatch's own words: "a piped cp1252 console"): run
`fairy.bridge run` under a non-UTF-8 console and the process DIES on its own first startup line
("[bridge] up — backend=...", an em dash) with an uncaught UnicodeEncodeError.

⚠ CORRECTION, measured while writing this test: cp1252 (Windows' ANSI/GUI codepage) actually ENCODES an em
dash fine (byte 0x97 — Western-European codepages keep it in their 0x80-0x9F extended range). The codepage
that genuinely fails is cp437 — the classic DOS/OEM codepage a raw `cmd.exe` window defaults to (a DIFFERENT
codepage from cp1252 despite both being "the Windows default" in casual speech) — confirmed directly:
`'—'.encode('cp437')` raises, `'—'.encode('cp1252')` does not. Since `START_GATEWAY.bat` runs in
`cmd.exe`, cp437 is the actually-relevant one; the dispatch's "cp1252" was the imprecise part, not the bug.

t2103 already hit and patched ONE line this way (the role-conflict WARNING, made plain ASCII — cp1252 lacks
the ⚠ WARNING SIGN, a real cp1252 gap unlike the em dash) — but a SECOND line (this one, under cp437) crashed
the same way later, proving the per-line ASCII-patch approach does not generalize: every future non-ASCII
print is an unpatched landmine. The fix here is at the ENTRYPOINT instead (fairy.bridge.main's own
sys.stdout/stderr.reconfigure(encoding="utf-8")) — one place, protects every print in the process against
every codepage this class of bug can come from, including ones not yet written.

Spawns a REAL subprocess with PYTHONIOENCODING=cp437 forced (simulating the reported console) and checks
the gateway is still alive a moment later, rather than mocking the encoding path. Non-vacuity: reverting the
fix reproduces the crash — see WORK-LOG t2659.

Run standalone:  python bridge/bridge-app/tests/test_unicode_banner_2659.py
"""
import os
import subprocess
import sys
import tempfile
import time

_HERE = os.path.dirname(os.path.abspath(__file__))
_BRIDGE_APP = os.path.dirname(_HERE)


def _spawn_run(env_encoding="cp437"):
    """Start `fairy.bridge run` (local backend, no --serve, so no port binding) under a forced console
    encoding, and return the live Popen — the caller decides how long to let it run before checking."""
    root = tempfile.mkdtemp(prefix="fairy_unicode_test_")
    env = dict(os.environ)
    env["PYTHONIOENCODING"] = env_encoding
    env.pop("PYTHONUTF8", None)   # don't let an already-UTF-8-forced test host mask the reproduction
    return subprocess.Popen(
        [sys.executable, "-m", "fairy.bridge", "run", "--backend", "local", "--root", root, "--dest", root, "--poll", "60"],
        cwd=_BRIDGE_APP, env=env,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding=env_encoding, errors="replace",
    )


def test_the_startup_banner_survives_a_cp437_console():
    p = _spawn_run("cp437")
    try:
        time.sleep(2.0)
        alive = p.poll() is None
        if not alive:
            out, err = p.communicate(timeout=2)
            assert alive, f"gateway died on startup under a forced cp437 console.\nSTDOUT:\n{out}\nSTDERR:\n{err}"
    finally:
        p.terminate()
        try:
            p.wait(timeout=5)
        except subprocess.TimeoutExpired:
            p.kill()


if __name__ == "__main__":
    test_the_startup_banner_survives_a_cp437_console()
    print("PASS")
