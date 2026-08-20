"""
DRIVE BACKEND — the BYO-cloud backend, proven against a SIMULATED Drive (t2076).

WHAT THIS PROVES, AND WHAT IT DOES NOT. It runs the REAL `DriveBackend` logic — the real query building,
the real find-then-update upsert, the real folder resolution, the real key conventions — against an
in-memory model of the Drive v3 REST API that reproduces the ONE semantic that actually differs from an
object store: **Drive allows two files with the same name in the same folder.** That is the defect this
backend exists to not have, so the fake is built to permit it and the tests assert we never do it.

⚠ It does NOT prove the wire format against Google. Only a live signed-in run does that, and it needs the
human's own Google account (`oauth.connected()` is False until they connect Drive in Setup). Stated
plainly per the dispatch's own rule: an honest limit beats a green tick on the half that can be faked.

Run standalone:  python bridge/bridge-app/tests/test_drive_backend_2076.py
"""
import json
import os
import re
import sys
import urllib.parse

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_HERE, ".."))
from fairy.backend.drive import DriveBackend, DriveError   # noqa: E402
from fairy.config import Config                             # noqa: E402

_FOLDER_MIME = "application/vnd.google-apps.folder"


class FakeDrive:
    """An in-memory Drive v3, intercepted at DriveBackend._req. Deliberately permits duplicate names in
    one folder (as the real Drive does) so a regression to blind-create shows up as a duplicate."""

    def __init__(self):
        self.files = {}      # id -> {name, parents, mimeType, content: bytes|None}
        self._n = 0
        self.calls = []      # every (method, path) — lets a test count round trips

    def _new_id(self, prefix="id"):
        self._n += 1
        return f"{prefix}{self._n}"

    def req(self, method, url, body=None, headers=None, raw=False):
        parsed = urllib.parse.urlparse(url)
        path, qs = parsed.path, urllib.parse.parse_qs(parsed.query)
        self.calls.append((method, path))

        # --- list: GET /drive/v3/files?q=...
        if method == "GET" and path.endswith("/drive/v3/files"):
            return {"files": self._query(qs.get("q", [""])[0])}

        # --- download: GET /drive/v3/files/<id>?alt=media
        if method == "GET" and "alt" in qs:
            fid = path.rsplit("/", 1)[-1]
            f = self.files.get(fid)
            return None if f is None else (f["content"] or b"")

        # --- create file (multipart upload). ⚠ CHECKED BEFORE the plain-files branch on purpose: Drive's
        #     upload path is /upload/drive/v3/files, which ALSO endswith "/drive/v3/files".
        if method == "POST" and "/upload/" in path:
            meta, content = self._split_multipart(body, headers)
            fid = self._new_id("file")
            self.files[fid] = {"name": meta["name"], "parents": meta.get("parents", ["root"]),
                               "mimeType": "", "content": content}
            return {"id": fid}

        # --- create folder (metadata-only JSON POST to /drive/v3/files)
        if method == "POST" and path.endswith("/drive/v3/files"):
            meta = json.loads(body.decode())
            fid = self._new_id("folder")
            self.files[fid] = {"name": meta["name"], "parents": meta.get("parents", ["root"]),
                               "mimeType": meta.get("mimeType", ""), "content": None}
            return {"id": fid}

        # --- replace content in place (media PATCH)
        if method == "PATCH" and "/upload/" in path:
            fid = path.rsplit("/", 1)[-1]
            if fid not in self.files:
                return None
            self.files[fid]["content"] = body
            return {"id": fid}

        # --- delete
        if method == "DELETE":
            self.files.pop(path.rsplit("/", 1)[-1], None)
            return {}

        raise AssertionError(f"FakeDrive got an unexpected call: {method} {url}")

    def _query(self, q):
        """Only the shapes DriveBackend actually builds: name =, <parent> in parents, mimeType =, trashed.
        ⚠ Parsed with anchored regexes, NOT find-the-next-quote: a query carrying BOTH a name and a parent
        (`name = 'J1.nc' and 'folderId' in parents`) makes naive quote-scanning capture the span between
        the name's opening quote and the parent's closing one."""
        unesc = lambda s: s.replace("\\'", "'").replace("\\\\", "\\")
        m_name = re.search(r"name = '((?:[^'\\]|\\.)*)'", q)
        m_parent = re.search(r"'((?:[^'\\]|\\.)*)' in parents", q)
        want_name = unesc(m_name.group(1)) if m_name else None
        want_parent = unesc(m_parent.group(1)) if m_parent else None
        want_folder = _FOLDER_MIME in q
        want_root_parent = "'root' in parents" in q
        out = []
        for fid, f in self.files.items():
            if want_name is not None and f["name"] != want_name:
                continue
            if want_parent is not None and want_parent not in f["parents"]:
                continue
            if want_root_parent and "root" not in f["parents"]:
                continue
            if want_folder and f["mimeType"] != _FOLDER_MIME:
                continue
            out.append({"id": fid, "name": f["name"]})
        return out

    @staticmethod
    def _split_multipart(body, headers):
        boundary = headers["Content-Type"].split("boundary=")[1].encode()
        parts = body.split(b"--" + boundary)
        meta = json.loads(parts[1].split(b"\r\n\r\n", 1)[1].rstrip(b"\r\n"))
        content = parts[2].split(b"\r\n\r\n", 1)[1]
        if content.endswith(b"\r\n"):
            content = content[:-2]
        return meta, content


