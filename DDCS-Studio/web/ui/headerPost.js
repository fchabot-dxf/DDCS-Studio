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
import { getActiveProfile } from '../shared/js/profiles/controllerProfiles.js';
import { validate, summarize } from '../shared/js/validate/validate.js';
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
};
// data-act → the existing handler it proxies (file ops are window globals; Open/Save click their header buttons).
const HQ_ACTIONS = [
    { act: 'open',   label: 'Open project' },
    { act: 'save',   label: 'Save project' },
    { act: 'load',   label: 'Load file' },
    { act: 'insert', label: 'Insert file' },
    { act: 'copy',   label: 'Copy program' },
    { act: 'clear',  label: 'Clear editor' },
    { act: 'export', label: 'Export / download' },
    { act: 'standalone', label: 'Download standalone' },
];
const HQ_THEME_SWATCH = { studio: '#9aa0a6', normal: '#4a90e2', steampunk: '#b07a2a', futuristic: '#00e5e5', organic: '#6b8e23' };

function runQuickAction(act) {
    switch (act) {
        case 'open':   document.getElementById('projOpenBtn')?.click(); break;
        case 'save':   document.getElementById('projSaveBtn')?.click(); break;
        case 'load':   window.loadGcodeFile?.(); break;
        case 'insert': window.insertGcodeFile?.(); break;
        case 'copy':   window.copyCode?.(); break;
        case 'clear':  window.clearCode?.(); break;
        case 'export': window.downloadFile?.(); break;
        case 'standalone':
            // The "standalone" IS the desktop EXE (bundles the gateway, runs fully offline) — open the SAME
            // release link the Gateway page uses (gatewayStatus.EXE_DOWNLOAD_URL → the latest GitHub release).
            window.open(EXE_DOWNLOAD_URL, '_blank', 'noopener');
            break;
        case 'settings': window.openSettings?.(); break;
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
    let postSubOpen = false;    // Post-processor + Theme are collapsible submenus (start collapsed)
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
        const themeRow = (name) =>
            `<button type="button" role="menuitemradio" class="hdr-quick-item" data-theme="${name}" aria-checked="${curTheme === name}">`
            + `<span class="hdr-quick-check" aria-hidden="true">${curTheme === name ? '✓' : ''}</span>`
            + `<span class="hq-swatch" style="background:${HQ_THEME_SWATCH[name] || '#888'}"></span>`
            + `<span class="hdr-quick-lbl">${name[0].toUpperCase() + name.slice(1)}</span></button>`;

        // Post-processor + Theme are collapsible SUBMENUS: the row shows the active value; click expands.
        const sub = (key, label, cur, open, body) =>
            `<button type="button" class="hdr-quick-item hdr-quick-sub${open ? ' is-open' : ''}" data-sub="${key}" aria-expanded="${open}">`
            + '<span class="hdr-quick-check" aria-hidden="true"></span>'
            + `<span class="hdr-quick-lbl">${label}<span class="hq-cur"> · ${esc(cur)}</span></span>`
            + '<span class="hq-caret" aria-hidden="true">▸</span></button>'
            + `<div class="hdr-quick-subitems" data-subitems="${key}"${open ? '' : ' hidden'}>${body}</div>`;

        const postSub = sub('post', 'Post-processor', activeName, postSubOpen,
            postRow('auto', autoLabel, false) + listPosts().map((p) => postRow(p.id, p.name, !p.verified)).join(''));
        const themeSub = sub('theme', 'Theme', curTheme[0].toUpperCase() + curTheme.slice(1), themeSubOpen,
            THEMES.map(themeRow).join(''));

        const settingsRow =
            '<button type="button" role="menuitem" class="hdr-quick-item" data-act="settings">'
            + '<span class="hdr-quick-check" aria-hidden="true"></span>' + svgIco('settings')
            + '<span class="hdr-quick-lbl">Settings…</span></button>';

        menu.innerHTML = '<div class="hdr-quick-head">Program</div>'
            + HQ_ACTIONS.map(actionRow).join('')
            + '<div class="hdr-quick-sep"></div>' + postSub
            + '<div class="hdr-quick-sep"></div>' + themeSub
            + '<div class="hdr-quick-sep"></div>' + settingsRow;

        btn.title = `Quick actions — open / save / load / export, post-processor (${activeName}), theme. Click to open.`;
        btn.setAttribute('aria-label', `Quick actions (post-processor: ${activeName})`);
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

    fillMenu();

    btn.addEventListener('click', (e) => { e.stopPropagation(); if (menu.hidden) openMenu(); else closeMenu(); });

    // Route a menu click: a file action, a theme, or a post pick (the post path keeps the old <select> effects).
    menu.addEventListener('click', (e) => {
        const it = e.target.closest('.hdr-quick-item');
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

        closeMenu();
        if (it.dataset.act) { runQuickAction(it.dataset.act); return; }
        if (it.dataset.theme) { setQuickTheme(it.dataset.theme); return; }

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
