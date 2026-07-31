# RESTORE CUSTOM MACROS — CNC-FAIRY (Expert M350)

A firmware flash reverts every custom **SYSTEM** macro to factory. This folder holds the versions to
put back, plus a patcher for the firmware macro library. After a flash: copy the `.nc` files onto
SYSDISK (overwrite), run the slib-g patcher, power-cycle, verify.

## What's here

### Gantry homing — A slaves to Y (factory homes A independently → racks the gantry)
- **fndzero.nc** — Find-Zero button: home Z/X/Y, then sync A to Y (`#883=#881`) + mark A homed (`#1518=1`).
- **fndY.nc** — Y-axis home: same A→Y sync (A follows Y).
- **sysstart.nc** — boot: `M115` homing, then the same A→Y sync.

### K-buttons (K1–K7)
- **key-1.nc** — TOOL SETTER: `#1502=2` / `M98P502` → runs the fixed tool-setter path (needs the slib-g patch below).
- **key-2.nc** — safe park spindle
- **key-3.nc / key-4.nc** — tool-change position
- **key-5.nc** — manual G55 XY zero
- **key-6.nc** — 3D corner probe (G55)
- **key-7.nc** — spindle warmup

### slib-g.nc patcher — firmware macro library (can't copy the whole file across firmware versions)
- **patch-slib-g.py** — re-applies 3 edits to O502's **fixed-probe branch only** (floating + first-fixed untouched):
  1. strip the A/B jog from the approach: `G53X#10Y#11A#13B#14C#15` → `G53X#10Y#11` — factory jogs A/B toward 0, which crawls the XY move when B is unhomed.
  2. fixed-probe signal → **P2 L1**: `#1075`/`#1077` → `2`/`1` — factory port config never triggers on this machine.
  3. tool-length write → subtract the setter reference: `= #31` → `= [#31 - #2500]`.
  Content-matched (survives firmware line shifts) and idempotent.

## Restore procedure (after a flash)
1. Copy all `.nc` files here onto **SYSDISK** (overwrite), same route as any system file.
2. Patch the freshly-flashed slib-g:
   ```
   python patch-slib-g.py "\\192.168.0.99\SYSDISK\slib-g.nc"
   ```
3. **Power-cycle** the controller.
4. Verify:
   - Home → confirm the **"HOMING COMPLETE - A SYNCED"** message (gantry sync).
   - Tool setter: set `#2500` once via CALIBRATE, then Fixed Probe / K1 → jog to G54 Z0, tip on the spoilboard.

## Not restored (on purpose)
- `mdi.nc` — that's the MDI scratch line (last thing typed in MDI), not a macro.
- `save_park/sensor/toolchange_position.nc` — dropped per the user.
- CNCDISK files — test/job junk.
