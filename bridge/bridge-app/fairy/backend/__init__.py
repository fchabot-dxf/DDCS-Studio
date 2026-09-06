"""backend/ — the transport seam (ARCHITECTURE.md §4, PROTOCOL §3).

The Poller/Tracker are backend-agnostic: they only ever call these four methods.
`local_folder` is for testing the whole pipeline on one PC; `r2` is production.
Swapping between them is the entire "cloud vs local" switch.

No bucket retention. Every job's inbox/<jobId>.* is DELETED on delivery — the file then lives on
the controller's CNCDISK (which is where a same-session re-run comes from anyway; days later the
operator regenerates). Only status/<jobId>.json (metadata, no G-code) remains, for the tracker.

t2649 (BACKLOG #78) — every job now delivers and reaches a terminal state (delivered/failed) synchronously
within the tick that claimed it: deliver -> "delivered" (terminal). There is no more TRACKED/DELIVER-ONLY
distinction (the beacon mechanism that split them is REMOVED — owner-directed 2026-09-04, never demonstrably
ran end-to-end); a job's own `.map.json`, when present, carries only `content_hash` and similar per-job
metadata now, never a progress-watch request.
"""
from abc import ABC, abstractmethod


class Backend(ABC):
    # t2097 — the loop's own poll cadence (bridge.py run_loop) used to be ONE number for every backend,
    # even though Drive's quota ceiling (see drive.py's own warning) makes a 1-5s poll actively harmful
    # there while being exactly right for local/R2. The backend is the thing that knows its own quota, so
    # it declares the floor rather than the loop growing a per-backend branch — 0 = no floor (the loop's
    # own configured interval stands as-is).
    POLL_FLOOR_S = 0.0

    @abstractmethod
    def list_inbox(self) -> list:
        """Return jobIds in inbox/, sorted ascending (== FIFO creation order)."""

    @abstractmethod
    def put_job(self, job_id: str, nc_bytes, mapping=None) -> None:
        """Write inbox/<jobId>.nc (+ .map.json if mapping given). The inbound side of the queue —
        used by the local-server ops layer (in cloud mode the web Worker does this instead)."""

    @abstractmethod
    def get_job(self, job_id: str):
        """Return (nc_bytes, map_dict) for a jobId. map_dict is {} if no map present."""

    @abstractmethod
    def put_status(self, job_id: str, status: dict) -> None:
        """Write status/<jobId>.json (PROTOCOL §5)."""

    @abstractmethod
    def get_status(self, job_id: str):
        """Return status/<jobId>.json as a dict, or None if absent."""

    @abstractmethod
    def list_statuses(self) -> list:
        """Return all status objects (for the queue/tracker view), sorted by jobId."""

    @abstractmethod
    def put_heartbeat(self, obj: dict) -> None:
        """Write gateway/heartbeat.json — liveness + descriptor for the cloud console (CONFIGS §6)."""

    # --- history (durable finished-job log: name, final state, duration) -------------------
    @abstractmethod
    def append_history(self, record: dict) -> None:
        """Append a finished-job record to history/<jobId>.json (seam for the History view)."""

    @abstractmethod
    def list_history(self, limit: int = 100) -> list:
        """Return recent history records, newest first (up to limit)."""

    @abstractmethod
    def delete_job(self, job_id: str) -> None:
        """Delete inbox/<jobId>.{nc,map.json} after delivery (every job — no retention; the file
        now lives on the controller). Removing it from inbox/ also keeps fairy from re-running it."""

    # --- CNCDISK file explorer (fairy publishes; web reads + issues delete commands) ---------
    @abstractmethod
    def put_cncdisk_index(self, index: dict) -> None:
        """Write cncdisk/index.json — fairy's listing of the controller's CNCDISK (PROTOCOL §7)."""

    @abstractmethod
    def list_commands(self) -> list:
        """Return pending [(cmdId, command_dict)] from commands/, sorted (FIFO)."""

    @abstractmethod
    def clear_command(self, cmd_id: str) -> None:
        """Delete commands/<cmdId>.json once fairy has processed it."""


def make_backend(config, auto_discover=False):
    """t2659 — `auto_discover` (drive only) is a single-candidate machine_name auto-adopt that makes a
    REAL Drive API call when the name is blank (see DriveBackend's own docstring). Defaults False so every
    existing caller — tests included — keeps today's side-effect-free construction; bridge.py's real
    startup path (build(), below) is the one caller that opts in."""
    if config.backend == "local":
        from .local_folder import LocalFolderBackend
        return LocalFolderBackend(config.local_root)
    if config.backend == "r2":
        from .r2 import R2Backend
        return R2Backend(config)
    if config.backend == "drive":
        # t2076 — BYO cloud: the USER's own Google Drive. Stdlib-only on purpose (see drive.py's header):
        # r2.py needs boto3, which build_fairy.ps1 EXCLUDES from the exe, so the R2 path can never run in
        # the shipped app. This one can.
        from .drive import DriveBackend
        return DriveBackend(config, auto_discover=auto_discover)
    raise ValueError(f"unknown backend: {config.backend!r} (expected 'local', 'r2' or 'drive')")
