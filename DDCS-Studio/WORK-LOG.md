
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

## 🔨 turn 265 (cycle 127) — CORNER-BACKLOG RECONCILIATION AUDIT (NO CODE). Full table + stale-line quotes in scratchpad/corner-backlog-audit.md (VS Code tab).

**BOTTOM LINE:** the corner mainline is ~fully DONE (line 107 "CORNER BACKLOG NOW FULLY CLOSED" HOLDS). Exactly ONE corner item is genuinely OPEN (parity-gap #2 source chips); the rest are DONE / deliberately DEFERRED / Blocks-tab port-debt.

**CLASSIFICATION (vs HEAD — code + specs + git log):**
- **DONE** — (1) STRUCTURAL-TOGGLES + rollout: 4a-4d (02dc8ca/9e1250b/9edc930/8e7a322) + corner×probeSeq 8-way (abd5b82) + Blockly structural controls (ad5028b/c0e4262; corner-structctl + corner-redivide specs); the per-toggle frontier tripwires are RETIRED (only corner-data-baked-frontier remains, holding `level` baked-final by design). (2) MULTI-HANDLE editor: ③ handles (3a8b31e) + sim-marker-track/wall-1 relTo anchor (17ee142) + prefill (0dfb395) + item-2 corner-selector GUI (corner-selector.spec + featureCanvas fc-corner-pick) — ran 19 corner-viz tests green. (3) fan-out `#17=[#19+#20]` (5448249). (8b) per-corner prefill (0dfb395) + glow merge (bae8ea9).
- **PARTIAL** — VIEWS=DATA: redivide DONE (corner-redivide; "BLOCKLY REORG COMPLETE" l186), per-view RIG blocks DEFERRED as YAGNI (l173). item-d KNOB/BINDING: structural half DONE (sc_*), VALUE-knob projection (def.bindings→pre-ticked knobs, l435) NOT built (restoreExpose is persist/restore, not projection) — Blocks-tab port-debt.
- **OPEN** — **PARITY-GAP #2 source chips** (the ONE real remaining corner item; human-approved t80, GATED on the register-verification scout, NOT dispatched — l107). DEFINITION-CHANGE→REBUILD notice (committed t36, NO code in HEAD — wizards-as-data lifecycle, l521). 2D-sim-view removal (deliberate BACKLOG, "not corner" — l12).

**REAL REMAINING corner work for a clean re-dispatch:** parity-gap #2 (register scout → wire chips) · the rebuild notice (as-data lifecycle) · value-knob projection (optional debt). DEFERRED/leave: 2D-sim-view removal, per-view RIG blocks.

**STALE LINES quoted for one-pass prune** (in the doc): l44 (4b-4d batch), l455-461 + l463-469 (probeZFirst superset / M3-vs-M2 record — already SUPERSEDED), l33 (D3 fan-out), l83 (wall-1 hint + Layout unify), l134-136 (prefill + item-2 selector). l107 stays (accurate summary).

**NO CODE, NO spec changes. PASS BACK** — the advisor prunes + dispatches the real remaining work (+ the UX interleaves: toast+FAQ · help slot · version nudge) from the clean list.

## 🔨 turn 267 (cycle 127) — ROUND-TRIP DISCOVERABILITY (the human-scoped small UX increment: toast + FAQ). NO new machinery, NO emit change. 607 pass / 2 skip.

**BUILT (reused existing patterns, per dispatch):**
- `wizardManager.js`: a ONE-TIME toast on the first wizard-op insert — `showRoundTripToastOnce()` fires from the fresh-insert branch (insert() `else`, after `commitActiveOp`/`commitDecodedCode` succeeds = the op is now an editable block stack). Persisted flag `ddcs_seen_blocks_roundtrip` → shows ONCE ever, never nags. REUSED the shared transient `toast()` (ui/gateway/util.js) — did NOT hand-roll a second toast system. Text: "This op is now an editable block stack — open the Blocks tab to edit or extend it."
- `settingsPanel.js` (set_tab_faq): a new FAQ `<details>` matching the app's format — "Can I edit a wizard op after inserting it?" → explains the editable block stack, opening Blocks, reorder/tweak/extend, and the round-trip back to the form (nothing is a dead end).

**VERIFY — REAL SYMPTOM (drove the actual insert + Settings):** new blocks-roundtrip-toast.spec (2 tests): fresh profile → insert 'drill' → the toast appears (contains "editable block stack" + "Blocks") + the flag persists ('1'); clear the toast DOM → insert again → NO toast (once-ever); the FAQ entry renders with the round-trip text. SCREENSHOTS (VS Code tabs): roundtrip-toast.png (the toast under the inserted drill G-code), roundtrip-faq.png (the FAQ entry expanded in Settings → General → FAQ). Full suite 607 pass / 2 skip (1 known middle-animator flake, retry-passes).

**NO emit change (pure UX). PASS BACK for review.** NEXT (the remaining UX interleaves per NEXT-SESSION QUEUED): the DECLARED HELP SLOT · the WEB VERSION-NUDGE TOAST · then the real remaining corner work (parity-gap #2 source-chips, gated on the register scout).

## 🔨 turn 269 (cycle 127) — WEB VERSION-NUDGE TOAST (the hosted web build can be a stale cached bundle; the exe has a banner, the web had nothing). NO new machinery (reuses toast() + updateCheck's bakedVersion/isNewer). 611 pass / 2 skip.

**BUILT (declare-the-artifact-first, per dispatch):**
- `scripts/bump-version.cjs`: now ALSO writes `web/version.json {"v":"10.xx"}` at bump time — a DECLARED, cache-bustable source (NOT the index.html chip regexed out of fetched HTML). Created `web/version.json` = {"v":"10.67"} now to match the current chip.
- `ui/updateCheck.js`: added `checkWebVersion()` — on load + visibilitychange (THROTTLED ~1/hour), `fetch('version.json',{cache:'no-store'})`, compare to `bakedVersion()` via `isNewer()`; on a newer live version → the shared `toast('V10.xx is live — reload to update.')`. Wired via `initWebVersionNudge()` called at the top of `initUpdateCheck()` (runs everywhere; the desktop GitHub banner stays exe-only below). REUSED updateCheck's own helpers + the shared toast — no new machinery.
- **EXE HARMLESS (verified by logic + the served-app check):** on the exe the relative `version.json` fetch hits the bundled copy (== baked → no toast) or 404s on an old bundle (early return) — no special-case needed.

**VERIFY:** new web-version-nudge.spec (mocked fetch, 3 tests): NEWER live version → toast names the version + 'reload'; live == baked → NO toast (exactly the exe-harmless path); throttle → two rapid checks fetch ONCE. REAL-SYMPTOM in the served app (no mock): version.json=10.67 == baked chip 10.67 → no nudge (confirmed). Full suite 611 pass / 2 skip.

**⚑ RELEASE NOTE for the advisor:** the bump now touches THREE files — `package.json` + `web/index.html` (chip+title) + `web/version.json`. version.json must ride the SAME commit as the bump (the bump script writes all three; commit them together as the release tip).

**NO emit change (pure UX/infra). PASS BACK for review.** NEXT (remaining UX interleave): the DECLARED HELP SLOT; then parity-gap #2 source-chips (gated on the register scout).

## 🔨 turn 271 (cycle 127) — DECLARED HELP SLOT scout → PROPOSE (NO CODE). Full seam table + decomposition in scratchpad/help-slot-scout.md (VS Code tab).

**FINDING: no ONE global place a `help` key can live so all 3 surfaces read it** — they span 3-4 DISTINCT declaration domains, and one surface (built-in wizard forms) is static HTML. Per the dispatch rule ("a surface with no declaration layer → propose"), I propose. But one slice IS genuinely clean + buildable now.

**SEAMS (where each declaration lives):**
- (c-i) wizard form for PORTED ops (corner) → `def.bindings` `{param,label,…}` → **renderOpForm** (formWidgets.js:373), which ALSO powers the Blocks-tab FORM PANE (blocksApp.js:371). → `b.help`→`title` = CLEAN, one source, TWO surfaces.
- (c-ii) wizard form for BUILT-IN wizards (atc_change) → STATIC index.html labels + opSchema FIELD_BIND. NOT renderOpForm → NO clean render; needs opSchema `help` + a FIELD_BIND title pass.
- (a) Blockly param-BLOCK tooltips → the atoms/knobs/sc_* blocks, NOT def.bindings; no `setTooltip` exists today → a distinct renderer (version-pinned setTooltip, blockly-skill).
- (b) settings I/O rows → the I/O TYPE CATALOG (IN_TYPES/OUT_TYPES) → renderIoTable → CLEAN but a SEPARATE domain.

**So each FIELD's help lives in ONE place (its own declaration), read by its surfaces — but there's no single GLOBAL key.**

**PROPOSED DECOMPOSITION:** 1a (CLEAN, rec) `help` on def.bindings → renderOpForm title (wizard form + Blocks-tab pane; corner seed) — one source, one renderer, two surfaces, proves the slot. 1b I/O-type-catalog help → renderIoTable. 1c Blockly block tooltips (knob/sc_* render → version-pinned setTooltip). 1d built-in static forms (opSchema help + FIELD_BIND title pass). Each hangs on its OWN existing declaration — NO parallel registry.

**RECOMMEND:** build 1a now (clean, two top-used surfaces); 1b/1c/1d as small per-domain follow-ons. The literal "3 renderers reading ONE source" isn't achievable (different declarations) — this is the honest shape. Advisor's call on scope. NO CODE. PASS BACK.

## 🔨 turn 273 (cycle 127) — DECLARED HELP SLOT 1a: optional `help` on def.bindings → renderOpForm renders it as a native title= on the field label. Corner seeded. 612 pass / 2 skip.

**BUILT (dumb + one-source, per the ruling):**
- `formWidgets.js` `labelSpan(b)`: `if (b.help) span.title = b.help;` — ONE place, EVERY widget type (number/range/select/checkbox all use labelSpan), on the field LABEL. Native title=, no positioning framework. Fields without `help` unchanged.
- `deriveBindings.js`: carry `help` through derivation (`if (s.help) b.help = s.help;`, alongside the existing label/section copies) — corner's VALUE bindings are DERIVED from CORNER_BINDING_SPECS, so the seed must survive the derive.
- `cornerData.js` SEED: real machine-meaning `help` on 8 bindings — dist / retract / f_fast / f_slow / port / radius / safeZ / scanDepth (value, via CORNER_BINDING_SPECS) + probeZFirst / travelApproach (structural, CORNER_STRUCT_BINDINGS). Strings say what the field MEANS on the machine (e.g. Safe Z = "Machine Z the probe lifts to … clear of the stock and fixtures — YOUR clearance value"), not a restatement of the name.

**VERIFY — the declared string IS the title in BOTH surfaces (new help-slot.spec):** (1) the Blocks-tab form-pane path — `renderOpForm(CORNER_BINDINGS)` (the exact blocksApp.js:371 call): the derived 'dist' binding carries the help + its label title === the declared string; a field seeded WITHOUT help (travelDist) has no help + no title (unchanged). (2) the real ported wizard form — open('user_corner_data'): the same 'Max Probe Dist' / 'Safe Z' / 'Probe Z First' labels show their declared help as title. ONE declaration → two renders, asserted in both. (Native title is hover-only → no meaningful screenshot; the specs assert the actual title value — the real symptom.) Full suite 612 pass / 2 skip.

**NO emit change (pure UX). PASS BACK for review.** NEXT per the ruling: 1b (I/O type catalog → renderIoTable), then 1c (Blockly setTooltip). 1d waived (static built-in forms dissolve as wizards port onto renderOpForm).

## 🔨 turn 275 (cycle 127) — DECLARED HELP SLOT 1b: help on the I/O TYPE CATALOG → renderIoTable row-label tooltip (the Setup surface). 614 pass / 2 skip.

**BUILT (same dumb native pattern as 1a; the type catalog is its OWN declaration domain):**
- `ioTable.js`: added optional `help` to the TYPE CATALOG entries (INPUT_TYPES + OUTPUT_TYPES). `renderIoTable` sets `name.title = typeDef.help || <the plain rename hint>` on the row-label input — the type help when present, else the unchanged rename hint (types without help are untouched).
- SEED (ATC-relevant + a few, real machine-meaning): drawbar ("ON RELEASES/unclamps, OFF CLAMPS — the ATC change pulses this"), dustcover (open before / close after), coolant (M8/M9), rotate (carousel indexes the pocket to the pickup); sensor ("a digital input the program WAITS on — the ATC change waits on drawbar released M301, clamped M302, spindle stopped M300"), probe (G31 trigger), touch/limit. What the pin DOES, not a name restatement.

**VERIFY — the declared string IS the row tooltip (new help-slot-io.spec):** drive renderIoTable directly (the exact renderer the Settings I/O table uses) — a drawbar output row's label title === the declared drawbar help (contains "RELEASES"); a `custom` type (no help) keeps the plain "edit to rename" hint. A sensor input row's title names the ATC waits (M301 + spindle stopped M300); `estop` (no help) unchanged. Full suite 614 pass / 2 skip.

**NO emit change (pure Setup UX). PASS BACK.** NEXT per the ruling: 1c (Blockly setTooltip — the version-pinned tooltip API, blockly-skill discipline) — then the help-slot batch (1a+1b+1c) releases as ONE milestone.

## 🔨 turn 277 (cycle 127) — HELP SLOT 1c (Blockly tooltips) scout → PROPOSE (NO CODE). Full finding in scratchpad/help-slot-1c-scout.md (VS Code tab).

**Not a one-liner — both halves hit the dispatch's "read from the declaration, never duplicate" against the campaign's existing layering + one-source-via-assertion patterns.**

**MECHANISM (grounded):** Blockly is 13.0.0 (VERSION + API-NOTES; the blockly-skill known-projects note is STALE at 12.5.1 — flag). Tooltips already flow via the declarative JSON `tooltip` key in bridge.js jsonDef (block-level "<label> (<category>)" + per-field getDesc(f)). getDesc is a GENERIC field-name→description map, NOT the binding's help. setTooltip is a stable v13 Block method (plain string), but the JSON key is the existing reuse point.

**(a) sc_* controls — FORK:** structCtl.js HAND-DECLARES the sc_* defs mirroring CORNER_STRUCT_BINDINGS, asserted-to-match by corner-structctl.spec (param/options/kind/label). It DELIBERATELY doesn't import corner data (layering: generic ops ≠ corner-specific). So help = (A) hand-declare + assert-match (consistent with the label pattern; assertion = no-drift; but duplicates the string, against the rule) vs (B) import CORNER_STRUCT_BINDINGS live (no duplication; but a layering violation the file avoids). Dispatch-rule vs file-design.

**(b) knob/param — BLOCKED on the surface existing:** the atom-block field tooltip is getDesc (generic); linking a knob's PNAME → CORNER_BINDINGS[pname].help is another layering cross; and corner's value params are NOT pre-ticked as knobs today (value-knob projection is OPEN, t265) → NO default corner knob block to tooltip. The VERIFY's "corner knob/param block tooltip" has no surface yet.

**PROPOSAL:** (1) fix the blockly-skill note 12.5.1→13.0.0. (2) sc_* half: rule (A)/(B) — I lean A (matches the blessed hand-declare+assert; the assertion IS the one-source guarantee, honoring the SPIRIT of no-duplication without breaking layering); seed help on all 6 structural bindings + assert. (3) knob/param half: DEFER until the value-knob projection lands (no surface today), OR re-scope to the first-class `param` block type. REC: build sc_* now (via A), defer knob/param with the value-knob projection. NO CODE pending the ruling. PASS BACK.

## 🔨 turn 279 (cycle 127) — HELP SLOT 1c-sc: Blockly canvas tooltips for the sc_* structural controls (Option A). CLOSES the 1a+1b+1c batch. 616 pass / 2 skip.

**BUILT (Option A — hand-declare + assert-match, the file's blessed one-source pattern):**
- `cornerData.js`: seeded help on the remaining 4 structural bindings (wcs / syncA / corner / probeSeq; probeZFirst + travelApproach seeded in 1a) — all 6 CORNER_STRUCT_BINDINGS now carry real machine-meaning help.
- `structCtl.js`: the bool/enu sc_* def helpers gained a `help` arg; hand-declared the same 6 help strings on the sc_* defs (MIRRORING CORNER_STRUCT_BINDINGS 1:1 — structCtl.js deliberately does not import corner data, the layering; the assertion is the one-source guarantee).
- `bridge.js` jsonDef: block-level `tooltip: def.help || "<label> (<category>)"` — a def with declared help uses it as the block tooltip (the plain-string form v13 applies via setTooltip during jsonInit); a def WITHOUT help keeps the default.

**VERIFY — extended assertion + the rendered control (corner-structctl.spec):** (1) the def-match assertion now covers HELP too (label/options/kind/default/help) — sc_* help === CORNER_STRUCT_BINDINGS help, so it can't drift. (3b) NEW — opened corner in Blocks (real workspace, __blkws): each rendered sc_* control's `getTooltip()` IS its declared structural help (probeZFirst / wcs / corner asserted); a no-help atom block keeps the default "<label> (<category>)" tooltip and is NOT any help string (unchanged). Full suite 616 pass / 2 skip / 0 fail.

**DEFERRED (advisor ruling): the knob/param half** — no surface yet (corner value params aren't pre-ticked knobs; the value-knob binding-projection is OPEN, tracked in the t265 audit); it rides that projection later. **The DECLARED HELP SLOT batch (1a form + 1b Setup I/O + 1c Blockly sc_*) is COMPLETE + one-source across three surfaces from three declaration domains, all via the SAME declared help key.** NO emit change throughout. **BATCH READY — advisor releases the tooltips milestone.** PASS BACK.

## 🔨 turn 281 (cycle 127) — VALUE-KNOB PROJECTION scout → PROPOSE (NO CODE). Design-heavy: the pre-tick is trivial, but it amplifies a confirmed lossy-save clobber. Full table + diagram in scratchpad/value-knob-projection-scout.md (VS Code tab).

**THE DEBT (t265):** corner's declared VALUE bindings (dist/retract/f_fast/f_slow/port/radius/safeZ/scanDepth) should pre-tick as knobs on the Blocks canvas. Today augment() grows an expose row per numeric field but leaves every EXPOSE_ FALSE; restoreExpose only re-applies a PERSISTED user exposure — nothing reads def.bindings to pre-tick the declared knobs.

**MECHANICALLY TRIVIAL (~15 lines):** projection is the INVERSE of collectAuthoring (which already turns ticked knobs into exposures {param,blockIndex,key,widget}). The atomBlocks[i] to flat[i] index alignment already exists. So pre-ticking from def.bindings is easy.

**THE HAZARD (why NOT a clean build) — the dev-mode SAVE path is LOSSY for a rich def, CONFIRMED EMPIRICALLY this turn:**
- corner = def.bindings (rich: relTo/when/group/role/socketHeld/section/help/sourceField) + def.bindingSpecs (re-derive value sockets BY IDENTITY — the whole M2 mechanism).
- Save to Update: collectAuthoring to buildBindings produces PLAIN {param,blockIndex,key,type:number,default,label} — all the rich metadata STRIPPED. userOpFromStack does NOT set bindingSpecs (grep-confirmed). updateUserOp does defs[i]=def (REPLACE, no merge — confirmed).
- So hitting Update FLATTENS corner's def, DROPPING bindingSpecs + every piece of the campaign's structural metadata — the exact lossy-hand-rolled-path divergence the campaign exists to prevent.
- This clobber is PRE-EXISTING (dev-saving corner today already degrades it), but projection AMPLIFIES it: pre-ticked knobs signal these are editable/saveable, turning a latent footgun into a prominent one.

**THE 3 RECONCILE QUESTIONS (the dispatch asked):** (1) which pre-tick = the value bindings (blockIndex+key to a numeric/inline field); sc_* already handled. (2) exposure vs binding reconcile = agree at LOAD, but the save reads exposures back LOSSY and overwrites the rich declared bindings — conflict. (3) does a knob edit round-trip to the form? For a rich def NO, it DEGRADES it (loses the rich metadata + bindingSpecs).

**ALSO:** corner's value params are ALREADY surfaced+editable in Blocks TODAY via the form pane (renderOpForm(def.bindings), blocksApp.js:371). The FUNCTIONAL gap is already covered — the only real gap is the CANVAS expose-rows don't visually MARK the declared knobs.

**FORK (advisor rules):**
- **A (REC) — project + make Update SAFE:** pre-tick value knobs as a REFLECTION + GUARD the Update path for a bindingSpecs def (MERGE knob deltas into the existing rich def preserving bindingSpecs/metadata, OR REFUSE to flatten with a clear message). Correct; closes the pre-existing clobber footgun; the knobs then exist so it folds in the DEFERRED knob-help tooltip (PNAME to binding.help). Biggest — needs a lossless-merge/block Update path = a real design piece.
- **B — pre-tick only, no save change:** tiny + literal, but SHIPS THE FOOTGUN (pre-ticked knobs invite Update to flatten the rich def). REJECT.
- **C — defer/re-scope:** the form pane already does the functional job; the knob path is for hand-authored/simple wizards, not rich bindingSpecs defs; leave projection unbuilt. Zero regression risk; the visual-consistency gap + knob-help tooltip stay open.

**REC: design-heavy, do NOT ship B. Lean A scoped as (1) read-only reflection pre-tick, (2) the Update guard for a bindingSpecs def (the load-bearing safety piece — a real latent bug regardless of projection), (3) fold in knob-help tooltip. If keeping the increment small, C (defer) is the honest fallback — the campaign's re-authoring vision is better served by editWizardDef (loads the TEMPLATE with pills) + a bindingSpecs-preserving save than by the lossy knob path. NO CODE. PASS BACK.**

## 🔨 turn 283 (cycle 127) — RICH-DEF UPDATE GUARD (SPLIT-A part 1): a bindingSpecs def REFUSES the dev-mode visual Update (block-with-message). Projection + knob-help DEFERRED per the ruling. 618 pass / 2 skip.

**THE INVARIANT, DECLARED ONCE:** `isMaintainedAsData(def)` = `bindingSpecs` present + non-empty (exported from devMode.js). One rule, read by BOTH the dialog (disable Update) and the commit chokepoint (refuse Update). corner is the only such def today; any future bindingSpecs port inherits the guard for free.

**WHY (the hazard the t281 scout confirmed):** the visual Update runs collectAuthoring→buildBindings (flattens the rich bindings to plain {param,blockIndex,key,default}) → userOpFromStack (does NOT set bindingSpecs) → updateUserOp (defs[i]=def, REPLACE). So an Update would silently STRIP bindingSpecs + relTo/when/group/role/section/help/sourceField — the campaign's entire M2 derive mechanism. Block it; Save-as-new (a copy) is already the non-destructive path.

**BUILT (devMode.js only — pure save-flow, NO emit path touched):**
- `isMaintainedAsData(def)` predicate + export.
- `saveAsCustomOp`: compute `lockUpdate = isMaintainedAsData(editingDef)`; pass to the dialog; and a belt-and-suspenders commit guard — `if (update && lockUpdate) { alert(WHY); return; }` (the true data-level chokepoint).
- `openSaveDialog`: when editing + `lockUpdate` — the Update button renders DISABLED (title = the WHY) and the edit-note swaps to "…is maintained as data — Update would strip its data-driven parameters, so it's disabled. Save as new keeps the original and saves a copy." Save-as-new stays the accent/suggested action. Non-locked editing is UNCHANGED.

**VERIFY — REAL SYMPTOM (new rich-def-update-guard.spec, drives the actual dialog via ddcsEditWizardDef + ddcsSaveAsWizard):** (1) corner (bindingSpecs def): the Update button IS disabled + the note contains "maintained as data" + Save button reads "Save as new"; clicking Save-as-new creates a SECOND op AND the original user_corner_data def is BYTE-UNCHANGED (JSON identical, bindingSpecs intact) — the copy is a plain op (no bindingSpecs, the very reason Update is blocked, asserted). (2) a PLAIN user op (param-pill, no bindingSpecs): Update button ENABLED + no "maintained as data" note — the guard is scoped to bindingSpecs defs only, doesn't over-block. Existing gui-blocks-reauthor (plain-op Update-in-place) still green. Full suite 618 pass / 2 skip / 0 fail.

**DEFERRED per the ruling (SPLIT-A part 2): the value-knob PROJECTION + knob-help tooltips** — to the next Blocks-canvas investment (the form pane covers function today; C's logic accepted). merge-preserve rejected as speculative (Save-as-new already IS the non-destructive path). B (pre-tick-only) rejected as a footgun. NO emit change. PASS BACK.

## 🔨 turn 285 (cycle 127) — DEF-CHANGE → REBUILD NOTICE scout → PROPOSE (NO CODE). Decision table + N1..N3 in scratchpad/def-change-rebuild-scout.md (VS Code tab).

**THE REFRAME (load-bearing finding):** import ALREADY rebuilds forward-only. importMarkedNc (programModel.js:118) runs opFromMarker(rec.opType, rec.params) = makeOp with the CURRENT builder + saved params, and DISCARDS the file's emitted body (the while-not-marker skip). So a stale-def file, on import, is ALREADY silently regenerated to the latest def's output. → The feature is NOT add-a-rebuild (the rebuild exists); it's TRANSPARENCY (tell the user their toolpath was upgraded) + PARAM SAFETY (renamed/removed params silently dropped by the forward rebuild). The def-version stamp makes both detectable.

**PERSISTENCE REALITY (verified):** markers materialize ONLY on export (editorManager:188 serializeWithMarkers) + read on import (commandDeck:127 importMarkedNc). NO marked autosave of the live program. So the detect point is import; the live stack has no markers.

**TWO STALENESS SURFACES:** S1 IMPORT a saved .nc under an old def (marker.defV < current — a LOOKUP not a diff; the primary, universal case; already the rebuild chokepoint). S2 RE-AUTHOR in-session (updateUserOp) — plain user ops only (the t283 guard blocks bindingSpecs re-author via dev-save); needs an op-CONTAINER defV stamp since the live stack has no marker. Corner only goes stale across a RELEASE (S1), refreshed by seedDefaultPortedUserOps on the next boot.

**5 POINTS:** (1) stamp = def.defV int (default 1), author-declared in code (like MARKER_VERSION but per-def; auto-inc on updateUserOp for user ops); NOT a body-hash (inference+churn); markerLine stamps rec.defV, parseMarker reads it. (2) detect = import primary + op-open lazy; not render. (3) surface = opt-in banner (reuse toast/pull-review modal); rebuild = reuse opFromMarker (INC-D forward-only, atc_change round-trip already asserts it); derived-region invariant holds so safe-by-construction. (4) migration = DECLARED per-def per-version-step map applied oldV to currentV; fork 4a fn-per-step (rec, expressive) vs 4b flat rename table vs 4c {renames,drops,compute}; sparse (only rename/remove versions). (5) interplay: seed-refresh keeps the LIBRARY def current, rebuild-notice keeps PLACED INSTANCES current — one story; isMaintainedAsData SPLITS the populations (code-bump+seed for maintained-as-data vs updateUserOp-bump for plain), stamp/detect/regenerate is ONE path.

**DECISION TABLE (5 forks: A bump-trigger, B detect-point, C notice-UX, D migration-shape, E scope) + INCREMENTS N1 stamp foundation / N2 detect+transparency notice (additive-only, the universal 80%) / N3 migration map (rule-of-three, when a rename lands) / S2 optional later.** REC: ship N1+N2 first (small, rides the existing import-rebuild + toast); migrations + S2 are declared follow-ons.

**NO CODE. Advisor rules the table. PASS BACK.**

## 🔨 turn 287 (cycle 127) — DEF-CHANGE → REBUILD NOTICE, N1+N2 (as ruled): the defV stamp + import-time staleness detect → transparency notice. 620 pass / 2 skip. NO golden re-baseline needed (see below).

**N1 — the declared per-def version stamp (ruling A: declared int, NEVER a body-hash):**
- `def.defV` (int). `createUserOp` defaults a fresh def to 1. `updateUserOp` AUTO-INCREMENTS only an UNDECLARED incoming def (a dev-save re-author via userOpFromStack sets no defV → its placed instances are now stale → bump past the stored version); a DECLARED defV (a code seed / author-maintained) is respected as-is. The distinguishing signal is declared-vs-undeclared, NOT isMaintainedAsData (drill/slot/surfacing/text/atcWarmup are PLAIN seeds — only corner is bindingSpecs — so isMaintainedAsData would wrongly boot-bump them). seedDefaultPortedUserOps sets a floor `def.defV ??= 1` so seeds ALWAYS arrive declared → updateUserOp respects them → no boot-bump (verified by the re-apply test).
- `defVOf(opType)` (userOps): the registered user-def's defV, or 0 for a built-in/unversioned op (never stale).
- `markerLine(opType, params, defV)`: stamps `rec.defV` LAST, only when > 0 (additive payload key; format MARKER_VERSION untouched — old readers ignore it, so no format bump). `parseMarker` reads defV back (absent → 0 = legacy) and excludes it from params (reserved key).

**N2 — import-time detect (ruling B/C: import-primary, transparency-first, non-blocking):**
- `staleMarkedOps(text)` (programModel, PURE): a LOOKUP — for each marker, `rec.defV (was) < defVOf(opType) (cur, >0)` → `{opType,label,fromV,toV}`. Built-ins (cur 0) never flag. `defChangeSummary(stale)` = the one-line message naming each op + version jump.
- `commandDeck` file-open: after importMarkedNc + loadBlockStack, run staleMarkedOps → if any, ONE `toast(defChangeSummary)`. Best-effort (never blocks the load). Import ALREADY rebuilds forward-only (opFromMarker, the file body discarded) — so the notice is pure TRANSPARENCY, no rebuild path added. keep-as-plain escape SKIPPED (not trivial — import discards the body by design; noted for later).

**VERIFY — REAL SYMPTOM (new def-change-notice.spec, drives the actual import functions):** (1) fresh user def stamps v1; an author-declared bump to v2 is respected. (2) v1 marker vs current v1 → staleMarkedOps [] (no notice). (3) after bump to v2 → staleMarkedOps [{user_vtest, VTest, fromV:1, toV:2}] + summary contains "VTest v1→v2"; importMarkedNc rebuilds from the CURRENT builder (a deliberately-bogus X999 file body is DISCARDED — forward-only asserted). (4) legacy marker with NO defV → fromV:0 (v0), flagged once, no crash. (5) a built-in (no user-def) marker → never flags. Plus test 2: an undeclared re-author auto-incs (1→2); a declared defV=7 respected; re-apply doesn't drift (no boot-bump). Full suite 620 pass / 2 skip / 0 fail.

**⚑ GOLDEN NOTE (deviation from the dispatch's expectation, FLAG):** the ruling anticipated re-baselining marker-line goldens — turned out UNNECESSARY. defV stamps ONLY versioned USER-op markers (defVOf>0); the only literal @DDCS marker golden asserts `op:"atc_change"` (a BUILT-IN → defVOf 0 → unstamped), and the corner specs assert params/emit not raw marker lines. So ZERO goldens changed — the stamp is well-scoped (less churn, less risk). No re-baseline performed because none was needed.

**DEFERRED (per E/D): N3 migration map (declared per-step renames/drops + fn escape) at rule-of-three when the first rename lands; S2 in-session re-author detect (op-container stamp). NO emit change (marker payload + import UX only). PASS BACK for review.**

## 🔨 turn 289 (cycle 127) — SOURCE-CHIPS REGISTER SCOUT (parity-gap #2, NO CODE). Registers ALL VERIFY + a premise finding: the chips are ~90% BUILT + GREEN. Full table + fork in scratchpad/source-chips-register-scout.md (VS Code tab).

**(1) REGISTER VERIFICATION — safe-Z #69 discipline, ALL 4 CONFIRMED macro-referenced in the Expert ground-truth slib-g.nc (not just named in eng/cfg):** port #1078 (Pr578) — `IF #1078!=0 GOTO36` + `#26 = #1078` (floating probe port); level #1080 (Pr580) — `#28 = #1080` (load); fastFeed #632 (Pr132) — `#22 = #632` (the cfg-vs-macro-var red herring resolved: used as a VALUE); retract #640 (Pr140) — `G91G0Z#640` (a real MOTION, strongest reference). Registers live in the profile's probeVars (controllerProfiles.js). No name-only field.

**(2) PER-PROFILE:** Expert declares all 4 (+setter*). V4.1/Generic probeVars={} → probeSrcAvailable false → NO chip, plain literal, graceful+correct. DM500 has #70/#2011/#75 but the profile itself says "verify these" — UNVERIFIED, not corner-scope, leave as-is.

**(3) DELIBERATE LITERALS:** port/fastFeed/retract literals are opt-in-overridable (SRC_BY_PARAM, cornerData:305). level DELIBERATELY BAKED (excluded) — established decision; it IS verified controller-resident (#1080) so a future opt-in is sound, but current scope keeps it literal (scoping choice, not a gap).

**⚠️ PREMISE FINDING (confirm-before-building) — parity-gap #2 is ~90% BUILT + GREEN, do NOT rebuild:** EMIT done (applyProbeSources via postInstantiate rewrites #5/#3/#2 via srcVal/srcNote; byte-identical when studio/non-Expert). FORM LOCK+PROVENANCE done (formWidgets.js:57-58 greys the input + Pr tooltip when ctrl — the Option-A gate-and-grey). SPEC GREEN (corner-source-chips.spec, 2 tests, in the 620-green suite: emit #5=#1078+Pr578/#3=#632/#2=#640 + Generic-literal + studio byte-identical; form greyed+Pr578 tooltip when ctrl).

**(4) MECHANISM MAP — THE RESIDUAL GAP:** built-in (probeSrcGlyph decorateProbeSrc/decorateInput via view.probeSrcFields) inserts an ALWAYS-PRESENT clickable radio-DOT (hollow=studio, filled=ctrl) that INLINE-TOGGLES the source. Data-op (formWidgets:57-58) only greys+tooltips when ALREADY ctrl — NO glyph, NO inline toggle, routes flipping to Settings. So the residual = the data-op form lacks the built-in's source AFFORDANCE (the dot) + inline toggle. sourceField is already the declared key (the 1a labelSpan precedent shape).

**(5) SEMANTICS:** built-in = provenance + value LOCK (both). Data-op already = lock + provenance-tooltip. Open question is only the INLINE TOGGLE (dot vs Settings). State is a global per-field setting shared by both surfaces.

**FORK: A close the residual = render decorateInput's dot in renderOpForm for sourceField bindings (true built-in parity; small refactor — decorateInput takes an id today, needs an element entry; + a postGating flag: formWidgets uses disabled, postGating re-enables [data-cap] — prefer readOnly/data-op-gated). B accept current state as parity (emit+lock+provenance ship; document Settings-routed toggle; declare #2 CLOSED). REC: LEAD with the premise finding — this is NOT the register-wiring the dispatch implies; registers all verify; the only residual is the inline dot/toggle. A if the human wants true built-in parity (corner = PERFECT), else B. NO CODE. PASS BACK.**

## 🔨 turn 291 (cycle 127) — SOURCE-CHIPS parity (Option A): the inline source DOT in the data-op form. CORNER = PERFECT gate. 621 pass.

**BUILT (reuse the built-in's exact glyph, per the ruling — true parity, not a parallel mechanism):**
- `probeSrcGlyph.js`: extracted `decorateInputEl(input, field, opts)` (element-based) from `decorateInput` (which now delegates — the built-in path unchanged). `applyState` gained a `gate` flag: when locking a data-op field it stamps `data-op-gated` (the t253 contract — postGating re-enables `.disabled`, so the lock uses `readOnly` + this attr, NEVER disabled). Also switches a number input to type=text while locked so it can DISPLAY the runtime var (#1078) — the built-in's documented "shows the var" intent (shared, harmless for text inputs; restored on unlock).
- `formWidgets.js`: dropped the ad-hoc disabled+opacity greying in numberWidget; added a `renderOpForm` POST-PASS — for each binding with `sourceField`, `decorateInputEl(inp, field, {gate:true})`. Uniform across widget types, mirrors the built-in's decorateProbeSrc post-pass. The dot appears only when the profile has the register (probeSrcAvailable).

**HOW THE TOGGLE PROPAGATES:** click the dot → `setProbeSrc` → saveSettings broadcasts `ddcs:settings-changed` → wizardManager.update() re-renders + re-generates → applyProbeSources (already built) picks up the new source → the EMIT follows. The setting is the SAME global per-field state the built-in shares, so a flip in either surface follows everywhere.

**VERIFY — REAL SYMPTOM (extended corner-source-chips.spec):** test 1 (emit) unchanged/green. NEW: (a) the dot is present on the 3 sourced fields (port/f_fast/retract), ABSENT on a non-sourced field (f_slow); studio = editable + unlit + not gated. (b) clicking the port dot flips to ctrl → the field locks via readOnly + data-op-gated (NOT disabled, asserted) + shows #1078 + the dot lights + the glyph names Pr578 + the EMIT rebuilds to #5=#1078 (follows the toggle). (c) Generic profile → NO dot (graceful). Full suite 621 pass / 2 skip / 0 fail (built-in path unregressed; studio byte-parity held by test 1).

**SCOPE NOTE:** corner sources 3 fields (port/f_fast/retract) — the dispatch said "4"; level is the 4th VERIFIED register (#1080) but stays BAKED by the established decision (SRC_BY_PARAM excludes it), so it correctly gets no dot. All 3 sourced fields get the dot. **CORNER = PERFECT gate — on bless, the porting fan-out begins. NOTE: rides the same tree as the advisor's probe-dims merge (c482153) — same release. PASS BACK.**

## 🔨 turn 293 (cycle 127) — START-MARKER VISUAL LANGUAGE, UNIFIED ACROSS ALL WIZARDS + BOTH SURFACES (human-directed, live). Dispatch was "label 2 corner Layout markers" → the HUMAN expanded it to a full one-glyph-language unification. 623 pass / 2 skip. NODE_MODULES was externally WIPED mid-turn + reinstalled.

**⚑ SCOPE (for the advisor): this GREATLY exceeded the t292 dispatch, all HUMAN-directed live in the worker window + confirmed step-by-step.** The dispatch: label the cyan '1 pos' square + the bare hollow circle on corner's Layout. The human, testing live, ruled the 3D preview and the Layout used DIFFERENT glyphs/labels for the SAME markers ("never was supposed to be different") and directed ONE language everywhere, for EVERY wizard (not a corner override).

**THE AGREED LANGUAGE (human-confirmed table):**
- SHAPE + COLOUR agree: **AUTO reposition (machine drives there) = a filled CYAN SQUARE ■; MANUAL jog / the operator START = a filled AMBER CIRCLE ●.** Under manual travel every reposition marker becomes an amber circle.
- **The first start (pass 0) is ALWAYS the operator's jog → the amber-circle "Start"** (by pass INDEX, so it doesn't touch the declared per-pass SOURCE data → corner-source-declared's pass-0='auto' assertion is untouched).
- **3D preview + 2D toolpath (top panel): glyph + colour ONLY, no text** (the numbered ①② badges are gone — 3D sprite number-sprite + 2D badge both removed).
- **2D Layout canvas: glyph + colour + a LABEL** — `Start` for pass 0, the destination PASS NUMBER (1, 2…) for each reposition. The generic `pos` label + the redundant `n:1` anchor-dot number are gone (the dot stays for non-corner point widgets, just without the number).
- corner-datum pick circles stay unlabeled (prior human call).

**BUILT (pure preview — the emit is byte-IDENTICAL; nothing touches a builder):**
- `viz/gcodeViz3d.js`: `_startGlyphTex` emitting diamond→SQUARE + the sim circle FILLED; `_makeMarker` drops the number sprite (`_makeNumberSprite` kept — still used for ATC pockets); `_highlightSelectedStart` colours+shapes by `manual = (p===0) || src==='manual'`.
- `viz/toolpath2d.js`: `drawStartHandles` diamond→square + filled circle, dropped the numbered badge; `manual = (i===0) || startSources[i]==='manual'`.
- `viz/featureCanvas.js`: merged the sim/move branches into ONE start-marker rule — `startManual = h.simOnly || col==='#ffb300'` → amber filled circle, else cyan filled square (the drill/point handles untouched).
- `wizards/ops/panelTypes.js`: the sim-only Layout marker → `label:'Start'`, `manual:true`, amber; the emitting reposition handle → `label = destPass number` (was 'pos') + `manual` flag; the anchor hole keeps its dot but drops `n:1` (no redundant '1').

**VERIFY — full suite 623 pass / 2 skip / 0 fail.** New `corner-marker-labels.spec` (labels: Start + pass number, no 'pos'; the Layout renders an amber circle Start + a cyan square reposition). RE-BASELINED the OLD diamond/hollow specs to the new language: `corner-viz-polish` (1)+(3), `corner-data-sim-marker-emits` (C, repurposed to prove colour follows SOURCE not emits), `corner-data-sim-marker-track` (3), `marker-colour-by-source` (pass-0 Start=amber, later passes by source). corner-source-declared UNCHANGED (pass-0 source data still 'auto'; the amber Start is an index-rule in the renderers, not a source change). Byte-parity held by the existing emit specs (corner-source-chips etc.). Screenshot: scratchpad/markers-after.png. The human live-verified throughout.

**🔴 STILL OPEN (human flagged, NOT yet fixed — the NEXT item): "moving start moves the other marker, i dont want that."** Dragging the Layout Start re-derives the whole chain (the reposition markers are G91 increments relative to pass-0, so they ride the moved root — the deliberate t120 "undragged handles ride the root" behaviour). The human wants dragging Start to move ONLY the Start, leaving the probe markers put. Separate from this visual change; to be scoped/fixed next.

**⚑ ENV: node_modules was WIPED mid-turn (0 entries — external/concurrent, not my edits) → `npm ci` restored it; suite re-run green after.**

## 🔨 turn 293 (cont.) — START-DRAG INVESTIGATION + a CONFIRMED next feature (DEFERRED to the advisor per the human). NO code beyond the committed visual-language unification (3f1c835).

**HUMAN-FLAGGED (live, testing the new markers): "moving start moves the other marker, i dont want that"** — dragging the Layout Start (amber circle) moves the reposition (cyan square) with it.

**BISECT — NOT a regression I introduced (verify-real-symptom).** Checked out the PRE-EDIT viz files and ran the identical real-pointer drag: the reposition moved 55px BOTH before AND after my visual change (byte-identical behaviour). So the coupling is PRE-EXISTING (the t107/t120 machine-faithful chain: the reposition preview is anchored to pass-0 = the jog-in Start, so it rides the dragged Start). My edit only made the markers bolder/clearer → the human noticed it now. It is PREVIEW-ONLY today (the Start is sim-only, never emitted; #23/#24 unchanged; byte-parity held — the human confirmed "might be simulation only").

**HUMAN RESOLVED the machine-semantics question (they own the macro):** the corner reposition #23/#24 is measured **FROM THE JOG-IN START** (not the probed wall-1). Therefore the human wants: **dragging the Start should RECOMPUTE #23/#24 = (wall_target − Start)** so each wall marker STAYS on its stock target while the Start moves — "yes recompute." **This CHANGES THE EMIT** (#23/#24 becomes a function of the Start position) → it is NOT preview-only, and it REVERSES the deliberate t120 decision ("the Start drag must stay a PURE preview move; it must NOT capture").

**THE FEATURE (well-scoped for the advisor to plan) — extend the EXISTING t120 capture-and-derive to the Start drag:**
- Mechanism already present: `spotOnDrag` (panelTypes.js:196-205) freezes an emitting group's WORLD into `spotStore` and the derive (panelTypes.js:174-179) recomputes its G91 increment = world − anchor + WRITES it to the param (#21-#24). Today this fires ONLY when dragging an EMITTING handle; the SIM_ID (Start) branch of `wrappedOnDrag` (panelTypes.js:236-241) deliberately does NOT capture.
- The edit: on the SIM_ID branch, BEFORE `simStart.onDrag`, capture EVERY `repoGroups` world into `spotStore` (freeze the walls), then move the Start. The empirical bisect confirms the reposition anchor already FOLLOWS the dragged Start → so the derive recomputes #21-#24 = frozen-world − Start-shifted-anchor → wall markers hold, offsets adapt.
- **Design/risk points for the advisor (why it's a gate, not a quick edit):** (1) it CHANGES emitted #21-#24 on a Start drag — confirm the macro truly wants the offset re-derived from the jog-in (the human says yes). (2) byte-parity MUST hold at the DEFAULT (no drag → no captured spot → default increment). (3) probeZ-ON has TWO emitting handles (#21/#22 wall-1 + #23/#24 wall-2) that CHAIN — capturing both must stay coherent. (4) the 8 corner×probeSeq combos. (5) top-panel vs Layout consistency (the param write flows to both). (6) it reverses the t120 rationale — update that comment/decision. **Verify: a real-pointer-drag spec (wall marker stays put + #21-#24 recompute + emit byte-identical at default), across combos + both probeZ states + both surfaces; adversarial edge cases.**

**NOTE for the advisor:** the whole t293 line massively exceeded the "label 2 markers" dispatch — the human live-directed a full start-marker visual-language unification (shipped 3f1c835, 623 pass) + this recompute feature. Also: **node_modules was externally WIPED mid-turn + I `npm ci`-restored it.** The human said to defer the recompute to the advisor.

## 🔨 turn 293 (amendment reconciliation) — the advisor's mid-task amendment CONFLICTS with the human's LIVE direction. FLAGGED, not silently applied (gate discipline).
- **AMENDMENT (advisor, relaying human):** "the pos square marker must NOT be labeled pos — label it with its XYZ VALUES (matching the jog-pendant Pos fields)."
- **BUT the human, LIVE in the worker window, directed + AskUserQuestion-CONFIRMED a DIFFERENT scheme:** the square gets its PASS NUMBER (1,2…), the circle gets 'Start' ("Start + numbered walls" → "thats it yes"), within the full auto/manual square/circle + cyan/amber unification (shipped 3f1c835, 623 pass). The amendment predates that live session (it targets the old 'pos' state).
- **RESOLUTION: left the shipped pass-number scheme intact (human-confirmed + committed + green); did NOT re-apply the XYZ-values label.** The human issued TWO different label directions through TWO channels — advisor+human must reconcile: **pass NUMBER (shipped) vs XYZ live-coordinates (amendment).** The XYZ idea ties to the pendant Pos fields + the bidirectional next task, so the label content is really part of THAT feature.
- **"two markers labeled 1" ghost (amendment note):** I DID remove the redundant hole-number (the anchor dot kept, its 'n:1' dropped) so the square shows a single pass number now. If the human still sees TWO 1s, it's the override-bug ghost the amendment names → belongs to the bidirectional task.
- **⚑ OVERLAP:** the queued NEXT task (pendant Pos fields ⇄ drag handle BIDIRECTIONAL — a drag writes back to the pendant, the pendant no longer just overrides) is the SAME "drag writes back" family as the recompute-on-Start-drag feature the human confirmed to me (drag Start → recompute #21-#24 = wall−Start → walls hold + emit changes; the reposition is jog-in-Start-relative). RECOMMEND the advisor UNIFY them into one bidirectional-drag design (the Start-drag investigation + exact edit point are in the prior WORK-LOG entry).

## 🔨 turn 295 (cycle 127) — UNIFIED BIDIRECTIONAL-DRAG SCOUT (NO CODE). 6-agent mapping workflow (wjmeawzp8, every seam code-verified). Full design in scratchpad/bidirectional-drag-scout.md.

**Also: restored mockup-buttons.html (staged-deleted in the tree — node_modules-wipe collateral, not my change; git checkout restored, tree clean).**

**THE ONE MECHANISM — two position CLASSES, not four stores:** pass-0 = the operator jog (SIM-ONLY, userStarts[0]); pass>=1 = the reposition (EMITTED #21-#24, with spotStore as the datum-relative world derive-cache). viz.starts / passStarts / userStarts[p>=1] are views/caches, never a 2nd authority. Invariant: #21-#24 is ALWAYS world - anchor, re-derived every render (panelTypes:174-179) — the emit can't disagree with the picture.

**PHASE 1 (goals a/b/c, ~8 lines, independently shippable):**
- (a) START-DRAG RECOMPUTE = extend the t120 capture to the wrappedOnDrag SIM_ID branch (panelTypes:238): freeze EVERY repoGroup into spotStore BEFORE simStart.onDrag (ORDER load-bearing — setSpots before onDrag). The :174-179 derive then holds each wall world + re-derives #21-#24 = wall - Start. No new math.
- (b) PENDANT bidirectional = ONE line: the pendant-overrides-handle is an ASYMMETRIC-REFRESH bug (viz._syncJogPos fires only from the 3D gizmo/step-jog/start-select; every other drag routes onStartDrag->setGcode->syncJog, a button-greyer). FIX: add `if (v._syncJogPos) v._syncJogPos();` in createPreviewPanel.setGcode after the viz.starts mirror (after :486) — setGcode runs after every drag surface, so every drag writes the pendant. syncPos skips the focused field (typing safe).
- (c) GHOST = already tombstoned (3f1c835 dropped the hole n; one "1" both probeZ states); codify handle-owns-number/hole-is-mute + cheaply harden the residual n:1 at panelTypes:127 (corner never hits it).

**PHASE 2 (valid-by-construction endpoint = THE DECISION):** kills the pre-existing WALL-JOG GHOST — dragging a WALL (pass>=1) via 3D/2D-top/pendant writes userStarts[p>=1] which BEATS the hint for display but NEVER reaches #21-#24 (lies about the machine). Fix: split by pass class in onStartDrag/onStartChange/precedence; p>=1 calls a host-supplied onEmitWorld(pass,world) (spotStore[gid]=world-cornerXY; derive #21-#24; re-emit) + DROP userStarts[p>=1] from computePassStarts. Crosses the deliberate createPreviewPanel<->op boundary (onEmitWorld keeps it generic; only corner's impl knows #21-#24).

**6 GATES all PASS for Phase 1:** byte-parity-at-default (spotStore empty until a drag) · probeZ-ON both handles (repoGroups holds both; per-gid derive) · 8 combos (datum-relative to cornerXY; VERIFY not assume) · top<->Layout consistent except the Phase-1 wall-jog residual + a one-frame flicker unknown · **t120 REVERSAL = a semantic reframe (the Start ◇ becomes the reposition DATUM, START=SOURCE) — but it CHANGES the emitted program on a Start jog → wants ONE explicit sign-off** · edges (coincident handles / unset-socket formula->number on capture).

**REAL-POINTER VERIFY PLAN:** 16 configs (4 corners × 2 probeSeq × 2 probeZ); real pointer events on Layout/2D-top/3D-gizmo/pendant; A default byte-parity · B Start-drag (walls stay + #21-#24 recompute the VALUE + all views show new Start + re-emit hits the same physical walls) · C wall-handle drag (#21-#24 change + top panel matches + PENDANT REFRESHES [the (b) guard] + other wall holds) · D pendant pass-0 edit · E pendant/3D WALL-drag = the Phase-1-vs-Phase-2 distinguishing assertion.

**FLAGGED UNKNOWNS:** (1) the wall anchors follow the Start via the passEnds runtime-shift (panelTypes:160-165, passEnds[0] follows userStarts[0] 1:1 — empirically confirmed), NOT a frac-chain. (2) one-frame top-panel flicker on a Start drag (two-render cascade; Phase 2 is the root fix; unknown if visible). (3) Phase-1-vs-Phase-2 scope is the human's call. (4) the pendant offers wall passes as jog targets today → the wall-jog ghost is reachable, not hypothetical.

**NO CODE. Advisor rules: (1) Phase 1 now / Phase 2 gated vs both; (2) the t120-reversal emit-change sign-off; (3) whether the flicker forces Phase 2 up-front. PASS BACK.**

## 🔨 turn 297 (cycle 127) — BUILT PHASE 1 of the unified bidirectional-drag (blessed scout). Start ◇ = the reposition DATUM. 627 pass / 1 known flake. Screenshots: scratchpad/startdrag-{layout,wizard}.png.

**BUILT (3 seams, exactly as the scout ruled):**
- **(a) START-DRAG RECOMPUTE** — panelTypes.js wrappedOnDrag SIM_ID branch: freeze EVERY repoGroup into spotStore (guard spotStore&&repoGroups.length&&cornerXY) BEFORE simStart.onDrag (ORDER load-bearing — setSpots first, else one-frame jump). The :174-179 derive then holds each wall world + re-derives #21-#24 = wall − (Start-shifted anchor). Updated the t87/t120 comment → START=DATUM (the emit CHANGES on a Start jog BY DESIGN, human-signed-off t294/t296).
- **(b) PENDANT bidirectional** — createPreviewPanel.setGcode, after the viz.starts mirror: `if (v._syncJogPos) v._syncJogPos();`. setGcode runs after EVERY drag surface → every drag now refreshes the pendant Pos fields (was only the 3D gizmo — the asymmetric-refresh "pendant overrides handle" bug). syncPos skips the focused field → typing safe.
- **(c) GHOST** — dropped the residual n:1 at panelTypes.js:127 (the len/text-height branch) + codified the invariant at :183 (handle-owns-number, hole-is-mute; sim ◇ stays 'Start'). One "1" everywhere.

**VERIFY (new corner-start-datum-drag.spec, REAL pointer events + the 16-config plan A-E):**
- A DEFAULT byte-parity: no drag → #23/#24 UNSET (formula) → emit unchanged.
- B 16-CONFIG SWEEP (4 corners × 2 probeSeq × 2 probeZ): a real Start-drag HOLDS every wall (reposition marker moves <6px) and RE-DERIVES its offset to a finite CHANGED number — probeZ-ON asserts BOTH pairs (#21/#22 wall-1 + #23/#24 wall-2 hold + recompute). ALL 16 pass.
- (b) a Layout drag REFRESHES the pendant (_syncJogPos spy fires — pre-fix it only fired on the 3D gizmo).
- FLICKER MEASURED: the LAYOUT wall deviation across the whole drag = **0px** (no on-Layout flicker — the Layout is frozen by the spot). The sub-frame TOP-PANEL transient the scout flagged is not capturable by settled sampling (two-render cascade) → it's the human's live-eyeball item (the gate); scout estimate ~a few px / one frame.
- Screenshots: scratchpad/startdrag-layout.png (settled Layout) + startdrag-wizard.png (full wizard).
- RE-BASELINED corner-layout-sim-drag.spec (1): flipped the old "emit byte-identical on a sim drag" invariant → "the Start drag RECOMPUTES the emit (the reposition datum)" — the t120 reversal. Test (2) degenerate-overlap unchanged.
- Full suite 627 pass / 2 skip (1 known middle-animator load flake, retry-passes).

**PHASE-1 RESIDUAL (documented, Phase-2 territory per the ruling):** dragging a WALL (pass>=1) via the 3D/2D-top/pendant still writes userStarts[p>=1] (moves the sprite, does NOT reach #21-#24) — the wall-jog ghost the immediate Phase-2 follow-on kills. GATE: pass back the diff + the screenshot PATHS for the human to feel before release.

## 🔨 turn 299 (cycle 127) — MARKER-PARITY SCOUT (NO CODE). 6-agent workflow (wpsh9500q) that DROVE the app + read REAL PIXELS. Full design in scratchpad/marker-parity-scout.md + screenshots.

**⚠️ THE FRAMING IS CORRECTED BY THE REAL PIXELS (the advisor's own instruction — map the real output).** AT REST the 3D wall marker and the Layout wall marker are COINCIDENT (BOTH at world (-43,43), the correct external wall-2 approach point) — two independent measurements REFUTE the "3D wrong far-left at rest / Layout correct" premise. The real bug is DRAG-TIME: after a real Start-drag the Layout wall HOLDS (-43,43) + #23/#24 recompute (cross1_x ""→"-78.571"), but the 3D wall MOVES to (-71.571,64.429) — swings ~30-36mm. So only HALF the locked requirement is met (Layout holds, 3D doesn't). **⚑ CONFIRM: the human's t298 "3D wrong at rest" screenshot is likely a POST-DRAG state (or a different corner/build) — not reproducible at rest.**

**WHY (one diverging term):** panelTypes:174-179 — the spotStore+cornerXY datum branch pins the Layout wall to cornerXY+spot (absolute stock world) + re-derives #23/#24; c435b1f's wrappedOnDrag captures the wall world before the re-trace so the Layout holds. The 3D _markerWorld (gcodeViz3d:326-334) has NO spot store — it chains end+(row-prev) off passStarts/passEnds which track the dragged Start → drifts. Secondary: the Layout re-derives its anchor from opSimStarts (raw hint), not the shared passStarts (userOpView:142-143 keeps only [0]).

**THE ONE SHARED SOURCE (not a per-surface patch):** LIFT the datum-pinned wall world (cornerXY+spot, already captured by c435b1f into _layoutSpots) UP into the shared computePassStarts. Seam A: computePassStarts overrides next[p] = cornerXY+spot with pinned:true when a spot exists (no spot → the pure-auto chain, byte-identical across panels). Seam B: 3D carries pinned through v.starts + _markerWorld returns row early when pinned (the mirror of the route's _anchorToStart gate). Seam C: thread the FULL passStarts into layoutSpecFromOp; read the anchor/dest from it (not opSimStarts); the #23/#24 write-back STAYS. NET: at rest coincident by construction; on drag both HOLD; the spot→world formula lives in ONE place.

**KEEP c435b1f — do NOT revert.** It satisfies the locked requirement on the Layout (pixel-verified) + IS the single source this fix reads. The residual is PURELY ADDITIVE (the 3D doesn't consume the spot). Keep + add Seams A/B/C.

**VERIFY (the anti-green guard):** the prior review shipped green while the picture was broken because it asserted each panel NUMERICALLY, never the two panels AGAINST EACH OTHER. Fix = drive both panels, locate each wall in WORLD (3D via spindleMarkers[1].getWorldPosition camera-projected — NOT a GL color-scan, sprite dims to 0-4px; Layout via the handle px→world), assert at rest + after-drag |world_3D − world_Layout| < 1mm (COINCIDENT), each HELD < 1mm, #23/#24 = wall_world − Start_world (the VALUE), + cropped side-by-side screenshots of both panels.

**FLAGGED:** trace-3's "Layout double-counts/moves" reconciled (with c435b1f the drag creates a spot → the spot branch overrides → Layout pins; the pinned-passStarts fix closes both) · trace-1's G53/machine-home taint NOT reproduced (partFrame.shift=0) · a latent no-spot bug: passEnds[0].x tracked the Start but .y did not.

**NO CODE. Advisor rules the Seams A/B/C build (keep c435b1f) + confirm the t298 screenshot state. QUEUED after: the 2D-preview path+red-probe animation on the Layout (reuse toolpath2d). PASS BACK the map.**

## 🔨 turn 301 (cycle 127) — BUILT the MARKER-PARITY fix (Seams A+B, the anti-green guard GREEN). The 3D wall no longer rides the dragged Start: both panels COINCIDENT (Δ=0.00mm) at rest AND held after a Start-drag. 629 pass / 2 skip. KEPT c435b1f. 6 files (5 wiring + new anti-green spec). GATE: pass back the diff + the side-by-side shots; literal Seam C flagged as a fork.

**THE FIX = ONE SHARED SOURCE, not a per-surface patch (the scout's Seams A + B):**
- **cornerDatumXY(params, stock)** (panelTypes.js, NEW export) — LIFTED the inline {corner param + stock} → world-corner mapping (was duplicated inline in layoutSpecFromOp:63-64) into ONE exported function. layoutSpecFromOp now calls it; so does pinnedStartsFor. The two panels' corner→world formula now lives in ONE place → they can't drift.
- **pinnedStartsFor(def, params, spots)** (panelTypes.js, NEW export, Seam A source) — the datum-PINNED wall worlds keyed by PASS INDEX, derived from the Layout's spot store as cornerXY + spot (the SAME formula + SAME spots object the Layout uses). Maps each spotted group → resolveRelToIndex(relTo)+1 = the destination (wall) pass.
- **Seam A** (createPreviewPanel.js computePassStarts) — reads getPinnedStarts; when a pass has a pin, overrides row.x/row.y = the pinned world + sets row.pinned=true. NO spot → the pure-auto chain, byte-identical (the 16-config byte-parity + goldens stay green). Carries pinned through into v.starts.
- **Seam B** (gcodeViz3d.js _markerWorld) — added `if (row.pinned) return row;` at the TOP: a pinned wall's world is ABSOLUTE, so SKIP the passEnds+(row−prev) relocation. THAT relocation (which chains off passStarts/passEnds that track the dragged Start) is exactly what made the 3D wall RIDE the Start. Mirrors the route's _anchorToStart gate.
- **WIRING** — wizardManager.preview3D adds getPinnedStarts: () => host.__pinnedStarts. userOpView feeds host.__pinnedStarts = pinnedStartsFor(...) in TWO spots: the top-level render (via viz3dIn('userViz3dContainer') — see the host-derivation fix below) AND setSpots (synchronously on each drag capture, so the immediately-following onStartDrag→setGcode→computePassStarts reads the fresh pins → the 3D holds the same frame).

**HOST-DERIVATION HARDENING (found while wiring):** the pre-render pin write first used _pbox.parentElement.parentElement.querySelector('.wiz-viz3d') (TWO levels up). But form3d+2d has TWO .wiz-viz3d panes (3D + Layout) under a common ancestor, so a two-level querySelector can match the OTHER pane first. Switched it to viz3dIn('userViz3dContainer') — the SAME one-level derivation the panel binding + the drag-path host + the existing viz3dIn helper all use. One derivation, not two. (The drag path already used the correct one-level host, which is why the test passed either way; this closes the param-change-after-drag re-render path.)

**VERIFY = THE ANTI-GREEN GUARD (new corner-marker-parity.spec.js, mandatory):** reads each wall in WORLD — 3D from viz.spindleMarkers (the cyan #22d3ee marker .position), Layout from the [data-hid="reposition_pos"] handle px → world via the largest fc-stock rect mapping — and asserts the TWO PANELS AGAINST EACH OTHER (not each vs a number — that is how the prior review shipped green while the picture was broken):
- AT REST: 3D wall (-43,43) == Layout wall (-43,43), **Δ=0.00mm**.
- AFTER a real Start-drag (mouse down on __simstart0, move +70,+45, up): the Layout wall HELD (-43,43), the 3D wall HELD (-43,43) — **the fix: it no longer swings ~30mm** — and the two still COINCIDENT **Δ=0.00mm**.
- the Start ITSELF moved (>15mm) + #23/#24 RECOMPUTED (cross1 "" → finite changed).
- VALUE (round-trip): anchor-end + #23/#24 = the held wall world (<2mm). Full suite 629 pass / 2 skip.
- Screenshots (full page = both panels each): scratchpad/parity_before.png + parity_after.png.

**VALUE-MODEL CORRECTION (the scout/dispatch said "#23/#24 = wall − Start"):** that is a SIMPLIFICATION. The G91 increment #23/#24 is wall_world − the ANCHOR PASS's RUNTIME END (passEnds[0], which is the previous pass's touched+retract spot — it FOLLOWED the dragged Start), NOT wall − the raw pass-0 Start jog. My first value assert used wall−Start and failed (got 50, want 107.4 = the 57.4mm probe+retract gap). Corrected to the round-trip anchor-end + #23/#24 = held wall — which is the meaningful check (applying the recomputed increment from the Start-shifted anchor lands back on the held wall).

**⚑ GATE — literal Seam C flagged as a FORK (built A+B, did NOT build the literal C):** the scout's Seam C = "thread the FULL passStarts INTO layoutSpecFromOp, read anchor/dest from it not opSimStarts." I did NOT rewire layoutSpecFromOp to consume passStarts. Instead A+B + cornerDatumXY make BOTH panels derive the wall from the SAME shared source (cornerDatumXY + the one _layoutSpots store) → coincident+held is VERIFIED (Δ=0.00mm) and the spot→world formula ALREADY lives in ONE place (Seam C's stated goal). Literal Seam C would swap the shared-FUNCTION construction for a shared-ARRAY construction (stronger single-array by-construction, but rewires layoutSpecFromOp's anchor source + risks the 16-config byte-parity). BOTH are legitimate: (A+B) ships the verified requirement now, one-source via cornerDatumXY; (+literal C) adds the single-array guarantee. Advisor's call — implement literal C too, or accept A+B as the one-source? Not pushing past the gate.

**⚑ FLAGGED (per the dispatch) — the latent no-spot passEnds[0].y bug:** at the no-spot default, passEnds[0].x tracked the dragged Start but .y did not (scout t299). NOT touched by this fix (A+B activate only WITH a spot; the no-spot path is byte-identical). Flagged for the advisor to route — a separate passEnds derive fix, not marker-parity.

**PASSED BACK for advisor review + the human gate (both panels coincident+held before release). QUEUED after: the 2D-preview path + red-probe animation on the Layout (reuse toolpath2d).**

### 🔨 turn 301 (cont.) — AMENDMENTS INCORPORATED → BUILT the literal Seam C (the consolidation, not a fork). 629 pass / 2 skip. +1 file (markerWorld.js). The two panels are now coincident BY CONSTRUCTION (one declared source), not by two derives happening to agree.

**Two advisor amendments landed for t301 (polled before commit) — they SUPERSEDE my "flag Seam C as a fork" plan:**
- **(1) declare-over-handroll (human asked):** consolidate to the ONE declared source — `pinned` is a DECLARED flag on the pass record flowing through computePassStarts, read by BOTH panels; do NOT hand-roll a second position computation; Seam C must DELETE the Layout's secondary opSimStarts-derived anchor, not add a parallel one.
- **(2) generality / the pilot principle (human asked):** the SHARED path (computePassStarts, _markerWorld, the layoutSpecFromOp consumer) must stay WIZARD-AGNOSTIC — reads pinned-marker-worlds-keyed-by-pass, nothing corner-specific; isolate ALL corner-specificity to the tiny datum PRODUCER (cornerDatumXY / pinnedStartsFor). Litmus: a future wizard inherits marker-holds+both-panels-coincident by declaring ONLY its own datum accessor.

**BUILT Seam C as a CONSOLIDATION (deleted the parallel derive, did not add one):**
- **NEW viz/markerWorld.js — markerWorldOf(starts, passEnds, p):** the ONE per-pass marker-world fn, WIZARD-AGNOSTIC (reads only x/y/z + the pinned + anchorsAtPrev flags). pinned → absolute; anchorsAtPrev → prev pass runtime END + delta; else the declared row. Byte-identical to the old gcodeViz3d._markerWorld body.
- **gcodeViz3d._markerWorld → delegates to markerWorldOf** (behaviour-identical for the 3D; the Seam-B pinned early-return now lives in the shared fn).
- **layoutSpecFromOp — DELETED the Layout's parallel POSITION derive:** was `destX = opSimStarts[ri+1]` (secondary source) + an inline `worldX = cornerXY + spot` (a 2nd hand-rolled cornerXY+spot). NOW: reads the anchor + the DESTINATION wall world from the SHARED panelStarts (= computePassStarts's output, the SAME array the 3D marker consumes) via the ONE markerWorldOf. The #23/#24 write-back is guarded on the GENERIC `pinned` flag (panelStarts[destPass].pinned), NO cornerXY in the position/write path. Falls back to opSimStarts ONLY when no panel is wired (2d-only mode — no 3D to be coincident with). panelStarts threaded via renderLayout2D ← userOpView (panel.getPassStarts()).

**WIZARD-AGNOSTIC (amendment 2, verified):** the shared consumer path (markerWorld.js · computePassStarts · _markerWorld · the layoutSpecFromOp position-read + the pinned write-back guard) references ONLY generic pass-record fields — no params.corner / cornerXY. All corner-specificity is in the PRODUCER (cornerDatumXY / pinnedStartsFor). A future wizard declares its own datum accessor and inherits the mechanism.

**VERIFY (all green from DDCS-Studio; the repo-root `tests/…` path form trips the known stale-collection error — run bare filenames from DDCS-Studio):**
- corner-marker-parity (anti-green): AT REST 3D wall (-43,43) == Layout (-43,43) Δ=0.00mm; AFTER a Start-drag both HELD (-43,43) Δ=0.00mm — now coincident BY CONSTRUCTION (both read markerWorldOf off the same passStarts), the test still measures the two INDEPENDENT rendered positions so it guards the rendering paths + the drag-hold, not a tautology.
- corner-marker-independence (5): default emit byte-identical · start↔reposition machine-world preserved · #23/#24 socket expression intact · datum spot preserved on corner-change · no cross-instance leak — ALL green (Seam C preserved byte-parity).
- corner-start-datum-drag (16-config sweep + default byte-parity + pendant refresh + flicker=0px) green. corner-layout-sim-drag green.
- FULL suite 629 pass / 2 skip. Screenshots refreshed: scratchpad/parity_before.png + parity_after.png.

**⚑ RESIDUAL (flagged, the rule-of-three generalization — NOT needed for the corner pilot):** the drag-CAPTURE (the datum-relative dx/dy = world − cornerXY in wrappedOnDrag/spotOnDrag) + pinnedStartsFor's hardcoded cornerDatumXY call are still corner-specific and live in layoutSpecFromOp / panelTypes. They are the PRODUCER side (they PRODUCE the spots that feed the pins), not the shared consumer path — so amendment 2 (agnostic CONSUMER) is met. Hoisting the capture out + making pinnedStartsFor call a per-op datum accessor (so a 2nd wizard needs ONLY its datum fn) is the generalization to do when the 2nd wizard is ported (corner-gated-pilot: prove once on corner, the rest inherit). Flagged for the advisor.

**GATE unchanged: PASSED BACK the diff + parity_before/after.png — the human sees both panels coincident + held before release. The passEnds[0].y latent no-spot bug still flagged (untouched — A+B+C activate only WITH a spot; the no-spot path is byte-identical).**

## 🔨 turn 303 (cycle 127) — AT-REST PARITY: the premise is REFUTED by real measurement; the human confirms probe-Z-first is FINE on HEAD (5ac24d8 already fixed it). Delivered the UPGRADED 16-config at-rest anti-green guard. 631 pass / 2 skip. TEST-ONLY (no source change).

**DISPATCH (t302 human gate, advisor-relayed):** markers coincide AFTER a drag but NOT at rest in the human's config ("initial pos not coincident, on drag it then coincides"); advisor-diagnosed ROOT = markerWorldOf's no-spot anchorsAtPrev branch depends on passEnds, the two panels fed DIFFERENT passEnds → diverge at rest, the pin branch bypasses passEnds → snaps coincident. Task = CONFIRM by driving the app + one-source the passEnds too.

**CONFIRMED BY DRIVING THE APP — the premise does NOT reproduce on HEAD (the advisor's root is refuted):**
- NEW corner-atrest-parity.spec drives the REAL app and measures the 3D marker world (viz.spindleMarkers .position, paired to the Layout handle BY PASS INDEX — wall-2 = the last pass, wall-1 = second-to-last, so the probeZ-on 2-cyan-marker case is handled, not the single-cyan colour-filter my t301 spec used) vs the Layout handle world (px→world). Result: **ALL 16 configs (4 corners × 2 probeSeq × 2 probeZ) at REST = Δ 0.00mm**, both walls under probeZ-on included.
- STRESS (the edge cases the sweep could mask): a settling FLASH (0/50/200/500ms) = Δ 0.00 at every delay; a LITERAL reposition value (cross1=25,18) = Δ 0.00; a non-default stock (320×240) = Δ 0.00; panelStarts ALWAYS covers every pass (nPS==nMk=3) so the Layout NEVER hits the opSimStarts fallback.
- CODE ANALYSIS confirms WHY it can't diverge at rest: passEnds is computed SYNCHRONOUSLY in setGcode (parsed.passEnds) and the SAME array is fed to BOTH panels (lastPassEnds → getPassEnds for the Layout; v.setPassEnds for the 3D). Post-Seam-C both panels read the ONE markerWorldOf off the SAME passStarts + the SAME passEnds → at-rest 3D-vs-Layout divergence is impossible by construction. The advisor's "different passEnds" hypothesis is not borne out by the plumbing.

**HUMAN INTERACTION (drove the real symptom, per verify-real-symptom):** the human INTERRUPTED — "you tested with probe z first too, its behave weird." I LOOKED at the real rendered output (scratchpad/atrest_BR_XY_Zon.png, a probeZ-on rest shot) instead of trusting the numbers, and was honest that my guard only asserts the two panels AGREE (3D==Layout), NOT that the spot is CORRECT — a marker wrong in BOTH panels sails through green (the assert-the-value gap). Human then clarified: "it was before, now its fine" + asked "did you repair that specifically?"

**ANSWER (honest, causal link REASONED not proven):** I did NOT touch source this turn (test-only). The fix that resolved it is the turn-301 Seam C consolidation (5ac24d8): BEFORE it the bottom Layout derived wall positions from its OWN opSimStarts path (independent of the 3D), which with probeZ-first's 3-pass relocation could place a marker in the wrong spot; AFTER it both panels read the ONE shared markerWorldOf(passStarts, passEnds) → probeZ-first markers land in one consistent correct place. I OFFERED to PROVE the causal link by reverting 5ac24d8 + re-checking (the wrong-place marker would return), but the human DECLINED (it would briefly re-serve the weird code in their live app) — "No, it's fine, move on." So the causal link is reasoned from the code structure, not reproduced before/after.

**DELIVERABLE = the UPGRADED anti-green guard (the advisor-mandated verify):** corner-atrest-parity.spec.js asserts |3D − Layout| < 1mm AT REST across ALL 16 configs (not the single config my t301 spec covered) + the after-settle stress cases. This is the permanent regression guard that would catch a real future at-rest divergence. Full suite 631 pass / 2 skip (629 + the 2 new guard tests; NO source change this turn → the 629 baseline is intact).

**⚑ FLAGGED — assert-the-value gap (the real lesson):** BOTH the t301 corner-marker-parity AND this t303 corner-atrest-parity guard assert the two panels COINCIDE with each other — NOT that the marker is at the CORRECT stock position. If a probeZ-first marker were wrong in BOTH panels (agreeing), both guards pass green while the picture is wrong. The human's eye caught exactly this class. A COMPLETE guard needs an INDEPENDENT truth for the wall world (the geometric probe-approach point from the corner + stock + offsets), not just cross-panel agreement. Recommend the advisor route a follow-up: pin each probeZ-first marker's world vs an independent geometric truth. The passEnds[0].y latent no-spot bug (advisor-flagged t299) is NOT currently manifesting (human confirms probeZ-first fine on HEAD) but remains un-pinned by an independent-truth assert.

**PASSED BACK: the at-rest premise is refuted on HEAD + human-confirmed fine; the 16-config at-rest guard is committed; recommend the advisor (1) treat the t302 gate as satisfied on 5ac24d8, (2) consider the assert-the-value follow-up (independent geometric truth for probeZ-first marker worlds).**

## 🔨 turn 305 (cycle 127) — ASSERT-THE-VALUE HARDENING: pinned every probe marker vs an INDEPENDENT geometric truth (outside the render path). ALL 16 configs Δ 0.00mm — markers geometrically CORRECT; non-tautological; passEnds[0].y bug does NOT manifest at rest. 633 pass / 2 skip. TEST-ONLY.

**DISPATCH (advisor t304, my recommended follow-up):** the parity guards prove the two panels AGREE, not that the marker is at the CORRECT stock spot (a marker wrong in BOTH panels passes green — the class the human's eye caught). Pin each reposition marker world vs an INDEPENDENT geometric truth (datum corner + stock + declared offsets, computed OUTSIDE the render path) across 16 configs incl probeZ-first 2-marker; also net the passEnds[0].y latent bug; STOP+flag if a REAL wrong position surfaces; VERIFY the assert FAILS on a mutated offset.

**THE DERIVATION (DIAG pass first — verify-real-symptom before asserting):** the RENDERED marker is NOT the naive declared chain — a reposition-destination pass is markerWorldOf-RELOCATED to the previous pass's RUNTIME END (passEnds) + its offset. DIAG dumped, per config, my independent chain vs rendered vs passEnds vs stock and REVEALED the exact machine-faithful model:
- first pass renders at its APPROACH (outside the wall, offset ALONG it by travelDist; frac-inset zsurf mirrored to the corner via dirsOf signs).
- a reposition-destination pass renders at passEnds[prev] + its #21/#22 or #23/#24 offset.
- the RUNTIME END of a wall probe = wall_edge − probeDir·(stylusR + retract) on the PROBE axis, approach coord unchanged on the ALONG axis (verified: FL wall1End.y=0−7=−7, BL=80+7=87, FR wall1End.x=100+7=107, BR=107 — all match passEnds exactly).
- a Z-surface probe leaves XY untouched (passEnds[zsurf]=zsurf).

**BUILT corner-marker-truth.spec.js — truthMarkers(corner, seq, probeZ, sx, sy, td, stylusR, retract):** re-implements this FULL machine-faithful chain from declared inputs ONLY (no call into opSimStarts / cornerReposOffsets / markerWorldOf — a SEPARATE computation), returning the expected rendered world for zsurf/wall1/wall2. Asserts each viz.spindleMarkers marker == its truth <1mm across all 16 configs (4 corners × 2 probeSeq × 2 probeZ).

**RESULT — every marker Δ 0.00mm, all 16 configs (incl probeZ-first's 3 markers):** the probe markers are geometrically CORRECT on HEAD (5ac24d8) — NO wrong position surfaced (no STOP/flag needed), consistent with the human's "it was weird before, fine now". Because passEnds[wall1] is PART of my independent model and rendered wall2 = passEnds[wall1] + off2 matched Δ 0.00, the **passEnds[0].y latent bug does NOT manifest at rest** — the app's runtime end (incl its y) equals the independent probe-touch+retract model. (Any at-rest passEnds y-error WOULD have failed the wall2 assert — this is the flag-net the advisor asked for; it comes up clean.)

**NON-TAUTOLOGICAL (proven):** a 2nd test builds the truth with travelDist NEGATED (off1/off2 flip) → the rendered wall2 does NOT match it (Δ>10mm) while the correct truth matches (Δ<1) → the assert constrains the VALUE, not a shape. This is the assert-the-value-not-the-change principle applied to the marker world itself (see the memory's new B4 instance: cross-panel AGREEMENT is not correctness).

**COVERAGE (transitivity):** corner-atrest-parity (t303, 4b9b664) locks 3D == Layout <1mm at rest across 16 configs; this locks 3D marker == independent truth Δ 0.00 → Layout == truth by transitivity. Together: both panels, geometrically correct, non-tautologically pinned. Full suite 633 pass / 2 skip (631 baseline + 2 new; NO source change).

**⚑ NOTE (model fidelity):** the truth encodes the probe standoff = stylusR + retract (matched all 16 exactly). If a future probe-model change (overtravel, collision-clamp, a different retract semantic) alters the real runtime end, this assert will flag it — correct behaviour (it must track the REAL geometry, not a frozen constant). The model is DECLARED in truthMarkers, one place, easy to update if the probe semantics legitimately change.

**PASSED BACK: markers verified geometrically correct + non-tautologically pinned across 16 configs; passEnds[0].y clean at rest; recommend the advisor consider the queued items (2D-preview animation on Layout, stepper-either-side, direction arrows, travel-shape dropdown, toast consolidation).**

## 🔨 turn 307 (cycle 127) — 2D-ANIMATION-ON-LAYOUT SCOUT (human t298; NO CODE). 4-agent map (wf_8120ea77-07a) of toolpath2d / featureCanvas / preview-driving / Layout-mount. The coordinate alignment (the ONE real task) is SOLVED exactly.

**GOAL:** the bottom Layout (featureCanvas SVG + declarative handles) shows the top-panel's 2D animation — the traced toolpath (yellow rapid / blue probe / green retract) + the red probe dot (#ff2a44) riding the live sim engine + a play control. PRINCIPLE: REUSE the existing toolpath2d renderer as an overlay UNDER the SVG handles, NOT a hand-rolled SVG re-implementation.

**THE ONE REAL TASK — COORDINATE ALIGNMENT (SOLVED, EXACT):** both surfaces are the SAME Y-flipped affine, differing only in parameterisation:
- featureCanvas._S (featureCanvas.js:215): sx = cx + (x-cxw)*s ; sy = cy - (y-cyw)*s ; _tf = {scale:s, cxw, cyw, cx=VW/2, cy=VH/2}.
- toolpath2d view (toolpath2d.js:64-65): sx = ox + x*s' ; sy = oy - y*s' ; view = {ox, oy, scale}.
- SET the overlay view FROM the live _tf: scale = _tf.scale ; ox = _tf.cx - _tf.cxw*_tf.scale ; oy = _tf.cy + _tf.cyw*_tf.scale → PIXEL-IDENTICAL (verified algebraically). Both use viewBox 1:1 to CSS px, no letterbox (aspect matches, no preserveAspectRatio). An overlay canvas absolute/inset:0 in the same container shares VW×VH → same pixel space.
- PATH-vs-MARKER consistency is FREE: toolpath2d positions the path with passOff = anchorToStart ? passAnchorFor(starts,passEnds,pass) : stockPin(); for an anchorsAtPrev pass passAnchorFor = passEnds[pass-1], and the Layout SVG marker = markerWorldOf = passEnds[pass-1]+delta → the drawn reposition path EMANATES from the runtime end and ARRIVES at the handle. Feed the overlay the SAME setStarts(passStarts)+setPassEnds+setAnchor the Layout already reads (getPassStarts/getPassEnds) + setMachine(null) → the path connects the handles BY CONSTRUCTION.

**COMPOSITION — path-only toolpath2d canvas UNDER a transparent SVG:** #userVizContainer (position:relative) gets a NEW child <canvas class=fc-anim-overlay position:absolute inset:0 pointer-events:none> BEHIND the SVG, running createToolpath2d(canvas, {overlay:true}) drawing ONLY path+dot; the SVG (gGrid/gItems stock/gHandles) stays ON TOP, handles topmost + interactive.
- OCCLUSION FIX (required): .feature-canvas{background:#000} (styles.css:2191) is OPAQUE → move the #000 to the container .viz-canvas; the SVG goes transparent, the path shows through (dimmed behind the translucent stock fill, under the handles). This IS the advisor's canvas-UNDER-the-handles.
- SURVIVAL: featureCanvas _draw only replaceChildren's its 3 <g>s → a sibling canvas survives redraws; _mount innerHTML='' only on FIRST mount / container change → insert the overlay AFTER first render, re-attach if the _layout singleton ever renders elsewhere and back.

**TRACE + LIVE TOOLPOS + PLAY — one engine, teed to all (declare-don't-handroll):** the panel runs ONE GcodeExecutionEngine; onPositionChange is the single live-pos source but routes to t2 ONLY while mode==='2d' (corner's top is 3D → would starve the Layout), and the raw segs + live pos are closures. Three small seams:
1. panel.getSegments() — expose parsed.segments (the shared trace); the overlay feeds setSegments (no re-trace, no divergence).
2. panel.onToolPos(cb) — a subscriber FAN-OUT off onPositionChange, firing in ANY top-panel mode; each tick the overlay setToolPosition(pos)+seek(nearest).
3. reuse panel.play()/stop() — one play drives the engine → all subscribers sync; a Layout ▶ (optional) delegates to panel.play. No 2nd engine.

**SMALL DECLARED SEAMS (the whole surface — additive, no emit change):** toolpath2d {opts.overlay = path+dot only; setViewTransform({ox,oy,scale}) = pin the frame, skip fit}; featureCanvas {getTransform() live _tf; onTransform(cb) on pan/zoom/fit/resize; move background:#000 container-ward}; createPreviewPanel {getSegments(); onToolPos(cb) fan-out}; userOpView {create the overlay + createToolpath2d({overlay}) ONCE memoised on the container, feed segments/starts/passEnds/anchor, pin view from _tf on each onTransform, subscribe onToolPos, wire ▶→panel.play}.

**RISKS/MITIGATIONS:** (1) RAF/instance LEAK — renderLayoutWithSim re-runs on every field input/drag/corner-pick/Start-drag + self-recurses → create the overlay+toolpath2d ONCE (memoise on #userVizContainer), idempotent re-attach; toolpath2d.play is one raf. (2) _tf mutates in place with NO hook → add onTransform (must cover featureCanvas's OWN ResizeObserver re-render at featureCanvas.js:74-79 which bypasses update()). (3) red dot + setToolPosition only while playing → a paused Layout shows the trail, no dot (matches the top; fine). (4) host.__panel null in 2d-only mode → guard on the panel (overlay only for form3d+2d). (5) _layout singleton shared with renderDeclaredLayout → re-attach if it renders elsewhere and back.

**DECOMPOSITION:** INC-1 ALIGNMENT PROOF (the one real task) — a STATIC path canvas under the transparent SVG, setViewTransform from _tf, assert a known path point sits pixel-exact under the SVG marker (via canvas.__t2view + _tf) across pan/zoom/resize; no animation. INC-2 LIVE ANIMATION — onToolPos fan-out + red dot + trail seek off the shared engine. INC-3 PLAY CONTROL + lockstep polish (Layout ▶→panel.play, pan/zoom/resize lockstep, DPR crispness).

**FORKS FOR ADVISOR + HUMAN:** (a) overlay scope = path+dot ONLY (rec — SVG owns stock/grid/handles) vs full scene (redundant); (b) play trigger = reuse the top play (rec — one engine drives all) vs a dedicated Layout ▶ (small delegate; not exclusive); (c) layering = canvas UNDER + transparent SVG bg (the advisor's ask, rec — handles stay visually on top) vs canvas ABOVE + pointer-events:none (path covers the handle markers). NO CODE — advisor rules the seams + the decomposition + the forks, then dispatch the build.

## 🔨 turn 309 (cycle 127) — BUILT the 2D-ANIMATION-ON-LAYOUT (INC-1→3, blessed scout). A path-only toolpath2d canvas UNDER the Layout SVG shows the traced toolpath + the live red probe head, driven by the ONE engine. Pixel-exact under the handles; additive, no emit change. 635 pass (1 parallel flake). 6 files + new spec.

**THE 6 SEAMS (exactly as the scout ruled — path-only, reuse the top play, under+transparent-bg):**
- **toolpath2d.js:** `opts.overlay` → paint() draws ONLY the path + red head (skips grid/envelope/stock/axes/handles); `setViewTransform({ox,oy,scale})` pins the frame externally; `fit()` is a no-op in overlay mode (the host owns the view).
- **featureCanvas.js:** `getTransform()` (live _tf) + `onTransform(cb)` fired from `_draw` (the ONE choke point for pan/zoom/fit/resize/render).
- **createPreviewPanel.js:** `getSegments()` (the shared trace); `onToolPos(cb)` fan-out off the engine's onPositionChange — fires in ANY view mode (a mode==='2d' gate would starve corner's 3D-top Layout) + cb(null,0) on stopPlay; `getAnchor()`.
- **panelTypes.js:** `renderLayout2D` returns the FeatureCanvas (so the host can pin the overlay).
- **userOpView.js:** `wireAnimOverlay(container, fc, panel, ...)` — creates the `<canvas class=fc-anim-overlay>` UNDER the SVG ONCE (memoised on container.__animOverlay — renderLayoutWithSim re-runs on every field/drag + self-recurses, so a per-render instance/raf would leak), wires `fc.onTransform`→setViewTransform + `panel.onToolPos`→seek+setToolPosition/stop, feeds the SAME segments/starts/passEnds/anchor the top 2D panel uses (so the path connects the SVG handles by construction).
- **styles.css:** scoped to `#userVizContainer` — the CONTAINER owns `background:#000` + `isolation:isolate`; the SVG goes transparent; `.fc-anim-overlay` = `position:absolute; inset:0; z-index:-1; pointer-events:none` (behind the SVG, above the bg → path under the interactive handles). Every OTHER featureCanvas untouched.

**ALIGNMENT (the one real task — EXACT):** the overlay view is set FROM featureCanvas._tf: `scale=_tf.scale, ox=_tf.cx - _tf.cxw*_tf.scale, oy=_tf.cy + _tf.cyw*_tf.scale` → `tx/ty == _S` (both viewBox 1:1 to CSS px). The path connects the handles for free because toolpath2d's passOff=passAnchorFor(passEnds) and the Layout marker=markerWorldOf(passEnds+delta) already agree — feed the overlay the same starts/passEnds/anchor (which the Layout already reads) and setViewTransform, and it registers pixel-exact.

**VERIFY (corner-anim-overlay.spec, 3 tests, all green):**
- INC-1 ALIGNMENT (the load-bearing proof): the overlay's published view maps the stock WORLD corners onto the SVG stock rect corners <2mm — AT REST and AFTER a wheel-ZOOM (the overlay re-pins via onTransform). Δ<2px both.
- INC-2 DRIVE: onToolPos delivers >=2 DISTINCT live positions during a run (the head animates as the engine advances) + the overlay draws a LIVE red head on the path. Screenshot scratchpad/anim_overlay.png = the traced path (blue probe + yellow rapids) UNDER the handles + the red probe head on it.
- INC-3 HANDLES: a Start-drag through the pointer-events:none overlay still reaches the handle + recomputes #23 (the overlay does not block interaction).

**OBSERVATION (not a blocker, flagged):** the corner LIVE sim stops early in the headless test (DRO 'Execution stopped' at Y≈1.9 — the same for the 3D preview; onToolPos fires ~3 ticks then null). This is a PRE-EXISTING live-engine behaviour (the overlay MIRRORS the 3D — both stop together, so it is not the overlay), and the traced PATH renders fully regardless of play (setSegments is static). The screenshot stages the head at the longest segment's midpoint for a clear visual since the live sim is too brief to race.

**REUSABILITY:** the overlay is GENERIC — wired in the shared form3d+2d Layout render path (renderLayoutWithSim), reading generic panel data (segments/starts/passEnds/anchor) + the FeatureCanvas transform, NOTHING corner-specific. Any wizard using the form3d+2d panel (3D-top + Layout-bottom) inherits the animated toolpath + probe head for free. Corner is the ONLY form3d+2d op today (the pilot); as the other PROBE wizards (edge/middle/rotary/alignment) port to form3d+2d they get it — the corner-gated-pilot: proven once, the rest inherit. (Caveat: tuned for the ANCHORED probe frame; a non-anchored MILL op on form3d+2d would also need setMachine/setStock fed — a small follow-on.)

**Full suite 635 pass / 2 skip (632 baseline + 3 new; 1 failure = project-drawer-smoke, a known parallel-run flake — passes in isolation). GATE: PASS BACK the diff + anim_overlay.png — the human sees the path under the handles + the red head before release.**

## 🔨 turn 311 (cycle 127) — STEPPER-SIDE (human t302, small): DECLARE widgetConfig.stepperSide on the number widget. Default UNCHANGED (native right spinner); 'left' = a custom ▲▼ stepper placed LEFT via CSS flex order. 637 pass, no emit change. 3 files.

**BUILT:** formWidgets.numberWidget reads `cfg.stepperSide`. Default (unset / 'right') appends the native input EXACTLY as before → byte-identical, every existing field unchanged. `'left'` hides the native inner-spin-button (`num-input-bare`, appearance:none) and mounts a custom stepper ELEMENT (a `.num-stepper` span with two `.num-step-btn` ▲▼ buttons) in a `.num-field` flex wrapper; CSS `.num-stepper-left .num-stepper { order:-1 }` places the spinner on the LEFT (a DECLARED class + flex order, NOT a per-field hack). The ▲▼ buttons drive the SAME input (inp.stepUp/stepDown, with a ±1 fallback for step='any' which throws) + dispatch input/change so the form read + preview update normally. The read() closure binds `inp` either way → value/emit path untouched.

**Why a custom element (not CSS on the native spinner):** the native `input[type=number]` spinner is a UA pseudo-element locked to the right; `direction:rtl` (the only pure-CSS move) right-aligns + breaks signed-number display (this is a CNC app full of signed offsets). So 'left' uses a real orderable element; default keeps the native spinner so nothing existing changes.

**VERIFY (form-widgets.spec, new test, green):** a `widgetConfig:{stepperSide:'left'}` number field mounts a `.num-stepper` with 2 buttons positioned to the LEFT of the input (getBoundingClientRect x < input x); a DEFAULT number field is NOT wrapped (still a native `input[type=number]`); clicking ▲ steps the value up (feed 100→>100, the custom stepper drives the input); Insert commits depth=-5 unchanged (no emit change). Full suite 637 pass / 2 skip (636 baseline + 1 new; NO existing field or emit touched).

**PASSED BACK. QUEUED next per the advisor: direction arrows (t292c), travel-shape dropdown (t292d), toast consolidation (t292e).**

## 🔨 turn 313 (cycle 127) — VIZ TWEAKS (human t312, two specific values in toolpath2d drawPath): future/untraveled path alpha 0.22→0.8 (80%) + traveled path width 2.6→3.12 (1.2×). ONE renderer → BOTH the top panel + the Layout overlay. No emit change, 636 pass (1 parallel flake). 1 file.

**BUILT (toolpath2d.js drawPath, the play-state trail):** the future segments strokeSegs alpha 0.22 → 0.8 (human-specified 80% — brighter, but still dimmer than the traveled path at alpha 1 so the progress contrast holds); the traveled segments strokeSegs width 2.6 → 3.12 (2.6×1.2, human t312 amendment). Both are the SAME one-source renderer, so the top 2D panel AND the new Layout animation overlay inherit both at once. The STATIC path (k==null: alpha 1, width 2) is UNTOUCHED — only the mid-play trail changes.

**VERIFY:** real-app mid-animation screenshot scratchpad/anim_overlay.png (regenerated) — the traced path renders brighter (future at 80%) with the red probe head, under the handles; the traveled portion up to the head is the wider 3.12 stroke, still distinct from the 80% future. No emit change (visual-only, drawPath is a preview renderer). Full suite 636 pass / 2 skip (1 failure = custom-op-chip, a known parallel-run flake — passes in isolation; a 2-value opacity/width tweak cannot affect the Edit-chip test).

**PASSED BACK (screenshot for the human). QUEUED next per the advisor: travel-shape dropdown (t292d), toast consolidation (t292e).**

### 🔨 turn 313 (amendment) — THIRD tweak (human t312c, consistency): gcodeViz3d._dimRoute untraveled route opacity 0.5→0.8 to MATCH the 2D future=0.8 → both previews consistent. The bold 3D _trailLine (traveled emphasis) is UNTOUCHED. So this turn = THREE one-value tweaks: 2D future 0.22→0.8, 2D traveled width 2.6→3.12, 3D untraveled 0.5→0.8. (Deeper: these progress-style values + the colour legend get declared ONE-SOURCE in a QUEUED cleanup — not this turn, per the advisor.) Screenshot both previews mid-play.

## 🔨 turn 315 (cycle 127) — VIZ ONE-SOURCE UNIFICATION SCOUT (human-designed, NO CODE). 3-agent map (wf_c162449f-080) of toolpath2d + gcodeViz3d + the legend + the touch-pulse. The path-visual palette is FOUR hand-maintained copies today; one declared module + type×state composition fixes it. Corrects two imprecisions in the brief.

**WHY (human t312d):** the human has VALUE MODIFICATIONS in mind for the path visuals + wants them to land ONCE and hit BOTH previews → unify FIRST, then edit. Today the palette is duplicated in 4 places: 2D segColor (toolpath2d:27-33), 3D line-groups+trail (gcodeViz3d:832-833/856-861), the live LEGEND array (createPreviewPanel:532), and the CSS .viz-legend-line (styles.css:3403-3407) — the root cause enabling every divergence.

**THE ONE MODULE (proposed viz/pathStyle.js) — TYPE × STATE, orthogonal (type never touches opacity, state never touches dash):**
- (A) TYPE table, keyed by type = { color, dash, widthScale, shape, label }. SIX types: rapid #ffcc00 dash[5,4] wScale0.6 · retract #33cc55 solid · probe-fast #3b82f6 dash[2,3] (draw UNDER) · probe-slow WHITE dash[2,3] (draw OVER — wins the overlap) · feed = gradient(FEED_LOW 0x0a4fd0→FEED_HIGH 0x35ffd0, a Z-depth function) · JOG(manual) #ff9a0d dash[5,4] shape=arc. (feed + probe rows hold FUNCTIONS/branches, not flat hex.)
- (B) STATE tokens = { static:{alpha:1,width:2}, future:{alpha:0.8,width:1.5}, traveled:{alpha:1,width:3.12} } + the red head #ff2a44 r4.
- (C) PROBE + TOUCH-PULSE config (colors + the disc sizes/timing).
- RENDERER COMPOSES: color=type.color(seg) · dash=type.dash · width=state.width × type.widthScale · alpha=state.alpha · shape=type.shape. This UNTANGLES today's three fusions the map found: (1) width is type-tainted (rapid ×0.6 mixed into the state-width, toolpath2d:241) → becomes type.widthScale; (2) jog color is inline off startSources, bypassing segColor (toolpath2d:240) → jog becomes a real TYPE (promote it out of the geometric 2-axis-rapid detection); (3) SHAPE (straight vs 'rainbow' arc, toolpath2d:245-248) is a hidden 3rd axis fused into the jog branch → a per-type `shape`.

**BOTH RENDERERS + THE LEGEND read the module:** 2D strokeSegs, 3D line-groups+trail, and the LEGEND (replaces the createPreviewPanel array + the CSS copy) all resolve type→style from the ONE table → a value edit (human's coming mods) lands once, hits all. PROBE fast/slow DRAW-ORDER: the table declares it (fast under, slow WHITE on top) → the renderer draws all fast probe segs then slow over (today both draw in trace order, no deliberate order).

**⚑ CORRECTION 1 — THE TOUCH-PULSE the brief points at is TWO different glows (the brief conflates them):** (a) _probeDiscBurst (gcodeViz3d:2007-2037, triggered by probeAxisTouched:1946 on each G31 contact at the ruby 0xff2a44) = a CYAN 0x00e5ff disc that does NOT expand — fixed FEED-SCALED constant-screen radius (200px × clamp(sqrt(feed/250),0.6,1.8) → FASTER=BIGGER), opacity-pulses (0.03..0.08 additive, slow flashes 4× / fast 3×) + fades over 16000ms SIM-time. (b) _glowAt (gcodeViz3d:1864) = the SEPARATE ~0.7s (850ms) EXPAND+FADE (r0→r0×2.3) glow — wired ONLY to flashMarker (WCS 0xffe08a / start 0xff7a6a), NOT probe contact. So the brief's "170-178/1862, expand+fade ~0.7s, on-contact, lockstep with red probe" mixes the disc's ON-CONTACT trigger with the _glowAt EXPAND+FADE style. PROPOSED 2D PULSE (a clean composite, net-new — 2D has NO pulse today): trigger ON PROBE CONTACT (a new panel onProbeTouch(cb) fan-out, mirror of onToolPos — fires the touch position + feed at the G31 contact, lockstep with the red head) → draw a pulse disc that EXPANDS+FADES over ~0.7s (the _glowAt feel, not the 16s sim-fade), restyled LOW-ALPHA WHITE (a~0.3), SLOW=BIGGER (screen-space fast~7px / slow~14px). Ported into BOTH the top 2D + the Layout overlay (one renderer).

**⚑ CORRECTION 2 — the 3 divergences are NOT all reconciles:**
- (1) JOG COLOR — REAL divergence, COLOR-ONLY: 2D jog = #ffb300 (it borrows the START-MARKER amber, toolpath2d:240); 3D + legend + CSS all = #ff9a0d (the canonical jog amber). So the 2D is the lone outlier. The SHAPE ALREADY MATCHES (the 2D trans-vector is ALREADY dashed [5,4] AND bowed — toolpath2d:242/246) → the brief's "arc→dashed" is a FALSE premise, add no dashing. Fix = 2D #ffb300→#ff9a0d: PIXEL-NEUTRAL on 3D/legend/CSS, a small visible amber-shift on the 2D ONLY. SEMANTIC FORK (flag): should the jog LINE match the jog LEGEND (#ff9a0d, 3 sides already agree — recommended) or the START MARKER it connects (#ffb300)? — human call.
- (2) FEED GRADIENT — NOT a divergence: 2D FEED_LOW/HIGH (0x0a4fd0/0x35ffd0) == 3D cLow/cHigh (0x0a4fd0/0x35ffd0) BYTE-IDENTICAL → PIXEL-NEUTRAL, do NOT "fix" the endpoints. The only real drift is a LEGEND TYPO: the 'Cut' chip = #35d0ff (a transposed #35ffd0, createPreviewPanel:533) → #35ffd0 (legend-only, tiny). Optional behavioural align: 2D colours a feed seg by its MIDPOINT-Z over the feed z-range, 3D per-VERTEX over scene bounds — a same-value application difference, deferrable.
- (3) DISC SIZING DIRECTION — DELIBERATE net-new (2D has no disc). The advisor's slow=bigger (fast~7/slow~14px) INVERTS the 3D's faster=bigger (gcodeViz3d:2001) → the two views would DISAGREE on direction. NOTE the 3D size code already CONTRADICTS its own comment (:171 "slow/fine → BIG disc") + the flash-count cue is already slow=more (slow 4× / fast 3×). DECISION (flag): (a) 2D slow=bigger AND flip the 3D to slow=bigger too (consistent, matches the flash cue + the stale comment's intent — RECOMMENDED) vs (b) 2D-only slow=bigger (views split). Also the 3D base is a 200px soft additive glow vs the 2D's 7-14px hard disc → only the DIRECTION+clamp shape ports, not the px.
- (4) probe-slow → WHITE is a DELIBERATE 3-place change (currently consistent #93c5fd across 2D+3D+legend) — via the module it is ONE edit. RISK: confirm the exact white (pure #fff vs off-white) stays distinct from white start-glyphs/snap markers + the red head.

**DECOMPOSITION (proposed):** INC-1 the pathStyle module (declare the TYPE table + STATE tokens + FEED gradient + probe/pulse config, values MIRRORING today exactly → byte-neutral). INC-2 rewire the 2D renderer to compose type×state from it (untangles the width-taint + inline-jog + shape; byte-neutral EXCEPT the deliberate jog #ffb300→#ff9a0d). INC-3 rewire the 3D line-groups+trail to the module (byte-neutral, kills the duplicate inline hex). INC-4 rewire the LEGEND + CSS to the module (fixes the #35d0ff typo). INC-5 the DELIBERATE visible changes: probe-slow→WHITE + probe draw-order (slow over fast). INC-6 the TOUCH-PULSE port: onProbeTouch fan-out + a white expand-fade ~0.7s slow=bigger disc in the 2D + Layout overlay (+ the 3D-direction decision). PIXEL-NEUTRAL: INC-1..4 (except the tiny jog + legend-typo tweaks). DELIBERATE: INC-5, INC-6, the jog color.

**FORKS FOR THE ADVISOR + HUMAN:** (a) jog-line color = #ff9a0d (legend-canonical, rec) vs #ffb300 (start-marker); (b) probe-slow WHITE exact value + distinctness; (c) disc direction — flip the 3D to slow=bigger too (rec, consistent) vs 2D-only; (d) the pulse timing — the ~0.7s expand-fade (rec, the _glowAt feel) vs the 3D disc's 16s sim-fade; (e) whether the module lives as viz/pathStyle.js (rec) + how the legend consumes it. NO CODE — advisor rules the module shape + the decomposition + the forks, then dispatch the build (unify byte-neutral first, then the human's value mods land once).

## 🔨 turn 317 (cycle 127) — VIZ ONE-SOURCE UNIFICATION BUILD (INC-1→4, byte-neutral). NEW viz/pathStyle.js = the ONE palette (TYPE color/dash/widthScale/shape × STATE alpha/width); the 2D + 3D renderers + the legend + the CSS all READ it → the 4 hand-maintained copies collapse to 1. 637 pass, no emit change. 6 files.

**BUILT viz/pathStyle.js:** PATH_TYPES {rapid, feed, probeFast, probeSlow, retract, jog} each = {color(hex int), dash, widthScale, shape, label} · PATH_STATE {static, future, traveled} = {alpha, width} · FEED_LOW/FEED_HIGH · HEAD {color, r} · feedRgb() (2D depth lerp) · LEGEND_ROWS (derived FROM PATH_TYPES so the legend can't drift) · applyPathVars() (publishes --viz-path-* so the legacy CSS legend reads the same source; runs on load). Built at the CURRENT values = byte-neutral.

**REWIRED all 4 consumers to READ it:**
- 2D (toolpath2d): segColor → PATH_TYPES colours + feedRgb (removed the local FEED_LOW/HIGH + lerpHex); drawPath static/future/traveled → PATH_STATE; the red head → HEAD; the manual JOG LINE → PATH_TYPES.jog.color. segColor EXPORTED as the one-source parity seam.
- 3D (gcodeViz3d): the trail colours + the line-group colours + the feed-gradient endpoints (cLow/cHigh) → PATH_TYPES/FEED_*; _dimRoute untraveled alpha → PATH_STATE.future.alpha (SHARED with the 2D future — a human mod hits both). (The 3D line-group base opacities 0.6/0.85/0.95 stay inline — a 3D render detail, not a shared type identity.)
- LEGEND (createPreviewPanel): the inline 6-row array → LEGEND_ROWS.
- CSS (styles.css): .viz-legend-line.* → var(--viz-path-*, <current fallback>) (byte-neutral; the vars come from applyPathVars).

**THE 2 AGREED MICRO-FIXES (the only pixel changes):** (1) the manual JOG LINE #ffb300 → #ff9a0d (it had borrowed the START-MARKER amber; now the ONE canonical jog amber the 3D+legend+CSS already use — the 2D was the lone outlier; the start-marker amber #ffb300 at drawStartHandles:191 is a separate glyph layer, UNTOUCHED). (2) the legend Cut chip #35d0ff → #35ffd0 (a transposed typo; now reads the real gradient-high FEED_HIGH). The 2D auto trans-vector cyan #22d3ee is the marker/traverse layer, not a path type — untouched.

**WHY STATE too (not just colours):** the human's coming value mods (t312d "modify it for BOTH") + the t313 tweaks (future 0.8, traveled 3.12) are STATE values — one-sourcing PATH_STATE means the human's next edit lands ONCE and hits both previews (the 2D drawPath + the 3D _dimRoute both read future.alpha).

**VERIFY (new viz-pathstyle.spec, green):** byte-neutral current values (rapid 0xffcc00 · retract 0x33cc55 · probe fast/slow 0x3b82f6/0x93c5fd · feed/FEED_HIGH 0x35ffd0 · FEED_LOW 0x0a4fd0 · future α 0.8 · traveled w 3.12); ONE-SOURCE — the 2D segColor(rapid) == the legend rapid == the module == the CSS var, all '#ffcc00'; the 2 micro-fixes (jog '#ff9a0d', Cut '#35ffd0'); LIVE proof — mutating PATH_TYPES.rapid.color changes the 2D segColor (it reads the live module, not a copy → a value mod lands once). Full suite 637 pass / 2 skip (1 known middle-animator flake, retry-passed) — byte-neutral across every shared renderer/legend test; NO emit change (palette is viz-only; goldens/roundtrip green).

**GATE: PASSED BACK the diff. NOTE for later (not this turn): INC-5 = probe-slow WHITE #ffffff + draw-order slow-over-fast; INC-6 = the touch-pulse PORT with the honest top-view projection (2D CIRCLE for a Z/surface touch, LINE for a WALL touch; event {pos, probe-axis, feed}) + the 3D pulse timing/direction calls.**

## 🔨 turn 319 (cycle 127) — INC-5 (first VISIBLE change): probe-slow → WHITE + draw-order slow-over-fast. ONE module edit (both previews follow) + the 2D/3D order fix. 639 pass, no emit change. 3 files + test.

**BUILT (on the t317 one-source palette):** (1) PATH_TYPES.probeSlow.color 0x93c5fd → 0xffffff — ONE edit in viz/pathStyle.js; the 2D segColor, the 3D line-group + trail, the legend, and the CSS var all follow (the whole point of the unification). (2) DRAW ORDER so the WHITE slow wins the collinear re-probe overlap with the fast blue: 2D toolpath2d.strokeSegs now draws in TWO passes (everything EXCEPT the slow probe, then the slow probe LAST) — byte-neutral for non-probe types (non-overlapping segments are order-independent); 3D gcodeViz3d sets lineGroups.probeSlow.renderOrder = 21 (over the fast probe's 20, depthTest:false). The fast probe stays blue-dotted (#3b82f6, [2,3]).

**VERIFY (viz-pathstyle.spec, green):** the value — PATH_TYPES.probeSlow = 0xffffff and 2D segColor(slow) = '#ffffff', fast stays '#3b82f6'. The DRAW ORDER — a controlled render of a FAST + a SLOW probe on the SAME line, then a canvas pixel scan: WHITE pixels (slow, on top) > BLUE pixels (fast, covered) → the slow drew LAST and won the overlap (flip the order and blue would win). Full suite 639 pass / 2 skip — byte-parity for every non-probe type held through the strokeSegs restructure; NO emit change. Screenshot scratchpad/inc5_white_slow_probe.png (both previews + the legend showing 'Probe slow' now white); the corner's slow-touch segment is short so the pixel-scan test is the rigorous white-on-top proof.

**GATE: PASSED BACK the diff + the screenshot. On bless the advisor releases INC-1→5 together. Later: INC-6 = the touch-pulse port (honest top-view projection — 2D circle for a Z/surface touch, line for a wall touch; event {pos, probe-axis, feed}) + the 3D pulse timing/direction fork.**

## 🔨 turn 321 (cycle 127) — INC-6, the TOUCH-PULSE PORT (the LAST viz increment): a transient white flash at each G31 contact ported into the 2D/Layout with the HONEST TOP-VIEW PROJECTION; the 3D disc restyled + flipped. 641 pass, no emit change. 5 files + 2 tests.

**BUILT (5 pieces):**
- **pathStyle.js:** TOUCH_PULSE token = { color 0xffffff, alpha 0.3, fastPx 7, slowPx 14, fadeMs 16000 } + pulsePx(slow) — the ONE declared source (colour + the 2 sizes + the sim-fade), read by BOTH previews.
- **createPreviewPanel:** onProbeTouch(cb) FAN-OUT (mirror of onToolPos) fired on the G31 CONTACT (the existing probeAxisTouched seam) carrying { pos: engine.pos, axis (x/y/z), feed, slow: feed<maxProbeFeed, pass: lastPass, speed: simSpeed() }; it also pulses the top 2D (t2.pulse) directly. lastPass tracked from onPositionChange so the pulse rides the SAME per-pass anchored frame as the head.
- **toolpath2d:** a pulse system — pulse(ev) + a fade raf (prog += dt*speed/fadeMs = SIM-time, SAME both previews) + drawPulses. THE HONEST TOP-VIEW PROJECTION by axis: Z/surface → a CIRCLE (the disc face-on); X wall (probe in X, wall along Y) → a VERTICAL tangent LINE; Y wall → a HORIZONTAL tangent LINE. Low-alpha white, SLOW=BIGGER (slowPx 14 / fastPx 7 screen-space), flashes 4×(slow)/3×(fast) then fades. Positioned via ptx/pty (lockstep with the red head); drawn in both the top 2D + the overlay (one renderer).
- **gcodeViz3d:** restyled _probeDiscBurst to the declared TOUCH_PULSE.color (WHITE, was the cyan _lineColor) + FLIPPED _burstRadiusPx to slow-bigger (sqrt(ref/f) inverts the old sqrt(f/ref)) + one-sourced the fade to TOUCH_PULSE.fadeMs.
- **userOpView:** the overlay subscribes panel.onProbeTouch → tp.pulse (so the Layout pulses in lockstep with the 3D + the head).

**VERIFY (viz-touch-pulse.spec, green — DROVE the render):** the HONEST PROJECTION by axis — a controlled overlay pulse + a non-transparent-pixel BBOX scan: Z → a CIRCLE (bbox ≈ square), X → a VERTICAL line (tall+narrow), Y → a HORIZONTAL line (wide+short); SLOW bbox > FAST bbox (slow=bigger). The panel exposes onProbeTouch (the fan-out API). The 3D flip: probe-cue-refine UPDATED (was faster-smaller → now slow-BIGGER; slow F50 disc > fast F3000, matching the 2D). Full suite 641 pass / 2 skip — byte-parity for non-pulse rendering held; NO emit change (viz-only; goldens green). Screenshot scratchpad/inc6_touch_pulse.png = BOTH previews: the 3D white touch-disc + the 2D Z-touch CIRCLE (by the reposition marker) + the wall-touch LINE (right of ①).

**GATE: PASSED BACK the diff + the screenshot — the human sees the honest projection before release. THE VIZ UNIFICATION CAMPAIGN (INC-1→6) IS COMPLETE.**
