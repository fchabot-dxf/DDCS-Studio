#!/usr/bin/env python3
"""fairy_gateway.py — desktop entry for the CNC-FAIRY gateway (fairy.exe).

Starts the gateway HTTP server + poll loop in a background thread, then opens Studio
(served at /; the legacy fairy console stays at /fairy/ until COMBINED-APP-PLAN Step 5)
in a native pywebview window — no browser. Frozen-aware: when packaged by PyInstaller it
serves the bundled studio + console + shared/ assets from sys._MEIPASS; in dev it serves
them from the repo tree.

Build:      build_fairy.ps1   ->  ./fairy.exe
Run (dev):  python fairy_gateway.py            (boots to Setup; configure the
            controller disk there — it persists to ~/.ddcs-bridge/config.json)
Extra args pass straight through to the gateway, e.g.:
            python fairy_gateway.py --dest \\\\192.168.0.99\\CNCDISK --port COM6
"""
import datetime
import json
import os
import platform
import sys
import threading
import time
import urllib.request
import uuid

HERE = os.path.dirname(os.path.abspath(__file__))
HOST = "127.0.0.1"
# Port fallback: the exe binds the first FREE port in this range (so it still launches if 8765 is taken).
# ALL of these must be registered as Google OAuth "Authorized JavaScript origins" (http://127.0.0.1:<p>) so the
# in-app cloud login works whichever port it lands on. PORT is set at startup by _pick_port().
PORTS = [8765, 8766, 8767, 8768, 8769]
PORT = PORTS[0]
TITLE = "DDCS Studio"   # the desktop app = Studio UI + embedded gateway ("fairy" is just the gateway daemon inside)
LOG_PATH = os.path.join(os.path.expanduser("~"), ".ddcs-bridge", "fairy.log")


class _Tee:
    """Write to several streams at once (console + log file), tolerating None/closed streams."""
    def __init__(self, *streams):
        self.streams = [s for s in streams if s is not None]

    def write(self, data):
        for s in self.streams:
            try:
                s.write(data)
                s.flush()
            except Exception:
                pass

    def flush(self):
        for s in self.streams:
            try:
                s.flush()
            except Exception:
                pass


def _setup_logging():
    """Tee stdout/stderr to ~/.ddcs-bridge/fairy.log so the gateway's [bridge] lines are visible even
    though the pywebview window hides the console. Returns the log path (also exposed in the UI title)."""
    try:
        os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
        f = open(LOG_PATH, "a", buffering=1, encoding="utf-8")
        sys.stdout = _Tee(sys.__stdout__, f)
        sys.stderr = _Tee(sys.__stderr__, f)
        print(f"\n=== fairy gateway started {datetime.datetime.now():%Y-%m-%d %H:%M:%S} (pid {os.getpid()}) ===")
    except Exception as e:
        print(f"[fairy] could not open log file {LOG_PATH}: {e}", file=sys.stderr)
    return LOG_PATH


def _asset(name):
    """Resolve a bundled asset dir — from PyInstaller's _MEIPASS when frozen, else the repo tree."""
    base = getattr(sys, "_MEIPASS", None)
    if base:
        return os.path.join(base, name)
    return {
        "console": os.path.join(HERE, "bridge", "bridge-app", "web", "ui"),
        "studio": os.path.join(HERE, "DDCS-Studio", "web"),
        "shared": os.path.join(HERE, "DDCS-Studio", "web", "shared"),
    }[name]


# Anonymous launch beacon — the authoritative "exe was launched" signal (unique installs, OS, version).
# No PII; best-effort; never blocks or raises. The in-app web UI also reports visit/feature events via
# ui/analytics.js, but those depend on the page JS — this fires straight from Python. Matches the Worker
# in analytics/. Set ANALYTICS_URL to your deployed Worker URL; opt out with env DDCS_NO_ANALYTICS=1.
ANALYTICS_URL = "https://ddcs-analytics.dansemur.workers.dev/e"   # deployed Worker (see analytics/)


def _install_id():
    """Stable anonymous id for this install (random uuid in ~/.ddcs-bridge/install_id) — NOT a person."""
    p = os.path.join(os.path.expanduser("~"), ".ddcs-bridge", "install_id")
    try:
        if os.path.exists(p):
            return open(p, encoding="utf-8").read().strip()[:64]
        os.makedirs(os.path.dirname(p), exist_ok=True)
        new = uuid.uuid4().hex
        with open(p, "w", encoding="utf-8") as f:
            f.write(new)
        return new
    except Exception:
        return ""


def _studio_version():
    """Read the Studio version from the bundled index.html .ver chip (best-effort)."""
    try:
        import re
        html = open(os.path.join(_asset("studio"), "index.html"), encoding="utf-8").read()
        m = re.search(r'class="ver">V([0-9][0-9.]*)<', html)
        return m.group(1) if m else ""
    except Exception:
        return ""


