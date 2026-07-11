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
import { openProfileModal, recentProfileIds, pushRecentProfile } from './profileModal.js';   // t688 b2 — the header PROFILE section
import * as ProfLib from '../data/profileLibrary.js';
import { THEMES } from './themes.js';
import { EXE_DOWNLOAD_URL } from './gatewayStatus.js';   // the "standalone" desktop EXE release link (same as the Gateway page)

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
    wizard: { c: '#a855f7', d: '<path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/>' },
};
// data-act → the existing handler it proxies (file ops are window globals; Open/Save click their header buttons).
const HQ_ACTIONS = [
    { act: 'open',   label: 'Open project' },
    { act: 'save',   label: 'Save project' },
    { act: 'wizard', label: 'Save as custom wizard' },   // register the current op's stack as a bar button (+ its form)
    { act: 'load',   label: 'Load file' },
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
        case 'load':   window.loadGcodeFile?.(); break;
        case 'insert': window.insertGcodeFile?.(); break;
        case 'clear':  window.clearCode?.(); break;
        case 'export': window.downloadFile?.(); break;
        case 'standalone':
            // The "standalone" IS the desktop EXE (bundles the gateway, runs fully offline) — open the SAME
            // release link the Gateway page uses (gatewayStatus.EXE_DOWNLOAD_URL → the latest GitHub release).
            window.open(EXE_DOWNLOAD_URL, '_blank', 'noopener');
            break;
        case 'settings': window.openSettings?.(); break;
        case 'checklist': window.openSetupChecklist?.(); break;
        case 'rate': window.ddcsOpenRate?.(); break;   // t598 — the always-available Rate / Feedback path (opens the repo)
    }
}

function setQuickTheme(name) {
    try {
        const tm = window.ddcsStudio && window.ddcsStudio.themeManager;
        if (tm && tm.setCurrent) tm.setCurrent(name);
        else { document.body.setAttribute('data-theme', name); localStorage.setItem('ddcs_theme', name); }
    } catch (_) { document.body.setAttribute('data-theme', name); }
}

