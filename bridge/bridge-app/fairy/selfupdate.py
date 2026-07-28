"""fairy/selfupdate.py — the desktop app replaces itself, safely (t1261, user-ruled).

THE PORTABLE MODEL STAYS: one .exe you can put anywhere, no installer, no service. What changes is that "update"
stops meaning "open a browser, download, find the file, quit the app, overwrite it, reopen" and becomes one button.

WINDOWS LETS A RUNNING EXE BE RENAMED BUT NOT OVERWRITTEN. That single fact shapes everything here: the new build is
written beside the running one, VERIFIED, and only then is the running file renamed out of the way so the new one can
take its exact path and name. The next launch sweeps the leftovers.

THE ORDER IS THE SAFETY, and it is deliberate:

    1. download the new exe  -> <name>.new.exe   (beside the running one, same volume, so the move is atomic)
    2. download its .sha256, hash the file, COMPARE  -- a mismatch stops here and nothing has been touched
    3. rename the RUNNING exe -> <name>.old.exe   (the first step that changes anything about the install)
    4. move <name>.new.exe   -> the running exe's exact path
    5. relaunch; the new process sweeps *.old.exe on boot

Anything that fails at 1 or 2 leaves the installation byte-identical. If 4 somehow fails after 3, we put the original
back — an app that cannot update is a nuisance, an app that deletes itself is a disaster.

NO CERTIFICATE, SO THE HASH IS THE INTEGRITY STORY. It is not a signature: it proves the bytes match what the release
published, not who published them (both come from the same GitHub release over TLS). Say so plainly rather than
implying more. A mismatch is a NAMED REFUSAL plus the release page — never "install anyway".

THE URL IS NOT TAKEN FROM THE PAGE. The browser side asks to update; it does not get to say WHAT to install. This
module resolves the release from the hard-coded repo itself, so a compromised or confused page cannot point the
updater at arbitrary bytes.
"""
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.request

REPO = "fchabot-dxf/DDCS-Studio"
API_LATEST = f"https://api.github.com/repos/{REPO}/releases/latest"
RELEASES_PAGE = f"https://github.com/{REPO}/releases/latest"
OLD_SUFFIX = ".old.exe"
_UA = {"User-Agent": "DDCS-Studio-updater"}


# ── where we are ────────────────────────────────────────────────────────────────────────────────────────────────
def is_frozen() -> bool:
    """True only inside the PyInstaller exe. The web app and a source run never self-update."""
    return bool(getattr(sys, "frozen", False))


def exe_path() -> str:
    """The running executable's own path — what we are replacing."""
    return os.path.abspath(sys.executable)


def sweep_old(directory: str = None) -> list:
    """Delete the previous build(s) left behind by an update. Called on boot; failures are ignored (still in use)."""
    directory = directory or os.path.dirname(exe_path())
    removed = []
    try:
        for name in os.listdir(directory):
            if name.lower().endswith(OLD_SUFFIX):
                try:
                    os.remove(os.path.join(directory, name))
                    removed.append(name)
                except OSError:
                    pass   # still locked by a process that has not exited yet; the next boot gets it
    except OSError:
        pass
    return removed


# ── integrity ───────────────────────────────────────────────────────────────────────────────────────────────────
def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def parse_sha256(text: str) -> str:
    """Read a hex digest out of a .sha256 file (bare, or the `<hex>  <name>` shasum format). '' if unrecognisable."""
    m = re.search(r"\b([0-9a-fA-F]{64})\b", text or "")
    return m.group(1).lower() if m else ""


