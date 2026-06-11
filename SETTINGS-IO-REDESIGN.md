# Settings + Machine-I/O Redesign — spec

_Locked design for the Settings overlay rework. Build target; not yet implemented. June 2026._

---

## Structure — 2-level nav + inline part lists

```
L1 (header)      L2 (sub-tabs)
───────────      ──────────────────────────────────────────────────────────
General          Profile (+ controller dropdown ▾) · Variables · Feedback · Network (stub)

Hardware         Machine   (single config)
                 Stock     (single config)
                 Input     [ + Add input ▾ ]   list of ONLY the inputs you've added; each row carries a pin # field
                              Probe          pin [ 3 ]   level [NC]
                              Tool-setter    pin [ 2 ]   level [NC]  loc 10,10,-50
                              Limit X−       pin [ 5 ]   level [NC]
                 Output    [ + Add output ▾ ]  list of ONLY the outputs you've added
                              Coolant        pin [ 1 ]   M8 / M9
                              Drawbar        pin [ 2 ]   M154 / M155
                 [ + Add ▾ ]  →  adds a whole category tab (ATC · future subsystems)
```

- **Input and Output are separate tabs.** Inside each, the parts are a **table — one row per part, no drill-down / no third-level tabs.** The **`+ Add`** button opens a **dropdown of preprogrammed types**; choosing one drops a new row **pre-expanded with that type's parameters** (a Probe row shows pin/level/location; a Coolant row shows pin/on-code/off-code). **Only the rows you've added are shown — no empty pin slots.** Each row has a **pin # field (inputs 1–24, outputs 1–20)**, and the Add menu / pin picker is **free-pin-aware** (pins already in use are greyed out) so a pin can't be double-assigned. _(DDCS Expert M350 hardware: 24 inputs, 20 outputs — the Virtual I/O panel should match.)_
- **Two `+Add` scopes:**
  - per-tab **`+Add`** (inside Input / Output) → adds a **row** (a part).
  - L2 **`+Add ▾`** (beside the sub-tabs) → adds a whole **subsystem category tab**. A subsystem = several pins + its own config/logic, *not* a single on/off pin. Candidates: **ATC** (now) · **Spindle / VFD** (speed + M3/M4/M5 + at-speed/fault) · **Lubrication / auto-oiler** · **Pneumatic clamping / 4th-axis** · **Laser / plasma THC**. Each auto-adds its standard I/O (tagged `group`, mirrored) + holds its config. Single on/off devices (coolant, mist, air blast, dust, a lone sensor) stay as plain Input/Output rows — not categories.
