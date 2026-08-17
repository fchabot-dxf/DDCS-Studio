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
    def submit_job(self, name, nc, mapping=None, content_hash=None):
        """Queue a job. nc = G-code (str or bytes). mapping present => tracked; absent => deliver-only.

        t2020 — content_hash (a SHA-256 of the client's NORMALISED G-code — see send.js's own contentHashOf,
        reusing portingArc.js's normaliseGcode rather than a second normaliser) rides in the SAME mapping dict
        so it survives for a deliver-only job too (mapping would otherwise be None/absent): it is what lets
        two sends of the identical program LINK in the History view, independent of tracked vs deliver-only
        and independent of jobId, which stays a fresh timestamp per send on purpose (never collapses two
        sends into one record)."""
        if content_hash:
            mapping = {**(mapping or {}), "content_hash": content_hash}
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

    # --- SYSDISK macro files: K-button programs (key-N.nc) + the O100nn library (slib-m.nc) ---------
    # WRITE to the controller's macro disk. Whitelisted names only (no traversal, no firmware files); the
    # existing file is ALWAYS backed up to <name>.bak before any change. The controller loads slib-m.nc at
    # boot, so a merged M-code needs a REBOOT to take effect (the UI says so); key-N.nc is a button program.
    def _sysfile_path(self, name):
        base = self._sysdisk_path()
        if not base or not name or not re.match(r"^(key-[1-7]\.nc|slib-m\.nc|T\.nc|error\.nc|probe\.nc|mulprobe\.nc)$", name):
            return None
        return os.path.join(base, name)

    def read_sysfile(self, name):
        """Read a whitelisted SYSDISK macro file (text) — for previewing / merging slib-m.nc."""
        if not self.controller_reachable():
            return {"ok": False, "error": "controller unreachable"}
        p = self._sysfile_path(name)
        if not p:
            return {"ok": False, "error": f"name not allowed: {name!r}"}
        try:
            with open(p, "r", encoding="utf-8", errors="replace") as f:
                return {"ok": True, "name": name, "content": f.read()}
        except OSError as e:
            return {"ok": False, "error": str(e)}

    def write_sysfile(self, name, content, mode="write"):
        """Write (overwrite) or append a whitelisted SYSDISK macro file. Backs the existing file up to
        <name>.bak first. mode='append' adds to the end — used to merge an O100nn block into slib-m.nc
        WITHOUT rewriting the factory content (binary-preserved original + appended block)."""
        if not self.controller_reachable():
            return {"ok": False, "error": "controller unreachable"}
        p = self._sysfile_path(name)
        if not p:
            return {"ok": False, "error": f"name not allowed: {name!r}"}
        try:
            backed = False
            if os.path.exists(p):
                with open(p, "rb") as src, open(p + ".bak", "wb") as dst:
                    dst.write(src.read())
                backed = True
            with open(p, "a" if mode == "append" else "w", encoding="utf-8", newline="") as f:
                f.write(content)
            return {"ok": True, "name": name, "backup": (name + ".bak") if backed else ""}
        except OSError as e:
            return {"ok": False, "error": str(e)}

    def delete_sysfile(self, name):
        """Delete a whitelisted SYSDISK macro file (standalone hooks/buttons)."""
        if name == "slib-m.nc":
            return {"ok": False, "error": "slib-m.nc cannot be deleted, only overwritten"}
        if not self.controller_reachable():
            return {"ok": False, "error": "controller unreachable"}
        p = self._sysfile_path(name)
        if not p:
            return {"ok": False, "error": f"name not allowed: {name!r}"}
        try:
            if os.path.exists(p):
                os.remove(p)
            # Remove backup if exists too
            if os.path.exists(p + ".bak"):
                os.remove(p + ".bak")
            return {"ok": True, "name": name}
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
        if result.get("family") == "unknown":
            # Firmware `.out` missing/ambiguous → fall back to the `setting` param COUNT, a reliable
            # discriminator the validator already relies on: a V4.1's setting has ~1500 params, an
            # Expert/M350's ~1000 (see controllers/v4.1 + _EXPECTED_PARAM_COUNT). Keeps a V4.1 from
            # defaulting to the Expert baseline (which then false-flags a profile MISMATCH).
            try:
                params = self._read_setting_params()
            except Exception:
                params = None
            if params is not None:
                n = len(params)
                fam = "v4.1" if n >= 1400 else "expert-m350" if 900 <= n <= 1100 else "unknown"
                if fam != "unknown":
                    result = {**result, "family": fam,
                              "signals": {**result.get("signals", {}), "paramCount": n, "via": "param-count"}}
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
            params = self._read_setting_params()   # 1500×f64; schema differs from the Expert but the decode is the same
            if params is not None:
                prof["source"] = "controller"
                prof["paramCount"] = len(params)
                _eng = self._read_eng() or ""
                self._map_geometry_to_profile_v41(params, prof, _eng)   # eng = the MEANING (by name), setting = the VALUES
                self._map_spindle_to_profile(params, prof, _eng)        # t780 — V4.1 #188 interface + #189 mapping axis
                self._map_wcs_to_profile_v41(params, prof, self._read_coord1())            # WCS table from the SYSDISK coord1 file (t654)
            return prof
        # Expert M350, or unknown → default to the Expert baseline + live-setting refinement (as before).
        prof = {**self._CONTROLLERS["expert-m350"], "detected": det}
        params = self._read_setting_params()
        if params is not None:
            prof["source"] = "controller"
            prof["paramCount"] = len(params)
            self._map_setting_to_profile(params, prof)
            self._map_geometry_to_profile(params, prof)
            self._map_spindle_to_profile(params, prof, self._read_eng() or "")   # t780 — Expert #79 interface + #80 mapping axis
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
    _HOMING_SPEED = (107, 108, 109)   # per-axis homing feed (X/Y/Z); #118 = homing precision (seed Studio's Homing Setup)
    _HOMING_PRECISION = 118
    _MACH_ZERO = (235, 236, 237)
    _ACTIVE_WCS = 78
    _WCS_BASE = 305
    _WCS_STRIDE = 5
    _SENTINEL = 9999.0

    # ── V4.1 geometry: DERIVED BY NAME from the firmware `eng` dictionary (declare-not-hardcode, t650 amendment). The `eng`
    # is a self-describing param-definition file the controller ships (assets/firmware/.../eng, also on SYSDISK):
    #   #235 -t1 -s1"Soft-limited postion value of X--" -s2"unit" -m11 -min=-9999 -max=9999
    # so the MEANING comes from the eng (parsed once), the VALUES from the live/captured `setting`. This future-proofs any DDCS
    # family shipping an eng and avoids the two-controllers index trap (controllers/README.md). Confirmed vs the June capture:
    # #234 Enable-soft-limit = 0 (DISABLED on this rig — surfaced honestly), #235-237/#240-242 soft-limit neg/pos pairs
    # (X/Y/Z = -3830/-3900/-800 · 0/0/0), #199-202 home dir, #204-207 home search speed, #209-212 positioning speed.
    _ENG_NAME = {   # the eng-name patterns → the geometry role (case-insensitive; the firmware's "postion" typo tolerated)
        "enable":   r"enable\s+soft",
        "softNeg":  r"soft.?limited\s+po\w+\s+value\s+of\s+{AX}--",
        "softPos":  r"soft.?limited\s+po\w+\s+value\s+of\s+{AX}\+\+",
        "homeDir":  r"{AX}\s+axis\s+home\s+direction",
        "seek":     r"{AX}\s+axis\s+home\s+search\s+speed",
        "slow":     r"{AX}\s+axis\s+home\s+positioning\s+speed",
    }
    # ── V4.1 WCS store (t654). The 6-axis coordinate table lives in the SYSDISK `coord1` file (54 × f64 = 9 systems × 6 axes
    # X,Y,Z,A,B,C), NOT in `setting`/uservar — so we READ THE FILE. Block index = the firmware's "current coordinate system"
    # ENUM (default_vars_v3.js #16: 0=G53, 1=G54, 2=G55, … 6=G59, 7=MACH), so G54 = block 1 … G59 = block 6 (block 0 = G53).
    # PINNED by 3 grounds: (1) selcoord.rc binds the dialog rows ~1512-1|G54 … ~1542-1|G59 (G54=#1512, stride 6); (2) the #16
    # enum orders the file; (3) the June backup coord1 has the ONLY taught row at block 1 (= G54: X-300.29 Y-116.06 Z1547.27),
    # block 0 (G53) zero — the default first-taught WCS. Active system = setting #16 (0=G53 … 7=MACH; 1..6 → Studio G54..G59).
    _V41_ACTIVE_WCS = 16       # setting "current coordinate system": 0=G53, 1=G54, … 6=G59, 7=MACH
    _V41_COORD_STRIDE = 6      # coord1: 6 axes per system; the block index IS the coord-system enum (block 1 = G54)

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

        def far_reach(i):
            """The signed FAR-END machine coord of axis i = the reach from home. The machine homes to an extreme, so
            the home end reads ~0 and the far end ~±span → the SIGNED far value IS machine.<axis>. A ±9999 sentinel end
            means 'no soft limit that side'; when only ONE end is sentinel the other IS the far reach (the human's X:
            neg=-9999 sentinel, pos=756 → far +756). BOTH ends sentinel → None (the axis is not soft-limited → NOT
            declared on the controller; the human's Z). Both real → the larger-magnitude end is the far reach (Y:
            neg=-776, pos=+5 → the home end is ~+5, the far reach is -776)."""
            neg, pos = at(self._SOFT_NEG[i], -self._SENTINEL), at(self._SOFT_POS[i], self._SENTINEL)
            neg_sent, pos_sent = abs(neg) >= self._SENTINEL, abs(pos) >= self._SENTINEL
            if neg_sent and pos_sent:
                return None
            if neg_sent:
                return pos
            if pos_sent:
                return neg
            return neg if abs(neg) >= abs(pos) else pos

        def travel(i):  # the |signed far reach| — the axis EXTENT (Studio scales it by homeDir for the sign). None = undeclared.
            fr = far_reach(i)
            return None if fr is None else round(abs(fr), 4)

        def home_edge(i):
            """The declared home END ('min'|'max') per axis + a conflict flag. PRIMARY = the homing-direction param
            (#112-114: 0 → home at the MIN end, 1 → the MAX end). The soft-limit far reach (when the axis IS declared)
            CONFIRMS it — home sits OPPOSITE the far end (far +X ⇒ home min; far -Y ⇒ home max) — and WINS on a
            disagreement (the soft-limit machine coords are unambiguous; the dir bit's polarity is [TO TEST]). Returns
            (end | None, conflict) — end is None only when neither signal exists."""
            hd = at(self._HOMING_DIR[i], None)
            dir_end = ("min" if int(hd) == 0 else "max") if hd is not None else None
            fr = far_reach(i)
            sl_end = None if fr is None else ("min" if fr >= 0 else "max")
            end = sl_end or dir_end
            return end, bool(sl_end and dir_end and sl_end != dir_end)

        def home_sign(i):
            """Travel SIGN (±1) Studio's sim needs = which side of machine-zero (home) the working envelope
            sits on. PRIMARY signal = the soft-limit MACHINE coordinates (#161-168): neg/pos are machine
            coords of the envelope ends, so the side of 0 they fall on IS the travel direction — unambiguous,
            no polarity guess. Since the machine homes to an extreme, the home end reads ~0 and the far end
            ~±span, so the envelope midpoint's sign gives the direction. FALLBACK (both ends sentinel/zero):
            the homing-direction param (#112-114: 0 = home toward the negative end → envelope/travel positive;
            1 = home toward the positive end → travel negative). Returns +1, -1, or None (undeterminable →
            Studio keeps the user's current sign). Never returns 0 (the web treats 0 as 'no info')."""
            neg, pos = at(self._SOFT_NEG[i], -self._SENTINEL), at(self._SOFT_POS[i], self._SENTINEL)
            neg_ok, pos_ok = abs(neg) < self._SENTINEL, abs(pos) < self._SENTINEL
            if neg_ok and pos_ok and (neg + pos) != 0:
                return 1 if (neg + pos) > 0 else -1
            if pos_ok and pos != 0:
                return 1 if pos > 0 else -1
            if neg_ok and neg != 0:
                return 1 if neg > 0 else -1
            hd = at(self._HOMING_DIR[i], None)
            if hd is None:
                return None
            return 1 if int(hd) == 0 else -1

        active = at(self._ACTIVE_WCS, 1.0)
        active = int(active) if 1 <= active <= 6 else 1
        base = self._WCS_BASE + (active - 1) * self._WCS_STRIDE

        table = {}
        for w in range(6):
            b = self._WCS_BASE + w * self._WCS_STRIDE
            table["g%d" % (54 + w)] = [round(at(b), 4), round(at(b + 1), 4), round(at(b + 2), 4)]

        he = {axis: home_edge(i) for i, axis in enumerate(("x", "y", "z"))}
        prof["geometry"] = {
            # travel = the axis EXTENT magnitude (sentinel-aware far reach: X 756, Y 776; None = the controller
            # doesn't declare that axis — the human's Z: both ends ±9999). Studio scales it by homeDir for the sign.
            "travel": {"x": travel(0), "y": travel(1), "z": travel(2)},
            "softLimits": {"xMin": at(self._SOFT_NEG[0]), "xMax": at(self._SOFT_POS[0]),
                           "yMin": at(self._SOFT_NEG[1]), "yMax": at(self._SOFT_POS[1]),
                           "zMin": at(self._SOFT_NEG[2]), "zMax": at(self._SOFT_POS[2])},
            "homingDir": {"x": int(at(self._HOMING_DIR[0])), "y": int(at(self._HOMING_DIR[1])),
                          "z": int(at(self._HOMING_DIR[2]))},
            # homeDir = the derived ±1 travel sign Studio consumes (geometry.homeDir); homingDir above is the
            # raw 0/1 param it's derived from, kept for debugging.
            "homeDir": {"x": home_sign(0), "y": home_sign(1), "z": home_sign(2)},
            # homeEdge = the declared HOME END per axis ('min'|'max') → Studio's per-axis <edge>Home limit row (t594);
            # homeEdgeConflict = the homing-dir bit disagrees with the soft-limit far reach (Studio flags it, prefers soft-limit).
            "homeEdge": {"x": he["x"][0], "y": he["y"][0], "z": he["z"][0]},
            "homeEdgeConflict": {"x": he["x"][1], "y": he["y"][1], "z": he["z"][1]},
            # homingFeeds = the per-axis homing feed (#107-109) + precision (#118) to seed Studio's Homing Setup.
            "homingFeeds": {"speed": {"x": at(self._HOMING_SPEED[0]), "y": at(self._HOMING_SPEED[1]), "z": at(self._HOMING_SPEED[2])},
                            "precision": at(self._HOMING_PRECISION)},
            "machZero": {"x": at(self._MACH_ZERO[0]), "y": at(self._MACH_ZERO[1]), "z": at(self._MACH_ZERO[2])},
        }
        prof["wcs"] = {
            "active": active,
            "workOrigin": {"x": round(at(base), 4), "y": round(at(base + 1), 4), "z": round(at(base + 2), 4)},
            "table": table,
        }

    def _parse_eng(self, text):
        """Parse the controller's self-describing `eng` param dictionary → {index: {name, unit, group, type, enums}}.
        A DECLARED, reusable parser (any DDCS family shipping an eng future-proofs for free). Read-only; never raises.
        Line form: `#235 -t1 -s1"<name>" -s2"<unit>" -m11 -min=… -max=… -i0"<enum0>" -i1"<enum1>"`."""
        out = {}
        for line in (text or "").splitlines():
            m = re.match(r"\s*#(\d+)\b", line)
            if not m:
                continue
            nm = re.search(r'-s1"([^"]*)"', line)
            un = re.search(r'-s2"([^"]*)"', line)
            grp = re.search(r"-m(\d+)", line)
            typ = re.search(r"-t(\d+)", line)
            out[int(m.group(1))] = {
                "name": nm.group(1) if nm else "", "unit": un.group(1) if un else "",
                "group": int(grp.group(1)) if grp else None, "type": int(typ.group(1)) if typ else None,
                "enums": {int(a): b for a, b in re.findall(r'-i(\d+)"([^"]*)"', line)},
            }
        return out

    def _v41_geo_indices(self, eng):
        """Resolve the geometry/homing param indices from the eng BY NAME (never a hardcoded index). Returns a dict of
        role → index (or per-axis {x,y,z} → index); a role not found in this firmware's eng resolves to None (→ N/A)."""
        def find(pat):
            rx = re.compile(pat, re.I)
            for i in sorted(eng):
                if rx.search(eng[i]["name"]):
                    return i
            return None
        idx = {"enable": find(self._ENG_NAME["enable"])}
        for role in ("softNeg", "softPos", "homeDir", "seek", "slow"):
            idx[role] = {ax: find(self._ENG_NAME[role].format(AX=ax.upper())) for ax in ("x", "y", "z")}
        return idx

    # ── SPINDLE (t780 1b) — the DECLARED spindle interface + mapping axis, BY NAME from the eng, decoded through EACH
    # eng's OWN enums (V4.1 #188/#189 · Expert #79/#80 — never cross-applied). Seeds ONLY interface + mappingAxis
    # (readable machine truth); tapCapable/reversible stay USER attestations (never seeded). The JS twin (dumpImport.js
    # mapSpindle) reproduces this EXACTLY — the cross-language golden pins both.
    _SPINDLE_ENG = {"iface": r"spindle\s+interface\s+type", "mapAxis": r"spindle\s+mapping\s+axis"}

    @staticmethod
    def _norm_spindle_iface(label):
        return "pul-dir-axis" if re.search(r"pul|dir", label or "", re.I) else "analog"

    @staticmethod
    def _norm_spindle_axis(label):
        m = re.match(r"\s*([XYZA])\b", label or "", re.I)
        if m:
            return m.group(1).upper()
        return "A" if re.search(r"4th", label or "", re.I) else ""

    def _map_spindle_to_profile(self, params, prof, eng_text):
        """Emit `spindle` = {interface, mappingAxis} (+ raw/label/idx provenance) BY NAME through the eng's own enums.
        Read-only; never raises; leaves prof untouched if the eng has neither field."""
        eng = self._parse_eng(eng_text or "")
        if not eng:
            return
        def find(pat):
            rx = re.compile(pat, re.I)
            for i in sorted(eng):
                if rx.search(eng[i]["name"]):
                    return i
            return None
        if_idx, ax_idx = find(self._SPINDLE_ENG["iface"]), find(self._SPINDLE_ENG["mapAxis"])
        if if_idx is None and ax_idx is None:
            return
        def read_enum(idx):
            if idx is None or idx < 0 or idx >= len(params):
                return (None, "")
            try:
                raw = int(params[idx])
            except (ValueError, TypeError):
                raw = 0
            return (raw, eng[idx]["enums"].get(raw, ""))
        if_raw, if_lbl = read_enum(if_idx)
        ax_raw, ax_lbl = read_enum(ax_idx)
        prof["spindle"] = {
            "interface": self._norm_spindle_iface(if_lbl), "interfaceLabel": if_lbl, "interfaceRaw": if_raw,
            "mappingAxis": self._norm_spindle_axis(ax_lbl), "mappingAxisLabel": ax_lbl, "mappingAxisRaw": ax_raw,
            "_idx": {"interface": if_idx, "mappingAxis": ax_idx},
        }

    def _map_geometry_to_profile_v41(self, params, prof, eng_text):
        """V4.1 geometry DERIVED BY NAME from the eng (the MEANING) + the live/captured `setting` (the VALUES). The eng
        gives a soft-limit neg/pos PAIR per axis (X--/X++ …) exactly like the Expert, so the SAME far-reach/home derivation
        applies. The Enable-soft-limit flag (#234) is surfaced honestly (0 = disabled → the envelope values are the declared
        config, not enforced). WCS work offsets stay N/A on V4.1 (HIGH vars #1506+, not in the setting/uservar param space).
        Read-only; never raises. `geometryRaw` carries the resolved indices + raw values so the review shows the ground."""
        eng = self._parse_eng(eng_text)
        gi = self._v41_geo_indices(eng)

        def at(i, default=0.0):
            if i is None:
                return default
            try:
                v = params[i]
                return float(v) if isinstance(v, (int, float)) else default
            except (IndexError, TypeError):
                return default
        def has(i):
            return i is not None and 0 <= i < len(params)

        SENT = self._SENTINEL
        neg_i, pos_i, dir_i = gi["softNeg"], gi["softPos"], gi["homeDir"]
        seek_i, slow_i = gi["seek"], gi["slow"]

        def far_reach(ax):   # the SIGNED far-end machine coord: the larger-|·| soft-limit end (sentinel-aware). None = undeclared.
            neg, pos = at(neg_i[ax], -SENT), at(pos_i[ax], SENT)
            neg_s, pos_s = abs(neg) >= SENT, abs(pos) >= SENT
            if neg_s and pos_s:
                return None
            if neg_s:
                return pos
            if pos_s:
                return neg
            if neg == 0 and pos == 0:
                return None
            return neg if abs(neg) >= abs(pos) else pos
        def travel(ax):
            fr = far_reach(ax)
            return None if fr is None else round(abs(fr), 4)
        def home_sign(ax):   # PRIMARY = soft-limit machine coords; FALLBACK = the home-direction bit (0=neg→+1, 1=pos→-1)
            neg, pos = at(neg_i[ax], -SENT), at(pos_i[ax], SENT)
            no, po = abs(neg) < SENT, abs(pos) < SENT
            if no and po and (neg + pos) != 0:
                return 1 if (neg + pos) > 0 else -1
            if po and pos != 0:
                return 1 if pos > 0 else -1
            if no and neg != 0:
                return 1 if neg > 0 else -1
            hd = at(dir_i[ax], None) if has(dir_i[ax]) else None
            return None if hd is None else (1 if int(hd) == 0 else -1)
        def home_edge(ax):   # ('min'|'max', conflict): soft-limit far end is PRIMARY, the home-dir bit CONFIRMS/conflicts (soft-limit wins)
            fr = far_reach(ax)
            sl = None if fr is None else ("min" if fr >= 0 else "max")
            hd = at(dir_i[ax], None) if has(dir_i[ax]) else None
            de = None if hd is None else ("min" if int(hd) == 0 else "max")
            return (sl or de), bool(sl and de and sl != de)

        axes = ("x", "y", "z")
        he = {ax: home_edge(ax) for ax in axes}
        enable = at(gi["enable"], 1.0) if has(gi["enable"]) else 1.0
        speed = {ax: (at(seek_i[ax]) if has(seek_i[ax]) else None) for ax in axes}
        any_speed = any(v for v in speed.values())
        prof["geometry"] = {
            "travel": {ax: travel(ax) for ax in axes},
            "softLimits": {"xMin": at(neg_i["x"]), "xMax": at(pos_i["x"]), "yMin": at(neg_i["y"]),
                           "yMax": at(pos_i["y"]), "zMin": at(neg_i["z"]), "zMax": at(pos_i["z"])},
            "homeDir": {ax: home_sign(ax) for ax in axes},
            "homeEdge": {ax: he[ax][0] for ax in axes},
            "homeEdgeConflict": {ax: he[ax][1] for ax in axes},
            # homing feeds ARE grounded on V4.1 (eng-named): search speed = seek, positioning speed = slow.
            "homingFeeds": ({"speed": speed, "precision": (at(slow_i["x"]) if has(slow_i["x"]) else None)} if any_speed else None),
            "machZero": None,                                   # not a named V4.1 param → N/A
            "softLimitEnabled": bool(int(enable)) if has(gi["enable"]) else None,   # #234 — surfaced honestly (0 = disabled)
        }
        prof["geometryRaw"] = {"indices": {"softNeg": neg_i, "softPos": pos_i, "enable": gi["enable"], "homeDir": dir_i, "seek": seek_i},
                               "softLimitEnabled": enable}
        prof["wcs"] = None   # default N/A; _map_wcs_to_profile_v41 fills it from the SYSDISK coord1 file when readable (t654)

    def _map_wcs_to_profile_v41(self, params, prof, coord1):
        """V4.1 WCS table + active system from the SYSDISK `coord1` file (t654) — the SAME payload shape the Expert branch
        emits, so the review modal renders the V4.1 WCS rows for free. coord1 is block-indexed by the coordinate-system enum
        (block 0 = G53, block 1 = G54, … block 6 = G59), 6 axes per block; the active system is setting #16. Read-only;
        never raises. coord1 unreadable → wcs stays whatever the geometry mapper set (None)."""
        if not coord1 or len(coord1) < 7 * self._V41_COORD_STRIDE:   # need at least G53..G59 (blocks 0..6)
            return
        def cell(block, ax):
            i = block * self._V41_COORD_STRIDE + ax
            try:
                v = coord1[i]
                return round(float(v), 4) if isinstance(v, (int, float)) else 0.0
            except (IndexError, TypeError):
                return 0.0
        # G54 = block 1 … G59 = block 6 (the enum: block 0 = G53). Table keyed g54..g59, [X,Y,Z] like the Expert.
        table = {"g%d" % (54 + w): [cell(w + 1, 0), cell(w + 1, 1), cell(w + 1, 2)] for w in range(6)}
        # active = setting #16 (0=G53 … 6=G59, 7=MACH) → Studio's 1-based G54..G59 index; G53/MACH (0/7) → default G54.
        try:
            enum = int(params[self._V41_ACTIVE_WCS]) if isinstance(params[self._V41_ACTIVE_WCS], (int, float)) else 0
        except (IndexError, TypeError):
            enum = 0
        active = enum if 1 <= enum <= 6 else 1
        wo = table["g%d" % (53 + active)]
        prof["wcs"] = {"active": active, "workOrigin": {"x": wo[0], "y": wo[1], "z": wo[2]}, "table": table}
        prof["wcsRaw"] = {"activeEnum": enum, "block1IsG54": True}   # the pin, surfaced for the review's transparency

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
        # The M350 baseline (1000 params + probes/limits + M350 anchors) doesn't apply to a V4.1: it has a
        # different setting schema (~1500 params, different I/O indices) and serves its own builtin baseline,
        # so validating it against the Expert profile would always false-flag a mismatch. Skip it.
        if self.detect_controller().get("family") == "v4.1":
            return {"ok": None, "reason": "V4.1 controller — uses its builtin baseline, not the M350 profile check"}
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

    def _read_eng(self):
        """Read the controller's self-describing `eng` param dictionary (TEXT) from SYSDISK. Returns str, or None if
        unreachable/unreadable. Read-only; never raises. Same share logic as _read_setting_params (eng lives on SYSDISK)."""
        if not self.controller_reachable():
            return None
        candidates = [os.path.join(self.cfg.expert_dest, "eng")]
        dest = (self.cfg.expert_dest or "").rstrip("\\/")
        if dest.upper().endswith("CNCDISK"):
            candidates.append(os.path.join(dest[: -len("CNCDISK")] + "SYSDISK", "eng"))
        for full in candidates:
            try:
                with open(full, "rb") as f:
                    return f.read().decode("utf-8", "replace")
            except OSError:
                continue
        return None

    def _read_coord1(self):
        """Decode the V4.1 `coord1` file as little-endian f64 — the coordinate-system table (9 systems × 6 axes = 54 f64,
        block index = the 'current coordinate system' enum: 0=G53, 1=G54, … 6=G59). On SYSDISK, same share as `setting`.
        Returns list[float], or None if unreachable/unreadable. Read-only; never raises."""
        import struct
        if not self.controller_reachable():
            return None
        candidates = [os.path.join(self.cfg.expert_dest, "coord1")]
        dest = (self.cfg.expert_dest or "").rstrip("\\/")
        if dest.upper().endswith("CNCDISK"):
            candidates.append(os.path.join(dest[: -len("CNCDISK")] + "SYSDISK", "coord1"))
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

    def _read_camsetting(self):
        """Decode the controller's `camsetting` file as little-endian f64 — the ATC / CAM parameter tables
        #1000-1499 (slot = #var-1000). Mapping boundary-confirmed by the captured sentinels (#1000/#1050/
        #1099/#1100/#1300/#1499). Holds current tool #1300, capacity #1301, pocket XYZ #1330/#1350/#1370 and
        the tool-length table #1430+. On SYSDISK. Returns list[float], or None if unreachable. Never raises."""
        import struct
        if not self.controller_reachable():
            return None
        for base in (self._sysdisk_path(), self.cfg.expert_dest):
            if not base:
                continue
            try:
                with open(os.path.join(base, "camsetting"), "rb") as f:
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

    def _read_default_setting(self):
        """Decode `default_setting` — the factory baseline of `setting` (same index = param # layout, 1000×f64).
        Used to flag which pulled #0-999 params the operator actually changed from default. On SYSDISK. Never raises."""
        import struct
        if not self.controller_reachable():
            return None
        for base in (self._sysdisk_path(), self.cfg.expert_dest):
            if not base:
                continue
            try:
                with open(os.path.join(base, "default_setting"), "rb") as f:
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

    # --- live variable values (read-only watch list) -----------------------
    # Values are read from the controller's disk over SMB (read-only snapshot, flushed at run start/end):
    #   #0-99    locals — RAM-only, never on disk (unavailable)
    #   #100-549 `uservar`  (slot = #var-100), f64 LE — V4.1 SYSDISK 400 slots / Expert CNCDISK 450 slots
    #   #100-999 `setting`  (index = #var) — persisted system params: WCS #805+, serial, servo, …
    #   #1000-1499 `camsetting` (slot = #var-1000) — ATC/CAM tables: current tool, pockets, tool lengths
    #   #1500+   position/runtime — bench-map pending (unavailable)
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

    def _var_value(self, n, files):
        uservar, setting, camsetting = files.get("uservar"), files.get("setting"), files.get("camsetting")
        default_setting = files.get("default_setting")
        try:
            n = int(n)
        except (TypeError, ValueError):
            return {"available": False, "reason": "not a number"}
        if 0 <= n <= 99:
            return {"available": False, "source": "local", "reason": "local var - RAM-only, not on disk"}
        # uservar: live macro vars #100-549 (slot = #var-100). No factory baseline → userSet = non-zero.
        if uservar is not None and 100 <= n and (n - 100) < len(uservar):
            v = uservar[n - 100]
            return {"available": True, "value": v, "source": "uservar", "userSet": v != 0}
        # camsetting: ATC/CAM tables #1000-1499 (slot = #var-1000). No default file → userSet = non-zero (untaught = 0).
        if 1000 <= n <= 1499 and camsetting is not None and (n - 1000) < len(camsetting):
            v = camsetting[n - 1000]
            return {"available": True, "value": v, "source": "camsetting", "userSet": v != 0}
        # setting: persisted system params #0-999 (index = #var) — WCS #805+, serial, servo, … userSet = differs
        # from the factory `default_setting` baseline (so the import can flag what the operator actually changed).
        if 100 <= n <= 999 and setting is not None and n < len(setting):
            v = setting[n]
            out = {"available": True, "value": v, "source": "setting"}
            if default_setting is not None and n < len(default_setting):
                out["default"] = default_setting[n]
                out["userSet"] = abs(v - default_setting[n]) > 1e-9
            else:
                out["userSet"] = v != 0
            return out
        if not self.controller_reachable():
            return {"available": False, "reason": "controller unreachable"}
        if n >= 1500:
            return {"available": False, "source": "runtime", "reason": "position/runtime var - bench-map pending"}
        return {"available": False, "source": "tbd", "reason": "mapping pending bench verification"}

    def read_vars(self, nums):
        """Read a watch list of variable numbers (read-only). Returns {connected, values:{n:{...}}}.
        Reads only the disk files a request actually needs (uservar always; setting/camsetting on demand)."""
        ints = []
        for x in nums:
            try:
                ints.append(int(x))
            except (TypeError, ValueError):
                pass
        files = {"uservar": self._read_uservar()}
        if any(100 <= v <= 999 for v in ints):
            files["setting"] = self._read_setting_params()
            files["default_setting"] = self._read_default_setting()   # factory baseline → userSet diff
        if any(1000 <= v <= 1499 for v in ints):
            files["camsetting"] = self._read_camsetting()
        return {
            "connected": self.controller_reachable(),
            "snapshot": "last run start/end",
            "values": {str(n): self._var_value(n, files) for n in nums},
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
