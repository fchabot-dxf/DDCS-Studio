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

## 🚦 ACTIVE DISPATCH — CORNER-PORT inc B2: SIM (declare the preview start-markers) [advisor turn 8]
Make "Corner (data)"'s 3D preview render its per-pass START MARKERS. **PREMISE (advisor-verified turn 8):** a DATA op's sim starts come
from its OWN DECLARED `simstart` rows (template `simstart` canonical, `def.sim.starts` fallback — the custom-op-sim-starts-precedence
spec), routed via `setUserSimStarts`/`makeProvider`, NOT the built-in's `opSimStarts.corner()`. `cornerData` currently declares NONE →
its preview shows no per-pass markers. And we're REPLACING the built-in. So B2 = **DECLARE the corner sim-starts on `cornerData`** — do
NOT fix the retiring built-in's `opSimStarts.corner`/`inferStarts` (defects #2/#3) unless the data op genuinely routes through them.
- **SCOUT FIRST:** confirm the user-op marker path (`setUserSimStarts` ← template `simstart` rows via `makeProvider`; `opSimContext`).
  Confirm HOW a `simstart` row expresses a position (static coord vs a binding/expression). Report the mechanism; **GATE** if declaring the
  rows is bigger than expected (e.g. positions need the datum the B1b gate deferred).
- **DECLARE** a `simstart` row per pass on `cornerData` (Z-plunge start · wall-1 start · reposition · wall-2 start) so the preview renders
  them, positions following the LOCKED MODEL (resolve to the DEFAULT geometry for the marker). **NO NaN** when a socket holds an expression
  string — tolerate it (`Number.isFinite()` discipline), render no marker rather than NaN.
- SCOPE: SIM only. No emit change (B1b done); no view/canvas (B3).

**VERIFY:** a placed "Corner (data)" renders its start markers in the REAL preview with NO NaN coords (incl. expression-holding reposition
sockets); a declared sim-starts spec + full suite GREEN. **STAGE SURGICALLY** (stray PNG/HANDOFF churn — never `git add -A`). Commit + WORK-LOG + pass.

**NORTH STAR:** declare-never-infer (sim intent DECLARED on the op, never inferred from motion — the custom-op rule) · verify-real-symptom
(markers render in the REAL preview, not just a spec) · one-source (the same declared provider path the 5 siblings use).

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
