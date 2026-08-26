# Session notes (2026-06) — settings, Mill wizards, ATC/probe fixes

Running session log. **Settings are now canonical in [`SETTINGS-IO-REDESIGN.md`](SETTINGS-IO-REDESIGN.md)** —
this file keeps the broader session history (Mill/drill wizards, ATC generator fixes, the still-open rotary
probe bug, the sim-parser fix). The settings-tab notes below are historical; the spec is the source of truth.

## Done this session (in `web/ui/settingsPanel.js`)

- **Stock/template cleanup** finished (template UI lives in `stockEditor.js`; dead blank block removed).
- **Settings main-tab active styling** — `.settings-main-tab` had no CSS at all; added flat/underline
  active treatment matching the STUDIO/GATEWAY header tabs.
- **New tabs** (all model + UI + persistence; verified in-browser):
  - General: **Appearance** (theme picker + keyboard-drawer height), **Program** (end-of-program
    routine), **About** (live version + credits).
  - Hardware: **Spindle / VFD** subsystem (added via `+Add`, gated by `hardwareTabs.spindle`).
- **Header comment** restored (stray typing had overwritten it).

## Decisions

- **Units (mm/inch): dropped.** DDCS Expert variable table has no inch/G20/metric param → controller is
  metric-only. Only the simulator parses G20 from loaded files.
- **Network: kept** as a stub (not migrated to the Gateway header tab).
- **Settings is a sibling header tab** to STUDIO / GATEWAY (`data-app="settings"`, `window.showApp('settings')`).
- **End-of-program design** (machining): default footer = M5 (spindle off) · M9 (coolant off) · retract Z
  to safe height via **G53** · optional park XY via **G53** · M30. G53 because the DDCS has **G28 not
  configured** and G53 machine-coord moves are verified. Global default now; **per-wizard overrides planned**.

## Follow-up wiring (NOT done — settings store the values, nothing consumes them yet)

- [ ] Generators emit the **Spindle** S-word / M3·M4 + spin-up/down dwell from `settings.spindle`.
- [ ] Generators append the **end-of-program footer** from `settings.endProgram`.
- [ ] Per-wizard end-of-program overrides (layer over the global default).
- [ ] Appearance keyboard-height slider initializes to clamped min (200) while the drawer is collapsed —
      could read the real default open height instead. Minor.
- [ ] Stage 3 of SETTINGS-IO-REDESIGN: wizards read `inputs[]`/`outputs[]` directly (drop flat mirror).

## Subsystem-tab re-org (2026-06)

Replaced the gated-tab + sidebar "+ Add ▾" model with **always-present subsystem tabs that carry their own
in-tab "Add" button** (verified in-browser):
- Hardware sidebar is now fixed: **Machine · Spindle · Input · Output · Tool table**.
- **Spindle** tab: shows "➕ Add spindle" until added, then the RPM/dir/dwell config (`set_spin_add` /
  `set_spin_config`, toggled by `applyHardwareTabs`).
- **Tool table** tab (was "ATC"): the tool-length table + tool-length-probe defaults show **always**; an
  "➕ Add tool changer (ATC)" button reveals the magazine + T.nc generator (`set_atc_add` /
  `set_atc_magazine_wrap`). Adding ATC still pushes the drawbar (and disk carousel/index) I/O to Output/Input.
- `applyHardwareTabs()` now toggles in-tab sections instead of hiding tabs; the `set_add_hw` dropdown is gone.
- This supersedes the L2 "+Add adds a category tab" model in [`SETTINGS-IO-REDESIGN.md`](SETTINGS-IO-REDESIGN.md).

**Spindle → Head (DONE 2026-06):** the "Spindle" tab is now **"Head"** with a **Type** selector
(`set_head_type`): Router/Spindle (working), Plasma, Laser. Type-specific config shows per type
(`set_head_spindle` / `set_head_plasma` / `set_head_laser`); plasma & laser are "coming soon" stubs (no
generation yet). Layered with minimal churn: kept `settings.spindle` (the spindle-type config) + the
`hardwareTabs.spindle` "head-added" flag + the `set_spin_*` ids; added only `settings.head = { type }`.
Verified in-browser (type toggles + persists).

**Subsystem stubs — decided NOT to add:** **Coolant is just an Output** (M7/M8/M9 rows), so no tab — confirmed
with the user. Single on/off devices (mist, air blast, dust, vacuum, lone sensors) stay as Output rows per the
redesign doc's rule. Lubrication/auto-oiler could be a future subsystem but isn't worth a stub now.

## Wizard profile chip + app-loader removal (2026-06)

