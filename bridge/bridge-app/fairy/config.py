"""config.py — every knob in one place (ARCHITECTURE.md §4).

Defaults match the confirmed studio rig (COM6 @ 115200, Expert CNCDISK at 192.168.0.99).
R2 credentials are read from the environment so secrets never live in the repo.
"""
import json
import os
from dataclasses import dataclass, field


@dataclass
class Config:
    # --- backend (the rendezvous store; PROTOCOL §3) -----------------------
    backend: str = "local"                  # "local" (test) | "r2" (dev's bucket) | "drive" (user's own Drive)
    local_root: str = "./_bridge_data"      # local-folder backend root (inbox/ status/)

    # --- R2 (only used when backend == "r2"); pulled from env --------------
    r2_endpoint: str = ""
    r2_bucket: str = ""
    r2_access_key: str = ""
    r2_secret_key: str = ""

    # --- Google Drive (backend == "drive"): BYO cloud, t2076 ---------------
    # Auth is the loopback OAuth already shipped (google_client_id/secret below + oauth.py) — no extra
    # credential to configure. The folder is created in the user's Drive root on first use.
    drive_folder: str = "DDCS Bridge"
    # t2097 — the poll floor used to live here, unread (bridge.py's run_loop slept poll_interval_s /
    # run_poll_interval_s for every backend alike, never this field). Removed — two sources for one number
    # is the shape this project keeps removing. The floor is now DriveBackend.POLL_FLOOR_S
    # (backend/drive.py) — the backend that knows its own quota declares it, and run_loop's sleep is
    # max(configured interval, backend.POLL_FLOOR_S).

    # --- transfer to the controller (transfer.py — the only hardware path) -
    # The controller's CNCDISK network share, e.g. \\192.168.0.99\CNCDISK or \\10.0.0.50\cncdisk.
    # Empty = unconfigured (set it in the Setup UI). MUST be a network share — the Setup layer rejects
    # local folders so the connection is always a real controller (no confusing local "sandbox").
    expert_dest: str = ""

    # --- Modbus MASTER position poll (master.py) — t2063/t2647 (BACKLOG #79) -----------------------------
    # Opt-in, OFF by default. Live position/run-state/executing-line reads, needs controller param
    # P279=Slave. com_port/baud/slave_id are this feature's OWN wire config now — t2649 (BACKLOG #78)
    # removed the Modbus SLAVE (the beacon checkpoint receiver, slave.py) these fields used to be shared
    # with; PositionPoller (master.py) is the only consumer left.
    com_port: str = "COM6"                  # SABRENT FTDI on CNC-FAIRY
    baud: int = 115200
    slave_id: int = 1
    enable_position_poll: bool = False      # --position-poll
    position_poll_interval_s: float = 2.0   # seconds between read cycles
    position_registers: dict = None         # override any/all of master.py's default REGISTERS block(s); None = use the defaults as-is

    # --- loop / timing ----------------------------------------------------
    poll_interval_s: float = 5.0            # how often the poller checks the inbox

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

    # --- audio feedback (chime.py; t2125, SOUND-PLAN.md) ---------------------------------------------
    # ⛔ NO CLI FLAG HERE ON PURPOSE. SOUND-PLAN.md's ruling is "exactly ONE toggle anywhere in the
    # product" — a --no-sound flag would be a second, independent source that could silently disagree
    # with what Studio's browser toggle says. This field exists ONLY as the gateway's live copy of that
    # ONE toggle, kept current by whatever Studio last pushed via POST /api/config (sound.js's
    # syncGatewaySound). Default True so a gateway that has never heard from a browser still chimes.
    # No `theme` field: SOUND-PLAN.md section 5 keeps the job sounds as the existing WAVs, unthemed —
    # chime.py has never needed a theme and still doesn't.
    sound_enabled: bool = True
    # t2125 amendment 3 — a MASTER mute (above) plus a PER-SOUND toggle. sound_off lists the action names
    # (ui/sound.js's ACTION keys, e.g. "job.arrived") Studio's browser has individually silenced; chime.py
    # is only ever asked about "job.arrived"/"job.delivered"/"job.failed", so entries for browser-only
    # actions (ui.*, job.sent) just sit here unused — same JSON list either way, no filtering needed.
    sound_off: list = field(default_factory=list)

    # --- PC role: gateway vs client (ROLES-PLAN.md S0; t2103) ---------------
    # ⛔ DERIVED, NEVER STORED AS THE PRIMARY SIGNAL: role_override is empty by default, and effective_role()
    # below computes gateway/client fresh from expert_dest every time — "almost nothing user-visible" (the
    # plan's own words) means every existing install keeps behaving exactly as it does today, with zero
    # config migration. This field exists ONLY for the one case derivation gets wrong: a machine carrying
    # STALE controller config (a disk path left over from bench work) would auto-classify as gateway and
    # claim jobs it should not. Set to "gateway" or "client" to override; "" (default) = trust the derivation.
    role_override: str = ""

    # config.json key (what the Setup UI / set_config writes) -> Config attribute it restores.
    _PERSIST_KEYS = {
        "dest": "expert_dest", "machine_name": "machine_name", "machine_id": "machine_id",
        "com_port": "com_port", "backend": "backend",
        "host": "host",   # LAN serving toggle ("127.0.0.1" | "0.0.0.0") — COMBINED-APP-PLAN Step 3
        "google_client_id": "google_client_id",   # Google Desktop OAuth client id (BYO cloud / Drive sign-in)
        "sound_enabled": "sound_enabled",   # t2125 — the master toggle, live from whatever Studio last pushed
        "sound_off": "sound_off",           # t2125 amendment 3 — the per-sound off-list, same channel
        "role_override": "role_override",   # t2103 (S0) — "", "gateway", or "client"
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
        orphaned. Sibling to config.json/gateway.log/install_id — the SAME already-shipped stable-per-user
        convention (fairy_gateway.py) — directly under the user's home folder rather than buried in
        AppData, so it is a path the user can actually find and back up, not just a durable one."""
        return os.path.join(os.path.expanduser("~"), ".ddcs-bridge", "data")

    @staticmethod
    def default_log_path():
        """t2113 (BACKLOG #3) — the ONE declared source for the desktop exe's log file location, so
        fairy_gateway.py (which writes it — see its own _setup_logging) and Ops.open_log (which offers to
        open it for Setup's 'view log' affordance) can never disagree about where it lives. Same sibling
        convention as config.json/install_id/data above."""
        return os.path.join(os.path.expanduser("~"), ".ddcs-bridge", "gateway.log")

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

        # ── Default backend to drive when the user already signed in and never chose (BACKLOG #81) ────
        # t2659 — "backend" ABSENT from persisted config (never written by Setup's own save at all — see
        # admin.js's own save.onclick, which always sends `backend`, so absence means "never saved once")
        # is a DIFFERENT fact from "backend PERSISTED as 'local'" (the user's own explicit choice, which
        # this must never override). Only the absent case is touched. `oauth.connected()` is a local
        # file-presence check (a stored refresh_token) — no network round trip, safe to call on every
        # startup. Signing in already said what the user wants; a user who never signed in stays local,
        # untouched (oauth.connected() is False, this whole branch is skipped).
        if "backend" not in persisted:
            try:
                from . import oauth
                if oauth.connected():
                    c.backend = "drive"
            except Exception:
                pass

        # ── Seed Google OAuth ────────────────────────────────────────────────────────────────────────
        # t2079b — SEEDING "IF MISSING" WAS NOT ENOUGH, and this is the correction to t2079's own fix.
        # t2079 made a FRESH install pick the Desktop client, but an EXISTING install already had the wrong
        # (Web) client PERSISTED in config.json from an earlier run — and a persisted value is never
        # re-seeded, so updating the app changed nothing and sign-in kept dying on redirect_uri_mismatch.
        # Hit live on ASUS immediately after shipping t2079.
        #
        # So a value that this code SEEDED is now marked as such (`google_client_source: "bundled"`), and a
        # bundled value that has since changed REPLACES it. A client id the USER typed carries no marker and
        # is never touched — the distinction the first attempt could not make, which is exactly why it could
        # only ever be a no-op or a clobber.
        bundled_id = bundled_secret = ""
        try:
            _bo = os.path.join(os.path.dirname(__file__), "google_oauth.json")
            if os.path.exists(_bo):
                with open(_bo, encoding="utf-8") as f:
                    _od = json.load(f)
                _cr = _od.get("installed") or _od.get("web") or {}
                bundled_id, bundled_secret = _cr.get("client_id", ""), _cr.get("client_secret", "")
        except Exception:
            pass
        # An install seeded BEFORE provenance existed carries no marker, which is precisely ASUS's case — so
        # the marker alone would never fire for the very machines that need it. One extra, SURGICAL signal:
        # the exact WEB client id that used to be seeded by mistake. It is public (it ships in
        # web/ui/cloud/providers.js for the browser, where a Web client is CORRECT), and matching it is proof
        # this value was auto-seeded rather than typed — nobody hand-enters the browser's client into the
        # gateway. Anything else with no marker is left alone.
        _MISSEEDED_WEB_ID = "895572525139-mapt84pm4lfudmjfq553k6pm4m2o0e77.apps.googleusercontent.com"
        was_seeded = (persisted.get("google_client_source") == "bundled"
                      or c.google_client_id == _MISSEEDED_WEB_ID)
        if bundled_id and was_seeded and c.google_client_id != bundled_id:
            c.google_client_id, c.google_client_secret = bundled_id, bundled_secret
            persisted["google_client_id"] = bundled_id
            persisted["google_client_secret"] = bundled_secret
            try:
                with open(cfg_path, "w", encoding="utf-8") as f:
                    json.dump(persisted, f, indent=2)
            except OSError:
                pass

        seeded = False
        if not c.google_client_id:
            try:
                bundled_oauth = os.path.join(os.path.dirname(__file__), "google_oauth.json")
                if os.path.exists(bundled_oauth):
                    with open(bundled_oauth, encoding="utf-8") as f:
                        oauth_data = json.load(f)
                    # t2079 — INSTALLED FIRST, and this ordering is the whole bug. THIS process is the
                    # desktop gateway: it signs in through the LOOPBACK flow
                    # (http://127.0.0.1:<port>/oauth/google/callback). A Google "Web application" client
                    # accepts ONLY redirect URIs registered against it one by one, so seeding a web client
                    # here produced `Error 400: redirect_uri_mismatch` on every machine — hit live on
                    # 2026-08-19. A "Desktop app" (installed) client accepts any loopback port by
                    # construction, which is exactly what this flow needs. Prefer it; fall back to `web`
                    # only so an old single-client credentials file still starts.
                    creds = oauth_data.get("installed") or oauth_data.get("web") or {}
                    cid = creds.get("client_id", "")
                    csec = creds.get("client_secret", "")
                    if cid:
                        c.google_client_id = cid
                        c.google_client_secret = csec
                        persisted["google_client_id"] = cid
                        persisted["google_client_secret"] = csec
                        persisted["google_client_source"] = "bundled"   # t2079b — provenance: safe to replace later
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


# --- PC role: gateway vs client (ROLES-PLAN.md S0; t2103) -------------------------------------------------
# "Client" does NOT mean no daemon — every exe runs the same gateway daemon and serves Studio's own UI on
# localhost regardless of role (ROLES-PLAN.md:24-28, the human's own words: "client also still are
# technically gateways"). The role governs exactly two things: whether the poller CLAIMS
# (poller.py's _maybe_claim, the authoritative gate — never the UI alone), and which settings the UI shows.
ROLE_GATEWAY = "gateway"
ROLE_CLIENT = "client"


def effective_role(config):
    """gateway ⇔ a controller disk is configured; client otherwise — DERIVED, never from reachability (a
    gateway with its controller unplugged is still a gateway; that is a STATUS question, a different axis).
    An explicit role_override wins when set, for the one case derivation gets wrong: stale config left over
    from bench work that no longer reflects what this PC actually is."""
    if config.role_override in (ROLE_GATEWAY, ROLE_CLIENT):
        return config.role_override
    return ROLE_GATEWAY if (config.expert_dest or "").strip() else ROLE_CLIENT


def role_conflict(config):
    """True when an explicit 'client' override coexists with a configured controller disk — a
    misconfiguration that must be SEEN, never silently resolved either way (ROLES-PLAN.md S0's own
    constraint). Only this direction is a conflict: an explicit 'gateway' override with no disk configured is
    not contradictory — it names an intent (this PC IS the gateway) that Setup just hasn't been finished for
    yet, not a disagreement between two facts."""
    return config.role_override == ROLE_CLIENT and bool((config.expert_dest or "").strip())
