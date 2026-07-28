# UNIVERSAL CAM — code-grounded architecture plan

Branch: `feat/cam-builder` · Scope: **planning only** (no source edits) · Repo: `DDCS-Studio/web`

## Headline (TL;DR)
1. **The crux is already 90% built into the engine.** `wizards/ops/util.js:17` `val()` passes a `#var`/`[expr]` **string through verbatim** into emitted G-code, and `num()` (`util.js:2`) coerces it to a numeric default. That is the SIMPLE-vs-GEOMETRY split, **declared at the kernel level** — feed/coord/rpm/probe-target go through `val()`, loop/pattern/stepover/peck go through `num()`.
2. **Recommended mechanism = (C)-locates / (A)-survives, verified empirically.** Use the op bindings (`{param, blockIndex, key}`, e.g. `drillData.js:65`) to know exactly which socket a param drives (candidate C = the *where*), then inject that param `#var` token via the existing `instantiate()` (`userOps.js:428/445`) so it flows through the fold and emits verbatim wherever the kernel used `val()` (candidate A = the *how*, realized through the existing `val()` seam — **no per-kernel rewrite**). Classify each param by an **emit-probe** (declare-then-verify).
3. **Reject (B) bare-literal post-process** as fragile (feed `1500`, depth `5`==clearance `5` collide); reject **pure-(A)** whole-emitter parametric flag (touches ~30 kernels, fights `num()`/arithmetic, duplicates `val()`).
4. **Recommend HYBRID, not replace.** Unrolled emit **cannot keep geometry live**; the 8 parametric generators (`probeToSlot`/`millToSlot`/`opToSlot` + `camMacroKit` `rasterClear`/`ringClear`) stay the **premium** live-parametric path for the standard shapes, universal unroll+expose is the **long-tail** path for ANY forked op.
5. **UI is 100% reusable** — the `cbm*` modal, `_authoring.ops[]`, group-by-op expose/bake table, seed doors, multi-op `buildSlotFromOps`, icon step, Simulate — only the **per-op generator call** gains a third arm (`stackToSlot`). Pendant `slotPack` (`slotMacro`/`engLine`/`mirrorVar`) consumes the unrolled body **unchanged**.
6. **Prove it with one slice:** a base op + one `val()`-ready atom (Feed + Move), expose feed + single-plunge Z, bake the rest → `stackToSlot(def, decl)` returns the exact `{name, fields, body}` the existing UI + `slotPack` already eat.

---

## 1. THE CRUX — arbitrary op stack emit → `#2600`

### 1.1 The current emit path (grounded)
- A program op is a transparent container: `blockEmitter.js:135` (`type==='op'`) and `:142` (`user_root`) just recurse into children. A composed/forked op = a `user_root` wrapping `panel/sim/param_group` (uiChildren) + the executable `children` (see the drill def stack `drillData.js:148-162`).
- **Params reach the emit via sockets, not the form.** `instantiate(def, params)` (`userOps.js:428`) clones the def `template`, prunes guards, flattens, and for each binding does `blk.params[b.key] = params[b.param] ?? b.default` (`userOps.js:445`). So the form param `feed` lands in socket `(blockIndex 4, key 'feed')` per `drillData.js:100`.
- The fold `emit()` (`blockEmitter.js:127`) calls `resolveParams()` (`:69`) which runs `evalExpr` (`:74`) per string param, then hands **numbers** to the leaf kernel `def.emit(p, dx, dy, dialect)` (`:289`). Containers/paths/loops/depth/fill (`:261/:275/:162/:184/:202`) **multiply or branch** lines from their params (`def.points(p)`, `depthLevels`, `def.segments`).
- Post-passes over the flat lines: `applyModalFeed` (`:510`), `applyProgramTransform`→`rotateProgram` (`:373`), the place/rotate/skim folds `translateProgram`/`rotateProgram` (`:218/:229/:238`).

### 1.2 Why the clean `allocFieldsWith` interpolation point does not exist here
The generators own their body as a **string template** and interpolate `v[key]` (`probeToSlot.js:71-89`, `opToSlot.js:132-141`) — there is exactly one substitution site per param. An **arbitrary unrolled emit** has no such site: the value is scattered across N moves after the fold. So we need a mechanism that plants the token **before** the fold and lets it ride through.

### 1.3 The three candidates, grounded

**(A) Parametric-emit mode in the block emitter.** *Assessed:* the leaf kernels already interpolate raw strings — but most wrap params in `num()` (`drill.js:13` `num(p.feed,100)`; `dwell.js:9`), which coerces a `#var` to `NaN`→default. A true parametric mode means teaching **every** kernel to emit a token instead of a number for exposed params: ~30 kernels, must handle arithmetic (`drill.js:18-22` `Math.min(d+q, depth)`), and it **duplicates the `val()` declaration** that already exists. Too invasive; not "universal".

