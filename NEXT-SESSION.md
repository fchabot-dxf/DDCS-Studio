# NEXT-SESSION — advisor → worker dispatch

**Branch:** `port/corner-clean` (off `main` @9bc0a7c = shipped V10.49 + concurrent H2). **Backups:** `wizard-porting-work` · `corner-notepad-enrich`.
**NOT on main / not deployed** — 18 commits ahead of `origin/main` (which has no `cornerData`); the branch is served locally via VSCode Live Server.

## 🔒 THE LOCKED MODEL (human turn 6) — "Corner (data)" REPLACES the built-in; positions are EXPRESSIONS of the stock-datum coord
Each reposition socket (`#21`/`#22` start, `#23`/`#24` cross) holds a **`datum + offset` EXPRESSION**:
- **DEFAULT** offset = stock-geometry-derived → correct-by-construction. **DRAG** = a datum-RELATIVE literal offset → tracks the stock (ABS = fallback).
- **REPLACE** mode (built-in retires). **Probe-Z-First** = a structural frontier (B4).

## ✅ DONE + VERIFIED (advisor reviews = fan-out + adversarial verify + independent re-run) — EMIT + SIM + LAYOUT+DRAG complete
- **EMIT** — inc A (mechanism) · B1 (corner twin) · B1b (reposition correct-by-default via signed-travelDist expressions; degenerate `G0 X0 Y0` dead).
- **SIM** — B2 → B2b (per-PROBE-PASS markers, pass-aligned vs the REAL engine, none inside the stock).
- **LAYOUT+DRAG** — B3 (generic canvas-widget wiring, no per-wizard view) → B3b (drag writes the CORRECT INCREMENTAL DELTA `world−wall1`,
  via a GENERIC point-anchor `relTo:0` from `opSimStarts`; test asserts the VALUE + rejects absolute). 452/0-fail.
- **Human calls:** REPLACE (t6) · positions = datum expressions (t6) · dropdown dup = stale localStorage op (t8) · ADD auto/manual travel (t12) · B3 (t12).
- **Recurring lesson:** the worker's tests keep asserting a change HAPPENED, not that the RESULT is CORRECT (B1 golden / B2 finite / B3 literal) —
  every test-bearing dispatch now MANDATES asserting the correct value vs an INDEPENDENT truth; the advisor re-runs + fan-out-reviews.

## 🚦 ACTIVE DISPATCH — ① AUTO/MANUAL TRAVEL: BUILD (scout plan BLESSED) [advisor turn 18]
The scout plan (WORK-LOG turn-17) is SOUND + adversarially self-verified (middle value-identity + corner back-compat both HOLD; the "drop
crux" elegantly resolved — corner-manual reuses each travel's OWN auto `lift #19`/`drop #18`, no new `manualLift/Drop`). BUILD per the plan
§1–§4 (early-return manual branch in `safeTraverseStack`; middle `reposition()`→ the shared block; corner `travelApproach`→ both seq calls;
twin bakes auto). **Fork decisions:**
1. **SINGLE `travelApproach`** (governs both corner travels) — CONFIRMED (matches the human's "for all travel within"; per-travel is a cheap
   additive refinement later via middle's `oneMode` precedent if a real case appears).
2. **Value-identity proof:** the targeted UNIT EQUIVALENCE is the PRIMARY proof; KEEP the full-macro before/after sweep as the backstop but
   **INLINE the golden — NO `UPDATE_GOLDEN` fixture machinery** (a ONE-SHOT refactor proof, not a maintained golden; rule-of-three: don't build
   a golden framework for one use) + the existing middle suite + `corner-data-emit` stay green.
3. **Twin frontier gate — BOTH:** the divergence row in `corner-data-emit.spec` (load-bearing) AND the loud `test.fixme` frontier spec —
   mirror the probeZFirst frontier EXACTLY (one-source: same pattern; both gate the built-in's retirement).
4. **DEFER the `travelApproach` GUI control + Blockly round-trip to ② (B4).** ① is EMIT plumbing; the twin BAKES auto (frontier) → a control
   there would be a NON-WORKING option (the bridge.js "don't surface dead options" lesson). The LIVE toggle + its control + round-trip land
   with ② when the structural capability makes it real. (This is the "① plumbing, ② the visible toggle" split I told the human.)
- HONOR the residual risks: DOCUMENT the `approach:'manual'` = seq/in-axis-ONLY constraint (never center/transTraverse — re-centre math) on
  the param; do NOT auto-prefix `REPOSITION:` inside the branch (the CALLER owns it — the sim pass-counter keys on it); the XY-only-jog-during-
  the-pause is a USER responsibility (as middle already ships).

**VERIFY:** middle emit BYTE/VALUE-IDENTICAL (unit-equivalence + full-macro sweep + middle suite green); corner emits the manual jog-prompt vs
the auto move per `travelApproach`, auto byte-identical to today; twin bakes auto + the frontier gate trips; full suite GREEN. Stage surgically.
Commit + WORK-LOG + pass.

**NORTH STAR:** one-source (the ONE declared travel primitive owns auto/manual; kill the per-wizard hand-roll — the probe-surface-block
generalises-probing pattern) · valid-by-construction · verify-real-symptom (middle proven byte/value-identical post-refactor).

## 📌 QUEUED (advisor dispatches each after review — no human check-in):
- **② B4 — PROBE-Z-FIRST + the structural-toggle capability (REQUIRED for replacement).** probeZFirst (add the Z step) AND auto/manual travel
  (prompt vs move) are BOTH structural toggles the data model can't yet do. Likely: ALWAYS emit the block, GUARDED by a flag (conditional
  goto) → a BOUND VALUE in a fixed shape. Makes both toggles LIVE in "Corner (data)". Red frontier-gate holds until it lands.
  (Also fixes the latent `relTo` anchor shift: with probeZFirst on, sim-start[0] = Z-surface not wall-1, so the drag anchor index must adjust.)
- **③ FOLLOW-UP — stock-datum integration (B1b GATE):** wire the stock-datum coord (PlaceOnStock / "sits at WCS") to the corner op so the
  reposition DEFAULT + the B3 drag become datum-relative (the LOCKED-MODEL TARGET; interim = signed-travelDist / wall-1-relative today).
  Also cures the B3 caveat (handle renders at world 0,0 when unset → renders at the true wall once the datum resolves).
- **④ inc C — VERIFY + RELEASE:** all dims end-to-end (EMIT · SIM · LAYOUT+DRAG · Probe-Z-First · auto/manual travel) + full suite green.
  Release when verified (merge to main + version bump → pages.dev + exe). Closes the FIRST full wizard-as-data port that REPLACES its built-in.

---

## ⏸️ PAUSED — B-TRANS / middle (all SHIPPED work is on MAIN up to V10.49; resume later)
- the **`#53` / probe-calc SIM fix** · the **AUTO second-transition (→③) diagonal still hard-coded** · inc2b · B-TRANS canvas rollout · full-suite re-run to confirm V10.49.

**REFS:** `WIZARD-PORTING-MAP.md` · `SPATIAL-MODEL-SPEC.md` · `TRAVEL-START-SPEC.md` · `MIDDLE-PROBE-BACKLOG.md`.
