# Two-WCS datum in the sim — spec (PROVISIONAL · advisor turn 101 · awaiting human confirm)

## The ask (human, turn 101)
The sim must distinguish **two WCS roles**, which may be the SAME slot or DIFFERENT:
1. **INITIAL / STOCK WCS** — where the stock SITS ("Sits at WCS"). **Static** during the run.
2. **TARGET / PROBE WCS** — what the probe operation **SETS** (the wizard's WCS field). It is **EMITTED**
   (the macro writes the measured offset) **AND simulated** — the sim shows the **datum**, and must show it
   **UPDATE DYNAMICALLY** as the probe collides with walls.

**MIDDLE is the showcase:** the new target WCS lands at the **CENTRE of the stock**, not a corner — the most
illustrative dynamic-datum case.

## Hard rules (from the human + our principles)
- **Both WCS read the SAME wcs table — READ-ONLY. NEITHER writes to it.** The sim is not the real controller;
  do **NOT** overwrite the user's real WCS offsets. The moving target datum is a **SIM-ONLY overlay** derived
  from the probe's computed offset (`#53`/`#56`), **never persisted**. [[machine-frame-sim-spec]] (the table is
  the floor, never push) · [[personalised-sim-from-dump]] (machine-truth read-only).
- **If target = ACTIVE:** the datum uses the **active WCS initially**, then **dynamically updates** to the
  measured centre as the probe runs.

## Principle fit (why this is north-star-clean)
- The target is **DECLARED** (the wizard's `params.wcs` field) — declare-not-infer. ✓
- The datum position is **DERIVED from the macro the probe RUNS** (the engine computes `#53`/`#56`), so it is
  **coherent-by-construction** — the G-code-driver-handle EXEMPTION, not an inferred guess. [[declared-seam-before-declaring-gui]]
- Read-only table → one-source-of-truth, never push. ✓

## Decisions
- **A) Update granularity = RESPECT EXECUTION** — ✅ **LOCKED** (human, turn 101). The datum is a **pure function
  of the engine's execution state** — it updates WHEN the engine executes the **centre-midpoint assignment**, which
  is the LAST line of `seq()` ([middleWizard.js:125](DDCS-Studio/web/wizards/middleWizard.js#L125)) and fires
  **immediately after that axis's 2nd probe**, mid-program (verified, human turn 101):
  `#53 = [#51+#52]/2` runs right after the 2nd X probe → the datum's **X** jumps THEN; `#56 = [#54+#55]/2` right
  after the 2nd Y probe → the datum's **Y** jumps THEN. The end-of-program offset write `#[#70+off]=#53/#56` merely
  **persists** an already-known value — the datum has already moved. Progressive convergence falls out **naturally
  and faithfully** because the macro computes each axis's centre at a different execution point — it is **NOT a
  scripted/anticipated embellishment**. Drive the datum from the macro the engine runs, in execution order.
  [[declared-seam-before-declaring-gui]]
  ⇒ **implementation hook (build-gate detail):** the engine's assignment event for the **centre variable**
  (`#53`/`#56` for middle) — the value that feeds the target-WCS-offset write — routed to the SIM-ONLY datum
  overlay, never to the persisted table. Generality Q for the gate: how the sim IDENTIFIES the centre variable
  across probe types (back-reference from the offset-write's source var vs a declared sim hint) — middle = `#53/#56`.

## OPEN — working defaults (revisit at the build design-gate)
- **B) Same vs different** (default): target=active & stock-at-active → the two datums START coincident, then the
  target **peels off** to the centre; target = a different slot → **two distinct datums from t0**.
- **C) Z scope** — ✅ **RESOLVED** by MID-PROBE-Z-FIRST (human, turn 102, see MIDDLE-PROBE-BACKLOG): the target datum
  is **XY when probe-Z-first is OFF**, **XYZ when ON** — the Z datum is set FIRST (right after the Z-surface probe),
  so the convergence is **Z → X → Y** (respect execution). No separate Z-probe-type needed for middle.
- **D) Visuals** (default): two **labelled, visually distinct** markers (stock vs target); the target animates.

