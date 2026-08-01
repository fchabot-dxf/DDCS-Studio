# RESTORE CUSTOM MACROS — CNC-FAIRY (Expert M350)

A firmware flash reverts every custom **SYSTEM** macro to factory. This folder holds the versions to
put back, plus a patcher for the firmware macro library. After a flash: copy the `.nc` files onto
SYSDISK (overwrite), run the slib-g patcher, power-cycle, verify.

## What's here

### Gantry homing — A slaves to Y (factory homes A independently → racks the gantry)
- **fndzero.nc** — Find-Zero button: home Z/X/Y, then sync A to Y (`#883=#881`) + mark A homed (`#1518=1`).
- **fndY.nc** — Y-axis home: same A→Y sync (A follows Y).
- **sysstart.nc** — boot: **per-axis** homing (`M98P501X2/X0/X1`, **not `M115`**), the A→Y sync, **zero B in place** (`#884=0`+`#1519=1`, no homing move), and the **fixed-probe config** (below) so it survives resets. Per-axis is required: `M98P501X<n>` sets `#1` (axis index) via the `X`-arg; `M115` at boot leaves `#1` dirty → "Macro address does not exist". Ends with `M30`.

### K-buttons (K1–K7)
`key-1.nc`…`key-7.nc` — K1 = tool setter (`#1502=2`/`M98P502`), K2 park, K3/K4 tool-change, K5 G55 XY zero, K6 corner probe, K7 warmup.
> ⚠️ The K-button→file **assignment** is a separate config the flash also wipes (buttons "just light up"). Re-assign in **Settings → Key Settings** if needed. The everyday tool setter is the on-screen **Fixed Probe** button, which needs no assignment.

### Fixed tool setter — the fix that took a day to find
The factory Fixed Probe **rapid-descended `G53 Z#637` straight through the setter before any G31 ran**
— and a rapid ignores the probe input, so it never stopped (looked like a dead signal; it wasn't).
Two pieces:

- **slib-g patch — `patch-slib-g.py`** (O502 fixed-probe path only; floating/first-fixed untouched; factory signal lines kept):
  1. strip rotary from the approach XY move (`…A#13B#14C#15` → `G53X#10Y#11`) — no crawl when B unhomed.
  2. **DELETE the rapid descent `G53Z#637`** — *the real bug.* Now the G31 probes the whole descent from the safe Z (`#641`) and stops on touch, like CALIBRATE.
  3. tool-length write (N18) `= #31` → `= [#31 - #2500]` — apply the setter→spoilboard reference.
  4. re-probe base `#20=#500` (O502 copy only) → `#20=160` — factory re-probes crawl from 10 mm/min halving; 160 gives a ~80 mm/min re-probe (with `#631=2`), matching CALIBRATE.
  Content-matched + idempotent.
- **config — `SETPROBE.nc`** (also run by `sysstart` each boot): `#1075=2` (probe input = IN02), `#1077=1` (level), `#632=800` (fast first probe), `#631=2` (2 touches). These are runtime and revert on reboot, so `sysstart` re-applies them. *(`#632`/`#631` are global → they affect the floating probe too; fine for spoilboard work, but verify floating still zeros.)*

## Restore procedure (after a flash)
1. Copy all `.nc` files here onto **SYSDISK** (overwrite), same route as any system file.
2. Patch the freshly-flashed slib-g:
   ```
   python patch-slib-g.py "\\192.168.0.99\SYSDISK\slib-g.nc"
   ```
3. **Power-cycle.**
4. Verify: home → **"HOMING COMPLETE - A SYNCED"**; then the tool-setter workflow below.

## Tool-setter workflow (the order matters)
1. **Zero G54 Z0 on the spoilboard** (floating probe) — the sacred Z0.
2. **Run `CALIBRATE` once** → stores the setter→spoilboard reference in `#2500`.
3. **Fixed Probe** on each tool change → writes `#1430 = touch − #2500` (WCS untouched).
4. First time / after re-cal: jog to G54 Z0, tip should sit on the spoilboard. Off by ~2× ⇒ sign flipped.

Without steps 1–2 the tool offset is meaningless (that's what `#2500` fixes).

## Not restored (on purpose)
- `mdi.nc` — MDI scratch line, not a macro.
- `save_park/sensor/toolchange_position.nc` — dropped per the user.
- CNCDISK files — test/job junk.
