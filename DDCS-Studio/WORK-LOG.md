
## 🔨 turn 199 (cycle 13) — ATC-SETUP-GUI SCOUT (design-heavy, SCOUT ONLY, no code). On top of V10.58 (ATC sim campaign complete). Deliverable = the scoped design + mock + forks for advisor + human BEFORE building.

### GROUNDING — where the ATC coords LIVE today (the asymmetry that drives the coord fork)
- **Firmware station (#1306, #1320-1326)** = CONTROLLER VARIABLES (in the var dictionary: #1306 "highest Z when changing", #1320/1321 push-start XY, #1323/1324 push-end, #1325/1326 retreat). The firmwareStack emits `G53 X#1320` — it REFERENCES the vars (byte-identical to the controller's O10102), so the CONTROLLER owns the values. NO Studio store; the sim reads them from the traced code -> UNTAUGHT = 0 (why the station sits at the origin without a pull). This is the "stuck-at-0" problem.
- **Generic per-tool pockets** = STUDIO-OWNED: settings.atc.magazine[] {pocket, tool, x, y, z}. autoStack emits them as LITERALS (`A('#110', String(p.x))`) -> the machine uses the literals; no controller var needed. Edited today in the magazine TABLE (renderMagazineTable).
- **Disk pickup + ring** = STUDIO-OWNED: settings.atc.pickup {x,y,z} + diskDia + diskAxis. diskAutoStack emits #103-105 as literals.
- **ATC I/O pins** = settings.outputs/inputs (group='atc') {label, onCode/waitCode, pin} — assigned by TYPING a pin number in the Settings IO table; the io-labeling (P-C.2c/d) lights the ASSIGNED pin.
- **Drag infra that EXISTS to reuse:** the 2D layout canvas (viz/featureCanvas.js — parameter-driven SVG with drag handles for holes/lines/regions, machine-frame-capable) + the 3D sim drag (gcodeViz3d start/spot markers). So a draggable machine-frame canvas is a REUSE, not from-scratch.

### THE DESIGN (mock — the human's call)
```
┌ ATC Setup ─ [Firmware ▾] ────────────────────────────────────┐
│  2D top-down MACHINE FRAME (drag the points)   Safe-Z:[-10]mm │
│   ┌────────────────────────────┐   Push-start: [200][150]     │
│   │           +Y               │   Push-end:   [250][150]     │
│   │    ◆push-start             │   Retreat:    [300][150]     │
│   │    ◆push-end  (the swap)   │                              │
│   │    ◆retreat                │   Source: (o) Pull from ctrl │
│   │ home●──────────── +X       │           ( ) Author + Push⚠ │
│   └────────────────────────────┘   [Pull]     [Push to ctrl⚠] │
│  ── ATC I/O pins (assign, no typing) ───────────────────────  │
│   Pusher   OUT[5▾]  Locating OUT[6▾]  Dust OUT[7▾]  Drawbar OUT[4▾] │
│   Spindle-stopped IN[3▾]  Drawbar-released IN[4▾]  clamped IN[5▾]  │
└───────────────────────────────────────────────────────────────┘
   (Generic ▾ -> per-tool pocket handles + Z; Disk ▾ -> pickup handle + ring-Ø handle + axis)
```

### (1) THE CANVAS + DRAGGABLE ELEMENTS
A **2D top-down MACHINE-FRAME canvas** (the envelope XY + draggable handles) is the precise drag surface (reuse featureCanvas); the existing **3D sim REFLECTS** (the station/magazine/devices already render there post-campaign). Draggable per method:
- **Firmware:** 3 XY handles — push-start (#1320/1321), push-end (#1323/1324), retreat (#1325/1326); Safe-Z (#1306) a field/slider (Z isn't a top-down drag).
- **Generic:** one XY handle per magazine pocket; per-pocket Z a field.
- **Disk:** the pickup XY handle + a ring-radius handle (diskDia) + the diskAxis selector; the ring pockets auto-lay (magazinePockets, P-C.3c).

### (2) DRAG -> COORD — TWO REGIMES (the fork is ONLY the firmware station)
- **Studio-owned (generic pockets + disk pickup): NO fork, NO push.** Drag -> write settings.atc.magazine[i].x/y (or .pickup) -> the emit uses the LITERALS + the sim reflects. Clean + SAFE (no machine write). The magazine table is the existing editor; the canvas is a friendlier visual peer that writes the SAME config (one source).
- **Controller-owned (firmware #1320-1326): the COORD-MODEL FORK** (the macro references the vars; the controller must have them). Two models:
  - **(A) PULL-and-visualize** (machine owns): pull #1306/#1320-1326 from the controller (reuse the WCS/tool-table pull pipeline — they live at param #806/#820-826 = macro−500) into a Studio store -> the sim SHOWS the real taught station + the GUI confirms it. Dragging = editing a COPY that diverges from the controller (so a drag still needs a PUSH to apply). SAFE if read-only-visualize; a drag-to-apply needs (B).
  - **(B) AUTHOR-in-Studio + PUSH** (Studio owns -> teach the machine): drag -> a Studio store (settings.atc.firmwareStation) -> the sim SEEDS its var store from it (so the station shows immediately, no pull) -> a PUSH writes #1320-1326 to the controller so the firmware macro runs right. The human t170 ('push those things via a macro') LEANS here. **CAUTION: the push is a LIVE-MACHINE WRITE** — gate it deliberately (an explicit confirm + only when the operator is AT the machine; live-cnc-readonly memory). The SIM half (author -> seed -> show) is SAFE + buildable now; the PUSH half is the gated, careful piece.
  - RECOMMEND: build (B)'s SIM HALF first (author the station in Studio -> the sim seeds + shows it -> unblocks the "stuck-at-0" + drag-to-visualize, ZERO machine write), and treat the controller PUSH as a separate gated increment (or offer PULL to confirm against the machine). This gives the visual setup + the correct sim NOW, defers the live write.

### (3) PIN ASSIGNMENT (visual, no typing)
A compact **"ATC I/O" pin-picker** (each ATC function — pusher / collet-drawbar / locating / dust / vacuum / the sensors — with a PIN dropdown of the free pins) writes settings.outputs/inputs[i].pin (group='atc'), the SAME config the Settings IO table edits. ONE SOURCE -> the io-labeling (P-C.2c/d) then LIGHTS the assigned pins during a sim. MVP = the picker panel; a richer option = click a DEVICE in the canvas/3D -> assign its pin (drag-to-pin) — flag as a later polish.

### (4) ONE-SOURCE / DECLARE
The GUI writes only DECLARED stores — settings.atc.magazine (generic), .pickup/.diskDia/.diskAxis (disk), a NEW .firmwareStation (the station coords, for the sim seed + the push), settings.outputs/inputs (pins). The SIM + IO-TAB + EMIT all REFLECT those (read them) — no duplication, no inference. The firmwareStation store is the bridge: the sim seeds its var store from it (so #1320-1326 resolve to the authored values, not 0), and the push reads it.

### (5) EFFORT + FORKS
- 2D machine-frame canvas + drag handles: MEDIUM (reuse featureCanvas). Generic/disk drag->settings: SMALL. The firmwareStation store + the sim var-seed: MEDIUM (unblocks stuck-at-0). Firmware PULL: MEDIUM (reuse the WCS pull). Firmware PUSH: MEDIUM-LARGE + the LIVE-WRITE GATE. Pin-picker panel: MEDIUM.
- **FORK 1 (canvas):** 2D top-down machine-frame (precise, reuse featureCanvas) [REC] vs 3D-sim drag handles (in place, harder/less precise).
- **FORK 2 (firmware coord model — the big one):** (A) PULL-visualize (machine owns; safe; drag needs push to apply) vs (B) AUTHOR + PUSH (Studio owns -> teach the machine; the human's lean; the PUSH is a gated LIVE WRITE). REC: build (B)'s SIM HALF now (author->seed->show, zero machine write), defer/gate the controller PUSH (or add PULL to confirm). Generic/disk have NO fork (Studio-owned, drag->settings, safe).
- **FORK 3 (pin UI):** a pin-picker panel [REC MVP] vs click-device-to-assign (richer polish).
- **FORK 4 (sequencing):** REC — (a) the firmwareStation store + the sim var-seed (kills stuck-at-0) + the generic/disk drag (Studio-owned, safe) FIRST [all SIM-side, no machine write, high value], then (b) the pin-picker, then (c) the gated controller PUSH/PULL.

**GATED per worker step-5 (a substantial new GUI campaign; the advisor wants the plan + human eyes, esp. FORK 2 pull-vs-push [a live-machine write] + FORK 1 canvas). NO code. PASSED BACK the scope + mock + forks + a safe-first sequencing. Ready to build the chosen path on confirm. SIM-FRAME axis; authoring axis stays done + disjoint.**

## 🔨 turn 201 (cycle 13) — GUI-1: the ATC-setup DRAG CANVAS (the safe, sim-side, ZERO-controller-write first step of the ATC-setup GUI). Full suite 562 pass / 2 skip / 0 fail (grew 558→564 with 3 new tests). SIM/UI only → emit BYTE-IDENTICAL. 7 files (1 new module + 1 new spec).

**WHAT** — a 2D TOP-DOWN of the machine frame in the ATC Settings tab (a visual PEER to the numeric magazine table — one source settings.atc, two views), where the operator DRAGS the taught points instead of typing machine coords: (1) generic pockets → settings.atc.magazine, (2) disk pickup → settings.atc.pickup, (3) firmware push-station points → a NEW settings.atc.firmwareStation store. Kills the P-C.1a "station stuck untaught-at-0".

**THE COORD ASYMMETRY (scout t199, now built):** generic/disk are STUDIO-OWNED (emitted as literals) → drag writes the EXISTING config, the emit reflects it as always (NO new emit path). Firmware #1306/#1320-1326 are CONTROLLER vars (the O10102 macro REFERENCES them) → the drag writes a Studio-side store that VAR-SEEDS the SIM only; the firmware emit still references the controller vars → **firmware emit byte-identical**. ZERO controller write anywhere (the gated push is GUI-3, deferred).

**PIECES (7 files):**
1. `atcChangeWizard.js` — DECLARE `firmwareStationSeed(fw)`: the INVERSE of ATC_CHOREOGRAPHY.firmware.region — maps the store {safeZ,pushStart,pushEnd,retreat} → [[1306,v],[1320,v]…] pairs. Co-located with the firmware choreography (one-source for the station var semantics). SIM-only, never emitted.
2. `viz/atcSetupCanvas.js` (NEW) — `renderAtcSetupCanvas(container,{atc,machine,onChange})`: REUSES the wizard's FeatureCanvas (grid/pan/zoom/drag hit-test) with the "stock" rect = the machine envelope + handles = ATC points in RAW machine coords (placement {0,0}). Straight → per-pocket handles; disk → pickup + a ring-Ø guide; firmware → 3 orange handles (start→end→retreat) + a dashed push-stroke guide, shown from the store or on-canvas defaults (untaught). onDrag writes the matching config/store field (rounded 0.1) + redraws live; onDragEnd persists (onChange). `defaultFirmwareStation(machine)` exported. NO import of atcViews (inlined the ring math) → light + cycle-free (only imports FeatureCanvas).
3. `atcViews.js` (atc_change update) — VAR-SEED the firmware station from settings.atc.firmwareStation: one store → one `firmwareStationSeed` → TWO consumers — the station-highlight trace (createVarStore on traceToolpath) AND the PLAYED preview engine (previewVarSeed) so the animated push travel ALSO reaches the taught station, not 0.
4. `wizardManager.js` — new `previewVarSeed(containerId, seed)` hook (sets host.__varSeed) + a `createVarStore: () => host.__varSeed ? new Map(...) : new Map()` getter in preview3D. Read fresh each resetState(play) → a later seed takes effect without rebuilding the panel. SIM-only.
5. `settingsPanel.js` — mount the canvas + a "Firmware safe-Z (#1306)" field ABOVE #atc_magazine in set_tab_atc; `renderAtcSetup()` renders BOTH views from settings.atc; `atcOnChangeFull` = atcOnChange (I/O + save) + re-render both; safe-Z change materializes the store (from the on-canvas defaults) so store + canvas + seed agree.
6. `featureCanvas.js` — the DEFAULT point handle now honors `h.color` (inline fill/stroke) so the ATC canvas's BLUE pockets vs ORANGE station read apart. Additive: uncoloured handles (every existing wizard) unaffected — full suite confirms.
7. `tests/atc-setup-canvas.spec.js` (NEW, 3 tests, real pointer-drags + value-asserts).

**VERIFIED REAL SYMPTOM (driven gestures + value-asserts + screenshot):**
- (1) DRAG a generic pocket handle → `settings.atc.magazine[0]` lands at the EXACT cursor world point (150,130 — an independent target computed via the live FeatureCanvas transform), the other pocket UNTOUCHED (surgical), and NO controller write (spied fetch → 0 POST/PUT). 
- (2) DRAG the firmware PUSH-START handle (store starts null) → `settings.atc.firmwareStation` materializes; pushStart = the dragged world (300,250); pushEnd/retreat materialized from defaults (store+seed coherent).
- (3) Open the atc_change FIRMWARE method with a taught store {pushStart 321/222, safeZ −15} → the 3D station region (`viz._station`) resolves start.x=321, start.y=222, end.x=340, z=−15 — seeded from the store, **NOT the untaught 0** (the stuck-at-0 fix, end-to-end through the real wizard).
- Screenshot scratchpad/atc-setup-canvas.png (envelope + 3 blue pockets P1·T2/P2·T5/P3·T7 + orange PUSH START→PUSH END→RETREAT with the dashed guide) opened in a VS Code tab.

**BLAST:** additive (a new canvas + store + one shared-handle colour path). Full suite 562/0 — ATC (22 specs), 2d-layout / pathdatum / drill (the FeatureCanvas consumers), goldens + atc-roundtrip (BYTE-PARITY, no emit touched) all green. No flake this run.

**FLAG (per the dispatch — "if the var-seed is trickier"):** it was NOT tricky — traceToolpath already exposes createVarStore + the panel reads it per-play, so the store seeds both the highlight trace AND the played travel cleanly. NOTE the firmware handles show ALWAYS (orthogonal to magType) at defaults when untaught — the first drag (or setting safe-Z) teaches the store; that's intended (nothing persists until the user acts, per dont-declare-away-user-responsibility). NEXT per the plan: GUI-2 (the visual pin-picker) → GUI-3 (the gated controller pull/push, FORK 2 to the human).

**PASSED BACK for advisor review. SIM-FRAME axis; authoring axis stays done + disjoint. Zero controller write — the gated push is GUI-3.**

## 🔨 turn 203 (cycle 13) — FRAME-FIX: make the ATC-setup canvas MACHINE-FRAME-COHERENT (human t202 flagged the envelope/axes/origin didn't sit coherently on the grid). SIM/UI only, emit untouched. 3 files (featureCanvas machine-frame mode + atcSetupCanvas + spec).

**DIAGNOSIS (confirmed):** GUI-1 reused FeatureCanvas (a PART/stock layout canvas) with the machine envelope shoved in as the `stock` rect → the only origin marker was the part-zero crosshair (a 9px tick), NO home, NO axes, NO edge labels → it did NOT read as a machine frame (the human saw axis labels + origin in mismatched places).

**FIX — a MACHINE-FRAME MODE on FeatureCanvas (spec.machine = {x,y,z}), mirroring the 3D sim ONE-SOURCE (no second convention invented):** grounded the 3D machine frame in gcodeViz3d + sceneFrame (P-A) — home at scene/coord 0, envelope [0..m.x]×[0..m.y] (centre m.x/2,m.y/2), edge labels `+X`/`-X` (red #ff6b6b) + `+Y`/`-Y` (green #5fd35f) at the edge CENTRES. `_drawMachineFrame(m)` draws the SAME: the envelope rect, a HOME 0,0 marker at coord 0 with a red +X arm + green +Y arm, and the +X/-X/+Y/-Y edge labels (identical text + red/green). `_draw` gates: spec.machine → machine chrome; else the part-zero crosshair (unchanged). `_fit` accounts the envelope corners. atcSetupCanvas now passes `machine:{x,y,z}` instead of `stock` (the ATC points already ride raw machine coords — placement {0,0} — so they sit correctly relative to home). PART/stock wizards never set spec.machine → their frame is byte-identical.

**VERIFIED REAL SYMPTOM (screenshot + value-asserts):**
- SCREENSHOT scratchpad/atc-setup-frame.png (opened in a VS Code tab): HOME 0,0 at the bottom-left corner with +X (red, →) / +Y (green, ↑) arms; +Y top-centre / -Y bottom-centre / +X right-centre / -X left-centre edge labels; the envelope filling the frame; blue pockets + orange station inside — now reads as ONE coherent machine frame that MATCHES the 3D sim.
- NEW 4th test (assert the VALUE via the live transform, independent truth): the part-datum crosshair is GONE (.fc-axis-x absent → the frame SWITCHED to machine); the +X/-X/+Y/-Y labels are drawn; a HOME marker exists; fc.spec.machine == the travel extents {600,400}; and the envelope RECT corners map to machine 0..extents — left edge == _S(0,m.y).x, top == _S(0,m.y).y, width == 600·scale, height == 400·scale. So the origin/axes sit AT machine 0 (not a part datum) and the envelope == the travel extents.

**BLAST:** additive machine-frame path in FeatureCanvas (opt-in via spec.machine). Full suite 562 pass / 2 skip; the FeatureCanvas part-frame consumers (pathdatum 12, drill, 2d-layout, corner, stock-attach/corner-pick) all GREEN → part frame unaffected. Goldens + atc-roundtrip GREEN (no emit touched → BYTE-PARITY). 1 FLAKE `project-drawer-smoke` (a KNOWN full-suite header-quick-menu/cloud init-race — its own comments call it out; PASSES isolated in 1.8s; untouched by this work — same class as the middle-animator / blocks-live-form flakes).

**NOT a deeper FeatureCanvas limitation** (per the dispatch's FLAG-if clause): the drawing primitives (grid/pan/zoom/handles/fit) are frame-agnostic; only the origin-marker semantics were part-specific, so a clean opt-in machine-frame mode was the right, minimal fix (no fork needed).

**PASSED BACK for advisor review + human eyes on the frame screenshot. SIM-FRAME axis; authoring stays disjoint. Zero controller write. NEXT per plan: GUI-2 (numeric/parametric — disk Ø+count / linear length+count → computed pockets, firmware numeric fields, canvas = read-back).**

## 🔨 turn 205 (cycle 13) — GUI-2: NUMERIC + PARAMETRIC ATC-setup controls (human t200 REDIRECT: "shouldn't be a drag but a xy coord field — we need PRECISION" + pattern params disk Ø / linear length / count). SIM/UI only, emit reflects config (firmware store SIM-only → firmware emit BYTE-IDENTICAL). Full suite 566 pass / 2 skip / 0 fail (grew 565→568 with 3 new tests; NO flake this run). 3 files.

**REDIRECT HONORED — numeric is now the PRIMARY precise editor; the canvas (FRAME-FIX) is a live READ-BACK + the drag stays as an OPTIONAL COARSE adjunct (not removed).** Grounded first: the magazine table (renderMagazineTable) ALREADY had disk (pickup XY + Ø + count) + a linear pitch-fill + per-pocket XY — so I REUSED those (surgical) and built the real gap: the FIRMWARE STATION had NO numeric fields (GUI-1 made it drag-only — exactly the human's complaint).

**PIECES (3 files):**
1. `ui/settingsPanel.js` — a NEW "FIRMWARE PUSH STATION (O10102 · #1306/#1320-1326)" section in the ATC tab: 7 NUMERIC fields — push-start X/Y, push-end X/Y, retreat X/Y, safe-Z — writing settings.atc.firmwareStation. `renderAtcSetup` fills all 7 from the store; a shared `fwFieldSet` materializes the station (from the on-canvas defaults, so store+canvas+seed stay coherent) then sets the EXACT typed value → the canvas read-back + the var-seed'd sim reflect it. Reframed the MACHINE-FRAME LAYOUT hint (numeric = precise; canvas = read-back + coarse drag). SIM-only (nothing pushed to the controller).
2. `ui/ioTable.js` (magazine table) — the linear pattern fill is now LENGTH-based (the human's word): origin = P1, **Length** over the pocket COUNT → pitch = length ÷ (count − 1), evenly-spaced (was a fixed pitch). Persists atc._lineAxis/_lineLength; added stable data-attrs (data-atc-count / data-atc-len / data-atc-line-axis / data-atc-fill) for precise targeting. Disk Ø + count (Carousel Ø + Pockets) unchanged — magazinePockets already lays the ring from Ø + count + pickup.
3. `tests/atc-setup-numeric.spec.js` (NEW, 3 tests, real UI gestures + value-asserts).

**ONE-SOURCE:** params + pockets + firmware store all in settings.atc; the canvas + the numeric fields/table + the sim all REFLECT it — the per-pocket table stays as the irregular/precision OVERRIDE.

**VERIFIED REAL SYMPTOM (assert the VALUE, driven through the real Settings UI):**
- LINEAR — 4 pockets, origin P1 (10,5,-50), set Length=90 + axis=X + click Fill → pockets at x = [10, 40, 70, 100] (pitch 30 = 90÷3), y/z carried from P1. Even-spacing math asserted against the independent length÷(count−1).
- DISK — pickup (150,100), Ø=120, set the COUNT field = 8 → 8 magazine rows; magazinePockets lays 8 ring positions each at radius 60 (Ø/2) from the carousel centre. count + radius asserted.
- FIRMWARE — type push-start 321/222, push-end 340/222, safe-Z −15 in the FIELDS → settings.atc.firmwareStation holds the EXACT values; then the firmware wizard's 3D station region (viz._station) renders start=(321,222), end.x=340, z=−15 — the typed coords var-seed the sim end-to-end (precision, the redirect's core).
- Screenshot scratchpad/atc-setup-numeric.png (canvas read-back + the 7 firmware fields + the parametric magazine table) opened in a VS Code tab.

**BLAST:** UI-only (Settings ATC tab + the store). Full suite 566 pass — goldens + atc-roundtrip GREEN (no emit path touched → BYTE-PARITY, incl. firmware byte-identical); the atc-setup-canvas (GUI-1/FRAME-FIX) 4 specs still green; project-drawer-smoke PASSED this run (the prior flake didn't recur). No FeatureCanvas change this turn.

**PASSED BACK for advisor review + human eyes on the numeric screenshot. SIM-FRAME axis; authoring disjoint. Zero controller write. NEXT per plan: the TOOL-SETTER MODEL → GUI-3 (the pin-picker) → GUI-4 (the gated controller pull/push, FORK 2 to the human).**

## 🔨 turn 207 (cycle 13) — TOOL-SETTER MODEL (human t202 "we can add a tool setter model"). SIM/VISUAL only, emit BYTE-IDENTICAL. Full suite 569 pass / 2 skip / 0 fail (grew 568→571 with 3 new tests; no flake). 3 files (a wizardManager hook + 2 view calls + new spec) — a WIRE-UP, not a build.

**GROUNDED FIRST (per the dispatch's "ground the setter position, flag if a new field is needed"):** the setter POSITION is ALREADY configured — NO new field. The setter is a `setter`-type INPUT row carrying {x,y,z,w,h} (ioTable default {0,0,0,20,20}); settingsPanel syncs it into `settings.probes` {setterX/Y/Z/W/H} — the CANONICAL config the sim's probe COLLISION already reads (GcodeExecutionEngine ~1036). ONE-SOURCE confirmed. AND the MODEL already exists: `gcodeViz3d.setProbes(probes)` draws a magenta touch-off cylinder at (setterX, setterY, setterZ−H/2) on the FIXED scene frame (raw machine coords). The GAP: `setProbes` was only ever called from the DEAD `_svgPreview.bak.js` — the CURRENT shared preview panel never called it, so the setter never rendered in the Length/Check previews.

**FIX (wire the existing model to the current previews):**
1. `wizardManager.js` — new `previewToolSetter(containerId, setter)` hook (mirrors previewMagazine) → `viz.setProbes(setter || null)`.
2. `wizards/views/atcViews.js` — atcLengthView + atcCheckView now call `previewToolSetter(vizId, p.setterW>0 && p.setterH>0 ? p : null)` with `p = settings.probes` (the one source). Only when a real setter is configured (W/H > 0).
3. `tests/atc-tool-setter.spec.js` (NEW, 3 tests).

**VERIFIED REAL SYMPTOM (assert the VALUE + screenshot):**
- Tool LENGTH preview: the setter mesh renders at the CONFIGURED machine position — centre (300, 200, −57 = setterZ −40 − H/2 17), mesh + edges present. On the FIXED machine frame (raw coords).
- Tool CHECK preview: same, at (120, 80, −60) — the SAME setter config drives both.
- ONE-SOURCE: change settings.probes.setterX 100→250 + wizard update() → the mesh FOLLOWS to X=250 (the render tracks the config, no duplicated position).
- Screenshot scratchpad/tool-setter.png (the magenta touch-off block at its machine position in the Tool Length preview, distinct look) opened in a VS Code tab.

**BLAST:** additive (a new hook, called only by Length/Check) → every other preview UNAFFECTED. Full suite 569 pass; goldens + atc-roundtrip GREEN (no emit path touched → BYTE-PARITY); the ATC + setup-canvas + numeric specs still green. No engine/emit change.

**FLAG (a coherence follow-up, honest):** the Length/Check wizards are OPERATOR-HOVER (the emit has NO XY move — the op confirms "Hover tool over the setter" then Z-probes), so the sim tool sits at the program start (origin), NOT over the setter. I TRIED seeding the preview start to the setter XY (preview3D 3rd arg) but for machine-frame ATC ops the tool marker didn't follow (the start→tool-position path is tangled with _stockOffset / the P-A part-frame) — reverted it rather than rabbit-hole/guess. So the setter renders at its real position (the dispatch's actual VERIFY ✓) but the tool doesn't auto-hover over it; the OPTIONAL touch cue is moot until then (the tool must be over the setter to contact it). Positioning the tool over the setter (a machine-frame start seed) + the contact flash = a coherence follow-up if the human wants it — flagged, not guessed. The MODEL + RENDER + one-source are done.

**PASSED BACK for advisor review + human eyes on the setter screenshot. SIM-FRAME axis; authoring disjoint. Zero controller write. NEXT per plan: GUI-3 (the pin-picker) → GUI-4 (the gated controller pull/push).**

## 🔨 turn 209 (cycle 13) — GUI-3: the ATC PIN-PICKER (assign the ATC I/O pins visually; scout fork-3 = a panel). SIM/UI only, emit BYTE-IDENTICAL. Full suite 573 pass / 2 skip / 0 fail (grew 571→575 with 4 new tests; no flake). 3 files.

**WHAT** — a FOCUSED ATC I/O pin-assignment panel in the ATC Settings tab (near the setup canvas): every ATC function with a numbered-pin dropdown, so the user assigns pins visually WITHOUT hunting through the general Input/Output tables. A PEER editor — it writes the SAME settings.outputs/inputs `.pin` the io config table + the io-labeling read (ONE SOURCE, no duplicated data), so a pin assigned here LIGHTS in the I/O panel during a sim (the P-C.2c/d join).

**PIECES (3 files):**
1. `ui/ioTable.js` — DECLARED `ATC_IO_FUNCTIONS` catalog (7 outputs drawbar/dust/pusher/pin/vacuum/gripper/rotate · 8 inputs spindle-stopped/drawbar-released/clamped/mag-open/closed/gripper-open/closed/pocket-index), each carrying its canonical M-code(s) — the SAME onCode/waitCode the io-tab join (→ ATC_DIALECT → semantic pin) keys on. `renderAtcPinPicker(container,{outputs,inputs,onChange})`: per function a pin `<select>` (1–20 out / 1–24 in); a pin used by any row of that kind is DISABLED ("N (taken)") so a pin maps to ONE function (conflict prevented); the current pin reads the matched row (relabel-proof — matched by M-code, not label). Assign → find-or-CREATE the row (with the canonical codes + group='atc') → set `.pin`; clear (—) frees it (no dup row).
2. `ui/settingsPanel.js` — a new "ATC I/O PINS" section (#atc_pin_picker) in the ATC tab; `renderAtcSetup` renders it with onChange = `syncIO()` (the SAME persist the io tables use) + dispatch `io_change` (relight the I/O panel if open). Import from ioTable.
3. `tests/atc-pin-picker.spec.js` (NEW, 4 tests, real change-events + value-asserts).

**ONE-SOURCE:** the picker + the general I/O table + the io-labeling all read/write settings.outputs/inputs `.pin` (+ onCode/waitCode) — the picker is a visual peer, not a second store.

**VERIFIED REAL SYMPTOM (assert the VALUE via real change events + the LIVE IoTab):**
- Assign OUTPUT drawbar→pin 5 (no row yet) → settings.outputs gets a row {onCode M154, pin 5, group atc}; `window.ioPanel._deriveAtcMap()` → `_atcOutMap[5]` has a semanticPin + label → it LIGHTS (the join, through the real io-tab).
- Assign INPUT spindle-stopped→pin 3 → settings.inputs {waitCode M300, pin 3}; `_atcInMap[3]` derives the input semantic pin.
- CONFLICT: after drawbar=5, another output's pin-5 option is DISABLED (no double-assign); pin 5 is STILL free for an INPUT (separate 1–20 vs 1–24 banks).
- ONE-SOURCE: a pre-set config pin (7) shows in the picker (reads the existing row, no dup); clearing frees it and leaves exactly ONE drawbar row (matched by M-code, not duplicated).
- Screenshot scratchpad/atc-pin-picker.png (the ATC I/O PINS grid — outputs + inputs with pin dropdowns, some assigned) opened in a VS Code tab.

**BLAST:** additive (a new panel + a declared catalog) → the general I/O tables + the labeling UNAFFECTED (same source). Full suite 573 pass; io / io-labeling / ATC / setup specs green; goldens + atc-roundtrip GREEN (no emit path touched → BYTE-PARITY).

**NOTE (honest, minor):** rotate + pocket-index have NO M-code (special disk I/O) so they're assignable but label-only in the io-tab (they don't join ATC_DIALECT) — included per the dispatch's function list, matched by type. The M-code functions (the meaningful lighting set) all join + light.

**PASSED BACK for advisor review + human eyes on the pin-picker screenshot. SIM-FRAME axis; authoring disjoint. Zero controller write. NEXT per plan: GUI-4 (the GATED controller pull/push — FORK 2 [firmware pull-visualize vs author-push], to the human).**

## 🔨 turn 211 (cycle 13) — EASY FIX (UI/CSS): the Blocks sidebar X-HANDLE color + drop-shadow (human t210 screenshot + t211 direct "remove drop shadow"). UI/CSS only, emit BYTE-IDENTICAL. Full suite 573 pass / 0 fail (color change); handle spec + tree clean after the shadow removal. 1 file (styles.css, one rule).

**THE HANDLE** = `#blkToolsHandle` / `.blk-tools-handle` (blocksApp.js) — the vertical close tab that parks at the toolbox's right edge showing `✕` when the Blocks palette/sidebar is open (and "Blocks" when collapsed).

**ROOT CAUSE:** it was `color:var(--screen-ink); background:var(--screen)`. `--screen` = `#000000` — a HARDCODED black ("the screen is black in every theme", styles.css:4566 — the on-screen-keyboard / editor-readout token, NOT the sidebar). So the handle was a BLACK box that didn't match the toolbox in ANY theme.

**FIX:** use the SAME tokens the Blockly theme gives the sidebar (blocks/blockly/theme.js: toolboxBackgroundColour = `--panel2`/`--panel`, toolboxForegroundColour = `--text`): `color:var(--text,#cbd5e1); background:var(--panel2,var(--panel,#161d28))`. Now the handle blends with the toolbox in every theme (theme-aware — --panel2 varies per skin: organic #2f261c, futuristic #0e1626, steampunk #3d2817, …). Then per the human's follow-up, REMOVED the `box-shadow:4px 0 14px #0007` so it sits FLAT with the sidebar (no floating drop shadow). Kept the theme-aware `border:1px solid var(--line)`.

**VERIFIED (screenshots, both themes):** the ✕ handle now matches the toolbox background + is flat (no shadow) in steampunk (dark) + organic — scratchpad/xhandle-dark.png, xhandle-light.png, xhandle-noshadow.png opened in VS Code tabs. blocks-desktop-collapse spec GREEN (the handle still toggles the palette — position/text/width unaffected by the color/shadow). Full suite 573 pass (the color change is a bigger visual delta than the shadow line; the shadow removal is a pure cosmetic subtraction on the same rule). BYTE-PARITY: no JS/emit touched.

**PASSED BACK. NOTE (from the dispatch): the ATC setup GUI is DONE-FOR-NOW (the human moved off the FORK-2 pull/push decision → deferred; revisit only if they want the controller-PULL convenience).**

### 🔨 turn 211 (addendum) — two DIRECT human follow-ups on the Blocks sidebar (same styles.css rule-group, UI/CSS only, emit byte-identical):
1. "put a outline in side bar too" → added `#blocks-app .blk-ws .blocklyToolbox { border-right:1px solid var(--line); box-sizing:border-box; }` — the toolbox/sidebar's canvas-facing edge now carries the SAME theme-aware `--line` outline as the handle (box-sizing keeps Blockly's measured toolbox width stable → collapse test unaffected).
2. "make the x handle hide the outline where it is positioned, maybe with an offset" → the open-state handle transform now `translateX(calc(var(--blk-tbx-w) - 1px))` (was `var(--blk-tbx-w)`): the 1px left overlap puts the handle's (--panel2, same as the sidebar) body over the toolbox's 1px border-right where the handle sits, HIDING it there; the handle's own top/right/bottom border wraps that gap so the outline reads as continuous AROUND the handle.

VERIFIED (screenshots normal/light theme): the sidebar has a top-to-bottom right-edge outline; the ✕ handle sits on it with the outline hidden behind the handle + wrapping around it — scratchpad/sidebar-outline.png + sidebar-handle-zoom.png opened in VS Code tabs. blocks-desktop-collapse spec GREEN (handle still toggles the palette; the 1px offset + the border box-sizing don't shift the collapsed-handle position or the toolbox width the test asserts). BYTE-PARITY: no JS/emit touched.

## 🔨 turn 213 (cycle 13) — RE-PLAN #2 SCOUT: declare GRIP + MOTION as composable ATC config (SCOUT ONLY, no code). Deliverable = the design + migration + RapidChange proof + forks for advisor + human BEFORE building. GATED (reframes the shipped ATC model).

### FRAME — the reframe (grounded: DDCS ships a BLANK ATC = an M6 hook only; O10102 is an INSTALLED pneumatic-push package, #1320-1326-parameterized; "firmware" was a MISLABEL of one installed macro)
Today the change is a FIXED METHOD (firmware / generic / disk / m6 / manual) — resolveMethod → a hand-written stack + a hard-coded ATC_CHOREOGRAPHY[method] {kind}. TARGET: the user DECLARES their ATC from composable pieces, so a new changer = a config, not a new method:

```
   LAYOUT  ×  GRIP  ×  MOTION  ×  I/O   ──►  the CHANGE
  (where)   (hold/    (travel   (M-code
            release)  sequence)  dialect)
  positions  ↘         ↓          ↙
             the CHOREOGRAPHY = MOTION's step-sequence, driving GRIP's release/clamp,
             at LAYOUT's positions, speaking the I/O dialect
                    │
          ┌─────────┴─────────┐
       EMIT (G-code)      SIM (P-C animation)      ← ONE declared sequence, two consumers
```

### (1) HOW TO DECLARE grip + motion — the config schema (additive under settings.atc; LAYOUT + I/O already exist)
- **GRIP** = the hold/release MECHANISM: `settings.atc.grip = { kind, orient?, release:[actions], clamp:[actions], device? }`. An `action` = `{ code, off, wait, dev }` (an I/O M-code + its sensor wait + a device animation). GRIP is itself a mini-sequence so a MULTI-actuator grip (pneumatic) declares cleanly:
  - `drawbar`: orient:false; release:[{code:M154, wait:M301, dev:collet-open}]; clamp:[{code:M155, wait:M302, dev:collet-close}].
  - `pneumatic`: orient:true(M19); release:[M159 vacuum-off, M157 pin-close, M160 pusher-open+dwell]; clamp:[M156 pin-open, M161 pusher-close]; dev:pusher/pin.
  - `magnetic` (RapidChange): orient:false; release:[]; clamp:[] (NO actuator — the MOTION's plunge engages the fork/magnet); dev:fork/dock.
- **MOTION** = the travel SEQUENCE (a DECLARED step-list with grip-hooks + LAYOUT position refs): `settings.atc.motion = { kind, steps:[...] }`. Step primitives (the vocabulary): `safeZ · travelXY(ref) · descend(ref) · retract · grip.release · grip.clamp · rotate(pocket) · dwell(t) · orient`. A `ref` names a LAYOUT position ('cur.pocket' / 'target.pocket' / 'pickup' / 'station.start|end|retreat' / 'dock'):
  - `pick-place`: [safeZ, travelXY(cur.pocket), descend, grip.release, retract, travelXY(target.pocket), grip.release, descend, grip.clamp, retract].
  - `push`: [orient, travelZ(safeZ=#1306), travelXY(station.start), grip.release(pusher-out+dwell), travelXY(station.end), travelXY(station.retreat), grip.clamp(pin/pusher-close)].
  - `rotate`: [safeZ, rotate(cur.pocket), travelXY(pickup), descend, grip.release, retract, rotate(target.pocket), descend, grip.clamp, retract].
  - `plunge` (RapidChange): [safeZ, travelXY(cur.dock), descend(dock), grip.release(∅), retract, travelXY(target.dock), descend, grip.clamp(∅), retract].

### (2) HOW THEY COMPOSE — the interpreter (ONE source → emit + sim)
A small **choreography INTERPRETER** walks MOTION.steps and resolves each: a POSITION step ← LAYOUT (the pocket/dock/station coords, already numeric); a GRIP step (release/clamp) ← GRIP's action-list (the I/O + device); the M-codes ← the I/O dialect. It emits to TWO backends from the SAME walk: the EMIT backend → G-code atoms (the existing block-stack atoms: Move/MCode/Confirm…), the SIM backend → the P-C choreography (travel + device animations). This is the north-star **wizards-as-data** applied to the change motion: the sequence is DATA, the interpreter is the engine, emit + sim are views. Grip/motion are DECLARATIONS (near-free); the interpreter is the one engine (rule-of-three: push/pick-place/rotate/plunge = 4 motions justify it).

### (3) HOW IT GENERALIZES THE SEAM (+ what REUSES, unchanged)
- Today: `ATC_CHOREOGRAPHY[resolveMethod] = {kind:'push'|'pick-place'|'macro-call', variant}`. NEW: the descriptor is COMPUTED from the config — `kind = motion.kind`, `device = grip.device`, positions ← layout. The fixed per-method table becomes `atcChoreography(params) = { kind: motion.kind, device: grip.device, steps: motion.steps }`. The seam stays the SAME shape (createPreviewPanel.setAtcSwap still branches on choreo.kind), so P-C.1b/3 keep working.
- **REUSE — do NOT rebuild:** the CHOREOGRAPHY SEAM (setAtcSwap), the DEVICES (pusher/pin/collet → add fork/dock), the #1300 SWAP (checkToolSwap/doToolSwap — already branch on choreo.kind), the MACHINE FRAME (P-A), the SETUP GUI (canvas + numeric + pin-picker), the I/O DIALECT (ATC_DIALECT), the var-seed. GRIP maps onto the EXISTING devices; MOTION.kind onto the EXISTING seam kinds.

### (4) MIGRATION MAP (existing methods = grip×motion combos; KEEP byte-identical)
| method (old) | LAYOUT | GRIP | MOTION |
|---|---|---|---|
| firmware | station #1320-1326 | pneumatic | push |
| generic | linear pockets | drawbar | pick-place |
| disk | disk ring + pickup | drawbar | rotate |
| m6 | — | (controller) | macro-call |
| manual | park | (hand) | manual |
resolveMethod stays as the BACK-COMPAT map (old ops/files → the preset grip×motion×layout), so saved ops are untouched. **EMIT byte-parity (the crux):** the 3 stacks (firmwareStack/autoStack/diskAutoStack) are hand-written + firmware is byte-identical to O10102 — so for the KNOWN combos the emit DELEGATES to the existing stacks (byte-identical, guaranteed by the goldens/atc-roundtrip). The INTERPRETER's emit is used for NEW combos only (initially); converging the 3 stacks onto the interpreter is a SEPARATE, later, byte-parity-tested step (FORK A). "firmware" gets RELABELED "pneumatic push" in the GUI (a naming cleanup that falls out — the macro isn't firmware).

### (5) SETUP GUI — add the selectors
The ATC settings tab gains a **GRIP** selector + a **MOTION** selector (dropdowns) beside the existing LAYOUT (magType). Picking grip×motion writes settings.atc.grip/motion → the sim choreography + emit follow. The old method presets = named grip×motion combos the two selectors express (a "changer preset" dropdown can still offer firmware/generic/disk/RapidChange as one-click combos that set grip+motion+layout). Reuses the GUI-1/2/3 surfaces.

### (6) RAPIDCHANGE — the PROOF (linear LAYOUT + magnetic GRIP + plunge MOTION)
Config-only? **ALMOST — and the residue is small + declared:** LAYOUT linear EXISTS (the dock XY = pockets). MAGNETIC GRIP = a DECLARATION (release:[]/clamp:[] empty, dev:fork) — no new code, just data. PLUNGE MOTION = a DECLARED step-sequence (travel→descend→retract, grip-hooks empty) — data, IF the step vocabulary (descend/retract/travelXY) already exists in the interpreter. The ONE genuinely-new CODE piece = the FORK/DOCK DEVICE mesh (a viz addition, reusing the pusher/collet device pattern). So the composed model turns "support RapidChange" from *a whole new method + stack + sim path* into *declare a grip + a motion sequence + one device mesh* — the win. (CAVEAT to CONFIRM: RapidChange's real mechanism is a spindle-plunge into a fork that grips the ER nut, sometimes spindle-spin to loosen — so PLUNGE may need a `spin`/`dwell` sub-step; the magnetic framing is the advisor's simplification. Either way it's a declared grip+motion, not new machinery.)

### (7) EFFORT + INCREMENTS + FORKS + BYTE-PARITY
- **Effort:** config schema + grip/motion DEFS = SMALL (declarations). The choreography INTERPRETER (one walk → emit + sim) = MEDIUM-LARGE (the core engine — build once). The seam generalization (choreo from config) = SMALL. GUI selectors = SMALL-MEDIUM. Fork/dock device = SMALL. RapidChange combo = SMALL once the above exist.
- **Increments:** (I1) declare the grip/motion schema + the migration map + resolveMethod→preset (config only, NO emit/sim change yet — byte-identical). (I2) generalize the seam (choreo computed from config; sim unchanged for the 3 presets). (I3) GUI grip+motion selectors + the preset dropdown. (I4) the choreography INTERPRETER for the SIM (drive the existing 3 from the declared sequences — a sim-only proof; verify the sim matches). (I5) the interpreter's EMIT for NEW combos + RapidChange (fork device + plunge) — the payoff. (I6, optional) converge the 3 stacks onto the interpreter's emit (byte-parity-tested) — retires the hand-written stacks.
- **FORKS:** (A) EMIT — presets-delegate-to-existing-stacks [REC: byte-identical, safe] vs interpreter-generates-all [risk: must reproduce O10102 exactly]. (B) MOTION rep — declared STEP-SEQUENCE (data, interpreted) [REC: wizards-as-data] vs a per-motion JS builder (simpler, less declarative). (C) FIRST increment — full composition vs incremental I1→I5 [REC: incremental — I1-I3 are near-free + reversible, the interpreter I4/I5 is where the real design risk is, so prove the sim first]. (D) GRIP granularity — a single release[]/clamp[] action-list [REC] vs a richer per-actuator device graph (defer).
- **BYTE-IDENTICAL vs CHANGES:** byte-identical = the 3 existing combos' EMIT (delegate to the existing stacks; goldens + atc-roundtrip guard it) + m6/manual. CHANGES (all ADDITIVE/back-compat): settings.atc gains grip/motion (resolveMethod back-fills for old ops), the seam is computed not tabled (SIM only), the GUI adds selectors, the label "firmware"→"pneumatic push". NEW (no byte-parity concern): RapidChange + any new grip×motion.

**GATED per worker step-5 (a substantial reframe of the shipped ATC model; the advisor wants the plan + HUMAN eyes — esp. FORK A [emit delegate-vs-interpreter, the byte-parity crux] + FORK C [incremental sim-first]). NO code. PASSED BACK the schema + composition + interpreter + migration + RapidChange proof + increments/forks. Ready to build the chosen path on confirm. SIM-FRAME/authoring axes untouched; this is the ATC-model axis.**

## 🔨 turn 215 (cycle 13) — I1: the composable ATC schema + presets (RE-PLAN #2, increment 1 — the SAFE foundation). INERT DATA only, BYTE-IDENTICAL (no emit/sim/behavior change). Full suite 575 pass / 2 skip / 1 known flake (middle-animator, retry-passed; grew 575→578 with 3 new tests). 2 NEW files (a declarations module + spec), 0 modified.

**ADVISOR RESOLVED THE FORKS:** A = emit-DELEGATE (byte-safe), B = declared STEP-SEQUENCE, C = SIM-FIRST. I1 builds ONLY the declared schema + presets; the interpreter is I2+.

**WHAT (all inert declarations — "declarations are free"):** NEW `wizards/atcModel.js`:
- `GRIPS` (the hold/release MECHANISM, release[]/clamp[] ACTION-LISTS of {code,wait,dev,dwell} + orient/pre/post): `drawbar` (M154 release/M301 · M155 clamp/M302 · collet), `pneumatic` (M19 orient · pre M159/M157 · release M160+dwell#1322 · post M163/M156 · clamp M161 · pusher — the O10102 actuators), `magnetic` (empty hooks — mechanical; CANDIDATE for RapidChange/I5).
- `MOTIONS` (the travel SEQUENCE, a declared step-list with grip-hooks + LAYOUT position refs): `pick-place` (safeZ·travelXY(cur.pocket)·descend·grip.release·retract·travelXY(target.pocket)·…·grip.clamp), `push` (orient·grip.pre·travelZ(station.z)·travelXY(station.start)·grip.release·travelXY(station.end)·grip.post·travelXY(station.retreat)·grip.clamp), `rotate` (rotate(pocket)·travelXY(pickup)·grip.release/clamp), + `plunge` (CANDIDATE RapidChange), `macro-call`, `manual`.
- `PRESETS` (the MIGRATION MAP — shipped methods AS grip×motion): firmware = pneumatic×push, generic = drawbar×pick-place, disk = drawbar×rotate (+ m6 macro-call, manual). "firmware" flagged as the MISLABEL (it's the pneumatic-push O10102 install; GUI relabels at I3).
- `atcCombo(params)` — resolves an op (via resolveMethod, so OLD mode/magType ops back-fill) → {method, gripKind, motionKind, layout, grip, motion}.

**BYTE-IDENTICAL SCOPE (Fork A delegate):** NOTHING in the app imports atcModel yet — the EMIT still goes ENTIRELY through the existing hand-written stacks (atcChangeStack switch → firmwareStack/autoStack/diskAutoStack). So this increment is pure additive substrate; emit/sim UNCHANGED. The seam consumes atcCombo in I2 (sim-first); the interpreter emits new combos in I5.

**ONE-SOURCE:** grip/motion will live under settings.atc (a user override, added by the GUI in I3); until then atcCombo derives the combo from the op's method, so existing ops/files are untouched.

**VERIFIED REAL SYMPTOM (assert the VALUE + byte-parity):** NEW `atc-model.spec.js` (3 tests) — (a) the schema is WELL-FORMED (every grip has release[]+clamp[] action-lists; every motion a steps[]; every preset references a grip/motion that EXISTS in the registry); (b) the 3 methods + BACK-COMPAT old ops (mode/magType, no method) + the empty/legacy case resolve to the CORRECT combo (firmware→pneumatic×push, generic→drawbar×pick-place, disk→drawbar×rotate, {}→manual), and the resolved combo carries the actual grip/motion DEFS (orient=true, push steps>0); (c) BYTE-IDENTICAL — the firmware emit still = the raw O10102 (G53 X#1320 · M159 · M19), generic = the drawbar M154 pick-place, disk = the carousel-rotate template → the emit path is untouched by the model. Full suite 575 pass — goldens + atc-roundtrip GREEN (byte-parity); the whole ATC suite green.

**FLAG (per the dispatch's "flag anything that would change emit"):** NOTHING changes emit this increment — atcModel is not imported by any app code (only the test). The pneumatic grip's pre/post/release/clamp are a CANDIDATE decomposition of O10102 (declared for the interpreter to consume at I5, where the byte-parity of the interpreter-generated emit will be tested against the stacks); the magnetic grip + plunge motion are CANDIDATE (RapidChange, I5). None affect the shipped emit (delegate).

**PASSED BACK for advisor review. NEXT per plan: I2 (generalize the seam — choreo computed from atcCombo, sim-first, still byte-identical emit). SIM-FRAME/authoring untouched; ATC-model axis. Human has design eyes.**

## 🔨 turn 217 (cycle 13) — I2: generalize the ATC_CHOREOGRAPHY seam to SOURCE from atcCombo (RE-PLAN #2 inc 2; sim-first, BYTE + SIM IDENTICAL). Full suite 577 pass / 2 skip / 0 fail (grew 578→579; no flake). 3 files (atcModel + atcChangeWizard + spec). No emit path touched.

**WHAT** — the seam's descriptor is now COMPUTED from the declared model instead of a fixed per-method table. `atcChoreography(params)` = the SEAM PROJECTION of the op's declared MOTION (via atcCombo) + the declared GRIP's device — so the seam reads the DECLARED MODEL (one source), not a hardcoded table.

**THE SEAM-KIND vs MOTION-KIND GAP (resolved via a declared projection):** the seam's coarse vocabulary is push/pick-place/macro-call, but the MOTION kinds are finer (push/pick-place/ROTATE/plunge). So each MOTION now declares a `seam` projection: push→{kind:push, +stationVars +region}, pick-place→{kind:pick-place, variant:magazine}, ROTATE→{kind:pick-place, variant:CAROUSEL}, macro-call→{kind:macro-call}, manual→null. `atcChoreography` returns `{...motion.seam, device: grip.device}`. Identical to the old table for the 3 presets; the region builder + stationVars moved VERBATIM from ATC_CHOREOGRAPHY.firmware into MOTIONS.push.seam.

**STRUCTURE (broke the import cycle):** `resolveMethod` MOVED atcChangeWizard → atcModel (so the model is the one source for method→combo→choreo + atcModel imports NOTHING back). atcChangeWizard now `import { resolveMethod, atcChoreography } from './atcModel.js'` (atcChangeStack's switch uses resolveMethod) + `export { resolveMethod, atcChoreography }` (re-export → atcViews' import untouched). Removed the old resolveMethod + ATC_CHOREOGRAPHY + atcChoreography from atcChangeWizard. firmwareStationSeed stays (comment now points at MOTIONS.push.seam.region). One-directional graph: atcChangeWizard → atcModel; NO cycle.

**BYTE + SIM IDENTICAL (Fork A still delegate):** the EMIT still goes entirely through the existing stacks (atcChangeStack switch — untouched) → byte-identical. Only the CHOREO/SIM SOURCING moved to the model. NEW combos NOT wired (I4 the interpreter). The sim consumers read choreo.kind (setAtcSwap + atcViews) + region + stationVars — all identical; the grip-sourced `device` field is ADDITIVE + unconsumed (verified: setAtcSwap reads only choreo.kind; devices come from io_change).

**VERIFIED REAL SYMPTOM (assert the VALUE + all sim specs):** NEW test (atc-model I2) — the computed descriptor == the OLD fixed-table descriptor for EACH preset: firmware {kind:push, stationVars:[1306,1320-1326], region(vars) OUTPUT identical, label, device:pusher}; generic {kind:pick-place, variant:magazine, device:collet}; disk {kind:pick-place, variant:carousel, device:collet}; m6 {macro-call}; manual null. The re-export path (atcChoreography FROM atcChangeWizard) yields the identical fn. ALL ATC SIM SPECS GREEN (23: station-highlight / station-devices / tool-swap / collet / pocket-swap / disk-swap / dialect) → sim identical. Full suite 577 pass; goldens + atc-roundtrip GREEN → BYTE-PARITY. The wide import-graph change (resolveMethod moved+re-exported) broke nothing.

**FLAG (per the dispatch's "flag if a preset's choreo can't be derived identically"):** NONE — all 3 presets derive IDENTICALLY from the model (the seam projection + the verbatim region/stationVars). The only schema addition was the `seam` field on each MOTION (the declared sim projection) — no gap.

**PASSED BACK for advisor review. NEXT per plan: I3 (the GUI — preset-lib + from-zero grip×motion composer + relabel 'firmware' → 'Pneumatic push'). SIM-FRAME/authoring untouched; ATC-model axis. Human has design eyes.**

## 🔨 turn 219 (cycle 13) — I3: the ATC CHANGER composer GUI (preset-lib + from-zero) + the NAMING FIX (RE-PLAN #2 inc 3). SIM/UI, BYTE-IDENTICAL for the 3 presets. Full suite 581 pass / 2 skip / 0 fail (grew 579→583 with 4 new changer-GUI tests; no flake). 6 files (2 new + 4 modified).

**(B) NAMING FIX (human t218: 'pneumatic' isn't distinctive — most ATCs are pneumatic; the MECHANISM is):** in atcModel.js RENAMED the grip key `pneumatic` → `pusher` (mechanism, not actuation; label 'Pusher') + `magnetic` → `magnet` (label 'Magnet'); grips are now drawbar/collet · pusher · magnet (actuation air/hydraulic/electric = a separate/implied property, NOT a grip type). Firmware PRESET → {grip:'pusher'} + label 'Push station' (NOT firmware/pneumatic-push). Added PRESET display labels (Push station / Drawbar pick & place / Disk carousel / Controller M6 / Manual) + a candidate `rapidchange` preset (magnet × plunge × linear). BYTE + SIM IDENTICAL: the rename is a key/label change — the pusher grip's `device` is still 'pusher', so the choreo descriptor + emit are unchanged; the 3 presets resolve to the same combos.

**(A) THE CHANGER GUI (NEW ui/atcChangerGui.js — the two doors to the ONE config):** `renderAtcChanger(container,{atc,onChange})` in a new "TOOL CHANGER" section atop the ATC settings tab: (1) PRESET LIBRARY dropdown = the built-in PRESETS + the user's saved ones → picking pre-fills settings.atc.{grip,motion,layout}; (2) FROM-ZERO composer = Layout × Grip × Motion dropdowns (from atcModel LAYOUTS/GRIPS/MOTIONS); (3) SAVE AS PRESET = persist the current config to settings.atc.userPresets (re-appears in the library) + a live combo summary. Data-attrs (data-atc-preset/layout/grip/motion/save/savename) for targeting.

**ONE-SOURCE + config-DRIVES-sim:** atcCombo(params, atc) now reads the Studio-DECLARED changer (settings.atc.grip/motion/layout) as PRIMARY, else the method preset (back-compat — when atc is unset the result is EXACTLY the I2 preset combo → byte + sim identical). atcChoreography(params, atc) passes atc through; atcViews.update calls atcChoreography(params, s.atc). So picking a preset / composing a config DRIVES the sim (the seam reads the declared config), and an UNSET config falls back to the method (the 3 existing sim specs untouched).

**BYTE-IDENTICAL SCOPE (Fork A):** the EMIT is still the op's method → atcChangeStack (unchanged) → byte-identical for the 3 presets. NEW from-zero combos (magnet×plunge) build a config + drive the sim's choreo KIND but do NOT emit yet (I5) and don't fully animate (I4).

**VERIFIED REAL SYMPTOM (assert the VALUE + screenshot):** NEW atc-changer-gui.spec (4 tests, real Settings UI) — (a) the preset library lists the RELABELED presets (Push station / Drawbar pick & place / Disk carousel / RapidChange (candidate)); NO 'firmware'/'pneumatic' text; picking Push station sets settings.atc = {grip:'pusher', motion:'push', layout:'station'} (mechanism naming); (b) the declared config DRIVES the sim — atcChoreography({}, atc) for the disk preset == atcChoreography({method:'disk'}) (same kind pick-place + variant carousel + device collet) → sim identical; (c) the from-zero composer builds a magnet×plunge×linear (RapidChange) config; (d) save-as-preset persists {name,grip,motion,layout} + it reappears in the library. Screenshot scratchpad/atc-changer.png (the TOOL CHANGER section — preset lib + Layout/Grip/Motion composer + Save, summary "station · Pusher · Fixed-station push") opened in a VS Code tab. Updated atc-model.spec for the rename (grips drawbar/pusher/magnet; firmware→pusher). ALL ATC sim specs + goldens + atc-roundtrip GREEN → byte + sim identical.

**FLAG (per the dispatch's "flag if the from-zero composer surfaces a schema gap"):** ONE seam noted (not a gap — an alignment for a later increment): settings.atc.{grip,motion,layout} (the MACHINE changer, GUI) + the ATC-change WIZARD's per-op `method` selector coexist — atcCombo reads settings-override-else-method, so the sim follows the declared config; the EMIT still follows the op's method. For the 3 presets they align; unifying the wizard method ↔ the machine changer config (so the emit follows the declared changer too) is a natural follow-up when I5 wires new-combo emit. No schema gap in the composer itself.

**PASSED BACK for advisor review + human eyes on the changer screenshot. NEXT per plan: I4 (the interpreter drives the SIM for NEW combos — sim-first proof of a from-zero/RapidChange config). ATC-model axis; SIM-FRAME/authoring untouched.**

## 🔨 turn 221 (cycle 13) — I4: the choreography INTERPRETER drives the SIM for NEW combos (RE-PLAN #2 inc 4 — the RapidChange payoff). SIM/VISUAL, emit BYTE-IDENTICAL. Full suite 583 pass / 2 skip / 0 fail (grew 583→585 with 2 new interpreter tests; no flake). 5 files (2 new + 3 modified). Fit in ONE increment — no split needed.

**WHAT** — a from-zero / RapidChange changer (magnet × plunge × linear) that has NO hand-written stack now SIMS by WALKING its declared MOTION.steps. The 3 shipped presets keep their played-inline sim (my Fork-A call: the interpreter drives ONLY candidate combos; the presets are untouched → byte + sim identical).

**PIECES (5 files):**
1. `wizards/atcInterpreter.js` (NEW) — `motionToSimGcode(combo, ctx)` WALKS combo.motion.steps → a SIM-ONLY G-code path: positions resolved from the LAYOUT (cur/target pockets · pickup · station), grip release/clamp M-codes from the GRIP (empty for magnet — the plunge does it mechanically), the descend = a G1 plunge into the dock, the #1300 swap at the pick. `interpCtxFromAtc(atc, pockets)` builds a demo cur→target change from the first two pockets. SIM-ONLY: this is the VISUALIZATION path, NOT the emit (the emit is the M6/T.nc call, I5).
2. `wizards/views/atcViews.js` — for a CANDIDATE motion (cmb.motion.candidate — plunge/RapidChange; not the 3 presets) the preview plays the INTERPRETER path instead of the emit; the CODE PREVIEW stays the emit. The choreo (I2/I3) is still atcChoreography(params, s.atc) → plunge seam = pick-place → the EXISTING pick-place swap fires on the #1300 flip (reuse P-C.3b). A fork/dock grip (magnet) renders the fork stations.
3. `viz/gcodeViz3d.js` — `setForkDock(docks)`: a teal fork (base + 2 prongs the tool plunges between) at each dock, on the FIXED machine frame (reuses the setStationDevices device-mesh pattern).
4. `wizardManager.js` — `previewForkDock(containerId, docks)` hook.
5. `tests/atc-interpreter.spec.js` (NEW, 2 tests).

**REUSED (not rebuilt):** the played-engine sim + the tool animation, the pick-place SWAP (checkToolSwap/doToolSwap on the #1300 flip), the machine frame, the magazine render (the docks), the device-mesh pattern. NEW = the interpreter (walk steps → sim path) + the fork/dock mesh.

**VERIFIED REAL SYMPTOM (assert the VALUE + screenshot):** NEW atc-interpreter.spec — (a) the interpreter walks a PLUNGE motion → a sim path with the plunge (G1 Z-40 into the dock) + the target travel (G0 X200 Y100) + the #1300 swap (2→5) + NO drawbar M154 / NO pneumatic M156-163 (the magnet grip's release/clamp are EMPTY — the plunge does it); (b) a from-zero RapidChange config (settings.atc = magnet×plunge×linear) SIMS via the interpreter — the preview plays the "interpreter walk" path (not a stack), the FORK/DOCK stations render (viz._forkGroup), and ▶ play swaps the tool to the target (5) at the plunge. Screenshot scratchpad/atc-rapidchange.png (the spindle PLUNGING — G1 feed, Z -13.9→-40 — into the teal fork/dock stations on the machine frame) opened in a VS Code tab.

**BYTE + SIM IDENTICAL:** the 3 presets' motions are NON-candidate → interpret=false → the preview plays the emit (unchanged); the fork renders ONLY for a magnet/fork combo (not the presets). Full suite 583 pass — all ATC sim specs + goldens + atc-roundtrip GREEN. Emit path untouched (the interpreter is sim-only).

**FLAG:** none blocking. NOTE the I3 config↔method seam still stands: a from-zero combo drives the SIM (via settings.atc) but the EMIT is still the op's method (delegate/manual) — the CODE PREVIEW shows the emit while the sim shows the interpreter plunge; unifying them (the emit follows the declared changer) is I5. Also: the fork/dock renders at the magazine pockets (the docks) — a per-dock fork; refinements (a real ISO20/ER fork profile, a magnet glow) are polish if wanted.

**PASSED BACK for advisor review + human eyes on the RapidChange plunge screenshot. NEXT per plan: I5 (the interpreter EMIT — emit the T.nc O-program + M6 call per the t214 no-inline conclusion, + unify config/method). ATC-model axis; SIM-FRAME/authoring untouched.**

## 🔨 turn 223 (cycle 13) — I5: the interpreter EMITS a T.nc O-program for NEW combos (RE-PLAN #2 inc 5 — RapidChange now FULLY functional sim+emit). Emit BYTE-IDENTICAL for the 3 presets. Full suite 583 pass / 2 skip + 2 KNOWN flakes (blocks-live-form + project-drawer-smoke — both pass ISOLATED 7/7; parallel/init-race, untouched by me). Grew 585→587 with 2 new tests. 3 files.

**t214 CONCLUSION HONORED:** a tool change is a STANDALONE SUBPROGRAM (an O-program with M99), auto-run by the controller on `Tn M6` — NOT inlined into the cutting program. 'Generate T.nc' is the O-program MAKER.

**PIECES (3 files):**
1. `wizards/atcInterpreter.js` — NEW `motionToTnc(combo, atc, opts)`: walks a combo's MOTION + GRIP → a T.nc O-PROGRAM: an `O<num>` header + the dispatch (IF #1504==tool / IF #1300==tool GOTO dock) + per-dock return/fetch sequences (G53 moves; the descend is a `G53 G1 Z F` PLUNGE for a plunge motion, else G0; the grip release/clamp M-codes + waits — EMPTY for a magnet grip) + `#1300=#1504` + `M99` (subprogram return). preOpen = the fetch opens the grip before descending (drawbar), not a magnet. `gripLines(list)` → the M-code + its sensor wait.
2. `ui/settingsPanel.js` — 'Generate T.nc' (atc_gen_tnc) now ROUTES: a NEW / from-zero combo (a candidate motion — RapidChange magnet×plunge) → `motionToTnc` (the interpreter O-program); the shipped drawbar changer (non-candidate) → the EXISTING `generateToolChangeNc` (byte-identical). Imported atcCombo + motionToTnc.
3. `tests/atc-interpreter.spec.js` — 2 new tests.

**BYTE-IDENTICAL (Fork A):** I touched NEITHER the wizard emit (atcChangeStack — the goldens/atc-roundtrip subject) NOR generateToolChangeNc. The interpreter emit is a SEPARATE path used ONLY for a candidate combo. So the 3 presets' emit + 'Generate T.nc' for a drawbar changer are byte-identical. Converging the 3 presets onto the interpreter + unifying config↔method = I5b (deferred, as the dispatch specified).

**VERIFIED REAL SYMPTOM (assert the VALUE + screenshot):** NEW atc-interpreter.spec — (a) motionToTnc for a RapidChange config = a valid O-program: an `O<num>` header (standalone, not inline), the plunge descend `G53 G1 Z#3 F800`, the #1504 dispatch (runs on Tn M6), `#1300 = #1504` (records the new tool), the linear docks ("return T2 to dock 1"), ends with `M99`; NO drawbar M154 / NO pneumatic M156-163 (magnet grip empty); (b) 'Generate T.nc' ROUTES — a RapidChange config → the interpreter O-program (plunge, no drawbar), switching to a drawbar changer → the existing generator (M154 dance, no plunge feed). Screenshot scratchpad/atc-rapidchange-tnc.png (the generated `O1000 (magnet x plunge tool-change macro)` — the STANDALONE-macro header "runs on Tn M6" + the dock dispatch) opened in a VS Code tab. Full suite: goldens + atc-roundtrip + all ATC specs GREEN (byte-parity; the 2 failures are the known flakes, pass isolated).

**RAPIDCHANGE IS NOW FULLY FUNCTIONAL from CONFIG:** compose magnet×plunge×linear in the GUI (I3) → the sim walks it (I4) → 'Generate T.nc' emits its O-program (I5). The composable model's payoff: a new changer = a config, no new per-method code.

**FLAG (deferred, per the dispatch):** I5b = the config↔method unify (make the cutting-program op's emit follow the declared changer — today the ATC-change wizard emit is still the op's method; the T.nc is the standalone macro the config emits) + converging the 3 presets onto the interpreter (a byte-tested step). Not a gap — the intended split.

**PASSED BACK for advisor review + human eyes on the RapidChange T.nc. NEXT per plan: the RELEASE (the complete composable ATC) + any I5b. ATC-model axis; SIM-FRAME/authoring untouched.**

## 🔨 turn 225 (cycle 13) — I5b-1: teach the interpreter to emit a SAFETY-COMPLETE drawbar T.nc FROM THE DECLARATION (so it can LATER become the single emitter). ADDITIVE, ZERO shipped-output change (no routing/golden/generateToolChangeNc/3-preset-sim change). Full suite 585 pass / 2 skip / 1 known flake (middle-animator retry-passed; grew 587→588). Diff = atcModel.js + atcInterpreter.js + the test (exactly as specified).

**THE TRAP (advisor):** routing drawbar to the interpreter NAIVELY would DROP the M300 spindle-stop wait + the G04 P500 drawbar settle dwell (SAFETY). FIX = DECLARE, not hand-roll.

**DECLARE (atcModel GRIPS.drawbar):** added `stopWait: 'M300'` (wait spindle stopped after M5 M9), `dwell: 500` on the release (M154) + clamp (M155) actions (kept the waits M301/M302). All INERT except read by motionToTnc — the SIM (motionToSimGcode uses code-only), the choreo, the routing, the 3-preset emit are UNTOUCHED → zero shipped change.

**EMIT GENERICALLY (atcInterpreter, NO gripKind branch):** `gripLines(list)` now emits code + `G04 P<dwell>` (declared) + wait; motionToTnc emits `grip.stopWait` after M5 M9 (never dropped). Added `gripOpen(list)` = code + wait, NO settle dwell — the FETCH pre-open (open collet + WAIT, then descend ONTO the tool; the dwell is for actuate-and-hold = the return-release + the clamp), matching the DDCS dance. A magnet grip declares none → its macro has no M300/dwell/wait (per-grip declaration).

**THE DRAWBAR T.nc IT NOW PRODUCES (safety-complete, matches the DDCS drawbar dance = generateToolChangeNc; differs only by the O-header — the standalone-macro marker):**
```
O1000 (drawbar x pick-place tool-change macro - DDCS Studio)
(GENERATED ... review + dry-run ...)
(STANDALONE macro: the controller runs it on Tn M6. #1504=requested  #1300=spindle  3 docks)
IF #1504==#1300 GOTO999            ; requested tool already in spindle
M5  M9                             ; spindle + coolant OFF
M300                              ; wait: spindle stopped (SAFETY)      <-- was DROPPED, now declared
#4 = 10
G53 G0 Z#4                         ; lift to safe Z
... IF #1300==t GOTO10x dispatch ...
N101 (return T1 to dock 1)
G53 G0 X#1 Y#2 · G53 G0 Z#3 · M154 · G04 P500 (settle) · M301 (wait) · G53 G0 Z#4 · GOTO500   <-- RETURN dance
... N500 fetch dispatch ...
N201 (fetch T1 from dock 1)
G53 G0 X#1 Y#2 · M154 · M301 (WAIT before descend) · G53 G0 Z#3 · M155 · G04 P500 (settle) · M302 (wait) · G53 G0 Z#4 · #1300 = #1504   <-- FETCH dance
... N999 · M99
```
(the RETURN + FETCH sequences are byte-structure-identical to the DDCS drawbar dance; the O-header is the intended NOT-inline marker.)

**VERIFIED (assert the VALUES + ordering vs the DDCS dance, not non-empty):** NEW test — O-header + M99; IF #1504==#1300 GOTO999; M300 AFTER M5 M9 (the dropped-safety element restored); RETURN in-order = XY,descend,M154,G04 P500,M301,lift; FETCH in-order = XY,M154,M301(WAIT before descend),descend,M155,G04 P500,M302,lift,#1300=#1504; a MAGNET grip's macro has NO M300/M301 (declaration-driven, per grip). atc-interpreter (all 5) + atc-roundtrip (8) + full suite GREEN; ATC goldens byte-identical (zero shipped change — the drawbar route still uses generateToolChangeNc).

**NO SAFETY GAP (step 4):** every safety element (M300 stop-wait · the settle dwells · the released/clamped waits · the open+wait-before-descend) COMES FROM THE DECLARATION — none required hand-rolling; the interpreter is now capable of the safety-complete drawbar emit for the future single-emitter converge.

**PASSED BACK for advisor review. NEXT per plan: the byte converge (route drawbar → motionToTnc, reconcile the O-header, retire generateToolChangeNc) + config↔method unify = the rest of I5b, then the RELEASE. ATC-model axis; SIM-FRAME/authoring untouched.**

## 🔨 turn 227 (cycle 13) — I5b-2a: CONVERGE the DRAWBAR emit onto the interpreter (the cutover; emit-CHANGING = GATED for advisor + HUMAN review BEFORE final). Full suite 585 pass / 2 skip / 1 KNOWN flake (blocks-live-form, passes isolated 6/6). 2 files (settingsPanel routing + the test).

**THE CUTOVER (settingsPanel.js atc_gen_tnc):** TRANSITIONAL routing — `useInterp = candidate || gripKind==='drawbar'` → motionToTnc, else generateToolChangeNc. Commented clearly as transitional (collapses to UNCONDITIONAL motionToTnc + retires generateToolChangeNc once disk+pusher converge = I5b-2b/c). Only the EXPLICIT drawbar-declared changer routes to the interpreter now; legacy/disk/pusher stay on generateToolChangeNc.

**VERIFIED THE DIFF MYSELF (verify-real-symptom, per the gate) — generated OLD (generateToolChangeNc) vs NEW (motionToTnc) for the SAME drawbar config + diffed:**
- STRIPPING comments/parentheticals/blank-lines/O-header → the EXECUTABLE PROGRAM is **BYTE-IDENTICAL** (zero-line diff). Every M-code / G-code / #var / N-label / IF / GOTO / M99 matches. Confirms the advisor's line-by-line diff: ZERO executable/safety change.
- The ONLY diffs: (1) +`O1000 (drawbar x pick-place tool-change macro - DDCS Studio)` header (the not-inline marker generateToolChangeNc lacked); (2) comment WORDING (`; ...` phrasing, `pocket`→`dock`, tool NAMES dropped from the N-labels); (3) blank lines (old had section blanks, new doesn't). All non-executable.

**SAFETY-ASSERTION MOVED ONTO THE SHIPPED ROUTE:** the I5b-2a test now CLICKS Generate T.nc with a drawbar config → asserts the SHIPPED output has the O-header + M300 (spindle-stop wait) + the drawbar dance (M154→M155 + G04 P500 dwells + M301→M302 waits) + `dock` wording + NO plunge G1 feed. (The I5b-1 direct-motionToTnc ordering test stays as the interpreter unit test.)

**GOLDEN RE-BASELINE:** there is NO byte-golden/.nc-fixture/snapshot for the T.nc button output (the ATC goldens = the WIZARD emit atcChangeStack — UNTOUCHED, still green; verification/atc-gen-test.mjs tests the wizard emit, not generateToolChangeNc). The "drawbar T.nc golden" = the routing TEST assertion, re-baselined from "drawbar → the existing generator" to "drawbar → the interpreter (safety-complete shipped route)".

**SCOPE HELD:** did NOT touch the disk/pusher route (stays on generateToolChangeNc), the 3-preset SIM, or any non-drawbar golden. atc-roundtrip + atc-wizards + ATC goldens BYTE-IDENTICAL (they test the wizard emit). full suite green (the 1 failure = the known blocks-live-form flake, passes isolated).

**⏸ GATE — PASSED BACK the byte-DIFF for advisor + HUMAN review BEFORE it is final** (the shipped drawbar T.nc output now carries the O-header + the reworded comments). The two .nc files (drawbar-old.nc / drawbar-new.nc) + the unified diff are in scratchpad, opened for review. NEXT (on approval): I5b-2b = PUSHER converge (FIRST verify GRIPS.pusher declares the correct O10102 push M-codes vs the dump — pusher currently falls back to the WRONG drawbar M154/M155 if routed).

## 🔨 turn 229 (cycle 13) — I5b-3 SCOUT: the config/method CODE-SOURCE unify (design + decomposition, NO code; GATED for advisor + HUMAN before build).

### THE PROBLEM (why)
I5b-2a's converge routes the drawbar emit through motionToTnc → atcCombo → **GRIPS' hardcoded M154/M155**. But the OLD generateToolChangeNc read the code from the USER's I/O table (`outputs.find(type==='drawbar').onCode || 'M154'`). So the converge DROPPED the user's custom drawbar code: a machine that uses M158/M159 for its drawbar now emits M154/M155 (wrong). SAME for the sensor WAITS (M301/M302 hardcoded vs the user's sensor rows). The SIM (motionToSimGcode) has the same hardcoded-code gap. → sim + emit must both SOURCE the codes from the user's ATC I/O function table.

### THE ONE-SOURCE MODEL
```
  USER's ATC I/O function table            GRIPS (atcModel) — stays DUMB
  (settings.outputs/inputs, editable)  ×   (STRUCTURE + a DEFAULT-code fallback)
     onCode/offCode/waitCode                  release/clamp actions declare a fn-REFERENCE
            │                                          │
            └──────────►  a RESOLVER  ◄───────────────┘   (code = user's onCode ELSE the grip default)
                              │
                  ┌───────────┴───────────┐
             SIM (motionToSimGcode)   EMIT (motionToTnc)     ← both call the resolver → CONSISTENT + machine-correct
```
The user's I/O table is the ONE SOURCE for the VALUE; GRIPS declares the STRUCTURE (which function each action drives, + a default so an un-configured machine still emits). One resolver, two consumers (sim + emit).

### THE MECHANISM (a declared fn-reference + a resolver; keep the grip data dumb)
- A grip ACTION gains a REFERENCE: `{ fn, edge, code (default), waitFn, wait (default), dwell, dev }` — `fn` = the I/O function key + `edge`='on'|'off' (release=on / clamp=off); `waitFn` = the sensor function; `code`/`wait` = the DEFAULT fallbacks (today's literals). The grip stays declarative data — NO lookup logic in it.
- A pure resolver `resolveAction(action, io)` → `{ code: <the matched OUTPUT row's onCode(edge on)/offCode(edge off)> ?? action.code, wait: <the matched INPUT row's waitCode> ?? action.wait, dwell, dev }`. motionToSimGcode + motionToTnc replace `action.code`/`action.wait` with the resolver (ONE seam).
- THE STABLE LINK (output row ↔ fn): the ATC I/O rows today are matched by onCode (fragile — editing the code breaks the link) and carry NO stable fn key. Two ways: match by row `type` (the drawbar row is type:'drawbar' — exactly how generateToolChangeNc links it, STABLE), or add a declared `fn` key to the rows. Sensors match by their seeded id / canonical waitCode.

### DECOMPOSITION (minimal-first)
- **INC1 — DRAWBAR code-source (unblocks the HELD drawbar release):** the drawbar release/clamp declare `fn:'drawbar'`+edge+`waitFn`; the resolver reads the drawbar OUTPUT row (matched by `type==='drawbar'` — REUSES generateToolChangeNc's proven link, NO new field) onCode/offCode + the drawbar sensor INPUT rows' waitCodes; defaults M154/M155/M301/M302. Wire both motionToSimGcode + motionToTnc through the resolver. SMALL. **Verify: a custom drawbar onCode (M154→M158) → BOTH sim + emit use M158; a default machine → M154/M155/M301/M302 byte-identical (goldens green).**
- **INC2 — PUSHER code-source:** add the stable `fn` key to the ATC I/O rows (extend the GUI-3 ATC_IO_FUNCTIONS catalog + the seed + a back-fill for existing rows); the pusher's pre/release/post/clamp actions ref vacuum/pin/pusher/dust functions + edges.
- **INC3 — DISK ROTATE code-source:** the rotate function resolution (see HARD CASE).

### HARD CASES (flagged)
- **PUSHER = a multi-code O10102 sequence:** "one action → one function" HOLDS — each actuator IS one function edge: vacuum-off (M159=off), pin-close (M157=off)/pin-open (M156=on), pusher-open (M160=on)/pusher-close (M161=off), dust-off (M163=off). So the actions map to function on/off edges cleanly. The COST: the pusher grip spans 4 functions, all needing I/O rows (else fall back to defaults) + they need the stable `fn` key (INC2). Not a blocker — a bigger surface.
- **DISK ROTATE is NOT a grip release/clamp — it is a MOTION step:** "rotate the carousel to pocket #106" has no on/off actuator M-code; it is a rotate OUTPUT + an index SENSOR (M303/M304) tied to the `rotate` MOTION step, not the GRIP. So the grip-action-fn mechanism DOESN'T cover it — INC3 needs a parallel MOTION-STEP code-source (the rotate step resolves the rotate output + index sensor), or the rotate stays literal for now. FLAG for the design decision.

### EFFORT + FORK
- INC1 SMALL (a resolver + fn-refs on the drawbar grip + wire 2 emitters; type-match link, no schema change). INC2 MEDIUM (the `fn` key + catalog/seed + pusher's 4 functions). INC3 MEDIUM (the motion-step code-source for rotate).
- **FORK (the stable link):** (A) INC1 matches the OUTPUT by `type` (drawbar) — minimal, no new field, unblocks drawbar fast; add the declared `fn` key at INC2 when pusher needs it [REC — incremental, lowest risk]. vs (B) add the `fn` key to ALL ATC I/O rows upfront (catalog + seed + migration) — one clean mechanism, but a bigger first step touching GUI-3 + existing configs.
- BYTE-PARITY: INC1's default path (no user onCode edit / the seeded M154 etc.) resolves to the SAME literals → byte-identical (goldens green); only a machine with a CUSTOM code changes (correctly). SIM/emit only — the wizard emit (atcChangeStack goldens) untouched.

**GATED per worker step-5 (this reworks how the grip codes source — the advisor wants the plan + HUMAN eyes, esp. FORK [type-match vs fn-key] + the disk-rotate HARD CASE). NO code. PASSED BACK the model + mechanism + decomposition (INC1 drawbar first, then pusher, then disk) + the hard cases. Ready to build INC1 on confirm. ATC-model axis; SIM-FRAME/authoring untouched.**

## 🔨 turn 231 (cycle 13) — I5b-3 INC1: the DRAWBAR code-source (fork A / type-match — unblocks the HELD drawbar release). SIM+EMIT source the drawbar M-codes + sensor waits from the user's ATC I/O table; default byte-identical. Full suite 587 pass / 2 skip / 0 fail (grew 589 with 1 new test; no flake). 5 files (atcModel + atcInterpreter core + 2 io-threading wirings + test).

**THE FIX (declare, not hand-roll):**
1. `atcModel GRIPS.drawbar` — the release/clamp actions now declare fn-REFERENCES (data stays DUMB): release `{fn:'drawbar', edge:'on', waitFn:'drawbar_released', code:'M154' default, wait:'M301' default, dwell:500}`; clamp `{fn:'drawbar', edge:'off', waitFn:'drawbar_clamped', code:'M155', wait:'M302', dwell:500}`. (stopWait M300 + the dwell stay declared defaults.)
2. `atcInterpreter resolveAction(action, io)` — NEW pure resolver: code = the OUTPUT row matched by `type==='drawbar'` (fork A — stable, survives a code edit, exactly generateToolChangeNc's link) → onCode(edge on)/offCode(edge off), ELSE action.code; wait = the INPUT row matched by the seeded id `<waitFn>_atc` (or the canonical waitCode) → waitCode, ELSE action.wait; dwell/dev pass through.
3. ONE SEAM — BOTH emitters go through resolveAction: the SIM's `emitActions(list, io, lines)` (motionToSimGcode) AND the EMIT's `gripLines(list, io)` / `gripOpen(list, io)` (motionToTnc). io = `{outputs, inputs}` threaded via `interpCtxFromAtc(atc, pockets, io)` (sim, atcViews passes s.outputs/s.inputs) + `motionToTnc(cmb, atc, {io})` (emit, settingsPanel passes getOutputs()/getInputs()). NOTE: outputs live at settings.outputs, NOT settings.atc.

**VERIFIED THE VALUES IN BOTH PATHS (assert-the-value):** NEW INC1 test — a CUSTOM machine I/O (drawbar output onCode M158/offCode M159, released-sensor waitCode M310) makes BOTH the SIM G-code (motionToSimGcode) AND the EMIT T.nc (motionToTnc) use M158 (release) + M159 (clamp); the custom sensor waitCode M310 flows too; a DEFAULT machine (no custom I/O) keeps M154/M155/M301/M302 (sim + emit byte-identical, no custom code). The I5/I5b-1/I5b-2a interpreter tests + atc-roundtrip (wizard emit) + full suite GREEN → byte-parity (default path resolves to the same literals; only a CUSTOM-code machine changes, correctly).

**SCOPE HELD:** did NOT touch the pusher/disk grips (INC2/3), the wizard emit atcChangeStack, or the disk/pusher route. The only new machinery = the pure resolveAction + the io thread; GRIPS gained fn-refs (declarations).

**PASSED BACK for advisor review — on bless the advisor RELEASES the drawbar converge (I5b-2a) + INC1 together. NEXT: INC2 pusher (add the stable fn key + the pusher's multi-function actions), then INC3 disk-rotate (the motion-step code-source). ATC-model axis; SIM-FRAME/authoring untouched.**

## 🔨 turn 233 (cycle 13) — WIZARD-OP → T# M6 SCOUT: converge the ATC-change OP emit from the inline dance to a T# M6 CALL to the installed T.nc (design + decomposition + install-safety options, NO code; model-level + emit-changing; GATED for advisor + HUMAN).

### THE CONVERGE
```
  BEFORE                                   AFTER
  atc_change op ──► atcChangeStack         atc_change op ──► T<n> M6  ( calls your installed T.nc )
    (firmware/generic/disk = the             + ( @DDCS:1 {op:atc_change, method, fixedT, …} )  ← round-trip marker
     full INLINE dance in the program)      the DANCE lives in the T.nc (the interpreter's O-program), NOT the program.
  wizard preview PLAYS the inline dance    wizard preview PLAYS the INTERPRETER motion (motionToSimGcode) — the T# M6
                                             line has no motion, so the SIM animates the declared changer combo.
```

### (1) TOOL-NUMBER SOURCE
`T<params.fixedT> M6` — the op's "change to tool" (fixedT). `fixedT>0` → `T<n> M6` (explicit standalone change). `fixedT=0` ("from program") → the op sits AFTER a program `Txx` that set #1504 → emit a bare `M6` (or require an explicit target). FLAG: a standalone change should carry an explicit tool; "from program" is only valid embedded after a Txx.

### (2) RETIRE THE INLINE DANCE → THE CALL
The AUTOMATIC methods (firmware/generic/disk) → emit `T<n> M6` + the "calls your installed T.nc" note; the code-preview shows `T# M6` (not the dance). m6 STAYS `M6` (already a delegate call); manual STAYS inline (a hand-swap, no T.nc). METHOD-AGNOSTIC: since the op emits `T# M6`, the METHOD only selects the T.nc content (the changer config) — the op emit is the SAME for all automatic methods.

### (3) THE SIM (the key — decouple emit from preview)
atcViews computes TWO things for the op: `gcode = T# M6` (the code-preview) + `simGcode = motionToSimGcode(the declared changer combo, ctx)` (the wizard preview). So the preview still shows the plunge/dance/swap by walking the machine's declared changer (settings.atc.grip/motion) via the INTERPRETER — a GENERALIZATION of I4 (which did this for candidate combos only) to ALL atc_change previews. (FLAG: the WIZARD preview animates via the interpreter cleanly; the MAIN-PROGRAM sim, with `T# M6` embedded, fires the swap on #1300 but won't inline the dance UNLESS the played engine EXPANDS T# M6 → the changer motion — a macro-aware-playback follow-up. Options: wizard-preview-only animation now, or macro-expansion later.)

### (4) THE INSTALL-DEPENDENCY = THE SAFETY CRUX (a bare T# M6 SILENTLY NO-OPs if the T.nc isn't installed) — OPTIONS (human decides)
- **OPT-A — NOTE + WARN (minimal, always-on) [REC baseline]:** the code-preview carries `( T# M6 — runs YOUR installed T.nc; generate + install it via ⚙ Generate T.nc )`; a UI banner on the atc_change op + a setup-checklist item "ATC change macro installed?". No controller needed. Doesn't PROVE installation, but makes the dependency loud + guides the fix.
- **OPT-B — VERIFY-MACRO-EXISTS (gateway):** when the gateway/exe is connected, query the controller's file list for the installed T.nc / O-number; warn/BLOCK if absent, green-check if present. Strong, but only works connected; needs a controller file query.
- **OPT-C — INLINE-FALLBACK toggle [REC escape hatch]:** an op/config toggle "call installed macro (T# M6)" vs "inline the change" (emit the interpreter's O-program BODY inline — no O-header/M99, the dance as program lines). For a machine that CAN'T install a macro (offline / no file access). This is the OLD behavior kept as a deliberate, labeled fallback.
- REC: A (loud note + checklist) as the baseline + C (inline-fallback) as the escape hatch; add B (verify) when the gateway is connected. The human picks the mix.

### (5) ROUND-TRIP (already solved by the marker)
The op emits `T# M6` + `( @DDCS:1 {op:atc_change, method, fixedT, …} )` — the @DDCS marker (opSchema.js) carries the op params INDEPENDENTLY of the G-code lines, so the reconciler parses the op back from the MARKER (not the T# M6 line). Converging the emit line does NOT affect round-trip — the marker is unchanged. Just verify the marker rides with the T# M6 line.

### (6) BACKWARD-COMPAT (existing placed inline atc_change ops)
The op params live in the @DDCS marker, so a re-emit produces T# M6. Options: **(a) migrate-on-rebuild** [the op re-emits as T# M6 next time it's rebuilt — clean, one path, but changes existing programs' output on rebuild] vs **(b) stay-inline via a per-op flag** [old ops keep the inline dance; new ops emit T# M6]. REC (a) migrate-on-rebuild (the inline is retired; OPT-C covers machines needing inline). Human decides.

### (7) SCOPE
ALL AUTOMATIC methods at once (firmware/generic/disk) — because the op emit becomes IDENTICAL (`T# M6`) regardless of method (the method → the T.nc, not the op). Drawbar-first would be an artificial split (the op emit is method-agnostic). m6/manual unchanged.

### (8) DECOMPOSITION (+ it SUBSUMES the pusher/disk OP-emit)
- **INC-A (op emit → T# M6):** atcChangeStack's automatic methods emit `T<n> M6` + the note + the marker; code-preview shows T# M6. EMIT-CHANGING → GATE + re-baseline the atc_change goldens/atc-roundtrip (the emitted G-code changes from the dance to T# M6; the @DDCS round-trip stays).
- **INC-B (the sim):** atcViews drives the atc_change preview via motionToSimGcode(the declared changer) for ALL combos (generalize I4) — the preview shows the dance despite the T# M6 emit.
- **INC-C (install-safety):** the chosen OPT (A note+checklist / B verify / C inline-fallback).
- **INC-D (backward-compat + round-trip verify):** migrate-on-rebuild (or the stay-flag) + assert T# M6 + @DDCS parses back.
- **→ SUBSUMES the pusher/disk OP-emit:** once the op emits `T# M6`, the pusher/disk DANCE is entirely in the T.nc (the interpreter's O-program), so the earlier INC2 (pusher) / INC3 (disk) reduce to JUST the T.nc CODES (the interpreter's pusher/disk emit + their I/O code-source) — the op-emit side is done.

### EFFORT + THE FORKS
- INC-A SMALL-MEDIUM (retire the automatic stacks → T# M6 + marker; re-baseline goldens). INC-B SMALL (generalize the I4 sim wiring). INC-C = the chosen option's size (A small / B medium+gateway / C medium). INC-D SMALL.
- **FORK 1 (install-safety):** A note+checklist / B verify-gateway / C inline-fallback — REC A+C, B when connected. HUMAN decides (safety-critical).
- **FORK 2 (backward-compat):** migrate-on-rebuild vs stay-inline-flag — REC migrate + OPT-C fallback.
- **FORK 3 (main-program sim):** wizard-preview-only interpreter animation now, vs macro-aware-playback (expand T# M6 in the played engine) later — REC wizard-preview now, flag the expansion.
- BYTE-CHANGING: INC-A changes the atc_change EMITTED G-code (dance → T# M6) → re-baseline the atc_change goldens/atc-roundtrip DELIBERATELY (like I5b-2a); the @DDCS round-trip + the wizard SIM are preserved/improved. The other wizards' goldens untouched.

**GATED per worker step-5 (a model-level, emit-CHANGING reframe of the shipped ATC-change op; the advisor wants the plan + HUMAN eyes — esp. FORK 1 [install-safety, the crux] + FORK 2 [backward-compat] + FORK 3 [main-sim]). NO code. PASSED BACK the design + the install-safety OPTIONS + the decomposition (subsumes pusher/disk op-emit). Ready to build INC-A on the human's install-safety + scope decisions. ATC-model axis.**

## 🔨 turn 235 (cycle 13) — INC-A SIM-DECOUPLE: ⚠️ GATE HELD — the interpreter preview MATERIALLY DEGRADES for FIRMWARE. Verified BEFORE shipping (per the dispatch's "if it degrades STOP + report"); NO code shipped (0 code files changed). Reporting the diff + the proposed enrichment for the advisor's enrich-or-reconsider call.

**WHAT I VERIFIED (generated motionToSimGcode for firmware/generic/disk vs the current wizard-emit preview):**

**🔴 FIRMWARE (push) — MATERIALLY DEGRADED (missing the entire station DANCE):**
- interpreter sim = `( push sim )  #1300=1  M19  M159  M157  G0 Z10  M160  M163  M156  M161  #1300=2  G0 Z10  M30`
- → the pneumatic M-codes fire IN PLACE; there is NO station XY travel — the tool does NOT move to push-start / push-end / retreat.
- vs the CURRENT firmware preview (plays firmwareStack): `G53 Z#1306 · G53 X#1320 Y#1321 · G53 X#1323 Y#1324 · G53 X#1325 Y#1326` = the REAL station travel + the push stroke, on the machine frame, + the station highlight + the pusher/pin devices.
- ROOT CAUSE: (1) `interpCtxFromAtc` provides only cur/target/pickup (from the magazine pockets) — NO `ctx.station`, so the push motion's `station.start/end/retreat/z` refs resolve to undefined → no moves; (2) firmware has no magazine, so even cur/target are null. SECONDARY: motionToSimGcode emits `G0` (part/WCS frame) but the station is MACHINE-frame (`G53`) — coincides only at workOrigin=0.

**🟡 GENERIC (pick-place) — roughly equivalent / arguably richer:**
- interpreter sim HAS the dance: `#1300=1 · G0 X100 Y50 · G1 Z-40 · M154 · G0 Z10 · G0 X150 Y50 · M154 · G1 Z-40 · M155 · #1300=2` (travel to the pockets + the drawbar codes + the demo swap). vs the current (plays autoStack, which without a program tool-change may show no swap motion). Frame caveat: `G0` (part) vs autoStack's `G53` (machine) — coincides at workOrigin=0.

**🟡 DISK (rotate) — roughly equivalent:** `#1300=1 · G0 X150 Y100(pickup) · M154 · G0 Z10 · G0 X150 Y100 · G1 Z-30 · M155 · #1300=2` (pickup travel + drawbar + swap; the ring rotation rides the swap). Same frame caveat.

**VERDICT (the gate):** shipping the all-methods sim-decouple NOW would DEGRADE the firmware preview (lose the station dance entirely) → per the dispatch I STOPPED, did not ship. generic/disk are acceptable; firmware is NOT.

**PROPOSED ENRICHMENT (small, to make ALL methods equivalent — the advisor's "enrich motionToSimGcode" branch):**
1. `interpCtxFromAtc` reads `settings.atc.firmwareStation` → `ctx.station = { start: pushStart, end: pushEnd, retreat: retreat, z: safeZ }`, so the push motion's station refs resolve to the taught points → the tool walks push-start → push-end → retreat.
2. The ATC interpreter station moves emit `G53` (machine frame) — or all ATC moves do — so the station/pocket travel lands on the FIXED machine frame (robust to a WCS offset, matching firmwareStack). (Reuses GUI-1's firmwareStation + var-seed conventions.)
→ With (1)+(2), firmware previews the full station dance equivalently; generic/disk gain the correct machine frame.

**FORK for the human/advisor:** (A) ENRICH now (add ctx.station + G53) → ship all-methods sim-decouple equivalently [REC — small, correct]; (B) ship generic/disk sim-decouple now, firmware after the enrichment; (C) reconsider (keep firmware on the played firmwareStack preview, interpreter for generic/disk + candidates only). The full interpreter path JSON is in scratchpad/sim-check.json.

**⏸ GATE — PASSED BACK the equivalence diff + the proposed enrichment BEFORE shipping. Did NOT change the 3-preset emit/goldens (nothing shipped). Awaiting the enrich-or-reconsider decision.**

## 🔨 turn 237 (cycle 13) — INC-A RETRY (Fork A / ENRICH): the SIM-DECOUPLE — the atc_change WIZARD preview animates via the INTERPRETER for ALL automatic methods (firmware/generic/disk). ADDITIVE — NO emit change, ALL goldens BYTE-IDENTICAL. Full suite 587 pass / 2 skip / 0 fail. Firmware degrade FIXED + equivalence VERIFIED. 3 files.

**THE FIX (the t235 firmware degrade):**
1. `interpCtxFromAtc` now reads `settings.atc.firmwareStation` → `ctx.station = { start:pushStart, end:pushEnd, retreat, z:safeZ }`, so the push motion's station.start/end/retreat/z refs RESOLVE (were undefined → no travel).
2. The ATC interpreter moves now emit `G53` (machine frame) not `G0` — machine-frame-correct for the ATC positions (station/pockets/pickup all machine coords), robust to a WCS offset (workOrigin=0 unchanged; non-zero-WCS now MORE correct, not a regression).
3. `atcViews`: `interpret = candidate OR method∈{firmware,generic,disk}` — the WIZARD preview plays motionToSimGcode for all automatic methods; the EMIT (gcode) STAYS atcChangeStack (ADDITIVE); m6/manual keep their played emit.

**FIRMWARE EQUIVALENCE — VERIFIED (was the degrade; now walks the full station dance):**
- interpreter sim = `M19 · M159 M157 · G53 G0 Z-10 · G53 G0 X<pushStart> · M160 · G53 G0 X<pushEnd> · M163 M156 · G53 G0 X<retreat> · M161 · [#1300 swap if magazine] · G53 G0 Z<safeZ>` — the tool now TRAVELS push-start → push-end → retreat with the pneumatic M-codes, matching firmwareStack's station sequence (G53 X#1320 → #1323 → #1325). Minor diffs (the release dwell #1322 + the F#563/#1327 feeds are timing, not the path/devices).
- ALL 30 ATC sim/roundtrip specs GREEN (per the gate — the DEVICES + HIGHLIGHT + SWAP carry): atc-station-devices "(3) a real firmware push PLAY animates the devices via the engine io_change" GREEN → the interpreter path's M160/M161/M156/M157 fire the io_change → the pusher/pin animate; atc-station-highlight GREEN → the highlight (traced from gcode=firmwareStack + the var-seed) carries (independent of simGcode); atc-tool-swap "(3) isolated firmware shows NO swap" GREEN → firmware has no magazine → interpCtx has no cur/target → no demo swap (matches current). NEW INC-A test asserts the station travel (G53 to pushStart/end/retreat) + the pneumatics + NO bare part-frame G0.
- SCREENSHOT scratchpad/firmware-interp.png: the tool TRAVELING the station (DRO X204→ heading to the station at Z-10, "G0 rapid 333mm") on the machine frame — the station dance the t235 degrade was missing. Opened in a VS Code tab.

**GENERIC/DISK stay correct:** now G53 (machine frame) — the pocket/pickup travel + the drawbar codes + the demo swap; workOrigin=0 unchanged, WCS-offset now correct.

**ADDITIVE — ZERO shipped-output change:** the CODE PREVIEW + the emitted G-code STAY atcChangeStack (only simGcode/the preview switched); goldens + atc-roundtrip BYTE-IDENTICAL (587 green). The I4/I5/I5b interpreter tests + the RapidChange sim (now G53) all still green.

**GATE SATISFIED — the firmware interpreter preview is EQUIVALENT (station dance + travel + devices + highlight all carry); generic/disk correct. PASSED BACK the equivalence verification + screenshot. NEXT: INC-B (the emit flip — atc_change → T# M6, gated) + the 3 guardrails (note+checklist / gateway-verify / inline-fallback) the human chose. ATC-model axis.**

## 🔨 turn 239 (cycle 13) — INC-B: the atc_change EMIT FLIP — the AUTOMATIC methods (firmware/generic/disk) now DEFAULT to a `T# M6` call to the installed T.nc macro; the inline dance is preserved verbatim behind `callMacro:false`. m6/manual unchanged. GATE — byte-diff + a round-trip finding passed back for advisor+HUMAN review; NOT released. 587 pass / 2 skip / 1 known-flake. 11 files (3 web + 8 tests).

**THE FLIP:**
- New `macroCallStack(params)` in atcChangeWizard.js: emits `( ATC | Tool Change — call the installed T.nc macro )` + a LOUD note (`T# M6 - runs YOUR installed T.nc; generate + install it via Settings -> ATC -> Generate T.nc — a bare T# M6 does NOTHING if it is not installed`) + `T<fixedT> M6` (fixedT>0) or bare `M6` (fixedT=0, tool from a preceding program M6 Txx) + the #1505 complete + M30.
- `atcChangeStack` routing: `if ((method==='firmware'||'generic'||'disk') && params.callMacro !== false) return macroCallStack(params);` else the original switch. So automatic methods DEFAULT to the call; `callMacro:false` keeps the inline dance (the fallback — its converge is INC-B2). The switch dispatch is byte-unchanged (hoisted `resolveMethod` to a `const method`).
- `opSchema.js`: atc_change gained `callMacro: Bool()` (marker codec includes it; `validate` doesn't warn).
- `atcViews.js` atcChangeView params: `callMacro: el('atc_change_callmacro')?.checked !== false` — no checkbox yet (INC-C's toggle [C]) → `undefined !== false` → true → the GUI default is the T# M6 call.

**VERIFY (all criteria met, real values):**
- default → `T3 M6`/`T2 M6` + the loud note. fixedT 0 → bare `M6` (not `T0 M6`).
- `@DDCS` marker RIDES + round-trips: `markerLine('atc_change',{method:'firmware',callMacro:false})` → `( @DDCS:1 {"op":"atc_change","method":"firmware","callMacro":false} )` → `parseMarker` recovers `{method,callMacro:false}`; the default OMITS callMacro → parses back → defaults to T# M6. `validate` = [] both.
- `callMacro:false` BYTE-IDENTICAL to the old default — STRUCTURAL proof: the git diff of atcChangeWizard.js is purely additive (the new macroCallStack + the routing `if`); the 5 inline stacks firmwareStack/autoStack/diskAutoStack/m6Stack/manualStack are byte-untouched, so `callMacro:false` → the exact same switch branch as before.
- byte-DIFF generated (firmware 18→6, generic ~70→6, disk ~80→6 lines) — saved to scratchpad/INC-B-gate.md, opened in a VS Code tab for the human.

**BLAST RADIUS — 7 tests broke, not the 2 the dispatch named. 6 were CLEAN re-baselines (they test the INLINE dance → now pass `callMacro:false`, correct + honest):** atc-station-devices (firmware push devices), atc-io-labeling (M-code pin labels), atc-tool-swap (retire-to-station), atc-station-highlight (push stations), atc-collet (drawbar sensor lighting), atc-model:58 (renamed → guards the inline FALLBACK's byte-preservation). Plus atc-roundtrip:67 (new: default→T# M6 + `not O10102`; callMacro:false→the O10102 stations) + atc-wizards (firmware/generic code-preview → `call the installed T.nc macro`/`M6`, `not G53 Z#1306`/`not M154`).

**⚠ THE 7TH — a real design point, SURFACED at the gate (not silently patched):** the block-level reverse-sync (Blocks-tab edit → wizard form) CANNOT recover the METHOD from a `T# M6` emit — firmware/generic/disk all emit the identical method-agnostic `T# M6`, and the `atc_change` reconciler reverse-PARSES G-code (firmware←O10102, generic/disk←#100), none of which exists in T# M6. **Real symptom = BENIGN (verified, not reasoned):** `pullFromBlocks` treats a null reconcile as a silent no-op (wizardManager.js:187) — form keeps its values, op params intact (makeOp deep-copies them). No corruption/crash. Only loss: editing a T# M6 op's T-word IN THE BLOCKS TAB won't push to the form. Method identity is safe (lives in the declared params, not the emit). Handled: re-baselined atc-roundtrip:39 so method-identity round-trips through the INLINE dance (callMacro:false) + an explicit assertion that the T# M6 default reverse-syncs as a benign no-op (`toBeNull`); legacyAuto/legacyDisk also → callMacro:false. Did NOT grow the reconciler. Options passed back: (A) accept the benign no-op [recommended for INC-B, no new machinery] vs (B) a small reconciler branch reading the DECLARED method+callMacro off the op-wrapper params (declare-not-infer; first reconciler to read declared params — fits INC-C polish).

**GATE — NOT released.** Awaiting advisor+HUMAN review of the byte-diff (scratchpad/INC-B-gate.md, VS Code tab) + the (A)/(B) round-trip call. NEXT after the gate: INC-C guardrails ([A] banner+checklist, [B] gateway verify, [C] inline-fallback toggle) then INC-B2 (converge the inline fallback to the interpreter body + code-source).

## 🔨 turn 242 (cycle 124) — INC-C1: the callMacro TOGGLE UI (guardrail [C], the inline-fallback escape hatch). Adds `#atc_change_callmacro` to the atc_change form for the AUTOMATIC methods; toggling re-renders the code preview between the `T# M6` call and the inline dance. NO emit-logic change (the branch already exists in atcChangeStack; atcViews already read the checkbox). 589 pass / 2 skip / 0 fail. 3 files (+ WORK-LOG).

**CONTEXT:** turn-241's "do option B (reconcile fix)" was SUPERSEDED — the advisor (t240 RESUME, turn 242) diagnosed the idle-not-wedged hiccup, RELAXED to Option A (accept the committed benign no-op; INC-B 0d88acb blessed, nothing lost), DEFERRED the declare-based reconcile B to QUEUED (a designed increment / small scout — it's the first reconciler to read declared params). This turn = INC-C1 instead (small, safe, re-establishes the loop).

**BUILD (minimal, per dispatch):**
- `index.html`: a shared `#atc_change_automatic_params` param-grid (right under the Method select) holding `#atc_change_callmacro` (CHECKED by default), label "Call installed T.nc macro (recommended) — uncheck to inline the change" + a tooltip (recommended = a bare T# M6 calls the T.nc you install via Settings → ATC → Generate T.nc, codes one-source in the T.nc; uncheck = inline the full sequence for a controller with no installed T.nc).
- `atcViews.js` atcChangeView.update(): show `#atc_change_automatic_params` for method ∈ {firmware,generic,disk} (hidden for m6/manual); added `'atc_change_callmacro'` to `inputIds` so toggling fires the manager's change-listener → update() → RE-RENDER; refreshed the stale INC-B "no form field yet" comment to point at the INC-C1 checkbox.
- The `callMacro: el('atc_change_callmacro')?.checked !== false` read (already present from INC-B) now has its UI. NO change to atcChangeStack / the emit logic.

**VERIFY — REAL SYMPTOM (drove the actual checkbox, not a proxy):** new atc-wizards test "the callMacro toggle switches the preview…": m6 (default) → toggle HIDDEN; firmware → toggle VISIBLE + CHECKED, preview = the T# M6 call (`call the installed T.nc macro`, NOT `G53 Z#1306`); `.uncheck()` → preview RE-RENDERS to the inline O10102 dance (`G53 Z#1306` + `M19`, NOT the call); `.check()` → back to the call; generic+disk → VISIBLE, manual → HIDDEN. SCREENSHOTS (scratchpad/callmacro-on.png / -off.png, opened in VS Code tabs): ON = checkbox ticked + bare M6 preview (fixedT 0 = from-program); OFF = checkbox empty + the full inline push dance + the 3D shows the 2-rapid station travel. Both render clean, checkbox sits above the M19 toggle.

**NEXT (per NEXT-SESSION t240):** guardrail [A] banner+checklist · [B] gateway verify · INC-B2 (converge the inline fallback → the interpreter body + code-source) · INC-D (back-compat). QUEUED-deferred: RECONCILE FIX B (the declare-not-infer T# M6 Blocks reverse-sync — a scout-first new pattern).

## 🔨 turn 244 (cycle 125) — INC-C2: guardrail [A], the install-DEPENDENCY BANNER. A prominent amber warning shows on the atc_change op when an AUTOMATIC method (firmware/generic/disk) is in T# M6 mode (callMacro=true): "Calls your installed T.nc macro … install it via Settings → ATC → Generate T.nc, or a bare T# M6 does NOTHING." Hides for the inline fallback (callMacro=false) + for m6/manual. NO emit change. 589 pass / 2 skip / 1 known-flake. 2 files (+ WORK-LOG).

**BUILD (mirror the existing pattern, per dispatch — do NOT hand-roll a new one):**
- `atcViews.js`: added `syncChangeMacroBanner(method, callMacro)` — a MIRROR of `syncChangeUnverifiedBanner` (lazy-create the banner anchored above `#atc_change_automatic_params` = right at the callMacro toggle it explains, then toggle `.display` per state). Distinct AMBER style (`var(--warning,#f59e0b)`) so it reads apart from the RED unverified banner. Shows when `callMacro && method ∈ {firmware,generic,disk}`. Called right after `syncChangeUnverifiedBanner(method)` with the inline callMacro read.
- Banner id `#atc_change_macrodep`, role=alert.

**VERIFY — REAL SYMPTOM (drove the real gestures):** new atc-wizards test "the install-dependency banner shows in T# M6 mode…": m6 (default) → HIDDEN; firmware (callMacro default checked) → VISIBLE (`installed T.nc macro` + `NOTHING`); `.uncheck()` the toggle → HIDDEN (inline, codes present, no T.nc needed); `.check()` → VISIBLE; generic+disk → VISIBLE; manual → HIDDEN. SCREENSHOTS (scratchpad/banner-on.png / -off.png, VS Code tabs): ON = amber banner at the top above the toggle, T# M6 preview; OFF = banner gone, full inline dance. Both render clean; the amber is clearly distinct from the red unverified banner.

**⚠ MINOR FOLLOW-UP FLAGGED (not fixed — advisor's call, pre-existing UI, not a blocker):** for generic/disk + callMacro=TRUE, BOTH banners show (red UNVERIFIED "assumed drawbar model" + amber install-dep). But in T# M6 mode the assumed drawbar codes are NOT emitted (it's a bare T# M6 → the user's own T.nc), so the UNVERIFIED warning is arguably stale there. Clean fix = gate `syncChangeUnverifiedBanner` on callMacro=false too (the assumed model only ships when inline). Left untouched per scope (INC-C2 = add the install-dep banner only; NO change to existing banner behavior). Firmware has no overlap (not generic/disk → no unverified banner).

**RELEASE FLOOR MET:** note (INC-B) + banner (INC-C2) + toggle (INC-C1) = the install-safety floor for the T# M6 convergence. Advisor to RELEASE V10.62 next. NEXT after: guardrail [B] gateway verify · INC-B2 (fallback→interpreter body) · INC-D (back-compat); QUEUED = reconcile fix B (declare-not-infer, scout-first).

## 🔨 turn 247 (cycle 127) — INC-C3: gate the red UNVERIFIED banner on callMacro=false (banner-gate cleanup, no emit change). Closes the UX wart flagged at INC-C2 (t244): the red "assumed drawbar model UNVERIFIED" banner now shows ONLY when actually INLINING those codes (callMacro=false), NOT in the default T# M6 mode (where the op just calls the installed T.nc — the assumed codes are never emitted, so the amber install-dependency banner covers that mode). 590 pass / 2 skip / 0 fail. 2 files (+ WORK-LOG).

**BUILD (per dispatch — tiny, pure UI gate, NO emit-logic change):**
- `atcViews.js`: `syncChangeUnverifiedBanner(method)` → `syncChangeUnverifiedBanner(method, callMacro)`; the `unverified` predicate gained a `!callMacro &&` prefix (`const unverified = !callMacro && (method==='generic'||'auto'||'disk')`). Docstring updated with the INC-C3 rationale.
- Call site (update()): `syncChangeUnverifiedBanner(method, el('atc_change_callmacro')?.checked !== false)` — reuses the exact canonical callMacro read already used one line below for `syncChangeMacroBanner` (line 282) and in the params object (line 304); did NOT hoist to a local const (matched the existing inline idiom, kept the change surgical). The `atc_change_callmacro` checkbox is already in `inputIds`, so toggling re-runs update() → re-syncs the banner (the INC-C1 mechanism).
- No change to `atcChangeStack` / the emit / `simGcode` — pure viz gate.

**VERIFY — REAL SYMPTOM (drove the actual toggle in the real page, both states):** REWROTE the existing atc-wizards test "bold UNVERIFIED banner only when INLINING generic/disk assumed codes (INC-C3)". The OLD test asserted generic/disk → red VISIBLE in the DEFAULT state — which is now (correctly) WRONG, since the default is callMacro-checked / T# M6 mode. New test: generic + callMacro CHECKED (T# M6) → `toBeChecked()` + red HIDDEN; `.uncheck()` (inline) → red VISIBLE + contains "UNVERIFIED" + bolded; `.check()` → HIDDEN again; disk same (checked→hidden, uncheck→visible); firmware → HIDDEN in BOTH modes (never in the generic/auto/disk set); manual → HIDDEN. This is NOT tautological — the "generic + checked → hidden" assertion FAILS on the pre-change code (which always showed for generic/disk), so the test pins the actual gate. Full suite 590 pass / 2 skip / 0 fail.

**HANDOFF NOTE (this turn):** picked up after a "handoff is unsynced" flag post-VSCODE-restart. Diagnosed from the REPO ROOT: HANDOFF.md is internally consistent (turn 247, ball→worker, task INC-C3; handoff.py status agrees) — the authoritative marker was synced; the loop had simply STALLED (prior worker went idle without re-arming the blocking wait). The `.proc/turn.json` 245-vs-247 gap is the proc_health leak-label counter (advisor re-marked it), not the handoff turn — cosmetic. Also noted a STALE `DDCS-Studio/.proc/turn.json` (Jul 3, turn 156) = an old cwd-split-brain artifact; corrected my cwd back to the repo root for all handoff/proc calls (ran tests via the DDCS-Studio subdir only). Cure for the stall = complete this turn + re-arm the BLOCKING `wait --timeout 3600`.

**RELEASE FLOOR (already shipped at V10.62 INC-C2) unchanged — this is pure polish.** NEXT (per NEXT-SESSION t245): [B] gateway verify-installed · INC-B2 (retire inline dance → interpreter body, one emitter) · INC-D (back-compat migrate + round-trip tests) · the deferred reconcile scout (declare-not-infer T# M6 Blocks reverse-sync).

## 🔨 turn 249 (cycle 127) — INC-B2 SCOUT → PROPOSE (GATED, no code). The routing-extract + wrapper-strip seams are CLEAN, but the increment has one UNSPECIFIED op-record-contract decision (how the live atc/io reach the params-pure wizard) that I'm surfacing BEFORE sinking a large emit-changing build — per the dispatch's "if the seam turns out non-trivial → STOP and propose, don't grind (INC-B-recon lesson)" and the campaign's scout-first-for-gated-emit pattern (Z-frame scout).

**SEAM — verified in source (real names, line-pinned):**
- ⚙ Generate T.nc (settingsPanel.js:2120-2132): `atcCombo({},atc)` → `useInterp = cmb.motion && (cmb.motion.candidate || cmb.gripKind==='drawbar')` → `motionToTnc(cmb,atc,{io})` else `generateToolChangeNc(atc,outputs)`. Both return a STRING.
- The two generators source the USER's codes: generateToolChangeNc reads drawbar.onCode/offCode from outputs (atcGenerator.js:25-27, sensor waits M300/301/302 still hardcoded); motionToTnc reads everything via resolveAction(io) (atcInterpreter.js). Wrappers: motionToTnc has an O-header (line 118) + M99 (145); generateToolChangeNc has NO O-header (comments only) + M99 (75).
- The atc_change INLINE branch (atcChangeWizard.js): `atcChangeStack` → generic→`autoStack`, disk→`diskAutoStack`. These are full IF/GOTO/N-label macros built from block ATOMS that HARDCODE the ASSUMED codes (MC(154)/MC(155)/MC(301)/MC(302)) — the exact thing INC-B2 replaces. `generate()` = `emitMapped(atcChangeStack(params)).text`; the stack is a first-class block-atom representation (dialect-aware + round-trips to Blocks).
- Marker: programModel.js:99 prepends `markerLine(op.opType, op.params)` PER-OP — params-driven, INDEPENDENT of the stack (confirmed INC-B). So injecting RAW body lines into the stack does NOT disturb the marker → VERIFY(4) round-trip is structurally safe. atc_change marker fields (opSchema FIELD_BIND:165) = method/x/y/z/zClear/fixedT/orient/waitSpindle/dustCover/confirm (+callMacro from INC-B). magazine/outputs/inputs are NOT serialized (they're threaded emit-only today).
- Import graph: atcModel imports NOTHING; atcInterpreter imports only `num`; atcGenerator imports nothing → a shared `tncProgram` in atcModel importing both generators has NO cycle.

**DECISIONS (I decided all but #4; #4 is the ask, #7 is a flag):**
1. Home of `tncProgram(atc, io, opts)` → **atcModel.js** (has atcCombo; no cycle). DECIDED.
2. Body/wrapper seam → a **`{body:true}` opts flag** on motionToTnc + generateToolChangeNc that OMITS the O-header (interp) + the trailing M99 (both) — the DECLARED seam, NOT a regex header-strip. DECIDED.
3. string→stack bridge → inject the body lines as **RAW atoms** into the op stack (re-atomizing the generators = a big rewrite the SCOPE GUARD defers to I5b-2b/c). DECIDED. Consequence: the inline path's Blocks round-trip degrades to opaque RAW lines + becomes Expert-dialect verbatim — acceptable (auto inline was already Expert-only; the current `if(!atc)` guard degrades non-Expert).
4. ★ **OPEN — how the live atc + outputs/inputs reach the params-pure `generate()`** (tncProgram needs them; the drawbar/sensor CODES live in settings, NOT the op). (4a) **thread via params** like magazine already is (emit-only, NOT in the marker) — matches precedent, keeps generate() testable, but grows the op-record [MY REC]; vs (4b) **live-read `ddcsGetSettings()`** inside generate() — leanest op-record + truest one-source, but makes generate() impure + needs test-harness settings. This sets the op-record contract → I want it ratified BEFORE building the emit change.
5. generic vs disk (callMacro=false) → **both route through tncProgram** (follows the CONFIGURED changer, not the method label); a disk changer routes to generateToolChangeNc today (no carousel) — SAME as the ⚙ button now; the carousel convergence is I5b-2b/c (collapses both callers at once). DECIDED per SCOPE GUARD.
6. tail → **drop M99/END** (body = modulo wrapper; N999 falls through to continue the cutting program). DECIDED.
7. FLAG (don't decide): post-B2 the red UNVERIFIED banner's "assumed codes" wording goes HALF-stale for inline — the CODES become user-sourced, but the SEQUENCE stays firmware-unverified. Advisor rules the wording next turn.

**BUILD PLAN once #4 is blessed (one gated pass, then byte-diff back):** add tncProgram (atcModel) + the {body} flag (both generators) → settingsPanel calls tncProgram → atc_change generic/disk callMacro=false → a new inlineTncStack = [2 comment atoms] + RAW(body lines) → thread atc/io per #4 → autoStack/diskAutoStack become dead (remove, my orphans) → re-baseline the inline goldens DELIBERATELY → hardened spec: VERIFY(1) set NON-default drawbar M-codes → inline contains THOSE codes (FAILS on the old assumed dance); (2) inline body ≡ the LIVE tncProgram output modulo wrapper; (3) default T# M6 byte-identical; (4) marker round-trips method+fixedT+callMacro:false; (5) full suite. GATE: byte-diff back before bless/release.

**NO CODE THIS TURN.** Passing back for the #4 ratification + the #7 wording call.

## 🔨 turn 251 (cycle 127) — INC-B2 BUILD: ONE EMITTER (the callMacro=false inline body → tncProgram, sources the user's ATC I/O codes). GATED emit change — byte-diff PASSED BACK for review + a MATERIAL correction to my scout's #4 premise. 595 pass / 2 skip / 0 fail (+ 6-point hardened spec; 4 inline tests re-baselined). NOT released.

**BUILT (per the ratified plan, 4a):**
- `atcModel.js`: new exported `tncProgram(atc, io, opts)` — the routing extracted from settingsPanel (atcCombo → useInterp[candidate||gripKind==='drawbar'] → motionToTnc else generateToolChangeNc). `opts.body` passes through. Imports motionToTnc + generateToolChangeNc (no cycle — neither imports atcModel).
- `atcInterpreter.js` motionToTnc + `atcGenerator.js` generateToolChangeNc: a DECLARED `{body:true}` seam — omits the O-header (interp only) + the trailing M99 (both), and rewords the standalone header comment for inline. NEVER a regex strip.
- `settingsPanel.js` atc_gen_tnc: converged to `tncProgram(atc, {outputs,inputs})` (dropped the duplicated inline routing + the 3 now-unused imports).
- `atcChangeWizard.js`: new `inlineTncStack(params)` = 2 comment atoms + `tncProgram(params._atc, {outputs,inputs}, {body:true})` split to RAW lines; generic+disk callMacro=false route to it; **firmware inline STAYS firmwareStack (the O10102 push — not the assumed dance)**; `autoStack`+`diskAutoStack` REMOVED (143 lines, my orphans; only the switch + a banner-docstring named them).
- `atcViews.js`: threaded `_atc`/`_outputs`/`_inputs` at the magazine seam (4a); banner REWORD (#7) — kept RED, now "Change SEQUENCE unverified … codes come from your Settings → ATC I/O".

**ROUTING (decision #5, ratified): tncProgram routes on the CONFIGURED changer (atcCombo({}, atc)), NOT the method label** — exactly as the ⚙ button already did (settingsPanel passed empty params too). So generic vs disk emit identically (both follow atc.grip/motion); a disk changer routes to generateToolChangeNc today (no carousel) — SAME as the button now; the carousel convergence is I5b-2b/c (collapses both callers at once).

**VERIFY — 6 hardened points (atc-inline-onesource.spec.js, vs INDEPENDENT truth):** (1) inline sources the USER codes M54/M55, NOT the assumed M154/M155 [FAILS on the old dance]; (2) inline body executable ≡ the LIVE ⚙ Generate T.nc executable, modulo wrapper — proven for BOTH routes (linear drops M99; interpreter drops O-header + M99); (3) the default T# M6 emit byte-unchanged; (4) marker round-trips method+fixedT+callMacro; (5) FRESHNESS (graft ii) — re-emit after a code change yields the NEW code; (6) reconcile over the RAW stack → CLEAN null (the reconciler keys on a #100 ASSIGN atom; the RAW body has none → hits `if(!tgt) return null`, never garbage).

**RE-BASELINED (deliberate):** atc-model:58 (premise "the model is inert / inline == old stacks" is RETIRED → now asserts firmware-unchanged + generic/disk source the user codes); atc-collet:75 (thread _atc + set #1504=5 so the new body's fetch fires M300/301/302); atc-roundtrip:39 (generic/legacyAuto/legacyDisk inline now reconcile → benign NULL, SAME declare-not-infer posture as the T# M6 default); atc-wizards:119 (banner text reword).

**⚠ MATERIAL CORRECTION to my t249 scout (integrity):** I told the advisor 4a threads params "emit-only, NOT in the marker." **That is FALSE.** `markerLine` (opSchema.js:215) serializes EVERY param key; `magazine` ALREADY lands in the export marker (empirical probe: 282 chars, pre-existing), and so do `_atc`/`_outputs`/`_inputs` (~doubles it + a full settings snapshot). IMPLICATIONS: (a) bloat is EXPORT-ONLY (the live projection stays clean — markers ride only on serializeWithMarkers); (b) file-RELOAD staleness for the CODES (an imported op re-emits the SNAPSHOTTED codes, same class as the pre-existing magazine staleness) — LIVE-session freshness HOLDS (atcViews re-threads; VERIFY(5) green). FORK surfaced at the gate: **4a (as built, matches the magazine precedent, non-breaking) vs 4b (inlineTncStack LIVE-READs ddcsGetSettings → clean marker + always-fresh even on reload, but the inline emit reads global settings). I RECOMMEND 4b** for the codes (a live-settings concern; snapshotting into the marker is the anti-pattern). A marker "_-prefix skip" does NOT work (it empties the reloaded body). ADVISOR RULES.

**NOTED (not a fork):** the m300/dustCover/confirm form toggles no longer affect the inline emit (the generator has its own fixed shape); flagged in case they should map onto the generator later.

**GATE — byte-diff + the correction in scratchpad/INC-B2-gate.md (opened in a VS Code tab).** Committed but NOT released; awaiting the advisor's #4 (4a vs 4b) ruling + bless. Then INC-D (back-compat, pins the FINAL emit) · [B] gateway verify · the reconcile scout.

## 🔨 turn 253 (cycle 127) — INC-B2b: completes B2 to releasable. (1) 4b LIVE-READ (codes out of the marker, reload-fresh), (2) fixedT GROUNDED + greyed inline (valid-by-construction), (3) dead toggles + zClear greyed. + a declared postGating `data-op-gated` contract. 598 pass / 2 skip / 0 fail. NOT released — final byte-diff passed back.

**PART 1 — 4b live-read (the marker fix):** `inlineTncStack()` now reads the changer config + I/O codes LIVE from `window.ddcsGetSettings()` (guarded for pure-Node), NOT from params. De-threaded `_atc/_outputs/_inputs` from atcViews + removed the false "not serialized" comment. RESULT (asserted): the exported inline-op marker carries NO `_atc/_outputs/_inputs` snapshot; a reloaded file re-emits the user's CURRENT codes (VERIFY(7) reload-freshness — change the live drawbar code, re-emit → the NEW code). The pre-existing `magazine` marker snapshot is the SAME disease but OUT of scope (flagged for the INC-D/marker-schema conversation).

**PART 2 — fixedT GROUNDED (DDCS truth) → grey inline (Option B):** consulted ddcs-expert + grepped the M350 dumps: **`#1504` (requested tool) is NOT in the confirmed register set — it appears ONLY in DDCS Studio's own generator/tests** (the controller populates it on Tn M6; direct-write UNCONFIRMED). `#1300` (tool-in-spindle) IS [CONFIRMED] directly writable. Per the advisor's framework ("if not legal → grey") + valid-by-construction, I did NOT emit an unconfirmed `#1504=n` preamble — I GREY the fixedT field in inline mode (never inert-and-live). It stays LIVE for the T# M6 call (the target FOLLOWS the field → `T<n> M6`, asserted). Also SHOWED the change-target row for automatic methods (was m6-only) so the T# M6 call can pick a tool. **A alternative (a #1504 preamble) is QUEUED pending a human/machine confirmation of #1504 writability — flagged at the gate.**

**PART 3 — grey the dead fields:** m300/dustCover/confirm (consumed by ZERO stacks now) + zClear (the inline body uses `atc.safeZ`) are GREYED for generic/disk via a small `gateField(id, gated, why)` helper (disabled + opacity + tooltip, mirroring formWidgets), tooltip "handled by your changer declaration + installed T.nc".

**THE DEBUGGING FIND (declare-not-handroll win):** my `gateField` set `.disabled=true` but an EXISTING declared post-gating (`ui/postGating.js`) — caps-driven, greys fields the active post can't use — ran async on `ddcs:settings-changed` and BLANKET-RE-ENABLED every control in the ATC panel (`[data-cap]`, cap ON). Traced via a setter-trap stack to postGating.js:56. Fix = a DECLARED contract, not a fight: `gateField` marks the input `data-op-gated`, and postGating's cap-ON pass RESPECTS it (skips re-enabling an op-gated field). postGating owns the CAPS axis; the op view owns per-field method/mode gating. One line in postGating; probe caps-gating unaffected (full suite green).

**VERIFY — real symptom + hardened specs:** atc-inline-onesource (7 points incl. reload-freshness); a new atc-wizards field-gating test (target FOLLOWS fixedT in T# M6, fixedT greyed inline + no T-word leak into the body, dead toggles + zClear greyed); re-baselined atc-model:58 / atc-collet:75 / atc-roundtrip:39 / atc-wizards:17 for 4b + the visible-for-automatic row. SCREENSHOTS (VS Code tabs): the dead toggles render greyed + the code preview is the inlined one-source body; the reworded RED banner renders. Full suite 598 pass / 2 skip / 0 fail.

**GATE — final byte-diff + the fixedT grounding + screenshots in scratchpad/INC-B2b-gate.md (VS Code tab). Committed, NOT released.** Release after the advisor's review (+ human eyes). Then INC-D (back-compat, pins the FINAL emit) · [B] gateway verify · the reconcile scout.

## 🔨 turn 255 (cycle 127) — INC-D: back-compat migrate-on-rebuild + round-trip tests (TEST-ONLY). Emit-level back-compat VERIFIED (3 green tests); FOUND A HOLE in the marker-cleanliness clauses (codec doesn't normalize on rebuild) → flagged, NOT patched. 601 pass / 2 skip / 0 fail.

**TESTED + GREEN (atc-backcompat.spec.js, values vs independent truth, ruling-agnostic):**
- (1a) MIGRATE-ON-REBUILD: an old marker with NO callMacro key rebuilds to the DEFAULT T# M6 call + note (oldGeneric→T2 M6, oldFirmware→T3 M6); a LEGACY mode/magType op (resolveMethod back-compat) migrates the same (mode:auto→T4 M6, +disk→T5 M6). Back-compat is functionally sound at the EMIT level.
- (2) ROUND-TRIP STABILITY: the T# M6 region is byte-identical across serialize→parse→rebuild (settings-independent); the INLINE region regenerates from LIVE settings — a drawbar-code change flows on the next rebuild (M54→M56), codes FOLLOW settings not the file text (4b at file scope).
- (3-benign) STRAY KEYS: a 4a-era _atc snapshot + a _futureField load without breaking; parseMarker rehydrates; the emit IGNORES them (fetches T7 from LIVE settings, never the stale snapshot's T99).

**⚠ HOLE (probe-confirmed; NOT patched per "if a hole NEEDS a loader change, STOP + pass back"):** `opFromMarker → makeOp` (programModel.js:110) passes parsed params VERBATIM, and `markerLine` serializes EVERY key — so the REBUILT marker is NOT normalized: **(1b)** it does NOT gain callMacro (the migration is via the emit DEFAULT, not by writing the key); **(3-clean)** it KEEPS the stray _atc/_futureField. Both are BENIGN (emit always correct on reload), but the dispatch's "marker carries callMacro / rewritten marker is clean" assertions need marker NORMALIZATION the codec doesn't do.

**FORK (advisor rules):** A = normalize on rebuild (filter to schema + defaults) → self-cleaning marker, but ⚠ FORWARD-COMPAT DATA LOSS (a newer version's field dropped by an older one). B = keep emit-migration-only (no code change; the emit-level tests prove back-compat; no forward-compat risk). C = middle (write defaults like callMacro, PRESERVE unknown keys — forward-compat-safe half). **MY REC: B (or C)** — the emit migration already makes every reload correct; "drop unknown keys" trades a cosmetic cleanup for real forward-compat data-loss risk. Full detail + the probe evidence in scratchpad/INC-D-finding.md (VS Code tab).

**GATE — TEST-ONLY commit (no source edit); the marker-cleanliness clauses DEFERRED pending your ruling.** If B → INC-D is DONE as-is (emit-level back-compat covered). If A/C → I add the marker-normalization + its cleanliness tests next turn. Then the queue: [B] gateway verify · reconcile scout · backlog.

## 🔨 turn 257 (cycle 127) — guardrail [B] gateway VERIFY-INSTALLED (the last of the human's chosen three). Scouted the seam (CLEAN) → built the T.nc install TRI-STATE in the same pass. NO emit change (pure status UI). 605 pass / 2 skip / 0 fail. Real-machine check flagged for the human.

**SCOUT (seam CLEAN → build, per the dispatch):** T.nc is a SYSDISK file → `makeClient().readSysfile('T.nc')` returns {ok, content} (the SAME read-only seam the Macros sync uses, macrosApp.js:590/704 — NEVER scraped from UI text; read-only [[live-cnc-readonly-when-away]]). Connection state = the `ddcs:gateway-status` event (bridged), broadcast by gatewayStatus.js's 5s poll. NO new bridge endpoints needed.

**BUILT:**
- NEW `ui/tncInstallStatus.js` — the DECLARED install-state (the gateway client exposes it; the view READS it, never scrapes). `getTncStatus()` → 'installed'|'missing'|'unknown' (cached); `refreshTncStatus()` = a read-only readSysfile('T.nc') check (installed = found + non-empty; missing = connected-but-absent; unknown = no gateway / error — NOT "missing"). Re-verifies on (dis)connect; broadcasts `ddcs:tnc-status`.
- `atcViews.js` — the INC-C2 amber banner (`syncChangeMacroBanner`) is now a live TRI-STATE (a `TNC_BANNER` state→style/text map + `renderTncBanner` + a `ddcs:tnc-status` listener that re-renders in place without touching display): GREEN "✓ T.nc installed on the controller — verified via the connected gateway" · RED "⚠ T.nc NOT FOUND on the controller — … does NOTHING. Generate + install it" · AMBER (unchanged) when no gateway. Kicks a read-only re-verify when it shows.

**VERIFY — MOCKED gateway (NEW tests/atc-tnc-verify.spec.js, stub /api/descriptor + /api/sysfile), asserts the banner VALUE:** GREEN (installed), RED (connected + not-found), AMBER (disconnected → today's install text, NOT the green), + a live RED→GREEN re-verify (operator installs T.nc → reconnect → flips). Existing INC-C2/C3 banner tests stay green on the AMBER default (no gateway in those tests). SCREENSHOTS (VS Code tabs): tnc-green.png / tnc-red.png render correctly.

**⚑ REAL-MACHINE CHECK FLAGGED for the human's next CONNECTED session:** the read-only readSysfile('T.nc') against a LIVE controller is unverified here (tests mock the gateway). At a powered, gateway-connected machine: open Tool Change (automatic, T# M6) → banner GREEN if T.nc installed, RED if not.

**GATE — byte-diff + scout summary + screenshots in scratchpad/INC-Bverify-gate.md (VS Code tab). PASS BACK for review.** This completes the human's three install-safety guardrails ([A] note+banner · [C] toggle · [B] gateway verify). NEXT (per NEXT-SESSION t256): the reconcile scout (priority-bumped) · then the corner backlog / UX items (toast+FAQ · help slot · version nudge).

## 🔨 turn 259 (cycle 127) — RECONCILE SCOUT (declare-not-infer fix B). SCOUT ONLY / NO CODE. Full proposal + decision table in scratchpad/reconcile-scout.md (VS Code tab).

**THE FINDING (declared params ALREADY on the block stack):** every op-container is `makeOp(opType, params, children)` = `{type:'op', opType, params:<deep-copy>, children}` (opBuilders.js:93); buildActiveOpStack wraps with `makeOp(op.type, op.params, bare)` (opSession.js:342) — so the op's DECLARED {method,fixedT,callMacro} rides on the op-container INSIDE the live block program. The atc_change reconciler (opSession.js:225) IGNORES it and INFERS the method from emit-shape (#100 / O10102 / "Manual" comment / M6-atom); a method-agnostic T# M6 (+ the new inline tncProgram RAW body) has NONE → null → the Blocks round-trip no-ops (atc-roundtrip:60/67/74/76 assert this today). `flat(prog)` KEEPS the op-container (opSession.js:306) → the reconciler already RECEIVES the params, just doesn't read them. There's even a precedent: `_replayParams` (opSession.js:43/593) — replayReconcile ALREADY sources stored params when the wizard is closed.

**SEAMS:** (i) op-container `.params` = RECOMMENDED (one-source: the op's own declared params; cheapest: already there, no emit change; generalizes: a shared declared-param helper / the existing _replayParams pattern). (ii) marker/parseMarker = REJECT (redundant — derived from the same params; markers aren't in the live block program). (iii) declared field on the block stack = converges with (i) [the op-container's params IS this]; the STRONGER form (a declared `macrocall` block instead of RAW('T# M6')) is an EMIT change → queue as A2.

**FIX = ADDITIVE declared-param FALLBACK:** keep the atom-inference branches (they recover live EDITS to the structured-atom methods m6/manual/firmware-inline) + ADD a final fallback (before `return null`) that reads the op-container params for the method-agnostic cases (T# M6, new inline). Zero regression; purest declare-not-infer where there's nothing to infer.

**THE ONE DECISION — the T# M6 tool-word edit:** reading DECLARED fixedT fixes the null but recovers the PRE-edit value; to make a Blocks T-word EDIT (T2→T5 in the RAW atom) sync, either **A1** (no emit change, RECOMMENDED) regex the T-word off the edited RAW atom (edit wins for fixedT; method/callMacro declared) or **A2** (emit change, queue) make macroCallStack emit a declared macrocall block. Recommend A1 (emit-stable; fixedT is the one editable field so parsing the user's own edit is legit, not intent-inference).

**TEST SHAPE:** roundTrip(atc_change,{method:'firmware'}) → FIELDS not null (FLIP atc-roundtrip:67); roundTrip({method:'generic',callMacro:false}) → fields (FLIP :60/:74/:76); (A1) build T# M6 fixedT:2 → edit RAW to `T5 M6` → recovers atc_change_fixedt:5; REGRESSION: m6/manual/firmware round-trips still recover their fields.

**NO CODE. PASS BACK the proposal** (seam i + additive declared-param fallback + A1). NEXT after the ruling: build fix B, or the corner backlog / UX items (toast+FAQ · help slot · version nudge).

## 🔨 turn 261 (cycle 127) — BUILD fix B: declared-param reconcile for method-agnostic atc_change (reconciler-only; NO emit change; goldens untouched). 606 pass / 2 skip / 0 fail.

**BUILT (seam i + additive fallback + A1, as blessed):**
- `opSession.js`: a shared `declaredOpParams(prog, opType)` helper — reads the op-container's declared `.params` (the reusable declare-not-infer seam any future declared-param reconciler uses). Imported `resolveMethod` (atcModel; opSession already imports wizard helpers — pocketWizard/region/contour; no cycle). ADDITIVE fallback in the atc_change reconciler (replacing the method-agnostic `return null`): read the DECLARED method/callMacro off the op-container (`resolveMethod(dp)` covers legacy mode/magType); fixedT via **A1** — the edited RAW `T# M6` word WINS (`T5 M6`→5, bare `M6`→0), else the declared fixedT (the inline body has no T# M6 line). dp null (raw leaf-parse, no op-container) → keep null.
- The atom-inference branches (O10102→firmware · "Manual" · M6+#102 · #100→generic/disk) are UNTOUCHED → m6/manual/firmware-inline still recover from ATOMS (their LIVE edits). Zero regression.

**VERIFY — REAL SYMPTOM (drove the reconcile over an EDITED block stack):** the A1 test builds a T# M6 op (fixedT:2), rewrites its RAW atom to `T5 M6` (a Blocks-tab tool-word edit), reconciles → recovers `atc_change_fixedt:5` (the edit wins) + method from the declaration; a bare `M6` → 0. Flipped atc-roundtrip 60/67/74/76 from `toBeNull()` to real field assertions (T# M6 firmware → {method:'firmware', fixedt:0, callmacro:true}; generic/legacy-auto/legacy-disk inline → their declared method+callMacro; legacy mode/magType resolves via resolveMethod). Updated atc-inline-onesource VERIFY(6) (was 'reconcile → null' → now 'recovers the DECLARED fields'). Full suite 606 pass / 2 skip / 0 fail.

**NO EMIT CHANGE** — reconciler (reverse-sync) only; atcChangeStack/macroCallStack/tncProgram untouched; goldens unchanged (the emit tests pass). The shared `declaredOpParams` seam is the declared-param-reconcile PATTERN, ready for reuse as more wizards port to declaration-driven emits.

**GATE — byte-diff (the opSession reconciler diff) in scratchpad/fixB-gate.md (VS Code tab). PASS BACK for review.** After this: the corner backlog / UX items (toast+FAQ · help slot · version nudge) — or the queued A2 (a declared macrocall block, emit change) if you want the fuller declare.

## 🔨 turn 263 (cycle 127) — CORNER VISUAL-LANGUAGE POLISH: **ALREADY DONE in HEAD** → flagged, NO code (stale re-dispatch caught).

**PREMISE CHECK (confirm-before-building):** the dispatch's 3 parts are ALL already shipped + verified on this branch — this is a stale re-dispatch of the PRE-ATC corner mainline (completed at the suite-482 era; the ATC campaign then ran the suite 482→606).

**EVIDENCE:**
- Commits IN HEAD (git merge-base --is-ancestor confirmed): **ec81ab4** "visual-language polish — circle sim-only/manual-jog marker · rainbow upward arc for manual jog · Layout handles adopt the top panel cyan=auto/amber=manual"; **a460b47** "DECLARE the per-pass reposition source from the live travelApproach"; **36783f7** (3D rainbow arc + FeatureCanvas colour-specificity); **7a809fd** sim-marker-distinguish (emits flag → filled ◆ vs hollow ○).
- The code has all 3: toolpath2d.js:197 (hollow CIRCLE sim-only) / :241 (manual jog arcs up 'rainbow'); gcodeViz3d.js:260 (hollow circle) / :784 (3D rainbow arc bows +Z); featureCanvas.js:346-362 (reposition handle cyan=auto/amber=manual via inline style so getComputedStyle wins).
- A DEDICATED spec matches the dispatch's 3 parts EXACTLY — `corner-viz-polish.spec.js`: "(1) 2D sim-only marker is a hollow CIRCLE; emitting stays a filled diamond", "(2) 2D manual jog travel arcs up (rainbow); auto travel stays straight", "(3) Layout handles adopt the top panel cyan=auto/amber=manual colour code" — 3/3 GREEN. Plus corner-source-declared (a460b47) green; corner-layout-coherence + corner-data-sim-marker-emits/-track + corner-data-repos-handle green (ran 19 corner-viz tests total, all pass).
- NEXT-SESSION.md line 106 (the status region) itself marks it "🎉 CORNER VISUAL-LANGUAGE POLISH FULLY COMPLETE" (a460b47).

**ACTION:** did NOT rebuild (redundant + regression risk on working, spec-covered code). The dispatch note itself flags the ACTUAL open item — "the PARITY-GAP #2 fork (controller-source chips) is BACK IN FRONT OF THE HUMAN" — which is likely the real next corner step once the human rules. PASS BACK: confirm the visual polish is complete (or point me at a SPECIFIC remaining gap I'm not seeing — e.g. a shape/behavior the dispatch wants CHANGED from what shipped, like emitting = numbered SQUARES vs the shipped filled diamond).
