"""ops.py — the API-first operations surface (CONFIGS §8).

Every capability is a plain method here, so the operations have ONE definition reused by every caller:
the local HTTP server (server.py), and later an MCP agent server or an embedded client. The console UI
is just one consumer. Keeping this layer thin + caller-agnostic is what makes "AI agent (MCP)" and
"portable into another app" free later.

These run ON the gateway, so file actions execute directly (backend + cncdisk). (In the *cloud* config the
console can't reach the gateway directly, so it writes to R2 and the gateway's poll loop picks it up —
same end calls, different trigger.)
"""
import datetime
import json
import os
import re

from . import __version__, cncdisk, identity

_SLUG = re.compile(r"[^A-Za-z0-9_.-]+")

# A controller disk must be a NETWORK SHARE (\\host\share or //host/share) — never a local folder,
# so the connection is always a real controller (no confusing local "sandbox").
def is_network_share(path):
    return bool(path) and (path.startswith("\\\\") or path.startswith("//"))


def make_job_id(name, now=None):
    """`<YYYYMMDDTHHMMSS>-<slug>` — lexicographically sortable = FIFO creation order (PROTOCOL §3)."""
    now = now or datetime.datetime.now()
    base = name.rsplit(".", 1)[0] if "." in name else name
    slug = _SLUG.sub("_", base).strip("_") or "job"
    return f"{now.strftime('%Y%m%dT%H%M%S')}_{now.microsecond:06d}-{slug}"


