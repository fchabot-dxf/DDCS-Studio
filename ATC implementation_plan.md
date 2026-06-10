# Implementation Plan: Wizard Toolbar Reorganization & ATC Tool Length Wizard

Based on your feedback, we'll reorganize the wizard bar to support dropdown menus, grouping related wizards together. Then, we will build the highly useful **Tool Length Setter Wizard** as our first ATC-related macro generator.

## Proposed Changes

### 1. Toolbar Reorganization (`src/commandDeck.js` & `src/styles.css`)
- **CSS Dropdown System:** Create a new CSS-only or simple JS dropdown component for the top `.header-center` toolbar.
- **Probe Group:** Bundle the existing `📐 Corner`, `🎯 Middle`, `📏 Edge`, and `🧭 Align` buttons into a single **"🎯 Probe"** dropdown menu.
- **ATC Group:** Create a new **"🔄 ATC"** dropdown menu.
  - Add the new **"📏 Tool Length"** wizard.
  - (Placeholder) **"⚙️ Carousel Align"**
  - (Placeholder) **"🔥 Warm-up"**

### 2. Tool Length Wizard UI (`src/index.html`)
- Add a new `<div id="wiz_atc_length" class="wiz-body">` panel inside the wizard overlay.
- **Inputs:**
  - Fast Plunge Feed & Slow Probe Feed
  - Max Search Distance & Retract Distance
  - Safe Z (Z height to retract to after probing)
  - Probe Input Port (e.g., IN 3) & Trigger Level (0 or 1)
  - Tool Setter Block Height (mm)

### 3. Generator Logic (`src/wizards/atcLengthWizard.js`)
- Create a new wizard generator class that outputs the Tool Setter macro.
- **Macro Sequence:**
  1. Spindle plunges down at Fast Feed until the Tool Setter switch is hit.
  2. Spindle retracts slightly.
  3. Spindle plunges down at Slow Feed for precision touch.
  4. Macro reads the Machine Z Coordinate (`#1927`).
  5. Calculates tool length offset (Machine Z - Block Height) and saves it to the `#H` length registry for the currently active tool.
  6. Spindle retracts back to Safe Z.

### 4. Integration (`src/wizardManager.js` & `src/app.js`)
- Import `AtcLengthWizard` into `WizardManager`.
- Add `openAtcLengthWiz()` and `updateAtcLengthWizard()`.
- Add HTML bindings and route the new button to the wizard logic.

## Verification Plan
1. **Toolbar:** Open the Studio, verify the "Probe" and "ATC" buttons have dropdown menus, and all existing probe wizards still launch correctly.
2. **ATC Wizard:** Click "Tool Length", verify the new UI appears, edit values, and check that the generated G-code properly updates and implements a two-stage plunge and Z-coordinate math calculation.

-----

## Status (Opus 4.8, 2026-06-09)

- **Generator (`src/wizards/atcLengthWizard.js`): built + DDCS-validated.** The two-stage plunge and the
  `MachineZ − BlockHeight → #[1430 + #1300 - 1]` tool-table math match the [CONFIRMED] M350 patterns
  (`#1922`/`#1927` probe status/trigger-Z, `#1300` active tool, `#1430+T-1` tool-length offset). Regenerates
  `valid:true` through the engine's syntax checker.
- **Engine** now sets the active tool on `M6 Tn → #1300`, so this wizard simulates end-to-end instead of
  always hitting "No tool number set."
- **Sibling `atcChangeWizard.js`** rewritten as a **real manual tool change** (stop → park → blocking
  `#1505` prompt → `M30`). The controller dump confirmed this machine has no pneumatic drawbar I/O, so the
  old `M10/M11/M31/M33` digital handshakes (and their UI port fields) were fiction and are removed. Earlier
  priming/label fixes folded in. Tool-setter probe port corrected to **IN02** (`setterPin 4 → 2`).
- Full validation + the (now-resolved) I/O-convention decision live in
  [ATC_INTEGRATION_PLAN.md](DDCS-Studio/docs/ATC_INTEGRATION_PLAN.md).
- **Toolbar reorg / `wiz_atc_length` UI wiring:** not verified in this pass (generator logic only).
