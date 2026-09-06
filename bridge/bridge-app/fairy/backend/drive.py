"""drive.py — BYO-cloud backend: the user's OWN Google Drive, over the Drive v3 REST API.

WHY THIS EXISTS (t2076). The only cloud backend before this was `r2.py` — the DEVELOPER's Cloudflare
bucket, reached with one shared access token, paid for by the developer, and structurally single-tenant.
The human asked for the opposite: send a job over the internet using **their own** Google account, so the
data, the quota and the trust boundary are all theirs.

⭐ STDLIB ONLY, AND THAT IS THE WHOLE POINT — NOT AN AESTHETIC CHOICE.
`r2.py` needs boto3, and `desktop/build_fairy.ps1` builds the shipped exe with
`--exclude-module boto3 --exclude-module botocore` ("Local backend only (R2/boto3 excluded to slim it)").
So the exe — the thing every user actually runs — **cannot reach the R2 cloud path at all**; that is why
it was still `[TO TEST]` months later. This file uses `urllib` and `json` only, exactly like `oauth.py`,
so it bundles into the exe with no new dependency and no build change. ⛔ **Do not add `requests`,
`google-api-python-client`, or any other third-party client to this file** — that would reintroduce the
precise defect it exists to avoid.

AUTH is the loopback OAuth already shipped (`fairy/oauth.py`): `access_token()` returns a live token,
silently refreshed from the stored refresh token. Scope is `drive.file` — this app can only ever see
files IT created, never the rest of the user's Drive.

⭐ THE VISIBILITY QUESTION, SETTLED BEFORE THIS WAS WRITTEN (the spike's own gate). `drive.file` scopes
visibility to the OAuth CLIENT, so two different clients signed into one account cannot see each other's
files — which would have made this design silently useless (the gateway polling forever, finding nothing).
MEASURED 2026-08-19: the desktop side (`~/.ddcs-bridge/config.json`) and the hosted web side (fetched live
from `ddcs-studio.pages.dev/ui/cloud/providers.js`) ship the **IDENTICAL client id**
`895572525139-…m2o0e77`. One client, therefore one visibility domain, therefore the two ends see each
other's files by construction.

LAYOUT — a faithful port of the R2 key structure, so the Poller cannot tell the backends apart:

    <root>/                 "DDCS Bridge" (created on first use, in the user's Drive root)
      inbox/                <jobId>.nc  +  <jobId>.map.json
      status/               <jobId>.json
      history/              <jobId>.json
      commands/             <cmdId>.json
      gateway/              heartbeat.json
      cncdisk/              index.json

⚠ DRIVE IS NOT AN OBJECT STORE — the two differences that actually bite, handled here:
 1. **Names are not keys.** Drive happily stores two files with the SAME name in one folder, so a naive
    `put_status` would create a duplicate on every call and `get_status` would then be a coin flip. Every
    write here is an UPSERT: find-by-name, PATCH if present, POST if not (`_upsert`).
 2. **Paths do not exist.** "list the inbox" is a folder-id query, so the folder ids are resolved once and
    cached (`_folder`). A cache miss costs one extra request, never a wrong answer.

⚠ POLLING QUOTA. Drive's per-user limits are far tighter than R2's; a 5s poll is antisocial and will meet
them — and the idle case is not the only exposure: `run_poll_interval_s` (the FASTER cadence bridge.py
uses while a job is actively tracked) is 1s by default, which would poll Drive at 60 requests a minute,
worse than the idle rate this warning is about. `POLL_FLOOR_S` below is this backend's own declared
floor (t2097) — `run_loop`'s sleep is `max(configured interval, backend.POLL_FLOOR_S)`, so the floor
holds in BOTH the idle and the active-job case, regardless of what poll_interval_s/run_poll_interval_s
are configured to. This makes Drive right for SENDING and wrong for live progress — which is fine and by
design: live tracking runs on the serial cable, never on this path.
"""
import json
import mimetypes
import urllib.error
import urllib.parse
import urllib.request

from . import Backend
from .. import oauth

_API = "https://www.googleapis.com/drive/v3/files"
_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files"
_FOLDER_MIME = "application/vnd.google-apps.folder"

_INBOX, _STATUS, _HISTORY, _COMMANDS, _GATEWAY, _CNCDISK = (
    "inbox", "status", "history", "commands", "gateway", "cncdisk")


class DriveError(RuntimeError):
    """A Drive call that did not return a usable answer. Raised, never swallowed into a silent empty
    result — a gateway that cannot reach Drive must look broken, not merely idle (the exact failure
    shape that hid the beacon bug for months)."""


def _q(s):
    """Escape a value for a Drive query string literal (names can contain ' and \\)."""
    return str(s).replace("\\", "\\\\").replace("'", "\\'")