def _beacon_launch():
    """POST one anonymous app_launch event. Swallows everything — analytics must never affect the app."""
    if "REPLACE-ME" in ANALYTICS_URL or os.environ.get("DDCS_NO_ANALYTICS") == "1":
        return
    try:
        # dev=1 for your own runs: a non-frozen run (python fairy_gateway.py) or env DDCS_DEV=1 — so your
        # testing across any PC is filterable out of the numbers. A released exe is frozen → counts as real.
        is_dev = (not getattr(sys, "frozen", False)) or os.environ.get("DDCS_DEV") == "1"
        body = json.dumps({
            "event": "app_launch", "app": "exe", "id": _install_id(),
            "version": _studio_version(),
            "os": f"{platform.system()} {platform.release()}".strip()[:32],
            "dev": 1 if is_dev else 0,
        }).encode("utf-8")
        req = urllib.request.Request(ANALYTICS_URL, data=body,
                                     headers={"content-type": "text/plain"}, method="POST")
        urllib.request.urlopen(req, timeout=4).close()
    except Exception:
        pass


def _run_gateway(user_args):
    """Run the blocking gateway (serve + poll loop) — invoked in a daemon thread."""
    if not getattr(sys, "frozen", False):
        sys.path.insert(0, os.path.join(HERE, "bridge", "bridge-app"))
    from fairy.bridge import main
    # No --host here: the bind address comes from Setup's persisted config (default 127.0.0.1;
    # "0.0.0.0" when the user enables LAN serving). The window still opens on 127.0.0.1 either way.
    argv = [
        "run", "--serve", "--backend", "local",
        "--http-port", str(PORT),
        "--console", _asset("console"), "--shared", _asset("shared"),
    ]
    # Studio at / (COMBINED-APP-PLAN Step 1); tolerate an older frozen build without the studio bundle.
    if os.path.isdir(_asset("studio")):
        argv += ["--studio", _asset("studio")]
    # Safe default: no serial slave unless the user wired it — avoids a COM-port open failure on a box
    # with no SABRENT. But respect a persisted Beacons=on (Setup), so the saved choice survives relaunch.
    forced_flags = any(a in user_args for a in ("--port", "--no-slave"))
    if not forced_flags and not _persisted_beacons_on():
        argv.append("--no-slave")
    argv += user_args
    main(argv)


def _persisted_beacons_on():
    """True if the saved Setup config has Beacons enabled — so we don't force --no-slave over it."""
    try:
        import json
        with open(os.path.join(os.path.expanduser("~"), ".ddcs-bridge", "config.json"), encoding="utf-8") as f:
            return bool(json.load(f).get("enable_slave"))
    except Exception:
        return False


def _wait_up(timeout=20):
    url = f"http://{HOST}:{PORT}/api/descriptor"
    end = time.time() + timeout
    while time.time() < end:
        try:
            urllib.request.urlopen(url, timeout=1).read()
            return True
        except Exception:
            time.sleep(0.25)
    return False


def _msgbox(text, yesno=False):
    """Native Windows message box (visible even with no console). Returns True for OK/Yes."""
    try:
        import ctypes
        MB_ICONINFORMATION, MB_YESNO_WARN, IDYES, IDOK = 0x40, 0x4 | 0x30, 6, 1
        r = ctypes.windll.user32.MessageBoxW(None, text, TITLE, MB_YESNO_WARN if yesno else MB_ICONINFORMATION)
        return r == (IDYES if yesno else IDOK)
    except Exception:
        print(f"[fairy] {text}")
        return True


def _gateway_answering(port=None, timeout=0.8):
    """True if a DDCS gateway already answers on <port> (default PORT) — a second copy must not start."""
    try:
        with urllib.request.urlopen(f"http://{HOST}:{port or PORT}/api/descriptor", timeout=timeout) as r:
            return r.status == 200
    except Exception:
        return False


def _port_free(port):
    """True if we can bind <port> on HOST right now (i.e. it's free for our server)."""
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind((HOST, port))
        return True
    except OSError:
        return False
    finally:
        s.close()


def _preferred_port():
    """A user-chosen port from ~/.ddcs-bridge/config.json ("port"), honored only if it's one of our registered
    PORTS (so OAuth's JS-origin list still covers it). Lets users pick which port the exe serves on."""
    try:
        import json
        with open(os.path.join(os.path.expanduser("~"), ".ddcs-bridge", "config.json"), encoding="utf-8") as f:
            p = json.load(f).get("port")
        return p if p in PORTS else None
    except Exception:
        return None


def _pick_port():
    """Single-instance + port fallback, honoring the user's chosen port first. If a DDCS gateway already answers
    on a candidate, reuse-detect it (don't start a second). Otherwise bind the first FREE candidate, trying the
    user's preferred port ahead of the rest. Returns (port, already_running)."""
    pref = _preferred_port()
    order = ([pref] if pref else []) + [p for p in PORTS if p != pref]
    for p in order:
        if _gateway_answering(p):
            return p, True
    for p in order:
        if _port_free(p):
            return p, False
    return order[0], False   # none free — binding will fail and report below


