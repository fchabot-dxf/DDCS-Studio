# DDCS Expert — ATC workflow & I/O dialect (from the firmware backup)

_Derived from the controller firmware backup `slib-m.nc` (the M-code library) + `T.nc`. This is how a
tool change **actually** runs on the controller — the reference the ATC generator + profile build to._
_Source: `skills/ddcs-expert/references/firmware-backup-2025-12-31/.../nand1-1/slib-m.nc`._

---

## 1. The big picture

```
your program:           T2 M6
  controller:           sets #1504 = 2 (target tool)  →  runs  T.nc
  T.nc (the hook):      orchestrates the change using the built-in M-codes + positions below
```

- **`T.nc`** is the fixed-name tool-change hook (auto-run on a tool change). Stock content is just `T#1504`
  (a stub — the machine we dumped is manual change). **`#1504` = target tool**, **`#1300` = current tool.**
- The controller already provides every **actuator + sensor as an M-code** (below). The ATC macro doesn't
  bit-bang pins — it calls these M-codes, and **which physical pin each one uses is a parameter** (§3).

---

## 2. M-code dialect (built-in — `O10NNN` defines `MNNN`)

| M-code | Function | M-code | Function |
|---|---|---|---|
| **M154 / M155** | **Drawbar** release / clamp | **M156 / M157** | Locating pin extend / retract |
| **M158 / M159** | Blow-tool on / off | **M160 / M161** | **Magazine** forward / back |
| **M162 / M163** | **Dust cover** open / close | **M150 / M151** | Gripper open / close |
| **M166 / M167** | Cleaning blow on / off | **M176–M179** | Coolant 1 / 2 on / off |
| **M168–M175** | Multi-purpose outputs 1–4 | **M180 / M181** | Servo-lock mode on / off |
| **M102** | packaged tool-change move sequence | **M103 / M104** | change start / change end |

**Sensor waits (block until the input matches):**
| M-code | Waits for | M-code | Waits for |
|---|---|---|---|
| **M300** | E-stop | **M301 / M302** | Drawbar **released / clamped** |
| **M303 / M304** | Magazine **open / closed** | **M305 / M306** | Gripper open / closed |
| **M307** | Servo in-position | | |

---

## 3. I/O is **parameter-driven** (the key insight)

Each function reads a **port / enable / level** parameter triple, then sets/reads the bit. So **assigning a
pin = writing a controller parameter** — which is exactly what Studio's Input/Output table should map to.

- **Set output N:** `#[1552 + N …]`  · **Read input N:** `#[1520 + N − 1]`  (≈ 24 inputs, ≈ 20 outputs — matches the hardware)

**Output function → parameter triple** (`port`, `enable`, `level`):
| Function | port · enable · level | Function | port · enable · level |
|---|---|---|---|
| Drawbar (M154/5) | **#1250 · #1251 · #1252** | Locating pin (M156/7) | #1256 · #1257 · #1258 |
| Blow tool (M158/9) | #1259 · #1260 · #1261 | Magazine (M160/1) | **#1265 · #1266 · #1267** |
| Dust cover (M162/3) | **#1268 · #1269 · #1270** | Gripper (M150/1) | #1262 · #1263 · #1264 |
| Coolant 1 (M176/7) | #1289 · #1290 · #1291 | Coolant 2 (M178/9) | #1292 · #1293 · #1294 |

**Input (sensor) function → parameter triple:**
| Sensor | port · enable · level | Sensor | port · enable · level |
|---|---|---|---|
| Drawbar released (M301) | #1123 · #1124 · #1125 | Drawbar clamped (M302) | **#1126 · #1127 · #1128** |
| Magazine open (M303) | #1129 · #1130 · #1131 | Magazine closed (M304) | #1197 · #1198 · #1199 |
| E-stop (M300) | #1120 · #1121 · #1122 | Servo in-pos (M307) | #1194 · #1195 · #1196 |

> ⚠ **Namespace:** the `#12xx` above are the **runtime macro vars** the M-code subprograms read (straight
> from `slib-m.nc`). The **panel / profile I/O config** — which *physical pin* each signal is on — lives in
> the separate **`setting`-param space** (labelled by `cfg_utf8`), e.g. on the studio Expert the Fixed Probe =
> `setting#575` (port 2), Floating Probe = `setting#578` (port 10). **`bridge/controllers/expert-m350/FINDINGS.md`
> → "Profile I/O map" is the authoritative, machine-confirmed source** — the gateway pulls the profile from
> there. Don't cross-read the two number spaces.

