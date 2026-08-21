# Redesigning the "Save Custom Wizard" Modal

Thanks for the feedback! You're completely right—the CAM slot builder (`openCamAuthoring`) is much more spacious, structured, and visually balanced.

We will redesign the Wizard Save Dialog to inherit the design language and spaciousness of the CAM slot builder. Furthermore, we will embed the existing file explorer (the **Library Shelf**) directly into the bottom of this modal so you can see where your wizards are going and manage them without leaving the dialog.

## Proposed Changes

### 1. Adopt the CAM Builder's Layout & Sizing
- **Current Wizard Modal:** 380px wide, centered vertically, cramped padding (`14px 16px`), standard HTML `<select>` elements.
- **Proposed:** Adopt the CAM modal's wider, top-aligned, scrollable layout.
  - Set `width: min(700px, 100%)` (wider than before, giving elements room to breathe).
  - Align it slightly toward the top instead of dead-center so it feels like a primary workspace rather than an alert dialog.
  - Match the `border-radius: 10px` and use `var(--panel)` exactly as the CAM modal does.

### 2. Embed the Library File Explorer with Enriched Cards
To answer your request about categorizing and labeling wizards in the explorer:
- The custom wizard format (`.wiz`) actually saves all its metadata (its display name, its panel category like Form+2D, the number of knobs, etc.).
- Right now, the Library Shelf only shows the filename and a basic "wizard · X fields" label. **We will upgrade this** so that the embedded explorer parses the JSON of these **uninstalled files directly from disk** and displays their rich information (e.g., showing its actual UI label and preview rig type on the card instead of just the raw filename). You will see this rich information without needing to install the wizard first.
- We will embed this upgraded **Library Shelf** directly into the bottom of the Save Wizard modal.
- Alongside the standard "Save" (which saves to your current workspace), we will add a **"Save & Export to Library"** button. This instantly drops a `.wiz` file right into the explorer list below it.

### 3. Load/Import Directly From the Modal
- **Yes! Because we are embedding the Library Shelf, you can use this modal to load/import wizards too!**
- If you click on any `.wiz` card in the embedded explorer, it will import and install that wizard straight into your workspace, completely bypassing the need to open the Settings menu.

### 4. Visual Panel & Rig Selection
Instead of standard dropdowns and checkboxes, we will build out a structured table or grid (similar to the CAM expose/bake table):
- **Panel Layout Choice:** A grid of 4 buttons acting as a segmented control for the form layout (Form Only, Form + 2D, Form + 3D, Form + 2D + 3D).
- **Preview Rig:** A row of prominent toggle buttons or chips (Rotary, Machine Frame, ATC Magazine).

### 5. Unified "Make" Menu (NEW)
As requested, we will unify the "Make" button across the UI so you don't have different authoring buttons scattered across tabs:
- The `＋ Make ▾` dropdown in the Editor tab will be upgraded to include all three options: **CAM slot**, **K-button**, and **Custom Wizard**.
- The `💾 Save wizard…` button in the Blocks tab will be replaced with the exact same `＋ Make ▾` dropdown.
- This creates a single, consistent way to bake your current program/stack into any of the 3 reusable macro formats, regardless of which tab you are currently working in.

## Proposed Implementation Files
### [MODIFY] web/blocks/devMode.js
- Rewrite the HTML payload in `openSaveDialog` to match the new 700px-wide design.
- Import `renderLibraryShelf` and mount it into a new container at the bottom of the dialog.
- Wire up the new **"Save & Export"** button to automatically trigger the `.wiz` export logic and refresh the shelf.
- Wire up the **Import** logic so clicking a card installs the wizard and refreshes the Wizard Bar.
- Rename the Blocks tab's `Save wizard...` button to `＋ Make ▾` and wire it to call the unified menu.

### [MODIFY] web/ui/wizardManagerPanel.js (and devMode.js)
- When calling `renderLibraryShelf` for wizards, update the `describe` callback to parse and display the wizard's `label`, `panel`, and `sim` rig, rather than just the generic "wizard · X fields" text. This will make the file explorer much more descriptive, directly from the uninstalled files on disk.

### [MODIFY] web/ui/globalFunctions.js
- Refactor `window.ddcsEditorMakeMenu` to include the `💾 Custom Wizard` option, wiring it to `window.ddcsSaveAsWizard()`.
- Rename it to `window.ddcsMakeMenu` so it conceptually applies to both the Editor and Blocks tabs.

## Verification Plan
- I will implement the HTML/CSS changes directly inside `devMode.js`, `wizardManagerPanel.js`, and `globalFunctions.js`.
- Provide you with a screenshot of the new modal and the unified dropdown menu.
- Verify that saving to the workspace, exporting to the library, AND importing from the library all function correctly directly from the modal.
