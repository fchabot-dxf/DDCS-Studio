# NEXT SESSION — Binding Rebuild (handoff)

---
## 📝 MESSAGE FROM THE ADVISORY SESSION — module restructure proposal

**Finish your current work first (glow), commit it clean, then read this.**

### The problem: `opStacks.js` is a misnamed mediator
The name "opStacks" only describes one of five unrelated responsibilities living in that file. It sits between
all 21 wizard files and `programModel.js`, orchestrating between them — that's a controller role, not a "stacks"
role. This is the root of the "forked away from programModel" drift.

The five responsibilities and where they should live:

| what lives in `opStacks.js` today | what it actually is | right home |
|---|---|---|
| `BUILDERS` registry + `makeOp` | how to construct a block stack from op params (needs all 21 wizard imports) | **`opBuilders.js`** |
| `buildActiveOpStack` → `previewActiveOp` → `commitActiveOp` → `reconcileActiveOp` | the wizard session — the op being authored before commit | **`opSession.js`** |
| `replaceOp`, `deleteOp`, `duplicateOp`, `mergeOpBlocks` | program mutations — edits to the committed stack | `opSession.js` (needs BUILDERS; see coupling note below) |
| `isOpBlockEdited`, `editedLinesForOp`, `collectInjectedIds` | glow / diff utilities | **`opGlow.js`** |
| `opFromMarker`, `importMarkedNc` | marker import — the other half of `serializeWithMarkers` | **`programModel.js`** |

### The clearest symptom — codec asymmetry
- Export: `serializeWithMarkers()` lives in `programModel.js` ✓
- Import: `opFromMarker()`, `importMarkedNc()` live in `opStacks.js` ✗

Both halves of a codec belong in the same file. Moving the import side into `programModel.js` (next to
`serializeWithMarkers`) is the single most impactful fix — it makes the round-trip self-contained in the right
place.

### Second issue — `blockModel.js` is misnamed
It's stateless (no state, no subscriptions). It takes blocks and emits G-code (`emitMapped`, `emitProgram`, `newBlock`).
The name "model" implies it owns state, like `programModel.js` does. More honest: **`blockEmitter.js`**.

### Coupling note — why program mutations can't simply move to `programModel.js`
`replaceOp`, `deleteOp`, `duplicateOp` need BUILDERS to rebuild after a replacement. Moving them to
`programModel.js` would require importing `opBuilders.js` there — a new dependency. Simpler: keep mutations in
`opSession.js` which already owns BUILDERS, and have `opSession.js` call `programModel.setStack()` to commit.
That's the current pattern anyway; the rename makes the role explicit.

### Proposed end state
```
blocks/
  opBuilders.js   ← BUILDERS registry (21 wizard imports, makeOp)          [was part of opStacks.js]
  opSession.js    ← active wizard session (build→preview→commit) + mutations [was part of opStacks.js]
  opGlow.js       ← glow/diff (isOpBlockEdited, editedLinesForOp,            [was part of opStacks.js]
                    collectInjectedIds)
  opSchema.js     ← schema registry + codec (already renamed) ✓
  programModel.js ← program state + opFromMarker + importMarkedNc            [absorbs codec import side]
  blockEmitter.js ← stateless block→G-code emitter                          [was blockModel.js]
  gcodeToStack.js ← G-code → block stack parser (fine as-is) ✓
  programFraming.js, macroFile.js, lint.js, suggest.js, bigram.js, saveStates.js — all fine as-is
```

### How to do it safely
Each rename is purely mechanical — no logic changes, just moving exports between files.
Run the full suite + protocol validator after each step. One commit per rename.
Do NOT do them all in one commit — the diff becomes unreadable.

Order:
1. ✅ **DONE (commit `47a330d`)** `blockModel.js` → `blockEmitter.js` — git mv + ~40 importers + header; suite green.
2. ✅ **DONE (commit `7373da5`)** moved `opFromMarker` + `importMarkedNc` → `programModel.js` (codec symmetry, next to `serializeWithMarkers`).
3. ✅ **DONE (commit `b976615`)** extracted `opGlow.js` (the three glow exports + `stripBlockIds` + the LCS override-diff helpers).
4. ✅ **DONE (commits `7a383e6` + `89218bf` + `f0bed03`)** — extracted `opBuilders.js` leaf FIRST (per the ordering note),
   then split the remainder into `opSession.js`, then dissolved the `opStacks.js` barrel (importers re-pointed, file deleted).

