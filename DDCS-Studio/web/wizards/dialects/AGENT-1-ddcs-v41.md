# Agent 1 — DDCS V4.1 dialect

You are filling **one** controller dialect for DDCS Studio. Repo: `c:\Users\danse\APPS\ddcs-studio-project`.

## What you're doing
"Register the words per profile" — produce a binding that renders block-atom *intent* into **DDCS V4.1**'s real
G-code. One file. Mirror the verified anchor's exact shape.

## Read first (READ-ONLY — do not edit)
- `DDCS-Studio/web/wizards/dialects/SCHEMA.md` — the contract (method names + signatures).
- `DDCS-Studio/web/wizards/dialects/ddcs-expert-m350.js` — the verified ANCHOR. Mirror it exactly.

## Conflict avoidance (IMPORTANT)
- Write **ONLY** `DDCS-Studio/web/wizards/dialects/ddcs-v41.js` (a NEW file — you're its only author).
- Do **NOT** edit the anchor, `SCHEMA.md`, or any other `wizards/dialects/*.js` (other agents own those).
- Stay in your lane → zero merge conflicts.

## Ground truth — verify everything
**Dump:** `bridge/controllers/v4.1/assets/firmware/.../ddcsv4/` — plain-text macros: `probe-fix.nc`,
`probe-float.nc`, `probe-h.nc`, `macroMillRect.nc`, `slib-g.nc`, `slib-m.nc`.
**Var map:** `DDCS-Studio/web/data/default_vars_v41.js`.
Cite `file:line` in comments. Mark anything you can't confirm `TO CONFIRM` in `notes`. Return `[]` for folded primitives.

## Key fact
V4.1 is **≈ Expert M350 in FORM** but uses **different variable numbers** (runtime state at `#1500+`).

## Verified forms (pre-extracted — re-check TO CONFIRM)
- `programModel:'inline'`, `probeModel:'g31'`, `dwellUnits:'ms'`.
- `vars`: `dro:1500` (X#1500/Y#1501/Z#1502/A#1503), `wcsBase:1512` (stride **6**), `toolTable:1561`,
  `activeWcs:` TO CONFIRM, `ax:{X:0,Y:1,Z:2,A:3}`. **No probe status/trigger var** — result is the post-probe DRO `#1502`.
- **probeMove**: `G31 ${axis}${dist} L#682 Q1 K0 F${feed}`  (`probe-fix.nc:10`; `#682` = probe-selector param)
- **probeStatus**: `[]`  (no status var — `TO CONFIRM`; success read from post-probe DRO)
- **probeRead / readMachine**: `${var}=#${1500+ax}`  (`probe-fix.nc:11`)
- **machineMove**: `G53 ${axis}${ref}`  (`probe-fix.nc:6` `G0 G53 Z#102`)
- **setWorkOffset**: `G90 G92 ${axis}${value}`  (`probe-float.nc:7` — V4.1 uses **G92**, not the indirect write)
- **distMode** `G90`/`G91` · **dwell** `G04 P${ms}` · **endProgram** `M30` · **spindle** `M3 S${rpm}`/`M5` · **coolant** `M8`/`M9`
- **ifGoto**: `IF ${lhs}${op}${rhs}GOTO${label}` — **NO space before GOTO** (`probe-h.nc:7` `IF#101==0GOTO2`); ops `==`/`<=`/`>=`. **label** `N${n}`. (`WHILE#x<=#yDO2…END2` also exists.)
- **HMI** (hmiPrompt/hmiToast/hmiInput): `[]` `TO CONFIRM` — firmware uses `MarcoDialog "*.rc"`; `#1505` not confirmed on V4.1.

## Deliverable
Write `ddcs-v41.js` mirroring the anchor. Node-sanity-check the functions if you can. Report what you verified
vs what's `TO CONFIRM`. Do not touch any other file.
