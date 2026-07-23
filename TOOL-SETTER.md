# DDCS Fixed Tool-Setter — findings & plan (2026-07-20)

Working notes for the physical **DDCS Expert V1.1** (hostname `CNC-FAIRY`; controller shares
mounted as `N:` = CNCDISK, `S:` = SYSDISK over `\\192.168.0.99`). Captured after a long debug
session so we don't re-live it.

## Setup / givens
- **Fixed tool setter** mounted at machine **X 682 / Y −775** (`#635`/`#636`), Z approach `#637` = −100.
- Setter touch signal is on **input IN02** — the raw input **works** (toggles on the I/O screen when pressed).
- **G54 Z0 = the spoilboard surface, and is SACRED.** It was set once (via the floating probe, with a
  surfacing tool that is **long gone**). Do not rewrite it, do not touch the spoilboard to re-zero.
- Tools currently have **no set offsets** — the whole point is to use the setter to measure tool height.

## Problem 1 — the setter didn't detect the tool (drove straight through)
**Root cause:** the factory macro **`O502`** (in `S:/slib-g.nc`, called by the Fixed/Floating/Mult
Probe buttons via `#1502`) probes with:

```
G91 G31 … F#22 P#26 L#28 K0 Q1      ; fixed path: #26 = #1075, #28 = #1077
```

i.e. it watches the **fixed-probe config** port/level `#1075`/`#1077`, which are **mis-resolved** on this
machine — so `G31` never triggers and the tool drives through. The raw IN02 input working on the I/O
screen tells you nothing about `#1075`.

**What WORKS (proven live):** a hardcoded probe —

```
G31 Z<neg> F80 P2 L1 K0 Q1          ; port 2 (IN02), level 1
```

- `N:/PROBE_TEST.nc` — bare probe test with `P2 L1`. **Stops on touch. Confirmed.**

## Problem 2 — tying the measurement to the spoilboard (UNSOLVED, do this right)
A tool setter only measures tool length **relative to its own plate.** To make that reference the
spoilboard (G54 Z0), **one** link between the setter plate and the spoilboard must be established once.
With the original surfacing tool gone, no set reference tool, and no spoilboard contact allowed, the
only honest options are:
- the **factory "first fixed" calibration** (`O502` `N17`): reads the *stored* G54 Z0 from memory +
  one setter touch and sets up the reference itself — **but it writes the WCS Z param** (tension with
  "G54 Z0 sacred"; its intent is to keep Z0 landing on the spoilboard), **or**
- physically measure the setter's trigger height above the spoilboard once and enter it.

### Failed attempt — do NOT use as-is
- `N:/TOOLSET.nc` wrote the **raw setter-touch machine Z** as the tool offset
  (`#[1430+[#1300-1]] = #1927`). That has **no reference to the spoilboard**, so the result was **very
  wrong** (a tool came out ~60 mm off). **A wrong tool offset crashes — don't run programs with it.**
  The correct offset must be `touch − reference`, and the reference is the missing spoilboard link above.

## Recommended path
1. **Minimal `O502` fix:** change the fixed-path `G31` from `P#1075 L#1077` → **`P2 L1`** so the
   **factory** setter finally triggers. Backup already at `S:/slib-g.nc.bak`.
2. Then use the **factory first-fixed → fixed** calibration (its offset math is tested; the hand-rolled
   macro math was not). Cross-check the exact first-fixed procedure against the DDCS tool-setter setup
   guide / forum.
3. **Verify by jogging, not cutting:** set a tool, jog to G54 Z0, confirm the tip sits on the spoilboard
   before running any program. If off by a constant, adjust one number.

## DDCS Expert quirks that bit us (macro authoring)
- **`G53` needs a variable**, not a literal: `#101=0 / G53 Z#101` (never `G53 Z0`).
- **Comments can't nest parens** — `( … ( … ) )` throws a bracket / "Unrecognized characters" error.
- Macro **arithmetic needs brackets**: `#102 = [#100+5]` (and `[0-#17]` for negatives); a literal in a
  motion word can error — put it in a variable first.
- Config `S:/setting` is a **float64 array** (8 bytes/param). Slot map: param < 500 → slot = param;
  **param ≥ 500 → slot = param − 500** (e.g. `#632`→slot 132, `#635`→slot 135, `#571`→slot 71). Reads of
  individual slots proved **unreliable** — verify at the machine, don't assert values.
- Some params (`#571` "G0 motion planning", `#575` fixed-probe signal) are **not shown in the UI** and
  didn't respond to MDI; set via macro or the config file, and reboot to apply.

## Also unresolved (parked)
- Fixed tool-set **approach crawls on short moves** (slow when starting close to the setter, fast when
  far; avg ∝ distance). Normal work-coord rapids are fine; it only affects `G53` machine-coord moves.
  Not accel/speed/jerk (tried), not `#571` (set to 1, no change). Likely a `G53`-machine-move firmware
  behavior — a DDCS-support question.

## Files on the controller (`N:`)
- `PROBE_TEST.nc` — bare `P2 L1` probe (works, stops on touch).
- `TOOLSET.nc` — writes tool Z offset, **but the reference is wrong** (see Problem 2). Don't trust yet.
- `SET571.nc` / `SET575.nc` — one-line param setters (used during debug).
