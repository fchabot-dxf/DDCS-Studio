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
                     │  — see § THE REGISTRIES, "what the bar shows and what     │
                     │    it opens" (file:line lives there, machine-checked)     │
                     └───────────────┬───────────────────────────────────────────┘
                                     │ drives THREE consequences, so they cannot drift
          ┌──────────────────────────┼──────────────────────────┐
          ▼                          ▼                          ▼
   bar click re-points        twin's OWN entry hidden      opened title = built-in's
   commandDeck.js:90          wizardLibrary.js:139         PLAIN label
                              → :156 userEntries()         wizardLibrary.js:144
                                                           → userOpView.js:36
   + inverse bridge for CAM: builtinTypeForTwin  wizardLibrary.js:151 → data/opCamMap.js


 THE WIZARD BAR IS 100% DATA-TWIN — BUILTINS' opensAs coverage is machine-checked (§ THE REGISTRIES, GENERATED
 count test); not restated here so there is exactly ONE prose copy of the count to keep in sync (t2006 — this line
 used to also say "25 entries; ALL 25 declare opensAs", the SAME fact the REGISTRIES row and the GENERATED test
 both already state; three copies of one fact is the exact "second source" shape this session keeps finding and
 deleting — see architecture-map-1698.test.mjs's own t2006 comment for the fuller account).
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
                                openForEdit → :406 this.open()   opensAs. This is the ONLY
                                                                door left to the 14 coded
                                                                built-in views — and, if the
                                                                type has NO view/twin at all,
                                                                a silent blank modal (known,
                                                                unfixed — see TRAPS #5).
 Blocks tab palette           blocks/opToolbox.js               a BLOCK STACK, not a wizard
 prereq "Open anyway"         ui/wizardPrereq.js:107            re-enters openWiz(type,…)
```

**`openWiz` has exactly five call sites in app code** — `commandDeck.js:85,90,93,94` and `wizardPrereq.js:107`.
`index.html` contains **zero** `openWiz(` onclicks (`grep -c "openWiz(" DDCS-Studio/web/index.html` → 0).

**All legacy back-compat wizard-opener globals are now GONE — deleted, not merely dead.** `window.openCornerWiz`
retired 2026-07-02 (tombstone comment only, `ui/globalFunctions.js:29`). `window.openMiddleWiz / openEdgeWiz /
openAlignmentWiz` retired t1730 alongside their coded views — the globals themselves are deleted (tombstone
comment `ui/globalFunctions.js:30-33`), and so are their wizardManager.js targets (`openMiddle`/`openEdge`/
`openAlignment`, tombstone comment `wizardManager.js:421-423`); `updateMiddleWizard`/`updateEdgeWizard`/
`updateAlignmentWizard`/`_startEdgeAnim`/`_startAlignmentAnim` (the `update()` back-compat entries app.js's now-
also-deleted `setupVisualizationListeners` used to call) are gone too.

**EIGHT wizards are fully RETIRED — their entry points are deleted, not hidden.** Two before this turn, six more
at t1730 (same shape each time: no view import, no `#wiz_<type>` panel, `BUILTINS` slot survives with
`opensAs:'user_<type>_data'`, the legacy stack builder survives as the twin's own template source):
- **CORNER** (retired 2026-07-02, `wizards/views/index.js` retirement comment). No `#wiz_corner` panel
  (`grep -c 'id="wiz_corner"' DDCS-Studio/web/index.html` → **0**). `wizards/cornerWizard.js` still exists as the
  legacy **stack builder** the twin's own template is built from (`blocks/dataOps/cornerData.js:44,244`).
- **CIRCULAR** (retired 2026-06-23, superseded by Middle). Gone further: it has **no `BUILTINS` entry at all**
  (deleted t1730 alongside its whole file, `wizards/circularWizard.js` — it had zero reachable UI path, twin or
  otherwise), so it was never even a bar slot.
- **MIDDLE / EDGE / ALIGNMENT / ROTARY_CENTER / ROTARY_CLOCK / HOMING** (all retired t1730, gameplan step 2 Tier
  B — see WORK-LOG t1730). Each `opensAs` its twin and had for a while already (the wizard bar has routed every
  one of these through `opensAs` since their own earlier in-place ports — `wizard-bar.spec.js` names the t-marks);
  the coded view was already UNREACHABLE from any live menu/button, reached only by an old saved op / Blocks-
  authored raw block carrying the RAW built-in type through `openForEdit`. Deleted together (not incrementally)
  because `rotaryCenterView.js`'s `restoreBoxStock()` is consumed by `middleView.js`/`edgeView.js`/
  `rotaryClockView.js` — a dangling-import intermediate state was avoided by removing all 6 in one act. `homing`
  kept one live export, `homingRunParams` (`wizards/homingWizard.js`) — unrelated to the deleted view, still used
  directly by `ui/macrosApp.js` for "Regenerate from homing profile".

**14 coded built-in views still exist and still render real two-pane forms** — `WIZARD_VIEWS`
(`wizards/views/index.js:35-48`, 14 entries), each with a live `#wiz_<type>` panel (15 unique `#wiz_*` panel ids
in `index.html`, the 15th being `#wiz_user`). **No bar entry reaches any of them.** The only live door is
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
                  └─ def.postInstantiate(stack, p)  userOps.js:965            │
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

### Post-passes, in declared order (`blockEmitter.js:516-533`)

`applySetupFlips` :516 → `applyToolChanges` :517 → `applyEntryWaypoint` :518 → `applyProgramTransform` :519 →
`applySerialLibrary` :520 → `applyModalFeed` :521 → `applyLineSuppression` :522 (t2277 — renamed from
`applyCapGating`: it now does capability gating AND human-disable suppression, distinguishable in the output
as `( gated: … )` vs `( disabled: … )`; the call site's own line number is unchanged) → `balanceOwords` :523 →
`applyDdcsSyntaxGuards` :530 (t2070/t2139, inline-IF..THEN skip then the unconditional flush-left strip — every
line loses its leading whitespace, always, no settings check). Runs **last** because every pass above it matches
line *text* — the reasoning is written at `blockEmitter.js:524-529`.

⭐ **t2141 — extracted to a dependency-free leaf, one export, order baked in.** `data/gcodeSyntaxGuards.js`
exports ONE function, `applyDdcsSyntaxGuards(T, dialect)` — internally the same two passes, in the same fixed
order, but not separately exported, so no caller can apply them out of order (the clamp rewrite inserts new
lines that also need flushing). `blockEmitter.js:32` imports it. The CAM slot-macro path (`data/slotPack.js`'s
`slotMacro`) needed the SAME guard (its generator arms build G-code TEXT directly, bypassing `emitMapped`
entirely, so it never ran on a CAM macro before this) — it applies the guard to the FINAL joined macro text via
a small text↔token adapter (`applyMachineSyntaxGuards`), defaulting `dialect` to a literal DDCS gate
(`{ flushIndent: true }`) so `slotPack.js` stays free of any dialect-resolution import, per its own "stays
LIGHT" design (`slotPack.js:194-196`). The first cut imported the two passes straight from `blockEmitter.js`
(safe by the existing `data/exposeClassifier.js`/`data/stackToSlot.js` precedent — no cycle) but that pulls in
`blockEmitter.js`'s own `wizards/ops/index.js` dependency (the full 50+-file BLOCKS registry) — MEASURED, not
assumed, to corrupt an unrelated `GcodeExecutionEngine` trace of a hand-written CAM macro. Neither pass has any
real reason to depend on the op registry, so the fix was to stop routing through a file that does (following
`data/rotateProgram.js`'s own precedent as a zero-import leaf), not to chase the exact registry file at fault.
Also found while widening this to real CAM-generator text for the first time: the inline-THEN regex only ever
matched SYMBOLIC comparison operators (`>`, `==`, …); DDCS accepts word forms too (`GT`, `EQ`, …) and the
hand-written CAM generator source uses them extensively — `CLAMP_RE`/`CLAMP_INV` now cover both forms.

`emitMapped` returns `{ text, lines, map, absorbed, feedFolds }` (`blockEmitter.js:539`, t2277 shifted from 536
by +3 — `applyLineSuppression`'s expanded doc comment above it). `absorbed` (:534) and `feedFolds` (:538) are
**passes declaring what they did**, so their invariants can be measured rather than trusted.

### The three facts a newcomer gets wrong here

1. **The template is FROZEN DATA.** `userOpFromStack` (`userOps.js:1172`) runs the legacy JS builder ONCE at
   module load and `stripIds`es the result into `def.template`. Anything needing live state at build time is a
   declared `postInstantiate` hook (`userOps.js:965`), never an interpolation in the template.
2. **Ordering inside `registerUserOp` is load-bearing:** `materializeParamGroup(def)` (`userOps.js:954`) MUST run
   before `validateUserOp(def)` (`:956`) — materialization adds the `param_field` blocks and re-derives each
   `blockIndex`; validating first fails every materialized def.
3. **A failed expression keeps the author's text, it does not become 0.** `resolveValue` (`blockEmitter.js:88`)
   returns the raw string on failure. Four sibling failure shapes, each deliberate: a **coordinate** rides out
   verbatim (`wizards/ops/util.js`); a **Set** binds `UNRESOLVED` (`blockEmitter.js:246-254`); a **bound**
   (loop `to`, stepdown `to`) emits the author's text in place of the body; a **condition** emits neither branch.

### Dialect

`getDialect(profileId)` — `wizards/dialects/index.js`. Two consumption modes: **per-line**, threaded as the 4th
argument to every leaf kernel (`blockEmitter.js:456`); and **capabilities**, `getCaps(id)` read at
`applyLineSuppression` (`:522`, t2277 renamed from `applyCapGating`) and `balanceOwords` (`:523`). Suppression
is **per line, never per op** — the op stays in the stack and unrunnable lines become `( gated: … )` comments;
a line the human disabled becomes `( disabled: … )` instead — same mechanism, distinguishable reason, and only
`disabled` persists across a save/reload (it rides the op's own marker; `gated` is recomputed fresh from the
active post on every emit, so it is never stale and never needs to be).

### Where the emit is actually invoked

```bash
rg -n "emitMapped\(" DDCS-Studio/web --glob '!blocks/blockEmitter.js'
```
The four **program-shaped** call sites: `wizards/views/userOpView.js:428` (the wizard's live code panel + the sim
source; `:424` for the group path), `blocks/programModel.js:245` (t1928 — shifted from 226 by +19; committed program → editor text),
`blocks/opGlow.js:81,110,145,168,203` (emit twice, diff for per-word glow), `data/stackToSlot.js:164,166` (CAM
slot body). **Correction to an earlier survey:** that is not the complete set — the legacy `wizards/*Wizard.js`
`generate()` methods call it too (e.g. `wizards/atcChangeWizard.js:226`), and they are still reachable through the
`openForEdit` door (Q1). Also `blocks/dataOps/equivalence.js:34-35`, the twin-vs-builtin byte-identity gate.

---

## Q3 — WHO DRAWS WHAT, AND IN WHICH FRAME

### There are TWO preview boxes in a twin's wizard, and the Layout box holds TWO STACKED RENDERERS

```
WIZARD BODY (twin, panel = form3d+2d)      index.html:353-355
│
├─ #userViz3dBox / #userViz3dContainer ── the 3D box ─────────────────────────
│   └─ .wiz-viz3d           wizardManager.js:569-573  (position:relative; t1942 — shifted from 540-544 by +29)
│        └─ createPreviewPanel        ONE trace, ONE engine, TWO renderers
│             ├─ WebGL canvas   appended IN FLOW — see § TRAPS #8 (file:line + the z-index history, machine-checked)
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
shift is baked into `spec.stock.ox/oy` at `panelTypes.js:211` instead), the snap ring (:559), the machine frame
(:574,578,588), the stock-attach markers (:610), the corner-pick rings (:642) and the edge-pick strips (:677).
Drag input runs the exact inverse: `_hit` subtracts placement (:356), `onDrag` subtracts it (:157),
`_followHandle`/`_handleInGutter` add it (:307,:323).

### Three different shifts, all called something like "the offset"

| name | what it is | declared at | read by |
|---|---|---|---|
| `partZeroShift(machine, stock, floorZ)` | machine coords of part-zero (the WCS pin) | `viz/sceneFrame.js:43` | 3D `PartFrame`; twin Layout `spec.placement` (`panelTypes.js:230, 634, 669, 671`) |
| `stockPinOffset(machine, stock)` | `pinRow − workOrigin`; `{0,0}` unless explicitly pinned — **a different number** | `viz/sceneFrame.js:88` | `toolpath2d.js:91` (both modes) |
| `placeShiftFromParams` / `placeShiftOfStack` | the op's **PlaceOnStock** attach shift | `wizards/ops/placement.js:133` / `blockEmitter.js:152` | the place fold (`blockEmitter.js:358`); baked into twin preview geometry as `_pShift` (`panelTypes.js:299-305`) |

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
| **every mill twin** | `partZeroShift(...)` — the **WCS pin**, machine coords (`panelTypes.js:634,669,671`) |
| the 7 lathe twins | **absent** — a lathe spec carries no `placement` key at all (`viz/latheProfileCanvas.js`, early-returned at `panelTypes.js:208-209`) |

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

### Six legacy renderers were live, not five renderers and a composer — DELETED at t1730

Until t1730 this section named a real divergence risk: `wizards/views/index.js`'s `WIZARD_VIEWS` registered a
SEVENTH, older renderer per op for 6 of the 8 probe/utility twins — `middleView.js` / `edgeView.js` /
`alignmentView.js` / `rotaryCenterView.js` / `rotaryClockView.js` / `homingView.js` — the pre-port built-in
wizard views, unreachable from any live menu/button but reachable the instant an op carried its RAW built-in type
(an old save file, a Blocks-authored raw block) instead of its twin's `user_*_data` type. Two of the six **were**
confirmed behaviorally different from their twin (this map caught it, cycle 857 ACT 1) and were fixed as of cycle
857 ACT 2 (t1722): `middle_data` declared `def.simStock`; `rotaryCenterView.js`'s `activateCylinderStock()` no
longer touched global `settings.stock`. Full per-op detail, citations, and the complete duplicate-intent list:
`PREVIEW-AS-DATA.md` (cycle 857 ACT 1 survey, historical — the code it describes is gone).

**All 6 are now DELETED (gameplan step 2 Tier B, t1730, WORK-LOG t1730)** — the divergence risk is fully closed,
not just fixed-while-present: there is no second renderer left to diverge from. The RAW-built-in-type path (an
old save / a Blocks-authored raw block) now finds no panel and silently no-ops instead of opening the deleted
view — the SAME known, unfixed blank-modal shape `corner` already had — see TRAPS #5 (a graceful version was
built and then explicitly ruled out the same turn: no old-save audience exists for this app). `wcs`'s legacy view
(`wcsView.js`) is unrelated and still survives (one of the 14 that remain) — it draws nothing on either path, so
it never carried divergence risk and was out of scope for this deletion.

### The wizard-shape-block vocabulary: one working consumer, three container blocks, ALL THREE now deleted (t1734/t2507)

`wizards/ops/vizBlocks.js` (t1627) declares the four SHAPE primitives — `shape_rect`/`shape_circle`/`shape_line`/
`shape_marker` (`SHAPE_2D_TYPES`) — which have a real, working consumer: `panelTypes.js`'s own `layoutSpecFromOp`
flattens `def.template` (walking BOTH `uiChildren` and `children` — mouth-agnostic) and draws every `shape_*`
block it finds as a Layout-pane item, already wired, zero extra code needed by a twin that has content to
declare. This is UNCHANGED and remains fully live.

Three CONTAINER blocks were declared alongside them at various points — `layout_2d_canvas` (`kind:'uibox'`,
`mouth:'DO'`), `sim_3d_box`, `code_preview_panel` — and **all three are now deleted**. `sim_3d_box`/
`code_preview_panel` never carried a `.mouth` (so bridge.js's generic mouth mechanism, below, never applied to
them) and had no other consumer either; traced live (cycle 856 ACT 3, t1724) and **deleted at t1734** (GAMEPLAN
STEP 3, alongside the Blocks-tab right column's face-switch predicate and the Projected G-code pane they would
have backed) — see WORK-LOG t1734.

`layout_2d_canvas` was different, and worth recording precisely because two READINGS of "is it dead" were both
correct at once, about two different questions. Its Blockly ROUND-TRIP genuinely WAS wired — GENERICALLY, via
bridge.js's own `else for (const m of mouthsOf(def)) addMouth(m.name, m.label)` (gives any def carrying a
`.mouth`, or the plural `.mouths` t2333, a Blockly mouth regardless of type) — so grepping the literal string
`layout_2d_canvas` outside its own declaration found nothing even though a user really could drag one into a
workspace and its shape-primitive children really would round-trip correctly. The advisor twice reported all
three ORIGINAL container blocks dead by that grep; the worker corrected it at t1726 for this one, on exactly
that mechanical basis — and that correction was RIGHT, not superseded.

What t1726 did NOT establish, and what BACKLOG #61's own finding (2026-09-01) traced further and found FALSE:
that being mechanically wired made the block USEFUL. Nothing ever read `layout_2d_canvas`'s own existence or
its `minHeight`/`showRuler` fields — the actual 2D feature canvas was, and is, rendered entirely by the
SEPARATE `feature_canvas` node (`formWidgets.js:1540` — t2515: renamed from `panel`, BACKLOG #72's own rename
ruling), completely independent of whether a `layout_2d_canvas` sat anywhere in the tree; `layout_2d_canvas`'s
own `emit: () => []` confirms it contributed nothing to it either.
It was a THIRD way to say something `feature_canvas`/`sim`/`code_preview`/the split/section/tab containers already say —
wired, but never useful. **Owner ruling 2026-09-01, deleted at t2507** (BACKLOG #61 L7) — see WORK-LOG t2507.
Both findings stand: t1726's "the round-trip is live" and t2507's "and it was never worth using" are the same
block seen from two different, non-contradicting questions.

### The one-sources every renderer already shares — do not re-derive these

`viz/sceneFrame.js` (frames) · `viz/markerWorld.js:12` `markerWorldOf` (marker world) · `viz/startGlyph.js`
`resolveStartGlyph` (glyph) · `viz/displayPrefs.js` `displayOf` (visibility) · `viz/pathStyle.js` (palette/dash) ·
`viz/canvasWidgets.js` `buildCanvasWidgets` (gesture math).

---

## THE REGISTRIES — name these, never copy them

| fact | the declaration of record | regenerate with |
|---|---|---|
| what the bar shows and what it opens | `BUILTINS` + `opensAs`, `blocks/wizardLibrary.js:42-81` (**25** entries, **25** with `opensAs`) | `rg -n "opensAs" DDCS-Studio/web/blocks/wizardLibrary.js` |
| the data twins | `SEED_BUILDERS`, `web/app.js:100-107` (**32**) — exported deliberately so tests sweep the registry, not a parallel hand list (`app.js:98-99`) | `rg -n "_OPTYPE = 'user_" DDCS-Studio/web/blocks/dataOps/*.js` |
| the surviving coded views | `WIZARD_VIEWS`, `wizards/views/index.js:34-48` (**14**) | `rg -o 'id="wiz_[a-z_0-9]*"' DDCS-Studio/web/index.html \| sort -u` |
| which block kinds hold children | **`def.mouth`** (one) or **`def.mouths`** (2+, t2333 — `split_horizontal`/`split_vertical`'s LEFT/RIGHT, TOP/BOTTOM) on each def, normalized by `mouthsOf` — see INVARIANT #1 (the one-line reader's file:line lives there, machine-checked) | `rg -n "mouth:|mouths:" DDCS-Studio/web/wizards/ops/` |
| which record fields survive a Blockly round-trip | `DURABLE_DATA_FIELDS` (`stackBridge.js:24`) + `KNOWN_LEAF_RECORD_FIELDS` (`:46`, t2289 shifted from 39 by +7 — `comment` joined the set) | — |
| what counts as a "hook" on a def | **derived**, not listed: `_BASE_DEF_SHAPE` from one real constructor call, `userOps.js:917` (t1996 shifted this from 893 — see INV6); exported as `hookKeysOf` `:924` | — |
| guard predicate shape | `GUARD_FIELDS`, `wizards/ops/guard.js:36` | — |
| per-atom scratch vars | `def.scratch` on each atom; aggregated by `data/universalScratch.js` | — |
| which widgets own several params | `MULTI_WIDGETS`, `ui/formWidgets.js` — read by BOTH `renderOpForm`'s `renderUnit` AND `panelTypes.js:292` (t2004 — this cited `:267` for who knows how long; that line is unrelated CORNER-MARKER-INDEPENDENCE code, not a `MULTI_WIDGETS` reader at all — see architecture-map-1698.test.mjs's own `REGISTRY_CLAIMS` comment for the full account) | — |
| the posts | `wizards/dialects/index.js` registry (7 posts) + `DEFAULT_CAPS` | — |

**32 twins vs 25 `opensAs` targets.** The 7-op remainder is the lathe family
(`user_lathe_facing|odturn|parting|centerdrill|polygon|faceprobe|odprobe`), which surface as their **own**
`kind:'user'` bar entries in the `lathe` group; that group leads the bar on a lathe workspace
(`wizardLibrary.js:192-197`).

---

## INVARIANTS — the rule, its guard, and what breaking it looks like

**1 · A record that carries children declares a `mouth`.**
Guard: `blocks/blockly/stackBridge.js:393` (t2289 — shifted from 373 by +20, the `comment` doc block + capture/write-back lines added above it; t2277 before that — shifted from 350 by +23, the `isManuallyDisabled` helper added above it; t1950 before that — shifted from 326 by +24, the workspaceToStack terminator/wrapper-gate correction's own doc comment) throws by name. Reader: `blocks/blockly/bridge.js:78`.
Break it → the children are **silently discarded** on a Blockly round-trip. This replaced four hand-maintained
kind lists after the *fifth* silent loss (t1069/t1093/t1595/t1627/t1636). A **fifth, still-live** kind list at
`blocks/blockEmitter.js:40` was surveyed, measured non-lossy, and deliberately left — unifying it is re-litigating
a decided call.

**2 · A leaf record's top-level fields are declared or the write throws.**
Guard: `stackBridge.js:340` (t2289 — shifted from 320 by +20, same cause as INV1 above; t2277 before that — shifted from 297 by +23, same cause; t1950 before that — shifted from 273 by +24, same cause). Break it → `G1 G91 Z-5` comes back through the Blocks canvas having lost its G91: a
relative plunge silently becomes absolute. Note the resolution shape: `_group` is **tolerated, not persisted** —
in `KNOWN_LEAF_RECORD_FIELDS`, deliberately NOT in `DURABLE_DATA_FIELDS`, because a stashed copy goes stale.

**3 · A fail-loud guard is worthless if the path carrying its throw swallows it.**
Guard: `blocks/programModel.js:586` (t1992 — shifted from 538 by +48, the removeOpById + insertOpAfterId declarations added beside findOpById/replaceOpById; previously stale at 236, then 269, then 347, then 357, then 364, then 388, then 407, then 438, then 456, then 508, then 526, then 538) — subscriber isolation logs `console.error`, never a bare `catch {}`. Both of
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
Guard: **derived, not listed** — see § THE REGISTRIES, "what counts as a hook on a def" (`_BASE_DEF_SHAPE` +
`hookKeysOf`, both machine-checked there). (t2004 found THIS line's own copy of the fact stale at `893-900` a full
turn after the REGISTRIES copy was fixed to `917`/`924` — t2008 removed the second copy instead of keeping both in
sync by hand, since two synced copies is still two copies that CAN diverge again.) Break it → `OP_CODE_HOOKS`, an
8-name hand list, had gone stale by **7 live hooks**;
forking any of 11+ ops silently dropped one — byte-correct emit, clean console, a piece of the UI just missing.
**The obvious replacement is also wrong:** "any function on `def`" misses 5 of the 7, because `zRuler` /
`entryPoint` / `simStartParams` / `latheTool` / `latheProbeAxis` are plain JSON-safe **data**, not functions.

**7 · One function, not two copies of a value that currently agree.**
Guard: `featureCanvas.js:83` folds placement into `getTransform()`; `:383` relays that same composed value.
Break it → the ~275 px overlay/SVG split (§ TRAPS).

**8 · BYTE-IDENTICAL EMIT is the proof obligation for any preview-only change.**
Guard: `tests/fork-parity-1593.spec.js` — FORM identity, EMIT byte-identity at N off-default values, hook carry.
Backed by `validateUserOp` (`userOps.js:861`), whose fork-arm check is asserted **silent** rather than deleted.
(t1996 — this cited `:746` for who knows how long; that line sits inside a DIFFERENT function, `instantiate`'s own
binding loop, not `validateUserOp` at all. The checker's own citation for this claim never caught it either, since
it carried a trivial always-true placeholder pattern instead of checking real content — see architecture-map-
1698.test.mjs's own header comment for the full account. Both are fixed now.)
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
Guard: `userOps.js:1145` (`return null; // FAIL CLOSED`), doctrine at `:1125-1127`: *an empty form is a visible
disappointment, a form silently wired to the wrong sockets is a wrong program.* The fork remap aligns two flattens
by **type sequence**, never a blanket `+1`.

**14 · `emit` is a FROZEN template; live values go through `postInstantiate`.**
Guard: `userOps.js:965`, with the ordering constraint at `:954-956`.

**15 · CORNER IS THE GATED PILOT — no wizard ports until corner is right.**
A standing ruling, not a test: `NEXT-SESSION.md`, under **STANDING RULINGS (do not re-litigate)** — cited by
content, not line, because that file is rewritten wholesale each cycle and a line number would drift on the next
rewrite. Every mechanism is proven once on corner; the other 31 twins inherit it. A corner defect outranks the queue.

**16 · A RETIRED wizard has no built-in to compare against.** See Q1 and § TRAPS #1.

**17 · Report the honest shape; a corrected dispatch is the deliverable.**
`AGENTS.md:41` (do not "clean up" code you have not traced — find its consumers first); `AGENTS.md:35` (one
commit, one concern); `NEXT-SESSION.md:187-189` (*a symptom is an observation, not a diagnosis; grep who declares
and who consumes before relaying*).

**18 · A generic `.children`/`.uiChildren` walker goes through `childrenOf`, never a bare array assumption.**
Guard: `childrenOf`, `web/blocks/userOps.js:116`. Break it → `TypeError: (x||[]) is not iterable`, or a silent
undercount, the moment the walk reaches a `split_horizontal`/`split_vertical` node — its OWN `.children` is the
mouth-keyed object `{LEFT:[...], RIGHT:[...]}` (or `{TOP:...,BOTTOM:...}`), not an array (t2333's `mouthsOf`,
the sibling normalizer for the DEF-level mouth declaration, is a different thing — this is about reading the
CHILD ARRAY VALUE itself, wherever a node's own children/uiChildren field is iterated). **Narrow the search
correctly:** a split/multi-mouth node is placed ONLY as an entry inside a `uiChildren` array by convention (it is
pure layout/presentation vocabulary — no functional G-code atom type declares 2+ mouths) — so a walker that
recurses `.children` alone, and never follows `.uiChildren`, cannot reach one, and is safe by construction even
with a bare loop (confirmed by direct inspection at t2339: `opGlow.js`, `blocksApp.js`'s `findModelById`,
`programModel.js`'s five by-id walkers, `opSession.js`'s four walkers, `opBuilders.js`'s `scanAtoms`/`_framed`,
`lint.js`, `suggest.js`, `setupSheet.js`'s `collectOps`, `stackBridge.js`'s `recWithDefaults`,
`odTurnData.js`/`polygonData.js`'s `root.children` filters — all `.children`-only, none fixed, left as-is). The
walkers that DO need the fix are the ones that ALSO recurse `.uiChildren` generically, unguarded — six confirmed
so far, all fixed at t2337/t2339: `tests/roundtrip-whole-program-1319.spec.js`'s own `flat()` (the one that
actually broke, gating drill's flip attempt 8), `web/blocks/dataOps/edgeData.js`/`centerDrillData.js`/
`partingData.js`'s own post-instantiate `walk()` helpers (safe in practice today — none of those three twins are
tree-mode yet — but the identical shape, fixed pre-emptively rather than waiting for their own future flip to
find it the hard way), and three `tests/cam-block-native-params*.spec.js`/`cam-substack-fork.spec.js` local
finders. `userOps.js`'s `flattenBlocks`, `userOpView.js`'s `hasTreeLayout`, `blocksApp.js`'s `checkLayoutNodes`,
and `formWidgets.js`'s `traverse` were ALREADY fixed this way (t2315) before drill ever flipped once. **A full
mechanical scanner + inventory ratchet (the shape `tests/node/op-lookup-scan-1968.test.mjs` uses for the
sibling `flattenOps`/`findOpById` bypass class) was considered and deliberately NOT built** — once the risk is
correctly narrowed to "recurses `.uiChildren` generically, unguarded," the known instances are six, all now
fixed and each covered by its own real-app or round-trip test; a scanner's own tuning/false-positive burden and
its own citation-drift liability (see #17) were judged not worth it against that small, now-closed surface. If a
SEVENTH instance of this exact shape is ever found the hard way again, that is the trigger to reconsider.

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

### 3 · A DOM query standing in for a declaration → "17 twins will gain handles", then a HARDCODED selector broke
the Blocks pane, then the fix for THAT left a deferred-reader ordering hole, then a caller with no host at all
regressed silently. Five fixes, each closing the gap the previous one's design left open.
A dispatch relayed 17. Reading the whole regenerated snapshot diff — 10 lines, 7 insertions, 3 deletions, not the
~50 a 17-twin gain implies — showed only `user_corner_data` and `user_middle_data` moved. Of the other 15,
**13 declare zero role/group-tagged bindings anywhere** and have no spatial X/Y to drag at all; **2** were a
gate-harness gap, not a product gap. t1690 replaced the DOM query wholesale with a pure declaration — which then
put a handle over a param with NO rendered field yet (declared ≠ rendered; `tests/custom-op-canvas-handles.spec.js`
caught it). t1700 restored the DOM check as a SECOND, conditional half, but hardcoded which form to query:
```js
// wizards/ops/panelTypes.js:286
const _writable = (name) => _declaredParams.has(name) && !_unwritable.has(name) && (!_host || !!_field(name));
```
The declared half (`_declaredParams`/`_unwritable`) is still built from `MULTI_WIDGETS` (`panelTypes.js:25,267`) —
the **same registry** `renderOpForm`'s `renderUnit` reads. t1700's DOM half hardcoded `document.querySelector
('#wiz_user_form ...')` — fine while only the MODAL rendered this module, wrong once the Blocks pane got its own
namespaced form (`#blk_wiz_user_form`, ns='blk'). On a page that opened the modal first (warm), a drag on the
PANE silently found and wrote into the MODAL's leftover field instead of the pane's own — a silent cross-surface
write, worse than the cold failure it looked like, because it looked like it worked. t1804 fixed the ROOT, not
another special case, with an INJECTED host (`setFormHost`, `panelTypes.js:85-87` — mirroring
`setPreviewOnlyWriteHandler` just below it — dependency injection, not a new import cycle, since `panelTypes.js`
is a lower layer than `userOpView.js`, which calls it before every `renderLayout2D` call with THIS instance's own
`elNS('wiz_user_form')`, `userOpView.js:707,724` — t1906, shifted from 672,689 by 19 (the `_wcsSyncOk`/`_wcsPickerOk` gate wiring above it)). `_formHostExists` was removed rather than ported.
**t1806 found the injection point itself was still a MODULE-LEVEL SINGLETON, read AGAIN at GESTURE time** by
three DEFERRED readers (`setFields`'s drag write-back, `onEdgePick`, `onCornerPick`) — correct for `_writable`
(evaluated synchronously during the render that built it) but not for a handler firing long after that render
returned. Demonstrated live via the real "Open as modal" button (`blocksApp.js`'s `openLiveAsModal`, no tab
switch away from the Blocks pane at all): closing that modal does not re-render the pane, so the pane's own
already-built drag handlers were still reading the singleton, by then re-pointed at the modal by its own render.
(That live repro also surfaced an unrelated, separate hazard — the shared `_layout` FeatureCanvas singleton
reparenting across containers, see §9 below — which swallowed the pane's drag before it could reach this code at
all in that exact scenario; the deferred-reader bug itself was proven cleanly with a gesture-free unit test
instead — see WORK-LOG t1806.) Fixed by capturing the host ONCE into a local `_host` (`panelTypes.js:170`) at
the top of `layoutSpecFromOp`, with `_field`/`_writeParam` defined LOCALLY inside that call (no longer
module-level functions) so every closure it builds — deferred or not — closes over that one captured value
forever, never re-reading the singleton again.
**t1808's full-suite release gate caught a REAL REGRESSION from the t1804/t1806 injection work itself**:
`tests/custom-op-number-roles.spec.js`'s two authoring specs called `layoutSpecFromOp` directly, in a real
browser, and had never called `setFormHost` — they were living off the OLD global `document.querySelector`
default, same shape as the gap `custom-op-canvas-handles.spec.js` had already been fixed for at t1804, just a
sibling test file nobody had touched yet. Enumerated EVERY consumer of `layoutSpecFromOp`/`renderLayout2D`
(`web/` production code: exactly the two `userOpView.js` sites, both already correct; every `tests/` call site,
categorized by whether it exercises `.onDrag()` against a real field or only inspects handle structure) before
concluding these were the only two gaps — see WORK-LOG t1808 for the full per-site list. Fixed the test file the
same way. Then closed the CLASS of this regression, not just the instance: `layoutSpecFromOp` now separates
three previously-conflated situations explicitly — no `document` at all (the node-tier gate) stays silent and
permissive; a host injected but THIS param has no bound field (the legitimate t1648 preview-only store, or the
very first paint) stays silent; a REAL BROWSER RENDER WITH NO HOST INJECTED AT ALL is now a LOUD
`console.error` naming the op (`panelTypes.js:184-186`, the same "declaration bug, not a valid state" convention
`formWidgets.js:250` already uses for an enum with no options) — not a throw, since STEP 1's enumeration is what
makes a throw provably safe to consider LATER, not something to reach for before that enumeration exists. The
NEXT caller who forgets `setFormHost` now finds out at the moment they introduce the gap, not when a full-suite
gate catches a silently-dead handle days later.
```bash
rg -n "_writable|_host|setFormHost" DDCS-Studio/web/wizards/ops/panelTypes.js DDCS-Studio/web/wizards/views/userOpView.js
```

### 4 · RESOLVED (t2139) — the `indentStyle` split is gone, not just fixed.
This finding used to read: `activeDialectOpts()` returned `{ dialect, indentStyle }`, three modules
(`programModel.js`/`opGlow.js`/`opSession.js`) kept their own `{ dialect }`-only copy, and `indentStyle:'flush'`
appeared to change the wizard preview panel but not the committed program/glow diff/exported `.nc` — a fact
declared in one place and inconsistently read in the others.

Human ruling, "no indentation ever" (BACKLOG.md "NO INDENTATION, EVER"): the entire `indentStyle`
setting/toggle/emit-branch is RETIRED, not reconciled. There is no longer a split to close because there is no
longer a SECOND behavior for the split copies to diverge from — every dialect emits flush-left,
unconditionally (`blockEmitter.js`'s final pass, see the post-passes list above). `activeDialectOpts()` now
returns `{ dialect }` only, matching the three modules that were already right. `data/indentStyle.js` is
deleted; its surviving comment/uncomment half moved to `ui/editorTextOps.js`.

⚠ **CORRECTION (t2141) — "unconditionally" above was true for `emitMapped` only, and t2139 did not say so.**
The CAM slot-macro path (`data/slotPack.js`'s `slotMacro`, feeding every `camN.nc` a pack exports) NEVER went
through `emitMapped` at all — its generator arms (`opToSlot.js`/`millToSlot.js`) build G-code TEXT directly,
`surfaceRasterLines`' own output among it, so NEITHER guard ever touched a CAM macro. VERIFIED BY RUNNING IT: a
default rect-pocket CAM slot emitted 28 indented lines (6 of them indented N-labels) and 2 inline
`IF … THEN var=val` lines — both bench-confirmed hard syntax errors on the DDCS Expert (t2070), and the human
has never loaded a Studio-built CAM pack onto a controller, so this shipped un-caught. Closed in t2141:
`applyDdcsSyntaxGuards` now runs once, at the `slotMacro` boundary, on the fully composed body (never per-part
— its internal label allocator would mint colliding labels across parts otherwise, a wrong-cut bug strictly
worse than a refused file). Also widened the inline-THEN regex to word-form comparisons (`GT`/`LT`/`EQ`/…), not
just symbols — the wizard-op path never exercised that form, but the hand-written CAM generator text uses it
throughout (measured: the symbol-only regex caught 2 of 23 real inline-THEN lines across the twelve generator
arms and silently passed the other 21). Verified directly against `surfaceRasterLines({})`: 28/6/2 → 0/0/0.
The "unconditionally" claim above is now actually true for every G-code surface Studio produces, not just the
wizard-op one — including every probe arm (`data/probeToSlot.js`'s `cornerSlot` etc.), not only the mill arms.

### 5 · A legacy `corner` op has a live ✎ Edit that opens onto nothing — CONFIRMED live at runtime, deliberately NOT fixed.
`canEdit('corner')` (`wizardManager.js:323`) returns true because `paramFields('corner')` is non-empty —
`FIELD_BIND.corner` (`blocks/opSchema.js:158`) is folded onto `SCHEMA.corner` at `:177-180`. But those 15 field
ids point at DOM deleted with the panel:
```bash
grep -c 'id="c_corner"' DDCS-Studio/web/index.html        # → 0
```
Confirmed live (not just by inspection), t1730, with a synthetic op carrying `opType:'corner'` driven through the
real `openForEdit`/`open()` gesture: `wizardManager.js`'s `open()` finds no `#wiz_corner`, and — since `wizElem`
is falsy — the whole `if (wizElem) {...}` body (`:277-309`) is simply skipped: the overlay stays open, every
panel stays hidden, nothing fills in. A silent blank modal, no error, no message. Same shape for `middle` /
`edge` / `alignment` / `rotary_center` / `rotary_clock` / `homing` (their coded views retired at t1730 too — Q1's
"EIGHT wizards are fully RETIRED" above) and would be for any future retirement that leaves `canEdit` true. A fix
(close the overlay + toast why) was built and proven at t1730, then explicitly RULED OUT the same turn: an
amendment established there is no old-save audience for this app (no legacy `.ddcs` files exist to carry a raw
built-in type back in), so the scenario the fix protected against doesn't occur in practice — "no new UI, no new
verification step, nothing built for a legacy audience" (WORK-LOG t1730). The gap is real and reproducible
exactly as described above; it stays a known, accepted rough edge rather than a fixed one. If it's ever worth
closing, the mechanism to reuse is exactly this: `wizardManager.js`'s `open()`, right after the `wizElem` lookup.

### 6 · `setup_datawiz` is an undeclared group. **Read from source.**
`blocks/dataOps/commData.js:154` and `blocks/dataOps/homingData.js:129` (t1898 — shifted from 167 by -38) pass `'setup_datawiz'`, but `GROUPS`
(`wizardLibrary.js:28-41`) declares only `probe_datawiz` / `atc_datawiz` / `mill_datawiz`. Harmless today because
both are `opensAs` targets that `userEntries()` drops — but a **fork** copies `def.group` verbatim, so forking
Comm or Homing puts a bar dropdown on screen whose label falls through to the raw id (`wizardLibrary.js:206`).
```bash
rg -n "setup_datawiz" DDCS-Studio/web
```

### 7 · The bar's `data-optype` stamp is the BUILT-IN type, not the twin.
`commandDeck.js:109` — `e.type || e.opensAs || e.id` (t1918 — shifted from 107 by +2, `HEADER_ICONS.lathe` recoarsened). So `ui/axisGating.js` gates the Pocket button on `'pocket'`
while the click opens `'user_pocket_data'`. For `io_step` / `pause_confirm` / `tap` the stamped value is a type no
builder registry knows.

### 8 · The z-index comment in `createPreviewPanel.js:1147-1148` describes code that no longer runs.
It says the 3D canvas is z-index 2 above the 2D canvas. The only code that sets that is `gcodeViz3d.js:2835`
`attach()`, whose sole caller is the retired `wizards/_svgPreview.bak.js:94`. In the live path the WebGL canvas is
appended **in flow** (`gcodeViz3d.js:68`) and the toggle works because `setMode` sets `display:'none'`.
```bash
rg -n "\.attach\(" DDCS-Studio/web --glob '*.js'
```

### 9 · `renderDeclaredLayout` is an exported function with ZERO callers. Its former sibling risk — the shared
`_layout` singleton reparenting across the modal and the Blocks pane — was real, demonstrated live at t1806, and
**FIXED at t1816.**
`renderLayout2D` (`panelTypes.js:679-684`) used to lazily build ONE module-level `FeatureCanvas` (`_layout`) and
reuse it for every caller regardless of surface. `FeatureCanvas._mount` wipes `container.innerHTML` when the
container changes (`featureCanvas.js:92-95`), so whichever surface rendered LAST reparented the ONE instance into
its own container, leaving the OTHER surface's still-visible SVG (and its still-attached event listeners) with no
live path back to the singleton's current state — t1806's "Open as modal" repro demonstrated a drag on the pane's
own already-built handle silently reaching no `onDrag` handler at all once the modal had rendered after it. t1814
turned that into a genuine failing test (`tests/layout-singleton-reparent-1814.spec.js`) and found a SECOND
symptom of the same root cause: `FeatureCanvas.onTransform(cb)` is a single-slot assignment
(`featureCanvas.js:89`), so `userOpView.js`'s `wireAnimOverlay` re-pin callback for whichever surface registered
FIRST was silently overwritten the moment the OTHER surface's own `wireAnimOverlay` first ran against the same
shared instance.
t1816 converted `renderLayout2D` to cache its `FeatureCanvas` **per container** (`container.__layout ||
(container.__layout = new FeatureCanvas())`, `panelTypes.js:681`) — the same precedent already used by
`atcSetupCanvas.js:36`'s `container.__atcFc` and by `wireAnimOverlay`'s own `container.__animOverlay`
(`userOpView.js:119`) — rather than a module-level `Map` keyed by container (rejected: a `Map` keeps a
module-level singleton and adds an eviction-lifetime question a container-keyed property doesn't have, since it's
garbage-collected with its container). This makes `onTransform` per-instance for free, closing BOTH symptoms with
the one change — proved with two separate tests, not asserted: `layout-singleton-reparent-1814.spec.js` (the
drag hit-test, now green on its own terms) and `layout-ontransform-per-container-1816.spec.js` (the re-pin theft,
new). `renderDeclaredLayout` itself still genuinely has zero callers (`rg` below still returns one hit, the
definition) and is otherwise unaffected — it merely forwards to `renderLayout2D`.
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
| FORM | **yes, 32/32** | registry sweep over `SEED_BUILDERS` (`web/app.js:99-100` states why it is exported) |
| PREVIEW | **since 2026-08-10 only** | `tests/node/preview-spec-gate-1688.test.mjs` — spec snapshot per twin × 2 param sets; `spec.placement === partZeroShift`; the `_disp` / `getTransform` / `_pinFromTf` pixel identity at 1e-6 px with a non-vacuity guard; gesture forwarding; the glyph truth table |
| `opensAs` resolvability | **NO** | 17 per-wizard in-place specs exist, but **no sweep asserts every `opensAs` target is a registered def**. A typo'd target opens an empty `#wiz_user`. The registry-parity pattern already exists next door (the preview gate's Part 0 discovers twins from `blocks/dataOps/*Data.js` and cross-checks `SEED_BUILDERS` — `preview-spec-gate-1688.test.mjs:273-277`); it just does not cover `opensAs`. |
| the Q3 §"four semantics of `spec.placement`" and the overlay's not-told set | **NO** | nothing gates these |

Before the preview gate existed, PREVIEW was **0/32**: ~2450 e2e tests assert emitted text and data structures and
essentially none render anything, so a preview defect could not turn a test red. One day cost four production
defects, one of them shipped by an approved fix (`preview-spec-gate-1688.test.mjs:8-14`). *(Counts here are
WORK-LOG- and test-header-reported; not re-measured.)*

---

## MIGRATED FACTS — a separate pass, verified by reading, at HEAD `2f6f9149` (2026-09-03)

**This section was NOT part of the 2026-08-10 read-through above** — the rest of this document was not
re-verified this turn, only the 13 items below (t2585, closing out t2535's own deferred batch of 23 memory
candidates — 6 dropped as superseded/already-shipped/already-covered, reported in WORK-LOG t2585, not here).
Same rule as the rest of the file: name the declaration, cite `file:line`, mark what's genuinely unresolved.

**A new `uiChildren` node type needs TWO registrations, or Blockly throws and aborts the Customize-route
render.** A render branch in `formWidgets.js`'s `traverse()` (`web/ui/formWidgets.js:1447`, e.g. the
`code_preview` branch at `:1650`) AND a matching Blockly block def in `wizards/ops/` (e.g.
`web/wizards/ops/codePreview.js:21`), registered in `wizards/ops/index.js` and fed into
`Blockly.defineBlocksWithJsonArray` (`web/blocks/blockly/bridge.js:865`). The two halves are declaratively
independent — nothing enforces that adding one also adds the other, and a lone-half type throws `Invalid block
definition for type: <x>` the instant `ddcsEditWizardDef` renders the Blocks-tab canvas, which can abort
rendering of unrelated fields too.

**CAM slot building is a deliberate HYBRID, not a replace.** `camTypeOf` (`web/data/opCamMap.js:547`) resolves a
program op to a premium, live-parametric generator — `GEN = {corner,edge,surface,pocket,cpocket,zprobe,inside,
boss,align}` (`opCamMap.js:525-526`, drawn from `data/probeToSlot.js`/`data/millToSlot.js`) — or falls back to
`{universal:true}` for any op the generators can't express, routing to `data/stackToSlot.js`'s UNROLL
(value-role params stay live `#var` knobs via `data/atomRoles.js`/`data/exposeClassifier.js`; geometry bakes to
literals). A third mode, SUB-STACK (`wizards/ops/userRoot.js`'s `opunit` boundary block, transparent in
`blockEmitter.js`'s fold — see Q2's own fold table), lets a custom op embed a *standard* generator sub-unit that
stays live via `data/subStackToSlot.js`. Multi-part programs compose through `data/slotPack.js:177`
`composeParts` (uniquifies labels, strips all but the last terminal `M30`); local scratch vars allocate
collision-free through `data/camScratch.js`'s declared `SCRATCH_BANDS`/`nextLocalVar`/`fieldVarCollisions`.

**The emit source for a wizards-as-data op is the TEMPLATE itself (M2), not a JS builder it delegates to (M3,
rejected)** — a deliberate choice so re-authoring a wizard in the Blocks tab (e.g. wrapping a probe in an
`array` to make a grid) actually changes what gets built. `instantiate(def, params)` (`userOps.js:674`) clones
`def.template` — FROZEN JSON DATA — then `deriveGuards`/`pruneGuards` (`whenGuard.js:38`) resolve variant
branches and `deriveBindings` (`dataOps/deriveBindings.js:50`) re-derives value bindings BY IDENTITY after
prune. A legacy JS stack builder (e.g. `cornerStack`) survives only as the SEED that produced the frozen
template at authoring time, never as a runtime dependency.

**Stock is a richer WORKPIECE, not a bare box.** `settings.stock` stays flat for back-compat, with an additive
`stock.features[]`, projected by `getWorkpiece()`/`projectWorkpiece()` (`engine/workpiece.js:90,116`). The
taxonomy is SHAPE × SIDE, not boss-vs-pocket: `{rect:{outside:'boss',inside:'pocket'},
round:{outside:'round-boss',inside:'bore'}}` (`workpiece.js:20-21`) — OUTSIDE features share the outer stock
outline, INSIDE features are per-op cavities. `deriveLegacyFeatures` (`:64`) reproduces the old hardcoded
pocket when no `features[]` is declared, so legacy renders stay byte-identical. Editing is centralized in one
dedicated modal, `ui/stockEditor.js`, opened from every wizard's own preview composer
(`viz/createPreviewPanel.js:32,1270`) rather than duplicated per wizard.

**Persistence is a user-OWNED file, never localStorage or the exe's WebView storage** (both app-managed, wiped
on update). The File System Access API is the one mechanism for both shells: `data/fsHandles.js`/`data/backup.js`
(`BACKUP_STORES`, `:57`) for the intentional `.ddcs` Save, `data/libraryFolder.js:42-43` for granular
`.wiz`/`.cam` source sharing, `data/deployFolder.js` for baked machine deploys. The desktop exe's WebView-storage
amnesia risk (a bare `webview.start()` defaulting to `private_mode=True`) was a real, reported bug (t1257) — now
closed by routing both launchers through one function, `bridge/bridge-app/fairy/webview_storage.py:35`
`start_persistent()`, which sets `private_mode=False` and a stable per-user `storage_path`.

**The preview's machine-frame math is sourced from the static controller dump, not live machine state.**
`GcodeExecutionEngine` takes a `wcsOffset` ctor option (`engine/GcodeExecutionEngine.js:78,137`) and computes
`part = machine·unitScale − wcsOffset` throughout (`:698,1142,1224`) — a no-op (origin offset) until a profile
supplies a real one. `bridge/bridge-app/fairy/ops.py`'s `_read_setting_params` (`:920`) parses the raw
`SYSDISK/setting` f64 array; `_map_geometry_to_profile`/`_map_geometry_to_profile_v41` (`:576,762`) emit the
`geometry`/`wcs` blocks `profile()` (`:436`) serves to `web/data/profileStore.js`.

**A probe wizard's "Clearance plane" work-frame move is offered only when it is provably reading the same WCS
its own probe writes.** `clearMode:'plane'` is gated by `optionGate: { requireAll: [{param:'wcs',is:'active'},
{param:'probeZFirst',is:true}], fallback:'hop' }` (`blocks/dataOps/cornerData.js:95`) — auto-reverting to Hop
otherwise, since a specific G54-G59 target op only WRITES that WCS's offset registers without activating it, so
the plane would read whatever WCS happens to be runtime-active. Max (G53) and Hop (relative) stay frame-
independent and are always offered.

**Probing is generalised into one declared primitive**, `wizards/ops/probeSurface.js` — "a shared sub-builder,
not an atom" (`:1-4`) — composed by every probe wizard's stack builder rather than each hand-rolling its own G31
sequence + stylus-radius comp: `wizards/stacks/{corner,edge,middle,alignment,rotaryCenter,rotaryClock}Wizard.js`
and `wizards/lathe/latheProbe.js` all import it. Radius compensation lives in `wizards/ops/radiuscomp.js`,
bundled by the block rather than duplicated per wizard.

**A probe op's WCS is its OUTPUT, not its input** — the stored table value is definitionally suspect at probe
time (stale from the last part). The sim never maps a probe op's picture through the declared WCS table:
`viz/opSimContext.js:43` states it directly ("this program probes FOR the WCS... renders via the honest margin
approximation EVEN WHEN a WCS [exists]"), backed by `createPreviewPanel.js`'s `g53ApproxForViz` (`:861`, wired at
`:879`) and `probesForWcs` (`:1405`). Mill/cut ops are unaffected — they legitimately read the WCS they run in.

**Editing a CAM slot (macrosApp's `editCamSlot`) also loads its op(s) into the Blocks tab so the tab shows real
structure.** The one-source load path is `devMode.js:557` `reconstructUserOpBlock(opType)`, used by both
`editWizardDef` (single, `:621`) and `editWizardDefs` (multi, `:607`) — there is no separate Blocks→slot
converter. A def-save fires `ddcs:userops-changed`, caught by `macrosApp.js:1171` `rebuildStaleCamSlots`, which
rebuilds any CAM slot whose op has gone `defVStale` via `buildSlotFromOps`.

**The editor follows Option B: editor TEXT stays clean**, with op info read from the program model, never from
`( @DDCS … )` G-code comments — enforced by `tests/editor-sim-real-insert.spec.js:44` (`hasMarker` must be
`false`). A sim-only declaration (e.g. "this probe contact is a radius-compensated surface") must be read
SIM-SIDE, from the op stack itself. `wizards/ops/probeSurface.js:75-78` documents a concrete instance: an
earlier `( @DDCS:1 {"op":"probe-surface",...} )` marker was removed for exactly this reason; the sim now reads
the radius-comp result off the op stack directly. (That same file's own top-of-file docblock, lines 5-7, is
stale prose still describing the removed marker — the code at `:75-78` overrides it; worth fixing if anyone
next edits that file.)

**`ui/postGating.js` owns the CAPS axis of wizard-field `.disabled`** (greying fields the active post can't
support), re-running on load and every `ddcs:settings-changed`; its cap-ON pass blanket re-enables every input
in a `[data-cap]` panel unless the element opts out. The contract: `postGating.js:54-55` — `if (ok &&
c.dataset.opGated === 'true') return;` before `c.disabled = !ok`. An op view greying a field for its own
method/mode reason must set `data-op-gated="true"`, or postGating silently re-enables it a tick later.
**t2615 — RE-VERIFIED against the wizards-as-data tree path specifically: `[data-cap]` (the trigger this whole
mechanism keys on) has ZERO live targets today.** Exhaustive grep (`grep -rn "data-cap=" DDCS-Studio/web`) finds
it in exactly two places, both permanently `display:none` retired classic-shell divs (`index.html:996,1060` —
`#wiz_atc_change`/`#wiz_atc_test`, superseded by their own tree-mode twins opening in-place instead) — the SAME
retirement t1880/t1890/t1906 (above) already describe happening one cap at a time. Confirmed live, not just by
grep: opened all 20 tree-mode ops and queried their own rendered form host — 0 ever contain a `[data-cap]`
element (`data-op-gated` itself, the SEPARATE, unrelated opt-out mechanism, IS live — 12 of the 20 use it). So
`applyPostGating()`'s own element-level disable loop (`postGating.js:47-56`) is presently DEAD CODE against
every live wizard field, tree-mode or classic-in-place alike — not because it happens to behave identically in
both render paths, but because its own trigger condition no longer reaches anything either path renders. Not
removed this turn (a live-behavior finding, not a requested cleanup) — flagged for whoever next touches this
file, since `postGating.js`'s own header comment still describes an active mechanism.

**t2611–t2613 — a tree-mode migration's real risk surface is BOUNDED to whole-form-level decisions; per-row
behavior cannot drift, by construction, and does not need re-auditing per bug found.** `userOpView.js`'s real
`render()` ALWAYS calls `renderOpForm(tempHost, binds)` FIRST, into a detached scratch container
(`userOpView.js:433`), builds `byParam` by walking the resulting rows, THEN calls `renderUiTree(host,
uiChildren, bindings, byParam, ...)` (`:447`) — which does not re-render a `field_ref`'d param, it RELOCATES the
exact same pre-built DOM row (`formWidgets.js:1552` — `container.appendChild(byParam[paramName].row)`). So
every per-row behavior `renderOpForm`'s own `addRow`/`renderUnit` produces (`.form-row` class, `data-when`/
`data-whenAll`/`data-gate`, help title, `formHidden` display, the field-link gear, the widget itself) is
IDENTICAL in both paths — it is the literal same element, just moved — and the `data-when`/`data-gate` runtime
scans that later act on it (`userOpView.js` — see the `postGating` entry above for the closely related
`data-op-gated` case) already query `fhost`/`document` globally, not scoped to either render path's own
container shape, so they inherit this same immunity. **The only real risk class is decisions `renderOpForm`
computes ONCE, OUTSIDE any single row, that a tree-mode NODE TYPE has no way to see or re-derive** — both bugs
found in this arc live exactly there: `sectionizeFor` (`formWidgets.js:1239`, extracted t2611 — `group_box`
originally had no equivalent to `renderOpForm`'s own fold-threshold rule) and `SECTION_RANK`'s auto-ordering
(t2613 — `group_box`'s own order is 100% author-typed, with nothing consulting the classic sort; measured
reach: 3 of 13 order-relevant migrated ops mismatch, see WORK-LOG t2613). Before trusting ANY new tree-mode node
type as a parity-safe migration, ask specifically whether the classic path derives something at the WHOLE-FORM
level for that concern (a threshold, a canonical order, a default sourced from total shape) — per-row concerns
don't need this check, whole-form ones always do. Full account + the audit method: WORK-LOG t2613, and
`context/VERIFICATION-DISCIPLINE.md` rule 17.

**The iPhone Ring/Silent switch silences Web Audio (`AVAudioSessionCategoryAmbient`) but not `<audio>`
(`...Playback`)** — a platform fact, not an app bug (traceable to WebKit's `AudioSessionIOS.mm`; Apple closed
WebKit#237322 as "configuration changed"). `ui/sound.js:28-34` ships an unrelated Android-scheduling-race fix
(`resume().then(go)`, t2134) but as of this HEAD contains no `navigator.audioSession` call —
`grep -rn audioSession DDCS-Studio/web` is empty. **UNVERIFIED-AS-DECIDED**: the documented iOS-16.4+ fix
(`navigator.audioSession.type='playback'`) has not shipped; whether that is an oversight or a deliberate cost
tradeoff (non-mixing, can grab a Bluetooth/car route, gates Now-Playing eligibility) has no recorded ruling in
WORK-LOG/BACKLOG/ROADMAP as of this turn.

---

## UNVERIFIED — the honest gaps

- **Nothing was executed.** No test, no browser, no dev server. Every claim above is static reading with a
  `file:line` you can check in one jump. All pass/fail counts, the "549 declared bindings", the "275 px" and
  "229 px" figures, and the "~2450 e2e tests" are WORK-LOG- or test-header-reported and were **not** re-measured.
- **Trap #4 (`indentStyle`)** is RESOLVED (t2139) — the setting is retired outright, not reconciled — AND the
  CAM slot-macro gap t2139 missed is closed too (t2141, VERIFIED BY RUNNING IT, not inferred); see the entry
  above.
- **Traps #5 and #6** are read from source; neither was reproduced in a browser.
- **Q3 §5 (the machine-frame twin's overlay path)** — for a homing/machine-frame twin, the overlay's `startPin()`
  and `envelopeRect()` branch the "wrong" way. Harmless today *only* because overlay mode never draws the envelope
  or start handles and `anchorToStart` dominates `passOff`. I did not verify a machine-frame twin's overlay
  position against its SVG on screen.
- **`middleVizUtils.js` / `middleVizManager.js` / `middleVizAnimator.js` / `edgeVizAnimator.js` /
  `alignVizAnimator.js`** — was: imported at `web/app.js`, animating the legacy inline SVGs in containers
  `preview3D` sets to `display:none` on first use. **DELETED (t1730):** their sole consumer, app.js's
  `setupVisualizationListeners()`, was deleted the same act (its coded-view targets — middleView.js/edgeView.js/
  alignmentView.js — were retired then too); confirmed zero other callers of their globals
  (`window.EdgeVizAnimator`/`AlignVizAnimator`/etc.) anywhere in `web/` before deleting the 5 files. See "Six
  legacy renderers were live... DELETED at t1730" above.
- **Rule 13's partition claim** (three fork-inheritance cases cover the registry with no overlap, `userOps.js:1121-1123`)
  was read, not re-derived.
- **Rule 14 (`postInstantiate`)** is verified as a *mechanism* at `userOps.js:965`; no violation of it was found in
  this week's work-log. It is listed because the project memory names it, not because this week caught it.
- The **lathe family's** divergences from the mill spine were not traced beyond `panelTypes.js:208-209` and the
  missing `placement` key. Two of the three files dirty at verification time are lathe viz files.
  **PARTIALLY RESOLVED (cycle 857 ACT 1, PREVIEW-AS-DATA.md):** traced fully — `withLatheScene` declares only the
  blank/stock shape (`def.simStock`); CUT geometry has no declared hook at all (2D dispatched by a 6-armed regex
  on `opType`, `latheProfileCanvas.js:128-161`; 3D tool mesh by a 2-armed switch on a plain string). The single
  most consequential bug in the whole 32-twin preview survey lives here: picking a real centre-drill/drill tool
  from the library silently renders as a flat mill endmill in 3D, because `userOpView.js:361-366` reads the wrong
  field (`_tbl.type`, always `''` on a lathe row) off the picked tool. Full detail, citations, and 3 more
  cross-cutting findings in `PREVIEW-AS-DATA.md`'s lathe section.