def _persist_discovered_name(config, name):
    """t2659 — write an auto-discovered machine_name to config.json, the SAME file/key Setup's own
    set_config (ops.py) writes, so the discovery survives a restart and Setup shows it as already-set
    rather than re-discovering (or re-asking) every single boot. Best-effort: a write failure here means
    the NEXT boot re-discovers instead (this same single-candidate scan is idempotent), never a crash.
    """
    import json
    import os
    path = getattr(config, "config_path", "") or ""
    if not path:
        from ..config import Config
        path = Config.default_config_path()
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        existing = {}
        if os.path.exists(path):
            with open(path, encoding="utf-8") as f:
                existing = json.load(f)
        existing["machine_name"] = name
        with open(path, "w", encoding="utf-8") as f:
            json.dump(existing, f, indent=2)
    except (OSError, ValueError):
        pass


class DriveBackend(Backend):
    POLL_FLOOR_S = 15.0   # t2097 — the deliberate floor for SENDING (see the module docstring's quota warning)

    def __init__(self, config, auto_discover=False):
        self.cfg = config
        self.root_name = getattr(config, "drive_folder", "") or "DDCS Bridge"
        # t2101 (S4) — EACH MACHINE GETS ITS OWN FOLDER. Before this, every machine's gateway shared ONE flat
        # inbox: poller._maybe_claim takes ids[0] with no notion of which machine a job is FOR, and identity.verify
        # is inert while machine_id is unset — an Expert program could be delivered to a V4.1 (different envelope,
        # different dialect). The name is machine_name VERBATIM, trimmed, never slugged: a slug would force two
        # independent implementations (here and driveJobs.js on the web side) to agree on one transform forever,
        # which is exactly the jobId hazard t2080 already paid for once. Drive takes spaces in a folder name fine.
        # ⛔ A BLANK NAME MUST NOT FALL BACK TO THE FLAT FOLDER — that fallback IS the hazard this exists to close.
        # A blank name still refuses to start, in __init__ — t2659 below just inserts ONE honest attempt to
        # avoid the refusal (a single-candidate auto-discovery) before it, never a silent fallback.
        self.machine_name = (getattr(config, "machine_name", "") or "").strip()
        self._root_id = None
        self._machine_root_id = None
        self._folders = {}          # "inbox" -> folder id (resolved once, then cached)
        # t2659 (BACKLOG #81, item 1 CORRECTED) — "the delivered .ddcs/first job can seed it when Setup
        # never did": a blank name no longer refuses outright — first try ONE honest guess. Studio's own
        # client-side send (ui/cloud/driveJobs.js's submitJobToDrive) already writes a job into
        # <container>/<fileSavedStem()>/inbox/ using the WORKSPACE STEM as the folder name — the SAME key
        # this class's own machine_name IS (see the class docstring: "VERBATIM, trimmed"). So if exactly
        # ONE non-reserved folder already sits under the container, it can only be that workspace's own
        # folder — adopt it and persist it, so every later boot (and Setup's own display) already has it.
        # Two-or-more candidates cannot be disambiguated safely (which one is THIS machine?), and zero means
        # genuinely nothing has synced yet — both fall through to the refusal below, unchanged.
        # ⛔ auto_discover DEFAULTS FALSE ON PURPOSE — this makes a REAL Drive API call, and a bare
        # `DriveBackend(cfg)` must stay the side-effect-free construction every existing caller (and every
        # unit test not deliberately opting in) already relies on — see
        # test_a_blank_machine_name_refuses_rather_than_falling_back_to_the_flat_folder's own contract
        # ("the caller learns before any Drive call is even attempted"). Only bridge.py's real `build()`
        # startup path opts in.
        if not self.machine_name and auto_discover:
            discovered = self._discover_single_machine_name()
            if discovered:
                self.machine_name = discovered
                _persist_discovered_name(config, discovered)
        if not self.machine_name:
            raise DriveError(
                "Drive backend needs a machine name to keep each machine's jobs in their own folder — "
                "set one in Setup before turning Drive on")

    def _discover_single_machine_name(self):
        """The one-candidate auto-adopt described above. Best-effort: any failure (no token yet, network,
        an unreadable response) falls through to the caller's own refusal — this NEVER raises itself, since
        an honest guess that cannot be made is not a reason to fail differently than a guess that was never
        attempted."""
        try:
            container = self._root()
            q = f"'{_q(container)}' in parents and trashed = false and mimeType = '{_FOLDER_MIME}'"
            names = [f["name"] for f in self._list(q)
                     if f["name"] not in (_INBOX, _STATUS, _HISTORY, _COMMANDS, _GATEWAY, _CNCDISK)]
        except Exception:
            return ""
        return names[0] if len(names) == 1 else ""

    # ── plumbing ────────────────────────────────────────────────────────────────────────────────
    def _token(self):
        tok = oauth.access_token(self.cfg.google_client_id, self.cfg.google_client_secret)
        if not tok:
            raise DriveError(
                "not signed in to Google Drive — open Studio and connect Drive (Setup), "
                "or the stored refresh token has been revoked")
        return tok

    def _req(self, method, url, body=None, headers=None, raw=False):
        h = {"Authorization": "Bearer " + self._token()}
        h.update(headers or {})
        req = urllib.request.Request(url, data=body, headers=h, method=method)
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                data = r.read()
        except urllib.error.HTTPError as e:
            detail = ""
            try:
                detail = e.read().decode("utf-8", "replace")[:400]
            except Exception:
                pass
            if e.code == 404:
                return None
            raise DriveError(f"{method} {url.split('?')[0]} -> HTTP {e.code}: {detail}") from e
        except OSError as e:
            raise DriveError(f"{method} {url.split('?')[0]} -> {e}") from e
        if raw:
            return data
        return json.loads(data) if data else {}

    def _list(self, query, fields="files(id,name)"):
        """Every page of a files.list query (Drive paginates at 100 by default)."""
        out, page = [], None
        while True:
            p = {"q": query, "fields": f"nextPageToken,{fields}", "pageSize": "1000",
                 "spaces": "drive"}
            if page:
                p["pageToken"] = page
            resp = self._req("GET", _API + "?" + urllib.parse.urlencode(p)) or {}
            out.extend(resp.get("files", []))
            page = resp.get("nextPageToken")
            if not page:
                break
        return out

    def _find_child(self, parent_id, name, folder=False):
        q = (f"name = '{_q(name)}' and '{_q(parent_id)}' in parents and trashed = false")
        if folder:
            q += f" and mimeType = '{_FOLDER_MIME}'"
        files = self._list(q)
        return files[0]["id"] if files else None

    def _mkdir(self, name, parent_id=None):
        meta = {"name": name, "mimeType": _FOLDER_MIME}
        if parent_id:
            meta["parents"] = [parent_id]
        resp = self._req("POST", _API + "?fields=id",
                         body=json.dumps(meta).encode("utf-8"),
                         headers={"Content-Type": "application/json; charset=UTF-8"})
        return resp["id"]

    def _root(self):
        """The CONTAINER folder ("DDCS Bridge") — shared across every machine. Reserve the six legacy leaf
        names (inbox/status/history/commands/gateway/cncdisk) below this: a child folder called one of those
        is the OLD flat layout, never a machine (t2101 — legacy_flat_jobs() below relies on that)."""
        if self._root_id:
            return self._root_id
        q = (f"name = '{_q(self.root_name)}' and mimeType = '{_FOLDER_MIME}' "
             f"and 'root' in parents and trashed = false")
        files = self._list(q)
        self._root_id = files[0]["id"] if files else self._mkdir(self.root_name)
        return self._root_id

    def _machine_root(self):
        """t2101 (S4) — THIS machine's own folder, nested under the container: <container>/<machine_name>/."""
        if self._machine_root_id:
            return self._machine_root_id
        container = self._root()
        self._machine_root_id = self._find_child(container, self.machine_name, folder=True) \
            or self._mkdir(self.machine_name, container)
        return self._machine_root_id

    def _folder(self, name):
        if name in self._folders:
            return self._folders[name]
        root = self._machine_root()
        fid = self._find_child(root, name, folder=True) or self._mkdir(name, root)
        self._folders[name] = fid
        return fid

    def legacy_flat_jobs(self):
        """t2101 (S4) — DETECT, never migrate, pre-namespace jobs sitting in the OLD flat <container>/inbox
        (before this machine had its own folder). Read-only: uses _find_child, never _folder/_mkdir, so
        checking for the legacy folder can never manufacture it. Auto-migrating would have to GUESS which
        machine each legacy job was originally for — that guess IS the safety bug this whole feature exists
        to close, re-committed as migration code. Returns the count of .nc jobs still sitting there flat (0 =
        nothing to report); bridge.py logs it once at startup so it is a support answer, not a mystery."""
        inbox_id = self._find_child(self._root(), _INBOX, folder=True)
        if not inbox_id:
            return 0
        files = self._list(f"'{_q(inbox_id)}' in parents and trashed = false")
        return len([f for f in files if f["name"].endswith(".nc")])

    def _upsert(self, folder, name, data, mime=None):
        """Create the file, or REPLACE its content if a file of that name is already there. Drive
        permits duplicate names in one folder, so this is what keeps a name behaving like a key."""
        if isinstance(data, str):
            data = data.encode("utf-8")
        mime = mime or mimetypes.guess_type(name)[0] or "application/octet-stream"
        fid = self._find_child(self._folder(folder), name)
        if fid:   # replace content in place — simple media upload, metadata untouched
            self._req("PATCH", f"{_UPLOAD}/{fid}?uploadType=media",
                      body=data, headers={"Content-Type": mime})
            return fid
        meta = {"name": name, "parents": [self._folder(folder)]}
        boundary = "ddcs-bridge-boundary-7f3a"
        body = (
            f"--{boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n"
            f"{json.dumps(meta)}\r\n--{boundary}\r\nContent-Type: {mime}\r\n\r\n"
        ).encode("utf-8") + data + f"\r\n--{boundary}--\r\n".encode("utf-8")
        resp = self._req("POST", f"{_UPLOAD}?uploadType=multipart&fields=id", body=body,
                         headers={"Content-Type": f"multipart/related; boundary={boundary}"})
        return (resp or {}).get("id")

    def _read(self, folder, name):
        """File content as bytes, or None when it isn't there (an absent file is an answer, not an error)."""
        fid = self._find_child(self._folder(folder), name)
        if not fid:
            return None
        return self._req("GET", f"{_API}/{fid}?alt=media", raw=True)

    def _read_json(self, folder, name):
        raw = self._read(folder, name)
        if not raw:
            return None
        try:
            return json.loads(raw)
        except ValueError:
            return None

    def _delete(self, folder, name):
        fid = self._find_child(self._folder(folder), name)
        if fid:
            self._req("DELETE", f"{_API}/{fid}")

    def _names(self, folder, suffix):
        q = f"'{_q(self._folder(folder))}' in parents and trashed = false"
        return sorted(f["name"] for f in self._list(q) if f["name"].endswith(suffix))

    def _all_json(self, folder):
        """[(name, parsed)] for every .json in the folder, name included because the OTHER backends key
        commands by FILENAME stem (`local_folder.py:139` `f[:-5]`), not by a field inside the record."""
        q = f"'{_q(self._folder(folder))}' in parents and trashed = false"
        out = []
        for f in sorted(self._list(q), key=lambda x: x["name"]):
            if not f["name"].endswith(".json"):
                continue
            raw = self._req("GET", f"{_API}/{f['id']}?alt=media", raw=True)
            if raw:
                try:
                    out.append((f["name"], json.loads(raw)))
                except ValueError:
                    pass   # a half-written file is skipped, never crashes the poll loop
        return out

    # ── the Backend contract (same 13 methods the Poller calls) ─────────────────────────────────
    def list_inbox(self):
        return sorted(n[:-3] for n in self._names(_INBOX, ".nc"))

    def put_job(self, job_id, nc_bytes, mapping=None):
        self._upsert(_INBOX, f"{job_id}.nc", nc_bytes, "text/plain")
        if mapping:
            self._upsert(_INBOX, f"{job_id}.map.json", json.dumps(mapping, indent=2),
                         "application/json")

    def get_job(self, job_id):
        nc = self._read(_INBOX, f"{job_id}.nc")
        if nc is None:
            raise DriveError(f"inbox/{job_id}.nc not found in Drive")
        return nc, (self._read_json(_INBOX, f"{job_id}.map.json") or {})

    def put_status(self, job_id, status):
        self._upsert(_STATUS, f"{job_id}.json", json.dumps(status, indent=2), "application/json")

    def get_status(self, job_id):
        return self._read_json(_STATUS, f"{job_id}.json")

    def list_statuses(self):
        return sorted((rec for _, rec in self._all_json(_STATUS)),
                      key=lambda s: s.get("jobId", ""))

    def put_heartbeat(self, obj):
        self._upsert(_GATEWAY, "heartbeat.json", json.dumps(obj, indent=2), "application/json")

    def append_history(self, record):
        self._upsert(_HISTORY, f"{record['jobId']}.json", json.dumps(record, indent=2),
                     "application/json")

    def list_history(self, limit=100):
        out = [rec for _, rec in self._all_json(_HISTORY)]
        out.sort(key=lambda r: r.get("recorded_at", ""), reverse=True)
        return out[:limit]

    def delete_job(self, job_id):
        for ext in (".nc", ".map.json"):
            self._delete(_INBOX, f"{job_id}{ext}")

    def put_cncdisk_index(self, index):
        self._upsert(_CNCDISK, "index.json", json.dumps(index, indent=2), "application/json")

    def list_commands(self):
        # keyed by FILENAME stem, matching local_folder/r2 — clear_command() is called back with this id
        return sorted(((name[:-5], rec) for name, rec in self._all_json(_COMMANDS)),
                      key=lambda c: c[0])

    def clear_command(self, cmd_id):
        self._delete(_COMMANDS, f"{cmd_id}.json")
