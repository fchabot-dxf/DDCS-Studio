# BLOCK-NATIVE CAM PARAMS — make the pendant/form param declaration a BLOCK, not a modal

Branch: `feat/cam-builder` · Scope: **planning only** (no source edits) · Repo: `DDCS-Studio/web`
Siblings: `cam-universal-plan.md` (the `stackToSlot` unroll+expose engine) · `cam-substack-plan.md` (the `opunit` sub-unit boundary). This plan sits ON TOP of both — it moves the *field declaration* those engines synthesize into declared blocks.

## Headline (TL;DR)
1. **The precedent for the whole feature already ships: `formfield`.** `formFieldBlock` (wizards/ops/formField.js:17) is a DECLARED, emit-nothing metadata block in the `user_root` PRESENTATION mouth that IS the blocks-native twin of a binding-spec row, round-tripped by `bindingsFromStack`/`bindingsToBlocks` (userOps.js:292, slotPack side). Both halves of this feature are "another `formfield` for another presentation face" — a `cam_field` for the PENDANT face, and populating `param_group` for the FORM face. The family (metadata block · emits `[]` · lives in the Presentation mouth · round-trips) is proven.
2. **The crux one-source split is clean because the code already separates WIRING from PRESENTATION.** A def's `bindings` entry is `{param, blockIndex, key, type, default, label, units, widget}` (cleanBinding, userOps.js:111; extractParamBlocks, :143). The `blockIndex/key` half is pure WIRING (which socket carries the `#var`); the `label/widget/units/default` half is PRESENTATION. The split: **the binding keeps blockIndex+key+param+type; the field BLOCK owns label + expose/bake + pendant-name + order + min/max**. No duplication — each side owns one concern.
3. **Today the pendant field declaration is SCATTERED across three places, none of them a block** — that is the problem this feature fixes. Shape+role come from `def.bindings` + `classifyExposable` (exposeClassifier.js:61); the per-op expose/bake/value tuning lives in the in-memory `_authoring.ops[]` and the persisted `slot.ops[]` manifest maps `exposed`/`baked`/`values` (macrosApp.js:1143/1180-1188/1190); the pendant label/units/min/max ride the derived `slot.fields` (buildSlotFromOps, macrosApp.js:1058) into the `.eng` sidecar (`slotEng`→`engLine`, slotPack.js:69/62) and the `#2600` reads (`slotMacro`→`mirrorVar`, slotPack.js:75/22). **The blocks become the single declaration; `slot.fields`/`.eng`/`#2600` emit FROM them.**
4. **New schema = a `cam_table` container + `cam_field` rows, plus a `bindings→formfield` populator for `param_group`.** `cam_table` joins the transparent metadata-container family (param_group/section/opunit, userRoot.js:24/39/55); each `cam_field` references a def value-binding by param name and carries pendant-label + expose|bake + order + min/max. Both emit `[]` — read at CAM-build time by a new `camFieldsFromStack(template)` (the mirror of `bindingsFromStack`).
5. **Block order = pendant row order for free — the allocator is already order-driven.** `nextParam(used)` (slotPack.js:35) hands out `#11xx` in field-generation order, and `mirrorVar` maps `#11xx→#2600` (slotPack.js:22). Make the emit iterate the `cam_field` blocks in mouth order (instead of `def.bindings` pre-order) and reorder-in-the-mouth = reorder-on-the-pendant, no extra machinery.
6. **The modal becomes a VIEW.** `renderCbmTable` (macrosApp.js:1199) stops being the source of truth and instead renders the `cam_field` blocks; its Expose/Bake radios (`cbmToggle`, :1363) and value edits write the blocks. `buildSlotFromOps`→`slotPack` downstream is unchanged — it still consumes `{name, fields, body}`.
7. **Two honest walls the locked design must absorb (Section 10):** guarded/ported twins (corner/pocket/edge/middle) are `classifyExposable`-fail-closed (exposeClassifier.js:70/76) so their `cam_field`s can't be exposable yet; and expose/bake moving onto a DEF block makes it def-global, colliding with today's *per-slot* expose/bake — the plan keeps the manifest as an optional per-slot override (Fork C).

---

## 1. GROUND TRUTH — where a CAM field is declared TODAY (cite file:line)

