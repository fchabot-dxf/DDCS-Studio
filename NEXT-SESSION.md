# NEXT-SESSION — advisor → worker dispatch

**Branch:** `port/corner-clean` (off `main` @9bc0a7c). NOT on main / not deployed. Served locally via VSCode Live Server. **Backups:** `wizard-porting-work` · `corner-notepad-enrich`.

## 🔒 THE LOCKED MODEL (human turn 6) — "Corner (data)" REPLACES the built-in; reposition positions are EXPRESSIONS of the stock-datum coord
Socket = `datum + offset` EXPRESSION. DEFAULT = stock-geometry-derived; DRAG = datum-RELATIVE literal (tracks stock); ABS = fallback. REPLACE mode.

## ✅ DONE + VERIFIED (advisor reviews = fan-out + adversarial verify + independent re-run)
- **EMIT** — A (mechanism) · B1 (twin) · B1b (reposition correct-by-default via signed-travelDist expressions).
- **SIM** — B2 → B2b (per-PROBE-PASS markers, pass-aligned vs the REAL engine, none inside the stock).
- **LAYOUT+DRAG** — B3 (generic canvas-widget wiring) → B3b (drag writes the CORRECT incremental delta `world−wall1` via a generic
  point-anchor `relTo:0`; test asserts the value + rejects absolute).
- **① AUTO/MANUAL TRAVEL** (human t12) — generalized into the shared `safeTraverseStack` (`approach:'auto'|'manual'`, manual = a `#1505`
  jog-prompt via a guarded early-return; auto arms untouched). Middle's hand-rolled manual refactored onto it, proven **BYTE-IDENTICAL**
  (unit equivalence + a FROZEN before-tip full-macro golden — review CLEAN 2/2, re-run green). Corner adopts one `travelApproach` on both
  travels (reuses each travel's own lift/drop). Twin bakes auto + divergence row + loud fixme frontier gate.
- **Recurring lesson:** every test-bearing dispatch MANDATES asserting the correct VALUE vs an INDEPENDENT truth (not just "it changed"); advisor re-runs + fan-out-reviews.

## 🐞 THE WIZ-BAR GAP (user-found t18, trace-CONFIRMED) — the canvas is built but the BAR opens the wrong surface
Clicking "Corner (data)" in the Probe-Data-Wiz dropdown routes to the plain quick-insert FORM (`commandDeck.js:70-75` → `ddcsInsertUserOp`
→ `userOpForm.openUserOpForm` = fields only). The FeatureCanvas + drag render ONLY via the WIZARD path (`openWiz` → `wizardManager.open` →
`userOpView.update` → `renderLayout2D`). The B3 test used `openWiz` (passed); the user clicks the bar (form-only). Same op, two doors —
NOT stale cache. → **B3c** below. (The parallel isolated build of this 529'd before committing; the worker builds it fresh.)

## 🚦 ACTIVE DISPATCH — B3c: WIZ-BAR ROUTING — open the canvas, not the plain form [advisor turn 20; user-blocked]
Route panel-declaring data-ops from the bar to the canvas/wizard path so "Corner (data)" opens its 2D layout + drag handle (the thing the
human has been trying to see), not the bare form.
- **FIX:** in `commandDeck.js wizItemOnclick(e)`, route a `kind:'user'` entry whose `e.def.panel` is `'form2d'`/`'form3d'` to the CANVAS/
  wizard path (the `openWiz`/`wizardManager.open` seam) instead of `ddcsInsertUserOp`. Keep form-only user ops on the quick form (no regression).
  The full def is on the entry (`wizardLibrary.userEntries` sets `def:d`), so `e.def.panel` is available.
- **SCOUT the ONE subtlety — the INSERT flow:** does the wizard/`userOpView` path actually INSERT the op into the program (the quick-form's
  job), or only preview/edit? It MUST still insert. If the wizard path can't insert, wire the right seam so a form2d op both RENDERS its
  canvas AND inserts. GATE if this is a bigger seam than a routing switch.
- ⭐ **TEST (verify-real-symptom — the USER's path, NOT `openWiz`):** open "Corner (data)" via the DROPDOWN/commandDeck click entrypoint and
  assert the FeatureCanvas + a `.fc-handle-move` RENDER (the exact gap). Must FAIL pre-fix, PASS post-fix.
- SCOPE: the routing (`commandDeck`) + whatever the insert flow needs. NOT the emit (done); NOT ②'s toggles.

**VERIFY:** clicking "Corner (data)" in the bar opens the 2D canvas + drag handle (and it STILL inserts); the new dropdown-path test + the
existing commandDeck/user-op specs + full suite GREEN. **STAGE SURGICALLY** (never `git add -A`). Commit + WORK-LOG + pass.

**NORTH STAR:** verify-real-symptom (test the path the USER takes) · GUI-first (the canvas IS the point) · one-source (route by the declared
`panel` — generic to every visual data-op, not corner-special).

## 📌 QUEUED (advisor dispatches each after review — no human check-in):
- **② B4 — PROBE-Z-FIRST + auto/manual LIVE toggle + the structural-toggle capability + GUI/round-trip (REQUIRED for replacement).**
  probeZFirst (add the Z step) AND auto/manual travel (prompt vs move) are BOTH structural toggles the twin can't yet do (baked). Likely:
  ALWAYS emit the block GUARDED by a flag (conditional goto) → a BOUND VALUE in a fixed shape → both go LIVE in "Corner (data)". Ship the
  `travelApproach` (+ probeZFirst) GUI control + Blockly round-trip HERE (once live). Also fix the latent `relTo` anchor shift under probeZFirst.
- **③ FOLLOW-UP — stock-datum integration (B1b GATE):** wire the stock-datum coord (PlaceOnStock / "sits at WCS") to the corner op so the
  reposition DEFAULT + the B3 drag become datum-relative (interim = signed-travelDist / wall-1-relative today). Cures the B3 (0,0) handle caveat.
- **④ inc C — VERIFY + RELEASE:** all dims end-to-end + full suite green → merge to main + version bump → pages.dev + exe. Closes the FIRST
  full wizard-as-data port that REPLACES its built-in.

---

## ⏸️ PAUSED — B-TRANS / middle (all SHIPPED work is on MAIN up to V10.49; resume later)
- `#53`/probe-calc SIM fix · AUTO second-transition (→③) diagonal still hard-coded · inc2b · B-TRANS canvas rollout · full-suite re-run to confirm V10.49.

**REFS:** `WIZARD-PORTING-MAP.md` · `SPATIAL-MODEL-SPEC.md` · `TRAVEL-START-SPEC.md` · `MIDDLE-PROBE-BACKLOG.md`.
