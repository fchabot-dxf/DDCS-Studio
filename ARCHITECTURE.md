# ARCHITECTURE.md — the map

**Written 2026-08-10. Verified by reading, at HEAD `e554bdc7`.** Working tree at verification time was dirty in
three files only — `DDCS-Studio/tests/node/preview-spec-gate-1688.test.mjs`, `DDCS-Studio/web/viz/latheProfileCanvas.js`,
`DDCS-Studio/web/viz/latheScene.js`. Line numbers in those three may have shifted under you; everything else was clean.

**This document must not become another stale list.** It exists because three specific wrong beliefs cost hours
(§ TRAPS). The rule it lives by: **name the declaration or the registry that holds a fact; do not copy the fact.**
Where a list would rot, a `grep` that regenerates it is given instead. Every claim carries `file:line` so you can
verify it in one jump. Anything not confirmed is marked **UNVERIFIED** rather than smoothed.

Nothing was executed to produce this. Every number below is a count off a declaration, re-derived at verification
time. Test pass/fail states are **not** re-measured — they are WORK-LOG-reported and marked as such.

---

## Q1 — WHAT OPENS WHAT

```
                     ┌───────────────────────────────────────────────────────────┐
                     │  THE ONE DECLARATION                                      │
                     │  `opensAs` on a BUILTINS entry                            │
                     │  DDCS-Studio/web/blocks/wizardLibrary.js:42-81            │
                     └───────────────┬───────────────────────────────────────────┘
                                     │ drives THREE consequences, so they cannot drift
          ┌──────────────────────────┼──────────────────────────┐
          ▼                          ▼                          ▼
   bar click re-points        twin's OWN entry hidden      opened title = built-in's
   commandDeck.js:90          wizardLibrary.js:139         PLAIN label
                              → :156 userEntries()         wizardLibrary.js:144
                                                           → userOpView.js:36
   + inverse bridge for CAM: builtinTypeForTwin  wizardLibrary.js:151 → data/opCamMap.js


 THE WIZARD BAR IS 100% DATA-TWIN.  BUILTINS = 25 entries; ALL 25 declare opensAs.
 WIZ_SPECIAL_OPENER = {}   (commandDeck.js:61 — every 3D-animated opener is gone)

 ROUTE                        CODE                              LANDS ON
 ───────────────────────────  ────────────────────────────────  ──────────────────────────────
 bar · BUILT-IN entry         commandDeck.js:90                 userOpView   (#wiz_user)
                              openWiz(e.opensAs)                the TWIN, always
 bar · USER entry             commandDeck.js:84-86              userOpView if panel is
                              panel form2d|form3d+2d → openWiz    form2d / form3d+2d,
                              else ddcsInsertUserOp             ELSE the QUICK form
                                                                  (ui/userOpForm.js) — a
                                                                  DIFFERENT modal
 Wizard Manager modal         ui/wizardManager.js               NOTHING opens for USE.
   (header ▸ Wizards)         renderMine / renderBuiltins       Lifecycle only: fork /
                                                                rename / dup / export /
                                                                delete / import
 Settings bar-designer        ui/wizardManagerPanel.js          arrange / hide / rename bar
                                                                entries + Restore-to-factory
 edit a SAVED op  (✎)         ui/globalFunctions.js:37          ⚠ open(op.opType) — the RAW
                              → wizardManager.js:401            opType, DELIBERATELY NOT via
                                openForEdit → :404 this.open()   opensAs. This is the ONLY
                                                                door left to the 20 coded
                                                                built-in views.
 Blocks tab palette           blocks/opToolbox.js               a BLOCK STACK, not a wizard
 prereq "Open anyway"         ui/wizardPrereq.js:107            re-enters openWiz(type,…)
```

**`openWiz` has exactly five call sites in app code** — `commandDeck.js:85,90,93,94` and `wizardPrereq.js:107`.
`index.html` contains **zero** `openWiz(` onclicks (`grep -c "openWiz(" DDCS-Studio/web/index.html` → 0).

**Three dead back-compat globals** survive with no caller: `window.openMiddleWiz / openEdgeWiz / openAlignmentWiz`
(`ui/globalFunctions.js:30-32` → `wizardManager.js:422-424`). `openCornerWiz` was deleted; only the tombstone
comment survives at `ui/globalFunctions.js:29`.

**Two wizards are fully RETIRED — their entry points are deleted, not hidden.**
- **CORNER** (retired 2026-07-02, `wizards/views/index.js:20`). No view import, no `#wiz_corner` panel
  (`grep -c 'id="wiz_corner"' DDCS-Studio/web/index.html` → **0**), no opener. Its `BUILTINS` slot survives and
  `opensAs: 'user_corner_data'` (`wizardLibrary.js:56`). `wizards/cornerWizard.js` still exists as the legacy
  **stack builder** the twin's own template is built from (`blocks/dataOps/cornerData.js:44,231`).
- **CIRCULAR** (retired 2026-06-23, superseded by Middle — `wizards/views/index.js:22`). Gone further: it has
  **no `BUILTINS` entry at all**, so it is not even a bar slot.

**The 20 coded built-in views still exist and still render real two-pane forms** — `WIZARD_VIEWS`
(`wizards/views/index.js:36-57`, 20 entries), each with a live `#wiz_<type>` panel (21 unique `#wiz_*` panel ids
in `index.html`, the 21st being `#wiz_user`). **No bar entry reaches any of them.** The only live door is
`openForEdit` (`wizardManager.js:401`), reached from the editor hover ✎ / op context menu.