# ── the release ─────────────────────────────────────────────────────────────────────────────────────────────────
def _get(url: str, timeout: int = 30) -> bytes:
    req = urllib.request.Request(url, headers=_UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def pick_assets(assets: dict) -> dict:
    """
    Choose the exe and its checksum from a release's assets, BY PATTERN (t1263).

    Release assets are version-named — `DDCS-Studio-v2026.07.27.1.exe` — so that a Downloads folder full of them
    still tells you which is which. That means the updater cannot look for a fixed filename, and it must not simply
    take "the first .exe" either: a release can carry other files, and picking the wrong one would download something
    that is not the app. It matches the DDCS-Studio-*.exe family, prefers the one whose .sha256 it can also find, and
    pairs them by exact name so a stray checksum cannot be attached to the wrong binary.
    @param assets {name: url}
    """
    exes = sorted(n for n in assets if n.lower().startswith("ddcs-studio") and n.lower().endswith(".exe"))
    for name in exes:
        sha = name + ".sha256"
        if sha in assets:
            return {"exe_url": assets[name], "sha_url": assets[sha], "exe_name": name}
    # an exe with no matching checksum: report it so the caller can refuse for the RIGHT reason (unverifiable),
    # rather than reporting "no download" and sending someone hunting for a missing asset
    return {"exe_url": assets[exes[0]] if exes else "", "sha_url": "", "exe_name": exes[0] if exes else ""}


def latest_release(fetch=None) -> dict:
    """
    Resolve the latest release from the REPO ITSELF (never a URL handed in from the page).

    /releases/latest returns the newest NON-prerelease, so the rolling `latest` build of main — published as a
    pre-release — is invisible here by construction. The updater cannot be walked backwards onto a main build.
    @returns {tag, exe_url, sha_url, exe_name} — urls are '' when the release does not carry them.
    """
    fetch = fetch or _get
    data = json.loads(fetch(API_LATEST).decode("utf-8", "replace"))
    assets = {a.get("name", ""): a.get("browser_download_url", "") for a in (data.get("assets") or [])}
    picked = pick_assets(assets)
    return {"tag": data.get("tag_name", ""), **picked}


# ── the swap ────────────────────────────────────────────────────────────────────────────────────────────────────
def swap_in(new_file: str, target: str) -> dict:
    """
    Put `new_file` at `target`, where `target` may be a RUNNING executable.

    THE UPDATE KEEPS THE USER'S FILENAME (t1263). Release assets are version-named, but the installed app is whatever
    the user called it and wherever they put it — shortcuts, taskbar pins and scripts all point at THAT path. Renaming
    it to match the release would break every one of them and leave a stale duplicate behind. The version chip inside
    the app is the truth about which build this is; the filename is the user's business.

    Assumes the caller has already verified `new_file` — this function does the dangerous part and nothing else, so
    the verify-before-touch order is visible at the call site instead of buried here.
    @returns {ok, old, error?}
    """
    if not os.path.isfile(new_file):
        return {"ok": False, "error": "the downloaded file is missing."}
    old = target + OLD_SUFFIX
    try:
        if os.path.exists(old):
            os.remove(old)   # a leftover from a previous update the sweep could not take
    except OSError:
        pass
    try:
        os.rename(target, old)          # ← the FIRST destructive step, and only now
    except OSError as e:
        return {"ok": False, "error": f"could not move the running app aside ({e}). Nothing was changed."}
    try:
        shutil.move(new_file, target)
    except OSError as e:
        try:
            os.rename(old, target)      # PUT IT BACK: an app that cannot update beats an app that vanished
            return {"ok": False, "error": f"could not put the new version in place ({e}). The original is intact."}
        except OSError:
            return {"ok": False, "error": f"could not put the new version in place ({e}), and the original is at {old}."}
    return {"ok": True, "old": old}


def can_write_here(target: str = None) -> bool:
    """Is the app's own folder writable? A read-only location is a refusal, not a failed swap halfway through."""
    target = target or exe_path()
    d = os.path.dirname(target)
    try:
        with tempfile.NamedTemporaryFile(dir=d, prefix=".ddcs-upd-", delete=True):
            return True
    except OSError:
        return False


# ── the whole act ───────────────────────────────────────────────────────────────────────────────────────────────
def perform_update(fetch=None, relaunch=True) -> dict:
    """
    Download → verify → swap → relaunch. Every failure is a NAMED refusal plus the release page, never a silent stop
    and never an unverified install.
    @returns {ok, tag?, error?, page?}
    """
    fetch = fetch or _get
    if not is_frozen():
        return {"ok": False, "error": "self-update only applies to the desktop app.", "page": RELEASES_PAGE}
    target = exe_path()
    if not can_write_here(target):
        return {"ok": False, "page": RELEASES_PAGE,
                "error": f"“{os.path.dirname(target)}” is read-only, so the app cannot replace itself there. "
                         "Download the new version and put it where you keep this one."}
    try:
        rel = latest_release(fetch)
    except Exception as e:
        return {"ok": False, "error": f"could not reach the release list ({e}).", "page": RELEASES_PAGE}
    if not rel.get("exe_url"):
        return {"ok": False, "error": "that release has no .exe to download.", "page": RELEASES_PAGE}
    if not rel.get("sha_url"):
        # INTEGRITY IS NOT OPTIONAL: with no published hash there is nothing to check the bytes against, so we do not
        # install them. The release page still works — a human downloading knowingly is a different decision.
        return {"ok": False, "page": RELEASES_PAGE,
                "error": "that release did not publish a checksum, so the download cannot be verified."}

    new_file = target + ".new.exe"
    try:
        data = fetch(rel["exe_url"], timeout=300)
        with open(new_file, "wb") as f:
            f.write(data)
        want = parse_sha256(fetch(rel["sha_url"], timeout=60).decode("utf-8", "replace"))
        got = sha256_file(new_file)
    except Exception as e:
        _quiet_remove(new_file)
        return {"ok": False, "error": f"the download did not finish ({e}).", "page": RELEASES_PAGE}
    if not want:
        _quiet_remove(new_file)
        return {"ok": False, "error": "the published checksum could not be read.", "page": RELEASES_PAGE}
    if got != want:
        _quiet_remove(new_file)
        return {"ok": False, "page": RELEASES_PAGE,
                "error": "the downloaded file does not match the published checksum, so it was NOT installed."}

    r = swap_in(new_file, target)
    if not r.get("ok"):
        _quiet_remove(new_file)
        return {"ok": False, "error": r.get("error"), "page": RELEASES_PAGE}
    if relaunch:
        try:
            subprocess.Popen([target], close_fds=True)
        except Exception as e:
            return {"ok": True, "tag": rel.get("tag"), "relaunched": False,
                    "error": f"updated, but the new version could not be started automatically ({e}) — open it yourself."}
    return {"ok": True, "tag": rel.get("tag"), "relaunched": bool(relaunch)}


def _quiet_remove(path: str):
    try:
        os.remove(path)
    except OSError:
        pass
