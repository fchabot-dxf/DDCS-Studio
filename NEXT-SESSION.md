# NEXT-SESSION — advisor → worker dispatch

**Branch:** `port/corner-clean` (off `main` @9bc0a7c = shipped V10.49 + concurrent H2). A FRESH, clean corner-port branch, cut
after the 89-file `wizard-porting-work` dump was audited. **Backups (READ-ONLY reference, nothing lost):** `wizard-porting-work`
(the audited 89-file dump) · `corner-notepad-enrich` (the retry + preserved uncommitted work).

## 📋 THE AUDIT (5 adversarial reviewers, runtime-verified — the basis for this plan)
`wizard-porting-work` (7634815) = **good code, unfit commit.** The wizards-as-data PORT MECHANISM is SOUND ("the crown jewel")
and the corner wizard/view port is clean; the break is 3 small corner-specific defects; the rest is junk + other agents' WIP swept
into one "wip" label. So: **DON'T build on that branch — LIFT the clean pieces here, worker-driven, and REDO the one broken file.**

**The 3 corner defects (runtime-proven):**
1. `data/cornerPort.js` `CORNER_EXEC_BINDINGS` — hand-counted block-index map off-by-one → `registerUserOp` THROWS. **FIXED inc B1**
   (deriveBindings.js — reviewer-confirmed clean).
2. `viz/opSimStarts.js` `corner()` — guard `stx !== null` but `n()` returns **`undefined`** → NaN preview-marker coords. **inc B2 (SIM).**
3. `wizards/cornerWizard.js` `inferStarts()` calls `window.app.opSimStarts(...)`, a global assigned nowhere. **inc B2 (SIM).**

---

## ✅ inc A DONE + VERIFIED (advisor turn 2) — the wizards-as-data MECHANISM is lifted
- Mechanism lifted (fb3f439/118a6f2/d06e770); 4-lens review: emit-identity + mechanism-soundness CLEAN, 4/5 refuted, 1 nit; 7 specs green.
- FLAG1 commit-split = LEAVE (cosmetic). FLAG2 stale advisor marker = FIXED (178→2).

## ✅ inc B1 DONE + REVIEWED (advisor turn 6) — corner EMIT via derived-binding data twin; the "regression" dissolved by human "REPLACE"
- Worker built B1 (73b4293): cornerStack EMIT lift + `deriveBindings.js` (reusable) + `cornerData.js` + emit/frontier specs; suite 448/3-skip/0-fail.
- **ADVISOR REVIEW** (4-lens + adversarial verify, 11 agents): **derive-helper CLEAN** · **FLAG1 safeZ-bake CORRECT** (real fan-out
  `#17`+`#19`; baking is valid-by-construction + sibling-consistent → KEEP) · probeSeq XY→YX default = not a regression (canonical).
- The review flagged a built-in regression: the schema rename → `cross1_x/cross1_y` default `0` → the reposition collapses to
  `G0 X0 Y0`, on the SHARED `cornerStack`. **Human ruling (turn 6): "REPLACE"** — "Corner (data)" REPLACES the built-in, so its
  transitional emit is IRRELEVANT (drop the byte-identical-to-old invariant). The REAL residue = the data op's OWN default must be correct.

### 🔒 THE LOCKED MODEL (human turn 6) — reposition positions are EXPRESSIONS of the stock-datum coord
Each reposition socket (`#21`/`#22` start, `#23`/`#24` cross) holds a **`datum + offset` EXPRESSION** (declare-never-infer, not a magic number):
- **DEFAULT** offset = stock-geometry-derived → correct-by-construction (kills the degenerate default). Datum referenced via the WCS /
  "sits at WCS" stock placement (same wiring the sim/placement use → human: "probably wired" — VERIFY).
- **DRAG** (B3 canvas) = a **datum-RELATIVE literal offset** → tracks the stock (drill frontier-#2 lesson: never bake an absolute snapshot
  of derivable geometry). ABSOLUTE = the degenerate case (bare literal, no datum term) → a fallback, never the default.
- **REPLACE** mode (built-in retires). **Probe-Z-First** = the one structural frontier (its own planned increment; red gate holds).