> ## ✅ THE RESTRUCTURE IS DONE — `opStacks.js` is gone (5 commits `7a383e6`→`f0bed03`, suite green at each)
> Followed the **opBuilders-first** ordering. Final module set:
> ```
> opBuilders.js   ← BUILDERS leaf (the wizard stack-builder registry + op-container construction)
> opSession.js    ← wizard session (build/preview/commit) + mutations + RECONCILERS + find + accumulation
> opGlow.js       ← form-vs-blocks diff (isOpBlockEdited / editedLinesForOp / editedRangesForOp + override-diff)
> programModel.js ← program state + the FULL marker codec (serializeWithMarkers + opFromMarker + importMarkedNc)
> ```
> Two corrections to the advisory's straddler plan, **verified against the real code** (the impl-session note above was
> slightly off): **`find`** is used only by `placeFields` + `RECONCILERS` → stayed with `opSession` (not a leaf util);
> **`stripBlockIds`** is used only by `isOpBlockEdited` + `_paramsDiffer` → went to `opGlow` (NOT a straddler — `mergeArrays`
> does not use it). No cycle (`programModel → opBuilders` is call-time only). Adversarially reviewed: reachability + cycle +
> untested-path agents all clean. ⚠ Downstream: `ddcs-vscode-extension/web/dist/bundle.js` (generated) still names
> opStacks — it picks up the new files on the next `npm run build:web` in the extension.

---
## ✅ DONE — `DICT` → `SCHEMA`, `opDictionary.js` → `opSchema.js` (advisory rename, commit below)
The export is now `SCHEMA` and the file `web/blocks/opSchema.js` (a schema registry — it declares every op's
param structure/types/canon/field bindings; not a plain lookup). Purely mechanical; suite + validator green.
`paramFields`, `markerLine`, `parseMarker`, `BIND_ORPHANS`, `validate` kept their names. **References below that
still say `DICT`/`opDictionary.js` in the historical commit table are accurate for those commits.**

---

> ## ✅ THE BINDING REBUILD IS DONE (steps 1–4 shipped to `main`)
> The wizard form-field binding is now **unified into the dictionary**. `PARAM_FIELDS` is gone; the field id
> lives ON each SCHEMA param (`SCHEMA[op][param].field`), and consumers read it via `paramFields(opType)`. The
> protocol validator structurally prevents drift (`BIND_ORPHANS` empty). Verified the live edit path end-to-end.
> **What's left = optional cleanup + the queued features below.** See "DONE" + "What's next".
>
> ## 🔴 GOLDEN RULE (still applies)
> **Run BOTH after EVERY change, before committing:**
> ```
> cd DDCS-Studio && npx playwright test --reporter=line            # full suite  (baseline: 229 pass, 1 known-fail)
> npx playwright test tests/protocol-validator.spec.js              # the protocol guard
> ```
> **The existing tests ARE the contract.** The one real error two sessions ago came from deleting a subsystem
> *without running the suite* — it broke 14 tests (reverted). Do not repeat it. Dev server runs on `localhost:3211`.

---

## Baseline — already shipped + pushed to `main`
A **self-describing-G-code format/parser system**: a program's ops carry `( @DDCS:1 {…} )` marker comments, so a
saved `.nc` round-trips back into high-level ops. **Declare, never infer.**

| commit | what |
|---|---|
| `f1f51a6` | **B1** `web/blocks/opDictionary.js` — the op dictionary (`DICT`) + the `( @DDCS:1 {…} )` marker codec (`markerLine`/`parseMarker`) + per-param `canon` rename map |
| `215147e` | **B2** `programModel.serializeWithMarkers()` — self-describing export; the live editor stays clean |
| `7b413d9` | **B3** `opStacks.importMarkedNc()` + `opFromMarker()` — read markers → reconstruct ops |
| `5580086` | **egress** — `editorManager.buildProgram()` emits markers on export/transfer; `commandDeck.loadGcodeFile()` reconstructs a marked `.nc` |
| `2d5371a` | **dict expansion** — all 21 ops in `DICT`, canon renames applied |
| `d636dc7` | **B4** override-diff glow — `collectInjectedIds` flags injected atoms **and** value-edited matched blocks |
| `6a0a105` | **B5 (partial)** — removed `isOpBlockEdited`'s broken form-safe reconciler check (field-id↔param adapter gap; it was a dead no-op) |
| `a6a4040` | **protocol VALIDATOR** `tests/protocol-validator.spec.js` — caught `circular`'s missing dict entry on first run |
| `a7ad0c5` | **rebuild step 1** — `PARAM_FIELDS` exported; validator now guards "every op has a form-field binding (or is exempt)" |
| `bd45abf` | **rebuild step 2 (move)** — `PARAM_FIELDS` co-located into `opDictionary.js` as `FIELDS`; wizardManager re-exports it (pure data move) |
| `8dcb8b0` | **rebuild step 2 (reconcile)** — validator asserts `FIELDS ⊆ DICT`; reconciled every drift (rpm on cutting ops; originX/originY on slot+text; qStop on the 6 probe ops; syncA/slave on edge; orient on atc_change; atc_table lengths/pockets → includeLengths/includePockets). Truth = view params-reader + `<name>Stack` reads (13-agent map + spot-checks) |
| `58b85d3` | **rebuild steps 3–4** — field folded ONTO each dict param (`DICT[op][param].field`); `paramFields(op)` replaces `PARAM_FIELDS`; `_seedForm`/`canEdit` read the dict; `BIND_ORPHANS` guard replaces the now-structural `FIELDS⊆DICT` check; live edit path verified end-to-end |

