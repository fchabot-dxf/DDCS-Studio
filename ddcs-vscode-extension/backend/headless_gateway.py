#!/usr/bin/env python3
"""headless_gateway.py — Headless VS Code extension entry for the CNC-FAIRY gateway.

Starts the gateway HTTP server + poll loop, blocking forever.
No pywebview or browser is launched, because VS Code provides the Webview.
"""
import datetime
import os
import sys
import time
import urllib.request

# backend/headless_gateway.py -> backend -> ddcs-vscode-extension -> ddcs-studio-project
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HOST = "127.0.0.1"
PORTS = [8765, 8766, 8767, 8768, 8769]
PORT = PORTS[0]
LOG_PATH = os.path.join(os.path.expanduser("~"), ".ddcs-bridge", "fairy_vscode.log")

class _Tee:
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
    try:
        os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
        f = open(LOG_PATH, "a", buffering=1, encoding="utf-8")
        sys.stdout = _Tee(sys.__stdout__, f)
        sys.stderr = _Tee(sys.__stderr__, f)
        print(f"\n=== headless gateway started {datetime.datetime.now():%Y-%m-%d %H:%M:%S} (pid {os.getpid()}) ===")
    except Exception as e:
        print(f"[headless] could not open log file {LOG_PATH}: {e}", file=sys.stderr)

def _asset(name):
    return {
        "console": os.path.join(ROOT_DIR, "bridge", "bridge-app", "web", "ui"),
        "studio": os.path.join(ROOT_DIR, "DDCS-Studio", "web"),
        "shared": os.path.join(ROOT_DIR, "DDCS-Studio", "web", "shared"),
    }[name]

def _gateway_answering(port=None, timeout=0.8):
    try:
        with urllib.request.urlopen(f"http://{HOST}:{port or PORT}/api/descriptor", timeout=timeout) as r:
            return r.status == 200
    except Exception:
        return False

def _port_free(port):
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind((HOST, port))
        return True
    except OSError:
        return False
    finally:
        s.close()

def _pick_port():
    try:
        import json
        with open(os.path.join(os.path.expanduser("~"), ".ddcs-bridge", "config.json"), encoding="utf-8") as f:
            pref = json.load(f).get("port")
            if pref not in PORTS: pref = None
    except Exception:
        pref = None

    order = ([pref] if pref else []) + [p for p in PORTS if p != pref]
    for p in order:
        if _gateway_answering(p): return p, True
    for p in order:
        if _port_free(p): return p, False
    return order[0], False

def _persisted_beacons_on():
    try:
        import json
        with open(os.path.join(os.path.expanduser("~"), ".ddcs-bridge", "config.json"), encoding="utf-8") as f:
            return bool(json.load(f).get("enable_slave"))
    except Exception:
        return False

def _run_gateway_blocking(user_args):
    sys.path.insert(0, os.path.join(ROOT_DIR, "bridge", "bridge-app"))
    from fairy.bridge import main
    argv = [
        "run", "--serve", "--backend", "local",
        "--http-port", str(PORT),
        "--console", _asset("console"), "--shared", _asset("shared"),
    ]
    if os.path.isdir(_asset("studio")):
        argv += ["--studio", _asset("studio")]
        
    forced_flags = any(a in user_args for a in ("--port", "--no-slave"))
    if not forced_flags and not _persisted_beacons_on():
        argv.append("--no-slave")
        
    argv += user_args
    main(argv) # This blocks forever!

def main():
    _setup_logging()
    global PORT
    PORT, already_running = _pick_port()
    # Machine-readable handshake for the VS Code extension host (the port may fall back off 8765).
    print(f"DDCS_PORT={PORT}", flush=True)
    if already_running:
        print(f"[headless] another instance answers on :{PORT}. VS Code will just connect to it!")
        # We block forever so the extension host doesn't think we crashed.
        try:
            while True: time.sleep(86400)
        except KeyboardInterrupt:
            os._exit(0)
            
    print(f"[headless] starting server on http://{HOST}:{PORT}")
    user_args = sys.argv[1:]
    
    try:
        _run_gateway_blocking(user_args)
    except KeyboardInterrupt:
        print("[headless] stopped via KeyboardInterrupt.")
        os._exit(0)

if __name__ == "__main__":
    main()