---

## 4. Positions & tool table (parameters)

- **Tool-change position** (fixed-spot changer, used by M102): `#1306` safe Z · `#1320/#1321` start XY · `#1322` dwell · `#1323/#1324` end XY · `#1325/#1326` after-change XY · `#1327` feed.
- **Per-pocket positions** (linear magazine): the `#1330+` / `#1350+` / `#1370+` X/Y/Z tables — one set per pocket. (This is the **straight/linear** path; our Settings magazine table fills these.)
- **Tool length offsets:** `#[1430 + (tool−1)]`. **Tool count:** `#1301`. **ATC enabled:** `#1302`.

---

## 5. So how the generator should work

- **Studio Input/Output rows → controller parameter triples.** A "Drawbar" output row's pin → `#1250`; its level → `#1252`. A "Drawbar clamped" sensor input's pin → `#1126`. (The profile holds this function→param map; the I/O table holds the user's actual pin numbers.)
- **Straight / linear magazine:** the wizard emits a **`T.nc`** that reads `#1504`, looks up that tool's pocket from the **Settings magazine table** (writes/uses `#1330+`), then runs the real sequence: `M157`/`M159` (safe), move to pocket, `M154` (release), `M301` (wait released), retract, move to new pocket, insert, `M155` (clamp), `M302` (wait clamped), apply `#1430` offset, return. Save as `T.nc`.
- **Fixed-spot / disk:** can lean on the built-in **M102** (uses `#1320–#1327`) + a magazine rotate output, rather than per-pocket moves.

---

## 6. Profiles — who builds them (3 controllers, 3 sources)

| Controller | Connectivity | How its profile is built |
|---|---|---|
| **Expert / M350** | Modbus + SMB | **bridge pulls it live** (`GET /api/profile`) — DONE |
| **V4.1** | SMB (bench) | bridge pulls it (once `cfg_utf8` is grabbed) |
| **3.1** | **offline — no network** | **owner exports settings → Studio parses the export → profile** |

**All three produce the same shared JSON shape.** Three *sources*:
- **Studio, standalone** — build/edit by hand (the Hardware tabs *are* the editor) and **import / export** as a file. No controller needed.
- **Pulled from the controller (the bridge's job)** — when Studio is bridged, the gateway reads the live controller and hands Studio a profile. **The bridge is the only thing that talks to the controller.**
- **Built from an offline controller's settings export (the DDCS 3.1 path)** — the **3.1 has no network**, so it can't be pulled. The owner uses the controller's *export settings* feature to produce a file; Studio (or a desk tool) **parses that export → a profile + a reusable profile template**. **Needs a sample 3.1 export to map its format** (we have no 3.1) — the 3.1's analogue of the Expert's `cfg_utf8`. Distinct from importing a Studio-JSON profile: this parses the *controller's native* dump.

**Expert profile = DONE** (gateway `Ops.profile()`, verified live): `hardwareTabs ["probes","limits"]`, ATC off,
pins probe=10 / setter=2 / limits{xMin:20, yMax:23, zMax:21}, level `N`/`P` = active-low/high. Decoded from the
captured **`SYSDISK/cfg_utf8`** (the param schema). _(Note: live floating-probe = port **10**, not the Studio
default `3` — reconcile the Studio seed; the 3D YunKia may be a separate input.)_

**4.1 gap — what's missing:** the V4.1 dump has `setting` (values) + full firmware (`slib-m.nc` dialect, factory
macros) + the **Variables-list xlsx**, but **no `cfg_utf8`** — the schema that made the Expert's `setting`
indices decodable without blind toggling. Since the 4.1 is **booted**, grab **`\\10.0.0.50\SYSDISK\cfg_utf8`**
(+ a fresh `setting`); then its I/O map is desk-decodable the same way. The 4.1's param numbers + M-codes
**differ** from the Expert (e.g. no `M115`; `M105–108`/`G128` homing) — don't cross-apply.

> ⚠ Confidence: the M-code dialect (§2) is read straight from the Expert firmware (high). The output-bit offset
> math, the runtime-var↔`setting`-param linkage, and the built-in-M102-vs-custom-`T.nc` split should be
> confirmed on a real ATC before trusting generated code. **`bridge/controllers/.../FINDINGS.md` is canonical.**
