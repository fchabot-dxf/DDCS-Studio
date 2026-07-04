
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