def _tracking_active():
    """True if a job is being tracked right now (queue has running/delivered/stalled items)."""
    try:
        import json
        with urllib.request.urlopen(f"http://{HOST}:{PORT}/api/queue", timeout=2) as r:
            items = json.load(r)
        return any(i.get("state") in ("running", "delivered", "stalled") for i in items)
    except Exception:
        return False


def _shutdown_other(port):
    """Force-close whatever is LISTENING on <port> so this instance can take it over. Forceful (taskkill):
    job state is durable and the OS reclaims the COM port on exit. Windows-only; best-effort, never raises.
    Returns True once the port is actually free."""
    import subprocess
    pids = set()
    try:
        out = subprocess.run(["netstat", "-ano", "-p", "tcp"], capture_output=True, text=True, timeout=5).stdout
        for line in out.splitlines():
            parts = line.split()
            if (len(parts) >= 5 and parts[0].upper() in ("TCP", "TCP6")
                    and parts[1].endswith(f":{port}") and parts[3].upper() == "LISTENING"):
                pids.add(parts[4])
    except Exception:
        return _port_free(port)
    for pid in pids:
        try:
            subprocess.run(["taskkill", "/PID", pid, "/F"], capture_output=True, timeout=5)
        except Exception:
            pass
    for _ in range(25):                 # wait up to ~5s for the OS to release the socket
        if _port_free(port):
            return True
        time.sleep(0.2)
    return _port_free(port)


def main():
    _setup_logging()
    # Single-instance lock + port fallback (COMBINED-APP-PLAN Step 4): two gateways would double-bind the HTTP
    # port and fight over the serial COM port — refuse politely. If 8765 is taken by something else, fall back
    # to the next free port in PORTS.
    global PORT
    PORT, already_running = _pick_port()
    if already_running:
        # Default = TAKE OVER the port (close the other instance, start here). A stale/forgotten/orphaned
        # gateway is replaced seamlessly: job state is durable on disk and Studio state persists, so the new
        # window comes back to the same place. The ONLY thing unsafe to interrupt is a file TRANSFER to the
        # controller (mid-write could deliver a partial .nc) — so we ASK FIRST only when a job is in flight.
        if _tracking_active():
            if not _msgbox(f"DDCS Studio is already running on port {PORT} and a job is in flight.\n\n"
                           "Taking over now could interrupt a file transfer to the controller. "
                           "Close it and take over anyway?", yesno=True):
                print(f"[fairy] another instance on :{PORT} is busy — left running, exiting.")
                return
        print(f"[fairy] taking over :{PORT} — closing the other instance…")
        if not _shutdown_other(PORT):
            _msgbox(f"Couldn't free port {PORT}. Close the other DDCS Studio window manually, then relaunch.")
            print(f"[fairy] :{PORT} still in use after take-over — exiting.")
            return
        PORT, _ = _pick_port()   # port is free now — bind it and start normally below
    print(f"[fairy] serving on http://{HOST}:{PORT}")
    user_args = sys.argv[1:]
    threading.Thread(target=_run_gateway, args=(user_args,), daemon=True).start()
    threading.Thread(target=_beacon_launch, daemon=True).start()   # anonymous launch beacon (best-effort)
    if not _wait_up():
        print("[fairy] gateway did not start — see the log above.", file=sys.stderr)
    url = f"http://{HOST}:{PORT}/"
    try:
        import webview
        window = webview.create_window(TITLE, url, width=1180, height=820, min_size=(900, 600))

        def on_closing():
            # Window close = full shutdown (chosen lifecycle, COMBINED-APP-PLAN). The machine keeps
            # running its job regardless (the bridge is push-only) — but tracking, the queue and LAN
            # serving stop with this window, so confirm when a job is live.
            if _tracking_active():
                return _msgbox("A job is still being tracked.\n\n"
                               "The machine keeps running either way, but tracking and LAN serving "
                               "stop when this window closes.\n\nClose anyway?", yesno=True)
            return True

        try:
            window.events.closing += on_closing
        except Exception as e:
            print(f"[fairy] close-confirm unavailable ({e}); window closes without asking.")
        # t1259 — STORAGE MUST SURVIVE THE WINDOW CLOSING. pywebview defaults to private mode, which discards
        # localStorage + IndexedDB on exit — and here that is the workspace buffer, the save watermark and the File
        # System Access handles for all three granted folders. The policy lives in ONE place (fairy.webview_storage)
        # because it was previously fixed in the OTHER launcher and the shipped exe, built from THIS file, kept
        # forgetting. See that module for where the data goes and why it is not beside the executable.
        from fairy.webview_storage import start_persistent
        start_persistent(webview)             # blocks until the window closes
        print("[fairy] window closed — gateway down.")
        os._exit(0)                           # daemon threads + serial released; guarantee no orphan
    except Exception as e:
        # No webview backend (headless / missing WebView2): fall back to the default browser.
        print(f"[fairy] native window unavailable ({e}); opening {url} in your browser. Ctrl+C to stop.")
        try:
            import webbrowser
            webbrowser.open(url)
        except Exception:
            pass
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("[fairy] stopped.")
            os._exit(0)


if __name__ == "__main__":
    main()
