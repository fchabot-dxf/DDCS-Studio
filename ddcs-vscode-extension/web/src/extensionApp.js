// This file is the ES6 entrypoint for the VS Code extension's Webview.
// It imports modules natively from the standalone DDCS-Studio app,
// and esbuild will bundle it into a single file (dist/bundle.js) to avoid CORS issues.

import { installBlockly, buildToolbox } from '../../../DDCS-Studio/web/blocks/blockly/bridge.js';
import { ddcsTheme } from '../../../DDCS-Studio/web/blocks/blockly/theme.js';
import { WizardManager } from '../../../DDCS-Studio/web/wizardManager.js';
import { CommandDeck } from '../../../DDCS-Studio/web/ui/commandDeck.js';
import { ThemeManager } from '../../../DDCS-Studio/web/ui/themes.js';
import { initProgramModel, onChange, setStack, getStack } from '../../../DDCS-Studio/web/blocks/programModel.js';
import { stackToWorkspace, workspaceToStack } from '../../../DDCS-Studio/web/blocks/blockly/stackBridge.js';
import { reconcileGcodeToStack } from '../../../DDCS-Studio/web/blocks/gcodeToStack.js';
import { resolveActivePost } from '../../../DDCS-Studio/web/wizards/dialects/index.js';
import { getActiveProfile } from '../../../DDCS-Studio/web/shared/js/profiles/controllerProfiles.js';
import { makeClient } from '../../../DDCS-Studio/web/shared/js/client.js';
import { lintGcode } from './gcodeLint.js';

function dialectOpts() { 
    try { return { dialect: resolveActivePost(getActiveProfile().id) }; } 
    catch (_) { return {}; } 
}

