# DDCS Studio VS Code Extension Concept

> [!NOTE]
> This document outlines the idea of migrating or adapting DDCS Studio into a Visual Studio Code Extension as a parallel project. The main goal is to leverage VS Code's robust editor features while maintaining DDCS Studio's custom visual functionality.

## Motivation & Pros

- **Editor Outsourcing:** Eliminates the need to build and maintain a custom text editor. VS Code provides best-in-class syntax highlighting, minimaps, search, and multi-cursor support out of the box.
- **Familiar Ecosystem:** Developers already use VS Code. Integrating into their existing workflow reduces friction and context switching.
- **Interoperability:** Users can leverage other extensions (e.g., Python linters, Git tools, GitHub Copilot) alongside DDCS Studio tools.
- **Webview Capabilities:** Existing visual tools (like the Blockly workspace) can be embedded directly into VS Code tabs using the Webview API.
- **UI Real Estate:** Seamless integration into the Activity Bar, Side Bar, and Command Palette (`Ctrl+Shift+P`).
- **Free to Publish & Host:** It is 100% free to publish and host a VS Code extension on the Microsoft Marketplace. There are no developer fees, and Microsoft handles all download bandwidth.

## Challenges & Cons

- **Architectural Shift:** Moving to a Webview requires asynchronous message passing between the custom UI (DOM) and the extension host (Node.js). This will require refactoring how the app currently communicates.
- **UI Sandbox Constraints:** The UI must adhere to VS Code's structural paradigms. You can't place floating windows anywhere; you must use Tree Views, Webviews, and Status Bar items.
- **Loss of Brand Exclusivity:** The interface will look and feel like a VS Code tool rather than a completely bespoke standalone application.
- **Learning Curve:** The VS Code Extension API is extensive and highly opinionated.

## Dual-Distribution Strategy (Standalone + Extension)

To support both non-developer users (via a `.exe`) and developers (via VS Code), the architecture should rely on **strict decoupling**:

1. **Core Backend / CLI (Python/C++):** Handles business logic, CAM parsing, and hardware communication. It is entirely headless.
2. **Shared Web UI (HTML/JS/Blockly):** The visual interface layer.
3. **Standalone Wrapper (Electron/Tauri/PyQt):** Wraps the UI and Backend into a standalone `.exe`.
4. **VS Code Extension Host (TypeScript/Node.js):** Wraps the UI in a Webview and manages the Backend.

## Proposed Architecture (VS Code Specific)

1. **Extension Host (TypeScript/Node.js):** 
   - Acts as the central controller and "State Manager".
   - Registers commands and UI contributions in the `package.json`.
   - Manages file saving/loading via standard VS Code APIs.
   - Spawns and manages any backend processes.
2. **Custom UI (HTML/JS/CSS in Webviews):**
   - Renders the Blockly workspace and custom 3D/CAM visualizations inside `WebviewPanels` or sidebar `WebviewViews`.
   - **Multiple Webviews:** You can open several Webviews at once (e.g., Blockly in one tab, 3D CAM in another). Since Webviews are isolated sandboxes and cannot talk directly to each other, they communicate by sending messages to the Extension Host, which then routes the data to the appropriate view.
3. **Backend Processes:**
   - Existing heavy lifting or logic (e.g., Python scripts like `generate_centroid_vars.py`) is executed by the extension host via child processes or local HTTP/WebSocket servers.

## Next Steps (When starting the parallel project)

- [ ] Create a boilerplate VS Code extension using the generator (`npx yo code`).
- [ ] Prototype rendering the existing Blockly interface inside a VS Code Webview.
- [ ] Establish a basic message-passing protocol between the Webview and the Extension Host.
- [ ] Evaluate the effort required to strictly decouple the current backend logic from the existing standalone frontend.
