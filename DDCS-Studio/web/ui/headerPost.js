/**
 * ui/headerPost.js — the global POST-PROCESSOR (dialect) selector in the app header: a discreet chevron
 * quick-action button (#hdrPostBtn) that opens a popover picker (#hdrPostMenu) + a capability LINT (#hdrPostWarn).
 *
 * The post decides WHICH controller's G-code is generated — distinct from the machine PROFILE (hardware
 * config, in Settings → Profile). `auto` follows the active profile's native post; pick a specific post to
 * emit for another controller (e.g. generate grbl / LinuxCNC from a DDCS bench). Changing it re-emits the
 * Blocks/editor projection and re-renders open previews.
 *
 * LINT (warn-don't-break): a loaded program re-emits into the chosen post live (the stack is post-agnostic).
 * But some posts can't RUN what a program uses — e.g. grbl has no #variables/flow, so a probe/ATC macro
 * re-emitted onto grbl is non-runnable (probing on grbl is host-side). Rather than silently hand over broken
 * G-code, a ⚠ next to the selector explains the mismatch. Cutting programs (no #vars) switch cleanly.
 */
import { listPosts, getActivePostId, setActivePostId, getDialect, resolveActivePost, getCaps } from '../wizards/dialects/index.js';
import { getActiveProfile, CONTROLLER_PROFILES } from '../shared/js/profiles/controllerProfiles.js';
import { validate, summarize } from '../shared/js/validate/validate.js';
import { dlgNotice } from './dialog.js';   // in-app notice (t684 d — no bare alert)
import { getMachine, envelopeSummary } from '../data/workspaceMachine.js';   // t1217 — the identity line names THIS WORKSPACE'S MACHINE; t1231 — with its signed envelope
import { THEMES } from './themes.js';
import { EXE_DOWNLOAD_URL } from './gatewayStatus.js';   // the "standalone" desktop EXE release link (same as the Gateway page)
import { openSetupSheet } from './setupSheet.js';   // t850 — the print-ready job page (reads every value from its declared source)
import { openLibrary } from './libraryModal.js';   // t854 — the Library (Projects · Wizards; Profiles retired t1217)