### The greps that regenerate this — use these, not a copied list

```bash
# every retired built-in and the twin that took its slot
rg -n "opensAs" DDCS-Studio/web/blocks/wizardLibrary.js
# the deletions, with dates and reasons
rg -n -i "retired" DDCS-Studio/web/wizards/views/index.js
# the coded views that still exist
rg -n "^\s{4}\w+View,$" DDCS-Studio/web/wizards/views/index.js
# the live panels
rg -o 'id="wiz_[a-z_0-9]*"' DDCS-Studio/web/index.html | sort -u
```
In the live app: `listEntries().filter(e => e.kind === 'builtin').map(e => [e.id, e.opensAs])`.

---

## Q2 — HOW A WIZARD BECOMES G-CODE

```
 FORM BOX                                                              G-CODE LINE
    │                                                                        ▲
    │ userOpView.update()          wizards/views/userOpView.js:340           │
    │   widget readers → params{}                                            │
    ▼                                                                        │
 params ─► builderOf(opType)             blocks/opBuilders.js                 │
             └─ USER_BUILDERS closure     blocks/userOps.js:905-912           │
                  ├─ instantiate(def,p)   userOps.js:674                      │
                  │    └─ resolveArm      userOps.js:711                      │
                  │         ├─ normalizeParams / withGuardDefaults            │
                  │         ├─ clone def.template   ◄── FROZEN JSON DATA      │
                  │         ├─ deriveGuards → pruneGuards  whenGuard.js:38    │
                  │         ├─ flattenBlocks                                  │
                  │         └─ deriveBindings   dataOps/deriveBindings.js:50  │
                  │    └─ write each binding into flat[b.blockIndex].params   │
                  └─ def.postInstantiate(stack, p)  userOps.js:911            │
                        ▼                                                     │
                  BLOCK STACK  [{ type, params, children }]                    │
                        ▼                                                     │
            emitMapped(stack, opts)     blocks/blockEmitter.js:504 ───────────┘
              ├ uniquifyFlowLabels :484 (called :505)   forward-jump labels, base 91
              ├ per-top-block fold  :513 → emit() :216
              │     resolveParams :113 → resolveValue :88
              │     def.emit(p, dx, dy, dialect)  :456   ← THE KERNEL
              │     block.modalPre grafted        :460
              └ 9 whole-program passes :514-527  (order is load-bearing, stated at :522-526)
```

### The fold, by kind (`blockEmitter.js:216`, dispatch on `def.kind`)

| kind | line | behaviour |
|---|---|---|
| `op` / `user_root` | 224 / 231 | transparent — emit children in order |
| transparent containers | **237** | `param_group\|guard\|section\|setup\|safetraverse\|opunit` — **a `block.type` string literal, not a kind** |
| `var` (Set) | 245 | binds `scope[name]`; on failure binds `UNRESOLVED` |
| `loop` (Count) | 257 | unrolled; child scope carries the index |
| `cond` (If) | 278 | **unrolled** — only the taken branch reaches the file |
| `depth` (Step Down) | 305 | one pass per level; exposes `z`, `by`, `prevZ` |
| `fill` (Step Over) | 336 | `def.segments(p)` per-pass body, else `def.lines(p,z)` |
| `place` | 358 | emit child, then translate — or hand the shift to a self-framing child |
| `rotate` / `skim` | 380 / 389 | emit child, then `rotateProgram` / `relativizeProgram` + G91 wrap |
| `xform` / `flip` / `entry` | 410 / 412 / 414 | childless MARKERS — emit nothing; consumed by whole-program passes |
| `toolsel` | 417 | childless marker recording the op's declared tool |
| `container` / `path` | 422 / 436 | stamp at `def.points(p)` / sweep along `cd.step(params, pt)` |
| leaf / move | **456** | `def.emit(p, dx, dy, dialect)` — e.g. `wizards/ops/move.js` |

### Post-passes, in declared order (`blockEmitter.js:514-527`)

`applySetupFlips` :514 → `applyToolChanges` :515 → `applyEntryWaypoint` :516 → `applyProgramTransform` :517 →
`applySerialLibrary` :518 → `applyModalFeed` :519 → `applyCapGating` :520 → `balanceOwords` :521 →
`applyIndentStyle` :527 (`data/indentStyle.js:169`). Each is byte-identical no-op when its declaration is absent.
Indent runs **last** because every pass above it matches line *text* — the reasoning is written at
`blockEmitter.js:522-526`.

`emitMapped` returns `{ text, lines, map, absorbed, feedFolds }` (`blockEmitter.js:536`). `absorbed` (:531) and
`feedFolds` (:535) are **passes declaring what they did**, so their invariants can be measured rather than trusted.

### The three facts a newcomer gets wrong here

1. **The template is FROZEN DATA.** `userOpFromStack` (`userOps.js:1118`) runs the legacy JS builder ONCE at
   module load and `stripIds`es the result into `def.template`. Anything needing live state at build time is a
   declared `postInstantiate` hook (`userOps.js:911`), never an interpolation in the template.
