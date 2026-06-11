#!/usr/bin/env python3
"""fairy_gateway.py — desktop entry for the CNC-FAIRY gateway (fairy.exe).

Starts the gateway HTTP server + poll loop in a background thread, then opens the
existing fairy console (web/ui: Queue/Submit/Files/History/Setup) in a native
pywebview window — no browser. Frozen-aware: when packaged by PyInstaller it serves
the bundled console + shared/ assets from sys._MEIPASS; in dev it serves them from
the repo tree.

Build:      build_fairy.ps1   ->  ./fairy.exe
Run (dev):  python fairy_gateway.py            (boots to Setup; configure the
            controller disk there — it persists to ~/.ddcs-bridge/config.json)
Extra args pass straight through to the gateway, e.g.:
            python fairy_gateway.py --dest \\\\192.168.0.99\\CNCDISK --port COM6
"""
import os
import sys
import threading
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
HOST, PORT = "127.0.0.1", 8765
TITLE = "CNC-FAIRY Gateway"


def _asset(name):
    """Resolve a bundled asset dir — from PyInstaller's _MEIPASS when frozen, else the repo tree."""
    base = getattr(sys, "_MEIPASS", None)
    if base:
        return os.path.join(base, name)
    return {
        "console": os.path.join(HERE, "bridge", "bridge-app", "web", "ui"),
        "shared": os.path.join(HERE, "DDCS-Studio", "web", "shared"),
    }[name]


def _run_gateway(user_args):
    """Run the blocking gateway (serve + poll loop) — invoked in a daemon thread."""
    if not getattr(sys, "frozen", False):
        sys.path.insert(0, os.path.join(HERE, "bridge", "bridge-app"))
    from fairy.bridge import main
    argv = [
        "run", "--serve", "--backend", "local",
        "--host", HOST, "--http-port", str(PORT),
        "--console", _asset("console"), "--shared", _asset("shared"),
    ]
    # First-boot safe default: no serial slave unless the user explicitly wires it (avoids a COM-port
    # open failure on a machine with no SABRENT). Beacons are toggled on later in the Setup tab.
    if not any(a in user_args for a in ("--port", "--no-slave")):
        argv.append("--no-slave")
    argv += user_args
    main(argv)


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


def main():
    user_args = sys.argv[1:]
    threading.Thread(target=_run_gateway, args=(user_args,), daemon=True).start()
    if not _wait_up():
        print("[fairy] gateway did not start — see the log above.", file=sys.stderr)
    url = f"http://{HOST}:{PORT}/"
    try:
        import webview
        webview.create_window(TITLE, url, width=1180, height=820, min_size=(900, 600))
        webview.start()                       # blocks until the window closes; then the process exits
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
            pass


if __name__ == "__main__":
    main()