// Quick-menu glyphs (24×24 stroke grid) — mirror the dock toolbar icons so the menu reads consistently.
const HQ_ICONS = {
    open:   { c: '#f59e0b', d: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>' },
    save:   { c: '#0ea5e9', d: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>' },
    load:   { c: '#f59e0b', d: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>' },
    insert: { c: '#14b8a6', d: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>' },
    copy:   { c: '#6366f1', d: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>' },
    clear:  { c: '#ef4444', d: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>' },
    export: { c: '#0ea5e9', d: '<path d="M16 9h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2"/><line x1="12" y1="14" x2="12" y2="3"/><polyline points="8 7 12 3 16 7"/>' },
    standalone: { c: '#22c55e', d: '<rect x="3" y="3" width="18" height="14" rx="2"/><line x1="3" y1="8" x2="21" y2="8"/><polyline points="9 13 12 16 15 13"/><line x1="12" y1="11" x2="12" y2="16"/>' },
    settings: { c: '#94a3b8', d: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' },
    checklist: { c: '#3ddc84', d: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>' },
    setupSheet: { c: '#c084fc', d: '<path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>' },
    library: { c: '#38bdf8', d: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>' },
    wizard: { c: '#a855f7', d: '<path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/>' },
};
// data-act → the existing handler it proxies (file ops are window globals; Open/Save click their header buttons).
const HQ_ACTIONS = [
    { act: 'open',   label: 'Open project' },
    { act: 'save',   label: 'Save project' },
    { act: 'wizard', label: 'Save as custom wizard' },   // register the current op's stack as a bar button (+ its form)
    { act: 'load',   label: 'Load gcode (replace)' },
    { act: 'insert', label: 'Insert gcode' },
    // Copy moved to a floating button in the editor (ui: #editor-copy-btn). Clear stays here as the phone access
    // point (the header Clear shortcut is desktop-only); on desktop it's a fallback to the header trash button.
    { act: 'clear',  label: 'Clear editor' },
    { act: 'export', label: 'Export / download' },
];
// Rendered as its OWN section (the standalone = the desktop EXE release, not a file op).
const HQ_STANDALONE = { act: 'standalone', label: 'Download standalone' };
const HQ_THEME_SWATCH = { studio: '#9aa0a6', normal: '#4a90e2', steampunk: '#b07a2a', futuristic: '#00e5e5', organic: '#6b8e23' };

function runQuickAction(act) {
    switch (act) {
        case 'open':   document.getElementById('projOpenBtn')?.click(); break;
        case 'save':   document.getElementById('projSaveBtn')?.click(); break;
        case 'wizard': window.ddcsSaveAsWizard ? window.ddcsSaveAsWizard() : dlgNotice('Open an op in the Blocks tab first, then save it as a wizard.'); break;
        // t1227 — load / insert / export / clear left this router with their rows: they are the EDITOR's file
        // actions and now live in the editor's corner menu (ui/globalFunctions.js EDITOR_FILE_ACTIONS).
        case 'standalone':
            // The "standalone" IS the desktop EXE (bundles the gateway, runs fully offline) — open the SAME
            // release link the Gateway page uses (gatewayStatus.EXE_DOWNLOAD_URL → the latest GitHub release).
            window.open(EXE_DOWNLOAD_URL, '_blank', 'noopener');
            break;
        case 'settings': window.openSettings?.(); break;
        case 'checklist': window.openSetupChecklist?.(); break;
        case 'setupSheet': openSetupSheet(); break;   // t850 — the print-ready job page
        case 'library': openLibrary(); break;   // t854 — the Library (last-used tab)
        case 'rate': window.ddcsOpenRate?.(); break;   // t598 — the always-available Rate / Feedback path (opens the repo)
        // t1223 — WORKSPACE (the .ddcs). Both open the ONE manager modal, on the half the user asked for: Save
        // focuses the current workspace + its delta, Open focuses the granted folder's cards.
        case 'wsSave': window.openWorkspaceManager?.('save'); break;
        case 'wsOpen': window.openWorkspaceManager?.('open'); break;
    }
}

function setQuickTheme(name) {
    try {
        const tm = window.ddcsStudio && window.ddcsStudio.themeManager;
        if (tm && tm.setCurrent) tm.setCurrent(name);
        else { document.body.setAttribute('data-theme', name); localStorage.setItem('ddcs_theme', name); }
    } catch (_) { document.body.setAttribute('data-theme', name); }
}

// t1243 — openCloudModal is DELETED with the ☁ badge that opened it. The shared renderCloudLogin it hosted is
// still the ONE connect UI (Settings + the projects drawer use it); the workspace manager's Cloud tab is the
// wizard-side door now, carrying sign-in, the signed-in account and sign-out.

export function initHeaderPost() {
    const btn = document.getElementById('hdrPostBtn');
    const menu = document.getElementById('hdrPostMenu');
    if (!btn || !menu) return;
    const warnEl = document.getElementById('hdrPostWarn');

    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const svgIco = (k) => `<svg class="hq-ico" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="${HQ_ICONS[k].c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${HQ_ICONS[k].d}</svg>`;

    // Build the quick-actions popover — menu diet (t851): ~17 rows → ~9, and t1227 curation: 10 → 8.
    // Layout: identity row · workspace row (Save/Open) · Library… · Theme · Setup sheet… · Setup checklist · Settings… · Rate.
    // MOVED NOT LOST: Save/Open/wizard → Library; Pull → Gateway (↧ on identity row); standalone/checklist → Settings;
    // and t1227 Load/Insert/Export/Clear → the EDITOR's corner file menu, the pane they act on.
    let postSubOpen = false;    // (preserved for the post-switch handler below; no post rows emitted in the slimmed menu)
    let themeSubOpen = false;

    const fillMenu = () => {
        const machinePost = getDialect(getActiveProfile().id);
        const active = getActivePostId();
        const curTheme = document.body.getAttribute('data-theme') || 'studio';
        // (t1227 — the generic `actionRow` helper went with its last caller, the Clear editor row.)
        const themeRow = (name) => {
            const label = name[0].toUpperCase() + name.slice(1);
            return `<button type="button" role="menuitemradio" class="hq-theme-chip${curTheme === name ? ' active' : ''}" data-theme="${name}" title="${label}" aria-label="${label} theme" aria-checked="${curTheme === name}" style="--chip:${HQ_THEME_SWATCH[name] || '#888'}"></button>`;
        };

        // ── IDENTITY LINE (t1227 amendment, user) ─────────────────────────────────────────────────────
        // It was a big compound BUTTON whose tap opened the machine's settings — a door built for the retired profile
        // world. It is now one QUIET PLAIN-TEXT line, "<workspace> · <dialect>", sitting directly above Save / Open so
        // a save has its context: no click handler, no button styling, nothing to press by accident.
        // The ↧ span stays: it is its OWN tap target for a live feature (pull from the controller) — never the row's
        // retired click. (t1243 — the ☁ badge that sat beside it moved to the workspace manager's Cloud tab.)
        const ap = getMachine();
        const apCtrl = (CONTROLLER_PROFILES[ap.controllerId] || {}).name || ap.controllerId || '';
        // t1231 (user) — the line also carries the ENVELOPE, signed, from the SAME formatter the manager rows and the
        // Settings band use. Three surfaces, one source: they cannot describe the same machine differently.
        const apEnv = envelopeSummary((window.ddcsGetSettings && window.ddcsGetSettings().machine) || {});
        // t1243 (user) — THE ☁ BADGE IS GONE. Cloud access lives in ONE place: the workspace manager's Local | Cloud
        // tabs, which carry the sign-in, the signed-in account and the sign-out. A second door in the header meant two
        // places to learn for one connection. The ↧ PULL span stays — that is a controller read, not a cloud thing.
        const identityRow =
            `<div class="hq-identity-line hq-identity">`
            + `<span class="hq-identity-txt"><b>${esc(ap.name || 'Untitled workspace')}</b>`
            + `<span class="hq-cur"> · ${esc(apCtrl)}</span>`
            + (apEnv ? `<span class="hq-cur hq-env"> · ${esc(apEnv)}</span>` : '')
            + `</span>`
            + `<span class="hq-pull-btn" data-profact="pull" role="button" tabindex="0" title="Pull from controller">↧</span>`
            + `</div>`;

        // t1227 CURATION (user ruling): the GCODE ROW (Load / Insert / Export) and CLEAR EDITOR are GONE from here.
        // They act on the program in the editor pane, and this menu is where you look for APP things — so they moved
        // to the editor's own corner file menu (index.html #editor-file-btn → ddcsEditorFileMenu). Same handlers, one
        // place. What is left in this menu is the WORKSPACE and app-level entries.

        // ── t1223 (1) — WORKSPACE ROW: Save + Open are the PRIMARY buttons, and all workspace management lives
        //    here rather than in a new header menu. ────────────────────────────────────────────────────────────
        const workspaceRow =
            `<div class="hq-ws-row">`   // its OWN class (a workspace row is not a gcode row); the menu-diet spec counts it
            + `<button type="button" class="hq-ws-btn" data-act="wsSave" title="Save this workspace to its .ddcs file">💾 Save</button>`
            + `<button type="button" class="hq-ws-btn" data-act="wsOpen" title="Open a workspace from your workspaces folder">📂 Open</button>`
            + `</div>`;

        // ── THEME ─────────────────────────────────────────────────────────────────────────────────────
        const themeSection = '<div class="hdr-quick-sep"></div><div class="hdr-quick-head">Theme</div>'
            + `<div class="hdr-quick-subitems" data-subitems="theme">${THEMES.map(themeRow).join('')}</div>`;

        // ── UTILITY ROWS ──────────────────────────────────────────────────────────────────────────────
        // t854 — the Library: one door to Profiles · Projects · Wizards.
        const libraryRow =
            '<button type="button" role="menuitem" class="hdr-quick-item" data-act="library">'
            + '<span class="hdr-quick-check" aria-hidden="true"></span>' + svgIco('library')
            + '<span class="hdr-quick-lbl">Library…</span></button>';
        const healthOn = (window.ddcsHealthSignalsOn ? window.ddcsHealthSignalsOn() : true);
        const checklistRow = !healthOn ? '' :
            '<button type="button" role="menuitem" class="hdr-quick-item" data-act="checklist">'
            + '<span class="hdr-quick-check" aria-hidden="true"></span>' + svgIco('checklist')
            + '<span class="hdr-quick-lbl">Setup checklist</span></button>';

        // t850 — print-ready job page.
        const setupSheetRow =
            '<button type="button" role="menuitem" class="hdr-quick-item" data-act="setupSheet">'
            + '<span class="hdr-quick-check" aria-hidden="true"></span>' + svgIco('setupSheet')
            + '<span class="hdr-quick-lbl">Setup sheet…</span></button>';
        const settingsRow =
            '<button type="button" role="menuitem" class="hdr-quick-item" data-act="settings">'
            + '<span class="hdr-quick-check" aria-hidden="true"></span>' + svgIco('settings')
            + '<span class="hdr-quick-lbl">Settings…</span></button>';
        // t598 — always-available Rate / Feedback.
        const rateRow =
            '<button type="button" role="menuitem" class="hdr-quick-item" data-act="rate">'
            + '<span class="hdr-quick-check" aria-hidden="true"></span><span class="hdr-quick-lbl">⭐ Rate / Feedback</span></button>';

        // ── ASSEMBLE — the workspace, then app-level entries (t1227: the editor's file rows are no longer here) ──
        menu.innerHTML =
            identityRow          // t1227 — the quiet name · dialect line sits WITH the workspace buttons (save context)
            + workspaceRow
            + '<div class="hdr-quick-sep"></div>'
            + libraryRow
            + themeSection
            + '<div class="hdr-quick-sep"></div>'
            + setupSheetRow + checklistRow + settingsRow + rateRow;

        btn.title = `Quick actions — ${ap.name || 'untitled workspace'} · ${apCtrl}`;
        btn.setAttribute('aria-label', `Quick actions (${ap.name || 'untitled workspace'} · ${apCtrl})`);
    };

    const onDocClick = (e) => { if (!menu.contains(e.target) && !btn.contains(e.target)) closeMenu(); };
    const onKey = (e) => { if (e.key === 'Escape') { closeMenu(); btn.focus(); } };
    function closeMenu() {
        if (menu.hidden) return;
        menu.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
        document.removeEventListener('click', onDocClick, true);
        document.removeEventListener('keydown', onKey, true);
    }
    function openMenu() {
        fillMenu();
        menu.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
        document.addEventListener('click', onDocClick, true);
        document.addEventListener('keydown', onKey, true);
    }

    // Warn (don't break) when the loaded program uses capabilities the active post lacks.
    const lint = () => {
        if (!warnEl) return;
        const post = resolveActivePost(getActiveProfile().id);   // the post that's actually active (override or profile)
        const caps = getCaps(post.id);
        const ed = document.getElementById('editor');
        const text = ed ? ed.value : '';
        const hasVars = /#\d/.test(text);
        const hasProbe = /\b(?:G38\.2|G31|M101)\b/.test(text);
        let msg = '';
        if (!caps.vars && hasVars) {
            msg = `${post.name} can't run this program — it uses #variables (a probe/ATC macro). Probing on this `
                + `controller is host-side (stream G38.2 → read [PRB:] → G10 L20); the emitted macro won't execute as-is.`;
        } else if (caps.flowStreamable === false && (hasProbe || hasVars)) {
            msg = `${post.name}: load this macro from SD/littlefs — its O-word flow doesn't run while streaming over serial.`;
        }
        let linterMsg = '';
        if (post.id.includes('ddcs')) {
            const res = validate(text);
            if (!res.ok || res.warnings > 0) {
                linterMsg = summarize(res) + ' - ' + res.findings.map(f => `Line ${f.line}: ${f.msg}`).join(' | ');
            }
        }

        const combinedMsg = [msg, linterMsg].filter(Boolean).join('\n\n');
        warnEl.hidden = !combinedMsg;
        warnEl.title = combinedMsg;

        const statusBar = document.getElementById('editor-statusbar');
        const statusText = document.getElementById('editor-status-text');
        if (statusBar && statusText) {
            statusBar.classList.toggle('hidden', !linterMsg);
            statusText.textContent = linterMsg;
        }
    };

    const copyBtn = document.getElementById('editor-status-copy');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const statusText = document.getElementById('editor-status-text');
            if (!statusText || !statusText.textContent) return;
            const text = statusText.textContent;
            
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text);
            } else {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                try { document.execCommand('copy'); } catch (e) {}
                document.body.removeChild(ta);
            }
            
            copyBtn.style.color = '#00ff00';
            setTimeout(() => copyBtn.style.color = '', 500);
        });
    }

    // Floating Copy-program button in the editor (moved out of the quick-menu) → copy the whole program + flash.
    const progCopyBtn = document.getElementById('editor-copy-btn');
    if (progCopyBtn) {
        progCopyBtn.addEventListener('click', () => {
            window.copyCode?.();
            progCopyBtn.classList.add('copied');
            setTimeout(() => progCopyBtn.classList.remove('copied'), 600);
        });
    }

    fillMenu();

    btn.addEventListener('click', (e) => { e.stopPropagation(); if (menu.hidden) openMenu(); else closeMenu(); });

    // Route a menu click: an identity-line sub-target (☁ / ↧), a workspace button, a theme chip, or a menu row.
    menu.addEventListener('click', (e) => {
        const exactPull = e.target.closest('.hq-pull-btn[data-profact]');
        if (exactPull) {
            closeMenu();
            if (window.openSettings) window.openSettings({ group: 'controller', panel: 'set_tab_profile' });
            setTimeout(() => { const b = document.getElementById('set_profile_pull'); if (b) b.click(); }, 60);
            return;
        }

        // workspace-row inline action buttons (they carry data-act)
        const rowBtn = e.target.closest('.hq-ws-btn');
        if (rowBtn && rowBtn.dataset.act) { closeMenu(); runQuickAction(rowBtn.dataset.act); return; }

        const it = e.target.closest('.hdr-quick-item, .hq-theme-chip');
        if (!it) return;

        // A submenu header toggles its list open/closed and keeps the menu open.
        if (it.dataset.sub) {
            const list = menu.querySelector(`.hdr-quick-subitems[data-subitems="${it.dataset.sub}"]`);
            const willOpen = list ? list.hidden : false;
            if (list) list.hidden = !willOpen;
            it.classList.toggle('is-open', willOpen);
            it.setAttribute('aria-expanded', String(willOpen));
            if (it.dataset.sub === 'post') postSubOpen = willOpen;
            if (it.dataset.sub === 'theme') themeSubOpen = willOpen;
            return;
        }

        if (it.dataset.theme) { setQuickTheme(it.dataset.theme); fillMenu(); return; }   // chips stay open; just refresh the active ring
        closeMenu();
        if (it.dataset.act) { runQuickAction(it.dataset.act); return; }
        // t1227 — the identity's own `browse` click (open the machine's settings) is GONE with its button: it was a
        // door built for the retired profile world. ☁ and ↧ are handled above, on the exact span that was tapped.
        if (!it.dataset.post) return;   // (dialect switching removed from the menu — no data-post items remain)

        setActivePostId(it.dataset.post);                           // persist the active post (override or 'auto')

        // Automatically sync the variable DB to the active post's family
        const post = resolveActivePost(getActiveProfile().id);
        const vdb = window.ddcsStudio && window.ddcsStudio.variableDB;
        if (vdb && post) {
            let fam = 'expert';
            if (post.id.includes('v4')) fam = 'v4.1';
            else if (post.id.includes('centroid')) fam = 'centroid';
            else if (post.id.includes('rs274ngc') || post.id.includes('linuxcnc')) fam = 'rs274ngc';
            else if (post.id.includes('mach3')) fam = 'mach3';
            else if (post.id.includes('mach4')) fam = 'mach4';
            else if (post.id.includes('uccnc')) fam = 'uccnc';
            vdb.setControllerVars(fam);
        }

        if (window.ddcsRefreshBlocks) window.ddcsRefreshBlocks();   // re-project Blocks/editor in the new post
        window.dispatchEvent(new CustomEvent('ddcs:settings-changed'));   // re-render open previews/wizards
        lint();
    });

    // Re-sync the 'Auto · <name>' tooltip + re-lint when the profile/post or program changes elsewhere.
    window.addEventListener('ddcs:settings-changed', () => { fillMenu(); lint(); });
    const ed = document.getElementById('editor');
    if (ed) ed.addEventListener('input', lint);
    lint();
}