2. **Ordering inside `registerUserOp` is load-bearing:** `materializeParamGroup(def)` (`userOps.js:900`) MUST run
   before `validateUserOp(def)` (`:902`) — materialization adds the `param_field` blocks and re-derives each
   `blockIndex`; validating first fails every materialized def.
3. **A failed expression keeps the author's text, it does not become 0.** `resolveValue` (`blockEmitter.js:88`)
   returns the raw string on failure. Four sibling failure shapes, each deliberate: a **coordinate** rides out
   verbatim (`wizards/ops/util.js`); a **Set** binds `UNRESOLVED` (`blockEmitter.js:246-254`); a **bound**
   (loop `to`, stepdown `to`) emits the author's text in place of the body; a **condition** emits neither branch.

### Dialect

`getDialect(profileId)` — `wizards/dialects/index.js`. Two consumption modes: **per-line**, threaded as the 4th
argument to every leaf kernel (`blockEmitter.js:456`); and **capabilities**, `getCaps(id)` read at
`applyCapGating` (`:520`) and `balanceOwords` (`:521`). Gating is **per line, never per op** — the op stays in the
stack and unrunnable lines become `( gated: … )` comments.

### Where the emit is actually invoked

```bash
rg -n "emitMapped\(" DDCS-Studio/web --glob '!blocks/blockEmitter.js'
```
The four **program-shaped** call sites: `wizards/views/userOpView.js:428` (the wizard's live code panel + the sim
source; `:424` for the group path), `blocks/programModel.js:215` (committed program → editor text),
`blocks/opGlow.js:81,110,145,168,203` (emit twice, diff for per-word glow), `data/stackToSlot.js:164,166` (CAM
slot body). **Correction to an earlier survey:** that is not the complete set — the legacy `wizards/*Wizard.js`
`generate()` methods call it too (e.g. `wizards/atcChangeWizard.js:226`), and they are still reachable through the
`openForEdit` door (Q1). Also `blocks/dataOps/equivalence.js:34-35`, the twin-vs-builtin byte-identity gate.

---

## Q3 — WHO DRAWS WHAT, AND IN WHICH FRAME

### There are TWO preview boxes in a twin's wizard, and the Layout box holds TWO STACKED RENDERERS

```
WIZARD BODY (twin, panel = form3d+2d)      index.html:837-843
│
├─ #userViz3dBox / #userViz3dContainer ── the 3D box ─────────────────────────
│   └─ .wiz-viz3d           wizardManager.js:539-543  (position:relative)
│        └─ createPreviewPanel        ONE trace, ONE engine, TWO renderers
│             ├─ WebGL canvas   viz/gcodeViz3d.js:68  — appended IN FLOW
│             │      display:none when mode==='2d'    createPreviewPanel.js:1106
│             ├─ canvas.pp-2d  createPreviewPanel.js:96  absolute, z-index:1
│             │      display:none when mode==='3d'    createPreviewPanel.js:1102
│             │      ↑ FULL toolpath2d scene: grid+envelope+stock+path+labels
│             │        +start handles+poschip+cursor
│             └─ statusbar / controls / legend / DRO   (absolute chrome)
│        ⇒ EXACTLY ONE of WebGL | pp-2d is ever visible. They NEVER composite.
│
└─ #userVizContainer ── the 2D "Layout" box ─────────────────────────────────
     styles.css:2651   background:#000; isolation:isolate
     │ [optionally wrapped in .viz-zruler-row — the Z-ruler is a FLEX SIBLING
     │  to the LEFT, userOpView.js:56-83. Not stacked.]
     │
     ├─ canvas.fc-anim-overlay        styles.css:2653   z-index:-1, pointer-events:none
     │      inserted as firstChild    userOpView.js:88-90
     │      ↑ toolpath2d in OVERLAY MODE: path + red head + pulses + poschip ONLY
     │        (early return, viz/toolpath2d.js:182)
     │
     └─ svg.feature-canvas            styles.css:2652   background TRANSPARENT
            gGrid → gItems → gHandles     featureCanvas.js:100-103 (SVG paint order)
                ↑ grid, part-zero crosshair | stock, envelope, paths, guides, holes
                  | handles+labels, attach/corner/edge pickers, snap ring

  ⇒ THESE TWO COMPOSITE. The raster sits UNDER the vector, both visible at once.
    THIS IS THE ONLY PLACE IN THE APP WHERE TWO RENDERERS SHARE ONE FRAME.
    The whole expensive-bug class lives exactly here.
```

### The frame algebra — read this before touching any preview coordinate

```
 THE SVG paints PLACED coords in an UNPLACED view:
     _disp(x,y) = _S(x + p.x, y + p.y)          featureCanvas.js:330
     p = spec.placement, assigned at _draw       featureCanvas.js:379

 THE OVERLAY paints RAW coords in a PLACED view:
     tx(x) = view.ox + x*scale                   toolpath2d.js:83
     view  = _pinFromTf(fc.getTransform())       userOpView.js:50, :94/:97/:105

 THEY MEET because getTransform() FOLDS the placement in:
     getTransform() = { scale, cxw − p.x, cyw − p.y, cx, cy }   featureCanvas.js:83-87
     ⇒ ox + X·scale = cx + (X + p.x − cxw)·scale = _S(X + p.x) = _disp(X)   ✔

 TWO OPPOSITE CONVENTIONS MEETING AT ONE PIXEL. This is the t1686 fix.
 Before it, getTransform() returned the raw pan/zoom _tf and the overlay drew
 ~275 px from the SVG whenever a stock was pinned to a non-G54 WCS.
 The push path can no longer disagree with the pull path: the _onTransform
 callback relays this.getTransform(), not _tf   featureCanvas.js:383
```

