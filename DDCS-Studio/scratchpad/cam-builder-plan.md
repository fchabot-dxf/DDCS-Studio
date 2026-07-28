# CAM Builder Authoring Wizard — build plan (from the architect pass, t1028)

## Headline
~70% already exists (the CAM slot machinery in `ui/macrosApp.js` + `data/*Slot.js`). The wizard is a new ARRANGEMENT of existing pieces + ONE new concept: **expose vs bake** per param.

## Critical architecture clarification (open Q#7)
Two DISTINCT op-stack IRs exist — do NOT conflate:
- **Blocks op stack** (`blocks/programModel.js` getStack → emitMapped) = UNROLLED, fixed-size toolpaths. WRONG output for CAM.
- **CAM slot op manifest** (`slot.ops=[{type,variant,values}]`, `macrosApp.js:1028 buildSlotFromOps` → CAM_GEN generators → parametric looping macro reading #2600+). This is the CAM source of truth.
→ The wizard reuses the CAM slot op MANIFEST as its source, and only IMITATES the blocks composition UX + marker round-trip pattern. (millToSlot.js:5-8: a CAM slot must be PARAMETRIC, not an unrolled port.)

## The crux — field-table declaration (expose/bake)
Today `allocFields(spec,used,off)` (probeToSlot.js:50) maps EVERY spec param → a #11xx knob + #var mirror → 100% operator-fillable, no bake.
NEW: `allocFieldsWith(spec,used,off,decl)` where decl={key:{exposed,value}}:
- exposed → unchanged (nextParam → #11xx, mirror #2600, field pushed, v[key]='#n').
- baked → NO nextParam, NO field, v[key]=literal. Generators already interpolate v[key] as a string → baking is a 1-line substitution. slotMacro/slotEng emit read/eng lines ONLY for existing fields → baked params vanish from macro-reads + pendant.
- decl omitted / all-exposed = BYTE-IDENTICAL to today.
Persist on the source: op.exposed{key:bool} + op.baked{key:val}, threaded via buildSlotFromOps→generateOp.
#2600 map: mirrorVar(idx)=idx+1500 (#1100→#2600); only exposed call nextParam → baking reduces pool pressure. Collision/validate machinery unchanged.

## Author→pack feed (reuse install path, + the user's Build-modal)
Pack = `_camPack={meta,slots[]}` in localStorage. Wizard produces ONE slot → push/replace into _camPack.slots + saveCamPack() (same as cam_add_slot :1313). Slot number via nextSlotNum() (baseSlot 22; cam0-21 reserved).
USER DETAIL: "Build CAM" opens a MODAL confirming WHICH slot (new cam-N vs overwrite existing) before writing. Then all downstream (field table, Simulate, zip export macro_camN.nc+camN.bmp+eng, Merge eng, install README) is already wired.

## Reuse (do NOT rebuild)
camMacroKit (raster/ring/probe primitives), slotMacro/slotEng/engLine/mergeEng, all CAM_GEN generators, buildSlotFromOps, nextParam/usedParams/validatePack, createPreviewPanel (the SAME editor/wizard preview engine — simulateSlot:1178), autoIconBmp/openIconEditor/bmpDataUrl, the pack tree + zip + eng-merge + install.

## NEW (build this)
1. Authoring-wizard shell (op picker → op cards [opCardsHtml:1075 liftable] → field-table w/ expose-bake → inline preview → icon → Add-to-pack).
2. allocFieldsWith (probeToSlot.js) + thread op.exposed/op.baked through generateOp/buildSlotFromOps; opToSlot.js:127 needs the same hook.
3. expose/bake UI (checkbox column on the field table, or a checklist).
4. (optional) `cam-slot` marker for round-trip (imitate progMarkerLine/progBlocksFromMarker).
5. Inline preview host (dock createPreviewPanel in the wizard vs the throwaway overlay).

## Build order (slices, each reviewable, byte-identical where possible)
- **S0**: allocFieldsWith == allocFields when all-exposed (pure-fn, no UI, byte-identical safety net).
- **S1**: single-op slot + expose/bake one param + inline preview + Add-to-pack. All-exposed == today byte-for-byte; baking `fast` removes its read+eng line + inlines the literal.
- **S2**: multi-op composition (op cards, reorder/dup/delete, params allocated around the pack).
- **S3**: grouped field-table (by owning op f._op) + icon (autoIcon/iconEditor) + validatePack before add.
- **S4** (optional): round-trip marker.
Expert-only throughout.

## DECISIONS NEEDED (human rulings)
1. #2600 index stability: baking then re-exposing reallocates #11xx → breaks an INSTALLED pack's operator values. Rec: pin a param's #11xx after first export (op.idxPin).
2. Mandatory-exposed/baked allow-list? Some params drive GUARDS/branches (probe corner branch, surfacing `IF stepover LE 0`) — baking bakes the guard. Rec: a per-spec exposable/bakeable allow-list, not free choice on every param.
3. Round-trip: ship the cam-slot marker (full author round-trip) or one-way authoring for v1?
4. Icon for a multi-op slot: label by primary op, or author picks?
5. Wizard lives WHERE: new Macros-tab panel vs an in-panel "Compose new slot" mode (rec: in-panel mode so the pack tree/install stays the one home).

## Critical files
probeToSlot.js (allocFields → the expose/bake change) · macrosApp.js (buildSlotFromOps/renderCamBuilder/generateOp/simulateSlot/nextSlotNum) · slotPack.js (mirrorVar/nextParam/engLine/slotMacro/mergeEng) · millToSlot.js (generators) · programModel.js (marker pattern to imitate).

## ADDENDUM (user t1030) — the field-table is the #1 GUI element; support DROPDOWNS
Reality: the DDCS pendant eng field-table is NUMERIC-ONLY (engLine slotPack.js: -t0 integer / -t1 decimal + min/max/label/units; NO enum field type). Current CAM specs (millToSlot.js) are all numeric.
SO: enum params (corner/direction/strategy/wcs) get a DROPDOWN in the STUDIO authoring table (author-friendly), and Studio maps the pick <-> an INTEGER; when EXPOSED, the pendant shows a numbered choice (0..N) with the eng label documenting the options; when BAKED, no pendant entry.
NEW (fold into the plan as first-class): an ENUM field type on the field spec carrying {options:[{label,value}]}, the authoring-table dropdown widget (reuse formWidgets enum), and the enum<->int mapping for engLine + the macro read. The authoring table becomes the rich GUI; the pendant stays numeric with documented options. Priority: HIGH (user: "the table is the most important gui element").

## STATUS (user t1030): FUTURE PROJECT — own branch
Deferred to a future project, built on its OWN BRANCH (isolate the multi-slice authoring surface from the main release line). This plan + addenda are the ready spec — no re-planning when it starts.

## FUTURE-CAM IDEA (user t1030) — path to WHOLE-APP CAM compatibility
User idea: make the whole app CAM-compatible by associating every param with a numeric register (#2600+). Assessment:
- HALF works: numeric-association substitutes #2600 into the emit — OK for params appearing LITERALLY in a move (feed F#2600, per-move depth Z#2600, spindle S#2600).
- CATCH: GEOMETRY params (width/stepover/count/positions) need the toolpath RECOMPUTED at runtime by a LOOP macro — cannot #2600-substitute unrolled moves into that. This is why millToSlot writes a separate PARAMETRIC macro ("not a verbatim port").
- The clean split: SIMPLE ops (line/move/drill/single-feature/bolt-circle) = numeric-association makes them CAM-able almost for FREE; COMPLEX ops (pocket raster/contour/surfacing) = need the recompute-loop macro (exists for mill/probe via millToSlot, per-op work for the rest).
- PATH: (1) universal param↔#2600 association (cheap, do it, picks up the simple ops) + (2) a parametric-emit variant per complex op (real, op-by-op). The CAM Builder authors the ops that HAVE the parametric emit; this idea extends the param side everywhere.
