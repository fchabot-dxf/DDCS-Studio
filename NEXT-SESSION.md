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

## 🚦 ACTIVE DISPATCH — ① AUTO/MANUAL TRAVEL: generalize into `safeTraverseStack` (SCOUT + GATE) [advisor turn 16; human t12]
Generalize middle's EXISTING per-traverse auto/manual into the ONE shared travel primitive, so corner (+ every wizard) inherits it — NOT a
per-wizard hand-roll. This is a shared-primitive CONTRACT change + a refactor of SHIPPED middle code → **SCOUT + GATE first** (report the plan; I review before you build).
- **Ground truth to build on:** middle has auto/manual per-traverse (`middleWizard.js:30-33` `approach`/`inAxis`/`transAxis`): AUTO = the
  machine's G0 traverse; MANUAL = a `#1505` "jog to the next wall + Press Enter" prompt (no move) — HAND-ROLLED at `middleWizard.js:93-99`.
  The shared `safeTraverseStack` (`ops/probeSurface.js`) is AUTO-only (center/seq/in-axis all emit G0).
- **Propose (in the scout):**
  1. Add `approach: 'auto'|'manual'` to `safeTraverseStack` — manual → the `#1505` jog-prompt; auto → the current G0 (default, back-compat).
  2. REFACTOR middle's hand-rolled manual (`:93-99`) onto the shared block — **must be VALUE-IDENTICAL** (middle is shipped; prove it with a sweep).
  3. CORNER adopts it for ALL its travels: `#21/#22` (Z-first→wall-1) AND `#23/#24` (wall-1→wall-2) — a per-travel toggle.
  4. DATA op ("Corner (data)"): manual vs auto = DIFFERENT blocks (prompt vs move) → a STRUCTURAL toggle `instantiate` can't do → same class
     as probeZFirst; BAKE auto in the twin for now, the LIVE toggle lands with ② (the structural-toggle capability). Say how you'll bake+gate it.
- **GATE:** report the plan (the `safeTraverseStack` API · the middle value-identity proof approach · the corner adoption · the twin handling)
  BEFORE building. I review, then dispatch the build.
- SCOPE (build, after gate): the shared primitive + middle refactor (value-identical) + corner emit adoption. NOT the live data-op toggle (②).

**NORTH STAR:** one-source (the ONE declared travel primitive owns auto/manual; kill the per-wizard hand-roll — the probe-surface-block
generalises-probing pattern) · valid-by-construction · verify-real-symptom (middle's emit proven byte/value-identical post-refactor).

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
