"""DDCS Bridge — desktop app (pywebview).

The gateway in a native window: one Python process — the gateway loop runs in a daemon thread and the
console shows in a WebView2 window (no browser, no separate server). Reads optional per-machine config
from ~/.ddcs-bridge/config.json. Bundle with PyInstaller -> one .exe (see web/DEPLOY.md / build).

Run from source:  cd bridge-app && python desktop.py
"""
import json
import os
import sys
import threading
import time

import webview

from fairy.bridge import run_loop
from fairy.config import Config

APP_DATA = os.path.join(os.path.expanduser("~"), ".ddcs-bridge")


def _bundle_dir():
    # PyInstaller unpacks data to sys._MEIPASS; from source it's this file's dir.
    return getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))


def _shared_dir():
    """The shared/ core (mounted at /shared/). It lives in the Studio deploy root so Cloudflare serves
    it with no build: <repo>/DDCS-Studio/web/shared. Frozen exe: bundled flat at <_MEIPASS>/shared.
    From source: repo root is two up from bridge-app (bridge-app -> bridge -> repo)."""
    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        return os.path.join(meipass, "shared")
    here = os.path.dirname(os.path.abspath(__file__))
    return os.path.normpath(os.path.join(here, "..", "..", "DDCS-Studio", "web", "shared"))


def _overrides():
    """Optional ~/.ddcs-bridge/config.json — per-machine setup without rebuilding the exe. Keys:
    backend, dest, com_port, enable_slave, machine_id, machine_name, port, r2_* (for cloud)."""
    try:
        with open(os.path.join(APP_DATA, "config.json"), encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def build_config():
    ov = _overrides()
    return Config.from_env(
        backend=ov.get("backend", "local"),
        local_root=ov.get("local_root", os.path.join(APP_DATA, "data")),
        expert_dest=ov.get("dest", ""),                  # unconfigured until set in Setup (a network share)
        com_port=ov.get("com_port"),
        machine_id=ov.get("machine_id"),
        machine_name=ov.get("machine_name"),
        enable_slave=ov.get("enable_slave", False),      # default off (no Modbus) until configured
        serve=True, host="127.0.0.1", port=int(ov.get("port", 8765)),
        console_dir=os.path.join(_bundle_dir(), "web", "ui"),
        shared_dir=_shared_dir(),
        config_path=os.path.join(APP_DATA, "config.json"),   # Setup persists here
        open_browser=False,                              # the window IS the UI
    )


def main():
    cfg = build_config()
    threading.Thread(target=run_loop, args=(cfg,), daemon=True).start()

    url = f"http://{cfg.host}:{cfg.port}"
    import urllib.request
    for _ in range(80):                                  # wait for the local server to come up
        try:
            urllib.request.urlopen(url + "/api/descriptor", timeout=1)
            break
        except Exception:
            time.sleep(0.1)

    webview.create_window("DDCS Bridge", url, width=900, height=840)
    # ── STORAGE MUST SURVIVE THE APP CLOSING (t1257, proven live by the user) ─────────────────────────────────────
    # pywebview defaults to PRIVATE MODE, which throws browser storage away when the window closes. In this app that
    # storage is not a cache — it is the workspace: localStorage holds the working buffer and the save watermark, and
    # IndexedDB holds the File System Access handles for the workspaces folder, the library folder and the deploy
    # target. So every close+reopen looked like amnesia: the granted folder gone, the save handle gone, unsaved work
    # gone. private_mode=False turns persistence on; storage_path pins WHERE it persists.
    #
    # The path is deliberately in the user's own app-data, NOT beside the executable: a PyInstaller build unpacks to a
    # temp dir, and an install-location path would also mean an app UPDATE reads as a fresh amnesiac install. It is
    # created up front because pywebview will not create a missing storage directory for us.
    storage = os.path.join(
        os.environ.get("LOCALAPPDATA") or os.path.join(os.path.expanduser("~"), ".local", "share"),
        "DDCS-Studio", "webview",
    )
    try:
        os.makedirs(storage, exist_ok=True)
        webview.start(private_mode=False, storage_path=storage)
    except TypeError:
        # an older pywebview without these arguments: start anyway rather than refusing to launch, and say why the
        # app will still forget things, so the symptom is never a mystery again.
        print("[ddcs] pywebview is too old for private_mode/storage_path — browser storage will NOT persist; upgrade pywebview.", file=sys.stderr)
        webview.start()


if __name__ == "__main__":
    main()