**Not everything in the SVG is placed.** `_disp` is applied to paths (:446), items (:457,461,464), holes (:473),
handles (:490), the origin crosshair (:436). Raw `_S` is used for the grid (:402), the **stock rect** (:417 — its
shift is baked into `spec.stock.ox/oy` at `panelTypes.js:205` instead), the snap ring (:559), the machine frame
(:574,578,588), the stock-attach markers (:610), the corner-pick rings (:642) and the edge-pick strips (:677).
Drag input runs the exact inverse: `_hit` subtracts placement (:356), `onDrag` subtracts it (:157),
`_followHandle`/`_handleInGutter` add it (:307,:323).

### Three different shifts, all called something like "the offset"

| name | what it is | declared at | read by |
|---|---|---|---|
| `partZeroShift(machine, stock, floorZ)` | machine coords of part-zero (the WCS pin) | `viz/sceneFrame.js:43` | 3D `PartFrame`; twin Layout `spec.placement` (`panelTypes.js:195, 585, 620, 622`) |
| `stockPinOffset(machine, stock)` | `pinRow − workOrigin`; `{0,0}` unless explicitly pinned — **a different number** | `viz/sceneFrame.js:88` | `toolpath2d.js:91` (both modes) |
| `placeShiftFromParams` / `placeShiftOfStack` | the op's **PlaceOnStock** attach shift | `wizards/ops/placement.js:133` / `blockEmitter.js:152` | the place fold (`blockEmitter.js:358`); baked into twin preview geometry as `_pShift` (`panelTypes.js:250-258`) |

**Consequence, stated plainly:** for the same op, the Layout pane anchors on `partZeroShift` while the 3D box's
own 2D canvas anchors on `stockPinOffset`. These are equal only when the stock is pinned *and* `workOrigin` is 0.
**Each pane is internally coherent; comparing pixel positions ACROSS the two boxes is not meaningful.**

### What the overlay is deliberately NOT told — and why it is load-bearing

`wireAnimOverlay` (`userOpView.js:99-105`) feeds exactly six things: `setAnchor`, `setStarts`, `setPassEnds`,
`setStartSources`, `setSegments`, `setViewTransform`. It never calls `setStock` / `setMachine` /
`setMachineFrame`. With no stock, `stockPin()` is `{0,0}` (`toolpath2d.js:91`) — **which is precisely what makes
the fold-in-the-view arithmetic above come out right.** If anyone ever calls `ov.tp.setStock(...)`, the overlay
double-shifts by the pin.

### `spec.placement` means FOUR different things to four callers

`FeatureCanvas` cannot tell them apart — it just adds `p` in `_disp`.

| caller | `placement` = |
|---|---|
| the 8 legacy per-wizard views | `placementShift(bbox, params)` — the **PlaceOnStock attach offset** (`wizards/ops/placement.js:34`) |
| edge / middle views | hardcoded `{x:0,y:0}` |
| **every mill twin** | `partZeroShift(...)` — the **WCS pin**, machine coords (`panelTypes.js:585,620,622`) |
| the 7 lathe twins | **absent** — a lathe spec carries no `placement` key at all (`viz/latheProfileCanvas.js`, early-returned at `panelTypes.js:173-174`) |

### Renderer inventory (four renderers, one composer, one spec compiler)

- `viz/featureCanvas.js` — the 2D Layout **SVG**. Knows nothing of ops or params; takes a plain spec. Fits itself;
  auto-fit stops once `_userAdjusted`. A `ResizeObserver` re-renders on container resize (`:110-116`).
- `viz/toolpath2d.js` — the toolpath **raster**, in two modes decided by `createToolpath2d(canvas, {overlay})`
  (`:62-63`). Full mode draws the whole scene and owns its own `fit()`; overlay mode draws path+head+pulses+chip
  and **never fits** (`:367`) — the view is pushed in via `setViewTransform` (`:365`).
- `viz/gcodeViz3d.js` — the **WebGL** scene. Machine-frame content on the scene; part-frame content in a
  `PartFrame` group shifted by `partZeroShift`. Machine-frame content explicitly cancels that shift.
- `viz/latheProfileCanvas.js` — **not a renderer**: a spec *builder* for FeatureCanvas (lathe Z→x, radius→y).
- `viz/createPreviewPanel.js` — the **composer**. Owns ONE trace (`traceToolpath`, `:896`) fed to both renderers,
  one execution engine, the play loop, the 2D/3D toggle, and the seams the Layout pane consumes
  (`getSegments` :1494, `onToolPos` :1508, …).
- `wizards/ops/panelTypes.js` — the twin's **spec compiler**. `layoutSpecFromOp` (`:168`) turns def + live params
  into a FeatureCanvas spec. Everything the Layout pane shows for a twin originates here.

### The one-sources every renderer already shares — do not re-derive these

`viz/sceneFrame.js` (frames) · `viz/markerWorld.js:12` `markerWorldOf` (marker world) · `viz/startGlyph.js`
`resolveStartGlyph` (glyph) · `viz/displayPrefs.js` `displayOf` (visibility) · `viz/pathStyle.js` (palette/dash) ·
`viz/canvasWidgets.js` `buildCanvasWidgets` (gesture math).

