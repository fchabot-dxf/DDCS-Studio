# The "Wizards-as-Data" Transition Plan (Composable Authoring)

> ## ⭐ STATUS — 2026-08-21. NOT DONE. And this document was UNTRACKED until today.
>
> The branch has been named `wizards-as-data-blocks` for months while carrying everything else — releases,
> the vendor-pack fixes, the sound system, theme work. That made it easy to assume the project had shipped.
> **It has not**, and the spec you are reading was never committed, so nothing could be checked against it.
>
> ### THE DONE-CONDITION, in the owner's words (2026-08-21)
> > *"I'm not rigid on the edit-a-built-in speech. What I want is **full reproducibility of a built-in by
> > blocks** … this has a lot to do with the **visual of the form and preview** — can we make it look like a
> > built-in too."*
>
> ⇒ **The test is not "can a user edit a built-in".** It is:
>
> > **For every built-in wizard, a block stack exists that reproduces it INDISTINGUISHABLY — form widgets,
> > section order, gating, and preview — not merely the same parameters and the same emitted G-code.**
>
> ⭐ That is a **pass/fail per wizard**, which makes the remaining work countable instead of a feeling.
> ⚠ Note this is not a new bar: *Verification Strategy* §2 below already demanded "the form still renders
> identically to its legacy state (no visual regressions)". The bar was set here and never measured.
>
> ### What is measured so far
> - **38** data twins exist in `DDCS-Studio/web/blocks/dataOps/`.
> - **26 of 38 declare a `widget:`.** The other **12 do not** — they fall through to whatever the default
>   renderer picks, so their visual reproduction cannot be *guaranteed*, only hoped for. Those 12 are the
>   first rows of the backlog.
> - The declaration vocabulary is genuinely rich where it is used — `cornerData.js` alone carries
>   `widget: 'plane-suggest' | 'segmented' | 'action'`, `widgetConfig.options`, `section`, `when`,
>   `optionGate`, `tokenRefusal`, `help`. **The language is not the bottleneck; per-wizard completeness is.**
>
> ### ⛔ What "done" does NOT mean
> - Not "has a data twin" — that is cheap and nearly universal.
> - Not "emits the same G-code" — `generate()` IS the block stack, so emit fidelity was largely free.
> - **A twin that produces correct G-code behind a form that looks wrong FAILS this bar.**
>
> ### ⚠ How to verify — pixels, not declarations
> A declaration audit will happily pass a wizard that renders wrong. Verification is: **render the built-in
> and its block-built reproduction side by side and compare them.** Same standing rule as every wizard
> review here — look at the full surface, form and panels.