## Substrate — shared GRANULAR probe moves (human, turn 102: "share some, NOT a monolith")
Middle and centreline (`rotary_center`) duplicate the same centre-finding TODAY as separate local closures. The
clean fix is **a few small shared atoms**, composed differently per wizard — **NOT** one monolithic "find-centre"
stack. [[cam-menu-architecture]] (small subs, no monolith) · [[wizard-atom-granularity-ask]] · [[priorities-friendliness-over-perf]].
- **SHARE** (the duplicated bricks): `probeFace` (2-pass fast+slow+retract — `middle.twoPass` ≈ `centreline.pp`) ·
  `reposition` (incremental lift/jog/drop — near-identical in both) · `centre = midpoint(a,b)` (the bisect —
  `#53=[#51+#52]/2` ≈ `#54=[#52+#53]/2`).
- **KEEP per-wizard** (the orchestration + feature-specific moves): middle's `transTraverse`/`traverseOver`;
  centreline's round-bar flank geometry + radius solve.
- **DATUM HOOK = the shared `centre=midpoint` brick**, wherever composed → the datum lights up for middle +
  centreline + any future centre-finder, no per-wizard special-casing, no `#53`-vs-`#54` variable-sniffing.
- This is a **precursor refactor** (consolidate the duplicated probe helpers into shared atoms); gate it on its own,
  and it can land BEFORE the datum feature so the datum simply hooks the shared brick. Open: confirm the share/keep
  split above at the gate; verify byte-identical emit per wizard (the equivalence gate).

## ⊕ The concrete CURRENT BUG this fixes (human, turn 105 — verified-live + code-confirmed)
The sim's datum gizmo renders **on the WALLS, not the centre** — contradicting the macro, which writes the WCS
offset = `#53`/`#56` (the computed centre). ROOT: [gcodeViz3d.js:1674](DDCS-Studio/web/viz/gcodeViz3d.js#L1674)
`_probeVals[axis] = tool.position[axis]` at **each probe contact** → `_updateDatum()` ([:1686](DDCS-Studio/web/viz/gcodeViz3d.js#L1686))
parks the datum gizmo at those raw contacts (the last-touched walls = a corner), shown when ≥2 axes probed (so it
bites on both-axis). The datum is tracking the **probe contacts**, NOT the macro's WCS write (the centre). ⇒ the
feature's core fix = drive the datum from the **WCS-offset write / `#53`/`#56`** (respect execution — see Decision A),
not from `_probeVals`. Same class as the flash: the render lies though the macro is right ([[verify-real-symptom-not-just-test]]).
A SMALL standalone fix (point `_updateDatum` at the computed centre for middle) could land ahead of the full
two-datum feature if we want the wall-corner gone sooner.

**No extra writes (human, turn 105).** The faithful render does NOT require the macro to write the WCS at each wall
+ the centre — that would be a **waste of writes** (the controller only wants the final centre). Instead the sim datum
**READS the engine's COMPUTED `#53`/`#56`** (a sim-only overlay) as they're calculated, so the macro keeps its single
end-of-program write and the render still tracks the centre live. Datum = the computed centre; the walls keep their
own probe-contact burst markers (separate). One write, zero waste, faithful render.

## Relation to current work
- **Adjacent to B-END-OFFSET** (the tool should rest over the feature CENTRE = the target datum). Same
  "centre of the stock" notion; keep them SEPARATE (a datum marker ≠ the tool position) but they reinforce.
- **Sequence:** AFTER the middle render bugs (B-FLASH → B-END-OFFSET → B-TRANS-ANGLE). This is a larger feature
  and needs its own design-gate pass before any build.
- Applies to **all probe types** (edge/corner/middle/Z), middle being the showcase.