**(B) Post-process the unrolled G-code.** *Assessed:* emit literals, then string-replace the exposed value with `#2600`. **Fragile exactly as feared:** feed `1500` appears on every cut line (want all → fine) but the *value* `5` is simultaneously `depth`, `clearance`, and `stepdown` in a typical op — a bare-literal replace cannot tell which token is which. Also negation/scaling (`Z${r3(-d)}`) means the literal in the text is not the param face value. Rejected as the primary mechanism.

**(C) Binding-driven substitution.** *Assessed:* the binding **is** the param→socket map (`{param, blockIndex, key}`, `deriveBindings.js:65`, `drillData.js:65-102`). It tells us the **exact** `(blockIndex,key)` a param drives — no guessing, no literal collision. This is the right *locator*. It does not by itself solve survival-to-output, but combined with the `val()` seam it does.

### 1.4 RECOMMENDATION — "bind to locate, val() to survive, probe to verify"
A single new pure function, **`stackToSlot(def, decl, used, varOffset)`** (new file `web/data/stackToSlot.js`), does:

1. **Allocate** a `#11xx` param + `#2600` mirror + field per **exposed** param — reuse `slotPack.nextParam` (`slotPack.js:33`) and the field shape from the binding `label/units/type` (fall back to defaults). Identical allocation contract to `allocFieldsWith` (`probeToSlot.js:71`) so multi-op `used`/`varOffset` composition is unchanged.
2. **Tokenise + instantiate.** Build a params object where each **exposed** param value is its assigned **local `#var`** string (e.g. `'#31'`), each **baked** param is its literal, each geometry/unexposed param is its default. Call `instantiate(def, tokenParams)` (`userOps.js:428`) → the token lands in the socket (`:445`).
3. **Emit.** `emitMapped(stack, dialectOpts)` (`blockEmitter.js:328`). Wherever the kernel used `val()` (`move.js:18-28`, `feed.js:10`, `arc.js:13`, `probe.js:14`), the `#var` **passes through verbatim** (`util.js:17`) → `F#31`, `X#31`, `G31 ... F#31`. `applyModalFeed` already tolerates `F#`/`F[` and resets modal tracking (`blockEmitter.js:518`) — exposed feeds are safe by construction.
4. **Wrap.** Prepend one `readLine` per field (`#31=#2631 ;Label [mm] =def [min~max]`, `probeToSlot.js:89` / `macrosApp.js:1024 canonicalRead`) so `slotPack.slotMacro` (`slotPack.js:73`, `hasReads` guard `:80`) and **Refresh-fields** (`fieldsFromMacro`, `slotPack.js:140`) keep working. Return `{ name, fields, body }` — the **same shape** every generator returns.

**Why this is least-fragile + most-declarative:** the *where* is declared by bindings (never inferred from text), the *how* rides an **existing, intentional seam** (`val()` docstring literally says "a `#var` or `[expr]` string passes through verbatim ... NOT for params consumed by JS math" — `util.js:13-16`), and the injection reuses `instantiate()` with **zero emitter changes**. The only residual (num()-based leaves bake) is *correct* and points straight at the hybrid boundary.

---

## 2. PARAM CLASSIFICATION — simple-exposable vs geometry-bake

### 2.1 The ground truth is already in the kernels
- **SIMPLE (exposable):** the kernel emits the param through `val()` (`util.js:17`). Files that do: `move.js` (x/y/z/a/b/feed), `feed.js` (rate), `arc.js` (x/y/i/j/feed), `probe.js` (to/feed/port), `spindle.js`, `variable.js`. A `#var` string survives → `F#2600`.
- **GEOMETRY (bake-only):** the param is consumed by `num()` / JS math or drives a fold. Two sub-cases:
  - **Fold-driving:** its socket is a `container`/`path`/`loop`/`depth`/`fill` block (`blockEmitter.js:261/275/162/184/202`) or feeds `def.points`/`def.segments`/`depthLevels` — it changes the **number of moves**, which is frozen once unrolled.
  - **Math-consumed leaf:** `num()` in the kernel (`drill.js:13` feed+depth+peck; `bore.js:15`) → a token becomes the default. Even a "value" param here bakes.
- **Transform-blocked:** an x/y param whose socket sits **under** a `place`/`rotate`/`skim` fold (`blockEmitter.js:218/229/238`) — `translateProgram`/`rotateProgram` regex-parse numbers, so `X#2600` would be mangled/dropped. Bake-only unless no transform is above it.

