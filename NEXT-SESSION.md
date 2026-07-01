# NEXT-SESSION — advisor → worker dispatch

**Branch:** `port/corner-clean` (off `main` @9bc0a7c = shipped V10.49 + concurrent H2). **Backups:** `wizard-porting-work` · `corner-notepad-enrich`.

## 🔒 THE LOCKED MODEL (human turn 6) — "Corner (data)" REPLACES the built-in; positions are EXPRESSIONS of the stock-datum coord
Each reposition socket (`#21`/`#22` start, `#23`/`#24` cross) holds a **`datum + offset` EXPRESSION** (declare-never-infer):
- **DEFAULT** offset = stock-geometry-derived → correct-by-construction (kills the degenerate `G0 X0 Y0`). Datum via the WCS / "sits at WCS".
- **DRAG** (B3) = a datum-RELATIVE literal offset → tracks the stock (drill frontier-#2 lesson). ABS = the bare-literal fallback.
- **REPLACE** mode (built-in retires). **Probe-Z-First** = a structural frontier (B4).

## ✅ DONE + VERIFIED (advisor reviews = fan-out + adversarial verify)
- **inc A** (mechanism lift) · **inc B1** (corner EMIT twin; derive-helper clean, safeZ-bake correct) · **inc B1b** (reposition
  correct-by-default via signed-travelDist EXPRESSIONS; review clean 3/3; degenerate `G0 X0 Y0` dead, known-good golden).
- **inc B2 → B2b** (SIM): `cornerData` declares its OWN per-PROBE-PASS markers (`CORNER_SIM_STARTS` = Z-surface[gated]·wall-1·wall-2).
  B2 mis-declared a reposition-waypoint marker (3 for a 2-pass macro → wall-2 marker inside the stock); B2b fixed it (one marker per
  `_pass`, reposition = a delimiter not a pass) AND rewrote the test to assert PASS-ALIGNMENT vs the REAL engine. 451/0-fail.
- **Human calls:** REPLACE the built-in (turn 6) · positions = datum expressions (turn 6) · dropdown-dup was a stale localStorage op
  (turn 8) · **ADD auto/manual travel** (turn 12, queued below) · **proceed to B3** (turn 12).

## 🚦 ACTIVE DISPATCH — CORNER-PORT inc B3: LAYOUT + DRAG [advisor turn 12; human "b3"]
LIFT the corner's 2D layout + wire the drag — the PAYOFF of the LOCKED MODEL (dragging OVERRIDES the reposition socket expression).
- LIFT `cornerView.js` FeatureCanvas port (drag handles, `tieCornerTravel`, `getPassStarts`) + the `index.html` corner panel; render
  "Corner (data)" through the generic `registerUserOp → def.panel/def.layout → userOpView` (like the 5 sibling data ops).
- ⭐ **The DRAG writes a datum-RELATIVE literal offset into the reposition socket** (`cross1_x/cross1_y` → a bound literal that OVERRIDES
  the default expression via `instantiate`; tracks the stock). **INTERIM:** the stock-datum coord isn't a reachable `#var` yet (the B1b
  gate), so the drag is relative to the DEFAULT geometry / `travelDist` for now; the true datum-relative form lands with the stock-datum
  follow-up. Keep the socket EXPRESSION-HOLDING so both drop in without a schema change.
- **SCOUT FIRST:** the `cornerView` canvas port + the drag→socket-override wiring (how a user-op's canvas handle writes a binding literal
  back through `userOpView`). Report the mechanism; **GATE** if the datum-relative drag needs the deferred datum.
- SCOPE: LAYOUT + DRAG. No emit-structure change; NOT auto/manual (its own increment); NOT probeZFirst (B4).

**VERIFY:** "Corner (data)" renders its FeatureCanvas layout + form panel via `userOpView` (matching the built-in corner); dragging a
handle updates the emitted reposition (the socket takes the literal); relevant specs + full suite GREEN. **STAGE SURGICALLY** (never
`git add -A`). Commit + WORK-LOG + pass.

**NORTH STAR:** GUI-first (drag the canvas, not a field) · valid-by-construction (datum-relative tracks the stock) · one-source (the same
`userOpView` path the siblings use) · verify-real-symptom (a REAL pointer drag updates the REAL emit).

## 📌 QUEUED (advisor dispatches each after review — no human check-in):
- **AUTO/MANUAL TRAVEL — generalize into `safeTraverseStack` (human t12).** Middle ALREADY has per-traverse auto/manual
  (`middleWizard.js:30-33` `approach`/`inAxis`/`transAxis`: AUTO = the machine's G0 traverse; MANUAL = a `#1505` "jog to the next wall +
  Press Enter" prompt, no move — hand-rolled at `middleWizard.js:93-99`). But the shared `safeTraverseStack` (`ops/probeSurface.js`) is
  AUTO-only (center/seq/in-axis all emit G0). ⭐ **GENERALIZE:** add `approach: 'auto'|'manual'` to `safeTraverseStack` (manual → the
  `#1505` jog-prompt), REFACTOR middle's hand-rolled manual onto the shared block (ONE-SOURCE), then CORNER adopts it for **ALL** its
  travels (`#21/#22` Z-first→wall-1 AND `#23/#24` wall-1→wall-2) — a per-travel toggle. ⚠ manual vs auto = DIFFERENT blocks (prompt vs
  move) → a STRUCTURAL toggle → same data-op frontier class as probeZFirst (B4): bake in the twin OR fold into the structural-toggle work.
  Scout-first (the middle refactor must stay value-identical). *(This is the [[probe-surface-block-generalises-probing]] pattern — pull the
  scattered per-wizard manual-travel into the one declared travel primitive.)*
- **inc B4 — PROBE-Z-FIRST + the structural-toggle capability (REQUIRED for replacement).** probeZFirst (add the Z step) AND auto/manual
  travel are BOTH structural toggles the data model can't yet do. Likely: ALWAYS emit the block, GUARDED by a flag (conditional goto) → a
  BOUND VALUE in a fixed shape. Red frontier-gate holds until it lands. (Groups with auto/manual travel above — same capability.)
- **FOLLOW-UP — stock-datum integration (B1b GATE):** wire the stock-datum coord (PlaceOnStock / "sits at WCS") to the corner op so the
  reposition DEFAULT + the B3 drag become datum-relative (the LOCKED-MODEL TARGET; interim = signed-travelDist / default-relative today).
- **inc C — VERIFY + RELEASE:** all dims end-to-end (EMIT · SIM · LAYOUT+DRAG · Probe-Z-First · auto/manual travel) + full suite green.
  Release when verified. Closes the FIRST full wizard-as-data port that REPLACES its built-in.

---

## ⏸️ PAUSED — B-TRANS / middle (all SHIPPED work is on MAIN up to V10.49; resume later)
- the **`#53` / probe-calc SIM fix** (sim probe accumulates → degenerate `#53` + manual off-stock start; ONE fix, BOTH).
- the **AUTO second-transition (→③) diagonal is still hard-coded** (V10.49 `#22` fix only covered →②; auto→③ doesn't).
- inc2b (two-meanings-of-pass) · B-TRANS canvas rollout · full-suite re-run to confirm V10.49.

**REFS:** `WIZARD-PORTING-MAP.md` · `SPATIAL-MODEL-SPEC.md` · `TRAVEL-START-SPEC.md` · `MIDDLE-PROBE-BACKLOG.md`.
