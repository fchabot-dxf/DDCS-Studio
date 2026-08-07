/**
 * DDCS Studio - Main Application
 * Version 9.49 - Modular ES6 Edition
 * 
 * CNC G-code Generator for DDCS Expert M350 Controller
 */

import { ThemeManager } from './ui/themes.js';
import { VariableDatabase } from './data/variableDB.js';
import { EditorManager } from './ui/editorManager.js';
import { DockManager } from './ui/dockManager.js';
import { WizardManager } from './wizardManager.js';
import { el } from './ui/uiUtils.js';
import { setupGlobalFunctions } from './ui/globalFunctions.js';
import { setupNumericInputGuards as setupNumericInputGuardsImpl } from './ui/numericInputGuards.js';
import { playClick } from './ui/sound.js';  // click feedback sound
import { loadUserOps, listUserOps, createUserOp, updateUserOp, deleteUserOp, getUserDef } from './blocks/userOps.js';   // wizard-maker: register + seed/upgrade user-defined ops; t1107 — per-wizard Restore-to-factory reseed
import { insertUserOp } from './ui/userOpForm.js';   // wizard-maker: generic param form (→ window.ddcsInsertUserOp)
import { atcWarmupDataDef } from './blocks/dataOps/atcWarmupData.js';
import { facingDataDef } from './blocks/dataOps/facingData.js';   // t1271 — the lathe family's first citizen (the gated pilot)
import { odTurnDataDef } from './blocks/dataOps/odTurnData.js';
import { partingDataDef } from './blocks/dataOps/partingData.js';   // t1275 — parting / grooving
import { centerDrillDataDef } from './blocks/dataOps/centerDrillData.js';
import { polygonDataDef } from './blocks/dataOps/polygonData.js';
import { faceProbeDataDef } from './blocks/dataOps/faceProbeData.js';   // t1299 — the lathe probe family
import { odProbeDataDef } from './blocks/dataOps/odProbeData.js';
import { applyLatheWorkspaceStock } from './viz/latheScene.js';   // t1297 — a lathe workspace's workpiece IS a bar
import './ui/axisGating.js';   // t1271 — grey (never hide) the ops this machine's declared axes cannot run
import { atcLengthDataDef } from './blocks/dataOps/atcLengthData.js';   // t409 — ATC Tool Length light port (new twin, opened IN-PLACE from the ATC Tool Length slot)
import { atcCheckDataDef } from './blocks/dataOps/atcCheckData.js';   // t411 — ATC Tool Check light port (inherits the Tool Length recipe)
import { atcTestDataDef } from './blocks/dataOps/atcTestData.js';   // t556-t560 ATC Test port — the "ATC Test (data)" twin: opened IN-PLACE from the built-in ATC Test slot (opensAs); mode superset + pockets unroll + M2 recompose + declared-I/O one-source + machine-frame/magazine sim
import { atcChangeDataDef } from './blocks/dataOps/atcChangeData.js';   // t562-t566 ATC Change port — the "Tool Change (data)" twin: opened IN-PLACE from the built-in Tool Change slot (opensAs); 5-method _arm superset + M2 static-arm graft + inlineTnc live-view + per-method field gating + machine/magazine/choreography sim
import { atcTableDataDef } from './blocks/dataOps/atcTableData.js';   // t568 ATC Table port (THE LAST WIZARD) — the "Tool Table (data)" twin: opened IN-PLACE from the built-in Tool Table slot (opensAs); include-toggle superset + live-view rows (unroll from Settings → Tool table)
import { drillDataDef } from './blocks/dataOps/drillData.js';
import { tapDataDef } from './blocks/dataOps/tapData.js';   // t778 — the Tapping data-twin (floating-holder + gated rigid)
import { boreDataDef } from './blocks/dataOps/boreData.js';   // fan-out — the helical "Bore (data)" twin — opened IN-PLACE from the built-in Bore slot (opensAs); drillStack method='helical', byte-identical
import { slotDataDef } from './blocks/dataOps/slotData.js';
import { surfacingDataDef } from './blocks/dataOps/surfacingData.js';
import { contourDataDef } from './blocks/dataOps/contourData.js';   // E1 mill FEATURE-WRITE port: the flat "Contour (data)" twin — opened IN-PLACE from the built-in Contour slot (opensAs); region-pill→flat reframe, byte-identical
import { pocketDataDef } from './blocks/dataOps/pocketData.js';   // t469 E1 — the "Pocket (data)" twin (FIRST coarse SUPERSET: strategy + tooSmall guards + the derive-guards hook); in-place from the built-in Pocket slot (opensAs)
import { wcsDataDef } from './blocks/dataOps/wcsData.js';   // t477 E1 — the "WCS (data)" twin (STATIC-shape over the dialect-aware wcszero atom); in-place from the built-in WCS slot (opensAs)
import { textDataDef } from './blocks/dataOps/textData.js';
import { cornerDataDef } from './blocks/dataOps/cornerData.js';   // corner port (inc B1): additive "Corner (data)" twin
import { edgeDataDef } from './blocks/dataOps/edgeData.js';   // t339 edge port E1-E4: the "Edge (data)" twin — opened IN-PLACE from the built-in Edge's Probe slot (opensAs)
import { middleDataDef } from './blocks/dataOps/middleData.js';   // middle port E1-E4: the "Middle (data)" twin — opened IN-PLACE from the built-in Middle's Probe slot (opensAs)
import { rotaryCenterDataDef } from './blocks/dataOps/rotaryCenterData.js';   // t413-t421 rotary centreline port E1-E5: the "Rotary Centreline (data)" twin — opened IN-PLACE from the built-in Centreline slot (opensAs); round-bar sim + 4th-axis rig + multi-pass starts
import { rotaryClockDataDef } from './blocks/dataOps/rotaryClockData.js';   // t423-t429 rotary clock port E0-E3: the "Rotary Clock (data)" twin — opened IN-PLACE from the built-in Clock A0 slot (opensAs); box + 4-jaw rig + single start
import { alignmentDataDef } from './blocks/dataOps/alignmentData.js';   // t431-t437 alignment port E0-E3 (the LAST probe): the "Alignment (data)" twin — opened IN-PLACE from the built-in Align slot (opensAs); box + 2 fence starts, no rig
import { commDataDef } from './blocks/dataOps/commData.js';   // t518 1b-ii — the "Communication (data)" twin (Setup/IO port): opened IN-PLACE from the built-in Comm slot (opensAs); superset type × hmi × mode × conditional forks + value-bearing recompose
import { ioStepDataDef } from './blocks/dataOps/ioStepData.js';   // t522 E2 — the grouped "I/O Step" twin (output/input/dwell): opened IN-PLACE from the built-in I/O Step setup slot (opensAs); declared-I/O by name + raw-pin fallback
import { pauseConfirmDataDef } from './blocks/dataOps/pauseConfirmData.js';   // t1031 — the standalone Pause/Confirm twin (operator message + M0), opened in-place from the built-in setup slot (opensAs)
import { homingDataDef } from './blocks/dataOps/homingData.js';   // t546-t552 homing port — the "Homing (data)" twin: opened IN-PLACE from the built-in Homing slot (opensAs); per-axis guarded arms + settings recompose (unroll) + the machine-frame preview (forced envelope + draggable Start)
// Edge viz animator (registers `window.EdgeVizAnimator`)
import './viz/edgeVizAnimator.js';
// Alignment viz animator (registers `window.AlignVizAnimator`)
import './viz/alignVizAnimator.js';

