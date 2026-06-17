// This file is the ES6 entrypoint for the VS Code extension's Webview.
// It imports modules natively from the standalone DDCS-Studio app,
// and esbuild will bundle it into a single file (dist/bundle.js) to avoid CORS issues.

import { installBlockly, buildToolbox } from '../../../DDCS-Studio/web/blocks/blockly/bridge.js';
import { ddcsTheme } from '../../../DDCS-Studio/web/blocks/blockly/theme.js';
import { WizardManager } from '../../../DDCS-Studio/web/wizardManager.js';
import { initProgramModel, onChange, setStack, getStack } from '../../../DDCS-Studio/web/blocks/programModel.js';
import { stackToWorkspace, workspaceToStack } from '../../../DDCS-Studio/web/blocks/blockly/stackBridge.js';
import { reconcileGcodeToStack } from '../../../DDCS-Studio/web/blocks/gcodeToStack.js';
import { resolveActivePost } from '../../../DDCS-Studio/web/wizards/dialects/index.js';
import { getActiveProfile } from '../../../DDCS-Studio/web/shared/js/profiles/controllerProfiles.js';
import { makeClient } from '../../../DDCS-Studio/web/shared/js/client.js';

function dialectOpts() { 
    try { return { dialect: resolveActivePost(getActiveProfile().id) }; } 
    catch (_) { return {}; } 
}

// The standalone app's blockly-spike manually created a generator and defined basic blocks.
// We'll reproduce that setup here, but using the shared code natively.
document.addEventListener('DOMContentLoaded', () => {
    // 1. Ensure Blockly is loaded globally (the HTML still includes blockly.min.js via <script>)
    const B = window.Blockly;
    if (!B) {
        console.error("Blockly not found!");
        return;
    }

    // 0. Point the shared client seam (client.js) at the Python gateway the extension host spawned.
    //    The webview is its own (vscode-webview://) origin, so a same-origin "" base would miss the
    //    gateway entirely. Persisting to localStorage makes every makeClient() in shared code inherit it.
    const apiBase = window.__ddcsApiBase || '';
    if (apiBase) { try { localStorage.setItem('ddcs_api', apiBase); } catch (_) {} }
    const gwEl = document.getElementById('gw-status');
    const setGw = (txt, color) => { if (gwEl) { gwEl.textContent = txt; gwEl.style.color = color; } };
    setGw('gateway: connecting…', '#8b97a6');
    makeClient({ base: apiBase }).descriptor()
        .then((d) => { console.log('[DDCS] gateway descriptor:', d); setGw('gateway: connected', '#2dd4bf'); })
        .catch((err) => { console.warn('[DDCS] gateway probe failed:', err); setGw('gateway: offline', '#f87171'); });

    // 2. Install DDCS blocks from the shared bridge
    installBlockly(B);

    // 3. Define the theme
    const theme = B.Theme.defineTheme('ddcs_dark', ddcsTheme);

    // 4. Build the toolbox
    const toolbox = buildToolbox();

    // 5. Inject Blockly into the workspace div
    const ws = B.inject('ws', {
        toolbox,
        theme,
        renderer: 'zelos',
        grid: { spacing: 26, length: 2, colour: '#1b2733', snap: true },
        zoom: { controls: true, wheel: true, startScale: 0.9 },
        trashcan: true,
        move: { smoothScroll: true },
    });
    
    window.__workspace = ws;

    // Initialize the shared Wizard Manager so the modal overlays work
    const dummyEditorManager = {
        insert: (code) => { /* handled by interceptor below */ },
        getValue: () => "",
        setValue: () => {},
        editor: { addEventListener: () => {} }
    };
    
    // Wire up the standalone Program Model so WizardManager can build block stacks
    window.ddcsStudio = { editorManager: dummyEditorManager };
    initProgramModel();
    
    // Listen for model changes and project them into the Blockly canvas
    onChange(({ stack, proj, origin }) => {
        if (origin !== 'blockly' && window.__workspace) {
            stackToWorkspace(stack, window.__workspace);
        }
        
        // Sync back to VS Code!
        if (origin !== 'vscode' && window.vscode) {
            window.vscode.postMessage({ type: 'documentChanged', text: proj.text });
        }
    });

    // Receive document updates from VS Code
    window.addEventListener('vscode:updateDocument', (e) => {
        const text = e.detail;
        const currentStack = getStack();
        const newStack = reconcileGcodeToStack(text, currentStack, dialectOpts());
        if (newStack) {
            setStack(newStack, 'vscode');
        }
    });

    // Send Blockly changes back to the model
    window.__workspace.addChangeListener((e) => {
        if (e.isUiEvent || e.type === Blockly.Events.FINISHED_LOADING) return;
        const stack = workspaceToStack(window.__workspace);
        setStack(stack, 'blockly');
    });

    window.wizardManager = new WizardManager(dummyEditorManager);
    
    // Wire up the top-bar HTML buttons
    window.openWiz = (type) => window.wizardManager.open(type);
    window.closeWiz = () => window.wizardManager.close();

    // No need to intercept wizardManager.insert anymore! 
    // The wizard will commit the op to programModel, which triggers onChange,
    // which automatically sends the entire file contents to VS Code.
});
