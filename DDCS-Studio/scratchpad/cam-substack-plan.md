# SUB-STACK CAM — recognize the standard INSIDE the custom (declare-aligned)

Branch: `feat/cam-builder` · Scope: **planning only** (no source edits) · Repo: `DDCS-Studio/web`
Sibling: `cam-universal-plan.md` (the `stackToSlot` unroll+expose engine this plan composes ON TOP of).

## Headline (TL;DR)
1. **The composition is FLAT — this is the make-or-break finding.** A forked custom op's `template` is a flat atom stack (`user_root.children`) with NO nested declared "this part is surfacing" unit (surfacingData.js:116-140; saveAsCustomOp -> userOpFromStack, devMode.js:612/617). Standard-op recognition today is a READ of the pristine twin's `opType` via the `opensAs` bridge (builtinTypeForTwin, wizardLibrary.js:141 -> camTypeOf, opCamMap.js:118) — and a fork gives the op a **fresh `user_<slug>` opType that is not an opensAs target**, so `camTypeOf` returns `{unsupported}` (opCamMap.js:146). There is literally nothing to read.
2. **So the north-star forces the design: MAKE the composition declare its sub-units.** Recognizing "surfacing is in here" from block shape is INFERENCE, which `[[custom-op-sim-intent-infer-vs-declare]]` (userOps.js:461-465) forbids. The fix is to add a DECLARED, transparent sub-unit container — in-grain with the app's existing declare-not-infer metadata blocks (sim/panel/simstart/formfield/layoutwidget/entry/toolsel).
3. **Mechanism = a new `opunit` container.** It carries `params.opType` (the forked-from standard op, e.g. `user_surfacing_data`) + a `defV` stamp, WRAPS the standard atoms as its `children`, and is TRANSPARENT at emit (add it beside `section`/`param_group`, blockEmitter.js:148 -> BYTE-IDENTICAL). Recognition becomes a READ of `opunit.params.opType`.
4. **Route per part (hybrid, reusing both engines):** walk `user_root.children`; each `opunit` -> its PARAMETRIC generator (camTypeOf -> CAM_GEN/generateOp, geometry stays a LIVE `#2600` loop); each maximal run of loose atoms -> `stackToSlot` unroll+expose (feed/coord/Z live via the `val()` seam, geometry baked).
5. **Compose into ONE slot with the substrate that already exists.** `buildSlotFromOps` (macrosApp.js:1038) already concatenates N generator bodies in order, allocates `#11xx`/`#2600` around siblings (`used`/`varOffset`), tags `f._op`, and re-applies tuned values — generalize its op list from "N program ops" to "N PARTS of one custom op." slotPack consumes the same `{name, fields, body}` unchanged.
6. **Prove it with one slice:** a hand-built def `user_root{ opunit(user_surfacing_data){surfacing atoms}, feed, move }` -> `subStackToSlot(def)` -> one slot where the surfacing raster is a LIVE `#2600` stepover knob AND the custom atom's feed is an exposed `#2600`, emitted in order.

---

## 1. GROUND TRUTH — the composition reality (cite file:line)

### 1.1 A "standard op" the user forks is a data-op TWIN, stored as a FLAT atom stack
`surfacingDataDef()` (surfacingData.js:116-140) builds the twin's def:
```
template = [ user_root {
    uiChildren: [ panel, sim, param_group ],
    children:   appendToolSel(appendEntry(surfacingStack(defaults)))
                // = [progstart, wcs, placeonstock{ stepdown{ surfacefill } }, progend, entry, toolsel]
} ]
```
The standard atoms are **flat** inside `user_root.children`. `bindings` map param names -> `(blockIndex,key)` into that flat stack, offset by `WRAP_PREFIX_COUNT = 4` (user_root+panel+sim+param_group; surfacingData.js:85-86). There is **no** nested "surfacing" marker — the "this is surfacing" identity lives ONLY in the def's `opType` string.

