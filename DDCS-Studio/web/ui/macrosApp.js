/**
 * ui/macrosApp.js — the MACROS main-tab view (promoted out of Settings: these are authoring surfaces,
 * not configuration). Three builders: custom M-codes (O100nn), K-buttons (key-N.nc), and the CAM Pack
 * Builder. M-codes/K-buttons persist in the profile via getSettings()/saveSettings(); the CAM pack is a
 * distributable kept in localStorage. Mounted lazily into #macros-app by showApp('macros').
 */
import { getSettings, saveSettings, openSettings } from './settingsPanel.js';
import { getActiveProfile } from '../shared/js/profiles/controllerProfiles.js';
import { FACTORY_MACROS } from '../data/factoryMacros.js';
import { makeClient } from '../shared/js/client.js';
import { fileTreeFor, flattenFiles } from '../data/controllerFiles.js';   // t662 (E1) — the per-controller file-tree declaration
import { seedBody } from '../data/controllerFileSeeds.js';                 // t662 (E1) — first-open dump seeds for plain files
import { UIUtils } from './uiUtils.js';                                    // t662 (E1) — downloadFile for the no-LAN (DM500) export transport
import * as slotPack from '../data/slotPack.js';
import { bmpDataUrl } from '../data/bmp.js';
import { openIconEditor, autoIconLayers, imageTileLayer } from './iconEditor.js';   // t1135 S5b — the inline (mounted) icon editor + the layer helpers (auto default / imported-BMP tile)
import { slotFromOp } from '../data/opToSlot.js';
import { cornerSlot, edgeSlot, probeZSlot, insideCentreSlot, bossCentreSlot, alignmentSlot } from '../data/probeToSlot.js';
import { pocketSlot, circlePocketSlot, surfacingSlot } from '../data/millToSlot.js';
import { seedFromOp, camTypeOf, isCamableType } from '../data/opCamMap.js';   // t1045 S1c — seed a CAM slot's expose/bake table from a program op. (t1131 S6 — isCamGeneratorTwin dropped with the settings Customize-op picker; the op-menu Customize still uses it in opContextMenu.js)
import { stackToSlot } from '../data/stackToSlot.js';   // U3 — the UNIVERSAL build arm: a non-generator op's def → a CAM slot (geometry baked, value params exposed)
import { subStackToSlot, walkParts } from '../data/subStackToSlot.js';
import { fieldVarCollisions, collisionMessage, maxLocalVar, bandsFor } from '../data/camScratch.js';   // t1081 — the DECLARED generator scratch bands + the build guard that refuses a slot whose form values land inside them   // S4 — a forked op containing an opunit: the standard part stays LIVE, custom atoms exposed; walkParts detects it
import { universalBands } from '../data/universalScratch.js';   // t1085 slice C — the injected band of the UNIVERSAL arm (atoms + active post), so the guard backstops that arm too

// t1085 — the camType→bands resolver the guard runs with HERE. camScratch declares the generator bands and cannot import
// universalScratch (it is a leaf by design), so this is where the two are joined: a 'universal' part is measured against
// what emitMapped injects beneath it, every other part against its own generator's declaration. After slice C a collision
// should be impossible on EITHER arm — so the guard firing now means a regression on whichever arm reported it.
const camBandsOf = (t) => ((t === 'universal') ? universalBands() : bandsFor(t));
import { getUserDef, defVOf, flattenBlocks } from '../blocks/userOps.js';   // U3 — the live def (template+bindings) for stackToSlot + the def-version stamp for the manifest; t1099 (S4a) — walk the template for cam_field block records
import { makeZip, downloadBytes } from '../data/zip.js';
import { createPreviewPanel } from '../viz/createPreviewPanel.js';
import { homingStack, homingRunParams } from '../wizards/homingWizard.js';   // homingRunParams = the ONE contract shape (t626) so sysstart generate matches the wizard emit (was passing the raw object → empty stub)
import { emitMapped } from '../blocks/blockEmitter.js';
import { activeDialectOpts } from '../wizards/previewEmit.js';   // t646 — thread the ACTIVE post into the sysstart emit like the previews (t634); homingStack already refuses non-Expert, this keeps the atom emit per-post too
import { dlgConfirm, dlgPrompt, dlgNotice } from './dialog.js';   // in-app dialogs (t684 d — no bare confirm/prompt/alert)

let _wired = false;

// --- Homing & Sysstart Constants ---
// t624 — the HOMING config GUI (constants + renderHomingGui/commitHoming/homingMove/homingConfiguredAxes) MOVED to
// Settings → Machine → Homing (it edits settings.homing = machine-profile data). This panel keeps only the sysstart
// GENERATION + a read-only summary/link. homingPostIsExpert stays here (the advstart/sysstart filename decision reads it).
const FOUNDATIONAL_M_CODES = [3, 4, 5, 6, 8, 9, 30, 50];