// MiddleViz helpers (animation, id mapping, visibility controller)
import './viz/middleVizUtils.js';
import './viz/middleVizAnimator.js';
import './viz/middleVizManager.js';

// EDITOR / 3D toolpath preview tab (self-registers window.setGcodeView on DOM ready)
import './ui/gcodePreviewTab.js';

// Settings panel (header ⚙ → CSV import/export + stock + machine envelope)
import './ui/settingsPanel.js';

// Profile store (one JSON = settings + user variables; pywebview file-I/O ready)
import './data/profileStore.js';
// t1217 — THE WORKSPACE'S ONE MACHINE ([[one-workspace-one-machine]]): the .ddcs IS the machine. The record rides the
// file as its own declared BACKUP_STORES row, and opening a workspace adopts the controller it names.

// Virtual I/O simulation — browser-only mock of hardware handshakes (ATC, drawbar, etc.)
// Used by the Studio's G-code simulation/preview engine to animate full macro cycles
// without a real controller. No network or serial connections — pure JS + setTimeout.
// See src/virtualIO.js for the truth table and integration API.

// IO Settings & Diagnostics
import './ui/ioTab.js';

// PERSISTENCE-A — the "unsaved to file" header chip + exit warning (localStorage-only work vs a portable .ddcs)
import './ui/fileSaveState.js';