### 2.2 Can it be DECLARED or INFERRED? — do both (mirror `NON_BAKEABLE`)
- **INFER (floor, works for ANY op — the point of "universal"):** an **emit-probe**. Instantiate+emit twice: once with the token, once with the literal default. The param is **exposable iff** (a) emit does not throw, (b) the token appears in the output as a clean standalone word, and (c) **line count is identical** to the literal emit (proves it did not change the move count → not fold-driving) and no `NaN`/`[object` appears. Otherwise **bake-only**. This mirrors the existing declare-then-verify culture (drill-as-data emit-equivalence spec, `drillData.js:32-38`).
- **DECLARE (optional override):** allow a binding to carry `camExpose: 'value' | 'geometry'` (parallel to `NON_BAKEABLE`, `opCamMap.js:77`) for the rare case the probe is ambiguous or the author wants to force bake. Declaration wins; the probe is the safety net.
- The verdict feeds the **existing** `field.bakeable` flag the table already renders (`macrosApp.js:1149/1153` — greyed Bake radio + tooltip). Geometry params render **Bake-forced, Expose-disabled**.

---

## 3. REPLACE vs HYBRID

**RECOMMEND: HYBRID.** Reasons, grounded:
- The generators emit **runtime WHILE/loops** so depth/stepover/pattern-count stay **live `#2600` knobs** (`opToSlot.js:74-116` peck/ring loops; `millToSlot.js` via `camMacroKit.rasterClear`/`ringClear` `camMacroKit.js:66/125`). The universal path **unrolls** the fold — geometry is baked into the move list and cannot be a live knob without re-parametrising the loop, which *is* what the generators do.
- So: **generators = premium** live-parametric path for the 8 standard shapes; **`stackToSlot` = universal** path for everything else (forked/custom stacks, and the value-knobs on any op).

**Migration of `opCamMap` / `camTypeOf` / `seedFromOp`:**
- Keep `camTypeOf` (`opCamMap.js:118`) as the **premium router**: "does a hand-tuned generator exist for this op?" → the 8 arms unchanged.
- Add a **fallback verdict**: when `camTypeOf` returns `{unsupported}` (`:130/:135/:142/:145`), route to `{universal: true}` instead of dead-ending. Widen `isCamableType` (`:31`) to "op has a registered def" (≈ always true) so the picker offers **every** op.
- `seedFromOp` (`:156`) gains a **universal branch** that reads the def **bindings** directly (param names are already the def own) — **no `PARAM_ALIAS`/`DERIVE`/`genFieldsFor`** needed (`:39/:60/:97`). Net: universal is *more* DRY than the alias tables; the long tail costs zero per-op maintenance.
- `ENUM_OPTIONS` (`:86`) still applies — a binding `widgetConfig.options` already carries enum label↔int (`drillData.js:66` WCS_OPTIONS), so the enum-dropdown authoring table generalises for free.

---

## 4. UI REUSE MAP (the v1 authoring surface carries over)

**Stays IDENTICAL (no change):**
- The one modal opener `openCamAuthoring(seedOp?)` (`macrosApp.js:1198`); overlay/panel state `_cbmOverlay`/`_cbmPanel` (`:1116-1117`).
- `_authoring.ops[]` model (`:1115`) and `makeAuthOp` shape `{opType, camType, variant, fields, values, exposed, baked, label}` (`:1122-1128`).
- Group-by-op expose/bake table `renderCbmTable` (`:1132`), the per-row Expose/Bake radios + `bakeable` greying (`:1149-1153`), `cbmToggle` (`:1243`), numeric/enum value edit (`:1178-1194`), `cbmVal` (`:1131`).
- The three **seed doors**: op-card `Build CAM slot` (`opContextMenu.js:46-51` → `ddcsOpenCamAuthoring(full)`), toolbar, and CAM-tab **auto-import all CAM-able ops** (`macrosApp.js:1206-1213`).
- **Multi-op** composition `buildSlotFromOps` (`:1038`) — allocates params **around** siblings (`used`), continues `varOffset`, tags `f._op`, re-applies tuned `op.values` (`:1042-1055`). `declFromOp` (`:1017`) → the `decl` object.
- **Slot-confirm** `cbmBuildModal` (new vs overwrite, `:1223`) + `cbmBuild` (`:1273`).
- **Icon step**: `renderCamBuilder` slot cards + icon editor + BMP import + auto-icon (`:1285/1314-1316`, `openIconEditor`, `autoIconBmp`, `svgToCamIcon`), the planned snapshot-as-icon.
- **Simulate** (`cbmSimulate` `:1262`, `simulateSlot` `:1365`) via `createPreviewPanel`, seeding `#2600` mirrors from field defaults (`:1269`) — probe stock synthesis (`:1254`) unchanged.
- **Refresh-fields** from macro (`fieldsFromMacro`, `slotPack.js:140`).