## 🚦 ACTIVE DISPATCH — CORNER-PORT inc B1b: reposition correct-by-default via datum EXPRESSIONS [advisor turn 6; human "replace" + "expressions of the stock-datum coord"]
Make "Corner (data)" emit a CORRECT wall-to-wall reposition BY DEFAULT (it REPLACES the built-in — correctness is the bar, not
byte-identity to the old emit). Work to THE LOCKED MODEL above.
- **DEFAULT `#21`/`#22`/`#23`/`#24` to EXPRESSIONS, not literal `0`.** TARGET: datum-relative geometry expressions of the stock-datum
  coord (via the WCS / PlaceOnStock "sits at WCS"). **FIRST verify** the stock-datum coord is reachable from the corner op (it currently
  uses a relative `travelDist`, NOT stock geometry — so the target may need the corner op connected to the stock model):
  - **IF wired** → default to the datum-relative geometry expressions.
  - **IF NOT** (a bigger stock-model integration) → use **signed-`travelDist` expressions** (reproduce the base `travelOwn`/`travelOpp`
    ±travelDist reposition) as the CORRECT non-degenerate **INTERIM** — still an expression, fixes the default NOW — and **GATE** the
    stock-datum wiring as a follow-up increment (report it). Either way the degenerate `G0 X0 Y0` default dies in this increment.
- Keep `travelDist` as a bound scalar the interim expressions reference; keep the sockets **expression-holding** (so a datum default OR a
  B3 drag literal drops in later WITHOUT a schema change).
- **TEST:** `corner-data-emit` must pin the emit against a KNOWN-GOOD golden — the CORRECT non-zero reposition — NOT "agreement with
  `cornerStack`" alone (agreement passed while BOTH were degenerate — the verify-real-symptom trap that hid this).
- KEEP: `deriveBindings.js`, safeZ baked (FLAG1), the `corner-data-probeZFirst-frontier` gate, the additive seed.

**VERIFY:** a placed "Corner (data)" with DEFAULTS emits a real reposition (NOT `G0 X0 Y0`); `corner-data-emit` pins the correct motion +
GREEN; frontier-gate + the 7 inc-A + `probe-surface-block` GREEN; full suite green. **STAGE SURGICALLY** (stray PNG/HANDOFF churn — never
`git add -A`). Commit + WORK-LOG + pass.

**NORTH STAR:** declare-never-infer (position = DERIVED geometry, not a magic number) · valid-by-construction (datum-relative → tracks the
stock) · verify-real-symptom (the golden pins the REAL motion) · GUI-first (B3 drag overrides the same socket).

## 📌 QUEUED (advisor dispatches each after review — no human check-in):
- **inc B2 — SIM:** FIX defect #2 (`opSimStarts.corner()` `!== null` → `Number.isFinite()`) + defect #3 (`cornerWizard.js`
  `window.app.opSimStarts` → `import { opSimStarts }`) + `inferStarts`. VERIFY: a placed "Corner (data)" renders start markers (**NO NaN**).
- **inc B3 — LAYOUT + DRAG:** LIFT `cornerView.js` FeatureCanvas port + the `index.html` corner panel, rendered via
  `registerUserOp → def.panel/def.layout → userOpView`. ⭐ **The DRAG writes a datum-RELATIVE literal offset into the reposition socket**
  (overriding the default expression; tracks the stock). VERIFY: layout + form render; dragging a handle updates the emitted position.
- **inc B4 — PROBE-Z-FIRST (REQUIRED for replacement):** since "Corner (data)" REPLACES the built-in, it must do Probe-Z-First (an
  add-a-step, not an expression). Likely: ALWAYS emit the Z-surface step + traverse, GUARDED by a `probeZ` flag (conditional goto), so it
  becomes a BOUND VALUE in a fixed shape (registers stop shifting). Its own increment; the red frontier-gate holds until it lands.
- **inc C — VERIFY + RELEASE:** all dims end-to-end (EMIT correct reposition · SIM no-NaN · LAYOUT+DRAG · Probe-Z-First) + full suite
  green. Release when verified. Closes the FIRST full wizard-as-data port that REPLACES its built-in.

---

## ⏸️ PAUSED — B-TRANS / middle (all SHIPPED work is on MAIN up to V10.49; resume later)
- the **`#53` / probe-calc SIM fix** — the sim's probe doesn't STOP / accumulates → degenerate `#53` (auto measured-centre ≈2) +
  the manual off-stock start. ONE fix, BOTH symptoms.
- the **AUTO second-transition (→③) diagonal is still hard-coded** — the B-TRANS (b) fix (V10.49, `#22` primary-peer) only covered
  the FIRST transition (→②); manual→③ works, auto→③ doesn't. (human-demonstrated t178.)
- inc2b (two-meanings-of-pass → the 4th/5th markers) · B-TRANS canvas rollout to corner/rotary/alignment.
- a full-suite re-run to confirm V10.49 (the box was heavily loaded).

**REFS:** `WIZARD-PORTING-MAP.md` · `SPATIAL-MODEL-SPEC.md` · `TRAVEL-START-SPEC.md` · `MIDDLE-PROBE-BACKLOG.md`.
