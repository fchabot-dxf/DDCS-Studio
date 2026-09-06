# Wizard Audit: Composable Authoring (Atoms)

This report details exactly which parts of the built-in wizards are fully "built as atoms" (blocks) today, and which parts are still hardcoded in JavaScript (and therefore lost when you save a custom wizard).

---

## 🧭 WHAT ACTUALLY OPENS — read this BEFORE asserting any architecture

**The trap:** it is natural to assume a ported wizard means *two* surfaces exist — the built-in and its
`(data)` twin — and that you can compare them. **For most ported wizards that is false.** The built-in
menu slot opens the TWIN **in place**. There is one surface, not two. Reasoning about a comparison that
cannot be made sends work down a path that does not exist. (Cost this real: an advisor dispatched
"compare the Corner wizard's canvas against the twin's" for a Corner wizard that no longer opens.)

**The declaration is `opensAs`** (`web/blocks/wizardLibrary.js`) — a built-in library entry declares which
op it actually opens. That declaration is the source of truth; this document deliberately does **not**
copy the list, because a copied list rots. To see the current truth:

```
grep -rn "opensAs" DDCS-Studio/web --include=*.js
```

Ported in-place via `opensAs` (as of 2026-08-09, indicative — re-grep, don't trust this line): ATC Test ·
Tool Change · Tool Table · Bore · Contour · Pocket · WCS · Edge · Middle · Rotary Centreline · and more.

**One entry goes further — Corner is fully RETIRED, not merely routed.** Its entry points were deleted,
not redirected: `openCorner()` (`web/app.js:349`), `openCornerWiz` (`web/ui/globalFunctions.js:29`), and
its viz listeners (`web/app.js:298`). `user_corner_data` **is** Corner. There is no built-in Corner to
compare against, open, or fall back to.

**So, before claiming two things exist to compare:** grep `opensAs` and grep for `retired` near the entry
point. Two greps. A retired surface assumed live is the most expensive kind of wrong, because everything
built on top of the assumption has to be thrown away.

---

## ✅ What is fully built as Atoms (Blocks)

1. **The Execution Logic (G-code):** 
   100% of the actual machining logic for all wizards is built entirely from blocks (`move`, `probe`, `assign`, `distmode`, etc.).
2. **Basic Form Parameters:** 
   When you open a built-in wizard in the Blocks tab, the system runs a function called `bindingsToBlocks()`. This successfully converts all the basic numeric inputs, dropdowns, and checkboxes from the old JavaScript array into `formfield` blocks inside a `Parameter Group`.

---

## ❌ What is NOT built as Atoms yet (The "Lost" Features)

While the engine has the *concept* of layout blocks (`panel`, `simstart`, `coordlist`), the complex logic for many built-in wizards has not been ported to them yet. When you save a custom wizard, these hardcoded JavaScript features are stripped away.

To successfully move all wizards to the "One Source of Truth" without making the Blocks tab an unusable mess, we must explicitly divide our UI blocks into two distinct paradigms:

### 1. Schema Blocks (Fine to author directly in Blockly)
These are blocks that work perfectly well being dragged and dropped. They do not render the GUI themselves; they simply act as a **schema** (a list of instructions) that the engine uses to generate standard HTML forms.
* **Examples:** `formfield` (numbers, text), `dropdown`, `checkbox`.
* **Current Status:** These are already fully working! When you open a wizard, the engine successfully converts its basic parameters into these Schema Blocks.
* **Action Required:** We just need to manually port the remaining wizards (Corner, Pocket, etc.) to use these blocks in their templates instead of JavaScript arrays.

### 2. Entrypoint Blocks (Require Dedicated GUI Editors)
These are blocks that represent highly complex, interactive GUI features. You **cannot** comfortably author these using standard Blockly blocks. Instead, the block serves as an **entrypoint**—it sits on the canvas as a "Save Slot", and you click an "Edit" button on it to open a dedicated visual editor. 

> ⚠ **READ THE "WHAT COUNTS AS COMPLEX" SECTION BELOW BEFORE BUILDING ANY OF THE FOUR CATEGORIES.**
> Most of what looks complex decomposes into ordinary Schema Blocks. Reaching for a bespoke editor
> should be the *last* move, not the first — and the categories below were written before that test
> existed.

We can categorize the required Entrypoint Blocks into four specific types based on the editor they need to launch:

#### Category A: 2D Coordinate Lists (The Point Picker)
* **Affected Wizards:** Drill, Bore, Hole Cycle
* **The Missing Piece:** We have the `coordlist` block definition, but it needs to launch a **Point Picker Modal**. This modal would let the user click on a 2D grid (or an imported DXF/SVG) to drop drill points, and then serialize that list of X/Y coordinates back into the `coordlist` block.

#### Category B: Custom 2D Feature Layouts (The "Mini-Workspace" Hybrid)
* **Affected Wizards:** Pocket, Surfacing, Contour
* **The Challenge:** A wizard author needs a way to visually design a complex 2D layout (like drawing a top view and a side view) without writing JavaScript.
* **The Architecture (The Hybrid Approach):** Building a pure "Canvas Builder" modal hides the data, but building it blindly with blocks on the main canvas forces you to constantly switch tabs to see what you drew. The solution is a hybrid:
  1. We introduce a `feature_canvas` container block that has a statement "mouth".
  2. We create a library of **GUI Drawing Blocks** (`draw_rect`, `draw_circle`, `draw_line`, `drag_handle`).
  3. When you click "Edit" on the `feature_canvas` block, it opens a **Focus Modal**. 
  4. Inside this modal, the left side is a **Mini-Blockly Workspace** showing only the drawing blocks inside that mouth. The right side is a **Live FeatureCanvas**. 
  5. As you snap drawing blocks together on the left, the canvas on the right updates instantly. When you close the modal, the drawing blocks remain visible inside the `feature_canvas` mouth on the main canvas, ensuring nothing is hidden!

#### Category C: Dynamic 3D Preview Anchors (The `inferStart` Math)
* **Affected Wizards:** Corner, Edge, Middle
* **The Missing Piece:** We need a `sim_start_anchor` block that launches a **3D Bounding Box Modal**. Instead of writing complex JavaScript trigonometry to figure out where the tool should hover before probing, the user visually drags a starting point relative to the stock in the modal, which saves the offset math to the block.

#### Category D: Structural Pruning (Shape-Shifting Logic)
* **Affected Wizards:** Corner (Auto vs Manual), Pocket (Shape dropdown)
* **The Missing Piece:** We need a `structural_guard` block. This is a block with a dropdown and a statement "mouth". It doesn't need a complex modal editor, but it acts as a special entrypoint for logic: any G-code blocks placed inside its mouth are only emitted if the dropdown value matches. The engine already supports this pruning; we just need the UI block to expose it.

---

## Built-ins are DATA, but they are NOT EDITABLE (ruled 2026-08-06)

Two things that sound alike and are not:

| | verdict |
|---|---|
| **Built-in wizards become data** (layout as blocks) | ✅ **essential** — it is the one-source-of-truth win, and it is what makes fork-to-custom lossless |
| **Editing a built-in in place** (override layer) | ❌ **no** |

**Fork-to-custom is the path.** Open a built-in, change it, save it as yours. The built-in stays
pristine and keeps receiving app updates.

### Why not in-place editing

1. ⚠ **Safety, and this one is specific to what this app drives.** A presentation edit that hides or
   reorders `safe Z`, `clearance`, or a probe direction is one click from a crash — and whoever made
   that edit months ago will not remember. A general-purpose app can tolerate that; a CNC app cannot.
2. **It manufactures an update problem that fork-to-custom does not have.** Ship a fix to a built-in
   and every in-place edit either blocks it, silently loses it, or conflicts. That is precisely why an
   override layer would need provenance, reset, and conflict display — machinery for a problem we can
   simply decline to create.
3. **Nobody has asked.** Building a layering model for an unproven need is the speculative machinery
   this project's own principles warn against. Declare liberally; build reluctantly.

### What people usually actually want

- *"start from corner and make MY version"* → **fork-to-custom**, already implied by built-ins-as-data.
- *"stop showing me fields I never use"* → **personalisation** (collapse / reorder / favourites): a
  non-destructive, resettable VIEW preference that never removes a field. Cheap, safe, and available
  later if the annoyance actually shows up.

### The trigger to revisit

If the maintainer finds themselves repeatedly forking a built-in **just to change one label**, that is
real evidence and this ruling should be reconsidered. Until then, built-ins are immutable.

---

## What Counts as a "Complex GUI" — and What To Do About It

*(Added after review, 2026-08-05. The four categories above were written before this test existed.
Apply this section first; it dissolves most of them.)*

### The principle

> **A GUI should RENDER a declaration, never be the only way to AUTHOR one.**

If the modal is where the data lives, the data is trapped in the modal — invisible on the canvas,
undiffable, and unreachable by anything except that one editor. If **blocks declare the data** and the
GUI is a comfortable editor *for those declarations*, you get both: the convenience of the visual
editor and the blocks remaining the single source of truth.

This is the existing `declared-seam-before-the-declaring-GUI` rule, applied to wizard authoring.

### ⚠ TWO ORTHOGONAL AXES — do not conflate them (user ruling, 2026-08-05)

An earlier draft of this section read as *"avoid complex editors"*. That is **not** the rule, and the
correction matters because it makes the architecture more permissive without weakening the guarantee:

| Axis | Rule |
|---|---|
| **Is the parameter DECLARED?** | **Mandatory.** The value lives in the block. Non-negotiable. |
| **Which WIDGET edits it?** | **The wizard author's free choice** — text field, stepper, slider, dropdown, 3×3 grid, a drag handle on a canvas, or a full modal editor. |

> **"Trapped" means the VALUE DOES NOT LIVE IN THE BLOCK — not that the editor is complex.**

A modal that serializes a point list into a declared param traps nothing: the value is on the canvas,
diffable, and reachable by every other consumer. The real failure is a modal whose state lives
*elsewhere* — localStorage, a side file, a closure — with the block holding only a reference.

**So an author may absolutely choose a complex modal for their own param.** Two consequences worth
having on purpose:

- **The same param can wear different widgets in different wizards.** A diameter is a number: one
  wizard gives it a text field, another a slider, another a drag handle on a circle. The data model
  never changes. (This is the `widget-library-custom-op-wizards` idea, falling out for free once the
  axes are kept separate.)
- **Do not force a widget onto every param, and do not force a param into one widget.** The engine
  should render a sensible default and let the author override it — never require the override.

### The test: is it actually complex, or just visual?

Ask these in order. The first **yes** decides it.

| # | Question | If yes |
|---|---|---|
| 1 | Can the thing be described by a **fixed set of named parameters**? | **Schema blocks.** Not complex — just visual. A canvas may *render* it, but params author it. |
| 2 | Is it a **finite composition** of such parameter sets (a source, a transform, a filter)? | **Several schema blocks**, one per concern. Still not complex. |
| 3 | Is the data **irreducibly unstructured** — an arbitrary list or an imported blob with no parametric form? | **Entrypoint block.** Genuinely complex. The block holds the data; an editor edits it. |
| 4 | Does authoring require **live spatial feedback to be possible at all** (not merely nicer)? | **Entrypoint block**, and say why in the block's own comment. |

**"It has a picture" is not complexity.** The wizard tab already redraws a preview whenever a parameter
changes; that loop is free and applies equally to block-derived params.

### Applying the test to the four categories

| Category | Verdict | Decomposition |
|---|---|---|
| **A · Point lists** (drill, bore, hole cycle) | **Mostly Q1/Q2 → schema blocks** | `pattern_grid{cols,rows,dx,dy}` · `pattern_circle{dia,start,n}` · `point_skip{list}`. The drill wizard is *already* parametric this way. Only a hand-clicked or imported point cloud reaches Q3. |
| **B · Feature canvas** (pocket, surfacing, contour) | **Mostly Q1 → schema blocks. Category largely dissolves as CORE MACHINERY** — though an author may still attach a drawing widget to their own declared params (see the two axes above). | These are **parametric features, not drawings**: `feature_rect{x,y,w,h}` · `feature_circle{cx,cy,r}` · `corner_radius{r}`. `viz/featureCanvas.js` already renders exactly this from params. The `draw_rect`/`draw_line` + mini-Blockly build treats a parametric problem as a freeform one. |
| **C · 3D anchor** (corner, edge, middle) | **Q1/Q2 → schema blocks** | `anchor_from{stock-corner\|feature-centre\|wcs}` + `anchor_offset{x,y,z}`. Declared intent instead of inferred trigonometry. The 3D view becomes a convenience for setting two numbers — not the source. Consistent with `datum-model-physical-derived-offset`. |
| **D · Structural guard** | **Not a GUI question at all** | Already an ordinary block. ⚠ And it is **not a UI block**: it prunes emitted G-code, while every other block in this family is inert (`emit: () => []`). File it with flow control so nobody inherits the "emits nothing" assumption. |

**Net effect: four categories of bespoke editor collapse to one** — genuinely arbitrary geometry
(an imported DXF contour, a hand-clicked point cloud). That case is irreducible precisely *because*
the data has no structure to decompose into parameters.

### Why the decomposed form is better, beyond saving work

- **Inspectable.** You can see on the canvas that a pocket is 80×60 with 5 mm corners, rather than it
  being opaque inside a modal.
- **Diffable.** Comparing declared params is trivial; comparing serialized modal state is not — and the
  lossless round-trip invariant depends on being able to compare.
- **Reusable.** A `pattern_grid` block serves drill, bore, and hole-cycle. A drill-specific point-picker
  modal serves one wizard.

### The costs — decided, not discovered later

1. **Several blocks now describe one visual thing**, so the canvas must render their *combination* live
   while the author edits. The wizard tab already does this (params change → preview redraws); point the
   existing loop at block-derived params rather than building a second one.
2. **A larger vocabulary.** This trades a few big builds for many small blocks, and vocabulary has real
   costs: discoverability, naming, palette crowding. **Open question to settle early:** do these live in
   one "Feature" category, or grouped per wizard family?
3. **A decomposition can be wrong.** If a parameter set turns out not to describe the real cases, the
   fix is revising a declaration — which is cheap, and is exactly why declaring beats building.

---

## The Next Evolution: Composable Wizard Layouts
Some wizards need **multiple** GUI sections at once (e.g., a 2D top view for picking points, and a 2D side view for dragging depth). 

Currently, the layout of a wizard is controlled by a single, rigid `panel` block (which just offers dropdown choices like `form3d+2d`). To enable wizards with multiple complex GUIs, we need to upgrade the `panel` block from a rigid string into a **structural layout system**:

1. **Responsive Flexbox Containers:** We introduce blocks like `split_horizontal` and `split_vertical`. Crucially, these blocks would have settings for **flex ratios** (e.g., a 2:1 split), allowing authors to define how much space the top view gets vs the side view, while ensuring the whole layout remains responsive using standard CSS flexbox.
2. **Dropping in GUIs:** You can build a responsive grid layout by nesting these containers, and then you just drop your Entrypoint Blocks (like `coordlist` or `feature_canvas`) into the specific regions of the grid you created.
3. **The Result:** The engine reads this structural tree of blocks and dynamically renders a multi-pane wizard UI. This allows for infinite layout combinations without writing new Vue components.

---

## Summary: The "Entrypoint" Architecture

To achieve the "One Source of Truth" without making the Blocks tab an unusable mess of complex math and coordinate lists, we must adopt this **"Blocks as Entrypoints"** architecture. 

The Blocks canvas remains the central nervous system (holding 100% of the data), but for highly complex GUI features, the blocks simply act as storage nodes that launch dedicated, purpose-built visual editors.

### Component Reusability (The Secret Weapon)
The most powerful part of this architecture is that **we do not need to build these visual editors from scratch**. 

The exact same HTML/JS/Vue components that currently render these interactive features in the Wizard tab (e.g., `coordListSvg.js` or `regionEditor.js`) can be entirely reused for the block editors. 

---

## t2675 — THE LIVE-ANCHOR PRIMITIVE: a design memo (DESIGN ONLY, nothing below is built)

⚠ **Everything above this line describes an earlier, speculative vision (Vue components, `draw_rect`,
`sim_start_anchor`, `structural_guard`) that was never built.** What actually shipped instead
(BACKLOG #71/#72, t2511 onward) is a DIFFERENT, simpler mechanism: `point_handle`/`rect_handle`/
`radial_handle`/`length_handle`/… — small GUI blocks nested inside a `feature_canvas` block's own mouth,
each declaring a FIXED literal anchor (`ax`/`ay`) plus which real form param(s) it drags. `panelTypes.js`'s
own `layoutSpecFromOp` reads them via a `groups[gid]` loop, switching on `anchor.kind`. This memo is
grounded in THAT real, shipped mechanism — not the categories above, which this document keeps only as
history.

### The problem, in one sentence per op (t2665/t2673/t2675's own measurements)

Migrating a built-in-as-data twin's canvas gestures from a JS `previewGeometry` hook (or, for corner, a
role-tagged fallback with no hook at all) to REAL blocks in the `feature_canvas` mouth requires the
declared-anchor vocabulary to express three things it currently cannot:

| Gap | Ops blocked | What's missing |
|---|---|---|
| **(a) Live, datum-relative anchor** | bore, contour, drill, pocket, surfacing, tap, text (7 ops) | The anchor position depends on ANOTHER field's live value (`originX`) AND a datum-corner selector (`stockAttach`/`pathDatum`) that picks which corner + which sign. `rect_handle`'s `ax`/`ay` are fixed literals baked at authoring time. |
| **(b) Conditional write target** | surfacing (`sf_pos` specifically) | The SAME visual marker writes `originX`/`originY` in one mode and `jogX`/`jogY` in another, picked by a THIRD field (`zMode`). `point_handle`'s `fx`/`fy` resolve once, at authoring time (must-match pickers). |
| **(c) Incremental/relTo anchor in the DECLARED path** | corner (`cross1_x/y`, `startX/Y`) | The anchor is a LIVE OFFSET from another declared sim-start pass (`relTo:{row:'wall1'}`), including a pinned-wall write-back and a dog-leg runtime-end shift. The value-binding side already carries `relTo`; the DECLARED `anchor.kind==='point'` render branch does not resolve it at all — only the older role-tagged fallback does. A PARTIAL precedent already ships: `crossAim` (`anchor.relToRow`) resolves the position half via the same `resolveRelToIndex`, but not the write-back/dog-leg half. |
| **(d) Compound / multi-field anchor** | slot (`sl_anchor`, a `translate` handle moving `ax/ay` AND `bx/by` together) | None of the 10 existing `anchor.kind` values are a compound "move several params by one shared delta" gesture — deliberately unbuilt once already (t716's own header: "Slot has no single position param… this is the anchor the origin-based ops get from their pos handle"), and un-deferring it is the same ruling, not a new one. |

Three declaration shapes below answer (a)/(b)/(c); (d) is named as its own, separate, still-deliberately-
unbuilt gesture kind (not designed here — a compound handle is a different vocabulary problem, one value
per FIELD rather than one value per HANDLE, and deserves its own memo when it's actually prioritized).

### Proposal (a) — anchor-by-reference: an anchor that names a datum, not a literal

**The idea:** `rect_handle`'s `ax`/`ay` (and `point_handle`'s, for symmetry) accept EITHER a plain number
(today's literal, unchanged) OR a declared REFERENCE — the name of another param this stack already
binds, resolved live at render time. A SECOND, optional field names the datum-corner SELECTOR (which
param picks px/py/sx/sy the way `stockAttach`/`pathDatum` do for surfacing) so the corner itself can be
live too, not just the offset.

- **Block face:** `rect_handle`'s `ax`/`ay` fields stay plain text (already true today — no picker, no new
  field TYPE), but the reference form is recognizable (`@originX` or similar sentinel, matching how
  `resolveAnchorCoord` already distinguishes a stock-token string from a plain number by trying the token
  table first). A THIRD, new field — `cornerParam` — optionally names the datum-selector field
  (`stockAttach`), must-match-picker like `fx`/`fy` already are.
- **What `deriveBindings`/`handleBindingsFromStack` does:** unchanged at the DERIVE layer — `anchor.ax`/
  `anchor.ay`/`anchor.cornerParam` stay RAW STRINGS (mirroring `point_handle`'s own `ax`/`ay`, already kept
  raw for exactly this reason — t2573's own note). Resolution moves entirely into the RENDER layer.
- **What `panelTypes.js` does:** `resolveAnchorCoord` gains a THIRD tier — after the stock-token table and
  the plain-number parse, try `params[raw]` (the op's own live value) if `raw` matches a param name AND a
  `params` argument is threaded through (today it only receives `stock`, not `params` — a real, small
  signature change, not free). The datum-corner math itself (`px`/`py`/`vx`/`vy`/`sx`/`sy` from
  `stockAttach`/`pathDatum`) — currently `handleScale()`'s own private logic — becomes its own small,
  exported, reusable function `cornerAnchorOf(cornerParamValue, w, h)` that BOTH `handleScale` (unchanged
  call sites) and the new render-time anchor resolver can call, so there is one source for "what does
  'pp' mean" rather than two.
- **What the 7 blocked ops' JS would translate to:** `sf_size`'s current `{ax: ox+px, ay: oy+py, sx, sy,
  ...}` (computed inline in `surfacingPreviewGeometry`) becomes a `rect_handle` block: `{field:'w',
  fieldH:'h', ax:'originX', ay:'originY', cornerParam:'stockAttach', valueField:'field'}` — the block
  names WHICH params to track, the render path does the datum-corner math the SAME way `handleScale`
  already does it, just reading it through the reference instead of a direct function call.
- **What it CANNOT express:** a REFERENCE anchor whose target is itself computed (not a plain bound param)
  — e.g. if a future op's "corner" depended on TWO fields combined, not one selector param. Not needed by
  any of the 7 today (all resolve through one datum-selector field), but worth naming as the boundary.

### Proposal (b) — target-by-condition: a write target that switches on another field

**The idea:** reuse the vocabulary formfield's own `when` gating already established (`whenparam`/
`whenis`), applied to WHICH PARAM a handle writes rather than whether a FORM ROW shows. A handle
declares MULTIPLE candidate targets, each with its own `when`; exactly one is active at a time (the SAME
mutual-exclusion `whenOk` already guarantees for row visibility).

- **Block face:** `point_handle` gains a repeatable "target" sub-structure instead of a single `fx`/`fy`
  pair — concretely, N target rows, each `{fx, fy, whenParam, whenIs}`, authored as either (i) a small
  fixed-count set of extra optional fields (`fx2`/`fy2`/`whenParam2`/`whenIs2` — ugly but simple, matches
  this codebase's own existing "a few numbered slots" precedent e.g. `min`/`max` pairs) or (ii) the handle
  nests small `handle_target` child blocks in a THIRD mouth, more composable but a new mouth-authoring
  surface no handle block has needed before. Given only surfacing needs this today (1 op, 2 targets), (i)
  is the smaller machinery; (ii) only earns its cost if a THIRD op needs 3+ conditional targets later
  (rule-of-three, this project's own standing discipline for when a slot's machinery is worth building).
- **What `deriveBindings`/`handleBindingsFromStack` does:** `attach()` is called ONCE PER CANDIDATE TARGET
  (not once), each producing its own `{group, role, anchor}` entry tagged with that target's own `when` —
  mirroring EXACTLY how a `when`-gated group ALREADY skips rendering in `layoutSpecFromOp`'s own group loop
  (`gWhen`/`whenOk`, already live for corner's own `start` group). No new gating primitive — REUSE.
- **What `panelTypes.js` does:** the `groups[gid]` loop's existing `gWhen` check (skip the WHOLE group if
  its gate fails) already does 90% of this — the remaining piece is: when a group has MULTIPLE members for
  the SAME role (x appears twice, once per candidate target, each own `when`), pick the one whose `when`
  passes instead of the current `byRole[b.role] = b` last-write-wins (which silently picks whichever
  candidate happens to iterate last — today harmless since no group has this shape yet, but a real bug the
  moment one does).
- **What surfacing's own JS would translate to:** `startMarkerTarget(zMode)`'s own `{normal:{x:'originX',
  y:'originY'}, skim:{x:'jogX',y:'jogY'}}` map becomes two `attach()` calls behind one `point_handle`
  block: target 1 `fx:'originX', fy:'originY', whenParam:'zMode', whenIs:'normal'`; target 2
  `fx:'jogX', fy:'jogY', whenParam:'zMode', whenIs:'skim'`.
- **What it CANNOT express:** a target that depends on TWO conditions at once (an AND of two `when`s) —
  `whenOk` itself already supports only a single param/value pair per gate; widening THAT is a separate,
  earlier-layer decision this memo doesn't reopen. Not needed by surfacing (one condition, `zMode`), named
  as the boundary for whoever hits it next.

### Proposal (c) — relToRow on point_handle: extend the ALREADY-SHIPPED crossAim precedent

**The idea:** the smallest of the three — `point_handle` gains ONE new field, `relToRow`, mirroring both
`formfield`'s own already-shipped `relToRow` (t2133, for VALUE fields) and `crossAimHandle`'s own already-
shipped `relToRow` → `anchor.relToRow` (t2583, for a DIFFERENT gesture kind). No new primitive — closing a
gap in an existing one.

- **Block face:** `point_handle` gains `relToRow` (must-match picker, naming a `simstart` block's own `id`
  in this stack — same picker convention `formfield`'s own `relToRow` already uses).
- **What `deriveBindings`/`handleBindingsFromStack` does:** `handleBindingsFromStack`'s own point_handle
  branch (userOps.js) adds `relToRow: p.relToRow || ''` onto the built `anchor` object (one field, same
  shape `crossAim`'s branch already carries).
- **What `panelTypes.js` does:** the `anchor.kind==='point'` branch (line ~475) gains the SAME
  `resolveRelToIndex`/`panelStarts` resolution `crossAim`'s own branch already has (lines ~658-676) —
  literally portable, not new logic. What is NOT portable without separate work: the pinned-wall
  write-back (`_writeParam` on a datum-pinned destination) and the dog-leg runtime-end anchor shift
  (`passEnds`/`dest.anchorsAtPrev`) — both live ONLY in the older role-tagged fallback branch today, never
  ported to ANY declared anchor kind, `crossAim` included. Closing (c) for the POSITION half is a genuinely
  small, low-risk port; closing it for corner's OWN full behavior (write-back + dog-leg) needs that
  separately verified first — named, not attempted, this turn (see `cornerData.js`'s own t2675 comment).
- **What corner's own JS would translate to:** `cross1_x`/`cross1_y`'s own spec rows drop `group`/`role`
  (those come from the handle block instead); a `point_handle` block in `feature_canvas`'s mouth:
  `{fx:'cross1_x', fy:'cross1_y', relToRow:'wall1'}`. A second, `when`-gated (via the SAME mechanism
  proposal (b) reuses) `point_handle` for `startX`/`startY`: `{fx:'startX', fy:'startY',
  relToRow:'zsurf'}` — its own `when` inherited from the value binding it merges onto (unchanged), not
  declared on the handle itself.
- **What it CANNOT express (yet):** the write-back/dog-leg behavior above — a real, separate gap even once
  `relToRow` itself ships.

### Recommended order, if this arc continues

**(c) first** — smallest, has a working precedent (`crossAim`) to copy from, and the position-only half is
verifiable in isolation before touching corner's own write-back/dog-leg complexity. **(a) second** — the
highest-leverage (7 ops), self-contained (a resolver + one exported corner-math function), no interaction
with (b) or (c). **(b) third** — smallest ops-count (1), and the "multiple candidates per role" render-loop
change is the most invasive of the three (touches the shared group-building loop every op's handles run
through, so needs the widest regression check). (d) — slot's compound anchor — stays out of scope until a
second op actually needs a multi-field-single-delta gesture (rule of three), matching its own original
deferral.
When you click "Configure UI" on a `coordlist` block, the system simply pops open a modal and mounts the exact same `coordListSvg` component you'd see in the Wizard tab. You interact with it exactly the same way, and when you close the modal, the component serializes its state back into the block. One UI component, two purposes!