// INTENTIONAL SAVE — Ctrl+S / Save writes the whole workspace to a user-owned .ddcs via the File System Access API
import './ui/workspaceSave.js';

// t1223 — THE WORKSPACE MANAGER: one modal for Save / Save As / Duplicate + the granted-folder card browser (Open).
import './ui/workspaceManager.js';

// Anonymous, opt-out usage analytics — fires a `visit` on load; see ui/analytics.js
import './ui/analytics.js';

import { initProgramModel } from './blocks/programModel.js';
import { initSaveStates } from './blocks/saveStates.js';

// t1107 — the factory data-twin builders, the ONE source shared by the boot seed (seedDefaultPortedUserOps) AND the per-wizard
// Restore-to-factory action (wizardManagerPanel). A built-in wizard's opensAs twin is reset to factory by re-running its builder.
// t1581 — exported so a test can sweep the REGISTRY itself (every ported twin's form presents every declared binding),
// rather than a hand-typed parallel list that a new twin could silently fall out of.
export const SEED_BUILDERS = [
    atcWarmupDataDef, atcLengthDataDef, atcCheckDataDef, atcTestDataDef, atcChangeDataDef, atcTableDataDef,
    drillDataDef, tapDataDef, boreDataDef, slotDataDef, surfacingDataDef, contourDataDef, pocketDataDef, wcsDataDef, textDataDef,
    cornerDataDef, edgeDataDef, middleDataDef, rotaryCenterDataDef, rotaryClockDataDef, alignmentDataDef,
    commDataDef, ioStepDataDef, pauseConfirmDataDef, homingDataDef,
    facingDataDef, odTurnDataDef, partingDataDef, centerDrillDataDef, polygonDataDef,   // t1271/t1273/t1275/t1277 — LATHE: seeded for every workspace; the bar decides where it SITS by machine kind
    faceProbeDataDef, odProbeDataDef,   // t1299 — the lathe PROBE family: they write the datum the five turning ops are measured from
];
const seedBuilderFor = (opType) => SEED_BUILDERS.find((fn) => { try { return fn().opType === opType; } catch (_) { return false; } }) || null;

// A built-in's opensAs twin diverges from factory when a re-author (updateUserOp with an undeclared defV) bumped its defV
// PAST the factory seed's declared version. The blanket reset stays resetLayout; this is the per-wizard twin signal.
window.ddcsUserOpDivergedFromFactory = (opType) => {
    try {
        const stored = JSON.parse(localStorage.getItem('ddcs_user_ops') || '[]');
        return Array.isArray(stored) && stored.some(d => d.opType === opType);
    } catch (_) { return false; }
};
// Restore ONE built-in's opensAs twin to factory IMMEDIATELY (no reboot): delete the customized store copy + re-create it from
// the factory builder. deleteUserOp clears every registered table; createUserOp re-registers the pristine def. Returns bool.
window.ddcsReseedUserOp = (opType) => {
    const fn = seedBuilderFor(opType); if (!fn) return false;
    let def; try { def = fn(); } catch (_) { return false; }
    if (def.defV == null) def.defV = 1;
    try { deleteUserOp(opType); } catch (_) { /* not registered — fall through to create */ }
    try { createUserOp(def); return true; } catch (_) { try { updateUserOp(def); return true; } catch (__) { return false; } }
};