> ## ⭐⭐ MEASURED 2026-08-22 — and WHY the first attempt failed
>
> A 6-area survey (80 agents, adversarially verified) measured the actual state. It is worse than "partly
> done", and the reason is specific and fixable.
>
> ### The numbers
> | claim | state |
> |---|---|
> | (a) every built-in HAS a data twin | ✅ **25 of 25**, 0 orphans |
> | (b) the twin carries its LAYOUT as blocks | ⛔ **0 of 32** |
> | (c) reproducible by blocks | ⛔ falls with (b) |
>
> **Not one twin authors a single `formfield` block.** All 32 declare a `param_group` whose `children` array
> is **empty**. Field identity, label, widget, help, order and section still live in hand-written JS arrays
> (`*_BINDING_SPECS`). Plan Phase 1 step 3 — *"delete the `def.bindingSpecs` assignment"* — was never done on
> **any** wizard, including all four named pilots.
>
> ⚠ **68 of 399 declared fields (17%) exist ONLY in JS, with no block at all.** Section ORDER is hardcoded in
> imperative render code. Both are outright blockers for visual reproducibility.
>
> ### ⛔ The data flow was INVERTED, not executed
> ```
>   PLAN:     author formfield blocks -> delete bindingSpecs -> deriveBindings scans the canvas
>   SHIPPED:  JS arrays -> materializeParamGroup auto-generates param_field blocks FROM them
> ```
> Blocks are *generated from* the hardcoded specs rather than being their source. `param_field` is not the
> plan's `formfield` — it is presentation-only with no socket link, so it cannot bind, gate or carry
> structure. `renderUiTree`, the layout-as-blocks renderer, is **unreachable for every built-in**.
>
> ### ⭐ WHY THE PORT FAILED — the part that matters
> The branch is named after a port that was **made and reverted**. Reflog: `802e03e8` *"Port Corner Wizard to
> Wizards-as-Data architecture"* (2026-08-04) → `reset` to `be8ea255` (2026-08-05). WORK-LOG t1559:
> *"Diagnose **broken Corner wizard / missing preview drag handles & collapse buttons**, revert broken agent
> commits."*
>
> ⭐⭐ **It failed because the block vocabulary is a STRICT SUBSET of the spec vocabulary.** `formfield`
> declares `param label type section help widget options units key optional`. The specs also carry:
>
> | attribute | what it does | in any block? |
> |---|---|---|
> | `relTo: { row: 'wall1' }` | which sim row the drag handle anchors to | ⛔ **0 of 4** block-def files |
> | `role: 'x' \| 'y'` | which half of the handle this field is | ⛔ **0 of 4** |
> | `group: 'reposition'` | which handle the pair belongs to | ⛔ **0 of 4** |
> | `formHidden: true` | "this is NOT a visible form input" | ⛔ **0 of 4** |
> | `match: { type:'assign', var:'#23' }` | binds the field to its emitted `#var` | ◐ 2 of 4 |
>
> Corner's `cross1_x` / `cross1_y` / `startX` / `startY` are **not form inputs at all** — they are hidden
> fields whose only job is to place draggable handles on the preview. Port the specs to `formfield` and all
> five attributes are dropped ⇒ **the handles vanish.** Exactly the reported symptom.
>
> ⚠ **The 2026-08-05 recovery built the wrong axis.** It responded by adding `split_horizontal`/`split_vertical`
> and 13 container blocks — *layout* vocabulary. Useful, and Phase 0 is genuinely done because of it. But the
> blocker was never how fields are ARRANGED; it is that **a field cannot declare that it isn't a field.**
>
> ### ⭐ THE FIRST TASK — and it is not "port Corner"
> ```
>   1. extend `formfield` with formHidden + the relTo/role/group triple (and finish `match`)
>   2. REUSE the existing gate machinery for when/optionGate — do NOT invent new ones
>   3. THEN port Corner
>   4. prove the drag handles survive — that is the pass/fail
> ```
> ⭐ Step 2 matters: `gate:` (27 files), `when:` (16), `optionGate` (4) and `clearWhenOff` (2) already exist
> with a live consumer at `wizards/views/userOpView.js:514`. Three of the seven "missing" attributes need no
> invention at all. See BACKLOG "GATE CONSOLIDATION" — the eight-mechanism inventory is why these should be
> shaped as DATA rather than as more special cases.

## Background & The "One Source of Truth" Problem

Historically, DDCS Studio's built-in wizards (e.g., Corner Probe, Pocket) were defined in two separate halves:
1. **The Execution (G-code atoms):** These were represented as blocks on the canvas (e.g. Move, Probe, Assign).
2. **The Presentation (Form Layout & Previews):** These were **hardcoded in JavaScript arrays** (specifically, `bindingSpecs` and `simStarts`). 

Because the layout data was never represented as blocks on the canvas:
- Users could not see or edit the layout visually when they customized a wizard in the Blocks tab.
- When a user clicked "Save Custom Wizard", the hardcoded specs were stripped away, forcing the user to pick a generic layout from the Save dialog dropdowns instead of inheriting the built-in wizard's complex, carefully crafted form.

## The Goal: Composable Authoring

We are migrating the layout data directly into the wizard's block template. The layout will become an explicit tree of blocks on the canvas:
- `panel panel`: Defines the overall layout (e.g., `form3d`, `form2d`).
- `preview rig`: Defines the 3D rig (e.g., `rotary`, `machine`).
- `param_group`: Acts as a container for all the form inputs.
- `formfield` / `layoutwidget`: Individual blocks nested inside the `param_group` that define each input, its default value, its label, and its tooltip.

**Once every form field is authored as a block, the wizard's layout becomes 100% lossless.**
When a user opens a built-in wizard, they see its entire layout on the canvas, and a block stack built from
that layout reproduces the wizard indistinguishably — form, gating and preview included.

