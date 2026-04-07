# DDCS Studio - Modular ES6 Edition

Version 9.49 - Modularized for AI Agent Development

## Overview

DDCS Studio is a web-based G-code generator for CNC operations using the DDCS Expert M350 controller. This modular version breaks down the monolithic HTML file into clean ES6 modules for easier AI-assisted development and maintenance.

## Module Structure

```
ddcs-studio-modular/
├── app.js                 # Main application entry point
├── themes.js              # Theme engine and management
├── scaleManager.js        # Viewport scaling and zoom
├── variableDB.js          # DDCS variable database management
├── editorManager.js       # G-code editor functionality
├── searchManager.js       # Variable search and filtering
├── wizardManager.js       # Wizard dialog coordinator
├── uiUtils.js            # DOM helpers and utilities
├── snippets.js           # Pre-defined G-code templates
├── wizards/
│   ├── cornerWizard.js   # Corner probe wizard
│   ├── middleWizard.js   # Middle finder wizard
│   ├── edgeWizard.js     # Edge finder wizard
│   ├── communicationWizard.js  # Controller communication
│   └── wcsWizard.js      # WCS zeroing wizard
└── package.json          # Package metadata
```

## Module Descriptions

### Core Modules

#### `app.js`
Main application orchestrator. Initializes all managers and coordinates the application lifecycle.
- Creates instances of all manager classes
- Sets up global function bindings for HTML compatibility
- Initializes event listeners
- Handles application startup

#### `themes.js`
Theme engine supporting 5 visual styles:
- DDCS (default - matches real M350 controller)
- Normal (modern flat UI)
- Steampunk (industrial aesthetic)
- Futuristic (sci-fi blue theme)
- Organic (natural green theme)

**Key Class:** `ThemeManager`
- `toggle()` - Cycle through themes
- `setCurrent(themeName)` - Set specific theme
- `getCurrent()` - Get active theme name

#### `scaleManager.js`
Viewport scaling for different screen sizes.

**Key Class:** `ScaleManager`
- `toggle()` - Cycle through scale presets
- `apply()` - Apply current scale
- Scale sequence: 100%, auto, 150%, 200%, 50%, 75%

#### `variableDB.js`
Manages DDCS M350 system and user variable catalog.