class Ops:
    def __init__(self, backend, config):
        self.backend = backend
        self.cfg = config

    # --- jobs ---------------------------------------------------------------
    def submit_job(self, name, nc, mapping=None):
        """Queue a job. nc = G-code (str or bytes). mapping present => tracked; absent => deliver-only."""
        job_id = make_job_id(name)
        self.backend.put_job(job_id, nc, mapping)
        tracked = bool(mapping and mapping.get("total_beacons"))
        return {"jobId": job_id, "name": name, "tracked": tracked}

    def list_queue(self):
        """The queue/tracker view: every status object, plus inbox jobs not yet given a status."""
        statuses = {s.get("jobId"): s for s in self.backend.list_statuses()}
        items = list(statuses.values())
        for jid in self.backend.list_inbox():
            if jid not in statuses:
                items.append({"jobId": jid, "state": "queued"})
        items.sort(key=lambda s: s.get("jobId", ""))
        return items

    def get_status(self, job_id):
        return self.backend.get_status(job_id)

    def list_history(self, limit=100):
        """Finished-job history: name, final state, duration (History view seam)."""
        return self.backend.list_history(limit)

    # --- CNCDISK files ------------------------------------------------------
    def list_files(self):
        return cncdisk.build_index(self.cfg.expert_dest)

    def delete_file(self, name):
        return cncdisk.apply_command(self.cfg.expert_dest, {"op": "delete", "target": name})

    def read_file(self, name):
        """Read one CNCDISK file's text (G-code text view seam). Same target validation as delete."""
        import os
        if not name or os.path.basename(name) != name:
            return {"ok": False, "error": f"invalid target: {name!r}"}
        full = os.path.join(self.cfg.expert_dest, name)
        if not os.path.isfile(full):
            return {"ok": False, "error": f"not found: {name}"}
        try:
            with open(full, "r", encoding="utf-8", errors="replace") as f:
                return {"ok": True, "name": name, "content": f.read()}
        except OSError as e:
            return {"ok": False, "error": str(e)}

    # --- identity / descriptor ---------------------------------------------
    def controller_reachable(self):
        if not self.cfg.expert_dest:
            return False
        try:
            return os.path.isdir(self.cfg.expert_dest)
        except OSError:
            return False

    def descriptor(self):
        """Who this gateway is + its live-ish state. Basis for the heartbeat and the Admin view."""
        found = identity.read(self.cfg.expert_dest, self.cfg.identity_filename)
        return {
            "machine_id": self.cfg.machine_id,
            "machine_name": self.cfg.machine_name,
            "controller_id": found.get("id") if found else None,
            "controller_name": found.get("name") if found else None,
            "controller_connected": self.controller_reachable(),
            "dest": self.cfg.expert_dest,            # which controller disk this gateway is pointed at
            "backend": self.cfg.backend,
            "version": __version__,
        }

    # --- controller profile (shared with Studio) ---------------------------
    def profile(self):
        """Build a controller profile in the SHARED shape DDCS Studio consumes
        (see web/shared/js/profiles/controllerProfiles.js): {id, name, source, hardwareTabs, atc}.

        The controller's persisted config is the `setting` file (1000 × f64, index = param #) on
        SYSDISK and decodes over SMB. The captured `cfg_utf8` (full param schema) localized the I-O
        indices and a 2026-06-10 panel cross-check CONFIRMED them (Fixed Probe #575 = IN02, Floating
        Probe #578 = port 10); see controllers/expert-m350/FINDINGS.md "Profile I/O map". So when a live
        `setting` is read we derive hardwareTabs + a `pins` block from the real I-O config; otherwise we
        fall back to the builtin baseline (source = builtin).
        """
        prof = {
            "id": "ddcs-expert-m350",
            "name": "DDCS Expert M350",
            "source": "builtin",
            "hardwareTabs": ["probes", "limits"],
            "atc": {"toolTableBaseVar": 1430, "defaultToolCount": 10},
        }
        params = self._read_setting_params()
        if params is not None:
            prof["source"] = "controller"
            prof["paramCount"] = len(params)
            self._map_setting_to_profile(params, prof)
            prof["validation"] = self.validate_profile(params)   # reuse the read; UI shows match/warnings
        return prof

    # `setting` input-signal indices (the `-m16` group in cfg_utf8): each input is a triple
    # [port#, enable, active-level]; port 0 == unassigned, enable == 1 when assigned, level at +2.
    # The level offset (+2, not +1) was pinned by a live differential toggle 2026-06-10: changing the
    # Fixed-Probe level on the panel moved #577. Param #s are firmware-defined; values are this
    # controller's wiring. CONFIRMED 2026-06-10 (see FINDINGS "Profile I/O map").
    _SETTER_PORT = 575      # Fixed Probe (tool-setter); enable at +1, active-level at +2 (#577)
    _PROBE_PORT = 578       # Floating Probe (3D touch);  enable at +1, active-level at +2 (#580)
    _LIMIT_PORTS = {        # negative + positive hard-limit inputs per axis
        "xMin": 515, "yMin": 518, "zMin": 521,
        "xMax": 530, "yMax": 533, "zMax": 536,
    }
    _ATC_IO_PORTS = (623, 626, 629, 697, 750, 753)  # tool release/lock/open/close in + ATC outputs

    def _map_setting_to_profile(self, params, prof):
        """Derive hardwareTabs + a `pins` block from a live `setting` array (read-only; never raises).
        An input is 'configured' when its port index is a nonzero integer (0 == unassigned)."""
        def port(i):
            try:
                v = params[i]
            except (IndexError, TypeError):
                return 0
            return int(v) if isinstance(v, (int, float)) and v > 0 else 0

        def level(i):  # active-level (0/1) at port+2; valid as 0, so don't gate on >0 like port()
            try:
                v = params[i]
            except (IndexError, TypeError):
                return 0
            return int(v) if isinstance(v, (int, float)) else 0

        setter, probe = port(self._SETTER_PORT), port(self._PROBE_PORT)
        limits = {k: port(i) for k, i in self._LIMIT_PORTS.items()}
        has_probe = bool(setter or probe)
        has_limits = any(limits.values())
        has_atc = any(port(i) for i in self._ATC_IO_PORTS)

        tabs = []
        if has_probe:
            tabs.append("probes")
        if has_atc:                       # off on a manual machine (all ATC I-O unassigned)
            tabs.append("atc")
        if has_limits:
            tabs.append("limits")
        prof["hardwareTabs"] = tabs

        # `pins` is an extra block Studio pre-fills user settings from (not part of the tab contract).
        # Active-level is at port+2 (#577/#580, differential-confirmed); panel "N"/"P" = Negative/Positive
        # electric level, so 0 = N (active-low), 1 = P (active-high). Only emit a pin when assigned.
        prof["pins"] = {
            "probe": probe, "probeLevel": level(self._PROBE_PORT + 2) if probe else 0,
            "setter": setter, "setterLevel": level(self._SETTER_PORT + 2) if setter else 0,
            "limits": {k: v for k, v in limits.items() if v},
        }

    # Expected `setting` shape + anchor sanity for the Expert — used to confirm the live file decoded
    # as aligned f64 params (not garbage / a wrong-controller dump). Anchors are [CONFIRMED] in FINDINGS:
    # #266/#267 baud code, #279 Modbus 0/1, #284 net-boot 0/1/2, #296 parity, #297 stop.
    _EXPECTED_PARAM_COUNT = 1000
    _ANCHOR_RANGES = {266: (0, 10), 267: (0, 10), 279: (0, 1), 284: (0, 2), 296: (0, 2), 297: (0, 1)}

    def validate_profile(self, params=None):
        """Read-only check: does the connected controller match the expected profile?
        Returns a dict (never raises). `ok`: True (matches), False (mismatch/garbage), or None (skipped —
        controller unreachable). Compares the LIVE-derived hardwareTabs against the builtin baseline and
        sanity-checks the decode via known anchors, so a wrong share / wrong-size dump / ATC-misconfig
        surfaces (at startup and in the UI) instead of silently feeding Studio bad data. Pass `params`
        to reuse an already-read `setting` (profile() does this); otherwise it reads once."""
        if params is None:
            params = self._read_setting_params()
        if params is None:
            return {"ok": None, "reason": "controller unreachable — validation skipped"}

        warnings = []
        count = len(params)
        if count != self._EXPECTED_PARAM_COUNT:
            warnings.append(f"setting has {count} params, expected {self._EXPECTED_PARAM_COUNT} "
                            f"(wrong share, truncated read, or different controller?)")
        anchors_ok = True
        for idx, (lo, hi) in self._ANCHOR_RANGES.items():
            v = params[idx] if idx < count else None
            if v is None or not isinstance(v, (int, float)) or v != v or not (lo <= v <= hi):
                anchors_ok = False
                warnings.append(f"anchor #{idx}={v} outside expected [{lo},{hi}] — decode may be misaligned")

        # Detected (live) vs builtin baseline for this controller id.
        detected = {}
        self._map_setting_to_profile(params, detected)
        baseline = ["probes", "limits"]              # the M350 builtin baseline (see controllerProfiles.js)
        det_tabs = detected.get("hardwareTabs", [])
        missing = [t for t in baseline if t not in det_tabs]     # baseline expects it, controller lacks it
        extra = [t for t in det_tabs if t not in baseline]       # controller has it, baseline didn't list it
        if missing:
            warnings.append(f"baseline expects {missing} but the controller has no such I/O configured")
        if "atc" in extra:
            warnings.append("controller has tool-change I/O wired — ATC is OFF in the baseline profile")

        return {
            "ok": anchors_ok and not warnings,
            "paramCount": count, "anchorsOk": anchors_ok,
            "detectedTabs": det_tabs, "baselineTabs": baseline,
            "missing": missing, "extra": extra, "warnings": warnings,
        }

    def _read_setting_params(self):
        """Decode the controller's `setting` file as little-endian f64 (index = param #).
        Returns list[float], or None if unreachable/unreadable. Read-only; never raises.

        `setting` lives on the **SYSDISK** share (not CNCDISK = expert_dest) — confirmed by the Phase-1
        capture — so try expert_dest first, then the SYSDISK sibling derived by swapping the share name."""
        import struct
        if not self.controller_reachable():
            return None
        candidates = [os.path.join(self.cfg.expert_dest, "setting")]
        dest = (self.cfg.expert_dest or "").rstrip("\\/")
        if dest.upper().endswith("CNCDISK"):
            candidates.append(os.path.join(dest[: -len("CNCDISK")] + "SYSDISK", "setting"))
        for full in candidates:
            try:
                with open(full, "rb") as f:
                    raw = f.read()
            except OSError:
                continue
            n = len(raw) // 8
            if n == 0:
                continue
            try:
                return list(struct.unpack("<%dd" % n, raw[: n * 8]))
            except struct.error:
                continue
        return None

    # --- gateway setup (the Setup UI; local gateway only — the cloud can't reach in) --------
    @staticmethod
    def _lan_ip():
        """This box's LAN address (for the 'open this on your phone' hint). Best-effort, never raises."""
        import socket
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))           # no traffic sent — just picks the outbound interface
            ip = s.getsockname()[0]
            s.close()
            return ip
        except OSError:
            return ""

    def get_config(self):
        c = self.cfg
        return {
            "machine_name": c.machine_name, "machine_id": c.machine_id,
            "dest": c.expert_dest, "com_port": c.com_port,
            "backend": c.backend, "enable_slave": c.enable_slave,
            "host": c.host, "port": c.port, "lan_ip": self._lan_ip(),
            "is_remote": is_network_share(c.expert_dest),
            "controller_connected": self.controller_reachable(),
        }

    def _config_file(self):
        return self.cfg.config_path or os.path.join(os.path.expanduser("~"), ".ddcs-bridge", "config.json")

    def set_config(self, updates):
        """Apply + persist gateway setup. dest must be a network share (no local folders). Fields the
        gateway reads live (name/id/dest/com) take effect now; backend/beacons need a restart."""
        c = self.cfg
        if "dest" in updates:
            d = (updates.get("dest") or "").strip()
            if d and not is_network_share(d):
                return {"ok": False, "error": r"controller disk must be a network share like \\10.0.0.50\cncdisk (not a local folder)"}
        if "host" in updates and updates["host"] is not None and updates["host"] not in ("127.0.0.1", "0.0.0.0"):
            return {"ok": False, "error": 'host must be "127.0.0.1" (this PC only) or "0.0.0.0" (LAN)'}
        restart = False
        if "machine_name" in updates: c.machine_name = (updates["machine_name"] or "").strip()
        if "machine_id" in updates: c.machine_id = (updates["machine_id"] or "").strip()
        if "dest" in updates: c.expert_dest = (updates["dest"] or "").strip()
        if updates.get("com_port"): c.com_port = updates["com_port"].strip()
        for k in ("enable_slave", "backend", "host"):   # host rebind needs a server restart
            if k in updates and updates[k] is not None and getattr(c, k) != updates[k]:
                setattr(c, k, updates[k]); restart = True
        path = self._config_file()
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            existing = {}
            if os.path.exists(path):
                with open(path, encoding="utf-8") as f:
                    existing = json.load(f)
            existing.update({k: v for k, v in updates.items() if v is not None})
            with open(path, "w", encoding="utf-8") as f:
                json.dump(existing, f, indent=2)
        except (OSError, ValueError) as e:
            return {"ok": False, "error": f"applied, but couldn't save {path}: {e}"}
        return {"ok": True, "restart_needed": restart, "config_path": path, "config": self.get_config()}