- **Active-profile chip** added to the shared wizard header (`#wizProfile` in index.html `.wiz-head-actions`;
  populated/wired in `wizardManager.syncProfileChip()` + `open()`). Shows the active controller profile and
  switches the **global** one (`setActiveProfile` + dispatch `ddcs:settings-changed` → open wizard re-renders).
  Not a per-wizard override (mixing dialects mid-session is the footgun). Verified: lists Expert/Generic,
  switching works. Rationale: G12/G13, M-codes and pins are all profile-specific, so generating blind is risky.
- **Removed the external `fred-host.js` app loader** (`apploader.pages.dev`) from index.html — the app boots
  fine from the local `import('./app.js')`.
- **Gotcha for in-browser tests:** `window.openWiz` is first set by a parse-time *fallback* IIFE
  (index.html ~1888, `showWizardPanel`, bypasses the manager), then overridden by the real
  `app.wizardManager.open` in `setupGlobalFunctions`. Tests must wait for the REAL glue
  (`typeof window.ddcsGetSettings === 'function' && String(window.openWiz).includes('wizardManager')`),
  not just `openWiz` existing, or they hit the fallback and the manager path (syncProfileChip / applyProbeDefaults) never runs.

## Cutting generators — new "Mill" wizard group (2026-06, in progress)

Direction: simple, hand-written-replaceable ops only (conversational, NOT CAM). Targets ranked by what
machinists actually hand-write: **hole patterns/drilling** (most), **facing** (prep), **bore/circle**, then
slot. Explicitly OUT: adaptive, finish-strategy contours, 3D, thread-with-comp (the param-explosion zone).

- **Arc support confirmed from the dumps:** Expert (`CNCDISK/roughing morph.nc`) and V4.1 (factory macros
  `G02/G03 X0 I-#6` + a "G2/G3 programming error" alarm) both run **planar G2/G3 with I/J**. No **helical**
  (arc-with-Z) found in either → bores use **ring-stepped planar G3** (plunge pitch, full circle, repeat),
  not helical-Z and not a verbose linearised G1 helix.
- **`wizards/cuttingBlocks.js`** — shared `headerBlock` (G90 + spindle-on from Head) + `footerBlock`
  (the end-of-program routine). First real consumer of the Head + end-of-program settings.
- **`wizards/drillWizard.js`** (DONE, generator only — UI pending): patterns **grid / circle / rectangle /
  line**; methods **peck-drill** (plunge, hole Ø = tool) and **bore** (ring-stepped G3, hole Ø ≥ tool);
  per-hole **suppression** (`skip` = 1-based hole numbers); auto header/footer. Flat G0/G1/G3 in the active
  WCS — no #vars/IF/GOTO, fully reviewable. Smoke-tested (bolt circle w/ skip, bore Ø12 with 6 mm tool).
- **Drill UI DONE (verified):** `wizards/views/drillView.js` + `wiz_drill` panel + registered in `views/index.js`
  + **Mill ▾** dropdown in commandDeck (beside Probe/ATC). Pattern/method fields toggle; **Hole Ø** is the primary
  diameter (peck: hole = drill; bore: also a **Tool Ø** end-mill field, hole ≥ tool). Header pulls `M3 S<rpm>`
  from Head settings, footer = end-of-program. First op consuming Head + end-of-program live.

**Architecture that's emerging — Pattern × Operation:**
- The per-hole *move* is a pluggable function (`peckDrill` / `helicalBore`) and the *pattern* (`patternPoints`)
  is a separate reusable unit. So new ops slot in cleanly:
  - **Counterbore** = the bore method at a larger Ø + shallow depth (≈ reuse `helicalBore`). 
  - **Countersink** = plunge a chamfer/csink tool to a depth computed from csink Ø + included angle (≈ `peckDrill`
    with a single computed-depth plunge). Both are just additional per-hole methods (or sibling ops) on the same pattern.
- **Save-pattern + WCS (user idea):** persist named patterns (type + params, anchored to a WCS) like stock templates,
  so you can **drill a pattern, then counterbore/tap the SAME holes** without re-entering it. Store in settings
  (e.g. `settings.holePatterns[]`); the drill/counterbore/csink ops load by name. Deferred — but the pattern engine
  is already the clean seam for it.