### 1.1 The two binding shapes (this decides which block half aligns with what)
- **`def.bindings`** — the WIRING map `{param, blockIndex, key, type, default, label, units, widget}` (cleanBinding, userOps.js:111). Built by `extractParamBlocks` from param PILLS in value sockets (userOps.js:143), or hand-assembled by a data-op twin (`surfacingDataDef` → `{opType,label,template,bindings}`, surfacingData.js:114). This is what `instantiate` (userOps.js:436/451), `classifyExposable` (exposeClassifier.js:61), `stackToSlot` (stackToSlot.js:49) and `seedUniversal` (opCamMap.js:178) all read. **The value bindings are the CAM param universe.**
- **`def.bindingSpecs`** — the richer FORM spec (deriveBindings rows), round-tripped by the `formfield` block via `bindingsFromStack` (userOps.js:292). Only the guarded ports (corner/pocket/edge/middle) carry it, and `classifyExposable` **fails closed** on any def that has it (exposeClassifier.js:70/76 — "expose NOTHING… fail-closed").

**Consequence:** the CAM-table half rides `def.bindings` (value bindings). The `param_group`-populate half is the FORM face of those same bindings. `formfield` is spec'd against `bindingSpecs`+var-identity `match:{type:'assign',var}` (formField.js:7), which does NOT address a `(blockIndex,key)` value binding — so it is a *precedent for the pattern*, not a drop-in for the socket link (Fork B).

### 1.2 The field-declaration is scattered — three owners, zero blocks
1. **Shape / role / exposability** — derived from `def.bindings` by `classifyExposable` (value-role via atomRoles.js:113 + no blocking fold, exposeClassifier.js:24/61). Not editable, not persisted, not a block.
2. **Per-op expose/bake/value** — the in-memory authoring op `{opType,camType,variant,fields,values,exposed,baked,label}` (makeAuthOp, macrosApp.js:1176-1188) and the persisted manifest `toManifest → slot.ops[]` (macrosApp.js:1190). `exposed[key]===false ⇒ baked`, `baked[key]` = the frozen literal (declFromOp, macrosApp.js:1032). This is the real "is it a pendant field?" declaration today — and it is a per-SLOT map, not a def block.
3. **Pendant label / units / min / max / default** — carried on the generated `slot.fields` (buildSlotFromOps, macrosApp.js:1058-1079), overridable per-slot via `FIELD_OVR_COLS = ['label','units','def','min','max']` (macrosApp.js:1028) stored back on `op.values[key]`.

### 1.3 The emit path a block must feed (unchanged downstream)
`buildSlotFromOps` (macrosApp.js:1058) → `generateOp` (macrosApp.js:1020: `stackToSlot`/`subStackToSlot`/generator arms) → each returns `{name, fields, body}` where a field is `{key, idx, var, label, units, def, min, max, type, exposable}` (stackToSlot.js:57). Then:
- **`.eng` sidecar** — `slotEng(slot)` → `engLine(f, slot.slot)` (slotPack.js:69/62): `#<idx> … =<def> -t… -s1"<label>" -s2"<units>" -m<slot+20> -min -max`. Emitted at export (macrosApp.js:1606/1661/1673) and merged safely via `mergeEng` (:1691, slotPack.js:147).
- **`#2600` mirrors** — `slotMacro(slot)` (slotPack.js:75) prepends `#<var>=#<mirrorVar(idx)> ;<label>` reads (`mirrorVar` `#1100→#2600`, slotPack.js:22); `hasReads` (slotPack.js:82) skips re-prepending when the body already carries them (stackToSlot prepends its own, stackToSlot.js:68).
- **Reverse (Refresh-fields)** — `fieldsFromMacro` (slotPack.js:202) re-derives fields from `#var=#26xx ;comment` reads → so the block↔field↔macro grammar must stay canonical (`canonicalRead`, macrosApp.js:1044).

### 1.4 The block-rendering + transparent-emit substrate (what a new container costs)
- A metadata container is declared by `kind` and rendered by `jsonDef` (bridge.js:195): `param_group`/`section`/`opunit` each get a titled `DO` mouth (bridge.js:241) and emit their children transparently (userRoot.js:32/46/63). Adding `cam_table` is one entry in the same switch (a new `kind` + `addMouth('DO')`).
- A metadata LEAF that emits nothing = `emit: () => []` (formField.js:36). `cam_field` is that.
- Per-instance chrome (friendly label, read-only routing key) is a Blockly extension — `ddcs_opunit` (bridge.js:397) and `ddcs_seccolor` (bridge.js:381) are the templates for a `cam_field` chip that shows its param + expose/bake state.
- Colour is category-driven: `style: catSlug(def.category)+'_style'` (bridge.js:228); `Wizard UI → wizardui → #d946ef` fuchsia (theme.js:15).

