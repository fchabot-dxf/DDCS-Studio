
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
