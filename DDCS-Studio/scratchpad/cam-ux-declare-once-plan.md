# CAM-UX DECLARE-ONCE — one place to author a slot, settings becomes a display

Branch: `feat/gateway-csrf-guard` (full merged CAM) · Scope: **planning only** (no source edits) · Repo: `DDCS-Studio/web`
Siblings: `cam-universal-plan.md` (the `stackToSlot` unroll+expose engine) · `cam-block-native-params-plan.md` (the `cam_field`/`cam_table` pendant blocks — **partially landed already**: `camRowBlock`, `maybeMaterializeCamTable`, the S4a modal-as-view hooks) · `cam-substack-plan.md` (the `opunit` live sub-unit). This plan sits ON TOP: it does not add an engine, it **relocates the authoring surface** so the wizard is the ONE editor and settings is a read-mostly display.

## Headline (TL;DR)
1. **The substrate the locked design rides already exists and is one function.** `setStack(next)` (programModel.js:213) re-emits the projection, pushes it into the Studio editor (`projectToEditor`, :221) and notifies every subscriber (Blocks view); `window.ddcsLoadBlockStack = (s) => setStack(s,'load')` (programModel.js:244) is the public door. "Make the slot the active stack" = call `ddcsLoadBlockStack`. The editor, Blocks and projected macro re-render **for free** — exactly as the design assumes.
2. **The exact "reopen in UPDATE mode" precedent is `editWizardDef`/`saveAsCustomOp`, one level down.** `editWizardDef(opType)` (devMode.js:545) loads a saved def's stack active (`ddcsLoadBlockStack([opC])`, :570), sets `_editingWizard`/`_editingLabel` (:568) as the **update flag**, and the save dialog reads `init.editing` → shows **"Update <name>"** and routes `commit('update')` → `updateUserOp` **in place** (devMode.js:633-659, 739-740). **The CAM-slot Edit is this pattern promoted from a def to a slot** — carry `_editingSlot`, show **"Update CAM (camN)"**, overwrite that slot. No new machinery; a promotion.
3. **The honest crux the design must absorb: `slot.ops` is a CAM MANIFEST, not a program block-stack.** `toManifest` (macrosApp.js:1190) stores `{type:camType, variant, values, exposed, baked, opType, defV}` — the pendant declaration — and **drops the source op's `params`**. `getStack()` returns program blocks `[{type:'op', opType, params, children}]`. So "set `slot.ops` as the active stack" is a **reconstruction**, not an assignment, and its fidelity **splits by slot kind** (Section 4). This is the single place the locked wording is harder than it sounds — surfaced, not papered over.
4. **Reconstruction is EXACT for universal/substack, PARAMETRIC-at-defaults for the 8 generators — and that is faithful, not lossy, because a generator CAM slot IS parametric.** A universal/substack slot's source is its `getUserDef(opType)` (recoverable, `makeOp(opType, defaultParams(def), def.template)` — literally `editWizardDef`, devMode.js:558-559). A generator slot (`pocketSlot`/`probeToSlot`/…) emits a `#2600`-parametric macro that **ignores the source op's params** — the pendant fields ARE the knobs — so the source op params were never part of the slot's identity; there is nothing richer to restore than `{camType, variant, expose/bake, pendant values}` = the authoring op.
5. **Therefore the primary Edit mechanism is: restore the AUTHORING state from `slot.ops` and reopen the wizard PRE-SEEDED with an update flag — uniform across all slot kinds, pure declare-never-infer, reuses the existing round-trip.** `cbmBuild` already has the overwrite branch (macrosApp.js:1436, `dest.isNew===false`); Edit routes straight to it (skipping `cbmBuildModal`). The "which slot? new vs overwrite" prompt (`cbmBuildModal`, :1326) is **eliminated**: New always mints `nextSlotNum` (:1656), Edit always overwrites `_editingSlot`. The **"active stack → editor/Blocks are live views"** enrichment (design-literal) is a separate, **gated** slice on top (S4), exact for universal/substack.
6. **Settings collapses from a full second editor to a read-mostly display + two doors.** `renderCamBuilder` (macrosApp.js:1441) today re-implements the whole wizard: an editable field table (:1450-1459), `＋ Add field`/`Refresh fields` (:1475), op cards with type/variant/reorder (`opCardsHtml`, :1111), the `＋ Add op` generator cluster (`addOpClusterHtml`, :1133), and a hand-editable macro `<textarea>` (:1477). **All of that is the "second editor" the design deletes.** What remains: the slot list + `New`/`Edit` doors + read-only `View output`/`Export .zip`/`Delete`/`Simulate`/reorder + the icon **preview** (the icon **editor** moves into the wizard).
7. **Prove it in slices that split the risk cleanly:** S1 the display refactor (mostly DELETION, byte-neutral to built slots), S2 the door collapse, S3 the manifest-Edit + update flag (the crux, but modal-only — does not touch the active program), **S4 (GATED) the active-stack live-view**, S5 the icon move, S6 migration + the hand-edited-macro honesty.

---

