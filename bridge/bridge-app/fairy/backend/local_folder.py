"""local_folder.py — the test backend. A root folder mirrors the R2 layout:
inbox/  status/. Lets the whole bridge run on one PC, no cloud account.
"""
import json
import os
import shutil

from . import Backend

_SUBDIRS = ("inbox", "status", "cncdisk", "commands", "history")


def migrate_legacy_root(new_root, legacy_root="./_bridge_data", log=print):
    """t2022 — port forward records from the OLD cwd-relative default (a landmine: relative to wherever the
    process happened to launch from, so it sat beside the install folder) into the new stable per-user
    NEW_ROOT (Config.default_local_root()). Merges file-by-file and never overwrites an existing destination
    file, so re-running this on every startup is a no-op once the one-time copy has happened — safe to call
    unconditionally. Returns the number of files moved (0 = nothing to do, including "already migrated")."""
    legacy = os.path.abspath(legacy_root)
    new_abs = os.path.abspath(new_root)
    if legacy == new_abs or not os.path.isdir(legacy):
        return 0
    moved = 0
    for sub in _SUBDIRS:
        src_dir = os.path.join(legacy, sub)
        if not os.path.isdir(src_dir):
            continue
        dst_dir = os.path.join(new_root, sub)
        os.makedirs(dst_dir, exist_ok=True)
        for fn in os.listdir(src_dir):
            src = os.path.join(src_dir, fn)
            dst = os.path.join(dst_dir, fn)
            if not os.path.isfile(src) or os.path.exists(dst):
                continue   # a directory entry, or already migrated -- never overwrite what's already there
            shutil.copy2(src, dst)
            moved += 1
    if moved:
        log(f"[migrate] moved {moved} record(s) from the old {legacy} into {new_root} (one-time)")
    return moved


class LocalFolderBackend(Backend):
    def __init__(self, root):
        self.root = root
        self.inbox = os.path.join(root, "inbox")
        self.status = os.path.join(root, "status")
        self.cncdisk = os.path.join(root, "cncdisk")     # published listing lives here
        self.commands = os.path.join(root, "commands")
        self.history = os.path.join(root, "history")
        for d in (self.inbox, self.status, self.cncdisk, self.commands, self.history):
            os.makedirs(d, exist_ok=True)

    def list_inbox(self):
        ids = [f[:-3] for f in os.listdir(self.inbox) if f.endswith(".nc")]
        return sorted(ids)

    def put_job(self, job_id, nc_bytes, mapping=None):
        if isinstance(nc_bytes, str):
            nc_bytes = nc_bytes.encode("utf-8")
        with open(os.path.join(self.inbox, job_id + ".nc"), "wb") as f:
            f.write(nc_bytes)
        if mapping:
            with open(os.path.join(self.inbox, job_id + ".map.json"), "w", encoding="utf-8") as f:
                json.dump(mapping, f, indent=2)

    def get_job(self, job_id):
        with open(os.path.join(self.inbox, job_id + ".nc"), "rb") as f:
            nc = f.read()
        m = {}
        map_path = os.path.join(self.inbox, job_id + ".map.json")
        if os.path.exists(map_path):
            with open(map_path, "r", encoding="utf-8") as f:
                m = json.load(f)
        return nc, m

    def put_status(self, job_id, status):
        path = os.path.join(self.status, job_id + ".json")
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(status, f, indent=2)
        os.replace(tmp, path)        # atomic — a reader never sees a half-written status

    def get_status(self, job_id):
        path = os.path.join(self.status, job_id + ".json")
        if not os.path.exists(path):
            return None
        with open(path, encoding="utf-8") as f:
            return json.load(f)

    def list_statuses(self):
        out = []
        for fn in sorted(os.listdir(self.status)):
            if fn.endswith(".json"):
                with open(os.path.join(self.status, fn), encoding="utf-8") as f:
                    out.append(json.load(f))
        return out

    def put_heartbeat(self, obj):
        d = os.path.join(self.root, "gateway")
        os.makedirs(d, exist_ok=True)
        path = os.path.join(d, "heartbeat.json")
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(obj, f, indent=2)
        os.replace(tmp, path)

    def append_history(self, record):
        path = os.path.join(self.history, record["jobId"] + ".json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(record, f, indent=2)

    def list_history(self, limit=100):
        out = []
        for fn in sorted(os.listdir(self.history), reverse=True):
            if fn.endswith(".json"):
                with open(os.path.join(self.history, fn), encoding="utf-8") as f:
                    out.append(json.load(f))
        out.sort(key=lambda r: r.get("recorded_at", ""), reverse=True)
        return out[:limit]

    def delete_job(self, job_id):
        for ext in (".nc", ".map.json"):
            path = os.path.join(self.inbox, job_id + ext)
            if os.path.exists(path):
                os.remove(path)

    def put_cncdisk_index(self, index):
        path = os.path.join(self.cncdisk, "index.json")
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(index, f, indent=2)
        os.replace(tmp, path)

    def list_commands(self):
        out = []
        for f in sorted(os.listdir(self.commands)):
            if f.endswith(".json"):
                with open(os.path.join(self.commands, f), encoding="utf-8") as fh:
                    out.append((f[:-5], json.load(fh)))
        return out

    def clear_command(self, cmd_id):
        path = os.path.join(self.commands, cmd_id + ".json")
        if os.path.exists(path):
            os.remove(path)