export function initHeaderPost() {
    const btn = document.getElementById('hdrPostBtn');
    const menu = document.getElementById('hdrPostMenu');
    if (!btn || !menu) return;
    const warnEl = document.getElementById('hdrPostWarn');

    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const svgIco = (k) => `<svg class="hq-ico" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="${HQ_ICONS[k].c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${HQ_ICONS[k].d}</svg>`;

    // Build the quick-actions popover: Program (file ops) · Post-processor (dialect) · Theme. The dialect
    // and theme rows carry a ✓ on the active one; the chevron's tooltip names the active post.
    let postSubOpen = false;    // Generate-for + Theme are collapsible submenus (start collapsed)
    let themeSubOpen = false;

    const fillMenu = () => {
        const machinePost = getDialect(getActiveProfile().id);
        const active = getActivePostId();
        const autoLabel = `Auto · ${machinePost.name}`;
        const curTheme = document.body.getAttribute('data-theme') || 'studio';
        const activeName = active === 'auto' ? autoLabel : (listPosts().find((p) => p.id === active)?.name || active);

        const actionRow = (a) =>
            `<button type="button" role="menuitem" class="hdr-quick-item" data-act="${a.act}">`
            + '<span class="hdr-quick-check" aria-hidden="true"></span>' + svgIco(a.act)
            + `<span class="hdr-quick-lbl">${a.label}</span></button>`;
        const postRow = (value, label, warn) =>
            `<button type="button" role="menuitemradio" class="hdr-quick-item" data-post="${esc(value)}" aria-checked="${active === value}">`
            + `<span class="hdr-quick-check" aria-hidden="true">${active === value ? '✓' : ''}</span>`
            + `<span class="hdr-quick-lbl">${esc(label)}</span>`
            + (warn ? '<span class="hdr-quick-warn" title="Not yet verified">⚠</span>' : '')
            + '</button>';
        // Theme picker = a horizontal row of colour chips (tooltip = theme name); the active one gets a ring.
        const themeRow = (name) => {
            const label = name[0].toUpperCase() + name.slice(1);
            return `<button type="button" role="menuitemradio" class="hq-theme-chip${curTheme === name ? ' active' : ''}" data-theme="${name}" title="${label}" aria-label="${label} theme" aria-checked="${curTheme === name}" style="--chip:${HQ_THEME_SWATCH[name] || '#888'}"></button>`;
        };

        // Post-processor + Theme are collapsible SUBMENUS: the row shows the active value; click expands.
        const sub = (key, label, cur, open, body) =>
            `<button type="button" class="hdr-quick-item hdr-quick-sub${open ? ' is-open' : ''}" data-sub="${key}" aria-expanded="${open}">`
            + '<span class="hdr-quick-check" aria-hidden="true"></span>'
            + `<span class="hdr-quick-lbl">${label}<span class="hq-cur"> · ${esc(cur)}</span></span>`
            + '<span class="hq-caret" aria-hidden="true">▸</span></button>'
            + `<div class="hdr-quick-subitems" data-subitems="${key}"${open ? '' : ' hidden'}>${body}</div>`;

        // t688 b2 — the PROFILE section REPLACES "Generate for". Read-only current profile + controller, up to 3 recents
        // (one-click full-swap), and the modal doors. NO dialect/controller switching here — that stays on the Settings
        // controller dropdown (with its per-post warning triangles). One override surface beats two.
        const ap = ProfLib.activeProfile() || {};
        const apCtrl = (CONTROLLER_PROFILES[ap.controllerId] || {}).name || ap.controllerId || '';
        const recents = recentProfileIds().filter((id) => id !== ProfLib.activeProfileId()).slice(0, 3);
        const recentRows = recents.map((id) => {
            const p = ProfLib.listProfiles().find((x) => x.id === id); if (!p) return '';
            const c = (CONTROLLER_PROFILES[p.controllerId] || {}).name || p.controllerId || '';
            return `<button type="button" role="menuitem" class="hdr-quick-item" data-profswitch="${esc(id)}" title="Switch to this profile (full-swap)"><span class="hdr-quick-check" aria-hidden="true"></span><span class="hdr-quick-lbl">↔ ${esc(p.name || '(unnamed)')}<span class="hq-cur"> · ${esc(c)}</span></span></button>`;
        }).join('');
        const profAct = (act, label) => `<button type="button" role="menuitem" class="hdr-quick-item" data-profact="${act}"><span class="hdr-quick-check" aria-hidden="true"></span><span class="hdr-quick-lbl">${label}</span></button>`;
        const profileSection = '<div class="hdr-quick-head">Profile</div>'
            + `<div class="hdr-quick-cur" style="display:flex; align-items:center; gap:8px; padding:5px 12px; font-size:13px; opacity:.92; cursor:default;"><span class="hdr-quick-lbl"><b>${esc(ap.name || '(unnamed configuration)')}</b><span class="hq-cur"> · ${esc(apCtrl)}</span></span></div>`
            + recentRows
            + profAct('browse', '🗂 Profiles…') + profAct('saveas', '＋ Save as…') + profAct('pull', '↧ Pull from controller');
        // Theme picker is no longer collapsed — the chips are compact, so show them directly under a heading.
        const themeSection = '<div class="hdr-quick-sep"></div><div class="hdr-quick-head">Theme</div>'
            + `<div class="hdr-quick-subitems" data-subitems="theme">${THEMES.map(themeRow).join('')}</div>`;

        // The Setup checklist entry is hidden when the master health switch is off (Settings / the checklist toggle).
        const healthOn = (window.ddcsHealthSignalsOn ? window.ddcsHealthSignalsOn() : true);
        const checklistRow = !healthOn ? '' :
            '<button type="button" role="menuitem" class="hdr-quick-item" data-act="checklist">'
            + '<span class="hdr-quick-check" aria-hidden="true"></span>' + svgIco('checklist')
            + '<span class="hdr-quick-lbl">Setup checklist</span></button>';
        const settingsRow =
            '<button type="button" role="menuitem" class="hdr-quick-item" data-act="settings">'
            + '<span class="hdr-quick-check" aria-hidden="true"></span>' + svgIco('settings')
            + '<span class="hdr-quick-lbl">Settings…</span></button>';
        // t598 — ALWAYS-AVAILABLE "Rate / Feedback" (the unprompted path — opens the GitHub repo to star / give feedback).
        const rateRow =
            '<button type="button" role="menuitem" class="hdr-quick-item" data-act="rate">'
            + '<span class="hdr-quick-check" aria-hidden="true"></span><span class="hdr-quick-lbl">⭐ Rate / Feedback</span></button>';

        menu.innerHTML = '<div class="hdr-quick-head">Program</div>'
            + HQ_ACTIONS.map(actionRow).join('')
            + '<div class="hdr-quick-sep"></div>'
            + actionRow(HQ_STANDALONE)
            + '<div class="hdr-quick-sep"></div>' + profileSection
            + themeSection
            + '<div class="hdr-quick-sep"></div>' + checklistRow + settingsRow + rateRow;

        btn.title = `Quick actions — open / save / load / export, profile (${ap.name || 'unnamed'} · ${apCtrl}), theme. Click to open.`;
        btn.setAttribute('aria-label', `Quick actions (profile: ${ap.name || 'unnamed'} · ${apCtrl})`);
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

    // Route a menu click: a file action, a theme, or a post pick (the post path keeps the old <select> effects).
    menu.addEventListener('click', (e) => {
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
        // t688 b2 — PROFILE section: a recent switches (full-swap); the doors open the modal / the pull flow.
        if (it.dataset.profswitch) { ProfLib.switchProfile(it.dataset.profswitch); pushRecentProfile(it.dataset.profswitch); window.dispatchEvent(new CustomEvent('ddcs:settings-changed')); return; }
        if (it.dataset.profact) {
            const a = it.dataset.profact;
            if (a === 'browse') openProfileModal('browse');
            else if (a === 'saveas') openProfileModal('save');
            else if (a === 'pull') { if (window.openSettings) window.openSettings({ group: 'controller', panel: 'set_tab_profile' }); setTimeout(() => { const b = document.getElementById('set_profile_pull'); if (b) b.click(); }, 60); }
            return;
        }
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
