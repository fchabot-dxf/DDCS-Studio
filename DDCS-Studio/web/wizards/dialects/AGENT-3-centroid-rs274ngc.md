# Agent 3 — Centroid + RS274NGC dialects (port targets)

You are filling **two** controller dialects for DDCS Studio. Repo: `c:\Users\danse\APPS\ddcs-studio-project`.
Both are *in-program* dialects (logic lives in the program, like DDCS), so "register the words" works cleanly.

## What you're doing
Produce two bindings that render block-atom *intent* into **Centroid CNC12** and **RS274NGC (grbl HAL / LinuxCNC)**.
Mirror the verified anchor's exact shape.

## Read first (READ-ONLY — do not edit)
- `DDCS-Studio/web/wizards/dialects/SCHEMA.md` — the contract.
- `DDCS-Studio/web/wizards/dialects/ddcs-expert-m350.js` — the verified ANCHOR. Mirror it exactly.
- `bridge/controllers/MACHINE-PRIMITIVES-MAP.md` — the cross-controller map (your overview).

## Conflict avoidance (IMPORTANT)
- Write **ONLY** these two NEW files: `DDCS-Studio/web/wizards/dialects/centroid.js` and
  `DDCS-Studio/web/wizards/dialects/rs274ngc.js`.
- Do **NOT** edit the anchor, `SCHEMA.md`, or any other `wizards/dialects/*.js` (other agents own those).
- Stay in your lane → zero merge conflicts.

## Ground truth — verify everything
Cite `file:line`. Mark unconfirmed forms `TO CONFIRM`. Return `[]` for primitives the controller folds away.

---

### File A — `centroid.js` (Centroid CNC12 / Acorn)
Dump: `bridge/controllers/centroid/` — `corner-probe-FL.mac`, `assets/Centroid_CNC12_Macro_Programming.txt`.
- `programModel:'inline'`, `probeModel:'move-until-input'`, `dwellUnits:'s'`.
- **probeMove**: `M115 /${axis}${dist} P${port} F${feed}` (stops AT contact, **auto-errors** on no-contact; retract `M116`).
- **probeStatus**: `[]` (auto-error built in). **probeRead**: `[]` (at contact → define via setWorkOffset).
- **machineMove**: `G53 ${axis}${ref}`. **setWorkOffset**: `G92 ${axis}${value}` (or `G10 P${wcs} R${value}`).
- **readMachine**: `TO CONFIRM` (system `#4xxx`).
- **distMode** G90/G91 · **dwell** `G4 P${sec}` · **endProgram** `M30` · **spindle** M3/M4/M5.
- **ifGoto**: `IF ${lhs}${op}${rhs} THEN GOTO${label}` (note **THEN**); **label** `N${n}`.
- **HMI**: hmiPrompt `M225 #0 "${msg}"` (display-until-ack); hmiInput `M224 #0 "${prompt}" #${retvar}`; hmiToast `M225 #<t> "${msg}"`.
- `notes`: M115/M116 probing is shorter than DDCS (no status read); IF…THEN…GOTO; M224/M225 HMI.

### File B — `rs274ngc.js` (grbl HAL / LinuxCNC — the cleanest ~1:1)
Dumps: `bridge/controllers/grbl/assets/grblHAL-core-src/`, `bridge/controllers/linuxcnc/`.
- `programModel:'inline'`, `probeModel:'g38'`, `dwellUnits:'s'`.
- `vars`: `probeTrig:5061` (X#5061/Y#5062/Z#5063), `probeStatus:5070` (1=ok), `dro:5420` (LinuxCNC current pos — `TO CONFIRM` grblHAL).
- **probeMove**: `G38.2 ${axis}${dist} F${feed}`. **probeRead**: `${var}=#${5061+ax}`.
- **setWorkOffset**: `G10 L20 P${wcs} ${axis}${value}`. **machineMove**: `G53 G0 ${axis}${value}`.
- **distMode** G90/G91 · **dwell** `G4 P${sec}` · **endProgram** `M30` · **spindle** M3/M4/M5 · **coolant** M7/M8/M9.
- **FLOW IS O-WORD, NOT GOTO**: `o<n> if [..] … o<n> endif`, `while/endwhile`, `sub/endsub/call`. So
  `ifGoto`/`goto`/`label`/`probeStatus` do **not** map to GOTO — implement as an O-word `if` block (or a `(MSG,…)`
  + note) and explain the flow-model difference in `notes`.
- **HMI**: hmiToast `(MSG,${msg})`; no blocking input in stream mode → hmiPrompt/hmiInput `[]`.
- `notes`: cleanest 1:1 with DDCS concepts; free/open (best distribution target); flow is O-word not GOTO.

---

## Deliverable
Write `centroid.js` and `rs274ngc.js` mirroring the anchor. Node-sanity-check if you can. Report verified vs
`TO CONFIRM` for each. Do not touch any other file.