class DDCSStudio {
    constructor() {
        this.themeManager = new ThemeManager();
        console.debug('DDCSStudio: ThemeManager initialized');
        this.variableDB = new VariableDatabase();
        console.debug('DDCSStudio: VariableDatabase initialized');
        this.editorManager = new EditorManager();
        console.debug('DDCSStudio: EditorManager initialized');
        import('./ui/followExec.js').then((m) => m.initFollowExec(this.editorManager)).catch(() => { /* follow-exec toggle is optional chrome */ });   // t865 — editor auto-scroll-to-running-line toggle (replaced the minimap; consumes onActiveLine)
        import('./ui/preflightBadge.js').then((m) => m.initPreflightBadge(this.editorManager)).catch(() => { /* pre-flight badge is optional chrome */ });   // t838 — the pre-flight envelope check badge
        import('./ui/timeChip.js').then((m) => m.initTimeChip()).catch(() => { /* time-estimate chip is optional chrome */ });   // t844 — the estimated run-time chip

        this.dockManager = new DockManager(this.variableDB, this.editorManager);
        console.debug('DDCSStudio: DockManager initialized');
        this.wizardManager = new WizardManager(this.editorManager);
        console.debug('DDCSStudio: WizardManager initialized');

        console.debug('DDCSStudio: calling init()');
        this.init();
    }

    init() {
        console.debug('DDCSStudio.init() start');
        // t1223 — the boot-time legacy-library migration is GONE ([[no-legacy-burden]]): nothing to migrate, and it ran
        // on every single boot forever to serve a one-time case that no longer exists.

        // Initialize the global program model and history (undo/redo)
        initProgramModel();
        initSaveStates();
        loadUserOps();                              // register every persisted user-defined op (wizard-maker)
        this.seedDefaultPortedUserOps();            // surface shipped data-op ports in the user layer / bar Custom dropdown
        // t1297 — a lathe workspace's WORKPIECE is a bar, so the global stock is one: the main preview then draws the
        // same thing the wizards do, instead of a toolpath in empty air. Never overwrites a bar the user already has.
        try { applyLatheWorkspaceStock(); } catch (_) {}
        window.ddcsInsertUserOp = insertUserOp;     // open the generic param form for a user op (menu / dev panel)
        // Re-author a saved wizard (load its template into Blocks). Exposed early — the Settings manager triggers it
        // from Studio, before the Blocks app (which would otherwise set it) has mounted.
        import('./blocks/devMode.js').then((m) => { window.ddcsEditWizardDef = (opType) => m.editWizardDef(opType); window.ddcsEditWizardDefs = (opTypes) => m.editWizardDefs(opTypes); }).catch(() => {});

        // Ensure the wizard bar reflects any newly seeded user ops on first load.
        if (window.ddcsRefreshWizardBar) window.ddcsRefreshWizardBar();

        // Setup global window functions for backwards compatibility
        this.setupGlobalFunctions();
        console.debug('DDCSStudio.init() - setupGlobalFunctions complete');

        // Enforce numeric-only input on generator numeric fields
        this.setupNumericInputGuards();

        // Setup file upload handler
        this.setupFileUpload();

        // Visual Viewport -> detect virtual keyboard on mobile (adds/removes `keyboard-active` on <body>)
        if (window.visualViewport) {
            // track previous keyboard state so we only play sound when it opens
            this._keyboardActive = false;

            const _checkKeyboard = () => {
                try {
                    const vv = window.visualViewport;
                    const newActive = vv && vv.height < window.innerHeight * 0.8;

                    if (newActive && !this._keyboardActive) {
                        // keyboard just opened
                        playClick();
                    }
                    this._keyboardActive = newActive;

                    if (newActive) {
                        document.body.classList.add('keyboard-active');
                    } else {
                        document.body.classList.remove('keyboard-active');
                    }
                } catch (e) { /* noop */ }
            };
            window.visualViewport.addEventListener('resize', _checkKeyboard);
            window.visualViewport.addEventListener('scroll', _checkKeyboard);
            // initial check
            _checkKeyboard();
        }

        this.setupVisualizationListeners();

        // Log layout snapshot for debugging: sizes and visibility
        this.logLayoutSnapshot();
    }