export function initMacrosApp() {
    const num = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
    const root = document.getElementById('macros-app');
    if (!root || _wired) return; _wired = true;

    root.innerHTML = `
        <style>
            #macros-app { display: flex; flex-direction: column; height: 100%; box-sizing: border-box; position: relative; }
            #macros-app .settings-head { padding: 8px 16px; border-bottom: 1px solid var(--border); background: var(--panel); flex: 0 0 auto; display: flex; align-items: center; }
            /* .settings-main-tab styling is shared/global in styles.css */
            #macros-app .settings-body { display: flex; flex-direction: row; flex: 1; min-height: 0; overflow: hidden; }
            #macros-app .settings-sidebar { width: 180px; flex: 0 0 180px; display: flex; flex-direction: column; gap: 2px; padding: 12px 8px; border-right: 1px solid var(--border); background: var(--panel); overflow-y: auto; }
            #macros-app .settings-sidebar .settings-tab { display: block; width: 100%; text-align: left; padding: 7px 12px; font-size: 12.5px; font-weight: 600; border-radius: var(--radius, 4px); border: none; background: transparent; color: var(--text-dim); cursor: pointer; transition: 120ms; }
            #macros-app .settings-sidebar .settings-tab:hover { background: var(--bg); color: var(--text-main); }
            #macros-app .settings-sidebar .settings-tab.active { background: var(--bg); color: var(--text-main); border-left: 3px solid var(--accent); padding-left: 9px; }
            #macros-app .settings-sidebar .sidebar-group-label { font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--text-dim); padding: 8px 12px 4px; opacity: .6; }
            #macros-app .settings-sidebar .sidebar-group-label:first-child { padding-top: 2px; }
            #macros-app .settings-sidebar .tree-level-1 { padding-left: 20px; }
            #macros-app .settings-sidebar .tree-level-1.active { padding-left: 17px; }
            #macros-app .settings-sidebar .tree-level-2 { padding-left: 32px; }
            #macros-app .settings-sidebar .tree-level-2.active { padding-left: 29px; }
            #macros-app .settings-content { flex: 1; min-width: 0; overflow-y: auto; padding: 16px 20px; background: var(--bg); }
        </style>
        <div id="macros_header" style="display:flex; align-items:center; gap:10px; padding:8px 16px; border-bottom:1px solid var(--border); background:var(--panel); flex:0 0 auto;">
            <span style="font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:var(--text-dim); opacity:.6;">Controller</span>
            <button id="macros_ctrl_chip" class="toolbar-btn settings-io" title="The active controller profile — everything here (boot macro, deploy, WCS) is generated for it. Click to change it in Settings → Controller." style="font-size:12px; padding:3px 10px; display:inline-flex; align-items:center; gap:6px; cursor:pointer;">⚙ <span id="macros_ctrl_name">…</span></button>
        </div>
        <div class="settings-body">
            <div class="settings-sidebar">
                <!-- t662 (E1) — declaration-driven file tree: renderFileTree() builds THIS from the active controller's
                     declaration (data/controllerFiles). Expert entries wrap today's builder panels; V4.1/DM500 = plain editors. -->
                <div id="macros_tree" style="display:flex; flex-direction:column; gap:2px; margin-top:4px;"></div>
                <div style="flex: 1;"></div>
                <div style="padding: 12px 4px 4px; border-top: 1px solid var(--border); margin-top: 16px;">
                    <button id="mac_btn_global_pull" class="toolbar-btn settings-io" style="width:100%; margin-bottom:8px; display:flex; justify-content:center; align-items:center; background: var(--bg); color: var(--text-main); border: 1px solid var(--border);">⬇ Load from controller</button>
                    <button id="mac_btn_global_push" class="toolbar-btn settings-io" style="width:100%; display:flex; justify-content:center; align-items:center;">⬆ Deploy to controller</button>
                </div>
            </div>
            <div class="settings-content">
                <div id="macros_panel_mcode">
                    <div class="settings-section">
                        <div class="settings-section-title">CUSTOM M-CODES</div>
                        <div class="settings-hint">Macros called <b>from a program</b> — O100nn ⇄ <b>M<i>nn</i></b> (e.g. M15 tool-break check). Build one with a wizard in Studio, then <b>＋ Add from editor</b>. <b>Generate</b> wraps it as the installable O100nn block. Saved with your Profile.</div>
                        <div id="mcodes_list"></div>
                        <div class="settings-row" style="margin-top:8px;">
                            <button class="toolbar-btn settings-io" id="mcodes_add_editor">＋ Add from editor</button>
                            <button class="toolbar-btn settings-io" id="mcodes_add_blank">＋ Add blank</button>
                        </div>
                    </div>
                </div>
                <div id="macros_panel_sysstart" style="display:none;">
                    <div class="settings-section">
                        <div class="settings-section-title" id="mac_title_sysstart">SYSSTART.NC (BOOT HOOK)</div>
                        <div class="settings-hint" id="mac_desc_sysstart">The macro the controller runs automatically at boot (auto-home, WCS restore, pin setup). It's a <b>stored macro</b> saved with your Profile — edit it directly here (your edits stick and export/import with the profile), or Regenerate it from your homing profile.</div>
                        <div id="sysstart_list">
                            <div class="settings-hint" style="margin-top: 12px; font-weight: 600;">BOOT MACRO</div>
                            <div class="settings-hint">Edit freely — your changes persist. <b>Regenerate</b> rebuilds the body from <b>Settings → Machine → Homing</b> + the additional G-code below (it asks first if you've hand-edited). <b>Push</b> sends exactly what's in this box.</div>
                            <textarea id="sysstart_body" spellcheck="false" placeholder="( boot macro — Regenerate from the homing profile, or type your own )" style="width:100%; height:220px; margin-top:6px; font:12px/1.45 monospace; box-sizing:border-box; background: var(--bg); color: var(--text-main); border: 1px solid var(--border); border-radius: 4px; padding: 8px;"></textarea>
                            <div class="settings-hint" id="sysstart_editnote" style="font-size:11px; margin-top:4px; opacity:0.75;"></div>

                            <div class="settings-hint" style="margin-top: 18px; font-weight: 600;">ADDITIONAL BOOT G-CODE <span style="font-weight:normal; opacity:0.7;">(regeneration input)</span></div>
                            <div class="settings-hint">Appended after the homing sequence when you Regenerate. Use this for <code>G54</code> restores, variable setup, or pin toggles.</div>
                            <textarea id="sysstart_custom_gcode" spellcheck="false" placeholder="(e.g. G54&#10;#100 = 1)" style="width:100%; height:70px; margin-top:6px; font:12px/1.4 monospace; box-sizing:border-box; background: var(--bg); color: var(--text-main); border: 1px solid var(--border); border-radius: 4px; padding: 8px;"></textarea>

                            <div class="settings-row" style="margin-top:12px;">
                                <button class="toolbar-btn settings-io" id="sysstart_regen">↻ Regenerate from homing profile</button>
                                <button class="toolbar-btn settings-io" id="sysstart_push">⬆ Push to controller</button>
                            </div>
                        </div>
                    </div>
                </div>
                <div id="macros_panel_tnc" style="display:none;">
                    <div class="settings-section">
                        <div class="settings-section-title">T.NC (TOOL CHANGE HOOK)</div>
                        <div class="settings-hint">Executes when an M6 tool change is called. <b>Use with caution!</b> A bad tool change macro can cause a crash.</div>
                        <div style="margin-top:12px; position:relative;">
                            <textarea id="mac_tnc_body" class="mcode-body" spellcheck="false" disabled style="width:100%; height:200px; font:13px/1.45 monospace; background:#1a1a1a; color:#d8d8d8; border:1px solid #888; border-radius:4px; padding:10px; box-sizing:border-box;" placeholder="Enter T.nc G-code here..."></textarea>
                            <div style="display:flex; justify-content:space-between; margin-top:8px;">
                                <div id="mac_tnc_status" style="font-size:12px; font-weight:600; color:var(--text-dim); display:flex; align-items:center; gap:6px;">
                                    <span style="color:#d4982c;">🔒 System hook</span> — locked to prevent accidental edits
                                </div>
                                <div style="display:flex; gap:8px;">
                                    <button class="toolbar-btn settings-io" id="mac_tnc_unlock" style="color:#d4982c;">🔓 Unlock to Edit</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div id="macros_panel_error" style="display:none;">
                    <div class="settings-section">
                        <div class="settings-section-title">ERROR.NC (ALARM HOOK)</div>
                        <div class="settings-hint">Executes when the controller throws a hard alarm. Use this to safely stop external peripherals (like disabling a plasma torch or dropping a vacuum table) before the machine halts.</div>
                        <div style="margin-top:12px; position:relative;">
                            <textarea id="mac_error_body" class="mcode-body" spellcheck="false" disabled style="width:100%; height:120px; font:13px/1.45 monospace; background:#1a1a1a; color:#d8d8d8; border:1px solid #888; border-radius:4px; padding:10px; box-sizing:border-box;" placeholder="Enter error.nc G-code here..."></textarea>
                            <div style="display:flex; justify-content:space-between; margin-top:8px;">
                                <div id="mac_error_status" style="font-size:12px; font-weight:600; color:var(--text-dim); display:flex; align-items:center; gap:6px;">
                                    <span style="color:#d4982c;">🔒 System hook</span> — locked to prevent accidental edits
                                </div>
                                <div style="display:flex; gap:8px;">
                                    <button class="toolbar-btn settings-io" id="mac_error_unlock" style="color:#d4982c;">🔓 Unlock to Edit</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div id="macros_panel_probe" style="display:none;">
                    <div class="settings-section">
                        <div class="settings-section-title">PROBE.NC</div>
                        <div class="settings-hint">Executes when you trigger probing from the controller UI.</div>
                    </div>
                </div>
                <div id="macros_panel_kbtn" style="display:none;">
                    <div class="settings-section">
                        <div class="settings-section-title">K-BUTTONS (K1–K7)</div>
                        <div class="settings-hint">The 7 panel buttons — each runs <b>key-<i>N</i>.nc</b> when pressed. Type/paste a body or <b>⇪ From editor</b>, then <b>Generate</b> for the install file. Empty = unused.</div>
                        <div id="kbuttons_list"></div>
                    </div>
                </div>
                <div id="macros_panel_cam" style="display:none;">
                    <div class="settings-section">
                        <div class="settings-section-title">CAM PACK BUILDER</div>
                        <div class="settings-hint">Author a DDCS Expert <b>CAM-menu pack</b> — parameterized macro slots for the controller's CAM page — to share with the community. Each slot = a <b>form</b> + a <b>macro</b> that reads the form live (the <code>#2600+</code> mirrors). Studio auto-allocates the shared <code>#1100–1499</code> form params and flags collisions. <i>Author each slot in the wizard — <b>＋ New CAM slot</b> composes it from your program's ops; this panel displays the pack and exports it.</i></div>
                        <div class="settings-row"><label>Pack name<input type="text" id="cam_pack_name"></label><button class="toolbar-btn settings-io" id="cam_build_slot" title="Author a CAM slot from an op in your program: seed the expose/bake table, choose which params the operator fills (Expose) vs freezes (Bake), preview, then Build to a slot.">＋ New CAM slot</button><button class="toolbar-btn settings-io" id="cam_export_pack" title="Bundle every slot (macro_camN.nc + camN.bmp) + the eng lines to merge + an install README into a USB-ready .zip.">📦 Export pack (.zip)</button><button class="toolbar-btn settings-io" id="cam_merge_eng" title="Paste the controller's CURRENT eng file → get a safely-merged eng (your pack appended, #param / -m group collisions flagged). Avoids the community full-replace mistake.">🔗 Merge eng</button></div>
                        <div id="cam_validate" class="settings-hint" style="margin-top:6px;"></div>
                        <div id="cam_slots" style="margin-top:6px;"></div>
                    </div>
                </div>
                <!-- t662 (E1) — the GENERALIZED simple editor (the autostart stored-editor pattern, per file). Rendered by
                     openFileEditor() for any declared plain file; the body is stored in settings.workspace[path]. -->
                <div id="macros_panel_file" style="display:none;"></div>
            </div>
        </div>
        <div id="macros_sync_modal" style="display:none; position:absolute; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.6); z-index:100; align-items:center; justify-content:center;">
            <div style="background:var(--panel); border:1px solid var(--border); border-radius:8px; width:450px; padding:20px; box-shadow:0 10px 30px rgba(0,0,0,0.5);">
                <div style="font-weight:700; margin-bottom:12px; font-size:16px;" id="macros_sync_title">Sync Macros</div>
                <div id="macros_sync_body" style="font-size:12.5px; color:var(--text-dim); margin-bottom:16px; line-height: 1.4;">
                    Checking connection to controller...
                </div>
                <div id="macros_sync_list" style="margin-bottom:16px; max-height:200px; overflow-y:auto; border:1px solid var(--border); border-radius:4px; padding:8px; display:none; flex-direction:column; gap:4px;">
                </div>
                <div id="macros_sync_conflict_ui" style="display:none; margin-bottom:16px; padding:12px; border:1px solid #c2410c; background:rgba(194,65,12,0.1); border-radius:4px;">
                    <div style="font-weight:600; color:#fdba74; margin-bottom:8px;">⚠️ Conflict Detected</div>
                    <div style="font-size:12px; color:var(--text-dim); margin-bottom:12px;">Some files from the controller contain M-codes or K-buttons that you have also edited locally. How would you like to handle this?</div>
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer;"><input type="radio" name="sync_conflict_strategy" value="merge" checked> <b>Merge:</b> Keep local edits, append only new items from controller.</label>
                        <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer;"><input type="radio" name="sync_conflict_strategy" value="replace"> <b>Replace:</b> Wipe local edits, strictly mirror the controller.</label>
                    </div>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:8px;">
                    <button id="macros_sync_cancel" class="toolbar-btn" style="background:transparent; border:1px solid var(--border); color:var(--text-main);">Cancel</button>
                    <button id="macros_sync_confirm" class="toolbar-btn settings-io" style="display:none;">Confirm</button>
                </div>
            </div>
        </div>
    `;

    const q = (id) => root.querySelector('#' + id);
    const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const PANEL_IDS = ['macros_panel_mcode', 'macros_panel_sysstart', 'macros_panel_tnc', 'macros_panel_error', 'macros_panel_probe', 'macros_panel_kbtn', 'macros_panel_cam', 'macros_panel_file'];
    // Show a panel (external API + Expert builder wraps). Active class is managed per-item by the tree click handler.
    const mShowPanel = (id) => {
        PANEL_IDS.forEach((p) => { const el = q(p); if (el) el.style.display = (p === id) ? '' : 'none'; });
        root.querySelectorAll('#macros_tree .settings-tab').forEach((b) => b.classList.toggle('active', b.dataset.target === id && !b.dataset.file));
    };
    window.showMacrosPanel = mShowPanel;

    // ── t662 (E1) — the DECLARATION-DRIVEN FILE TREE. The active controller's declaration (data/controllerFiles) builds
    // the sidebar ALWAYS (offline included). Expert entries carry `panel` → wrap today's builder panels (byte-identical);
    // plain entries carry `editable` → open the generalized simple editor. Re-renders on a controller switch. ──
    function selectTreeItem(btn) {
        root.querySelectorAll('#macros_tree .settings-tab').forEach((b) => b.classList.toggle('active', b === btn));
        PANEL_IDS.forEach((p) => { const el = q(p); if (el) el.style.display = (p === btn.dataset.target) ? '' : 'none'; });
        if (btn.dataset.file) openFileEditor(btn.dataset.file);
    }
    // t664 (E3) — the user's OWN files (add/rename/delete). They live in settings.workspaceFiles (the list) + their body
    // in settings.workspace (like a baseline edit), so they ride the profile. The declared baseline is IMMUTABLE.
    const userFilesArr = () => (getSettings().workspaceFiles || (getSettings().workspaceFiles = []));
    const isUserFile = (path) => userFilesArr().some((f) => f.path === path);
    // Validate a proposed user-file name → a normalized name (adds .nc if no .nc/.rc), or null (alerts why).
    function validFileName(raw, cid, exclude) {
        let n = String(raw == null ? '' : raw).trim();
        if (!n) return null;
        if (/[\\/]/.test(n)) { dlgNotice('File names can’t contain slashes.'); return null; }
        if (!/\.(nc|rc)$/i.test(n)) n += '.nc';   // DDCS macro convention
        if (flattenFiles(cid).some((e) => e.path.toLowerCase() === n.toLowerCase())) { dlgNotice('“' + n + '” is a built-in controller file — pick another name.'); return null; }
        if (userFilesArr().some((f) => f.path.toLowerCase() === n.toLowerCase() && f.path.toLowerCase() !== String(exclude || '').toLowerCase())) { dlgNotice('You already have a file named “' + n + '”.'); return null; }
        return n;
    }
    async function addUserFile() {
        const cid = (getActiveProfile() || {}).id || 'ddcs-expert-m350';
        const name = validFileName(await dlgPrompt('New file name (e.g. myprobe.nc):', ''), cid);
        if (!name) return;
        userFilesArr().push({ path: name, title: name, sub: 'Your file' });
        (getSettings().workspace || (getSettings().workspace = {}))[name] = '';
        saveSettings();
        renderFileTree(name);   // rebuild + open the new file
    }
    async function renameUserFile(path) {
        const cid = (getActiveProfile() || {}).id || 'ddcs-expert-m350';
        const name = validFileName(await dlgPrompt('Rename file:', path), cid, path);
        if (!name || name === path) return;
        const f = userFilesArr().find((x) => x.path === path); if (f) { f.path = name; f.title = name; }
        const ws = getSettings().workspace || (getSettings().workspace = {});
        ws[name] = typeof ws[path] === 'string' ? ws[path] : ''; delete ws[path];
        saveSettings();
        renderFileTree(name);
    }
    async function deleteUserFile(path) {
        if (!await dlgConfirm('Delete “' + path + '”? It’s removed from this profile.')) return;
        const arr = userFilesArr(); const i = arr.findIndex((x) => x.path === path); if (i >= 0) arr.splice(i, 1);
        if (getSettings().workspace) delete getSettings().workspace[path];
        saveSettings();
        renderFileTree();
    }

    function renderFileTree(selectPath) {
        const host = q('macros_tree'); if (!host) return;
        const cid = (getActiveProfile() || {}).id || 'ddcs-expert-m350';
        const decl = fileTreeFor(cid);
        const fileBtn = (f, level, user) => {
            const target = f.panel || 'macros_panel_file';
            const fileAttr = f.panel ? '' : ` data-file="${esc(f.path)}"`;
            const dot = user ? '<span style="color:var(--accent); margin-right:4px;" aria-hidden="true">•</span>' : '';
            return `<button class="settings-tab tree-level-${level}" data-target="${target}"${fileAttr}${user ? ' data-user="1"' : ''} style="margin-top:2px; line-height:1.3;">`
                + `<div style="text-transform:none; font-size:12px;">${dot}${esc(f.title || f.path)}</div>`
                + `<div style="font-size:9px; font-weight:normal; opacity:.6; margin-top:2px;">${esc(f.sub || '')}</div></button>`;
        };
        const renderNodes = (nodes, level) => nodes.map((n) => {
            if (n.group) return `<details open style="margin-top:2px;"><summary class="sidebar-group-label" style="padding-left:${level === 1 ? 4 : 12}px; font-size:11px; cursor:pointer; outline:none;">${esc(n.group)}</summary>`
                + renderNodes(n.children || [], level + 1) + `</details>`;
            return fileBtn(n, level);
        }).join('');
        // "My files/" — the user's own files (E3), visually distinct (accent dot), under their own group.
        const users = userFilesArr();
        const userGroup = users.length
            ? `<details open style="margin-top:6px;"><summary class="sidebar-group-label" style="padding-left:4px; font-size:11px; cursor:pointer; outline:none;">My files/</summary>`
                + users.map((f) => fileBtn({ path: f.path, title: f.title || f.path, sub: f.sub || 'Your file' }, 2, true)).join('') + `</details>`
            : '';
        host.innerHTML = (renderNodes(decl.tree || [], 1) || '<div class="settings-hint" style="padding:8px 4px;">No declared files for this controller yet.</div>')
            + userGroup
            + `<button id="mac_add_file" class="toolbar-btn settings-io" style="width:calc(100% - 8px); margin:10px 4px 0; justify-content:center;">＋ New file</button>`;
        host.querySelectorAll('.settings-tab').forEach((b) => b.addEventListener('click', () => selectTreeItem(b)));
        if (q('mac_add_file')) q('mac_add_file').addEventListener('click', addUserFile);
        // transport: DM500 (export) has no LAN → hide the global pull/deploy buttons (per-file Export replaces them).
        const lan = decl.transport !== 'export';
        if (q('mac_btn_global_pull')) q('mac_btn_global_pull').style.display = lan ? '' : 'none';
        if (q('mac_btn_global_push')) q('mac_btn_global_push').style.display = lan ? '' : 'none';
        const btns = [...host.querySelectorAll('.settings-tab')];
        const target = (selectPath && btns.find((b) => b.dataset.file === selectPath)) || btns[0];
        if (target) selectTreeItem(target);   // open the requested file, else the first (Expert → slib-m.nc / M-codes)
    }

    // The generalized simple editor. Body stored IN THE PROFILE (settings.workspace[path]). A baseline file DISPLAYS its
    // declared dump seed until edited (→ Revert to default); a USER file is renamable/deletable. Transport per declaration.
    function openFileEditor(path) {
        const panel = q('macros_panel_file'); if (!panel) return;
        const cid = (getActiveProfile() || {}).id || 'ddcs-expert-m350';
        const user = isUserFile(path);
        const entry = user ? { path, title: path, sub: 'Your file' } : (flattenFiles(cid).find((e) => e.path === path) || { path, title: path, sub: '' });
        const isExport = fileTreeFor(cid).transport === 'export';
        const ws = getSettings().workspace || (getSettings().workspace = {});
        const edited = typeof ws[path] === 'string';
        const seed = user ? '' : seedBody(cid, path);
        const body = edited ? ws[path] : seed;
        const canRevert = !user;   // BASELINE files are immutable structure — their EDITS revert to the shipped default
        panel.innerHTML = `
            <div class="settings-section">
                <div class="settings-section-title">${esc(entry.title || path)}${user ? ' <span style="font-size:11px; font-weight:normal; opacity:.6;">· your file</span>' : ''}</div>
                <div class="settings-hint">${esc(entry.sub || '')} — a <b>stored file</b> saved with your Profile (edits persist, and ride Export/Import + cloud). ${isExport ? 'This controller has no LAN link — <b>Export</b> the file to copy it over by USB.' : '<b>Push</b> sends it to the controller.'}</div>
                <textarea id="macfile_body" spellcheck="false" style="width:100%; height:300px; margin-top:8px; font:12px/1.45 monospace; box-sizing:border-box; background:var(--bg); color:var(--text-main); border:1px solid var(--border); border-radius:4px; padding:8px;" placeholder="( ${esc(path)} — type the file body, or leave empty )"></textarea>
                <div class="settings-hint" id="macfile_note" style="font-size:11px; margin-top:4px; opacity:.75;"></div>
                <div class="settings-row" style="margin-top:12px;">
                    <button class="toolbar-btn settings-io" id="macfile_send">${isExport ? '⬇ Export (save file)' : '⬆ Push to controller'}</button>
                    ${user
                        ? `<button class="toolbar-btn settings-io" id="macfile_rename">✎ Rename</button><button class="toolbar-btn settings-io" id="macfile_delete" title="Delete this file from the profile.">🗑 Delete</button>`
                        : (canRevert ? `<button class="toolbar-btn settings-io" id="macfile_revert" title="Discard your edits — restore the baseline copy Studio ships for this controller.">↺ Revert to default</button>` : '')}
                </div>
            </div>`;
        const ta = panel.querySelector('#macfile_body');
        const note = panel.querySelector('#macfile_note');
        ta.value = body;
        const setNote = () => {
            if (user) { note.textContent = '● Your file — stored in this profile' + (isExport ? ' (Export to USB).' : ' (Push to the controller).'); return; }
            const e = typeof getSettings().workspace[path] === 'string';
            note.textContent = e ? '● Edited — stored in this profile.' : (seed ? '○ Showing the shipped baseline (edit to store your own in this profile).' : '○ Empty — no baseline shipped; type your own (stored in this profile).');
        };
        setNote();
        ta.addEventListener('input', () => { (getSettings().workspace || (getSettings().workspace = {}))[path] = ta.value; saveSettings(); setNote(); });
        const send = panel.querySelector('#macfile_send');
        if (send) send.addEventListener('click', async () => {
            const content = ta.value;
            if (isExport) { UIUtils.downloadFile(path, content); return; }
            if (!await dlgConfirm('Push “' + path + '” to the controller? This overwrites the file on the machine.')) return;
            const orig = send.textContent; send.disabled = true; send.textContent = 'Pushing…';
            makeClient().writeSysfile(path, content, 'write')
                .then((r) => { dlgNotice(r && r.ok ? ('Pushed “' + path + '”.' + (r.backup ? ' (backup: ' + r.backup + ')' : '')) : ('Push failed: ' + ((r && r.error) || 'no controller'))); })
                .catch((e) => dlgNotice('Push failed: ' + (e && e.message ? e.message : e)))
                .finally(() => { send.disabled = false; send.textContent = orig; });
        });
        const rename = panel.querySelector('#macfile_rename'); if (rename) rename.addEventListener('click', () => renameUserFile(path));
        const del = panel.querySelector('#macfile_delete'); if (del) del.addEventListener('click', () => deleteUserFile(path));
        const revert = panel.querySelector('#macfile_revert');
        if (revert) revert.addEventListener('click', async () => {
            if (!await dlgConfirm('Discard your edits to “' + path + '” and restore the default baseline?')) return;
            if (getSettings().workspace) delete getSettings().workspace[path];
            saveSettings();
            openFileEditor(path);   // refresh: now unedited → shows the seed again
        });
    }

    // t656 (amend 2) — the SELECTED CONTROLLER chip in the Macros header strip: what everything here is generated for.
    // Click → Settings → Controller (the openSettings deep-link). Re-renders on a profile switch, like the rest.
    function renderMacrosCtrlChip() {
        const n = q('macros_ctrl_name'); if (!n) return;
        n.textContent = (getActiveProfile() || {}).name || 'DDCS Expert M350';
    }
    if (q('macros_ctrl_chip')) q('macros_ctrl_chip').addEventListener('click', () => { if (window.openSettings) window.openSettings({ group: 'controller', panel: 'set_tab_profile' }); });
    renderMacrosCtrlChip();
    renderFileTree();   // t662 (E1) — build the ACTIVE controller's file tree at mount
    let _lastTreeCtrl = (getActiveProfile() || {}).id;
    window.addEventListener('ddcs:settings-changed', () => {
        renderMacrosCtrlChip();
        const cid = (getActiveProfile() || {}).id;
        if (cid !== _lastTreeCtrl) { _lastTreeCtrl = cid; renderFileTree(); }   // rebuild the tree ONLY on a controller switch (not on every edit → the editor keeps focus)
        if (typeof updateSysstartEditNote === 'function') updateSysstartEditNote();
    });

    // --- Macros: author controller macros (M-code O100nn / K-button key-N); saved in the profile. ---
    const macrosArr = () => (getSettings().macros || (getSettings().macros = []));
    const editorText = () => { const e = document.getElementById('editor'); return e ? e.value : ''; };
    function macroFileText(m) {
        const name = (m.name || 'macro').trim();
        const body = String(m.body || '').replace(/\r/g, '').replace(/\s+$/, '');
        const t = m.trigger || {};
        const hasEnd = /\b(M99|M30|M0?2)\b/.test(body);
        if (t.kind === 'mcode') { const n = Math.max(0, parseInt(t.code, 10) || 0); return `O${10000 + n} ( ${name} — M${n} )\n${body}${hasEnd ? '' : '\nM99'}\n`; }
        if (t.kind === 'kbutton') { const k = Math.min(7, Math.max(1, parseInt(t.key, 10) || 1)); return `( save as key-${k}.nc on SYSDISK — K${k} button )\n${body}${hasEnd ? '' : '\nM30'}\n`; }
        return `( save as ${(name || 'macro').replace(/[^\w-]+/g, '_')}.nc )\n${body}${hasEnd ? '' : '\nM30'}\n`;
    }
    const insertToEditor = (txt) => { const em = (window.ddcsStudio && window.ddcsStudio.editorManager) || window.editorManager; if (em && typeof em.insert === 'function') em.insert(txt); else dlgNotice('Editor not available.'); };
    const findKbtn = (k) => macrosArr().find((m) => (m.trigger || {}).kind === 'kbutton' && (m.trigger || {}).key === k);
    const ensureKbtn = (k) => { let m = findKbtn(k); if (!m) { m = { name: '', trigger: { kind: 'kbutton', key: k }, body: '' }; macrosArr().push(m); } return m; };
    async function pushMcode(m) {
        const n = parseInt((m.trigger || {}).code, 10) || 0; const oNum = 'O' + (10000 + n);
        if (!await dlgConfirm(`Merge M${n} (${oNum}) into the controller's macro library (slib-m.nc)?\n\nThe existing slib-m.nc is backed up first (slib-m.nc.bak). You must REBOOT the controller afterward for it to load.`)) return;
        try {
            const cur = await makeClient().readSysfile('slib-m.nc');
            if (!cur || cur.ok === false) { dlgNotice('Could not read slib-m.nc — needs the gateway/desktop app + a connected controller.' + (cur && cur.error ? '\n(' + cur.error + ')' : '')); return; }
            if (new RegExp('(^|\\s)' + oNum + '(\\s|$)').test(cur.content || '')) { dlgNotice(`${oNum} is already in slib-m.nc — remove it on the controller first so it isn't duplicated, then push again.`); return; }
            const res = await makeClient().writeSysfile('slib-m.nc', '\n' + macroFileText(m), 'append');
            if (res && res.ok) dlgNotice(`Merged ${oNum} (M${n}) into slib-m.nc${res.backup ? ' — backup ' + res.backup : ''}.\n\nReboot the controller to load it; then M${n} is callable from a program.`);
            else dlgNotice('Push failed: ' + ((res && res.error) || 'unknown'));
        } catch (err) { dlgNotice('Push failed: ' + (err && err.message ? err.message : err)); }
    }
    async function pushKbutton(k, m) {
        if (!await dlgConfirm(`Write key-${k}.nc to the controller (the K${k} button)?\n\nThe existing key-${k}.nc is backed up first (key-${k}.nc.bak).`)) return;
        try {
            const res = await makeClient().writeSysfile('key-' + k + '.nc', macroFileText(m), 'write');
            if (res && res.ok) dlgNotice(`Wrote key-${k}.nc${res.backup ? ' — backup ' + res.backup : ''}.\nPress K${k} to run it (reboot if the controller doesn't pick it up).`);
            else dlgNotice('Push failed: ' + ((res && res.error) || 'needs the gateway/desktop app + a connected controller'));
        } catch (err) { dlgNotice('Push failed: ' + (err && err.message ? err.message : err)); }
    }
    function renderMcodes() {
        const host = q('mcodes_list'); if (!host) return;
        const rows = macrosArr().map((m, i) => ({ m, i })).filter((x) => (x.m.trigger || {}).kind === 'mcode');
        if (!rows.length) { host.innerHTML = '<div class="settings-hint">No custom M-codes yet — “＋ Add from editor” or “＋ Add blank”.</div>'; return; }
        host.innerHTML = rows.map(({ m, i }) => {
            const code = (m.trigger || {}).code != null ? parseInt(m.trigger.code, 10) : 15;
            const isSys = FOUNDATIONAL_M_CODES.includes(code);
            const locked = isSys && !m.unlocked;
            const dis = locked ? 'disabled' : '';
            return `<div class="macro-card" data-i="${i}" style="border:1px solid var(--border); border-radius:6px; padding:8px; margin-bottom:8px;">
                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                    <label style="font-size:11px; color:var(--text-dim);">M<input type="number" class="mc-f" data-f="num" value="${code}" min="0" max="99" style="width:52px; margin-left:2px;" ${dis}></label>
                    <input class="mc-f" data-f="name" value="${String(m.name || '').replace(/"/g, '&quot;')}" placeholder="Name" style="flex:1; min-width:120px;" ${dis}>
                    <span class="mc-o" style="font-size:10px; color:var(--text-dim);">→ O${10000 + code}</span>
                </div>
                <textarea class="mc-f" data-f="body" spellcheck="false" placeholder="macro body (G-code)" style="width:100%; height:110px; margin-top:6px; font:12px/1.4 monospace; box-sizing:border-box;" ${dis}>${String(m.body || '').replace(/</g, '&lt;')}</textarea>
                <div class="settings-row" style="margin-top:6px;">
                    <button class="toolbar-btn settings-io" data-act="gen">⬇ Generate</button>
                    <button class="toolbar-btn settings-io" data-act="push">⬆ Push to controller</button>
                    ${isSys ? `<button class="toolbar-btn settings-io" data-act="restore">↺ Revert to Factory</button>` : ''}
                    ${locked ? `<button class="toolbar-btn settings-io" data-act="unlock" style="color:#d4982c;">🔓 Unlock to Edit</button>` : ''}
                    <span style="flex:1"></span>
                    ${!isSys ? `<button class="op-btn" data-act="del" title="Delete">✕</button>` : ''}
                </div>
            </div>`;
        }).join('');
    }
    function renderKbuttons() {
        const host = q('kbuttons_list'); if (!host) return;
        let html = '';
        for (let k = 1; k <= 7; k++) {
            const m = findKbtn(k);
            html += `<div class="kbtn-row" data-k="${k}" style="border:1px solid var(--border); border-radius:6px; padding:8px; margin-bottom:8px;">
                <div style="display:flex; gap:8px; align-items:center;">
                    <b style="width:30px;">K${k}</b>
                    <input class="kb-f" data-f="name" value="${m ? String(m.name || '').replace(/"/g, '&quot;') : ''}" placeholder="(unused)" style="flex:1;">
                    <span style="font-size:10px; color:var(--text-dim);">key-${k}.nc</span>
                </div>
                <textarea class="kb-f" data-f="body" spellcheck="false" placeholder="button macro body" style="width:100%; height:80px; margin-top:6px; font:12px/1.4 monospace; box-sizing:border-box;">${m ? String(m.body || '').replace(/</g, '&lt;') : ''}</textarea>
                <div class="settings-row" style="margin-top:6px;"><button class="toolbar-btn settings-io" data-act="ked">⇪ From editor</button><button class="toolbar-btn settings-io" data-act="kgen">⬇ Generate</button><button class="toolbar-btn settings-io" data-act="kpush">⬆ Push</button><span style="flex:1"></span><button class="op-btn" data-act="kclr" title="Clear">✕</button></div>
            </div>`;
        }
        host.innerHTML = html;
    }
    const mch = q('mcodes_list');
    if (mch) {
        mch.addEventListener('input', (e) => {
            const c = e.target.closest('.macro-card'); if (!c || !e.target.dataset.f) return;
            const m = macrosArr()[+c.dataset.i]; if (!m) return; const f = e.target.dataset.f;
            if (f === 'name') m.name = e.target.value;
            else if (f === 'body') m.body = e.target.value;
            else if (f === 'num') { m.trigger = m.trigger || { kind: 'mcode' }; m.trigger.kind = 'mcode'; m.trigger.code = parseInt(e.target.value, 10) || 0; const s = c.querySelector('.mc-o'); if (s) s.textContent = '→ O' + (10000 + m.trigger.code); }
            saveSettings();
        });
        mch.addEventListener('click', async (e) => {
            const c = e.target.closest('.macro-card'); if (!c) return; const i = +c.dataset.i; const a = e.target.dataset.act;
            const m = macrosArr()[i];
            if (a === 'del') { 
                const code = (m.trigger || {}).code != null ? parseInt(m.trigger.code, 10) : null;
                if (FOUNDATIONAL_M_CODES.includes(code)) {
                    if (!await dlgConfirm(`M${code} is a foundational system M-code. Deleting it may break basic controller functionality (like spindle or coolant).\n\nAre you absolutely sure you want to delete it?`)) return;
                }
                macrosArr().splice(i, 1); 
                saveSettings(); 
                renderMcodes(); 
            }
            else if (a === 'unlock') {
                m.unlocked = true;
                saveSettings();
                renderMcodes();
            }
            else if (a === 'restore') {
                const code = (m.trigger || {}).code != null ? parseInt(m.trigger.code, 10) : null;
                if (!await dlgConfirm(`This will overwrite your current M${code} macro with the factory default for your active controller.\n\nAre you sure you want to revert to the original code?`)) return;
                
                const profileId = (getActiveProfile() || {}).id || 'ddcs-expert-m350';
                const factory = FACTORY_MACROS[profileId] || [];
                const pristine = factory.find(fm => (fm.trigger || {}).kind === 'mcode' && fm.trigger.code === code);
                
                if (pristine) {
                    m.body = pristine.body;
                    m.unlocked = false; // re-lock after restoring
                    saveSettings();
                    renderMcodes();
                } else {
                    dlgNotice('Could not find the factory default code for this macro.');
                }
            }
            else if (a === 'gen') insertToEditor(macroFileText(macrosArr()[i]));
            else if (a === 'push') pushMcode(macrosArr()[i]);
        });
    }
    const kbh = q('kbuttons_list');
    if (kbh) {
        kbh.addEventListener('input', (e) => { const r = e.target.closest('.kbtn-row'); if (!r || !e.target.dataset.f) return; const m = ensureKbtn(+r.dataset.k); if (e.target.dataset.f === 'name') m.name = e.target.value; else m.body = e.target.value; saveSettings(); });
        kbh.addEventListener('click', (e) => {
            const r = e.target.closest('.kbtn-row'); if (!r) return; const k = +r.dataset.k; const a = e.target.dataset.act;
            if (a === 'ked') { ensureKbtn(k).body = editorText().trim(); saveSettings(); renderKbuttons(); }
            else if (a === 'kgen') { const m = findKbtn(k); if (!m || !String(m.body).trim()) { dlgNotice('K' + k + ' is empty.'); return; } insertToEditor(macroFileText(m)); }
            else if (a === 'kpush') { const m = findKbtn(k); if (!m || !String(m.body).trim()) { dlgNotice('K' + k + ' is empty.'); return; } pushKbutton(k, m); }
            else if (a === 'kclr') { const i = macrosArr().findIndex((x) => (x.trigger || {}).kind === 'kbutton' && (x.trigger || {}).key === k); if (i >= 0) macrosArr().splice(i, 1); saveSettings(); renderKbuttons(); }
        });
    }
    const _mcAddEd = q('mcodes_add_editor');
    if (_mcAddEd) _mcAddEd.addEventListener('click', () => { macrosArr().push({ name: 'New M-code', trigger: { kind: 'mcode', code: 15 }, body: editorText().trim() }); saveSettings(); renderMcodes(); });
    const _mcAddBlank = q('mcodes_add_blank');
    if (_mcAddBlank) _mcAddBlank.addEventListener('click', () => { macrosArr().push({ name: 'New M-code', trigger: { kind: 'mcode', code: 15 }, body: '' }); saveSettings(); renderMcodes(); });
    
    function renderSystemHooks() {
        const hooks = getSettings().systemHooks || {};
        const T = hooks.T || '';
        const T_unl = !!hooks.T_unlocked;
        const err = hooks.error || '';
        const err_unl = !!hooks.error_unlocked;
        
        const tb = q('mac_tnc_body');
        if (tb) {
            tb.value = T;
            tb.disabled = !T_unl;
            tb.style.borderColor = T_unl ? 'var(--accent)' : '#888';
            q('mac_tnc_unlock').style.display = T_unl ? 'none' : '';
            q('mac_tnc_status').innerHTML = T_unl ? '<span style="color:var(--accent);">🔓 Unlocked</span> — edits will be deployed' : '<span style="color:#d4982c;">🔒 System hook</span> — locked to prevent accidental edits';
        }
        
        const eb = q('mac_error_body');
        if (eb) {
            eb.value = err;
            eb.disabled = !err_unl;
            eb.style.borderColor = err_unl ? 'var(--accent)' : '#888';
            q('mac_error_unlock').style.display = err_unl ? 'none' : '';
            q('mac_error_status').innerHTML = err_unl ? '<span style="color:var(--accent);">🔓 Unlocked</span> — edits will be deployed' : '<span style="color:#d4982c;">🔒 System hook</span> — locked to prevent accidental edits';
        }
    }

    if (q('mac_tnc_body')) q('mac_tnc_body').addEventListener('input', (e) => {
        getSettings().systemHooks = getSettings().systemHooks || {};
        getSettings().systemHooks.T = e.target.value;
        saveSettings();
    });
    if (q('mac_error_body')) q('mac_error_body').addEventListener('input', (e) => {
        getSettings().systemHooks = getSettings().systemHooks || {};
        getSettings().systemHooks.error = e.target.value;
        saveSettings();
    });
    
    if (q('mac_tnc_unlock')) q('mac_tnc_unlock').addEventListener('click', async () => {
        if (!await dlgConfirm('T.nc executes on every tool change. Errors here can cause crashes.\n\nAre you sure you want to unlock it?')) return;
        getSettings().systemHooks = getSettings().systemHooks || {};
        getSettings().systemHooks.T_unlocked = true;
        saveSettings();
        renderSystemHooks();
    });
    if (q('mac_error_unlock')) q('mac_error_unlock').addEventListener('click', () => {
        getSettings().systemHooks = getSettings().systemHooks || {};
        getSettings().systemHooks.error_unlocked = true;
        saveSettings();
        renderSystemHooks();
    });

    // Render the initial states
    renderMcodes();
    renderKbuttons();
    renderSystemHooks();

    // ── AUTOSTART = a STORED, profile-persisted macro (t656, user design). The body is an editable ARTIFACT
    //    (settings.autostartBody, saved via saveSettings → exports/imports with the profile, survives sessions), like
    //    the M-code / K-button siblings. Regenerate rebuilds it from the homing profile + the additional G-code (both
    //    STORED inputs → deterministic); hand edits STICK until an explicit regenerate (confirm before clobbering).
    function buildAutostartBody() {
        let code = emitMapped(homingStack(homingRunParams(getSettings())), activeDialectOpts()).text || '';   // t626/t646 — the REAL homing sequence, per active post
        code = code.replace(/\s*M30\s*$/, '');   // t656 — strip the homing emit's trailing M30: the additional G-code must run BEFORE the program end, and the body ends with ONE M30 (a human caught the double-M30 + dead trailing custom)
        // t899 — the t822 #520 auto-seed is REMOVED. Studio never injects config into the user's boot macro (the editor is a
        // user-authored surface). #520 is now READ-ONLY to every emitted program: the safeRetract guard READS it with a baked-
        // margin fallback (dialect.safeRetract), so a machine that never got a #520 push is still safe. The ONLY sanctioned
        // write is the Settings safe-Z margin field's Apply-Now button (a deliberate one-line run-once job). See varMap #520.
        const custom = String(getSettings().sysstartCustomGcode || '').trim();
        if (custom) code += '\n( --- Additional Boot G-code --- )\n' + custom;
        code += '\nM30\n';
        return code;
    }
    const curProfileId = () => (getActiveProfile() || {}).id || 'ddcs-expert-m350';
    const curProfileName = () => (getActiveProfile() || {}).name || 'DDCS Expert M350';
    // t696 a — a FINGERPRINT of the generator INPUTS (the homingRunParams contract + the additional-G-code field). Stored
    // with the body so the editor can flag a SILENT staleness: a homing-config change (e.g. a dual-Y enable, a feed) that
    // the old note (controller-mismatch only) missed. djb2 over the JSON — small + drift-exact.
    function autostartGenSig() {
        try { const s = JSON.stringify(homingRunParams(getSettings())) + ' ' + String(getSettings().sysstartCustomGcode || ''); let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h >>> 0); }
        catch (e) { return ''; }
    }
    // Record the body + WHICH profile it was built for (t656 amend 1) + the generator-input fingerprint (t696 a).
    function storeAutostartBody(body, handEdited) { getSettings().autostartBody = body; getSettings().autostartHandEdited = !!handEdited; getSettings().autostartProfileId = curProfileId(); getSettings().autostartGenSig = autostartGenSig(); saveSettings(); }
    function updateSysstartEditNote() {
        const n = q('sysstart_editnote'); if (!n) return;
        const genFor = getSettings().autostartProfileId, cur = curProfileId();
        if (genFor && genFor !== cur) {   // t656 amend 1 — a stored body built under a DIFFERENT profile than the selected one is FLAGGED (can't masquerade)
            n.innerHTML = `⚠ Generated for <b>${genFor}</b> — Regenerate for the selected <b>${curProfileName()}</b> before pushing (it would otherwise send the wrong controller's boot macro).`;
            n.style.color = 'var(--warn, #d1902b)';
            return;
        }
        // t696 a — STALENESS: the generator inputs (homing config + additional G-code) drifted since this body was built,
        // but the controller is unchanged. Flag it (a clean body only — a hand-edit shows its own note; Regenerate picks up
        // the drift either way). Legacy bodies without a stored sig are treated as in-sync (no false alarm).
        const storedSig = getSettings().autostartGenSig;
        if (!getSettings().autostartHandEdited && storedSig && storedSig !== autostartGenSig()) {
            n.innerHTML = '⚠ The homing profile changed since this was generated — <b>Regenerate</b> to rebuild the boot macro.';
            n.style.color = 'var(--warn, #d1902b)';
            return;
        }
        n.style.color = '';
        n.textContent = getSettings().autostartHandEdited
            ? '✎ Hand-edited since the last regenerate — Regenerate will ask before overwriting.'
            : 'In sync with the homing profile — Regenerate rebuilds it; edit to customize (your edits stick).';
    }
    // t696 a — a homing-config change (dispatched by Settings) live-refreshes the staleness note (no-op when the panel is closed).
    window.addEventListener('ddcs:settings-changed', () => { try { updateSysstartEditNote(); } catch (_) { /* */ } });
    if (q('sysstart_body')) {
        // MIGRATE: first open with no stored body → seed it via one regenerate (for the SELECTED profile) so it's never empty.
        if (getSettings().autostartBody == null) storeAutostartBody(buildAutostartBody(), false);
        q('sysstart_body').value = getSettings().autostartBody || '';
        q('sysstart_body').addEventListener('input', (e) => { getSettings().autostartBody = e.target.value; getSettings().autostartHandEdited = true; saveSettings(); updateSysstartEditNote(); });   // a hand edit keeps the recorded profile (it's still that profile's body, edited)
        updateSysstartEditNote();
    }
    if (q('sysstart_custom_gcode')) {
        q('sysstart_custom_gcode').value = getSettings().sysstartCustomGcode || '';
        q('sysstart_custom_gcode').addEventListener('change', (e) => {
            getSettings().sysstartCustomGcode = e.target.value;
            saveSettings();
        });
    }

    // --- Global Sync Logic ---
    const SYNC_FILES = ['slib-m.nc', 'sysstart.nc', 'advstart.nc', 'T.nc', 'error.nc', 'probe.nc', 'key-1.nc', 'key-2.nc', 'key-3.nc', 'key-4.nc', 'key-5.nc', 'key-6.nc', 'key-7.nc'];
    
    let currentSyncFiles = {};
    let syncMode = 'pull';

    const parseMcodeLibrary = (text) => {
        const found = [];
        const regex = /O100(\d{2})[ \t]*(?:\(\s*([^)\n]*?)\s*\))?\r?\n([\s\S]*?)(?=O100\d{2}|$)/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
            let body = match[3].trim();
            body = body.replace(/M99\s*$/, '').trim(); // strip trailing M99
            let name = match[2] ? match[2].replace(/— M\d+/, '').trim() : '';
            found.push({
                name: name || 'Extracted M' + parseInt(match[1], 10),
                trigger: { kind: 'mcode', code: parseInt(match[1], 10) },
                body: body
            });
        }
        return found;
    };

    const performPull = async (strategy) => {
        const checked = [...q('macros_sync_list').querySelectorAll('input[type="checkbox"]:checked')].map(cb => cb.value);
        if (!checked.length) return;
        
        let mcodeUpdates = [];
        let kbtnUpdates = [];
        
        for (const file of checked) {
            const content = currentSyncFiles[file];
            if (!content) continue;
            
            if (file === 'slib-m.nc') {
                mcodeUpdates = parseMcodeLibrary(content);
            } else if (file.startsWith('key-')) {
                const num = parseInt(file.replace(/\D/g, ''), 10);
                let body = content.trim();
                body = body.replace(/M30\s*$/, '').trim(); // strip trailing M30
                // Try to extract name from first comment line
                let name = `K${num}`;
                const lines = body.split('\n');
                if (lines[0].startsWith('(') && lines[0].endsWith(')')) {
                    const cmt = lines.shift().replace(/^\(|\)$/g, '').trim();
                    if (cmt.includes('—')) name = cmt.split('—').pop().trim();
                    body = lines.join('\n').trim();
                }
                kbtnUpdates.push({
                    name: name,
                    trigger: { kind: 'kbutton', key: num },
                    body: body
                });
            } else if (file === 'sysstart.nc' || file === 'advstart.nc') {
                // t656 — the pulled boot macro IS the stored body (edit it directly in the sysstart panel). It's an EXTERNAL
                // body (the machine's real boot macro), so it's hand-edited — a Regenerate would overwrite it (with a confirm).
                if (strategy === 'replace') {
                    getSettings().autostartBody = content;
                } else if (strategy === 'merge') {
                    getSettings().autostartBody = (getSettings().autostartBody || '') + '\n\n' + content;
                }
                getSettings().autostartHandEdited = true;
            }
        }
        
        const existing = macrosArr();
        
        if (strategy === 'replace') {
            if (checked.includes('slib-m.nc')) {
                // Remove all local mcodes
                for (let i = existing.length - 1; i >= 0; i--) {
                    if ((existing[i].trigger || {}).kind === 'mcode') existing.splice(i, 1);
                }
            }
            const pulledKeys = kbtnUpdates.map(u => (u.trigger || {}).key);
            for (let i = existing.length - 1; i >= 0; i--) {
                const t = existing[i].trigger || {};
                if (t.kind === 'kbutton' && pulledKeys.includes(t.key)) existing.splice(i, 1);
            }
        }
        
        // Merge in new
        const allUpdates = [...mcodeUpdates, ...kbtnUpdates];
        for (const u of allUpdates) {
            const tk = u.trigger.kind;
            const tv = tk === 'mcode' ? u.trigger.code : u.trigger.key;
            
            const matchIdx = existing.findIndex(m => (m.trigger || {}).kind === tk && ((m.trigger || {}).code === tv || (m.trigger || {}).key === tv));
            if (matchIdx >= 0) {
                if (strategy === 'replace') existing[matchIdx] = u;
                // If strategy === 'merge', we KEEP local and ignore pulled
            } else {
                existing.push(u);
            }
        }
        
        getSettings().macrosSynced = true;
        saveSettings();
        renderMcodes();
        renderKbuttons();
        if (q('sysstart_custom_gcode')) q('sysstart_custom_gcode').value = getSettings().sysstartCustomGcode || '';
        if (q('sysstart_body')) { q('sysstart_body').value = getSettings().autostartBody || ''; if (typeof updateSysstartEditNote === 'function') updateSysstartEditNote(); }   // t656 — a pulled boot macro lands in the stored body editor
        q('macros_sync_modal').style.display = 'none';
    };

    if (q('mac_btn_global_pull')) {
        q('mac_btn_global_pull').addEventListener('click', async () => {
            q('macros_sync_modal').style.display = 'flex';
            q('macros_sync_title').textContent = 'Load from Controller';
            q('macros_sync_body').textContent = 'Checking connection and finding files...';
            q('macros_sync_list').style.display = 'none';
            q('macros_sync_conflict_ui').style.display = 'none';
            q('macros_sync_confirm').style.display = 'none';
            
            syncMode = 'pull';
            currentSyncFiles = {};
            let hasConflicts = false;
            let html = '';
            
            for (const file of SYNC_FILES) {
                // Only pull advstart or sysstart depending on dialect
                if (isV41 && file === 'sysstart.nc') continue;
                if (!isV41 && file === 'advstart.nc') continue;
                
                try {
                    const res = await makeClient().readSysfile(file);
                    if (res && res.ok && res.content && res.content.trim()) {
                        currentSyncFiles[file] = res.content;
                        
                        // Check for conflicts
                        if (file === 'slib-m.nc') {
                            const parsed = parseMcodeLibrary(res.content);
                            const existingCodes = macrosArr().filter(m => (m.trigger || {}).kind === 'mcode').map(m => (m.trigger || {}).code);
                            if (parsed.some(p => existingCodes.includes(p.trigger.code))) hasConflicts = true;
                        } else if (file.startsWith('key-')) {
                            const num = parseInt(file.replace(/\D/g, ''), 10);
                            const existingKeys = macrosArr().filter(m => (m.trigger || {}).kind === 'kbutton').map(m => (m.trigger || {}).key);
                            if (existingKeys.includes(num)) hasConflicts = true;
                        }

                        html += `<label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer; padding:2px 4px; border-radius:4px;"><input type="checkbox" value="${file}" checked> ${file}</label>`;
                    }
                } catch(e) {}
            }
            
            if (!Object.keys(currentSyncFiles).length) {
                q('macros_sync_body').textContent = 'Could not find any macro files on the controller. Make sure it is connected.';
                return;
            }
            
            q('macros_sync_body').textContent = `Found ${Object.keys(currentSyncFiles).length} files. Select the ones you want to pull into Studio:`;
            q('macros_sync_list').innerHTML = html;
            q('macros_sync_list').style.display = 'flex';
            if (hasConflicts) q('macros_sync_conflict_ui').style.display = 'block';
            
            q('macros_sync_confirm').style.display = 'block';
            q('macros_sync_confirm').textContent = 'Pull Files';
        });
    }

    if (q('mac_btn_global_push')) {
        q('mac_btn_global_push').addEventListener('click', () => {
            if (!getSettings().macrosSynced) {
                // Show Deploy Safeguard Warning
                q('macros_sync_modal').style.display = 'flex';
                q('macros_sync_title').textContent = '⚠️ Incompatible Firmware Warning';
                q('macros_sync_body').innerHTML = `
                    <div style="background: rgba(224,160,32,0.1); border: 1px solid rgba(224,160,32,0.4); padding: 12px; border-radius: 4px; margin-bottom: 12px; color: var(--text-main);">
                        You are about to push Studio's default factory macros to your controller.
                        <br><br>
                        If your controller is running older or customized firmware, these defaults may be incompatible and could overwrite your working configuration.
                    </div>
                    <b>We highly recommend you click "Load from controller" first</b> to sync your machine's exact macros into Studio.
                `;
                q('macros_sync_list').style.display = 'none';
                q('macros_sync_conflict_ui').style.display = 'none';
                q('macros_sync_confirm').style.display = 'block';
                q('macros_sync_confirm').textContent = 'Deploy Anyway';
                syncMode = 'push_warning';
                return;
            }
            openDeployModal();
        });
    }

    async function openDeployModal() {
            q('macros_sync_modal').style.display = 'flex';
            q('macros_sync_title').textContent = 'Deploy to Controller';
            q('macros_sync_body').textContent = 'Gathering local macros...';
            q('macros_sync_list').style.display = 'none';
            q('macros_sync_conflict_ui').style.display = 'none';
            q('macros_sync_confirm').style.display = 'none';
            
            syncMode = 'push';
            currentSyncFiles = {};
            let html = '';
            const existing = macrosArr();
            
            // slib-m.nc
            const mcodes = existing.filter(m => (m.trigger || {}).kind === 'mcode');
            if (mcodes.length) {
                let text = '';
                for (const m of mcodes) text += macroFileText(m) + '\n';
                currentSyncFiles['slib-m.nc'] = text;
                html += `<label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer; padding:2px 4px; border-radius:4px;"><input type="checkbox" value="slib-m.nc" checked> slib-m.nc (${mcodes.length} M-codes)</label>`;
            }
            
            // key-N.nc
            const kbtns = existing.filter(m => (m.trigger || {}).kind === 'kbutton');
            for (const m of kbtns) {
                const k = (m.trigger || {}).key;
                const file = `key-${k}.nc`;
                currentSyncFiles[file] = macroFileText(m);
                html += `<label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer; padding:2px 4px; border-radius:4px;"><input type="checkbox" value="${file}" checked> ${file}</label>`;
            }
            
            // sysstart.nc — the STORED boot macro (t656; edited/regenerated in the sysstart panel). Fall back to a fresh
            // build if it was never seeded (e.g. Deploy opened before the sysstart panel migrated it).
            const syscode = String(getSettings().autostartBody != null ? getSettings().autostartBody : buildAutostartBody());
            if (syscode.trim() && syscode.trim() !== 'M30') {
                const file = (homingPostIsExpert() || isV41) ? 'advstart.nc' : 'sysstart.nc';
                currentSyncFiles[file] = syscode;
                html += `<label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer; padding:2px 4px; border-radius:4px;"><input type="checkbox" value="${file}" checked> ${file}</label>`;
            }
            
            if (!Object.keys(currentSyncFiles).length) {
                q('macros_sync_body').textContent = 'No local macros or hooks are configured to deploy.';
                return;
            }
            
            const DELETABLE = ['key-1.nc', 'key-2.nc', 'key-3.nc', 'key-4.nc', 'key-5.nc', 'key-6.nc', 'key-7.nc', 'T.nc', 'error.nc', 'probe.nc', 'mulprobe.nc'];
            const toCheck = DELETABLE.filter(f => !currentSyncFiles[f]);
            
            if (toCheck.length > 0) {
                try {
                    const resps = await Promise.all(toCheck.map(f => makeClient().readSysfile(f)));
                    const orphaned = resps.filter(r => r && r.ok).map(r => r.name);
                    if (orphaned.length) {
                        html += '<div style="margin:12px 0 6px 0; font-weight:600; font-size:12px; color:var(--accent);">Orphaned on Controller (safe to delete)</div>';
                        for (const file of orphaned) {
                            html += `<label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer; padding:2px 4px; border-radius:4px; color:#e06c75;"><input type="checkbox" value="DEL:${file}"> 🗑 Delete ${file}</label>`;
                        }
                    }
                } catch(e) {}
            }
            
            q('macros_sync_body').textContent = `Select the files you want to push to the controller (existing files on the controller will be backed up):`;
            q('macros_sync_list').innerHTML = html;
            q('macros_sync_list').style.display = 'flex';
            
            q('macros_sync_confirm').style.display = 'block';
            q('macros_sync_confirm').textContent = 'Deploy Files';
        }

    if (q('macros_sync_cancel')) q('macros_sync_cancel').addEventListener('click', () => q('macros_sync_modal').style.display = 'none');
    
    if (q('macros_sync_confirm')) {
        q('macros_sync_confirm').addEventListener('click', async () => {
            if (syncMode === 'pull') {
                const stratNode = q('macros_sync_conflict_ui').querySelector('input[name="sync_conflict_strategy"]:checked');
                performPull(stratNode ? stratNode.value : 'merge');
            } else if (syncMode === 'push') {
                const checked = [...q('macros_sync_list').querySelectorAll('input[type="checkbox"]:checked')].map(cb => cb.value);
                if (!checked.length) return;
                
                const toPush = checked.filter(v => !v.startsWith('DEL:'));
                const toDel = checked.filter(v => v.startsWith('DEL:')).map(v => v.slice(4));
                
                let successCount = 0;
                let failCount = 0;
                
                for (const file of toPush) {
                    const content = currentSyncFiles[file];
                    if (!content) continue;
                    try {
                        const res = await makeClient().writeSysfile(file, content, 'write');
                        if (res && res.ok) successCount++;
                        else failCount++;
                    } catch (e) {
                        failCount++;
                    }
                }
                
                for (const file of toDel) {
                    try {
                        const res = await makeClient().deleteSysfile(file);
                        if (res && res.ok) successCount++;
                        else failCount++;
                    } catch (e) {
                        failCount++;
                    }
                }
                
                q('macros_sync_modal').style.display = 'none';
                q('macros_sync_modal').style.display = 'none';
                if (failCount === 0) dlgNotice(`Successfully deployed ${successCount} file(s) to the controller.\n\nNote: For slib-m.nc changes, you must reboot the controller to load the new M-codes.`);
                else dlgNotice(`Deployed ${successCount} file(s), but ${failCount} failed. Ensure the controller is connected.`);
            } else if (syncMode === 'push_warning') {
                // User chose to bypass the warning
                getSettings().macrosSynced = true; // Mark as synced so we don't warn again
                saveSettings();
                openDeployModal();
            }
        });
    }

    if (q('sysstart_regen')) {
        q('sysstart_regen').addEventListener('click', async () => {
            // t656 — no silent clobber: a hand-edited body is confirmed before a fresh rebuild overwrites it.
            if (getSettings().autostartHandEdited && !await dlgConfirm('Regenerate will OVERWRITE the boot macro you hand-edited with a fresh build from the homing profile + the additional G-code.\n\nOverwrite your edits?')) return;
            const body = buildAutostartBody();
            storeAutostartBody(body, false);   // t656 amend 1 — records the SELECTED profile the body was built for
            const t = q('sysstart_body'); if (t) t.value = body;
            updateSysstartEditNote();
        });
    }

    if (q('sysstart_push')) {
        q('sysstart_push').addEventListener('click', async () => {
            const code = String(getSettings().autostartBody || '');   // t656 — send EXACTLY the STORED body (the editor IS the source of truth), not a re-emit
            const filename = (homingPostIsExpert() || isV41) ? 'advstart.nc' : 'sysstart.nc';
            if (!await dlgConfirm(`Write ${filename} to the controller?\n\nThe existing ${filename} will be backed up.`)) return;
            try {
                const res = await makeClient().writeSysfile(filename, code, 'write');
                if (res && res.ok) dlgNotice(`Wrote ${filename}${res.backup ? ' — backup ' + res.backup : ''}.`);
                else dlgNotice('Push failed: ' + ((res && res.error) || 'needs the gateway/desktop app + a connected controller'));
            } catch (err) { dlgNotice('Push failed: ' + (err && err.message ? err.message : err)); }
        });
    }

