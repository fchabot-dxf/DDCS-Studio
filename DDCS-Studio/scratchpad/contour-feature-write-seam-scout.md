# Contour — the FEATURE-WRITE SEAM scout (t443, NO CODE)

## 0. TL;DR
Contour is the cheapest FULL mill port (no structural fork → **no superset**; side + 4 shapes are pure value-swaps) and the place to prove the **feature-WRITE seam** — the missing half of the workpiece bridge. Design: `getWorkpiece()` UNIONS the stock-modal features with features **projected (derive-not-copy)** from the program's mill ops. One KEY semantic fork for the human (outside-contour = stock-outline vs region-boss) + one reframe (region-pill → flat).

## 1. Contour current shape (ground truth)
- `contourWizard.js` → `contourStack(params)` = `[makeStart, wcs, makePlace(bbox, StepDown{ Contour(region, side, tool) }), makeEnd]`. Emits via `emitMapped(contourStack(params)).text` — **emit is already declarative** (no blocker).
- **NO structural fork:** `side` (outside|inside|on) + `shape` (rect|circle|polygon|ellipse) are pure VALUE-swaps inside `contourRegion`/`offsetRegion` — no block added/removed → **no `{superset}` guard prune** (unlike the probe twins / pocket).
- Params: `shape · originX · originY · w · h · dia · sides · side · toolDia · depth · stepdown · feed · plunge · clearance · wcs` + placement (`stockAttach · pathDatum · stockDatum · offX/Y/Z · stockW/H/Z`).
- **Bindings = POSITIONAL** (blockIndex+key, like `slotData`), NOT identity (`match:{assign,#var}`) — the cutting atoms carry plain sockets, no `#var` assign blocks.

### 1a. THE REGION-PILL → FLAT reframe (a real restructure, directive 1)
`contourStack` nests the region as a **socket block**: `contour.params.region = newBlock('region')`. `flattenBlocks` only walks `uiChildren`/`children` — **NOT block-valued params** — so the region's `shape/x/y/w/h/sides` are INVISIBLE to positional binding. Two ways:
- **(A, recommend) FLATTEN** the region params onto the contour block (contour gets `shape/x/y/w/h/sides` directly; the atom builds its region internally) → bindable positionally, mirrors `slot`'s flat `ax/ay/bx/by`. Directive 1 (restructure source, keep the format dumb). The FORM is already flat (`ct_*` fields), so no form churn — only `contourStack`+`contour` atom change, must stay emit-byte-identical.
- (B) grow `flattenBlocks`/`deriveBindings` to traverse socket blocks — REJECT (grows the engine to fit awkward source; directive 1 says restructure instead).

## 2. THE SEAM — getWorkpiece PROJECTS a contour op's cut feature (DERIVE-not-copy)

```
   TODAY (one-way bridge)                        WITH THE SEAM (loop closed)
   ┌─────────────┐                               ┌─────────────┐   ┌──────────────────┐
   │ stock modal │──writes──► stock.features[]   │ stock modal │   │ program mill ops │
   └─────────────┘                 │             └──────┬──────┘   └────────┬─────────┘
                                    ▼                    │ writes            │ (op.params)
                            getWorkpiece()               ▼                   ▼ project (pure)
                                    │             stock.features[]    featureFromContourOp(op)
                                    ▼                    └────────┬──────────┘
                          probes READ features[]                  ▼  UNION (derived, no copy)
   (deriveLegacyFeatures SYNTHESIZES a pocket             getWorkpiece() = {outer, features[]}
    because NO op declares one)                                    ▼
                                                        probes READ the EXACT milled object
```

- **Projector home:** `engine/workpiece.js` (beside `projectWorkpiece`/`deriveLegacyFeatures`). Reads the program via `window.ddcsGetBlockProgram()` (the same global pattern getWorkpiece already uses for `window.ddcsGetSettings().stock` — no circular dep).
- **`featureFromContourOp(op)` → a feature** `{ id, shape, side, pos, size, depth }`, a PURE projection of `op.params` (mirrors `projectWorkpiece`/`layoutSpecFromOp` — declaration-consistent, NOT inferred from G-code motion, NOT written into `stock.features[]` on save).
- **Param → feature map:**
  | feature field | from contour params | note |
  |---|---|---|
  | `shape` | rect→`rect`; circle→`round` | polygon/ellipse → **fork** (round-by-bounds, or extend schema) |
  | `side` | inside→`inside`; outside→`outside` | `on` (wall-finish) → **fork** (no distinct feature?) |
  | `pos` | region origin + PlaceOnStock placement | **reuse `ops/placement.js` math (one-source)** → stock-min-XY physical frame (like `deriveLegacyFeatures.pos`) |
  | `size` | rect→`{x:w,y:h}`; round→`{d:dia}` | the region size (the TRUE profile, pre-offset) |
  | `depth` | `depth` | full/partial |