---

## THE REGISTRIES — name these, never copy them

| fact | the declaration of record | regenerate with |
|---|---|---|
| what the bar shows and what it opens | `BUILTINS` + `opensAs`, `blocks/wizardLibrary.js:42-81` (**25** entries, **25** with `opensAs`) | `rg -n "opensAs" DDCS-Studio/web/blocks/wizardLibrary.js` |
| the data twins | `SEED_BUILDERS`, `web/app.js:105-112` (**32**) — exported deliberately so tests sweep the registry, not a parallel hand list (`app.js:103-104`) | `rg -n "_OPTYPE = 'user_" DDCS-Studio/web/blocks/dataOps/*.js` |
| the surviving coded views | `WIZARD_VIEWS`, `wizards/views/index.js:36-57` (**20**) | `rg -o 'id="wiz_[a-z_0-9]*"' DDCS-Studio/web/index.html \| sort -u` |
| which block kinds hold children | **`def.mouth`** on each def; the reader is one line — `blocks/blockly/bridge.js:78` | `rg -n "mouth:" DDCS-Studio/web/wizards/ops/` |
| which record fields survive a Blockly round-trip | `DURABLE_DATA_FIELDS` (`stackBridge.js:23`) + `KNOWN_LEAF_RECORD_FIELDS` (`:35`) | — |
| what counts as a "hook" on a def | **derived**, not listed: `_BASE_DEF_SHAPE` from one real constructor call, `userOps.js:839-841`; exported as `hookKeysOf` `:846` | — |
| guard predicate shape | `GUARD_FIELDS`, `wizards/ops/guard.js:36` | — |
| per-atom scratch vars | `def.scratch` on each atom; aggregated by `data/universalScratch.js` | — |
| which widgets own several params | `MULTI_WIDGETS`, `ui/formWidgets.js` — read by BOTH `renderOpForm`'s `renderUnit` AND `panelTypes.js:234` | — |
| the posts | `wizards/dialects/index.js` registry (7 posts) + `DEFAULT_CAPS` | — |

**32 twins vs 25 `opensAs` targets.** The 7-op remainder is the lathe family
(`user_lathe_facing|odturn|parting|centerdrill|polygon|faceprobe|odprobe`), which surface as their **own**
`kind:'user'` bar entries in the `lathe` group; that group leads the bar on a lathe workspace
(`wizardLibrary.js:192-197`).

---

## INVARIANTS — the rule, its guard, and what breaking it looks like

**1 · A record that carries children declares a `mouth`.**
Guard: `blocks/blockly/stackBridge.js:318` throws by name. Reader: `blocks/blockly/bridge.js:78`.
Break it → the children are **silently discarded** on a Blockly round-trip. This replaced four hand-maintained
kind lists after the *fifth* silent loss (t1069/t1093/t1595/t1627/t1636). A **fifth, still-live** kind list at
`blocks/blockEmitter.js:40` was surveyed, measured non-lossy, and deliberately left — unifying it is re-litigating
a decided call.

**2 · A leaf record's top-level fields are declared or the write throws.**
Guard: `stackBridge.js:265`. Break it → `G1 G91 Z-5` comes back through the Blocks canvas having lost its G91: a
relative plunge silently becomes absolute. Note the resolution shape: `_group` is **tolerated, not persisted** —
in `KNOWN_LEAF_RECORD_FIELDS`, deliberately NOT in `DURABLE_DATA_FIELDS`, because a stashed copy goes stale.

**3 · A fail-loud guard is worthless if the path carrying its throw swallows it.**
Guard: `blocks/programModel.js:225` — subscriber isolation logs `console.error`, never a bare `catch {}`. Both of
the guards above fired into a silent catch for their entire early life, on the only path an operator's
paste-then-open-Blocks gesture takes.

**4 · A declared key must have a reader in its designated consumer.**
Guard: `tests/node/declared-key-coverage-1678.test.mjs`, `CLEAN_SHAPES` at `:43`. It states its own honesty
limits at `:17-23` — a heuristic, not a static analyzer; short/common keys are deliberately excluded. Break it →
`emits` / `noSnap` / `onEdit` / `manual`: declared upstream, dropped in a generic forward, **found four times by
accident**.

**5 · A KNOWN GAP test asserts the currently-broken state; closing the gap means deliberately updating its tripwire.**
`declared-key-coverage-1678.test.mjs:80-87` — PART 2 is empty **by design, not deleted**. Deleting a tripwire on
fixing its gap erases the record of what changed.

**6 · Derive membership from shape; never hand-maintain a name list that must track a growing set.**
Guard: `userOps.js:839-841`. Break it → `OP_CODE_HOOKS`, an 8-name hand list, had gone stale by **7 live hooks**;
forking any of 11+ ops silently dropped one — byte-correct emit, clean console, a piece of the UI just missing.
**The obvious replacement is also wrong:** "any function on `def`" misses 5 of the 7, because `zRuler` /
`entryPoint` / `simStartParams` / `latheTool` / `latheProbeAxis` are plain JSON-safe **data**, not functions.

**7 · One function, not two copies of a value that currently agree.**
Guard: `featureCanvas.js:83` folds placement into `getTransform()`; `:383` relays that same composed value.
Break it → the ~275 px overlay/SVG split (§ TRAPS).