**Changes (ENGINE beneath only):**
- `generateOp` (`macrosApp.js:1009`) gains a **third arm**: today `CAM_GEN[type] ?? slotFromOp(...)`; add `?? stackToSlot(def, decl, used, off)` for universal ops. Same `(used, off, variant, decl)` contract → `buildSlotFromOps` needs **no structural change**.
- `makeAuthOp`/`seedFromOp` (`:1122`) read the **universal seed** (bindings-derived fields + probe-classified `bakeable`) for non-generator ops.
- The manifest op (`toManifest` `:1129`) gains `opType` + a def-version stamp so a universal slot can be **rebuilt** (see Fork 4).
- Everything downstream (`toManifest`→`buildSlotFromOps`→`slotPack`) consumes the same `{name, fields, body}`.

---

## 5. PENDANT SLOT + ENG — reuse confirmed

`stackToSlot` returns `{name, fields, body}` where `body` is the unrolled emit carrying `#26xx`/local `#var` tokens. Everything in `slotPack.js` is text/field-shape agnostic:
- `slotMacro` (`:73`) prepends `( macro_camN.nc )` header + WCS + (guarded) mirror reads (`hasReads` `:80`) + `M99`. Because we emit our own `readLine`s, `hasReads` correctly **skips** re-prepending.
- `engLine`/`slotEng` (`:60/:67`) build the pendant form rows from `fields` (idx/label/units/def/min/max/type).
- `mirrorVar` (`:20`) `#11xx→#2600`; `nextParam` (`:33`) pool alloc; `collisions`/`outOfPool`/`validatePack` (`:39/:49/:109`) still gate.
- `mergeEng` (`:93`) appends the new param rows into the controller `eng` safely.
- **Round-trip:** `fieldsFromMacro` (`:140`) re-derives fields from `#var=#26xx ;comment` reads → **Refresh-fields works** iff we emit reads in canonical form (`macrosApp.js:1024`). This is the reason to inject a **local `#var`** (not the raw mirror) at the socket (Fork 1).

---

## 6. THE HONEST LIMITS (what CANNOT be exposed, and how it surfaces)