**Verdict:** every mechanism the feature needs already exists as a shipped pattern. The work is *composition + one relocation of state* (modal→blocks), not new machinery.

---

## 2. THE BLOCK SCHEMAS

### 2.1 `cam_table` — the pendant-field C-mouth container (new)
Joins the transparent metadata family (userRoot.js:24/39/55). Lives in the `user_root` PRESENTATION mouth beside `param_group` (NOT a new user_root mouth — see Fork A).
```
export const camTableBlock = {
  type: 'cam_table', label: 'CAM Pendant Fields', category: 'Wizard UI', kind: 'cam_table',
  hidden: false,                    // draggable from the palette (unlike opunit) — a wizard opts in to pendant fields
  defaults: {},
  fields: [],
  emit: () => [],                   // metadata only — read at CAM-build by camFieldsFromStack; NOT transparent-emit (it declares pendant rows, it is not G-code)
};
```
- `jsonDef` gets one arm: `else if (kind === 'cam_table') addMouth('DO')` (bridge.js:241) — a titled DO mouth holding `cam_field` rows.
- NB it is **emit:`[]` not transparent-passthrough** — its children are declarations, not atoms; unlike `param_group` (which wraps Set-Variable *atoms*), `cam_table` holds only `cam_field` metadata rows.

### 2.2 `cam_field` — one pendant field row (new)
The PENDANT face of a value binding. References the def param by NAME (the binding `param`), the same key `stackToSlot`/`declFromOp` already address by.
```
export const camFieldBlock = {
  type: 'cam_field', label: 'pendant field', category: 'Wizard UI', kind: 'cam_field',
  help: 'One controller (pendant) field for a CAM slot. Expose = the operator fills it on the pendant (#11xx→#2600); Bake = frozen into the macro. Order in the mouth = pendant row order.',
  defaults: {
    param:  '',        // which def value-binding this row is (matches binding.param) — the ROUTING KEY, read-only chip
    label:  '',        // pendant -s1 label (empty = inherit binding.label)
    mode:   'expose',  // 'expose' | 'bake'   (Fork D: one field vs two block types)
    baked:  '',        // the frozen literal when mode==='bake' (else ignored)
    units:  '',        // pendant -s2 units (empty = inherit binding.units)
    dflt:   '',        // pendant default seed (empty = inherit binding.default)
    nmin:   '', nmax: '',   // pendant editable range (-min/-max)
  },
  fields: ['param', 'label', 'mode', 'baked', 'units', 'dflt', 'nmin', 'nmax'],
  emit: () => [],      // metadata only
};
```
- `param` renders READ-ONLY (a routing key — a hand-edit corrupts the wiring), reusing the `ddcs_opunit` lock pattern (bridge.js:397-419) in a `ddcs_camfield` extension that also shows the resolved role/exposability (grey the block + a tooltip when `classifyExposable` says bake-only, mirroring the modal greying at macrosApp.js:1224-1226).
- `dynamic: 'mode'` (the `ddcs_dynfields` pattern, bridge.js:243) so a `mode:'bake'` row shows `baked` and hides `nmin/nmax`, and vice-versa — keeps the chip readable (Fork D keeps this a field rather than two block types).

### 2.3 `param_group` population — the FORM face (reuse `formfield` vs a new `param_field`)
The locked design: render FORM params as editable blocks inside `param_group` even on built-in twins, sourced from bindings. Two candidate blocks:
- **Reuse `formfield`** (formField.js:17) — already round-trips, already in the Presentation mouth. BUT its socket link is var-identity `match:{type:'assign',var}` (formField.js:7), which addresses assign-var data-op fields, not a `(blockIndex,key)` value socket. Overloading it to also mean "param-name join" muddies its contract.
- **New `param_field`** — a lean FORM-face row keyed by binding `param` (symmetric with `cam_field`), owning form-label/widget/help/section/default. Reverse of `extractParamBlocks` (bindings → block).

**Recommend a new `param_field`** (Fork B) — symmetric with `cam_field`, keyed the same way (`param`), so ONE populator (`paramFieldsFromStack` mirroring `camFieldsFromStack`) serves both mouths and the `formfield`/`bindingSpecs` var-identity contract stays clean for the guarded ports it already serves.

---

## 3. THE ONE-SOURCE SPLIT (the crux) — who owns what after the split