> ### ⛔ CUT 2026-08-21 — "editing a built-in in place" is NOT a goal
> This paragraph used to end *"when they **edit it** and save it as a custom wizard…"*. The owner removed
> that: *"we can remove the edit built in goal."*
>
> **Built-ins do not need to be editable.** Fork-to-custom is a perfectly good path, and whether a built-in
> is read-only is now irrelevant to whether this project is finished. ⚠ Do not reintroduce it as a
> stretch goal — it drags work toward an editing UX that nobody asked for and that the done-condition does
> not measure.
>
> What survives is the half that mattered: **the layout must travel losslessly**, so that what you fork
> into can express everything the original did.

---

## Execution Plan: Porting the Pilots

To complete this transition, we must port the remaining legacy wizards. We will use **Corner Probe** as our initial pilot, followed by **Edge**, **Middle**, and **Pocket**.

### Phase 0: Building the Foundational Simple Blocks
Before we tackle any complex modals, we will build a set of simple, standard Blockly blocks that require zero UI engineering but are crucial for the architecture:
1. **`split_horizontal` and `split_vertical` blocks:** Standard blocks with a `Ratio` dropdown and a statement mouth. These enable composable, responsive Flexbox wizard layouts.
2. **`structural_guard` block:** A logic block with two text fields (`Variable Name` and `Value`) and a statement mouth. Any blocks placed inside are pruned if the variable doesn't match the value (solving Corner's Auto vs Manual shape-shifting).
*(Note: We don't need to build `dropdown` or `checkbox` blocks, as the existing `formfield` block dynamically exposes `options` fields when configured!)*

### Phase 1: Porting a Wizard (e.g., Corner Probe)

**1. Translate `bindingSpecs` to `formfield` Blocks**
Locate the hardcoded JavaScript array (`CORNER_BINDING_SPECS` in `cornerData.js`) and translate every single field into a `formfield` block representation.
- **Value Fields:** Fields that map to G-code variables (e.g., `dist`, `radius`, `safeZ`) will become `formfield` blocks that explicitly bind to their target `#var` identities (`match: { var: '...' }`).
- **Structural Fields:** Fields that change the shape of the program (e.g., `corner`, `travelApproach`) will be mapped as structurally-bound fields.

**2. Populate the Block Template (`cornerDataStack`)**
Update `cornerDataStack` to inject these new `formfield` blocks directly into the `children` array of the `param_group` block. Ensure the `panel` and `sim` blocks accurately reflect the wizard's needs.

```javascript
// Example transformation inside cornerDataStack:
const paramGroup = { 
    type: 'param_group', 
    params: { group: 'Corner' }, 
    children: [
        { type: 'formfield', params: { param: 'safeZ', label: 'Safe Z', default: 10, ... } },
        { type: 'formfield', params: { param: 'dist', label: 'Probe Dist', default: 50, ... } },
        // ... all other specs ported here
    ] 
};
```

**3. Remove the Hardcoded `bindingSpecs`**
Delete the `def.bindingSpecs = CORNER_BINDING_SPECS` assignment from the wizard's registration. The engine's `deriveBindings` function will now automatically scan the canvas, find the `formfield` blocks, and build the form natively.

### Phase 2: Deprecating the Save Dialog Layout Options

Once ALL built-in wizards have been ported to use `param_group` and `formfield` blocks, the generic "Panel Layout" and "Preview Rig" dropdowns in the Save Wizard dialog will become obsolete. 

Because the blocks themselves will serve as the single source of truth for the layout, the Save Wizard dialog should be simplified to **only** ask for the Wizard Name.

---

## Verification Strategy

When a wizard is successfully ported, we will verify it by:
1. **Visual Canvas Check:** Opening the built-in wizard in the Blocks tab and confirming the `Parameter Group` block is fully populated with all inputs right on the canvas.
2. **Form Rendering Check:** Checking the "Wizard" tab in Studio to ensure the form still renders identically to its legacy state (no visual regressions).
3. **Lossless Customization Check:** Clicking the "Custom Wizard" save button from the Blocks tab and ensuring the saved `.wiz` file perfectly retains the exact layout configuration without losing any tabs or tooltips.
