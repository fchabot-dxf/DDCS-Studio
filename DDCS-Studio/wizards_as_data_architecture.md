# Wizard Audit: Composable Authoring (Atoms)

This report details exactly which parts of the built-in wizards are fully "built as atoms" (blocks) today, and which parts are still hardcoded in JavaScript (and therefore lost when you save a custom wizard).

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
When you click "Configure UI" on a `coordlist` block, the system simply pops open a modal and mounts the exact same `coordListSvg` component you'd see in the Wizard tab. You interact with it exactly the same way, and when you close the modal, the component serializes its state back into the block. One UI component, two purposes!
