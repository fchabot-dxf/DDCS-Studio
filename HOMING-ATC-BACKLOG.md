# Homing + ATC backlog (prepared 2026-06-28, advisor)

Code-grounded — every item has `file:line` (verified by a read-only exploration of `DDCS-Studio/web`).
Primary scope = **HOMING**; ATC is the secondary sweep. ★ = headline. Each item notes severity + a verify-first hook.
These REFINE/ground the existing ROADMAP backlog (#2 = H3, #3 = H2, #11 = A1) and add new items.

---

## HOMING

### H1 (MED — RE-SCOPED, human-corrected + advisor-verified, turn 46) — Homing preview moves via a SIMPLIFIED proxy; raw `M98` isn't engine-run
⚠ **The Explore agent's original claim ("homing does nothing in sim") was WRONG** — human-observed ("the M98 is doing something, it's moving the spindle") + advisor-verified: the homing WIZARD PREVIEW **does** move the spindle. `homingView` feeds **`homingSimProxy`** (plain G53 moves to machine-0 + backoff) to the preview, NOT the raw macro — so the motion shows.
- `wizards/views/homingView.js:88` (`ctx.preview3D(wizard.simProxy(params), …)`); `wizards/homingWizard.js:237-267` (proxy); `engine/GcodeExecutionEngine.js:729-803` (no `M98` handler — grep-confirmed empty, but irrelevant to the preview).
- **Real (smaller) gaps that remain:** (a) the proxy is a SIMPLIFIED G53 model — it moves the spindle but doesn't model switch-seek or set homed flags (overlaps **H2**); (b) if the RAW emitted homing macro (the literal `M98 P501` lines) is Simulated through the engine DIRECTLY (e.g. in the editor, not the wizard preview), `M98` is skipped → no motion there — a possible wizard-preview-vs-editor-sim inconsistency.
- **Verify-first:** does an editor Simulate of an inserted homing macro show motion? If yes → no gap. If no → that inconsistency is the real (small) item. **LESSON: a code-read ("no M98 handler") ≠ the real behavior (the proxy path); verify the symptom.** [[verify-real-symptom-not-just-test]]

### ★ H2 (HIGH — whole INITIATIVE) — Limit/home switches not modeled in the sim  *(= ROADMAP #3)*
Limit/home switches are I/O-configurable (per-axis `x_min..z_max`, pins 1-24) but NEVER read by the engine;
`virtualIO` has no `IN_HOME_*`/`IN_LIMIT_*`; `probeGeometry` clamps the STOCK only, not the machine envelope.
So homing can't simulate seek-to-switch — a seek runs off the envelope with nothing to trip it. (HOME == the limit position.)
- `engine/virtualIO.js:102-365` (no home/limit in truth table); `ui/ioTable.js:76-145` (configurable, unused); `engine/probeGeometry.js:75-96` (stock only); `engine/GcodeExecutionEngine.js:850-920` (motion, no envelope check).
- **NOTE:** big — model the switches as I/O at the envelope edges; tool motion trips them like a G31 trips the probe (rides `window.ioPanel` + `waitInput`). Parked behind the probe-cue work (memory: "homing is a whole initiative").

### ★ H3 (MEDIUM) — Home DIRECTION: two sources that can disagree + NO per-axis override UI  *(= ROADMAP #2)*
Direction comes from TWO independent sources: the SIGNED machine travel (`settings.machine.x/y/z` sign) and the
controller register `#[612+N]`. The seek path uses signed-travel (or `#612` if `dir===0`); native `M98` trusts the
controller. A `c.dir` per-axis override is READ in code but there is **no UI to set it** — so the two can drift.
- `wizards/homingWizard.js:131-145` (direction cascade explicit > signed-travel > `#612`), `:136` (reads `c.dir`); `ui/settingsPanel.js:150-152` (signed-travel owns direction, doc); `ui/macrosApp.js:851-876` (no dir field); `wizards/views/homingView.js:13,80` (not exposed).
- **Fix:** one-source the DEFAULT off the signed envelope, and expose a per-axis direction OVERRIDE in the Homing setup UI + homing op schema (`blocks/opSchema.js:85`). Default = valid-by-construction; override = autonomy.

### H4 (MED) — `#[1920+N]` limit-vs-home detection UNVERIFIED
Used in the G31 seek to tell a hard-limit strike from the home switch; semantics undocumented on this controller. `wizards/homingWizard.js:158-160`.

### H5 (MED) — G31 granular seek path UNVERIFIED on hardware
The seek method (a re-derivation of the controller's O501) is explicitly marked unverified; native `M98 P501` is the robust path. `wizards/homingWizard.js:14-16, 120-140`.

### H6 (MED) — Rotary A/B homing untested
`setzero`/`switch` + continuous-wrap branch has no hardware test. `ui/macrosApp.js:871-873`; `wizards/homingWizard.js:257`.

### H7 (LOW) — No post-homing return-to-reference / safe-Z
The macro leaves the tool AT the home switch (no trailing G53 safe-Z / reference-offset return; the O501 `#622-626` remap isn't carried). `wizards/homingWizard.js:191-192`.

### H8 (LOW) — `M98 P503` mid-level seek not exposed (only native P501 or G31).
### H9 (LOW) — Gantry auto-squaring is sync-only (operator squares manually).

---

## ATC

### ★ A1 (CRITICAL) — `#11` Z-plunge below the table/envelope: no Z-clamp AND invisible in preview
The machine-move atom emits `G53 Z` with NO envelope clamp; ATC change/length/check/test all move Z unclamped.
Worse — `GcodeSimulator` SKIPS G53 moves entirely → the plunge is INVISIBLE in the preview trace, and the 3D
envelope just expands downward to fit. So a bad Z sinks the spindle into the table with no warning.
- `wizards/ops/macro.js:16-20` (unclamped emit); `wizards/atcChangeWizard.js:121-147 / 185-210 / 232-233` (MM Z moves); `wizards/atcLengthWizard.js:74`; `wizards/atcToolCheckWizard.js:72,79`; `wizards/atcTestWizard.js:82`; `engine/GcodeSimulator.js:147-164` (G53 SKIPPED); `viz/gcodeViz3d.js:877-882` (envelope expands to fit).
- **Fix direction:** make G53 moves VISIBLE in the trace (so a plunge is caught) + clamp/validate Z against `envelope.minZ` where known. Verify-first the real plunge repro.

### A2 (HIGH) — Generic auto-change (drawbar pick&place) is ASSUMED, never verified
`autoStack` models a drawbar pick&place the real M350 O10102 (a pneumatic push station) does NOT do; kept for back-compat. Needs a bold in-UI "unverified — review every line" warning. `wizards/atcChangeWizard.js:76-156` (`:80-81`, `:99`).

### A3 (HIGH) — Disk/carousel indexing STUBBED
Rotation is a literal G-code comment (">> Rotate carousel to pocket #N here…"); no firmware rotate verb, no index sync-wait (M303/M304), no rotation viz. `wizards/atcChangeWizard.js:161-215` (`:194`, `:206`).

### A4 (MED) — Pocket-table writes (`#1330…`) unverified on hardware. `wizards/atcTableWizard.js:9-10`.
### A5 (MED) — G53 moves invisible in preview (safety-audit gap; ties to A1). `engine/GcodeSimulator.js:147-164`.
### A6 (MED) — Carousel rotation not visualized. `viz/gcodeViz3d.js:1259`.
### A7 (LOW) — Magazine vs tool-library: no validation (a deleted library tool stays referenced). `wizards/views/atcViews.js:38-53`.
### A8 (LOW) — Drawbar sensor waits hardcoded (no-sensor machines must hand-edit). `wizards/atcChangeWizard.js:132,144-146,196,208-209`.

---

## SOLID — do NOT backlog (verified working)
- **Homing:** native `M98 P501` emit, soft-limit re-enable (`#655`), set-zero, per-axis order, gantry slave-sync, settings persistence.
- **ATC:** m6 + firmware O10102 + manual change, tool-length setter, tool-check (re-tap), test macros, magazine table editor, `atc_warmup` data-port.

---

## Suggested first cuts (when these get scheduled — one per loop turn, verify-first)
1. **A1 (#11) Z-plunge** — highest user-facing safety risk; start by making G53 VISIBLE in the trace (verify-first the repro), then clamp.
2. **H3 (#2) home-direction override** — one-source the default off the signed envelope + a per-axis override UI; contained, fixes a real wrong-way bug.
3. **H2/#3 limit-switch sim** — the big initiative; sequence AFTER the probe-cue work, reuse the I/O-trip model. (Subsumes the real part of H1 — switch-seek + homed-flags; the proxy already shows motion.)
4. **H1 (re-scoped)** — only if an editor Simulate of the raw homing macro is found to show no motion (verify first); otherwise the proxy preview is fine.
