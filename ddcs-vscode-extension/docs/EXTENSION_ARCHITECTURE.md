# DDCS Studio VS Code Extension: Comprehensive Architecture

> [!NOTE]
> This document provides an extensive architectural blueprint for the `ddcs-vscode-extension`. It covers the system topology, communication protocols, VS Code API touchpoints, and distribution strategies necessary to successfully port DDCS Studio into a VS Code environment while maintaining a shared codebase with the standalone `.exe`.

---

## 1. System Overview & The Monorepo Strategy

To avoid maintaining two separate codebases (one for the standalone app and one for the extension), the project relies on **Strict Decoupling**.

1. **`core/` (Python):** Headless backend for hardware communication, CAM parsing, and heavy logic.
2. **`web-ui/` (HTML/JS/Blockly):** The frontend visual layer. It has no direct file-system or hardware access.
3. **`ddcs-vscode-extension/` (TypeScript):** The VS Code wrapper. It mounts the `web-ui` inside VS Code panels and spawns the `core` process.

---

## 2. Component Topology & Responsibilities

### 2.1 The Extension Host (TypeScript / Node.js)
The Extension Host is the "brain" of the extension. It runs in VS Code's background Node.js process and has full access to the local file system and VS Code APIs.

**Responsibilities:**
- **Activation:** Listens for `Activation Events` (e.g., user opens a `.ddcs` file, or clicks a command in the palette) to wake up the extension.
- **Process Management:** Spawns the Python core backend as a child process when activated, and ensures it is safely killed when VS Code closes.
- **State Routing:** Acts as a message broker between the sandboxed Webviews and the Python backend.
- **Native Integration:** Handles file Save/Open dialogs, notifications, and reads user preferences from VS Code settings.

### 2.2 The Custom UI (Webviews & Custom Editors)
Webviews are essentially `iframes` running inside VS Code. They are heavily sandboxed for security.

**Touchpoints:**
- **CustomEditors (Implemented):** A specific type of WebviewPanel natively tied to a VS Code `TextDocument`. We have registered a Custom Editor for `.nc` and `.ddcs` files. Double-clicking one of these files automatically opens it in our DDCS Blockly UI instead of as raw text. This provides built-in two-way synchronization: edits in the Blockly UI update the hidden text document, and direct text edits update the Blockly canvas.
- **WebviewPanels:** Main editor tabs for things that aren't tied to a specific text file (e.g., a standalone wizard launcher).
- **WebviewViews:** Sidebar panels (Activity Bar). Ideal for a persistent "Machine Status" or "Toolbox" view.

### 2.3 The Core Backend (Python Bridge)
The Python backend handles the actual machine logic, g-code generation, and serial communication.

**Integration Strategy:**
- Runs completely headless.
- Does not import any UI libraries (no PyQt, no Tkinter).

---

## 3. Communication Protocols

Because the UI is sandboxed and the backend is an external process, communication is critical.

### Webview ↔ Extension Host (The Frontend Link)
- **Mechanism:** Asynchronous Message Passing.
- **API:** Inside the Webview, you call `vscode.postMessage({ command: 'generate_gcode', data: blocks })`.
- **API:** Inside the Host, you listen via `panel.webview.onDidReceiveMessage(...)`.

### Extension Host ↔ Python Backend (The Backend Link)
There are two primary ways to handle this:
1. **Standard I/O (stdio):** The Extension Host spawns Python and writes JSON strings to `stdin`, reading responses from `stdout`. This is lightweight but can be tricky if Python prints random logs that break the JSON parser.
2. **Local Server (Highly Recommended):** The Python process boots up a lightweight local WebSocket or HTTP server (e.g., `localhost:8080`). The Extension Host connects to it.
   - *Why WebSocket?* CNC machines stream real-time position data (DRO). WebSockets handle high-frequency, bidirectional streams much better than standard HTTP or stdio.

### The Full Data Flow
```mermaid
sequenceDiagram
    participant WebUI as Blockly Webview
    participant Host as Extension Host (TS)
    participant Py as Python Bridge (Local WS)
    participant CNC as DDCS Controller
    
    WebUI->>Host: postMessage({cmd: "JOG_X", val: 10})
    Host->>Py: WebSocket SEND {"action": "JOG", "axis": "X"}
    Py->>CNC: Serial / USB Packet
    CNC-->>Py: ACK / New Position
    Py-->>Host: WebSocket RECEIVE {"pos": {"X": 10.0}}
    Host-->>WebUI: postMessage({type: "DRO_UPDATE", X: 10.0})
```

