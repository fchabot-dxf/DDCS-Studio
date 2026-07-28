# CAM Builder S1 — design proposal (GROUND + PROPOSE + GATE, t1037)

**No UI built this turn.** This gates the S1 design back to the advisor (who surfaces the mockup to the user). Branch `feat/cam-builder`.

## Headline
S1 = the first user-visible surface: seed a single-op CAM slot's **expose/bake field table** from an op already in the program, preview it inline, and Build it to a pack slot. The machinery is ~90% present — the CAM Pack Builder ALREADY has a structured op path (`slot.ops` manifest + op cards + `buildSlotFromOps` + a per-field value-override model + an inline-dockable preview engine). S1 adds: (1) an **expose/bake** column threaded through to `allocFieldsWith` (the S0 superset), (2) a **seed-from-program-op** entry (replacing the blank op-type picker), and (3) the **op→CAM-spec map** that is the real new work.

---

## GROUND (read-only, key line numbers)

### The CAM Pack Builder (web/ui/macrosApp.js)
- Panel `#macros_panel_cam` (L155-163); render host `#cam_slots` (L161); `renderCamBuilder()` L1098 (full innerHTML rebuild L1105); actions delegated on the host (input L1210 / click L1227 / change L1292).
- `_camPack = { meta:{name,baseSlot=22}, slots:[] }`; key `ddcs_campack` (L974); `saveCamPack` L977.
- **Slot** = `{ slot, name, wcs, fields[], body, ops[], bodyDirty, icon }`. **fields[]** each = `{key,idx,var,label,units,def,min,max,type,_op}`. **ops[] manifest** = `[{type,variant,values?}]` where `op.values[key]={def,min,max,label,units}` (the already-persisted per-field tuning; cols = `FIELD_OVR_COLS` L1010).
- `buildSlotFromOps(slot)` L1028 → loops `slot.ops`, `generateOp(op.type,op.variant,used,fields.length)` L1033, threads the `used` #11xx set (L1030/1036), tags `f._op=oi` L1037, applies `op.values` overrides (L1037-1041), rebuilds `slot.fields/body/name`.
- `generateOp` L1007 = `CAM_GEN[type](used,off,variant)` else `slotFromOp(type,variant,used,off)`. `CAM_GEN` L1003 = {corner,edge,zprobe,inside,boss,align,pocket,cpocket,surface}.
- `simulateSlot(slot)` L1178 → `createPreviewPanel(host,{getGcode,createVarStore})` (viz/createPreviewPanel.js L150) — **inline-dockable** (currently just mounted in a throwaway fixed overlay L1187-1199). Returns `{setActive,stop,setGcode,refresh,viz,engine,el}`.
- `nextSlotNum()` L1312 (first free >= baseSlot 22); add-slot pushes a bare slot L1314. Op cards `opCardsHtml(slot)` L1075; blank op picker `addOpClusterHtml()` L1095 + `addop` handler L1235 (pushes `{type,variant}` → buildSlotFromOps, defaults only).

