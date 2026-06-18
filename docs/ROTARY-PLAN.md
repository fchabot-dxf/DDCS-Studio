# Rotary support — design + sim-spin plan

_The design worked out for rotary (4th/5th axis), and the precise plan for the load-bearing sim-spin.
Foundation is built; the 3D-engine piece is scoped, not yet built. June 2026._

---

## The model (settled)

- **Rotary is *behavior*, not a toggle.** The sim spins the part **when the program has a rotary-axis (A/B) move** — the code is the single source of truth. No manual "rotary" toggle to set (and get out of sync).
- **One machine config does both 3-axis and rotary** — the *program* decides. This deliberately sidesteps Fusion's pain (where rotary and 3-axis are two separate machines).
- **End goal is 5-axis** — build single-rotary now, but keep it the base case of a kinematic chain (see "5-axis" below).

## Settings — DONE (`c7953ae`, v9.82)

- **Machine → AXES:** X/Y/Z linear; **A/B = unused | linear | rotary** + which Cartesian axis each spins around. Persisted; merged on load.
- **`getRotaryAxes()`** → `{ a:'x', … }` — the sim reads this to know which axes are rotary + orientation. Two rotary axes allowed.

## Stock (decided)

- **Stock = just the solid:** shape (`box` | `cylinder`) + dims. **No rotary flag on the stock** — `box + A-moves` = rotary rectangular, `cylinder + A-moves` = rotary cylindrical.
- **boss/pocket is NOT a stock shape** — it's *probe direction* (outside/inside) → it belongs to the probe wizard (the corner wizard already does this).
- *Open:* where the stock control lives — leaning a **Stock setup (toolbar button)** with shape/dims/show, pulled out of the Settings table. Cylinder shape is the new bit.

## Sim spin — the load-bearing 3D-engine piece (NOT YET BUILT)

Hook points (all mapped):
1. **Upstream G-code parser** (whoever calls `gcodeViz3d.setSegments` — *not* gcodeViz3d itself): extract `A`/`B` per move → put it on each segment (`s.a`). **This is where the program's rotation enters.**
2. **`gcodeViz3d.setSegments` / `_rebuild`** (`viz/gcodeViz3d.js` ~347, ~405-446): carry per-segment `A` through into `_animSegs`.
3. **`setStock`** (~571): add a **cylinder** geometry option + wrap the stock (and ideally the toolpath lines) in a **`partGroup`** that can rotate.
4. **`_animTick`** (~276): as play advances, set `partGroup.rotation[axis] = interpolatedA` (axis from `getRotaryAxes()`).

**Model:** the part group (stock + path) rotates by `A` around the declared axis; the tool/probe follows X/Y/Z. For probing that *is* the verification — part spins, probe approaches; you catch chuck/corner-sweep crashes you can't picture in your head.

## Probe wizards (sit on the sim spin)

- **2 self-contained wizards:** **Rotary Setup** (centerline/center + clock) + **Rotary Index**. Reuse `probeBlocks.js`/`words.js`/`dialect.js` + the sim spin. Shape (cyl/rect) read from the stock; probe direction (outside/inside) lives in the wizard.
- **~3 rotary probe types:** centerline (Z), clock (A=0), indexed; (+ axis-center, runout optional).
- **Auto-consistency:** emitting rotary code → the sim auto-spins (no toggle to disagree). Emitting rotary code with no rotary axis declared just means the sim treats A as linear — declare A rotary in Machine → AXES.

## 5-axis (later)

Nested rotary (a rotary table **on** the first rotary — B carried by A) is a kinematic chain, not two independent rotaries. Extend by: a **`parent`** field per axis in `motors` (B carried by A) + the sim nesting B's group inside A's group. The single-rotary sim is literally the base case — no rework, just nest.

## Why no rotary toggle

A toggle would restate what the program already says (`A` moves = rotary) and add a chance to be wrong (out of sync). The sim reads the code. The only persistent rotary config is the **AXES declaration** (which axis is rotary), set once on the machine.