| Concern | Owner AFTER the split | Was (today) |
|---|---|---|
| Which socket carries the `#var` (`blockIndex`, `key`) | **BINDING** (`def.bindings`) | binding |
| Param identity / name (`param`) | **BINDING** (the join key both blocks reference) | binding |
| Value type (`type`: int/number) | **BINDING** | binding |
| Base default (`default`) | **BINDING** (blocks may override) | binding |
| Role / exposability (value vs geometry) | **DERIVED** — `classifyExposable` over binding+structure (exposeClassifier.js) — never stored | derived (same) |
| FORM label / widget / help / section | **`param_field` block** (param_group) | `def.bindingSpecs` / pill / hard-coded |
| PENDANT label / units / min / max | **`cam_field` block** (cam_table) | `slot.fields` + `op.values` FIELD_OVR_COLS (macrosApp.js:1028) |
| Expose vs bake (+ baked literal) | **`cam_field` block** (`mode`,`baked`) | per-slot `op.exposed`/`op.baked` (macrosApp.js:1180-1188) |
| Pendant row order → `#11xx`/`#2600` allocation order | **`cam_field` order in the mouth** | `def.bindings` pre-order |
| Which `#11xx` a slot lands on (pack-scoped) | **`slot.fields[].idx`** (allocated by `nextParam` at build, pack-collision-aware, slotPack.js:35) | slot.fields (same) |
| Per-SLOT value tuning (operator seeds, one op reused in two slots differently) | **`slot.ops[]` manifest override** (kept, optional — Fork C) | manifest (same) |

