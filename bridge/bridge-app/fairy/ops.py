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
        self._detect_cache = None  # (dest, result): the fingerprint is stable per connected controller

    # Per-controller baseline profiles (the shared shape Studio consumes). detect_controller() picks
    # which one; the live `setting` derivation below refines the Expert. The V4.1 `setting` schema
    # differs (1500 params, different I/O indices — see controllers/v4.1), so its live derivation is a
    # separate, not-yet-mapped step; for now V4.1 serves its builtin baseline.
    _CONTROLLERS = {
        "expert-m350": {"id": "ddcs-expert-m350", "name": "DDCS Expert M350", "source": "builtin",
                        "hardwareTabs": ["probes", "limits"],
                        "atc": {"toolTableBaseVar": 1430, "defaultToolCount": 10}},
        "v4.1": {"id": "ddcs-v4.1", "name": "DDCS V4.1", "source": "builtin",
                 "hardwareTabs": ["probes", "limits"], "atc": None},
    }
    _FW_KEYS = ("DDCSV4", "DDCSE", "Expert", "M350", "MSETDATA", "MGETDATA", "Modbus")

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
        det = self.detect_controller()
        return {
            "machine_id": self.cfg.machine_id,
            "machine_name": self.cfg.machine_name,
            "controller_id": found.get("id") if found else None,
            "controller_name": found.get("name") if found else None,
            "controller_connected": self.controller_reachable(),
            "controller_family": det.get("family"),       # v4.1 | expert-m350 | unknown (read-only fingerprint)
            "controller_firmware": det.get("firmware"),
            "dest": self.cfg.expert_dest,            # which controller disk this gateway is pointed at
            "backend": self.cfg.backend,
            "version": __version__,
        }

    # --- controller detection (V4.1 vs Expert) -----------------------------
    @staticmethod
    def _sysdisk_for(dest):
        """SYSDISK share path for a given CNCDISK dest (swap the trailing share name). None if no dest.
        Shared by the connected-controller path and the LAN scan (which fingerprints arbitrary hosts)."""
        dest = (dest or "").rstrip("\\/")
        if not dest:
            return None
        if dest.upper().endswith("CNCDISK"):
            return dest[: -len("CNCDISK")] + "SYSDISK"
        return dest  # already SYSDISK, or an unknown share name — try as-is

    def _sysdisk_path(self):
        """The SYSDISK share for the connected controller (holds the firmware + `setting`)."""
        return self._sysdisk_for(self.cfg.expert_dest)

    def detect_controller(self):
        """Read-only fingerprint of the connected controller (V4.1 vs Expert), from its firmware `.out`
        on the SYSDISK share — the Python port of controllers/identify-controller.ps1. The filename is
        decisive in the common case (`ddcsv4.out` = V4.1); only an ambiguous name triggers a string
        scan of the binary (Modbus is Expert-only). Cached per dest. Read-only; never raises."""
        dest = self.cfg.expert_dest or ""
        if self._detect_cache and self._detect_cache[0] == dest:
            return self._detect_cache[1]
        result = self._fingerprint_sysdisk(self._sysdisk_path())
        self._detect_cache = (dest, result)
        return result

    def _fingerprint_sysdisk(self, sysdisk):
        """Family/firmware from a SYSDISK path's `.out` firmware file (`ddcsv4.out` = V4.1; else a filename
        match, else a read-only string scan as tiebreaker). Read-only; never raises. Shared by
        detect_controller (connected dest) and scan_controllers (arbitrary LAN hosts)."""
        result = {"family": "unknown", "firmware": None, "signals": {}}
        if not (sysdisk and os.path.isdir(sysdisk)):
            return result
        fw = None
        try:
            outs = [n for n in sorted(os.listdir(sysdisk)) if n.lower().endswith(".out")]
            fw = outs[0] if outs else None
        except OSError:
            fw = None
        name = (fw or "").lower()
        family, sig = "unknown", {}
        if name == "ddcsv4.out":
            family = "v4.1"
        elif any(t in name for t in ("ddcse", "expert", "m350")):
            family = "expert-m350"
        elif fw:  # ambiguous filename — scan the firmware strings as a tiebreaker (read-only)
            try:
                with open(os.path.join(sysdisk, fw), "rb") as f:
                    text = f.read().decode("ascii", "ignore").lower()
            except OSError:
                text = ""
            sig = {k: (k.lower() in text) for k in self._FW_KEYS}
            is_v4 = sig.get("DDCSV4", False)
            is_exp = any(sig.get(k, False) for k in ("DDCSE", "Expert", "M350", "MSETDATA", "MGETDATA", "Modbus"))
            family = "v4.1" if (is_v4 and not is_exp) else "expert-m350" if (is_exp and not is_v4) else "unknown"
        return {"family": family, "firmware": fw, "signals": sig}

    def scan_controllers(self, timeout=0.3, workers=64):
        """Discover DDCS controllers on the gateway PC's local /24: hosts with SMB (445) open that expose a
        SYSDISK share whose `.out` fingerprints as V4.1/Expert. Read-only; never raises. Windows (UNC).
        Returns [{ip, dest, family, firmware}] — `dest` is the CNCDISK share to set as expert_dest."""
        import socket
        import concurrent.futures
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))   # no packets sent — just learns the primary outbound IP
            net = ".".join(s.getsockname()[0].split(".")[:3])
            s.close()
        except Exception:
            return []

        def smb_open(host):
            try:
                socket.create_connection((host, 445), timeout=timeout).close()
                return host
            except Exception:
                return None

        hosts = ["%s.%d" % (net, i) for i in range(1, 255)]
        with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as ex:
            live = [h for h in ex.map(smb_open, hosts) if h]
        found = []
        for h in live:
            for share in ("cncdisk", "CNCDISK"):
                dest = r"\\%s\%s" % (h, share)
                fp = self._fingerprint_sysdisk(self._sysdisk_for(dest))
                if fp["family"] != "unknown":
                    found.append({"ip": h, "dest": dest, "family": fp["family"], "firmware": fp["firmware"]})
                    break
        return found

    # --- controller profile (shared with Studio) ---------------------------
    def profile(self):
        """Build a controller profile in the SHARED shape DDCS Studio consumes
        (see web/shared/js/profiles/controllerProfiles.js): {id, name, source, hardwareTabs, atc}.

        We FINGERPRINT the connected controller first (detect_controller) and serve the matching
        baseline. For an Expert we then refine it from the live `setting` file (1000 × f64 on SYSDISK,
        index = param #): the captured `cfg_utf8` localized the I-O indices and a 2026-06-10 panel
        cross-check CONFIRMED them (Fixed Probe #575 = IN02, Floating Probe #578 = port 10; see
        controllers/expert-m350/FINDINGS.md). A V4.1's `setting` schema differs (1500 params, different
        indices) so its live derivation is not mapped yet — it serves its builtin baseline.
        """
        det = self.detect_controller()
        family = det.get("family")
        if family == "v4.1":
            prof = {**self._CONTROLLERS["v4.1"], "detected": det}
            return prof
        # Expert M350, or unknown → default to the Expert baseline + live-setting refinement (as before).
        prof = {**self._CONTROLLERS["expert-m350"], "detected": det}
        params = self._read_setting_params()
        if params is not None:
            prof["source"] = "controller"
            prof["paramCount"] = len(params)
            self._map_setting_to_profile(params, prof)
            self._map_geometry_to_profile(params, prof)
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

    # Machine-frame geometry + WCS offset table from the live `setting` array (param-space; macro = param + 500).
    # Indices CONFIRMED against cfg_utf8/eng + a live-dump decode (2026-06-17, see VERIFY-AT-MACHINE.md):
    #   soft limits neg #161-163 / pos #166-168  (±9999 = axis sentinel: "no soft limit on that axis")
    #   homing dir  #112-114  (0 = negative, 1 = positive)
    #   mach-zero   #235-237  ("mach pos at the mechanical zero switch")
    #   active WCS  #78  (1..6 = G54..G59);  WCS offset table base #305 (= macro #805), stride 5 = [X,Y,Z,A,B]
    # A WCS register holds the MACHINE coordinate of that work origin (direct `#805 = #880` sets G54 X = current
    # machine X), so workOrigin (the active WCS's X/Y/Z) IS the sim's wcsOffset: part = machine - workOrigin.
    _SOFT_NEG = (161, 162, 163)
    _SOFT_POS = (166, 167, 168)
    _HOMING_DIR = (112, 113, 114)
    _MACH_ZERO = (235, 236, 237)
    _ACTIVE_WCS = 78
    _WCS_BASE = 305
    _WCS_STRIDE = 5
    _SENTINEL = 9999.0

    def _map_geometry_to_profile(self, params, prof):
        """Emit `geometry` (travel / soft-limits / homing / mach-zero) + `wcs` (active index, offset table,
        and workOrigin = machine coords of part-zero) from the live `setting` array.
        Read-only; never raises (bad indices fall back to 0 / None)."""
        def at(i, default=0.0):
            try:
                v = params[i]
                return float(v) if isinstance(v, (int, float)) else default
            except (IndexError, TypeError):
                return default

        def span(neg_i, pos_i):  # travel = pos - neg; a ±9999 sentinel on either end means "no soft limit"
            neg, pos = at(neg_i, -self._SENTINEL), at(pos_i, self._SENTINEL)
            if abs(neg) >= self._SENTINEL or abs(pos) >= self._SENTINEL or pos <= neg:
                return None
            return round(pos - neg, 4)

        active = at(self._ACTIVE_WCS, 1.0)
        active = int(active) if 1 <= active <= 6 else 1
        base = self._WCS_BASE + (active - 1) * self._WCS_STRIDE

        table = {}
        for w in range(6):
            b = self._WCS_BASE + w * self._WCS_STRIDE
            table["g%d" % (54 + w)] = [round(at(b), 4), round(at(b + 1), 4), round(at(b + 2), 4)]

        prof["geometry"] = {
            "travel": {"x": span(self._SOFT_NEG[0], self._SOFT_POS[0]),
                       "y": span(self._SOFT_NEG[1], self._SOFT_POS[1]),
                       "z": span(self._SOFT_NEG[2], self._SOFT_POS[2])},
            "softLimits": {"xMin": at(self._SOFT_NEG[0]), "xMax": at(self._SOFT_POS[0]),
                           "yMin": at(self._SOFT_NEG[1]), "yMax": at(self._SOFT_POS[1]),
                           "zMin": at(self._SOFT_NEG[2]), "zMax": at(self._SOFT_POS[2])},
            "homingDir": {"x": int(at(self._HOMING_DIR[0])), "y": int(at(self._HOMING_DIR[1])),
                          "z": int(at(self._HOMING_DIR[2]))},
            "machZero": {"x": at(self._MACH_ZERO[0]), "y": at(self._MACH_ZERO[1]), "z": at(self._MACH_ZERO[2])},
        }
        prof["wcs"] = {
            "active": active,
            "workOrigin": {"x": round(at(base), 4), "y": round(at(base + 1), 4), "z": round(at(base + 2), 4)},
            "table": table,
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

    # --- live variable values (read-only watch list) -----------------------
    # Values are read from the controller's disk over SMB. CONFIRMED: #100-499 live in `uservar`
    # (slot = #var-100), f64 LE — true on both the V4.1 (SYSDISK, 400 slots) and the Expert (CNCDISK,
    # 450 slots), so we just try both shares. #0-99 are locals (RAM-only, never on disk). #500+ ranges
    # (setting/coord1/positions) have an unverified macro-address mapping on each controller — we return
    # available:false rather than show a wrong value off a machine tool. NOTE: values flush only at run
    # start/end, so this is a snapshot of the last run, not a live tick.
    def _read_uservar(self):
        import struct
        if not self.controller_reachable():
            return None
        for base in (self._sysdisk_path(), self.cfg.expert_dest):
            if not base:
                continue
            try:
                with open(os.path.join(base, "uservar"), "rb") as f:
                    raw = f.read()
            except OSError:
                continue
            n = len(raw) // 8
            if n:
                try:
                    return list(struct.unpack("<%dd" % n, raw[: n * 8]))
                except struct.error:
                    continue
        return None

    def _var_value(self, n, uservar):
        try:
            n = int(n)
        except (TypeError, ValueError):
            return {"available": False, "reason": "not a number"}
        if 0 <= n <= 99:
            return {"available": False, "source": "local", "reason": "local var - RAM-only, not on disk"}
        if uservar is not None:
            slot = n - 100
            if 0 <= slot < len(uservar):
                return {"available": True, "value": uservar[slot], "source": "uservar"}
        if not self.controller_reachable():
            return {"available": False, "reason": "controller unreachable"}
        # Known system ranges we can't read yet — say which kind, and that the per-controller disk-slot
        # mapping needs one bench confirmation (read the file, change a known value, see which slot moves).
        if 500 <= n <= 1499:
            return {"available": False, "source": "setting", "reason": "system parameter - bench-map pending"}
        if n >= 1500:
            return {"available": False, "source": "runtime", "reason": "position/runtime var - bench-map pending"}
        return {"available": False, "source": "tbd", "reason": "mapping pending bench verification"}

    def read_vars(self, nums):
        """Read a watch list of variable numbers (read-only). Returns {connected, values:{n:{...}}}."""
        uservar = self._read_uservar()
        return {
            "connected": self.controller_reachable(),
            "snapshot": "last run start/end",
            "values": {str(n): self._var_value(n, uservar) for n in nums},
        }

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
        if "port" in updates and updates["port"] is not None:   # serve port: only our registered ports (keeps OAuth JS origins valid)
            try:
                p = int(updates["port"])
            except (TypeError, ValueError):
                return {"ok": False, "error": "port must be a number"}
            if p not in (8765, 8766, 8767, 8768, 8769):
                return {"ok": False, "error": "port must be one of 8765-8769 (keeps the OAuth JS origins valid)"}
            updates = {**updates, "port": p}             # persist the int
            if c.port != p:
                c.port = p; restart = True               # takes effect on next launch (fairy_gateway._preferred_port)
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
