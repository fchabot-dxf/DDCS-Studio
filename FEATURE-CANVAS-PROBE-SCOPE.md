# Feature-canvas-in-probe — per-wizard surfaceable elements (advisor, turn 73)

Scope for the spatial **feature-canvas editor** in the probe wizards: drag handles / click picks on a
canvas instead of typing numbers + choosing dropdowns. Grounded in a read of every probe wizard +
`viz/canvasWidgets.js` (gestures) + `viz/featureCanvas.js` (drill prototype) + `viz/toolpath2d.js`
(the existing draggable per-pass start markers ①②③④).

## Additive, NOT a replacement (human, turn 73: "the goal is not to replace the forms in their column — we can have both")
The form column STAYS, unchanged. The canvas ADDS a **two-way-synced** spatial handle for the spatial
params: drag the canvas OR type the field — both write the same value (the drill pattern: canvas + plain
numbers). So **"stays in form" below means form-PRIMARY (no canvas handle needed)** — nothing is removed,
everything remains typeable. This de-risks rollout: each handle is an independent, isolated ADD, no form
surgery.

## Dual purpose: a handle drives the G-CODE and/or the SIM (human, turn 73: "gui has a dual purpose or more — drive the gcode and drive the sim")
A canvas handle has up to two outputs:
- **→ G-CODE** — writes a FORM/op param → `generate()` → the emitted macro (probe-vector → axis/dir/dist
  → G31; cross-over → `#19`/`#20`; diameter → the param). The SIM stays coherent **for free** because the
  preview RUNS the real emitted macro — the same value feeds both.
- **→ SIM scene only** — sets preview CONTEXT that is NOT emitted: the per-pass **start** position (the
  macro is incremental/relative, so the start is where the tool BEGINS in the preview, not a G-code line),
  the stock / feature geometry, the WCS.

The risk lives in the **sim-only** drivers: position a marker INDEPENDENTLY of the g-code and the two
**DIVERGE** — the sim looks right while the motion is wrong. **That was the boss-both bug** (② marker said
one thing, the trans-axis motion did another). **COHERENCE IS MANDATORY: the preview must reflect the REAL
emitted g-code, never a decorative overlay that can drift.** Rule: a handle drives the real param (ONE
source) + the sim RUNS the real macro → both stay locked. [[verify-real-symptom-not-just-test]]

Per-element classification: probe-vector = g-code (+sim runs it) · cross-over / diag / diameter / corner =
g-code · START markers / stock = sim-only · A & B fence points = sim (+ the span may emit). When a handle
is sim-only, wire its coherence explicitly — it must move the same frame the macro is relative to.

### The dual purpose carries into the BLOCK layer (human, turn 77: "they need to be carefully thought about when adding them as blocks")
A sim-only value is NOT emitted, so as a BLOCK it is a different KIND from an emit-atom:
- **emit-atom block** → round-trips `block ⇄ MACRO` (the normal reverse-sync reads the emitted lines).
- **sim-declaration block** (e.g. `def.sim.starts`) → round-trips `block ⇄ DECLARATION`. **There is NO emitted
  line to read back** — the emit reverse-sync would find nothing and silently DROP it. It needs a
  DECLARATION round-trip, and must READ as a distinct "sim / preview" block (not a g-code block) so a user
  composing a custom op never expects it to emit.