## 1. GROUND TRUTH — the current CAM surfaces (cite file:line)

### 1.1 The settings panel (`#macros_panel_cam`, macrosApp.js:167-174)
The toolbar row (macrosApp.js:171) carries **five** buttons + the pack name:
- `cam_pack_name` — pack name input (→ `_camPack.meta.name`, handler :1654).
- `cam_add_slot` (:171, handler :1657) — pushes a **blank** slot `{slot, name:'New slot', fields:[], body:''}`. The redundant blank door.
- `cam_build_slot` (:171, handler :1659) — `openCamAuthoring()` (no seed) → **auto-imports all CAM-able program ops** (macrosApp.js:1309-1316). The seed-from-program door.
- `cam_customize_op` (:171, handler :1661) — `cbmCustomizeModal()` (:1348) → `ddcsEditWizardDef(opType)`: fork a recognized generator twin into an `opunit` sub-stack in Blocks.
- `cam_export_pack` / `cam_merge_eng` (:171) — pack-level read-only actions (.zip bundle, safe eng-merge).
- `cam_validate` (:172) + `cam_slots` (:173) — the collision hint + the slot list (`renderCamBuilder`).

### 1.2 The per-slot card (`renderCamBuilder`, macrosApp.js:1441-1482) — this IS the "second editor"
Each slot card renders:
- **Header** (:1461-1468): `cam<N>` number input (`data-f=slot`), name input (`data-f=name`), `WCS` select (`data-f=wcs`), the `-m<group>` label, `⧉ dupslot` (:1466), `✕ dels` (:1467).
- **Icon row** (:1469-1473): the icon `<img>` preview + `✕ delicon`, **`🎨 Create/Edit icon`** (`data-act=edit` → `openIconEditor`, :1576), **`🖼 Import BMP`** (`data-act=icon`, :1577).
- **The editable field table** (:1450-1459, :1474): per-field `label`/`units`/`def`/`min`/`max`/`var` inputs (`.cf`, input handler :1555-1562, persisted onto the owning op via `FIELD_OVR_COLS`, :1559), `#param→#2600` read-out, `✕ delf`.
- **Field actions** (:1475): `＋ Add field` (`addf`, :1573), **`🔄 Refresh fields from macro`** (`refresh`, :1623 — re-derives fields by re-scanning the macro, `fieldsFromMacro`).
- **Op cards** (`opCardsHtml`, :1111-1130, rendered :1476): per-op type/variant selects (`.cam-op-type`/`.cam-op-var`, :1647-1651), `▲▼ opup/opdown` (:1604), `⧉ dupop` (:1609), `✕ delop` (:1600).
- **The macro `<textarea>`** (`data-f=body`, :1477, handler :1567 sets `slot.bodyDirty`) + a persistent-var audit hint (:1478).
- **The `＋ Add op` generator cluster** (`addOpClusterHtml`, :1133, rendered :1479, handler `addop` :1579).
- **Read-only-ish actions** (:1479): `▶ Simulate` (`sim` → `simulateSlot`, :1633/:1521), `⬇ Export macro + eng to editor` (`exp`, :1634 → `insertToEditor`).

