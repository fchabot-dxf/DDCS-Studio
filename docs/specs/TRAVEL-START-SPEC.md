# Item 4 — the Unified Travel/START Model

**Status:** DESIGN (scout `f45d57c` done; this is the draft for human shaping — same playbook as `SPATIAL-MODEL-SPEC.md`). The "crux."
**Origin:** the human's screenshot (the diag-travel "locked at 24"; the missing 4th/5th markers) + `MIDDLE-PROBE-BACKLOG.md`
turn-117 ("THE CRUX") + `FEATURE-CANVAS-PROBE-SCOPE.md` (both since deleted, t2295 doc cleaning — their own
conclusions shipped and are superseded; kept here only as historical attribution for where this spec's own
origin traces to).

## The headline (scout): it's a FLIP, not a build
Today the dependency is **INVERTED** — **START ← TRAVEL** in every probe wizard (each derives the start from a travel/reach field via
`inferStart` / `opSimStarts`). Item 4 = **flip it: TRAVEL ← START** — the start is the GUI-placed SOURCE, the travel is DERIVED. And
the seam ALREADY EXISTS:
- `createPreviewPanel.userStarts` — a dragged marker **beats** the inferred hint **and persists**.
- `tieDiagTravel` (middleView) — already **inverts ONE field**: dragging ② derives `#21` ("② is the master").
- `toolpath2d.setStarts` — draggable ①②③④ markers; the count is **config-driven 1–5**.

⇒ item 4 = **generalise `tieDiagTravel` to every field + drop the now-redundant fields**. NOT build-from-scratch.

## The model
- **START = SOURCE** — the user places each probe-start marker on the canvas (GUI-first). [[prefer-gui-over-fields]] [[spatial-gui-form-vs-canvas]]
- **TRAVEL = DERIVED** — reach/travel is computed FROM the start positions; the block **STORES** the derived value, **NO form field**.
- **Valid by construction** — the "locked 24" was a field **disconnected** from the handle; flipping REMOVES the field → nothing to
  disconnect. (Echoes §B's one-source `barRadius`: kill the second source, the drift can't happen.)
- **config-driven markers 1–5** — middle: `z(probeZ) + prim(inAxisManual?2:1) + sec(twoAxis)` → max 5 = `[Z, X1, X2, Y1, Y2]` =
  the human's 4th+5th (already config-driven — surface them).

## Constraints (scout flags — don't drift)
- **travel=derived is GUI-SIDE** — derived from the START POSITIONS in the GUI; the MACRO can't know wall-2's position pre-probe. The
  derivation lives GUI-side and feeds the block's stored value.
- **markers ↔ macro `reposition()` in LOCKSTEP** — the GUI marker count MUST match the macro's reposition calls; don't let them drift.
- **B-TRANS-ANGLE** = a **render** fix (the trans-axis vector renders a fixed 45° instead of tracking ②); NOT in the emit.
- **edge "reach"** = the `dist` field **MISLABELED** (it's really the start outset).

## Increments (scout rec order; release each, value-identical on default start positions)
1. **EDGE (the prototype)** — drop the reach→start handle: the start marker IS the source, `dist`/"reach" derived. Simplest wizard → prove the flip.
2. **MIDDLE (the crux)** — generalise `tieDiagTravel` to all start fields; **REMOVE the `diagTravel` field**; fix the locked-disconnect
   (by construction); the per-transition AUTO/MANUAL unification ("two meanings of pass"); surface the 4th+5th markers (Z-first/both-axis).
3. **B-TRANS-ANGLE render** — the trans-axis vector tracks ② instead of a fixed 45°.
4. **corner / rotary / alignment** — adopt the canvas (start markers + derived travel).

## Verify
- each wizard: dragging the start marker DERIVES the travel (block stores it); NO travel form field; markers match the macro
  `reposition()` count; emit **value-identical** to today for the default start positions (no regression).
- middle: the 4th+5th markers appear for Z-first / both-axis; the "locked 24" disconnect is GONE.

Refs: `MIDDLE-PROBE-BACKLOG.md` turn-117 · `FEATURE-CANVAS-PROBE-SCOPE.md` (both deleted t2295 — see the
origin note above)
