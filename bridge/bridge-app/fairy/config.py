"""config.py — every knob in one place (ARCHITECTURE.md §4).

Defaults match the confirmed studio rig (COM6 @ 115200, Expert CNCDISK at 192.168.0.99).
R2 credentials are read from the environment so secrets never live in the repo.
"""
import json
import os
from dataclasses import dataclass


@dataclass
class Config:
    # --- backend (the rendezvous store; PROTOCOL §3) -----------------------
    backend: str = "local"                  # "local" (test) | "r2" (prod)
    local_root: str = "./_bridge_data"      # local-folder backend root (inbox/ status/)

    # --- R2 (only used when backend == "r2"); pulled from env --------------
    r2_endpoint: str = ""
    r2_bucket: str = ""
    r2_access_key: str = ""
    r2_secret_key: str = ""

    # --- transfer to the controller (transfer.py — the only hardware path) -
    # The controller's CNCDISK network share, e.g. \\192.168.0.99\CNCDISK or \\10.0.0.50\cncdisk.
    # Empty = unconfigured (set it in the Setup UI). MUST be a network share — the Setup layer rejects
    # local folders so the connection is always a real controller (no confusing local "sandbox").
    expert_dest: str = ""

    # --- Modbus slave (slave.py) ------------------------------------------
    com_port: str = "COM6"                  # SABRENT FTDI on CNC-FAIRY
    baud: int = 115200
    slave_id: int = 1
    enable_slave: bool = True               # False (--no-slave): skip the Modbus slave (UI/SMB-only; no serial/pymodbus)

    # --- Modbus MASTER position poll (master.py, Option 1) — t2063 --------
    # Opt-in, OFF by default: unproven on real hardware beyond a local synthetic slave (t2059/t2063).
    # MUTUALLY EXCLUSIVE with enable_slave/the Modbus slave above — same serial port (com_port/baud/
    # slave_id, reused as-is: it's the SAME wire), and the controller's own P279 parameter is a one-at-a-
    # time mode select (NO/Poll/Slave) — Poll is what MSETDATA needs, Slave is what this needs. See
    # master.py's own PositionPoller docstring.
    enable_position_poll: bool = False      # --position-poll
    position_poll_interval_s: float = 2.0   # seconds between read cycles
    position_registers: dict = None         # override any/all of master.py's default REGISTERS block(s); None = use the defaults as-is

    # --- loop / timing ----------------------------------------------------
    poll_interval_s: float = 5.0            # while idle (no active job)
    run_poll_interval_s: float = 1.0        # while a job is active (faster progress)
    stall_seconds: float = 120.0            # no new beacon this long -> "stalled"

    cncdisk_refresh_s: float = 15.0         # how often to republish the CNCDISK file listing
    heartbeat_s: float = 20.0               # how often to publish the gateway heartbeat

    # --- machine identity (which controller this gateway serves; CONFIGS §7) -------
    machine_id: str = ""                    # expected controller id; empty = unconfigured (verify skipped)
    machine_name: str = ""                  # human label, e.g. "Ultimate Bee"
    identity_filename: str = ".bridge-machine.json"   # written on the controller's disk

    # --- BYO cloud (desktop OAuth; oauth.py) -------------------------------
    google_client_id: str = ""              # Google "Desktop app" OAuth client id — enables the loopback Drive
                                            # sign-in inside the exe; empty = desktop Google disabled
    google_client_secret: str = ""          # the Desktop client's secret (non-confidential for installed apps);
                                            # sent in the token exchange when set (Google's Desktop flow expects it)

    # --- local server (offline / local configs: serve the console + ops API) ------
    serve: bool = False                     # run the local HTTP server (server.py)
    host: str = "0.0.0.0"                   # bind address — DEFAULT 0.0.0.0 so the exe is reachable from the LAN
                                            # (phone/tablet on the same wifi); set "127.0.0.1" in config.json for localhost-only
    port: int = 8765
    console_dir: str = ""                   # legacy fairy console; at / unless studio_dir is set (then /fairy/)
    studio_dir: str = ""                    # Studio web root (DDCS-Studio/web) served at / — the one-app face
    shared_dir: str = ""                    # monorepo shared/ dir, mounted at /shared/ (empty = no mount)
    open_browser: bool = False              # --open: pop the console in the default browser on start
    config_path: str = ""                   # where Setup persists config (empty -> ~/.ddcs-bridge/config.json)

    # --- WebSocket telemetry (Command Center broadcast; telemetry.py) --------------
    enable_ws: bool = False                 # --ws: start the WebSocket telemetry server
    ws_port: int = 8766                     # WebSocket bind port (separate from the HTTP port 8765)

    # config.json key (what the Setup UI / set_config writes) -> Config attribute it restores.
    _PERSIST_KEYS = {
        "dest": "expert_dest", "machine_name": "machine_name", "machine_id": "machine_id",
        "com_port": "com_port", "backend": "backend", "enable_slave": "enable_slave",
        "host": "host",   # LAN serving toggle ("127.0.0.1" | "0.0.0.0") — COMBINED-APP-PLAN Step 3
        "google_client_id": "google_client_id",   # Google Desktop OAuth client id (BYO cloud / Drive sign-in)
        "google_client_secret": "google_client_secret",
    }

    @staticmethod
    def default_config_path():
        return os.path.join(os.path.expanduser("~"), ".ddcs-bridge", "config.json")

    @staticmethod
    def default_local_root():
        """Stable per-user location for the local-folder backend's queue/status/history data (t2022) —
        NOT beside the executable. The install folder is unsafe for durable data twice over: a frozen
        PyInstaller build unpacks to a temp dir each run (an exe-relative path is discarded on exit), and
        even the unpacked desktop exe reads it as cwd-relative (see START_GATEWAY.bat / fairy_gateway.py),
        so a full reinstall to a new folder silently starts a fresh, empty store while the old one sits
        orphaned. Sibling to config.json/fairy.log/install_id — the SAME already-shipped stable-per-user
        convention (fairy_gateway.py) — directly under the user's home folder rather than buried in
        AppData, so it is a path the user can actually find and back up, not just a durable one."""
        return os.path.join(os.path.expanduser("~"), ".ddcs-bridge", "data")

    @classmethod
    def from_env(cls, **overrides):
        """Build a Config: defaults < env (secrets) < persisted Setup config.json < explicit CLI overrides.
        Loading the persisted file is what makes Setup survive a relaunch (the gateway reads back what the
        Setup UI saved); explicit CLI args still win over it."""
        c = cls()
        c.local_root = cls.default_local_root()   # stable by default; an explicit --root below still wins
        c.r2_endpoint = os.environ.get("R2_ENDPOINT", c.r2_endpoint)
        c.r2_bucket = os.environ.get("R2_BUCKET", c.r2_bucket)
        c.r2_access_key = os.environ.get("R2_ACCESS_KEY", c.r2_access_key)
        c.r2_secret_key = os.environ.get("R2_SECRET_KEY", c.r2_secret_key)
        cfg_path = overrides.get("config_path") or cls.default_config_path()
        persisted = {}
        try:
            with open(cfg_path, encoding="utf-8") as f:
                persisted = json.load(f)
            for jk, attr in cls._PERSIST_KEYS.items():
                if persisted.get(jk) is not None:
                    setattr(c, attr, persisted[jk])
        except (OSError, ValueError):
            pass

        # Seed Google OAuth if missing
        seeded = False
        if not c.google_client_id:
            try:
                bundled_oauth = os.path.join(os.path.dirname(__file__), "google_oauth.json")
                if os.path.exists(bundled_oauth):
                    with open(bundled_oauth, encoding="utf-8") as f:
                        oauth_data = json.load(f)
                    creds = oauth_data.get("web") or oauth_data.get("installed") or {}
                    cid = creds.get("client_id", "")
                    csec = creds.get("client_secret", "")
                    if cid:
                        c.google_client_id = cid
                        c.google_client_secret = csec
                        persisted["google_client_id"] = cid
                        persisted["google_client_secret"] = csec
                        seeded = True
            except Exception:
                pass

        if seeded:
            try:
                d = os.path.dirname(cfg_path)
                if d:
                    os.makedirs(d, exist_ok=True)
                with open(cfg_path, "w", encoding="utf-8") as f:
                    json.dump(persisted, f)
            except Exception:
                pass

        c.config_path = cfg_path
        for k, v in overrides.items():
            if v is not None:
                setattr(c, k, v)

        # t2022 — one-time, idempotent: port forward any job/history data an OLDER build left in the cwd-relative
        # "./_bridge_data" landmine (still the same folder this process just launched from) into the new stable
        # root, but only when local_root is genuinely the stable default — never when a caller (a test, --root,
        # a custom deployment) explicitly chose a different location.
        if c.backend == "local" and c.local_root == cls.default_local_root():
            from .backend.local_folder import migrate_legacy_root
            migrate_legacy_root(c.local_root)
        return c