- **Next op:** facing (op #2), or counterbore/countersink methods, or save-pattern — user's call.

**SVG/DXF sketch editor (user idea) — assessment:** not needed for these parametric ops (defined by numbers +
3D preview). A sketch editor / DXF import only matters for *arbitrary* profiles = the CAM territory we chose to
avoid (offset side, lead-in, tabs, strategy). Recommend: stay parametric; if arbitrary shapes ever needed,
**DXF/SVG import** (draw in a real tool, Studio offsets + depth-steps) is the pragmatic path — a separate,
bigger project — but a **built-in editor is a different product**, not "make hand-coding easier."

## Root .md triage — DONE (2026-06-17)

Executed: removed `ATC implementation_plan.md` + `injection-tooltips-guide.md` (verified implemented/spent);
relocated `DDCS-ATC-WORKFLOW.md` → `bridge/controllers/expert-m350/` and `PORTING-GRBL-MACH3.md` →
`bridge/controllers/`; consolidated settings into `SETTINGS-IO-REDESIGN.md` (this file kept as session log);
un-deferred the machine-frame in `SIMULATION-NOTES.md`. See git history for the full pass.

## ATC wizard correctness — review findings (2026-06)

Reviewed `data/atcGenerator.js`, `wizards/atcChangeWizard.js`, `wizards/atcTestWizard.js`,
`wizards/atcLengthWizard.js`, and the probe wizards against the firmware-derived reference
[`DDCS-ATC-WORKFLOW.md`](../../bridge/controllers/expert-m350/DDCS-ATC-WORKFLOW.md). **Fixed 2026-06 (see "Applied" below)** — but the M-code
map still needs confirming against `bridge/controllers/expert-m350/FINDINGS.md` / a live ATC before trusting.

**1. Two divergent auto tool-change generators (the biggest issue).**
- `data/atcGenerator.js` (the Settings → ATC → "Generate T.nc" button) is the **weaker** path: it uses a
  blind `G04 P500` dwell instead of drawbar **sensor waits**, emits **no spindle stop (M5)** before the
  drawbar release, lets "tool not in magazine" **silently return** (no alarm/halt), never applies the
  **#1430 tool-length offset**, and pulls pocket XYZ from the Settings magazine table.
- `wizards/atcChangeWizard.js` `generateAuto()` is the **better** path: M5/M9 + `M300` wait, sensor waits
  around the drawbar, range-validates the target, uses the controller pocket tables `#1330/#1350/#1370`.
- → They produce **different** T.nc. The Settings button ships the inferior one. **Pick one** (the wizard
  logic) and have both call it.

**2. `atcChangeWizard.js` M-codes disagree with the firmware reference (likely bugs):**
- Uses **`M303`** for "wait drawbar released / tool open" (lines 125, 138). Per the reference, `M303` =
  **Magazine open**; drawbar-released is **`M301`**. (It correctly pairs clamp with `M302`.)
- Uses **`M305/M306`** for "dust cover open/close" (lines 111, 143). Per the reference, dust cover =
  **`M162/M163`**; `M305/M306` are the **Gripper** open/closed *sensor* waits.
- Its own header comment (lines 13–14) mislabels these the same way.

**3. Both change paths + the length wizard:** the `#1922`/`#1927` probe-result vars, the `#1505 = 1 / -5000`
prompt convention, and the M-code/param map all need **live-ATC confirmation** (the file headers already say
so). `atcLengthWizard.js` otherwise looks structurally sound (tool-table write `#[1430+T-1]` matches the
reference) — its main gap is no explicit **M5** assert before probing a tool on the setter.

**4. Probe move drives through the stock — `wizards/circularWizard.js` BOSS path.**
After probing the two X faces, it re-centred with `G53 X#53` (move to the boss X centre) **at probe depth**.
For an outside boss the centre is solid, so the stylus traversed **straight through the boss**. (The BORE
path reuses the same re-centre but there the centre is the empty hole — safe.)

## Applied fixes (2026-06)

- `atcChangeWizard.js`: `M303`→`M301` (drawbar-released waits), `M305/M306`→`M162/M163` (dust cover),
  header/comment labels corrected.
- `atcTestWizard.js`: `M303`→`M301` (drawbar-released), header/comment corrected.
- `atcLengthWizard.js`: added `M5 M9` (spindle + coolant off) before probing a tool on the setter.
- `data/atcGenerator.js`: added `M5 M9` + `M300` (spindle-stopped wait) before the drawbar dance; added
  `M301`/`M302` drawbar sensor waits (commented "delete if no sensor"); header note. **Fetch sequence
  reconciled to the wizard**: now opens the collet (`M154` + `M301` wait) BEFORE descending over the new
  tool's shank, then clamps — previously it descended a possibly-closed collet onto the tool (only worked
  by luck after a return; broken when starting with an empty spindle).