---

## 4. Distributing the Python Backend

A major challenge with VS Code extensions is ensuring users have the right dependencies. You cannot guarantee a user has Python 3.10+ or `pyserial` installed.

### Approach A: The "Bring Your Own Python" Method
- The extension finds the user's local Python installation using the official VS Code Python API.
- It creates a virtual environment (`.venv`) and runs `pip install -r requirements.txt` on first launch.
- *Pros:* Small extension file size.
- *Cons:* Prone to failure if the user's local Python setup is broken or missing.

### Approach B: The "Bundled Executable" Method (Recommended)
- During your build process, you use `PyInstaller` to compile the Python backend into standalone executables (e.g., `bridge-win.exe`, `bridge-mac`).
- You bundle the executable directly inside the `.vsix` extension package.
- *Pros:* "It just works." Zero setup for the end-user. Extremely reliable for machine shops and non-developers.
- *Cons:* Larger download size. You must publish Platform-Specific Extensions (e.g., one VSIX for Windows, one for Mac, one for Linux).

---

## 5. Development Workflow

To work on this extension effectively, you need to run two things at once:
1. **The Extension Debugger:** Pressing `F5` in VS Code compiles your TypeScript and launches a new "Extension Development Host" window.
2. **The Web UI Server (Optional but helpful):** Instead of copying HTML files every time you make a change to the CSS, during development the Extension Host can load `http://localhost:3000` (a Vite/React/Vanilla dev server running your `web-ui` code) so you get Hot Module Replacement (HMR) right inside the VS Code tab.

---

## 6. Implementation Roadmap

### Phase 1: Boilerplate & Prototyping
- [ ] Run `npx yo code` to generate the TypeScript boilerplate.
- [ ] Create a basic `WebviewPanel` that simply loads an `<iframe>` of the existing DDCS Studio web app running locally to prove it works.

### Phase 2: Decoupling & The Build Step
- `[x]` Update the `DDCS-Studio/web` code to check if it is running inside VS Code (`acquireVsCodeApi()`) or in a browser, and route its API calls accordingly.
- `[x]` Create an `esbuild` script that automatically bundles the shared `web` ES6 modules into the extension's `dist/` directory, resolving CORS and Sandbox restrictions natively.

### Phase 3: The Headless Bridge
- [ ] Strip all GUI code from `fairy_gateway.py`.
- [ ] Implement a WebSocket server in the Python bridge to listen for commands and broadcast machine state.
- [ ] Write TypeScript logic in the Extension Host to automatically spawn the Python executable on startup.

### Phase 4: Native VS Code Integration
- `[x]` Register a `CustomEditorProvider` so `.nc` and `.ddcs` project files open directly into the Blockly interface, offering real-time two-way sync with the generated G-code.
- [ ] Add VS Code settings (`contributes.configuration` in `package.json`) so users can configure COM ports natively in VS Code's settings UI.
- [ ] Package via `vsce` for distribution.

---

## 7. UI Module Sharing Strategy (Prototype vs Production)

A core goal of this extension is to minimize copying backend and frontend logic from the `DDCS-Studio/web` directory.

### The Sandbox Prototype (Completed)
During initial rapid prototyping, Python scripts were used to aggressively extract HTML blocks and JS logic. This was done strictly to prove the VS Code Webview UX layout without fighting module load paths.

### The Production Target (True Module Sharing - Implemented)
In the production architecture, `extension_index.html` remains a stripped-down skeleton. 
All UI components, blocks, and parsers are loaded natively from the shared folder via an `esbuild` bundling process.

**Current Production Entrypoint (`extensionApp.js`):**
```javascript
// Natively load definitions from the standalone app! No copying!
import { OP_BLOCKS } from '../../DDCS-Studio/web/blocks/blockly/bridge.js';
import { initBlocks } from '../../DDCS-Studio/web/blocks/blocksApp.js';
import { wizardManager } from '../../DDCS-Studio/web/wizardManager.js';

// Boot the UI using shared logic
Blockly.defineBlocksWithJsonArray(OP_BLOCKS);
```
This ensures that any time a new wizard or CNC block is added to the standalone DDCS Studio app, the VS Code extension inherits it automatically on the next build with zero code duplication.