### 1.2 Recognition today is a READ of the twin's opType (works ONLY for the pristine twin)
`camTypeOf(op)` (opCamMap.js:118) reads `op.opType` -> `baseOf` -> `builtinTypeForTwin` (wizardLibrary.js:141, inverts the `opensAs` declaration on the built-in library entry, wizardLibrary.js:73) -> `surface`. `seedFromOp` (opCamMap.js:156) is PURE over `op.opType` + bare `op.params`. This is already declare-aligned — but it keys on the opType, not on the blocks.

### 1.3 Forking FLATTENS and LOSES the identity
`saveAsCustomOp` (devMode.js:560) -> `collectAuthoring(_ws)` -> `a.opRec.children` (the op's DO-chain atoms) -> `userOpFromStack(newType, name, a.opRec.children, bindings, ...)` (devMode.js:612/617). `userOpFromStack` sets `def.template = stripIds(stack)` (userOps.js:626-632). The new `opType` is a fresh `user_<slug>` deduped against existing (devMode.js:614-616). Net:
- new `template` = flat stack of the standard atoms **plus the user's added atoms**, no sub-unit boundary;
- new `opType` is **not** an `opensAs` target -> `builtinTypeForTwin(newType)=null` -> `camTypeOf`={unsupported} (opCamMap.js:146).
**A custom op that contains a standard part preserves NO declared sub-unit. Recognizing the standard part would require inference. The north-star forbids it.**

### 1.4 Does an op stack already nest sub-ops? NO (but the substrate is close)
- A program op is a transparent container `{ type:'op', opType, label, requires, params, children }` (opBuilders.js:96-101); emit just recurses its children (blockEmitter.js:135-139). A user op nests ONE transparent `user_root` inside that (emit recurses uiChildren then children, blockEmitter.js:142-147).
- Ops are **top-level siblings**, never op-inside-op — gestures bail on any nested op (programModel.js:82). So there is an existing 2-level transparent-container pattern (`op` -> `user_root` -> atoms) but **no** declared sub-op unit inside a custom op's body. `defVOf` (userOps.js:566) already stamps op versions for staleness (programModel.js:190) — reusable for the sub-unit stamp.

**Verdict: the composition does NOT declare its sub-units. Section 3 proposes the minimal change to make it declare — the big fork.**

---

## 2. THE DECLARE-ALIGNED MECHANISM

### 2.1 The new `opunit` container (mirrors the existing metadata-block family)
A block type `opunit` (working name), authored/read exactly like `sim`/`panel`/`simstart`/`formfield` are (declare, never infer):
- `params.opType` = the standard op this sub-stack IS (e.g. `user_surfacing_data`) — the thing that already has an `opensAs` -> generator bridge AND a registered def to re-instantiate.
- `params.defV` = the sub-unit's def version at wrap time (staleness/rebuild, matching defVOf, programModel.js:190).
- `children` = the standard atoms (the twin's exec stack, minus program framing where a sibling owns it).
- **Transparent at emit**: add `'opunit'` to the transparent set at blockEmitter.js:148 (`param_group`/`section`/...) -> it emits its children in order -> **byte-identical** to the same atoms loose. (`uniquifySafeRetractLabels` + `flattenBlocks` already walk `children`, so labels/bindings are unaffected.)

A forked op's template then reads:
```
user_root
  children:
    opunit(opType='user_surfacing_data', defV=N) { children:[progstart, wcs, placeonstock{stepdown{surfacefill}}, progend] }
    feed { rate:#var }      <- the user's added custom atoms (loose)
    move { z:#var, ... }
```

### 2.2 Recognition = a READ; the walk
`walkParts(user_root.children)` -> an ORDERED list of parts:
- `opunit` child -> `{ kind:'standard', opType, defV, params }` where `params` is re-derived from the sub-stack sockets via the standard def's `bindings` (a READ of the declared binding map — one source of truth; NOT inferred from emit text). Snapshot fallback in section 5 FORK 2.
- a maximal run of non-`opunit` atoms -> `{ kind:'custom', stack, bindings }` (the loose custom blocks between/around sub-units).
Order is walk order -> execution order is preserved.

### 2.3 Why this is in-grain (weighed against wizards-as-data)
`opunit` is just another DECLARED, emit-transparent container in the same family the app already ships (sim/panel/simstart/formfield/layoutwidget/section). It adds ZERO new emit semantics, round-trips through `flattenBlocks`, and keeps the "the form is a pure function of the blocks" invariant. The ALTERNATIVE — inferring surfacing from `surfacefill`+`stepdown` block shapes — is exactly the pattern the north-star bans (userOps.js:461-465). So the declare mechanism is not a detour from wizards-as-data; it IS wizards-as-data applied to sub-composition.

---

## 3. ROUTE PER PART + COMPOSE INTO ONE SLOT

`subStackToSlot(def)` (new, `web/data/subStackToSlot.js`, or folded into `stackToSlot.js`):
1. `parts = walkParts(def.template's user_root.children)` (section 2.2).
2. `used = new Set()`, `off = 0`. For each part in order:
   - **standard** -> `seed = seedFromOp({opType, params})` (opCamMap.js:156); `gen = generateOp(seed.camType, variant, used, off, declFromOp(part))` (macrosApp.js:1009 -> CAM_GEN or slotFromOp). Geometry stays a LIVE `#2600` loop (opToSlot/camMacroKit rasterClear/ringClear). Returns `{name, fields, body}`.
   - **custom** -> `gen = stackToSlot(subDef, decl, used, off)` (cam-universal-plan U0). Simple values (feed/coord/Z) exposed as `#2600` via the `val()` seam; geometry baked. Returns `{name, fields, body}`.
   - After each: `gen.fields.forEach(f => { used.add(f.idx); f._op = partIndex; })`; `off += gen.fields.length`.
3. Concatenate `parts[].body` IN ORDER (`parts.join()`), concat fields, one `name`, `slotPack.slotMacro`. This is EXACTLY `buildSlotFromOps` (macrosApp.js:1038-1060) — reuse it verbatim by handing it a `slot.ops` whose entries are the parts.

The composition substrate is already multi-part: `buildSlotFromOps` allocs around siblings + tags `f._op` + re-applies `op.values` (macrosApp.js:1040-1055). We only change WHAT fills `slot.ops`: today = N whole program ops; now = N parts of ONE custom op. No generator/slotPack change.

---

## 4. REUSE MAP

- **Standard route (premium, geometry LIVE):** `builtinTypeForTwin` (wizardLibrary.js:141) · `camTypeOf`/`seedFromOp`/`genFieldsFor`/`PARAM_ALIAS`/`DERIVE`/`ENUM_OPTIONS`/`NON_BAKEABLE` (opCamMap.js:39/60/86/77/97/156) · `CAM_GEN`/`generateOp`/`declFromOp` (macrosApp.js:1004/1009/1017).
- **Custom route (universal, unroll+expose):** `stackToSlot(def, decl, used, off)` + the emit-probe classifier (cam-universal-plan.md — MUST land first). Rides the `val()`/`num()` seam (util.js:17/2) via `instantiate` (userOps.js:428/442) + `emitMapped` (blockEmitter.js:328).
- **Compose substrate:** `buildSlotFromOps` (macrosApp.js:1038), `used`/`varOffset`/`f._op`/`applyOverridesToBody`/`canonicalRead` (macrosApp.js:1024/1025).
- **Pendant pack (unchanged):** `slotPack.slotMacro`/`engLine`/`mirrorVar`/`nextParam`/`fieldsFromMacro` (slotPack.js:73/60/20/33/140).
- **Authoring UI (unchanged shape):** the `cbm*` modal / `_authoring.ops[]` / `renderCbmTable` group-by-op / Expose-Bake radios + `bakeable` greying / Simulate (macrosApp.js:1115/1132/1149-1153/1262). One custom op now presents as its PARTS in that table.
- **Emit transparency + walk:** blockEmitter.js:148 transparent set; `flattenBlocks` (userOps.js:54); `defVOf` staleness (userOps.js:566, programModel.js:190).

---

## 5. FORKS FOR THE HUMAN (each with a recommendation)

**FORK 1 — THE BIG ONE: make the composition declarable, or stay flat + infer.**
Change the fork/compose path so a forked recognized op WRAPS its atoms in `opunit(opType, defV)` (a new transparent block + a change to `saveAsCustomOp`/`userOpFromStack`, devMode.js:612/617 + a Blocks-tab affordance rendering the boundary chip) **vs** leave templates flat and pattern-match the standard part from block shape.
**RECOMMEND: DECLARE via `opunit`.** Inference violates `[[custom-op-sim-intent-infer-vs-declare]]` outright; `opunit` is in-grain with sim/panel/formfield/simstart and emits byte-identical. Cost is real (new block type + fork-path change + editor UX + legacy re-fork) — hence surfaced as the decisive fork. WITHOUT this change the rest of the plan cannot legally recognize the standard sub-unit.

**FORK 2 — how the sub-unit carries its params.** Re-derive live from the sub-stack sockets via the standard def's `bindings` (DRY, one-source) **vs** a stored params snapshot on `opunit` (robust to internal edits) **vs** both.
**RECOMMEND: re-derive from sockets (declare-aligned READ) + treat the sub-unit as parametrically OPAQUE** (edit its values through the standard op's form; custom edits go in the loose atoms), with a **snapshot + `defV` stamp** as the staleness/rebuild fallback (matches defVOf, programModel.js:190). A user who hand-edits INSIDE the sub-unit breaks the binding map -> fall back to bake or refuse (honest).

**FORK 3 — sequencing vs `stackToSlot`.** `stackToSlot` (the custom-atom route) is PLANNED but not built. Build cam-universal-plan U0 FIRST and consume it **vs** ship an interim "bake ALL custom atoms to literals" that proves compose + the LIVE standard part now, minus the exposed custom feed.
**RECOMMEND: land U0 first**, but the interim bake-all is a safe fallback slice if U0 slips (still demonstrates the LIVE standard sub-unit inside a custom op).

*Lower-stakes forks:*
- **FORK 4 — where the boundary is authored:** automatic wrap on fork of a recognized op **vs** an explicit Blocks gesture ("mark this run as a sub-unit"). RECOMMEND: automatic on fork, with a VISIBLE editable boundary chip.
- **FORK 5 — sub-unit identity:** the forked-from twin opType (`user_surfacing_data`) **vs** the built-in base (`surfacing`). RECOMMEND: the twin opType (it already has the `opensAs` -> generator bridge + a registered def to re-instantiate).
- **FORK 6 — legacy already-forked ops** (no `opunit`): route entirely through `stackToSlot` (all unrolled, standard part NOT live) **vs** a one-time re-fork to gain the boundary. RECOMMEND: unroll-all for legacy + offer re-fork; never infer to rescue them.

---

## 6. PRIORITISED SLICED BUILD ORDER

- **S0 (prereq) — land cam-universal-plan U0:** `stackToSlot(def, decl, used, off)` proven on one base+atom (the custom-atom route).
- **S1 — PROVE THE COMPOSITION (engine only, no fork-UX yet).** Add `opunit` as a transparent emit type (blockEmitter.js:148) + byte-identical check. Hand-build a def `user_root{ opunit(user_surfacing_data){surfacing atoms}, feed, move }`. Write `subStackToSlot(def)`: walk -> parts -> route (standard -> generateOp, custom -> stackToSlot) -> compose via buildSlotFromOps allocation -> one `{name, fields, body}`. **VERIFY:** slotMacro renders; the surfacing raster stays a LIVE `#2600` stepover knob (loop intact); the custom atom's feed is an exposed `#2600`; Simulate traces; surfacing-then-move execution order preserved. *(The whole proof — a harness, no modal.)*
- **S2 — the walk + router as a pure fn** (`web/data/subStackToSlot.js`): classify each child (`opunit` -> declared standard; run-of-atoms -> custom group), handle N sub-units + N custom groups interleaved, in order.
- **S3 — the FORK PATH declares it.** `saveAsCustomOp`/`userOpFromStack` wrap a forked recognized op's atoms in `opunit` (+ defV). Blocks-tab renders the boundary chip. **VERIFY** a real fork -> save -> CAM-build round-trip on a forked surfacing.
- **S4 — wire into the CAM authoring surface.** `openCamAuthoring`/`makeAuthOp`/`generateOp` accept a custom op whose parts come from the walk; `renderCbmTable` groups rows by PART (standard part: generator fields, loop knobs LIVE, geometry bake-forced where a fold-driver; custom part: `val()`-exposable rows). Manifest carries `opType`+`defV` to rebuild. Table/toggles/preview/build/icon otherwise unchanged.
- **S5 — honesty + polish.** Per-part "standard (live) vs custom (unrolled)" badge; geometry-frozen reasons on custom rows (reuse `bakeable` greying, macrosApp.js:1153); staleness rebuild when a sub-unit's `defV` bumps.

---

## 7. THE HONEST LIMITS

- **Value is GATED on FORK 1.** If the fork path is not changed to declare `opunit`, there is nothing to read and the north-star forbids inferring the standard part — the plan cannot proceed legally. This is the single biggest risk.
- **Interleaving into a live loop is impossible.** Custom atoms BETWEEN passes of a standard loop (not before/after the whole sub-unit) can't be spliced into the generator's runtime WHILE loop — the "concatenate part bodies" model only interleaves at part boundaries. Such an edit forces bake-or-reject for the standard part.
- **A hand-edited sub-unit drifts.** Editing atoms INSIDE `opunit` (not just its form values) desyncs the standard def's bindings -> re-derivation breaks -> fall back to bake/refuse (declare it opaque, FORK 2).
- **Custom route inherits every `stackToSlot` limit** (cam-universal-plan section 6): `num()`-consumed leaves bake, fold-driving geometry bakes, transform-blocked XY bakes.
- **Legacy forks (pre-`opunit`)** have no declared boundary -> fully unrolled (standard part not live) unless re-forked; no inference to rescue.
- **Depth caveat carries over:** a standard sub-unit's depth stays LIVE only as its generator's loop knob; a custom-atom single-plunge Z is the only exposable custom depth (val, move.js) — stepdown drives a fold -> bake.

## Critical files for implementation
- `DDCS-Studio/web/blocks/userOps.js` — `userOpFromStack` (:626), `instantiate`/bindings (:428/442), `flattenBlocks` (:54), `defVOf` (:566): where the fork writes the template + where a sub-unit's live params are re-derived.
- `DDCS-Studio/web/blocks/devMode.js` — `saveAsCustomOp` (:560/612/617): the FORK path that must wrap the standard atoms in `opunit` (FORK 1).
- `DDCS-Studio/web/blocks/blockEmitter.js` — the transparent set (:148) `opunit` joins (byte-identical emit); `emitMapped` (:328) the custom route rides.
- `DDCS-Studio/web/data/opCamMap.js` — `camTypeOf`/`seedFromOp`/`builtinTypeForTwin` bridge (:118/156): the standard sub-unit's route to its parametric generator.
- `DDCS-Studio/web/ui/macrosApp.js` — `buildSlotFromOps`/`generateOp`/`renderCbmTable` (:1038/1009/1132): the compose-around-siblings substrate + the authoring surface generalized from N ops to N parts.
- *(new)* `DDCS-Studio/web/data/subStackToSlot.js` — the walk (`opunit` -> standard, runs -> custom) + per-part route + compose (depends on `stackToSlot.js` from cam-universal-plan).