- Machine + Stock stay single-config. **ATC is a subsystem (its own L2 category tab), not an input or output.** Only *some* of its parts are I/O.
  - **Adding the ATC category auto-adds only the standard, non-optional parts** — **drawbar** output (M154/M155) always; **+ carousel-rotate output + pocket/index sensor input** when the magazine type is **disk** (both required for it to run) — with **pins blank**, all **removable**. **Optional parts (tool-present sensor, dust cover, …) are added manually** via the ATC tab's Add.
  - **The ATC tab also has its own "+ Add input / + Add output"** for extras. Rows (auto or manual) are tagged **`group:'atc'`** and **mirrored into the global Input/Output tables** — same underlying row in `inputs[]`/`outputs[]`, editable from either place, one pin map (a small "ATC" badge marks them in the global tables).
  - **Outputs:** drawbar (lock/unlock) · dust cover · (disk) carousel rotate.
  - **Inputs:** tool-present sensor · drawbar-clamped sensor · (disk) pocket/index sensor.
  - **ATC tab only (neither):** magazine type · magazine table (pocket·tool#·name·park XYZ) · tool-offset table · tool-length-probe defaults.
  - **Magazine type: Straight | Disk** — the tool-change wizard branches on it:
    - **Straight / linear — FULL support.** Settings hold the **magazine count (N pockets)** + a **magazine table** — one row per pocket: **pocket # · tool # · name · park X · Y · Z** (editable in Settings). The tool-change macro `G53`-moves to the pocket's park XYZ; the generator can push the positions to the controller (`#1330+`/`#1350+`/`#1370+`). [CONFIRMED path].
    - **Disk/carousel** = one fixed pickup XYZ + rotate-to-pocket, driven by a **rotate output + index-sensor input** (from the I/O list) + pocket count + CW/CCW shortest-path + datum pocket. No hardcoded rotate M-code; validate against the real magazine.
  - **Wizard output = a complete `T.nc`.** `T.nc` is the DDCS's **fixed tool-change macro filename** — the controller auto-runs it on a tool change (`Tn M6`; `#1504` = target tool). The wizard builds the whole `T.nc` **from the ATC magazine table in Settings** (pocket → tool# → park XYZ) + the drawbar/sensor I/O; the user saves it **as `T.nc`** on the controller (replacing the stub), then programs just call `Tn M6`. _[CONFIRMED from the firmware backup: `T.nc`, `fndX/Y/Z.nc`, `fndzero.nc`, `probe.nc`, `slib-g.nc`/`slib-m.nc`, `key-N.nc` are fixed-name system macros; the stock `T.nc` is just `T#1504`.]_

### Each row's fields (inline in the list)
- **Input row:** `type · pin # · active level (NC/NO) · [location x/y/z/w/h for probe & setter] · ×`
- **Output row:** `type · pin # · ON M-code · OFF M-code · ×`  (e.g. coolant M8/M9, drawbar M154/M155)

### Preprogrammed types (the `+Add` menu)
- **Input:** **3D touch probe** (pin·level — radius is a calibration macro, `#1200`, not a pin setting) · **Touch-plate / floating probe (ground)** (pin·level) · **Tool-setter** (pin·level·location) · Limit X−/X+/Y−/Y+/Z−/Z+ · E-stop · Sensor
- **Output:** Coolant · Drawbar · Dust-cover · Mist · Custom
- _Probe is split because the sensors behave differently in macros: the 3D probe gives XYZ + radius comp; the touch-plate is a ground-completed touch (Z/tool-length)._

## Controller profiles (must stay flexible)

A **profile** = a preset I/O template **+ capability flags** that *seeds* the lists; the user edits from there.
- Capability flags: pin ranges (Expert: 24 in / 20 out; **DDCS 4.1** may differ), dialect (M-codes / variable addresses), and **which types are allowed / how many** (e.g. a single-fixed-probe controller caps `probe` at 1).
- **DDCS Expert** and **DDCS 4.1** are two profiles with different seeds + ranges + dialect.
- Two physical probes are **two input rows on two pins** (this machine: 3D probe = IN03, tool-setter/floating-ground = IN02).

---

## Decisions (confirmed)

- Controller-profile dropdown moves into **General → Profile** (out of the header).
- The **"Controller / Hardware Tabs" checkboxes are removed** — you add the inputs your machine has.
- Wizards **pick which probe input** from the Input list via a **"Probe input" dropdown** (auto-selected when there's only one probe-type input), then read that input's **pin + level**. Drop the wizard's `INPUT PORT (P)` / `LEVEL (L)` fields. **Keep `STOP (Q)`** as a per-operation choice. → multiple probes (3D + touch-plate + setter) are all supported; the user just chooses per operation.
- **Outputs get the same Add tool** (full pin map lives in Hardware).
- The wizard **"Animate paths"** toggle is removed (the engine Run/Step manages playback).

---

## Data model

Each row = one entry in an array — the list *is* the data.

### Today (flat — read directly by sim + wizards)
```js
probes:  { probePin:3, probeLevel:0, setterPin:2, setterLevel:0, setterX,Y,Z,W,H },
limits:  { xMinPin:'', xMinLevel:0, … zMaxLevel },
hardwareTabs: { probes:true, atc:false, limits:true },   // ← removed
atc:     { baseVar:1430, toolCount:10, tools:[], … },
```

### Target
```js
inputs:  [ { id, type:'probe'|'setter'|'limit'|'estop'|'sensor', label, pin, level, …loc } ],
outputs: [ { id, type:'coolant'|'drawbar'|'dustcover'|'mist'|'custom', label, pin, onCode, offCode } ],
// atc stays its own object; its sensors / drawbar reference input / output ids
```

---

## Staged build plan

1. **Data model + migration** — add `inputs[]` / `outputs[]`; on load, seed them from the existing `probes` / `limits` so nothing is lost. Accessor helpers (`getInput('probe')`, `getLimit('x_min')`).
2. **UI** — General/Hardware header; Machine·Stock·Input·Output sub-tabs + L2 `+Add` (ATC); the Input/Output row lists with their `+Add` menus + inline editing; controller dropdown → Profile; Network stub; remove the checkbox section.
3. **Rewire** — sim + wizards read pins via the accessors; drop the wizard P/L; remove the Animate-paths toggle.
   - Lower-risk interim: keep flat `probes`/`limits` synced from the list so the sim/wizards keep working before the full rewire.

---

## Status
- ☐ Stage 1 — data model + migration
- ☐ Stage 2 — UI (2-level nav + Input/Output row lists)
- ☐ Stage 3 — rewire sim + wizards, drop wizard P/L, remove animate-paths