// --- Sysstart GENERATION (the homing CONFIG GUI moved to Settings → Machine → Homing, t624). homingPostIsExpert stays
// here — the advstart/sysstart FILENAME decision (below) reads it; homingConfiguredAxes moved with the GUI. ---
function homingPostIsExpert() {
    try {
        const ap = localStorage.getItem('ddcs_active_post');
        if (ap && ap !== 'auto') return ap === 'ddcs-expert-m350';
        return (localStorage.getItem('ddcs_controller_profile') || 'ddcs-expert-m350') === 'ddcs-expert-m350';
    } catch (_) { return true; }
}

// t656 — renderHomingSummary REMOVED: the homing-summary recap section was dropped from the Macros → sysstart panel
// (the boot macro is now a stored, editable body; the homing profile stays in Settings → Machine → Homing).

    // --- CAM Pack Builder (Phase 1): author CAM-menu slots (form + macro), auto-allocate #11xx, export. ---
    const CAMPACK_KEY = 'ddcs_campack';
    const loadCamPack = () => { try { const p = JSON.parse(localStorage.getItem(CAMPACK_KEY)); if (p && Array.isArray(p.slots)) return p; } catch (e) { /* */ } return { meta: { name: 'My CAM pack', baseSlot: 22 }, slots: [] }; };
    let _camPack = loadCamPack();
    const saveCamPack = () => { try { localStorage.setItem(CAMPACK_KEY, JSON.stringify(_camPack)); } catch (e) { /* */ } };
    const camEsc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    // The op's SECOND build-time dropdown is context-aware (no dead greyed control): point pattern for
    // drill/bore, raster direction for the rect mill ops, arc direction for the round pocket. The probes (and
    // the standalone slot mill) have no build-time choice — their discrete options are runtime form fields — so
    // the dropdown is hidden for them. The chosen value is passed to the generator as its variant arg.
    const SECOND_CTL = {
        drill:   { title: 'Point pattern the holes are arranged in', opts: [['circle', 'bolt circle'], ['grid', 'grid'], ['line', 'line'], ['rect', 'rectangle']] },
        bore:    { title: 'Point pattern the bores are arranged in', opts: [['circle', 'bolt circle'], ['grid', 'grid'], ['line', 'line'], ['rect', 'rectangle']] },
        pocket:  { title: 'Raster direction — which axis the clearing rows run along', opts: [['x', 'rows ∥ X'], ['y', 'rows ∥ Y']] },
        surface: { title: 'Raster direction — which axis the facing rows run along', opts: [['x', 'rows ∥ X'], ['y', 'rows ∥ Y']] },
        cpocket: { title: 'Ring direction (CW spindle): climb = CCW/G3, conventional = CW/G2', opts: [['G3', 'climb (G3)'], ['G2', 'conventional (G2)']] },
    };
    // ---- Structured op model: a slot can remember the OPS it was built from (slot.ops = [{type, variant}]) so
    // they can be edited as cards and the macro REGENERATED from them. Legacy/hand-built slots (no slot.ops) keep
    // the raw-text workflow untouched. ----
    const OP_LABEL = { drill: 'Drill', bore: 'Bore', slot: 'Slot', pocket: 'Pocket (rect)', cpocket: 'Pocket (circle)', surface: 'Surface / face', corner: 'Probe corner', edge: 'Probe edge', zprobe: 'Probe Z surface', inside: 'Probe inside centre', boss: 'Probe boss centre', align: 'Probe alignment' };
    const CAM_GEN = { corner: cornerSlot, edge: edgeSlot, zprobe: probeZSlot, inside: insideCentreSlot, boss: bossCentreSlot, align: alignmentSlot, pocket: pocketSlot, cpocket: circlePocketSlot, surface: surfacingSlot };
    const defaultVariant = (type) => (SECOND_CTL[type] ? SECOND_CTL[type].opts[0][0] : '');
    // Generate one op into a starting point. The mill/probe ops live in CAM_GEN; drill/bore/slot go via slotFromOp.
    // S1a — a `decl` (the expose/bake declaration) threads through to allocFieldsWith / slotFromOp's inline hook.
    const generateOp = (type, variant, used, off, decl, opType) =>
        (type === 'substack') ? subStackToSlot(getUserDef(opType), used, off)        // S4 — a forked op w/ an embedded opunit: subStackToSlot composes ALL parts itself (standard part LIVE via its generator loop, custom atoms exposed)
        : (type === 'universal') ? stackToSlot(getUserDef(opType), decl, used, off)   // U3 — the universal arm: unroll the op's def, expose value params, bake geometry
        : CAM_GEN[type] ? CAM_GEN[type](used, off, variant, decl)                    // the 8 PREMIUM live-parametric generators (unchanged)
        : slotFromOp(type, variant, used, off, decl);                                // drill/bore/slot generators (unchanged)
    // Columns the user can tune in the field table that we PERSIST per op (so a regenerate keeps them, matched by
    // field key). `var` is generator-assigned (renaming would desync the body) and `type` has no column, so neither
    // is persisted. Stored on the op as op.values[key] = {def, min, max, label, units}.
    const FIELD_OVR_COLS = ['label', 'units', 'def', 'min', 'max'];
    // S1a — the expose/bake declaration for a manifest op (siblings of op.values): a param is BAKED when
    // op.exposed[key] === false, its frozen literal = op.baked[key]. Both maps are ABSENT until S1b's UI writes them,
    // so decl is empty today → allocFieldsWith / slotFromOp run all-exposed → every existing slot is byte-identical.
    const declFromOp = (op) => {
        const ex = op.exposed || {}, bk = op.baked || {}, vals = op.values || {}, decl = {};
        new Set([...Object.keys(ex), ...Object.keys(bk)]).forEach((k) => {
            if (ex[k] === false) decl[k] = { exposed: false, value: bk[k] };
            // UNIVERSAL: stackToSlot exposes ONLY on decl.exposed===true (an absent entry = not-exposed), so expose must be
            // POSITIVE here (unlike the generator path where absence = exposed). Seed the pendant field from the op's value.
            else if (op.type === 'universal') decl[k] = { exposed: true, value: (vals[k] ? vals[k].def : undefined) };
        });
        return decl;
    };
    // A read-line in canonical form (identical to what every generator emits) — used to re-sync the macro comment
    // to a tuned field so the table, the macro, Simulate and "Refresh fields" all agree.
    const canonicalRead = (f) => `${f.var}=#${f.idx + 1500}   ;${f.label}${f.units ? ' [' + f.units + ']' : ''} =${f.def} [${f.min}~${f.max}]`;
    function applyOverridesToBody(body, fields, values) {
        let out = body;
        fields.forEach((f) => {
            if (!values[fkeyOf(f)]) return;   // only fields the user actually tuned (t1077 — part-scoped key)
            const re = new RegExp('^[ \\t]*' + f.var.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=#' + (f.idx + 1500) + '\\b.*$', 'm');
            if (re.test(out)) out = out.replace(re, canonicalRead(f));
        });
        return out;
    }
    // Rebuild a slot's fields + body + name from its op list. Params are allocated AROUND the other slots' params
    // (so a regenerate doesn't collide), and vars continue across ops — exactly the Add-op append sequence. Each
    // field is tagged with its owning op (_op) and any value the user tuned on that op (op.values) is re-applied to
    // both the field and its macro read-line; only keys carried over by the new op/variant survive. Icon untouched.
    function buildSlotFromOps(slot) {
        const used = new Set();
        _camPack.slots.forEach((s) => { if (s !== slot) (s.fields || []).forEach((f) => used.add(f.idx)); });
        let fields = [], parts = [], name = '';
        (slot.ops || []).forEach((op, oi) => {
            // t1083 — advance the local-var cursor from what the previous parts ACTUALLY MINTED, not from a parallel
            // field COUNT. That is what closes the bake gap: a baked param mints no var, so `fields.length` drifted below
            // the real high-water mark and the next part's vars overlapped the previous part's.
            const gen = generateOp(op.type, op.variant, used, maxLocalVar(fields), declFromOp(op), op.opType);   // opType → the universal arm's def lookup
            let body = gen.body;
            gen.fields.forEach((f) => {
                used.add(f.idx);
                f._op = oi;
                const ov = op.values && op.values[fkeyOf(f)];   // t1077 — part-scoped key (identical for a single-part op)
                if (ov) FIELD_OVR_COLS.forEach((k) => { if (ov[k] !== undefined) f[k] = ov[k]; });
            });
            if (op.values) body = applyOverridesToBody(body, gen.fields, op.values);
            fields = fields.concat(gen.fields);
            parts.push(body);
            name = name ? name + ' + ' + gen.name.replace(/^(Drill|Bore) — /, '') : gen.name;
        });
        slot.fields = fields;
        // t1081 — record any field var that lands inside a composed part's DECLARED scratch band, so the build can refuse
        // and the pack validator can flag an already-built slot. Detection only here; the build path does the refusing.
        slot.varCollisions = fieldVarCollisions(fields, slot.ops || [], camBandsOf);
        slot.body = slotPack.composeParts(parts);   // normalize the composed parts into ONE executable program (strip non-terminal M30s + uniquify labels) — else the controller stops after part 1
        if (name) slot.name = name;
        slot.bodyDirty = false;
    }
    // A structural edit rebuilds the macro. If the body was hand-edited since the last build, confirm first.
    // Guard a from-ops rebuild behind the clobber-confirm, but ONLY async when there's a hand-edit to clobber — a clean
    // slot proceeds SYNCHRONOUSLY (so the cam handlers stay sync + the op edit lands immediately). callback style.
    function regenGuard(slot, proceed) {
        if (!slot.bodyDirty) { proceed(); return; }
        dlgConfirm('Rebuild the macro from the ops?\nYour manual edits to the macro body will be discarded.', { danger: true, okLabel: 'Rebuild' })
            .then((ok) => { if (ok) proceed(); else renderCamBuilder(); });
    }
    // Re-allocate a slot's form params (#11xx) to free ones around `otherUsed`, rewriting each field's read-line
    // mirror (#26xx) to match. For duplicating a LEGACY/hand-built slot (no op manifest to regenerate from) so the
    // copy doesn't collide with the original. Anchored to each field's `var=#mirror` at line start — calcs untouched.
    function reallocSlotParams(slot, otherUsed) {
        const taken = new Set(otherUsed);
        let body = String(slot.body || '');
        (slot.fields || []).forEach((f) => {
            const ni = slotPack.nextParam(taken); if (ni == null || ni === f.idx) { if (ni != null) taken.add(ni); return; }
            taken.add(ni);
            const re = new RegExp('^([ \\t]*' + f.var.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=#)' + (f.idx + 1500) + '\\b', 'm');
            body = body.replace(re, '$1' + (ni + 1500));
            f.idx = ni;
        });
        slot.body = body;
    }
    // ── S1c — Build CAM slot: a REUSABLE authoring surface (one component, three triggers — DRY). It opens as a MODAL
    // over any surface via window.ddcsOpenCamAuthoring(op?). Seed a slot's expose/bake field table from a program op,
    // preview it, and Build it into the pack (_camPack). Triggers: (1) a per-op CAM action on the op card (pre-seeded,
    // picker hidden); (2) the editor toolbar; (3) the CAM Pack Builder button — (2)+(3) show the seed picker. ──
    // t1055 (S-C) — MULTI-OP: _authoring holds an ARRAY of ops (each a seeded expose/bake group), so one slot can compose a
    // whole program. The global doors AUTO-IMPORT all CAM-able program ops; the op-card door seeds that ONE op. buildSlotFromOps
    // already composes multi-op (allocates params around siblings, tags f._op) — no generator/slotPack change.
    let _authoring = null;   // { ops:[{opType,camType,variant,fields,values,exposed,baked,label}], name, seedLocked } | null
    let _editingSlot = null; // t1127 S3 — the cam NUMBER being Edited (Update-in-place), or null = a NEW slot. The slot-level analog of devMode._editingWizard.
    let _cbmPanel = null;    // the docked inline preview panel
    let _iconEditor = null;  // t1135 S5b — the INLINE icon editor handle ({ destroy, getLayers, rasterize, addImage }) mounted in the wizard
    let _cbmOverlay = null;  // the modal overlay element
    let _cbmUnsupported = []; // present-but-not-CAM-able program ops (for the empty-state reasons)
    const CAM_SUPPORTED_LABEL = 'Pocket · Surface · Probe corner / edge · Slot · Drill / Bore · Probe centre (Middle)';
    const variantForCam = (camType, params) => (camType === 'drill' || camType === 'bore') ? (params.pattern || 'circle') : defaultVariant(camType);
    // S4 — a forked op whose def embeds an `opunit` (a standard sub-unit kept live) → the parts that walkParts sees, else null.
    // Recognition is a READ of the declared opunit boundary (never inferred from motion). Only user_* forks are in USER_DEFS.
    const subStackParts = (opType) => {
        const def = getUserDef(opType); if (!def) return null;
        const tmpl = def.template || [];
        const root = tmpl.find((b) => b && b.type === 'user_root') || tmpl[0];
        const parts = walkParts(root ? root.children : []);
        return parts.some((p) => p.kind === 'standard') ? parts : null;   // has at least one live standard part → route through subStackToSlot
    };
    // Build a SUB-STACK authoring op: subStackToSlot composes the parts (standard = generator LIVE knobs, custom = value params).
    // Fields carry _part/_partKind/_partLabel so renderCbmTable groups them. S4 modal-first: the build is fixed all-exposed
    // (surfacing stays parametric independent of the toggles), so every row is Expose-only (bakeable:false) — per-part
    // expose/bake toggling that drives the build is a flagged follow-on.
    function makeSubStackAuthOp(op) {
        const def = getUserDef(op.opType);
        const sub = subStackToSlot(def);   // build once to get the composed, part-tagged fields (idx/var + _part/_partKind/_partLabel)
        const fields = (sub.fields || []).map((f) => ({
            ...f,
            value: (f.def != null ? f.def : ''),
            bakeable: false,   // standard = generator loop knob (always live); custom = exposed for now (per-part baking is a follow-on)
            _bakeTip: f._partKind === 'standard' ? 'Generator loop knob — always live (baking would break the parametric loop)' : 'Sub-stack builds all-exposed; per-part baking is a follow-on',
        }));
        const exposed = {}, baked = {};
        fields.forEach((f) => { exposed[fkeyOf(f)] = true; });   // fixed all-exposed (matches the subStackToSlot build); PART-SCOPED so two parts sharing a key stay independent
        return { opType: op.opType, camType: 'substack', variant: '', fields, values: {}, exposed, baked, label: op.label || op.opType, substack: true, defV: defVOf(op.opType) };
    }
    // A program op → an authoring op (via seedFromOp). null when the op isn't CAM-able.
    function makeAuthOp(op) {
        if (subStackParts(op.opType)) return makeSubStackAuthOp(op);   // S4 — a forked op w/ an embedded standard sub-unit routes to the sub-stack path (parts stay grouped, standard LIVE)
        const seed = seedFromOp(op);
        if (seed.unsupported) return null;
        const values = {}, exposed = {}, baked = {};
        seed.fields.forEach((f) => {
            if (typeof f.value === 'number') values[fkeyOf(f)] = { def: f.value };   // seed NUMERIC values (enum ints come via the field default)
            // UNIVERSAL default: value params (exposable) start EXPOSED (positive, not by-absence — the generator path's
            // empty-map default means all-exposed, but stackToSlot needs an explicit expose flag); geometry params start
            // BAKED to the op's own value (a #var can't ride through them). The generator path keeps its empty exposed/baked.
            if (seed.universal) { const k = fkeyOf(f); if (f.exposable) exposed[k] = true; else { exposed[k] = false; baked[k] = f.value; } }
        });
        return { opType: op.opType, camType: seed.camType, variant: variantForCam(seed.camType, op.params || {}), fields: seed.fields, values, exposed, baked, label: op.label || op.opType, universal: !!seed.universal, defV: defVOf(op.opType) };
    }
    const toManifest = (a) => ({ type: a.camType, variant: a.variant, values: a.values, exposed: a.exposed, baked: a.baked, opType: a.opType, defV: a.defV });   // U3 — opType+defV let a universal slot rebuild via getUserDef; type==='universal' selects the arm
    // t1127 S3 — the DECLARED inverse of camTypeOf's forward map: the discriminating params it reads to resolve a generator's
    // camType/field-set. toManifest dropped the source op's params, so re-derive JUST these from the stored camType/variant
    // → seedFromOp re-resolves the SAME camType + re-hydrates the SAME fields. Universal/substack need none (the def IS the
    // source). Declare-never-infer: the manifest is read, slot.body is NEVER re-parsed.
    const CAM_SEED_PARAMS = {
        pocket: () => ({ shape: 'rect' }), cpocket: () => ({ shape: 'circle' }),
        inside: () => ({ twoAxis: true, featureType: 'inside' }), boss: () => ({ twoAxis: true, featureType: 'boss' }),
        drill: (v) => ({ pattern: v || 'circle' }), bore: (v) => ({ pattern: v || 'circle', method: 'helical' }),
    };
    // The faithful INVERSE of toManifest: a stored manifest op → an authoring op (the shape makeAuthOp produces). Re-hydrate
    // `fields` from the op-type SEED (makeAuthOp → seedFromOp/subStackToSlot, the SAME call the fresh-authoring path uses),
    // then OVERLAY the stored variant/values/exposed/baked (the declared customization). Returns null if the op-type is no
    // longer CAM-able (a stale/removed def).
    function manifestToAuthOp(m) {
        if (!m || !m.opType) return null;
        const seedParams = CAM_SEED_PARAMS[m.type] ? CAM_SEED_PARAMS[m.type](m.variant) : {};
        const a = makeAuthOp({ opType: m.opType, params: seedParams });
        if (!a) return null;
        if (m.variant != null && m.variant !== '') a.variant = m.variant;
        a.values = { ...(a.values || {}), ...(m.values || {}) };
        a.exposed = { ...(a.exposed || {}), ...(m.exposed || {}) };
        a.baked = { ...(a.baked || {}), ...(m.baked || {}) };
        a.fields.forEach((f) => { const ov = a.values[fkeyOf(f)]; if (ov && ov.def != null) f.value = ov.def; });   // reflect tuned values onto the re-seeded table
        return a;
    }
    const cbmPreviewSlot = () => { const s = { slot: nextSlotNum(), name: _authoring.name || 'New CAM slot', ops: _authoring.ops.map(toManifest) }; buildSlotFromOps(s); return s; };
    // t1077 — the ONE key the modal ADDRESSES a field by (row id, radio group, value input, expose/bake + value maps, and
    // the pendant-slot lookup). A SUB-STACK op composes SEVERAL parts, and two parts can legitimately carry the SAME param
    // key (a custom binding named `feed` beside the surfacing generator's `feed`) — a bare key would collide, so one row's
    // radio/value would silently drive the other's. Scope it by PART. A single-part op (generator / universal) has no
    // `_part`, so the key is UNCHANGED → every existing slot + manifest stays byte-identical.
    const fkeyOf = (f) => (f && f._part != null ? f._part + ':' + f.key : (f && f.key));
    const cbmVal = (oi, fk) => {
        const a = _authoring.ops[oi];
        const row = camRowBlock(a.opType, fk);   // S4a — a cam_table op reads its value from the block (dflt when exposed, baked literal when baked); empty inherits the field default below
        if (row) { const v = row.params.mode === 'bake' ? row.params.baked : row.params.dflt; if (v !== '' && v != null) return v; }
        const ov = a.values[fk]; if (ov && ov.def != null) return ov.def;
        const f = a.fields.find((x) => fkeyOf(x) === fk); return f ? (typeof f.value === 'number' ? f.value : f.def) : '';
    };
    function renderCbmTable() {
        const el = document.getElementById('cbm_table'); if (!el) return;   // modal is on document.body, not #macros-app (q is root-scoped)
        if (!_authoring.ops.length) {   // EMPTY-STATE (subsumes S-B) — no greyed dropdown; list what CAM supports + why present ops didn't qualify
            const reasons = _cbmUnsupported.length ? '<div style="margin-top:8px;">' + _cbmUnsupported.map((u) => `<div style="font-size:11px; color:var(--text-dim);">• ${camEsc(u.label)} — ${camEsc(u.reason)}</div>`).join('') + '</div>' : '';
            el.innerHTML = `<div class="settings-hint" style="padding:12px 2px;">No CAM-able ops to import. The CAM Builder supports: <b>${CAM_SUPPORTED_LABEL}</b>. Insert one of those into your program, then reopen — or use an op's ▸ Build CAM slot action.${reasons}</div>`;
            return;
        }
        const preview = cbmPreviewSlot();   // buildSlotFromOps allocates params around siblings + tags each field's owning op (f._op)
        const idxOf = (oi, fk) => { const f = (preview.fields || []).find((x) => x._op === oi && fkeyOf(x) === fk); return f ? f.idx : null; };   // t1077 — part-scoped: two parts may share a param key
        const sections = _authoring.ops.map((a, oi) => {
            const rowHtml = (f) => {
                const fk = fkeyOf(f);   // t1077 — PART-SCOPED addressing: two parts of a sub-stack may share a param key
                const _row = camRowBlock(a.opType, fk);   // S4a — a cam_table op reads its expose/bake state from the block, not a.exposed
                const baked = _row ? (_row.params.mode === 'bake') : (a.exposed[fk] === false), val = cbmVal(oi, fk), idx = idxOf(oi, fk);
                const enumOpt = f.enum && f.enum.find((o) => o.value === Number(val));
                const numeric = (val === '' || val == null || !isNaN(Number(val)));   // a non-numeric value (a baked string/enum with no dropdown) must NOT be an editable number input — typing would overwrite the string bake with a number (wrong G-code)
                const valCell = a.substack
                    // S4 — a sub-stack part's value is the pendant DEFAULT re-derived from the op's definition on every build; editing it here
                    // would be a no-op (subStackToSlot re-derives from the def), so show it read-only. Modal editing of part defaults is a follow-on.
                    ? `<span style="font-size:11.5px;" title="Pendant default, derived from the op's definition — customize the op to change it">${camEsc(String(val))}</span>`
                    : f.enum
                        ? `<select class="cbm-val" data-oi="${oi}" data-fkey="${camEsc(fk)}" style="min-width:118px;">${f.enum.map((o) => `<option value="${o.value}"${o.value === Number(val) ? ' selected' : ''}>${camEsc(o.label)}</option>`).join('')}</select>`
                        : numeric
                            ? `<input class="cbm-val" data-oi="${oi}" data-fkey="${camEsc(fk)}" type="number" value="${val}" style="width:72px;">`
                            : `<span style="color:var(--text-dim); font-size:11px;" title="baked string/enum value (read-only)">${camEsc(String(val))}</span>`;
                const slotCell = baked ? `baked = ${f.enum ? (enumOpt ? enumOpt.label + ' (' + val + ')' : val) : val}` : (idx != null ? `#${idx} → #${slotPack.mirrorVar(idx)}` : '—');
                const bakeTip = f.bakeable ? '' : ` title="${camEsc(f._bakeTip || 'Guard / branch param — must stay operator-set (Expose-only)')}"`;   // S4 — a sub-stack part carries its own reason on _bakeTip
                const canExpose = f.exposable !== false;   // U3 — universal GEOMETRY params (exposable===false) can't carry a #var → Expose disabled, Bake-forced (mirrors the bakeable greying)
                const exposeTip = canExpose ? '' : ' title="Geometry / fold-driven — a #var cannot ride through the emit; bake it"';
                return `<tr data-oi="${oi}" data-fkey="${camEsc(fk)}">
                    <td style="padding:2px 6px;">${camEsc(f.label || f.key)}</td>
                    <td>${valCell}</td>
                    <td style="white-space:nowrap;"><label${exposeTip} style="margin-right:8px;${canExpose ? '' : 'color:var(--text-dim);'}"><input type="radio" class="cbm-eb" name="eb_${oi}_${camEsc(fk)}" data-oi="${oi}" data-fkey="${camEsc(fk)}" data-mode="expose"${baked ? '' : ' checked'}${canExpose ? '' : ' disabled'}> Expose</label><label${bakeTip} style="${f.bakeable ? '' : 'color:var(--text-dim);'}"><input type="radio" class="cbm-eb" name="eb_${oi}_${camEsc(fk)}" data-oi="${oi}" data-fkey="${camEsc(fk)}" data-mode="bake"${baked ? ' checked' : ''}${f.bakeable ? '' : ' disabled'}> Bake</label></td>
                    <td style="color:var(--text-dim); font-size:10px; white-space:nowrap;">${camEsc(slotCell)}</td>
                </tr>`;
            };
            let rows;
            if (a.substack) {
                // S4 — group the composed fields by PART (the opunit standard sub-unit + each custom loose-atom run); a labelled
                // sub-header per part shows the standard part is LIVE (its generator loop) vs the custom part's exposed values.
                const groups = [];
                a.fields.forEach((f) => { const pi = f._part || 0; if (!groups[pi]) groups[pi] = { kind: f._partKind, label: f._partLabel, fields: [] }; groups[pi].fields.push(f); });
                rows = groups.filter(Boolean).map((g, gi) => {
                    const hint = g.kind === 'standard' ? 'live — generator loop knobs (geometry stays parametric)' : 'custom atoms — values exposed, geometry baked';
                    const plabel = g.kind === 'standard' ? (g.label || ('Part ' + (gi + 1))) : 'Custom atoms';   // the custom part's _partLabel is a synthetic subDef opType (noise) → a friendly generic label
                    return `<tr><td colspan="4" style="padding:6px 6px 2px; font-size:10.5px; font-weight:600; color:var(--text-dim); border-top:${gi ? '1px dashed var(--border)' : 'none'};">▸ ${camEsc(plabel)} <span style="font-weight:400;">— ${hint}</span></td></tr>` + g.fields.map(rowHtml).join('');
                }).join('');
            } else {
                rows = a.fields.map(rowHtml).join('');
            }
            const camLabel = a.camType === 'substack' ? 'sub-stack — parts stay live' : a.camType;
            return `<div class="cbm-op-group" data-oi="${oi}" style="margin-top:${oi ? 12 : 0}px;"><div style="font-size:12px; font-weight:600; color:var(--accent,#6ea8fe); border-bottom:1px solid var(--border); padding:3px 0; margin-bottom:3px;">${oi + 1}. ${camEsc(a.label)} <span style="color:var(--text-dim); font-weight:400; font-size:10px;">→ ${camEsc(camLabel)}</span></div>
                <table style="width:100%; font-size:11.5px; border-collapse:collapse;"><thead><tr style="color:var(--text-dim); font-size:10px; text-align:left;"><th style="padding:2px 6px;">Param</th><th>Value</th><th>On the pendant?</th><th>Pendant slot</th></tr></thead><tbody>${rows}</tbody></table></div>`;
        }).join('');
        el.innerHTML = `${sections}<div class="settings-hint" style="margin-top:8px;">Expose = the operator fills it on the pendant (#11xx → #2600). Bake = frozen into the macro; the row vanishes. Enum params pick a friendly label; the pendant stores its number.</div>`;
    }
    // t1135 S5b — mount the INLINE icon editor (side-by-side with the expose/bake table, mirroring the controller's CAM page:
    // camN.bmp + the operator form together = WYSIWYG). The editor edits LAYERS; onChange live-writes _authoring.icon.layers;
    // the BMP is rasterized at build (cbmBuild). Seed from the slot's layers (Edit), a pre-S5b BMP as a tile (legacy Edit), or
    // the auto default = the slot name as editable text (New) — so the preview is never blank AND the auto content is editable.
    function mountIconEditor() {
        const host = document.getElementById('cbm_iconedit'); if (!host || !_authoring) return;
        if (_iconEditor) { try { _iconEditor.destroy(); } catch (_) { /* */ } _iconEditor = null; }
        const ic = _authoring.icon;
        const initLayers = (ic && Array.isArray(ic.layers) && ic.layers.length) ? ic.layers
            : (ic && ic.data) ? [imageTileLayer(ic.data)]
                : autoIconLayers(_authoring.name);
        _iconEditor = openIconEditor({ layers: initLayers }, null, {
            mount: host,
            onChange: ({ layers }) => { _authoring.icon = { ...(_authoring.icon || {}), name: (_authoring.name || 'cam') + '.bmp', w: 360, h: 180, layers }; },   // live; .data is rasterized at build
        });
    }
    function mountAuthoringSurface(body) {
        const n = _authoring.ops.length;
        const editing = _editingSlot != null;   // t1127 S3 — Edit reads "Update CAM (camN)"; New reads "Build CAM slot"
        body.innerHTML = `<div class="cam-build-mode" style="padding:14px 16px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;"><b style="flex:1; font-size:14px;">${editing ? `✎ Update CAM (cam${_editingSlot})` : '✚ Build CAM slot'}${n > 1 ? ` — ${n} ops` : ''}</b><button class="toolbar-btn settings-io" data-act="cbm-cancel">✕ Cancel</button></div>
            <div class="settings-row" style="align-items:center; margin-top:2px;"><label style="font-size:11px; color:var(--text-dim);">Slot name&nbsp;<input id="cbm_name" value="${camEsc(_authoring.name || '')}" placeholder="e.g. Pocket" style="min-width:200px;"></label></div>
            <div style="margin-top:10px;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;"><b style="font-size:11px; color:var(--text-dim); flex:1;">Slot icon (camN.bmp) — draw it above the form, as the DDCS CAM page shows it</b><button class="toolbar-btn settings-io" data-act="cbm-icon-import">🖼 Import BMP</button></div>
                <div id="cbm_iconedit"></div>
            </div>
            <div id="cbm_table" style="margin-top:10px;"></div>
            <div style="display:flex; align-items:center; gap:8px; margin-top:10px;"><b style="font-size:11px; color:var(--text-dim); flex:1;">Inline preview</b><button class="toolbar-btn settings-io" data-act="cbm-sim" title="Simulate this slot's composed macro, each field seeded from its value.">▶ Simulate</button></div>
            <div id="cbm_preview" style="height:280px; position:relative; border:1px solid var(--border); border-radius:6px; margin-top:6px; background:#000;"></div>
            <div class="settings-row" style="justify-content:flex-end; margin-top:12px;"><button class="toolbar-btn settings-io" data-act="cbm-build" style="font-weight:600;"${n ? '' : ' disabled'}>${editing ? `Update CAM (cam${_editingSlot}) ▸` : 'Build CAM slot ▸'}</button></div>
        </div>`;
        renderCbmTable();
        mountIconEditor();   // t1135 S5b — the inline icon editor, beside the table
    }
    function attachCbmListeners(root) {
        root.addEventListener('input', (e) => {
            const t = e.target;
            if (t.id === 'cbm_name') { _authoring.name = t.value; return; }
            if (t.classList.contains('cbm-val') && t.tagName !== 'SELECT') {   // numeric value (enum selects go via change → re-render)
                const a = _authoring.ops[+t.dataset.oi], key = t.dataset.fkey, num = (t.value === '' ? '' : parseFloat(t.value));
                const row = camRowBlock(a.opType, key);
                if (row) { if (row.params.mode === 'bake') row.params.baked = String(num); else row.params.dflt = String(num); return; }   // S4a — write the value to the block (baked literal when baked, pendant default when exposed)
                a.values[key] = { ...(a.values[key] || {}), def: num };
                if (a.exposed[key] === false) a.baked[key] = num;   // keep the baked literal in sync
            }
        });
        root.addEventListener('click', (e) => {
            const a = e.target.dataset.act;
            if (a === 'cbm-cancel') cbmExit();
            else if (a === 'cbm-sim') cbmSimulate();
            else if (a === 'cbm-build') cbmBuild();
            else if (a === 'cbm-icon-import') importCamIcon();   // t1135 S5b — Import BMP → the inline editor adds it as a movable tile layer
        });
        root.addEventListener('change', (e) => {
            const t = e.target;
            if (t.classList.contains('cbm-eb') && t.checked) { cbmToggle(+t.dataset.oi, t.dataset.fkey, t.dataset.mode); return; }
            if (t.tagName === 'SELECT' && t.classList.contains('cbm-val')) {   // ENUM pick → store the int (+ keep any baked literal in sync)
                const a = _authoring.ops[+t.dataset.oi], key = t.dataset.fkey, iv = parseInt(t.value, 10);
                const row = camRowBlock(a.opType, key);
                if (row) { if (row.params.mode === 'bake') row.params.baked = String(iv); else row.params.dflt = String(iv); renderCbmTable(); return; }   // S4a — write the enum int to the block
                a.values[key] = { ...(a.values[key] || {}), def: iv };
                if (a.exposed[key] === false) a.baked[key] = iv;
                renderCbmTable();
            }
        });
    }
    // t1127 S3 — the per-slot "Edit ▸" entry: reopen the wizard PRE-SEEDED from the slot MANIFEST (manifestToAuthOp), with
    // _editingSlot set so Build becomes "Update CAM (camN)" overwriting that slot IN PLACE. MODAL-ONLY (does not touch the
    // active program/editor — that is the gated S4). A legacy slot (no slot.ops) or one whose op-type is gone can't Edit: the
    // display only offers Edit when slot.ops has content, and this refuses a stale manifest loudly rather than opening lossy.
    function editCamSlot(slot) {
        const ops = (slot.ops || []).map(manifestToAuthOp);
        if (!ops.length || ops.some((a) => !a)) { dlgNotice('This slot can’t be edited in the wizard (a legacy hand-built macro, or an op that is no longer installed). Use ▶ Simulate / ⬇ View output / ✕.'); return; }
        _editingSlot = +slot.slot;
        _authoring = { ops, name: slot.name || '', icon: slot.icon ? JSON.parse(JSON.stringify(slot.icon)) : null, seedLocked: true };   // t1129 S5 — PRE-LOAD the slot icon so the wizard preview shows it + it is re-editable
        _cbmUnsupported = [];
        openCamAuthoring();   // _editingSlot != null → skips the seed, opens on the pre-set _authoring
    }
    // The ONE opener — a modal over any surface. seedOp given (op-card door) → seeds THAT one op. No seedOp (toolbar / CAM-tab
    // doors) → AUTO-IMPORT every CAM-able op from the program (in order). Exposed as window.ddcsOpenCamAuthoring for the op card.
    function openCamAuthoring(seedOp) {
        if (_cbmOverlay) return;   // one at a time
        if (_editingSlot == null) {   // NEW authoring — seed from the op / program. (Edit pre-sets _authoring in editCamSlot; skip the seed.)
            _authoring = { ops: [], name: '', seedLocked: !!seedOp };
            _cbmUnsupported = [];
            if (seedOp) {   // op-card door — this ONE op
                const a = makeAuthOp(seedOp);
                if (!a) { const r = seedFromOp(seedOp); dlgNotice((r && r.unsupported) || 'This op is not CAM-able.'); _authoring = null; return; }
                _authoring.ops = [a]; _authoring.name = a.label;
            } else {        // global doors — auto-import all CAM-able program ops (program order)
                const stack = (window.ddcsGetBlockProgram && window.ddcsGetBlockProgram()) || [];
                for (const op of stack.filter((b) => b && b.type === 'op')) {
                    const a = makeAuthOp(op);
                    if (a) _authoring.ops.push(a);
                    else { const r = seedFromOp(op); _cbmUnsupported.push({ label: op.label || op.opType, reason: (r && r.unsupported) || 'not CAM-able' }); }
                }
                _authoring.name = _authoring.ops.length === 1 ? _authoring.ops[0].label : (_authoring.ops.length ? 'Program' : '');
            }
        }
        const ov = document.createElement('div'); ov.className = 'cam-auth-overlay';
        ov.style.cssText = 'position:fixed; inset:0; z-index:9998; background:rgba(0,0,0,.55); display:flex; align-items:flex-start; justify-content:center; overflow:auto; padding:22px 12px;';
        const body = document.createElement('div'); body.style.cssText = 'width:min(1000px,97vw); background:var(--panel,#161b22); border:1px solid var(--border); border-radius:10px;';
        ov.appendChild(body); document.body.appendChild(ov); _cbmOverlay = ov;
        attachCbmListeners(body);
        mountAuthoringSurface(body);          // builds the shell + renders the group-by-op table (or the empty-state)
        ov.addEventListener('mousedown', (e) => { if (e.target === ov) cbmExit(); });
    }
    // t1127 S3 — cbmBuildModal (the "Build to which slot? New vs Overwrite" prompt) is DELETED: the destination is now
    // valid-by-construction (New always mints nextSlotNum, Edit always overwrites _editingSlot), so the prompt is dead.
    // t1131 S6 (Fork B) — the settings "🧩 Customize op" picker (cbmCustomizeModal) is RETIRED: it was an AUTHORING door and
    // the settings panel is now a pure display. The op-menu "🧩 Customize as blocks" (opContextMenu.js) stays — it calls
    // ddcsEditWizardDef directly, so nothing here is needed for it.
    const cbmExit = () => { if (_iconEditor) { try { _iconEditor.destroy(); } catch (_) { /* */ } _iconEditor = null; } if (_cbmPanel) { try { _cbmPanel.stop(); _cbmPanel.setActive(false); } catch (_) { /* noop */ } _cbmPanel = null; } if (_cbmOverlay) { _cbmOverlay.remove(); _cbmOverlay = null; } _authoring = null; _editingSlot = null; if (q('cam_slots')) renderCamBuilder(); };   // t1127 S3 — clear the Edit flag on close (build OR cancel); t1135 S5b — tear down the inline icon editor
    // S4a (block-native params) — the modal as a VIEW of the cam_field blocks. When the op's def carries a cam_table, its
    // cam_field block RECORD (live in getUserDef's template) IS the state: the render reads mode/value from it and a
    // radio/value edit WRITES to it, so the block is one source and the S2 build (which reads the same cam_table) reflects
    // the edit. flattenBlocks returns the actual block objects, so mutating .params persists in the registry + the next
    // build. null → the op has no cam_table (every op until the S4b hook) → the _authoring.ops/decl path, UNCHANGED (inert).
    const camRowBlock = (opType, key) => {
        const def = getUserDef(opType);
        if (!def || !def.template) return null;
        for (const b of flattenBlocks(def.template)) if (b && b.type === 'cam_field' && b.params && String(b.params.param) === String(key)) return b;
        return null;
    };
    function cbmToggle(oi, key, mode) {
        const a = _authoring.ops[oi];
        const row = camRowBlock(a.opType, key);
        if (row) {   // S4a — the block IS the state: flip the row mode; on bake, seed the literal from the current value
            row.params.mode = (mode === 'bake') ? 'bake' : 'expose';
            if (mode === 'bake' && (row.params.baked === '' || row.params.baked == null)) row.params.baked = String(cbmVal(oi, key));
            renderCbmTable(); return;
        }
        if (mode === 'bake') { a.exposed[key] = false; a.baked[key] = cbmVal(oi, key); }
        else if (a.universal) { a.exposed[key] = true; delete a.baked[key]; }   // universal: Expose is POSITIVE (stackToSlot exposes only on exposed===true)
        else { delete a.exposed[key]; delete a.baked[key]; }   // generator: Expose = the default (no decl entry)
        renderCbmTable();
    }
    // t1053 (S-A / Gap 4) — a PROBE CAM slot's macro is INCREMENTAL (G31 from the operator start); with no stock/start the
    // preview clamps the first probe to zero and traces from origin = empty/black. For a probe slot (G31) synthesize a
    // CENTERED TOP-DATUM stock box (size from the probe's reach) + a start ABOVE it, so the incremental probe travels toward
    // the stock. Preview-only (getStock/getStart) — NO settings.stock mutation; a non-probe slot passes NEITHER = byte-identical
    // to today (previewStock falls back to the global). Mirrors the wizardManager getStock/getStart wiring.
    const probePreviewStock = (slot) => {
        const f = (k) => { const x = (slot.fields || []).find((y) => y.key === k); return x ? Number(x.def) : undefined; };
        const xy = Math.max(40, f('maxProbe') || f('travel') || 120);   // F4b — size from maxProbe/travel; fallback 120×120×25
        return { x: xy, y: xy, z: 25, shape: 'box', datum: 'ccp', show: true };   // centered, top datum (z=0 at the surface)
    };
    const probePreviewStart = (slot) => { const s = (slot.fields || []).find((y) => y.key === 'safeZ'); return { x: 0, y: 0, z: s ? Math.max(2, Number(s.def)) : 10 }; };
    const probePreviewOpts = (slot, macro) => (/\bG31\b/.test(macro) ? { getStock: () => probePreviewStock(slot), getStart: () => probePreviewStart(slot) } : {});

    function cbmSimulate() {
        if (!_authoring.ops.length) { dlgNotice('Import or add an op first.'); return; }
        const host = document.getElementById('cbm_preview'); if (!host) return;
        if (window.ddcsStopPreview) window.ddcsStopPreview();
        if (_cbmPanel) { try { _cbmPanel.stop(); _cbmPanel.setActive(false); } catch (_) { /* noop */ } _cbmPanel = null; }
        host.innerHTML = '';
        const s = cbmPreviewSlot(), macro = slotPack.slotMacro(s), seed = new Map();
        (s.fields || []).forEach((f) => seed.set(slotPack.mirrorVar(f.idx), Number(f.def)));
        _cbmPanel = createPreviewPanel(host, { getGcode: () => macro, createVarStore: () => new Map(seed), ...probePreviewOpts(s, macro) });
        _cbmPanel.setActive(true);
    }
    async function cbmBuild() {
        if (!_authoring.ops.length) { dlgNotice('Import or add an op first.'); return; }
        // t1081 SAFETY — REFUSE, loudly and by name, a slot whose form values would be overwritten by a generator's own
        // working variables. Measured: composing two mill ops puts the RPM field on #20, which the pocket then writes to
        // 0, so `M3 S[#20]` commands S0 — a non-rotating tool driven through the toolpath. Checked BEFORE the destination
        // prompt so the user is not asked where to put a slot that cannot be built.
        const _pv = cbmPreviewSlot();
        const _cols = fieldVarCollisions(_pv.fields, _pv.ops, camBandsOf);
        if (_cols.length) { dlgNotice(collisionMessage(_cols)); return; }
        // t1127 S3 — the destination is now UNAMBIGUOUS (valid-by-construction): Edit OVERWRITES _editingSlot in place, New
        // always MINTS the next cam number. The old "new vs overwrite" prompt (cbmBuildModal) is eliminated.
        const ops = _authoring.ops.map(toManifest);
        let slot;
        if (_editingSlot != null) {
            slot = _camPack.slots.find((s) => +s.slot === _editingSlot);
            if (!slot) { cbmExit(); return; }           // the slot vanished under us — bail (cbmExit clears _editingSlot)
            slot.ops = ops; if (_authoring.name) slot.name = _authoring.name;
        } else {
            slot = { slot: nextSlotNum(), name: _authoring.name || 'New CAM slot', ops }; _camPack.slots.push(slot);
        }
        // t1135 S5b — rasterize the INLINE editor's LIVE layers → the camN.bmp, then carry the icon (layers + data) to the slot
        // on BOTH New (Build) and Edit (Update). Rasterize is async (an SVG tile may load); a failure keeps whatever icon exists.
        if (_iconEditor) {
            try { const data = await _iconEditor.rasterize(); _authoring.icon = { name: (_authoring.name || 'cam') + '.bmp', data, w: 360, h: 180, layers: _iconEditor.getLayers() }; } catch (_) { /* keep the existing icon */ }
        }
        if (_authoring.icon) slot.icon = _authoring.icon;   // carry the wizard icon to the slot
        buildSlotFromOps(slot); saveCamPack(); cbmExit();
    }

    function renderCamBuilder() {
        const host = q('cam_slots'); if (!host) return;
        const nameEl = q('cam_pack_name'); if (nameEl && document.activeElement !== nameEl) nameEl.value = (_camPack.meta && _camPack.meta.name) || '';
        const v = slotPack.validatePack(_camPack, { bandsOf: camBandsOf });
        const vEl = q('cam_validate');
        if (vEl) vEl.innerHTML = [...v.errors.map((e) => '⛔ ' + e), ...v.warnings.map((w) => '⚠ ' + w)].join('<br>') || ('✓ No collisions · ' + slotPack.usedParams(_camPack).size + '/400 form params used.');
        if (!_camPack.slots.length) { host.innerHTML = '<div class="settings-hint">No slots yet — “＋ New CAM slot” composes one from your program. Slots default to cam' + ((_camPack.meta && _camPack.meta.baseSlot) || 22) + '+ (cam0–21 are factory / community).</div>'; return; }
        host.innerHTML = _camPack.slots.map((slot, si) => {
            // S1 (declare-never-infer): the settings panel is now a read-mostly DISPLAY — authoring lives in the wizard.
            // The op summary is read from the slot.ops MANIFEST via the declared OP_LABEL, NEVER by re-parsing the compiled
            // slot.body. A legacy/hand-built slot (no slot.ops) shows no summary.
            const opSummary = (slot.ops || []).map((o) => OP_LABEL[o.type] || (o.type === 'universal' ? '⚙ Custom op' : (o.type || 'op'))).join(' + ');
            return `<div class="cam-slot" data-si="${si}" style="border:1px solid var(--border); border-radius:6px; padding:8px; margin-bottom:10px;">
                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                    <label style="font-size:11px; color:var(--text-dim);">cam<input type="number" class="cs" data-f="slot" value="${slot.slot}" min="0" max="9999" style="width:60px; margin-left:2px;"></label>
                    <input class="cs" data-f="name" value="${camEsc(slot.name)}" placeholder="Slot name" style="flex:1; min-width:120px;">
                    <label style="font-size:10px; color:var(--text-dim);" title="Work coordinate system this slot's macro runs in. Active = whatever G54–G59 the operator has selected; or bake a specific one.">WCS<select class="cs" data-f="wcs" style="margin-left:3px;">${['active', 'G54', 'G55', 'G56', 'G57', 'G58', 'G59'].map((o) => `<option value="${o}"${(slot.wcs || 'active') === o ? ' selected' : ''}>${o === 'active' ? 'Active' : o}</option>`).join('')}</select></label>
                    <span style="font-size:10px; color:var(--text-dim);">-m${slotPack.slotGroup(slot.slot)}</span>
                    <button class="op-btn" data-act="dupslot" title="Duplicate this slot to a new cam number">⧉</button>
                    <button class="op-btn" data-act="dels" title="Remove slot">✕</button>
                </div>
                <div style="display:flex; gap:8px; align-items:center; margin-top:6px;">
                    ${slot.icon ? `<img src="${slot.icon.data}" alt="" style="width:72px; height:36px; object-fit:contain; border:1px solid var(--border); background:#000;"><span style="font-size:10px; color:var(--text-dim);">${camEsc(slot.icon.name)}${slot.icon.w ? ' · ' + slot.icon.w + '×' + slot.icon.h + (slot.icon.w === 360 && slot.icon.h === 180 ? '' : ' ⚠ not 360×180') : ''}</span>` : '<span style="font-size:11px; color:var(--text-dim);">No icon (camN.bmp)</span>'}
                </div>
                ${opSummary ? `<div style="font-size:11px; color:var(--text-dim); margin-top:6px;"><span style="opacity:.65;">ops:</span> ${camEsc(opSummary)}</div>` : ''}
                <div class="settings-row" style="margin-top:6px; flex-wrap:wrap;">${(slot.ops && slot.ops.length) ? '<button class="toolbar-btn settings-io" data-act="editslot" title="Reopen this slot in the wizard, pre-seeded from its ops — tune expose/bake + values, then Update it in place.">✎ Edit</button>' : '<span title="This slot has no declared ops (a legacy hand-built macro), so it can’t be edited in the wizard — re-author it via ＋ New CAM slot. View output / Simulate / Delete still work." style="font-size:10px; color:var(--text-dim); cursor:help; align-self:center;">ⓘ hand-built — no wizard Edit</span>'}<span style="flex:1"></span><button class="toolbar-btn settings-io" data-act="sim" title="Run this slot's macro in the simulator with each field seeded from its default — verify the toolpath before publishing.">▶ Simulate</button><button class="toolbar-btn settings-io" data-act="exp">⬇ Export macro + eng to editor</button></div>
            </div>`;
        }).join('');
    }
    // t1135 S5b — Import a BMP/image into the INLINE editor as a movable/resizable TILE layer (so it composes + rasterizes
    // like anything drawn). The settings icon buttons that used to call this were removed in S1; the wizard is the only caller.
    function importCamIcon() {
        const input = document.createElement('input'); input.type = 'file'; input.accept = '.bmp,image/bmp,image/*';
        input.addEventListener('change', () => {
            const f = input.files && input.files[0]; if (!f || !_iconEditor) return;
            const r = new FileReader();
            r.onload = () => { _iconEditor.addImage(r.result); };
            r.readAsDataURL(f);
        });
        input.click();
    }
    async function svgToCamIcon(slot, svgName) {
        try {
            const resp = await fetch('assets/svg/' + svgName + '.svg');
            if (!resp.ok) throw new Error('SVG not found (' + resp.status + ')');
            let svg = (await resp.text()).replace(/width="100%"/, 'width="465"').replace(/height="100%"/, 'height="465"');
            const blobUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
            const img = new Image();
            img.onload = () => {
                const W = 360, H = 180; const c = document.createElement('canvas'); c.width = W; c.height = H;
                const ctx = c.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
                const iw = img.naturalWidth || 465, ih = img.naturalHeight || 465; const sc = Math.min(W / iw, H / ih);
                ctx.drawImage(img, (W - iw * sc) / 2, (H - ih * sc) / 2, iw * sc, ih * sc);
                URL.revokeObjectURL(blobUrl);
                try { slot.icon = { name: svgName + '.bmp', data: bmpDataUrl(W, H, ctx.getImageData(0, 0, W, H).data), w: W, h: H, source: 'svg:' + svgName }; saveCamPack(); renderCamBuilder(); }
                catch (e) { dlgNotice('Could not read the rendered icon: ' + (e && e.message ? e.message : e)); }
            };
            img.onerror = () => { URL.revokeObjectURL(blobUrl); dlgNotice('Could not render ' + svgName + '.svg'); };
            img.src = blobUrl;
        } catch (e) { dlgNotice('Palette icon failed: ' + (e && e.message ? e.message : e)); }
    }
    // Simulate a slot: run its macro through the shared preview panel with the #2600 mirrors SEEDED from each
    // field's default (mirror = #param + 1500). Lets the pack author verify the toolpath before publishing —
    // the same engine + 2D/3D view the editor preview uses, in a throwaway modal.
    function simulateSlot(slot) {
        if (window.ddcsStopPreview) window.ddcsStopPreview();   // only one engine runs at a time
        const macro = slotPack.slotMacro(slot);
        const seed = new Map();
        (slot.fields || []).forEach((f) => { const v = Number(f.def); seed.set(slotPack.mirrorVar(f.idx), Number.isFinite(v) ? v : 0); });
        // Probe macros (G31) trace their full travel unless the engine has stock to clamp to — the panel's
        // Stock button (📦) sets it, so a probe then stops at the real surface instead of running to the limit.
        const isProbe = /\bG31\b/.test(macro);
        const hint = isProbe ? 'probes clamp to Stock (📦) — else they trace full travel' : 'form values seeded from field defaults';
        const overlay = document.createElement('div');
        overlay.className = 'cam-sim-overlay';
        overlay.style.cssText = 'position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,.6); display:flex; align-items:center; justify-content:center;';
        overlay.innerHTML = `<div style="width:min(1100px,92vw); height:min(760px,88vh); background:var(--panel,#161b22); border:1px solid var(--border); border-radius:10px; display:flex; flex-direction:column; overflow:hidden;">
            <div style="display:flex; align-items:center; gap:10px; padding:8px 12px; border-bottom:1px solid var(--border);">
                <b style="flex:1">▶ Simulate — ${camEsc(slot.name || ('CAM slot ' + slot.slot))}</b>
                <span class="settings-hint" style="margin:0">${hint}</span>
                <button class="toolbar-btn settings-io" data-sim-close>✕ Close</button>
            </div>
            <div class="cam-sim-host" style="flex:1; position:relative; min-height:0;"></div>
        </div>`;
        document.body.appendChild(overlay);
        const panel = createPreviewPanel(overlay.querySelector('.cam-sim-host'), { getGcode: () => macro, createVarStore: () => new Map(seed), ...probePreviewOpts(slot, macro) });
        panel.setActive(true);
        const close = () => { try { panel.stop(); panel.setActive(false); } catch (_) { /* noop */ } overlay.remove(); document.removeEventListener('keydown', onKey); };
        const onKey = (e) => { if (e.key === 'Escape') close(); };
        overlay.querySelector('[data-sim-close]').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        document.addEventListener('keydown', onKey);
    }

    const camHost = q('cam_slots');
    if (camHost) {
        camHost.addEventListener('input', (e) => {
            const t = e.target; const card = t.closest('.cam-slot'); if (!card) return; const slot = _camPack.slots[+card.dataset.si]; if (!slot) return;
            if (t.classList.contains('cs')) {   // the header light-edits kept in the display: cam# / name / WCS
                const fld = t.dataset.f;
                if (fld === 'slot') { slot.slot = parseInt(t.value, 10) || 0; saveCamPack(); renderCamBuilder(); }
                else { slot[fld] = t.value; saveCamPack(); renderCamBuilder(); }
            }
        });
        camHost.addEventListener('click', (e) => {
            const card = e.target.closest('.cam-slot'); if (!card) return; const si = +card.dataset.si; const slot = _camPack.slots[si]; if (!slot) return; const a = e.target.dataset.act;
            // S1 — the settings panel is read-mostly: only the DISPLAY actions live here (Delete / Duplicate the slot,
            // Simulate, View output). Authoring (fields, ops, macro, icon) moved to the wizard (S2/S3/S5).
            if (a === 'dels') { _camPack.slots.splice(si, 1); saveCamPack(); renderCamBuilder(); }
            else if (a === 'editslot') { editCamSlot(slot); }   // t1127 S3 — reopen the wizard pre-seeded from the manifest → Update in place
            else if (a === 'dupslot') {
                const clone = JSON.parse(JSON.stringify(slot)); delete clone.bodyDirty;
                clone.slot = nextSlotNum();
                const otherUsed = new Set(); _camPack.slots.forEach((s) => (s.fields || []).forEach((f) => otherUsed.add(f.idx)));
                _camPack.slots.push(clone);
                if (clone.ops && clone.ops.length) buildSlotFromOps(clone);   // structured → fresh params for free
                else reallocSlotParams(clone, otherUsed);                     // legacy → remap params off the original
                clone.name = (clone.name || 'Slot') + ' (copy)';
                saveCamPack(); renderCamBuilder();
            }
            else if (a === 'sim') { simulateSlot(slot); }
            else if (a === 'exp') { insertToEditor('( ===== eng form lines — MERGE into the controller eng language file ===== )\n' + slotPack.slotEng(slot) + '\n\n' + slotPack.slotMacro(slot)); }
        });
    }
    const _camName = q('cam_pack_name');
    if (_camName) _camName.addEventListener('input', () => { _camPack.meta = _camPack.meta || {}; _camPack.meta.name = _camName.value; saveCamPack(); });
    const nextSlotNum = () => { const base = (_camPack.meta && _camPack.meta.baseSlot) || 22; const used = new Set(_camPack.slots.map((s) => +s.slot)); let n = base; while (used.has(n)) n++; return n; };
    const _camBuildSlot = q('cam_build_slot');   // t1045 S1c — CAM-tab door: open the authoring modal (seeds from the program). t1125 S2 — now the ONLY new-slot door (the blank-slot cam_add_slot is gone; blank-canvas authoring is by-design removed)
    if (_camBuildSlot) _camBuildSlot.addEventListener('click', () => openCamAuthoring());
    // Expose the ONE opener so the editor op card (door 1) + toolbar (door 2) trigger the same modal. camTypeOf lets a
    // caller check CAM-ability before offering the action.
    window.ddcsOpenCamAuthoring = (op) => openCamAuthoring(op);
    window.ddcsCamTypeOf = (op) => camTypeOf(op);
    // Pack export: bundle the whole pack into a USB-ready .zip (CAM/ folder + eng-merge + README).
    const packBytes = (dataUrl) => { const bin = atob(String(dataUrl || '').split(',')[1] || ''); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
    const readmeText = (name) => [name, '',
        'INSTALL (DDCS Expert / M350):',
        '1. Copy the CAM/ folder onto a FAT32 USB stick.',
        '2. Power off the controller, insert the USB, power on, wait for restart.',
        '3. F2 -> Program -> F1 (select U-disk) -> cursor on the CAM folder -> F4 (copy to local).',
        '   Macros MUST run from internal storage — running from USB silently does nothing.',
        '4. MERGE eng-additions.txt into the controller eng (and chs) language file — do NOT replace it.',
        '5. Open the CAM page: bind a K-key (K1-K7) to function code 1399 (parameter range Pr210-252),',
        '   then press it. The new slots (cam22+) appear as icons — tap one, fill the form, press Start.',
        '', 'Spindle: the cutting slots run M3/M5 themselves. If your CAM workflow starts the spindle',
        'separately, delete the M3/G04/M5 lines from the macro (they are plain editable lines).'].join('\n') + '\n';
    const _camExport = q('cam_export_pack');
    if (_camExport) _camExport.addEventListener('click', async () => {
        if (!_camPack.slots.length) { dlgNotice('No slots to export — add a slot first.'); return; }
        const v = slotPack.validatePack(_camPack, { bandsOf: camBandsOf });
        if (!v.ok && !await dlgConfirm('This pack has problems:\n\n' + v.errors.join('\n') + '\n\nExport anyway?')) return;
        const files = [], eng = [];
        _camPack.slots.forEach((slot) => {
            files.push({ name: `CAM/macro_cam${slot.slot}.nc`, data: slotPack.slotMacro(slot) });
            if (slot.icon && slot.icon.data) files.push({ name: `CAM/cam${slot.slot}.bmp`, data: packBytes(slot.icon.data) });
            eng.push(`( ===== cam${slot.slot} — ${slot.name || ''} ===== )`, slotPack.slotEng(slot), '');
        });
        files.push({ name: 'eng-additions.txt', data: '( MERGE these lines into the controller eng/chs language file — do NOT replace it. )\n\n' + eng.join('\n') });
        const name = (_camPack.meta && _camPack.meta.name) || 'CAM pack';
        files.push({ name: 'README.txt', data: readmeText(name) });
        downloadBytes(name.replace(/[^\w-]+/g, '_') + '.zip', makeZip(files));
    });

    // Safe eng merge: paste the controller's CURRENT eng → append this pack's params, flag collisions, download.
    const _camMerge = q('cam_merge_eng');
    if (_camMerge) _camMerge.addEventListener('click', () => {
        if (!_camPack.slots.length) { dlgNotice('No slots to merge — add a slot first.'); return; }
        const additions = _camPack.slots.map((s) => slotPack.slotEng(s)).join('\n') + '\n';
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,.6); display:flex; align-items:center; justify-content:center;';
        overlay.innerHTML = `<div style="width:min(900px,92vw); height:min(680px,88vh); background:var(--panel,#161b22); border:1px solid var(--border); border-radius:10px; display:flex; flex-direction:column; overflow:hidden;">
            <div style="display:flex; align-items:center; gap:10px; padding:8px 12px; border-bottom:1px solid var(--border);"><b style="flex:1">🔗 Merge into controller eng</b><button class="toolbar-btn settings-io" data-mc>✕ Close</button></div>
            <div style="padding:12px; display:flex; flex-direction:column; gap:8px; flex:1; min-height:0;">
                <div class="settings-hint">Paste the controller's CURRENT <code>eng</code> file (pull it over the gateway or copy from the controller). Studio appends this pack's params and flags any <code>#param</code> / <code>-m</code> group collisions — then downloads the merged <code>eng</code> to push back. It never replaces existing content.</div>
                <textarea data-eng spellcheck="false" placeholder="paste the controller eng here…" style="flex:1; width:100%; font:12px/1.4 monospace; box-sizing:border-box;"></textarea>
                <div data-mout class="settings-hint" style="margin:0"></div>
                <div class="settings-row"><button class="toolbar-btn settings-io" data-mgo>Check &amp; download merged eng</button></div>
            </div></div>`;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.querySelector('[data-mc]').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        overlay.querySelector('[data-mgo]').addEventListener('click', () => {
            const eng = overlay.querySelector('[data-eng]').value;
            if (!eng.trim()) { dlgNotice('Paste the controller eng first.'); return; }
            const m = slotPack.mergeEng(eng, additions);
            const msgs = [];
            if (m.paramCollisions.length) msgs.push('⚠ #param collisions (already defined in the eng): ' + m.paramCollisions.map((n) => '#' + n).join(', ') + ' — reallocate these fields in the builder before installing.');
            if (m.groupCollisions.length) msgs.push('⚠ -m group collisions: ' + m.groupCollisions.map((g) => 'm' + g).join(', ') + ' — change the slot number(s).');
            msgs.push(`Appended ${m.added.length} param line(s).` + (m.paramCollisions.length || m.groupCollisions.length ? ' Merged file downloaded, but FIX the collisions first.' : ' No collisions — safe to install.'));
            const out = overlay.querySelector('[data-mout]');
            out.innerHTML = msgs.join('<br>');
            out.style.color = (m.paramCollisions.length || m.groupCollisions.length) ? '#ff6b6b' : '#3c9';
            const blob = new Blob([m.merged], { type: 'text/plain' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'eng-merged.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        });
    });

    renderCamBuilder();
}

window.ddcsInitMacrosApp = initMacrosApp;