### The generator pipeline (probeToSlot / millToSlot / opToSlot / slotPack)
- 9 generators call `allocFields(SPEC,used,varOffset)` → `{fields,v}`, build a PARAMETRIC macro interpolating `v[key]` (a #var string) into IF/arith/helper lines, return `{name,fields,body}`. The 10th path (`slotFromOp`, opToSlot.js:123) has a bespoke INLINE alloc loop (L127) — same shape, must gain the same hook.
- Baking works with ZERO generator change beyond the alloc swap: `allocFieldsWith` sets `v[key]=String(value)` for a baked param, so the same interpolation site emits the literal; the read line vanishes (`fields.map(readLine)` no longer includes it) and the pendant eng line vanishes (`slotEng` maps `slot.fields`). `engLine` (slotPack.js:60) is **NUMERIC-ONLY** (`-t0` int / `-t1` decimal + min/max/label/units) — no enum type (plan addendum confirmed).

### The seed source (programModel / opRecord / opSession)
- Program stack: `getStack()` (programModel.js:29), global `window.ddcsGetBlockProgram` (L244). An op = `{id,type:'op',opType,label,requires,params,children}` (opBuilders.makeOp L96). **`op.params` is the single source of truth** (deep-cloned wizard form values).
- Selection (`selectedId`, blocksApp.js:483) is **PRIVATE** to the Blocks-tab closure — not exported, not global. Last-generated op = `getLastOp()` (opRecord.js) → `{type,params}`, globally reachable.
- **TWO gaps that ARE the core of S1** (no such map exists yet):
  1. **opType != CAM-type**: `surfacing`->`surface`, `middle`->`inside`/`boss`, `contour`-> NO generator; `pocket/corner/edge/drill/bore/slot` match. Must be a DECLARED lookup.
  2. **param keys are wizard-PREFIXED** (`p_w`, `sf_depth`, `sf_stepoverPct`) vs generator field keys BARE (`w`, `depth`, `stepover`). Seeding needs a prefix-strip + a small semantic alias map per op type.

---

## PROPOSED S1 (gate this back — do NOT build yet)

### Where it lives — plan rec 5: an IN-PANEL "Build CAM slot" mode
A new mode inside the existing CAM Pack Builder panel (NOT a separate tab), so the pack tree / install / zip stays the one home. The existing per-slot field table (renders `slot.fields`) is UNTOUCHED (legacy slots byte-identical). The new mode renders a **spec-driven** expose/bake table for ONE seeded op, then Builds a slot into `_camPack.slots`.

### The flow
```
  [+ Build CAM slot]  (new button next to "+ Add slot")
        |
        v
  seed from a PROGRAM OP  ->  map opType->CAM type  ->  strip/alias param keys
   (getStack, CAM types only)     (DECLARED table)       (DECLARED alias table)
        |
        v
  expose/bake FIELD TABLE  (the #1 GUI element) + inline preview
        |
        v
  [Build CAM slot ▸]  ->  slot-confirm modal (new cam-N vs overwrite)  ->  push into _camPack.slots + saveCamPack
```

### The expose/bake field table (the #1 GUI element)
```
+- Build CAM slot ------------------------------------------------ [x] -+
| Seed from program op:  [ Pocket (rect)        v ]  <- ops in program  |
|                         (only CAM-supported types listed)            |
| Slot name: [ Pocket ]                                                 |
+----------------------------------------------------------------------+
| FIELD TABLE   (this becomes the operator's pendant form)             |
| +------------+---------+-------------+----------------------------+  |
| | Param      | Value   | On pendant? | Pendant slot               |  |
| +------------+---------+-------------+----------------------------+  |
| | Width  W   | [ 80  ] | (o) Expose  | #1100 -> #2600             |  |
| | Height H   | [ 60  ] | (o) Expose  | #1101 -> #2601             |  |
| | Depth      | [ 4   ] | (o) Expose  | #1102 -> #2602             |  |
| | Stepdown   | [ 1.5 ] | (o) Expose  | #1103 -> #2603             |  |
| | Feed       | [ 2000] | ( ) Bake    | baked = 2000  (no pendant) |  |
| | Tool O     | [ 6   ] | (o) Expose  | #1104 -> #2604             |  |
| | Guard: SO  | [ ...  ] | Expose-only | drives IF..GOTO (safety)   |  |
| +------------+---------+-------------+----------------------------+  |
|  Expose = operator fills it on the pendant (#11xx -> #2600 mirror).  |
|  Bake   = frozen into the macro; the row vanishes from the pendant.  |
+----------------------------------------------------------------------+
| INLINE PREVIEW      [ > Simulate ]     (createPreviewPanel, docked)  |
| +------------------------------------------------------------------+ |
| |    3D toolpath of the slot macro (seeded from field defaults)    | |
| +------------------------------------------------------------------+ |
+----------------------------------------------------------------------+
|                         [ Build CAM slot > ]                         |
+----------------------------------------------------------------------+

Build -> slot-confirm modal (reuse dlgConfirm styling):
  +- Build to which slot? -------------------+
  | (o) New slot   cam22                     |
  | ( ) Overwrite  [ cam23  Pocket      v ]  |
  |               [ Cancel ]     [ Build ]   |
  +------------------------------------------+
```
The table drives from the op's FULL spec (every param is a row) with per-row state = Exposed (in `slot.fields`) or Baked (a literal). Value edits map to `op.values[key].def`; the Expose/Bake toggle maps to `op.exposed[key]`/`op.baked[key]`.

### Persistence + Build
`op = { type, variant, values, exposed{key:bool}, baked{key:val} }` in `slot.ops` (exposed/baked are NEW siblings of the existing `values`). Build = `nextSlotNum()` (or the chosen overwrite slot) -> push/replace into `_camPack.slots` -> `saveCamPack()` -> `renderCamBuilder()`. All downstream (eng field-table, Simulate, zip export, Merge, install) is already wired.

---

## NAMED THREAD POINTS (for the later build slice — not this turn)
1. **decl plumbing**: `generateOp` (macrosApp.js:1007) gains a `decl` arg -> `CAM_GEN[type](used,off,variant,decl)` / `slotFromOp(type,variant,used,off,decl)`. `buildSlotFromOps` (L1033) builds `decl={key:{exposed,value}}` from `op.exposed`/`op.baked`. The "Add op" path (L1242) passes `decl` too.
2. **9 generators**: swap `allocFields(SPEC,used,varOffset)` -> `allocFieldsWith(SPEC,used,varOffset,decl)` at probeToSlot.js {96,208,256,321,395,478} + millToSlot.js {68,104,135}. (S0 already proved all-exposed == today byte-for-byte.)
3. **opToSlot.js:127**: the inline alloc loop gains the same bake branch (preserving its `holeDia` default override + `order` composition) — or is refactored onto `allocFieldsWith` with those preserved.
4. **NEW declared maps** (the core of S1): `OPTYPE_TO_CAM` (surfacing->surface, middle->inside/boss, ...) + per-CAM-type `PARAM_ALIAS` (wizard-prefixed -> bare key) + a `NON_BAKEABLE` guard-param set per spec.
5. **NEW render**: the in-panel Build-CAM-slot mode (spec-driven expose/bake table + docked `createPreviewPanel`). The existing per-slot field table + `addOpClusterHtml` blank picker stay.

---

## GATE — forks + one safety finding to rule before building

**SAFETY FINDING (G1, not optional): guard params must be non-bakeable.** Some params feed `IF..GOTO` guards/branches (surfacing `IF stepover LE 0`, corner `corner`/`seq`/`probeZ` sign+branch selects). Baking one bakes the branch -> a wrong/omitted path = wrong G-code. So S1 MUST ship a minimal DECLARED per-spec non-bakeable set (render those rows "Expose-only", greyed Bake). This is the safety floor of plan decision #2; the richer per-spec allow-list UX can wait for S3.

**FORK 1 — the seed source.** (Decision sieve: G3 one-source favors A.)
- **(A) [RECOMMEND] A "Seed from program op" picker** listing the ops in `getStack()` filtered to CAM-supported types; maps opType->CAM type, strips/aliases param keys, overlays values. Reads the global stack (the single source of truth) — matches the user's "import an inserted program then extrapolate the table" model. No private-selection or cross-tab plumbing.
- (B) Export `getSelectedOp()` from blocksApp (the Blocks-tab click selection). Richer (click any block) but the CAM builder is on the MACROS tab -> cross-tab selection is awkward, and `selectedId` is a private closure var needing new plumbing.
- (C) `getLastOp()` only (the one op just generated). Simplest, but limited to a single op — can't pick among several already inserted.
Recommend **A** — G3-clean (reads the SoT, no snapshot), and it IS the "extrapolate from the inserted program" mental model.

**FORK 2 — enum params in S1, or defer?** Enum params (corner/wcs/direction/strategy) want a Studio DROPDOWN + enum<->int mapping (plan addendum, HIGH priority) because the pendant is numeric-only. S1's acceptance bakes `fast` (numeric) and needs no enum. 
- **(A) [RECOMMEND] Defer enums to S3** (the grouped field-table slice folds in the addendum): S1 renders numeric rows + the expose/bake toggle, proving the mechanism end-to-end. Enum rows show as a plain numeric field for now (documented options in the label, as today).
- (B) Fold the enum dropdown + int-map into S1 now. Bigger S1; the addendum is real work (a new field-spec `type:'enum'` with options + the authoring widget + the engLine/read mapping).
Recommend **A** (keep S1 tight to the acceptance; enums are their own slice) — but flag it because the user called the field table "the most important GUI element" and enums make it rich.

**STRUCTURAL VERDICT (dispatch asked to gate if awkward): NOT structurally awkward.** The in-panel mode fits the existing structured-op path cleanly; op-to-spec seeding is a MISSING DECLARED MAP (cheap to declare, squarely declare-not-infer), not a structural mismatch. No structural gate — proceeding to the two value/scope forks above + the one safety requirement.