**8 · BYTE-IDENTICAL EMIT is the proof obligation for any preview-only change.**
Guard: `tests/fork-parity-1593.spec.js` — FORM identity, EMIT byte-identity at N off-default values, hook carry.
Backed by `validateUserOp` (`userOps.js:746`), whose fork-arm check is asserted **silent** rather than deleted.
Every WORK-LOG entry this week carries an explicit `### Emit byte-identical` section.

**9 · A new test must be proven RED against the pre-change tree.**
Process, not code (`~/.claude/skills/worker/SKILL.md`). Standing trap: restore from your **own scratch copy**, not
`git checkout HEAD --` — HEAD does not contain uncommitted work either. Two tests this week passed against both
the fixed AND the broken code before this was applied.

**10 · Assert at OFF-DEFAULTS, against an INDEPENDENT truth.**
Guard: `tests/fork-parity-1593.spec.js` typed sweep — every value binding is moved off its default or explicitly
skipped for the ONE declared legitimate reason; anything else **throws**, naming param/twin/type. At defaults a
dropped value and a kept one look identical.

**11 · Regenerating a snapshot must FAIL the run.**
Guard: `tests/node/preview-spec-gate-1688.test.mjs:324` — `UPDATE_PREVIEW_SNAPSHOT=1` rewrites the fixture **and
throws**. The serializer's rules matter as much: `undefined` is serialized as `"<undefined>"` rather than dropped
(that is exactly how `emits` hid), and functions as `"<fn/arity>"` (without which `onEdit` is invisible).

**12 · TRI-STATE: `undefined` means "no opinion". Only an explicit `false` is false.**
Guard: `viz/startGlyph.js:20` — `fill: emits !== false`, with the tri-state stated in its own comment at `:17-18`.
Break it → `!!(hint && hint.emits)` would have hollowed out **every multi-pass reposition marker in the app**,
because `emits:` is declared nowhere in `blocks/dataOps/` except corner. Sibling rule at `startGlyph.js:13`:
pass 0 is manual **regardless** of source.

**13 · FAIL CLOSED when a derived mapping cannot be proven.**
Guard: `userOps.js:1091` (`return null; // FAIL CLOSED`), doctrine at `:1071-1073`: *an empty form is a visible
disappointment, a form silently wired to the wrong sockets is a wrong program.* The fork remap aligns two flattens
by **type sequence**, never a blanket `+1`.

**14 · `emit` is a FROZEN template; live values go through `postInstantiate`.**
Guard: `userOps.js:911`, with the ordering constraint at `:900-902`.

**15 · CORNER IS THE GATED PILOT — no wizard ports until corner is right.**
A standing ruling, not a test: `NEXT-SESSION.md`, under **STANDING RULINGS (do not re-litigate)** — cited by
content, not line, because that file is rewritten wholesale each cycle and a line number would drift on the next
rewrite. Every mechanism is proven once on corner; the other 31 twins inherit it. A corner defect outranks the queue.

**16 · A RETIRED wizard has no built-in to compare against.** See Q1 and § TRAPS #1.

**17 · Report the honest shape; a corrected dispatch is the deliverable.**
`AGENTS.md:41` (do not "clean up" code you have not traced — find its consumers first); `AGENTS.md:35` (one
commit, one concern); `NEXT-SESSION.md:187-189` (*a symptom is an observation, not a diagnosis; grep who declares
and who consumes before relaying*).

---

## TRAPS — the specific wrong assumptions that have actually cost hours

### 1 · "There is a built-in Corner wizard to diff the twin against." There is not.
An advisor asserted this and sent a worker hunting a comparison that cannot be made. Corner's view import is
deleted (`wizards/views/index.js:20`), its panel is deleted, its opener is deleted. There is exactly ONE corner op.
```bash
grep -c 'id="wiz_corner"' DDCS-Studio/web/index.html      # → 0
```
The `BUILTINS` slot survives and `opensAs` the twin — that is what makes the bar look unchanged.
The same shape applies to CIRCULAR (retired further: no `BUILTINS` entry at all).

### 2 · "The Layout pane is one renderer." It is TWO STACKED RENDERERS.
A user-reported bug — the toolpath drawing far from the stock — went unexplained for hours because of this.
Root cause: the overlay was positioned by `getTransform()`, which did not fold the placement shift, so the raster
and the vector drew ~275 px apart whenever a stock was pinned to a non-G54 WCS. Invisible until t1672, because the
term was always 0 — `spec.placement` did not exist on the spec before then. **`userOpView.js`, the file with the
visible symptom, needed zero changes.** A crosshair bug (`spec.origin` read through `_S` instead of `_disp`) fell
out of the same commit.
```bash
grep -n "fc-anim-overlay" DDCS-Studio/web/styles.css DDCS-Studio/web/wizards/views/userOpView.js
```
Two elements in `#userVizContainer`: a `z-index:-1` canvas and a transparent SVG. If a coordinate looks wrong in
the Layout pane, **ask which of the two layers is wrong first.**

