"""fairy/webview_storage.py — where the desktop app's browser storage lives, decided ONCE (t1259).

WHY THIS IS A MODULE AND NOT TWO LINES IN A LAUNCHER: it already went wrong that way. pywebview defaults to PRIVATE
MODE, which throws browser storage away when the window closes — and in Studio that storage is not a cache, it IS the
workspace: localStorage holds the working buffer and the save watermark, IndexedDB holds the File System Access
handles for the workspaces folder, the library folder and the deploy target. So every close+reopen looked like
amnesia (t1257, reported live).

That fix was applied to `bridge/bridge-app/desktop.py`, and the amnesia survived the release — because the shipped exe
is built from `fairy_gateway.py` at the repo root by build_fairy.ps1, a DIFFERENT launcher with its own bare
`webview.start()`. Two launchers, two copies of a policy, one of them fixed. The answer is not to fix the second copy
too; it is to stop having copies. Both launchers now call `start_persistent()` and neither decides anything.

WHERE THE DATA GOES, and why not next to the app: a PyInstaller onefile build unpacks to a temp directory, so a path
relative to the executable would be discarded on exit — and an install-location path would make an app UPDATE read as
a fresh, amnesiac install. It lives in the user's own app-data, keyed to the app name, so it survives both restarts
and updates.
"""
import os
import sys

APP_DIR_NAME = "DDCS-Studio"


def storage_path() -> str:
    """The stable per-user directory for the webview's localStorage + IndexedDB. Created if missing."""
    base = os.environ.get("LOCALAPPDATA")
    if not base:   # non-Windows / a stripped environment — the XDG-ish fallback, still per-user and stable
        base = os.path.join(os.path.expanduser("~"), ".local", "share")
    path = os.path.join(base, APP_DIR_NAME, "webview")
    os.makedirs(path, exist_ok=True)   # pywebview will not create a missing storage directory for us
    return path


def start_persistent(webview, **kwargs):
    """
    `webview.start()`, with storage that survives the window closing.

    Every launcher goes through here, so "does the desktop app remember anything?" has exactly one answer. Extra
    kwargs (debug=…, gui=…) pass straight through.
    """
    try:
        webview.start(private_mode=False, storage_path=storage_path(), **kwargs)
    except TypeError:
        # An older pywebview without private_mode/storage_path. Start anyway rather than refusing to launch — but SAY
        # that storage will not persist, so the amnesia is never again something a user has to discover and report.
        print("[ddcs] this pywebview is too old for private_mode/storage_path — browser storage will NOT persist "
              "across restarts (your workspace buffer and folder grants will be forgotten). Upgrade pywebview.",
              file=sys.stderr)
        webview.start(**kwargs)
