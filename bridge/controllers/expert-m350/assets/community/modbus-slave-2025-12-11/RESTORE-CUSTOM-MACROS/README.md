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

## ⛔⛔ RESTORE PROCEDURE — THE OLD ONE DOES NOT WORK. MEASURED 2026-08-26.

⛔ **Copying these files onto SYSDISK over SMB DOES NOT PERSIST.** They were written, read back
byte-correct, and were **factory again after the next power-cycle**:

```
sysstart.nc   661B written -> 6B   (factory stub)    reverted
fndzero.nc    375B written -> 59B                    reverted
fndY.nc       288B written -> 15B                    reverted
slib-g.nc     patched, all 4 edits -> factory        reverted
SETPROBE.nc   455B written -> 455B                   SURVIVED
```

⭐ **The pattern is exact: a file the controller ships its own copy of is RESTORED at boot.**
`SETPROBE.nc` survived because it is a NEW file — the firmware has no copy to put back. ⇒ Any system
macro whose name appears in the flash payload cannot be edited over the network. **This is why homing
came up unsynced after the 2026-09-02 flash** — A landed at `-5.178` against Y at `-5.000`.

### ⭐ THE ROUTE THAT WORKS — bake the customisations into the flash payload
Make the controller's OWN copy the patched one, so there is nothing to revert to.

1. Extract `install/` from the release zip onto a FAT32 stick's root (hardware **V1** => `install/`,
   **V2** => `psys/`). ⛔ **Never add the `setting` file** — the OEM read-me says that restores FACTORY
   parameters and would wipe axes, envelope, tool table and probe config.
2. Patch the payload's copy, not the controller's:
   `python patch-slib-g.py "D:/install/slib-g.nc"`
   ⚠ **then DELETE the `slib-g.nc.prepatch` the patcher leaves behind** — it must not ship in the payload.
3. Copy `sysstart.nc`, `fndzero.nc`, `fndY.nc`, `SETPROBE.nc` from this folder **into `install/`**, overwriting.
4. Flash: power **off** -> stick in -> power **on**. Do not cut power mid-upgrade.
5. Verify: home -> **"HOMING COMPLETE - A SYNCED"**, A and Y machine both `-5.000`, not `-5.178`.

⭐ **Confirmed working 2026-08-26** on firmware `2026-09-02-00` — the owner: *"Works perfectly."*
⚠ No checksum or manifest was found in the payload, so the bootloader appears not to validate it — that
is an absence of evidence, not a guarantee. Keep the unmodified release zip to fall back to.

⚠ `key-1.nc`-`key-7.nc` are in this folder but were **NOT needed**: only `key-1.nc` is in the payload, and
`key-2`-`key-7` survived byte-identical (modulo line endings). ⭐ **And the owner does not use the K-buttons
at all** — the everyday tool setter is the on-screen **Fixed Probe** button, which is what the `slib-g`
patch fixes. Ignore the K-button assignment note above.

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
