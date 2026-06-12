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
import os
import sys
import threading
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
HOST, PORT = "127.0.0.1", 8765
TITLE = "CNC-FAIRY Gateway"
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


def _gateway_answering(timeout=0.8):
    """True if something already answers our port — a second copy must not start (COM/port clash)."""
    try:
        with urllib.request.urlopen(f"http://{HOST}:{PORT}/api/descriptor", timeout=timeout) as r:
            return r.status == 200
    except Exception:
        return False


def _tracking_active():
    """True if a job is being tracked right now (queue has running/delivered/stalled items)."""
    try:
        import json
        with urllib.request.urlopen(f"http://{HOST}:{PORT}/api/queue", timeout=2) as r:
            items = json.load(r)
        return any(i.get("state") in ("running", "delivered", "stalled") for i in items)
    except Exception:
        return False


def main():
    _setup_logging()
    # Single-instance lock (COMBINED-APP-PLAN Step 4): two gateways would silently double-bind the
    # HTTP port and fight over the serial COM port — refuse politely instead.
    if _gateway_answering():
        _msgbox(f"Already running — another gateway is answering on port {PORT}.\n\n"
                "Use the open window (or close it first); two copies would fight over the COM port.")
        print(f"[fairy] another instance answers on :{PORT} — exiting.")
        return
    user_args = sys.argv[1:]
    threading.Thread(target=_run_gateway, args=(user_args,), daemon=True).start()
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
        webview.start()                       # blocks until the window closes
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