- `circularWizard.js`: boss X re-centre now runs at **safe Z** (folded into `reposition()`), never at depth.
- All re-verified with a generator smoke test (15/15 checks: fixes present, old M303/M305/M306 + at-depth move gone).

**Probe-wizard sweep (all 5 examined):** `middleWizard` and `cornerWizard` are safe (retract to safe Z above
the top before traversing, or require a manual reposition). `edgeWizard` is safe (single touch). `circularWizard`
**boss** had the through-stock bug (fixed above); **bore** is safe. `rotaryCenterWizard` **fit** is safe
(retracts between points); **known** method is *flagged* — its +Y/-Y flank probes run near the cylinder top
with no Z-clear between them, so the +Y→-Y traverse may graze the apex. Not auto-fixed (marginal grazing vs.
the circular-boss full-depth crash) — verify in the sim.

**M-codes firmware-validated (2026-06):** cross-checked every fix against the controller's own M-code library
`slib-m.nc` (the `O10NNN`→`MNNN` subprograms) in both firmware backups. Confirmed: `M301`=drawbar released
(port #1123), `M302`=drawbar clamped (#1126), `M303`=**magazine open** (#1129) [so the old code's "M303
tool-open" was the bug], `M162/M163`=dust cover (#1268), `M305/M306`=**gripper** sensors (#1132), `M300`=
spindle stopped (#1120), `M154/M155`=drawbar (#1250). All applied fixes match the firmware. Also fixed a doc
error in `DDCS-ATC-WORKFLOW.md` (M300 was mislabelled "E-stop"; it's the spindle-stopped wait).

**Spindle / Program now wired (2026-06):** both tabs got an "⬇ Insert …" button (mirroring the ATC "Insert
tool table"). `set_spin_insert` emits `M3/M4 S<rpm>` + spin-up `G04` dwell; `set_end_insert` emits the
configured footer (`M5`/`M9`/`G53 G0 Z#101` retract — variable, per the G53 rule — / `G53` park / `M30`).
Verified in-browser (7/7 checks). Per-wizard end-of-program overrides still planned.

**Rotary "known" method — SIM-CONFIRMED bug, NOT fixed (needs design/machine):** after the top (Z−) probe the
stylus sits ~one ball-radius above the apex, then the macro probes the +Y/−Y flanks at that height **without
descending or repositioning** (`HAS_REPOSITION_BETWEEN_PROBES = false`). Ran the generated macro against a
cylinder stock in the 3D engine: toolpath stats **Z[0 17], Y[36 96]** — the flank probes travel in Y past the
cylinder's 76 mm edge while Z never drops below the stock top (0), so they skim above the surface and miss.
Confirmed three ways: macro structure, the engine box-collision model (top at Z=0, horizontal probe at Z>0
can't enter), and the geometry. **Fix is not a one-liner:** the whole flank-probe approach needs redesign —
descend to centreline height (Zc = top − R, R known) and approach each flank from *outside* in Y (probe
direction is likely wrong too: it uses `Y+` from centre, but a solid cylinder must be approached inward from
beyond ±R). The `fit` method's flank geometry looks suspect for the same reason. Needs the intended operator
workflow defined and bench validation before rewriting 4th-axis probe motion.

**Sim-parser FIXED (2026-06):** the "Unrecognizable G-code" warnings were **nested-paren comments**, e.g.
`( Probe top (Z down) )` and `( Write work origin (Z0 at centreline) )`. The comment-strip regex
`/\([^)]*\)/g` stopped at the first `)`, leaving a stray `)` that tokenized to nothing → flagged. Made the
canonical `stripLine()` in `engine/core/program.js` nesting-aware (iteratively remove innermost `(...)`),
and routed the two duplicate strippers — the validator in `GcodeExecutionEngine.js` and the static
`gcodeParser.js` — through it (the executor already uses `stripLine` via `loadProgram`). Verified: validator
now reports 0 errors on the rotary/circular macros, and the live sim run status is clean
(`G31 probe 30.0 mm at F200`, no warnings). (`ui/suggestBar.js` has the same naive regex but it only affects
autocomplete on comment lines — harmless, left as-is.)

**Still open:** sim-verify + fix the rotary "known" flank geometry; optional shared-core extraction for the
two tool-change generators (now only a maintainability item — they already emit the same correct sequence).
(The two tool-change generators now emit the same correct sequence — spindle stop, open-before-descend,
sensor waits — so they only differ in coordinate source (Settings magazine vs controller `#1330+` tables);
an optional shared-core extraction remains but is no longer a correctness issue.)