    // Seed/upgrade selected data-op ports as default USER ops.
    // Built-ins remain untouched; these are user-layer entries and can be hidden/deleted/overridden like any other custom op.
    // IMPORTANT: existing saved seeded defs are upgraded in place so new UI metadata (dropdown options, panel/sim blocks,
    // domain grouping) appears for users who already had earlier versions in localStorage.
    seedDefaultPortedUserOps() {
        const have = new Set(listUserOps().map((d) => d.opType));
        const seeds = SEED_BUILDERS.map((fn) => fn());   // t1107 — SEED_BUILDERS is the ONE source (module-level), shared with the per-wizard Restore-to-factory reseed
        for (const def of seeds) {
            try {
                if (def.defV == null) def.defV = 1;   // N1 — declare the seed's version (author bumps it in the def-builder when its emit changes); a DECLARED defV means updateUserOp respects it (no boot auto-inc)
                if (have.has(def.opType)) updateUserOp(def);
                else createUserOp(def);
            } catch (_) { /* ignore duplicate/corrupt edge cases */ }
        }
    }

    logLayoutSnapshot() {
        try {
            const bodyStyle = getComputedStyle(document.body);
            const appShell = document.querySelector('.app-shell');
            const main = document.querySelector('.main');
            const editor = document.getElementById('editor');
            const varList = document.getElementById('varList');
            const wizard = document.getElementById('wizard');

            const shellRect = appShell ? appShell.getBoundingClientRect() : null;
            const mainRect = main ? main.getBoundingClientRect() : null;
            const editorRect = editor ? editor.getBoundingClientRect() : null;

            console.debug('LayoutSnapshot', {
                bodyTransform: bodyStyle.transform,
                bodyClient: { w: document.body.clientWidth, h: document.body.clientHeight },
                appShellTransform: appShell ? getComputedStyle(appShell).transform : null,
                appShellRect: shellRect && { x: Math.round(shellRect.x), y: Math.round(shellRect.y), w: Math.round(shellRect.width), h: Math.round(shellRect.height) },
                mainRect: mainRect && { x: Math.round(mainRect.x), y: Math.round(mainRect.y), w: Math.round(mainRect.width), h: Math.round(mainRect.height) },
                editorRect: editorRect && { w: Math.round(editorRect.width), h: Math.round(editorRect.height) },
                editorClientHeight: editor ? editor.clientHeight : null,
                varListChildCount: varList ? varList.querySelectorAll('.var-item').length : 0,
                wizardDisplay: wizard ? getComputedStyle(wizard).display : 'missing'
            });
        } catch (err) {
            console.warn('logLayoutSnapshot failed', err);
        }
    }

    setupGlobalFunctions() {
        setupGlobalFunctions(this);
    }