**Key Class:** `VariableDatabase`
- `loadFromCSV(fileContent)` - Import variable definitions
- `search(searchTerm)` - Search variables
- `saveToStorage()` - Persist to localStorage
- Handles both system (#500-#999) and user (#100-#499) variables

#### `editorManager.js`
Main G-code text editor functionality.

**Key Class:** `EditorManager`
- `insert(key, text)` - Insert text at cursor
- `copyCode()` - Copy editor content
- `clearCode()` - Clear editor with confirmation
- `downloadFile()` - Download as .nc file
- Handles backspace button with repeat

#### `searchManager.js`
Variable search sidebar with live filtering.

**Key Class:** `SearchManager`
- `renderResults(term)` - Display search matches
- `clear()` - Reset search
- Multi-term AND search support
- Integrates with VariableDatabase

#### `wizardManager.js`
Coordinates all wizard dialogs and G-code generation.

**Key Class:** `WizardManager`
- `open(type)` - Open specific wizard
- `openCorner()` - Open corner probe wizard
- `openMiddle()` - Open middle finder wizard
- `openEdge()` - Open edge finder wizard
- `update()` - Update active wizard preview
- `insert()` - Insert generated code into editor

#### `uiUtils.js`
Shared UI utilities and DOM helpers.

**Key Functions:**
- `el(id)` - Get element by ID (shorthand)
- `UIUtils.showTooltip()` - Display tooltip
- `UIUtils.hideTooltip()` - Hide tooltip
- `UIUtils.insertAtCursor()` - Insert text at cursor position
- `UIUtils.downloadFile()` - Trigger file download

#### `snippets.js`
Pre-defined G-code templates.

**Available Snippets:**
- `safe_z` - Safe Z retract using G53
- `probe` - Basic probe template with error handling
- `wash` - Variable washing template (+0)

### Wizard Modules

#### `wizards/cornerWizard.js`
Generates comprehensive corner probing sequences.

**Key Class:** `CornerWizard`
- `generate(params)` - Generate complete corner probe G-code
- Supports all 4 corners (FL, FR, BL, BR)
- Optional Z surface probing
- Configurable probe sequence (YX or XY)
- Dual gantry synchronization support
- WCS-aware (G54-G59 or active)

**Features:**
- Fast/slow two-stage probing
- Automatic direction calculation
- DDCS M350 variable washing
- Incremental motion pattern
- Error handling with GOTO labels

#### `wizards/middleWizard.js`
Generates middle-finding sequences for centering on features.

**Key Class:** `MiddleWizard`
- `generate(params)` - Generate complete middle-finding G-code
- Supports both pockets (inside) and bosses (outside)
- X or Y axis selection
- Configurable first probe direction
- WCS-aware (G54-G59 or active)
- Dual gantry sync for Y axis

**Features:**
- Two-edge probing with automatic center calculation
- Pocket mode: probes outward from center
- Boss mode: probes inward from outside with manual jog step
- Result storage in #51, #52, #53 variables
- Use `#1505` confirm prompts between probe stages (generators no longer emit `M0`)

#### `wizards/edgeWizard.js`
Generates single-edge probing sequences.

**Key Class:** `EdgeWizard`
- `generate(params)` - Generate complete edge probe G-code
- Simple single-edge detection
- X or Y axis selection
- Positive or negative direction
- WCS-aware (G54-G59 or active)

**Features:**
- Fast/slow two-stage probing
- Single edge to WCS offset
- Minimal, focused operation
- Perfect for quick edge finding

#### `wizards/communicationWizard.js`
Generates controller communication and UI interaction code.

**Key Class:** `CommunicationWizard`
- `generate(params)` - Generate communication G-code
- Multiple communication types:
  - **Popup**: Display message with M0 pause
  - **Status**: Update status bar
  - **Input**: Numeric input dialog (DDCS-safe #50-#499)
  - **Beep**: System beep
  - **Alarm**: Trigger alarm with message
  - **Dwell**: G4 pause
  - **KeyWait**: Wait for keypress
- Data slot support (#1510-#1513)

**Features:**
- User feedback and interaction
- DDCS M350 compliant variable usage
- Customizable popup modes
- Safe numeric input handling

#### `wizards/wcsWizard.js`
Generates WCS (Work Coordinate System) zeroing code.

**Key Class:** `WCSWizard`
- `generate(params)` - Generate WCS zeroing G-code
- Auto-detect active WCS or specify G54-G59
- Individual axis selection (X, Y, Z, A)
- Dual gantry synchronization
- DDCS M350 compliant (direct #805+ writes, NO G10)

**Features:**
- Zero any combination of axes
- Auto-detect which WCS is active
- Support for all G54-G59 coordinate systems
- Dual gantry A/B axis sync
- Direct memory writes (G10 not used)

#### `wizards/alignmentWizard.js`
Generates axis/fence alignment verification sequences.

**Key Class:** `AlignmentWizard`
- `generate(params)` - Produce G-code to probe two points along a fence and
  compute angular misalignment.
- Supports 1‑axis and 2‑axis modes.
- Parameters include check axis, probe directions, safe Z, tolerance, feed rates,
  probe port/level/stop.

**Features:**
- Two‑leg probing with incremental math.
- Automatic delta/angle calculation using ATAN.
- Designed for fence/axis alignment checks.

## Usage for AI Agents

### Adding a New Theme

Edit `themes.js`:
```javascript
// Add to THEMES array
export const THEMES = ['ddcs', 'normal', 'steampunk', 'futuristic', 'organic', 'mynewtheme'];
```

Add CSS in the main HTML file's `<style>` section:
```css
body[data-theme="mynewtheme"] {
    --bg: #yourcolor;
    --panel: #yourcolor;
    /* ... */
}
```

### Modifying Corner Wizard Logic

Edit `wizards/cornerWizard.js`:
- `generateYXSequence()` - Modify Y-first probe sequence
- `generateXYSequence()` - Modify X-first probe sequence
- `generateHeader()` - Change comment headers
- `generateFooter()` - Modify success/error handling

### Adding New Snippets

Edit `snippets.js`:
```javascript
export const SNIPPETS = {
    existing_snippet: `...`,
    my_new_snippet: `( My Custom G-code )\nG0 Z10\nM30`
};
```

### Implementing Middle/Edge Wizards

Create new wizard class following `cornerWizard.js` pattern:
```javascript
export class MiddleWizard {
    generate(params) {
        // Generate G-code
        return gcode;
    }
}
```

Import in `wizardManager.js`:
```javascript
import { MiddleWizard } from './wizards/middleWizard.js';
```

Update `WizardManager.updateMiddleWizard()` method.

## Integration with HTML

The HTML file should import the main module:
```html
<script type="module" src="app.js"></script>
```

SVG visualizations remain in the HTML file and are referenced by the wizard modules through DOM manipulation.

## Key Design Patterns

1. **Manager Classes**: Each major feature has a manager class (ThemeManager, ScaleManager, etc.)
2. **Separation of Concerns**: UI logic separate from G-code generation
3. **ES6 Modules**: Clean imports/exports for dependency management
4. **Global Function Binding**: Maintains compatibility with existing HTML onclick handlers
5. **Event-Driven**: Listeners for user interactions and wizard updates

## Benefits of Modular Structure

✅ **Easier AI Editing**: AI can focus on one module at a time
✅ **Better Code Organization**: Related functionality grouped together
✅ **Simpler Testing**: Individual modules can be tested in isolation
✅ **Clearer Dependencies**: Import statements show relationships
✅ **Reduced Complexity**: Each file has single responsibility
✅ **Version Control**: Easier to track changes per feature

## Development Workflow

1. **Edit specific module** based on feature area
2. **Test in browser** with ES6 module support
3. **Check console** for import errors
4. **Verify functionality** of affected features
5. **Update README** if adding new modules

### SVG Gradient Namespacing

- Gradient IDs in `src/assets/svg/*.svg` are automatically namespaced by filename before bundling.
- Build path already runs this step via `prebundle`.
- Manual run (after Affinity export, before quick browser checks):

```bash
npm run svg:rename-gradients
```

- Dry run / backup options are available via:

```bash
python "src/assets/svg/rename_gradients.py" --dir "src/assets/svg" --dry-run
python "src/assets/svg/rename_gradients.py" --dir "src/assets/svg" --backup
```

## Browser Compatibility

Requires modern browser with:
- ES6 module support (`<script type="module">`)
- localStorage API
- FileReader API
- Modern CSS (CSS variables, grid, flexbox)

Tested on: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

## Future Enhancements

- [ ] Complete middle wizard implementation
- [ ] Complete edge wizard implementation  
- [ ] Add TypeScript definitions
- [ ] Create automated tests
- [ ] Add build system for minification
- [ ] Create standalone configuration module
- [ ] Add undo/redo functionality
- [ ] Implement G-code validation

## Notes for AI Agents

- **SVG visualizations** are still embedded in HTML - reference by ID
- **CSS themes** remain in HTML `<style>` tag - controlled by themes.js
- **Global functions** must be bound in `app.js` for HTML onclick compatibility
- **Variable washing** (#var = +0) is DDCS M350 specific requirement
- **Incremental mode** (G91) is preferred for DDCS M350 probe sequences

## Deployment — Cloudflare Pages (wrangler) 🔧

This repository supports easy deployment to **Cloudflare Pages** (recommended) by publishing the built `output/` directory.

**Source of truth:** all deployment paths must target `output/` (never `src/`) so the standalone HTML and generated `.nc` files are included.

### Automatic (recommended): GitHub Actions → Cloudflare Pages ✅

- I added a workflow at `.github/workflows/deploy-pages.yml` that can publish `output/` on push to `main`/`master`/`release/**`.
- Required repository secrets (set in GitHub > Settings > Secrets):
  - `CF_PAGES_API_TOKEN` — a Pages API Token (scoped for Pages deployment)
  - `CF_ACCOUNT_ID` — your Cloudflare account id
- The workflow uses project name `ddcsexpertstudio` and should publish the `output/` directory.

Example: push to `main` → GitHub Actions deploys to your Pages project.

### Auto-loading a site-level user variable table ✅

You can ship a site-wide variable table that automatically loads for *new visitors* by adding `src/user_vars.csv`.
- Format: same CSV format as `Variables-ENG 01-04-2025.csv` (no header required).  
- Behavior: on first load (when no saved DB in browser storage) the app will load `default_vars.js` (system vars) **and then** merge `user_vars.csv` as user variables.
- To include your personal table in the published site, replace `src/user_vars.csv` with your CSV — it will be merged at startup for fresh visitors.

### Local (one-off) using `wrangler` 🖥️

If you prefer to publish locally with Wrangler (you mentioned using it), run:

```bash
# install wrangler if you don't have it
npm i -g wrangler

# login (opens browser)
wrangler login

# publish the built site (output/)
wrangler pages deploy ./output --project-name=ddcsexpertstudio
```

You can also run the convenience npm script:

```bash
npm run deploy:pages
```

Node helper script (no extra CI action required)

```bash
# run the Node helper (wrangler must be installed or available via npx)
node scripts/publish-pages.cjs --dir=./output --project-name=ddcsexpertstudio

# or using the npm convenience script
npm run publish:pages-node

# optionally build before publish
node scripts/publish-pages.cjs --build --dir=./output --project-name=ddcsexpertstudio
```

### Build artifact details

- Build first: `npm run build` (produces `output/ddcs-studio-standalone.html` and generated `.nc` files under `output/*`).
- Publish `output/` with either the GitHub workflow or locally:

```bash
wrangler pages deploy ./output --project-name=ddcsexpertstudio
```

---

## License

MIT - Free to use and modify
