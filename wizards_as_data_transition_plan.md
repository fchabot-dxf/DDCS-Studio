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
When a user opens a built-in wizard, they will see the entire layout on the canvas. When they edit it and save it as a custom wizard, the layout blocks travel with it, perfectly preserving the structure.

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