- **UNION w/o duplication:** op-projected features carry a provenance key (e.g. `id:'op:'+op.id`, `src:'program'`) distinct from modal features (`src:'stock'`). Live: op edits → re-derive; op deleted → feature vanishes (no orphan). No copy → no drift.

## 3. THE KEY SEMANTIC FORK (needs the human) — sharpened by the consumer contract
**Consumer-contract finding (all 5 readers):** they consume ONLY `side:'inside'` features; an `outside` feature's size falls back to the OUTER block (`featureSize` workpiece.js:34-38 — "outside inherits outer"). So the two sides cost very differently:

- **INSIDE contour → `{side:inside}` cavity.** Projects `{pos, size:region, depth}` → **consumed by ALL 5 readers FOR FREE** (probe-stop walls, Middle centre-start, 3D cavity donut, 2D backdrop, modal). Zero reader cost — an immediate, unambiguous win. **This alone proves the seam.**

- **OUTSIDE contour → a boss** (the advisor's stated target). An outside profile cuts AROUND the region → a boss = the **region size** (usually SMALLER than the stock — a raised pad). But **NO reader consumes an outside feature's own size today** (outside ≡ the whole stock), so proving "probe THAT boss" needs real extension:
  - **Fork A (outside ≡ outer, today's F3):** writes NOTHING new (the stock outline already exists) → an outside contour is redundant with the stock; a probe reads `outer` and works WITHOUT the seam. Zero cost, zero new value.
  - **Fork B (activate the DEFERRED size-override):** outside → a boss with its OWN size = the region. Correct for a sub-stock pad, but requires: (i) `featureSize()` honor an explicit outside size (**1-liner**: `f.side==='inside'||f.size ? f.size : outer`), AND (ii) the RENDERERS learn an outside sub-stock feature — a boss renders RAISED, not a recessed cavity: `gcodeViz3d:1111` (a raised-boss mesh, not the cavity donut) · `probeGeometry:110` (probe the boss OUTSIDE walls) · `workpieceBackdrop:130` (a boss glyph, currently `continue`s on non-inside). **A meaningful multi-reader rendering slice.**
- **Recommendation:** prove the seam with the **INSIDE contour first** (E2, zero-cost, all readers consume it). Treat the **OUTSIDE boss (Fork B) as E2b** — the reader/renderer extension is the real content of "the outside/boss write" and shouldn't be smuggled into the first proof. Cite [[workpiece-model-pivot]]: the outside size-override was explicitly deferred "DECLARE later if it comes up" — Contour is when it comes up, and the consumer contract shows it's a rendering slice, not a 1-liner.

## 4. E-DECOMPOSITION
- **E1 — the twin (port), emit BYTE-IDENTICAL.** `contourDataDef` mirroring `slotData`: wrap `contourStack` as `user_contour_data`, POSITIONAL bindings (blockIndex+key), opensAs in-place from the Contour mill slot. Includes the **region-pill→flat reframe** (§1a — the PROVEN surfacing precedent: a dedicated flat `contour`-with-flat-geometry so shape/x/y/w/h/dia/sides are bindable knobs). VERIFY byte-identical vs `contourStack` across shape×side×scalar sweep. (No superset — the simplest twin yet.)
- **E2 — the FEATURE-WRITE PROJECTION (the seam), INSIDE-first.** `featureFromContourOp(op)` in `engine/workpiece.js` + `getWorkpiece()` reads the program via `window.ddcsGetBlockProgram()`, projects each contour op, UNIONS with stock features (provenance-keyed, no copy). Scope E2 to the **INSIDE cavity** (all 5 readers consume it free). VERIFY (assert-the-value): a placed inside-contour op makes `getWorkpiece().features` carry the derived cavity at the right pos/size (independent geometric truth), a Middle probe READS it (the loop closes end-to-end), and the stock path is byte-identical when no contour op is present.
- **E2b — the OUTSIDE BOSS (Fork B, the reader/renderer extension).** `featureSize` honors an explicit outside size + `gcodeViz3d`/`probeGeometry`/`workpieceBackdrop` render/probe a raised sub-stock boss (§3). Separate slice — the real content of "the outside/boss write". Gate on the human's Fork B ruling.
- **E3 — workpiece-read / layout / datum.** contour view reads `workpieceBackdrop(getWorkpiece())` (migrate off flat `s.stock`); the feature glyph; datum coherence (the `layoutSpecFromOp` origin=datumXY precedent).

## 5. FORKS + RISKS (for the human / advisor)
1. **Outside-contour semantics** (§3) — A stock-outline vs B region-boss. **Human call. Recommend B.**
2. **Region-pill→flat reframe** (§1a) — restructure contour source vs grow engine. Recommend flatten; risk = keep emit byte-identical.
3. **Shape mapping** — polygon/ellipse have no rect|round feature analog → round-by-bounds (lossy) or extend the feature schema. Minor fork.
4. **`side:'on'`** (wall-finish, tool-centre on boundary) → likely NO distinct feature (it neither adds nor removes material as a bulk region). Confirm.
5. **pos one-source** — the projector MUST reuse `ops/placement.js` (the same math PlaceOnStock/the 2D layout use) or 2D/3D/feature diverge.
6. **Union keying** — an op feature at the same spot as a modal feature: precedence/dedup rule (program wins? both show?). Define before build.
7. **Multi-op / ordering** — several contour ops → several features (fine); a later pocket INSIDE an earlier boss (nesting) is out of scope for Contour, flag for Pocket.

## 6. GROUNDING (accessors + precedents — Explore agent, verified file:line)
- **Program read (no circular dep):** `programModel.getStack()` = `export const getStack = () => stack` (programModel.js:28), exposed as `window.ddcsGetBlockProgram` (:205) — the SAME global pattern `getWorkpiece()` uses for `settings.stock`. Op-containers are `{type:'op', opType, params, children, id}`.
- **Read a placed contour op's geometry — existing precedent:** `RECONCILERS.contour(prog)` (opSession.js:129-147) already does `find(prog,'contour').params` + `params.region.params.{shape,x,y,w,h,dia,sides}`; `declaredOpParams(prog, opType)` (opSession.js:331) = "the DECLARED params of the (first) op of opType" — the direct read-by-opType helper the projector mirrors.
- **The projection precedent to mirror:** `layoutSpecFromOp(def, params, …)` (panelTypes.js:88) is a PURE fn of (def, params) → `{stock, items, handles, onDrag, origin}`; it reads op params through declared bindings/roles and switches on shape to emit canvas primitives — and it ALREADY reads `workpieceBackdrop(getWorkpiece())` (:115). `featureFromContourOp` mirrors this: pure fn of op.params → a `{shape,side,pos,size,depth}` record.
- **The reframe is PROVEN, not novel:** surfacing lifted geometry OUT of a Region pill into a flat `surfacefill` atom (surfacingData.js:3-8, surfaceFill.js:3, surfacing-as-data.spec.js:8); slot/text never had a pill. Contour is the last mill op still carrying the `sockets:{region:'region'}` pill (contour.js:46).

## 7. CONSUMER CONTRACT (who reads features[] — the schema the projection must hit)
Feature schema in use: `{ id, shape:'rect'|'round', side:'inside'|'outside', pos:{x,y}, size:{x,y}|{d}, depth }` (deriveLegacyFeatures workpiece.js:68-75). Readers (ALL inside-only today):
| reader | file:line | uses |
|---|---|---|
| stock modal (the ONLY writer + reader) | stockEditor.js:165,171-186 | draws + drags feature handles → `applySettings({stock:{features}})` |
| bore probe-stop geometry | probeGeometry.js:110-116 | inside cavities → ray-box walls so a probe stops at the pocket wall |
| Middle sim-start centre | opSimStarts.js:31 | inside feature `pos` → the Middle probe's centre start |
| 3D stock mesh | gcodeViz3d.js:1111 | inside cavities → extruded through-hole donuts |
| 2D layout backdrop | panelTypes.js:115 (via workpieceBackdrop) | inside cavity glyphs behind the op handles |

→ The projection MUST emit this exact `{shape,side,pos,size,depth}` shape so an INSIDE contour is consumed by all 5 for free; an OUTSIDE feature is a NEW consumer case (E2b).