Clean baseline = **~229 passed, 1 failed** (the 1 is always one of the two known-bad below).

---

## The architecture — the rules (from `docs/MULTI-OP-STACKING.md`)
**`op.params` is the source of truth. G-code is a one-way projection. Never invert it.**
The BANNED "inference" = recovering high-level intent **from opaque motion lines**. That is the *only* banned thing.

### ⚠️ The trap that bit me last session — read this twice
- **`RECONCILERS` (in `opSession.js`) read DECLARED params off the STRUCTURED BLOCK MODEL** (`offX` stored on the
  PlaceOnStock block; ATC tolerance on the atom). **That is DECLARATION, not inference.** They are a **tested,
  legitimate** reverse-sync feature (≈14 tests: `place-on-stock-block`, `slot-array`, `atc-roundtrip`, …).
  **DO NOT DELETE THEM.** I conflated "reads block params" with "infers from motion," deleted them, broke 14
  tests, and reverted.
- Rule of thumb: **reading the structured block model = declaration (fine). Recovering intent from emitted
  motion text = inference (banned).** `gcodeToStack` reads motion but only for *leaf* atoms (`G1 X10` declares
  its own X) — never high-level intent. That's fine.

---

## DONE — the form-field binding is unified into the dictionary
The param→form binding used to live in **two places that could drift** (`PARAM_FIELDS` forward + `RECONCILERS`
reverse). The forward binding is now **one declared source of truth on the dict**:
- The field id is a property of each schema param: **`SCHEMA[op][param].field`** (folded in from a compact authoring
  column `FIELD_BIND` at module load, in `opSchema.js`).
- `paramFields(opType)` (in `opSchema.js`) returns the `{ param → field id }` map, derived from the schema —
  the **replacement for `PARAM_FIELDS`**. `wizardManager._seedForm()` + `canEdit()` read it.
- A binding whose param isn't catalogued can't attach → it lands in **`BIND_ORPHANS`**, which the protocol
  validator asserts is empty. So the field map **cannot drift** from the dictionary — it lives ON it.
- The reconciliation (step 2) used the truth = **what each view's params-reader emits + each `<name>Stack`
  reads** (verified with a 13-agent map + manual spot-checks). Notable resolutions: `qStop` is emitted by every
  probe view but no builder consumes it yet (`twoPassProbe` hard-codes `Q=1`) — declared in the dict anyway
  because `op.params` carries it (source of truth); `slot`/`text` placement keys are `originX`/`originY` (the
  PlaceOnStock child-block layer is `offX`/`offY`, a different layer); `atc_table` was a stale-FIELDS rename.

### Step 5 (reverse-sync `RECONCILERS`) — ASSESSED + DEFERRED (optional, unfavorable)
`RECONCILERS` (`opSession.js`) map **block-atom params → form-field ids** (e.g. `sf_depth ← stepdown.to`), and emit
a **mix** of (a) op-param-bound fields and (b) pattern/derived fields with *no* flat binding (`sl_dia`, `sl_count`,
`d_cols`, un-derived `stepover%`). Migrating them to "produce `op.params` → map via the dict" only covers (a);
(b) stays hardcoded — and `drill`'s reconciler can't use `paramFields` at all (drill is binding-exempt). So it's a
partial, messy decouple of 14-tested reverse-sync code for modest gain. **Left as-is on purpose. Don't delete it.**
(The reconcilers reading the structured block model = DECLARATION, not the banned inference — see the trap above.)

### Exemptions (ops with no `.field` binding — the validator still exempts these)
`drill` (custom `view.setForm` for pattern variants), `atc_length` (Settings-driven, no per-op fields),
`homing` (no form-field map).

---