Where it bites: the DEFERRED `def.sim.starts` declarative path (inc 1's noted follow-up) must be designed
block-friendly FROM THE START — a declarative spec that maps cleanly to a sim-declaration block with a
declaration round-trip, NOT retrofitted onto the emit-atom machinery. [[wire-blockly-roundtrip-new-features]]

## The reframe (vs the raw inventory)
A first pass flattens every numeric field to a "drag-the-length" handle and leaves the dropdowns in the
form. That's backwards on VALUE. A `dist`/`retract`/`safeZ` number field is already fine — dragging it
saves little. **The feature canvas earns its keep on the SPATIAL picks** that today are a dropdown +
a field: *which corner*, *which way + how far to probe*, *where each pass starts*, *how big the
circle*, *what angle the fence*. Those are the drags that make a probe legible at a glance. So the list
is tiered: **🎯 signature spatial element** (the reason to build that wizard's canvas) · **secondary
handles** (nice, lower-value scalars) · **stays in form** (pure logical/enum picks).

## Gesture palette (what's actually buildable)
- **point** → `{x,y}` — free position (drag a marker). Used by the start-markers today.
- **radial** → `{angle, dist}` (polar) — a vector/arrow or a circle radius.
- **length** → `{distance}` — a 1D scalar along an axis.
- **rect** → `{w,h}` — a 2D extent.
- **corner-pick** (4-anchor) — click a stock corner (a spatial enum, not a free drag).
- **start-markers** (existing, `toolpath2d.drawStartHandles`) — per-pass ①②③④ point drags.

---

## MIDDLE — boss / pocket centre (1D or 2D)
- 🎯 **Per-pass START markers ①②③④** (point) — drag where each wall-probe begins. *This is the ②-aim
  from the boss-both saga.* Already half-built in `toolpath2d`; the canvas makes it the primary editor.
- **Probe-reach ring** per start (length/radial) — drag to set `dist`; shows the seek envelope.
- **(boss-auto) cross-over span + trans-axis diagonal** as draggable traverse vectors (length / point at
  the tip) — `crossX`/`crossY` (now decoupled, user-set) + `diagTravel`; drag the path between walls.
- **Centre target** (readout, non-draggable) — shows where the result lands.
- Stays in form: `axis`, `dir1/dir2`, pocket/boss, both-axes, circular.

## CORNER — outside corner (XY, optional Z)
- 🎯 **Corner pick** (corner-pick) — click the stock corner (FL/FR/BL/BR) instead of the dropdown.
- **Two probe arrows** (radial ×2) — the L-shape (X-wall + Y-wall); each arrow's direction is implied by
  the corner, its length = reach.
- **Travel-past-corner** (length), **scan depth** Z (length), **stylus radius** (length) — secondary.
- Stays in form: probe sequence (XY/YX), probe-Z toggle.

## EDGE — single wall (the cleanest collapse)
- 🎯 **Probe VECTOR** (radial) — ONE arrow from the start to the wall: its **direction** sets `axis`+`dir`,
  its **length** sets `dist`, kept two-way synced with the three form fields (which STAY). One drag mirrors
  three controls. Highest value-per-pixel of any wizard — the natural prototype to prove the pattern.
- **Stylus radius** (length) — secondary.
- Stays in form: (mostly subsumed by the vector).

## ROTARY CENTER — cylinder centreline + radius
- 🎯 **Cylinder circle** (radial) — drag the radius to set the known `diameter`; the circle shows the bar.
- **(3-pt fit) the 3 touch points** (point ×3) on the circle — drag each.
- **dist / retract / safeZ** (length) — secondary.
- Stays in form: method (known / 3-pt), Z datum (centre / top), approach (auto / guided).

## ROTARY CLOCK — flat on a rotary axis (tilt)
- 🎯 **Tilt / reference angle handle** (radial) — the reference orientation + measured flat angle as a
  rotating handle (top = 0° / side = 90°).
- **Span** between the two flat touches (length, or two points).
- **dist / retract / safeZ** (length) — secondary.
- Stays in form: action (set / report / rotate), reference (top / side).

## ALIGNMENT — fence angle (A → B)
- 🎯 **Two probe points A & B** along the fence (point ×2) — the LINE between them is the measured
  baseline; the probe direction is perpendicular. Dragging A/B sets where it samples → the angle readout.
- **dist / retract / safeZ / tolerance** (length) — secondary.
- Stays in form: check axis, probe direction.

## CIRCULAR — delegates to MIDDLE (circular + both forced)
- Same as MIDDLE plus the **diameter readout circle** (radial).

---

## What this says about build order
Two honest prototypes, by value:
1. **EDGE probe-vector** — smallest surface, biggest "aha": one radial drag = axis + dir + reach, synced
   with the fields. Proves the spatial drag (alongside the kept form controls) reads faster than typing.
2. **MIDDLE start-markers** — continues the existing `toolpath2d` ①②③④ drag into the editor; the spatial
   work the boss saga already touched. Higher continuity, slightly more plumbing.

Scalar-only handles (`retract`, `safeZ`, plain `dist`) are deferrable — a number field is fine; add them
only where they share a canvas already built for a signature element. Discrete logical picks stay in the
form per the spatial-GUI principle (continuous → canvas, discrete enum → form widget); the **corner** and
the **probe-vector direction** are spatial enough to ALSO get a canvas pick (in addition to the form
control, synced) — an option, never a removal.

## CONCRETE MIDDLE GUI BACKLOG (human eyeballs, turn 99)
Built on the existing MIDDLE feature canvas (`renderStartCanvas` in `middleView.js` + the ②-aim handles).

- **MG1 — start-pos handles = BLUE LOZENGES, not yellow squares.** The feature-canvas start handles render as the
  default `point`-gesture **yellow square**; they should be **blue lozenges** matching the 3D markers (`gcodeViz3d`)
  + the original per-pass start markers (cyan diamonds). Styling/consistency fix. Verify-first: the `point` handle
  render in `featureCanvas.js`/`canvasWidgets.js` + how the 3D draws the blue lozenge → match glyph + colour.
  (Subsumes the MIDDLE-PROBE-BACKLOG "glyph match" refinement.)
- **MG2 — in-axis traverse as a draggable LENGTH handle.** A `length` handle on the feature canvas for the IN-AXIS
  cross-over (`#19`/`#20` = the X/Y CROSS-OVER fields) — drag the **tip** to move the END of the in-axis travel
  = the **start of the wall-2 probe**. A g-code-driver handle (writes `m_crossX`/`m_crossY`, like edge's probe-vector
  writes its fields). Verify-first: the `traverseOver` cross-over geometry (anchor = wall-1, length = `#19`/`#20`,
  tip = wall-2 approach) + the `length` gesture + the field write-back. Two handles (X + Y cross-over) when both-axes.