def _backend():
    cfg = Config(backend="drive", google_client_id="cid", google_client_secret="sec")
    b = DriveBackend(cfg)
    fake = FakeDrive()
    b._req = fake.req                      # the ONLY seam replaced — all real logic above it runs
    b._token = lambda: "fake-token"        # no live OAuth in this tier
    return b, fake


def test_a_job_round_trips_through_drive():
    b, _ = _backend()
    b.put_job("J1", "G0 X1\nM30\n", {"total_beacons": 3, "content_hash": "H"})
    assert b.list_inbox() == ["J1"], b.list_inbox()
    nc, m = b.get_job("J1")
    assert nc == b"G0 X1\nM30\n", nc
    assert m["total_beacons"] == 3 and m["content_hash"] == "H", m


def test_deliver_then_delete_empties_the_inbox():
    """No retention: the poller deletes on delivery, and BOTH the .nc and .map.json must go."""
    b, fake = _backend()
    b.put_job("J1", "x", {"total_beacons": 1})
    b.delete_job("J1")
    assert b.list_inbox() == [], b.list_inbox()
    assert not [f for f in fake.files.values() if f["name"].startswith("J1")], fake.files


def test_rewriting_a_status_REPLACES_it_and_never_duplicates():
    """⭐ THE DRIVE-SPECIFIC DEFECT THIS GUARDS. Drive permits two files with one name in one folder, so a
    blind create would leave the poller's status history as duplicates and make get_status a coin flip.
    The poller rewrites a status on every beacon, so this is the hottest path in the whole backend."""
    b, fake = _backend()
    for state in ("delivering", "running", "done"):
        b.put_status("J1", {"jobId": "J1", "state": state})
    named = [f for f in fake.files.values() if f["name"] == "J1.json"]
    assert len(named) == 1, f"status was duplicated, not replaced: {len(named)} copies"
    assert b.get_status("J1")["state"] == "done", b.get_status("J1")
    assert len(b.list_statuses()) == 1, b.list_statuses()


def test_absent_things_answer_None_rather_than_raising():
    b, _ = _backend()
    assert b.get_status("nope") is None
    assert b.list_inbox() == [] and b.list_statuses() == [] and b.list_history() == []


def test_a_missing_job_raises_instead_of_returning_empty_gcode():
    """An unreadable job must NOT come back as empty G-code that would then be 'delivered' to a machine."""
    b, _ = _backend()
    try:
        b.get_job("ghost")
    except DriveError:
        return
    raise AssertionError("get_job on a missing job must raise, not return empty content")


def test_commands_are_keyed_by_FILENAME_stem_like_the_other_backends():
    """local_folder.py:139 keys a command by `f[:-5]` (the filename), and the poller hands that id back to
    clear_command. Keying off a field INSIDE the record instead would silently never clear anything."""
    b, _ = _backend()
    b._upsert("commands", "c1.json", json.dumps({"op": "delete", "target": "old.nc"}), "application/json")
    cmds = b.list_commands()
    assert [c[0] for c in cmds] == ["c1"], cmds
    assert cmds[0][1]["op"] == "delete", cmds
    b.clear_command("c1")
    assert b.list_commands() == [], b.list_commands()


def test_history_is_newest_first_and_capped():
    b, _ = _backend()
    for i, when in enumerate(["2026-08-01T00:00:00Z", "2026-08-03T00:00:00Z", "2026-08-02T00:00:00Z"]):
        b.append_history({"jobId": f"J{i}", "recorded_at": when, "final_state": "done"})
    got = [r["recorded_at"] for r in b.list_history()]
    assert got == sorted(got, reverse=True), got
    assert len(b.list_history(limit=2)) == 2


def test_the_folder_tree_is_created_once_and_then_cached():
    """Drive has no paths, so every folder is an id lookup. They are resolved once and cached — a cache
    miss costs a request, never a wrong answer, but re-resolving on every call would multiply the quota
    cost of a 15s poll loop."""
    b, fake = _backend()
    b.put_status("J1", {"jobId": "J1"})
    before = len(fake.calls)
    for _ in range(5):
        b.put_status("J1", {"jobId": "J1"})
    per_write = (len(fake.calls) - before) / 5
    assert per_write <= 2, f"{per_write} calls per status write — folder ids are not being cached"
    roots = [f for f in fake.files.values() if f["name"] == "DDCS Bridge"]
    assert len(roots) == 1, f"root folder created {len(roots)} times"


def test_heartbeat_and_cncdisk_index_are_single_well_known_files():
    b, fake = _backend()
    for i in range(3):
        b.put_heartbeat({"machine_id": "m1", "seq": i})
        b.put_cncdisk_index({"files": [f"f{i}.nc"]})
    assert len([f for f in fake.files.values() if f["name"] == "heartbeat.json"]) == 1
    assert len([f for f in fake.files.values() if f["name"] == "index.json"]) == 1


if __name__ == "__main__":
    for name, fn in sorted((n, f) for n, f in globals().items()
                           if n.startswith("test_") and callable(f)):
        fn()
        print("  ok  ", name)
    print("PASS -- the Drive backend implements the Backend contract against a simulated Drive: jobs round "
          "trip, writes UPSERT (never duplicate, the one semantic Drive does not share with an object "
          "store), commands key by filename like the other backends, and folder ids are cached. "
          "NOT proven here: the live wire format against Google — that needs a signed-in account.")