    setupFileUpload() {
        const csvInput = el('csvInput');
        if (!csvInput) return;

        csvInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                this.variableDB.loadFromCSV(e.target.result);
                // Refresh the keyboard's VARIABLES tab (the top strip that used to refresh is gone)
                if (window.refreshDeckVariables) window.refreshDeckVariables();
            };
            reader.readAsText(file);
        });
    }

    setupNumericInputGuards() {
        setupNumericInputGuardsImpl();
    }

    setupVisualizationListeners() {
        // (Corner wizard viz listeners retired ④ — the built-in Corner is replaced by the "Corner (data)" twin.)

        // Middle wizard visualization listeners
        ['m_type', 'm_axis', 'm_dir', 'm_dir2', 'm_both', 'm_probe_z_first'].forEach(id => {
            const elem = el(id);
            if (elem) {
                elem.addEventListener('change', () => {
                    if (el('wiz_middle').style.display !== 'none') {
                        // Call the full update which triggers both viz and animation
                        if (this.wizardManager && this.wizardManager.updateMiddleWizard) {
                            this.wizardManager.updateMiddleWizard();
                        } else if (window.drawMiddleViz) {
                            window.drawMiddleViz();
                        }
                    }
                });
            }
        });

        // Edge/probe visualization listeners — wire to actual control IDs
        ['p_axis', 'p_dir'].forEach(id => {
            const elem = el(id);
            if (elem) {
                elem.addEventListener('change', () => {
                    // Only update when the Edge wizard panel is visible
                    if (el('wiz_edge') && el('wiz_edge').style.display !== 'none') {
                        if (window.drawEdgeViz) window.drawEdgeViz();
                        else if (window.drawProbeViz) window.drawProbeViz();

                        // Ensure wizard manager refreshes its state and (re)starts animator
                        if (this.wizardManager && this.wizardManager.updateEdgeWizard) this.wizardManager.updateEdgeWizard();
                        if (this.wizardManager && this.wizardManager._startEdgeAnim) this.wizardManager._startEdgeAnim();
                    }
                });
            }
        });

        // Alignment visualization listeners
        ['al_check_axis', 'al_probe_dir'].forEach(id => {
            const elem = el(id);
            if (elem) {
                elem.addEventListener('change', () => {
                    if (el('wiz_alignment') && el('wiz_alignment').style.display !== 'none') {
                        if (window.drawAlignmentViz) window.drawAlignmentViz();
                        if (this.wizardManager && this.wizardManager.updateAlignmentWizard) this.wizardManager.updateAlignmentWizard();
                    }
                });
            }
        });
    }

    // openCorner() retired ④ — the built-in Corner is replaced by the "Corner (data)" twin (user_corner_data).

    openMiddle() {
        this.open('middle');
        setTimeout(() => {
            if (window.drawMiddleViz) window.drawMiddleViz();
            this.updateMiddleWizard();
        }, 10);
    }

    openEdge() {
        this.open('edge');
        setTimeout(() => {
            if (window.drawProbeViz) window.drawProbeViz();
            this.updateEdgeWizard();
        }, 10);
    }

    saveDefaults() {
        // All wizard input IDs to snapshot
        const inputIds = [
            'c_corner', 'c_probe_seq', 'c_wcs',
            'c_dist', 'c_retract', 'c_safe_z', 'c_travel_dist', 'c_scan_depth',
            'c_feed_fast', 'c_feed_slow', 'c_port', 'c_level', 'c_q', 'c_slave',
            'm_type', 'm_axis', 'm_dir', 'm_dir2', 'm_wcs',
            'm_dist', 'm_retract', 'm_safe_z', 'm_feed_fast', 'm_feed_slow',
            'm_port', 'm_level', 'm_q', 'm_slave',
            'p_axis', 'p_dir', 'p_wcs',
            'p_dist', 'p_retract', 'p_feed_fast', 'p_feed_slow',
            'p_port', 'p_level', 'p_q', 'p_slave',
            'al_check_axis', 'al_probe_dir',
            'al_dist', 'al_retract', 'al_safe_z', 'al_tolerance',
            'al_feed_fast', 'al_feed_slow', 'al_port', 'al_level', 'al_q',
            'w_sys', 'w_slave',
            'c_type'
        ];
        const checkboxIds = [
            'c_probe_z_first', 'c_sync_a',
            'm_both', 'm_probe_z_first', 'm_sync_a',
            'p_sync_a',
            'w_x', 'w_y', 'w_z', 'w_sync'
        ];

        // Capture live values
        const values = {};
        inputIds.forEach(id => {
            const elem = document.getElementById(id);
            if (elem) values[id] = elem.value;
        });
        const checked = {};
        checkboxIds.forEach(id => {
            const elem = document.getElementById(id);
            if (elem) checked[id] = elem.checked;
        });

        // Snapshot only user-defined variable entries (tiny — system defaults are baked into the build)
        // Embed as window.__ddcs_user_vars so variableDB.js can read it synchronously at init,
        // before any async module loading — localStorage timing is unreliable on a fresh machine.
        const userEntries = this.variableDB ? this.variableDB.getAll().filter(e => !e.isSys) : [];

        // Build patched HTML with saved defaults block
        const buildHtml = () => {
            let html = document.documentElement.outerHTML;
            const restoreScript = `<script id="__saved_defaults">
(function(){
    var values = ${JSON.stringify(values)};
    var checked = ${JSON.stringify(checked)};
    // User variable entries embedded at download time — read synchronously by variableDB.js
    window.__ddcs_user_vars = ${JSON.stringify(userEntries)};
    function restore() {
        Object.keys(values).forEach(function(id){ var e=document.getElementById(id); if(e) e.value=values[id]; });
        Object.keys(checked).forEach(function(id){ var e=document.getElementById(id); if(e) e.checked=checked[id]; });
    }
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', restore); } else { restore(); }
    window.addEventListener('load', function(){ setTimeout(restore, 300); });
})();
<\/script>`;
            html = html.replace(/<script id="__saved_defaults"[\s\S]*?<\/script>\s*/g, '');
            html = html.replace('</body>', restoreScript + '\n</body>');
            return html;
        };

        // Download the patched HTML
        const html = buildHtml();
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ddcs-studio-standalone.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
}