// The standalone app's blockly-spike manually created a generator and defined basic blocks.
// We'll reproduce that setup here, but using the shared code natively.
document.addEventListener('DOMContentLoaded', () => {
    // Forward webview console output to the host → _debug.log (the webview DevTools console isn't easily
    // readable). DDCS logs + all warns/errors.
    let __logSeq = 0;
    ['log', 'warn', 'error'].forEach((lvl) => {
        const orig = console[lvl].bind(console);
        console[lvl] = (...args) => {
            orig(...args);
            try {
                const text = args.map((a) => typeof a === 'string' ? a : (() => { try { return JSON.stringify(a); } catch (_) { return String(a); } })()).join(' ');
                if ((lvl !== 'log' || text.indexOf('DDCS') >= 0) && window.vscode) {
                    window.vscode.postMessage({ type: 'log', text: '#' + (++__logSeq) + ' [' + lvl + '] ' + text.slice(0, 1500) });
                }
            } catch (_) {}
        };
    });

    // Apply the DDCS theme (sets body[data-theme]). Studio boots this in app.js; without it the app has no
    // theme and falls back to the bare gray base colors — the unstyled "VS Code" look. Default is 'studio'
    // (THEMES[0], the tan one); a saved ddcs_theme (seeded by the host) overrides it, and the Settings tab's
    // switcher re-skins live.
    try { new ThemeManager(); } catch (err) { console.warn('[DDCS] ThemeManager init failed:', err && err.message ? err.message : err); }

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

    // 3. Define the theme — ddcsTheme is a FACTORY: call it with B (Studio does `theme: ddcsTheme(B)`).
    //    Passing the function itself gave a theme with no blockStyles → every block rendered black.
    const theme = ddcsTheme(B);

    // 4. Build the toolbox
    const toolbox = buildToolbox();

    // 5. Inject Blockly into the workspace div (geras renderer, matching Studio's Blocks tab)
    const ws = B.inject('ws', {
        toolbox,
        theme,
        renderer: 'geras',
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
    
    // Lint the current program against the active post → VS Code's Problems panel (computed here, where
    // the dialect + selected post live; the host just publishes the findings).
    const reportLint = (text) => {
        if (!window.vscode) return;
        let post = null;
        try { post = resolveActivePost(getActiveProfile().id); } catch (_) {}
        try { window.vscode.postMessage({ type: 'diagnostics', items: lintGcode(text, post) }); } catch (_) {}
    };

    // Mute the workspace change listener while WE rebuild the canvas from the model — otherwise
    // stackToWorkspace's events echo back as setStack('blockly') with an empty/partial stack, wiping
    // the model (blocks vanish on tab switch + the doc gets emptied). Same guard Studio's blocksApp uses.
    let muteChanges = false;
    let blocksActive = true;   // Blocks starts visible; the workspace→model sync only runs while it is
    let lastSentText = null;   // text we pushed to the doc — ignore the host's echo of it (don't reconcile our own change)

    // Listen for model changes and project them into the Blockly canvas
    onChange(({ stack, proj, origin }) => {
        const tlen = (proj && proj.text) ? proj.text.length : 0;
        console.log(`[DDCS] onChange origin=${origin} stackLen=${stack ? stack.length : 'null'} textLen=${tlen} blocksActive=${blocksActive}`);
        if (origin !== 'blockly' && window.__workspace) {
            // Disable Blockly events during the load so the rebuild can't echo back through the change
            // listener. A flag doesn't work: Blockly fires its create events ASYNC, after the flag resets —
            // Events.disable() drops them at creation instead.
            muteChanges = true;
            if (window.Blockly) window.Blockly.Events.disable();
            try { stackToWorkspace(stack, window.__workspace); }
            finally { if (window.Blockly) window.Blockly.Events.enable(); muteChanges = false; }
        }

        // Sync back to VS Code!
        if (origin !== 'vscode' && window.vscode) {
            console.log(`[DDCS] → postMessage documentChanged textLen=${tlen}`);
            lastSentText = proj.text;
            window.vscode.postMessage({ type: 'documentChanged', text: proj.text });
        }

        reportLint(proj.text);
    });

    // Receive document updates from VS Code
    window.addEventListener('vscode:updateDocument', (e) => {
        const text = e.detail;
        // Ignore the host echoing back the change WE just made — reconciling our own output can return a
        // different/empty stack and clobber the blocks the wizard just committed. (Normalize EOL: the doc
        // may store CRLF.) Only reconcile genuinely external edits.
        const norm = (s) => (s || '').replace(/\r\n/g, '\n');
        if (norm(text) === norm(lastSentText)) {
            console.log('[DDCS] vscode:updateDocument IGNORED (echo of our own change)');
            return;
        }
        const currentStack = getStack();
        const newStack = reconcileGcodeToStack(text, currentStack, dialectOpts());
        console.log(`[DDCS] vscode:updateDocument textLen=${text ? text.length : 0} curStackLen=${currentStack ? currentStack.length : 'null'} reconciledLen=${newStack ? newStack.length : 'null'}`);
        if (newStack) {
            setStack(newStack, 'vscode');
        }
    });

    // Send Blockly changes back to the model (skip our own model→workspace rebuild via muteChanges)
    window.__workspace.addChangeListener((e) => {
        if (e.isUiEvent || muteChanges || !blocksActive || e.type === Blockly.Events.FINISHED_LOADING) {
            if (!e.isUiEvent) console.log(`[DDCS] ws-change IGNORED type=${e.type} muted=${muteChanges} blocksActive=${blocksActive}`);
            return;
        }
        const stack = workspaceToStack(window.__workspace);
        console.log(`[DDCS] ws→model setStack(blockly) stackLen=${stack ? stack.length : 'null'} (event ${e.type})`);
        setStack(stack, 'blockly');
    });

    window.wizardManager = new WizardManager(dummyEditorManager);
    
    // Wire up the top-bar HTML buttons
    window.openWiz = (type) => window.wizardManager.open(type);
    window.closeWiz = () => window.wizardManager.close();
    window.openPreview = () => {
        // Pass the operator start (set on INSERT from the wizard's 3D preview) so the pop-out positions the
        // toolpath and tests probes from the real tool position — incremental (G91) probe G-code needs it,
        // or it renders from origin into a default stock (the wrong toolpath you saw).
        try { window.vscode && window.vscode.postMessage({ type: 'openPreview', start: window.__pendingSpindleStart || null }); } catch (_) {}
    };

    // Mirror settings up to the host — it owns the canonical copy (persisted) and seeds it into every
    // webview (this app on next launch + the preview), so all windows share one source of truth.
    const sendSettings = () => {
        try {
            const store = {};
            for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k) store[k] = localStorage.getItem(k); }
            window.vscode && window.vscode.postMessage({ type: 'settings', store });
        } catch (_) {}
    };
    window.addEventListener('ddcs:settings-changed', sendSettings);
    sendSettings();   // initial mirror (covers first-ever launch when the host has nothing yet)
    window.insertWiz = () => { console.log('[DDCS] insertWiz() clicked'); return window.wizardManager.insert(); };

    // The Probe dropdown calls these specific globals (Studio wires them in globalFunctions.js); each is
    // just open(<type>) under the hood (wizardManager.js:253-256), so alias them to the proven openWiz path.
    window.openCornerWiz = () => window.openWiz('corner');
    window.openMiddleWiz = () => window.openWiz('middle');
    window.openEdgeWiz = () => window.openWiz('edge');
    window.openAlignmentWiz = () => window.openWiz('alignment');
    // Clear is the only editor-op we keep (Load/Insert/Copy/Export are VS Code's job) — wipe the program:
    // a neutral origin makes onChange both rebuild the (empty) canvas AND post the empty doc to the editor.
    window.clearCode = () => setStack([], 'clear');

    // Build the real wizard toolbar from source. commandDeck.renderHeader() populates .header-left/center/
    // right (Comm/WCS/Warm-up + Probe/ATC/Mill dropdowns); its buttons call the globals wired above, so it
    // works as-is — and it tracks Studio (add a wizard there → it appears here) instead of a forked list.
    try {
        const deck = new CommandDeck(dummyEditorManager, null);
        deck.renderHeader();
        window.__commandDeck = deck;
        // Hide the editor-ops we don't use here; keep only Clear.
        document.querySelectorAll('.dock-header .header-right button').forEach((btn) => {
            const tx = (btn.querySelector('.btn-tx') || {}).textContent || '';
            if (tx.trim() !== 'Clear') { btn.style.display = 'none'; }
        });
        console.log('[DDCS] commandDeck toolbar rendered');
    } catch (err) {
        console.error('[DDCS] commandDeck.renderHeader failed:', err && err.message ? err.message : err);
    }

    // --- Main-UI tabs: BLOCKS (the #ws canvas) | GATEWAY | SETTINGS. Studio's editor tab is intentionally
    //     dropped — VS Code's own text editor is that surface. #gateway-app / #settings-app are the forked
    //     Studio app-shells (position:absolute under the 54px header); we swap them over the Blocks view. ---
    const mainEl = document.querySelector('.main');
    const gatewayApp = document.getElementById('gateway-app');
    const settingsApp = document.getElementById('settings-app');
    let _gatewayInited = false;
    window.showApp = async (which) => {
        const isBlocks = which === 'blocks', isGateway = which === 'gateway', isSettings = which === 'settings';
        console.log(`[DDCS] showApp(${which})`);
        blocksActive = isBlocks;   // set BEFORE hiding .main so hide-fired events are ignored, not synced as empty
        if (mainEl) mainEl.style.display = isBlocks ? '' : 'none';
        gatewayApp && gatewayApp.classList.toggle('hidden', !isGateway);
        settingsApp && settingsApp.classList.toggle('hidden', !isSettings);
        document.querySelectorAll('.ext-tab').forEach((t) => t.classList.toggle('active', t.dataset.app === which));

        // Panels are dynamic-imported + try/caught so one misbehaving panel can't take down the Blocks view.
        if (isGateway) {
            try {
                const mod = await import('../../../DDCS-Studio/web/ui/gatewayPanel.js');
                if (!_gatewayInited) { mod.initGatewayPanel(); _gatewayInited = true; }
                mod.setGatewayPanelVisible(true);
            } catch (err) { console.error('[DDCS] gateway panel failed:', err); }
        } else {
            try { (await import('../../../DDCS-Studio/web/ui/gatewayPanel.js')).setGatewayPanelVisible(false); } catch (_) {}
        }
        if (isSettings) {
            try { (await import('../../../DDCS-Studio/web/ui/settingsPanel.js')).openSettings(); }
            catch (err) { console.error('[DDCS] settings panel failed:', err); }
        }
        // Returning to Blocks: re-project the model (the source of truth) into the canvas, then re-measure.
        // Without the re-project, any blocks the workspace dropped while hidden don't come back — Studio's
        // blocksApp re-renders from the model on tab show for the same reason.
        if (isBlocks && window.__workspace) {
            const gs = getStack();
            console.log(`[DDCS] re-project on Blocks show, modelStackLen=${gs ? gs.length : 'null'}`);
            muteChanges = true;
            if (window.Blockly) window.Blockly.Events.disable();
            try { stackToWorkspace(gs, window.__workspace); }
            finally { if (window.Blockly) window.Blockly.Events.enable(); muteChanges = false; }
            if (window.Blockly) { try { window.Blockly.svgResize(window.__workspace); } catch (_) {} }
        }
    };

    // Populate the header post selector (#hdrPost) — lazy + isolated so a failure can't break the shell.
    import('../../../DDCS-Studio/web/ui/headerPost.js')
        .then((m) => m.initHeaderPost())
        .catch((err) => console.error('[DDCS] header post init failed:', err));

    window.showApp('blocks');   // start on the Blocks view

    // No need to intercept wizardManager.insert anymore! 
    // The wizard will commit the op to programModel, which triggers onChange,
    // which automatically sends the entire file contents to VS Code.
});
