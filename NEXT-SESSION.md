# NEXT-SESSION — advisor → worker dispatch

**Branch:** `port/corner-clean` (off `main` @9bc0a7c = shipped V10.49 + concurrent H2). A FRESH, clean corner-port branch, cut
after the 89-file `wizard-porting-work` dump was audited. **Backups (READ-ONLY reference):** `wizard-porting-work` · `corner-notepad-enrich`.

## 🔒 THE LOCKED MODEL (human turn 6) — corner "Corner (data)" REPLACES the built-in; positions are EXPRESSIONS of the stock-datum coord
Each reposition socket (`#21`/`#22` start, `#23`/`#24` cross) holds a **`datum + offset` EXPRESSION** (declare-never-infer, not a magic number):
- **DEFAULT** offset = stock-geometry-derived → correct-by-construction (kills the degenerate `G0 X0 Y0`). Datum via the WCS / "sits at WCS".
- **DRAG** (B3 canvas) = a datum-RELATIVE literal offset → tracks the stock (drill frontier-#2 lesson). ABS = the bare-literal fallback.
- **REPLACE** mode (built-in retires). **Probe-Z-First** = the one structural frontier (its own planned increment; red gate holds).

## ✅ DONE + VERIFIED (advisor reviews = fan-out + adversarial verify)
- **inc A** (mechanism lift): emit-identity + mechanism-soundness CLEAN; 7 specs green.
- **inc B1** (corner EMIT via derived-binding twin): derive-helper CLEAN; safeZ-bake correct (fan-out, keep). Review caught a "built-in
  regression" (schema rename → degenerate reposition) → dissolved by the human "REPLACE" ruling.
- **inc B1b** (reposition correct-by-default via EXPRESSIONS): review CLEAN 3/3 (reposition-correctness — golden pins the real ±travelDist
  motion, verified per-quadrant vs base; binding soundness — `travelDist` clean single-socket `#15`, `#16=[0-#15]` a reference; gate-verdict
  — stock-datum genuinely NOT a reachable `#var`, host-side JS folded by `translateProgram`). Degenerate `G0 X0 Y0` is DEAD; known-good
  golden added. INTERIM = signed-travelDist expressions; the datum-relative TARGET is GATED as a follow-up (below).
- **Dropdown dup (human turn 8):** a stale `user_corner_port` (the OLD hand-counted port) was a leftover localStorage save — NOT in this
  branch's code. Human deleted it; nothing re-seeds it. The kept op (`user_corner_data`) renders with real blocks = live-verified.

## ✅ inc B2 (SIM declared) — done, 1 concern → inc B2b
Worker declared `cornerData`'s OWN sim-starts (4 canonical `simstart` rows, NaN-safe by construction, real-symptom editor spec; premise
held — the built-in `opSimStarts.corner` doesn't exist). Review (2-lens): scope/emit CLEAN (emit untouched, bindings re-found under the
uiChildren shift). ONE concern: the markers align to WAYPOINTS, not PROBE PASSES → the reposition marker displaces wall-2 → probe-2 renders
INSIDE the stock + the true wall-2 marker is orphaned. Sim-preview only (concern, not blocker) → fixed in B2b.

## 🚦 ACTIVE DISPATCH — CORNER-PORT inc B2b: align sim-starts to PROBE PASSES [advisor turn 10]
The engine indexes preview markers by `_pass` (incremented at each reposition/traverse delimiter); markers must be ONE-PER-PROBE-PASS, not
one-per-waypoint. Currently `CORNER_SIM_STARTS` declares a SEPARATE reposition marker → 3 markers for a 2-pass macro → wall-2's marker is
the reposition point (INSIDE the stock) + the true wall-2 marker orphaned. Sibling contract: `opSimStarts` middle boss-both (2 probes /
1 reposition) = EXACTLY 2 markers, NO reposition marker.
- **FIX:** declare ONE marker per PROBE PASS — wall-1 start · wall-2 start (+ the Z-surface start when probeZFirst) — and REMOVE the
  reposition-waypoint marker. Markers index 1:1 with the engine's `_pass`.
- **SCOUT** the exact `_pass`-increment triggers (which comments bump `_pass` in `GcodeExecutionEngine`) so the count + order are right for
  BOTH the no-Z default (2 passes) AND probeZFirst (its pass count); mirror the `opSimStarts` middle/edge providers.
- ⭐ **FIX THE TEST** (the gap that shipped this green): `corner-data-sim-starts` asserted markers finite/DISTINCT — NOT that each maps to
  the correct PROBE PASS. Assert PASS-ALIGNMENT: N markers == N probe passes, each at the pass's real start, and NONE inside the stock
  footprint (the real symptom). verify-real-symptom — assert the RIGHT property.
- SCOPE: the sim-start DECLARATION (`cornerData` `CORNER_SIM_STARTS`) + its test. No emit change; no B3 view wiring.

**VERIFY:** the placed "Corner (data)" preview shows one marker per probe pass, each at the correct start, NONE inside the stock; the
corrected sim-starts spec + `corner-data-emit` + full suite GREEN. **STAGE SURGICALLY** (never `git add -A`). Commit + WORK-LOG + pass.

**NORTH STAR:** verify-real-symptom (assert marker POSITION per pass, not just finiteness) · one-source (align to the `opSimStarts` per-pass
contract the siblings use) · declare-never-infer.

## 📌 QUEUED (advisor dispatches each after review — no human check-in):
- **inc B3 — LAYOUT + DRAG:** LIFT `cornerView.js` FeatureCanvas + the `index.html` corner panel via `registerUserOp →
  def.panel/def.layout → userOpView`. ⭐ The DRAG writes a datum-RELATIVE literal offset into the reposition socket (overrides the default
  expression; tracks the stock — the payoff of the LOCKED MODEL). VERIFY: layout + form render; dragging a handle updates the emit.
- **inc B4 — PROBE-Z-FIRST (REQUIRED for replacement):** an add-a-step, not an expression. Likely: ALWAYS emit the Z-surface step +
  traverse, GUARDED by a `probeZ` flag (conditional goto) → a BOUND VALUE in a fixed shape (registers stop shifting). Red frontier-gate holds until it lands.
- **FOLLOW-UP — stock-datum integration (B1b GATE):** wire the stock-datum coord (PlaceOnStock / "sits at WCS") through to the corner op so
  the reposition DEFAULT becomes the datum-relative geometry expression (the LOCKED MODEL TARGET; interim = signed-travelDist today).
- **inc C — VERIFY + RELEASE:** all dims end-to-end (EMIT correct reposition · SIM markers no-NaN · LAYOUT+DRAG · Probe-Z-First) + full
  suite green. Release when verified. Closes the FIRST full wizard-as-data port that REPLACES its built-in.

---

## ⏸️ PAUSED — B-TRANS / middle (all SHIPPED work is on MAIN up to V10.49; resume later)
- the **`#53` / probe-calc SIM fix** — sim probe doesn't STOP / accumulates → degenerate `#53` (auto ≈2) + manual off-stock start. ONE fix, BOTH.
- the **AUTO second-transition (→③) diagonal is still hard-coded** — the B-TRANS (b) fix (V10.49, `#22`) only covered →②; auto→③ doesn't. (t178.)
- inc2b (two-meanings-of-pass → 4th/5th markers) · B-TRANS canvas rollout to corner/rotary/alignment · full-suite re-run to confirm V10.49.

**REFS:** `WIZARD-PORTING-MAP.md` · `SPATIAL-MODEL-SPEC.md` · `TRAVEL-START-SPEC.md` · `MIDDLE-PROBE-BACKLOG.md`.
