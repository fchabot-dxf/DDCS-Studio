# NEXT-SESSION — advisor → worker dispatch

**Branch:** `port/corner-clean` (off `main` @9bc0a7c = shipped V10.49 + concurrent H2). A FRESH, clean corner-port branch, cut
after the 89-file `wizard-porting-work` dump was audited. **Backups (READ-ONLY reference, nothing lost):** `wizard-porting-work`
(the audited 89-file dump) · `corner-notepad-enrich` (the retry + preserved uncommitted work).

## 📋 THE AUDIT (5 adversarial reviewers, runtime-verified — the basis for this plan)
`wizard-porting-work` (7634815) = **good code, unfit commit.** The wizards-as-data PORT MECHANISM is SOUND ("the crown jewel")
and the corner wizard/view port is clean; the break is 3 small corner-specific defects; the rest is junk + other agents' WIP swept
into one "wip" label. So: **DON'T build on that branch — LIFT the clean pieces here, worker-driven, and REDO the one broken file.**

**The 3 corner defects (runtime-proven):**
1. `data/cornerPort.js` `CORNER_EXEC_BINDINGS` — **hand-counted block-index map is off-by-one** (skips the `=== CONFIGURATION ===`
   comment at flat index 3) → all 9 bindings shift → `registerUserOp` THROWS (swallowed by an app.js try/catch → silently mis-binds).
2. `viz/opSimStarts.js` `corner()` — guard `stx !== null` but `n()` returns **`undefined`** → NaN preview-marker coords when the
   cross-over fields are blank (the default). `middle()` uses the correct `Number.isFinite()`.
3. `wizards/cornerWizard.js:224` — `inferStarts()` calls `window.app.opSimStarts(...)`, a global **assigned nowhere** → corner falls
   back to a single start (multi-handle drag / Wall-2 travel-tie never populate). Siblings `import { opSimStarts }` directly.

---

## 🚦 ACTIVE DISPATCH — CORNER-PORT inc A (advisor → worker): LIFT the PORT MECHANISM onto `port/corner-clean`, verify it loads + tests pass [audit-driven; human "please do, don't forget the north star"]

Lift the audit-SOUND wizards-as-data **mechanism** (the crown jewel) from `wizard-porting-work` onto this fresh branch — the FOUNDATION
the corner port sits on. **Reference:** `git show wizard-porting-work -- <file>` / `git checkout wizard-porting-work -- <file>`.

**Mechanism files (audit-confirmed SOUND — lift these ONLY):**
- `blocks/blockEmitter.js` (user_root / param_group transparency) · `wizards/ops/userRoot.js` + `wizards/ops/layout.js` (block defs +
  PALETTE) · `blocks/userOps.js` (resolveSim/Panel/LayoutMeta, panelFromStack/layoutFromStack, flattenBlocks group-propagation) ·
  `wizards/ops/probeSurface.js` (`safeTraverseStack`) · the 5 `blocks/dataOps/*.js` `user_root` wraps (WRAP_PREFIX_COUNT=4, verified) ·
  `web/app.js` seeding (`seedDefaultPortedUserOps`) · `blocks/blockly/{bridge,stackBridge}.js` (user_root DO→GCODE/SIM round-trip) ·
  `blocks/wizardLibrary.js` (`*_datawiz` groups) · `wizards/ops/index.js`, `wizards/ops/panelTypes.js` as needed for the above to resolve.

⚠ **LIFT ONLY THE MECHANISM.** Do NOT sweep in the other agents' swept-in WIP (homing / middle-B-TRANS-followon / spatial-GUI
number-roles / H2 virtual-I/O — each lands via ITS OWN branch, two carry their own regressions) NOR the junk (`.proc`, worktree
pointers, `_*.png`, `.vscode`). This is the EDGE-lesson discipline: lift only what's audited-clean; don't own the dump.

**VERIFY:** `node --check` clean on every lifted file; `registerUserOp` + the DO→GCODE/SIM round-trip work; the mechanism tests pass
(`{slot,drill,text,surfacing,atc-warmup}-as-data.spec`, `user-root-transparent-emit.spec`, `custom-op-sim-starts-precedence.spec`).
Full suite green. SCOPE = the mechanism only (NOT the corner port = inc B). Commit + WORK-LOG + pass.

**NORTH STAR:** wizards-as-data (the whole point) · one-source (the mechanism is the SINGLE generic consumer pipeline) ·
declare-never-infer · valid-by-construction. `WIZARD-PORTING-MAP.md` is the reference architecture.

---

## 📌 QUEUED — CORNER-PORT inc B: the corner port itself (fires after inc A lands + is reviewed)
- LIFT the audit-SOUND corner UI: `cornerWizard.js` cornerStack refactor (#21–#24 cross-traverse via shared `safeTraverseStack`,
  enum-normalizing param maps, `inferStarts`) · `cornerView.js` FeatureCanvas port (drag handles, `tieCornerTravel`, `getPassStarts`) ·
  `index.html` corner panel · the schema/FIELD_BIND rename (`travelDist`→`startX/startY/cross1_x/cross1_y`, internally consistent).
- ⭐ **REDO `cornerPort.js` → refile as `blocks/dataOps/cornerData.js`** (one-source: match the 5 siblings). **DERIVE the binding
  indices PROGRAMMATICALLY from the flattened stack — NOT hand-counted** → declare-never-infer / valid-by-construction (kills the
  off-by-one AND makes it robust to the `probeZFirst` toggle). This is defect #1's real fix.
- FIX defect #2: `opSimStarts.corner()` `!== null` → `Number.isFinite()` (like `middle()`). FIX defect #3: `cornerWizard.js`
  `window.app.opSimStarts` → `import { opSimStarts }`.
- DROP the corner orphans (dead `travelOwn`/`travelOpp` + imports, unused `td`, stale `Travel:` header).
- ⭐ **ADD an EMIT-CORRECTNESS test** — `corner-data-layout.spec` only checks a field-rewrite, NEVER that the emitted G-code is
  correct (that is WHY the break shipped). Assert the corner data-port emits the SAME G-code as the built-in `cornerWizard`
  (byte/value-identical via `stripAnnotations`) → verify-real-symptom. DISCARD `_diag-endoffset.spec.js` (asserts nothing).

---

## ⏸️ PAUSED — B-TRANS / middle (all SHIPPED work is on MAIN up to V10.49; resume later)
- the **`#53` / probe-calc SIM fix** — the sim's probe doesn't STOP / accumulates → degenerate `#53` (auto measured-centre ≈2) +
  the manual off-stock start. ONE fix, BOTH symptoms.
- the **AUTO second-transition (→③) diagonal is still hard-coded** — the B-TRANS (b) fix (V10.49, `#22` primary-peer) only covered
  the FIRST transition (→②); manual→③ works, auto→③ doesn't. (human-demonstrated t178.)
- inc2b (two-meanings-of-pass → the 4th/5th markers) · B-TRANS canvas rollout to corner/rotary/alignment.
- a full-suite re-run to confirm V10.49 (the box was heavily loaded).

**REFS:** `WIZARD-PORTING-MAP.md` · `SPATIAL-MODEL-SPEC.md` · `TRAVEL-START-SPEC.md` · `MIDDLE-PROBE-BACKLOG.md`.
