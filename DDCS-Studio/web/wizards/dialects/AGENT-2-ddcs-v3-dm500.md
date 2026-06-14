# Agent 2 — DDCS V3 / DM500 dialect

You are filling **one** controller dialect for DDCS Studio. Repo: `c:\Users\danse\APPS\ddcs-studio-project`.

## What you're doing
"Register the words per profile" — produce a binding that renders block-atom *intent* into **DDCS V3 / DM500**'s
real G-code. One file. Mirror the verified anchor's exact shape.

## Read first (READ-ONLY — do not edit)
- `DDCS-Studio/web/wizards/dialects/SCHEMA.md` — the contract (method names + signatures).
- `DDCS-Studio/web/wizards/dialects/ddcs-expert-m350.js` — the verified ANCHOR. Mirror it exactly.

## Conflict avoidance (IMPORTANT)
- Write **ONLY** `DDCS-Studio/web/wizards/dialects/ddcs-v3-dm500.js` (a NEW file — you're its only author).
- Do **NOT** edit the anchor, `SCHEMA.md`, or any other `wizards/dialects/*.js` (other agents own those).
- Stay in your lane → zero merge conflicts.

## Ground truth — verify everything
**Dump:** `bridge/controllers/dm500/install/` — `probe.nc`, `defprobe.nc`, `slib.nc`, `safez.nc`, `gotoz.nc`,
`pause.nc`, `m30.nc`, `eng`. **Comments are garbled encoding — read the G/M-code ONLY.**
**Var map:** `DDCS-Studio/web/data/default_vars_v3.js`.
Cite `file:line`. Mark unconfirmed forms `TO CONFIRM`. Return `[]` for folded primitives.

## Key fact
DM500 is **STRUCTURALLY different** from Expert: move-until-input probing (no G31), `#864+` DRO, G92 WCS,
**dwell in SECONDS**, and **word IF operators (EQ/LT/GT — no `!=`)**.

## Verified forms (pre-extracted — re-check TO CONFIRM)
- `programModel:'inline'`, `probeModel:'move-until-input'`, `dwellUnits:'s'` (**seconds, not ms!**).
- `vars`: `dro:864` (X#864/Y#865/Z#866/A#867); WCS offset table `#800-827` (G53 base #800-803; G54-59 deltas
  #804-827, selected via `#455`/`#516`); no probe status/trigger var; `ax:{X:0,Y:1,Z:2,A:3}`.
- **probeMove** (THREE lines): `M101` / `G91 G01 ${axis}${dist} F${feed}` / `M102`  (move-until-input; `probe.nc:23-25`)
- **probeStatus**: `[]`  (implicit — motion halts on input; no status var)
- **probeRead / readMachine**: `${var}=#${864+ax}`  (`probe.nc:4-6`)
- **machineMove**: `G53 ${axis}${ref}`  (G53 gated by config `#395`; the dump's safe-Z is `M98 P101` subprogram → `TO CONFIRM`; prefer G53, note the `M98 P<n>` alternative in `notes`)
- **setWorkOffset**: `G90 G92 ${axis}${value}`  (`defprobe.nc` — G92 zeroing; G10 not used)
- **distMode** `G90`/`G91` · **dwell** `G04 P${sec}` (**seconds**) · **endProgram** `M30` (`m30.nc` is empty → controller default) · **spindle** M3/M4/M5 · **coolant** M8/M9
- **ifGoto**: **WORD operators** — map `==→EQ`, `<→LT`, `>→GT`, `>=→GE`, `<=→LE`. **`!=`/`NE` does NOT exist** — for `!=`, emit a `notes` warning + best-effort (LT/GT workaround). e.g. `IF #455EQ0GOTO3`. **label** `N${n}`. (`*` between `[ ]` predicates = AND.)
- **HMI** (hmiPrompt/hmiToast/hmiInput): `[]` — no scripted operator prompt (pause hook = a Z-lift only).
- Subprograms: `M98 P<n>` / `M99`, O-numbered (`slib.nc`).

## Deliverable
Write `ddcs-v3-dm500.js` mirroring the anchor. Node-sanity-check if you can. Report verified vs `TO CONFIRM`.
Do not touch any other file.