**How they stay in sync — one direction, one derive:**
- **BINDING is authored once** (by `extractParamBlocks` at save, or the twin builder). It is the immutable wiring; a `cam_field`/`param_field` that names a `param` with no binding is a dangling row (grey it, like a stale opunit, subStackToSlot.js:22).
- **The blocks are the editable declaration.** The modal writes the blocks; `camFieldsFromStack(template)` reads them at CAM-build.
- **`slot.fields` is DERIVED at build** (buildSlotFromOps → generateOp): `stackToSlot`/`seedUniversal` consult `camFieldsFromStack` for label/expose/order/min-max and the binding for the socket, producing `slot.fields` → `.eng`/`#2600`. Nothing is stored twice: binding = wiring, block = presentation, `slot.fields` = the built artifact (rebuildable, like today).
- **No block ⇄ binding value duplication:** `default` lives in the binding; a block leaving `dflt` empty INHERITS it (exactly formfield's "empty dflt = socket-held", formField.js:11). So editing a default in one place only.

---

## 4. THE EMIT PATH — blocks → `.eng` + `#2600`

New pure reader (mirror of `bindingsFromStack`, userOps.js:292), in `blocks/userOps.js` or `data/`:
```
camFieldsFromStack(template) → [ { param, label, mode, baked, units, dflt, min, max } ]  // in cam_table mouth order
```
Then the generator/universal arms consume it:
1. **`stackToSlot` (stackToSlot.js:34)** — today it walks `def.bindings` in pre-order and reads `decl[param]` for expose/bake (:49-65). Change: walk the **`camFieldsFromStack` order** instead; each row → `decl[param] = { exposed: mode==='expose', value: baked }`; label/units/min/max/default come from the row (falling back to the binding). Allocation (`nextParam`, minting the `#var`, prepending `readLine`) is unchanged, so **block order → field order → `#11xx` order → `#2600` order** falls out (Headline 5). `classifyExposable` still gates (a bake-only param whose block says expose is force-baked, stackToSlot.js:59 — valid-by-construction).
2. **`seedUniversal` / `seedFromOp` (opCamMap.js:173/192)** — the modal seed reads the same `camFieldsFromStack` so the table pre-populates from blocks, not from bare bindings.
3. **`buildSlotFromOps` (macrosApp.js:1058)** — unchanged in shape: it still gets `{name, fields, body}` per op; `slot.fields` still flows to `slotEng`/`slotMacro`. The per-slot manifest `op.exposed/baked/values` becomes an OPTIONAL override layered ON TOP of the block declaration (Fork C), defaulting to "inherit the block."
4. **`.eng` + `#2600`** — untouched (`engLine`/`mirrorVar`/`slotMacro`, slotPack.js:62/22/75). They read `slot.fields`; `slot.fields` now traces to blocks.

**Reorder semantics (the locked "block order = pendant row order"):** because `nextParam` is a monotonic pool scan (slotPack.js:35), the Nth exposed `cam_field` gets the Nth free `#11xx` → the Nth `-m<group>` eng row → the Nth pendant slot. Reordering the mouth reorders the rows on the next build. (A rebuild re-allocates around pack siblings, macrosApp.js:1060 — the same churn any op-edit already causes; the manifest keeps tuned values by key, :1071.)

---

## 5. THE REVERSE PATH — the modal becomes a VIEW of the blocks

Today `renderCbmTable` (macrosApp.js:1199) reads `_authoring.ops[]` (seeded from bindings) and its radios/inputs write `a.exposed/a.baked/a.values` (cbmToggle :1363; input handlers :1266-1287). After the split:
- **Seed** — `openCamAuthoring`/`makeAuthOp` (macrosApp.js:1290/1176) read `camFieldsFromStack(def.template)` so the table rows ARE the `cam_field` blocks (falling back to the bindings-derived seed when a wizard has no `cam_table` yet — auto-materialize, Fork E).
- **Edit → write the block** — Expose/Bake radio (`cbmToggle`) sets the `cam_field.mode`; the value/label/min/max inputs set the block's fields; reorder writes mouth order. The write goes to the def template's `cam_field` block (via the Blocks workspace or a def-mutation seam), then `registerUserOp` re-derives, and the table re-renders from the block — a true round-trip, not a parallel model.
- **Round-trip guarantee** — the `cam_field`/`param_field` blocks live in `def.template`, so they serialize with the op and survive workspace ⇄ stack (stackBridge.js) like `formfield`/`opunit`/`simstart` already do (userOps.js:292/201, subStackToSlot.js:59). [[wire-blockly-roundtrip-new-features]] is satisfied by construction: the blocks ARE the template.
- **Modal still owns the pack-scoped bits** — slot name, which slot#, Simulate, icon (macrosApp.js:1258-1262, cbmSimulate :1383). Those are per-slot, not per-def, so they stay in the modal; only the FIELD DECLARATION migrates to blocks.

**Two-view consistency:** editing in the Blocks tab (drag a `cam_field`, flip its `mode`) and editing in the modal both mutate the same `cam_field` block → both views reflect it. This is the `[[wizard-to-blocks-bidirectional]]` / one-stack-many-views north-star applied to pendant params.

---

## 6. MIGRATION of existing twins/slots

- **Twins (surfacing-class, `bindings` only)** — have NO `cam_table`/`param_field` blocks. Auto-materialize on first CAM-build/open: synthesize a `cam_table` of `cam_field`s from `def.bindings` (expose = `classifyExposable` says exposable, else bake) and a `param_group` of `param_field`s — i.e. `bindingsToBlocks` for the value bindings (the inverse of `camFieldsFromStack`). This is byte-neutral: the synthesized blocks reproduce today's default expose/bake (Fork E: lazy-materialize vs one-time migration script).
- **Guarded ports (corner/pocket/edge/middle, `bindingSpecs`)** — `classifyExposable` fail-closes (exposeClassifier.js:70). Their `cam_field`s render as bake-only (Expose greyed) until the classifier learns the pruned-stack index alignment (a flagged follow-on, same limit `stackToSlot` has). Honest — do not fake exposability.
- **Existing CAM packs (`slot.ops[]` manifests)** — unchanged. `declFromOp` (macrosApp.js:1032) still reads `op.exposed/baked/values`; the block declaration becomes the DEFAULT those override. An old slot with an explicit manifest keeps behaving identically (Fork C keeps the override layer). A new slot with no manifest overrides inherits the blocks.
- **Sub-stack ops (`opunit`)** — `makeSubStackAuthOp`/`walkParts` (macrosApp.js:1162, subStackToSlot.js:59) already group fields by part with `_part` scoping and `fkeyOf` part-keys (macrosApp.js:1197). A `cam_field` must therefore also carry the part scope for a sub-stack (Fork F) — the per-part `fkey` collision guard (t1077) is the precedent.

---

## 7. COLOUR + north-star alignment

- **Colour** — `cam_table` + `cam_field` are the CAM-pendant family; they share ONE coherent colour ([[mind-block-color]]: a family shares one). Two options: (a) keep `category:'Wizard UI'` → inherit fuchsia `#d946ef` (theme.js:15), consistent with `param_group`/`formfield`/`opunit`; (b) give the pendant pair a declared distinct hue via the `ddcs_seccolor` per-instance pattern (bridge.js:381) so pendant rows read apart from form rows. **Recommend (a) fuchsia for `param_field` (it IS a Wizard-UI form row) + a single distinct declared hue for the `cam_table`/`cam_field` pair** (they are a different concern — controller pendant, not Studio form) so the two faces read apart at a glance. Keep both legible in every app theme (the theme maps category→colour live, theme.js:25).
- **GUI-first** ([[prefer-gui-over-fields]]) — the pendant field set becomes a visible, reorderable block stack instead of a modal-only table; expose/bake is a block toggle. This is the GUI-over-fields direction.
- **Declare-not-infer** ([[custom-op-sim-intent-infer-vs-declare]]) — the `cam_field` is a DECLARATION read as data, never inferred from emit; `classifyExposable` stays a pure function of declared facts (exposeClassifier.js:1-15).
- **One-source** — Section 3's table: binding=wiring, block=presentation, `slot.fields`=built artifact. No value lives in two editable places.
- **Wizards-as-data** ([[wizards-as-data-emit-is-template-not-delegate]]) — the pendant field declaration joins the template as composable blocks, so a user can author/re-author it. The modal delegating to blocks (not owning state) is the point.

---

## 8. SLICED BUILD ORDER (S1..Sn) — smallest-first, each independently verifiable

- **S1 — the `cam_field`/`cam_table` block SCHEMAS + reader (engine only, no UI, no emit change).** Add the two block defs (userRoot.js family), the `jsonDef` `cam_table` mouth arm (bridge.js:241), the `ddcs_camfield` read-only-param extension (bridge.js:397 pattern), and `camFieldsFromStack(template)` (mirror `bindingsFromStack`). **Verify:** a hand-built def with a `cam_table{cam_field(param=feed,mode=expose), cam_field(param=depth,mode=bake,baked=5)}` round-trips through `flattenBlocks`/stackBridge and `camFieldsFromStack` returns the two rows in mouth order; emit is byte-identical (both emit `[]`). Diff + a harness assert.
- **S2 — `stackToSlot` consumes `camFieldsFromStack` (the emit path).** Route `stackToSlot` (stackToSlot.js:49) to walk the `cam_field` order and read expose/bake/label/min-max from the rows (binding fallback). **Verify:** on the S1 def, the built `{fields, body}` exposes `feed` as `#2600` and bakes `depth=5`; `engLine`/`slotMacro` render; reorder the two `cam_field`s → the `#11xx`/`#2600` order swaps. Real-symptom: seed `#2600`, Simulate moves the feed. `[[verify-real-symptom-not-just-test]]`.
- **S3 — auto-materialize blocks from bindings (migration, byte-neutral).** `bindingsToBlocks` for value bindings so a legacy twin gains a default `cam_table` on open/build. **Verify:** a surfacing twin with NO cam_table builds a slot byte-identical to today's (same fields, same eng), then shows the materialized blocks. Guard the byte-identity like the twin-default memory `[[twin-default-mirrors-form-not-fallback]]`.
- **⚠ GATE-IF-BALLOONS — S4 — the modal becomes a VIEW.** `renderCbmTable` reads `cam_field` blocks; `cbmToggle`/value-inputs write them; the def-mutation ⇄ re-register ⇄ re-render loop (macrosApp.js:1199/1363). **This is the risky slice** (it relocates state the whole modal is built on, and touches the def-write seam). If it balloons past a tight diff — STOP and gate to the advisor: ship S1-S3 (blocks + emit + materialize) as the value, keep the modal writing the manifest as an override, and split the "modal writes blocks" into its own task. **Verify:** flip Expose→Bake in the modal → the `cam_field.mode` changes → the Blocks tab shows it → rebuild bakes it.
- **S5 — `param_group` populated from bindings (the FORM half).** `param_field` block + `paramFieldsFromStack` + auto-materialize form rows from bindings; the wizard form reads them. **Verify:** a built-in twin shows its FORM params as editable `param_field` blocks in `param_group`; editing a label/widget reflects in the Studio wizard form. (Independent of S1-S4 — could run in parallel, but shares the reader pattern, so land after S1.)
- **S6 — sub-stack + guarded honesty + polish.** Per-part `cam_field` scoping for `opunit` sub-stacks (Fork F, reuse `_part`/`fkeyOf`, macrosApp.js:1197); grey bake-only rows with the `classifyExposable` reason (macrosApp.js:1224); the colour split (Section 7); the per-slot manifest-override affordance (Fork C).

Slice boundary discipline mirrors the universal/sub-stack plans: S1-S2 are the engine proof (harness, no modal), S3 is the safety-net migration, S4 is the gated risky relocation, S5-S6 are additive.

---

## 9. FORKS FOR THE HUMAN (each with a recommendation + trade-off)

**FORK A — where the `cam_table` lives.** A container block INSIDE the `user_root` PRESENTATION mouth (beside `param_group`) **vs** a THIRD mouth on `user_root` (Presentation / Execution / Pendant). **RECOMMEND: a container in the Presentation mouth.** A new user_root mouth means changing `addMouth` wiring (bridge.js:236-240), the `user_root` emit (userRoot.js:21), and every walker's mouth assumption — high blast radius for a cosmetic gain. A container block is the `param_group`/`section` pattern, zero user_root change. Trade-off: pendant fields sit under "Presentation" rather than getting top billing.

**FORK B — the FORM-face block: reuse `formfield` vs a new `param_field`.** **RECOMMEND: a new `param_field`** keyed by binding `param` (symmetric with `cam_field`, one shared populator). Trade-off: one more block type vs overloading `formfield` — but `formfield`'s var-identity `match` contract (formField.js:7) does not address a `(blockIndex,key)` value socket, so reuse would blur two link semantics. Reuse is only cleaner if the twin's params are assign-var data-op fields (then `formfield` fits and `param_field` is redundant) — so keep `param_field` for value bindings, let `formfield` keep the assign-var ports.

**FORK C — expose/bake: def-block-global vs per-slot override.** Moving `mode` onto a DEF `cam_field` makes it shared by every slot built from that op — but today expose/bake is a per-authoring-op / per-slot map (macrosApp.js:1180-1188). **RECOMMEND: the block declares the DEFAULT; keep `slot.ops[].exposed/baked` as an OPTIONAL per-slot override** (declFromOp already layers it, macrosApp.js:1032). Trade-off: two places CAN set expose/bake (block default + slot override) — but they are different scopes (definition vs instance), not duplication, and the override defaults to "inherit", so the common case is single-source. Dropping the override entirely is simpler but loses "same op, two slots, different pendant exposure."

**FORK D — expose-vs-bake on the block: a `mode` field vs two block types (`cam_expose`/`cam_bake`).** **RECOMMEND: a `mode` field** (`dynamic:'mode'` shows/hides `baked`). Trade-off: two block types read more distinctly in the palette and make "drag to change" impossible-to-typo, but double the schema, the reader, and the round-trip, and fight the reorder story (a run of mixed types). A field keeps one row type, one populator, clean reorder.

**FORK E — migration: lazy auto-materialize vs one-time script.** **RECOMMEND: lazy auto-materialize** (synthesize blocks from bindings on first open/build when absent; S3). Trade-off: a twin's blocks appear only when touched (slightly magic) vs a migration script that rewrites every registered def up-front (touches USER_DEFS storage, riskier, and re-runs on every new twin anyway). Lazy is byte-neutral and self-healing.

**FORK F — sub-stack part scoping.** A `cam_field` for an `opunit` sub-stack op must disambiguate two parts sharing a param key (the t1077 `fkeyOf` case, macrosApp.js:1197). Carry an optional `part` on the `cam_field` **vs** scope by the containing `opunit` position. **RECOMMEND: scope by containing `opunit`** (position in the walk, subStackToSlot.js:59) so the `cam_field` stays free of a redundant part id; the walk already yields part order. Trade-off: a `cam_field` outside any opunit is "custom-atoms" part; inside → that standard part. Slightly more walk logic vs an explicit (corruptible) part field.

**FORK G — does `cam_table` live on EVERY custom wizard or only CAM-targeted ones?** **RECOMMEND: opt-in — only when a wizard has pendant fields.** `cam_table` is a draggable block; a wizard with none simply has no pendant slot (the CAM builder falls back to the bindings-derived seed, Fork E). Trade-off: universal presence would make "build a CAM slot" always block-driven, but bloats every simple wizard with an empty pendant mouth. Opt-in matches "declare when there's something to declare."

---

## 10. THE HONEST LIMITS (where the code makes the locked design harder)

- **The modal-as-view (S4) relocates the state the whole modal is built on.** `_authoring.ops[]` + `slot.ops[]` are the current source of truth (macrosApp.js:1143/1190); "the blocks are the source, the modal is a view" is a genuine inversion, not a wrapper. It needs a def-mutation ⇄ re-register ⇄ re-render seam that does not exist yet. This is the single riskiest slice — hence the GATE. S1-S3 deliver real value (block-native declaration + emit + migration) even if S4 is deferred.
- **Guarded/ported twins can't expose yet.** `classifyExposable` fail-closes on `bindingSpecs` defs (exposeClassifier.js:70/76). corner/pocket/edge/middle `cam_field`s are bake-only until the classifier mirrors the pruned-stack index alignment (`instantiate` re-derives per build, userOps.js:497). The blocks render; the Expose radio greys. Do not paper over it.
- **Def-global vs per-slot expose/bake is a real scope collision** (Fork C). A single `cam_field.mode` cannot be both "the op's pendant default" and "this slot's choice"; the plan keeps both scopes, which means the honest answer to "where is expose/bake set?" is "block default, slot override" — not strictly one place, though single-source in the common path.
- **Reorder churns `#11xx` allocation.** Because `nextParam` re-scans the pool per build (slotPack.js:35), reordering `cam_field`s re-numbers the pendant slots — fine for a fresh pack, but a SHARED/installed pack that operators have muscle-memory for would shift row numbers. The `mergeEng` append (slotPack.js:147) and the manifest value-by-key carry (macrosApp.js:1071) soften it, but "reorder = renumber" is inherent to a pool allocator. Flag before shipping reorder on installed packs.
- **`formfield` is NOT a drop-in for value bindings** (Fork B) — its var-identity `match` (formField.js:7) means the FORM-half needs `param_field`, so the "just reuse formfield" reading of the locked design does not hold for surfacing-class twins.
- **Sub-stack standard parts stay generator-live, not block-declared.** A `cam_field` can declare the CUSTOM atoms' pendant fields, but a standard `opunit` part's pendant knobs are its GENERATOR's loop params (makeSubStackAuthOp forces them all-exposed/bakeable:false, macrosApp.js:1168). Making those block-declared would mean re-parametrizing the generator loop — out of scope; the `cam_field` layer covers the custom/universal params, the generator owns the standard ones (the same hybrid frontier as cam-substack-plan §7).

---

## Critical files for implementation
- `DDCS-Studio/web/wizards/ops/userRoot.js` — `paramGroupBlock`/`sectionBlock`/`opUnitBlock` (:24/39/55): the transparent-container family `cam_table` joins; the `emit: () => children` vs `emit: () => []` distinction.
- `DDCS-Studio/web/wizards/ops/formField.js` — `formFieldBlock` (:17), `emit: () => []` (:36): the exact metadata-block-in-Presentation-mouth precedent `cam_field`/`param_field` copy.
- `DDCS-Studio/web/blocks/blockly/bridge.js` — `jsonDef` (:195), the mouth arm (:241), `catSlug`/style (:65/228), `ddcs_opunit`/`ddcs_seccolor` extensions (:397/381): where `cam_table` gets a mouth and `cam_field` gets its read-only-param chip + colour.
- `DDCS-Studio/web/blocks/userOps.js` — `extractParamBlocks` (:143), `cleanBinding` (:111), `bindingsFromStack` (:292), `instantiate` (:436/451): the binding shape the split divides + the `camFieldsFromStack`/`bindingsToBlocks` readers to mirror.
- `DDCS-Studio/web/data/exposeClassifier.js` — `classifyExposable` (:61), fail-closed on `bindingSpecs` (:70/76), `BLOCKING_FOLD_KINDS` (:24): the exposability gate a `cam_field.mode='expose'` is validated against.
- `DDCS-Studio/web/data/atomRoles.js` — `paramRole`/`ATOM_ROLES` (:113/28): the declared value-vs-geometry roles feeding the classifier + the block's grey-out.
- `DDCS-Studio/web/data/stackToSlot.js` — `stackToSlot` (:34), the field shape (:57), the prepended reads (:68): the emit arm that switches from `def.bindings` pre-order to `camFieldsFromStack` order.
- `DDCS-Studio/web/data/opCamMap.js` — `seedUniversal`/`seedFromOp` (:173/192): the modal seed that reads the blocks instead of bare bindings.
- `DDCS-Studio/web/data/slotPack.js` — `mirrorVar`/`engLine`/`slotEng`/`slotMacro`/`nextParam`/`fieldsFromMacro` (:22/62/69/75/35/202): the `.eng`+`#2600` emit + reverse, consumed unchanged; the order-driven allocator that makes reorder free.
- `DDCS-Studio/web/ui/macrosApp.js` — `renderCbmTable`/`cbmToggle`/`makeAuthOp`/`buildSlotFromOps`/`declFromOp`/`toManifest`/`fkeyOf` (:1199/1363/1176/1058/1032/1190/1197): the modal that becomes a view + the manifest override layer + the sub-stack part scoping.
- `DDCS-Studio/web/data/subStackToSlot.js` — `walkParts`/`deriveStandardParams` (:59/44): the per-part walk a sub-stack `cam_field` scopes by (Fork F).
- *(new)* the `cam_table`/`cam_field`/`param_field` block defs + `camFieldsFromStack`/`paramFieldsFromStack`/`bindingsToBlocks` readers.