### 3 · A DOM query standing in for a declaration → "17 twins will gain handles". The real answer was 2 — and
dropping the DOM query ENTIRELY (t1690) was itself a regression, caught by the release gate (t1700).
A dispatch relayed 17. Reading the whole regenerated snapshot diff — 10 lines, 7 insertions, 3 deletions, not the
~50 a 17-twin gain implies — showed only `user_corner_data` and `user_middle_data` moved. Of the other 15,
**13 declare zero role/group-tagged bindings anywhere** and have no spatial X/Y to drag at all; **2** were a
gate-harness gap, not a product gap. t1690 replaced the DOM query wholesale with a pure declaration — which then
put a handle over a param with NO rendered field yet (declared ≠ rendered; `tests/custom-op-canvas-handles.spec.js`
caught it). t1700 restored the DOM check as a SECOND, conditional half:
```js
// wizards/ops/panelTypes.js:250
const _writable = (name) => _declaredParams.has(name) && !_unwritable.has(name) && (!_formHostExists || !!_field(name));
```
The declared half (`_declaredParams`/`_unwritable`) is still built from `MULTI_WIDGETS` (`panelTypes.js:25,232`) —
the **same registry** `renderOpForm`'s `renderUnit` reads. The DOM half (`_field`, `panelTypes.js:75`) is skipped
when no real form host exists at all (`_formHostExists`, `panelTypes.js:249`) — the node-tier gate's `document` is
an inert stub whose `querySelector` always returns null, so AND-ing `_field` in unconditionally would zero out
every twin's handles there again. A real page's `#wiz_user_form` (`index.html:849`) exists from load, so there the
DOM half is live and a handle only appears once its own field has actually rendered.
```bash
rg -n "_writable|_formHostExists" DDCS-Studio/web/wizards/ops/panelTypes.js
```

### 4 · A fact declared and read by nobody — the `indentStyle` split. **UNVERIFIED at runtime; strong static read.**
`activeDialectOpts()` (`wizards/previewEmit.js:21`) returns `{ dialect, indentStyle }` and is imported by **29
modules**. Three modules keep their own byte-identical `dialectOpts()` copy that returns `{ dialect }` only:
```
blocks/programModel.js:26   () => ({ dialect })
blocks/opGlow.js:18         () => ({ dialect })
blocks/opSession.js:18      () => ({ dialect })
```
`applyIndentStyle` no-ops unless `settings.indentStyle === 'flush'` (`data/indentStyle.js:51`). So setting indent
style to `flush` appears to change the **wizard preview panel** but not the committed program projection
(`programModel.js:215`), the glow diff, or the exported `.nc`.
```bash
rg -n "indentStyle" DDCS-Studio/web --glob '!data/indentStyle.js'
```
Only `ui/settingsPanel.js` (writes) and `wizards/previewEmit.js` (reads) appear. **I did not run this.**

### 5 · A legacy `corner` (or `circular`) op has a live ✎ Edit that opens an EMPTY modal. **UNVERIFIED at runtime.**
`canEdit('corner')` (`wizardManager.js:318`) returns true because `paramFields('corner')` is non-empty —
`FIELD_BIND.corner` (`blocks/opSchema.js:158`) is folded onto `SCHEMA.corner` at `:177-180`. But those 15 field
ids point at DOM deleted with the panel:
```bash
grep -c 'id="c_corner"' DDCS-Studio/web/index.html        # → 0
```
`open('corner')` then shows the overlay, hides every panel, and finds no `#wiz_corner` to fill. Same shape for
`circular` (`opSchema.js` ids `circ_*`).

### 6 · `setup_datawiz` is an undeclared group. **Read from source.**
`blocks/dataOps/commData.js:154` and `blocks/dataOps/homingData.js:161` pass `'setup_datawiz'`, but `GROUPS`
(`wizardLibrary.js:28-41`) declares only `probe_datawiz` / `atc_datawiz` / `mill_datawiz`. Harmless today because
both are `opensAs` targets that `userEntries()` drops — but a **fork** copies `def.group` verbatim, so forking
Comm or Homing puts a bar dropdown on screen whose label falls through to the raw id (`wizardLibrary.js:206`).
```bash
rg -n "setup_datawiz" DDCS-Studio/web
```

### 7 · The bar's `data-optype` stamp is the BUILT-IN type, not the twin.
`commandDeck.js:103` — `e.type || e.opensAs || e.id`. So `ui/axisGating.js` gates the Pocket button on `'pocket'`
while the click opens `'user_pocket_data'`. For `io_step` / `pause_confirm` / `tap` the stamped value is a type no
builder registry knows.

### 8 · The z-index comment in `createPreviewPanel.js:1103-1104` describes code that no longer runs.
It says the 3D canvas is z-index 2 above the 2D canvas. The only code that sets that is `gcodeViz3d.js:2779`
`attach()`, whose sole caller is the retired `wizards/_svgPreview.bak.js:94`. In the live path the WebGL canvas is
appended **in flow** (`gcodeViz3d.js:68`) and the toggle works because `setMode` sets `display:'none'`.
```bash
rg -n "\.attach\(" DDCS-Studio/web --glob '*.js'
```

### 9 · `renderDeclaredLayout` is an exported function with ZERO callers — and it is the shape that would break the overlay.
`_layout` is a module-level singleton (`panelTypes.js:639`) and `FeatureCanvas._mount` wipes `container.innerHTML`
when the container changes (`featureCanvas.js:92-95`). Both live call sites pass `el('userVizContainer')`
(`userOpView.js:587,602`), so it never fires. If a second container is ever rendered, the wipe destroys
`.fc-anim-overlay` while `container.__animOverlay` still holds the detached canvas (`userOpView.js:86`) — the
overlay would silently never come back.
```bash
rg -n "renderDeclaredLayout" DDCS-Studio/web        # → one hit: the definition
```