// t538 — DEV BUILD STAMP: when a dev server / the ES-module session cache serves STALE modules, the header version chip
// (V10.97) can't tell you WHAT you're running — burning turns on "is my page stale?". HEAD-fetch the served app.js's
// Last-Modified (the entry module's mtime, no-store) → window.__ddcsBuild + a boot log + the .ver chip TOOLTIP, so "what am
// I running" is a visible fact. Dev-cheap (one HEAD, no build pipeline); silent no-op when packaged / no server. Tracks app.js.
// t1243 — …and the stamp alone was not enough. It reports what the SERVER has; the ghost is what the BROWSER KEPT. A
// dev server sending max-age (http-server's default was 3600) lets a normal reload re-run a module the fix already
// deleted — five "it came back" reports in one day, each spent hunting code that was already gone. The servers now all
// send no-cache (package.json -c-1, fairy/server.py, the mem-server; Cloudflare Pages already sent must-revalidate),
// and this compares the two directly: what the HTTP cache would hand the module loader (force-cache) against what the
// server has right now (no-store). Different → say so, once, loudly enough to stop the hunt.
(async () => {
    try {
        const url = new URL('app.js', import.meta.url).href;
        const cached = await fetch(url, { cache: 'force-cache' }).then((r) => r.headers.get('last-modified')).catch(() => null);
        const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
        const lm = res && res.headers.get('last-modified');
        if (!lm) return;
        const stamp = new Date(lm).toISOString().replace('T', ' ').slice(0, 19) + 'Z';
        window.__ddcsBuild = stamp;
        window.__ddcsStale = !!(cached && new Date(cached).getTime() !== new Date(lm).getTime());
        console.log('[DDCS] served app.js build: ' + stamp + '  (window.__ddcsBuild)');
        if (window.__ddcsStale) {
            console.warn('[DDCS] STALE MODULE CACHE: your browser is holding app.js from '
                + new Date(cached).toISOString().replace('T', ' ').slice(0, 19) + 'Z but the server has ' + stamp
                + '. What you see is NOT this code — hard-reload (Ctrl+Shift+R).');
        }
        const setTip = () => {
            const v = document.querySelector('.ver');
            if (!v) return;
            v.title = window.__ddcsStale
                ? 'STALE: the browser cached an older app.js — hard-reload (Ctrl+Shift+R). Served build: ' + stamp
                : 'app.js build: ' + stamp + ' — served mtime; if it is older than your last edit, the tree is stale (hard-reload).';
        };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setTip); else setTip();
    } catch (_) { /* packaged / no server → no stamp */ }
})();

// Initialize application when DOM is ready
const finishBoot = () => {
    window.ddcsStudio = new DDCSStudio();
    // t1601 — ADDITIVE, not a replacement for ddcs:ready (index.html, t1279): that signal means "the deferred
    // header/menu/editor wiring below the import chain is DONE" and stays exactly where it is — the header/menu
    // race it closed stays closed because we are not touching it. This one means something narrower and earlier:
    // the wizard/canvas surface (wizardManager + its panels) is usable THE MOMENT DDCSStudio exists, well before
    // any of those deferred imports even start. Tests that drag a canvas handle never needed to wait for the menu.
    document.documentElement.dataset.ddcsInteractive = '1';
    window.dispatchEvent(new CustomEvent('ddcs:interactive'));
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', finishBoot);
} else {
    finishBoot();
}

export default DDCSStudio;
