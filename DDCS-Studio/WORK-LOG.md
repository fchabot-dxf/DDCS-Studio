
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
