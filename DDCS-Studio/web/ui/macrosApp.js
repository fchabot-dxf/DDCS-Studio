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
import { openIconEditor } from './iconEditor.js';
import { slotFromOp } from '../data/opToSlot.js';
import { cornerSlot, edgeSlot, probeZSlot, insideCentreSlot, bossCentreSlot, alignmentSlot } from '../data/probeToSlot.js';
import { pocketSlot, circlePocketSlot, surfacingSlot } from '../data/millToSlot.js';
import { autoIconBmp } from '../data/autoIcon.js';
import { auditMacroVars } from '../data/varMap.js';
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
                        <div class="settings-hint">Author a DDCS Expert <b>CAM-menu pack</b> — parameterized macro slots for the controller's CAM page — to share with the community. Each slot = a <b>form</b> + a <b>macro</b> that reads the form live (the <code>#2600+</code> mirrors). Studio auto-allocates the shared <code>#1100–1499</code> form params and flags collisions. <i>Phase 1: form designer + macro + plain export. Icons + eng-merge install come next.</i></div>
                        <div class="settings-row"><label>Pack name<input type="text" id="cam_pack_name"></label><button class="toolbar-btn settings-io" id="cam_add_slot">＋ Add slot</button><button class="toolbar-btn settings-io" id="cam_export_pack" title="Bundle every slot (macro_camN.nc + camN.bmp) + the eng lines to merge + an install README into a USB-ready .zip.">📦 Export pack (.zip)</button><button class="toolbar-btn settings-io" id="cam_merge_eng" title="Paste the controller's CURRENT eng file → get a safely-merged eng (your pack appended, #param / -m group collisions flagged). Avoids the community full-replace mistake.">🔗 Merge eng</button></div>
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
    const secondCtlOpts = (method, sel) => (SECOND_CTL[method] ? SECOND_CTL[method].opts.map(([val, lbl]) => `<option value="${val}"${sel === val ? ' selected' : ''}>${lbl}</option>`).join('') : '');
    const secondCtlTitle = (method) => (SECOND_CTL[method] ? SECOND_CTL[method].title : '');
    // Rebuild the second dropdown's options + tooltip for a method, hiding it when the op has no build-time choice.
    function applySecondCtl(sel, method) {
        const has = !!SECOND_CTL[method];
        sel.innerHTML = secondCtlOpts(method);
        sel.title = secondCtlTitle(method);
        sel.style.display = has ? '' : 'none';
    }
    // ---- Structured op model: a slot can remember the OPS it was built from (slot.ops = [{type, variant}]) so
    // they can be edited as cards and the macro REGENERATED from them. Legacy/hand-built slots (no slot.ops) keep
    // the raw-text workflow untouched. ----
    const OP_LABEL = { drill: 'Drill', bore: 'Bore', slot: 'Slot', pocket: 'Pocket (rect)', cpocket: 'Pocket (circle)', surface: 'Surface / face', corner: 'Probe corner', edge: 'Probe edge', zprobe: 'Probe Z surface', inside: 'Probe inside centre', boss: 'Probe boss centre', align: 'Probe alignment' };
    const CAM_GEN = { corner: cornerSlot, edge: edgeSlot, zprobe: probeZSlot, inside: insideCentreSlot, boss: bossCentreSlot, align: alignmentSlot, pocket: pocketSlot, cpocket: circlePocketSlot, surface: surfacingSlot };
    const opTypeOpts = (sel) => Object.entries(OP_LABEL).map(([v, l]) => `<option value="${v}"${sel === v ? ' selected' : ''}>${l}</option>`).join('');
    const defaultVariant = (type) => (SECOND_CTL[type] ? SECOND_CTL[type].opts[0][0] : '');
    // Generate one op into a starting point. The mill/probe ops live in CAM_GEN; drill/bore/slot go via slotFromOp.
    // S1a — a `decl` (the expose/bake declaration) threads through to allocFieldsWith / slotFromOp's inline hook.
    const generateOp = (type, variant, used, off, decl) => (CAM_GEN[type] ? CAM_GEN[type](used, off, variant, decl) : slotFromOp(type, variant, used, off, decl));
    // Columns the user can tune in the field table that we PERSIST per op (so a regenerate keeps them, matched by
    // field key). `var` is generator-assigned (renaming would desync the body) and `type` has no column, so neither
    // is persisted. Stored on the op as op.values[key] = {def, min, max, label, units}.
    const FIELD_OVR_COLS = ['label', 'units', 'def', 'min', 'max'];
    // S1a — the expose/bake declaration for a manifest op (siblings of op.values): a param is BAKED when
    // op.exposed[key] === false, its frozen literal = op.baked[key]. Both maps are ABSENT until S1b's UI writes them,
    // so decl is empty today → allocFieldsWith / slotFromOp run all-exposed → every existing slot is byte-identical.
    const declFromOp = (op) => {
        const ex = op.exposed || {}, bk = op.baked || {}, decl = {};
        new Set([...Object.keys(ex), ...Object.keys(bk)]).forEach((k) => { if (ex[k] === false) decl[k] = { exposed: false, value: bk[k] }; });
        return decl;
    };
    // A read-line in canonical form (identical to what every generator emits) — used to re-sync the macro comment
    // to a tuned field so the table, the macro, Simulate and "Refresh fields" all agree.
    const canonicalRead = (f) => `${f.var}=#${f.idx + 1500}   ;${f.label}${f.units ? ' [' + f.units + ']' : ''} =${f.def} [${f.min}~${f.max}]`;
    function applyOverridesToBody(body, fields, values) {
        let out = body;
        fields.forEach((f) => {
            if (!values[f.key]) return;   // only fields the user actually tuned
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
            const gen = generateOp(op.type, op.variant, used, fields.length, declFromOp(op));
            let body = gen.body;
            gen.fields.forEach((f) => {
                used.add(f.idx);
                f._op = oi;
                const ov = op.values && op.values[f.key];
                if (ov) FIELD_OVR_COLS.forEach((k) => { if (ov[k] !== undefined) f[k] = ov[k]; });
            });
            if (op.values) body = applyOverridesToBody(body, gen.fields, op.values);
            fields = fields.concat(gen.fields);
            parts.push(body);
            name = name ? name + ' + ' + gen.name.replace(/^(Drill|Bore) — /, '') : gen.name;
        });
        slot.fields = fields;
        slot.body = parts.join('\n\n');
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
    // The editable op list for a slot (empty for legacy/hand-built slots with no op manifest).
    function opCardsHtml(slot) {
        if (!slot.ops || !slot.ops.length) return '';
        const cards = slot.ops.map((op, oi) => `<div class="cam-op-card" style="display:flex; align-items:center; gap:6px; padding:4px 6px; background:rgba(127,127,127,.05); border:1px solid var(--border); border-radius:6px;">
                <span style="font-size:10px; color:var(--text-dim); width:14px; text-align:center;">${oi + 1}</span>
                <select class="cam-op-type" data-oi="${oi}" title="Op type — changing it rebuilds this op's fields + macro">${opTypeOpts(op.type)}</select>
                <select class="cam-op-var" data-oi="${oi}" title="${secondCtlTitle(op.type)}"${SECOND_CTL[op.type] ? '' : ' style="display:none"'}>${secondCtlOpts(op.type, op.variant)}</select>
                <span style="flex:1"></span>
                <button class="op-btn" data-act="opup" data-oi="${oi}" title="Move up (ops run in this order)"${oi === 0 ? ' disabled' : ''}>▲</button>
                <button class="op-btn" data-act="opdown" data-oi="${oi}" title="Move down (ops run in this order)"${oi === slot.ops.length - 1 ? ' disabled' : ''}>▼</button>
                <button class="op-btn" data-act="dupop" data-oi="${oi}" title="Duplicate this op">⧉</button>
                <button class="op-btn" data-act="delop" data-oi="${oi}" title="Remove this op">✕</button>
            </div>`).join('');
        const dirty = slot.bodyDirty ? '<div class="settings-hint" style="color:#fd0; margin:0;">✎ macro hand-edited — changing an op rebuilds it and discards those edits</div>' : '';
        return `<div class="cam-ops" style="margin-top:8px; display:flex; flex-direction:column; gap:5px;">
                <div style="font-size:10px; color:var(--text-dim);">OPS IN THIS SLOT — edit to rebuild the macro (tuned field values are kept where the new op shares the same field)</div>
                ${cards}${dirty}
            </div>`;
    }
    // The "＋ Add op" generator cluster (op + context-aware variant + Generate). Lives at the BOTTOM of a slot, in
    // the action bar — it generates/appends an op into the slot; it does not edit the macro shown above it.
    function addOpClusterHtml() {
        return `<span style="display:inline-flex; align-items:center; gap:6px; padding:4px 8px; border:1px dashed var(--border); border-radius:6px; background:rgba(127,127,127,.06);"><span style="font-size:10px; color:var(--text-dim); white-space:nowrap;" title="Pick a NEW op to generate into this slot. These do NOT edit the macro above — the macro body is the editable source of truth.">＋ Add op:</span><select class="cam-op"><option value="drill">Drill</option><option value="bore">Bore</option><option value="slot">Slot</option><option value="pocket">Pocket (rect)</option><option value="cpocket">Pocket (circle)</option><option value="surface">Surface / face</option><option value="corner">Probe corner</option><option value="edge">Probe edge</option><option value="zprobe">Probe Z surface</option><option value="inside">Probe inside centre</option><option value="boss">Probe boss centre</option><option value="align">Probe alignment</option></select><select class="cam-op-pat" title="${secondCtlTitle('drill')}">${secondCtlOpts('drill')}</select><button class="toolbar-btn settings-io" data-act="addop" title="Generate the selected op into the slot — fills a blank slot, or APPENDS it to the existing macro (multi-op). It does NOT rewrite code you've already edited; the macro body above is the editable source of truth.">Generate ▸</button></span>`;
    }
    function renderCamBuilder() {
        const host = q('cam_slots'); if (!host) return;
        const nameEl = q('cam_pack_name'); if (nameEl && document.activeElement !== nameEl) nameEl.value = (_camPack.meta && _camPack.meta.name) || '';
        const v = slotPack.validatePack(_camPack);
        const vEl = q('cam_validate');
        if (vEl) vEl.innerHTML = [...v.errors.map((e) => '⛔ ' + e), ...v.warnings.map((w) => '⚠ ' + w)].join('<br>') || ('✓ No collisions · ' + slotPack.usedParams(_camPack).size + '/400 form params used.');
        if (!_camPack.slots.length) { host.innerHTML = '<div class="settings-hint">No slots yet — “＋ Add slot”. Slots default to cam' + ((_camPack.meta && _camPack.meta.baseSlot) || 22) + '+ (cam0–21 are factory / community).</div>'; return; }
        host.innerHTML = _camPack.slots.map((slot, si) => {
            const fields = slot.fields || [];
            const rows = fields.map((f, fi) => `<tr data-si="${si}" data-fi="${fi}">
                <td><input class="cf" data-f="label" value="${camEsc(f.label)}" placeholder="Label" style="width:100%;"></td>
                <td><input class="cf" data-f="units" value="${camEsc(f.units)}" placeholder="mm" style="width:46px;"></td>
                <td><input class="cf" data-f="def" type="number" value="${f.def != null ? f.def : 0}" style="width:62px;"></td>
                <td><input class="cf" data-f="min" type="number" value="${f.min != null ? f.min : 0}" style="width:62px;"></td>
                <td><input class="cf" data-f="max" type="number" value="${f.max != null ? f.max : 0}" style="width:62px;"></td>
                <td><input class="cf" data-f="var" value="${camEsc(f.var || '#' + (fi + 1))}" style="width:42px;"></td>
                <td style="color:var(--text-dim); font-size:10px; white-space:nowrap;">#${f.idx} → #${slotPack.mirrorVar(f.idx)}</td>
                <td><button class="op-btn" data-act="delf" title="Remove field">✕</button></td>
            </tr>`).join('');
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
                    ${slot.icon ? `<img src="${slot.icon.data}" alt="" style="width:72px; height:36px; object-fit:contain; border:1px solid var(--border); background:#000;"><span style="font-size:10px; color:var(--text-dim);">${camEsc(slot.icon.name)}${slot.icon.w ? ' · ' + slot.icon.w + '×' + slot.icon.h + (slot.icon.w === 360 && slot.icon.h === 180 ? '' : ' ⚠ not 360×180') : ''}</span><button class="op-btn" data-act="delicon" title="Remove icon">✕</button>` : '<span style="font-size:11px; color:var(--text-dim);">No icon (camN.bmp)</span>'}
                    <button class="toolbar-btn settings-io" data-act="edit">🎨 ${slot.icon ? 'Edit' : 'Create'} icon</button>
                    <button class="toolbar-btn settings-io" data-act="icon">🖼 Import BMP</button>
                </div>
                <table style="width:100%; font-size:11.5px; margin-top:6px; border-collapse:collapse;"><thead><tr style="color:var(--text-dim); font-size:10px; text-align:left;"><th>Label</th><th>Units</th><th>Default</th><th>Min</th><th>Max</th><th>Var</th><th>#param→#2600</th><th></th></tr></thead><tbody>${rows}</tbody></table>
                <div class="settings-row" style="margin-top:4px;"><button class="toolbar-btn settings-io" data-act="addf">＋ Add field</button><button class="toolbar-btn settings-io" data-act="refresh" title="Rebuild the field table from the macro's #2600 mirror-read comments — label, units, default and min~max all come from the macro (field type is preserved). Edit a read-line comment, then refresh to apply it.">🔄 Refresh fields from macro</button></div>
                ${opCardsHtml(slot)}
                <textarea class="cs" data-f="body" spellcheck="false" placeholder="macro body — declare fields as  #1=#2600 ;Label [mm] =0 [min~max]  then reference each Var (#1, #2 …)" style="width:100%; height:130px; margin-top:6px; font:12px/1.4 monospace; box-sizing:border-box;">${camEsc(slot.body)}</textarea>
                ${(() => { const a = auditMacroVars(slot.body); return a.danger.length ? `<div class="settings-hint" style="color:#ff6b6b; margin-top:4px;">⚠ macro writes persistent vars — ${a.danger.map(camEsc).join('; ')}</div>` : ''; })()}
                <div class="settings-row" style="margin-top:6px; flex-wrap:wrap;">${addOpClusterHtml()}<span style="flex:1"></span><button class="toolbar-btn settings-io" data-act="sim" title="Run this slot's macro in the simulator with each field seeded from its default — verify the toolpath before publishing.">▶ Simulate</button><button class="toolbar-btn settings-io" data-act="exp">⬇ Export macro + eng to editor</button></div>
            </div>`;
        }).join('');
    }
    function importCamIcon(slot) {
        const input = document.createElement('input'); input.type = 'file'; input.accept = '.bmp,image/bmp,image/*';
        input.addEventListener('change', () => {
            const f = input.files && input.files[0]; if (!f) return;
            const r = new FileReader();
            r.onload = () => {
                const data = r.result; const img = new Image();
                img.onload = () => { slot.icon = { name: f.name, data, w: img.naturalWidth, h: img.naturalHeight }; saveCamPack(); renderCamBuilder(); };
                img.onerror = () => { slot.icon = { name: f.name, data }; saveCamPack(); renderCamBuilder(); };
                img.src = data;
            };
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
        const panel = createPreviewPanel(overlay.querySelector('.cam-sim-host'), { getGcode: () => macro, createVarStore: () => new Map(seed) });
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
            if (t.classList.contains('cf')) {
                const f = (slot.fields || [])[+t.closest('tr').dataset.fi]; if (!f) return; const fld = t.dataset.f;
                f[fld] = (fld === 'label' || fld === 'units' || fld === 'var') ? t.value : (t.value === '' ? '' : parseFloat(t.value));
                // Structured slot: remember this tuned column on the owning op so a regenerate keeps it.
                if (slot.ops && f._op != null && f.key && FIELD_OVR_COLS.includes(fld)) {
                    const op = slot.ops[f._op];
                    if (op) { op.values = op.values || {}; op.values[f.key] = op.values[f.key] || {}; op.values[f.key][fld] = f[fld]; }
                }
                saveCamPack();
            } else if (t.classList.contains('cs')) {
                const fld = t.dataset.f;
                if (fld === 'slot') { slot.slot = parseInt(t.value, 10) || 0; saveCamPack(); renderCamBuilder(); }
                else { slot[fld] = t.value; if (fld === 'body' && slot.ops && slot.ops.length) slot.bodyDirty = true; saveCamPack(); if (fld !== 'body') renderCamBuilder(); }
            }
        });
        camHost.addEventListener('click', (e) => {
            const card = e.target.closest('.cam-slot'); if (!card) return; const si = +card.dataset.si; const slot = _camPack.slots[si]; if (!slot) return; const a = e.target.dataset.act;
            if (a === 'addf') { slot.fields = slot.fields || []; const idx = slotPack.nextParam(slotPack.usedParams(_camPack)); if (idx == null) { dlgNotice('The #1100–1499 form-param pool is full.'); return; } slot.fields.push({ idx, label: '', units: '', def: 0, min: 0, max: 0, type: 1, var: '#' + (slot.fields.length + 1) }); saveCamPack(); renderCamBuilder(); }
            else if (a === 'delf') { slot.fields.splice(+e.target.closest('tr').dataset.fi, 1); saveCamPack(); renderCamBuilder(); }
            else if (a === 'dels') { _camPack.slots.splice(si, 1); saveCamPack(); renderCamBuilder(); }
            else if (a === 'edit') { openIconEditor(slot.icon || null, (bmp, model) => { slot.icon = { name: (slot.name || 'cam' + slot.slot) + '.bmp', data: bmp, w: 360, h: 180, layers: model.layers }; saveCamPack(); renderCamBuilder(); }); }
            else if (a === 'icon') { importCamIcon(slot); }
            else if (a === 'delicon') { slot.icon = null; saveCamPack(); renderCamBuilder(); }
            else if (a === 'addop') {
                const method = card.querySelector('.cam-op').value, variant = card.querySelector('.cam-op-pat').value;
                // The second dropdown's value is the op's VARIANT: pattern for drill/bore, raster dir ('x'/'y') for
                // pocket/surface, arc dir ('G3'/'G2') for the round pocket. Probes ignore it (runtime form fields).
                const empty = !(slot.fields && slot.fields.length) && !String(slot.body || '').trim();
                if (!slot.ops && !empty) {
                    // Legacy / hand-built slot (no op manifest) — keep the raw-text append so manual work is never lost.
                    const gen = generateOp(method, variant, slotPack.usedParams(_camPack), (slot.fields || []).length);
                    slot.fields = (slot.fields || []).concat(gen.fields);
                    slot.body = String(slot.body || '').replace(/\s+$/, '') + '\n\n' + gen.body;
                    slot.name = (slot.name || 'Slot') + ' + ' + gen.name.replace(/^(Drill|Bore) — /, '');
                } else {
                    // Structured slot — record the op and regenerate fields + body from the whole op list.
                    slot.ops = slot.ops || [];
                    slot.ops.push({ type: method, variant });
                    buildSlotFromOps(slot);
                    // Auto-seed a labelled icon so a fresh slot isn't blank (editable via the icon editor).
                    if (empty && !slot.icon) { try { slot.icon = { name: (slot.name || 'cam' + slot.slot) + '.bmp', data: autoIconBmp(slot.name, method), w: 360, h: 180, source: 'auto' }; } catch (_) { /* canvas unavailable */ } }
                }
                saveCamPack(); renderCamBuilder();
            }
            else if (a === 'delop') {
                const oi = +e.target.dataset.oi;
                regenGuard(slot, () => { slot.ops.splice(oi, 1); buildSlotFromOps(slot); saveCamPack(); renderCamBuilder(); });
            }
            else if (a === 'opup' || a === 'opdown') {
                const oi = +e.target.dataset.oi, ni = a === 'opup' ? oi - 1 : oi + 1;
                if (!slot.ops || ni < 0 || ni >= slot.ops.length) return;
                regenGuard(slot, () => { const tmp = slot.ops[oi]; slot.ops[oi] = slot.ops[ni]; slot.ops[ni] = tmp; buildSlotFromOps(slot); saveCamPack(); renderCamBuilder(); });   // values travel with the op
            }
            else if (a === 'dupop') {
                if (!slot.ops) return; const oi = +e.target.dataset.oi; const src = slot.ops[oi]; if (!src) return;
                regenGuard(slot, () => { slot.ops.splice(oi + 1, 0, JSON.parse(JSON.stringify(src))); buildSlotFromOps(slot); saveCamPack(); renderCamBuilder(); });   // deep copy incl. tuned values
            }
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
            else if (a === 'refresh') {
                // Rebuild the field table from the macro's #2600 mirror reads. The read-line comment
                // "(Label [units] =default [min~max])" is the source for label/units/default/range, so editing it
                // in the macro and refreshing actually takes effect. Only `type` (int vs decimal) is preserved
                // from the existing field — it isn't encoded in the comment and has no column in the table to re-enter.
                const scanned = slotPack.fieldsFromMacro(slot.body);
                const byIdx = new Map((slot.fields || []).map((f) => [f.idx, f]));
                slot.fields = scanned.map((s, i) => { const e = byIdx.get(s.idx); return e ? { ...s, type: e.type, var: s.var || e.var } : { ...s, var: s.var || ('#' + (i + 1)) }; });
                saveCamPack(); renderCamBuilder();
            }
            else if (a === 'sim') { simulateSlot(slot); }
            else if (a === 'exp') { insertToEditor('( ===== eng form lines — MERGE into the controller eng language file ===== )\n' + slotPack.slotEng(slot) + '\n\n' + slotPack.slotMacro(slot)); }
        });
        camHost.addEventListener('change', (e) => {
            const t = e.target;
            // Add-op selector: rebuild its variant dropdown into the relevant build-time setting (or hide it).
            if (t.classList.contains('cam-op')) {
                const sel = t.parentElement.querySelector('.cam-op-pat');
                if (sel) applySecondCtl(sel, t.value);
                return;
            }
            // Structured op-card edits → mutate the op manifest and regenerate the slot from it.
            const card = t.closest('.cam-slot'); if (!card) return; const slot = _camPack.slots[+card.dataset.si]; if (!slot || !slot.ops) return;
            const op = slot.ops[+t.dataset.oi]; if (!op) return;
            if (t.classList.contains('cam-op-type')) {
                regenGuard(slot, () => { op.type = t.value; op.variant = defaultVariant(t.value); buildSlotFromOps(slot); saveCamPack(); renderCamBuilder(); });   // reset the variant to the new type's default
            } else if (t.classList.contains('cam-op-var')) {
                regenGuard(slot, () => { op.variant = t.value; buildSlotFromOps(slot); saveCamPack(); renderCamBuilder(); });
            }
        });
    }
    const _camName = q('cam_pack_name');
    if (_camName) _camName.addEventListener('input', () => { _camPack.meta = _camPack.meta || {}; _camPack.meta.name = _camName.value; saveCamPack(); });
    const nextSlotNum = () => { const base = (_camPack.meta && _camPack.meta.baseSlot) || 22; const used = new Set(_camPack.slots.map((s) => +s.slot)); let n = base; while (used.has(n)) n++; return n; };
    const _camAddSlot = q('cam_add_slot');
    if (_camAddSlot) _camAddSlot.addEventListener('click', () => { _camPack.slots.push({ slot: nextSlotNum(), name: 'New slot', fields: [], body: '' }); saveCamPack(); renderCamBuilder(); });
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
        const v = slotPack.validatePack(_camPack);
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