- **Geometry is frozen by unrolling.** Any param that drives a `container`/`path`/`loop`/`depth`/`fill` fold (`blockEmitter.js:261/275/162/184/202`) or a `def.points`/`depthLevels` count → the move list is already emitted; a `#2600` cannot change it. Surfaced as **Bake-only** (Expose radio disabled, `macrosApp.js:1153`) with reason "drives the number of moves — bake it".
- **`num()`-consumed leaves.** Drill/bore feed+depth (`drill.js:13`, `bore.js:15`) bake to default in the universal path — for a *live-parametric* drill/bore use the `opToSlot` generator instead (hybrid).
- **Transform-blocked position.** x/y under a `place`/`rotate`/`skim` fold (`:218/229/238`) cannot carry a token (numeric regex transforms) — bake-only; the emit-probe catches the mangling automatically.
- **Complex-geometry atoms** (pocket raster/contour via `camMacroKit.rasterClear`/`ringClear`; `restmachining`, `fill`, `fillText`) have **no `val()` value seam** → they stay **baked** or keep their **parametric generator**. This is the exact hybrid frontier.
- **Fan-out params.** A param feeding **two** sockets (drill `clearance` → progstart + leaf, `drillData.js:28` frontier #3) only tokenises the bound socket → flag as bake-only (honest) rather than silently expose one of two.
- **Depth caveat (the user "expose depth"):** depth is exposable **only** as a single-plunge Z (`move.js:20` `val`); depth-with-stepdown drives the `depth` fold pass-count → geometry → bake, or use the generator. The plan surfaces this per-op via the probe, not as a blanket promise.

---

## 7. PRIORITISED SLICED BUILD ORDER

- **U0 — prove the universal path end-to-end (engine only, zero UI).** New `web/data/stackToSlot.js`: given a registered def + a `decl` (exposed/baked map), inject local-`#var` tokens at exposed sockets via `instantiate`, `emitMapped` → unrolled body, prepend `readLine`s, return `{name, fields, body}`. Target op: **one simple custom op = a base + one `val()`-ready atom** (a Feed atom + a Move cut), expose **feed** + a **single-plunge Z**, bake the rest, **no place/rotate/loop above the exposed sockets**. Verify: `slotMacro` renders, Simulate traces, seeding `#2600` moves the feed. *(This is the whole proof — a test harness calling `stackToSlot`, no modal needed.)*
- **U1 — the emit-probe classifier.** Per exposed param: line-count + clean-token check → `field.bakeable`/exposable. Verify: feed→exposable, a stepdown/pattern param→bake-only, an under-rotate x→bake-only.
- **U2 — the router.** `opCamMap`: `camTypeOf` returns `{universal}` instead of `{unsupported}`; widen `isCamableType`; `seedFromOp` universal branch reads bindings (drops `PARAM_ALIAS` dependence for the long tail). Keep the 8 generators (hybrid).
- **U3 — UI swap (thin).** `generateOp` third arm → `stackToSlot`; `makeAuthOp` consumes the universal seed; manifest carries `opType`+defV. Table/toggles/preview/build/icon unchanged. Verify multi-op compose (param alloc around siblings, `f._op`).
- **U4 — polish + honesty.** Geometry rows show bake-only reason; a "premium vs universal" badge per seeded op; snapshot-as-icon; optional `camExpose` declared overrides.

---

## 8. FORKS FOR THE HUMAN (each with a recommendation)

**FORK 1 — token grammar at the socket.** Inject the **local `#var`** (then prepend `readLine`s; matches `slotMacro`/`fieldsFromMacro` grammar, Refresh-fields works) **vs** inject the raw `#2600` mirror (fewer lines, but breaks canonical reads + Refresh). **RECOMMEND: local `#var` + prepended reads** (generator parity, `slotPack.js:80/140`).

**FORK 2 — classification: declare vs infer.** Per-binding `camExpose` declaration **vs** the emit-probe inference. **RECOMMEND: probe-infer as the floor** (zero per-op authoring — the point of "universal"), with an **optional declared override** (mirrors `NON_BAKEABLE` declare-plus-verify, `opCamMap.js:77`).

**FORK 3 — replace vs hybrid engine.** Universal `stackToSlot` **replaces** the 8 generators **vs** runs **alongside** them. **RECOMMEND: HYBRID** — unrolled emit structurally cannot keep geometry live; generators stay the premium live-parametric path for the standard shapes, universal covers the long tail. (Migration: `camTypeOf` becomes the premium router with a universal fallback.)

*Additional forks (lower stakes):*
- **FORK 4 — slot rebuild memory.** Manifest carries `opType` + defV stamp to re-`instantiate` (matches `defVOf` staleness, `programModel.js:184`) **vs** snapshot the emitted body. **RECOMMEND: opType + defV stamp.**
- **FORK 5 — value provenance.** Bindings-only (clean; fan-out params flagged bake-only) **vs** stack-walk to catch multi-socket params. **RECOMMEND: bindings + flag fan-out as bake-only** (honest, simple).
- **FORK 6 — exposed-feed verbosity.** An exposed `F#2600` repeats every cut line (modal-fold skips `F#`, `blockEmitter.js:518`). **RECOMMEND: accept it** (correct + legible); add a `#var`-aware modal fold only if operators complain.

---

## Critical files for implementation
- `DDCS-Studio/web/wizards/ops/util.js` — `val()`/`num()` (`:17`/`:2`): the exposable-vs-geometry seam the whole mechanism rides.
- `DDCS-Studio/web/blocks/userOps.js` — `instantiate()` (`:428/445`), `flattenBlocks` (`:54`), `registerUserOp`/builder (`:501-521`): the token-injection + def→stack entry point.
- `DDCS-Studio/web/blocks/blockEmitter.js` — `emit`/`emitMapped` (`:127/:328`), the folds (`:184/202/218/261/275`), `applyModalFeed` (`:510`): where the token survives (or gets mangled → bake).
- `DDCS-Studio/web/data/opCamMap.js` — `camTypeOf`/`seedFromOp`/`isCamableType` (`:118/156/31`): the premium router that gains the universal fallback.
- `DDCS-Studio/web/data/slotPack.js` — `slotMacro`/`engLine`/`mirrorVar`/`fieldsFromMacro` (`:73/60/20/140`): the pendant pack the unrolled body plugs into unchanged.
- `DDCS-Studio/web/ui/macrosApp.js` — `buildSlotFromOps`/`generateOp`/`renderCbmTable`/`makeAuthOp` (`:1038/1009/1132/1122`): the reused authoring surface + the one call site that gains the `stackToSlot` arm.
- *(new)* `DDCS-Studio/web/data/stackToSlot.js` — the universal engine (`stackToSlot(def, decl, used, varOffset)` + the emit-probe classifier).