### 1.3 The authoring modal (`openCamAuthoring` + `cbm*`, macrosApp.js:1136-1438) — the real "wizard" today
- `openCamAuthoring(seedOp?)` (:1301): a modal overlay (`_cbmOverlay`); with `seedOp` seeds THAT op, without it **auto-imports every CAM-able program op** (:1309-1316); empty → the empty-state (:1207-1210, lists what CAM supports + why present ops didn't qualify).
- `makeAuthOp(op)` (:1176) → `{opType, camType, variant, fields, values, exposed, baked, label, universal, defV}`; sub-stack ops route to `makeSubStackAuthOp` (:1162). `_authoring.ops[]` (:1143) is the in-memory model.
- `renderCbmTable` (:1205) — the group-by-op **Expose/Bake** table, per-row radios (`cbmToggle`, :1385), value edit, `bakeable`/`exposable` greying (:1231-1233). **S4a already wired:** `camRowBlock(opType,key)` (:1379) reads/writes a `cam_field` block when the def has one (:1200, :1217, :1280, :1388) — the modal is *already becoming a view of the def's cam_table*.
- `mountAuthoringSurface` (:1261): the `✚ Build CAM slot` header (:1264), the slot-name input (`cbm_name`, :1265), the table, the inline `▶ Simulate` (`cbm-sim`, :1267/:1411) + preview, and the `Build CAM slot ▸` button (`cbm-build`, :1269).
- `cbmBuild` (:1422) → `cbmBuildModal()` (:1326) — the **new-vs-overwrite prompt** — then writes `_authoring.ops.map(toManifest)` to a new or existing slot (:1435-1437) and `buildSlotFromOps`.

### 1.4 The engine underneath (unchanged by this plan)
`buildSlotFromOps(slot)` (macrosApp.js:1058) walks `slot.ops`, calls `generateOp(type,variant,used,off,decl,opType)` (:1020 — the 8 generators / `stackToSlot` / `subStackToSlot` arms), allocates params around siblings, and composes `slot.body` (`slotPack.composeParts`). This plan does **not** touch it — it only changes **who calls it and from where**.

### 1.5 The external doors (must all be accounted for)
- Op context menu **`▸ Build CAM slot`** (opContextMenu.js:51-53) → `ddcsOpenCamAuthoring(op)` (seed-from-this-op).
- Op context menu **`🧩 Customize as blocks`** (opContextMenu.js:61) → `ddcsEditWizardDef(op.opType)`.
- Global/toolbar **`ddcsBuildCamSlot`** (globalFunctions.js:408) → `ddcsOpenCamAuthoring()`.
- `window.ddcsOpenCamAuthoring` / `window.ddcsCamTypeOf` published at macrosApp.js:1665-1666.

---

## 2. BEFORE → AFTER — every surface accounted for

Legend: **WIZARD** = moves into the authoring wizard (the one editor) · **DISPLAY** = stays in settings as read-mostly · **READ-ONLY** = kept, non-mutating · **REMOVED** · **DOOR** = a launcher into the wizard.

| # | Current surface (file:line) | What it does today | AFTER |
|---|---|---|---|
| 1 | `cam_add_slot` "＋ Add slot" (:171/:1657) | push a **blank** slot | **REMOVED** — collapses into the New door (#3). Blank-canvas authoring is gone (design: never a blank canvas). |
| 2 | Hand-editable macro `<textarea>` (`data-f=body`, :1477/:1567) | edit the compiled macro in settings | **REMOVED** as an editor → replaced by **READ-ONLY** View output (#16). The macro is a **projection** of the ops, not the source. |
| 3 | `cam_build_slot` "✚ Build CAM slot" (:171/:1659) | `openCamAuthoring()` seed-from-program | **DOOR → "＋ New CAM slot"** — same `openCamAuthoring()` (already seeds from the program + has the empty-state). Relabel + it becomes the *only* new-slot door. |
| 4 | Editable field table `label/units/def/min/max/var` (:1450-1459, `.cf` :1555) | tune pendant fields in settings | **WIZARD** — the Expose/Bake table (`renderCbmTable`, :1205) already owns this. Delete the settings copy. |
| 5 | `＋ Add field` / `✕ Remove field` (`addf`/`delf`, :1573/:1574) | hand-add pendant fields | **REMOVED** — fields are derived from the op's bindings / `cam_field` blocks in the wizard, never hand-added in settings. |
| 6 | `🔄 Refresh fields from macro` (`refresh`, :1623) | re-scan the macro → fields | **REMOVED** — declare-never-infer: fields come from `slot.ops`/bindings, not from re-parsing the compiled body. |
| 7 | Op cards: type/variant/`▲▼`/`⧉`/`✕` (`opCardsHtml`, :1111; :1600-1651) | edit/reorder the ops in settings | **WIZARD** — op composition is the wizard's job (the `_authoring.ops[]` group table). |
| 8 | `＋ Add op` generator cluster (`addOpClusterHtml`, :1133/:1579) | append an op in settings | **WIZARD** — new ops are seeded from the program / added in the wizard. |
| 9 | `🎨 Create/Edit icon` (`data-act=edit` → `openIconEditor`, :1576) | draw the slot icon in settings | **WIZARD** — the icon editor moves into the authoring flow (Section 6). |
| 10 | `🖼 Import BMP` (`data-act=icon`, :1577) + `✕ delicon` (:1578) | import/clear the icon in settings | **WIZARD** (import + clear live beside the in-wizard icon step); the settings card keeps only the icon **preview**. |
| 11 | `cam_customize_op` "🧩 Customize op" (:171/:1661) → `editWizardDef` | fork a twin into `opunit` blocks | **FORK B** — keep as a door (it is the "edit as blocks" entry) **or** fold into the wizard's advanced affordance. Recommend: keep the **op-menu** Customize (opContextMenu.js:61), retire the settings button (settings = display). |
| 12 | `cbmBuildModal` new-vs-overwrite prompt (:1326) | ask which slot on Build | **REMOVED** — New always `nextSlotNum`; Edit always overwrites `_editingSlot`. The wizard already knows the destination. |
| 13 | `Build CAM slot ▸` (`cbm-build`, :1269/:1422) | build to a slot | **WIZARD** — reads **"Update CAM (camN)"** when `_editingSlot` is set (Section 3), else "Build CAM slot". |
| 14 | Slot header: `cam<N>`, name, `WCS`, `-m<group>` (:1461-1465) | per-slot metadata | **DISPLAY** — kept editable-light (rename / renumber / WCS are per-slot facts, not op authoring). |
| 15 | `⧉ dupslot` (:1466/:1613) · `✕ dels` (:1467/:1575) | duplicate / delete a slot | **DISPLAY / READ-ONLY** — kept (Delete + Duplicate are slot-list ops, not authoring). |
| 16 | `⬇ Export macro + eng to editor` (`exp`, :1634) | project the built macro+eng to the editor | **READ-ONLY → "View output"** — unchanged behaviour, relabelled as the read-only look at the compiled output. |
| 17 | `▶ Simulate` (`sim` → `simulateSlot`, :1633/:1521) | run the slot macro in the sim | **READ-ONLY** — kept (verify the built slot without editing). |
| 18 | `📦 Export pack (.zip)` (`cam_export_pack`, :171) · `🔗 Merge eng` (`cam_merge_eng`) | pack-level bundle / eng-merge | **DISPLAY / READ-ONLY** — pack-level, kept in the display header. |
| 19 | `cam_pack_name` (:171/:1654) · `cam_validate` (:172) | pack name + collision hint | **DISPLAY** — kept as the display header. |
| 20 | *(new)* per-slot **"Edit ▸"** | — | **DOOR** — restore `slot.ops` into the wizard + `_editingSlot` flag (Section 3). The headline of the redesign. |
| 21 | Op-menu `▸ Build CAM slot` (opContextMenu.js:51) · global `ddcsBuildCamSlot` (globalFunctions.js:408) | seed the wizard from an op / the program | **DOOR** — kept (variants of New: from *this* op / from the program). |

**Nothing orphaned:** every current button/feature above maps to WIZARD, DISPLAY, READ-ONLY, DOOR, or REMOVED.

---

## 3. THE "EDIT → ACTIVE STACK + UPDATE FLAG" MECHANISM (grounded)

### 3.1 The precedent, promoted from def to slot
`editWizardDef` (devMode.js:545) is the template, verbatim:
```
editWizardDef(opType):
  def = listUserOps().find(opType)                    // the saved def
  maybeMaterializeCamTable(def) / maybeMaterializeParamGroup(def)   // pendant + form blocks (S4b/S5.3 — already landed)
  {template: forkTpl} = wrapRecognizedForFork(def)    // opunit-wrap a recognized twin
  opC = makeOp(opType, defaultParams(def), forkTpl)   // def → a program op
  showApp('blocks'); await ddcsLoadBlockStack ready
  _editingWizard = opType; _editingLabel = def.label  // ← THE UPDATE FLAG
  refreshEditingChrome()                              // "✎ Editing: <name>" chip + glow
  ddcsLoadBlockStack([opC])                            // ← THE ACTIVE STACK
```
On save, `saveAsCustomOp` (devMode.js:682) reads `_editingWizard` → `openSaveDialog({editing:{opType,label}})` → the dialog shows **"Update <name>"** (:644) and `commit('update')` (:659) routes to `updateUserOp(...)` **in place** (:739-740) instead of `createWizard`.

**The CAM-slot Edit is the identical shape, one level up:** the unit of identity is a **slot** (`camN`) not a **def**; the update flag is `_editingSlot` (the slot number) not `_editingWizard`; the save button reads **"Update CAM (camN)"**; the commit overwrites `_camPack.slots[camN]` in place via the existing `cbmBuild` overwrite branch (macrosApp.js:1436).

### 3.2 The two Edit realizations (dispatched by slot kind — the honest split)
Because `slot.ops` is a manifest, "restore the declared ops" resolves differently per kind:

```
                    slot.ops (manifest)                    what Edit restores
  ┌──────────────┬─────────────────────────────────┬──────────────────────────────────────────┐
  │ generator    │ {type:pocket, variant, exposed,  │  _authoring.ops ← manifest (re-hydrate     │
  │ (8 premium)  │  baked, values, opType}          │  fields via seedFromOp, overlay stored     │
  │              │  (source op PARAMS not stored)   │  expose/bake/values). Modal-only.          │
  ├──────────────┼─────────────────────────────────┼──────────────────────────────────────────┤
  │ universal /  │ {type:universal|substack,        │  EXACT: getUserDef(opType) → makeOp(       │
  │ substack     │  opType, defV, exposed, baked}   │  opType, defaultParams(def), def.template) │
  │              │  + cam_table blocks in the def   │  → ddcsLoadBlockStack (editor/Blocks live) │
  └──────────────┴─────────────────────────────────┴──────────────────────────────────────────┘
```

**PRIMARY (uniform, all kinds, S3) — restore the AUTHORING state, reopen the wizard pre-seeded:**
1. `_editingSlot = N`; `_authoring = { ops: slot.ops.map(manifestToAuthOp), name: slot.name }`.
   - `manifestToAuthOp` is the inverse of `toManifest` (:1190): re-hydrate `fields` via `seedFromOp`/`subStackToSlot` (the same call `makeAuthOp` uses), then overlay the stored `exposed`/`baked`/`values`. This is **declare-never-infer** — it reads the manifest, never re-parses `slot.body`.
2. `openCamAuthoring` opens the modal on `_authoring` (skip the auto-import seed when `_authoring.ops` is already populated).
3. `mountAuthoringSurface` header reads **"✎ Update CAM (cam N)"** when `_editingSlot != null`; the build button reads **"Update CAM (camN) ▸"**.
4. `cbmBuild` (:1422): when `_editingSlot != null`, **skip `cbmBuildModal`** and go straight to the overwrite branch (`slot = find(_editingSlot); slot.ops = ops; buildSlotFromOps(slot)`, :1436) → `saveCamPack` → clear `_editingSlot`.

This path **does not touch the active program** — it is a modal over settings, so there is no "you clobbered my editor program" problem (Fork C). It works for **every** slot that has a `slot.ops` manifest.

**ENRICHMENT (design-literal one-stack-many-views, S4, GATED) — the editor/Blocks become live views:**
For a **universal/substack** slot, also reconstruct the program stack and load it active so the Studio editor + Blocks render it, exactly like `editWizardDef`:
```
  op = makeOp(opType, defaultParams(getUserDef(opType)), getUserDef(opType).template)
  ddcsLoadBlockStack([op] or the N-op concat for a composed slot)
```
For a **generator** slot the reconstruction is a twin instance **at default params** (`builtinTypeForTwin(opType) → getUserDef → makeOp` at defaults) — an honest parametric instance, **not** "the exact pocket you drew" (the params were never persisted; Headline 4 argues this is faithful because the slot is parametric). **Gate:** if S4 balloons or the generator default-param instance confuses users, ship S1-S3 (the modal-Edit already fully delivers "one editor + update-in-place") and defer the live editor/Blocks view.

### 3.3 Why this satisfies the north star
- **One-stack/many-views:** the wizard/Blocks/editor already subscribe to `setStack` (programModel.js:213-217); S4 just points the active stack at the reconstructed op. S3 alone already unifies *authoring* into the one modal.
- **Declare-never-infer:** Edit reads `slot.ops` (the declared manifest) + `def.template` (the declared blocks), never `slot.body` (the compiled artifact). `refresh`-from-macro (:1623), the one inference path, is REMOVED (#6).
- **Valid-by-construction:** the destination is known (`_editingSlot`), so the ambiguous "new vs overwrite" prompt (:1326) disappears.

---

## 4. SETTINGS-AS-DISPLAY — the new `renderCamBuilder` shape

**Renders (per slot):** the icon **preview** (`<img>`, :1470, no editor), `cam<N>` / name / `WCS` / `-m<group>` (:1461-1465), and a compact read-only summary of the ops (`slot.ops.map(o => o.label|camType).join(' + ')` — the same `name` `buildSlotFromOps` already composes, :1077). Plus the doors + read-only actions:

```
 ┌─ CAM Pack: "My Pack"           [📦 Export .zip] [🔗 Merge eng]  ← pack header (DISPLAY)
 │  ✓ No collisions · 12/400 form params used                     ← cam_validate (DISPLAY)
 │  [＋ New CAM slot]                                              ← DOOR (openCamAuthoring, seed-from-program)
 │
 │  ┌───────────────────────────────────────────────────────────┐
 │  │ [icon]  cam22  "Pocket"   WCS:Active  -m42                 │  ← DISPLAY (rename/renumber/WCS light-edit)
 │  │ ops: Pocket (rect) + Drill                                 │  ← read-only op summary
 │  │ [Edit ▸] [View output] [▶ Simulate] [⧉ Duplicate] [✕]     │  ← DOOR + READ-ONLY actions
 │  └───────────────────────────────────────────────────────────┘
 │  ┌───────────────────────────────────────────────────────────┐
 │  │ [icon]  cam23  "Surface"  …                                │
 │  └───────────────────────────────────────────────────────────┘
 └─
```

**Drops (the "second editor"):** the field table + `addf`/`delf` (#4/#5), `Refresh fields` (#6), op cards (#7), the `＋ Add op` cluster (#8), the macro `<textarea>` (#2), the icon **editor** buttons `🎨`/`🖼`/`delicon` (#9/#10). The blank `cam_add_slot` door (#1) and `cbmBuildModal` (#12) go with them.

**Keeps read-only:** `View output` (exp, :1634), `Simulate` (:1633), `Duplicate` (:1613), `Delete` (:1575), `Export .zip` + `Merge eng` (pack-level). **Reorder:** not present today at slot level (only op-level, which is removed) — add slot `▲▼` in the display if wanted (a `_camPack.slots` splice, trivial), or leave order = cam-number order. **FORK: reorder scope** (Section 8).

---

## 5. ICON EDITOR INTO THE WIZARD

Today `openIconEditor(initial, onSave)` (iconEditor.js:102) is invoked from the per-slot settings action (macrosApp.js:1576), its `onSave(bmp, model)` writing `slot.icon`. The move:
- **In the wizard** (`mountAuthoringSurface`, :1261): add an **icon affordance/step** beside the slot-name row — the current icon preview + `🎨 Draw icon` (→ `openIconEditor(_authoring.icon || autoIconBmp(...), (bmp,model) => _authoring.icon = {...})`) + `🖼 Import BMP` (reuse `importCamIcon` logic against `_authoring`). The icon is composed **while** the slot is authored (design intent), then persisted on Build/Update (carry `icon` through `cbmBuild` onto the slot).
- **In settings:** the card shows the icon **preview only** (read-only), plus the `⚠ not 360×180` size warning (:1470) as a display hint. No draw/import/clear in settings.
- **Auto-icon** (`autoIconBmp`, :1596) already seeds a labelled icon on a fresh slot — keep it as the wizard's default so a new slot is never blank.

The `openIconEditor` signature and `slot.icon` shape are unchanged — only the **call site** moves (settings → wizard), so the change is a relocation, not a rewrite.

---

## 6. SLICED BUILD ORDER (S1..S6) — smallest-first, each independently verifiable

- **S1 — Settings-as-display refactor (mostly DELETION; byte-neutral to built slots).** Strip from `renderCamBuilder` (macrosApp.js:1441-1482): the field table (:1450-1459), `addf`/`delf`/`refresh` (:1475), `opCardsHtml` (:1476), the macro `<textarea>` (:1477), `addOpClusterHtml` (:1479), the icon editor buttons (:1471-1472). Leave the icon preview, header, `View output`, `Simulate`, `Duplicate`, `Delete`, `Export .zip`, `Merge eng`, `cam_validate`. Remove the now-orphaned handlers (`cf`/`cs`-body/`addf`/`delf`/`refresh`/`addop`/`opup`/`opdown`/`dupop`/`delop`/`cam-op*`, :1553-1652) — **only** those your deletion orphaned. **Verify:** the panel renders every existing slot with its icon + read-only summary; `View output`/`Simulate` still work; `slot.body`/`slot.fields` untouched → export byte-identical. Independent of the wizard.
- **S2 — Collapse the doors.** Delete `cam_add_slot` (:171 markup + :1657 handler). Relabel `cam_build_slot` → **"＋ New CAM slot"** (:171); its handler already calls `openCamAuthoring()` (:1659) which already seeds-from-program + shows the empty-state (:1207) — no logic change. **Verify:** New from a program with CAM-able ops seeds the table; empty program → the empty-state guidance; no blank-slot door remains.
- **S3 — The manifest-Edit + update flag (the crux; modal-only, does NOT touch the active program).** Add `_editingSlot`; add `manifestToAuthOp` (inverse of `toManifest`); add a per-slot **"Edit ▸"** that sets `_editingSlot` + `_authoring` from `slot.ops` and opens the modal pre-seeded; make `mountAuthoringSurface`/the build button read **"Update CAM (camN)"** when editing; route `cbmBuild` past `cbmBuildModal` to the overwrite branch (:1436) when `_editingSlot != null`; clear `_editingSlot` on exit. Delete `cbmBuildModal` (:1326) once New (always-new) + Edit (always-overwrite) are the only paths. Mirror `refreshEditingChrome` with a modal-header "✎ Editing camN" note. **Verify (real symptom):** Edit cam22 → the wizard opens pre-seeded with cam22's exact expose/bake + tuned values (declare-never-infer, not re-parsed) → flip one Expose→Bake → **Update CAM (cam22)** → cam22 overwritten **in place**, same cam#, **no prompt**; the `.eng`/`#2600` reflect the change.
- **⚠ GATE-IF-BALLOONS — S4 — Edit → active stack (editor/Blocks as live views).** For a **universal/substack** slot, reconstruct `makeOp(opType, defaultParams(getUserDef(opType)), def.template)` and `ddcsLoadBlockStack` it (guard the active program first — Fork C). For a **generator** slot, reconstruct the twin at defaults (or skip — modal-only stays the path). This is the design-literal one-stack-many-views payoff but the **lossy/risky** slice. **If it balloons** (the generator default-param instance, the multi-op concat, the dirty-program guard, the round-trip back to `slot.ops` on Update) — **STOP and gate:** S1-S3 already deliver "one editor + update-in-place"; ship them and defer the live editor/Blocks view to its own task. **Verify:** Edit a universal slot → the Blocks tab + Studio editor show the op → editing a value + Update rebuilds the slot.
- **S5 — Icon editor into the wizard (Section 5).** Add the in-wizard icon affordance (`openIconEditor` against `_authoring.icon`, import + auto-icon), carry `icon` through `cbmBuild`; remove the settings icon-editor buttons (preview stays). **Verify:** draw an icon while composing a New slot → Build → settings shows the preview; Edit → the icon is pre-loaded and re-editable. Independent of S3/S4 (shares only the modal shell).
- **S6 — Migration + hand-edited-macro honesty + polish.** Legacy slots with **no `slot.ops`** (hand-built): Edit is disabled or offers **View output only** (can't infer ops from the macro — declare-never-infer; Fork F). `bodyDirty` slots (hand-tweaked macro diverged from ops, :1085/:1125): Edit warns via `regenGuard`/`dlgConfirm` that Update rebuilds from ops and discards manual edits (Fork E). Dispose of the settings `cam_customize_op` button (Fork B). Optional slot reorder. **Verify:** a legacy raw slot survives (View output works, Edit greys); a hand-edited slot warns before clobbering.

Discipline mirrors the sibling plans: S1-S2 are pure surface (deletion + relabel), S3 is the crux but self-contained (modal), S4 is the gated risky live-view, S5-S6 are additive + honesty.

---

## 7. OPEN FORKS / RISKS (each with a recommendation)

**FORK A — Edit reconstruction: manifest-reseed-the-modal vs active-stack-load.** The manifest path (S3) is faithful for **all** slot kinds, minimal, and touches nothing outside the modal; the active-stack path (S4) is the design-literal one-stack-many-views but is **exact only for universal/substack** and reconstructs generators at default params. **RECOMMEND: manifest-reseed as the uniform PRIMARY (S3); active-stack-load as the GATED universal/substack enrichment (S4).** They converge as the block-native `cam_table` work matures (the def then carries the full pendant declaration, so `editWizardDef` alone restores everything). Trade-off: two realizations under one "Edit" button until convergence — honest, and dispatched by a single `slot.ops[0].type` check.

**FORK B — the `🧩 Customize` door.** Keep it as a settings button + op-menu entry, or fold "edit as blocks" into the wizard's advanced affordance. **RECOMMEND: keep the OP-MENU Customize (opContextMenu.js:61), retire the SETTINGS button (`cam_customize_op`).** Settings becomes a display; forking a twin into blocks is an **op** action (you fork the op you're looking at), and the wizard's universal/substack Edit (S4) already IS "edit as blocks" for a slot. Trade-off: one fewer discoverable door in settings — mitigated because New-from-op + Edit both reach the blocks.

**FORK C — Edit replaces the active program; what about unsaved editor work?** Only the S4 active-stack-load clobbers the current program; the S3 modal path does not. **RECOMMEND: (1) the S3 modal path is the default → no clobber; (2) gate S4's `ddcsLoadBlockStack` behind a dirty/non-empty check** — reuse the `saveStates` snapshot (saveStates.js) or a `dlgConfirm` ("Loading this slot replaces the current program — save it first?"), matching the `regenGuard`/`bodyDirty` clobber-confirm culture (macrosApp.js:1090). Trade-off: an extra confirm on a non-empty program — correct, since replacing the program is destructive.

**FORK D — a composed (multi-op) slot restoring to one stack.** `slot.ops` is an ARRAY; the manifest path re-seeds `_authoring.ops` natively (the modal already renders N op groups, :1214); the active-stack path must concat N reconstructed ops. **RECOMMEND: manifest-reseed (native multi-op) is primary; S4 concats the per-op reconstructions into one stack** (universal/substack exact; a mixed generator+universal slot loads the universal ops exactly and the generators at defaults). Trade-off: a mixed-kind composed slot has heterogeneous fidelity in the live view — flag it in the S4 badge; the built slot is unaffected (buildSlotFromOps is unchanged).

**FORK E — hand-edited-macro slots (the (a) ops-source vs (b) code-source tension).** A slot whose `slot.body` was hand-tweaked (`bodyDirty`, set at :1567) has DIVERGED from `slot.ops`. The wizard edits the **ops** (source) and `buildSlotFromOps` OVERWRITES `slot.body` (:1083) — discarding the hand edits. **RECOMMEND: ops are the declared source; on Edit of a `bodyDirty` slot, warn via `regenGuard`/`dlgConfirm` (reuse :1090) — "the macro was hand-edited; editing in the wizard rebuilds from the ops and discards those edits."** Offer **View output** (read-only) as the non-destructive alternative. Do **not** attempt to reverse-parse hand edits back into ops (declare-never-infer). Trade-off: a hand-tweaked slot can't round-trip through the wizard — honest; the raw text remains its escape hatch until re-authored from ops.

**FORK F — legacy slots with no `slot.ops` manifest.** Old/hand-built slots (`{slot,name,fields,body}`, no `ops`) have nothing to restore. **RECOMMEND: Edit is disabled (or greyed with a tooltip) for a no-`ops` slot; it keeps View output + Simulate + Delete.** Migration is lazy/self-healing: such slots simply stay raw-display; a user re-authors from scratch via New if they want the wizard. Trade-off: no automatic upgrade of legacy slots — acceptable (inferring ops from a compiled macro is exactly the inference the design forbids).

**FORK G — where "New CAM slot" seeds.** The current program's CAM-able ops (auto-import, :1309) vs an explicit op-picker. **RECOMMEND: seed from the current program's ops (existing behaviour); empty program → the empty-state that guides "build a Surfacing/Pocket/… op first" (existing, :1207).** The op-menu `▸ Build CAM slot` remains the "from THIS one op" variant. Trade-off: New depends on the user having ops in the program — which the empty-state handles, and matches "never a blank canvas."

**FORK H — does the settings display keep the per-slot rename/renumber/WCS as editable, or push them into the wizard too?** **RECOMMEND: keep them editable-light in the display** (they are per-slot **facts**, not op authoring — renumbering `camN`, renaming, choosing WCS don't compose a toolpath). Trade-off: a sliver of editing remains in "read-mostly" settings — but it is metadata, not authoring, so it doesn't reintroduce the second editor.

---

## 8. THE HONEST LIMITS (where the code makes the locked design harder)

- **`slot.ops` is a projection, not the source stack (Headline 3).** "Set the slot's op-stack active" is a **reconstruction**, and `toManifest` (:1190) discarded the source op's `params`. For universal/substack the def is the source and reconstruction is exact; for the 8 generators the reconstruction is a parametric twin **at defaults**. The plan argues this is faithful (the CAM slot IS parametric), but the literal reading "restore the exact ops you built from" does **not** hold for generator slots.
- **Two Edit realizations under one button (Fork A).** The block-native `cam_table` machinery (`maybeMaterializeCamTable`, devMode.js:515) **skips generator twins by design** (:519 — a generator's build never reads `camFieldsFromStack`), so a generator slot cannot ride the `editWizardDef` def-stack path; it must re-seed the modal from the manifest. Universal/substack ride the def-stack path. One button, two mechanisms, until block-native params covers the generators (which the sibling plan flags as its own hybrid frontier).
- **Hand-edited macros can't round-trip (Fork E).** The ops are the declared source; a `bodyDirty` slot's manual G-code is unreachable from the wizard without discarding it. This is the (a)-vs-(b) tension the user raised, and there is no non-inferring way to fold hand edits back into ops.
- **The active-stack load is destructive to the current program (Fork C).** S4's `ddcsLoadBlockStack` replaces whatever the user has in the editor/Blocks. The S3 modal path avoids this, which is why S3 (not S4) is the primary — but the design's "editor/Blocks are live views" only materialises with S4, so the payoff carries a destructive-load caveat and needs a dirty guard.
- **Customize (`opunit` fork) already overlaps New-from-op.** `wrapRecognizedForFork` (devMode.js:555) + `wrapForkAtSave` (:485) already opunit-wrap a recognized twin; S4's universal/substack reconstruction must **not double-wrap** (the `root.children.length===1 && opunit` guard at :495 is the precedent to reuse). A careless reconstruction could produce a doubly-wrapped op that emits wrong.
- **Reorder is not a slot-level concept today.** Only ops reorder (within a slot, being removed). Slot reorder (Fork H/Section 4) is new surface, small but not free.

---

## 9. Critical files for implementation
- `DDCS-Studio/web/ui/macrosApp.js` — the whole CAM surface: `renderCamBuilder` (:1441, → display), `openCamAuthoring`/`makeAuthOp`/`renderCbmTable`/`mountAuthoringSurface`/`cbmBuild` (:1301/:1176/:1205/:1261/:1422, → the one editor + Update flag), `cbmBuildModal` (:1326, REMOVED), `toManifest` (:1190, + its new inverse `manifestToAuthOp`), `buildSlotFromOps`/`generateOp` (:1058/:1020, unchanged engine), `nextSlotNum` (:1656), the door handlers (:1657-1665), `simulateSlot`/`exp` (:1521/:1634, read-only actions), `camRowBlock` (:1379, the block-native seam), `openIconEditor` call site (:1576, → wizard). **Read via `git show HEAD:… | tr -d '\000'` — the file carries a raw NUL byte.**
- `DDCS-Studio/web/blocks/devMode.js` — `editWizardDef` (:545) + `saveAsCustomOp` (:682) + `openSaveDialog` (:578, the Update-vs-Save-as-new UX) + `_editingWizard`/`refreshEditingChrome` (:568/:569) + `wrapRecognizedForFork`/`wrapForkAtSave` (:555/:485, the no-double-wrap guard at :495) + `maybeMaterializeCamTable`/`maybeMaterializeParamGroup` (:515/:534): the exact precedent to promote from a def to a CAM slot.
- `DDCS-Studio/web/blocks/programModel.js` — `setStack`/`projectToEditor` (:213/:221) + `ddcsLoadBlockStack`/`ddcsGetBlockProgram` (:244/:243): the one-stack/many-views substrate S4 rides.
- `DDCS-Studio/web/data/opCamMap.js` — `builtinTypeForTwin`/`isCamGeneratorTwin` (:43/:42), `seedFromOp` (:261), `camTypeOf` (:132): the twin↔generator map for reconstructing a generator's program op (S4) + the seed re-hydration (S3 `manifestToAuthOp`).
- `DDCS-Studio/web/ui/opContextMenu.js` — `▸ Build CAM slot` (:51) + `🧩 Customize as blocks` (:61): the external doors kept (New-from-op + the Customize fork, Fork B).
- `DDCS-Studio/web/ui/globalFunctions.js` — `ddcsBuildCamSlot` (:408): the toolbar New door.
- `DDCS-Studio/web/ui/iconEditor.js` — `openIconEditor(initial, onSave)` (:102): relocated from settings into the wizard (Section 5), signature unchanged.
- `DDCS-Studio/web/blocks/userOps.js` — `getUserDef` / `makeOp` / `defaultParams` / `flattenBlocks`: the def → program-op reconstruction (S4), the same calls `editWizardDef` makes.
- `DDCS-Studio/web/blocks/saveStates.js` — the active-program snapshot to guard S4's destructive load (Fork C).