## Key files
- `web/blocks/opSchema.js` — `SCHEMA` (per op: param type + `addr` + `canon` + now `.field`), `FIELD_BIND` (the
  authoring column folded onto `SCHEMA`), `BIND_ORPHANS`, `paramFields(op)`, codec, `validate`. **The single source of truth.**
- `web/blocks/opBuilders.js` — `BUILDERS` (exported, the wizard stack-builder registry), `makeOp`, `_framed`, `_builderAtoms`. The LEAF.
- `web/blocks/opSession.js` — the wizard session (`buildActiveOpStack`/`previewActiveOp`/`commitActiveOp`), mutations
  (`replaceOp`/`deleteOp`/`duplicateOp`/`commitDecodedCode`/`mergeOpBlocks`), `RECONCILERS` (**keep** — block→form reverse
  sync), `find`, the accumulation/label-hygiene helpers.
- `web/blocks/opGlow.js` — the form-vs-blocks diff: `isOpBlockEdited`, `editedLinesForOp`, `editedRangesForOp` +
  `collectInjectedIds`/`collectEdits` (override-diff) + `stripBlockIds`.
- `web/blocks/programModel.js` — stack-as-truth, the line→op map (`proj.map` = per-line block ancestry, built in
  `blockEmitter.js`'s `emit`: `own = [...anc, block.id]`), the marker codec (`serializeWithMarkers` + `opFromMarker` + `importMarkedNc`).
- `web/wizardManager.js` — imports `paramFields`; `_seedForm` + `canEdit` read the dict binding; `openForEdit`
  (seeds from `op.params` — the correct forward path), `pullFromBlocks` (reverse-sync via RECONCILERS, **keep**).
- `tests/protocol-validator.spec.js` — the guard: SCHEMA entry + binding (`.field`) + `BIND_ORPHANS` empty + canon
  unique + marker round-trip. **Extend it as you add ops/features.**
- `docs/MULTI-OP-STACKING.md` + `docs/BLOCKS-TAB.md` — the architecture (declare vs infer).

---

## Known-failing tests — IGNORE (pre-existing, not yours)
- `macros-tabs.spec.js` — stale (asserts an old flat-tab macros layout; UI is a tree now).
- `middle-animator.spec.js` — flaky animation timing; passes in isolation.

---

## ✅ Params-completeness — DONE (commit `6b997ab`)
A freshly-inserted op now satisfies `BUILDERS(op.params) == op.children` (block ids aside), so it doesn't
false-glow or falsely read as block-edited. **The handoff's "probe op.params doesn't capture sources" was a
MISDIAGNOSIS** — `sources` round-trips fine; probe ops were already clean. The real culprits (found by actually
running the app, not guessing): (1) the `region` block nested in `stepover.params` gets a fresh counter-based id
each build → fixed with a shared `stripBlockIds()` in the id-sensitive compares (`isOpBlockEdited`, the glow's
`_paramsDiffer`); pocket glowed 189 lines → 0. (2) `homing` self-wraps its atoms in an op container but
commit/replace/duplicate wrapped it AGAIN → fixed with `_framed()` (build + unwrap a self-wrapping builder),
routed through all six build sites. Guard: `tests/op-params-complete.spec.js` (all 21 ops clean).

## ✅ Word-level glow — DONE (commits `078fba6` + renderer test `6d25832`)
The "glow the exact edit" ask. The override-diff glow was line-level; editing ONE value in a Blocks atom lit the
whole line. Now `opStacks.editedRangesForOp(opId)` diffs the clean form rebuild's emit vs the live stack's emit
(forward-only, via `emitMapped`) and returns `[{ line, range }]`: a value-edited LEAF → `range = [start,end)` of
just the changed token; an injected / container / multi-line edit → `range = null` (whole-line). `editorOpHover`
renders it: `wrapRange` wraps the token in a `.word-edited` span (disconnects its MutationObserver during the wrap
to avoid a re-entrancy loop); whole-line keeps the `.op-block-edited` class. `collectInjectedIds` refactored to
share the LCS walk (`collectEdits`, which also returns the override base/actual pairs). Verified end-to-end at the
DOM level (`tests/word-glow.spec.js`: word range + injection whole-line + the rendered `.word-edited` span).

## Other queued work (after the binding rebuild)
- **USER wizard-maker** — let a user parametrize a block stack → a *compliant* custom op; the validator validates
  it by construction. (Separate product feature; builds on the unified binding + validator + the params-
  completeness guard above — a user op is valid only if `BUILDERS(params)` reproduces its blocks.)

  **Authoring flow (confirmed):**
  1. User inserts an existing op (e.g. probe edge) via the wizard bar — it lands as a block stack in the
     Blocks tab.
  2. User switches to the Blocks tab and enables the **dev panel** — a specialized authoring panel that
     shows the full atom structure with editable param declarations (type, range, default, units, label).
  3. User marks specific atom values as params (e.g. approach distance, probe speed, corner side) and
     names them. The dev panel is also usable for editing any existing op or macro — not authoring-only.
  4. User names the custom op (e.g. "my_corner_probe") and hits **"Save as custom op"** → the op is added
     to the user registry.
  5. The custom op appears in the wizard bar as a first-class entry. Clicking it opens a form showing only
     the declared params — same UX as a built-in wizard.
  6. Right-click → Edit opens it back in Blocks + dev panel for modification.

  This is the **fork-the-5%-delta** flow: start from a built-in, specialize the parts you control, name
  it, share it. Not building from atoms up — building on top of what already works.

  **Wizard file format:** each custom op saves as its own `.wizard` file — one op, one file. Portable,
  shareable, not bound to a profile. The wizard bar loads all `.wizard` files in the user's library.

  **Wizard library manager in Settings:** a GUI where users can manage all wizard files — built-ins and
  custom. Built-in wizards ship as `.wizard` files (the app's default library, same format as user ops).
  > **Hybrid reality (honest note):** built-ins are CODE (custom forms, 3D sims, pattern logic), so a built-in's
  > library entry is METADATA-ONLY + references its coded view — only USER ops are fully declarative `.wizard` files.
  > Built status (2026-06-25): library layer is `web/blocks/wizardLibrary.js` (catalog + per-entry/group overrides
  > + the `.wizard` codec) on top of `userOps.js`. **Forking a built-in = capture its output stack + expose params**
  > (a simplified declarative copy via the generic form), NOT a clone of its bespoke UI/sim.
  - List of all wizards: built-ins (read-only badge, forkable) + user wizards (fully editable)
  - Per entry: show/hide toggle (hidden wizards don't appear in the wizard bar), rename, edit (opens in
    Blocks tab dev mode), delete (user wizards), fork (built-ins), export/share
  - "Reset to factory" = reload the shipped built-in `.wizard` files

  **Dev mode UX (confirmed):**
  - Remove the current overlay buttons from the Blocks tab canvas (crosshair, +, -, trash). Zoom/pan via
    scroll/pinch; delete via keyboard or right-click.
  - Replace with a single small **floating dev-mode toggle** in the corner of the Blocks tab.
  - **Normal mode** (default): blocks show their current state, clean. Users learn block editing without
    authoring complexity — progressive disclosure.
  - **Dev mode**: each block expands inline to reveal its param declaration fields (type, range, default,
    units, label). No separate panel — the blocks themselves grow to show the authoring layer. The floating
    toggle is the only mode switch.

  ### Technical design (scoped 2026-06-25 — feasibility VERIFIED, ready to build)
  A user op = a saved block-stack **TEMPLATE** + a list of param **BINDINGS**, registered at RUNTIME. The template is
  the forked stack with every value at its default; a binding points at one value and exposes it as a param:
  ```
  def = {
    opType:  'user_<slug>',           // unique, namespaced (e.g. user_my_corner_probe)
    label:   'My Corner Probe',
    template: [ …block records, ids stripped, all values at default… ],
    bindings: [ { param:'approach', blockIndex:N, key:'dist',                 // WHERE in the template
                  type:'number', default:5, min:0, max:50, units:'mm', label:'Approach distance' }, … ],
  }
  ```
  `blockIndex` indexes a deterministic pre-order walk of the template's children; `key` is the numeric param on that
  block. The binding carries exactly the **dev-panel declarations** (type / range / default / units / label).

  **register(def)** installs it live (one new module `web/blocks/userOps.js`):
  - `BUILDERS[def.opType] = (params) => instantiate(def, params)` — clone the template, substitute each binding's
    value at its (blockIndex,key); unbound values stay baked. `instantiate` + `flattenBlocks` (children-only for v1).
  - `SCHEMA[def.opType] = { param: { type, addr:null, canon:param, field:'uop_<type>_<param>' } … }`.
  - `registerOpLabel(def.opType, def.label)` — a tiny new export in `opBuilders.js` writing the mutable `OP_LABELS`.

  **Compliant for FREE (verified — `BUILDERS`/`SCHEMA` are plain mutable objects, runtime-extensible):** the template
  IS `BUILDERS(defaults)`, so `BUILDERS(op.params) == op.children` → **no false glow, passes params-completeness**.
  Markers round-trip (canon = param name, unique). Validator type-checks. Glow / merge / `replaceOp` / `opFromMarker`
  all gate on `BUILDERS[opType]`/`SCHEMA[opType]` and just work. Consumers confirmed: `opBuilders._framed`,
  `opSession.{hasActiveOpStack,build,commit,replace,duplicate,merge}`, `opGlow.{isOpBlockEdited,editedLines/Ranges}`,
  `programModel.opFromMarker`, `opSchema.{paramFields,canonOf,revCanon,validate,markerLine,parseMarker}`,
  `wizardManager.{canEdit,_seedForm}`.

  **The two real builds (everything else is free):**
  1. **The dev panel** (authoring flow steps 2–3, 6) — a Blocks-tab panel that renders the active op's atom tree and
     lets the user click a numeric value → declare it (type/range/default/units/label) → a binding. Also a general
     op/macro inspector/editor (per the flow). Captures each value's (blockIndex,key).
  2. **The generic param form** (flow step 5) — user ops have NO hand-written wizard `view`, so clicking the custom op
     opens a **data-driven form generated from the bindings** (one input per param, ids `uop_<type>_<param>`, honoring
     range/units/label) → `BUILDERS(values)` → insert. This same generic form is `_seedForm`'s target on edit.

  **Persistence:** localStorage registry `ddcs_user_ops` (JSON array of defs; mirrors slotPack / `CAMPACK_KEY`).
  `loadUserOps()` re-registers all at app start. Stretch: fold into the profile (`settings.userOps`) so it survives
  profile export/import.

  **Surfacing (flow step 5 — "first-class in the wizard bar"):** the wizard bar is **static HTML**
  (`commandDeck.renderHeader` ~553-597), so a "Custom" group must be injected/data-driven there (the one bit of extra
  wiring). The Blocks **toolbox** is already registry-driven (`PALETTE`, `web/wizards/ops/index.js`) → a "Custom"
  category appears for free, a good secondary surface. Soft degradations (all fine): user ops render as the generic
  `op` container block (no bespoke Blockly block); dict-based `_seedForm` (no per-op view) — which is exactly why the
  generic form (build #2) exists.

  **Build order (one commit per stage, suite green each):**
  1. `web/blocks/userOps.js` core (instantiate/register/validate/persist/load + `userOpFromStack`) + `registerOpLabel`
     in `opBuilders.js` + a **programmatic compliance test** (make a 2-binding user op → assert it builds, marker
     round-trips, validates, and `_builderAtoms(type,defaults)` deep-equals the template → no false glow; mirrors
     `protocol-validator` + `op-params-complete`). **No UI — pure foundation.**
  2. The generic param form + insert path + `loadUserOps()` at startup + the wizard-bar "Custom" group.
  3. The dev panel (authoring + edit). **v1 param type = number** (depths/feeds/speeds/coords); enums/geometry later.
- **L1/L2** — per-controller address columns in the dict (the cross-controller translator); best-effort read of
  foreign post markers (e.g. Fusion op headers) as declarations.
- **`macrosApp.js` restructure + naming** — 1338 lines, four unrelated workflows (Homing/Sysstart,
  M-codes O100nn, K-buttons key-N.nc, CAM Pack Builder). Same medicine as `opStacks.js`: modularize first,
  then add validation, then tests. Ritual distance by section:
  - *CAM Pack Builder* — closest (sequence exists: slots → icons → pack → deploy); just untested
  - *Homing/Sysstart* — short distance (structured fields → .nc); no output validation
  - *M-codes / K-buttons* — furthest (raw text, no schema, no sim, no round-trip — "a prayer not a ritual")
  The systemic gap: none of the Macros tab output participates in the `@DDCS` schema system. A lint pass
  over declared intent (I/O touched, registers written, motion range) would catch obvious errors without full
  sim — same direction as the sim intent layer.
  **Naming:** ✅ **DONE** — two things called "macro" — `.mjson` saved op-stacks (Studio-side) vs Macros tab O-code
  scripts (controller-side). `macroFile.js` → `programFile.js` (commit `e5c93a7`); `camPack.js` → `slotPack.js`
  (commit `b5bdde4`, incl. the macrosApp `camPack`→`slotPack` namespace alias). `macrosApp.js` kept (it genuinely
  authors controller-side macros). Kept for data-compat: the `ddcs.macro` .mjson kind id, `CAMPACK_KEY`, the
  "CAM Pack Builder" UI label. **Still TODO: the `macrosApp.js` MODULE restructure itself** (1338 lines, 4 workflows
  above) — same medicine as `opStacks.js`, just untouched.

- **Gateway — implementation gaps (architecture already correct)** — already file-per-view (10 files, ~93
  lines avg). No restructuring needed. Two gaps:
  1. `merge.js` is a **stub** — multi-tool merge (combine single-tool programs, insert T+M6 + safe retract
     between each, one program frame) declared but not wired. Natural completion of the Send→Track loop.
  2. `watch.js` variable map half-done — #100–499 confirmed, #500+ pending per-controller mapping; same
     problem as the L1/L2 address columns queued for `opSchema`. Same fix covers both.
  Cloud path (admin.js dual-mode, Worker replacement) remains deferred per [[gateway-cloud-architecture]].

- **Sim intent layer** (`web/viz/opSimContext.js`) — ✅ **v1 DONE** (commits `14f5792` + `6bfcf04`). The declared
  op-type → preview-render-intent leaf: `opSimContext(opType) → { showRotaryRig, forceMachine, showMagazine }` +
  `programSimContext(opTypes)` (the UNION for a multi-op program). Pure + tested (`tests/op-sim-context.spec.js`).
  CORRECTION to the original framing: `gcodeViz3d` does NOT interrogate op TYPE directly — it's already decoupled via
  external setters (`setRotaryFixture`/`setMagazine`/`setProbes`/`setForceMachine`); the op-type decisions were
  scattered in the per-wizard VIEWS, so a generic consumer silently missed them. v1 centralizes those flags + wires
  the one generic consumer that needed them (the Blocks tab — see below). **Remaining (v2, optional):** widen to
  `(opType, stock, profile)` returning declared geometry/envelope/magazine-pocket data so `gcodeViz3d`'s `stock.shape`
  / `getRotaryAxes` / machine reads consume plain data too; also the Blocks preview could gain the ATC envelope +
  magazine (needs the pocket data that today lives in `atcViews.magazinePockets`). The per-op wizard views stay
  explicit on purpose (each knows its own type — routing through the table would be pure indirection).
- **Blocks tab rotary preview context** — ✅ **DONE** (commit `6bfcf04`). The Blocks tab is a GENERIC preview, so it
  missed the 4th-axis rig. `blocksApp.renderViews` now applies `programSimContext(stack op types).showRotaryRig` via a
  new panel `setRotaryFixture` passthrough — the **op type decides**, not `stock.shape` (rectangular stock on a rotary
  axis is valid). (The original note's premise — "the rig is gated on `stock.shape === 'cylinder'`" — was wrong: the rig
  was already op-flag-gated; the real gap was that the Blocks preview never CALLED `setRotaryFixture`.) Verified on the
  live 3D preview (`tests/blocks-rotary-rig.spec.js`: rotary op shows `viz._showRotaryFixture`, a mill program hides it).

- **Suggest bar: search mode + bigger panel** — the suggest bar (`web/ui/suggestBar.js`) is currently a
  context-aware chip row (predicts next token from the current line). Add a **search mode** alongside it:
  a small search input (🔍 icon or tap the bar) that lets the user type a name or code and get matching
  G-code commands to insert. This replaces the on-screen keyboard for the "I want to insert M3" use case
  on touch — search "spindle" → tap M3 spindle CW → inserted.

  What to build:
  1. A search input that appears when the user taps/clicks a 🔍 button next to the chip row.
  2. The search corpus: all chips from `suggestFor()` across all contexts (collect the full flat list), PLUS
     a curated list of named commands (e.g. `{ label: 'M3 spindle CW', insert: 'M3 S' }`, same pattern as
     the chip `T()` entries). The named list can start small and grow.
  3. Filter by label OR by code prefix as the user types. Results render as chips in a bigger panel
     (not just one row — 2–3 rows or a scrollable list) below/above the bar.
  4. Tap to insert (same `window.insert` path as the existing chips).
  5. Clear/close on Escape or when the editor regains focus.
  6. The existing context-aware chip row stays as-is; search is an additional mode toggled by the 🔍 button.

  Make the panel larger in both modes (currently one row; expand to show more chips on wide screens and
  allow 2 rows on narrow). The panel height should be a CSS variable so it's easy to tune.

- **File extensions: `.profile` + `.project`** — rename the saved file formats to descriptive extensions:
  - `.profile` — machine configuration (replaces the current anonymous JSON profile saves)
  - `.project` — saved op stack / program (replaces `.mjson`)
  Keep backward-compat: on open, accept `.mjson` and re-save as `.project`. The `ddcs.macro` kind id in
  the JSON payload can stay for data-compat. `programFile.js` needs updating for the new extension.

- **Profile identity + pulled-data glow in settings** — two related UX gaps that make the personalized
  machine space feel abstract:

  0. **Move "Pull from controller" to Settings → Controller tab** — the pull is a setup action (import your
     machine config into Studio), not a live communication action. It belongs in the Controller tab in
     Settings, not in the Gateway tab. The gateway bridge still does the actual data fetch, but the
     user-facing button lives in the Controller tab, but the pull populates EVERY settings tab — Machine
     (envelope from soft limits), I/O (limit switch pins, probe pins), Spindle, etc. One pull, all tabs
     reflect real machine data. Gateway keeps its live ops (send, track, console).

  1. **Named profile + correct save model** — after a pull+apply, prompt to save as a named profile file
     (e.g. "my_router.ddcs"). The active profile name is shown visibly in the UI (header or settings label).

     **Save model — no auto-save to localStorage:**
     - localStorage stores only WHICH profile was last loaded (filename), not the settings values.
     - The profile FILE is the source of truth. On load: read settings from file.
     - Changes are in-memory until the user explicitly saves to the file.
     - A dirty indicator ("my_router •") shows when in-memory state has drifted from the saved file.
     - Auto-saving changes to localStorage is dangerous with multiple profiles — silently corrupts state.

  2. **Pulled-data glow in settings** — settings fields populated from a controller pull should be visually
     distinct from fields still at their default value. A subtle glow, highlight, or "from controller" badge
     on the field (same visual language as the op-block glow) makes it immediately clear which settings are
     real machine data vs unconfigured defaults. Store the provenance alongside the value (e.g.
     `{ value: 300, source: 'pull' }` or a parallel `settings._sources` map) and apply the style in the
     settings panel renderer.

- **Machine envelope from controller soft limits** — after a gateway pull, automatically read the DDCS soft
  limit Pr values from the dump and drive the machine envelope visualization. Pr numbers are the same across
  Expert M350 and V4.1 (shared DDCS parameter space):
  - **Pr155** = soft limits master switch (0=disabled, 1=enabled)
  - **Pr161/162/163** = negative X/Y/Z software limit (mm)
  - **Pr166/167/168** = positive X/Y/Z software limit (mm)

  Behavior:
  - **Pr155=1** (soft limits on) → set `machine.x/y/z` from the Pr161-168 range; envelope box redraws to
    match. The user looks at the envelope and sees their soft limits reflected — no lookup, no manual entry.
  - **Pr155=0** (soft limits off) → check `settings.inputs.some(i => i.type === 'limit')`:
    - Limit switches with a pin configured (`inputs.some(i => i.type === 'limit' && i.pin !== '' && i.pin != null)`)
      → machine zero is a hard boundary; grid anchored at machine zero, open toward the work area (no far box).
    - No limit switches with a pin → fully open grid in all directions; machine zero shown as an origin
      marker only, not an edge. (Default limit entries with no pin = not physically wired.)

  Also populate limit switch input pins from the pull — the controller knows which physical input is wired
  to each axis limit switch:
  - **Pr515/518/521** = negative X/Y/Z hard limit input pin (0 = not wired, 1–24 = input number)
  - **Pr530/533/536** = positive X/Y/Z hard limit input pin (same range)

  After pull: for each axis, if the Pr value > 0, set the corresponding `inputs[]` limit entry's `pin` to
  that value. This is what determines whether the visualization treats machine zero as a hard boundary
  (pin set = physically wired) or shows an open grid (pin = 0 = no switch).

  Where to wire: the gateway pull already decodes the `setting`/`eng` dump via the bridge. The decoded Pr
  values need to flow into `settingsPanel.js` — Pr155/161-168 into `machine.x/y/z`, and Pr515/518/521 +
  Pr530/533/536 into the `inputs[]` limit pin fields. The pull modal or a post-pull callback is the right
  place. No new UI surface needed — the existing envelope box and inputs list are the confirmation.

- **New Machine ops: Loop + Subroutine Call** — two new ops for the Machine wizard dropdown (alongside Comm/MDI,
  Warm-up, Set Output, Wait Input, Dwell). Both clear the "worth a wizard" bar: they generate non-trivial code and
  have non-obvious syntax on the Expert dialect.
  1. **Loop** — generates a `WHILE #N LT [count] DO1 … END1` block with a counter variable. Params: iteration
     count, counter variable number. The body is a nested op slot. Wizard form: count field + variable picker.
     Schema entry + BUILDERS entry + protocol validator pass required.
  2. **Subroutine Call** — generates `M98 P[file]` with parameter passing via registers. Params: sub filename/number,
     argument values mapped to registers. Wizard form: file picker + parameter table. Same protocol requirements.
  Both are Expert-ONLY (caps-gated, same pattern as I/O ops). Add SCHEMA entries, BUILDERS entries, and extend the
  validator EXEMPT_BINDING or add field bindings as appropriate.