---

## KNOWN DIVERGENCE, deliberately left (do not "fix" without reading the history)

- **Three hand-maintained "which kinds fold" lists**, answering three different questions, with no shared
  declaration of the underlying fact: `blockEmitter.js:40` (gets a `children[]`), `gcodeToStack.js:231` (blocks
  text reconcile), `data/exposeClassifier.js:25` (blocks expose). A new folding kind must be added by hand in
  three files. In practice masked, because `isLeafRecord` also tests `children.length` — only a **childless**
  fold block slips through. **UNVERIFIED whether that state is reachable.**
- **The transparent-container list is a `block.type` string literal** (`blockEmitter.js:237`), while every other
  branch in the same function dispatches on `def.kind`. A new transparent container is invisible to emit until
  someone edits that string.
- **`deriveBindings`' property carry-list** (`blocks/dataOps/deriveBindings.js:73-102`) is an allow-list of ~19
  hand-listed properties; an un-listed property is silently dropped, and two shipped bugs of exactly that shape
  are recorded in its own comments. **The single highest-rot-risk list in the emit spine.**
- **A stale in-code pointer:** `blockEmitter.js:146` says the place fold is at "line ~188"; it is at `:358`. (An
  earlier survey put `placeShiftOfStack` at `:167`; it is at `:152`.) Harmless, and the same class of
  hand-maintained pointer this codebase has spent a week killing.

---

## WHERE THE GATES ARE, AND WHERE THEY ARE NOT

| layer | gated? | by |
|---|---|---|
| EMIT | **yes, 32/32** | `tests/fork-parity-1593.spec.js` byte-identity; `blocks/dataOps/equivalence.js:30` twin-vs-builtin sweep with a pinned dialect |
| FORM | **yes, 32/32** | registry sweep over `SEED_BUILDERS` (`web/app.js:103-104` states why it is exported) |
| PREVIEW | **since 2026-08-10 only** | `tests/node/preview-spec-gate-1688.test.mjs` — spec snapshot per twin × 2 param sets; `spec.placement === partZeroShift`; the `_disp` / `getTransform` / `_pinFromTf` pixel identity at 1e-6 px with a non-vacuity guard; gesture forwarding; the glyph truth table |
| `opensAs` resolvability | **NO** | 17 per-wizard in-place specs exist, but **no sweep asserts every `opensAs` target is a registered def**. A typo'd target opens an empty `#wiz_user`. The registry-parity pattern already exists next door (the preview gate's Part 0 discovers twins from `blocks/dataOps/*Data.js` and cross-checks `SEED_BUILDERS` — `preview-spec-gate-1688.test.mjs:273-277`); it just does not cover `opensAs`. |
| the Q3 §"four semantics of `spec.placement`" and the overlay's not-told set | **NO** | nothing gates these |

Before the preview gate existed, PREVIEW was **0/32**: ~2450 e2e tests assert emitted text and data structures and
essentially none render anything, so a preview defect could not turn a test red. One day cost four production
defects, one of them shipped by an approved fix (`preview-spec-gate-1688.test.mjs:8-14`). *(Counts here are
WORK-LOG- and test-header-reported; not re-measured.)*

---

## UNVERIFIED — the honest gaps

- **Nothing was executed.** No test, no browser, no dev server. Every claim above is static reading with a
  `file:line` you can check in one jump. All pass/fail counts, the "549 declared bindings", the "275 px" and
  "229 px" figures, and the "~2450 e2e tests" are WORK-LOG- or test-header-reported and were **not** re-measured.
- **Trap #4 (`indentStyle`)** is the one finding worth measuring before acting on. The grep across `web/` returned
  only `settingsPanel.js` (writes) and `previewEmit.js` (reads), but I did not run the app.
- **Traps #5 and #6** are read from source; neither was reproduced in a browser.
- **Q3 §5 (the machine-frame twin's overlay path)** — for a homing/machine-frame twin, the overlay's `startPin()`
  and `envelopeRect()` branch the "wrong" way. Harmless today *only* because overlay mode never draws the envelope
  or start handles and `anchorToStart` dominates `passOff`. I did not verify a machine-frame twin's overlay
  position against its SVG on screen.
- **`middleVizManager.js` / `middleVizAnimator.js` / `edgeVizAnimator.js` / `alignVizAnimator.js`** are imported at
  `web/app.js` and animate the legacy inline SVGs in containers `preview3D` sets to `display:none` on first use
  (`wizardManager.js:564`). **UNSURE whether any of these still animate anything visible.**
- **Rule 13's partition claim** (three fork-inheritance cases cover the registry with no overlap, `userOps.js:1055-1058`)
  was read, not re-derived.
- **Rule 14 (`postInstantiate`)** is verified as a *mechanism* at `userOps.js:911`; no violation of it was found in
  this week's work-log. It is listed because the project memory names it, not because this week caught it.
- The **lathe family's** divergences from the mill spine were not traced beyond `panelTypes.js:173-174` and the
  missing `placement` key. Two of the three files dirty at verification time are lathe viz files.
